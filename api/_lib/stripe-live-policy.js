"use strict";
function livePaymentsApproved(env=process.env){
  return env.VERCEL_ENV==="production" &&
    env.VERCEL_PROJECT_ID==="prj_kA6x5rt1MChiNSQpa6pShHoUSuOF" &&
    env.GETESTIMATEFAST_ISOLATED_BACKEND!=="true" &&
    env.GETESTIMATEFAST_STRIPE_MODE==="live" &&
    env.GETESTIMATEFAST_STRIPE_LIVE_ENABLED==="true" &&
    env.GETESTIMATEFAST_STRIPE_LIVE_CHECKOUT_APPROVED==="true" &&
    env.GETESTIMATEFAST_STRIPE_LIVE_WEBHOOK_ENABLED==="true" &&
    env.GETESTIMATEFAST_STRIPE_LIVE_SCHEMA_APPROVED==="true" &&
    env.GETESTIMATEFAST_MARKETPLACE_PRODUCTION_ENABLED==="true" &&
    env.GETESTIMATEFAST_MARKETPLACE_SCHEMA_APPROVED==="true" &&
    env.GETESTIMATEFAST_SMS_MODE==="disabled" &&
    env.GETESTIMATEFAST_STRIPE_TEST_CHECKOUT_APPROVED!=="true" &&
    env.GETESTIMATEFAST_STRIPE_TEST_WEBHOOK_ENABLED!=="true" &&
    env.GETESTIMATEFAST_REVIEW_GOOGLE_ENABLED!=="true" &&
    env.GETESTIMATEFAST_ADMIN_RECOVERY_ENABLED!=="true" &&
    String(env.GETESTIMATEFAST_SUPABASE_URL||"").replace(/\/$/,"")==="https://wedsjubkttygxtpkopfj.supabase.co" &&
    env.GETESTIMATEFAST_PUBLIC_ORIGIN==="https://www.getestimatefast.com";
}
module.exports={livePaymentsApproved};
