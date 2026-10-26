"use strict";
// Command plans and mock-only execution. No native spawn/fetch default is provided.
const path = require("node:path");
const fs = require("node:fs");
const { PROJECT, TEAM } = require("./stripe-preview-relay");
const { ACCOUNT, listenArguments } = require("./stripe-preview-launcher");
const { selectDeployment } = require("./stripe-authorized-deployments");
const { createOidcJwksLoader } = require("./stripe-oidc-validation");
const { OperationalError, timed } = require("./stripe-operational-control");
const privatePlans = new WeakMap();
const nativeRunners = new WeakSet();
function commands({ deploymentSelection, stripeExecutable, vercelEntry, runtimeDirectory, nodeExecutable = process.execPath }) {
  const approved = selectDeployment(deploymentSelection);
  if (![stripeExecutable, vercelEntry, nodeExecutable, runtimeDirectory].every(p => typeof p === "string" && path.isAbsolute(p)) ||
      !stripeExecutable.toLowerCase().endsWith("stripe.exe") || !vercelEntry.endsWith(".js") || /\.(cmd|bat|ps1)$/i.test(nodeExecutable)) throw Error("Reviewed native executable paths required");
  const spec = (file, args) => { const value = Object.freeze({ file, args: Object.freeze(args), options: Object.freeze({ cwd: runtimeDirectory, shell: false, windowsHide: true, stdio: Object.freeze(["ignore", "pipe", "pipe"]) }) }); privatePlans.set(value, { deploymentSelection, stripeExecutable, vercelEntry, nodeExecutable, runtimeDirectory }); return value; };
  const vercel = args => spec(nodeExecutable, [vercelEntry, ...args, "--scope", TEAM, "--non-interactive"]);
  return {
    version: () => spec(stripeExecutable, ["--version"]),
    selectSandbox: () => spec(stripeExecutable, ["switch", ACCOUNT, "--format", "json"]),
    identity: () => spec(stripeExecutable, ["whoami", "--format", "json"]),
    api(endpoint) {
      if (!["/v9/projects/" + PROJECT, "/v4/aliases/" + approved.alias, "/v13/deployments/" + approved.id].includes(endpoint)) throw Error("Read-only target endpoint required");
      return vercel(["api", endpoint, "--method", "GET"]);
    },
    oidc: () => spec(nodeExecutable, [vercelEntry, "env", "run", "--environment", "development", "--project", PROJECT, "--scope", TEAM,
      "--non-interactive", "--", nodeExecutable, "-e", "process.stdout.write(process.env.VERCEL_OIDC_TOKEN || '')"]),
    listen: args => { const match = Array.isArray(args) && args[args.indexOf("--forward-to") + 1]?.match(/^http:\/\/127\.0\.0\.1:(\d+)\/api\/stripe-test-webhook$/);
      if (!match || JSON.stringify(args) !== JSON.stringify(listenArguments(Number(match[1])))) throw Error("Restricted listener plan required"); return spec(stripeExecutable, args); }
  };
}
function cleanEnvironment(env) {
  // No inherited Stripe API override, node preload, Vercel token or application secrets.
  const allowed = ["PATH", "Path", "SystemRoot", "SYSTEMROOT", "WINDIR", "TEMP", "TMP", "USERPROFILE", "APPDATA", "LOCALAPPDATA", "HOME", "COMSPEC", "PATHEXT"];
  return Object.fromEntries(allowed.filter(k => typeof env[k] === "string").map(k => [k, env[k]]));
}
function makeProcessRunner({ mode, spawnMock, spawnReviewed, stopMock, env = {}, timeoutMs = 20000, cleanupTimeoutMs = 5000, maxBytes = 2097152 }) {
  if (!["synthetic", "native"].includes(mode) || (typeof spawnMock !== "function" && typeof spawnReviewed !== "function") || typeof stopMock !== "function" || !Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 20000 || !Number.isSafeInteger(maxBytes) || maxBytes < 1 || maxBytes > 2097152 || !Number.isInteger(cleanupTimeoutMs) || cleanupTimeoutMs < 1 || cleanupTimeoutMs > 5000) throw Error("Private process adapters required");
  const owned = new Set(), stopping = new Map(); let disposed = false;
  const stop = async child => {
    if (stopping.has(child)) return stopping.get(child);
    if (!owned.has(child)) return;
    const operation = timed(() => stopMock(child), cleanupTimeoutMs, undefined, "PROCESS_CLEANUP_TIMEOUT").then(() => owned.delete(child))
      .catch(e => { const error = new OperationalError(e?.code === "PROCESS_CLEANUP_TIMEOUT" ? "PROCESS_CLEANUP_TIMEOUT" : "PROCESS_CLEANUP_FAILED"); error.message = "Private process termination unavailable: " + error.code; throw error; }).finally(() => stopping.delete(child));
    stopping.set(child, operation); return operation;
  };
  const spawn = spec => {
    if (disposed || spec.options?.shell !== false || spec.options?.stdio?.join() !== "ignore,pipe,pipe") throw Error("Private subprocess required");
    if (!path.isAbsolute(spec.options.cwd || "") || fs.readdirSync(spec.options.cwd).some(n => /^\.env(?:\.|$)/i.test(n))) throw Error("Isolated runtime directory required");
    const child = spawnReviewed ? spawnReviewed(spec, cleanEnvironment(env)) : spawnMock(spec.file, [...spec.args], { ...spec.options, env: cleanEnvironment(env) }); child.on("error", () => {}); owned.add(child); return child;
  };
  const capture = async (spec, signal) => {
    let child, chunks = [], total = 0, timer, abort, onData, onStderr, onClose, onError, commandFailure;
    try {
      if (signal?.aborted) throw new OperationalError("OPERATION_ABORTED");
      child = spawn(spec);
      const bytes = await new Promise((resolve, reject) => {
        const fail = onError = () => reject(new OperationalError("PROCESS_START_FAILED"));
        timer = setTimeout(() => reject(new OperationalError("PROCESS_TIMEOUT")), timeoutMs);
        child.stdout.on("data", onData = chunk => { total += chunk.length; if (total > maxBytes) return fail(); chunks.push(Buffer.from(chunk)); });
        // Drain stderr without retaining or printing errors which may contain credentials.
        child.stderr.on("data", onStderr = () => {}); child.once("error", fail);
        child.once("close", onClose = (code, exitSignal) => code === 0 && !exitSignal ? resolve(Buffer.concat(chunks)) : reject(new OperationalError(exitSignal ? "PROCESS_INTERRUPTED" : "PROCESS_EXIT_NONZERO", { exitCode: code, signal: exitSignal })));
        if (signal) { abort = () => reject(new OperationalError("OPERATION_ABORTED")); signal.addEventListener("abort", abort, { once: true }); if (signal.aborted) abort(); }
      });
      return bytes;
    } catch (cause) { const error = cause instanceof OperationalError ? cause : new OperationalError("PROCESS_START_FAILED"); error.message = "Private command unavailable: " + error.code; commandFailure = error; throw error; }
    finally { clearTimeout(timer); if (abort) signal.removeEventListener("abort", abort); chunks.forEach(b => b.fill(0)); if (child) { child.stdout.off("data", onData); child.stderr.off("data", onStderr); child.off("close", onClose); child.off("error", onError); try { await stop(child); } catch (cleanup) { if (commandFailure) { cleanup.commandCode = commandFailure.code; if (Number.isInteger(commandFailure.exitCode)) cleanup.exitCode = commandFailure.exitCode; if (commandFailure.signal) cleanup.signal = commandFailure.signal; } throw cleanup; } } }
  };
  return { capture, spawn, stop, async dispose() { disposed = true; const results = await Promise.allSettled([...owned].map(stop)); const failure = results.find(r => r.status === "rejected"); if (failure) throw failure.reason; }, ownedCount: () => owned.size };
}
function createPrivateProcessRunner(options) {
  if (options?.mode !== "synthetic") throw Error("Synthetic process adapters only");
  return makeProcessRunner(options);
}
function createNativeProcessRunner({ authorization, deploymentSelection, env = {}, timeoutMs = 10000, cleanupTimeoutMs = 5000 }) {
  const { createNativeProcessController } = require("./stripe-native-processes");
  const controller = createNativeProcessController({ authorization, selection: deploymentSelection, timeoutMs: cleanupTimeoutMs,
    validatePlan(spec, grant) {
      const metadata = privatePlans.get(spec);
      if (!metadata || metadata.deploymentSelection !== deploymentSelection || metadata.stripeExecutable !== grant.stripeExecutable ||
          metadata.vercelEntry !== grant.vercelEntry || metadata.nodeExecutable !== grant.nodeExecutable || metadata.runtimeDirectory !== grant.runtimeDirectory) throw Error("Reviewed scoped native plan required");
      if (spec.args[0] === "switch" || (spec.args[0] === "listen" && grant.allowListener !== true)) throw Error("Native operation not authorized");
    } });
  const runner = makeProcessRunner({ mode: "native", spawnReviewed: controller.spawn, stopMock: controller.stop, env, timeoutMs, cleanupTimeoutMs });
  nativeRunners.add(runner); return runner;
}
function createVercelAdapter({ mode, plan, runner }) {
  if (mode !== "synthetic" && !(mode === "native" && nativeRunners.has(runner))) throw Error("Real authentication is not approved");
  const api = async (endpoint, signal) => { let bytes; try { bytes = await runner.capture(plan.api(endpoint), signal); return JSON.parse(bytes.toString()); } catch { throw Error("Vercel identity read unavailable"); } finally { bytes?.fill(0); } };
  const obtainToken = async signal => { let bytes; try { bytes = await runner.capture(plan.oidc(), signal); const value = bytes.toString().trim(); if (!/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(value)) throw Error(); return value; } catch { throw Error("Project OIDC unavailable"); } finally { bytes?.fill(0); } };
  return { api, obtainToken };
}
function createStripeAdapter({ mode, plan, runner }) {
  if (mode !== "synthetic" && !(mode === "native" && nativeRunners.has(runner))) throw Error("Real Stripe listener is not approved");
  let active, starting = false;
  const parse = async spec => { let bytes; try { bytes = await runner.capture(spec); return JSON.parse(bytes.toString()); } finally { bytes?.fill(0); } };
  const readStripeIdentity = async () => {
    let bytes; try {
      bytes = await runner.capture(plan.version()); if (bytes.toString().trim() !== "stripe version 1.53.1") throw Error();
      const who = await parse(plan.identity());
      if (who.account_id !== ACCOUNT || who.mode !== "test" || who.authorized_accounts?.length !== 1 || who.authorized_accounts[0].id !== ACCOUNT || who.authorized_accounts[0].modes?.join() !== "test") throw Error();
      return { version: "1.53.1", account_id: ACCOUNT, mode: "test", authorized_accounts: [{ id: ACCOUNT, modes: ["test"] }] };
    } catch { throw Error("Stripe Sandbox verification failed"); } finally { bytes?.fill(0); }
  };
  // Selection is prepared as an explicit plan, not run as a hidden recovery action.
  return { readStripeIdentity, selectionPlan: plan.selectSandbox,
    async spawnSynthetic(spec) { if (active || starting) throw Error("Listener already owned"); starting = true; try { await readStripeIdentity(); active = runner.spawn(plan.listen(spec.args)); return active; } finally { starting = false; } },
    async stopSynthetic(child) { if (child !== active) throw Error("Unowned listener"); await runner.stop(child); active = undefined; } };
}
function createJwksLoader({ mode, transport, timeoutMs = 10000 }) {
  if (mode !== "synthetic" || typeof transport !== "function") throw Error("Synthetic JWKS transport required");
  return createOidcJwksLoader({ transport, timeoutMs });
}
module.exports = { commands, cleanEnvironment, createPrivateProcessRunner, createNativeProcessRunner, createVercelAdapter, createStripeAdapter, createJwksLoader };
