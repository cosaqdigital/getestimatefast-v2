"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {createSandbox}=require("../scripts/local-marketplace-sandbox");
test("HTTP -> authenticating handlers -> isolated SQL: profile, moderation, prices and payment blocks",async()=>{
 const s=await createSandbox();
 const api=async(path,token,body)=>{const r=await s.fetch(s.origin+path,{method:body?"POST":"GET",headers:{...(token?{Authorization:"Bearer "+token}:{}),...(body?{"Content-Type":"application/json"}:{})},body:body?JSON.stringify(body):undefined});return {status:r.status,data:await r.json()};};
 try{
  assert.equal((await api("/api/contractor/marketplace")).status,401);
  assert.equal((await api("/api/admin/marketplace","synthetic-contractor")).status,403);
  const profile={slug:"synthetic-http-profile",display_name:"Synthetic HTTP Provider",headline:"Synthetic sandbox profile",about:"A test profile with no real service or customer.",city:"Riverview",state_code:"FL",zip_code:"33569",radius_miles:25,categories:["Painting"],languages:["English"],social_links:[],portfolio:[],published:true,publish_email:false,publish_phone:false};
  assert.equal((await api("/api/contractor/marketplace?action=public-profile","synthetic-contractor",profile)).status,200);
  const read=await api("/api/public-profile?slug=synthetic-http-profile");assert.equal(read.status,200);assert.equal(read.data.profile.public_phone,null);assert.equal(read.data.profile.contractor_id,undefined);
  assert.equal((await api("/api/contractor/marketplace?action=public-profile","synthetic-other")).data.profile,null);
  const invite=await api("/api/contractor/marketplace?action=review-invitation","synthetic-contractor",{});assert.equal(invite.status,201);
  const review=await api("/api/public-profile?action=review",null,{token:invite.data.review_path.split("#")[1],display_name:"Synthetic HTTP Reviewer",email:"synthetic-http@example.invalid",rating:4,comment:"A synthetic review used only to test moderation.",consent:true});assert.equal(review.status,201);
  assert.equal((await api("/api/public-profile?slug=synthetic-http-profile")).data.reviews.length,0);
  assert.equal((await api("/api/admin/marketplace","synthetic-admin",{action:"moderate-review",review_id:review.data.review_id,status:"approved",reason:"Synthetic moderation test",operation_key:"moderation:http001"})).status,200);
  const published=await api("/api/public-profile?slug=synthetic-http-profile");assert.equal(published.data.reviews[0].source,"external");assert.equal(published.data.reviews[0].identity_hash,undefined);
  const rule={version:"synthetic-http-v1",currency:"USD",category:"Painting",base_cents:1234,floor_cents:100,max_buyers:2,lifetime_hours:24,scope_bps:{},urgency_bps:{},discounts:[],effective_at:"2020-01-01T00:00:00Z"};
  const configured=await api("/api/admin/marketplace","synthetic-admin",{action:"pricing_rule",payload:rule,reason:"Synthetic rule for HTTP tests",operation_key:"pricing:http001"});assert.equal(configured.status,200);
  assert.equal((await api("/api/admin/marketplace","synthetic-admin",{action:"opportunity_terms",payload:{opportunity_id:s.ids.opportunity,rule_id:configured.data.id},reason:"Synthetic terms for HTTP tests",operation_key:"terms:http001"})).status,200);
  const matches=await api("/api/contractor/opportunities?category=Painting&radius=25","synthetic-contractor");assert.equal(matches.status,200);assert.equal(matches.data.opportunities[0].commercial.amount_cents,1234);assert.equal(matches.data.opportunities[0].lead_id,undefined);assert.equal(matches.data.opportunities[0].phone,undefined);
  for(const action of ["purchase","topup","refund","profile-service-checkout"]){const blocked=await api("/api/contractor/marketplace?action="+action,"synthetic-contractor",{});assert.equal(blocked.status,503);assert.equal(blocked.data.payments_enabled,false);}
  const html=await s.fetch(s.origin+"/professionals/synthetic-http-profile");assert.equal(html.status,200);assert((await html.text()).includes('property="og:title"'));
  const ledger=(await s.db.query("select count(*)::int n from gef_private.ledger")).rows[0].n;assert.equal(ledger,0);
 }finally{await s.close();}
});
