"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {productionMarketplaceEnabled}=require("../api/_lib/marketplace-access");

function env(overrides={}){
  return {
    VERCEL_ENV:"production",
    GETESTIMATEFAST_MARKETPLACE_PRODUCTION_ENABLED:"true",
    GETESTIMATEFAST_MARKETPLACE_SCHEMA_APPROVED:"true",
    GETESTIMATEFAST_ISOLATED_BACKEND:"false",
    GETESTIMATEFAST_SUPABASE_URL:"https://wedsjubkttygxtpkopfj.supabase.co",
    GETESTIMATEFAST_SMS_MODE:"disabled",
    GETESTIMATEFAST_STRIPE_TEST_CHECKOUT_APPROVED:"false",
    GETESTIMATEFAST_STRIPE_TEST_WEBHOOK_ENABLED:"false",
    GETESTIMATEFAST_ADMIN_RECOVERY_ENABLED:"false",
    GETESTIMATEFAST_REVIEW_GOOGLE_ENABLED:"true",
    GETESTIMATEFAST_REVIEW_SCHEMA_APPROVED:"true",
    ...overrides
  };
}

test("Google reviews do not disable the Production marketplace",()=>{
  assert.equal(productionMarketplaceEnabled(env()),true);
});

test("Production marketplace still fails closed for unsafe test checkout",()=>{
  assert.equal(productionMarketplaceEnabled(env({GETESTIMATEFAST_STRIPE_TEST_CHECKOUT_APPROVED:"true"})),false);
});

test("Production marketplace still requires approved marketplace schema",()=>{
  assert.equal(productionMarketplaceEnabled(env({GETESTIMATEFAST_MARKETPLACE_SCHEMA_APPROVED:"false"})),false);
});
