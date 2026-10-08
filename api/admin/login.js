const { config, json, method, readJson, queryDb, fail } = require("./_auth");
module.exports = async function handler(req, res) {
  if (!method(req, res, ["POST"])) return;
  try {
    const body = await readJson(req);
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !password || password.length > 256) {
      return json(res, 400, { error: "Invalid login details" });
    }
    const { url, publishable } = config();
    const response = await fetch(url + "/auth/v1/token?grant_type=password", {
      method: "POST", headers: { apikey: publishable, "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }), signal: AbortSignal.timeout(10000)
    });
    if (!response.ok) return json(res, 401, { error: "Invalid credentials or access not authorized" });
    const data = await response.json();
    const user = data.user || {};
    if (!user.id || !user.email_confirmed_at || !data.access_token) return json(res, 403, { error: "Account not authorized" });
    const members = await queryDb("admin_users?user_id=eq." + encodeURIComponent(user.id) + "&select=user_id&limit=1");
    if (!members.length) return json(res, 403, { error: "Account not authorized" });
    json(res, 200, { access_token: data.access_token, expires_in: data.expires_in, email: user.email });
  } catch (err) { fail(res, err); }
};
