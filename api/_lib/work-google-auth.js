"use strict";
const crypto=require("node:crypto");
const {createClient}=require("@supabase/supabase-js");
const {config,json,method}=require("../admin/_auth");

const COOKIE="gef-work-google",MAX_CHUNKS=4;
class WorkGoogleError extends Error{constructor(status,message){super(message);this.status=status;}}

function settings(){
 const c=config();
 const enabled=process.env.GETESTIMATEFAST_WORK_GOOGLE_ENABLED==="true"||process.env.GETESTIMATEFAST_CONTRACTOR_GOOGLE_ENABLED==="true";
 if(!enabled)throw new WorkGoogleError(503,"Google sign-in is not enabled.");
 const secret=process.env.GETESTIMATEFAST_WORK_AUTH_COOKIE_SECRET||process.env.GETESTIMATEFAST_CONTRACTOR_AUTH_COOKIE_SECRET||process.env.GETESTIMATEFAST_REVIEW_AUTH_COOKIE_SECRET;
 if(typeof secret!=="string"||secret.length<43)throw new WorkGoogleError(503,"Google sign-in is not configured.");
 const u=new URL(process.env.GETESTIMATEFAST_PUBLIC_ORIGIN||"https://www.getestimatefast.com");
 if(u.protocol!=="https:"||u.username||u.password||u.search||u.hash||u.pathname!=="/")throw new WorkGoogleError(503,"Portal origin is not configured.");
 return {...c,origin:u.origin,key:crypto.createHash("sha256").update("work-google-v1:"+secret).digest()};
}
function seal(state,key){const iv=crypto.randomBytes(12),cipher=crypto.createCipheriv("aes-256-gcm",key,iv);const data=Buffer.concat([cipher.update(JSON.stringify(state)),cipher.final()]);return Buffer.concat([iv,cipher.getAuthTag(),data]).toString("base64url");}
function open(value,key){try{const b=Buffer.from(value,"base64url"),d=crypto.createDecipheriv("aes-256-gcm",key,b.subarray(0,12));d.setAuthTag(b.subarray(12,28));const state=JSON.parse(Buffer.concat([d.update(b.subarray(28)),d.final()]));if(!state||state.exp<=Date.now()||!state.kv||Array.isArray(state.kv))throw Error();return state;}catch{return null;}}
function fresh(){return{exp:Date.now()+600000,kv:{}};}
function stateFor(req,c){const pairs=String(req.headers.cookie||"").split(/;\s*/).map(p=>p.split("="));const values=[];for(let i=0;i<MAX_CHUNKS;i++){const m=pairs.find(p=>p[0]===COOKIE+"."+i);if(!m)break;values.push(m[1]);}return open(values.join(""),c.key)||fresh();}
function save(res,state,c){const value=seal(state,c.key),chunks=value.match(/.{1,3500}/g)||[];const out=[];for(let i=0;i<MAX_CHUNKS;i++)out.push(`${COOKIE}.${i}=${chunks[i]||""}; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=${chunks[i]?Math.max(0,Math.floor((state.exp-Date.now())/1000)):0}`);res.setHeader("Set-Cookie",out);}
function clear(res){res.setHeader("Set-Cookie",Array.from({length:MAX_CHUNKS},(_,i)=>`${COOKIE}.${i}=; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=0`));}
function safeSession(value){const s=JSON.parse(value);if(!s||typeof s.access_token!=="string"||typeof s.refresh_token!=="string"||!s.user?.id)throw Error("Invalid session");return JSON.stringify({access_token:s.access_token,refresh_token:s.refresh_token,expires_at:s.expires_at,expires_in:s.expires_in,token_type:"bearer",user:{id:s.user.id}});}
function clientFor(state,c){return createClient(c.url,c.publishable,{auth:{flowType:"pkce",autoRefreshToken:false,detectSessionInUrl:false,persistSession:true,storage:{getItem:k=>state.kv[k]||null,setItem:(k,v)=>{state.kv[k]=k.endsWith("-code-verifier")?v:safeSession(v);},removeItem:k=>{delete state.kv[k];}}}});}
async function googleAvailable(c){try{const r=await fetch(c.url+"/auth/v1/settings",{headers:{apikey:c.publishable},redirect:"error",signal:AbortSignal.timeout(8000)});if(!r.ok)return false;const d=await r.json();return d?.external?.google===true;}catch{return false;}}
function sameOrigin(req,c){if(String(req.headers.origin||"")!==c.origin)throw new WorkGoogleError(403,"Please reopen Find Work and try again.");}
function wrap(allowed,fn){return async(req,res)=>{if(!method(req,res,allowed))return;let c,state;try{c=settings();state=stateFor(req,c);await fn(req,res,state,c,clientFor(state,c));}catch(e){json(res,e.status||503,{error:e instanceof WorkGoogleError?e.message:"Google sign-in is temporarily unavailable."});}};}
function handlers(){
 return{
  start:wrap(["POST"],async(req,res,state,c,client)=>{
   sameOrigin(req,c);
   if(!await googleAvailable(c))throw new WorkGoogleError(503,"Google sign-in is not available yet.");
   state.kv={};state.exp=Date.now()+600000;
   const {data,error}=await client.auth.signInWithOAuth({provider:"google",options:{redirectTo:c.origin+"/api/reviews/auth-callback",skipBrowserRedirect:true,scopes:"openid email profile",queryParams:{prompt:"select_account"}}});
   if(error||!data?.url)throw new WorkGoogleError(503,"Google sign-in could not be started.");
   save(res,state,c);json(res,200,{redirect:data.url});
  }),
  callback:wrap(["GET"],async(req,res,state,c,client)=>{
   let result="cancelled";
   if(!req.query?.error&&typeof req.query?.code==="string"&&req.query.code.length<=2048){
    const {data,error}=await client.auth.exchangeCodeForSession(req.query.code);
    if(!error&&data?.user?.id&&data.user.email_confirmed_at){
     const verified=await client.auth.getUser();
     if(!verified.error&&verified.data.user?.id){
      state.exp=Date.now()+3600000;result="success";
     }
    }
   }
   if(result!=="success")state.kv={};
   save(res,state,c);res.statusCode=303;res.setHeader("Cache-Control","no-store");res.setHeader("Location",c.origin+"/work-portal.html?google="+result);res.end();
  }),
  session:wrap(["GET"],async(req,res,state,c,client)=>{
   const {data,error}=await client.auth.getSession();
   if(error||!data?.session?.access_token)throw new WorkGoogleError(401,"Google session not found.");
   const verified=await client.auth.getUser();
   if(verified.error||!verified.data.user?.id||!verified.data.user.email_confirmed_at)throw new WorkGoogleError(401,"Google session expired.");
   const access_token=data.session.access_token,expires_in=data.session.expires_in||3600;
   clear(res);json(res,200,{access_token,expires_in});
  }),
  logout:wrap(["POST"],async(req,res,state,c)=>{sameOrigin(req,c);state.kv={};clear(res);json(res,200,{signed_out:true});})
 };
}
module.exports={handlers,COOKIE};
