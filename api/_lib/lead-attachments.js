"use strict";
const crypto = require('node:crypto');
const {createClient} = require('@supabase/supabase-js');
const {DEVELOPMENT_REF} = require('./preview-target');
const BUCKET = 'gef-lead-attachments';
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const TYPES = {'image/jpeg':'jpg','image/png':'png','image/webp':'webp','application/pdf':'pdf'};
function client(env=process.env) {
  // Deliberately Development-only. Production needs a separately reviewed rollout.
  if(env.GETESTIMATEFAST_ATTACHMENTS_ENABLED!=='true' || env.VERCEL_ENV!=='development' ||
    env.GETESTIMATEFAST_SUPABASE_URL!==`https://${DEVELOPMENT_REF}.supabase.co` || !env.GETESTIMATEFAST_SUPABASE_SECRET_KEY)
    throw Error('ATTACHMENTS_DISABLED');
  return createClient(env.GETESTIMATEFAST_SUPABASE_URL,env.GETESTIMATEFAST_SUPABASE_SECRET_KEY,{
    auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},
    global:{fetch:(url,options={})=>fetch(url,{...options,redirect:'error',signal:AbortSignal.timeout(8000)})}
  });
}
async function validateFiles(form) {
  const files=[];
  for(const [,file] of form.entries()) {
    if(typeof File==='undefined'||!(file instanceof File))continue;
    if(!file.name&&!file.size)continue; // browser's unselected file input
    if(!file.size||file.size>5*1024*1024||files.length>=3)throw Error('INVALID_ATTACHMENT');
    const ext=TYPES[file.type];
    if(!ext||!new RegExp(`\\.${ext==='jpg'?'jpe?g':ext}$`,'i').test(file.name)||/[\\/\x00-\x1f]/.test(file.name)||
      /\.(exe|com|bat|cmd|ps1|js|html?|svg|scr|dll|msi)\./i.test(file.name))throw Error('INVALID_ATTACHMENT');
    const data=Buffer.from(await file.arrayBuffer());
    let valid=false;
    if(ext==='jpg')valid=data.length>=4&&data.subarray(0,3).equals(Buffer.from([255,216,255]))&&data.subarray(-2).equals(Buffer.from([255,217]));
    if(ext==='png')valid=data.length>=20&&data.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))&&data.subarray(-8,-4).toString()==='IEND';
    if(ext==='webp')valid=data.length>=20&&data.toString('ascii',0,4)==='RIFF'&&data.toString('ascii',8,12)==='WEBP'&&data.readUInt32LE(4)+8===data.length;
    if(ext==='pdf')valid=/^%PDF-1\.[0-7]/.test(data.toString('ascii',0,8))&&/%%EOF\s*$/.test(data.subarray(-32).toString('ascii'));
    // Defense in depth, NOT a malware verdict: every uploaded object is quarantined.
    if(!valid||/<script|<svg|<html|\/JavaScript|\/JS\b|\/Launch|\/EmbeddedFile|\/OpenAction|\/AA\b/i.test(data.toString('latin1')))throw Error('INVALID_ATTACHMENT');
    files.push({data,mime:file.type,ext,size:data.length,sha256:crypto.createHash('sha256').update(data).digest('hex')});
  }
  return files;
}
async function rpc(db,name,args){
  try {const {data,error}=await db.rpc(name,args).retry(false);if(error)throw Error();return data;}
  catch {throw Error('ATTACHMENT_DATABASE_FAILURE');}
}
async function persistAttachments(lead,files,{db=client(),randomUUID=crypto.randomUUID}={}) {
  const batch=randomUUID();
  const objects=files.map(f=>({path:`${batch}/${randomUUID()}.${f.ext}`,mime:f.mime,size:f.size,sha256:f.sha256}));
  // Durable ledger is committed BEFORE any Storage write. Lost processes are recoverable.
  if(await rpc(db,'gef_reserve_attachment_batch',{p_batch:batch,p_objects:objects})!==true)throw Error('ATTACHMENT_RESERVATION_UNVERIFIED');
  try {
    for(let i=0;i<files.length;i++) {
      const {error}=await db.storage.from(BUCKET).upload(objects[i].path,files[i].data,{contentType:files[i].mime,upsert:false,cacheControl:'0'});
      if(error)throw Error('ATTACHMENT_STORAGE_FAILURE');
    }
    const receipt=await rpc(db,'gef_commit_attachment_batch',{p_batch:batch,p_lead:lead});
    if(!receipt||!UUID.test(receipt.id)||receipt.duplicate!==false||receipt.notification_queued!==true||receipt.attachments_complete!==true)throw Error('ATTACHMENT_RECEIPT_FAILURE');
    return receipt;
  }catch{
    // Never delete here: COMMIT acknowledgement may have been lost. The fenced
    // expiry/recovery RPC distinguishes committed from abandoned batches.
    throw Error('ATTACHMENTS_NOT_CONFIRMED');
  }
}
async function recoverBatch(batch,db=client()) {
  if(!UUID.test(batch))throw Error('INVALID_BATCH');
  const objects=await rpc(db,'gef_claim_attachment_cleanup',{p_batch:batch});
  if(!Array.isArray(objects)||objects.length>3)throw Error('CLEANUP_DENIED');
  if(objects.length) {
    if(objects.some(p=>typeof p!=='string'||!p.startsWith(batch+'/')||!new RegExp(`^${batch}/[a-f0-9-]{36}\\.(jpg|png|webp|pdf)$`).test(p)))throw Error('CLEANUP_DENIED');
    const {error}=await db.storage.from(BUCKET).remove(objects);if(error)throw Error('CLEANUP_PENDING');
  }
  await rpc(db,'gef_finish_attachment_cleanup',{p_batch:batch});
}
async function signedAttachment(lead,id,db=client()) {
  if(!UUID.test(lead)||!UUID.test(id))throw Error('INVALID_ATTACHMENT_ID');
  const row=await rpc(db,'gef_admin_attachment',{p_lead:lead,p_attachment:id});
  if(!row||row.scan_state!=='clean'||typeof row.path!=='string'||!/^[-a-f0-9]{36}\/[-a-f0-9]{36}\.(jpg|png|webp|pdf)$/.test(row.path))throw Error('ATTACHMENT_UNAVAILABLE');
  const {data,error}=await db.storage.from(BUCKET).createSignedUrl(row.path,60,{download:'attachment'});
  const url=new URL(data?.signedUrl||'https://invalid.invalid');
  if(error||url.origin!==`https://${DEVELOPMENT_REF}.supabase.co`||!url.pathname.startsWith(`/storage/v1/object/sign/${BUCKET}/`))throw Error('SIGNING_FAILED');
  return {url:url.href,expiresIn:60};
}
module.exports={BUCKET,client,validateFiles,persistAttachments,recoverBatch,signedAttachment};
