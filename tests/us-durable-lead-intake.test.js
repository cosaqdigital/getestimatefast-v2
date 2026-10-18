"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { Readable } = require("node:stream");
const fs = require("node:fs");
const path = require("node:path");
const handler = require("../api/lead");
const { DEVELOPMENT_REF, PREVIEW_BRANCHES } = require("../api/_lib/preview-target");
const TOKEN = "31e7431c-518b-4c92-84ad-64f088f23233";
const LEAD_ID = "a543017a-f35d-409a-90e1-2a0557c10be5";
const DEV_URL = "https://" + DEVELOPMENT_REF + ".supabase.co";
const KEYS = ["GETESTIMATEFAST_ISOLATED_BACKEND","VERCEL_ENV","VERCEL_GIT_COMMIT_REF","GETESTIMATEFAST_SUPABASE_URL","GETESTIMATEFAST_SUPABASE_SECRET_KEY","LEAD_PERSISTENCE_ENABLED","RESEND_API_KEY","LEAD_TO_EMAIL","LEAD_FROM_EMAIL"];
const dbReply=(data,status=201)=>new Response(JSON.stringify(data),{status,headers:{"content-type":"application/json"}});
async function invoke(fieldOverrides={},opts={}) {
  const form=new FormData();
  const values={
    "Submission Token":TOKEN,"Service Type":"Painting","Full Name":"Synthetic Example",
    "Phone Number":"8135550101","Email Address":"customer@example.invalid",
    "City":"Riverview","ZIP Code":"33569","Project Description":"Paint a living room.",
    ...fieldOverrides
  };
  for(const [key,value] of Object.entries(values))if(value!==null&&value!==undefined)form.append(key,value);
  if(opts.invalidFile)form.append("Photo 1",new File(["invalid"],"unsupported.txt",{type:"text/plain"}));
  const request=new Request("https://www.getestimatefast.com/api/lead",{method:"POST",body:form});
  const req=Readable.from([Buffer.from(await request.arrayBuffer())]);
  req.method="POST";
  req.headers={"content-type":request.headers.get("content-type")};
  const headers={};
  let body="";
  const res={statusCode:200,setHeader(k,v){headers[k.toLowerCase()]=String(v);},end(v=""){body+=String(v);}};
  await handler(req,res);
  return {status:res.statusCode,headers,body};
}
async function harness(overrides={},mockFetch=()=>{throw Error("Unexpected external call")},fn){
  const originalEnv=Object.fromEntries(KEYS.map(key=>[key,process.env[key]]));
  const originalFetch=global.fetch,originalError=console.error;
  const calls=[],errors=[];
  Object.assign(process.env,{
    GETESTIMATEFAST_ISOLATED_BACKEND:"false",VERCEL_ENV:"development",VERCEL_GIT_COMMIT_REF:"",
    GETESTIMATEFAST_SUPABASE_URL:DEV_URL,
    GETESTIMATEFAST_SUPABASE_SECRET_KEY:"SYNTHETIC_KEY_ONLY",
    LEAD_PERSISTENCE_ENABLED:"true",
    RESEND_API_KEY:"SYNTHETIC_RESEND_KEY",
    LEAD_TO_EMAIL:"admin@example.invalid"
  });
  for(const [key,value] of Object.entries(overrides)){if(value===null)delete process.env[key];else process.env[key]=value;}
  global.fetch=async(url,options={})=>{const call={url:String(url),method:options.method||"GET",options};calls.push(call);return mockFetch(call);};
  console.error=(...args)=>errors.push(args);
  try{await fn({invoke,calls,errors});}finally{
    global.fetch=originalFetch;
    console.error=originalError;
    for(const [key,value] of Object.entries(originalEnv)){if(value===undefined)delete process.env[key];else process.env[key]=value;}
  }
}
const okDb=call=>call.url.startsWith(DEV_URL)?dbReply([{id:LEAD_ID}]):dbReply({id:"synthetic-send"},200);

test("disabled persistence cannot send email or report success",async()=>{
 await harness({LEAD_PERSISTENCE_ENABLED:"false"},undefined,async({invoke,calls})=>{
   assert.equal((await invoke()).status,503);assert.equal(calls.length,0);
 });
});
test("missing token is rejected before any side effects",async()=>{
 await harness({},undefined,async({invoke,calls})=>{
   assert.equal((await invoke({"Submission Token":null})).status,400);assert.equal(calls.length,0);
 });
});
test("invalid file is rejected before database write",async()=>{
 await harness({},undefined,async({invoke,calls})=>{
   assert.equal((await invoke({}, {invalidFile:true})).status,413);assert.equal(calls.length,0);
 });
});
test("different database destination is blocked",async()=>{
 await harness({GETESTIMATEFAST_SUPABASE_URL:"https://non-gef-project.supabase.co"},undefined,async({invoke,calls})=>{
   assert.equal((await invoke()).status,503);assert.equal(calls.length,0);
 });
});
test("prod environment cannot insert in development DB",async()=>{
 await harness({VERCEL_ENV:"production"},undefined,async({invoke,calls})=>{
   assert.equal((await invoke()).status,503);assert.equal(calls.length,0);
 });
});
test("persist before notification",async()=>{
 await harness({},okDb,async({invoke,calls})=>{
   const r=await invoke();assert.equal(r.status,303);assert.equal(calls.length,2);
   assert.ok(calls[0].url.startsWith(DEV_URL+"/rest/v1/leads?"));
   const data=JSON.parse(calls[0].options.body);
   assert.equal(data.submission_token,TOKEN);assert.equal(data.status,"new");
   assert.equal(data.details._platform_review.required,true);
   assert.equal(calls[1].url,"https://api.resend.com/emails");
 });
});
test("DB failure prevents email and success",async()=>{
 await harness({},()=>dbReply({error:"failed"},503),async({invoke,calls})=>{
   assert.equal((await invoke()).status,503);assert.equal(calls.length,1);
 });
});
test("verified duplicate skips notification",async()=>{
 await harness({},call=>call.method==="GET"?dbReply([{id:LEAD_ID}],200):dbReply([]),async({invoke,calls})=>{
   assert.equal((await invoke()).status,303);assert.deepEqual(calls.map(x=>x.method),["POST","GET"]);
 });
});
test("unverified duplicate cannot report success",async()=>{
 await harness({},call=>call.method==="GET"?dbReply([],200):dbReply([]),async({invoke,calls})=>{
   assert.equal((await invoke()).status,503);assert.deepEqual(calls.map(x=>x.method),["POST","GET"]);
 });
});
test("notification failure preserves successful persisted receipt and logs no PII",async()=>{
 await harness({},call=>call.url.includes("resend.com")?new Response("Synthetic private error body",{status:500}):dbReply([{id:LEAD_ID}]),async({invoke,calls,errors})=>{
   assert.equal((await invoke()).status,303);assert.equal(calls.length,2);
   assert.ok(errors.some(x=>String(x[0]).includes("notification failed after lead storage")));
   assert.doesNotMatch(JSON.stringify(errors),/customer@example.invalid|SYNTHETIC_KEY_ONLY|Synthetic private error body/);
 });
});
test("network notification failure preserves persisted receipt",async()=>{
 await harness({},call=>call.url.includes("resend.com")?Promise.reject(Error("synthetic timeout")):dbReply([{id:LEAD_ID}]),async({invoke,errors})=>{
   assert.equal((await invoke()).status,303);
   assert.ok(errors.some(x=>String(x[0]).includes("notification transport failed")));
 });
});
test("missing notification config still acknowledges stored lead",async()=>{
 await harness({RESEND_API_KEY:null,LEAD_TO_EMAIL:null},okDb,async({invoke,calls})=>{
   assert.equal((await invoke()).status,303);assert.equal(calls.length,1);
 });
});
test("protected preview never accepts submissions",async()=>{
 await harness({VERCEL_ENV:"preview",VERCEL_GIT_COMMIT_REF:"feat/us-persisted-leads-20261014"},undefined,async({invoke,calls})=>{
   assert.equal((await invoke()).status,503);assert.equal(calls.length,0);
 });
});
test("all native form scripts generate UUIDs and deployment is blocked",()=>{
  const guided=fs.readFileSync(path.join(__dirname,"../assets/platform-forms.js"),"utf8");
  const native=fs.readFileSync(path.join(__dirname,"../assets/service-landing.js"),"utf8");
  assert.match(guided,/generateGuidedSubmissionToken/);
  assert.match(native,/generateServiceSubmissionToken/);
  assert.match(native,/token.name = "Submission Token"/);
  const config=JSON.parse(fs.readFileSync(path.join(__dirname,"../vercel.json"),"utf8"));
  assert.equal(config.git.deploymentEnabled["feat/us-persisted-leads-20261014"],false);
  assert.ok(PREVIEW_BRANCHES.includes("feat/us-persisted-leads-20261014"));
});
