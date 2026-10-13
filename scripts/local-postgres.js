"use strict";
const path = require("node:path");
const crypto = require("node:crypto");
const net = require("node:net");

// Native PostgreSQL, loopback only, random local password, separate connections.
// Never accepts a remote URL or creates a system user/service.
async function waitForLocalCluster(cluster, makeProbe, timeoutMs = 20000) {
  const cancellation = new AbortController(); let timer;
  const probe = (async () => {
    while (!cancellation.signal.aborted) {
      const client = makeProbe();
      try { await client.connect(); await client.query("select 1"); return; }
      catch { if (!cancellation.signal.aborted) await new Promise(resolve => setTimeout(resolve, 50)); }
      finally { await client.end().catch(() => {}); }
    }
    throw Error("Local startup stopped");
  })();
  try {
    await Promise.race([cluster.start(), probe, new Promise((_, reject) => { timer = setTimeout(() => reject(Error("Local PostgreSQL startup deadline")), timeoutMs); })]);
  } finally { clearTimeout(timer); cancellation.abort(); await probe.catch(() => {}); }
}
async function createLocalPostgres({ diagnostics = () => {} } = {}) {
  const startedAt = Date.now(); let phase = "import";
  const report = status => { try { diagnostics({ phase, status, elapsed_ms: Date.now() - startedAt }); } catch {} };
  const { default: EmbeddedPostgres } = await import("embedded-postgres");
  const { Client, types } = require("pg");
  types.setTypeParser(20, value => Number(value));
  types.setTypeParser(1184, value => value);
  const probe = net.createServer();
  await new Promise(resolve => probe.listen(0, "127.0.0.1", resolve));
  const port = probe.address().port;
  await new Promise(resolve => probe.close(resolve));
  const directory = path.resolve(__dirname, "../test-output", "pg-" + crypto.randomUUID());
  const password = crypto.randomBytes(32).toString("hex");
  const cluster = new EmbeddedPostgres({ databaseDir: directory, port, user: "postgres", password,
    persistent: false, createPostgresUser: false, authMethod: "scram-sha-256",
    postgresFlags: ["-h", "127.0.0.1"], onLog() {}, onError() {} });
  let client;
  const closeCluster = async () => {
    // embedded-postgres.stop recursively deletes this directory: verify containment.
    const relative = path.relative(path.resolve(__dirname, "../test-output"), directory);
    if (path.isAbsolute(relative) || relative.startsWith("..") || !/^pg-[a-f0-9-]+$/.test(relative)) throw Error("Unsafe local cluster path");
    if (cluster.process && cluster.process.exitCode === null && cluster.process.signalCode === null) await cluster.stop();
  };
  const connect = async () => {
    const connection = new Client({ host: "127.0.0.1", port, user: "postgres", password, database: "postgres", connectionTimeoutMillis: 5000 });
    try { await connection.connect(); return connection; } catch (error) { await connection.end().catch(() => {}); throw error; }
  };
  try {
    phase = "initialize"; report("begin"); await cluster.initialise(); report("complete");
    phase = "start"; report("begin");
    await waitForLocalCluster(cluster, () => new Client({ host: "127.0.0.1", port, user: "postgres", password, database: "postgres", connectionTimeoutMillis: 300 })); report("complete");
    phase = "connect"; client = await connect(); report("complete");
    return { waitReady: Promise.resolve(), connect,
      exec: sql => client.query(sql), query: (sql, values) => client.query(sql, values),
      async transaction(fn) {
        const connection = await connect();
        try { await connection.query("begin"); const result = await fn({ exec: sql => connection.query(sql), query: (sql, values) => connection.query(sql, values) }); await connection.query("commit"); return result; }
        catch (error) { await connection.query("rollback"); throw error; }
        finally { await connection.end(); }
      },
      async close() { phase = "close"; try { await client.end(); } finally { await closeCluster(); report("complete"); } }
    };
  } catch { report("failed"); await client?.end().catch(() => {}); await closeCluster().catch(() => {}); throw Error("Disposable local PostgreSQL failed at " + phase); }
}
module.exports = { createLocalPostgres, waitForLocalCluster };
