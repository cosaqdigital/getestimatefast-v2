"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const read=p=>fs.readFileSync(path.join(__dirname,"..",p),"utf8");
const endpoint=require("../api/admin/overview");
const ENV=["GETESTIMATEFAST_ISOLATED_BACKEND","GETESTIMATEFAST_DEVELOPMENT_PROJECT_REF","GETESTIMATEFAST_SUPABASE_URL","GETESTIMATEFAST_SUPABASE_SECRET_KEY","GETESTIMATEFAST_SUPABASE_PUBLISHABLE_KEY","VERCEL_ENV","VERCEL_GIT_COMMIT_REF"];
async function call(admin=true,validMetrics=true){
 const old=Object.fromEntries(ENV.map(k=>[k,process.env[k]]));const orig=global.fetch,logs=console.error,requests=[];
 Object.assign(process.env,{GETESTIMATEFAST_ISOLATED_BACKEND:"true",GETESTIMATEFAST_DEVELOPMENT_PROJECT_REF:"cpjsbijgijeyrwjpuciv",GETESTIMATEFAST_SUPABASE_URL:"https://cpjsbijgijeyrwjpuciv.supabase.co",GETESTIMATEFAST_SUPABASE_SECRET_KEY:"SYNTHETIC_KEY",GETESTIMATEFAST_SUPABASE_PUBLISHABLE_KEY:"SYNTHETIC_PUBLIC",VERCEL_ENV:"development",VERCEL_GIT_COMMIT_REF:""});
 global.fetch=async(url,init={})=>{requests.push({url:String(url),method:init.method||"GET"});
  if(String(url).includes("/auth/v1/user"))return new Response(JSON.stringify({id:"synthetic",email_confirmed_at:"2026-01-01"}));
  if(String(url).includes("admin_users?"))return new Response(JSON.stringify(admin?[{user_id:"synthetic"}]:[]));
  if(String(url).includes("/rest/v1/rpc/gef_admin_executive_overview"))return new Response(validMetrics?JSON.stringify([{requests_today:2,waiting_review:1,active_opportunities:3,revenue_today_cents:4200,active_professionals:4}]):"null",{status:200,headers:{"content-type":"application/json"}});
  throw Error("Unexpected request "+url);
 };
 console.error=()=>{};
 const req={method:"GET",headers:{authorization:"Bearer synthetic-token"}},res={statusCode:200,setHeader(){},end(v){this.body=JSON.parse(String(v||"{}"))}};
 try{await endpoint(req,res);return {code:res.statusCode,payload:res.body,requests}}finally{global.fetch=orig;console.error=logs;for(const [k,v] of Object.entries(old)){if(v===undefined)delete process.env[k];else process.env[k]=v;}}
}
test("contractor cannot read executive admin dashboard",async()=>{
 const r=await call(false);assert.equal(r.code,403);assert.equal(r.requests.some(x=>x.url.includes("gef_admin_executive_overview")),false);
});
test("authorized admin reads executive metrics from the independent US database",async()=>{
 const r=await call(true);assert.equal(r.code,200);assert.equal(r.payload.metrics.active_opportunities,3);assert.equal(r.payload.metrics.revenue_today_cents,4200);assert.equal(r.payload.time_zone,"America/New_York");assert.equal(r.requests.filter(x=>x.url.includes("gef_admin_executive_overview")).length,1);
});
test("missing executive metrics fail closed rather than displaying misleading zero",async()=>{
 const r=await call(true,false);assert.equal(r.code,503);
});
test("dashboard is login-gated with quick access to professional and financial screens",()=>{
 const html=read("admin.html"),js=read("assets/admin.js");
 assert.match(html,/id="dashboard" hidden/);assert.match(html,/id="overviewRevenueToday"/);assert.match(html,/id="overviewActiveOpportunities"/);assert.match(html,/id="overviewGoPros"/);
 assert.match(html,/href="\/marketplace-admin\.html"/);assert.match(js,/await api\("overview"\)/);
 assert.match(js,/refreshOverview\(\)/);
});
test("development only, and no automatic deployment",()=>{
 assert.equal(JSON.parse(read("vercel.json")).git.deploymentEnabled["feat/us-admin-overview-20261015"],false);
 assert.match(read("api/_lib/preview-target.js"),/feat\/us-admin-overview-20261015/);
});
