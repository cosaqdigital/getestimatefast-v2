"use strict";
// Local, opt-in relay. Starting it never registers a Stripe webhook or changes SSO.
// Credentials are provided in memory by the caller; never argv, disk or logs.
const http = require("node:http");
const { readRaw } = require("../api/_lib/stripe-test");
const { SANDBOX_BRANCH } = require("../api/_lib/stripe-policy");
function createRelay({ origin, deployment, tokenProvider, transport = fetch }) {
  const target = new URL(origin);
  if (target.protocol !== "https:" || !target.hostname.endsWith(".vercel.app") || target.username || target.password || target.search || target.hash || target.pathname !== "/") throw Error("Approved HTTPS Preview origin required");
  if (deployment?.projectId !== "prj_kA6x5rt1MChiNSQpa6pShHoUSuOF" || deployment?.environment !== "preview" ||
      deployment?.branch !== SANDBOX_BRANCH || deployment?.origin !== target.origin || !/^[a-f0-9]{40}$/.test(deployment?.sha || "")) throw Error("Verified project, Preview branch and SHA required");
  // The operator must verify this immutable deployment's project/branch/SHA first.
  return http.createServer(async (req, res) => {
    if (req.method !== "POST" || req.url !== "/api/stripe-test-webhook") { res.writeHead(404); return res.end(); }
    try {
      const raw = await readRaw(req);
      const signature = req.headers["stripe-signature"];
      if (typeof signature !== "string" || signature.length > 4096) { res.writeHead(400); return res.end(); }
      const token = await tokenProvider();
      if (typeof token !== "string" || !token) throw Error("Temporary project OIDC required");
      const response = await transport(target.origin + "/api/stripe-test-webhook", {
        method: "POST", redirect: "error", signal: AbortSignal.timeout(20000),
        headers: { "content-type": "application/json", "stripe-signature": signature, "x-vercel-trusted-oidc-idp-token": token }, body: raw
      });
      // Never relay provider responses, cookies, headers, auth pages or private data.
      res.writeHead(response.status >= 200 && response.status < 300 ? 204 : 503); res.end();
    } catch { res.writeHead(503); res.end(); }
  });
}
async function startRelay(options, port = 0) {
  const server = createRelay(options);
  await new Promise(resolve => server.listen(port, "127.0.0.1", resolve));
  return server;
}
module.exports = { createRelay, startRelay };
