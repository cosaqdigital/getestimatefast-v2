"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "admin-recovery.html"), "utf8");
const script = fs.readFileSync(path.join(root, "assets/admin-recovery.js"), "utf8");
const origin = "https://getestimatefast-v2-qa-get-estimate-fast.vercel.app";
const access = "synthetic.header.signature";
const refresh = "REFRESH_TOKEN_MUST_NEVER_BE_USED";
const config = { enabled: true, recipient: "admin@getestimatefast.com", minPasswordLength: 8, maxPasswordLength: 256, sessionValidated: false };
const session = { ...config, sessionValidated: true };
const recoveryUrl = origin + "/admin-recovery.html?next=https://attacker.example#access_token=" + access + "&refresh_token=" + refresh + "&type=recovery&token_type=bearer";
const response = (body, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => body });
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
const flush = async () => { for (let i = 0; i < 3; i++) await new Promise(resolve => setImmediate(resolve)); };

// A small DOM/event adapter runs the real browser script and the actual HTML IDs.
// No production code exports, dependency installation, or network access is needed.
function page({ url = origin + "/admin-recovery.html", fetchResult = () => response(config), scrubFails = false } = {}) {
  const nodes = new Map(), calls = [], history = [], logs = [];
  const document = { activeElement: null, getElementById(id) { assert(nodes.has(id), "Missing HTML element: " + id); return nodes.get(id); } };
  class Element extends EventTarget {
    constructor(attributes) {
      super(); this.attributes = attributes; this.value = attributes.get("value") || "";
      this.checked = attributes.has("checked"); this.disabled = attributes.has("disabled");
      this.hidden = attributes.has("hidden"); this.textContent = ""; this.dataset = {};
    }
    setAttribute(name, value) { this.attributes.set(name, String(value)); }
    removeAttribute(name) { this.attributes.delete(name); }
    getAttribute(name) { return this.attributes.get(name) ?? null; }
    focus() { document.activeElement = this; }
  }
  for (const tag of html.matchAll(/<[a-z][\w-]*\b([^>]*)>/gi)) {
    const attrs = new Map([...tag[1].matchAll(/([\w-]+)(?:="([^"]*)")?/g)].map(item => [item[1], item[2] ?? ""]));
    if (attrs.has("id")) { assert(!nodes.has(attrs.get("id"))); nodes.set(attrs.get("id"), new Element(attrs)); }
  }
  let currentUrl = new URL(url);
  const window = new EventTarget();
  Object.defineProperty(window, "location", { get: () => currentUrl });
  Object.defineProperty(document, "cookie", { get() { throw Error("No cookie access allowed"); }, set() { throw Error("No cookie writes allowed"); } });
  for (const key of ["localStorage", "sessionStorage"]) Object.defineProperty(window, key, { get() { throw Error("No persistent storage allowed"); } });
  window.history = { replaceState(value, title, destination) {
    assert.equal(value, null); assert.equal(title, "");
    if (scrubFails) throw Error("History unavailable");
    history.push(destination); currentUrl = new URL(destination, currentUrl);
  } };
  const context = vm.createContext({ window, document, URLSearchParams, AbortController, setTimeout, clearTimeout,
    console: { log: (...values) => logs.push(values), error: (...values) => logs.push(values) },
    fetch: async (target, options) => {
      assert.equal(currentUrl.hash, "", "Fragment must be removed before any API request");
      assert.equal(currentUrl.search, "", "Query must be removed before any API request");
      assert.equal(target, "/api/admin/password-recovery");
      const call = { target, options }; calls.push(call);
      return fetchResult(call, calls.length);
    }
  });
  vm.runInContext(script, context, { filename: "assets/admin-recovery.js" });
  return {
    node: id => document.getElementById(id), calls, history, logs, window, document,
    url: () => currentUrl,
    state: () => nodes.get("recoveryApp").dataset.state,
    event(id, name) { const event = new Event(name, { cancelable: true }); nodes.get(id).dispatchEvent(event); return event; },
    lifecycle(name, persisted = false) { const event = new Event(name); Object.defineProperty(event, "persisted", { value: persisted }); window.dispatchEvent(event); },
    fill(password, confirmation = password) { nodes.get("newPassword").value = password; nodes.get("confirmPassword").value = confirmation; },
    text() { return [...nodes.values()].map(node => node.textContent).join(" "); }
  };
}
function assertSafeTransport(calls) {
  for (const { options } of calls) {
    assert.equal(options.mode, "cors", "CORS mode avoids a null Origin under no-referrer");
    assert.equal(options.referrerPolicy, "no-referrer");
    assert.equal(options.redirect, "error");
    assert.equal(options.cache, "no-store");
    assert.equal(options.credentials, "same-origin");
    assert(!JSON.stringify(options).includes(refresh));
  }
}

test("recovery is disabled until a successful environment check; failure never submits a form", async () => {
  const p = page({ fetchResult: () => response({ code: "recovery_disabled" }, 404) });
  assert.equal(p.state(), "loading"); assert(p.node("requestFields").disabled); assert(p.node("passwordFields").disabled);
  await flush();
  assert.equal(p.state(), "unavailable"); assert(p.node("passwordForm").hidden);
  p.node("requestConsent").checked = true; p.event("requestForm", "submit");
  p.fill("SyntheticPassword99"); p.event("passwordForm", "submit");
  await flush(); assert.equal(p.calls.length, 1); assert.equal(p.calls[0].options.method, "GET");
});

test("URL scrub failure fails closed before any API call", async () => {
  const p = page({ url: recoveryUrl, scrubFails: true });
  await flush(); assert.equal(p.state(), "unavailable"); assert.equal(p.calls.length, 0);
  assert(p.node("retryCheck").hidden); assert(p.node("passwordFields").disabled);
});

test("email requires consent and an explicit submit; double submits cannot send another request", async () => {
  const pending = deferred();
  const p = page({ fetchResult: ({ options }) => options.method === "GET" ? response(config) : pending.promise });
  await flush(); assert.equal(p.state(), "request"); assert.equal(p.calls.length, 1);
  assert(p.event("requestForm", "submit").defaultPrevented); assert.equal(p.calls.length, 1);
  assert.equal(p.document.activeElement, p.node("requestConsent"));
  p.node("requestConsent").checked = true; p.event("requestConsent", "change");
  assert(!p.node("requestSubmit").disabled);
  p.event("requestForm", "submit"); p.event("requestForm", "submit");
  assert.equal(p.state(), "requesting"); assert(p.node("requestFields").disabled); assert.equal(p.calls.length, 2);
  assert.deepEqual(JSON.parse(p.calls[1].options.body), { action: "request" });
  assert.equal(p.calls[1].options.headers.Authorization, undefined);
  pending.resolve(response({ ok: true, requested: true })); await flush();
  assert.equal(p.state(), "requested"); assert.match(p.node("requestedMessage").textContent, /Delivery has not been confirmed/);
  p.event("requestAnother", "click"); assert.equal(p.state(), "request"); assert(!p.node("requestConsent").checked);
  assert.equal(p.calls.length, 2); assertSafeTransport(p.calls);
});

test("only a fragment token is used, and password fields remain disabled until server validation", async () => {
  const pending = deferred();
  const p = page({ url: recoveryUrl, fetchResult: (_, number) => number === 1 ? response(config) : pending.promise });
  await flush();
  assert.equal(p.state(), "loading"); assert(p.node("passwordFields").disabled); assert(p.node("passwordForm").hidden);
  assert.deepEqual(p.history, ["/admin-recovery.html"]); assert.equal(p.url().href, origin + "/admin-recovery.html");
  assert.equal(p.calls[0].options.headers.Authorization, undefined);
  assert.equal(p.calls[1].options.headers.Authorization, "Bearer " + access);
  assert(p.calls.every(call => call.options.method === "GET"));
  pending.resolve(response(session)); await flush();
  assert.equal(p.state(), "recovery"); assert(!p.node("passwordFields").disabled);
  assert(!p.text().includes(access)); assert(!p.text().includes(refresh)); assert.equal(p.logs.length, 0);
  assertSafeTransport(p.calls);
});

test("type=recovery, query tokens, duplicate tokens and error fragments do not authorize password changes", async () => {
  for (const suffix of ["#type=recovery", "?access_token=" + access + "&type=recovery",
    "#type=recovery&access_token=" + access + "&access_token=" + access,
    "#type=signup&access_token=" + access,
    "#type=recovery&access_token=" + access + "&error=access_denied"]) {
    const p = page({ url: origin + "/admin-recovery.html" + suffix }); await flush();
    assert.equal(p.state(), "expired"); assert(p.node("passwordFields").disabled);
    p.fill("SyntheticPassword99"); p.event("passwordForm", "submit"); await flush();
    assert.equal(p.calls.length, 1); assert.equal(p.calls[0].options.headers.Authorization, undefined);
  }
});

test("an expired token is cleared before an explicit new email request", async () => {
  const p = page({ url: recoveryUrl, fetchResult: (_, number) => number === 1 ? response(config) : response({ code: "session_invalid", error: access }, 401) });
  await flush(); assert.equal(p.state(), "expired"); assert(!p.text().includes(access));
  p.event("newRecovery", "click"); assert.equal(p.state(), "request"); assert.equal(p.calls.length, 2);
  p.node("requestConsent").checked = true; p.event("requestForm", "submit"); await flush();
  assert.equal(p.calls[2].options.headers.Authorization, undefined);
  assert.deepEqual(JSON.parse(p.calls[2].options.body), { action: "request" });
});

test("denied administrator access or additional verification stops recovery without suggesting a new email", async () => {
  for (const onUpdate of [false, true]) {
    const p = page({ url: recoveryUrl, fetchResult: ({ options }, number) => {
      if ((!onUpdate && number === 2) || options.method === "POST") return response({ code: "access_denied", error: "PRIVATE_AAL_DETAILS" }, 403);
      return response(number === 1 ? config : session);
    } });
    await flush();
    if (onUpdate) { p.fill("SyntheticPassword99"); p.event("passwordForm", "submit"); await flush(); }
    assert.equal(p.state(), "unavailable"); assert(p.node("passwordFields").disabled); assert(p.node("requestFields").disabled);
    assert.equal(p.node("newPassword").value, ""); assert(!p.text().includes("PRIVATE_AAL_DETAILS"));
    assert.match(p.node("unavailableMessage").textContent, /account verification/);
    const before = p.calls.length; p.event("newRecovery", "click"); p.event("passwordForm", "submit"); await flush();
    assert.equal(p.calls.length, before); assert.equal(p.state(), "unavailable");
  }
});

test("passwords must match and meet bounds; successful update clears fields and never auto signs in", async () => {
  const p = page({ url: recoveryUrl, fetchResult: ({ options }, number) => options.method === "POST" ?
    response({ ok: true, redirectPath: "/admin.html" }) : response(number === 1 ? config : session) });
  await flush();
  for (const [password, confirmation, field] of [["short", "short", "newPassword"], ["x".repeat(257), "x".repeat(257), "newPassword"], ["SyntheticPassword99", "OtherPassword99", "confirmPassword"]]) {
    p.fill(password, confirmation); p.event("passwordForm", "submit"); await flush();
    assert.equal(p.calls.length, 2); assert.equal(p.document.activeElement, p.node(field));
  }
  p.fill("SyntheticPassword99"); p.event("passwordForm", "submit");
  assert.equal(p.state(), "saving"); assert.equal(p.node("newPassword").value, ""); assert.equal(p.node("confirmPassword").value, "");
  assert.equal(p.calls[2].options.headers.Authorization, "Bearer " + access);
  assert.deepEqual(JSON.parse(p.calls[2].options.body), { action: "complete", password: "SyntheticPassword99" });
  await flush(); assert.equal(p.state(), "success"); assert.equal(p.url().pathname, "/admin-recovery.html");
  p.fill("AnotherPassword99"); p.event("passwordForm", "submit"); await flush(); assert.equal(p.calls.length, 3);
  assert(p.node("passwordFields").disabled); assert(!p.text().includes(access)); assertSafeTransport(p.calls);
});

test("an invalid session during update leaves no password or usable token in the page", async () => {
  const p = page({ url: recoveryUrl, fetchResult: ({ options }, number) => options.method === "POST" ?
    response({ code: "session_invalid", error: "PRIVATE_UPSTREAM_DETAILS" }, 401) : response(number === 1 ? config : session) });
  await flush(); p.fill("SyntheticPassword99"); p.event("passwordForm", "submit"); await flush();
  assert.equal(p.state(), "expired"); assert.equal(p.node("newPassword").value, ""); assert.equal(p.node("confirmPassword").value, "");
  assert(!p.text().includes("PRIVATE_UPSTREAM_DETAILS"));
  p.event("newRecovery", "click"); p.node("requestConsent").checked = true; p.event("requestForm", "submit"); await flush();
  assert.equal(p.calls[3].options.headers.Authorization, undefined);
});

test("uncertain POST outcomes are never automatically retried or reported as confirmed success", async () => {
  for (const recover of [false, true]) {
    const p = page({ url: recover ? recoveryUrl : undefined, fetchResult: ({ options }, number) => {
      if (options.method === "POST") throw Error("PRIVATE_TIMEOUT_DETAILS");
      return response(number === 1 ? config : session);
    } });
    await flush();
    if (recover) { p.fill("SyntheticPassword99"); p.event("passwordForm", "submit"); }
    else { p.node("requestConsent").checked = true; p.event("requestForm", "submit"); }
    await flush(); assert.equal(p.calls.filter(call => call.options.method === "POST").length, 1);
    assert.equal(p.state(), recover ? "expired" : "requested"); assert(!p.text().includes("PRIVATE_TIMEOUT_DETAILS"));
    assert.match(recover ? p.node("expiredMessage").textContent : p.node("requestedMessage").textContent, /could not confirm/);
  }
});

test("a known email delivery rejection shows an error and requires new consent before retrying", async () => {
  const p = page({ fetchResult: ({ options }) => options.method === "GET" ? response(config) :
    response({ code: "email_delivery_unavailable", error: "PRIVATE_PROVIDER_DETAILS" }, 503) });
  await flush(); p.node("requestConsent").checked = true; p.event("requestForm", "submit"); await flush();
  assert.equal(p.state(), "request"); assert(p.node("requestedView").hidden);
  assert.match(p.node("requestError").textContent, /could not be sent/);
  assert(!p.node("requestConsent").checked); assert(p.node("requestSubmit").disabled);
  p.event("requestForm", "submit"); await flush(); assert.equal(p.calls.length, 2);
  assert(!p.text().includes("PRIVATE_PROVIDER_DETAILS"));
});

test("loss of environment enablement during token validation keeps every form disabled", async () => {
  const p = page({ url: recoveryUrl, fetchResult: (_, number) => response(number === 1 ? config : { ...session, enabled: false }) });
  await flush(); assert.equal(p.state(), "unavailable"); assert(p.node("requestFields").disabled); assert(p.node("passwordFields").disabled);
  p.fill("SyntheticPassword99"); p.event("passwordForm", "submit"); p.event("newRecovery", "click");
  await flush(); assert.equal(p.calls.length, 2); assert.equal(p.state(), "unavailable");
});

test("pagehide aborts in-flight work and clears secrets; restoring a cached page cannot reuse the token", async () => {
  const pending = deferred();
  const p = page({ url: recoveryUrl, fetchResult: ({ options }, number) => options.method === "POST" ? pending.promise : response(number === 2 ? session : config) });
  await flush(); p.fill("SyntheticPassword99"); p.event("passwordForm", "submit");
  p.lifecycle("pagehide");
  assert(p.calls[2].options.signal.aborted); assert.equal(p.node("newPassword").value, ""); assert.equal(p.node("confirmPassword").value, "");
  assert.equal(p.state(), "unavailable");
  pending.resolve(response({ ok: true, redirectPath: "/admin.html" })); await flush();
  assert.equal(p.state(), "unavailable", "A late result cannot reactivate a departed page");
  p.lifecycle("pageshow", true); await flush(); assert.equal(p.state(), "expired");
  assert.equal(p.calls[3].options.method, "GET"); assert.equal(p.calls[3].options.headers.Authorization, undefined);
  assert.equal(p.calls.filter(call => call.options.method === "POST").length, 1);
});

test("the isolated page loads no third-party assets and has no-store, framing and form-fallback protection", () => {
  const configuration = JSON.parse(fs.readFileSync(path.join(root, "vercel.json"), "utf8"));
  const headersFor = source => Object.fromEntries(configuration.headers.find(rule => rule.source === source).headers.map(header => [header.key.toLowerCase(), header.value]));
  const headers = headersFor("/admin-recovery.html");
  assert.match(headers["cache-control"], /no-store/); assert.equal(headers["vercel-cdn-cache-control"], "no-store");
  assert.equal(headers["referrer-policy"], "no-referrer"); assert.equal(headers["x-frame-options"], "DENY");
  assert.match(headers["content-security-policy"], /script-src 'self'/); assert.match(headers["content-security-policy"], /style-src 'self'/);
  assert.match(headers["content-security-policy"], /connect-src 'self'/); assert.match(headers["content-security-policy"], /frame-ancestors 'none'/);
  assert.match(headers["content-security-policy"], /form-action 'none'/); assert(!headers["content-security-policy"].includes("unsafe-inline"));
  for (const asset of ["/assets/admin-recovery.js", "/assets/admin-recovery.css"]) assert.match(headersFor(asset)["cache-control"], /no-store/);
  const resources = [...html.matchAll(/<(?:script|link|img|iframe)\b[^>]*\b(?:src|href)="([^"]+)"/g)].map(item => item[1]);
  assert.deepEqual(resources, ["/assets/admin-recovery.js", "/assets/admin-recovery.css"]);
  for (const destination of [...html.matchAll(/<a\b[^>]*href="([^"]+)"/g)].map(item => item[1])) assert.equal(destination, "/admin.html");
  assert.match(html, /id="newPassword"[^>]*autocomplete="new-password"/); assert.match(html, /id="confirmPassword"[^>]*autocomplete="new-password"/);
});
