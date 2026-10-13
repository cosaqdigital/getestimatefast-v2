"use strict";
// Explicit opt-in: node --test tests/stripe-windows-native.cjs. No financial CLI/network.
const test = require("node:test"), assert = require("node:assert/strict");
const fs = require("node:fs"), os = require("node:os"), path = require("node:path"), crypto = require("node:crypto");
const { performance } = require("node:perf_hooks");
const { createNativeProcessController } = require("../scripts/stripe-native-processes");
const { createPrivateProcessRunner, cleanEnvironment, createNativeProcessRunner } = require("../scripts/stripe-relay-adapters");
const { APPROVED, ACCOUNT, verifyTarget, createTokenManager, createOidcVerifier, startSyntheticLauncher } = require("../scripts/stripe-preview-launcher");
assert.equal(process.platform, "win32", "This explicit operational harness requires Windows");
// Self-expiring three-generation trees. Every PID is reported by a directly spawned fixture.
const fixture = `const cp=require('node:child_process'); const depth=Number(process.argv[2]),mode=process.argv[3];
console.log(JSON.stringify({pid:process.pid,depth}));
const timer=setTimeout(()=>process.exit(91),30000);
if(depth>0){const child=cp.spawn(process.execPath,[__filename,String(depth-1),mode],{shell:false,windowsHide:true,stdio:['ignore',process.stdout,process.stderr]});
if(mode==='normal'||mode==='failure')child.once('close',()=>{clearTimeout(timer);process.exit(mode==='failure'?23:0)});}
else if(mode==='normal'||mode==='failure')setTimeout(()=>{clearTimeout(timer);process.exit(mode==='failure'?23:0)},100);
if(mode==='signal')setTimeout(()=>process.kill(process.pid,'SIGTERM'),150);`;
const runtime = fs.mkdtempSync(path.join(os.tmpdir(), "gef-windows-native-"));
const fixtureFile = path.join(runtime, "fixture.cjs");
fs.writeFileSync(fixtureFile, fixture);
const metrics = [], pids = new Set(), allPids = new Set(), children = new Set();
const alive = pid => { try { process.kill(pid, 0); return true; } catch (e) { if(e.code === "ESRCH")return false; throw e; } };
const delay = ms => new Promise(r => setTimeout(r, ms));
const grant = Object.freeze({ allowRealProcesses:true, purpose:"stripe-relay-operator", deploymentId:APPROVED.id, sha:APPROVED.sha, origin:APPROVED.origin, projectId:APPROVED.projectId, teamId:APPROVED.teamId, accountId:ACCOUNT, allowListener:false, expiresAt:Date.now()+900000 });
const controller = createNativeProcessController({ authorization:grant, selection:"pr60-stage7", validatePlan(spec) {
  assert.equal(spec.file,process.execPath); assert.equal(spec.args[0],fixtureFile); assert(["0","2"].includes(spec.args[1])); assert(["normal","failure","hang","signal"].includes(spec.args[2]));
} });
const spec = mode => ({file:process.execPath,args:[fixtureFile,"2",mode],options:{cwd:runtime,shell:false,windowsHide:true,stdio:["ignore","pipe","pipe"]}});
function spawn(plan, env) {
  const child = controller.spawn(plan, env); children.add(child); pids.add(child.pid); allPids.add(child.pid);
  let carry=""; child.stdout.on("data",chunk=>{carry+=chunk; const lines=carry.split(/\r?\n/);carry=lines.pop();for(const line of lines){const value=JSON.parse(line);assert(Number.isInteger(value.pid));pids.add(value.pid);allPids.add(value.pid);}});
  return child;
}
async function ready(child) {const start=performance.now();while(pids.size < 3 && child.exitCode===null && performance.now()-start<3000)await delay(10);assert.equal(pids.size,3);}
async function gone() {const start=performance.now();while([...pids].some(alive)&&performance.now()-start<2000)await delay(10);assert.deepEqual([...pids].filter(alive),[]);}
function record(name,start,extra={}){metrics.push({name,elapsed_ms:Number((performance.now()-start).toFixed(2)),...extra});}
test.after(async()=>{
  const outcomes=await Promise.allSettled([...children].map(c=>controller.stop(c)));
  await gone(); assert.deepEqual([...allPids].filter(alive),[]); assert(outcomes.every(r=>r.status==="fulfilled"));
  fs.mkdirSync("test-output",{recursive:true});fs.writeFileSync("test-output/stage1011-native-metrics.json",JSON.stringify({platform:process.platform,node:process.version,metrics,observed_processes:allPids.size,remaining_processes:0},null,2));
  fs.unlinkSync(fixtureFile);fs.rmdirSync(runtime);
});
for(const [mode,exit] of [["normal",0],["failure",23]])test("Windows cooperative tree "+mode,async()=>{
  pids.clear();const start=performance.now(),child=spawn(spec(mode),cleanEnvironment(process.env));
  const result=await new Promise(r=>child.once("close",(exitCode,signal)=>r({exitCode,signal})));
  assert.deepEqual(result,{exitCode:exit,signal:null});assert.deepEqual(await controller.stop(child),result);await gone();record(mode,start,{exitCode:exit,tree_size:3});
});
test("Windows taskkill terminates three generations and refuses unowned child",async()=>{
  pids.clear();const child=spawn(spec("hang"),cleanEnvironment(process.env));await ready(child);const start=performance.now();const result=await controller.stop(child);await gone();
  assert(result.exitCode!==null||result.signal!==null);await assert.rejects(controller.stop({pid:process.pid}),e=>e.code==="PROCESS_CLEANUP_FAILED");record("tree_force_stop",start,{...result,tree_size:3});
});
for(const mode of ["timeout","cancel"])test("Windows capture "+mode+" cleans owned tree",async()=>{
  pids.clear();let cleanupStarted;const runner=createPrivateProcessRunner({mode:"synthetic",spawnMock:(file,args,options)=>spawn({file,args,options},options.env),stopMock:child=>{cleanupStarted=performance.now();return controller.stop(child);},timeoutMs:mode==="timeout"?10000:20000});
  const abort=new AbortController(),start=performance.now();let timer;
  if(mode==="cancel")timer=setTimeout(()=>abort.abort(),400);
  try{await assert.rejects(runner.capture(spec("hang"),abort.signal),e=>e.code===(mode==="timeout"?"PROCESS_TIMEOUT":"OPERATION_ABORTED"));await gone();assert.equal(pids.size,3);assert.equal(runner.ownedCount(),0);record("capture_"+mode,start,{tree_size:3,operation_ms:Number((cleanupStarted-start).toFixed(2)),cleanup_ms:Number((performance.now()-cleanupStarted).toFixed(2))});}
  finally{clearTimeout(timer);await runner.dispose();}
});
test("Windows interruption preserves OS signal",async()=>{
  pids.clear();let timer;const runner=createPrivateProcessRunner({mode:"synthetic",spawnMock:(file,args,options)=>{const child=spawn({file,args,options},options.env);timer=setTimeout(()=>child.kill("SIGTERM"),150);return child;},stopMock:controller.stop});
  const plan=spec("hang");plan.args[1]="0";
  const start=performance.now();try{await assert.rejects(runner.capture(plan),e=>e.code==="PROCESS_INTERRUPTED"&&e.signal==="SIGTERM");await gone();record("signal",start,{signal:"SIGTERM",tree_size:1});}finally{clearTimeout(timer);await runner.dispose();}
});
const values={
  p:{id:APPROVED.projectId,accountId:APPROVED.teamId,name:"getestimatefast-v2",link:{type:"github",org:"cosaqdigital",repo:"getestimatefast-v2",repoId:APPROVED.repoId},ssoProtection:{deploymentType:"all_except_custom_domains"}},
  a:{projectId:APPROVED.projectId,alias:APPROVED.alias,deploymentId:APPROVED.id,redirect:null},
  d:{id:APPROVED.id,projectId:APPROVED.projectId,ownerId:APPROVED.teamId,target:null,readyState:"READY",url:new URL(APPROVED.origin).hostname,alias:[APPROVED.alias],meta:{githubCommitRef:APPROVED.branch,githubCommitSha:APPROVED.sha},gitSource:{type:"github",ref:APPROVED.branch,sha:APPROVED.sha,repoId:APPROVED.repoId}}
};
const value=route=>route.startsWith("/v9/")?values.p:route.startsWith("/v4/")?values.a:values.d;
test("parallel local identity latency and genuine ten-second deadline",async()=>{
  let active=0,peak=0;const start=performance.now();await verifyTarget(async route=>{active++;peak=Math.max(peak,active);await delay(250);active--;return value(route);},"pr60-stage7");assert.equal(peak,3);record("identity_parallel",start,{fixture_delay_ms:250,peak});
  let aborts=0;const deadline=performance.now();await assert.rejects(verifyTarget((route,signal)=>new Promise(resolve=>{signal.addEventListener("abort",()=>{aborts++;resolve(value(route));},{once:true});}),"pr60-stage7"));
  const elapsed=performance.now()-deadline;assert(elapsed>=9900&&elapsed<11000);assert.equal(aborts,3);record("identity_deadline",deadline,{deadline_ms:10000,aborted_operations:aborts});
});
test("identity cancellation, provider failure and late responses block",async()=>{
  for(const mode of ["cancel","failure"]){const abort=new AbortController(),start=performance.now();let signals=[],timer=setTimeout(()=>abort.abort(),50);
    try{await assert.rejects(verifyTarget((route,signal)=>{signals.push(signal);if(mode==="failure"&&route.startsWith("/v9/"))return Promise.reject(Error("synthetic-provider"));return new Promise(resolve=>setTimeout(()=>resolve(value(route)),100));},"pr60-stage7",abort.signal));assert(signals.every(s=>s.aborted));await delay(120);record("identity_"+mode,start);}finally{clearTimeout(timer);}}
});
test("real adapters and launcher remain blocked without scoped authorization",async()=>{
  assert.throws(()=>createNativeProcessRunner({deploymentSelection:"pr60-stage7"}));await assert.rejects(startSyntheticLauncher({mode:"native"}));
});
const pair=crypto.generateKeyPairSync("rsa",{modulusLength:2048}),key={...pair.publicKey.export({format:"jwk"}),kid:"synthetic-windows",alg:"RS256",use:"sig"};
function token(now,lifetime=70){const seconds=Math.floor(now/1000),encode=value=>Buffer.from(JSON.stringify(value)).toString("base64url");
 const head=encode({alg:"RS256",typ:"JWT",kid:key.kid}),body=encode({iss:"https://oidc.vercel.com/get-estimate-fast",aud:"https://vercel.com/get-estimate-fast",owner_id:APPROVED.teamId,owner:"get-estimate-fast",project_id:APPROVED.projectId,project:"getestimatefast-v2",environment:"development",sub:"owner:get-estimate-fast:project:getestimatefast-v2:environment:development",iat:seconds-1,nbf:seconds-1,exp:seconds+lifetime});
 return head+"."+body+"."+crypto.sign("RSA-SHA256",Buffer.from(head+"."+body),pair.privateKey).toString("base64url");
}
test("signed synthetic OIDC expiry, renewal, failure and cancellation",async()=>{
 let now=Date.now(),obtains=0,fail=false;const start=performance.now(),verify=createOidcVerifier({now:()=>now,loadJwks:async()=>({keys:[key]})});
 const manager=createTokenManager({now:()=>now,verify,obtain:async()=>{obtains++;if(fail)throw Error("synthetic-provider-failure");return token(now);}});
 try{const old=await manager.get();now+=15000;await Promise.all([manager.get(),manager.get()]);assert.equal(obtains,2);now+=71000;await assert.rejects(verify(old),e=>e.code==="OIDC_EXP_MARGIN");fail=true;await assert.rejects(manager.get(),e=>e.code==="OIDC_ACQUISITION");await assert.rejects(manager.get(),e=>e.code==="OIDC_ACQUISITION");
  const abort=new AbortController();abort.abort();const before=obtains;await assert.rejects(manager.get(abort.signal),e=>e.code==="OPERATION_ABORTED");assert.equal(obtains,before);record("oidc_expiry_renewal_failure_cancel",start,{successful_acquisitions:2});
 }finally{manager.dispose();}
});
test("OIDC genuine ten-second timeout cancels provider and refuses late cache mutation",async()=>{
 let release,signal,obtains=0;const late=new Promise(r=>release=r),verify=createOidcVerifier({loadJwks:async()=>({keys:[key]})});
 const manager=createTokenManager({verify,obtain:scope=>{obtains++;signal=scope;return obtains===1?late:Promise.resolve(token(Date.now(),3600));}}),start=performance.now();
 try{await assert.rejects(manager.get(),e=>e.code==="OIDC_REFRESH_TIMEOUT");const elapsed=performance.now()-start;assert(elapsed>=9900&&elapsed<11000);assert(signal.aborted);record("oidc_deadline",start,{deadline_ms:10000,provider_aborted:true});
  await manager.get();release(token(Date.now(),3600));await delay(30);await manager.get();assert.equal(obtains,2);
 }finally{release(token(Date.now(),3600));manager.dispose();}
});
