"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const routes = [
  {
    "path": "bathroom-remodeling.html",
    "label": "Bathroom Remodeling",
    "slug": "bathroom-remodeling",
    "baseDest": "quote-flow-standard.html?service=bathroom-remodeling"
  },
  {
    "path": "bathroom-remodeling-riverview.html",
    "label": "Bathroom Remodeling",
    "slug": "bathroom-remodeling",
    "baseDest": "quote-flow-standard.html?service=bathroom-remodeling"
  },
  {
    "path": "flooring-installation.html",
    "label": "Flooring Installation",
    "slug": "flooring",
    "baseDest": "quote-flow-standard.html?service=flooring"
  },
  {
    "path": "flooring-installation-riverview.html",
    "label": "Flooring Installation",
    "slug": "flooring",
    "baseDest": "quote-flow-standard.html?service=flooring"
  },
  {
    "path": "painting.html",
    "label": "Painting",
    "slug": "painting",
    "baseDest": "quote-flow-standard.html?service=painting"
  },
  {
    "path": "painting-riverview.html",
    "label": "Painting",
    "slug": "painting",
    "baseDest": "quote-flow-standard.html?service=painting"
  },
  {
    "path": "kitchen-remodeling.html",
    "label": "Kitchen Remodeling",
    "slug": "kitchen-remodeling",
    "baseDest": "quote-flow-kitchen.html"
  },
  {
    "path": "kitchen-remodeling-riverview.html",
    "label": "Kitchen Remodeling",
    "slug": "kitchen-remodeling",
    "baseDest": "quote-flow-kitchen.html"
  }
];
const read = (name) => fs.readFileSync(path.join(root,name),"utf8");

test("legacy US service pages link only to their native guided flows", () => {
  for (const route of routes) {
    const html = read(route.path);
    const separator = route.baseDest.includes("?") ? "&amp;" : "?";
    const expected = route.baseDest.replace(/&/g,"&amp;") + separator + "source=" + encodeURIComponent(route.path);
    assert.ok(html.includes('href="' + expected + '"'), route.path + " missing native intake link");
    assert.ok(html.includes('id="quote-form"'), route.path + " missing accessible section");
    assert.doesNotMatch(html, /formsubmit\.co|getestimatefast@gmail\.com|serviceLeadForm|id="stepsContainer"|assets\/service-landing\.js|name="_captcha"/i, route.path + " still references obsolete form");
    assert.match(html, /rel="canonical"/, route.path + " lost its SEO canonical");
    assert.doesNotMatch(html, /orcamentobrasil\.com|cosaqdigital\/orcamento-brasil/i);
  }
});

test("US lead API remains independent, persistent when enabled and manually reviewed", () => {
  const standard = read("quote-flow-standard.html");
  const kitchen = read("quote-flow-kitchen.html");
  assert.match(standard, /action="\/api\/lead"/);
  assert.match(kitchen, /action="\/api\/lead"/);
  const handler = read("api/lead.js");
  assert.match(handler, /LEAD_PERSISTENCE_ENABLED/);
  assert.match(handler, /status: "new"/);
  assert.match(handler, /manualReviewReason/);
  assert.match(handler, /fields\.gef_hp_trap_47b/);
});

test("US attribution is allowlisted and bathroom remains manual-review-only", () => {
  const script = read("assets/platform-forms.js");
  assert.match(script, /approvedLandingSources\.has\(source\)/);
  assert.match(script, /field\.name = "Original Landing Page"/);
  for (const route of routes) assert.ok(script.includes('"' + route.path + '"'));
  assert.match(script, /requested === "bathroom-remodeling" \? "Bathroom Remodeling"/);
  assert.match(script, /standardServiceQuestions\["bathroom-remodeling"\]/);
});

test("branch is isolated from deploy and protected from live preview requests", () => {
  const config = JSON.parse(read("vercel.json"));
  assert.equal(config.git.deploymentEnabled["feat/us-intake-routing-20261014"], false);
  assert.ok(read("api/_lib/preview-target.js").includes('"feat/us-intake-routing-20261014"'));
});
