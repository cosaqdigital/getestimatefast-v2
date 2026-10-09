"use strict";
// Explicit local synthetic sandbox. No production keys, users, requests or payment data.
const http=require("node:http"),fs=require("node:fs"),path=require("node:path"),crypto=require("node:crypto");
const {PGlite}=require("@electric-sql/pglite");
const root=path.resolve(__dirname,".."),u=n=>`10000000-0000-4000-8000-${String(n).padStart(12,"0")}`;
async function createSandbox(port=0,options={}){
 const db=options.db||new PGlite();await db.waitReady;
 await db.exec("create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);");
 const files=["getestimatefast_leads.sql","getestimatefast_marketplace_foundation.sql","getestimatefast_contractors_foundation.sql","contractor_consent_fields.sql","contractor_auto_enable.sql","opportunity_publication_preview.sql","controlled_matching_rounds.sql","sms_simulation_preview.sql","zenvia_us_webhook_safety.sql","us_marketplace_financial_foundation.sql","us_public_profiles_reviews.sql","us_marketplace_read_models.sql","us_topup_test_contract.sql","us_public_review_rate_limit.sql"];
 for(const file of files){const sql=fs.readFileSync(path.join(root,"sql",file),"utf8").replace("create extension if not exists pgcrypto;","");await db.exec(sql);}
 // DDL-only Storage contract. Real upload/RLS behavior still needs Supabase Storage.
 await db.exec("create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);");
 await db.exec(fs.readFileSync(path.join(root,"sql/us_portfolio_storage.sql"),"utf8"));
 await db.exec(fs.readFileSync(path.join(root,"sql/us_stripe_test_checkout.sql"),"utf8"));
 const asService=(sql,values=[])=>db.transaction(async tx=>{await tx.exec("set local role service_role");return tx.query(sql,values);});
 await db.query("insert into auth.users(id,email,email_confirmed_at) values($1,'contractor@example.invalid',now()),($2,'admin@example.invalid',now()),($3,'other@example.invalid',now())",[u(1),u(9),u(2)]);
 await db.query("insert into admin_users(user_id) values($1)",[u(9)]);
 for(const [id,name] of [[u(1),"Synthetic Painting Business"],[u(2),"Synthetic Other Business"]])await db.query("insert into contractor_profiles(user_id,display_name,business_name,contact_phone,contact_email,base_zip,city,state_code,service_radius_miles,service_categories,bio,account_status,email_verified_at,privacy_accepted_at,terms_accepted_at) values($1,$2,$2,'8135550100','synthetic@example.invalid','33569','Riverview','FL',25,array['Painting'],'Synthetic sandbox provider. No real business or service.', 'active',now(),now(),now())",[id,name]);
 await db.query("insert into leads(id,service_type,full_name,email,phone,city,zip_code,status) values($1,'Painting','Synthetic Customer','synthetic.customer@example.invalid','8135550199','Riverview','33569','published')",[u(20)]);
 await db.query("insert into opportunity_previews(id,lead_id,service_category,public_summary,city,zip_code,published_by) values($1,$2,'Painting','SYNTHETIC SANDBOX REQUEST: interior painting for a sample room. No real customer.','Riverview','33569',$3)",[u(30),u(20),u(9)]);
 const objects=new Map(),nativeFetch=global.fetch,previousEnv={...process.env};let origin;
 const users={"synthetic-contractor":{id:u(1),email:"contractor@example.invalid",email_confirmed_at:new Date().toISOString()},"synthetic-admin":{id:u(9),email:"admin@example.invalid",email_confirmed_at:new Date().toISOString()},"synthetic-other":{id:u(2),email:"other@example.invalid",email_confirmed_at:new Date().toISOString()}};
 const response=(data,status=200)=>new Response(data===null?null:JSON.stringify(data),{status,headers:{"Content-Type":"application/json"}});
 global.fetch=async(input,options={})=>{
  const target=new URL(String(input));
  if(target.origin!==origin||!/^\/(rest|auth|storage)\/v1\//.test(target.pathname))return nativeFetch(input,options);
  if(target.pathname==="/auth/v1/user"){const token=(options.headers?.Authorization||"").replace(/^Bearer /,"");return users[token]?response(users[token]):response({error:"Invalid synthetic session"},401);}
  if(target.pathname==="/auth/v1/token"){
   const body=JSON.parse(options.body||"{}");const token=body.email==="admin@example.invalid"?"synthetic-admin":body.email==="contractor@example.invalid"?"synthetic-contractor":body.email==="other@example.invalid"?"synthetic-other":null;
   return token&&body.password==="SyntheticTestOnly!"?response({access_token:token,user:users[token],expires_in:3600}):response({error:"Invalid synthetic credentials"},401);
  }
  if(target.pathname.startsWith("/storage/v1/object/gef-portfolio/")&&options.method==="POST"){objects.set(target.pathname.replace("/storage/v1/object/",""),{data:options.body,type:options.headers["Content-Type"]});return response({uploaded:true},201);}
  if(target.pathname.startsWith("/rest/v1/rpc/")){
   const name=target.pathname.split("/").pop();if(!/^[a-z_]+$/.test(name))return response({error:"Invalid RPC"},400);
   const body=JSON.parse(options.body||"{}"),entries=Object.entries(body);if(entries.some(([k])=>!/^p_[a-z_]+$/.test(k)))return response({error:"Invalid arguments"},400);
   try{
    const args=entries.map(([k],i)=>`${k}=>$${i+1}`).join(","),values=entries.map(([,v])=>v);
    if(name==="list_contractor_opportunities")return response((await asService(`select * from public.${name}(${args})`,values)).rows);
    return response((await asService(`select public.${name}(${args}) result`,values)).rows[0].result);
   }catch(e){return response({error:"Synthetic database rejected operation",code:e.code},409);}
  }
  if(target.pathname.startsWith("/rest/v1/")){
   const table=target.pathname.split("/").pop(),select=target.searchParams.get("select")||"*";
   if(!["contractor_profiles","admin_users","contractor_public_profiles"].includes(table)||!/^([a-z_]+,?)+$|^\*$/.test(select))return response({error:"Unsupported sandbox table"},400);
   const predicates=[],values=[];for(const [key,value] of target.searchParams){if(["select","limit","order","on_conflict"].includes(key))continue;if(!/^[a-z_]+$/.test(key)||!value.startsWith("eq."))return response({error:"Invalid filter"},400);values.push(value.slice(3));predicates.push(`${key}=$${values.length}`);}
   try{return response((await asService(`select ${select} from public.${table}${predicates.length?" where "+predicates.join(" and "):""} limit 100`,values)).rows);}catch(e){return response({error:"Synthetic table read failed",code:e.code},400);}
  }
  return response({error:"Unsupported sandbox endpoint"},400);
 };
 const server=http.createServer(async(req,res)=>{
  try{
   const target=new URL(req.url,origin);req.query=Object.fromEntries(target.searchParams);
   if(target.pathname==="/sandbox-info"){res.setHeader("Content-Type","application/json");return res.end(JSON.stringify({synthetic_only:true,contractor_email:"contractor@example.invalid",admin_email:"admin@example.invalid",password:"SyntheticTestOnly!"}));}
   if(target.pathname.startsWith("/api/")){
    const relative=target.pathname.slice(1)+".js",file=path.resolve(root,relative);if(!file.startsWith(root+path.sep)||!fs.existsSync(file)){res.statusCode=404;return res.end();}
    if(options.stripe && ["api/stripe-test-webhook.js","api/contractor/stripe-test-checkout.js"].includes(relative))return await require(file).createHandler(options.stripe)(req,res);
    return await require(file)(req,res);
   }
   if(target.pathname.startsWith("/professionals/")){req.query={slug:target.pathname.split("/").pop(),format:"html"};return await require("../api/public-profile")(req,res);}
   if(target.pathname.startsWith("/storage/v1/object/public/")){const item=objects.get(target.pathname.replace("/storage/v1/object/public/",""));if(!item){res.statusCode=404;return res.end();}res.setHeader("Content-Type",item.type);return res.end(item.data);}
   let relative=decodeURIComponent(target.pathname).replace(/^\//,"")||"contractor-portal.html";
   const file=path.resolve(root,relative);if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()||!/^assets[\\/]|^[A-Za-z0-9-]+\.html$/.test(relative)){res.statusCode=404;return res.end("Not found");}
   const mime={".html":"text/html; charset=utf-8",".js":"application/javascript",".css":"text/css",".jpg":"image/jpeg",".jpeg":"image/jpeg",".png":"image/png"};res.setHeader("Content-Type",mime[path.extname(file)]||"application/octet-stream");res.end(fs.readFileSync(file));
  }catch(e){res.statusCode=500;res.end("Synthetic sandbox request failed");console.error(e.message);}
 });
 await new Promise(resolve=>server.listen(port,"127.0.0.1",resolve));origin="http://127.0.0.1:"+server.address().port;
 Object.assign(process.env,{GETESTIMATEFAST_ISOLATED_BACKEND:"true",GETESTIMATEFAST_MARKETPLACE_PREVIEW:"true",GETESTIMATEFAST_SUPABASE_URL:origin,GETESTIMATEFAST_SUPABASE_SECRET_KEY:"synthetic-server-key",GETESTIMATEFAST_SUPABASE_PUBLISHABLE_KEY:"synthetic-publishable-key",GETESTIMATEFAST_PUBLIC_ORIGIN:origin,GETESTIMATEFAST_REVIEW_IDENTITY_SECRET:crypto.randomBytes(32).toString("hex"),VERCEL_ENV:"development",CONTRACTOR_PROFILE_EDITING_ENABLED:"false"});delete process.env.VERCEL;
 return {db,origin,users,ids:{contractor:u(1),other:u(2),admin:u(9),opportunity:u(30)},fetch:nativeFetch,async close(){await new Promise(resolve=>server.close(resolve));global.fetch=nativeFetch;for(const key of Object.keys(process.env))if(!(key in previousEnv))delete process.env[key];Object.assign(process.env,previousEnv);await db.close();}};
}
module.exports={createSandbox};
if(require.main===module)createSandbox(Number(process.argv[2]||4173)).then(s=>{console.log("SYNTHETIC LOCAL SANDBOX ONLY: "+s.origin+"/contractor-portal.html");console.log("Test accounts: contractor@example.invalid / admin@example.invalid; password: SyntheticTestOnly!");process.on("SIGINT",()=>s.close().then(()=>process.exit(0)));}).catch(e=>{console.error(e.message);process.exitCode=1;});
