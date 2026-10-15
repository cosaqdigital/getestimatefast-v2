const LAUNCH_CATALOG = require("../assets/launch-categories");
const { DEVELOPMENT_REF, protectedPreview } = require("./_lib/preview-target");
const {validateFiles, persistAttachments} = require('./_lib/lead-attachments');
// Reject accidental cross-platform database configuration.
const PRODUCTION_REF = "wedsjubkttygxtpkopfj";
const THANK_YOU_URL = "https://www.getestimatefast.com/thank-you.html";
const MAX_REQUEST_SIZE = 15 * 1024 * 1024;

module.exports = async function handler(req, res) {
  if (process.env.GETESTIMATEFAST_ISOLATED_BACKEND === "true" || protectedPreview()) {
    return sendErrorPage(res, 503, "Public submissions and external email delivery are disabled in this isolated test environment.");
  }
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return sendErrorPage(res, 405, "This page only accepts form submissions.");
  }

  try {
    const formData = await parseFormData(req);
    const fields = normalizeFields(formData);

    if (isSpamSubmission(fields)) {
      if (process.env.VERCEL_ENV === "preview") {
        return sendErrorPage(res, 400, "Test submission blocked by anti-spam field. No request was saved.");
      }
      return redirectToThankYou(res);
    }

    const validationError = validateLead(fields);
    if (validationError) return sendErrorPage(res, 400, validationError);

    // Validate attachments before writing: an invalid upload cannot create an incomplete lead.
    let attachments;
    try {
      attachments = await validateFiles(formData);
    } catch {
      return sendErrorPage(res, 413, "Check your attachments: JPG, PNG, WebP or PDF; up to three files of 5 MB each.");
    }

    // Unlike the former opt-in behavior, a disabled persistence flag fails closed.
    if (process.env.LEAD_PERSISTENCE_ENABLED !== "true") {
      console.error("GetEstimateFast lead persistence is not enabled.");
      return sendErrorPage(res, 503, "Requests are temporarily unavailable. Please try again later.");
    }

    try {
      await persistLead(fields, attachments);
    } catch {
      console.error("GetEstimateFast lead storage failed.");
      return sendErrorPage(res, 503, "We couldn't save your request. Please try again shortly.");
    }
    // RPC confirms both the lead and its transactional outbox intent.
    // Delivery is asynchronous and cannot change the customer receipt.
    return redirectToThankYou(res);
  } catch (error) {
    if(error?.code==='PAYLOAD_TOO_LARGE')return sendErrorPage(res,413,"Request exceeds the upload limit.");
    // Keep personal details, customer files and provider credentials out of server logs.
    console.error("GetEstimateFast request processing failed:", error?.name || "unknown");
    return sendErrorPage(res, 500, "We couldn't process your request. Please check your form and try again.");
  }
};
async function persistLead(fields, attachments = []) {
  const endpoint = String(process.env.GETESTIMATEFAST_SUPABASE_URL || "").replace(/\/$/, "");
  const key = process.env.GETESTIMATEFAST_SUPABASE_SECRET_KEY;
  const expectedRef = process.env.VERCEL_ENV === "production" ? PRODUCTION_REF : DEVELOPMENT_REF;
  if (endpoint !== `https://${expectedRef}.supabase.co` || !key) {
    throw new Error("Independent GetEstimateFast database is not configured for this environment");
  }

  const rawToken = firstValue(fields["Submission Token"]);
  const submissionToken = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(rawToken) ? rawToken : null;
  if (!submissionToken) throw new Error("Missing valid lead submission token");
  const dbHeaders = {
    apikey: key,
    ...(key.startsWith("sb_secret_") ? {} : { Authorization: "Bearer " + key })
  };
  const payload = { p_lead: {
    submission_token: submissionToken,
    service_type: firstValue(fields["Service Type"]), status: "new",
    full_name: firstValue(fields["Full Name"]), email: firstValue(fields["Email Address"]),
    phone: firstValue(fields["Phone Number"]), city: firstValue(fields["City"]), zip_code: firstValue(fields["ZIP Code"]),
    contact_method: firstValue(fields["Preferred contact method"]) || null,
    details: {...fields,_platform_review:{required:true,reason:manualReviewReason(fields),original_service:firstValue(fields["Service Type"]) }},
    source: "getestimatefast.com"
  }};
  if(attachments.length) return persistAttachments(payload.p_lead, attachments);
  const response = await fetch(endpoint + "/rest/v1/rpc/gef_persist_lead_and_notify", {
    method: "POST",
    headers: {
      ...dbHeaders,
      "Content-Type": "application/json"
    },
    redirect: "error",
    signal: AbortSignal.timeout(10000),
    body: JSON.stringify(payload)
  });
  if (!response.ok) {
    throw new Error("Lead database insert returned HTTP " + response.status);
  }
  const record = await response.json();
  if (!record || typeof record.id !== "string" || !/^[a-f0-9-]{36}$/i.test(record.id) || typeof record.duplicate !== "boolean" || record.notification_queued !== true) {
    throw new Error("Lead and notification intent are not verifiable");
  }
  return { duplicate: record.duplicate, id: record.id };
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
        reject(Object.assign(new Error("Request payload exceeds size limit"),{code:'PAYLOAD_TOO_LARGE'}));
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

  // Each supported browser form must generate a stable UUID for safe retries.
  const submissionToken = firstValue(fields["Submission Token"]);
  if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(submissionToken)) {
    return "We couldn't verify your request. Reload the form and try again.";
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

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
