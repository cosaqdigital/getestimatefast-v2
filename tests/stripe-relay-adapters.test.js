"use strict";
const test = require("node:test"), assert = require("node:assert/strict"), path = require("node:path");
const { EventEmitter } = require("node:events"), { PassThrough } = require("node:stream");
const fs = require("node:fs"), os = require("node:os");
const { commands, cleanEnvironment, createPrivateProcessRunner, createVercelAdapter, createStripeAdapter, createJwksLoader } = require("../scripts/stripe-relay-adapters");
const { ACCOUNT, listenArguments } = require("../scripts/stripe-preview-launcher");
const runtimeDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "gef-adapter-synthetic-"));
test.after(() => fs.rmdirSync(runtimeDirectory));
const plan = commands({ stripeExecutable: path.resolve("synthetic/stripe.exe"), vercelEntry: path.resolve("synthetic/vercel.js"), runtimeDirectory });
function runnerFixture(outputs = [], extra = {}) {
  const calls = [], children = []; let stops = 0;
  const runner = createPrivateProcessRunner({ mode: "synthetic", env: { PATH: "synthetic-path", STRIPE_API_KEY: "synthetic-hidden", VERCEL_TOKEN: "synthetic-hidden", NODE_OPTIONS: "--require malicious", GETESTIMATEFAST_SUPABASE_SECRET_KEY: "synthetic-hidden" },
    spawnMock: (file, args, opts) => { calls.push({ file, args, opts }); const c = new EventEmitter(); c.stdout = new PassThrough(); c.stderr = new PassThrough(); children.push(c); const next = outputs.shift();
      if (next !== undefined) queueMicrotask(() => { c.stdout.write(Buffer.from(next.stdout || "")); c.stderr.write(next.stderr || ""); c.emit("close", next.code || 0); }); return c; },
    stopMock: async c => { stops++; c.stdout.destroy(); c.stderr.destroy(); }, ...extra });
  return { runner, calls, children, stops: () => stops };
}
test("native command plans use argv arrays without shell and pin test account", () => {
  const p = plan.selectSandbox(); assert.deepEqual(p.args, ["switch", ACCOUNT, "--format", "json"]); assert.equal(p.options.shell, false); assert.equal(p.options.windowsHide, true);
  assert(!p.args.includes("--live")); assert.throws(() => plan.api("/v13/deployments")); assert.throws(() => commands({ stripeExecutable: "stripe.cmd", vercelEntry: "vercel.cmd" }));
  assert.deepEqual(plan.listen(listenArguments(43210)).args, listenArguments(43210));
  for (const args of [listenArguments(43210).concat("--live"), ["listen", "--forward-to", "https://attacker.example"], ["listen", "--api-key", "synthetic"]]) assert.throws(() => plan.listen(args));
});
test("private process strips credential overrides and preload variables", async () => {
  const f = runnerFixture([{ stdout: "synthetic-output" }]); const bytes = await f.runner.capture(plan.version()); assert.equal(bytes.toString(), "synthetic-output"); bytes.fill(0);
  assert.deepEqual(f.calls[0].opts.env, { PATH: "synthetic-path" }); assert.equal(f.stops(), 1); await f.runner.dispose();
  assert.equal(cleanEnvironment({ HOME: "synthetic", STRIPE_API_KEY: "hidden" }).STRIPE_API_KEY, undefined);
});
test("local dotenv files block execution before any child is created", async () => {
  const file = path.join(runtimeDirectory, ".env.local"); const f = runnerFixture();
  try { fs.writeFileSync(file, "SYNTHETIC_ONLY=true"); await assert.rejects(f.runner.capture(plan.oidc())); assert.equal(f.calls.length, 0); }
  finally { fs.unlinkSync(file); await f.runner.dispose(); }
});
test("no real runner or authentication is enabled by default", () => { assert.throws(() => createPrivateProcessRunner({ mode: "real" })); assert.throws(() => createVercelAdapter({ mode: "real" })); assert.throws(() => createStripeAdapter({ mode: "real" })); });
test("private stdout/stderr and provider failures never enter exceptions", async () => {
  const f = runnerFixture([{ stdout: "synthetic-private", stderr: "whsec_SyntheticOnlySecret", code: 1 }]);
  await assert.rejects(f.runner.capture(plan.identity()), e => e.message === "Private command unavailable" && !JSON.stringify(e).includes("Secret")); await f.runner.dispose();
});
test("private command timeout and output overflow close only owned children", async () => {
  const a = runnerFixture([], { timeoutMs: 20 }); await assert.rejects(a.runner.capture(plan.identity())); assert.equal(a.stops(), 1); await a.runner.dispose();
  const b = runnerFixture([{ stdout: "oversized" }], { maxBytes: 3 }); await assert.rejects(b.runner.capture(plan.version())); assert.equal(b.stops(), 1); await b.runner.dispose();
});
test("OIDC acquisition consumes only a synthetically captured JWT; noisy output fails closed", async () => {
  const f = runnerFixture([{ stdout: "synthetic.header.signature" }, { stdout: "log line\nsynthetic.header.signature" }]); const a = createVercelAdapter({ mode: "synthetic", plan, runner: f.runner });
  assert.equal(await a.obtainToken(), "synthetic.header.signature"); await assert.rejects(a.obtainToken(), /Project OIDC unavailable/);
  assert(f.calls[0].args.includes("development")); assert(!f.calls[0].args.includes("production")); assert(!JSON.stringify(f.calls).includes("synthetic.header.signature")); await f.runner.dispose();
});
test("Stripe identity is reconfirmed, listener ownership prevents duplicates and selection is never implicit", async () => {
  const identity = JSON.stringify({ account_id: ACCOUNT, mode: "test", authorized_accounts: [{ id: ACCOUNT, modes: ["test"] }] });
  const f = runnerFixture([{ stdout: "stripe version 1.53.1" }, { stdout: identity }, { stdout: "stripe version 1.53.1" }, { stdout: identity }]);
  const a = createStripeAdapter({ mode: "synthetic", plan, runner: f.runner }); await a.readStripeIdentity(); const child = await a.spawnSynthetic({ args: listenArguments(43210) });
  await assert.rejects(a.spawnSynthetic({ args: listenArguments(43210) }), /already owned/); assert.equal(f.calls.some(c => c.args[0] === "switch"), false);
  await a.stopSynthetic(child); await f.runner.dispose(); assert.equal(f.stops(), 5);
});
test("concurrent listener starts reserve ownership before any asynchronous identity read", async () => {
  const who = JSON.stringify({ account_id: ACCOUNT, mode: "test", authorized_accounts: [{ id: ACCOUNT, modes: ["test"] }] });
  const f = runnerFixture([{ stdout: "stripe version 1.53.1" }, { stdout: who }]); const a = createStripeAdapter({ mode: "synthetic", plan, runner: f.runner });
  const results = await Promise.allSettled([a.spawnSynthetic({ args: listenArguments(43210) }), a.spawnSynthetic({ args: listenArguments(43210) })]);
  assert.equal(results.filter(r => r.status === "fulfilled").length, 1); assert.equal(f.calls.filter(c => c.args[0] === "listen").length, 1);
  await a.stopSynthetic(results.find(r => r.status === "fulfilled").value); await f.runner.dispose();
});
test("concurrent disposal joins one owned process termination", async () => {
  let stops = 0; const f = runnerFixture([], { stopMock: async () => { stops++; await new Promise(resolve => setTimeout(resolve, 10)); } });
  const child = f.runner.spawn(plan.version()); await Promise.all([f.runner.stop(child), f.runner.dispose()]); assert.equal(stops, 1);
});
test("termination failures are sanitized and retain ownership for explicit cleanup", async () => {
  let calls = 0; const f = runnerFixture([], { stopMock: async () => { if (++calls === 1) throw Error("whsec_SyntheticPrivateFailure"); } });
  const child = f.runner.spawn(plan.version()); await assert.rejects(f.runner.stop(child), e => e.message === "Private process termination unavailable");
  await f.runner.dispose(); assert.equal(calls, 2);
});
for (const fields of [{ mode: "live" }, { account_id: "acct_other" }, { authorized_accounts: [{ id: ACCOUNT, modes: ["live", "test"] }] }]) test("wrong Stripe identity refuses startup without switching", async () => {
  const who = { account_id: ACCOUNT, mode: "test", authorized_accounts: [{ id: ACCOUNT, modes: ["test"] }], ...fields };
  const f = runnerFixture([{ stdout: "stripe version 1.53.1" }, { stdout: JSON.stringify(who) }]); const a = createStripeAdapter({ mode: "synthetic", plan, runner: f.runner });
  await assert.rejects(a.spawnSynthetic({ args: listenArguments(43210) })); assert.equal(f.calls.some(c => c.args.includes("listen")), false); await f.runner.dispose();
});
test("JWKS loader pins discovery, issuer and public-key origin, without sending authentication", async () => {
  const calls = [], issuer = "https://oidc.vercel.com/get-estimate-fast";
  const load = createJwksLoader({ mode: "synthetic", transport: async (url, opts) => { calls.push({ url, opts }); return new Response(JSON.stringify(calls.length === 1 ? { issuer, jwks_uri: issuer + "/.well-known/jwks" } : { keys: [{ kid: "synthetic" }] })); } });
  assert.equal((await load(issuer)).keys[0].kid, "synthetic"); assert.equal(calls[0].opts.redirect, "error"); assert.equal(calls[0].opts.headers, undefined);
  await assert.rejects(load("https://attacker.example"));
});
for (const status of [302, 401, 403, 503]) test("JWKS HTTP " + status + " cannot produce an accepted token", async () => { const load = createJwksLoader({ mode: "synthetic", transport: async () => new Response("synthetic-private", { status }) }); await assert.rejects(load("https://oidc.vercel.com"), /source unavailable/); });
test("JWKS discovery rejects external targets, oversized data, and a hanging connection", async () => {
  const bad = createJwksLoader({ mode: "synthetic", transport: async () => new Response(JSON.stringify({ issuer: "https://oidc.vercel.com", jwks_uri: "https://attacker.example/.well-known/jwks" })) }); await assert.rejects(bad("https://oidc.vercel.com"));
  const large = createJwksLoader({ mode: "synthetic", transport: async () => new Response("a".repeat(65537)) }); await assert.rejects(large("https://oidc.vercel.com"));
  const hung = createJwksLoader({ mode: "synthetic", transport: async () => new Promise(() => {}), timeoutMs: 20 }); await assert.rejects(hung("https://oidc.vercel.com"));
});
