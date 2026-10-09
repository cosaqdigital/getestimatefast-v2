const LAUNCH_CATALOG = require("../assets/launch-categories");
const THANK_YOU_URL = "https://www.getestimatefast.com/thank-you.html";
const DEFAULT_FROM_EMAIL = "GetEstimateFast <onboarding@resend.dev>";
const MAX_ATTACHMENT_SIZE = 5 * 1024 * 1024;
const MAX_REQUEST_SIZE = 15 * 1024 * 1024;
const MAX_ATTACHMENT_COUNT = 3;

module.exports = async function handler(req, res) {
  if (process.env.GETESTIMATEFAST_ISOLATED_BACKEND === "true" ||
      (process.env.VERCEL_ENV === "preview" && process.env.VERCEL_GIT_COMMIT_REF === "feat/isolated-preview-stripe-test-20261009")) {
    return sendErrorPage(res, 503, "Public submissions and external email delivery are disabled in this isolated test environment.");
  }
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return sendErrorPage(res, 405, "This page only accepts form submissions.");
  }

  if (!process.env.RESEND_API_KEY || !process.env.LEAD_TO_EMAIL) {
    console.error("Missing RESEND_API_KEY or LEAD_TO_EMAIL environment variable.");
    return sendErrorPage(res, 500, "Email delivery is not configured yet. Please try again shortly.");
  }

  let savedLeadId = null;
  try {
    const formData = await parseFormData(req);
    const fields = normalizeFields(formData);

    if (isSpamSubmission(fields)) {
      if (process.env.VERCEL_ENV === "preview") {
        console.warn("Preview test rejected by honeypot; no lead was saved.");
        return sendErrorPage(res, 400, "Test submission blocked by anti-spam field. No request was saved.");
      }
      return redirectToThankYou(res);
    }

    const validationError = validateLead(fields);
    if (validationError) {
      return sendErrorPage(res, 400, validationError);
    }

    // Persistence is opt-in until an isolated GetEstimateFast database is provisioned.
    // With enabled persistence, fail closed before emailing: never imply a request was saved.
    if (process.env.LEAD_PERSISTENCE_ENABLED === "true") {
      try {
        const persistenceResult = await persistLead(fields);
        if (persistenceResult.duplicate) return redirectToThankYou(res);
        savedLeadId = persistenceResult.id;
      } catch (persistError) {
        console.error("GetEstimateFast lead storage failed:", persistError.message);
        return sendErrorPage(res, 503, "We couldn't save your request right now. Please try again shortly.");
      }
    }

    const attachments = await collectAttachments(formData);
    const subject = buildSubject(fields);
    if (savedLeadId) fields["Request ID"] = savedLeadId;
    const replyTo = firstValue(fields["Email Address"]);

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from: process.env.LEAD_FROM_EMAIL || DEFAULT_FROM_EMAIL,
        to: [process.env.LEAD_TO_EMAIL],
        subject,
        html: renderLeadEmail(subject, fields, attachments),
        text: renderLeadText(subject, fields, attachments),
        reply_to: replyTo || undefined,
        attachments: attachments.map((file) => ({
          filename: file.filename,
          content: file.content
        }))
      })
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error("Resend API error:", response.status, errorBody);
      if (savedLeadId) return redirectToThankYou(res);
      return sendErrorPage(res, 502, "We couldn't deliver your request right now. Please try again in a moment.");
    }

    return redirectToThankYou(res);
  } catch (error) {
    console.error("Lead submission failed:", error);
    if (savedLeadId) return redirectToThankYou(res);
    return sendErrorPage(res, 500, "We couldn't send your request right now. Please go back and try again in a moment.");
  }
};

async function persistLead(fields) {
  const endpoint = String(process.env.GETESTIMATEFAST_SUPABASE_URL || "").replace(/\/$/, "");
  const key = process.env.GETESTIMATEFAST_SUPABASE_SECRET_KEY;
  if (!endpoint || !/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(endpoint) || !key) {
    throw new Error("Independent database environment is not configured");
  }

  const rawToken = firstValue(fields["Submission Token"]);
  const submissionToken = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(rawToken) ? rawToken : null;
  const response = await fetch(endpoint + "/rest/v1/leads?on_conflict=submission_token&select=id", {
    method: "POST",
    headers: {
      apikey: key,
      ...(key.startsWith("sb_secret_") ? {} : { Authorization: "Bearer " + key }),
      "Content-Type": "application/json",
      Prefer: "resolution=ignore-duplicates,return=representation"
    },
    body: JSON.stringify({
      submission_token: submissionToken,
      service_type: firstValue(fields["Service Type"]),
      status: "new", // Manual review before qualification or publishing.
      full_name: firstValue(fields["Full Name"]),
      email: firstValue(fields["Email Address"]),
      phone: firstValue(fields["Phone Number"]),
      city: firstValue(fields["City"]),
      zip_code: firstValue(fields["ZIP Code"]),
      contact_method: firstValue(fields["Preferred contact method"]) || null,
      details: {
        ...fields,
        _platform_review: {
          required: true,
          reason: manualReviewReason(fields),
          original_service: firstValue(fields["Service Type"])
        }
      },
      source: "getestimatefast.com"
    })
  });
  if (!response.ok) {
    throw new Error("Lead database insert returned HTTP " + response.status);
  }
  const records = await response.json();
  if (!Array.isArray(records)) throw new Error("Invalid lead database response");
  if (records.length === 0 && submissionToken) return { duplicate: true };
  if (!records[0] || !records[0].id) throw new Error("Lead database returned no ID");
  return { duplicate: false, id: records[0].id };
}

// Pure, server-derived review marker; descriptions are never blocked by
// service keywords or inferred licensing requirements.
function manualReviewReason(fields) {
  const service = firstValue(fields["Service Type"]);
  const category = LAUNCH_CATALOG.findByName(service);
  if (category?.slug === "other-services") return "other_services";
  if (!category) return "unlisted_or_legacy_category";
  return "standard_request";
}

async function parseFormData(req) {
  const bodyBuffer = await readRequestBody(req);
  const contentType = String(req.headers["content-type"] || "");
  const request = new Request("https://www.getestimatefast.com/api/lead", {
    method: "POST",
    headers: { "content-type": contentType },
    body: bodyBuffer
  });

  return request.formData();
}

function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;
    req.on("data", (chunk) => {
      total += chunk.length;
      if (total > MAX_REQUEST_SIZE) {
        reject(new Error("Request payload exceeds size limit"));
        req.pause();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => { if (total <= MAX_REQUEST_SIZE) resolve(Buffer.concat(chunks)); });
    req.on("error", reject);
  });
}

function normalizeFields(formData) {
  const normalized = {};

  for (const [key, rawValue] of formData.entries()) {
    if (isFileLike(rawValue)) continue;

    const value = String(rawValue == null ? "" : rawValue).trim();
    if (!value) continue;

    if (normalized[key]) {
      normalized[key] = Array.isArray(normalized[key])
        ? [...normalized[key], value]
        : [normalized[key], value];
    } else {
      normalized[key] = value;
    }
  }

  return normalized;
}

async function collectAttachments(formData) {
  const attachments = [];

  for (const [, rawValue] of formData.entries()) {
    if (!isFileLike(rawValue)) continue;
    if (!rawValue.size || rawValue.size <= 0) continue;
    if (rawValue.size > MAX_ATTACHMENT_SIZE) throw new Error("Attachment exceeds size limit");
    if (attachments.length >= MAX_ATTACHMENT_COUNT) throw new Error("Too many attachments");
    if (!["image/jpeg", "image/png", "image/webp", "application/pdf"].includes(rawValue.type)) throw new Error("Unsupported attachment type");

    const arrayBuffer = await rawValue.arrayBuffer();
    attachments.push({
      filename: rawValue.name || "attachment",
      content: Buffer.from(arrayBuffer).toString("base64"),
      size: rawValue.size
    });
  }

  return attachments;
}

function isSpamSubmission(fields) {
  return Boolean(firstValue(fields.gef_hp_trap_47b) || firstValue(fields.company) || firstValue(fields.website));
}

function validateLead(fields) {
  const required = ["Service Type", "Full Name", "Phone Number", "Email Address", "City", "ZIP Code"];

  for (const field of required) {
    if (!firstValue(fields[field])) {
      return `Please complete the ${field.toLowerCase()} field and try again.`;
    }
  }

  // No service/category keyword filter here. Unlisted and older service categories
  // are retained for human review rather than automatically rejected.
  const service = firstValue(fields["Service Type"]);
  if (service.length > 120) return "Please shorten the service name.";
  if (service === "Other Services" && firstValue(fields["Project Description"]).length < LAUNCH_CATALOG.MIN_OTHER_DESCRIPTION) {
    return "Please describe your Other Services request using at least 60 characters.";
  }
  if (firstValue(fields["Project Description"]).length > 10000) {
    return "Please shorten the description to 10000 characters.";
  }

  const phoneDigits = firstValue(fields["Phone Number"]).replace(/\D/g, "");
  if (phoneDigits.length < 10) {
    return "Please enter a valid phone number and try again.";
  }

  const zip = firstValue(fields["ZIP Code"]);
  if (!/^\d{5}$/.test(zip)) {
    return "Please enter a valid 5-digit ZIP Code and try again.";
  }

  const email = firstValue(fields["Email Address"]);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return "Please enter a valid email address and try again.";
  }

  return "";
}

function buildSubject(fields) {
  const customerName = firstValue(fields["Full Name"]) || "Customer";
  const serviceType = firstValue(fields["Service Type"]) || "Service Request";
  const zip = firstValue(fields["ZIP Code"]) || "ZIP";

  if (slugify(serviceType) === "house-cleaning") {
    const detail =
      firstValue(fields["Cleaning Type"]) ||
      firstValue(fields["Cleaning Frequency"]) ||
      firstValue(fields["Timeline"]) ||
      "House Cleaning Request";

    return `${customerName} - House Cleaning - ${zip} - ${detail}`;
  }

  const timeline = firstValue(fields["Timeline"]) || "New Request";
  return `${customerName} - ${serviceType} - ${zip} - ${timeline}`;
}

function renderLeadEmail(subject, fields, attachments) {
  const rows = Object.entries(fields)
    .map(([key, value]) => {
      const displayValue = Array.isArray(value) ? value.join(", ") : value;
      return `<tr><td style="padding:10px 12px;border:1px solid #d9e3ee;font-weight:700;background:#f8fafc;">${escapeHtml(
        key
      )}</td><td style="padding:10px 12px;border:1px solid #d9e3ee;">${escapeHtml(displayValue)}</td></tr>`;
    })
    .join("");

  const attachmentBlock = attachments.length
    ? `<p style="margin:20px 0 0;color:#526275;"><strong>Attachments:</strong> ${attachments
        .map((file) => escapeHtml(file.filename))
        .join(", ")}</p>`
    : "";

  return `
    <div style="font-family:Arial,Helvetica,sans-serif;color:#102237;background:#f5f8fb;padding:24px;">
      <div style="max-width:760px;margin:0 auto;background:#ffffff;border:1px solid #d9e3ee;border-radius:18px;padding:24px;">
        <h1 style="margin:0 0 8px;font-size:28px;line-height:1.15;">${escapeHtml(subject)}</h1>
        <p style="margin:0 0 18px;color:#526275;">New lead received from GetEstimateFast.</p>
        <table style="width:100%;border-collapse:collapse;font-size:15px;line-height:1.6;">
          <tbody>${rows}</tbody>
        </table>
        ${attachmentBlock}
      </div>
    </div>
  `;
}

function renderLeadText(subject, fields, attachments) {
  const lines = [`${subject}`, "", "New lead received from GetEstimateFast.", ""];

  Object.entries(fields).forEach(([key, value]) => {
    const displayValue = Array.isArray(value) ? value.join(", ") : value;
    lines.push(`${key}: ${displayValue}`);
  });

  if (attachments.length) {
    lines.push("");
    lines.push(`Attachments: ${attachments.map((file) => file.filename).join(", ")}`);
  }

  return lines.join("\n");
}

function redirectToThankYou(res) {
  res.statusCode = 303;
  // Keep Preview on the same deployment for a verifiable test.
  res.setHeader("Location", process.env.VERCEL_ENV === "preview" ? "/thank-you.html" : THANK_YOU_URL);
  res.end();
}

function sendErrorPage(res, statusCode, message) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.end(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Request Error | GetEstimateFast</title>
  <style>
    body{margin:0;font-family:Arial,Helvetica,sans-serif;background:#eef3f8;color:#102237;}
    .wrap{max-width:720px;margin:48px auto;padding:0 18px;}
    .card{background:#fff;border:1px solid #d9e3ee;border-radius:18px;padding:28px;box-shadow:0 18px 42px rgba(16,34,55,.08);}
    h1{margin:0 0 12px;font-size:32px;line-height:1.1;}
    p{margin:0 0 18px;color:#526275;font-size:16px;line-height:1.7;}
    a{display:inline-flex;align-items:center;justify-content:center;min-height:46px;padding:0 18px;border-radius:12px;background:#f26419;color:#fff;text-decoration:none;font-weight:700;}
  </style>
</head>
<body>
  <div class="wrap">
    <div class="card">
      <h1>We couldn't send your request.</h1>
      <p>${escapeHtml(message)}</p>
      <a href="javascript:history.back()">Go back</a>
    </div>
  </div>
</body>
</html>`);
}

function firstValue(value) {
  if (Array.isArray(value)) return String(value[0] || "").trim();
  return String(value || "").trim();
}

function isFileLike(value) {
  return typeof File !== "undefined" && value instanceof File;
}

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
