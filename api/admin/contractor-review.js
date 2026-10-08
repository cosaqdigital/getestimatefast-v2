const { json, method, readJson, requireAdmin, queryDb, fail } = require("./_auth");

const VALID_STATUSES = ["pending_review", "active", "suspended", "rejected"];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

module.exports = async function handler(req, res) {
  if (!method(req, res, ["POST"])) return;
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;

    const origin = String(req.headers.origin || "");
    if (origin && new URL(origin).host !== String(req.headers.host || "")) {
      return json(res, 403, { error: "Origin not allowed" });
    }

    const body = await readJson(req, 4096);
    const userId = String(body.user_id || "");
    const nextStatus = String(body.status || "");
    const note = typeof body.note === "string" ? body.note.trim() : "";
    if (!UUID.test(userId) || !VALID_STATUSES.includes(nextStatus) || note.length < 5 || note.length > 1000) {
      return json(res, 400, { error: "Choose a valid status and enter a review note (5–1000 characters)." });
    }

    const result = await queryDb("rpc/admin_review_contractor", {
      method: "POST",
      body: JSON.stringify({
        p_contractor_id: userId,
        p_next_status: nextStatus,
        p_note: note,
        p_actor: admin.id
      })
    });
    return json(res, 200, { result });
  } catch (error) {
    return fail(res, error);
  }
};
