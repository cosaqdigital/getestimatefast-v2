"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {productionMarketplaceEnabled}=require("../api/_lib/marketplace-access");

function baseEnv(){
  return {
    VERCEL_ENV:"production",
    GETESTIMATEFAST_SUPABASE_URL:"https://wedsjubkttygxtpkopfj.supabase.co",
    GETESTIMATEFAST_MARKETPLACE_PRODUCTION_ENABLED:"true",
    GETESTIMATEFAST_MARKETPLACE_SCHEMA_APPROVED:"true",
    GETESTIMATEFAST_ISOLATED_BACKEND:"false",
    GETESTIMATEFAST_SMS_MODE:"disabled",
    GETESTIMATEFAST_STRIPE_TEST_CHECKOUT_APPROVED:"false",
    GETESTIMATEFAST_STRIPE_TEST_WEBHOOK_ENABLED:"false",
    GETESTIMATEFAST_ADMIN_RECOVERY_ENABLED:"false",
    GETESTIMATEFAST_REVIEW_SCHEMA_APPROVED:"true"
  };
}

test("Google reviews do not disable the Production marketplace",()=>{
  const env={...baseEnv(),GETESTIMATEFAST_REVIEW_GOOGLE_ENABLED:"true"};
  assert.equal(productionMarketplaceEnabled(env),true);
});

test("unsafe Production gates still disable the marketplace",()=>{
  assert.equal(productionMarketplaceEnabled({...baseEnv(),GETESTIMATEFAST_REVIEW_GOOGLE_ENABLED:"true",GETESTIMATEFAST_REVIEW_SCHEMA_APPROVED:"false"}),false);
  assert.equal(productionMarketplaceEnabled({...baseEnv(),GETESTIMATEFAST_SMS_MODE:"live"}),false);
  assert.equal(productionMarketplaceEnabled({...baseEnv(),GETESTIMATEFAST_STRIPE_TEST_CHECKOUT_APPROVED:"true"}),false);
  assert.equal(productionMarketplaceEnabled({...baseEnv(),GETESTIMATEFAST_ADMIN_RECOVERY_ENABLED:"true"}),false);
});
