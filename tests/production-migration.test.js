"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {PGlite}=require("@electric-sql/pglite");

const root=path.resolve(__dirname,"..");
const migration=path.join(root,"supabase/prepared-migrations/20261018_production_marketplace_profile_origin.sql");
const u=n=>`90000000-0000-4000-8000-${String(n).padStart(12,"0")}`;

test("Production incremental marketplace migration applies to the current baseline without Stripe/Google-review test schema",async()=>{
 const db=new PGlite();await db.waitReady;
 try{
  await db.exec("create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);");
  const baseline=[
   "getestimatefast_leads.sql",
   "getestimatefast_marketplace_foundation.sql",
   "getestimatefast_admin_status_rpc.sql",
   "admin_approve_lead.sql",
   "getestimatefast_contractors_foundation.sql",
   "contractor_consent_fields.sql",
   "contractor_admin_review_rpc.sql",
   "contractor_auto_enable.sql",
   "opportunity_publication_preview.sql",
   "admin_reconfirm_legacy_review.sql",
   "controlled_matching_rounds.sql",
   "sms_simulation_preview.sql",
   "zenvia_us_webhook_safety.sql"
  ];
  for(const file of baseline){
   let sql=fs.readFileSync(path.join(root,"sql",file),"utf8");
   sql=sql.replace("create extension if not exists pgcrypto;","");
   await db.exec(sql);
  }
  await db.exec("create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);");
  await db.query("insert into auth.users(id,email,email_confirmed_at) values($1,'admin@getestimatefast.com',now())",[u(1)]);
  await db.query("insert into public.admin_users(user_id) values($1)",[u(1)]);

  await db.exec(fs.readFileSync(migration,"utf8"));

  const tables=(await db.query(`
    select n.nspname||'.'||c.relname name
    from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where c.relkind='r' and n.nspname in ('public','gef_private')
  `)).rows.map(r=>r.name);

  for(const expected of [
   "public.marketplace_price_rules",
   "public.marketplace_promotions",
   "public.contractor_public_profiles",
   "public.contractor_reviews",
   "public.profile_service_prices",
   "gef_private.wallets",
   "gef_private.ledger",
   "gef_private.opportunity_terms",
   "gef_private.contact_quotes",
   "gef_private.contact_purchases",
   "gef_private.payment_intents",
   "gef_private.admin_audit",
   "gef_private.public_request_limits"
  ]) assert(tables.includes(expected),expected);

  for(const excluded of [
   "gef_private.test_checkout_orders",
   "gef_private.test_checkout_events",
   "gef_private.test_refund_confirmations",
   "gef_private.review_authenticated_identities",
   "gef_private.review_legacy_classifications"
  ]) assert(!tables.includes(excluded),excluded);

  const funcs=(await db.query(`
    select n.nspname||'.'||p.proname name
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname in ('public','gef_private')
  `)).rows.map(r=>r.name);

  for(const expected of [
   "public.gef_dashboard",
   "public.gef_commercial_previews",
   "public.gef_public_profile",
   "public.gef_public_request_allowed",
   "public.admin_publish_profile_opportunity_priced",
   "gef_private.reject_paid_origin_contact",
   "gef_private.guard_immutable_lead_origin"
  ]) assert(funcs.includes(expected),expected);

  for(const excluded of [
   "public.gef_prepare_test_order",
   "public.gef_confirm_test_order",
   "public.gef_submit_authenticated_review",
   "public.gef_authenticated_review_exists"
  ]) assert(!funcs.includes(excluded),excluded);

  const leadColumn=(await db.query("select count(*)::int n from information_schema.columns where table_schema='public' and table_name='leads' and column_name='origin_contractor_id'")).rows[0].n;
  assert.equal(leadColumn,1);

  const fks=(await db.query(`
    select con.conname,pg_get_constraintdef(con.oid) def
    from pg_constraint con
    join pg_class c on c.oid=con.conrelid
    join pg_namespace n on n.oid=c.relnamespace
    where n.nspname in ('public','gef_private')
      and con.conname in ('admin_audit_actor_id_fkey','marketplace_price_rules_created_by_fkey','marketplace_promotions_created_by_fkey','profile_service_prices_created_by_fkey')
    order by con.conname
  `)).rows;
  assert.equal(fks.length,4);
  assert(fks.every(r=>/auth\.users/.test(r.def)));

  for(const role of ["anon","authenticated"]){
   assert.equal((await db.query("select has_function_privilege($1,'public.admin_publish_profile_opportunity_priced(uuid,text,uuid)','execute') allowed",[role])).rows[0].allowed,false);
   assert.equal((await db.query("select has_table_privilege($1,'gef_private.ledger','select') allowed",[role])).rows[0].allowed,false);
  }

  assert.equal((await db.query("select count(*)::int n from public.marketplace_price_rules")).rows[0].n,0);
  assert.equal((await db.query("select count(*)::int n from gef_private.ledger")).rows[0].n,0);
 }finally{await db.close();}
});

test("Production migration is fail-closed and contains no synthetic seed or live provider activation",()=>{
 const sql=fs.readFileSync(migration,"utf8");
 assert.match(sql,/Marketplace\/profile schema already exists; stop and re-audit before applying/);
 assert.match(sql,/admin_publish_profile_opportunity_priced/);
 assert.match(sql,/originating professional receives this contact without charge/i);
 assert.doesNotMatch(sql,/GETESTIMATEFAST_STRIPE|stripe_test_checkout|test_checkout_orders|test_refund_confirmations/i);
 assert.doesNotMatch(sql,/review_authenticated_identities|gef_submit_authenticated_review|gef_authenticated_review_exists/i);
 assert.doesNotMatch(sql,/insert\s+into\s+public\.marketplace_price_rules\s*\(/i);
 assert.doesNotMatch(sql,/TEST ONLY|synthetic@example\.invalid|8135550100/i);
});
