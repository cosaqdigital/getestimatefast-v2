"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {
  previewMarketplaceEnabled,
  productionMarketplaceEnabled,
  marketplaceCommercialEnabled
}=require("../api/_lib/marketplace-access");

function productionEnv(overrides={}){
  return {
    VERCEL_ENV:"production",
    GETESTIMATEFAST_SUPABASE_URL:"https://wedsjubkttygxtpkopfj.supabase.co",
    GETESTIMATEFAST_ISOLATED_BACKEND:"false",
    GETESTIMATEFAST_MARKETPLACE_PRODUCTION_ENABLED:"true",
    GETESTIMATEFAST_MARKETPLACE_SCHEMA_APPROVED:"true",
    GETESTIMATEFAST_SMS_MODE:"disabled",
    GETESTIMATEFAST_STRIPE_TEST_CHECKOUT_APPROVED:"false",
    GETESTIMATEFAST_STRIPE_TEST_WEBHOOK_ENABLED:"false",
    GETESTIMATEFAST_REVIEW_GOOGLE_ENABLED:"false",
    GETESTIMATEFAST_REVIEW_SCHEMA_APPROVED:"true",
    GETESTIMATEFAST_ADMIN_RECOVERY_ENABLED:"false",
    ...overrides
  };
}

test("production marketplace requires explicit exact production gates",()=>{
  const ok=productionEnv();
  assert.equal(productionMarketplaceEnabled(ok),true);
  assert.equal(marketplaceCommercialEnabled(ok),true);

  assert.equal(productionMarketplaceEnabled(productionEnv({GETESTIMATEFAST_REVIEW_GOOGLE_ENABLED:"true"})),true);

  for(const bad of [
    {GETESTIMATEFAST_MARKETPLACE_PRODUCTION_ENABLED:"false"},
    {GETESTIMATEFAST_MARKETPLACE_SCHEMA_APPROVED:"false"},
    {GETESTIMATEFAST_ISOLATED_BACKEND:"true"},
    {GETESTIMATEFAST_SUPABASE_URL:"https://cpjsbijgijeyrwjpuciv.supabase.co"},
    {GETESTIMATEFAST_SMS_MODE:"dry_run"},
    {GETESTIMATEFAST_STRIPE_TEST_CHECKOUT_APPROVED:"true"},
    {GETESTIMATEFAST_STRIPE_TEST_WEBHOOK_ENABLED:"true"},
    {GETESTIMATEFAST_REVIEW_GOOGLE_ENABLED:"true",GETESTIMATEFAST_REVIEW_SCHEMA_APPROVED:"false"},
    {GETESTIMATEFAST_ADMIN_RECOVERY_ENABLED:"true"}
  ]){
    assert.equal(productionMarketplaceEnabled(productionEnv(bad)),false,JSON.stringify(bad));
  }
});

test("preview marketplace remains separate from production gates",()=>{
  const env={
    VERCEL_ENV:"preview",
    GETESTIMATEFAST_MARKETPLACE_PREVIEW:"true",
    GETESTIMATEFAST_ISOLATED_BACKEND:"true"
  };
  assert.equal(previewMarketplaceEnabled(env),true);
  assert.equal(productionMarketplaceEnabled(env),false);
  assert.equal(marketplaceCommercialEnabled(env),true);
});

test("Stripe test HTTP surfaces are hard-blocked in Production",()=>{
  const checkout=fs.readFileSync(path.join(__dirname,"../api/contractor/stripe-test-checkout.js"),"utf8");
  const webhook=fs.readFileSync(path.join(__dirname,"../api/stripe-test-webhook.js"),"utf8");
  assert.match(checkout,/VERCEL_ENV === "production"\) return json\(res, 404/);
  assert.match(webhook,/VERCEL_ENV === "production"\) return json\(res, 404/);
});

test("production contractor consent records cannot use preview legal versions",()=>{
  const profile=fs.readFileSync(path.join(__dirname,"../api/contractor/profile.js"),"utf8");
  const signup=fs.readFileSync(path.join(__dirname,"../api/contractor/signup.js"),"utf8");
  assert.match(profile,/GETESTIMATEFAST_PRIVACY_VERSION/);
  assert.match(profile,/GETESTIMATEFAST_TERMS_VERSION/);
  assert.match(profile,/VERCEL_ENV==="production"/);
  assert.match(signup,/GETESTIMATEFAST_PRIVACY_VERSION/);
  assert.match(signup,/GETESTIMATEFAST_TERMS_VERSION/);
});
