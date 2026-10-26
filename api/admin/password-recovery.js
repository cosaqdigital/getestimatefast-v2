"use strict";

const { config, json, readJson, requireAdmin } = require("./_auth");
const { DEVELOPMENT_REF } = require("../_lib/preview-target");

// This is a one-account Development recovery path, not a general admin reset API.
// Enable only after the redirect and delivery to this exact inbox are approved.
const BRANCH = "feat/us-admin-overview-20261015";
const ORIGIN = "https://getestimatefast-v2-git-feat-us-admin-o-10fae9-get-estimate-fast.vercel.app";
const HOST = new URL(ORIGIN).host;
const REDIRECT = ORIGIN + "/admin-recovery.html";
const ADMIN_ID = "7f44765d-fd3a-4078-8a4f-d689eed39754";
const ADMIN_EMAIL = "admin@getestimatefast.com";
const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 256;

function reject(res, status, code, error) {
  return json(res, status, { error, code });
}

function publicKey(key) {
  if (typeof key !== "string") return false;
  if (key.startsWith("sb_publishable_")) return true;
  // Legacy anon keys are supported, but a service-role or user token must never
  // be mistaken for a public key by a misconfigured environment variable.
  try { return JSON.parse(Buffer.from(key.split(".")[1], "base64url").toString("utf8")).role === "anon"; }
  catch { return false; }
}

function recoveryConfig(env = process.env) {
  if (env.GETESTIMATEFAST_ADMIN_RECOVERY_ENABLED !== "true"
    || env.VERCEL_ENV !== "preview"
    || env.VERCEL_GIT_COMMIT_REF !== BRANCH
    || env.GETESTIMATEFAST_ISOLATED_BACKEND !== "true"
    || env.GETESTIMATEFAST_DEVELOPMENT_PROJECT_REF !== DEVELOPMENT_REF
    || String(env.GETESTIMATEFAST_SUPABASE_URL || "").replace(/\/$/, "") !== "https://" + DEVELOPMENT_REF + ".supabase.co"
    || env.GETESTIMATEFAST_PUBLIC_ORIGIN !== ORIGIN) return null;
  try {
    const settings = config(env);
    return publicKey(settings.publishable) ? settings : null;
  } catch { return null; }
}

function originAllowed(req) {
  if (req.headers.host !== HOST) return false;
  const site = req.headers["sec-fetch-site"];
  if (site !== undefined && site !== "same-origin") return false;
  const origin = req.headers.origin;
  // Same-origin GET fetches need not send Origin. They never send recovery mail
  // or update a password. Every mutation requires the exact Origin header.
  return origin === ORIGIN || (req.method === "GET" && origin === undefined);
}

async function recoveryAdmin(req, res) {
  // Keep the existing live Auth + admin_users authorization, while normalizing
  // its responses for this endpoint without forwarding any upstream details.
  const denied = { statusCode: 401, setHeader() {}, end() {} };
  const user = await requireAdmin(req, denied);
  if (!user) {
    if (denied.statusCode === 403) reject(res, 403, "access_denied", "Access denied.");
    else reject(res, 401, "session_invalid", "The recovery session is missing or expired.");
    return null;
  }
  if (user.id !== ADMIN_ID || user.email !== ADMIN_EMAIL) {
    reject(res, 403, "access_denied", "Access denied.");
    return null;
  }
  return user;
}

async function authFailure(res, response, action) {
  let code = "";
  try {
    const data = await response.json();
    if (typeof data?.code === "string") code = data.code;
    else if (typeof data?.error_code === "string") code = data.error_code;
  } catch { /* Never expose an upstream body or log it. */ }
  if (response.status === 429 || ["over_email_send_rate_limit", "over_request_rate_limit"].includes(code)) {
    const retryAfter = response.headers.get("retry-after");
    if (/^[1-9][0-9]{0,4}$/.test(retryAfter || "")) res.setHeader("Retry-After", String(Math.min(Number(retryAfter), 3600)));
    return reject(res, 429, "rate_limited", "Too many recovery attempts. Please try again later.");
  }
  if (action === "request") {
    return reject(res, 503, "email_delivery_unavailable", "Recovery email is unavailable. Check the Development email configuration.");
  }
  if (code === "insufficient_aal") {
    return reject(res, 403, "access_denied", "Additional authentication is required for this administrator.");
  }
  if (response.status === 401 || ["bad_jwt", "session_expired", "session_not_found"].includes(code)) {
    return reject(res, 401, "session_invalid", "The recovery session has expired. Request a new recovery link.");
  }
  if (response.status === 403) return reject(res, 403, "access_denied", "Access denied.");
  if (["reauthentication_needed", "reauthentication_not_valid", "current_password_required"].includes(code)) {
    return reject(res, 401, "session_invalid", "A new recovery link is required before changing the password.");
  }
  if (code === "same_password") return reject(res, 400, "invalid_password", "Choose a password different from the existing password.");
  if (code === "weak_password" || response.status === 400 || response.status === 422) {
    return reject(res, 400, "invalid_password", "The password was not accepted. Check the account password requirements.");
  }
  return reject(res, 503, "service_unavailable", "Recovery is temporarily unavailable.");
}

module.exports = async function handler(req, res) {
  res.setHeader("Referrer-Policy", "no-referrer");
  const settings = recoveryConfig();
  if (!settings) return reject(res, 404, "recovery_disabled", "Administrator recovery is not enabled.");
  if (!["GET", "POST"].includes(req.method)) {
    res.setHeader("Allow", "GET, POST");
    return reject(res, 405, "method_not_allowed", "Method not allowed.");
  }
  if (!originAllowed(req)) return reject(res, 403, "origin_not_allowed", "Request origin not allowed.");
  // This endpoint has no query parameters, including no token or redirect URL.
  if (Object.keys(req.query || {}).length || String(req.url || "").includes("?")) {
    return reject(res, 400, "invalid_request", "Invalid recovery request.");
  }
  try {
    if (req.method === "GET") {
      const sessionValidated = req.headers.authorization !== undefined;
      if (sessionValidated && !await recoveryAdmin(req, res)) return;
      return json(res, 200, {
        enabled: true, recipient: ADMIN_EMAIL,
        minPasswordLength: MIN_PASSWORD_LENGTH, maxPasswordLength: MAX_PASSWORD_LENGTH,
        sessionValidated
      });
    }
    if (String(req.headers["content-type"] || "").split(";")[0].trim().toLowerCase() !== "application/json") {
      return reject(res, 400, "invalid_request", "A JSON recovery request is required.");
    }
    let body;
    try { body = await readJson(req, 4096); }
    catch { return reject(res, 400, "invalid_request", "Invalid recovery request."); }
    if (!body || typeof body !== "object" || Array.isArray(body)
      || !["request", "complete"].includes(body.action)) {
      return reject(res, 400, "invalid_request", "Invalid recovery request.");
    }
    const expectedKeys = body.action === "request" ? ["action"] : ["action", "password"];
    const keys = Object.keys(body);
    if (keys.length !== expectedKeys.length || keys.some(key => !expectedKeys.includes(key))) {
      return reject(res, 400, "invalid_request", "Invalid recovery request.");
    }
    if (body.action === "request") {
      // Official resetPasswordForEmail REST operation; no service-role key and
      // no PKCE verifier. The implicit recovery session returns to REDIRECT.
      const response = await fetch(settings.url + "/auth/v1/recover?redirect_to=" + encodeURIComponent(REDIRECT), {
        method: "POST", redirect: "error",
        headers: { apikey: settings.publishable, "Content-Type": "application/json", "X-Supabase-Api-Version": "2024-01-01" },
        body: JSON.stringify({ email: ADMIN_EMAIL }),
        signal: AbortSignal.timeout(10000)
      });
      if (!response.ok) return await authFailure(res, response, "request");
      return json(res, 200, { ok: true, requested: true, message: "Recovery email requested. Delivery has not been confirmed." });
    }
    if (typeof body.password !== "string" || body.password.length < MIN_PASSWORD_LENGTH || body.password.length > MAX_PASSWORD_LENGTH) {
      return reject(res, 400, "invalid_password", "Use a password between 8 and 256 characters.");
    }
    if (!await recoveryAdmin(req, res)) return;
    const response = await fetch(settings.url + "/auth/v1/user", {
      method: "PUT", redirect: "error",
      headers: { apikey: settings.publishable, Authorization: req.headers.authorization, "Content-Type": "application/json", "X-Supabase-Api-Version": "2024-01-01" },
      body: JSON.stringify({ password: body.password }),
      signal: AbortSignal.timeout(10000)
    });
    if (!response.ok) return await authFailure(res, response, "complete");
    return json(res, 200, { ok: true, redirectPath: "/admin.html" });
  } catch {
    // Do not use the shared fail() logger here: error messages can contain
    // request bodies, passwords, tokens, or upstream response details.
    return reject(res, 503, "service_unavailable", "Recovery is temporarily unavailable.");
  }
};
