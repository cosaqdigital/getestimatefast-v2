"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const read=f=>fs.readFileSync(path.join(__dirname,"..",f),"utf8");

test("privacy policy contains 10DLC mobile data protections",()=>{
  const h=read("privacy.html");
  for(const s of [
    "privacy-2026-10-26",
    "Message frequency varies",
    "Message and data rates may apply",
    "replying STOP",
    "Reply HELP",
    "does not sell or rent mobile phone numbers",
    "will not be shared with third parties or affiliates for their own marketing or promotional purposes"
  ]) assert(h.includes(s),s);
});

test("terms disclose SMS program and opt-out mechanics",()=>{
  const h=read("terms.html");
  for(const s of [
    "terms-2026-10-26",
    "Consent to receive SMS is optional",
    "not a condition of purchase",
    "Message frequency varies",
    "Message and data rates may apply",
    "reply STOP",
    "HELP for help"
  ]) assert(h.includes(s),s);
});

test("professional portal presents separate explicit SMS consent with legal links",()=>{
  const h=read("contractor-portal.html");
  assert(h.includes('id="smsOptIn"'));
  assert(h.includes("matching job opportunities and account-related support"));
  assert(h.includes("Consent is not a condition of purchase"));
  assert(h.includes('href="/privacy.html"'));
  assert(h.includes('href="/terms.html"'));
  assert(h.includes("Reply STOP to opt out or HELP for help"));
});
