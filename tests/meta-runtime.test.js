"use strict";
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const {JSDOM} = require('jsdom');
const tracker = fs.readFileSync('assets/meta-tracking.js', 'utf8');

for (const [file, viewContent] of [['index.html', false], ['quote-flow-standard.html', true], ['quote-flow-house-cleaning.html', true]]) {
  test(`${file}: runtime queues exactly one PageView and appropriate ViewContent`, () => {
    const dom = new JSDOM(fs.readFileSync(file, 'utf8'), {url:'https://www.getestimatefast.com/'+file+'?fbclid=TEST123',runScripts:'outside-only'});
    const {window:w} = dom;
    w.eval(tracker);
    w.document.dispatchEvent(new w.Event('DOMContentLoaded'));
    w.document.dispatchEvent(new w.Event('DOMContentLoaded'));
    const events = w.fbq.queue.map(a=>Array.from(a));
    assert.deepEqual(JSON.parse(JSON.stringify(events.filter(a=>a[0]==='init'))), [['init','1444720010946620']]);
    assert.equal(events.filter(a=>a[1]==='PageView').length, 1);
    assert.equal(events.filter(a=>a[1]==='ViewContent').length, Number(viewContent));
    assert.equal(w.document.querySelectorAll('script[src="https://connect.facebook.net/en_US/fbevents.js"]').length, 1);
    dom.window.close();
  });
}

test('thank-you: receipt ID is queued for deduplication and removed from URL; reload cannot repeat Lead', () => {
  const html=fs.readFileSync('thank-you.html','utf8');
  const dom=new JSDOM(html,{url:'https://www.getestimatefast.com/thank-you.html?gef_event_id=synthetic-event&keep=yes#done',runScripts:'outside-only'});
  const w=dom.window;
  const script=Array.from(w.document.scripts).find(s=>s.textContent.includes("fbq('track', 'Lead'"));
  w.eval(script.textContent);
  const events=w.fbq.queue.map(a=>Array.from(a));
  assert.equal(events.filter(a=>a[1]==='Lead').length,1);
  assert.equal(events.find(a=>a[1]==='Lead')[3].eventID,'synthetic-event');
  assert.equal(w.location.search,'?keep=yes');
  assert.equal(w.location.hash,'#done');
  w.eval(script.textContent);
  assert.equal(w.fbq.queue.filter(a=>a[1]==='Lead').length,1);
  dom.window.close();
});
