const { json, method, readJson, queryDb, requireAdmin, fail } = require("./_auth");
module.exports = async function handler(req, res) {
  if (!method(req, res, ["POST"])) return;
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    const body = await readJson(req);
    if (!body.contactReviewed || !body.serviceReviewed) return json(res,400,{error:"Review the request first"});
    const result = await queryDb("rpc/admin_approve_lead", {method:"POST",body:JSON.stringify({p_lead_id:body.id,p_service_type:body.category,p_contact_reviewed:true,p_scope_reviewed:true,p_note:body.note||null,p_actor:admin.id})});
    return json(res,200,{approved:true,result});
  } catch(error) { return fail(res,error); }
};
