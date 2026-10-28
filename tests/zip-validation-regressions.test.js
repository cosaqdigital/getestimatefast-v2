"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const root=path.join(__dirname,"..");
const read=file=>fs.readFileSync(path.join(root,file),"utf8");

test("customer lead intake validates ZIP against Florida matching data",()=>{
 const src=read("api/lead.js");
 assert(src.includes('const { recognizedFloridaZip } = require("./_lib/florida-matching");'));
 assert(src.includes('!recognizedFloridaZip(zip)'));
});

test("direct profile leads validate ZIP against Florida matching data",()=>{
 const src=read("api/_lib/profile-origin.js");
 assert(src.includes('const {recognizedFloridaZip}=require("./florida-matching");'));
 assert(src.includes('if(!recognizedFloridaZip(fields.zip))'));
});

test("contractor profile cannot activate with an unrecognized or out-of-state ZIP",()=>{
 const src=read("api/contractor/profile.js");
 assert(src.includes('const {recognizedFloridaZip}=require("../_lib/florida-matching");'));
 assert(src.includes('state!=="FL"||!recognizedFloridaZip(zip)'));
});
