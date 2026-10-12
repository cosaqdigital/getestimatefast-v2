"use strict";
const http = require("node:http");
const { SANDBOX_BRANCH } = require("../api/_lib/stripe-policy");
const PROJECT = "prj_kA6x5rt1MChiNSQpa6pShHoUSuOF", TEAM = "team_vRw9eJBijmUFe1SbbOFY5xZs";
const PATH = "/api/stripe-test-webhook", LIMIT = 262144;
function validDestination(origin, d) {
  const u = new URL(origin);
  if (u.protocol !== "https:" || !u.hostname.endsWith(".vercel.app") || u.username || u.password || u.search || u.hash || u.pathname !== "/" || u.port ||
      d?.projectId !== PROJECT || d?.teamId !== TEAM || d?.environment !== "preview" || d?.branch !== SANDBOX_BRANCH ||
      d?.origin !== u.origin || !/^dpl_[A-Za-z0-9]+$/.test(d?.id || "") || !/^[a-f0-9]{40}$/.test(d?.sha || "")) throw Error("Verified isolated Preview required");
  return u.origin;
}
function bounded(promise, signal) {
  return new Promise((resolve, reject) => {
    const cleanup = () => signal.removeEventListener("abort", stop);
    const stop = () => { cleanup(); reject(Error("Relay operation stopped")); };
    if (signal.aborted) return stop();
    signal.addEventListener("abort", stop, { once: true });
    Promise.resolve(promise).then(v => { cleanup(); resolve(v); }, () => { cleanup(); reject(Error("Relay operation failed")); });
  });
}
function body(req, signal) {
  return new Promise((resolve, reject) => {
    let size = 0, chunks = [];
    const clear = () => { req.off("data", data); req.off("end", end); req.off("aborted", fail); req.off("error", fail); signal.removeEventListener("abort", fail); };
    const fail = () => { clear(); chunks.forEach(b => b.fill(0)); chunks = []; req.resume(); reject(Error("Body unavailable")); };
    const data = chunk => { size += chunk.length; if (size > LIMIT) { clear(); chunks.forEach(b => b.fill(0)); chunks = []; req.resume(); const e = Error("Body too large"); e.status = 413; reject(e); } else chunks.push(Buffer.from(chunk)); };
    const end = () => { clear(); const raw = Buffer.concat(chunks); chunks.forEach(b => b.fill(0)); resolve(raw); };
    req.on("data", data); req.once("end", end); req.once("aborted", fail); req.once("error", fail); signal.addEventListener("abort", fail, { once: true });
  });
}
function createRelay({ origin, deployment, verifyDestination, tokenProvider, verifyToken, verifySignature, onAuthorizationFailure = () => {}, transport = fetch, timeoutMs = 20000 }) {
  const target = validDestination(origin, deployment);
  for (const fn of [verifyDestination, tokenProvider, verifyToken, verifySignature]) if (typeof fn !== "function") throw Error("Verified relay dependencies required");
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 20000) throw Error("Invalid relay deadline");
  const shutdown = new AbortController(); let active = 0;
  const server = http.createServer(async (req, res) => {
    const reply = status => { if (!res.destroyed && !res.headersSent) { res.writeHead(status, { "cache-control": "no-store", connection: "close" }); res.end(); } };
    if (shutdown.signal.aborted) return reply(503);
    if (req.socket.remoteAddress !== "127.0.0.1" || req.headers.host !== "127.0.0.1:" + server.address()?.port) return reply(403);
    if (req.method !== "POST" || req.url !== PATH) return reply(404);
    if (active >= 16) return reply(503);
    if (req.headers["content-length"] && Number(req.headers["content-length"]) > LIMIT) { req.resume(); return reply(413); }
    active++; let raw, token;
    const timer = new AbortController(), deadline = setTimeout(() => timer.abort(), timeoutMs);
    const signal = AbortSignal.any([timer.signal, shutdown.signal]);
    try {
      raw = await body(req, signal);
      const signature = req.headers["stripe-signature"];
      if (typeof signature !== "string" || signature.length > 4096 || !await bounded(verifySignature(raw, signature), signal)) return reply(400);
      const verified = await bounded(verifyDestination(signal), signal);
      if (validDestination(target, verified) !== target || verified.id !== deployment.id || verified.sha !== deployment.sha) throw Error("Destination changed");
      token = await bounded(tokenProvider(signal), signal);
      if (typeof token !== "string" || !await bounded(verifyToken(token, signal), signal)) throw Error("Valid project OIDC required");
      if (signal.aborted) throw Error("Relay stopped before forwarding");
      const response = await bounded(transport(target + PATH, { method: "POST", redirect: "error", signal,
        headers: { "content-type": "application/json", "stripe-signature": signature, "x-vercel-trusted-oidc-idp-token": token }, body: raw }), signal);
      const status = response.status;
      if ([301, 302, 303, 307, 308, 401, 403].includes(status) || response.redirected) onAuthorizationFailure();
      if (response.body?.cancel) await bounded(response.body.cancel(), signal);
      reply(!response.redirected && Number.isInteger(status) && status >= 200 && status < 300 ? 204 : 503);
    } catch (e) { reply(e.status === 413 ? 413 : 503); }
    finally { clearTimeout(deadline); raw?.fill(0); token = undefined; active--; }
  });
  server.headersTimeout = 10000; server.requestTimeout = 20000; server.keepAliveTimeout = 1000;
  server.stopRelay = async () => { shutdown.abort(); await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }); };
  return server;
}
async function startRelay(options, port = 0) {
  const server = createRelay(options);
  await new Promise((resolve, reject) => { const error = () => reject(Error("Loopback listener unavailable")); server.once("error", error); server.listen(port, "127.0.0.1", () => { server.off("error", error); resolve(); }); });
  return server;
}
module.exports = { createRelay, startRelay, validDestination, bounded, PROJECT, TEAM, PATH };
