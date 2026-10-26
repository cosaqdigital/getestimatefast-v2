const {json,method,requireAdmin,fail}=require("./_auth");
const {readiness,normalizeUsPhone,prepareTelnyxPayload}=require("../_lib/telnyx-us-provider");
module.exports=async function handler(req,res){
 if(!method(req,res,["GET"]))return;
 try{
  const admin=await requireAdmin(req,res);if(!admin)return;
  const status=readiness();
  return json(res,200,{...status,example:{
    recipient_valid:!!normalizeUsPhone("+1 813 555 0134"),
    payload_structure_valid:!!prepareTelnyxPayload({
      from:"+1 813 303 9893",phone:"+1 813 555 0134",city:"Riverview",
      opportunityId:"123e4567-e89b-42d3-a456-426614174000"
    }),
    customer_details_included:false,
    direct_opportunity_link:true
  }});
 }catch(e){fail(res,e);}
};
