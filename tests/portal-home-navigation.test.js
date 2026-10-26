"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const read=p=>fs.readFileSync(path.join(__dirname,"..",p),"utf8");

test("admin and professional portals provide a home navigation link",()=>{
  assert.match(read("admin.html"),/href="\/index\.html">Back to Home<\/a>/);
  assert.match(read("contractor-portal.html"),/href="\/index\.html">Back to Home<\/a>/);
});
