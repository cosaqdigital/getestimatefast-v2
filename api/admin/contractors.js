const { json, method, requireAdmin, queryDb, fail } = require("./_auth");

const ALLOWED_STATUSES = ["pending_review", "active", "suspended", "rejected"];
const PAGE_SIZE = 25;

module.exports = async function handler(req, res) {
  if (!method(req, res, ["GET"])) return;
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;

    const status = typeof req.query?.status === "string" ? req.query.status.trim() : "";
    const rawPage = typeof req.query?.page === "string" ? req.query.page : "0";
    if ((status && !ALLOWED_STATUSES.includes(status)) || !/^(0|[1-9][0-9]{0,2})$/.test(rawPage)) {
      return json(res, 400, { error: "Invalid filter or page" });
    }
    const page = Number(rawPage);
    if (page > 200) return json(res, 400, { error: "Page limit exceeded" });

    const params = new URLSearchParams({
      select: "user_id,display_name,business_name,contact_phone,contact_email,base_zip,city,state_code,service_radius_miles,service_categories,account_status,email_verified_at,privacy_version,terms_version,created_at,updated_at",
      order: "created_at.desc",
      limit: String(PAGE_SIZE + 1),
      offset: String(page * PAGE_SIZE)
    });
    if (status) params.set("account_status", "eq." + status);

    const profiles = await queryDb("contractor_profiles?" + params.toString());
    if (!Array.isArray(profiles)) throw new Error("Invalid contractor list response");
    return json(res, 200, {
      contractors: profiles.slice(0, PAGE_SIZE),
      page,
      has_more: profiles.length > PAGE_SIZE
    });
  } catch (error) {
    return fail(res, error);
  }
};
