"use strict";
const crypto=require("node:crypto");
const {createClient}=require("@supabase/supabase-js");
const {config,headers,json,method,readJson,queryDb}=require("../admin/_auth");
const {normalizeUsPhone}=require("./telnyx-us-provider");

const COOKIE="gef-contractor-google",MAX_CHUNKS=4;
class ContractorGoogleError extends Error{constructor(status,message){super(message);this.status=status;}}

function settings(){
 const c=config();
 if(process.env.GETESTIMATEFAST_CONTRACTOR_GOOGLE_ENABLED!=="true")throw new ContractorGoogleError(503,"Google sign-in is not enabled.");
 const secret=process.env.GETESTIMATEFAST_CONTRACTOR_AUTH_COOKIE_SECRET||process.env.GETESTIMATEFAST_REVIEW_AUTH_COOKIE_SECRET;
 if(typeof secret!=="string"||secret.length<43)throw new ContractorGoogleError(503,"Google sign-in is not configured.");
 const u=new URL(process.env.GETESTIMATEFAST_PUBLIC_ORIGIN||"https://www.getestimatefast.com");
 if(u.protocol!=="https:"||u.username||u.password||u.search||u.hash||u.pathname!=="/")throw new ContractorGoogleError(503,"Portal origin is not configured.");
 return {...c,origin:u.origin,key:crypto.createHash("sha256").update(secret).digest()};
}
function seal(state,key){const iv=crypto.randomBytes(12),cipher=crypto.createCipheriv("aes-256-gcm",key,iv);const data=Buffer.concat([cipher.update(JSON.stringify(state)),cipher.final()]);return Buffer.concat([iv,cipher.getAuthTag(),data]).toString("base64url");}
function open(value,key){try{const b=Buffer.from(value,"base64url"),d=crypto.createDecipheriv("aes-256-gcm",key,b.subarray(0,12));d.setAuthTag(b.subarray(12,28));const state=JSON.parse(Buffer.concat([d.update(b.subarray(28)),d.final()]));if(!state||state.exp<=Date.now()||!state.kv||Array.isArray(state.kv))throw Error();return state;}catch{return null;}}
function fresh(){return{exp:Date.now()+600000,kv:{},mode:"login"};}
function stateFor(req,c){const pairs=String(req.headers.cookie||"").split(/;\s*/).map(p=>p.split("="));const values=[];for(let i=0;i<MAX_CHUNKS;i++){const m=pairs.find(p=>p[0]===COOKIE+"."+i);if(!m)break;values.push(m[1]);}return open(values.join(""),c.key)||fresh();}
function save(res,state,c){const value=seal(state,c.key),chunks=value.match(/.{1,3500}/g)||[];const out=[];for(let i=0;i<MAX_CHUNKS;i++)out.push(`${COOKIE}.${i}=${chunks[i]||""}; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=${chunks[i]?Math.max(0,Math.floor((state.exp-Date.now())/1000)):0}`);res.setHeader("Set-Cookie",out);}
function clear(res){res.setHeader("Set-Cookie",Array.from({length:MAX_CHUNKS},(_,i)=>`${COOKIE}.${i}=; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=0`));}
function safeSession(value){const s=JSON.parse(value);if(!s||typeof s.access_token!=="string"||typeof s.refresh_token!=="string"||!s.user?.id)throw Error("Invalid session");return JSON.stringify({access_token:s.access_token,refresh_token:s.refresh_token,expires_at:s.expires_at,expires_in:s.expires_in,token_type:"bearer",user:{id:s.user.id}});}
function clientFor(state,c){return createClient(c.url,c.publishable,{auth:{flowType:"pkce",autoRefreshToken:false,detectSessionInUrl:false,persistSession:true,storage:{getItem:k=>state.kv[k]||null,setItem:(k,v)=>{state.kv[k]=k.endsWith("-code-verifier")?v:safeSession(v);},removeItem:k=>{delete state.kv[k];}}}});}
async function googleAvailable(c){try{const r=await fetch(c.url+"/auth/v1/settings",{headers:{apikey:c.publishable},redirect:"error",signal:AbortSignal.timeout(8000)});if(!r.ok)return false;const d=await r.json();return d?.external?.google===true;}catch{return false;}}
function sameOrigin(req,c){if(String(req.headers.origin||"")!==c.origin)throw new ContractorGoogleError(403,"Please reopen the professional portal and try again.");}
async function persistSignup(user,state){
 if(state.mode!=="signup")return;
 const phone=String(state.signup?.phone||"").trim(),smsPhone=normalizeUsPhone(phone);
 if(!user?.id||!user.email||!smsPhone)throw new ContractorGoogleError(400,"Complete the Google registration form again.");
 const now=new Date().toISOString();
 const privacy=String(process.env.GETESTIMATEFAST_PRIVACY_VERSION||"").trim(),terms=String(process.env.GETESTIMATEFAST_TERMS_VERSION||"").trim();
 await queryDb("contractor_signup_consents?on_conflict=user_id",{method:"POST",headers:{Prefer:"return=representation,resolution=merge-duplicates"},body:JSON.stringify({
  user_id:user.id,contact_email:user.email.toLowerCase(),contact_phone:phone,sms_phone_e164:smsPhone,sms_opt_in:state.signup.smsOptIn===true,
  sms_opt_in_at:state.signup.smsOptIn===true?now:null,privacy_accepted_at:now,privacy_version:privacy,terms_accepted_at:now,terms_version:terms
 })});
}
async function hasProfessionalRecord(userId){
 const [profiles,consents]=await Promise.all([
  queryDb("contractor_profiles?user_id=eq."+encodeURIComponent(userId)+"&select=user_id&limit=1"),
  queryDb("contractor_signup_consents?user_id=eq."+encodeURIComponent(userId)+"&select=user_id&limit=1")
 ]);
 return Boolean(profiles[0]||consents[0]);
}
function wrap(allowed,fn){return async(req,res)=>{if(!method(req,res,allowed))return;let c,state;try{c=settings();state=stateFor(req,c);await fn(req,res,state,c,clientFor(state,c));}catch(e){json(res,e.status||503,{error:e instanceof ContractorGoogleError?e.message:"Google sign-in is temporarily unavailable."});}};}
function handlers(){
 return{
  start:wrap(["POST"],async(req,res,state,c,client)=>{
   sameOrigin(req,c);
   if(!await googleAvailable(c))throw new ContractorGoogleError(503,"Google sign-in is not available yet.");
   const body=await readJson(req,3000),mode=body.mode==="signup"?"signup":"login";
   state.mode=mode;state.kv={};state.exp=Date.now()+600000;delete state.signup;
   if(mode==="signup"){
    const phone=String(body.phone||"").trim(),smsPhone=normalizeUsPhone(phone);
    if(!smsPhone||phone.length>35||body.privacyConsent!==true||body.termsConsent!==true||typeof body.smsOptIn!=="boolean")throw new ContractorGoogleError(400,"Enter a valid US mobile number and accept the Privacy Policy and Terms of Use.");
    state.signup={phone,smsOptIn:body.smsOptIn};
   }
   const {data,error}=await client.auth.signInWithOAuth({provider:"google",options:{redirectTo:c.origin+"/api/contractor/google-callback",skipBrowserRedirect:true,scopes:"openid email profile",queryParams:{prompt:"select_account"}}});
   if(error||!data?.url)throw new ContractorGoogleError(503,"Google sign-in could not be started.");
   save(res,state,c);json(res,200,{redirect:data.url});
  }),
  callback:wrap(["GET"],async(req,res,state,c,client)=>{
   let result="cancelled";
   if(!req.query?.error&&typeof req.query?.code==="string"&&req.query.code.length<=2048){
    const {data,error}=await client.auth.exchangeCodeForSession(req.query.code);
    if(!error&&data?.user?.id&&data.user.email_confirmed_at){
     const verified=await client.auth.getUser();
     if(!verified.error){
      const user=verified.data.user;
      if(state.mode==="login"&&!await hasProfessionalRecord(user.id)){
       await client.auth.signOut({scope:"local"});state.kv={};result="needs_signup";
      }else{
       await persistSignup(user,state);state.exp=Date.now()+3600000;result="success";
      }
     }
    }
   }
   if(result!=="success")state.kv={};
   save(res,state,c);res.statusCode=303;res.setHeader("Cache-Control","no-store");res.setHeader("Location",c.origin+"/contractor-portal.html?google="+result);res.end();
  }),
  session:wrap(["GET"],async(req,res,state,c,client)=>{
   const {data,error}=await client.auth.getSession();
   if(error||!data?.session?.access_token)throw new ContractorGoogleError(401,"Google session not found.");
   const verified=await client.auth.getUser();
   if(verified.error||!verified.data.user?.id||!verified.data.user.email_confirmed_at)throw new ContractorGoogleError(401,"Google session expired.");
   const access_token=data.session.access_token,expires_in=data.session.expires_in||3600;
   clear(res);json(res,200,{access_token,expires_in});
  })
 };
}
module.exports={handlers,seal,open,googleAvailable,COOKIE};
