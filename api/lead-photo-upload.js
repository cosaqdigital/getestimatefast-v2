"use strict";
const crypto=require("node:crypto");
const {DEVELOPMENT_REF,protectedPreview}=require("./_lib/preview-target");
const {BUCKET,validatePhotoMetadata,validSubmissionToken,storageClient}=require("./_lib/lead-photo-storage");

const PRODUCTION_REF="wedsjubkttygxtpkopfj";

module.exports=async function handler(req,res){
  res.setHeader("Cache-Control","no-store");
  res.setHeader("X-Content-Type-Options","nosniff");
  if(req.method!=="POST"){res.setHeader("Allow","POST");return send(res,405,{error:"This endpoint only accepts POST requests."});}
  if(process.env.GETESTIMATEFAST_ISOLATED_BACKEND==="true"||protectedPreview())return send(res,503,{error:"Photo uploads are disabled in this isolated environment."});
  if(process.env.LEAD_PERSISTENCE_ENABLED!=="true")return send(res,503,{error:"Service requests are not open yet."});
  const origin=String(req.headers.origin||"");
  if(process.env.VERCEL_ENV==="production"&&origin!=="https://www.getestimatefast.com")return send(res,403,{error:"Invalid upload origin."});
  try{
    const body=await readJson(req,24000);
    const token=String(body?.submission_token||"").trim();
    if(!validSubmissionToken(token))return send(res,400,{error:"Reload the form and try again."});
    let files;
    try{files=validatePhotoMetadata(body?.files);}catch(e){return send(res,400,{error:e.message});}

    const endpoint=String(process.env.GETESTIMATEFAST_SUPABASE_URL||"").replace(/\/$/,"");
    const secret=process.env.GETESTIMATEFAST_SUPABASE_SECRET_KEY;
    const expectedRef=process.env.VERCEL_ENV==="production"?PRODUCTION_REF:DEVELOPMENT_REF;
    if(endpoint!=="https://"+expectedRef+".supabase.co"||!secret)throw Error("Independent GetEstimateFast storage is not configured");

    const client=storageClient(endpoint,secret);
    const uploads=[];
    for(const file of files){
      const path=token.toLowerCase()+"/"+String(file.index+1).padStart(2,"0")+"-"+crypto.randomUUID()+"."+file.ext;
      const {data,error}=await client.storage.from(BUCKET).createSignedUploadUrl(path,{upsert:false});
      if(error||!data?.signedUrl||!data?.token)throw Error("Could not prepare project photo upload");
      uploads.push({path,signed_url:data.signedUrl,type:file.type});
    }
    return send(res,201,{uploads});
  }catch(e){
    console.error("GetEstimateFast photo upload preparation failed:",e?.name||"unknown");
    return send(res,500,{error:"We couldn't prepare the photo upload. Please try again."});
  }
};

function send(res,status,payload){res.statusCode=status;res.setHeader("Content-Type","application/json; charset=utf-8");res.end(JSON.stringify(payload));}
function readJson(req,limit){return new Promise((resolve,reject)=>{const chunks=[];let total=0;req.on("data",chunk=>{total+=chunk.length;if(total>limit){reject(Error("Payload too large"));req.pause();return;}chunks.push(chunk);});req.on("end",()=>{try{resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")||"{}"));}catch{reject(Error("Invalid JSON"));}});req.on("error",reject);});}
