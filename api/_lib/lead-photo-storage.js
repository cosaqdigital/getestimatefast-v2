"use strict";
const {createClient}=require("@supabase/supabase-js");

const BUCKET="lead-photos";
const MAX_PHOTO_COUNT=5;
const MAX_PHOTO_SIZE=5*1024*1024;
const ALLOWED_TYPES=new Map([
  ["image/jpeg","jpg"],
  ["image/png","png"],
  ["image/webp","webp"]
]);
const UUID_RE=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;

function validSubmissionToken(value){return UUID_RE.test(String(value||"").trim());}
function extensionFor(type){return ALLOWED_TYPES.get(String(type||"").toLowerCase())||null;}
function validatePhotoMetadata(files){
  if(!Array.isArray(files)||files.length<1||files.length>MAX_PHOTO_COUNT)throw Error("Choose between 1 and 5 project photos.");
  return files.map((file,index)=>{
    const type=String(file?.type||"").toLowerCase();
    const ext=extensionFor(type);
    const size=Number(file?.size);
    if(!ext)throw Error("Project photos must be JPG, PNG or WebP.");
    if(!Number.isSafeInteger(size)||size<1||size>MAX_PHOTO_SIZE)throw Error("Each project photo must be 5 MB or smaller.");
    return {index,type,size,ext};
  });
}
function parsePhotoPaths(raw,submissionToken){
  if(!raw)return [];
  if(!validSubmissionToken(submissionToken))return [];
  let value=raw;
  if(typeof value==="string"){
    try{value=JSON.parse(value);}catch{return [];}
  }
  if(!Array.isArray(value)||value.length>MAX_PHOTO_COUNT)return [];
  const prefix=String(submissionToken).trim().toLowerCase()+"/";
  const seen=new Set(),paths=[];
  for(const item of value){
    const path=String(item||"").trim();
    if(!path||path.length>240||!path.toLowerCase().startsWith(prefix))continue;
    if(!/^[a-f0-9-]+\/[a-z0-9._-]+$/i.test(path))continue;
    if(seen.has(path))continue;
    seen.add(path);paths.push(path);
  }
  return paths.slice(0,MAX_PHOTO_COUNT);
}
function storageClient(url,secret){
  return createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
}
async function signPhotoUrls(url,secret,paths,expiresIn=900){
  if(!paths.length)return [];
  const client=storageClient(url,secret);
  const {data,error}=await client.storage.from(BUCKET).createSignedUrls(paths,expiresIn);
  if(error)throw error;
  return (data||[]).filter(x=>x?.path&&x?.signedUrl&&!x?.error).map(x=>({path:x.path,url:x.signedUrl}));
}
module.exports={BUCKET,MAX_PHOTO_COUNT,MAX_PHOTO_SIZE,ALLOWED_TYPES,validSubmissionToken,extensionFor,validatePhotoMetadata,parsePhotoPaths,storageClient,signPhotoUrls};
