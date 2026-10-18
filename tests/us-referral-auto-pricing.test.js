"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const {Readable}=require("node:stream");
const handler=require("../api/admin/publish-opportunity");
const id="22222222-2222-4222-8222-222222222222";
const admin="11111111-1111-4111-8111-111111111111";
const origin="33333333-3333-4333-8333-333333333333";
const envKeys=["GETESTIMATEFAST_ISOLATED_BACKEND","GETESTIMATEFAST_DEVELOPMENT_PROJECT_REF","GETESTIMATEFAST_SUPABASE_URL","GETESTIMATEFAST_SUPABASE_SECRET_KEY","GETESTIMATEFAST_SUPABASE_PUBLISHABLE_KEY","VERCEL_ENV","VERCEL_GIT_COMMIT_REF"];
const response=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{"Content-Type":"application/json"}});
async function invoke({referral=true,rules=true,isAdmin=true,fromOtherOrigin=false}={}){
 const saved=Object.fromEntries(envKeys.map(k=>[k,process.env[k]]));
 const oldFetch=global.fetch,oldError=console.error,requests=[];
 Object.assign(process.env,{GETESTIMATEFAST_ISOLATED_BACKEND:"true",GETESTIMATEFAST_DEVELOPMENT_PROJECT_REF:"cpjsbijgijeyrwjpuciv",GETESTIMATEFAST_SUPABASE_URL:"https://cpjsbijgijeyrwjpuciv.supabase.co",GETESTIMATEFAST_SUPABASE_SECRET_KEY:"SYNTHETIC_TEST_KEY",GETESTIMATEFAST_SUPABASE_PUBLISHABLE_KEY:"SYNTHETIC_TEST_PUBLIC",VERCEL_ENV:"preview",VERCEL_GIT_COMMIT_REF:"feat/us-admin-overview-20261015"});
 global.fetch=async(url,init={})=>{
  const u=String(url);requests.push({url:u,method:init.method||"GET",body:init.body});
  if(u.includes("/auth/v1/user"))return response({id:admin,email_confirmed_at:"2026-01-01"});
  if(u.includes("admin_users?"))return response(isAdmin?[{user_id:admin}]:[]);
  if(u.includes("leads?id="))return response([{source:referral?"professional_profile":"getestimatefast.com",origin_contractor_id:referral?origin:null,service_type:"Painting"}]);
  if(u.includes("marketplace_price_rules?"))return response(rules?[{id:"44444444-4444-4444-8444-444444444444"}]:[]);
  if(u.includes("rpc/admin_publish_profile_opportunity_priced"))return response({opportunity_id:"55555555-5555-4555-8555-555555555555",status:"published",origin_professional_free:true,commercial_terms_assigned:true});
  if(u.includes("rpc/admin_publish_opportunity"))return response({opportunity_id:"55555555-5555-4555-8555-555555555555",status:"published"});
  throw Error("Unexpected outbound API");
 };
 console.error=()=>{};
 const input=JSON.stringify({id,summary:"Synthetic interior painting request without PII.",confirmReviewed:true});
 const req=Readable.from([Buffer.from(input)]);req.method="POST";
 req.headers={authorization:"Bearer synthetic-admin-token",host:"test.example.invalid",...(fromOtherOrigin?{origin:"https://malicious.example.invalid"}:{})};
 const res={statusCode:200,setHeader(){},end(body){this.body=JSON.parse(body||"{}")}};
 try{await handler(req,res);return {status:res.statusCode,body:res.body,requests};}
 finally{global.fetch=oldFetch;console.error=oldError;for(const k of envKeys){if(saved[k]===undefined)delete process.env[k];else process.env[k]=saved[k];}}
}
test("originating-profile lead publishes atomically with configured pricing",async()=>{
 const r=await invoke();
 assert.equal(r.status,200);assert.equal(r.body.commercial_terms_assigned,true);
 assert.equal(r.body.origin_professional_free,true);
 assert(r.requests.some(x=>x.url.includes("rpc/admin_publish_profile_opportunity_priced")));
 assert(!r.requests.some(x=>x.url.endsWith("rpc/admin_publish_opportunity")));
 assert(r.requests.some(x=>x.url.includes("marketplace_price_rules?")));
 const rpc=r.requests.find(x=>x.url.includes("rpc/admin_publish_profile_opportunity_priced"));
 assert.equal(JSON.parse(rpc.body).p_actor,admin);
});
test("profile-origin opportunities cannot publish without active USD pricing",async()=>{
 const r=await invoke({rules:false});assert.equal(r.status,409);
 assert.match(r.body.error,/USD contact price/);
 assert(!r.requests.some(x=>x.url.includes("rpc/admin_publish")));
});
test("ordinary incoming requests preserve the existing publication path",async()=>{
 const r=await invoke({referral:false});
 assert.equal(r.status,200);assert.equal(r.body.origin_professional_free,false);
 assert(r.requests.some(x=>x.url.endsWith("rpc/admin_publish_opportunity")));
 assert(!r.requests.some(x=>x.url.includes("marketplace_price_rules?")));
});
test("unauthorized and cross-origin users cannot publish or configure prices",async()=>{
 const nope=await invoke({isAdmin:false});assert.equal(nope.status,403);
 assert(!nope.requests.some(x=>x.url.includes("leads?id=")));
 const cross=await invoke({fromOtherOrigin:true});assert.equal(cross.status,403);
 assert(!cross.requests.some(x=>x.url.includes("rpc/admin_publish")));
});
test("atomic SQL is invoker-only, approved-admin, scoped to US service_role",()=>{
 const sql=fs.readFileSync(path.join(__dirname,"../supabase/prepared-migrations/us-profile-origin-auto-pricing.sql"),"utf8");
 for(const part of ["SECURITY INVOKER","public.admin_publish_opportunity","public.gef_admin_configuration","commercial_terms_assigned","TO service_role","FROM PUBLIC,anon,authenticated"])assert(sql.includes(part),part);
 assert.doesNotMatch(sql,/SECURITY DEFINER|orcamentobrasil|ecbcbvnupndkaypegubv|wedsjubkttygxtpkopfj/i);
});
