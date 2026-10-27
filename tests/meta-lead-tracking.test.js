"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { createHash } = require("node:crypto");
const { Readable } = require("node:stream");
const fs = require("node:fs");
const path = require("node:path");
const { JSDOM } = require("jsdom");
const handler = require("../api/lead");
const TOKEN = "31e7431c-518b-4c92-84ad-64f088f23233";
const PIXEL = "1444720010946620";
const META_URL = `https://graph.facebook.com/v24.0/${PIXEL}/events`;
const DEV_URL = "https://cpjsbijgijeyrwjpuciv.supabase.co";
const PROD_URL = "https://wedsjubkttygxtpkopfj.supabase.co";
const RECEIPT = "https://www.getestimatefast.com/thank-you.html";
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const ENV = {
  GETESTIMATEFAST_ISOLATED_BACKEND: "false", VERCEL_ENV: "production", VERCEL_GIT_COMMIT_REF: "",
  GETESTIMATEFAST_SUPABASE_URL: PROD_URL, GETESTIMATEFAST_SUPABASE_SECRET_KEY: "SYNTHETIC_DB_ONLY",
  LEAD_PERSISTENCE_ENABLED: "true", RESEND_API_KEY: "SYNTHETIC_EMAIL_ONLY", LEAD_TO_EMAIL: "admin@example.invalid",
  META_DATASET_ID: PIXEL, META_CAPI_ACCESS_TOKEN: "SYNTHETIC_META_ONLY", META_TEST_EVENT_CODE: null
};
const hash = value => createHash("sha256").update(value).digest("hex");
const json = (value, status = 200) => new Response(JSON.stringify(value), { status });
const isDb = call => call.url.startsWith(PROD_URL) || call.url.startsWith(DEV_URL);
const normalReply = call => isDb(call) ? json([{ id: "synthetic-lead" }], 201) : json({ events_received: 1 });

async function invoke(overrides = {}, headers = {}, invalidFile = false) {
  const form = new FormData();
  const fields = {
    "Submission Token": TOKEN, "Service Type": "Painting", "Full Name": "José O'Example",
    "Phone Number": "(813) 555-0101", "Email Address": " Synthetic@Example.invalid ",
    "City": "São Example", "ZIP Code": "33569", "Project Description": "Synthetic project only.", ...overrides
  };
  for (const [key, value] of Object.entries(fields)) if (value !== null) form.append(key, value);
  if (invalidFile) form.append("Photo 1", new File(["synthetic"], "invalid.txt", { type: "text/plain" }));
  const request = new Request(RECEIPT, { method: "POST", body: form });
  const req = Readable.from([Buffer.from(await request.arrayBuffer())]);
  req.method = "POST";
  req.headers = { "content-type": request.headers.get("content-type"), ...headers };
  const responseHeaders = {};
  let body = "";
  const res = { statusCode: 200, setHeader(k, v) { responseHeaders[k.toLowerCase()] = v; }, end(v = "") { body += v; } };
  await handler(req, res);
  return { status: res.statusCode, headers: responseHeaders, body };
}

async function harness(overrides, reply, run) {
  const saved = Object.fromEntries(Object.keys(ENV).map(key => [key, process.env[key]]));
  const originalFetch = global.fetch, originalError = console.error;
  const calls = [], errors = [];
  for (const [key, value] of Object.entries({ ...ENV, ...overrides })) {
    if (value === null) delete process.env[key]; else process.env[key] = value;
  }
  global.fetch = async (url, options) => {
    const call = { url: String(url), options };
    calls.push(call);
    // Every request, including failures, is mocked. No hosted persistence or events.
    assert.ok(isDb(call) || call.url === META_URL || call.url === "https://api.resend.com/emails");
    return (reply || normalReply)(call);
  };
  console.error = (...args) => errors.push(args);
  try { await run({ calls, errors }); } finally {
    global.fetch = originalFetch;
    console.error = originalError;
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
}
const metaCall = calls => calls.find(call => call.url === META_URL);
const eventId = result => new URL(result.headers.location, RECEIPT).searchParams.get("gef_event_id");

test("Meta runs only after a successful new persistence, with the same ID as the receipt", async () => {
  await harness({}, null, async ({ calls }) => {
    const result = await invoke();
    assert.equal(result.status, 303);
    assert.deepEqual(calls.map(call => isDb(call) ? "DB" : call.url), ["DB", META_URL, "https://api.resend.com/emails"]);
    assert.match(eventId(result), UUID);
    assert.equal(result.headers.location, RECEIPT + "?gef_event_id=" + eventId(result));
    assert.equal(result.headers["cache-control"], "no-store");
    const call = metaCall(calls), payload = JSON.parse(call.options.body), event = payload.data[0];
    assert.equal(event.event_id, eventId(result));
    assert.equal(event.event_name, "Lead"); assert.equal(event.action_source, "website");
    assert.ok(Math.abs(event.event_time - Date.now() / 1000) < 3);
    assert.equal(payload.data.length, 1);
    assert.equal(call.options.headers.Authorization, "Bearer SYNTHETIC_META_ONLY");
    assert.equal(call.options.redirect, "error");
    assert.ok(call.options.signal instanceof AbortSignal);
    assert.ok(!Object.hasOwn(payload, "test_event_code"));
  });
});

test("matching data are normalized and SHA-256 hashed; IP, agent and attribution cookies remain unhashed", async () => {
  await harness({}, null, async ({ calls }) => {
    await invoke({}, {
      "x-forwarded-for": "203.0.113.7, 192.0.2.1", "user-agent": "Synthetic Browser",
      cookie: "_fbp=fb.1.1700000000000.123456; _fbc=fb.1.1700000000000.Synthetic_Click-1; other=ignored",
      referer: "https://www.getestimatefast.com/service-painting.html?email=private#private"
    });
    const { user_data: data, event_source_url: source } = JSON.parse(metaCall(calls).options.body).data[0];
    for (const [key, normalized] of Object.entries({ em: "synthetic@example.invalid", ph: "18135550101", fn: "jose", ln: "oexample", ct: "saoexample", zp: "33569", country: "us" })) {
      assert.deepEqual(data[key], [hash(normalized)]);
    }
    assert.equal(data.client_ip_address, "203.0.113.7"); assert.equal(data.client_user_agent, "Synthetic Browser");
    assert.equal(data.fbp, "fb.1.1700000000000.123456"); assert.equal(data.fbc, "fb.1.1700000000000.Synthetic_Click-1");
    assert.equal(source, "https://www.getestimatefast.com/service-painting.html");
    assert.doesNotMatch(JSON.stringify(data), /example\.invalid|555-0101|José/);
  });
});

test("already country-prefixed phone is not prefixed twice", async () => {
  await harness({}, null, async ({ calls }) => {
    await invoke({ "Phone Number": "+1 (813) 555-0101" });
    assert.deepEqual(JSON.parse(metaCall(calls).options.body).data[0].user_data.ph, [hash("18135550101")]);
  });
});

test("invalid attribution and external referrers cannot forward arbitrary private data", async () => {
  await harness({}, null, async ({ calls }) => {
    await invoke({}, { cookie: "_fbp=private; _fbc=private", referer: "https://external.invalid/private?email=private", "x-forwarded-for": "invalid", "user-agent": "invalid\nagent" });
    const event = JSON.parse(metaCall(calls).options.body).data[0];
    assert.equal(event.event_source_url, "https://www.getestimatefast.com/");
    for (const key of ["fbp", "fbc", "client_ip_address", "client_user_agent"]) assert.ok(!Object.hasOwn(event.user_data, key));
  });
});

test("optional test code is top-level and included only when configured", async () => {
  await harness({ META_TEST_EVENT_CODE: " SYNTHETIC_TEST_CODE " }, null, async ({ calls }) => {
    await invoke(); const payload = JSON.parse(metaCall(calls).options.body);
    assert.equal(payload.test_event_code, "SYNTHETIC_TEST_CODE");
    assert.ok(!Object.hasOwn(payload.data[0], "test_event_code"));
  });
});

for (const key of ["META_DATASET_ID", "META_CAPI_ACCESS_TOKEN"]) test(`missing ${key} skips CAPI while preserving the receipt ID`, async () => {
  await harness({ [key]: null }, null, async ({ calls }) => {
    const result = await invoke(); assert.equal(result.status, 303); assert.match(eventId(result), UUID);
    assert.equal(metaCall(calls), undefined); assert.equal(calls.length, 2);
  });
});

test("unexpected dataset never receives credentials", async () => {
  await harness({ META_DATASET_ID: "123" }, null, async ({ calls }) => {
    assert.equal((await invoke()).status, 303); assert.equal(metaCall(calls), undefined);
  });
});

for (const mode of ["http", "transport", "redirect"]) test(`Meta ${mode} failure is sanitized, never retried and never invalidates a saved lead`, async () => {
  await harness({}, call => {
    if (call.url !== META_URL) return normalReply(call);
    if (mode === "http") return new Response("SYNTHETIC_META_ONLY private@example.invalid", { status: 500 });
    throw Error("SYNTHETIC_META_ONLY private@example.invalid");
  }, async ({ calls, errors }) => {
    const result = await invoke(); assert.equal(result.status, 303); assert.match(eventId(result), UUID);
    assert.equal(calls.filter(call => call.url === META_URL).length, 1);
    assert.ok(calls.some(call => call.url.includes("resend.com")));
    assert.match(JSON.stringify(errors), /Meta CAPI/);
    assert.doesNotMatch(JSON.stringify(errors), /SYNTHETIC_META_ONLY|private@example/);
  });
});

test("Meta timeout aborts after two seconds without retry or changing the receipt", async () => {
  await harness({}, call => {
    if (call.url !== META_URL) return normalReply(call);
    return new Promise((resolve, reject) => {
      const keepAlive = setTimeout(() => reject(Error("Abort was not delivered")), 4000);
      call.options.signal.addEventListener("abort", () => { clearTimeout(keepAlive); reject(call.options.signal.reason); }, { once: true });
    });
  }, async ({ calls }) => {
    const start = performance.now(), result = await invoke(), elapsed = performance.now() - start;
    assert.equal(result.status, 303); assert.match(eventId(result), UUID);
    assert.ok(elapsed >= 1800 && elapsed < 3500, `elapsed=${elapsed}`);
    assert.equal(calls.filter(call => call.url === META_URL).length, 1);
  });
});

for (const mode of ["unconfigured", "http", "transport"]) test(`Resend ${mode} does not suppress CAPI or invalidate the receipt`, async () => {
  await harness(mode === "unconfigured" ? { RESEND_API_KEY: null } : {}, call => {
    if (!call.url.includes("resend.com")) return normalReply(call);
    if (mode === "http") return json({}, 503);
    throw Error("Synthetic notification failure");
  }, async ({ calls }) => {
    const result = await invoke(); assert.equal(result.status, 303); assert.equal(eventId(result), JSON.parse(metaCall(calls).options.body).data[0].event_id);
  });
});

test("verified duplicate returns a receipt without either Lead event or email", async () => {
  await harness({}, call => call.options.method === "GET" ? json([{ id: "original" }]) : json([]), async ({ calls }) => {
    const result = await invoke(); assert.equal(result.status, 303); assert.equal(eventId(result), null);
    assert.equal(result.headers.location, RECEIPT); assert.equal(calls.length, 2); assert.ok(calls.every(isDb));
  });
});

test("unverified duplicate and database failure cannot emit Lead", async () => {
  for (const mode of ["unverified", "failed"]) await harness({}, () => mode === "failed" ? json({}, 503) : json([]), async ({ calls }) => {
    assert.equal((await invoke()).status, 503); assert.ok(calls.every(isDb));
  });
});

for (const mode of ["spam", "invalid", "attachment", "disabled", "isolated", "protected-preview"]) test(`${mode} cannot emit CAPI or browser Lead`, async () => {
  const env = mode === "disabled" ? { LEAD_PERSISTENCE_ENABLED: "false" } : mode === "isolated" ? { GETESTIMATEFAST_ISOLATED_BACKEND: "true" } : mode === "protected-preview" ? { VERCEL_ENV: "preview", VERCEL_GIT_COMMIT_REF: "feat/us-persisted-leads-20261014" } : {};
  await harness(env, () => { throw Error("No external operations allowed"); }, async ({ calls }) => {
    const result = await invoke(mode === "spam" ? { gef_hp_trap_47b: "spam" } : mode === "invalid" ? { "Email Address": "invalid" } : {}, {}, mode === "attachment");
    assert.equal(calls.length, 0);
    if (mode === "spam") { assert.equal(result.status, 303); assert.equal(eventId(result), null); }
    else assert.ok(result.status >= 400);
  });
});

test("Preview keeps the event ID redirect on the same deployment", async () => {
  await harness({ VERCEL_ENV: "preview", GETESTIMATEFAST_SUPABASE_URL: DEV_URL }, null, async ({ calls }) => {
    const result = await invoke(); assert.match(result.headers.location, /^\/thank-you\.html\?gef_event_id=/);
    assert.equal(eventId(result), JSON.parse(metaCall(calls).options.body).data[0].event_id);
  });
});

test("independent new leads use different backend IDs", async () => {
  await harness({}, null, async () => {
    const a = await invoke(), b = await invoke({ "Submission Token": "41e7431c-518b-4c92-84ad-64f088f23233" });
    assert.notEqual(eventId(a), eventId(b));
  });
});

const html = fs.readFileSync(path.join(__dirname, "../thank-you.html"), "utf8");
const pixelScript = html.match(/  <script id="gef-meta-pixel">([\s\S]*?)  <\/script>\r?\n/);
function browser(url, failHistory = false) {
  // outside-only never loads or executes Google/Meta scripts or makes requests.
  const dom = new JSDOM(html, { url, runScripts: "outside-only" });
  if (failHistory) dom.window.history.replaceState = () => { throw Error("Synthetic restriction"); };
  dom.window.eval(pixelScript[1]);
  return dom;
}

test("Pixel uses the backend eventID, scrubs only its query parameter and cannot repeat Lead on refresh", () => {
  const dom = browser(RECEIPT + "?keep=1&gef_event_id=" + TOKEN + "#keep");
  try {
    const calls = Array.from(dom.window.fbq.queue, args => Array.from(args));
    assert.equal(calls[0][0], "init"); assert.equal(calls[0][1], PIXEL);
    assert.equal(calls[1][1], "PageView"); assert.equal(calls[2][1], "Lead"); assert.equal(calls[2][3].eventID, TOKEN);
    assert.equal(dom.window.location.href, RECEIPT + "?keep=1#keep");
    const refresh = browser(dom.window.location.href);
    try { assert.equal(refresh.window.fbq.queue.length, 2); } finally { refresh.window.close(); }
    const injected = dom.window.document.querySelector('script[src="https://connect.facebook.net/en_US/fbevents.js"]');
    assert.ok(injected.async);
  } finally { dom.window.close(); }
});

for (const mode of ["absent", "invalid", "history-failure"]) test(`Pixel ${mode} does not emit a Lead`, () => {
  const dom = browser(RECEIPT + (mode === "absent" ? "" : "?gef_event_id=" + (mode === "invalid" ? "not-a-backend-id" : TOKEN)), mode === "history-failure");
  try { assert.equal(dom.window.fbq.queue.length, 2); } finally { dom.window.close(); }
});

test("frontend contains no server-only Meta credentials or access token references", () => {
  assert.doesNotMatch(html, /META_CAPI_ACCESS_TOKEN|META_TEST_EVENT_CODE|Authorization|access_token|SYNTHETIC_META_ONLY/);
  assert.ok(pixelScript);
});
