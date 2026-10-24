const {json,method,readJson,queryDb,requireAdmin,fail}=require("./_auth");
const {formatOpportunityNotification}=require("../_lib/notification-preview");
module.exports=async function handler(req,res){
 if(!method(req,res,["POST"]))return;
 try{
  const admin=await requireAdmin(req,res);if(!admin)return;
  const origin=String(req.headers.origin||"");
  if(origin){let url;try{url=new URL(origin);}catch{return json(res,403,{error:"Invalid origin"});}
   if(url.host!==req.headers.host)return json(res,403,{error:"Origin not allowed"});}
  const body=await readJson(req,2048),leadId=String(body.leadId||"");
  if(!/^[0-9a-f-]{36}$/i.test(leadId))return json(res,400,{error:"Invalid opportunity"});
  const rows=await queryDb("opportunity_previews?lead_id=eq."+encodeURIComponent(leadId)+"&select=id,city&limit=1");
  const opportunity=rows[0];if(!opportunity)return json(res,404,{error:"Opportunity not found"});
  const leads=await queryDb("leads?id=eq."+encodeURIComponent(leadId)+"&select=status&limit=1");
  if(leads[0]?.status!=="published")return json(res,409,{error:"Opportunity not currently published"});
  const assignments=await queryDb("opportunity_matching_recipients?opportunity_id=eq."+encodeURIComponent(opportunity.id)+"&select=id,contractor_user_id&limit=26");
  if(assignments.length>25)return json(res,503,{error:"Recipient cap exceeded"});
  const text=formatOpportunityNotification(opportunity.city);
  const ids=assignments.map(x=>x.contractor_user_id);
  const profiles=ids.length?await queryDb("contractor_profiles?user_id=in.("+ids.map(encodeURIComponent).join(",")+")&select=user_id,account_status,email_verified_at,sms_opt_in,sms_opt_in_at"): [];
  const existing=assignments.length?await queryDb("opportunity_sms_simulations?matching_recipient_id=in.("+assignments.map(a=>a.id).join(",")+")&select=matching_recipient_id,status"):[];
  let recorded=0;
  for(const a of assignments){
   if(existing.some(x=>x.matching_recipient_id===a.id))continue;
   const p=profiles.find(p=>p.user_id===a.contractor_user_id);
   const status=!p||p.account_status!=="active"||!p.email_verified_at?"BLOCKED_INACTIVE":
     p.sms_opt_in===true&&p.sms_opt_in_at?"SIMULATED":"BLOCKED_NO_CONSENT";
   await queryDb("opportunity_sms_simulations?on_conflict=matching_recipient_id",{
     method:"POST",headers:{Prefer:"resolution=ignore-duplicates,return=minimal"},
     body:JSON.stringify({matching_recipient_id:a.id,status,message_preview:text})
   });
   recorded++;
  }
  return json(res,200,{mode:"SIMULATION",selected:assignments.length,recorded,messages_sent:0,contacts_shared:false});
 }catch(e){fail(res,e);}
};