"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {Readable}=require("node:stream");
const fs=require("node:fs");
const path=require("node:path");
const {mode,sign,verify,readFields,validate,requestOriginAllowed}=require("../api/_lib/profile-origin");
const {profileHtml}=require("../api/_lib/public-profile-html");
const estimateHandler=require("../api/profile-request");
const publicProfileHandler=require("../api/public-profile");
const originHandler=require("../api/contractor/origin-leads");
const ref="cpjsbijgijeyrwjpuciv";
const uuid="11111111-1111-4111-8111-111111111111",token="22222222-2222-4222-8222-222222222222";
const env=()=>({
 VERCEL_ENV:"preview",VERCEL_GIT_COMMIT_REF:"feat/us-admin-overview-20261015",
 GETESTIMATEFAST_ISOLATED_BACKEND:"true",GETESTIMATEFAST_DEVELOPMENT_PROJECT_REF:ref,
 GETESTIMATEFAST_SUPABASE_URL:"https://"+ref+".supabase.co",
 GETESTIMATEFAST_SUPABASE_SECRET_KEY:"sb_secret_qa_fake",
 GETESTIMATEFAST_SUPABASE_PUBLISHABLE_KEY:"sb_publishable_qa_fake",
 GETESTIMATEFAST_REVIEW_IDENTITY_SECRET:"US_ORIGIN_TEST_SECRET_DO_NOT_USE_FOR_REAL_ACCOUNTS",
 GETESTIMATEFAST_PROFILE_REQUESTS_MODE:"synthetic"
});
const profile={contractor_id:uuid,slug:"sample-contractor",categories:["Painting"],published:true};
const input=(envOverride={})=>({
 profile_slug:profile.slug,profile_token:sign(profile.slug,uuid,Date.now(),{...env(),...envOverride}),
 submission_token:token,full_name:"TEST ONLY Customer",email:"synthetic@example.invalid",
 phone:"8135550100",city:"Riverview",zip:"33569",service:"Painting",
 description:"TEST ONLY: Synthetic painting request for QA, no customer or work involved.",
 contact_consent:"yes",website:""
});
const j=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{"content-type":"application/json"}});
function nodeReq(path,method,body={},headers={}){
 const request=new URLSearchParams(body);
 const req=Readable.from([Buffer.from(request.toString())]);req.method=method;req.query={};
 req.headers={host:"test.example.invalid","content-type":"application/x-www-form-urlencoded","x-vercel-forwarded-for":"198.51.100.2",...headers};
 req.socket={remoteAddress:"198.51.100.2"};
 return req;
}
async function responseFor(handler,req){
 let payload="",headers={};
 const res={statusCode:200,setHeader(k,v){headers[k.toLowerCase()]=String(v)},end(value=""){payload+=String(value)}};
 await handler(req,res);
 return {status:res.statusCode,body:payload,headers};
}
async function withEnv(overrides,run){
 const saved={...process.env},priorFetch=global.fetch,priorError=console.error;
 const calls=[],logs=[];
 Object.assign(process.env,env(),overrides);delete process.env.GETESTIMATEFAST_PROFILE_REQUESTS_LIVE_APPROVED;
 console.error=(...parts)=>logs.push(parts.map(String).join(" "));
 try{return await run({calls,logs,setFetch:handler=>{global.fetch=async(url,options={})=>{calls.push({url:String(url),method:options.method||"GET",options});return handler(String(url),options);};}});}
 finally{
  global.fetch=priorFetch;console.error=priorError;
  for(const key of Object.keys(process.env))if(!(key in saved))delete process.env[key];
  Object.assign(process.env,saved);
 }
}
test("origin tokens are signed, bound to the actual public profile, and time-limited",()=>{
 const e=env(),start=Date.parse("2026-10-16T15:00:00Z"),signed=sign(profile.slug,uuid,start,e);
 assert.equal(verify(signed,profile.slug,start+1000,e)?.contractorId,uuid);
 assert.equal(verify(signed,"different-provider",start+1000,e),null);
 assert.equal(verify(signed+"x",profile.slug,start+1000,e),null);
 assert.equal(verify(signed,profile.slug,start+8*86400*1000,e),null);
 assert.equal(verify(signed,profile.slug,start-3600*1000,e),null);
 assert.equal(mode({...e,GETESTIMATEFAST_ISOLATED_BACKEND:"false"}),null);
 assert.equal(mode({...e,GETESTIMATEFAST_SUPABASE_URL:"https://other.supabase.co"}),null);
 assert.equal(mode({...e,VERCEL_ENV:"production"}),null);
 assert.equal(mode(e),"synthetic");
});
test("official deployment and branch Preview hosts can safely differ",()=>{
 const e={...env(),
  VERCEL_URL:"getestimatefast-v2-azmwy2ut2-get-estimate-fast.vercel.app",
  VERCEL_BRANCH_URL:"getestimatefast-v2-git-feat-us-admin-o-10fae9-get-estimate-fast.vercel.app",
  GETESTIMATEFAST_PUBLIC_ORIGIN:"https://getestimatefast-v2-git-feat-us-admin-o-10fae9-get-estimate-fast.vercel.app"};
 const deployOrigin="https://"+e.VERCEL_URL,branchOrigin="https://"+e.VERCEL_BRANCH_URL;
 assert.equal(requestOriginAllowed(deployOrigin,e.VERCEL_BRANCH_URL,e),true);
 assert.equal(requestOriginAllowed(branchOrigin,e.VERCEL_URL,e),true);
 assert.equal(requestOriginAllowed(deployOrigin,e.VERCEL_URL,e),true);
 assert.equal(requestOriginAllowed("https://attacker.example.com",e.VERCEL_URL,e),false);
 assert.equal(requestOriginAllowed("https://getestimatefast-v2-evil-other-team.vercel.app",e.VERCEL_URL,e),false);
 assert.equal(requestOriginAllowed(branchOrigin,"attacker.example.com",e),false);
 assert.equal(requestOriginAllowed("https://getestimatefast-v2-azmwy2ut2-get-estimate-fast.vercel.app.evil.com",e.VERCEL_URL,e),false);
 assert.equal(requestOriginAllowed("null",e.VERCEL_URL,e),false);
 assert.equal(requestOriginAllowed("http://"+e.VERCEL_URL,e.VERCEL_URL,e),false);
 assert.equal(requestOriginAllowed(branchOrigin,e.VERCEL_URL,{...e,GETESTIMATEFAST_ISOLATED_BACKEND:"false"}),false);
});
test("profile intake requires accurate category, explicit sharing consent and fictional preview data",()=>{
 const e=env(),good=input(),fields=readFields(new URLSearchParams(good));
 assert.equal(validate(fields,profile,"synthetic"),"");
 assert.match(validate({...fields,contact_consent:""},profile,"synthetic"),/confirm/);
 assert.match(validate({...fields,service:"Roofing"},profile,"synthetic"),/Select a service/);
 assert.match(validate({...fields,email:"customer@gmail.com"},profile,"synthetic"),/synthetic test/);
 assert.match(validate({...fields,phone:"8132223333"},profile,"synthetic"),/synthetic test/);
 assert.match(validate({...fields,website:"spam"},profile,"synthetic"),/Invalid/);
 assert.throws(()=>readFields(new URLSearchParams("zip=33569&zip=33570")));
});
test("public professional HTML provides no public direct phone/email and an explicit consent form",()=>{
 const html=profileHtml({profile:{
  slug:profile.slug,display_name:"Sample Contractor",headline:"Quality paint",about:"Painting contractor",
  city:"Riverview",state_code:"FL",zip_code:"33569",radius_miles:25,categories:["Painting"],
  languages:["English"],social_links:["https://wa.me/18135550100"],portfolio:[],
  public_email:"owner@example.invalid",public_phone:"+18135550100"
 },reviews:[],review_summary:{approved_count:0}}, "https://test.example.invalid","https://storage.example.invalid",
 {token:"synthetic-signed-token",synthetic:true});
 assert(html.includes("Request a Free Estimate"));
 assert(html.includes('href="/assets/profile-request.css"'));
 assert(html.includes('action="/api/profile-request"'));
 assert(html.includes('name="contact_consent"'));
 assert(!html.includes("owner@example.invalid")&&!html.includes("+18135550100")&&!html.includes("wa.me"));
 assert(html.includes("Other local professionals may also purchase access"));
 assert(html.includes("Development test only."));
});
test("profile quote preview never reaches database unless synthetic QA mode explicitly enabled",async()=>{
 await withEnv({GETESTIMATEFAST_PROFILE_REQUESTS_MODE:"disabled"},async({setFetch,calls})=>{
  setFetch(()=>{throw Error("No external operations expected")});
  const r=await responseFor(estimateHandler,nodeReq("/api/profile-request","POST",input()));
  assert.equal(r.status,503);assert.equal(calls.length,0);
 });
});
test("invalid source attribution is rejected before any database read",async()=>{
 await withEnv({},async({setFetch,calls})=>{
  setFetch(()=>{throw Error("No external operations expected")});
  const values=input();values.profile_slug="other-contractor";
  const r=await responseFor(estimateHandler,nodeReq("/api/profile-request","POST",values));
  assert.equal(r.status,400);assert.equal(calls.length,0);
 });
});
test("valid synthetic profile request creates one reviewed US lead, with server-derived attribution",async()=>{
 await withEnv({},async({setFetch,calls,logs})=>{
  let created;
  setFetch((url,opts)=>{
   if(url.includes("/contractor_public_profiles?"))return j([profile]);
   if(url.includes("/contractor_profiles?"))return j([{user_id:uuid}]);
   if(url.includes("/rpc/gef_public_request_allowed"))return j(true);
   if(url.includes("/leads?on_conflict=")){created=JSON.parse(opts.body);return j([{id:"33333333-3333-4333-8333-333333333333",origin_contractor_id:uuid}],201);}
   throw Error("Unexpected request "+url);
  });
  const r=await responseFor(estimateHandler,nodeReq("/api/profile-request","POST",input()));
  assert.equal(r.status,303);assert.equal(r.headers.location,"/profile-request-received.html");
  assert.equal(created.origin_contractor_id,uuid);
  assert.equal(created.source,"professional_profile");
  assert.equal(created.status,"new");
  assert.equal(created.details._profile_referral.origin_slug,profile.slug);
  assert.equal(created.details._profile_referral.customer_share_accepted,true);
  assert.equal(calls.length,4);
  assert(!calls.some(c=>c.url.includes("resend.com")));
  assert.equal(logs.length,0);
 });
});
test("signed synthetic form POST accepts two exact preview aliases while retaining all intake protections",async()=>{
 await withEnv({
  VERCEL_URL:"getestimatefast-v2-azmwy2ut2-get-estimate-fast.vercel.app",
  VERCEL_BRANCH_URL:"getestimatefast-v2-git-feat-us-admin-o-10fae9-get-estimate-fast.vercel.app",
  GETESTIMATEFAST_PUBLIC_ORIGIN:"https://getestimatefast-v2-git-feat-us-admin-o-10fae9-get-estimate-fast.vercel.app"
 },async({setFetch,calls})=>{
  setFetch((url,opts)=>{
   if(url.includes("/contractor_public_profiles?"))return j([profile]);
   if(url.includes("/contractor_profiles?"))return j([{user_id:uuid}]);
   if(url.includes("/rpc/gef_public_request_allowed"))return j(true);
   if(url.includes("/leads?on_conflict="))return j([{id:"33333333-3333-4333-8333-333333333333",origin_contractor_id:uuid}],201);
   throw Error("Unexpected remote call");
  });
  const req=nodeReq("/api/profile-request","POST",input(),{
   host:"getestimatefast-v2-azmwy2ut2-get-estimate-fast.vercel.app",
   origin:"https://getestimatefast-v2-git-feat-us-admin-o-10fae9-get-estimate-fast.vercel.app"
  });
  const r=await responseFor(estimateHandler,req);
  assert.equal(r.status,303);
  assert.equal(calls.length,4);
 });
});
test("rate limit blocks write, wrong owner and duplicate token are rejected",async()=>{
 await withEnv({},async({setFetch,calls})=>{
  setFetch((url)=>{
   if(url.includes("/contractor_public_profiles?"))return j([profile]);
   if(url.includes("/contractor_profiles?"))return j([{user_id:uuid}]);
   if(url.includes("/rpc/gef_public_request_allowed"))return j(false);
   throw Error("Unexpected insert");
  });
  assert.equal((await responseFor(estimateHandler,nodeReq("/api/profile-request","POST",input()))).status,429);
  assert(!calls.some(c=>c.url.includes("/leads")));
 });
 await withEnv({},async({setFetch})=>{
  setFetch((url)=>{
   if(url.includes("/contractor_public_profiles?"))return j([{...profile,contractor_id:"44444444-4444-4444-8444-444444444444"}]);
   throw Error("Unexpected further DB access");
  });
  assert.equal((await responseFor(estimateHandler,nodeReq("/api/profile-request","POST",input()))).status,503);
 });
});
test("only an authenticated active originator can see client contacts, never before publication",async()=>{
 await withEnv({},async({setFetch})=>{
  setFetch(url=>{
   if(url.includes("/auth/v1/user"))return j({id:uuid,email_confirmed_at:"2026-01-01"});
   if(url.includes("/contractor_profiles?"))return j([{account_status:"active",email_verified_at:"2026-01-01"}]);
   if(url.includes("/leads?"))return j([
    {id:"33333333-3333-4333-8333-333333333331",service_type:"Painting",city:"Riverview",zip_code:"33569",status:"new",created_at:"2026-10-16",full_name:"WAITING PRIVATE",email:"private@example.invalid",phone:"8135550100",details:{_profile_referral:{customer_share_accepted:true}}},
    {id:"33333333-3333-4333-8333-333333333332",service_type:"Painting",city:"Riverview",zip_code:"33569",status:"published",created_at:"2026-10-16",full_name:"TEST ONLY Approved",email:"approved@example.invalid",phone:"8135550100",details:{_profile_referral:{customer_share_accepted:true}}}
   ]);
   if(url.includes("/opportunity_previews?"))return j([{id:"55555555-5555-4555-8555-555555555555",lead_id:"33333333-3333-4333-8333-333333333332"}]);
   throw Error("Unknown database call");
  });
  const req=nodeReq("/api/contractor/origin-leads","GET");req.headers.authorization="Bearer test123";
  const result=await responseFor(originHandler,req);
  assert.equal(result.status,200);
  const data=JSON.parse(result.body);
  assert.equal(data.total,2);
  assert.equal(data.leads[0].contact_available,false);
  assert.equal(data.leads[0].customer,null);
  assert.equal(data.leads[1].contact_available,true);
  assert.equal(data.leads[1].customer.name,"TEST ONLY Approved");
  assert.equal(data.leads[1].contact_price_cents,0);
  assert(!result.body.includes("WAITING PRIVATE"));
  assert(!result.body.includes("private@example.invalid"));
 });
});
test("unauthenticated visitor never gets origin contacts",async()=>{
 await withEnv({},async({setFetch})=>{
  setFetch(()=>{throw Error("Unauthenticated request should not query anything")});
  const r=await responseFor(originHandler,nodeReq("/api/contractor/origin-leads","GET"));
  assert.equal(r.status,401);
 });
});

test("retry succeeds only for an existing token bound to the same profile source and owner",async()=>{
 for(const existing of [
  {id:token,origin_contractor_id:uuid,source:"professional_profile"},
  {id:token,origin_contractor_id:"44444444-4444-4444-8444-444444444444",source:"professional_profile"},
  {id:token,origin_contractor_id:uuid,source:"getestimatefast.com"},
  null
 ]){
  await withEnv({},async({setFetch,calls})=>{
   setFetch(url=>{
    if(url.includes("/contractor_public_profiles?"))return j([profile]);
    if(url.includes("/contractor_profiles?"))return j([{user_id:uuid}]);
    if(url.includes("/rpc/gef_public_request_allowed"))return j(true);
    if(url.includes("/leads?on_conflict="))return j([]);
    if(url.includes("/leads?submission_token="))return j(existing?[existing]:[]);
    throw Error("Unexpected outbound call");
   });
   const result=await responseFor(estimateHandler,nodeReq("/api/profile-request","POST",input()));
   const valid=existing?.origin_contractor_id===uuid&&existing?.source==="professional_profile";
   assert.equal(result.status,valid?303:409);
   assert.equal(calls.filter(c=>c.method==="POST"&&c.url.includes("/leads?")).length,1);
   assert(!calls.some(c=>/resend|stripe|zenvia/.test(c.url)));
  });
 }
});

test("a distinct submission token remains a separate legitimate request with the same contact details",async()=>{
 await withEnv({},async({setFetch})=>{
  const saved=new Map();
  setFetch((url,opts)=>{
   if(url.includes("/contractor_public_profiles?"))return j([profile]);
   if(url.includes("/contractor_profiles?"))return j([{user_id:uuid}]);
   if(url.includes("/rpc/gef_public_request_allowed"))return j(true);
   if(url.includes("/leads?on_conflict=")){
    const record=JSON.parse(opts.body);
    assert(!saved.has(record.submission_token));
    saved.set(record.submission_token,record);
    return j([{id:record.submission_token,origin_contractor_id:uuid}],201);
   }
   throw Error("Unexpected outbound call");
  });
  for(const submission_token of [token,"33333333-3333-4333-8333-333333333333"]){
   assert.equal((await responseFor(estimateHandler,nodeReq("/api/profile-request","POST",{...input(),submission_token}))).status,303);
  }
  assert.equal(saved.size,2);
 });
});

test("external origins are rejected by the actual intake handler before database access",async()=>{
 await withEnv({VERCEL_URL:"getestimatefast-v2-qa-get-estimate-fast.vercel.app"},async({setFetch,calls})=>{
  setFetch(()=>{throw Error("No database access permitted")});
  const req=nodeReq("/api/profile-request","POST",input(),{
   host:"getestimatefast-v2-qa-get-estimate-fast.vercel.app",origin:"https://attacker.example.com"
  });
  assert.equal((await responseFor(estimateHandler,req)).status,403);
  assert.equal(calls.length,0);
 });
});

test("origin contacts ignore forged owner identifiers and require consent plus a published preview",async()=>{
 await withEnv({},async({setFetch,calls})=>{
  const missingPreview="33333333-3333-4333-8333-333333333331";
  const missingConsent="33333333-3333-4333-8333-333333333332";
  setFetch(url=>{
   if(url.includes("/auth/v1/user"))return j({id:uuid,email_confirmed_at:"2026-01-01"});
   if(url.includes("/contractor_profiles?"))return j([{account_status:"active",email_verified_at:"2026-01-01"}]);
   if(url.includes("/leads?"))return j([
    {id:missingPreview,status:"published",email:"hidden-preview@example.invalid",details:{_profile_referral:{customer_share_accepted:true}}},
    {id:missingConsent,status:"published",email:"hidden-consent@example.invalid",details:{_profile_referral:{customer_share_accepted:false}}}
   ]);
   if(url.includes("/opportunity_previews?"))return j([{id:token,lead_id:missingConsent}]);
   throw Error("Unexpected outbound call");
  });
  const req=nodeReq("/api/contractor/origin-leads","GET");
  req.headers.authorization="Bearer test123";
  req.query={contractor_id:"44444444-4444-4444-8444-444444444444",origin_contractor_id:"44444444-4444-4444-8444-444444444444"};
  const result=await responseFor(originHandler,req);
  assert.equal(result.status,200);
  assert(JSON.parse(result.body).leads.every(l=>l.customer===null&&!l.contact_available));
  assert(!result.body.includes("@example.invalid"));
  const lookup=calls.find(c=>c.url.includes("/leads?"));
  assert(lookup.url.includes("origin_contractor_id=eq."+uuid));
  assert(!lookup.url.includes(req.query.contractor_id));
  assert(calls.every(c=>c.method==="GET"));
 });
});
test("SQL preserves buyer capacity and blocks charging the source professional",()=>{
 const sql=fs.readFileSync(path.join(__dirname,"../supabase/prepared-migrations/us-profile-origin-referrals.sql"),"utf8");
 assert.match(sql,/origin_contractor_id/);
 assert.match(sql,/gef_lead_origin_immutable/);
 assert.match(sql,/gef_no_paid_origin_contact/);
 assert.match(sql,/gef_private\.contact_purchases/);
 assert.doesNotMatch(sql,/grant\s+.+\s+to\s+(anon|authenticated)/i);
});

test("public profile response preserves the origin of its native same-origin form POST",async()=>{
 const previewHost="getestimatefast-v2-git-feat-us-admin-o-10fae9-get-estimate-fast.vercel.app";
 await withEnv({
  GETESTIMATEFAST_MARKETPLACE_PREVIEW:"true",
  GETESTIMATEFAST_PUBLIC_ORIGIN:"https://"+previewHost,
  GETESTIMATEFAST_SMS_MODE:"dry_run",
  GETESTIMATEFAST_STRIPE_TEST_CHECKOUT_APPROVED:"false"
 },async({setFetch,calls})=>{
  setFetch((url,opts)=>{
   assert(url.startsWith("https://"+ref+".supabase.co/rest/v1/"));
   if(url.endsWith("/rpc/gef_public_profile")){
    assert.equal(opts.method,"POST");
    assert.deepEqual(JSON.parse(opts.body),{p_slug:profile.slug});
    return j({profile:{
     slug:profile.slug,display_name:"Sample Contractor",headline:"Quality paint",
     about:"Painting contractor",city:"Riverview",state_code:"FL",zip_code:"33569",
     radius_miles:25,categories:["Painting"],languages:["English"],portfolio:[]
    },reviews:[]});
   }
   if(url.includes("/contractor_public_profiles?"))return j([{contractor_id:uuid}]);
   throw Error("Unexpected outbound call");
  });
  const req=nodeReq("/professionals/"+profile.slug,"GET",{}, {host:previewHost});
  req.query={slug:profile.slug,format:"html"};
  const result=await responseFor(publicProfileHandler,req);
  assert.equal(result.status,200);
  assert.equal(result.headers["referrer-policy"],"same-origin");
  const policies=[...result.body.matchAll(/<meta\b[^>]*name="referrer"[^>]*content="([^"]+)"[^>]*>/g)].map(match=>match[1]);
  assert.deepEqual(policies,["same-origin"]);
  assert.match(result.body,/<form\b[^>]*action="\/api\/profile-request"[^>]*method="post"/);
  assert.match(result.headers["content-security-policy"],/(?:^|;\s*)form-action 'self'(?:;|$)/);
  assert.equal(calls.length,2);
 });
});
test("opaque null Origin is rejected by the intake handler before database access",async()=>{
 const previewHost="getestimatefast-v2-qa-get-estimate-fast.vercel.app";
 await withEnv({VERCEL_URL:previewHost},async({setFetch,calls})=>{
  setFetch(()=>{throw Error("No database access permitted for an opaque origin")});
  const req=nodeReq("/api/profile-request","POST",input(),{host:previewHost,origin:"null"});
  const result=await responseFor(estimateHandler,req);
  assert.equal(result.status,403);
  assert.match(result.body,/Request origin not allowed\./);
  assert.equal(calls.length,0);
 });
});
