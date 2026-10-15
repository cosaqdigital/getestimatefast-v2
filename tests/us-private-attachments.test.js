"use strict";
const {test}=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {validateFiles,persistAttachments,recoverBatch,signedAttachment,client,BUCKET}=require('../api/_lib/lead-attachments');
const lead=crypto.randomUUID(),batch=crypto.randomUUID(),object=crypto.randomUUID();
const jpeg=Buffer.from([255,216,255,224,1,2,255,217]);
const pdf=Buffer.from('%PDF-1.7\n1 0 obj << /Type /Catalog >> endobj\n%%EOF\n');
function form(data=jpeg,name='image.jpg',type='image/jpeg'){const f=new FormData();f.append('Photo',new File([data],name,{type}));return f;}
for(const [name,data,file,mime] of [['JPG',jpeg,'image.jpg','image/jpeg'],['PDF',pdf,'doc.pdf','application/pdf']])test('valid '+name,async()=>{const a=await validateFiles(form(data,file,mime));assert.equal(a.length,1);assert.equal(a[0].sha256.length,64);assert.equal(a[0].filename,undefined);});
for(const [name,data,file,mime] of [
 ['false MIME',pdf,'image.jpg','image/jpeg'],['empty',Buffer.alloc(0),'image.jpg','image/jpeg'],
 ['too large',Buffer.alloc(5242881),'image.jpg','image/jpeg'],['SVG',Buffer.from('<svg/>'),'x.svg','image/svg+xml'],
 ['executable suffix',jpeg,'virus.exe.jpg','image/jpeg'],['traversal',jpeg,'../image.jpg','image/jpeg'],
 ['active PDF',Buffer.from('%PDF-1.7 /JavaScript () %%EOF'),'x.pdf','application/pdf'],
 ['polyglot',Buffer.concat([jpeg,Buffer.from('<script>')]),'x.jpg','image/jpeg']
])test('reject '+name,async()=>assert.rejects(validateFiles(form(data,file,mime)),/INVALID_ATTACHMENT/));
test('reject fourth file',async()=>{const f=form();for(let i=0;i<3;i++)f.append('Photo',new File([jpeg],'x.jpg',{type:'image/jpeg'}));await assert.rejects(validateFiles(f));});
test('placeholder unselected input skipped',async()=>assert.equal((await validateFiles(form(Buffer.alloc(0),'','application/octet-stream'))).length,0));
function mock({failUpload=false,failCommit=false,clean=true,paths=[`${batch}/${object}.jpg`]}={}) {
 const calls=[];
 const db={calls,rpc:async(name,args)=>{calls.push({name,args});if(name==='gef_commit_attachment_batch')return failCommit?{error:Error('SENSITIVE_TEST_SENTINEL')}:{data:{id:lead,duplicate:false,attachments_complete:true,notification_queued:true}};
 if(name==='gef_claim_attachment_cleanup')return {data:paths};
 if(name==='gef_admin_attachment')return {data:clean?{path:`${batch}/${object}.jpg`,scan_state:'clean'}:null};return {data:true};},
 storage:{from(bucket){assert.equal(bucket,BUCKET);return {
 upload:async(path,data,options)=>{calls.push({name:'upload',path,options});return {error:failUpload?Error('SENSITIVE_TEST_SENTINEL'):null};},
 remove:async(paths)=>{calls.push({name:'remove',paths});return {};},
 createSignedUrl:async(path,ttl,options)=>{calls.push({name:'sign',path,ttl,options});return {data:{signedUrl:`https://cpjsbijgijeyrwjpuciv.supabase.co/storage/v1/object/sign/${bucket}/${path}?token=SYNTHETIC_ONLY`}};}
 };}}};
 const original=db.rpc;
 db.rpc=(...args)=>{const result=original(...args);result.retry=enabled=>{assert.equal(enabled,false);return result;};return result;};
 return db;
}
test('ledger then upload then atomic receipt; no upsert or filename',async()=>{const db=mock();const files=await validateFiles(form());await persistAttachments({submission_token:crypto.randomUUID()},files,{db});assert.deepEqual(db.calls.map(x=>x.name),['gef_reserve_attachment_batch','upload','gef_commit_attachment_batch']);assert.equal(db.calls[1].options.upsert,false);assert.ok(!JSON.stringify(db.calls).includes('image.jpg'));});
for(const kind of ['failUpload','failCommit'])test(kind+' never reports success, deletes potentially committed objects or leaks errors',async()=>{const db=mock({[kind]:true});await assert.rejects(persistAttachments({},await validateFiles(form()),{db}),e=>e.message==='ATTACHMENTS_NOT_CONFIRMED');assert.ok(!db.calls.some(x=>x.name==='remove'));});
test('reservation failure prevents upload',async()=>{const db=mock();db.rpc=async()=>({error:Error('secret')});await assert.rejects(persistAttachments({},await validateFiles(form()),{db}),/DATABASE_FAILURE/);assert.equal(db.calls.length,0);});
test('cleanup uses only fenced ledger paths',async()=>{const db=mock();await recoverBatch(batch,db);assert.deepEqual(db.calls.map(x=>x.name),['gef_claim_attachment_cleanup','remove','gef_finish_attachment_cleanup']);});
test('cleanup traversal rejected',async()=>{const db=mock({paths:['../other']});await assert.rejects(recoverBatch(batch,db));assert.ok(!db.calls.some(x=>x.name==='remove'));});
test('quarantine cannot issue URL',async()=>{const db=mock({clean:false});await assert.rejects(signedAttachment(lead,object,db));assert.ok(!db.calls.some(x=>x.name==='sign'));});
test('admin clean attachment signs for 60s, forces download',async()=>{const db=mock();assert.equal((await signedAttachment(lead,object,db)).expiresIn,60);assert.equal(db.calls[1].ttl,60);assert.equal(db.calls[1].options.download,'attachment');});
test('invalid IDs cannot select paths',async()=>{const db=mock();await assert.rejects(signedAttachment('../x',object,db));assert.equal(db.calls.length,0);});
for(const mode of ['unset','preview','production','wrong-project'])test('client denies '+mode+' before network',()=>{const env={GETESTIMATEFAST_ATTACHMENTS_ENABLED:'true',VERCEL_ENV:'development',GETESTIMATEFAST_SUPABASE_URL:'https://cpjsbijgijeyrwjpuciv.supabase.co',GETESTIMATEFAST_SUPABASE_SECRET_KEY:'SYNTHETIC_ONLY'};if(mode==='unset')delete env.GETESTIMATEFAST_ATTACHMENTS_ENABLED;else if(mode==='wrong-project')env.GETESTIMATEFAST_SUPABASE_URL='https://wrong.invalid';else env.VERCEL_ENV=mode;assert.throws(()=>client(env),/ATTACHMENTS_DISABLED/);});
test('admin route without auth cannot access database or storage',async()=>{const handler=require('../api/admin/lead-attachments');const res={setHeader(){},end(body){this.body=body;}};await handler({method:'POST',headers:{}},res);assert.ok([401,503].includes(res.statusCode));assert.ok(!res.body.includes('SYNTHETIC'));});
test('authorized admin can sign; common user denied before metadata access',async()=>{
 const {createHandler}=require('../api/admin/lead-attachments');
 for(const approved of [false,true]){
  const db=mock(),res={setHeader(){},end(body){this.body=body;}};
  const handler=createHandler({getClient:()=>db,authenticate:async(req,res)=>{if(approved)return {id:'synthetic-admin'};res.statusCode=403;res.end('{}');return null;},readBody:async()=>({action:'sign',leadId:lead,attachmentId:object})});
  await handler({method:'POST',headers:{}},res);
  assert.equal(res.statusCode,approved?200:403);assert.equal(db.calls.length,approved?2:0);
 }
});
test('substituted signing host rejected',async()=>{const db=mock();db.storage.from=()=>({createSignedUrl:async()=>({data:{signedUrl:'https://evil.invalid/file'}})});await assert.rejects(signedAttachment(lead,object,db),/SIGNING_FAILED/);});
test('real SDK transport is bounded, redirects rejected, auth not persisted (synthetic fetch)',async()=>{
 const original=global.fetch;const calls=[];let status=200;
 global.fetch=async(url,opts)=>{calls.push({url,opts});return new Response(status===200?'true':'{"message":"SYNTHETIC_SERVER_FAILURE"}',{status,headers:{'content-type':'application/json'}});};
 try{
  const db=client({GETESTIMATEFAST_ATTACHMENTS_ENABLED:'true',VERCEL_ENV:'development',GETESTIMATEFAST_SUPABASE_URL:'https://cpjsbijgijeyrwjpuciv.supabase.co',GETESTIMATEFAST_SUPABASE_SECRET_KEY:'sb_secret_SYNTHETIC_ONLY_NOT_REAL'});
  const result=await db.rpc('gef_reserve_attachment_batch',{p_batch:batch,p_objects:[]});assert.equal(result.error,null);
  assert.equal(calls.length,1);assert.equal(calls[0].opts.redirect,'error');assert.ok(calls[0].opts.signal instanceof AbortSignal);
  calls.length=0;status=503;
  await assert.rejects(persistAttachments({},await validateFiles(form()),{db}),/DATABASE_FAILURE/);
  assert.equal(calls.length,1,'SDK must not automatically retry a mutating RPC');
 }finally{global.fetch=original;}
});
