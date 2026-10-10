"use strict";
const test = require("node:test"), assert = require("node:assert/strict"), { Readable } = require("node:stream");
const { PREVIEW_BRANCHES, VALIDATION_BRANCH, DEVELOPMENT_REF } = require("../api/_lib/preview-target");
const { config } = require("../api/admin/_auth");
const { inspect } = require("../scripts/preview-readiness");
function env() { return {
  VERCEL_ENV: "preview", VERCEL_GIT_COMMIT_REF: VALIDATION_BRANCH,
  GETESTIMATEFAST_ISOLATED_BACKEND: "true", GETESTIMATEFAST_MARKETPLACE_PREVIEW: "false",
  GETESTIMATEFAST_DEVELOPMENT_PROJECT_REF: DEVELOPMENT_REF, GETESTIMATEFAST_SUPABASE_URL: "https://" + DEVELOPMENT_REF + ".supabase.co",
  GETESTIMATEFAST_SUPABASE_SECRET_KEY: "SYNTHETIC_SECRET_NOT_FOR_DISPLAY", GETESTIMATEFAST_SUPABASE_PUBLISHABLE_KEY: "synthetic-public",
  GETESTIMATEFAST_PUBLIC_ORIGIN: "https://synthetic-preview.example.invalid", GETESTIMATEFAST_REVIEW_IDENTITY_SECRET: "SYNTHETIC_REVIEW_IDENTITY_NOT_FOR_DISPLAY",
  GETESTIMATEFAST_SMS_MODE: "dry_run", GETESTIMATEFAST_STRIPE_MODE: "test", GETESTIMATEFAST_STRIPE_TEST_CHECKOUT_APPROVED: "false"
}; }
async function withEnv(values, run) {
  const previous = { ...process.env }, savedFetch = global.fetch;
  try { Object.assign(process.env, values); global.fetch = () => { throw Error("Unexpected external request"); }; return await run(); }
  finally { global.fetch = savedFetch; for (const key of Object.keys(process.env)) if (!(key in previous)) delete process.env[key]; Object.assign(process.env, previous); }
}
async function invoke(handler, method = "GET") {
  const req = Readable.from([]); req.method = method; req.query = {}; req.headers = {};
  let body; const res = { setHeader() {}, end(value) { body = value; } };
  await handler(req, res); return { status: res.statusCode, body };
}
test("all test branches reject inherited production credentials and arbitrary development projects", () => {
  for (const branch of PREVIEW_BRANCHES) {
    const values = { ...env(), VERCEL_GIT_COMMIT_REF: branch };
    assert.throws(() => config({ ...values, GETESTIMATEFAST_ISOLATED_BACKEND: "false", GETESTIMATEFAST_SUPABASE_URL: "https://wedsjubkttygxtpkopfj.supabase.co" }));
    assert.throws(() => config({ ...values, GETESTIMATEFAST_DEVELOPMENT_PROJECT_REF: "abcdefghijklmnopqrst", GETESTIMATEFAST_SUPABASE_URL: "https://abcdefghijklmnopqrst.supabase.co" }));
    assert.equal(config(values).url, "https://" + DEVELOPMENT_REF + ".supabase.co");
  }
});
test("configuration preflight is usable before API enablement and does not print credential values", async () => {
  await withEnv(env(), async () => {
    const result = await invoke(require("../api/preview-readiness"));
    assert.equal(result.status, 200);
    const body = JSON.parse(result.body); assert.equal(body.ready, true); assert.equal(body.marketplace_enabled, false); assert.equal(body.database_integrity_verified, false);
    assert(!result.body.includes(process.env.GETESTIMATEFAST_SUPABASE_SECRET_KEY)); assert(!result.body.includes(process.env.GETESTIMATEFAST_REVIEW_IDENTITY_SECRET));
    assert.equal(inspect().ready, false);
  });
  await withEnv({ ...env(), GETESTIMATEFAST_SUPABASE_SECRET_KEY: "" }, async () => {
    const result = await invoke(require("../api/preview-readiness")); assert.equal(result.status, 503); assert(JSON.parse(result.body).missing_variable_names.includes("GETESTIMATEFAST_SUPABASE_SECRET_KEY"));
  });
  await withEnv({ ...env(), VERCEL_ENV: "production" }, async () => assert.equal((await invoke(require("../api/preview-readiness"))).status, 404));
});
test("marketplace APIs reject incomplete preflight before authentication or provider access", async () => {
  for (const override of [{ GETESTIMATEFAST_STRIPE_TEST_CHECKOUT_APPROVED: "true" }, { GETESTIMATEFAST_SMS_MODE: "live" }, { GETESTIMATEFAST_REVIEW_IDENTITY_SECRET: "" }]) {
    await withEnv({ ...env(), GETESTIMATEFAST_MARKETPLACE_PREVIEW: "true", ...override }, async () => {
      const result = await invoke(require("../api/contractor/marketplace")); assert.equal(result.status, 503); assert.match(result.body, /preflight/);
    });
  }
});
test("public lead and signup cannot deliver external email even when inherited flags/credentials are set", async () => {
  for (const branch of PREVIEW_BRANCHES) await withEnv({ ...env(), VERCEL_GIT_COMMIT_REF: branch, GETESTIMATEFAST_ISOLATED_BACKEND: "false", CONTRACTOR_SIGNUP_ENABLED: "true", RESEND_API_KEY: "synthetic-inherited-key", LEAD_TO_EMAIL: "synthetic@example.invalid" }, async () => {
    const lead = await invoke(require("../api/lead"), "POST"); assert.equal(lead.status, 503);
    const signup = await invoke(require("../api/contractor/signup"), "POST"); assert.equal(signup.status, 503);
  });
});
