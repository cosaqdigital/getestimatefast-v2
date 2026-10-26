"use strict";

const crypto = require("node:crypto");

const SUPABASE_PROJECT_URL = "https://wedsjubkttygxtpkopfj.supabase.co";
const MAX_BODY_BYTES = 65536;
const MAX_SKEW_SECONDS = 300;

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.end(JSON.stringify(body));
}

function getHeader(headers, name) {
  const wanted = name.toLowerCase();
  for (const [key, value] of Object.entries(headers || {})) {
    if (String(key).toLowerCase() === wanted) return Array.isArray(value) ? value[0] : value;
  }
  return "";
}

async function readRaw(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) throw new Error("Request too large");
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

function publicKeyObject(publicKeyB64) {
  const raw = Buffer.from(String(publicKeyB64 || "").trim(), "base64");
  if (raw.length !== 32) throw new Error("Invalid public key");
  const prefix = Buffer.from("302a300506032b6570032100", "hex");
  return crypto.createPublicKey({
    key: Buffer.concat([prefix, raw]),
    format: "der",
    type: "spki"
  });
}

function verifySignature(rawBody, headers, publicKeyB64) {
  const signature = Buffer.from(String(getHeader(headers, "telnyx-signature-ed25519") || ""), "base64");
  const timestamp = String(getHeader(headers, "telnyx-timestamp") || "");
  if (signature.length !== 64 || !/^\d{10}$/.test(timestamp)) throw new Error("Invalid signature headers");
  const signedAt = Number(timestamp);
  const now = Math.floor(Date.now() / 1000);
  if (!Number.isSafeInteger(signedAt) || Math.abs(now - signedAt) > MAX_SKEW_SECONDS) throw new Error("Stale webhook");
  const message = Buffer.concat([Buffer.from(timestamp + "|", "utf8"), rawBody]);
  if (!crypto.verify(null, message, publicKeyObject(publicKeyB64), signature)) {
    throw new Error("Invalid signature");
  }
}

function normalizeUsPhone(value) {
  const digits = String(value || "").replace(/\D/g, "");
  if (digits.length === 10) return "+1" + digits;
  if (digits.length === 11 && digits.startsWith("1")) return "+" + digits;
  return "";
}

function keyword(text) {
  const value = String(text || "").trim().toUpperCase();
  if (["STOP", "UNSUBSCRIBE", "CANCEL", "END", "QUIT"].includes(value)) return "STOP";
  if (["START", "YES", "UNSTOP"].includes(value)) return "START";
  if (value === "HELP") return "HELP";
  return "OTHER";
}

function supabaseHeaders(secret, extra = {}) {
  return {
    apikey: secret,
    ...(String(secret).startsWith("sb_secret_") ? {} : { Authorization: "Bearer " + secret }),
    "Content-Type": "application/json",
    ...extra
  };
}

async function db(path, options = {}) {
  const secret = String(process.env.GETESTIMATEFAST_SUPABASE_SECRET_KEY || "").trim();
  if (!secret) throw new Error("Supabase secret missing");
  const response = await fetch(SUPABASE_PROJECT_URL + "/rest/v1/" + path, {
    ...options,
    headers: supabaseHeaders(secret, options.headers || {}),
    redirect: "error",
    signal: AbortSignal.timeout(10000)
  });
  if (!response.ok) throw new Error("Database returned " + response.status);
  if (response.status === 204) return null;
  return response.json();
}

async function recordConsent(event) {
  await db("sms_consent_events?on_conflict=provider_event_id", {
    method: "POST",
    headers: { Prefer: "resolution=ignore-duplicates,return=minimal" },
    body: JSON.stringify(event)
  });
}

async function recordDelivery(event) {
  await db("sms_delivery_events?on_conflict=provider_event_id", {
    method: "POST",
    headers: { Prefer: "resolution=ignore-duplicates,return=minimal" },
    body: JSON.stringify(event)
  });
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return json(res, 405, { error: "Method not allowed" });
  }

  try {
    const publicKey = String(process.env.GETESTIMATEFAST_TELNYX_PUBLIC_KEY || "").trim();
    if (!publicKey) return json(res, 503, { accepted: false, live_sms_enabled: false });

    const raw = await readRaw(req);
    try {
      verifySignature(raw, req.headers, publicKey);
    } catch {
      return json(res, 401, { error: "Invalid webhook signature" });
    }

    let body;
    try {
      body = JSON.parse(raw.toString("utf8"));
    } catch {
      return json(res, 400, { error: "Invalid JSON" });
    }

    const data = body && body.data;
    if (!data || typeof data !== "object" || !data.payload || typeof data.payload !== "object") {
      return json(res, 400, { error: "Invalid Telnyx webhook" });
    }

    const eventId = String(data.id || "");
    const eventType = String(data.event_type || "");
    const occurredAt = String(data.occurred_at || "");
    if (!eventId || !eventType || Number.isNaN(Date.parse(occurredAt))) {
      return json(res, 400, { error: "Invalid Telnyx event" });
    }

    const providerEventId = "telnyx:" + eventId;

    if (eventType === "message.sent" || eventType === "message.finalized") {
      const messageId = String(data.payload.id || "");
      if (!messageId) return json(res, 400, { error: "Invalid message id" });

      const duplicate = await db(
        "sms_delivery_events?provider_event_id=eq." + encodeURIComponent(providerEventId) + "&select=id&limit=1"
      );
      if (duplicate.length) return json(res, 200, { accepted: true, duplicate: true, messages_sent: 0 });

      const status =
        typeof data.payload.to?.[0]?.status === "string"
          ? data.payload.to[0].status
          : typeof data.payload.status === "string"
            ? data.payload.status
            : null;
      const errorCodes = Array.isArray(data.payload.errors)
        ? data.payload.errors.slice(0, 10).map((item) => String(item?.code || item || "").slice(0, 80)).filter(Boolean)
        : [];

      await recordDelivery({
        provider: "telnyx",
        provider_event_id: providerEventId,
        message_id: messageId,
        event_type: eventType,
        delivery_status: status,
        error_codes: errorCodes,
        provider_timestamp: new Date(occurredAt).toISOString()
      });

      return json(res, 200, { accepted: true, delivery_recorded: true, messages_sent: 0 });
    }

    if (eventType !== "message.received") {
      return json(res, 200, { accepted: true, ignored: true, messages_sent: 0 });
    }

    const from = normalizeUsPhone(data.payload.from?.phone_number || "");
    const eventKeyword = keyword(data.payload.text);
    if (!from) return json(res, 400, { error: "Invalid inbound phone" });

    const duplicate = await db(
      "sms_consent_events?provider_event_id=eq." + encodeURIComponent(providerEventId) + "&select=id&limit=1"
    );
    if (duplicate.length) return json(res, 200, { accepted: true, duplicate: true, messages_sent: 0 });

    const profiles = await db(
      "contractor_profiles?sms_phone_e164=eq." + encodeURIComponent(from) + "&select=user_id,sms_opt_in&limit=2"
    );
    if (profiles.length > 1) throw new Error("Ambiguous contractor phone");

    const profile = profiles[0] || null;
    const base = {
      provider: "telnyx",
      provider_event_id: providerEventId,
      contractor_user_id: profile ? profile.user_id : null,
      event_type: eventKeyword,
      provider_timestamp: new Date(occurredAt).toISOString(),
      response_sent: false
    };

    if (!profile) {
      await recordConsent({ ...base, action: "UNKNOWN_CONTRACTOR" });
      return json(res, 200, { accepted: true, matched: false, messages_sent: 0 });
    }

    if (eventKeyword === "STOP") {
      const now = new Date().toISOString();
      await db("contractor_profiles?user_id=eq." + encodeURIComponent(profile.user_id), {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ sms_opt_in: false, sms_opt_in_at: null, sms_opt_out_at: now })
      });
      await recordConsent({ ...base, action: "OPTED_OUT" });
      return json(res, 200, { accepted: true, matched: true, opted_out: true, messages_sent: 0 });
    }

    if (eventKeyword === "START") {
      const now = new Date().toISOString();
      await db("contractor_profiles?user_id=eq." + encodeURIComponent(profile.user_id), {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ sms_opt_in: true, sms_opt_in_at: now, sms_opt_out_at: null })
      });
      await recordConsent({ ...base, action: "OPTED_IN" });
      return json(res, 200, { accepted: true, matched: true, opted_in: true, messages_sent: 0 });
    }

    if (eventKeyword === "HELP") {
      await recordConsent({ ...base, action: "HELP_RECORDED" });
      return json(res, 200, { accepted: true, matched: true, help_recorded: true, messages_sent: 0 });
    }

    await recordConsent({ ...base, action: "IGNORED" });
    return json(res, 200, { accepted: true, matched: true, ignored: true, messages_sent: 0 });
  } catch {
    console.error("GetEstimateFast Telnyx webhook failed.");
    return json(res, 503, { error: "Service temporarily unavailable" });
  }
};
