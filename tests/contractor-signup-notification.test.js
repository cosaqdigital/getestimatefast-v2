"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");

test("contractor signup notification uses dedicated contractors routing",()=>{
  const src=require("node:fs").readFileSync(require("node:path").join(__dirname,"../api/contractor/signup.js"),"utf8");
  assert.match(src,/CONTRACTOR_NOTIFICATION_TO_EMAIL/);
  assert.match(src,/contractors@getestimatefast\.com/);
  assert.match(src,/New professional registration/);
  assert.doesNotMatch(src,/password.*RESEND|RESEND.*password/i);
});
