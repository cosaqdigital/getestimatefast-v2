"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),crypto=require("node:crypto"),cp=require("node:child_process"),fs=require("node:fs"),os=require("node:os"),path=require("node:path");
const {EventEmitter}=require("node:events"),{PassThrough}=require("node:stream");
const {startSyntheticLauncher,APPROVED,ACCOUNT,verifyTarget,createTokenManager,createOidcVerifier}=require("../scripts/stripe-preview-launcher");
const {createPrivateProcessRunner,createNativeProcessRunner,commands,createVercelAdapter,createStripeAdapter}=require("../scripts/stripe-relay-adapters");
const {createPublicKeyCache}=require("../scripts/stripe-oidc-validation");
const {assertNativeAuthorization,createNativeProcessController}=require("../scripts/stripe-native-processes");
const pair=crypto.generateKeyPairSync("rsa",{modulusLength:2048}),key={...pair.publicKey.export({format:"jwk"}),kid:"synthetic-operations",alg:"RS256",use:"sig"};
const encode=v=>Buffer.from(JSON.stringify(v)).toString("base64url");
function jwt(now=Date.now(),changes={}){const sec=Math.floor(now/1000),h=encode({alg:"RS256",typ:"JWT",kid:key.kid}),c=encode({iss:"https://oidc.vercel.com/get-estimate-fast",aud:"https://vercel.com/get-estimate-fast",owner_id:APPROVED.teamId,owner:"get-estimate-fast",project_id:APPROVED.projectId,project:"getestimatefast-v2",environment:"development",sub:"owner:get-estimate-fast:project:getestimatefast-v2:environment:development",iat:sec-1,nbf:sec-1,exp:sec+3600,...changes});return h+"."+c+"."+crypto.sign("RSA-SHA256",Buffer.from(h+"."+c),pair.privateKey).toString("base64url");}
function child(){const c=new EventEmitter();c.stdout=new PassThrough();c.stderr=new PassThrough();return c;}
function fixture(extra={}){
 const c=child(),events=[];let stops=0;
 const p={id:APPROVED.projectId,accountId:APPROVED.teamId,name:"getestimatefast-v2",link:{type:"github",org:"cosaqdigital",repo:"getestimatefast-v2",repoId:APPROVED.repoId},ssoProtection:{deploymentType:"all_except_custom_domains"}},a={projectId:APPROVED.projectId,alias:APPROVED.alias,deploymentId:APPROVED.id,redirect:null},d={id:APPROVED.id,projectId:APPROVED.projectId,ownerId:APPROVED.teamId,target:null,readyState:"READY",url:new URL(APPROVED.origin).hostname,alias:[APPROVED.alias],meta:{githubCommitRef:APPROVED.branch,githubCommitSha:APPROVED.sha},gitSource:{type:"github",ref:APPROVED.branch,sha:APPROVED.sha,repoId:APPROVED.repoId}};
 const api=async route=>route.startsWith("/v9/")?p:route.startsWith("/v4/")?a:d;
 const adapters={mode:"synthetic",deploymentSelection:"pr60-stage7",api,obtainToken:async()=>jwt(),loadJwks:async()=>({keys:[key]}),readStripeIdentity:async()=>({version:"1.53.1",account_id:ACCOUNT,mode:"test",authorized_accounts:[{id:ACCOUNT,modes:["test"]}]}),spawnSynthetic:async()=>c,stopSynthetic:async()=>{stops++;c.stdout.destroy();c.stderr.destroy();},transport:async()=>{throw Error("No forwarding in lifecycle tests");},onStatus:e=>events.push(e),...extra};
 return{c,api,adapters,events,stops:()=>stops};
}
test("stop failure propagates; explicit retry cleans up and concurrent stops join",async()=>{
 let attempts=0;const f=fixture({stopSynthetic:async()=>{attempts++;await new Promise(r=>setTimeout(r,5));if(attempts===1)throw Error("synthetic-private-termination");}}),run=await startSyntheticLauncher(f.adapters);
 const first=await Promise.allSettled([run.stop(),run.stop()]);assert(first.every(r=>r.status==="rejected"&&r.reason.code==="PROCESS_CLEANUP_FAILED"));assert.equal(attempts,1);assert.equal(run.secretReady(),false);
 await assert.rejects(fetch("http://127.0.0.1:"+run.port));await run.stop();assert.equal(attempts,2);await run.stop();assert.equal(attempts,2);f.c.stdout.destroy();f.c.stderr.destroy();assert(!JSON.stringify(f.events).includes("synthetic-private"));
});
test("cleanup timeout is distinct; failed cleanup is not reported as stopped",async()=>{
 let hang=true;const f=fixture({cleanupTimeoutMs:20,stopSynthetic:async()=>hang?new Promise(()=>{}):undefined}),run=await startSyntheticLauncher(f.adapters);
 await assert.rejects(run.stop(),e=>e.code==="PROCESS_CLEANUP_TIMEOUT");assert.equal(run.status().code,"PROCESS_CLEANUP_TIMEOUT");hang=false;await run.stop();f.c.stdout.destroy();f.c.stderr.destroy();
});
for(const [exitCode,signal,expected]of [[0,null,"LAUNCHER_CHILD_EXIT"],[7,null,"PROCESS_EXIT_NONZERO"],[null,"SIGTERM","PROCESS_INTERRUPTED"]])test("child exit classification "+expected,async()=>{
 const f=fixture(),run=await startSyntheticLauncher(f.adapters);f.c.emit("exit",exitCode,signal);await run.stop();assert.equal(run.status().code,expected);if(Number.isInteger(exitCode))assert.equal(run.status().exitCode,exitCode);assert.equal(f.stops(),1);await assert.rejects(fetch("http://127.0.0.1:"+run.port));
});
test("operator interruption closes listener and records sanitized signal",async()=>{const f=fixture(),run=await startSyntheticLauncher(f.adapters);run.interrupt("SIGINT");await run.stop();assert.equal(run.status().code,"LAUNCHER_INTERRUPTED");assert.equal(run.status().signal,"SIGINT");assert.equal(f.stops(),1);});
test("startup has total bounded deadline even if identity ignores signal",async()=>{const f=fixture({startupTimeoutMs:20,readStripeIdentity:async()=>new Promise(()=>{})});await assert.rejects(startSyntheticLauncher(f.adapters),e=>e.code==="LAUNCHER_STARTUP_TIMEOUT");assert.equal(f.stops(),0);});
test("late subprocess after startup cancellation is still owned and stopped",async()=>{
 let entered,release,stops=0;const waiting=new Promise(r=>entered=r),spawn=new Promise(r=>release=r),c=child();
 const f=fixture({startupTimeoutMs:25,spawnSynthetic:async()=>{entered();return spawn;},stopSynthetic:async()=>{stops++;c.stdout.destroy();c.stderr.destroy();}});
 const start=startSyntheticLauncher(f.adapters);await waiting;await assert.rejects(start);release(c);await new Promise(r=>setTimeout(r,25));assert.equal(stops,1);
});
test("deployment reads run concurrently within the original fixed deadline",async()=>{
 const f=fixture();let active=0,peak=0;const api=async route=>{active++;peak=Math.max(active,peak);await new Promise(r=>setTimeout(r,20));active--;return f.api(route);};await verifyTarget(api,"pr60-stage7",undefined,60);assert.equal(peak,3);
});
test("token renewal remains serialized, invalidates stale values and exposes acquisition failure",async()=>{
 let now=Date.now(),gets=0,fail=false;const verify=createOidcVerifier({loadJwks:async()=>({keys:[key]}),now:()=>now});
 const m=createTokenManager({now:()=>now,verify,obtain:async()=>{gets++;if(fail)throw Error("synthetic-private-provider");return jwt(now,{exp:Math.floor(now/1000)+70});}});
 try{await m.get();now+=15000;await Promise.all([m.get(),m.get()]);assert.equal(gets,2);now+=15000;fail=true;await assert.rejects(m.get(),e=>e.code==="OIDC_ACQUISITION");}finally{m.dispose();}
});
test("refresh timeout and disposal block even a late token from ignored cancellation",async()=>{
 let release;const value=new Promise(r=>release=r),m=createTokenManager({timeoutMs:20,obtain:()=>value,verify:createOidcVerifier({loadJwks:async()=>({keys:[key]})})});await assert.rejects(m.get(),e=>e.code==="OIDC_REFRESH_TIMEOUT");m.dispose();release(jwt());await new Promise(r=>setTimeout(r,5));await assert.rejects(m.get());
});
test("cached token revalidation rejects backwards clock without weakening nbf",async()=>{
 let now=Date.now();const m=createTokenManager({now:()=>now,obtain:async()=>jwt(now),verify:createOidcVerifier({now:()=>now,loadJwks:async()=>({keys:[key]})})});try{await m.get();now-=10000;await assert.rejects(m.get(),e=>e.code==="OIDC_NOT_YET_VALID");}finally{m.dispose();}
});
test("dispose cancels a refresh shared by concurrent callers",async()=>{
 const m=createTokenManager({obtain:()=>new Promise(()=>{}),verify:async()=>{throw Error("not reached");}});const a=m.get(),b=m.get();m.dispose();const values=await Promise.allSettled([a,b]);assert(values.every(r=>r.status==="rejected"));
});
const runtime=fs.mkdtempSync(path.join(os.tmpdir(),"gef-operational-synthetic-"));test.after(()=>fs.rmdirSync(runtime));
test("already-cancelled OIDC caller never starts acquisition",async()=>{
 let obtains=0;const abort=new AbortController();abort.abort();const manager=createTokenManager({obtain:async()=>{obtains++;return jwt();},verify:async()=>({exp:Math.floor(Date.now()/1000)+3600})});
 try{await assert.rejects(manager.get(abort.signal),e=>e.code==="OPERATION_ABORTED");await new Promise(r=>setImmediate(r));assert.equal(obtains,0);}finally{manager.dispose();}
});
test("late timed-out verification cannot erase a newer successful renewal",async()=>{
 let obtains=0,release,entered;const waiting=new Promise(r=>entered=r),late=new Promise(r=>release=r);
 const verify=createOidcVerifier({loadJwks:async()=>({keys:[key]})});
 const manager=createTokenManager({timeoutMs:30,obtain:async()=>{obtains++;return jwt();},verify:async value=>{if(obtains===1){entered();await late;}return verify(value);}});
 try{const first=manager.get();await waiting;await assert.rejects(first,e=>e.code==="OIDC_REFRESH_TIMEOUT");await manager.get();release();await new Promise(r=>setTimeout(r,10));await manager.get();assert.equal(obtains,2);}finally{release();manager.dispose();}
});
test("capture preserves exit code/signal and dispose propagates cleanup failure",async()=>{
 const c=child();const runner=createPrivateProcessRunner({mode:"synthetic",spawnMock:()=>{queueMicrotask(()=>c.emit("close",23,null));return c;},stopMock:async()=>{c.stdout.destroy();c.stderr.destroy();}});
 await assert.rejects(runner.capture({file:process.execPath,args:[],options:{cwd:runtime,shell:false,stdio:["ignore","pipe","pipe"]}}),e=>e.code==="PROCESS_EXIT_NONZERO"&&e.exitCode===23);assert.equal(runner.ownedCount(),0);await runner.dispose();
 const bad=createPrivateProcessRunner({mode:"synthetic",spawnMock:child,stopMock:async()=>{throw Error("synthetic-private");}});const cc=bad.spawn({file:process.execPath,args:[],options:{cwd:runtime,shell:false,stdio:["ignore","pipe","pipe"]}});await assert.rejects(bad.dispose(),e=>e.code==="PROCESS_CLEANUP_FAILED");assert.equal(bad.ownedCount(),1);cc.stdout.destroy();cc.stderr.destroy();
});
function grant(extra={}){return Object.freeze({allowRealProcesses:true,purpose:"stripe-relay-operator",deploymentId:APPROVED.id,sha:APPROVED.sha,origin:APPROVED.origin,projectId:APPROVED.projectId,teamId:APPROVED.teamId,accountId:ACCOUNT,allowListener:false,expiresAt:Date.now()+60000,...extra});}
test("native mode cannot be enabled by env, unscoped, expired, production or arbitrary approval",()=>{
 for(const authorization of [undefined,{},grant({expiresAt:0}),grant({accountId:"acct_other"}),grant({deploymentId:"dpl_other"}),grant({origin:"https://production.invalid"}),grant({expiresAt:Date.now()+1000000})])assert.throws(()=>createNativeProcessRunner({authorization,deploymentSelection:"pr60-stage7"}));
 assert.equal(assertNativeAuthorization(grant(),"pr60-stage7").id,APPROVED.id);
});
test("prepared native termination uses owned tree only and waits for close (OS calls mocked)",async()=>{
 const spawn=cp.spawn,exec=cp.execFile,c=child();c.pid=12345;c.exitCode=null;c.signalCode=null;let commands=0;
 try{cp.spawn=()=>c;cp.execFile=(file,args,options,cb)=>{commands++;assert(file.endsWith("taskkill.exe"));assert.deepEqual(args,["/PID","12345","/T","/F"]);assert.equal(options.shell,false);queueMicrotask(()=>{c.exitCode=0;c.emit("close",0,null);cb(null,Buffer.from("synthetic-private"),Buffer.from("synthetic-private"));});};
  const controller=createNativeProcessController({authorization:grant(),selection:"pr60-stage7",validatePlan:()=>{}});const owned=controller.spawn({file:process.execPath,args:[],options:{shell:false}},{});assert.equal((await controller.stop(owned)).exitCode,0);assert.equal(commands,1);await assert.rejects(controller.stop(child()));
 }finally{cp.spawn=spawn;cp.execFile=exec;c.stdout.destroy();c.stderr.destroy();}
});
test("native command registry rejects cloned plans, hidden switch, unauthorized listener and fake native adapters",async()=>{
 const paths={stripeExecutable:path.resolve("synthetic/stripe.exe"),vercelEntry:path.resolve("synthetic/vercel.js"),nodeExecutable:process.execPath,runtimeDirectory:runtime},plan=commands({deploymentSelection:"pr60-stage7",...paths});
 const runner=createNativeProcessRunner({authorization:grant(paths),deploymentSelection:"pr60-stage7"});
 assert.throws(()=>runner.spawn({...plan.version()}));assert.throws(()=>runner.spawn(plan.selectSandbox()));
 assert.throws(()=>runner.spawn(plan.listen(require("../scripts/stripe-preview-launcher").listenArguments(43210))));
 assert.throws(()=>createVercelAdapter({mode:"native",plan,runner:{}}));assert.throws(()=>createStripeAdapter({mode:"native",plan,runner:{}}));
 assert.equal(typeof createVercelAdapter({mode:"native",plan,runner}).obtainToken,"function");
 await runner.dispose();assert.equal(runner.ownedCount(),0);
});
test("public JWKS cache serializes lookups, expires within 60 seconds and refuses stale fallback",async()=>{
 let now=0,loads=0,fail=false;const cache=createPublicKeyCache({now:()=>now,load:async()=>{loads++;if(fail)throw Error("synthetic-private-network");return{keys:[key]};}});
 await Promise.all([cache.get("https://oidc.vercel.com"),cache.get("https://oidc.vercel.com")]);assert.equal(loads,1);assert(Object.isFrozen(await cache.get("https://oidc.vercel.com")));
 now=60001;fail=true;await assert.rejects(cache.get("https://oidc.vercel.com"));assert.equal(loads,2);fail=false;await cache.get("https://oidc.vercel.com");assert.equal(loads,3);cache.dispose();await assert.rejects(cache.get("https://oidc.vercel.com"));
});
test("native cleanup timeout never claims a still-open child exited (OS calls mocked)",async()=>{
 const spawn=cp.spawn,exec=cp.execFile,c=child();c.pid=12345;c.exitCode=null;c.signalCode=null;
 try{cp.spawn=()=>c;cp.execFile=()=>{};const controller=createNativeProcessController({authorization:grant(),selection:"pr60-stage7",timeoutMs:20,validatePlan:()=>{}});controller.spawn({file:process.execPath,args:[],options:{shell:false}},{});await assert.rejects(controller.stop(c),e=>e.code==="PROCESS_CLEANUP_TIMEOUT");}
 finally{cp.spawn=spawn;cp.execFile=exec;c.stdout.destroy();c.stderr.destroy();}
});
test("aborted process capture creates no child and interruption keeps signal",async()=>{
 let spawns=0;const c=child(),runner=createPrivateProcessRunner({mode:"synthetic",spawnMock:()=>{spawns++;queueMicrotask(()=>c.emit("close",null,"SIGTERM"));return c;},stopMock:async()=>{c.stdout.destroy();c.stderr.destroy();}});
 const spec={file:process.execPath,args:[],options:{cwd:runtime,shell:false,stdio:["ignore","pipe","pipe"]}},abort=new AbortController();abort.abort();await assert.rejects(runner.capture(spec,abort.signal));assert.equal(spawns,0);
 await assert.rejects(runner.capture(spec),e=>e.code==="PROCESS_INTERRUPTED"&&e.signal==="SIGTERM");await runner.dispose();
});
