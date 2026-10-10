"use strict";
const crypto=require("node:crypto"),net=require("node:net");
const {createClient}=require("@supabase/supabase-js");
const {config,headers,json,method,readJson,queryDb}=require("../admin/_auth");
const {marketplaceReady}=require("./marketplace-access");
const {text,tokenHash}=require("./public-profile-policy");
const COOKIE="gef-review-auth",MAX_CHUNKS=4,verifiedCsrf=new WeakSet();
class ReviewError extends Error{constructor(status,message){super(message);this.status=status;}}
function settings(){
 const c=config();
 if(process.env.GETESTIMATEFAST_REVIEW_GOOGLE_ENABLED!=="true"||process.env.GETESTIMATEFAST_REVIEW_SCHEMA_APPROVED!=="true")throw new ReviewError(503,"Google reviews are not enabled in this isolated Preview yet.");
 const secret=process.env.GETESTIMATEFAST_REVIEW_AUTH_COOKIE_SECRET;
 if(typeof secret!=="string"||secret.length<43)throw new ReviewError(503,"Review authentication is not configured.");
 const u=new URL(process.env.GETESTIMATEFAST_PUBLIC_ORIGIN);
 const local=u.protocol==="http:"&&["localhost","127.0.0.1"].includes(u.hostname)&&process.env.VERCEL_ENV!=="preview"&&process.env.VERCEL!=="1";
 if((!local&&u.protocol!=="https:")||u.username||u.password||u.search||u.hash||u.pathname!=="/")throw new ReviewError(503,"Review origin is not configured.");
 return {...c,origin:u.origin,secure:!local,key:crypto.createHash("sha256").update(secret).digest()};
}
function seal(state,key){const iv=crypto.randomBytes(12),cipher=crypto.createCipheriv("aes-256-gcm",key,iv);const data=Buffer.concat([cipher.update(JSON.stringify(state)),cipher.final()]);return Buffer.concat([iv,cipher.getAuthTag(),data]).toString("base64url");}
function open(value,key){try{if(!/^[A-Za-z0-9_-]+$/.test(value)||value.length>14000)throw Error();const b=Buffer.from(value,"base64url"),d=crypto.createDecipheriv("aes-256-gcm",key,b.subarray(0,12));d.setAuthTag(b.subarray(12,28));const s=JSON.parse(Buffer.concat([d.update(b.subarray(28)),d.final()]));if(!s||s.exp<=Date.now()||typeof s.csrf!=="string"||!s.kv||Array.isArray(s.kv))throw Error();return s;}catch{return null;}}
function stateFor(req,c){const pairs=String(req.headers.cookie||"").split(/;\s*/).map(p=>p.split("="));const values=[];for(let i=0;i<MAX_CHUNKS;i++){const matches=pairs.filter(p=>p[0]===COOKIE+"."+i);if(matches.length>1)return fresh();if(!matches.length)break;values.push(matches[0][1]);}return open(values.join(""),c.key)||fresh();}
function fresh(){return{csrf:crypto.randomBytes(32).toString("base64url"),exp:Date.now()+600000,kv:{}};}
function save(res,state,c){const value=seal(state,c.key),chunks=value.match(/.{1,3500}/g)||[];if(chunks.length>MAX_CHUNKS)throw new ReviewError(503,"Review session is too large.");const cookies=[];for(let i=0;i<MAX_CHUNKS;i++)cookies.push(`${COOKIE}.${i}=${chunks[i]||""}; Path=/; HttpOnly; SameSite=Lax${c.secure?"; Secure":""}; Max-Age=${chunks[i]?Math.max(0,Math.floor((state.exp-Date.now())/1000)):0}`);res.setHeader("Set-Cookie",cookies);}
function csrf(req,body,state,c){if(!body||Array.isArray(body)||req.headers.origin!==c.origin||typeof body.csrf!=="string"||!/^[A-Za-z0-9_-]{43}$/.test(body.csrf)||!crypto.timingSafeEqual(Buffer.from(body.csrf),Buffer.from(state.csrf)))throw new ReviewError(403,"Please reopen the review invitation and try again.");verifiedCsrf.add(state);}
function safeSession(value){const s=JSON.parse(value);if(!s||typeof s.access_token!=="string"||typeof s.refresh_token!=="string"||!s.user?.id)throw Error("Invalid session");return JSON.stringify({access_token:s.access_token,refresh_token:s.refresh_token,expires_at:s.expires_at,expires_in:s.expires_in,token_type:"bearer",user:{id:s.user.id}});}
function clientFor(state,c,factory){return factory(c.url,c.publishable,{auth:{flowType:"pkce",autoRefreshToken:false,detectSessionInUrl:false,persistSession:true,storage:{getItem:k=>state.kv[k]||null,setItem:(k,v)=>{state.kv[k]=k.endsWith("-code-verifier")?v:safeSession(v);},removeItem:k=>{delete state.kv[k];}}}});}
function googleIdentity(user){const i=user?.identities?.find(i=>i.provider==="google"),sub=i?.provider_id||i?.identity_data?.sub;if(!user?.id||!user.email_confirmed_at||user.is_anonymous||typeof sub!=="string"||!sub||sub.length>255||/\s/.test(sub)||i.identity_data?.email_verified!==true|| (i.provider_id&&i.identity_data?.sub&&i.provider_id!==i.identity_data.sub))throw new ReviewError(401,"Continue with Google to submit your review.");return{id:user.id,sub,email:i.identity_data.email||user.email};}
async function current(client,state){if(!state.google)throw new ReviewError(401,"Continue with Google to submit your review.");const {data,error}=await client.auth.getUser();if(error)throw new ReviewError(401,"Your session expired. Continue with Google again.");const id=googleIdentity(data.user);if(id.id!==state.google.id||id.sub!==state.google.sub)throw new ReviewError(401,"Your account changed. Continue with Google again.");return id;}
const rpc=(name,p)=>queryDb("rpc/"+name,{method:"POST",body:JSON.stringify(p)});
async function invitation(state){if(!state.invite)throw new ReviewError(409,"Open the review invitation shared by your professional.");const row=await rpc("gef_review_invitation_context",{p_hash:tokenHash(state.invite)});if(!row)throw new ReviewError(409,"This invitation is unavailable or has already been used.");return row;}
async function notOwner(identity,ctx,c){if(identity.id===ctx.contractor_id)throw new ReviewError(403,"You cannot review your own professional profile.");const r=await fetch(c.url+"/auth/v1/admin/users/"+encodeURIComponent(ctx.contractor_id),{headers:headers(c.secret),signal:AbortSignal.timeout(10000)});if(!r.ok)throw new ReviewError(503,"Unable to verify profile ownership. Please try again later.");const owner=await r.json();if(owner.identities?.some(i=>i.provider==="google"&&(i.provider_id||i.identity_data?.sub)===identity.sub)||(owner.email_confirmed_at&&owner.email&&identity.email&&owner.email.toLowerCase()===identity.email.toLowerCase()))throw new ReviewError(403,"You cannot review your own professional profile.");}
function parseContent(v){if(!Number.isInteger(v.rating)||v.rating<1||v.rating>5||v.consent!==true||v.website)throw new ReviewError(400,"Choose a rating and confirm that this review describes your own experience.");try{return{display_name:text(v.display_name,2,80),rating:v.rating,comment:text(v.comment,10,1500)};}catch{throw new ReviewError(400,"Enter a display name and a review between 10 and 1,500 characters.");}}
function createHandlers(factory=createClient){
 const wrap=(allowed,fn)=>async(req,res)=>{
  if(!method(req,res,allowed))return;
  let c,s;
  try{
   if(!marketplaceReady(req,res))return;
   c=settings();s=stateFor(req,c);
   const client=clientFor(s,c,factory);
   await fn(req,res,s,c,client);
  }catch(e){
   // A validated POST may refresh credentials before content/SQL rejects it.
   // Persist those credentials, but never set cookies for a rejected CSRF request.
   if(c&&s&&verifiedCsrf.has(s)){try{save(res,s,c);}catch{/* Fail closed with generic error. */}}
   json(res,e instanceof SyntaxError?400:e.status||(e.reviewConflict?409:503),{error:e.reviewConflict||(e instanceof SyntaxError?"Send a valid review request.":e instanceof ReviewError?e.message:"Review service temporarily unavailable. Please try again later.")});
  }
 };
 return{
  session:wrap(["GET"],async(req,res,s,c,client)=>{let authenticated=false;try{await current(client,s);authenticated=true;}catch(e){if(e.status!==401)throw e;}let profile=null;if(s.invite){try{const ctx=await invitation(s);profile={display_name:ctx.display_name,slug:ctx.slug};}catch(e){if(e.status!==409)throw e;delete s.invite;}}save(res,s,c);json(res,200,{authenticated,profile,csrf:s.csrf});}),
  authStart:wrap(["POST"],async(req,res,s,c,client)=>{const b=await readJson(req,2000);csrf(req,b,s,c);if(b.token){tokenHash(b.token);s.invite=b.token;}await invitation(s);delete s.google;s.kv={};s.exp=Date.now()+600000;const {data,error}=await client.auth.signInWithOAuth({provider:"google",options:{redirectTo:c.origin+"/api/reviews/auth-callback",skipBrowserRedirect:true,scopes:"openid email profile",queryParams:{prompt:"select_account"}}});if(error||!data?.url)throw new ReviewError(503,"Google sign-in could not be started.");const target=new URL(data.url);if(target.origin!==c.url||target.pathname!=="/auth/v1/authorize"||target.searchParams.get("provider")!=="google")throw new ReviewError(503,"Google sign-in could not be started.");save(res,s,c);json(res,200,{redirect:data.url});}),
  callback:wrap(["GET"],async(req,res,s,c,client)=>{await invitation(s);let result="cancelled";if(!req.query?.error&&typeof req.query?.code==="string"&&req.query.code.length<=2048){const {data,error}=await client.auth.exchangeCodeForSession(req.query.code);if(!error&&data?.user){const verified=await client.auth.getUser();if(!verified.error){const id=googleIdentity(verified.data.user);s.google={id:id.id,sub:id.sub};s.exp=Date.now()+3600000;result="success";}}}if(result!=="success"){s.kv={};delete s.google;}save(res,s,c);res.statusCode=303;res.setHeader("Cache-Control","no-store");res.setHeader("Referrer-Policy","no-referrer");res.setHeader("Location",c.origin+"/review.html?auth="+result);res.end();}),
  submit:wrap(["POST"],async(req,res,s,c,client)=>{const b=await readJson(req,6000);csrf(req,b,s,c);const id=await current(client,s),content=parseContent(b),ctx=await invitation(s);await notOwner(id,ctx,c);const ip=process.env.VERCEL==="1"?String(req.headers["x-vercel-forwarded-for"]||"").split(",")[0].trim():req.socket?.remoteAddress;if(!net.isIP(ip||""))throw new ReviewError(503,"Review service temporarily unavailable.");const rate=crypto.createHmac("sha256",c.key).update("review:"+id.sub+":"+ip).digest("hex");if(!await rpc("gef_public_request_allowed",{p_hash:rate,p_limit:10}))throw new ReviewError(429,"Too many submissions. Please try again later.");const result=await rpc("gef_submit_authenticated_review",{p_actor:id.id,p_google_subject:id.sub,p_review:{...content,token_hash:tokenHash(s.invite)}});delete s.invite;save(res,s,c);json(res,201,result);}),
  logout:wrap(["POST"],async(req,res,s,c,client)=>{const b=await readJson(req,2000);csrf(req,b,s,c);await client.auth.signOut({scope:"local"});s.kv={};delete s.google;s.csrf=crypto.randomBytes(32).toString("base64url");s.exp=Date.now()+600000;save(res,s,c);json(res,200,{signed_out:true});})
 };
}
module.exports={createHandlers,seal,open,safeSession,googleIdentity,parseContent,COOKIE};
