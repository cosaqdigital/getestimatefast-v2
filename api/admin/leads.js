const { json, method, queryDb, requireAdmin, fail } = require("./_auth");
module.exports = async function handler(req, res) {
  if (!method(req, res, ["GET"])) return;
  try {
    const user = await requireAdmin(req, res);
    if (!user) return;
    const allowed = ["new", "qualified", "published", "closed", "rejected"];
    const status = String(req.query.status || "").trim();
    if (status && !allowed.includes(status)) return json(res, 400, { error: "Invalid status" });
    const page = Math.max(0, Math.min(200, Number.parseInt(req.query.page, 10) || 0));
    const params = new URLSearchParams();
    params.set("select", "id,created_at,service_type,full_name,email,phone,city,zip_code,contact_method,status,reviewed_at,admin_note,details");
    params.set("order", "created_at.desc");
    params.set("limit", "25"); params.set("offset", String(page * 25));
    if (status) params.set("status", "eq." + status);
    const leads = await queryDb("leads?" + params.toString());
    json(res, 200, { leads, page });
  } catch (err) { fail(res, err); }
};
