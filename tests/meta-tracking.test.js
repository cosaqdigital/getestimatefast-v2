const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("Meta Pixel loads on the paid acquisition landing page", () => {
  const html = read("index.html");
  assert.match(html, /assets\/meta-tracking\.js/);
});

test("Meta Pixel loads on both active quote flows", () => {
  for (const file of ["quote-flow-standard.html", "quote-flow-house-cleaning.html"]) {
    assert.match(read(file), /assets\/meta-tracking\.js/);
  }
});

test("shared Meta tracking emits PageView and ViewContent", () => {
  const script = read("assets/meta-tracking.js");
  assert.match(script, /fbq\("track", "PageView"\)/);
  assert.match(script, /fbq\("track", "ViewContent"/);
  assert.match(script, /\[data-quote-flow-form\]/);
});

test("Lead remains deduplicated between CAPI and browser", () => {
  const api = read("api/lead.js");
  const thankYou = read("thank-you.html");
  assert.match(api, /event_id:\s*eventId/);
  assert.match(api, /event_name:\s*"Lead"/);
  assert.match(thankYou, /fbq\('track', 'Lead', \{\}, \{ eventID: eventId \}\)/);
});
