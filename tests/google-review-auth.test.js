"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),crypto=require("node:crypto"),fs=require("node:fs"),path=require("node:path"),{Readable}=require("node:stream");
const {createClient}=require("@supabase/supabase-js"),{createSandbox}=require("../scripts/local-marketplace-sandbox");
const {createHandlers,open,seal,safeSession,googleIdentity}=require("../api/_lib/review-auth");
const root=path.resolve(__dirname,"..");
test("real Supabase SDK PKCE + encrypted cookies + local SQL: identity, privacy, legacy and reputation",async()=>{
 const s=await createSandbox();
 try{
  const profile={slug:"synthetic-google-profile",display_name:"Synthetic Google Provider",headline:"Synthetic review fixture",about:"No real customer or service is involved.",city:"Riverview",state_code:"FL",zip_code:"33569",radius_miles:25,categories:["Painting"],languages:["English"],social_links:[],portfolio:[],published:true,publish_email:false,publish_phone:false};
  await s.db.query("select gef_save_public_profile($1,$2::jsonb)",[s.ids.contractor,JSON.stringify(profile)]);
  const makeInvite=async()=>{const token=crypto.randomBytes(32).toString("base64url");await s.db.query("select gef_create_review_invitation($1,$2)",[s.ids.contractor,crypto.createHash("sha256").update(token).digest("hex")]);return token;};
  const legacyToken=await makeInvite();const legacy=(await s.db.query("select gef_submit_review($1::jsonb) r",[JSON.stringify({token_hash:crypto.createHash("sha256").update(legacyToken).digest("hex"),identity_hash:"c".repeat(64),display_name:"Synthetic legacy",rating:5,comment:"Synthetic legacy review preserved for migration."})])).rows[0].r;
  await s.db.query("select gef_moderate_review($1,$2,'approved','Synthetic legacy approval','legacy-google-test')",[s.ids.admin,legacy.review_id]);
  const files=fs.readdirSync(path.join(root,"supabase/migrations")).filter(n=>n.includes("review_")).sort();assert.equal(files.length,4);assert.equal(new Set(files.map(n=>n.split("_")[0])).size,4);
  for(const f of files)await s.db.exec(fs.readFileSync(path.join(root,"supabase/migrations",f),"utf8"));
  const projection=async()=>(await s.db.query("select gef_public_profile('synthetic-google-profile') r")).rows[0].r;
  assert.deepEqual((await projection()).review_summary,{approved_count:0,average_rating:null});assert.equal((await s.db.query("select prior_status from gef_private.review_legacy_classifications where review_id=$1",[legacy.review_id])).rows[0].prior_status,"approved");assert.equal((await s.db.query("select status from contractor_reviews where id=$1",[legacy.review_id])).rows[0].status,"approved");
  assert.equal((await s.db.query("select gef_admin_marketplace($1) r",[s.ids.admin])).rows[0].r.reviews.find(r=>r.id===legacy.review_id).identity_verified,false);
  await assert.rejects(s.db.query("select gef_submit_review('{}'::jsonb)"),/Google authentication required/);
  for(const role of ["anon","authenticated"]){const r=await s.db.query("select has_function_privilege($1,'public.gef_submit_authenticated_review(uuid,text,jsonb)','EXECUTE') allowed,has_table_privilege($1,'gef_private.review_authenticated_identities','SELECT') readable",[role]);assert.equal(r.rows[0].allowed,false);assert.equal(r.rows[0].readable,false);}
  Object.assign(process.env,{GETESTIMATEFAST_REVIEW_GOOGLE_ENABLED:"true",GETESTIMATEFAST_REVIEW_SCHEMA_APPROVED:"true",GETESTIMATEFAST_REVIEW_AUTH_COOKIE_SECRET:crypto.randomBytes(32).toString("base64url")});
  const customer={id:crypto.randomUUID(),email:"synthetic-google-customer@example.invalid",email_confirmed_at:new Date().toISOString()};
  await s.db.query("insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())",[customer.id,customer.email]);s.users["synthetic-reviewer"]=customer;
  const identities=[customer,s.users["synthetic-contractor"]];for(const [i,u]of identities.entries())u.identities=[{provider:"google",provider_id:"synthetic-google-"+i,identity_data:{sub:"synthetic-google-"+i,email:u.email,email_verified:true}}];
  let active=identities[0],challenge,usedCodes=new Set(),requests=0;const tokens=new Map();
  const factory=(url,key,options)=>createClient(url,key,{...options,global:{fetch:async(input,init={})=>{requests++;const u=new URL(String(input)),h=new Headers(init.headers);assert.equal(u.origin,s.origin);const respond=(d,status=200)=>new Response(JSON.stringify(d),{status,headers:{"Content-Type":"application/json"}});
   if(u.pathname==="/auth/v1/token"&&u.searchParams.get("grant_type")==="pkce"){
    const b=JSON.parse(init.body);if(b.auth_code!=="synthetic-code"||usedCodes.has(b.auth_code)||crypto.createHash("sha256").update(b.code_verifier).digest("base64url")!==challenge)return respond({error:"invalid_grant",error_description:"Synthetic invalid code"},400);usedCodes.add(b.auth_code);
    const access=[Buffer.from(JSON.stringify({alg:"HS256",typ:"JWT"})).toString("base64url"),Buffer.from(JSON.stringify({sub:active.id,exp:Math.floor(Date.now()/1000)+3600,aud:"authenticated",role:"authenticated"})).toString("base64url"),"synthetic-signature"].join(".");tokens.set(access,active);
    return respond({access_token:access,refresh_token:"synthetic-refresh-token",expires_in:3600,token_type:"bearer",user:active,provider_token:"SYNTHETIC_PRIVATE_GOOGLE_TOKEN",provider_refresh_token:"SYNTHETIC_PRIVATE_GOOGLE_REFRESH"});
   }
   if(u.pathname==="/auth/v1/user")return tokens.has(h.get("Authorization")?.replace("Bearer ",""))?respond(tokens.get(h.get("Authorization").replace("Bearer ",""))):respond({msg:"Synthetic expired session"},401);
   if(u.pathname==="/auth/v1/logout")return new Response(null,{status:204});throw Error("Unexpected SDK transport endpoint");
  }}});
  const handlers=createHandlers(factory),jar=new Map();
  const invoke=async(name,body,query={},origin=s.origin)=>{const req=Readable.from(body?[Buffer.from(JSON.stringify(body))]:[]);req.method=["session","callback"].includes(name)?"GET":"POST";req.headers={cookie:[...jar].map(([k,v])=>k+"="+v).join("; "),origin};req.query=query;req.socket={remoteAddress:"127.0.0.1"};let data;const hs={};const res={setHeader(k,v){hs[k]=v;},end(v){data=v?JSON.parse(v):null;}};await handlers[name](req,res);for(const cookie of hs["Set-Cookie"]||[]){const [k,v]=cookie.split(";")[0].split("=");v?jar.set(k,v):jar.delete(k);}return{status:res.statusCode,data,headers:hs};};
  let sess=await invoke("session");assert.equal(sess.status,200);let csrf=sess.data.csrf;
  assert.equal((await invoke("authStart",{csrf,token:await makeInvite()},{},"https://evil.example.invalid")).status,403);
  assert.equal((await invoke("submit",{csrf,rating:5,consent:true})).status,401);
  const token=await makeInvite();let start=await invoke("authStart",{csrf,token});assert.equal(start.status,200);const redirect=new URL(start.data.redirect);assert.equal(redirect.searchParams.get("provider"),"google");challenge=redirect.searchParams.get("code_challenge");assert(challenge);assert.equal(redirect.searchParams.get("code_challenge_method"),"s256");assert(!start.data.redirect.includes(token));assert(!jar.values().next().value.includes(token));
  const cookieBefore=[...jar.values()].join("");assert((await invoke("callback",null,{code:"synthetic-code"})).headers.Location.endsWith("/review.html?auth=success"));sess=await invoke("session");assert.equal(sess.data.authenticated,true);assert.equal(sess.data.profile.display_name,profile.display_name);assert(!JSON.stringify(sess.data).includes("@"));
  const cookie=[...jar.values()].join(""),key=crypto.createHash("sha256").update(process.env.GETESTIMATEFAST_REVIEW_AUTH_COOKIE_SECRET).digest(),state=open(cookie,key);assert(state.invite===token);assert(!JSON.stringify(state).includes("SYNTHETIC_PRIVATE_GOOGLE"));assert(!JSON.stringify(state.kv).includes("@"));assert.notEqual(cookie,cookieBefore);
  assert.equal(Number((await s.db.query("select count(*) n from contractor_profiles where user_id=$1",[customer.id])).rows[0].n),0);
  // Google cancellation clears authority but keeps the invitation for retry.
  const successfulJar=new Map(jar);const cancelled=await invoke("callback",null,{error:"access_denied"});assert(cancelled.headers.Location.endsWith("auth=cancelled"));assert.equal((await invoke("session")).data.authenticated,false);assert.equal(open([...jar.values()].join(""),key).invite,token);jar.clear();for(const [k,v]of successfulJar)jar.set(k,v);
  const replay=await invoke("callback",null,{code:"synthetic-code"});assert(replay.headers.Location.endsWith("auth=cancelled"));assert.equal((await invoke("session")).data.authenticated,false);jar.clear();for(const [k,v]of successfulJar)jar.set(k,v);
  const content={csrf,display_name:"Synthetic Google Reviewer",rating:4,comment:"A synthetic authenticated review used only locally.",consent:true,contractor_id:s.ids.other,status:"approved",source:"platform_contact",reviewer_user_id:s.ids.contractor,provider_subject:"spoofed"};
  assert.equal((await invoke("submit",{...content,csrf:"x".repeat(43)})).status,403);assert.equal((await invoke("submit",{...content,rating:6})).status,400);
  const review=await invoke("submit",content);assert.equal(review.status,201);assert.equal((await projection()).reviews.length,0);const saved=(await s.db.query("select contractor_id,status,source,identity_hash from contractor_reviews where id=$1",[review.data.review_id])).rows[0];assert.equal(saved.contractor_id,s.ids.contractor);assert.equal(saved.status,"pending");assert.equal(saved.source,"external");assert.equal(saved.identity_hash,null);
  assert.equal((await s.db.query("select gef_admin_marketplace($1) r",[s.ids.admin])).rows[0].r.reviews.find(r=>r.id===review.data.review_id).identity_verified,true);
  await s.db.query("select gef_moderate_review($1,$2,'approved','Synthetic Google approval','google-approve-test')",[s.ids.admin,review.data.review_id]);let p=await projection();assert.deepEqual(p.review_summary,{approved_count:1,average_rating:4});assert(!/provider_subject|reviewer_user_id|identity_hash|@example/.test(JSON.stringify(p)));
  await s.db.query("select gef_moderate_review($1,$2,'hidden','Synthetic Google hide','google-hide-test')",[s.ids.admin,review.data.review_id]);assert.equal((await projection()).review_summary.approved_count,0);
  // A second invitation and rejected/hidden status never free the identity slot.
  const another=await makeInvite();state.invite=another;jar.clear();const encrypted=seal(state,key);for(const [i,chunk]of encrypted.match(/.{1,3500}/g).entries())jar.set("gef-review-auth."+i,chunk);assert.equal((await invoke("submit",content)).status,409);assert.equal((await s.db.query("select used_at from gef_private.review_invitations where token_hash=$1",[crypto.createHash("sha256").update(another).digest("hex")])).rows[0].used_at,null);
  // Own profile is rejected by SQL even if a server caller skips its check.
  await assert.rejects(s.db.query("select gef_submit_authenticated_review($1,'synthetic-owner',$2::jsonb)",[s.ids.contractor,JSON.stringify({token_hash:crypto.createHash("sha256").update(another).digest("hex"),display_name:"Synthetic owner",rating:5,comment:"Synthetic self-review denial."})]),/Self-review/);
  // Own Google identity, or the owner's confirmed Auth email, is denied server-side.
  state.google={id:identities[0].id,sub:identities[0].identities[0].provider_id};identities[0].identities[0].identity_data.email=identities[1].email;jar.clear();for(const [i,chunk]of seal(state,key).match(/.{1,3500}/g).entries())jar.set("gef-review-auth."+i,chunk);assert.equal((await invoke("submit",content)).status,403);identities[0].identities[0].identity_data.email=identities[0].email;
  const beforeLogout=new Map(jar);assert.equal((await invoke("logout",{csrf})).status,200);assert.equal((await invoke("session")).data.authenticated,false);jar.clear();for(const [k,v]of beforeLogout)jar.set(k,v);
  // Tamper/expire cookies: no session and no SQL write.
  jar.set("gef-review-auth.0","x"+jar.get("gef-review-auth.0").slice(1));assert.equal((await invoke("submit",content)).status,403);
  assert.equal(open(seal({...state,exp:Date.now()-1},key),key),null);assert(requests>0);
 }finally{await s.close();}
});
test("Google review storage and identity reject provider token exposure and untrusted claims",()=>{
 const raw=JSON.stringify({access_token:"synthetic",refresh_token:"synthetic",expires_at:123,user:{id:"synthetic",email:"private@example.invalid",identities:[{provider:"google"}]},provider_token:"private-google",provider_refresh_token:"private-refresh"});const stored=safeSession(raw);assert(!/private|identities|email|provider_token/.test(stored));
 assert.throws(()=>googleIdentity({id:"fake",email_confirmed_at:"now",user_metadata:{provider:"google",sub:"spoofed"}}));assert.throws(()=>googleIdentity({id:"fake",email_confirmed_at:"now",is_anonymous:true,identities:[{provider:"google",provider_id:"fake",identity_data:{email_verified:true}}]}));
});
test("Google endpoints fail closed before SDK/provider access without rollout approval",async()=>{
 const previous={...process.env};let calls=0;
 try{
  Object.assign(process.env,{VERCEL_ENV:"development",GETESTIMATEFAST_ISOLATED_BACKEND:"true",GETESTIMATEFAST_MARKETPLACE_PREVIEW:"true",GETESTIMATEFAST_SUPABASE_URL:"http://127.0.0.1:54321",GETESTIMATEFAST_SUPABASE_SECRET_KEY:"synthetic",GETESTIMATEFAST_SUPABASE_PUBLISHABLE_KEY:"synthetic",GETESTIMATEFAST_PUBLIC_ORIGIN:"http://127.0.0.1:54321"});delete process.env.VERCEL;
  const h=createHandlers(()=>{calls++;throw Error("Unexpected SDK initialization");});
  for(const flags of [{GETESTIMATEFAST_REVIEW_GOOGLE_ENABLED:"false",GETESTIMATEFAST_REVIEW_SCHEMA_APPROVED:"false"},{GETESTIMATEFAST_REVIEW_GOOGLE_ENABLED:"true",GETESTIMATEFAST_REVIEW_SCHEMA_APPROVED:"false"},{GETESTIMATEFAST_REVIEW_GOOGLE_ENABLED:"true",GETESTIMATEFAST_REVIEW_SCHEMA_APPROVED:"true",GETESTIMATEFAST_REVIEW_AUTH_COOKIE_SECRET:""},{VERCEL_ENV:"production"}]){
   Object.assign(process.env,flags);const req=Readable.from([]);req.method="GET";req.headers={};let data;const res={setHeader(){},end(s){data=JSON.parse(s);}};await h.session(req,res);assert.equal(res.statusCode,503);assert(data.error);assert.equal(calls,0);
  }
 }finally{for(const k of Object.keys(process.env))if(!(k in previous))delete process.env[k];Object.assign(process.env,previous);}
});
