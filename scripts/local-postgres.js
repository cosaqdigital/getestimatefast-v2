"use strict";
const path = require("node:path");
const crypto = require("node:crypto");
const net = require("node:net");

// Native PostgreSQL, loopback only, random local password, separate connections.
// Never accepts a remote URL or creates a system user/service.
async function createLocalPostgres() {
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
  let started = false;
  const connect = async () => {
    const client = new Client({ host: "127.0.0.1", port, user: "postgres", password, database: "postgres" });
    await client.connect();
    return client;
  };
  try {
    await cluster.initialise(); await cluster.start(); started = true;
    const client = await connect();
    return { waitReady: Promise.resolve(), connect,
      exec: sql => client.query(sql), query: (sql, values) => client.query(sql, values),
      async transaction(fn) {
        const connection = await connect();
        try { await connection.query("begin"); const result = await fn({ exec: sql => connection.query(sql), query: (sql, values) => connection.query(sql, values) }); await connection.query("commit"); return result; }
        catch (error) { await connection.query("rollback"); throw error; }
        finally { await connection.end(); }
      },
      async close() { await client.end(); await cluster.stop(); }
    };
  } catch (error) { if (started) await cluster.stop(); throw error; }
}
module.exports = { createLocalPostgres };
