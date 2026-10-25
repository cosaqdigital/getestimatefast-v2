"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {googleIdentity,parseContent}=require("../api/_lib/review-auth");

test("Google review identity accepts a verified Google identity",()=>{
  const identity=googleIdentity({
    id:"11111111-2222-4333-8444-555555555555",
    email:"customer@example.com",
    email_confirmed_at:"2026-10-25T00:00:00Z",
    is_anonymous:false,
    identities:[{
      provider:"google",
      provider_id:"google-sub-123",
      identity_data:{sub:"google-sub-123",email:"customer@example.com",email_verified:true}
    }]
  });
  assert.deepEqual(identity,{
    id:"11111111-2222-4333-8444-555555555555",
    sub:"google-sub-123",
    email:"customer@example.com"
  });
});

test("Google review identity rejects unverified provider email",()=>{
  assert.throws(()=>googleIdentity({
    id:"11111111-2222-4333-8444-555555555555",
    email:"customer@example.com",
    email_confirmed_at:"2026-10-25T00:00:00Z",
    is_anonymous:false,
    identities:[{
      provider:"google",
      provider_id:"google-sub-123",
      identity_data:{sub:"google-sub-123",email:"customer@example.com",email_verified:false}
    }]
  }),/Continue with Google/);
});

test("Google review content still requires consent and a substantive comment",()=>{
  assert.deepEqual(parseContent({
    display_name:"Customer",
    rating:5,
    comment:"Excellent work and communication.",
    consent:true,
    website:""
  }),{
    display_name:"Customer",
    rating:5,
    comment:"Excellent work and communication."
  });
  assert.throws(()=>parseContent({display_name:"Customer",rating:5,comment:"Too short",consent:true,website:""}));
});
