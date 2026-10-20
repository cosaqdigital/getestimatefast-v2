"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {Readable}=require("node:stream");
const fs=require("node:fs");
const path=require("node:path");
const handler=require("../api/admin/production-password-reset");

const ORIGIN="https://www.getestimatefast.com";
const HOST="www.getestimatefast.com";
const STAGED_ORIGIN="https://getestimatefast-v2-get-estimate-fast.vercel.app";
const STAGED_HOST="getestimatefast-v2-get-estimate-fast.vercel.app";
const AUTH_URL="https://wedsjubkttygxtpkopfj.supabase.co";
const ADMIN_ID="5cb70424-1c13-46dd-b457-4e6991ec4263";
const ADMIN_EMAIL="admin@getestimatefast.com";
const TOKEN="synthetic.header.signature";
const PASSWORD="Synthetic-Production-Reset-99!";
const baseEnv={
 VERCEL_ENV:"production",
 GETESTIMATEFAST_ADMIN_PASSWORD_RESET_ENABLED:"true",
 GETESTIMATEFAST_ADMIN_PASSWORD_RESET_STAGED_TEST:"false",
 GETESTIMATEFAST_ISOLATED_BACKEND:"false",
 GETESTIMATEFAST_SUPABASE_URL:AUTH_URL,
 GETESTIMATEFAST_PUBLIC_ORIGIN:ORIGIN,
 GETESTIMATEFAST_SUPABASE_PUBLISHABLE_KEY:"sb_publishable_prod_reset_test",
 GETESTIMATEFAST_SUPABASE_SECRET_KEY:"sb_secret_prod_reset_test"
};

function req(method="GET",body,headers={}){
 const r=Readable.from(body===undefined?[]:[Buffer.from(JSON.stringify(body))]);
 r.method=method;r.url="/api/admin/production-password-reset";r.query={};
 r.headers={host:HOST,"sec-fetch-site":"same-origin",...(method==="POST"?{origin:ORIGIN,"content-type":"application/json"}:{}),...headers};
 return r;
}
async function run(req){
 let text="";const headers={};
 const res={statusCode:200,setHeader(k,v){headers[k.toLowerCase()]=String(v);},end(v=""){text+=v;}};
 await handler(req,res);
 return {status:res.statusCode,data:JSON.parse(text),headers,text};
}
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{"content-type":"application/json"}});

async function isolated(overrides,fn){
 const keys=[...new Set([...Object.keys(baseEnv),...Object.keys(overrides||{})])];
 const saved=Object.fromEntries(keys.map(k=>[k,process.env[k]]));
 const original=global.fetch;const calls=[];
 for(const [k,v] of Object.entries({...baseEnv,...overrides}))v===undefined?delete process.env[k]:process.env[k]=v;
 let mock=()=>{throw Error("unexpected network call");};
 global.fetch=async(url,options={})=>{calls.push({url:String(url),options,method:options.method||"GET"});return mock(String(url),options);};
 try{return await fn({calls,setFetch:f=>mock=f});}
 finally{global.fetch=original;for(const [k,v] of Object.entries(saved))v===undefined?delete process.env[k]:process.env[k]=v;}
}

test("Production admin reset is fail-closed outside exact Production configuration",async()=>{
 for(const override of [
  {GETESTIMATEFAST_ADMIN_PASSWORD_RESET_ENABLED:undefined},
  {GETESTIMATEFAST_ADMIN_PASSWORD_RESET_ENABLED:"false"},
  {VERCEL_ENV:"preview"},
  {GETESTIMATEFAST_ISOLATED_BACKEND:"true"},
  {GETESTIMATEFAST_SUPABASE_URL:"https://cpjsbijgijeyrwjpuciv.supabase.co"},
  {GETESTIMATEFAST_PUBLIC_ORIGIN:"https://getestimatefast.com"},
  {GETESTIMATEFAST_SUPABASE_SECRET_KEY:undefined}
 ]) await isolated(override,async({calls})=>{
  const r=await run(req());
  assert.equal(r.status,404);assert.equal(r.data.code,"recovery_disabled");assert.equal(calls.length,0);
 });
});

test("anonymous request sends reset only to fixed admin and exact reset redirect",async()=>{
 await isolated({},async({calls,setFetch})=>{
  setFetch((url,options)=>{
   assert.equal(url,AUTH_URL+"/auth/v1/recover?redirect_to="+encodeURIComponent(ORIGIN+"/admin-reset-password.html"));
   assert.equal(options.method,"POST");
   assert.deepEqual(JSON.parse(options.body),{email:ADMIN_EMAIL});
   assert.equal(options.headers.Authorization,undefined);
   return json({});
  });
  const r=await run(req("POST",{action:"request"}));
  assert.equal(r.status,200);assert.deepEqual(r.data,{ok:true,requested:true});
  assert.equal(calls.length,1);
 });
});

test("staged Production reset is rejected unless the explicit staged-test gate is enabled",async()=>{
 await isolated({},async({calls})=>{
  const r=await run(req("POST",{action:"request"},{host:STAGED_HOST,origin:STAGED_ORIGIN}));
  assert.equal(r.status,403);assert.equal(r.data.code,"origin_not_allowed");assert.equal(calls.length,0);
 });
});

test("guarded staged Production reset uses only the fixed protected alias and staged redirect",async()=>{
 await isolated({GETESTIMATEFAST_ADMIN_PASSWORD_RESET_STAGED_TEST:"true"},async({calls,setFetch})=>{
  setFetch((url,options)=>{
   assert.equal(url,AUTH_URL+"/auth/v1/recover?redirect_to="+encodeURIComponent(STAGED_ORIGIN+"/admin-reset-password.html"));
   assert.equal(options.method,"POST");
   assert.deepEqual(JSON.parse(options.body),{email:ADMIN_EMAIL});
   return json({});
  });
  const r=await run(req("POST",{action:"request"},{host:STAGED_HOST,origin:STAGED_ORIGIN}));
  assert.equal(r.status,200);assert.deepEqual(r.data,{ok:true,requested:true});
  assert.equal(calls.length,1);
 });
});

test("recovery token must belong to confirmed fixed admin and current admin membership before update",async()=>{
 await isolated({},async({calls,setFetch})=>{
  let step=0;
  setFetch((url,options)=>{
   step++;
   if(step===1){
    assert.equal(url,AUTH_URL+"/auth/v1/user");assert.equal(options.headers.Authorization,"Bearer "+TOKEN);
    return json({id:ADMIN_ID,email:ADMIN_EMAIL,email_confirmed_at:"2026-10-19T18:13:33Z"});
   }
   if(step===2){
    assert.match(url,/\/rest\/v1\/admin_users\?user_id=eq\./);
    return json([{user_id:ADMIN_ID}]);
   }
   if(step===3){
    assert.equal(url,AUTH_URL+"/auth/v1/user");assert.equal(options.method,"PUT");
    assert.equal(options.headers.Authorization,"Bearer "+TOKEN);
    assert.deepEqual(JSON.parse(options.body),{password:PASSWORD});
    return json({id:ADMIN_ID,email:ADMIN_EMAIL});
   }
   throw Error("unexpected call");
  });
  const check=await run(req("GET",undefined,{authorization:"Bearer "+TOKEN}));
  assert.equal(check.status,200);assert.equal(check.data.sessionValidated,true);
  const done=await run(req("POST",{action:"complete",password:PASSWORD},{authorization:"Bearer "+TOKEN}));
  assert.equal(done.status,200);assert.deepEqual(done.data,{ok:true,redirectPath:"/admin.html"});
  assert.equal(calls.length,5);
 });
});

test("different account, unconfirmed account, or missing admin membership cannot change password",async()=>{
 const cases=[
  {user:{id:ADMIN_ID,email:"other@example.invalid",email_confirmed_at:"x"},members:[{user_id:ADMIN_ID}]},
  {user:{id:ADMIN_ID,email:ADMIN_EMAIL,email_confirmed_at:null},members:[{user_id:ADMIN_ID}]},
  {user:{id:ADMIN_ID,email:ADMIN_EMAIL,email_confirmed_at:"x"},members:[]}
 ];
 for(const c of cases)await isolated({},async({calls,setFetch})=>{
  setFetch((url)=>{
   if(url===AUTH_URL+"/auth/v1/user")return json(c.user);
   if(url.startsWith(AUTH_URL+"/rest/v1/admin_users?"))return json(c.members);
   throw Error("unexpected update");
  });
  const r=await run(req("POST",{action:"complete",password:PASSWORD},{authorization:"Bearer "+TOKEN}));
  assert.equal(r.status,403);assert.equal(r.data.code,"access_denied");
  assert(!calls.some(x=>x.method==="PUT"));
 });
});

test("reset page scrubs token transport and Vercel applies no-store hardening",()=>{
 const root=path.join(__dirname,"..");
 const html=fs.readFileSync(path.join(root,"admin-reset-password.html"),"utf8");
 const js=fs.readFileSync(path.join(root,"assets/admin-reset-password.js"),"utf8");
 const admin=fs.readFileSync(path.join(root,"admin.html"),"utf8");
 const cfg=JSON.parse(fs.readFileSync(path.join(root,"vercel.json"),"utf8"));
 assert.match(html,/noindex,nofollow,noarchive/);
 assert.match(html,/admin-reset-password\.js/);
 assert.match(js,/history\.replaceState/);
 assert.match(js,/types\[0\]!==\"recovery\"/);
 assert.doesNotMatch(js,/refresh_token/);
 assert.match(admin,/Forgot administrator password/);
 const rule=cfg.headers.find(x=>x.source==="/admin-reset-password.html");
 assert(rule);
 const h=Object.fromEntries(rule.headers.map(x=>[x.key.toLowerCase(),x.value]));
 assert.match(h["cache-control"],/no-store/);
 assert.equal(h["x-frame-options"],"DENY");
 assert.match(h["content-security-policy"],/frame-ancestors 'none'/);
});
