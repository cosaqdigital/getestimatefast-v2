"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const {PGlite}=require("@electric-sql/pglite");
const u=n=>`00000000-0000-4000-8000-${String(n).padStart(12,"0")}`;
test("isolated PostgreSQL: financial atomicity, idempotency, privacy and review moderation",async t=>{
 const db=new PGlite();await db.waitReady;
 try{
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
 create schema auth; create table auth.users(id uuid primary key);
 create table public.admin_users(user_id uuid primary key references auth.users);
 create table public.contractor_profiles(user_id uuid primary key references auth.users,account_status text,email_verified_at timestamptz,state_code text);
 create table public.leads(id uuid primary key,status text,full_name text,email text,phone text);
 create table public.opportunity_previews(id uuid primary key,lead_id uuid references public.leads,service_category text,city text,public_summary text,published_at timestamptz);
 insert into auth.users values('${u(1)}'),('${u(2)}'),('${u(3)}'),('${u(9)}');
 insert into admin_users values('${u(9)}');
 insert into contractor_profiles values('${u(1)}','active',now(),'FL'),('${u(2)}','active',now(),'FL'),('${u(3)}','suspended',now(),'FL');
 insert into leads values('${u(20)}','published','Synthetic Customer','synthetic@example.invalid','+18135550100');
 insert into opportunity_previews values('${u(30)}','${u(20)}','Painting','Riverview','Synthetic request used exclusively for a database test',now());`);
 for(const file of ["us_marketplace_financial_foundation.sql","us_public_profiles_reviews.sql","us_marketplace_read_models.sql","us_topup_test_contract.sql","us_public_review_rate_limit.sql"]){await db.exec(fs.readFileSync(path.join(__dirname,"../sql",file),"utf8"));}
 const q=(sql,params=[])=>db.query(sql,params);
 const rejected=async(sql,params)=>assert.rejects(()=>q(sql,params));
 await q("insert into marketplace_price_rules(id,category,version,base_cents,floor_cents,max_buyers,lifetime_hours,effective_at,created_by,reason) values($1,'Painting','synthetic-v1',1000,100,1,24,now(),$2,'Synthetic test configuration')",[u(40),u(9)]);
 await q("insert into gef_private.opportunity_terms(id,opportunity_id,rule_id,max_buyers,opportunity_expires_at,published_at_snapshot) select $1,id,$2,1,now()+interval '24 hours',published_at from opportunity_previews where id=$3",[u(60),u(40),u(30)]);
 for(const [owner,id] of [[u(1),u(51)],[u(2),u(52)]])await q("insert into gef_private.contact_quotes(id,contractor_id,opportunity_id,rule_id,terms_id,amount_cents,max_buyers,valid_until,opportunity_expires_at,published_at_snapshot) select $1,$2,opportunity_id,rule_id,id,1000,max_buyers,now()+interval '5 minutes',opportunity_expires_at,published_at_snapshot from gef_private.opportunity_terms where id=$3",[id,owner,u(60)]);
 await t.test("pending payments do not increase balance; negative balances and history edits rejected",async()=>{
  await q("insert into gef_private.payment_intents(contractor_id,purpose,amount_cents,operation_key) values($1,'wallet_topup',1000,'pending:synthetic')",[u(1)]);
  assert.equal((await q("select public.gef_wallet_summary($1) s",[u(1)])).rows[0].s.available_cents,0);
  await rejected("select public.gef_adjust_wallet($1,$2,'paid',-1,'Synthetic negative test','adjust:negative')",[u(9),u(1)]);
  await q("select public.gef_adjust_wallet($1,$2,'paid',600,'Synthetic credit','adjust:paid001')",[u(9),u(1)]);
  await q("select public.gef_adjust_wallet($1,$2,'promotional',200,'Synthetic bonus','adjust:promo001')",[u(9),u(1)]);
  assert.equal((await q("select public.gef_adjust_wallet($1,$2,'paid',600,'Synthetic credit','adjust:paid001') s",[u(9),u(1)])).rows[0].s.created,false);
  await rejected("select public.gef_adjust_wallet($1,$2,'paid',601,'Synthetic credit','adjust:paid001')",[u(9),u(1)]);
  await rejected("update gef_private.ledger set amount_cents=999 where contractor_id=$1",[u(1)]);
  await rejected("select public.gef_adjust_wallet($1,$2,'paid',1,'Synthetic credit','adjust:noadmin')",[u(2),u(1)]);
 });
 await t.test("insufficient purchase rolls back all bucket debits, then retry acquires once",async()=>{
  await rejected("select gef_purchase_contact($1,$2,'buy:synthetic001')",[u(1),u(51)]);
  assert.equal((await q("select gef_wallet_summary($1) s",[u(1)])).rows[0].s.available_cents,800);
  assert.equal((await q("select count(*)::int n from gef_private.contact_purchases")).rows[0].n,0);
  await q("select gef_adjust_wallet($1,$2,'refund',200,'Synthetic refund credit','adjust:refund001')",[u(9),u(1)]);
  const r=await q("select gef_purchase_contact($1,$2,'buy:synthetic001') s",[u(1),u(51)]);assert.equal(r.rows[0].s.created,true);
  assert.equal((await q("select gef_purchase_contact($1,$2,'buy:synthetic001') s",[u(1),u(51)])).rows[0].s.created,false);
  await rejected("select gef_purchase_contact($1,$2,'buy:syntheticNEW')",[u(1),u(51)]);
  await rejected("select gef_purchase_contact($1,$2,'buy:wrongowner')",[u(2),u(51)]);
  await rejected("insert into gef_private.contact_quotes(contractor_id,opportunity_id,rule_id,terms_id,amount_cents,max_buyers,valid_until,opportunity_expires_at,published_at_snapshot) select contractor_id,opportunity_id,rule_id,terms_id,amount_cents,99,valid_until,opportunity_expires_at,published_at_snapshot from gef_private.contact_quotes limit 1");
 });
 await t.test("last buyer slot and refund prevent double sale/debit/refund",async()=>{
  await q("select gef_adjust_wallet($1,$2,'paid',1000,'Synthetic second wallet','adjust:second001')",[u(9),u(2)]);
  const attempts=await Promise.allSettled([q("select gef_purchase_contact($1,$2,'buy:second001')",[u(2),u(52)]),q("select gef_purchase_contact($1,$2,'buy:second002')",[u(2),u(52)])]);
  assert(attempts.every(a=>a.status==="rejected"));assert.equal((await q("select gef_wallet_summary($1) s",[u(2)])).rows[0].s.available_cents,1000);
  const pid=(await q("select id from gef_private.contact_purchases where contractor_id=$1",[u(1)])).rows[0].id;
  await q("select gef_refund_contact($1,$2,'Synthetic invalid contact','refund:synthetic001')",[u(9),pid]);
  assert.equal((await q("select gef_refund_contact($1,$2,'Synthetic invalid contact','refund:synthetic001') s",[u(9),pid])).rows[0].s.created,false);
  await rejected("select gef_refund_contact($1,$2,'Synthetic invalid contact','refund:syntheticNEW')",[u(9),pid]);
  assert.equal((await q("select gef_wallet_summary($1) s",[u(1)])).rows[0].s.refund_cents,1000);
  await q("select gef_purchase_contact($1,$2,'buy:second003')",[u(2),u(52)]);
 });
 await t.test("top-ups require matching test confirmation; money and optional bonuses credit once",async()=>{
  await q("insert into gef_private.payment_intents(id,contractor_id,purpose,amount_cents,provider,operation_key) values($1,$2,'wallet_topup',100,'stripe_test','synthetic:no-bonus')",[u(80),u(1)]);
  await rejected("select gef_confirm_test_topup($1,'event:wrong001','payment:test001',101,'USD','test')",[u(80)]);
  await rejected("select gef_confirm_test_topup($1,'event:live001','payment:test001',100,'USD','live')",[u(80)]);
  await q("select gef_confirm_test_topup($1,'event:test001','payment:test001',100,'USD','test')",[u(80)]);
  assert.equal((await q("select gef_confirm_test_topup($1,'event:test001','payment:test001',100,'USD','test') s",[u(80)])).rows[0].s.created,false);
  await q("select gef_confirm_test_topup($1,'event:test002','payment:test001',100,'USD','test')",[u(80)]);
  await rejected("select gef_confirm_test_topup($1,'event:test001','payment:different',100,'USD','test')",[u(80)]);
  await q("insert into marketplace_promotions(id,version,amount_cents,bonus_cents,starts_at,ends_at,enabled,created_by,reason) values($1,'synthetic-promo',100,20,now()-interval '1 day',now()+interval '1 day',true,$2,'Synthetic promotion only')",[u(81),u(9)]);
  await q("insert into gef_private.payment_intents(id,contractor_id,purpose,amount_cents,bonus_cents,promotion_id,provider,operation_key) values($1,$2,'wallet_topup',100,20,$3,'stripe_test','synthetic:bonus')",[u(82),u(1),u(81)]);
  await q("select gef_confirm_test_topup($1,'event:bonus001','payment:bonus001',100,'USD','test')",[u(82)]);
  const balance=(await q("select gef_wallet_summary($1) s",[u(1)])).rows[0].s;assert.equal(balance.paid_cents,200);assert.equal(balance.promotional_cents,20);assert.equal(balance.refund_cents,1000);
  await q("insert into gef_private.payment_intents(id,contractor_id,purpose,amount_cents,provider,operation_key) values($1,$2,'profile_service',100,'stripe_test','synthetic:profile')",[u(83),u(1)]);
  await rejected("select gef_confirm_test_topup($1,'event:profile001','payment:profile001',100,'USD','test')",[u(83)]);
 });
 await t.test("no public finance table access or privileged public RPC grants",async()=>{
  for(const role of ["anon","authenticated"]){
   assert.equal((await q("select has_function_privilege($1,'public.gef_purchase_contact(uuid,uuid,text)','execute') allowed",[role])).rows[0].allowed,false);
   assert.equal((await q("select has_table_privilege($1,'gef_private.ledger','select') allowed",[role])).rows[0].allowed,false);
  }
  const disabled=(await q("select count(*)::int n from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('gef_private','public') and c.relkind='r' and not c.relrowsecurity and c.relname not in ('leads','admin_users','contractor_profiles','opportunity_previews')")).rows[0].n;assert.equal(disabled,0);
 });
 const publicProfile={slug:"synthetic-provider",display_name:"Synthetic Provider",headline:"Local services",about:"Test only",city:"Riverview",state_code:"FL",zip_code:"33569",radius_miles:25,categories:["Painting"],languages:["English"],social_links:[],portfolio:[],published:true,publish_email:false,publish_phone:false,public_email:null,public_phone:null};
 await t.test("public profile projection never leaks account or private contacts; foreign photos rejected",async()=>{
  await q("select gef_save_public_profile($1,$2)",[u(1),publicProfile]);
  await rejected("select gef_save_public_profile($1,$2)",[u(2),{...publicProfile,slug:"synthetic-two",portfolio:[{image_path:u(1)+"/"+u(70)+".jpg"}]}]);
  const data=(await q("select gef_public_profile('synthetic-provider') s")).rows[0].s;
  assert.equal(data.profile.public_email,null);assert.equal(data.profile.contractor_id,undefined);assert.equal(data.reviews.length,0);
 });
 await t.test("invites are single use, external reviews are never verified purchases, moderation audited",async()=>{
  await q("select gef_create_review_invitation($1,$2,null)",[u(1),"a".repeat(64)]);
  const body={token_hash:"a".repeat(64),identity_hash:"b".repeat(64),display_name:"Synthetic Reviewer",rating:5,comment:"Synthetic review for an isolated test only."};
  const id=(await q("select gef_submit_review($1) s",[body])).rows[0].s.review_id;
  await rejected("select gef_submit_review($1)",[body]);
  assert.equal((await q("select gef_public_profile('synthetic-provider') s")).rows[0].s.reviews.length,0);
  await rejected("select gef_moderate_review($1,$2,'approved','Synthetic moderation','moderate:test001')",[u(2),id]);
  await q("select gef_moderate_review($1,$2,'approved','Synthetic moderation','moderate:test001')",[u(9),id]);
  const review=(await q("select gef_public_profile('synthetic-provider') s")).rows[0].s.reviews[0];assert.equal(review.source,"external");assert.equal(review.identity_hash,undefined);assert.equal(review.invitation_id,undefined);
  await q("select gef_create_review_invitation($1,$2,null)",[u(1),"c".repeat(64)]);
  await rejected("select gef_submit_review($1)",[{...body,token_hash:"c".repeat(64)}]);
  await rejected("select gef_create_review_invitation($1,$2,$3)",[u(1),"d".repeat(64),(await q("select id from gef_private.contact_purchases where contractor_id=$1",[u(2)])).rows[0].id]);
  await q("select gef_report_review($1,$2,'Synthetic report for moderation')",[id,"e".repeat(64)]);
  await q("select gef_report_review($1,$2,'Synthetic duplicate report')",[id,"e".repeat(64)]);
  assert.equal((await q("select count(*)::int n from gef_private.review_reports")).rows[0].n,1);
 });
 await t.test("configuration history is idempotent and anonymous rate limits are persistent",async()=>{
  const payload={version:'synthetic-profile-v1',amount_cents:100,effective_at:new Date().toISOString()};
  await q("select gef_admin_configuration($1,'profile_service_price',$2,'Synthetic service configuration','config:profile001')",[u(9),payload]);
  assert.equal((await q("select gef_admin_configuration($1,'profile_service_price',$2,'Synthetic service configuration','config:profile001') s",[u(9),payload])).rows[0].s.created,false);
  await rejected("select gef_admin_configuration($1,'profile_service_price',$2,'Synthetic service configuration','config:profile001')",[u(9),{...payload,amount_cents:101}]);
  const first=(await q("select gef_public_request_allowed($1,1) ok",['f'.repeat(64)])).rows[0].ok;
  const second=(await q("select gef_public_request_allowed($1,1) ok",['f'.repeat(64)])).rows[0].ok;assert.equal(first,true);assert.equal(second,false);
 });
 await t.test("financial invoker functions work with the actual service role grants",async()=>{
  await db.exec("grant select on public.admin_users,public.contractor_profiles to service_role;grant select,update on public.leads,public.opportunity_previews to service_role;");
  await db.transaction(async tx=>{
   await tx.exec("set local role service_role");
   await tx.query("select gef_adjust_wallet($1,$2,'paid',1,'Synthetic service role adjustment','service:adjust001')",[u(9),u(2)]);
   const result=await tx.query("select gef_wallet_summary($1) s",[u(2)]);assert.equal(result.rows[0].s.paid_cents,1);
   const admin=await tx.query("select gef_admin_marketplace($1) s",[u(9)]);assert(admin.rows[0].s.metrics.purchases>=1);
  });
 });
 }finally{await db.close();}
});
