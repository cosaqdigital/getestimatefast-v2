const { json, method, readJson, queryDb, requireAdmin, fail } = require("./_auth");
const statuses = ["new", "qualified", "published", "closed", "rejected"];
module.exports = async function handler(req, res) {
  if (!method(req, res, ["POST"])) return;
  try {
    const user = await requireAdmin(req, res);
    if (!user) return;
    const origin = String(req.headers.origin || "");
    const host = String(req.headers.host || "");
    if (origin && new URL(origin).host !== host) return json(res, 403, { error: "Origin not allowed" });
    const { id, status, note } = await readJson(req);
    if (status === "qualified" || status === "published") return json(res, 409, { error: "Use the review and approval workflow. Publishing is not available in this preview." });
    if (!/^[a-f0-9-]{36}$/i.test(String(id)) || !statuses.includes(status) || typeof note !== "string" || note.length > 1000) {
      return json(res, 400, { error: "Invalid request" });
    }
    const result = await queryDb("rpc/admin_change_lead_status", {
      method: "POST", body: JSON.stringify({
        p_lead_id: id, p_next_status: status, p_note: note.trim() || null, p_actor: user.id
      })
    });
    json(res, 200, { result });
  } catch (err) { fail(res, err); }
};
