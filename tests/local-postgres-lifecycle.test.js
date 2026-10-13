"use strict";
const test = require("node:test"), assert = require("node:assert/strict"), fs = require("node:fs");
const { createLocalPostgres, waitForLocalCluster } = require("../scripts/local-postgres");
test("local readiness uses SQL when the dependency's stderr readiness marker is missing", async () => {
  let closed = 0; await waitForLocalCluster({ start: () => new Promise(() => {}) }, () => ({ connect: async () => {}, query: async sql => assert.equal(sql, "select 1"), end: async () => { closed++; } }), 100);
  assert.equal(closed, 1);
});
test("unavailable local startup has a bounded deadline and closes probes", async () => {
  let closed = 0; await assert.rejects(waitForLocalCluster({ start: () => new Promise(() => {}) }, () => ({ connect: async () => { throw Error("synthetic unavailable"); }, end: async () => { closed++; } }), 20), /deadline/); assert(closed > 0);
});
test("controlled two-cluster local PostgreSQL startup uses separate connections and closes both", { timeout: 60000 }, async () => {
  const diagnostics = [];
  const results = await Promise.allSettled([0, 1].map(cluster => createLocalPostgres({ diagnostics: e => diagnostics.push({ cluster, ...e }) })));
  try {
    assert(results.every(r => r.status === "fulfilled"), "both independent disposable clusters started");
    for (const r of results) assert.equal((await r.value.query("select 1 as synthetic_probe")).rows[0].synthetic_probe, 1);
  } finally {
    await Promise.allSettled(results.filter(r => r.status === "fulfilled").map(r => r.value.close()));
    fs.writeFileSync("test-output/postgres-phase5-startup-diagnostics.json", JSON.stringify({ clusters: 2, statuses: results.map(r => r.status), diagnostics }, null, 2));
  }
});
