"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {queryDb}=require("../api/admin/_auth");
test("review conflict mapping never forwards arbitrary SQL details or classifies other RPCs",async()=>{
 const previous={...process.env},saved=global.fetch;
 try{
  Object.assign(process.env,{GETESTIMATEFAST_ISOLATED_BACKEND:"true",GETESTIMATEFAST_SUPABASE_URL:"http://127.0.0.1:54321",GETESTIMATEFAST_SUPABASE_SECRET_KEY:"synthetic-server-key",GETESTIMATEFAST_SUPABASE_PUBLISHABLE_KEY:"synthetic-public-key",VERCEL_ENV:"development"});delete process.env.VERCEL;
  const conflict={code:"P0001",message:"Review invitation expired or already used",details:"SYNTHETIC private SQL details"};
  global.fetch=async()=>new Response(JSON.stringify(conflict),{status:400});
  await assert.rejects(queryDb("rpc/gef_submit_review"),e=>e.message==="Database returned 400"&&/invitation/.test(e.reviewConflict)&&!e.reviewConflict.includes("SQL"));
  await assert.rejects(queryDb("rpc/gef_moderate_review"),e=>e.message==="Database returned 400"&&!e.reviewConflict);
  global.fetch=async()=>new Response(JSON.stringify({code:"23505",message:'duplicate key value violates unique constraint "unrelated_private_constraint"'}),{status:409});
  await assert.rejects(queryDb("rpc/gef_submit_review"),e=>e.message==="Database returned 409"&&!e.reviewConflict);
  global.fetch=async()=>new Response("not JSON: SYNTHETIC private response",{status:502});
  await assert.rejects(queryDb("rpc/gef_submit_review"),e=>e.message==="Database returned 502"&&!e.reviewConflict);
 }finally{global.fetch=saved;for(const k of Object.keys(process.env))if(!(k in previous))delete process.env[k];Object.assign(process.env,previous);}
});
