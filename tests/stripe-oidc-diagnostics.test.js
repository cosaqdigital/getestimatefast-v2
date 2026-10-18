"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),crypto=require("node:crypto");
const {createOidcVerifier,createOidcJwksLoader,OidcValidationError,diagnosticCode,DIAGNOSTIC_CODES}=require("../scripts/stripe-oidc-validation");
const {createTokenManager}=require("../scripts/stripe-preview-launcher");
const {PROJECT,TEAM}=require("../scripts/stripe-authorized-deployments");
const pair=crypto.generateKeyPairSync("rsa",{modulusLength:2048});
const key={...pair.publicKey.export({format:"jwk"}),kid:"synthetic-oidc",alg:"RS256",use:"sig"};
const seconds=1700000000,issuer="https://oidc.vercel.com/get-estimate-fast";
const claims={iss:issuer,aud:"https://vercel.com/get-estimate-fast",sub:"owner:get-estimate-fast:project:getestimatefast-v2:environment:development",owner:"get-estimate-fast",owner_id:TEAM,project:"getestimatefast-v2",project_id:PROJECT,environment:"development",iat:seconds-1,nbf:seconds-1,exp:seconds+43200,user_id:"synthetic-private-identity"};
const header={alg:"RS256",typ:"JWT",kid:key.kid},seen=new Set();
const encode=o=>Buffer.from(JSON.stringify(o)).toString("base64url");
function sign(c=claims,h=header){const text=encode(h)+"."+encode(c);return text+"."+crypto.sign("RSA-SHA256",Buffer.from(text),pair.privateKey).toString("base64url");}
const verify=extra=>createOidcVerifier({loadJwks:async()=>({keys:[key]}),now:()=>seconds*1000,...extra});
async function rejects(code,fn){await assert.rejects(fn,e=>{
  assert(e instanceof OidcValidationError);assert.equal(e.code,"OIDC_"+code);assert(!JSON.stringify(e).includes("synthetic-private"));assert(!e.message.includes("eyJ"));assert.equal(e.cause,undefined);seen.add(e.code);return true;
});}
test.after(()=>assert.deepEqual([...seen].sort(),[...DIAGNOSTIC_CODES].sort(),"every declared rejection code is exercised"));
for(const mode of ["development","preview"])for(const iss of [issuer,"https://oidc.vercel.com"])test("documented signed token validates "+mode+" with "+iss,async()=>{
  const c={...claims,iss,environment:mode,sub:"owner:get-estimate-fast:project:getestimatefast-v2:environment:"+mode,exp:seconds+(mode==="development"?43200:7200)};
  assert.equal((await verify()(sign(c))).project_id,PROJECT);
});
for(const [code,value]of [["TOKEN_TYPE",undefined],["TOKEN_TYPE",Buffer.from("synthetic")],["TOKEN_LENGTH","x".repeat(16385)],["TOKEN_FORMAT","a.b"],["TOKEN_FORMAT","a=.b.c"],["HEADER_JSON","eA."+encode(claims)+".eA"],["CLAIMS_JSON",encode(header)+".eA.eA"]])test("structure rejects "+code,()=>rejects(code,()=>verify()(value)));
test("header object required",()=>rejects("HEADER_OBJECT",()=>verify()(sign(claims,null))));
test("claims object required",()=>rejects("CLAIMS_OBJECT",()=>verify()(sign([]))));
for(const [code,change]of [["ALGORITHM",{alg:"none"}],["ALGORITHM",{alg:"HS256"}],["TYPE",{typ:"other"}],["KEY_ID",{kid:""}],["KEY_ID",{kid:null}],["KEY_ID",{kid:"x".repeat(257)}],...["jku","jwk","crit","x5u","b64"].map(name=>["UNTRUSTED_HEADER",{[name]:false}])])test("header rejects "+code+" "+Object.keys(change)[0],()=>rejects(code,()=>verify()(sign(claims,{...header,...change}))));
for(const [code,change]of [["ISSUER",{iss:"https://attacker.invalid"}],["AUDIENCE",{aud:"https://vercel.com/other"}],["AUDIENCE",{aud:[claims.aud]}],["TEAM_ID",{owner_id:"synthetic-private-other"}],["TEAM_SLUG",{owner:"other"}],["PROJECT_ID",{project_id:"other"}],["PROJECT_NAME",{project:"other"}],["SUBJECT",{sub:"synthetic-private-subject"}],["ENVIRONMENT",{environment:"production"}],["ENVIRONMENT",{environment:"custom"}]])test("identity/policy rejects "+code,()=>rejects(code,()=>verify()(sign({...claims,...change}))));
for(const [code,change]of [["EXP_TYPE",{exp:"future"}],["NBF_TYPE",{nbf:undefined}],["IAT_TYPE",{iat:1.5}],["EXP_MARGIN",{exp:seconds+30}],["EXP_MARGIN",{exp:seconds-1,iat:seconds-10,nbf:seconds-10}],["NOT_YET_VALID",{nbf:seconds+1}],["ISSUED_IN_FUTURE",{iat:seconds+1}]])test("time rejects "+code,()=>rejects(code,()=>verify()(sign({...claims,...change}))));
test("invalid clock distinguished",()=>rejects("CLOCK",()=>verify({now:()=>NaN})(sign())));
test("invalid timestamp ordering distinguished",()=>rejects("TIME_ORDER",()=>verify({now:(()=>{let n=0;return()=>++n===1?(seconds+100)*1000:seconds*1000;})()})(sign({...claims,iat:seconds+90,nbf:seconds-1,exp:seconds+90}))));
// Use a past clock to reach ordering after the other independent deadline checks.
test("expiry not after nbf cannot pass ordering",()=>rejects("TIME_ORDER",()=>verify({now:()=>0})(sign({...claims,iat:-2,nbf:-1,exp:-1}))));
test("expiry while fetching keys is rejected after cryptographic verification",()=>rejects("EXP_MARGIN",()=>verify({loadJwks:async()=>({keys:[key]}),now:(()=>{let n=0;return()=>seconds*1000+(++n===1?0:43180000);})()})(sign())));
test("provider errors do not leak",()=>rejects("JWKS_UNAVAILABLE",()=>verify({loadJwks:async()=>{throw Error("synthetic-private-provider");}})(sign())));
test("provider cannot smuggle private message through a diagnostic error",()=>rejects("SOURCE_NETWORK",()=>verify({loadJwks:async()=>{const e=new OidcValidationError("OIDC_SOURCE_NETWORK");e.message="synthetic-private-provider";throw e;}})(sign())));
for(const bad of [null,{keys:null},{keys:[null]},{keys:Array(33).fill(key)}])test("invalid JWKS shape rejected",()=>rejects("JWKS_SHAPE",()=>verify({loadJwks:async()=>bad})(sign())));
test("missing matching kid distinguished",()=>rejects("KEY_NOT_FOUND",()=>verify({loadJwks:async()=>({keys:[]})})(sign())));
test("duplicate kid distinguished",()=>rejects("KEY_AMBIGUOUS",()=>verify({loadJwks:async()=>({keys:[key,key]})})(sign())));
for(const change of [{kty:"EC"},{alg:"HS256"},{use:"enc"},{d:"synthetic-private"}])test("bad key metadata rejected",()=>rejects("KEY_METADATA",()=>verify({loadJwks:async()=>({keys:[{...key,...change}]})})(sign())));
test("invalid RSA material distinguished",()=>rejects("KEY_INVALID",()=>verify({loadJwks:async()=>({keys:[{kid:key.kid,kty:"RSA"}]})})(sign())));
test("signature tampering is distinct from claim rejection",()=>{const parts=sign().split(".");parts[1]=encode({...claims,user_id:"synthetic-private-tampered"});return rejects("SIGNATURE_INVALID",()=>verify()(parts.join(".")));});
test("crypto provider failure sanitized",async()=>{const original=crypto.verify;try{crypto.verify=()=>{throw Error("synthetic-private-crypto");};await rejects("SIGNATURE_ERROR",()=>verify()(sign()));}finally{crypto.verify=original;}});
test("unexpected internal dependency error sanitized",()=>rejects("INTERNAL",()=>verify({now:()=>{throw Error("synthetic-private-internal");}})(sign())));
test("token acquisition distinguished and verification codes preserved through manager",async()=>{
  const a=createTokenManager({obtain:async()=>{throw Error("synthetic-private-acquisition");},verify:verify()});try{await rejects("ACQUISITION",a.get);}finally{a.dispose();}
  const b=createTokenManager({obtain:async()=>sign({...claims,aud:"wrong"}),verify:verify()});try{await rejects("AUDIENCE",b.get);}finally{b.dispose();}
});
const discovery={issuer,jwks_uri:issuer+"/.well-known/jwks"};
const loader=extra=>createOidcJwksLoader({transport:async()=>new Response(JSON.stringify(discovery)),...extra});
test("valid discovery/JWKS mock pins sources and never sends credentials",async()=>{
  let calls=0;const load=loader({transport:async(url,opts)=>{assert(url.startsWith("https://oidc.vercel.com/"));assert.equal(opts.redirect,"error");assert.equal(opts.headers,undefined);return new Response(JSON.stringify(++calls===1?discovery:{keys:[key]}));}});
  assert.equal((await load(issuer)).keys.length,1);
});
test("unapproved source issuer rejected before transport",()=>rejects("SOURCE_ISSUER",()=>loader()("https://attacker.invalid")));
test("source connection error distinguished",()=>rejects("SOURCE_NETWORK",()=>loader({transport:async()=>{throw Error("synthetic-private-network");}})(issuer)));
test("source timeout bounds ignored cancellation",()=>rejects("SOURCE_TIMEOUT",()=>loader({timeoutMs:20,transport:async()=>new Promise(()=>{})})(issuer)));
for(const status of [401,403,503])test("source HTTP failure "+status,()=>rejects("SOURCE_HTTP",()=>loader({transport:async()=>new Response(null,{status})})(issuer)));
for(const status of [301,302,303,307,308])test("source redirect "+status,()=>rejects("SOURCE_REDIRECT",()=>loader({transport:async()=>new Response(null,{status})})(issuer)));
test("redirected final response rejected",()=>rejects("SOURCE_REDIRECT",()=>loader({transport:async()=>({status:200,redirected:true})})(issuer)));
test("source size limit enforced",()=>rejects("SOURCE_LIMIT",()=>loader({transport:async()=>new Response("x".repeat(65537))})(issuer)));
test("source JSON error distinguished",()=>rejects("SOURCE_JSON",()=>loader({transport:async()=>new Response("synthetic-private-invalid-json")})(issuer)));
test("discovery issuer mismatch distinguished",()=>rejects("DISCOVERY_ISSUER",()=>loader({transport:async()=>new Response(JSON.stringify({...discovery,issuer:"other"}))})(issuer)));
for(const uri of [undefined,"invalid","https://attacker.invalid/.well-known/jwks","https://oidc.vercel.com/other","https://oidc.vercel.com/.well-known/jwks?secret=synthetic-private","https://user@oidc.vercel.com/.well-known/jwks"])test("discovery URI rejected",()=>rejects("DISCOVERY_URI",()=>loader({transport:async()=>new Response(JSON.stringify({...discovery,jwks_uri:uri}))})(issuer)));
test("unrecognized errors map to a fixed internal code",()=>{assert.equal(diagnosticCode(Error("synthetic-private")),"OIDC_INTERNAL");assert.equal(new OidcValidationError("synthetic-private").code,"OIDC_INTERNAL");});
