"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),{Readable}=require("node:stream");
const {parsePublicProfile,parseReview,publicProjection}=require("../api/_lib/public-profile-policy");
const {stripeCheckoutDraft}=require("../api/_lib/payment-draft");
const {profileHtml}=require("../api/_lib/public-profile-html");
const {config}=require("../api/admin/_auth");
const base={slug:"synthetic-provider",display_name:"Synthetic Provider",city:"Riverview",state_code:"FL",zip_code:"33569",radius_miles:25,categories:["Painting"],languages:["English"],published:true,publish_email:false,publish_phone:false};
test("public contacts require explicit consent; protected identity/status ignored",()=>{
 const p=parsePublicProfile({...base,user_id:"someone-else",account_status:"active",public_email:"private@example.invalid",public_phone:"8135550100"});
 assert.equal(p.public_email,null);assert.equal(p.public_phone,null);assert.equal(p.user_id,undefined);assert.equal(p.account_status,undefined);
 const opted=parsePublicProfile({...base,publish_phone:true,public_phone:"8135550100"});assert.equal(opted.public_phone,"+18135550100");
 assert.throws(()=>parsePublicProfile({...base,social_links:["javascript:alert(1)"]}));assert.throws(()=>parsePublicProfile({...base,zip_code:"10001"}));
 assert.equal(publicProjection({...p,published:false}),null);
});
test("reviews reject spam and spoofed origin, never retain raw email",()=>{
 const result=parseReview({token:"a".repeat(43),display_name:"Synthetic Reviewer",email:"synthetic@example.invalid",rating:5,comment:"Synthetic review for isolated testing",consent:true,source:"verified_purchase"},"x".repeat(32));
 assert.equal(result.email,undefined);assert.equal(result.source,undefined);assert.equal(result.identity_hash.length,64);
 assert.throws(()=>parseReview({rating:5,consent:true,website:"spam"},"x".repeat(32)));
});
test("Open Graph and public content escape stored HTML",()=>{
 const p={...base,headline:'<script>alert("x")</script>',about:"test",portfolio:[],social_links:[]};
 const html=profileHtml({profile:p,reviews:[]},"https://example.invalid","https://backend.invalid");assert(!html.includes('<script>alert("x")</script>'));assert(html.includes("&lt;script&gt;"));assert(html.includes('property="og:title"'));
});
test("Stripe preparation has no delivery and separates profile service from wallet",()=>{
 const intent={id:"00000000-0000-4000-8000-000000000001",operation_key:"synthetic:checkout",amount_cents:1999,currency:"USD",status:"pending",purpose:"wallet_topup",bonus_cents:0};
 const draft=stripeCheckoutDraft(intent,"https://example.invalid");assert.equal(draft.enabled,false);assert.equal(draft.params.line_items[0].price_data.unit_amount,1999);
 assert.throws(()=>stripeCheckoutDraft({...intent,purpose:"profile_service",bonus_cents:1},"https://example.invalid"));
});
test("isolated backend pin rejects production and every other known platform",()=>{
 const previous={...process.env};try{
  process.env.GETESTIMATEFAST_ISOLATED_BACKEND="true";process.env.GETESTIMATEFAST_SUPABASE_SECRET_KEY="synthetic-secret";process.env.GETESTIMATEFAST_SUPABASE_PUBLISHABLE_KEY="synthetic-public";process.env.GETESTIMATEFAST_SUPABASE_URL="http://127.0.0.1:54321";process.env.VERCEL_ENV="development";delete process.env.VERCEL;assert.equal(config().url,"http://127.0.0.1:54321");
  process.env.VERCEL_ENV="preview";assert.throws(config);
  process.env.VERCEL_ENV="production";assert.throws(config);process.env.VERCEL_ENV="preview";
  for(const ref of ["wedsjubkttygxtpkopfj","ecbcbvnupndkaypegubv","jwvsbgfhtaojjmhcmega"]){process.env.GETESTIMATEFAST_SUPABASE_URL="https://"+ref+".supabase.co";process.env.GETESTIMATEFAST_DEVELOPMENT_PROJECT_REF=ref;assert.throws(config);}
 }finally{for(const key of Object.keys(process.env))if(!(key in previous))delete process.env[key];Object.assign(process.env,previous);}
});
test("marketplace endpoints fail closed before authentication/network when disabled",async()=>{
 const old=process.env.GETESTIMATEFAST_MARKETPLACE_PREVIEW;delete process.env.GETESTIMATEFAST_MARKETPLACE_PREVIEW;
 const savedFetch=global.fetch;global.fetch=()=>{throw Error("Unexpected network call");};
 try{for(const handler of [require("../api/contractor/marketplace"),require("../api/admin/marketplace"),require("../api/public-profile")]){
  const req=Readable.from([]);req.method="GET";req.query={};req.headers={};let data;const res={setHeader(){},end(s){data=JSON.parse(s);}};await handler(req,res);assert.equal(res.statusCode,503);assert.match(data.error,/isolated/);
 }}finally{global.fetch=savedFetch;if(old===undefined)delete process.env.GETESTIMATEFAST_MARKETPLACE_PREVIEW;else process.env.GETESTIMATEFAST_MARKETPLACE_PREVIEW=old;}
});
