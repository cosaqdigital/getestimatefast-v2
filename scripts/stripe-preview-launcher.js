"use strict";
// Preparation only. No built-in authenticated CLI/network adapters or real start.
const crypto = require("node:crypto");
const Stripe = require("stripe");
const { StringDecoder } = require("node:string_decoder");
const { startRelay, validDestination, PROJECT, TEAM } = require("./stripe-preview-relay");
const { SANDBOX_BRANCH } = require("../api/_lib/stripe-policy");
const ACCOUNT = "acct_1UOl9qH5rFe1usWF";
const APPROVED = Object.freeze({ id: "dpl_HAbtXDcwSPoVpTbPVjzZmCUMneHU", sha: "9901db8b8e99ae510de9e3f63b61c6e39256befa",
  alias: "getestimatefast-v2-git-feat-stripe-san-f12bd7-get-estimate-fast.vercel.app" });
const EVENTS = ["checkout.session.completed", "checkout.session.async_payment_succeeded", "checkout.session.async_payment_failed", "checkout.session.expired"];
async function verifyTarget(api, signal) {
  const p = await api("/v9/projects/" + PROJECT, signal);
  const a = await api("/v4/aliases/" + APPROVED.alias, signal);
  const d = await api("/v13/deployments/" + APPROVED.id, signal);
  if (p.id !== PROJECT || p.accountId !== TEAM || p.name !== "getestimatefast-v2" || p.ssoProtection?.deploymentType !== "all_except_custom_domains" ||
      a.projectId !== PROJECT || a.alias !== APPROVED.alias || a.deploymentId !== APPROVED.id || a.redirect ||
      d.id !== APPROVED.id || d.projectId !== PROJECT || d.ownerId !== TEAM || d.target != null || d.readyState !== "READY" ||
      d.meta?.githubCommitRef !== SANDBOX_BRANCH || d.meta?.githubCommitSha !== APPROVED.sha ||
      d.gitSource?.sha !== APPROVED.sha || d.gitSource?.repoId !== 1211705834 || !d.alias?.includes(APPROVED.alias)) throw Error("Vercel target verification failed");
  // Pin the immutable deployment URL: never send credentials to a mutable alias.
  const origin = "https://" + d.url;
  const target = { id: d.id, projectId: PROJECT, teamId: TEAM, environment: "preview", branch: SANDBOX_BRANCH, sha: APPROVED.sha, origin };
  validDestination(origin, target); return target;
}
function createOidcVerifier({ loadJwks, now = () => Date.now() }) {
  return async token => {
    try {
      if (typeof token !== "string" || token.length > 16384 || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token)) throw Error();
      const [h, p, s] = token.split("."), header = JSON.parse(Buffer.from(h, "base64url")), c = JSON.parse(Buffer.from(p, "base64url"));
      const seconds = Math.floor(now() / 1000);
      if (header.alg !== "RS256" || header.typ !== "JWT" || typeof header.kid !== "string" || header.jku || header.jwk || header.crit ||
          !["https://oidc.vercel.com", "https://oidc.vercel.com/get-estimate-fast"].includes(c.iss) ||
          c.aud !== "https://vercel.com/get-estimate-fast" || c.owner_id !== TEAM || c.owner !== "get-estimate-fast" || c.project_id !== PROJECT || c.project !== "getestimatefast-v2" ||
          !["development", "preview"].includes(c.environment) || c.sub !== "owner:get-estimate-fast:project:getestimatefast-v2:environment:" + c.environment ||
          !Number.isInteger(c.exp) || !Number.isInteger(c.nbf) || !Number.isInteger(c.iat) || c.exp <= seconds + 30 || c.nbf > seconds || c.iat > seconds || c.exp <= c.iat) throw Error();
      // Adapter must use the pinned issuer's discovery/JWKS, never token jku URLs.
      const jwks = await loadJwks(c.iss);
      const keys = jwks.keys.filter(k => k.kid === header.kid && k.kty === "RSA" && (!k.alg || k.alg === "RS256") && (!k.use || k.use === "sig"));
      if (keys.length !== 1 || !crypto.verify("RSA-SHA256", Buffer.from(h + "." + p), crypto.createPublicKey({ key: keys[0], format: "jwk" }), Buffer.from(s, "base64url")) || c.exp <= Math.floor(now() / 1000) + 30) throw Error();
      return c;
    } catch { throw Error("OIDC validation failed"); }
  };
}
function createTokenManager({ obtain, verify, now = () => Date.now() }) {
  let bytes, expires = 0, pending, disposed = false;
  const clear = () => { bytes?.fill(0); bytes = undefined; expires = 0; };
  const get = async () => {
    if (disposed) throw Error("Token manager closed");
    if (bytes && expires > now() + 60000) return bytes.toString();
    if (!pending) pending = (async () => {
      clear(); let value;
      try { value = await obtain(); const c = await verify(value); if (disposed || c.exp * 1000 <= now() + 30000) throw Error(); bytes = Buffer.from(value); expires = c.exp * 1000; return bytes.toString(); }
      catch { clear(); throw Error("Temporary OIDC unavailable"); }
      finally { value = undefined; }
    })().finally(() => { pending = undefined; });
    return pending;
  };
  return { get, verify: async token => { await verify(token); return true; }, invalidate: clear, dispose() { disposed = true; clear(); } };
}
function createSecretCapture() {
  const decoder = new StringDecoder("utf8"); let carry = "", bytes, disposed = false;
  return {
    ingest(chunk) {
      if (disposed) return;
      carry = (carry + decoder.write(chunk)).replace(/\x1b\[[0-9;]*m/g, "");
      const match = carry.match(/(?:^|[^A-Za-z0-9_])(whsec_[A-Za-z0-9]{8,})(?=[^A-Za-z0-9_])/);
      if (match) { if (bytes && bytes.toString() !== match[1]) throw Error("Signing secret changed; restart required"); bytes ||= Buffer.from(match[1]); carry = ""; }
      if (carry.length > 8192) carry = carry.slice(-8192);
    },
    verify(raw, signature) { if (!bytes) return false; try { Stripe.webhooks.constructEvent(raw, signature, bytes.toString(), 300); return true; } catch { return false; } },
    ready() { return Boolean(bytes) && !disposed; },
    dispose() { disposed = true; bytes?.fill(0); bytes = undefined; carry = ""; decoder.end(); }
  };
}
function listenArguments(port) {
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw Error("Invalid loopback port");
  return ["listen", "--events", EVENTS.join(","), "--events-from", "@self", "--forward-to", "http://127.0.0.1:" + port + "/api/stripe-test-webhook", "--skip-update", "--color", "off"];
}
async function startSyntheticLauncher(adapters) {
  // Explicitly unavailable for real startup until a separately approved adapter exists.
  if (adapters?.mode !== "synthetic" || ["spawnSynthetic", "stopSynthetic", "transport", "readStripeIdentity", "api", "obtainToken", "loadJwks"].some(n => typeof adapters[n] !== "function")) throw Error("Synthetic local launcher only");
  let server, child, closed = false;
  const capture = createSecretCapture(), verify = createOidcVerifier(adapters), tokens = createTokenManager({ obtain: adapters.obtainToken, verify, now: adapters.now });
  const stop = async () => {
    if (closed) return; closed = true;
    capture.dispose(); tokens.dispose();
    const cleanup = [];
    if (child) { child.stdout?.off("data", ingest); child.stderr?.off("data", ingest); child.off("error", failed); child.off("exit", failed); cleanup.push(Promise.resolve().then(() => adapters.stopSynthetic(child))); }
    if (server) cleanup.push(server.stopRelay());
    await Promise.allSettled(cleanup);
    process.off("SIGINT", failed); process.off("SIGTERM", failed);
  };
  const failed = () => { void stop().catch(() => {}); };
  const ingest = chunk => { try { capture.ingest(chunk); } catch { failed(); } };
  try {
    const identity = await adapters.readStripeIdentity();
    if (identity.version !== "1.53.1" || identity.account_id !== ACCOUNT || identity.mode !== "test" ||
        !Array.isArray(identity.authorized_accounts) || identity.authorized_accounts.length !== 1 || identity.authorized_accounts[0].id !== ACCOUNT ||
        JSON.stringify(identity.authorized_accounts[0].modes) !== '["test"]') throw Error("Stripe Sandbox identity required");
    const target = await verifyTarget(adapters.api); await tokens.get();
    server = await startRelay({ origin: target.origin, deployment: target, verifyDestination: signal => verifyTarget(adapters.api, signal),
      tokenProvider: tokens.get, verifyToken: tokens.verify, onAuthorizationFailure: tokens.invalidate, verifySignature: (raw, sig) => capture.verify(raw, sig), transport: adapters.transport, timeoutMs: adapters.timeoutMs || 20000 });
    child = await adapters.spawnSynthetic({ args: listenArguments(server.address().port), stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
    child.stdout.on("data", ingest); child.stderr.on("data", ingest); child.once("error", failed); child.once("exit", failed);
    process.once("SIGINT", failed); process.once("SIGTERM", failed);
    return { port: server.address().port, secretReady: capture.ready, stop };
  } catch { await stop(); throw Error("Local launcher preparation failed"); }
}
if (require.main === module) { process.stderr.write("Real Stripe listener is not enabled. Run local synthetic tests only.\n"); process.exitCode = 1; }
module.exports = { APPROVED, ACCOUNT, EVENTS, verifyTarget, createOidcVerifier, createTokenManager, createSecretCapture, listenArguments, startSyntheticLauncher };
