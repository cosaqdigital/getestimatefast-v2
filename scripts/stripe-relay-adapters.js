"use strict";
// Command plans and mock-only execution. No native spawn/fetch default is provided.
const path = require("node:path");
const fs = require("node:fs");
const { PROJECT, TEAM } = require("./stripe-preview-relay");
const { ACCOUNT, APPROVED, listenArguments } = require("./stripe-preview-launcher");
function commands({ stripeExecutable, vercelEntry, runtimeDirectory, nodeExecutable = process.execPath }) {
  if (![stripeExecutable, vercelEntry, nodeExecutable, runtimeDirectory].every(p => typeof p === "string" && path.isAbsolute(p)) ||
      !stripeExecutable.toLowerCase().endsWith("stripe.exe") || !vercelEntry.endsWith(".js") || /\.(cmd|bat|ps1)$/i.test(nodeExecutable)) throw Error("Reviewed native executable paths required");
  const spec = (file, args) => ({ file, args, options: { cwd: runtimeDirectory, shell: false, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] } });
  const vercel = args => spec(nodeExecutable, [vercelEntry, ...args, "--scope", TEAM, "--non-interactive"]);
  return {
    version: () => spec(stripeExecutable, ["--version"]),
    selectSandbox: () => spec(stripeExecutable, ["switch", ACCOUNT, "--format", "json"]),
    identity: () => spec(stripeExecutable, ["whoami", "--format", "json"]),
    api(endpoint) {
      if (!["/v9/projects/" + PROJECT, "/v4/aliases/" + APPROVED.alias, "/v13/deployments/" + APPROVED.id].includes(endpoint)) throw Error("Read-only target endpoint required");
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
function createPrivateProcessRunner({ mode, spawnMock, stopMock, env = {}, timeoutMs = 20000, maxBytes = 2097152 }) {
  if (mode !== "synthetic" || typeof spawnMock !== "function" || typeof stopMock !== "function" || timeoutMs < 1 || timeoutMs > 20000) throw Error("Synthetic process adapters only");
  const owned = new Set(), stopping = new Map(); let disposed = false;
  const stop = async child => {
    if (stopping.has(child)) return stopping.get(child);
    if (!owned.has(child)) return;
    const operation = Promise.resolve().then(() => stopMock(child)).then(() => owned.delete(child))
      .catch(() => { throw Error("Private process termination unavailable"); }).finally(() => stopping.delete(child));
    stopping.set(child, operation); return operation;
  };
  const spawn = spec => {
    if (disposed || spec.options?.shell !== false || spec.options?.stdio?.join() !== "ignore,pipe,pipe") throw Error("Private subprocess required");
    if (!path.isAbsolute(spec.options.cwd || "") || fs.readdirSync(spec.options.cwd).some(n => /^\.env(?:\.|$)/i.test(n))) throw Error("Isolated runtime directory required");
    const child = spawnMock(spec.file, [...spec.args], { ...spec.options, env: cleanEnvironment(env) }); owned.add(child); return child;
  };
  const capture = async spec => {
    let child, chunks = [], total = 0, timer;
    try {
      child = spawn(spec);
      const bytes = await new Promise((resolve, reject) => {
        const fail = () => reject(Error("Private command unavailable"));
        timer = setTimeout(fail, timeoutMs);
        child.stdout.on("data", chunk => { total += chunk.length; if (total > maxBytes) return fail(); chunks.push(Buffer.from(chunk)); });
        // Drain stderr without retaining or printing errors which may contain credentials.
        child.stderr.on("data", () => {}); child.once("error", fail);
        child.once("close", code => code === 0 ? resolve(Buffer.concat(chunks)) : fail());
      });
      return bytes;
    } catch { throw Error("Private command unavailable"); }
    finally { clearTimeout(timer); chunks.forEach(b => b.fill(0)); if (child) { child.stdout.removeAllListeners("data"); child.stderr.removeAllListeners("data"); child.removeAllListeners("close"); await stop(child).catch(() => {}); } }
  };
  return { capture, spawn, stop, async dispose() { disposed = true; await Promise.allSettled([...owned].map(stop)); } };
}
function createVercelAdapter({ mode, plan, runner }) {
  if (mode !== "synthetic") throw Error("Real authentication is not approved");
  const api = async endpoint => { let bytes; try { bytes = await runner.capture(plan.api(endpoint)); return JSON.parse(bytes.toString()); } catch { throw Error("Vercel identity read unavailable"); } finally { bytes?.fill(0); } };
  const obtainToken = async () => { let bytes; try { bytes = await runner.capture(plan.oidc()); const value = bytes.toString().trim(); if (!/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(value)) throw Error(); return value; } catch { throw Error("Project OIDC unavailable"); } finally { bytes?.fill(0); } };
  return { api, obtainToken };
}
function createStripeAdapter({ mode, plan, runner }) {
  if (mode !== "synthetic") throw Error("Real Stripe listener is not approved");
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
  const json = async url => {
    const controller = new AbortController(); let timer;
    try {
      return await Promise.race([(async () => {
        const r = await transport(url, { method: "GET", redirect: "error", signal: controller.signal });
        if (r.status !== 200 || r.redirected) throw Error();
        let size = 0, chunks = [];
        try { for await (const chunk of r.body) { size += chunk.length; if (size > 65536) throw Error(); chunks.push(Buffer.from(chunk)); } return JSON.parse(Buffer.concat(chunks).toString()); }
        finally { chunks.forEach(b => b.fill(0)); }
      })(), new Promise((_, reject) => { timer = setTimeout(() => { controller.abort(); reject(Error()); }, timeoutMs); })]);
    } catch { throw Error("OIDC public key source unavailable"); } finally { clearTimeout(timer); }
  };
  return async issuer => {
    if (!["https://oidc.vercel.com", "https://oidc.vercel.com/get-estimate-fast"].includes(issuer)) throw Error("Unapproved OIDC issuer");
    const discovery = await json(issuer + "/.well-known/openid-configuration");
    const uri = new URL(discovery.jwks_uri);
    if (discovery.issuer !== issuer || uri.origin !== "https://oidc.vercel.com" || uri.username || uri.password || uri.search || uri.hash || !uri.pathname.includes("/.well-known/")) throw Error("OIDC discovery mismatch");
    const jwks = await json(uri.href); if (!Array.isArray(jwks.keys) || jwks.keys.length > 32) throw Error("OIDC key set unavailable"); return jwks;
  };
}
module.exports = { commands, cleanEnvironment, createPrivateProcessRunner, createVercelAdapter, createStripeAdapter, createJwksLoader };
