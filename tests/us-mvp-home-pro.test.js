"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const root=path.resolve(__dirname,".."),read=p=>fs.readFileSync(path.join(root,p),"utf8");
test("home presents free customer request and a real service picker",()=>{
const h=read("index.html");
assert.match(h,/<h1>Need a service done\?[\s\S]*Find local pros\./);
assert.match(h,/href="#find-your-service"[^>]*>Get My Free Estimate<\/a>/);
assert.match(h,/data-service-starter-input/);
assert.match(h,/href="services.html"[^>]*>Explore All Services<\/a>/);
assert.match(h,/Free to request/);
assert.match(h,/don't guarantee an estimate or hire/);
assert.match(h,/rel="canonical" href="https:\/\/www\.getestimatefast\.com\/"/);
});
test("professional funnel has primary signup and login destinations",()=>{
const h=read("index.html"),p=read("for-professionals.html");
assert.match(h,/href="for-professionals.html"[^>]*data-cta="for-professionals"/);
assert.match(h,/id="for-local-pros"/);
assert.match(p,/Create My Free Profile/);
assert.match(p,/contractor-portal\.html\?signup=1/);
assert.match(p,/contact purchases remain disabled/);
assert.match(p,/name="robots" content="noindex,follow"/);
assert.match(p,/assets\/pro-landing\.css/);
});
test("registration link reveals signup form in the American portal",()=>{
const js=read("assets/marketplace-portal.js");
assert.match(read("contractor-portal.html"),/id="register" hidden/);
assert.match(js,/new URLSearchParams\(window\.location\.search\)\.get\("signup"\)==="1"/);
assert.match(js,/el\("register"\)\.hidden=false/);
assert.match(js,/portal\.api\("signup","POST"/);
});
test("US-only routes and draft branch are isolated",()=>{
for(const file of ["index.html","for-professionals.html","assets/marketplace-portal.js"]){
assert.doesNotMatch(read(file),/orcamentobrasil\.com|cosaqdigital\/orcamento-brasil|ecbcbvnupndkaypegubv/i);}
for(const file of ["services.html","contractor-portal.html","quote-flow-standard.html","quote-flow-kitchen.html","quote-flow-house-cleaning.html"])assert.ok(fs.existsSync(path.join(root,file)));
assert.equal(JSON.parse(read("vercel.json")).git.deploymentEnabled["feat/us-mvp-home-pro-funnel-20261015"],false);
assert.match(read("api/_lib/preview-target.js"),/feat\/us-mvp-home-pro-funnel-20261015/);
assert.match(read(".github/workflows/us-intake-offline-tests.yml"),/tests\/us-mvp-home-pro\.test\.js/);
});
