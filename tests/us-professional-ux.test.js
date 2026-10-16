"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const read=file=>fs.readFileSync(path.join(__dirname,"..",file),"utf8");
test("Independent professional UX loads after existing code",()=>{
 const h=read("contractor-portal.html");
 assert(h.indexOf("marketplace-portal.js")<h.indexOf("contractor-ux.js"));
 assert(h.includes("contractor-ux.css"));
});
test("Signed-in users never see account creation",()=>{
 assert.match(read("assets/contractor-portal.js"),/el\("register"\)\.hidden=b\|\|/);
});
test("Guided profile is two steps and preserves public profile privacy",()=>{
 const src=read("assets/contractor-ux.js");
 for(const s of ["Step 1 of 2","Step 2 of 2","Select the services","publicProfileForm","Your phone and email are not shown"])assert(src.includes(s)||s==="Select the services"&&src.includes("Choose the services"));
 assert.match(src,/step2\.disabled=step!==2/);
 assert.match(src,/opt\.selected=input\.checked/);
});
test("One section at a time, all modules available",()=>{
 const src=read("assets/contractor-ux.js");
 for(const name of ["contractorDashboard","opportunityPanel","publicProfilePanel","accountSettingsPanel","walletPanel","purchasePanel"])assert(src.includes(name));
 assert.match(src,/section\.hidden=key!==dest/);
});
test("Preview blocks public signup and financial transactions",()=>{
 assert.match(read("api/contractor/signup.js"),/GETESTIMATEFAST_ISOLATED_BACKEND/);
 assert.match(read("api/_lib/marketplace-access.js"),/blockPayments/);
 assert.equal(JSON.parse(read("vercel.json")).git.deploymentEnabled["feat/us-admin-overview-20261015"],false);
});
