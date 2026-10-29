"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const root=path.resolve(__dirname,".."),read=p=>fs.readFileSync(path.join(root,p),"utf8");

test("home presents free customer request and a real service picker",()=>{
const h=read("index.html");
assert.match(h,/Find local service professionals/);
assert.match(h,/href="#find-your-service"[^>]*data-cta="start-my-request"/);
assert.match(h,/<span class="desktop-cta-label">Start a Free Request<\\/span>/);
assert.match(h,/data-service-starter-input/);
assert.match(h,/href="services.html"[^>]*>View All Services<\/a>|href="services.html"[^>]*>Browse Services<\/a>/);
assert.match(h,/Free to submit/);
assert.match(h,/Responses not guaranteed|Availability varies by service and location/);
assert.match(h,/rel="canonical" href="https:\/\/www\.getestimatefast\.com\/"/);
});

test("professional funnel promotes the free profile with a clear signup and sign-in path",()=>{
const h=read("index.html"),p=read("for-professionals.html");
assert.match(h,/href="for-professionals.html"[^>]*>For Pros<\/a>/);
assert.match(h,/href="contractor-portal.html"[^>]*>Professional Sign In<\/a>/);
assert.match(p,/Build a professional profile customers can trust/);
assert.match(p,/href="\/contractor-portal\.html\?signup=1"[^>]*data-cta="create-free-profile"[^>]*>Create Free Profile<\/a>/);
assert.match(p,/Already have an account\? Sign In/);
assert.match(p,/Free to create/);
assert.match(p,/Portfolio/);
assert.match(p,/Customer reviews/);
assert.match(p,/Build ranking signals/);
assert.match(p,/Opportunities are never guaranteed|does not guarantee jobs/);
assert.doesNotMatch(p,/Development workspace|tested in Development/);
assert.match(p,/name="robots" content="index,follow"/);
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
