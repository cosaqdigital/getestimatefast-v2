"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const crypto=require("node:crypto");
const {normalizeEmail,validEmail,identityHash,createVerificationToken,hashVerificationToken}=require("../api/_lib/review-email");

test("review email normalization and validation",()=>{
  assert.equal(normalizeEmail(" Customer@Example.COM "),"customer@example.com");
  assert.equal(validEmail("customer@example.com"),true);
  assert.equal(validEmail("not-an-email"),false);
});

test("review identity hash is stable and secret-bound",()=>{
  const a=identityHash("Customer@Example.com","a".repeat(32));
  const b=identityHash(" customer@example.com ","a".repeat(32));
  const c=identityHash("customer@example.com","b".repeat(32));
  assert.match(a,/^[a-f0-9]{64}$/);
  assert.equal(a,b);
  assert.notEqual(a,c);
});

test("review verification tokens are random and hashable",()=>{
  const first=createVerificationToken(),second=createVerificationToken();
  assert.match(first.token,/^[a-f0-9]{64}$/);
  assert.match(first.tokenHash,/^[a-f0-9]{64}$/);
  assert.equal(hashVerificationToken(first.token),first.tokenHash);
  assert.notEqual(first.token,second.token);
  assert.equal(hashVerificationToken("bad"),null);
});
