"use strict";
const crypto=require("node:crypto");
const {json,method,readJson,fail,userFor,config,headers}=require("../contractor/_shared");
module.exports=async function handler(req,res){
 if(!method(req,res,["POST"]))return;
 try{
  const user=await userFor(req,res);if(!user)return;
  if(process.env.VERCEL_ENV==="production"&&process.env.WORK_PROFILE_EDITING_ENABLED!=="true")
    return json(res,503,{error:"Work profile editing is not open yet."});
  const body=await readJson(req,4200000);
  if(body.rightsConsent!==true||typeof body.data!=="string"||body.data.length>4000000)
    return json(res,400,{error:"Choose a photo you may publish (maximum 3 MB) and confirm permission."});
  const data=Buffer.from(body.data,"base64");
  if(data.length<12||data.length>3000000||data.toString("base64")!==body.data)
    return json(res,400,{error:"Invalid photo data"});
  let ext,mime;
  if(data.subarray(0,3).equals(Buffer.from([255,216,255]))){ext="jpg";mime="image/jpeg";}
  else if(data.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))){ext="png";mime="image/png";}
  else if(data.toString("ascii",0,4)==="RIFF"&&data.toString("ascii",8,12)==="WEBP"){ext="webp";mime="image/webp";}
  else return json(res,400,{error:"Use a JPG, PNG or WebP photo"});
  const {url,secret}=config();
  const imagePath=user.id+"/work-"+crypto.randomUUID()+"."+ext;
  const response=await fetch(url+"/storage/v1/object/gef-portfolio/"+imagePath,{
   method:"POST",
   headers:headers(secret,{"Content-Type":mime,"x-upsert":"false"}),
   body:data,
   signal:AbortSignal.timeout(15000)
  });
  if(!response.ok)throw Error("Work profile photo upload failed");
  return json(res,201,{
   image_path:imagePath,
   public_url:url+"/storage/v1/object/public/gef-portfolio/"+imagePath
  });
 }catch(e){fail(res,e);}
};