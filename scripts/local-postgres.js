"use strict";
const path = require("node:path");
const crypto = require("node:crypto");
const net = require("node:net");
const fs = require("node:fs");
const os = require("node:os");
const {spawn,execFile}=require("node:child_process");
const {promisify}=require("node:util");
const execute=promisify(execFile);
async function endLocalClient(client){
  if(!client)return;
  let timer;
  try {await Promise.race([client.end(),new Promise(resolve=>{timer=setTimeout(()=>{client.connection?.stream?.destroy();resolve();},2000);})]);}
  finally {clearTimeout(timer);}
}

// Native PostgreSQL, loopback only, random local password, separate connections.
// Never accepts a remote URL or creates a system user/service.
async function waitForLocalCluster(cluster, makeProbe, timeoutMs = 20000) {
  const cancellation = new AbortController(); let timer;
  const probe = (async () => {
    while (!cancellation.signal.aborted) {
      const client = makeProbe();
      try { await client.connect(); await client.query("select 1"); return; }
      catch { if (!cancellation.signal.aborted) await new Promise(resolve => setTimeout(resolve, 50)); }
      finally { await endLocalClient(client).catch(() => {}); }
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
  const binaries=await import(`@embedded-postgres/${process.platform==='win32'?'windows':process.platform}-${process.arch}`);
  const { Client, types } = require("pg");
  types.setTypeParser(20, value => Number(value));
  types.setTypeParser(1184, value => value);
  let port;
  for(let attempt=0;attempt<16;attempt++){
    const probe=net.createServer();
    await new Promise((resolve,reject)=>{probe.once('error',reject);probe.listen(0,'127.0.0.1',resolve);});
    const candidate=probe.address().port;
    await new Promise(resolve=>probe.close(resolve));
    if(![56215,59178,50001,49176,56961].includes(candidate)){port=candidate;break;}
  }
  if(!port)throw Error('No isolated test port');
  fs.mkdirSync(path.resolve(__dirname,'../test-output'),{recursive:true});
  // Fresh prefix, separate from all legacy clusters; never reuse/delete it.
  const dataRoot=fs.mkdtempSync(path.join(os.tmpdir(),'gef-us-notification-tests-'));
  const directory = path.join(dataRoot, "pg-" + crypto.randomUUID());
  const password = crypto.randomBytes(32).toString("hex");
  const cluster = new EmbeddedPostgres({ databaseDir: directory, port, user: "postgres", password,
    persistent: true, createPostgresUser: false, authMethod: "scram-sha-256",
    postgresFlags: ["-h", "127.0.0.1"], onLog() {}, onError() {} });
  let client,server,stopping;
  const proof={runId:crypto.randomUUID(),controllerPid:process.pid,directory,port,executable:binaries.postgres,state:'created'};
  const writeProof=()=>{
    fs.writeFileSync(path.join(directory,'test-resource.json'),JSON.stringify(proof));
    fs.writeFileSync(path.resolve(__dirname,'../test-output','postgres-resource-'+proof.runId+'.json'),JSON.stringify(proof));
  };
  const closeCluster=()=>{
    if(stopping)return stopping;
    stopping=(async()=>{
      if(!server)return;
      const relative=path.relative(dataRoot,directory);
      if(path.isAbsolute(relative)||relative.startsWith('..')||!/^pg-[a-f0-9-]+$/.test(relative))throw Error('Unsafe local cluster path');
      if(server.exitCode!==null||server.signalCode!==null)throw Error('Local server exited before controlled stop; preserve resources');
      const pid=fs.readFileSync(path.join(directory,'postmaster.pid'),'utf8').trim().split(/\r?\n/);
      if(Number(pid[0])!==server.pid||path.resolve(pid[1])!==directory||Number(pid[3])!==port||server.spawnfile!==binaries.postgres)throw Error('Local cluster ownership unproven');
      // pg_ctl coordinates PostgreSQL children; never use dependency taskkill/stop.
      await execute(binaries.pg_ctl,['-D',directory,'-m','fast','-w','-t','10','stop'],{windowsHide:true,timeout:15000});
      if(server.exitCode===null&&server.signalCode===null)await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Local server exit unproven')),2000);server.once('exit',()=>{clearTimeout(timer);resolve();});});
      await new Promise((resolve,reject)=>{const probe=net.createServer();probe.once('error',()=>reject(Error('Local test port not released')));probe.listen(port,'127.0.0.1',()=>probe.close(resolve));});
      proof.state='stopped';proof.closedAt=new Date().toISOString();writeProof();
    })();return stopping;
  };
  const connect = async () => {
    const connection = new Client({ host: "127.0.0.1", port, user: "postgres", password, database: "postgres", connectionTimeoutMillis: 5000, query_timeout:5000, statement_timeout:5000 });
    connection.on('error',()=>report('connection_error'));
    try { await connection.connect(); return connection; } catch (error) { await endLocalClient(connection).catch(() => {}); throw error; }
  };
  try {
    phase = "initialize"; report("begin"); await cluster.initialise(); report("complete");
    phase = "start"; report("begin");
    writeProof();
    const startup={start:()=>{
      server=spawn(binaries.postgres,['-D',directory,'-p',String(port),'-h','127.0.0.1'],{windowsHide:true,env:{...process.env,LC_MESSAGES:'C'},stdio:['ignore','ignore','ignore']});
      proof.serverPid=server.pid;proof.createdAt=new Date().toISOString();proof.state='starting';writeProof();
      return new Promise((_,reject)=>{server.once('error',()=>reject(Error('Local server spawn failed')));server.once('exit',()=>reject(Error('Local server exited')));});
    }};
    await waitForLocalCluster(startup, () => new Client({ host: "127.0.0.1", port, user: "postgres", password, database: "postgres", connectionTimeoutMillis: 300,query_timeout:1000,statement_timeout:1000 }));
    proof.state='running';writeProof();report("complete");
    phase = "connect"; client = await connect(); report("complete");
    return { waitReady: Promise.resolve(), connect, resource:Object.freeze({directory,port,runId:proof.runId,serverPid:server.pid}),
      exec: sql => client.query(sql), query: (sql, values) => client.query(sql, values),
      async transaction(fn) {
        const connection = await connect();
        try { await connection.query("begin"); const result = await fn({ exec: sql => connection.query(sql), query: (sql, values) => connection.query(sql, values) }); await connection.query("commit"); return result; }
        catch (error) { await connection.query("rollback"); throw error; }
        finally { await endLocalClient(connection); }
      },
      async close() { phase = "close"; try { await endLocalClient(client); } finally { await closeCluster(); report("complete"); } }
    };
  } catch { report("failed"); await endLocalClient(client).catch(() => {}); await closeCluster().catch(() => {}); throw Error("Disposable local PostgreSQL failed at " + phase); }
}
module.exports = { createLocalPostgres, waitForLocalCluster };
