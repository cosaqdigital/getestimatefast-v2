"use strict";
const test = require("node:test"), assert = require("node:assert/strict"), { inspect } = require("../scripts/preview-readiness");
test("Preview preflight prints variable names only and rejects production/cross-project targets", () => {
 const env = { VERCEL_ENV: "preview", VERCEL_GIT_COMMIT_REF: "feat/isolated-preview-stripe-test-20261009", GETESTIMATEFAST_ISOLATED_BACKEND: "true", GETESTIMATEFAST_MARKETPLACE_PREVIEW: "true", GETESTIMATEFAST_DEVELOPMENT_PROJECT_REF: "abcdefghijklmnopqrst", GETESTIMATEFAST_SUPABASE_URL: "https://abcdefghijklmnopqrst.supabase.co", GETESTIMATEFAST_SUPABASE_SECRET_KEY: "SYNTHETIC_SERVER_SECRET_NOT_FOR_DISPLAY", GETESTIMATEFAST_SUPABASE_PUBLISHABLE_KEY: "synthetic", GETESTIMATEFAST_PUBLIC_ORIGIN: "https://synthetic.example.invalid", GETESTIMATEFAST_REVIEW_IDENTITY_SECRET: "SYNTHETIC_REVIEW_SECRET_NOT_FOR_DISPLAY", GETESTIMATEFAST_SMS_MODE: "dry_run", GETESTIMATEFAST_STRIPE_TEST_CHECKOUT_APPROVED: "false" };
 assert.equal(inspect(env).ready, true); assert(!JSON.stringify(inspect(env)).includes(env.GETESTIMATEFAST_SUPABASE_SECRET_KEY));
 for (const ref of ["wedsjubkttygxtpkopfj", "ecbcbvnupndkaypegubv", "jwvsbgfhtaojjmhcmega"]) assert.equal(inspect({ ...env, GETESTIMATEFAST_DEVELOPMENT_PROJECT_REF: ref, GETESTIMATEFAST_SUPABASE_URL: "https://" + ref + ".supabase.co" }).ready, false);
 assert.equal(inspect({ ...env, VERCEL_ENV: "production" }).ready, false);
 assert.equal(inspect({ ...env, GETESTIMATEFAST_STRIPE_TEST_CHECKOUT_APPROVED: "true" }).ready, false);
 assert.equal(inspect({ ...env, GETESTIMATEFAST_SMS_MODE: "live" }).ready, false);
});
