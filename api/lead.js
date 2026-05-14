const THANK_YOU_URL = "https://www.getestimatefast.com/thank-you.html";
const DEFAULT_FROM_EMAIL = "GetEstimateFast <onboarding@resend.dev>";
const MAX_ATTACHMENT_SIZE = 5 * 1024 * 1024;

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return sendErrorPage(res, 405, "This page only accepts form submissions.");
  }

  if (!process.env.RESEND_API_KEY || !process.env.LEAD_TO_EMAIL) {
    console.error("Missing RESEND_API_KEY or LEAD_TO_EMAIL environment variable.");
    return sendErrorPage(res, 500, "Email delivery is not configured yet. Please try again shortly.");
  }

  try {
    const formData = await parseFormData(req);
    const fields = normalizeFields(formData);

    if (isSpamSubmission(fields)) {
      return redirectToThankYou(res);
    }

    const validationError = validateLead(fields);
    if (validationError) {
      return sendErrorPage(res, 400, validationError);
    }

    const attachments = await collectAttachments(formData);
    const subject = buildSubject(fields);
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
      return sendErrorPage(res, 502, "We couldn't deliver your request right now. Please try again in a moment.");
    }

    return redirectToThankYou(res);
  } catch (error) {
    console.error("Lead submission failed:", error);
    return sendErrorPage(res, 500, "We couldn't send your request right now. Please go back and try again in a moment.");
  }
};

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
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks)));
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
    if (rawValue.size > MAX_ATTACHMENT_SIZE) continue;

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
  return Boolean(firstValue(fields.company) || firstValue(fields.website));
}

function validateLead(fields) {
  const required = ["Service Type", "Full Name", "Phone Number", "Email Address", "City", "ZIP Code"];

  for (const field of required) {
    if (!firstValue(fields[field])) {
      return `Please complete the ${field.toLowerCase()} field and try again.`;
    }
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
  res.setHeader("Location", THANK_YOU_URL);
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
