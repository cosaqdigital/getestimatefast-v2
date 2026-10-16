"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const {Readable}=require("node:stream");
const {prepareProfileRequest,publicProfileRequestPath}=require("../api/_lib/profile-origin-policy");
const {profileHtml}=require("../api/_lib/public-profile-html");
const handler=require("../api/profile-request");
const {DEVELOPMENT_REF}=require("../api/_lib/preview-target");
const read=file=>fs.readFileSync(path.join(__dirname,"..",file),"utf8");
const leadId="5541a693-b42c-49e4-8111-bfa11ea28498";
const request={
 profileSlug:"synthetic-painter",submissionToken:"04a5f369-a4a5-4f8c-82c7-3f4a0389b461",
 service:"Painting",fullName:"Synthetic QA Customer",email:"customer@example.invalid",
 phone:"8135550100",city:"Riverview",zipCode:"33569",
 description:"Paint interior walls in a residential living room, including trim.",
 contactMethod:"email",marketplaceConsent:true,contactConsent:true,privacyConsent:true
};
const report=()=>({
 setHeader(){},statusCode:200,body:"",
 end(s=""){this.body+=String(s);}
});
const req=(body=request)=>{const source=Readable.from([Buffer.from(JSON.stringify(body))]);source.method="POST";source.headers={"content-type":"application/json",host:"local.test",origin:"https://local.test"};source.socket={remoteAddress:"127.0.0.1"};return source;};
async function withPreview(env,fetcher,run){
 const original={...process.env},before=global.fetch,log=console.error;
 try{
  Object.assign(process.env,{
   VERCEL_ENV:"preview",VERCEL_GIT_COMMIT_REF:"feat/us-profile-origin-free-leads-20261016",
   VERCEL:"0",GETESTIMATEFAST_ISOLATED_BACKEND:"true",
   GETESTIMATEFAST_PROFILE_REQUESTS_ENABLED:"true",GETESTIMATEFAST_MARKETPLACE_PREVIEW:"true",
   GETESTIMATEFAST_DEVELOPMENT_PROJECT_REF:DEVELOPMENT_REF,
   GETESTIMATEFAST_SUPABASE_URL:"https://"+DEVELOPMENT_REF+".supabase.co",
   GETESTIMATEFAST_SUPABASE_SECRET_KEY:"SYNTHETIC_TEST_SERVER_KEY",
   GETESTIMATEFAST_SUPABASE_PUBLISHABLE_KEY:"SYNTHETIC_TEST_PUBLIC_KEY",
   GETESTIMATEFAST_PUBLIC_ORIGIN:"https://synthetic-preview.example.invalid",
   GETESTIMATEFAST_REVIEW_IDENTITY_SECRET:"x".repeat(48),
   GETESTIMATEFAST_SMS_MODE:"dry_run",
   GETESTIMATEFAST_STRIPE_TEST_CHECKOUT_APPROVED:"false"
  },env);
  global.fetch=fetcher||(()=>{throw Error("Unexpected network call")});
  console.error=()=>{};
  await run();
 }finally{
  global.fetch=before;console.error=log;
  for(const key of Object.keys(process.env))if(!(key in original))delete process.env[key];
  Object.assign(process.env,original);
 }
}
test("valid profile-sourced request sanitizes the US input and fixes consent",()=>{
 const value=prepareProfileRequest(request);
 assert.equal(value.p_slug,"synthetic-painter");
 assert.equal(value.p_phone,"+18135550100");
 assert.equal(value.p_email,"customer@example.invalid");
 assert.equal(value.p_marketplace_consent,true);
 assert(!Object.hasOwn(value,"contractor_id"));
 assert(!Object.hasOwn(value,"amount_cents"));
 assert.equal(publicProfileRequestPath("synthetic-painter"),"/request-estimate.html?profile=synthetic-painter");
});
test("consent and invalid inputs cannot be bypassed",()=>{
 for(const change of [
  {marketplaceConsent:false},{contactConsent:false},{privacyConsent:false},
  {profileSlug:"../../admin"},{service:"Unlicensed demolition"},
  {zipCode:"10001"},{phone:"123"},{description:"too short"},{website:"bot"},
  {submissionToken:"not-a-uuid"}
 ])assert.throws(()=>prepareProfileRequest({...request,...change}));
});
test("public professional page exposes no phone/email and directs customers through GetEstimateFast",()=>{
 const sample={slug:"synthetic-painter",display_name:"Synthetic Painter",headline:"Home painting",about:"Local professional",city:"Riverview",state_code:"FL",zip_code:"33569",radius_miles:25,categories:["Painting"],languages:["English"],social_links:[],portfolio:[],public_phone:"+18135550100",public_email:"private@example.invalid"};
 const html=profileHtml({profile:sample,reviews:[]},"https://preview.example.invalid","https://storage.example.invalid");
 assert.match(html,/request-estimate\.html\?profile=synthetic-painter/);
 assert.match(html,/Request a Free Estimate/);
 assert.doesNotMatch(html,/tel:|private@example\.invalid|mailto:/);
 assert.match(html,/other local professionals/);
});
test("browser form includes explicit marketplace and contact consent and a real privacy notice",()=>{
 const html=read("request-estimate.html");
 assert.match(html,/name="marketplaceConsent"/);
 assert.match(html,/name="contactConsent"/);
 assert.match(html,/name="privacyConsent"/);
 assert.match(html,/profile-request-privacy\.html/);
 assert.match(read("assets/profile-request.js"),/\/api\/profile-request/);
});
test("public API never returns opted-in direct phone or email during the profile lead pilot",()=>{
 const code=read("api/public-profile.js");
 assert.match(code,/public_phone:null,public_email:null/);
 assert.match(code,/profileHtml\(publicData/);
});
test("live submission is blocked unless isolated preview and explicit approval",async()=>{
 await withPreview({GETESTIMATEFAST_PROFILE_REQUESTS_ENABLED:"false"},null,async()=>{
  const res=report();await handler(req(),res);assert.equal(res.statusCode,503);assert.match(res.body,/not yet available/);
 });
 await withPreview({VERCEL_ENV:"production"},null,async()=>{
  const res=report();await handler(req(),res);assert.equal(res.statusCode,503);
 });
 await withPreview({GETESTIMATEFAST_ISOLATED_BACKEND:"false"},null,async()=>{
  const res=report();await handler(req(),res);assert.equal(res.statusCode,503);
 });
});
test("no customer data enters the database without both consents",async()=>{
 let calls=0;
 await withPreview({},()=>{calls++;throw Error("No database access expected");},async()=>{
  const res=report();await handler(req({...request,marketplaceConsent:false}),res);
  assert.equal(res.statusCode,400);assert.equal(calls,0);
 });
});
test("atomic server transaction persists one lead and profile attribution, never sends external SMS or emails",async()=>{
 const calls=[];
 await withPreview({},async(url,options)=>{
  calls.push({url:String(url),options});
  const action=String(url).split("/rest/v1/")[1];
  if(action==="rpc/gef_public_request_allowed")return new Response("true",{status:200,headers:{"content-type":"application/json"}});
  if(action==="rpc/gef_create_profile_lead")return new Response(JSON.stringify({lead_id:leadId,status:"new",duplicate:false}),{status:200,headers:{"content-type":"application/json"}});
  throw Error("Unexpected endpoint");
 },async()=>{
  const res=report();await handler(req(),res);
  assert.equal(res.statusCode,201);
  const output=JSON.parse(res.body);assert.equal(output.received,true);
  assert.equal(output.request_id,leadId);
 });
 assert.equal(calls.length,2);
 assert(calls.every(c=>c.url.startsWith("https://"+DEVELOPMENT_REF+".supabase.co/rest/v1/rpc/")));
 assert.deepEqual(calls.map(c=>c.url.split("/").pop()),["gef_public_request_allowed","gef_create_profile_lead"]);
 const body=JSON.parse(calls[1].options.body);
 assert.equal(body.p_slug,"synthetic-painter");assert.equal(body.p_marketplace_consent,true);
 assert(!Object.hasOwn(body,"contractor_id"));
});
test("free entitlement never creates a paid contact purchase or wallet credit movement",()=>{
 const sql=read("supabase/prepared-migrations/us-profile-sourced-leads.sql");
 assert.match(sql,/gef_create_profile_lead/);
 assert.match(sql,/profile_lead_origins/);
 assert.match(sql,/gef_profile_origin_contact/);
 assert.match(sql,/amount_cents',0/);
 assert.match(sql,/before insert or update of contractor_id, opportunity_id/i);
 assert.match(sql,/raise exception 'Your own profile-generated contact is free/);
 assert.match(sql,/revoke all on function public\.gef_profile_origin_contact/);
 assert.match(sql,/profile_lead_contact_access/);
 assert.doesNotMatch(sql,/https?:\/\/|orcamentobrasil\.com/);
});
test("private origin contact read is always linked to the authenticated user",()=>{
 const route=read("api/contractor/profile-origin-leads.js");
 assert.match(route,/userFor\(req,res\)/);
 assert.match(route,/p_contractor:contractor\.id/);
 assert.match(route,/gef_profile_origin_contact/);
 assert.doesNotMatch(route,/blockPayments\(res\)/);
});
test("paid market is not silently activated",()=>{
 const vercel=JSON.parse(read("vercel.json"));
 assert.equal(vercel.git.deploymentEnabled["feat/us-profile-origin-free-leads-20261016"],false);
 assert.match(read("api/profile-request.js"),/GETESTIMATEFAST_PROFILE_REQUESTS_ENABLED/);
 assert.match(read("api/_lib/marketplace-access.js"),/blockPayments/);
 assert.match(read("api/lead.js"),/Public submissions and external email delivery are disabled/);
});
