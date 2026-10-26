const { json, method, requireAdmin, queryDb, fail } = require("./_auth");

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

module.exports = async function handler(req, res) {
  if (!method(req, res, ["GET"])) return;
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;

    const userId = typeof req.query?.user_id === "string" ? req.query.user_id : "";
    if (!UUID.test(userId)) return json(res, 400, { error: "Invalid contractor identifier" });

    const params = new URLSearchParams({
      contractor_id: "eq." + userId,
      select: "created_at,prior_status,next_status,note",
      order: "created_at.desc",
      limit: "20"
    });
    const events = await queryDb("contractor_verification_events?" + params.toString());
    if (!Array.isArray(events)) throw new Error("Invalid contractor review history");
    return json(res, 200, { events });
  } catch (error) {
    return fail(res, error);
  }
};
