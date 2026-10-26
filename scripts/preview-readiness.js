"use strict";
// Reads names/configuration locally. Never prints secret values or calls a provider.
const { config } = require("../api/admin/_auth");
const { PREVIEW_BRANCHES, DEVELOPMENT_REF } = require("../api/_lib/preview-target");
const { SANDBOX_BRANCH, checkoutApproved } = require("../api/_lib/stripe-policy");
const { EXPECTED_TEST_ACCOUNT_ID } = require("../api/_lib/stripe-account");
function inspect(env = process.env, { requireMarketplaceEnabled = true } = {}) {
  const missing = ["GETESTIMATEFAST_DEVELOPMENT_PROJECT_REF", "GETESTIMATEFAST_SUPABASE_URL", "GETESTIMATEFAST_SUPABASE_SECRET_KEY", "GETESTIMATEFAST_SUPABASE_PUBLISHABLE_KEY", "GETESTIMATEFAST_PUBLIC_ORIGIN", "GETESTIMATEFAST_REVIEW_IDENTITY_SECRET"].filter(name => !env[name]);
  const errors = [];
  if (env.VERCEL_ENV !== "preview") errors.push("VERCEL_ENV must be preview");
  if (!PREVIEW_BRANCHES.includes(env.VERCEL_GIT_COMMIT_REF)) errors.push("Wrong Preview branch");
  if (env.GETESTIMATEFAST_DEVELOPMENT_PROJECT_REF !== DEVELOPMENT_REF) errors.push("Wrong development project");
  if (env.GETESTIMATEFAST_ISOLATED_BACKEND !== "true" || (requireMarketplaceEnabled && env.GETESTIMATEFAST_MARKETPLACE_PREVIEW !== "true")) errors.push("Isolated backend and marketplace preview flags required");
  if (env.GETESTIMATEFAST_SMS_MODE !== "dry_run") errors.push("SMS must remain dry_run");
  if (env.VERCEL_GIT_COMMIT_REF === SANDBOX_BRANCH) {
    if (!["true", "false"].includes(env.GETESTIMATEFAST_STRIPE_TEST_CHECKOUT_APPROVED)) errors.push("Stripe Checkout approval must be explicit");
    if (env.GETESTIMATEFAST_STRIPE_MODE !== "test") errors.push("Stripe mode must be test");
  } else if (env.GETESTIMATEFAST_STRIPE_TEST_CHECKOUT_APPROVED !== "false") errors.push("Stripe Checkout must be explicitly disabled");
  if (env.VERCEL_GIT_COMMIT_REF === "feat/hosted-preview-validation-20261010" && env.GETESTIMATEFAST_STRIPE_MODE !== "test") errors.push("Stripe mode must be test");
  if ((env.GETESTIMATEFAST_REVIEW_IDENTITY_SECRET || "").length < 32) errors.push("Review identity secret must have at least 32 characters");
  try { const origin = new URL(env.GETESTIMATEFAST_PUBLIC_ORIGIN); if (origin.protocol !== "https:" || origin.username || origin.password || origin.pathname !== "/" || origin.search || origin.hash) throw Error(); } catch { errors.push("Trusted HTTPS Preview origin required"); }
  try { config(env); } catch { errors.push("Backend isolation validation failed"); }
  return { ready: !missing.length && !errors.length, missing_variable_names: missing, errors, secret_values_printed: false,
    stripe_checkout_enabled: checkoutApproved(env) && /^sk_test_[A-Za-z0-9]+$/.test(env.GETESTIMATEFAST_STRIPE_TEST_SECRET_KEY || "") && /^whsec_[A-Za-z0-9]+$/.test(env.GETESTIMATEFAST_STRIPE_TEST_WEBHOOK_SECRET || ""),
    stripe_checkout_approval_present: checkoutApproved(env),
    stripe_test_account_configured: env.GETESTIMATEFAST_STRIPE_TEST_ACCOUNT_ID === EXPECTED_TEST_ACCOUNT_ID };
}
module.exports = { inspect };
if (require.main === module) { const result = inspect(); console.log(JSON.stringify(result, null, 2)); process.exitCode = result.ready ? 0 : 1; }
