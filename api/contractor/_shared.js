const {config,headers,json,method,readJson,queryDb,fail}=require("../admin/_auth");
const CATEGORIES=["Bathroom Remodeling","Kitchen Remodeling","Flooring","Painting","Drywall","Roofing","Plumbing","Electrical","HVAC","House Cleaning","Yard Cleanup & Other Cleanup","General Remodeling","Foundation Repair","Drainage","Other"];
async function userFor(req,res){
 const match=/^Bearer ([A-Za-z0-9._~-]+)$/.exec(String(req.headers.authorization||""));
 if(!match){json(res,401,{error:"Sign in required"});return null;}
 const {url,publishable}=config();
 const response=await fetch(url+"/auth/v1/user",{headers:{apikey:publishable,Authorization:"Bearer "+match[1]},signal:AbortSignal.timeout(10000)});
 if(!response.ok){json(res,401,{error:"Invalid or expired session"});return null;}
 const user=await response.json();
 if(!user.id||!user.email_confirmed_at){json(res,403,{error:"Confirm your email first"});return null;}
 return user;
}
module.exports={config,headers,json,method,readJson,queryDb,fail,CATEGORIES,userFor};
