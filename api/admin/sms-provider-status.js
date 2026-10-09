const {json,method,requireAdmin,fail}=require("./_auth");
const {readiness,normalizeUsPhone,prepareZenviaUsPayload}=require("../_lib/zenvia-us-provider");
module.exports=async function handler(req,res){
 if(!method(req,res,["GET"]))return;
 try{
  const admin=await requireAdmin(req,res);if(!admin)return;
  const status=readiness();
  return json(res,200,{...status,example:{
    recipient_valid:!!normalizeUsPhone("+1 813 555 0134"),
    payload_structure_valid:!!prepareZenviaUsPayload({senderId:"PREVIEW",phone:"+1 813 555 0134",city:"Riverview"}),
    customer_details_included:false
  }});
 }catch(e){fail(res,e);}
};