const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

test("sitemap.xml keeps one valid canonical URL block per entry", () => {
  const xml = fs.readFileSync("sitemap.xml", "utf8");

  assert.match(xml, /^<\?xml version="1\.0" encoding="UTF-8"\?>/);
  assert.match(xml, /<urlset xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9">/);
  assert.doesNotMatch(xml, /<url>\s*<url>/, "nested <url> blocks are invalid");
  assert.doesNotMatch(xml, /<\/url>\s*<\/url>/, "duplicated closing </url> tags are invalid");

  const urls = [...xml.matchAll(/<url>\s*<loc>([^<]+)<\/loc>\s*<lastmod>([^<]+)<\/lastmod>\s*<\/url>/g)];
  assert.equal(urls.length, 55, "sitemap should contain the 55 canonical URLs");

  const locs = urls.map(([, loc]) => loc);
  assert.equal(new Set(locs).size, locs.length, "sitemap URLs must be unique");

  for (const loc of locs) {
    assert.match(loc, /^https:\/\/www\.getestimatefast\.com\//, "all sitemap URLs must use the canonical www host");
  }

  assert.ok(locs.includes("https://www.getestimatefast.com/"));
  assert.ok(locs.includes("https://www.getestimatefast.com/roofing-contractor-riverview-fl.html"));
  assert.ok(locs.includes("https://www.getestimatefast.com/foundation-repair-riverview-fl.html"));
});
