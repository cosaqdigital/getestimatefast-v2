"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const html=fs.readFileSync(path.join(__dirname,"..","index.html"),"utf8");

test("home footer includes discreet admin access link",()=>{
  assert.match(html,/<footer[^>]*>[\s\S]*href="\/admin\.html">Admin Access<\/a>[\s\S]*<\/footer>/);
});
