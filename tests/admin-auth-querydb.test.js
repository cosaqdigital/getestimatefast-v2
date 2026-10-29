"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {queryDb}=require("../api/admin/_auth");

const ORIGINAL_ENV={
  url:process.env.GETESTIMATEFAST_SUPABASE_URL,
  secret:process.env.GETESTIMATEFAST_SUPABASE_SECRET_KEY,
  publishable:process.env.GETESTIMATEFAST_SUPABASE_PUBLISHABLE_KEY,
  isolated:process.env.GETESTIMATEFAST_ISOLATED_BACKEND,
  vercelEnv:process.env.VERCEL_ENV,
  vercel:process.env.VERCEL
};
const originalFetch=global.fetch;

function configure(){
  process.env.GETESTIMATEFAST_SUPABASE_URL="https://wedsjubkttygxtpkopfj.supabase.co";
  process.env.GETESTIMATEFAST_SUPABASE_SECRET_KEY="sb_secret_test";
  process.env.GETESTIMATEFAST_SUPABASE_PUBLISHABLE_KEY="sb_publishable_test";
  delete process.env.GETESTIMATEFAST_ISOLATED_BACKEND;
  delete process.env.VERCEL_ENV;
  delete process.env.VERCEL;
}
function restore(){
  const map=[
    ["GETESTIMATEFAST_SUPABASE_URL",ORIGINAL_ENV.url],
    ["GETESTIMATEFAST_SUPABASE_SECRET_KEY",ORIGINAL_ENV.secret],
    ["GETESTIMATEFAST_SUPABASE_PUBLISHABLE_KEY",ORIGINAL_ENV.publishable],
    ["GETESTIMATEFAST_ISOLATED_BACKEND",ORIGINAL_ENV.isolated],
    ["VERCEL_ENV",ORIGINAL_ENV.vercelEnv],
    ["VERCEL",ORIGINAL_ENV.vercel]
  ];
  for(const [key,value] of map){
    if(value===undefined)delete process.env[key];
    else process.env[key]=value;
  }
  global.fetch=originalFetch;
}

test("queryDb accepts successful 201 responses with an empty body",async()=>{
  configure();
  global.fetch=async()=>new Response(null,{status:201});
  try{
    const result=await queryDb("sms_consent_events",{method:"POST",body:"{}"});
    assert.equal(result,null);
  }finally{restore();}
});

test("queryDb still parses successful JSON responses",async()=>{
  configure();
  global.fetch=async()=>new Response(JSON.stringify([{id:"ok"}]),{
    status:200,headers:{"content-type":"application/json"}
  });
  try{
    const result=await queryDb("admin_users?select=id");
    assert.deepEqual(result,[{id:"ok"}]);
  }finally{restore();}
});
