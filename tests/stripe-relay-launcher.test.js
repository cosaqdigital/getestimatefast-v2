"use strict";
const test = require("node:test"), assert = require("node:assert/strict"), crypto = require("node:crypto"), http = require("node:http");
const { EventEmitter } = require("node:events"), { PassThrough } = require("node:stream");
const Stripe = require("stripe");
const { startRelay, createRelay, PROJECT, TEAM, PATH } = require("../scripts/stripe-preview-relay");
const { APPROVED, ACCOUNT, verifyTarget, createOidcVerifier, createTokenManager, createSecretCapture, listenArguments, startSyntheticLauncher } = require("../scripts/stripe-preview-launcher");
const { SANDBOX_BRANCH } = require("../api/_lib/stripe-policy");
const pair = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
const jwk = { ...pair.publicKey.export({ format: "jwk" }), kid: "synthetic-key", alg: "RS256", use: "sig" };
const secret = "whsec_SyntheticOnly123456", payload = Buffer.from('{  "id":"evt_synthetic", "type":"customer.created", "livemode":false, "text":"é 🖌" }\n');
const signature = () => Stripe.webhooks.generateTestHeaderString({ payload: payload.toString(), secret });
const origin = "https://synthetic-relay-preview.vercel.app";
const deployment = { id: APPROVED.id, projectId: PROJECT, teamId: TEAM, origin, environment: "preview", branch: SANDBOX_BRANCH, sha: APPROVED.sha };
function jwt(changes = {}, now = Date.now()) {
  const sec = Math.floor(now / 1000), env = changes.environment || "development";
  const c = { iss: "https://oidc.vercel.com/get-estimate-fast", aud: "https://vercel.com/get-estimate-fast", owner: "get-estimate-fast", owner_id: TEAM,
    project: "getestimatefast-v2", project_id: PROJECT, environment: env, sub: "owner:get-estimate-fast:project:getestimatefast-v2:environment:" + env, iat: sec - 1, nbf: sec - 1, exp: sec + 3600, ...changes };
  const h = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT", kid: jwk.kid })).toString("base64url"), p = Buffer.from(JSON.stringify(c)).toString("base64url");
  return h + "." + p + "." + crypto.sign("RSA-SHA256", Buffer.from(h + "." + p), pair.privateKey).toString("base64url");
}
const verifier = options => createOidcVerifier({ loadJwks: async () => ({ keys: [jwk] }), ...options });
async function fixture(t, overrides = {}) {
  const calls = [], verify = verifier();
  const server = await startRelay({ origin, deployment, verifyDestination: async () => deployment, tokenProvider: async () => jwt(), verifyToken: async value => { await verify(value); return true; },
    verifySignature: async (raw, sig) => { try { Stripe.webhooks.constructEvent(raw, sig, secret); return true; } catch { return false; } },
    transport: async (url, options) => { calls.push({ url, ...options, body: Buffer.from(options.body) }); return new Response(null, { status: 200 }); }, ...overrides });
  t.after(() => server.stopRelay());
  const local = "http://127.0.0.1:" + server.address().port;
  const send = (opts = {}) => fetch(local + PATH, { method: "POST", headers: { "stripe-signature": signature() }, body: payload, ...opts });
  return { server, local, calls, send };
}
test("signed original UTF-8 bytes and Stripe header are preserved; private request/response headers are discarded", async t => {
  const f = await fixture(t); const sig = signature();
  const r = await f.send({ headers: { "stripe-signature": sig, Cookie: "synthetic-cookie", Authorization: "synthetic-private", "x-forwarded-host": "attacker.example" } });
  assert.equal(r.status, 204); assert.equal(await r.text(), ""); assert.deepEqual(f.calls[0].body, payload); assert.equal(f.calls[0].headers["stripe-signature"], sig);
  assert.equal(f.calls[0].redirect, "error"); assert.equal(f.calls[0].url, origin + PATH); assert.equal(f.calls[0].headers.Cookie, undefined); assert.equal(f.calls[0].headers.Authorization, undefined);
  assert.equal(f.server.address().address, "127.0.0.1");
});
test("invalid, absent and mutated signatures never reach the upstream", async t => {
  const f = await fixture(t);
  for (const opts of [{ headers: {} }, { headers: { "stripe-signature": "invalid" } }, { body: Buffer.from(payload.toString().replace("é", "e")) }]) assert.equal((await f.send(opts)).status, 400);
  assert.equal(f.calls.length, 0);
});
test("GET, alternate routes and query strings are denied", async t => {
  const f = await fixture(t);
  assert.equal((await fetch(f.local + PATH)).status, 404);
  for (const p of ["/api/admin/marketplace", PATH + "?x=1", PATH + "/", "/api/stripe-test-checkout"]) assert.equal((await fetch(f.local + p, { method: "POST" })).status, 404);
  assert.equal(f.calls.length, 0);
});
test("DNS rebinding Host header is denied", async t => {
  const f = await fixture(t);
  const status = await new Promise((resolve, reject) => { const req = http.request(f.local + PATH, { method: "POST", headers: { Host: "attacker.example", "stripe-signature": signature() } }, r => { r.resume(); resolve(r.statusCode); }); req.on("error", reject); req.end(payload); });
  assert.equal(status, 403); assert.equal(f.calls.length, 0);
});
test("bodies above 256 KiB are refused with 413", async t => { const f = await fixture(t); assert.equal((await f.send({ body: Buffer.alloc(262145) })).status, 413); assert.equal(f.calls.length, 0); });
test("chunked body limit cannot be bypassed", async t => {
  const f = await fixture(t);
  const status = await new Promise((resolve, reject) => { const req = http.request(f.local + PATH, { method: "POST", headers: { "stripe-signature": signature() } }, r => { r.resume(); resolve(r.statusCode); }); req.on("error", reject); req.write(Buffer.alloc(200000)); req.end(Buffer.alloc(100000)); });
  assert.equal(status, 413); assert.equal(f.calls.length, 0);
});
for (const status of [401, 403, 503, 302]) test("upstream " + status + " is sanitized and never followed", async t => {
  let called = 0; const f = await fixture(t, { transport: async (_, opts) => { called++; assert.equal(opts.redirect, "error"); return new Response("synthetic-private-provider-body", { status, headers: { "set-cookie": "private", location: "https://vercel.com/login" } }); } });
  const r = await f.send(); assert.equal(r.status, 503); assert.equal(await r.text(), ""); assert.equal(r.headers.get("set-cookie"), null); assert.equal(r.headers.get("location"), null); assert.equal(called, 1);
});
test("redirected response is rejected even with final 200", async t => { const f = await fixture(t, { transport: async () => ({ status: 200, redirected: true }) }); assert.equal((await f.send()).status, 503); });
test("connection failure is sanitized", async t => { const f = await fixture(t, { transport: async () => { throw Error("synthetic-secret-in-provider-error"); } }); const r = await f.send(); assert.equal(r.status, 503); assert.equal(await r.text(), ""); });
test("deadline bounds even a transport which ignores its AbortSignal", async t => { const f = await fixture(t, { timeoutMs: 40, transport: async () => new Promise(() => {}) }); assert.equal((await f.send()).status, 503); });
for (const [name, value] of [["absent", undefined], ["expired", jwt({ exp: Math.floor(Date.now() / 1000) - 1 })], ["invalid", "synthetic-invalid"], ["other project", jwt({ project_id: "prj_other" })], ["Production", jwt({ environment: "production" })]]) test("OIDC " + name + " blocks forwarding", async t => {
  const f = await fixture(t, { tokenProvider: async () => value }); assert.equal((await f.send()).status, 503); assert.equal(f.calls.length, 0);
});
test("OIDC cryptographic tampering, issuer and audience mismatches are refused", async () => {
  const verify = verifier(); const good = jwt(); const parts = good.split("."); parts[1] = Buffer.from(JSON.stringify({ project_id: PROJECT })).toString("base64url");
  for (const token of [parts.join("."), jwt({ iss: "https://attacker.example" }), jwt({ aud: "other" }), jwt({ owner_id: "team_other" })]) await assert.rejects(verify(token), /OIDC validation failed/);
  assert.equal((await verify(good)).project_id, PROJECT);
});
test("token renewal is serialized, validated and fail-closed", async () => {
  let now = Date.now(), obtains = 0; const verify = verifier({ now: () => now });
  const manager = createTokenManager({ now: () => now, verify, obtain: async () => { obtains++; return jwt({ exp: Math.floor(now / 1000) + 70 }, now); } });
  const first = await manager.get(); now += 15000; const results = await Promise.all([manager.get(), manager.get()]); assert.notEqual(first, results[0]); assert.equal(results[0], results[1]); assert.equal(obtains, 2);
  manager.dispose(); await assert.rejects(manager.get());
  const failed = createTokenManager({ verify, obtain: async () => "invalid" }); await assert.rejects(failed.get(), /Temporary OIDC unavailable/); failed.dispose();
});
test("rejected OIDC is invalidated; a separate retry renews without duplicating the listener", async t => {
  let obtains = 0, requests = 0; const verify = verifier();
  const manager = createTokenManager({ verify, obtain: async () => { obtains++; return jwt(); } }); t.after(() => manager.dispose());
  const f = await fixture(t, { tokenProvider: manager.get, verifyToken: manager.verify, onAuthorizationFailure: manager.invalidate,
    transport: async () => new Response(null, { status: ++requests === 1 ? 401 : 200 }) });
  const port = f.server.address().port; assert.equal((await f.send()).status, 503); assert.equal(requests, 1);
  assert.equal((await f.send()).status, 204); assert.equal(obtains, 2); assert.equal(requests, 2); assert.equal(f.server.address().port, port);
});
test("unverified/manual destinations, retargeting and Production are refused", async t => {
  assert.throws(() => createRelay({ origin, deployment }));
  for (const change of [{ projectId: "other" }, { environment: "production" }, { origin: "https://attacker.example" }]) assert.throws(() => createRelay({ origin, deployment: { ...deployment, ...change } }));
  const f = await fixture(t, { verifyDestination: async () => ({ ...deployment, id: "dpl_other" }) }); assert.equal((await f.send()).status, 503); assert.equal(f.calls.length, 0);
});
function apiFixture(change = {}) {
  const records = {
    ["/v9/projects/" + PROJECT]: { id: PROJECT, accountId: TEAM, name: "getestimatefast-v2", ssoProtection: { deploymentType: "all_except_custom_domains" } },
    ["/v4/aliases/" + APPROVED.alias]: { projectId: PROJECT, alias: APPROVED.alias, deploymentId: APPROVED.id, redirect: null },
    ["/v13/deployments/" + APPROVED.id]: { id: APPROVED.id, projectId: PROJECT, ownerId: TEAM, readyState: "READY", target: null, url: new URL(origin).host, alias: [APPROVED.alias], meta: { githubCommitRef: SANDBOX_BRANCH, githubCommitSha: APPROVED.sha }, gitSource: { sha: APPROVED.sha, repoId: 1211705834 }, ...change }
  }; return async path => structuredClone(records[path]);
}
test("Vercel API project, alias and immutable deployment are verified instead of trusting caller metadata", async () => {
  assert.equal((await verifyTarget(apiFixture())).origin, origin);
  for (const change of [{ target: "production" }, { ownerId: "team_other" }, { projectId: "other" }, { url: "attacker.example" }, { readyState: "ERROR" }, { meta: { githubCommitRef: "main", githubCommitSha: APPROVED.sha } }]) await assert.rejects(verifyTarget(apiFixture(change)));
});
test("whsec capture handles split chunks, stays private and is cleared on disposal", () => {
  const capture = createSecretCapture(); capture.ingest(Buffer.from("Ready signing secret: whse")); capture.ingest(Buffer.from("c_SyntheticOnly123456\n")); assert.equal(capture.ready(), true); assert.equal(capture.verify(payload, signature()), true);
  assert.equal(JSON.stringify(capture).includes(secret), false); capture.dispose(); assert.equal(capture.ready(), false); assert.equal(capture.verify(payload, signature()), false);
});
test("listener arguments restrict four self-account test events and loopback without sensitive flags", () => {
  const args = listenArguments(43210); assert(args.includes("@self")); assert(args.includes("http://127.0.0.1:43210" + PATH));
  for (const forbidden of ["--live", "--api-key", "--print-secret", "--headers", "--use-configured-webhooks"]) assert(!args.includes(forbidden));
});
function launcherFixture(extra = {}) {
  const child = new EventEmitter(); child.stdout = new PassThrough(); child.stderr = new PassThrough(); let killed = 0;
  const adapters = { mode: "synthetic", api: apiFixture(), obtainToken: async () => jwt(), loadJwks: async () => ({ keys: [jwk] }),
    readStripeIdentity: async () => ({ version: "1.53.1", account_id: ACCOUNT, mode: "test", authorized_accounts: [{ id: ACCOUNT, modes: ["test"] }] }),
    spawnSynthetic: async spec => { assert.equal(spec.windowsHide, true); assert.deepEqual(spec.stdio, ["ignore", "pipe", "pipe"]); return child; },
    stopSynthetic: async () => { killed++; child.stdout.destroy(); child.stderr.destroy(); }, transport: async () => new Response(null, { status: 200 }), ...extra };
  return { child, adapters, killed: () => killed };
}
test("launcher captures only in memory and closes subprocess/listener on stop", async () => {
  let forwarded = 0; const f = launcherFixture({ transport: async (_, opts) => { forwarded++; assert.deepEqual(opts.body, payload); return new Response(null, { status: 200 }); } }); const run = await startSyntheticLauncher(f.adapters);
  f.child.stderr.write("Ready " + secret + "\n"); assert.equal(run.secretReady(), true); assert.equal(f.child.stderr.listenerCount("data"), 1);
  assert.equal((await fetch("http://127.0.0.1:" + run.port + PATH, { method: "POST", headers: { "stripe-signature": signature() }, body: payload })).status, 204); assert.equal(forwarded, 1);
  await run.stop(); await run.stop(); assert.equal(run.secretReady(), false); assert.equal(f.killed(), 1); assert.equal(f.child.stderr.listenerCount("data"), 0);
  await assert.rejects(fetch("http://127.0.0.1:" + run.port + PATH));
});
test("unexpected subprocess exit cleans up and closes the listener", async () => {
  const f = launcherFixture(); const run = await startSyntheticLauncher(f.adapters); f.child.emit("exit", 1);
  await new Promise(resolve => setTimeout(resolve, 20)); assert.equal(run.secretReady(), false); assert.equal(f.killed(), 1);
  await assert.rejects(fetch("http://127.0.0.1:" + run.port + PATH));
});
test("changed signing secret fails closed without exposing either value", () => {
  const capture = createSecretCapture(); capture.ingest(Buffer.from("Ready " + secret + "\n"));
  assert.throws(() => capture.ingest(Buffer.from("Ready whsec_SyntheticDifferent123\n")), /Signing secret changed/); capture.dispose();
});
test("launcher refuses real mode, wrong account and live mode before spawning", async () => {
  await assert.rejects(startSyntheticLauncher({ mode: "real" }));
  for (const fields of [{ account_id: "acct_other" }, { mode: "live" }, { version: "other" }]) { let spawned = false; const f = launcherFixture({ readStripeIdentity: async () => ({ version: "1.53.1", account_id: ACCOUNT, mode: "test", authorized_accounts: [{ id: ACCOUNT, modes: ["test"] }], ...fields }), spawnSynthetic: async () => { spawned = true; } }); await assert.rejects(startSyntheticLauncher(f.adapters)); assert.equal(spawned, false); }
});
test("shutdown aborts an in-flight forwarding and releases loopback port", async t => {
  let started; const entered = new Promise(resolve => { started = resolve; });
  const f = await fixture(t, { transport: async () => { started(); return new Promise(() => {}); } });
  const request = f.send().catch(() => null); await entered; await f.server.stopRelay(); await request; assert.equal(f.server.listening, false);
});
