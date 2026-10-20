"use strict";
const {test}=require('node:test'),assert=require('node:assert/strict'),{Readable}=require('node:stream');
const base={VERCEL_ENV:'production',GETESTIMATEFAST_SUPABASE_URL:'https://wedsjubkttygxtpkopfj.supabase.co',GETESTIMATEFAST_SUPABASE_SECRET_KEY:'SYNTHETIC_ONLY',GETESTIMATEFAST_SUPABASE_PUBLISHABLE_KEY:'SYNTHETIC_ONLY',GETESTIMATEFAST_ISOLATED_BACKEND:'false',GETESTIMATEFAST_MARKETPLACE_PRODUCTION_ENABLED:'false',GETESTIMATEFAST_MARKETPLACE_SCHEMA_APPROVED:'false',GETESTIMATEFAST_MARKETPLACE_PREVIEW:'false',GETESTIMATEFAST_SMS_MODE:'disabled',CONTRACTOR_SIGNUP_ENABLED:'false',CONTRACTOR_PROFILE_EDITING_ENABLED:'false',LEAD_PERSISTENCE_ENABLED:'false'};
const id='11111111-1111-4111-8111-111111111111';
function req(method='GET',query={},body={}){const r=Readable.from([Buffer.from(JSON.stringify(body))]);r.method=method;r.headers={authorization:'Bearer SYNTHETIC_ONLY',host:'localhost'};r.query=query;return r;}
async function harness(fn,{env={},admin=true,db=()=>[]}={}){
 const values={...base,...env},old=Object.fromEntries(Object.keys(values).map(k=>[k,process.env[k]])),fetch=global.fetch,error=console.error,calls=[],logs=[];
 Object.assign(process.env,values);console.error=(...args)=>logs.push(args.join(' '));
 global.fetch=async(url,opts={})=>{calls.push({url:String(url),opts});let data;
  if(String(url).endsWith('/auth/v1/user'))data={id,email_confirmed_at:'2026-01-01'};
  else if(String(url).includes('/admin_users?'))data=admin?[{user_id:id}]:[];
  else data=await db(String(url),opts);
  if(data instanceof Response)return data;
  return new Response(JSON.stringify(data),{headers:{'content-type':'application/json'}});
 };
 const call=async(file,r=req())=>{const res={statusCode:200,headers:{},setHeader(k,v){this.headers[k.toLowerCase()]=v;},end(body){this.body=body;}};await require('../api/'+file)(r,res);return res;};
 try{await fn({call,calls,logs});}finally{global.fetch=fetch;console.error=error;for(const [k,v]of Object.entries(old))if(v===undefined)delete process.env[k];else process.env[k]=v;}
}
test('Production admin list/history remain readable with marketplace and schema gates false',async()=>harness(async({call,calls})=>{
 for(const [file,r] of [['admin/contractors',req('GET',{status:'active',page:'0'})],['admin/contractor-history',req('GET',{user_id:id})]]){
  const res=await call(file,r);assert.equal(res.statusCode,200);assert.equal(res.headers['cache-control'],'no-store');
 }
 assert.ok(calls.every(c=>!c.opts.method||c.opts.method==='GET'));assert.ok(calls.every(c=>c.url.startsWith(base.GETESTIMATEFAST_SUPABASE_URL)));
 assert.ok(calls.every(c=>c.opts.redirect==='error'));
}));
test('ordinary contractor cannot read admin contractor PII/history',async()=>harness(async({call,calls})=>{assert.equal((await call('admin/contractors')).statusCode,403);assert.equal(calls.length,2);},{admin:false}));
test('Production overview stays available to admin with commercial gates false, using count-only reads',async()=>harness(async({call,calls})=>{const res=await call('admin/overview');assert.equal(res.statusCode,200);assert.equal(Object.keys(JSON.parse(res.body).counts).length,6);assert.equal(calls.filter(c=>c.opts.method==='HEAD').length,6);assert.equal(res.headers['cache-control'],'no-store');},{db:(url,options)=>{assert.equal(options.method,'HEAD');return new Response(null,{headers:{'content-range':'0-0/1'}});}}));
test('anonymous request cannot read admin contractor list',async()=>harness(async({call,calls})=>{const r=req();delete r.headers.authorization;assert.equal((await call('admin/contractors',r)).statusCode,401);assert.equal(calls.length,0);}));
test('contractor pagination is bounded, stable and filter-injection rejected',async()=>harness(async({call,calls})=>{
 for(const query of [{page:'201'},{page:'-1'},{status:'active&select=*'}])assert.equal((await call('admin/contractors',req('GET',query))).statusCode,400);
 const res=await call('admin/contractors',req('GET',{page:'1'}));assert.equal(JSON.parse(res.body).contractors.length,25);assert.equal(JSON.parse(res.body).has_more,true);
 const p=new URL(calls.at(-1).url).searchParams;assert.equal(p.get('offset'),'25');assert.equal(p.get('limit'),'26');assert.equal(p.get('order'),'created_at.desc,user_id.asc');
},{db:()=>Array.from({length:26},()=>({user_id:id}))}));
test('missing schema or provider exception never leaks PII or credentials into logs',async()=>harness(async({call,logs})=>{const res=await call('admin/contractors');assert.equal(res.statusCode,503);assert.ok(!res.body.includes('PRIVATE_SENTINEL'));assert.ok(!logs.join('').includes('PRIVATE_SENTINEL'));},{db:()=>{throw Error('PRIVATE_SENTINEL customer@example.invalid secret');}}));
test('contractor moderation uses the verified administrator, never client-supplied actor',async()=>harness(async({call,calls})=>{const res=await call('admin/contractor-review',req('POST',{}, {user_id:id,status:'suspended',note:'Synthetic policy review only',p_actor:'not-an-admin'}));assert.equal(res.statusCode,200);const callRpc=calls.find(c=>c.url.includes('rpc/admin_review_contractor'));assert.equal(JSON.parse(callRpc.opts.body).p_actor,id);},{db:()=>({status:'suspended'})}));
test('invalid contractor moderation and invalid history identifiers cannot reach a business RPC',async()=>harness(async({call,calls})=>{assert.equal((await call('admin/contractor-review',req('POST',{}, {user_id:id,status:'paid',note:'Synthetic invalid status'}))).statusCode,400);assert.equal((await call('admin/contractor-history',req('GET',{user_id:'../other'}))).statusCode,400);assert.ok(!calls.some(c=>c.url.includes('/rpc/')));}));
for(const [file,method,query] of [
 ['admin/marketplace','GET',{}],['admin/marketplace','POST',{}],['contractor/marketplace','GET',{action:'dashboard'}],
 ...['purchase','topup','refund','adjustment','profile-service-checkout','public-profile','portfolio-upload'].map(action=>['contractor/marketplace','POST',{action}]),
 ['public-profile','GET',{slug:'synthetic-only'}],['contractor/origin-leads','GET',{}]
])test('closed Production gate rejects '+file+' '+method+' '+JSON.stringify(query)+' before any network',async()=>harness(async({call,calls})=>{assert.equal((await call(file,req(method,query))).statusCode,503);assert.equal(calls.length,0);}));
test('Production contractor can authenticate and read own profile without wallet RPC',async()=>harness(async({call,calls})=>{
 const res=await call('contractor/profile');assert.equal(res.statusCode,200);const data=JSON.parse(res.body);assert.equal(data.capabilities.marketplace_enabled,false);assert.equal(data.capabilities.profile_editing_enabled,false);assert.equal(data.capabilities.payments_enabled,false);assert.equal(calls.length,2);assert.ok(calls[1].url.includes('user_id=eq.'+id));
},{db:()=>[{user_id:id,account_status:'active'}]}));
test('profile POST blocked while editing false without a write',async()=>harness(async({call,calls})=>{assert.equal((await call('contractor/profile',req('POST'))).statusCode,503);assert.equal(calls.length,1);}));
test('commercial profile publication also honors editing gate when marketplace alone is enabled',async()=>harness(async({call,calls})=>{assert.equal((await call('contractor/marketplace',req('POST',{action:'public-profile'}))).statusCode,503);assert.equal(calls.length,1);},{env:{GETESTIMATEFAST_MARKETPLACE_PRODUCTION_ENABLED:'true',GETESTIMATEFAST_MARKETPLACE_SCHEMA_APPROVED:'true'}}));
test('admin referral publication cannot assign prices while marketplace gate is false',async()=>harness(async({call,calls})=>{const res=await call('admin/publish-opportunity',req('POST',{}, {id,summary:'Synthetic request with no customer information.',confirmReviewed:true}));assert.equal(res.statusCode,503);assert.ok(!calls.some(c=>c.url.includes('marketplace_price_rules')||c.url.includes('rpc/')));},{db:()=>[{source:'professional_profile',origin_contractor_id:id,service_type:'Painting'}]}));
test('public intake off blocks before parsing, spam success, database and email',async()=>harness(async({call,calls})=>{const res=await call('lead',{method:'POST',headers:{},on(){throw Error('Body must not be read');}});assert.equal(res.statusCode,503);assert.match(res.body,/Nothing was saved or sent/);assert.equal(res.headers['cache-control'],'no-store');assert.equal(calls.length,0);}));
test('signup disabled cannot send confirmation email',async()=>harness(async({call,calls})=>{assert.equal((await call('contractor/signup',req('POST'))).statusCode,503);assert.equal(calls.length,0);}));
test('independent profile referral flags cannot bypass disabled persistence or marketplace',()=>{
 const {mode}=require('../api/_lib/profile-origin');assert.equal(mode({...base,GETESTIMATEFAST_PROFILE_REQUESTS_MODE:'live',GETESTIMATEFAST_PROFILE_REQUESTS_LIVE_APPROVED:'true'}),null);
});
test('Google review flags cannot enable reviews while Production marketplace is closed',async()=>harness(async({call,calls})=>{assert.equal((await call('reviews/session')).statusCode,503);assert.equal(calls.length,0);},{env:{GETESTIMATEFAST_REVIEW_GOOGLE_ENABLED:'true',GETESTIMATEFAST_REVIEW_SCHEMA_APPROVED:'true'}}));
test('Stripe Production hard block survives accidental sandbox flags',async()=>harness(async({call,calls})=>{assert.equal((await call('contractor/stripe-test-checkout',req('POST'))).statusCode,404);assert.equal((await call('stripe-test-webhook',req('POST'))).statusCode,404);assert.equal(calls.length,0);},{env:{GETESTIMATEFAST_STRIPE_TEST_CHECKOUT_APPROVED:'true',GETESTIMATEFAST_STRIPE_TEST_WEBHOOK_ENABLED:'true',GETESTIMATEFAST_STRIPE_MODE:'test'}}));
test('SMS adapter cannot activate live delivery by env typo/change',()=>{const {readiness}=require('../api/_lib/zenvia-us-provider');for(const mode of ['disabled','live','true','dry_run'])assert.equal(readiness({GETESTIMATEFAST_SMS_MODE:mode}).live_sms_enabled,false);});
