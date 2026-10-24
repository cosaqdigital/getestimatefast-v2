"use strict";
const test = require("node:test"), assert = require("node:assert/strict"), fs = require("node:fs"), path = require("node:path");
const { createLocalPostgres } = require("../scripts/local-postgres");
const { files, inventory } = require("../scripts/development-installation-plan");
test("full development installation order compiles on an empty native PostgreSQL without operational seeds", { timeout: 120000 }, async () => {
 const db = await createLocalPostgres();
 try {
  await db.exec("create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);");
  // Minimal local event-trigger fixture: confirms grant revocation preserves its event binding.
  await db.exec("create function public.rls_auto_enable() returns event_trigger language plpgsql security definer set search_path=pg_catalog as $$begin return;end$$;create event trigger ensure_rls on ddl_command_end execute function public.rls_auto_enable();");
  for (const name of files) {
   const sql = fs.readFileSync(path.join(__dirname, "../sql", name), "utf8").replace("create extension if not exists pgcrypto;", "");
   await db.exec(sql);
  }
  const application = await db.query("select (select count(*) from leads) leads,(select count(*) from contractor_profiles) contractors,(select count(*) from admin_users) administrators,(select count(*) from gef_private.ledger) ledger,(select count(*) from auth.users) users");
  assert(Object.values(application.rows[0]).every(value => Number(value) === 0));
  const baseline=await db.query("select has_function_privilege('anon','public.rls_auto_enable()','execute') anon,has_function_privilege('authenticated','public.rls_auto_enable()','execute') authenticated,(select evtenabled from pg_event_trigger where evtname='ensure_rls') enabled");
  assert.equal(baseline.rows[0].anon,false);assert.equal(baseline.rows[0].authenticated,false);assert.equal(baseline.rows[0].enabled,'O');
  const fn = await db.query("select pg_get_functiondef('public.admin_review_contractor(uuid,text,text,uuid)'::regprocedure) definition");
  assert(fn.rows[0].definition.includes("Initial account activation is automatic"));
  for (const name of ["admin_approve_lead", "admin_reconfirm_legacy_lead", "admin_publish_opportunity", "admin_record_matching_round", "gef_create_test_order"]) {
   const result = await db.query("select has_function_privilege('anon',p.oid,'execute') anon,has_function_privilege('authenticated',p.oid,'execute') authenticated from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname=$1", [name]);
   assert(result.rows.length > 0); assert(result.rows.every(row => !row.anon && !row.authenticated));
  }
  const plan = inventory(); assert.equal(plan.project_ref, "cpjsbijgijeyrwjpuciv"); assert.equal(plan.remote_execution_enabled, false); assert.equal(plan.scripts.length, 20);
 } finally { await db.close(); }
});
