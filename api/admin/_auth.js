const PROJECT_URL = "https://wedsjubkttygxtpkopfj.supabase.co";
function config() {
  const url = String(process.env.GETESTIMATEFAST_SUPABASE_URL || "").replace(/\/$/, "");
  const secret = process.env.GETESTIMATEFAST_SUPABASE_SECRET_KEY;
  const publishable = process.env.GETESTIMATEFAST_SUPABASE_PUBLISHABLE_KEY;
  if (url !== PROJECT_URL || !secret || !publishable) throw new Error("GetEstimateFast admin backend not configured");
  return { url, secret, publishable };
}
function headers(key, extra = {}) {
  return { apikey: key, ...(key.startsWith("sb_secret_") ? {} : { Authorization: "Bearer " + key }), ...extra };
}
function json(res, status, data) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.end(JSON.stringify(data));
}
function method(req, res, allowed) {
  if (allowed.includes(req.method)) return true;
  res.setHeader("Allow", allowed.join(", "));
  json(res, 405, { error: "Method not allowed" });
  return false;
}
async function readJson(req, maxBytes = 8192) {
  const parts = []; let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > maxBytes) throw new Error("Request too large");
    parts.push(chunk);
  }
  return JSON.parse(Buffer.concat(parts).toString("utf8"));
}
async function queryDb(path, options = {}) {
  const { url, secret } = config();
  const response = await fetch(url + "/rest/v1/" + path, {
    ...options,
    headers: headers(secret, { "Content-Type": "application/json", ...options.headers }),
    signal: AbortSignal.timeout(10000)
  });
  if (!response.ok) throw new Error("Database returned " + response.status);
  if (response.status === 204) return null;
  return response.json();
}
async function requireAdmin(req, res) {
  const match = /^Bearer ([A-Za-z0-9._~-]+)$/.exec(String(req.headers.authorization || ""));
  if (!match) { json(res, 401, { error: "Authentication required" }); return null; }
  const { url, publishable } = config();
  const response = await fetch(url + "/auth/v1/user", {
    headers: { apikey: publishable, Authorization: "Bearer " + match[1] },
    signal: AbortSignal.timeout(10000)
  });
  if (!response.ok) { json(res, 401, { error: "Session expired" }); return null; }
  const user = await response.json();
  if (!user.id || !user.email_confirmed_at) { json(res, 403, { error: "Access denied" }); return null; }
  const administrators = await queryDb("admin_users?user_id=eq." + encodeURIComponent(user.id) + "&select=user_id&limit=1");
  if (!administrators.length) { json(res, 403, { error: "Access denied" }); return null; }
  return user;
}
function fail(res, err) { console.error("GetEstimateFast admin request failed:", err.message); json(res, 503, { error: "Service temporarily unavailable" }); }
module.exports = { config, headers, json, method, readJson, queryDb, requireAdmin, fail };
