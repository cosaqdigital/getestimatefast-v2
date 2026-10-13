"use strict";
const crypto = require("node:crypto");
const { PROJECT, TEAM } = require("./stripe-authorized-deployments");
const ISSUERS = Object.freeze(["https://oidc.vercel.com", "https://oidc.vercel.com/get-estimate-fast"]);
const GROUPS = Object.freeze({
  structure: ["TOKEN_TYPE", "TOKEN_LENGTH", "TOKEN_FORMAT", "HEADER_JSON", "CLAIMS_JSON", "HEADER_OBJECT", "CLAIMS_OBJECT", "ALGORITHM", "TYPE", "KEY_ID", "UNTRUSTED_HEADER"],
  identity: ["ISSUER", "AUDIENCE", "TEAM_ID", "TEAM_SLUG", "PROJECT_ID", "PROJECT_NAME", "SUBJECT"],
  authorization: ["ENVIRONMENT"],
  temporal: ["CLOCK", "EXP_TYPE", "NBF_TYPE", "IAT_TYPE", "EXP_MARGIN", "NOT_YET_VALID", "ISSUED_IN_FUTURE", "TIME_ORDER"],
  key_source: ["JWKS_UNAVAILABLE", "JWKS_SHAPE", "KEY_NOT_FOUND", "KEY_AMBIGUOUS", "KEY_METADATA", "KEY_INVALID", "SOURCE_ISSUER", "SOURCE_TIMEOUT", "SOURCE_NETWORK", "SOURCE_HTTP", "SOURCE_REDIRECT", "SOURCE_LIMIT", "SOURCE_JSON", "DISCOVERY_ISSUER", "DISCOVERY_URI", "ACQUISITION", "INTERNAL"],
  cryptographic: ["SIGNATURE_INVALID", "SIGNATURE_ERROR"]
});
const stages = new Map(Object.entries(GROUPS).flatMap(([stage, codes]) => codes.map(code => ["OIDC_" + code, stage])));
class OidcValidationError extends Error {
  constructor(code) {
    const safe = stages.has(code) ? code : "OIDC_INTERNAL";
    super("OIDC validation failed: " + safe); this.name = "OidcValidationError"; this.code = safe; this.stage = stages.get(safe);
  }
}
const fail = code => { throw new OidcValidationError("OIDC_" + code); };
function diagnosticCode(error) { return error instanceof OidcValidationError && stages.has(error.code) ? error.code : "OIDC_INTERNAL"; }
const object = value => value !== null && typeof value === "object" && !Array.isArray(value);
function parse(segment, code) {
  let bytes;
  try { bytes = Buffer.from(segment, "base64url"); return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)); }
  catch { fail(code); } finally { bytes?.fill(0); }
}
function times(c, now) {
  const seconds = Math.floor(now() / 1000);
  if (!Number.isFinite(seconds)) fail("CLOCK");
  if (!Number.isSafeInteger(c.exp)) fail("EXP_TYPE");
  if (!Number.isSafeInteger(c.nbf)) fail("NBF_TYPE");
  if (!Number.isSafeInteger(c.iat)) fail("IAT_TYPE");
  if (c.exp <= c.iat || c.exp <= c.nbf) fail("TIME_ORDER");
  if (c.exp <= seconds + 30) fail("EXP_MARGIN");
  if (c.nbf > seconds) fail("NOT_YET_VALID");
  if (c.iat > seconds) fail("ISSUED_IN_FUTURE");
}
function createOidcVerifier({ loadJwks, now = () => Date.now() }) {
  return async token => {
    try {
      if (typeof token !== "string") fail("TOKEN_TYPE");
      if (token.length > 16384) fail("TOKEN_LENGTH");
      if (!/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token)) fail("TOKEN_FORMAT");
      const [h, p, s] = token.split(".");
      const header = parse(h, "HEADER_JSON"), c = parse(p, "CLAIMS_JSON");
      if (!object(header)) fail("HEADER_OBJECT");
      if (!object(c)) fail("CLAIMS_OBJECT");
      if (header.alg !== "RS256") fail("ALGORITHM");
      if (header.typ !== "JWT") fail("TYPE");
      if (typeof header.kid !== "string" || !header.kid || header.kid.length > 256) fail("KEY_ID");
      if (["jku", "jwk", "crit", "x5u", "b64"].some(k => Object.hasOwn(header, k))) fail("UNTRUSTED_HEADER");
      if (!ISSUERS.includes(c.iss)) fail("ISSUER");
      if (c.aud !== "https://vercel.com/get-estimate-fast") fail("AUDIENCE");
      if (c.owner_id !== TEAM) fail("TEAM_ID");
      if (c.owner !== "get-estimate-fast") fail("TEAM_SLUG");
      if (c.project_id !== PROJECT) fail("PROJECT_ID");
      if (c.project !== "getestimatefast-v2") fail("PROJECT_NAME");
      if (!["development", "preview"].includes(c.environment)) fail("ENVIRONMENT");
      if (c.sub !== "owner:get-estimate-fast:project:getestimatefast-v2:environment:" + c.environment) fail("SUBJECT");
      times(c, now);
      let jwks;
      try { jwks = await loadJwks(c.iss); } catch (e) { if (e instanceof OidcValidationError) throw e; fail("JWKS_UNAVAILABLE"); }
      if (!object(jwks) || !Array.isArray(jwks.keys) || jwks.keys.length > 32 || jwks.keys.some(k => !object(k))) fail("JWKS_SHAPE");
      const candidates = jwks.keys.filter(k => k.kid === header.kid);
      if (!candidates.length) fail("KEY_NOT_FOUND");
      if (candidates.length !== 1) fail("KEY_AMBIGUOUS");
      const key = candidates[0];
      if (key.kty !== "RSA" || (Object.hasOwn(key, "alg") && key.alg !== "RS256") || (Object.hasOwn(key, "use") && key.use !== "sig") || Object.hasOwn(key, "d")) fail("KEY_METADATA");
      let publicKey; try { publicKey = crypto.createPublicKey({ key, format: "jwk" }); } catch { fail("KEY_INVALID"); }
      let valid; try { valid = crypto.verify("RSA-SHA256", Buffer.from(h + "." + p), publicKey, Buffer.from(s, "base64url")); } catch { fail("SIGNATURE_ERROR"); }
      if (!valid) fail("SIGNATURE_INVALID");
      times(c, now); // Recheck after a potentially slow key lookup.
      return c; // Successful cryptographic identity, not proof of hosted Trusted Sources acceptance.
    } catch (e) { throw new OidcValidationError(diagnosticCode(e)); }
  };
}
function createOidcJwksLoader({ transport, timeoutMs = 10000 }) {
  if (typeof transport !== "function" || !Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 10000) fail("INTERNAL");
  const json = async url => {
    const controller = new AbortController(); let timer;
    try {
      return await Promise.race([(async () => {
        let r; try { r = await transport(url, { method: "GET", redirect: "error", signal: controller.signal }); } catch { fail("SOURCE_NETWORK"); }
        if (r?.redirected || [301, 302, 303, 307, 308].includes(r?.status)) fail("SOURCE_REDIRECT");
        if (r?.status !== 200) fail("SOURCE_HTTP");
        let size = 0, chunks = [], joined;
        try {
          for await (const chunk of r.body) { size += chunk.length; if (size > 65536) fail("SOURCE_LIMIT"); chunks.push(Buffer.from(chunk)); }
          joined = Buffer.concat(chunks); try { return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(joined)); } catch { fail("SOURCE_JSON"); }
        } catch (e) { if (e instanceof OidcValidationError) throw e; fail("SOURCE_NETWORK"); }
        finally { chunks.forEach(b => b.fill(0)); joined?.fill(0); }
      })(), new Promise((_, reject) => { timer = setTimeout(() => { controller.abort(); reject(new OidcValidationError("OIDC_SOURCE_TIMEOUT")); }, timeoutMs); })]);
    } finally { clearTimeout(timer); }
  };
  return async issuer => {
    if (!ISSUERS.includes(issuer)) fail("SOURCE_ISSUER");
    const discovery = await json(issuer + "/.well-known/openid-configuration");
    if (!object(discovery) || discovery.issuer !== issuer) fail("DISCOVERY_ISSUER");
    let u; try { u = new URL(discovery.jwks_uri); } catch { fail("DISCOVERY_URI"); }
    if (u.origin !== "https://oidc.vercel.com" || u.username || u.password || u.search || u.hash || !u.pathname.includes("/.well-known/")) fail("DISCOVERY_URI");
    const jwks = await json(u.href);
    if (!object(jwks) || !Array.isArray(jwks.keys) || jwks.keys.length > 32 || jwks.keys.some(k => !object(k))) fail("JWKS_SHAPE");
    return jwks;
  };
}
function createPublicKeyCache({ load, now = () => Date.now(), ttlMs = 60000 }) {
  if (typeof load !== "function" || !Number.isInteger(ttlMs) || ttlMs < 1 || ttlMs > 60000) fail("INTERNAL");
  const entries = new Map(), pending = new Map(); let disposed = false;
  const get = async issuer => {
    if (disposed || !ISSUERS.includes(issuer)) fail("SOURCE_ISSUER");
    const cached = entries.get(issuer);
    if (cached && cached.until > now() && cached.from <= now()) return cached.value;
    if (!pending.has(issuer)) {
      entries.delete(issuer);
      const operation = Promise.resolve().then(() => load(issuer)).then(value => {
        if (disposed || !object(value) || !Array.isArray(value.keys) || value.keys.length > 32 || value.keys.some(k => !object(k) || Object.hasOwn(k, "d"))) fail("JWKS_SHAPE");
        const safe = Object.freeze({ keys: Object.freeze(value.keys.map(k => Object.freeze({ ...k }))) });
        entries.set(issuer, { value: safe, from: now(), until: now() + ttlMs }); return safe;
      }).catch(error => { throw new OidcValidationError(error instanceof OidcValidationError ? diagnosticCode(error) : "OIDC_JWKS_UNAVAILABLE"); }).finally(() => pending.delete(issuer));
      pending.set(issuer, operation);
    }
    return pending.get(issuer);
  };
  return { get, dispose() { disposed = true; entries.clear(); } };
}
module.exports = { createOidcVerifier, createOidcJwksLoader, createPublicKeyCache, OidcValidationError, diagnosticCode, DIAGNOSTIC_CODES: Object.freeze([...stages.keys()]) };
