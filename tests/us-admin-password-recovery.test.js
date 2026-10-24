"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { Readable } = require("node:stream");
const handler = require("../api/admin/password-recovery");

const ORIGIN = "https://getestimatefast-v2-git-feat-us-admin-o-10fae9-get-estimate-fast.vercel.app";
const HOST = new URL(ORIGIN).host;
const AUTH_URL = "https://cpjsbijgijeyrwjpuciv.supabase.co";
const ADMIN_ID = "7f44765d-fd3a-4078-8a4f-d689eed39754";
const ADMIN_EMAIL = "admin@getestimatefast.com";
const PUBLIC_KEY = "sb_publishable_recovery_test_only";
const SECRET_KEY = "sb_secret_recovery_test_only";
const TOKEN = "synthetic.recovery-token.only";
const PASSWORD = "Synthetic-test-password-ONLY!";
const user = { id: ADMIN_ID, email: ADMIN_EMAIL, email_confirmed_at: "2026-10-17T00:00:00Z" };
const baseEnv = {
  GETESTIMATEFAST_ADMIN_RECOVERY_ENABLED: "true",
  VERCEL_ENV: "preview", VERCEL_GIT_COMMIT_REF: "feat/us-admin-overview-20261015",
  GETESTIMATEFAST_ISOLATED_BACKEND: "true", GETESTIMATEFAST_DEVELOPMENT_PROJECT_REF: "cpjsbijgijeyrwjpuciv",
  GETESTIMATEFAST_SUPABASE_URL: AUTH_URL, GETESTIMATEFAST_PUBLIC_ORIGIN: ORIGIN,
  GETESTIMATEFAST_SUPABASE_PUBLISHABLE_KEY: PUBLIC_KEY, GETESTIMATEFAST_SUPABASE_SECRET_KEY: SECRET_KEY
};

function request(method = "GET", body, headers = {}, raw) {
  const req = Readable.from(raw !== undefined ? [Buffer.from(raw)] : body === undefined ? [] : [Buffer.from(JSON.stringify(body))]);
  req.method = method; req.url = "/api/admin/password-recovery"; req.query = {};
  req.headers = { host: HOST, "sec-fetch-site": "same-origin", ...(method === "POST" ? { origin: ORIGIN, "content-type": "application/json" } : {}), ...headers };
  return req;
}

async function responseFor(req) {
  const headers = {}; let text = "";
  const res = { statusCode: 200, setHeader(key, value) { headers[key.toLowerCase()] = String(value); }, end(value = "") { text += value; } };
  await handler(req, res);
  return { status: res.statusCode, data: JSON.parse(text), text, headers };
}

const response = (data, status = 200, headers = {}) => new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json", ...headers } });

async function isolated(overrides, run) {
  const saved = Object.fromEntries(Object.keys(baseEnv).map(key => [key, process.env[key]]));
  const originalFetch = global.fetch, originalError = console.error, originalLog = console.log;
  const calls = [], logs = [];
  const settings = { ...baseEnv, ...overrides };
  for (const [key, value] of Object.entries(settings)) {
    if (value === undefined) delete process.env[key]; else process.env[key] = value;
  }
  let fetchMock = () => { throw Error("Unexpected external operation; all recovery tests must use mocks."); };
  global.fetch = async (url, options = {}) => { calls.push({ url: String(url), method: options.method || "GET", options }); return fetchMock(String(url), options); };
  console.error = console.log = (...parts) => logs.push(parts.map(String).join(" "));
  try { return await run({ calls, logs, setFetch(fn) { fetchMock = fn; } }); }
  finally {
    global.fetch = originalFetch; console.error = originalError; console.log = originalLog;
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
}

function authenticatedMock(context, { authUser = user, authStatus = 200, members = [{ user_id: ADMIN_ID }], completeResponse = response(user) } = {}) {
  context.setFetch((url, options) => {
    if (url === AUTH_URL + "/auth/v1/user" && (!options.method || options.method === "GET")) return response(authUser, authStatus);
    if (url.startsWith(AUTH_URL + "/rest/v1/admin_users?")) return response(members);
    if (url === AUTH_URL + "/auth/v1/user" && options.method === "PUT") return completeResponse;
    throw Error("Unexpected request in authenticated recovery mock.");
  });
}

test("recovery is OFF by default and rejects every unapproved environment before network access", async () => {
  const variants = [
    { GETESTIMATEFAST_ADMIN_RECOVERY_ENABLED: undefined }, { GETESTIMATEFAST_ADMIN_RECOVERY_ENABLED: "false" },
    { GETESTIMATEFAST_ADMIN_RECOVERY_ENABLED: "TRUE" }, { VERCEL_ENV: "production" }, { VERCEL_ENV: "development" },
    { VERCEL_GIT_COMMIT_REF: "feat/google-review-auth-20261010" }, { GETESTIMATEFAST_ISOLATED_BACKEND: "false" },
    { GETESTIMATEFAST_DEVELOPMENT_PROJECT_REF: "wedsjubkttygxtpkopfj" },
    { GETESTIMATEFAST_SUPABASE_URL: "https://wedsjubkttygxtpkopfj.supabase.co" },
    { GETESTIMATEFAST_SUPABASE_URL: AUTH_URL + ".attacker.invalid" },
    { GETESTIMATEFAST_PUBLIC_ORIGIN: "https://www.getestimatefast.com" },
    { GETESTIMATEFAST_PUBLIC_ORIGIN: undefined }, { GETESTIMATEFAST_SUPABASE_PUBLISHABLE_KEY: undefined },
    { GETESTIMATEFAST_SUPABASE_SECRET_KEY: undefined },
    { GETESTIMATEFAST_SUPABASE_PUBLISHABLE_KEY: SECRET_KEY },
    { GETESTIMATEFAST_SUPABASE_PUBLISHABLE_KEY: "test." + Buffer.from('{"role":"service_role"}').toString("base64url") + ".test" }
  ];
  for (const env of variants) await isolated(env, async ({ calls }) => {
    for (const req of [request(), request("POST", { action: "request" }), request("POST", { action: "complete", password: PASSWORD }, { authorization: "Bearer " + TOKEN })]) {
      const result = await responseFor(req);
      assert.equal(result.status, 404); assert.equal(result.data.code, "recovery_disabled");
      assert.equal(result.headers["cache-control"], "no-store");
    }
    assert.equal(calls.length, 0);
  });
});

test("anonymous bootstrap is read-only and exposes only the approved UI contract", async () => {
  await isolated({}, async ({ calls }) => {
    const result = await responseFor(request());
    assert.equal(result.status, 200);
    assert.deepEqual(result.data, { enabled: true, recipient: ADMIN_EMAIL, minPasswordLength: 8, maxPasswordLength: 256, sessionValidated: false });
    assert.equal(result.headers["cache-control"], "no-store");
    assert.equal(result.headers["referrer-policy"], "no-referrer");
    assert.equal(result.headers["x-content-type-options"], "nosniff");
    assert.equal(result.headers["set-cookie"], undefined);
    assert.equal(result.headers["access-control-allow-origin"], undefined);
    assert.equal(calls.length, 0);
    assert(!result.text.includes(PUBLIC_KEY)); assert(!result.text.includes(SECRET_KEY));
  });
});

test("foreign or opaque Origin, wrong Host, and cross-site metadata fail before Auth or recovery", async () => {
  await isolated({}, async ({ calls }) => {
    const cases = [
      request("POST", { action: "request" }, { origin: undefined }),
      request("POST", { action: "request" }, { origin: "null" }),
      request("POST", { action: "request" }, { origin: ORIGIN + "/" }),
      request("POST", { action: "request" }, { origin: "https://attacker.invalid" }),
      request("POST", { action: "request" }, { host: "attacker.invalid" }),
      request("POST", { action: "request" }, { "sec-fetch-site": "cross-site" }),
      request("GET", undefined, { origin: "null" }),
      request("GET", undefined, { origin: "https://attacker.invalid" }),
      request("GET", undefined, { host: HOST + ".attacker.invalid" }),
      request("GET", undefined, { "sec-fetch-site": "same-site" })
    ];
    for (const req of cases) {
      const result = await responseFor(req);
      assert.equal(result.status, 403); assert.equal(result.data.code, "origin_not_allowed");
    }
    assert.equal(calls.length, 0);
  });
});

test("only explicit JSON actions are accepted; targets, redirect URLs and query tokens cannot be supplied", async () => {
  await isolated({}, async ({ calls }) => {
    const unsupported = await responseFor(request("OPTIONS"));
    assert.equal(unsupported.status, 405); assert.equal(unsupported.headers.allow, "GET, POST");
    const bodies = [null, [], {}, { action: "update" },
      { action: "request", email: "other@example.invalid" }, { action: "request", user_id: ADMIN_ID },
      { action: "request", redirectTo: "https://attacker.invalid" }, { action: "request", password: PASSWORD },
      { action: "complete" }, { action: "complete", password: PASSWORD, user_id: ADMIN_ID },
      { action: "complete", password: PASSWORD, email: ADMIN_EMAIL },
      { action: "complete", password: PASSWORD, access_token: TOKEN }];
    for (const body of bodies) {
      const result = await responseFor(request("POST", body));
      assert.equal(result.status, 400); assert.equal(result.data.code, "invalid_request");
    }
    for (const req of [
      request("POST", { action: "request" }, { "content-type": "application/x-www-form-urlencoded" }),
      request("POST", undefined, {}, "{not-json"),
      request("POST", undefined, {}, " ".repeat(4097)),
      Object.assign(request(), { query: { redirect_to: "https://attacker.invalid" } }),
      Object.assign(request(), { url: "/api/admin/password-recovery?access_token=" + TOKEN })
    ]) assert.equal((await responseFor(req)).status, 400);
    assert.equal(calls.length, 0);
  });
});

test("recovery request calls the official public Auth operation with the one fixed email and redirect", async () => {
  await isolated({}, async ({ calls, logs, setFetch }) => {
    setFetch(() => response({}));
    const result = await responseFor(request("POST", { action: "request" }));
    assert.equal(result.status, 200); assert.equal(result.data.requested, true);
    assert.match(result.data.message, /Delivery has not been confirmed/);
    assert.equal(calls.length, 1);
    const call = calls[0], url = new URL(call.url);
    assert.equal(url.origin, AUTH_URL); assert.equal(url.pathname, "/auth/v1/recover");
    assert.deepEqual([...url.searchParams], [["redirect_to", ORIGIN + "/admin-recovery.html"]]);
    assert.equal(call.method, "POST"); assert.equal(call.options.redirect, "error");
    assert.deepEqual(JSON.parse(call.options.body), { email: ADMIN_EMAIL });
    assert.equal(call.options.headers.apikey, PUBLIC_KEY);
    assert.equal(call.options.headers["X-Supabase-Api-Version"], "2024-01-01");
    assert.equal(call.options.headers.Authorization, undefined);
    assert(!JSON.stringify(call.options).includes(SECRET_KEY));
    assert.equal(logs.length, 0);
  });
});

test("SMTP and quota failures are sanitized and never reported as delivery success", async () => {
  for (const scenario of [
    { status: 403, code: "email_address_not_authorized", expected: 503, resultCode: "email_delivery_unavailable" },
    { status: 429, code: "over_email_send_rate_limit", expected: 429, resultCode: "rate_limited" },
    { status: 400, code: "over_request_rate_limit", expected: 429, resultCode: "rate_limited" },
    { status: 500, code: "unexpected_failure", expected: 503, resultCode: "email_delivery_unavailable" }
  ]) await isolated({}, async ({ setFetch, calls, logs }) => {
    setFetch(() => response({ error_code: scenario.code, msg: SECRET_KEY + TOKEN + PASSWORD }, scenario.status, { "retry-after": "60" }));
    const result = await responseFor(request("POST", { action: "request" }));
    assert.equal(result.status, scenario.expected); assert.equal(result.data.code, scenario.resultCode);
    assert.equal(result.data.requested, undefined); assert.equal(calls.length, 1);
    if (scenario.expected === 429) assert.equal(result.headers["retry-after"], "60");
    for (const sensitive of [SECRET_KEY, TOKEN, PASSWORD]) assert(!result.text.includes(sensitive));
    assert.equal(logs.length, 0);
  });
});

test("bootstrap with a session validates live Auth, admin membership, and the existing identity", async () => {
  await isolated({}, async context => {
    authenticatedMock(context);
    const result = await responseFor(request("GET", undefined, { authorization: "Bearer " + TOKEN }));
    assert.equal(result.status, 200); assert.equal(result.data.enabled, true); assert.equal(result.data.sessionValidated, true);
    assert.equal(context.calls.length, 2);
    assert.equal(context.calls[0].url, AUTH_URL + "/auth/v1/user");
    assert.equal(context.calls[0].options.headers.apikey, PUBLIC_KEY);
    assert.equal(context.calls[0].options.headers.Authorization, "Bearer " + TOKEN);
    assert.equal(context.calls[1].url, AUTH_URL + "/rest/v1/admin_users?user_id=eq." + ADMIN_ID + "&select=user_id&limit=1");
    assert(context.calls.every(call => call.method === "GET"));
    assert(!result.text.includes(TOKEN)); assert(!result.text.includes(SECRET_KEY));
  });
});

test("a missing or malformed session cannot update any password", async () => {
  await isolated({}, async ({ calls }) => {
    for (const authorization of [undefined, "", "Bearer", "Bearer token with spaces", "Basic synthetic"]) {
      const result = await responseFor(request("POST", { action: "complete", password: PASSWORD }, { authorization }));
      assert.equal(result.status, 401); assert.equal(result.data.code, "session_invalid");
    }
    assert.equal(calls.length, 0);
  });
});

test("invalid, unconfirmed, non-admin and different-admin sessions never reach password update", async () => {
  const scenarios = [
    { authStatus: 401, authUser: { msg: "invalid JWT" }, expected: 401, reads: 1 },
    { authUser: { ...user, email_confirmed_at: null }, expected: 403, reads: 1 },
    { members: [], expected: 403, reads: 2 },
    { authUser: { ...user, id: "11111111-1111-4111-8111-111111111111" }, expected: 403, reads: 2 },
    { authUser: { ...user, email: "other@example.invalid" }, expected: 403, reads: 2 }
  ];
  for (const scenario of scenarios) for (const method of ["GET", "POST"]) await isolated({}, async context => {
    authenticatedMock(context, scenario);
    const body = method === "POST" ? { action: "complete", password: PASSWORD } : undefined;
    const result = await responseFor(request(method, body, { authorization: "Bearer " + TOKEN }));
    assert.equal(result.status, scenario.expected); assert.equal(context.calls.length, scenario.reads);
    assert(context.calls.every(call => call.method === "GET"));
    assert.equal(context.logs.length, 0);
  });
});

test("password bounds are checked before any Auth call without trimming the accepted password", async () => {
  await isolated({}, async ({ calls }) => {
    for (const password of [null, 12345678, "short", "x".repeat(257)]) {
      const result = await responseFor(request("POST", { action: "complete", password }, { authorization: "Bearer " + TOKEN }));
      assert.equal(result.status, 400); assert.equal(result.data.code, "invalid_password");
    }
    assert.equal(calls.length, 0);
  });
  await isolated({}, async context => {
    authenticatedMock(context);
    const password = "  " + PASSWORD + "  ";
    assert.equal((await responseFor(request("POST", { action: "complete", password }, { authorization: "Bearer " + TOKEN }))).status, 200);
    assert.equal(JSON.parse(context.calls[2].options.body).password, password);
  });
});

test("successful recovery updates only the authenticated existing admin through the own-user API", async () => {
  await isolated({}, async context => {
    authenticatedMock(context);
    const result = await responseFor(request("POST", { action: "complete", password: PASSWORD }, { authorization: "Bearer " + TOKEN }));
    assert.equal(result.status, 200); assert.deepEqual(result.data, { ok: true, redirectPath: "/admin.html" });
    assert.equal(context.calls.length, 3);
    assert.deepEqual(context.calls.map(call => call.method), ["GET", "GET", "PUT"]);
    const update = context.calls[2];
    assert.equal(update.url, AUTH_URL + "/auth/v1/user"); assert.equal(update.options.redirect, "error");
    assert.deepEqual(JSON.parse(update.options.body), { password: PASSWORD });
    assert.equal(update.options.headers.apikey, PUBLIC_KEY);
    assert.equal(update.options.headers.Authorization, "Bearer " + TOKEN);
    assert(!JSON.stringify(update.options).includes(SECRET_KEY));
    assert(!context.calls.some(call => /\/admin\/users|\/rpc\/|\/leads|\/wallet|\/transactions/.test(call.url)));
    assert.equal(result.headers["set-cookie"], undefined);
    for (const sensitive of [SECRET_KEY, TOKEN, PASSWORD]) assert(!result.text.includes(sensitive));
    assert.equal(context.logs.length, 0);
  });
});

test("password policy, reauthentication and expiry failures do not retry with privileged credentials", async () => {
  for (const scenario of [
    { status: 422, code: "weak_password", expected: 400, resultCode: "invalid_password" },
    { status: 422, code: "same_password", expected: 400, resultCode: "invalid_password" },
    { status: 422, code: "reauthentication_needed", expected: 401, resultCode: "session_invalid" },
    { status: 422, code: "current_password_required", expected: 401, resultCode: "session_invalid" },
    { status: 400, code: "session_not_found", expected: 401, resultCode: "session_invalid" },
    { status: 401, code: "bad_jwt", expected: 401, resultCode: "session_invalid" },
    { status: 401, code: "insufficient_aal", expected: 403, resultCode: "access_denied" },
    { status: 429, code: "over_request_rate_limit", expected: 429, resultCode: "rate_limited" },
    { status: 500, code: "unexpected_failure", expected: 503, resultCode: "service_unavailable" }
  ]) await isolated({}, async context => {
    authenticatedMock(context, { completeResponse: response({ code: scenario.code, message: PASSWORD + TOKEN + SECRET_KEY }, scenario.status) });
    const result = await responseFor(request("POST", { action: "complete", password: PASSWORD }, { authorization: "Bearer " + TOKEN }));
    assert.equal(result.status, scenario.expected); assert.equal(result.data.code, scenario.resultCode);
    if (scenario.code === "insufficient_aal") {
      assert.match(result.data.error, /Additional authentication/);
      assert(!result.data.error.includes("new recovery link"));
    }
    assert.equal(context.calls.length, 3); assert.equal(context.calls[2].options.headers.apikey, PUBLIC_KEY);
    for (const sensitive of [SECRET_KEY, TOKEN, PASSWORD]) assert(!result.text.includes(sensitive));
    assert.equal(context.logs.length, 0);
  });
});

test("network or database exceptions fail closed without logging sensitive exception text", async () => {
  for (const stage of ["request", "auth", "database"]) await isolated({}, async ({ calls, logs, setFetch }) => {
    setFetch(url => {
      if (stage === "database" && url === AUTH_URL + "/auth/v1/user") return response(user);
      throw Error("Upstream diagnostic " + PASSWORD + TOKEN + SECRET_KEY);
    });
    const body = stage === "request" ? { action: "request" } : { action: "complete", password: PASSWORD };
    const result = await responseFor(request("POST", body, { authorization: "Bearer " + TOKEN }));
    assert.equal(result.status, 503); assert.equal(result.data.code, "service_unavailable");
    assert.equal(calls.length, stage === "database" ? 2 : 1);
    assert(!calls.some(call => call.method === "PUT"));
    for (const sensitive of [SECRET_KEY, TOKEN, PASSWORD]) assert(!result.text.includes(sensitive));
    assert.equal(logs.length, 0);
  });
});
