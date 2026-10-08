const {config,json,method,readJson,fail}=require("./_shared");
module.exports=async function handler(req,res){
 if(!method(req,res,["POST"]))return;
 try{
  const {email,password}=await readJson(req,3000);
  if(typeof email!=="string"||typeof password!=="string"||email.length>254||password.length>128||!email||!password)return json(res,400,{error:"Invalid login"});
  const {url,publishable}=config();
  const r=await fetch(url+"/auth/v1/token?grant_type=password",{method:"POST",headers:{"Content-Type":"application/json",apikey:publishable},body:JSON.stringify({email:email.trim().toLowerCase(),password}),signal:AbortSignal.timeout(10000)});
  if(!r.ok)return json(res,401,{error:"Invalid email or password, or email not confirmed"});
  const d=await r.json();
  if(!d.user?.email_confirmed_at||!d.access_token)return json(res,403,{error:"Confirm your email before signing in"});
  return json(res,200,{access_token:d.access_token,expires_in:d.expires_in});
 }catch(e){fail(res,e);}
};
