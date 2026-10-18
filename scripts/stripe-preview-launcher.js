"use strict";
// Preparation only. No built-in authenticated CLI/network adapters or real start.
const crypto = require("node:crypto");
const Stripe = require("stripe");
const { StringDecoder } = require("node:string_decoder");
const { startRelay, validDestination, bounded, PROJECT, TEAM } = require("./stripe-preview-relay");
const { selectDeployment } = require("./stripe-authorized-deployments");
const { createOidcVerifier, diagnosticCode, OidcValidationError } = require("./stripe-oidc-validation");
const { OperationalError, timed, safeStatus } = require("./stripe-operational-control");
const { SANDBOX_BRANCH } = require("../api/_lib/stripe-policy");
const ACCOUNT = "acct_1UOl9qH5rFe1usWF";
const APPROVED = selectDeployment("pr60-stage7"); // Metadata export; startup still requires explicit selection.
const EVENTS = ["checkout.session.completed", "checkout.session.async_payment_succeeded", "checkout.session.async_payment_failed", "checkout.session.expired"];
async function verifyTarget(api, selection, signal, timeoutMs = 10000) {
  const expected = selectDeployment(selection);
  if (typeof api !== "function" || !Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 10000) throw Error("Invalid target verifier");
  const controller = new AbortController(), timer = setTimeout(() => controller.abort(), timeoutMs);
  const scope = signal ? AbortSignal.any([signal, controller.signal]) : controller.signal;
  const read = async route => {
    if (scope.aborted) throw Error();
    const value = await bounded(Promise.resolve().then(() => api(route, scope)), scope);
    if (!value || typeof value !== "object" || Array.isArray(value) || value.redirected || value.status >= 300 || value.error) throw Error();
    return value;
  };
  try {
    const [p, a, d] = await Promise.all([read("/v9/projects/" + PROJECT), read("/v4/aliases/" + expected.alias), read("/v13/deployments/" + expected.id)]);
    if (p.id !== PROJECT || p.accountId !== TEAM || p.name !== "getestimatefast-v2" || p.ssoProtection?.deploymentType !== "all_except_custom_domains" ||
        p.link?.type !== "github" || p.link?.org !== "cosaqdigital" || p.link?.repo !== "getestimatefast-v2" || p.link?.repoId !== expected.repoId ||
        a.projectId !== PROJECT || a.alias !== expected.alias || a.deploymentId !== expected.id || a.redirect !== null ||
        d.id !== expected.id || d.projectId !== PROJECT || d.ownerId !== TEAM || d.target !== null || d.readyState !== "READY" ||
        d.meta?.githubCommitRef !== expected.branch || d.meta?.githubCommitSha !== expected.sha ||
        d.gitSource?.type !== "github" || d.gitSource?.ref !== expected.branch || d.gitSource?.sha !== expected.sha || d.gitSource?.repoId !== expected.repoId ||
        !Array.isArray(d.alias) || !d.alias.includes(expected.alias) || d.url !== new URL(expected.origin).hostname) throw Error();
    validDestination(expected.origin, expected);
    return expected; // The immutable catalog entry, never fields supplied by API/caller.
  } catch { throw Error("Vercel target verification failed"); }
  finally { clearTimeout(timer); controller.abort(); }
}
function createTokenManager({ obtain, verify, now = () => Date.now(), timeoutMs = 10000 }) {
  let bytes, expires = 0, pending, disposed = false, refreshing, generation = 0;
  const clear = () => { bytes?.fill(0); bytes = undefined; expires = 0; generation++; };
  const get = async signal => {
    if (disposed) throw Error("Token manager closed");
    if (signal?.aborted) throw new OperationalError("OPERATION_ABORTED");
    if (bytes && expires > now() + 60000) {
      const value = bytes.toString(), currentGeneration = generation;
      try { await timed(() => verify(value), timeoutMs, signal, "OIDC_REFRESH_TIMEOUT"); if (disposed || currentGeneration !== generation) throw new OperationalError("OPERATION_ABORTED"); return value; }
      catch (error) { if (currentGeneration === generation) clear(); throw error; }
    }
    if (!pending) { refreshing = new AbortController(); const refreshSignal = refreshing.signal; pending = timed(async scope => {
      clear(); const refreshGeneration = generation; let value;
      try { try { value = await obtain(scope); } catch { throw new OidcValidationError("OIDC_ACQUISITION"); } if (scope.aborted) throw new OperationalError("OPERATION_ABORTED"); const c = await verify(value); if (scope.aborted || disposed || c.exp * 1000 <= now() + 30000) throw Error(); bytes = Buffer.from(value); expires = c.exp * 1000; return bytes.toString(); }
      catch (cause) { if (refreshGeneration === generation) clear(); const error = new OidcValidationError(diagnosticCode(cause)); error.message = "Temporary OIDC unavailable: " + error.code; throw error; }
      finally { value = undefined; }
    }, timeoutMs, refreshSignal, "OIDC_REFRESH_TIMEOUT").catch(error => { clear(); throw error; }).finally(() => { pending = undefined; refreshing = undefined; }); }
    const current = pending;
    return signal ? timed(() => current, timeoutMs, signal, "OIDC_REFRESH_TIMEOUT") : current;
  };
  return { get, verify: async token => { if (disposed) throw Error("Token manager closed"); await verify(token); return true; }, invalidate() { clear(); refreshing?.abort(); }, dispose() { disposed = true; clear(); refreshing?.abort(); } };
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
  selectDeployment(adapters.deploymentSelection);
  const selection = adapters.deploymentSelection;
  let server, child, closed = false, stopped = false, stopping, terminal, childCleaned = false;
  const lifecycle = new AbortController(), startupMs = adapters.startupTimeoutMs || 30000, cleanupMs = adapters.cleanupTimeoutMs || 5000;
  if (!Number.isInteger(startupMs) || startupMs < 1 || startupMs > 30000 || !Number.isInteger(cleanupMs) || cleanupMs < 1 || cleanupMs > 5000) throw Error("Invalid launcher deadlines");
  const record = event => { terminal = safeStatus(event); try { adapters.onStatus?.(terminal); } catch {} };
  const capture = createSecretCapture(), verify = createOidcVerifier(adapters), tokens = createTokenManager({ obtain: adapters.obtainToken, verify, now: adapters.now });
  const stop = async () => {
    if (stopping) return stopping;
    if (stopped) return terminal;
    closed = true; lifecycle.abort();
    capture.dispose(); tokens.dispose();
    const cleanup = [];
    if (child && !childCleaned) { child.stdout?.off("data", ingest); child.stderr?.off("data", ingest); child.stdout?.resume(); child.stderr?.resume(); child.off("exit", childExit); cleanup.push(timed(() => adapters.stopSynthetic(child), cleanupMs, undefined, "PROCESS_CLEANUP_TIMEOUT").then(() => { childCleaned = true; })); }
    if (server?.listening) cleanup.push(server.stopRelay());
    process.off("SIGINT", onSigint); process.off("SIGTERM", onSigterm);
    stopping = Promise.allSettled(cleanup).then(results => {
      const failure = results.find(r => r.status === "rejected");
      if (failure) { const error = new OperationalError(failure.reason?.code === "PROCESS_CLEANUP_TIMEOUT" ? "PROCESS_CLEANUP_TIMEOUT" : "PROCESS_CLEANUP_FAILED", terminal); record(error); throw error; }
      stopped = true; child?.off("error", childError); if (!terminal) record({ code: "LAUNCHER_STOPPED" }); return terminal;
    }).finally(() => { stopping = undefined; });
    return stopping;
  };
  const failed = event => { record(event); void stop().catch(() => {}); };
  const childExit = (exitCode, signal) => failed({ code: exitCode === 0 && !signal ? "LAUNCHER_CHILD_EXIT" : signal ? "PROCESS_INTERRUPTED" : "PROCESS_EXIT_NONZERO", exitCode, signal });
  const childError = () => failed({ code: "PROCESS_START_FAILED" });
  const interrupted = signal => failed({ code: "LAUNCHER_INTERRUPTED", signal: typeof signal === "string" ? signal : "SIGINT" });
  const onSigint = () => interrupted("SIGINT"), onSigterm = () => interrupted("SIGTERM");
  const ingest = chunk => { try { capture.ingest(chunk); } catch { failed({ code: "LAUNCHER_SECRET_CHANGED" }); } };
  try {
    process.once("SIGINT", onSigint); process.once("SIGTERM", onSigterm);
    return await timed(async scope => {
    const identity = await timed(s => adapters.readStripeIdentity(s), 10000, scope);
    if (identity.version !== "1.53.1" || identity.account_id !== ACCOUNT || identity.mode !== "test" ||
        !Array.isArray(identity.authorized_accounts) || identity.authorized_accounts.length !== 1 || identity.authorized_accounts[0].id !== ACCOUNT ||
        JSON.stringify(identity.authorized_accounts[0].modes) !== '["test"]') throw Error("Stripe Sandbox identity required");
    const target = await verifyTarget(adapters.api, selection, scope); await tokens.get(scope);
    if (scope.aborted || closed) throw new OperationalError("OPERATION_ABORTED");
    server = await startRelay({ origin: target.origin, deployment: target, verifyDestination: signal => verifyTarget(adapters.api, selection, signal), onDestinationFailure: () => failed({ code: "LAUNCHER_DESTINATION_FAILED" }),
      tokenProvider: tokens.get, verifyToken: tokens.verify, onAuthorizationFailure: tokens.invalidate, verifySignature: (raw, sig) => capture.verify(raw, sig), transport: adapters.transport, timeoutMs: adapters.timeoutMs || 20000 });
    if (scope.aborted || closed) { await stop(); throw new OperationalError("OPERATION_ABORTED"); }
    child = await adapters.spawnSynthetic({ args: listenArguments(server.address().port), stdio: ["ignore", "pipe", "pipe"], windowsHide: true }, scope);
    if (scope.aborted || closed) { stopped = false; await stop(); throw new OperationalError("OPERATION_ABORTED"); }
    child.stdout.on("data", ingest); child.stderr.on("data", ingest); child.on("error", childError); child.once("exit", childExit);
    return { port: server.address().port, secretReady: capture.ready, stop, status: () => terminal, interrupt: signal => interrupted(signal) };
    }, startupMs, adapters.signal ? AbortSignal.any([adapters.signal, lifecycle.signal]) : lifecycle.signal, "LAUNCHER_STARTUP_TIMEOUT");
  } catch (cause) { await stop(); if (cause instanceof OidcValidationError || cause instanceof OperationalError) throw cause; throw new OperationalError("LAUNCHER_START_FAILED"); }
}
if (require.main === module) { process.stderr.write("Real Stripe listener is not enabled. Run local synthetic tests only.\n"); process.exitCode = 1; }
module.exports = { APPROVED, ACCOUNT, EVENTS, verifyTarget, createOidcVerifier, createTokenManager, createSecretCapture, listenArguments, startSyntheticLauncher };
