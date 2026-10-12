"use strict";
const { DEVELOPMENT_REF } = require("./preview-target");
const SANDBOX_BRANCH = "feat/stripe-sandbox-safety-20261012";
// Infrastructure readiness is independent from permission to create a payment.
function allowedScope(env) {
  return env.GETESTIMATEFAST_ISOLATED_BACKEND === "true" && env.GETESTIMATEFAST_STRIPE_MODE === "test" &&
    env.GETESTIMATEFAST_DEVELOPMENT_PROJECT_REF === DEVELOPMENT_REF &&
    env.GETESTIMATEFAST_SMS_MODE === "dry_run" &&
    (env.VERCEL_ENV === "development" ||
      (env.VERCEL_ENV === "preview" && env.VERCEL_GIT_COMMIT_REF === SANDBOX_BRANCH &&
        env.VERCEL_PROJECT_ID === "prj_kA6x5rt1MChiNSQpa6pShHoUSuOF"));
}
function checkoutApproved(env = process.env) {
  return allowedScope(env) && env.GETESTIMATEFAST_MARKETPLACE_PREVIEW === "true" &&
    env.GETESTIMATEFAST_STRIPE_TEST_CHECKOUT_APPROVED === "true" &&
    env.GETESTIMATEFAST_STRIPE_TEST_WEBHOOK_ENABLED === "true" &&
    env.GETESTIMATEFAST_STRIPE_TEST_SCHEMA_APPROVED === "true";
}
function webhookApproved(env = process.env) {
  return allowedScope(env) && env.GETESTIMATEFAST_STRIPE_TEST_WEBHOOK_ENABLED === "true" &&
    env.GETESTIMATEFAST_STRIPE_TEST_SCHEMA_APPROVED === "true";
}
module.exports = { SANDBOX_BRANCH, allowedScope, checkoutApproved, webhookApproved };
