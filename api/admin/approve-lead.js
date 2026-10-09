const { json, method, readJson, queryDb, requireAdmin, fail } = require("./_auth");
module.exports = async function handler(req, res) {
  if (!method(req, res, ["POST"])) return;
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    const body = await readJson(req,4096);
    const origin = String(req.headers.origin || "");
    const host = String(req.headers.host || "");
    if (origin) {
      let url;
      try { url = new URL(origin); } catch (_) { return json(res,403,{error:"Invalid origin"}); }
      if (url.host !== host) return json(res,403,{error:"Origin not allowed"});
    }
    if (!/^[a-f0-9-]{36}$/i.test(String(body.id || "")) || body.contactReviewed !== true || body.serviceReviewed !== true || typeof body.category !== "string" || body.category.trim().length < 2 || body.category.trim().length > 120 || typeof body.note !== "string" || body.note.length > 1000) return json(res,400,{error:"Review contact and scope, and select a category."});
    const result = await queryDb("rpc/admin_approve_lead", {method:"POST",body:JSON.stringify({p_lead_id:body.id,p_service_type:body.category.trim(),p_contact_reviewed:true,p_scope_reviewed:true,p_note:body.note.trim()||null,p_actor:admin.id})});
    return json(res,200,{approved:true,result});
  } catch(error) { return fail(res,error); }
};
