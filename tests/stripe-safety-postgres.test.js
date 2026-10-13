"use strict";
const test = require("node:test"), assert = require("node:assert/strict"), crypto = require("node:crypto"), fs = require("node:fs"), path = require("node:path");
const { createLocalPostgres } = require("../scripts/local-postgres");
const { createSandbox } = require("../scripts/local-marketplace-sandbox");
test("disposable PostgreSQL: Stripe safety migration, contention, ordering and confirmed refunds", { timeout: 120000 }, async t => {
  const db = await createLocalPostgres(); let sandbox;
  try {
    sandbox = await createSandbox(0, { db });
    const { contractor: owner, other, admin } = sandbox.ids;
    const origin = "https://synthetic-stripe-preview.vercel.app";
    const rpcSql = (name, values) => ({ sql: `select public.${name}(${values.map((_, i) => "$" + (i + 1)).join(",")}) result`, values });
    const rpc = async (name, values) => { const c = rpcSql(name, values); return (await db.transaction(async tx => { await tx.exec("set local role service_role"); return tx.query(c.sql, c.values); })).rows[0].result; };
    // Preserve a pre-migration synthetic order without extending its reservation.
    await db.query("insert into profile_service_prices(version,amount_cents,currency,effective_at,created_by,reason) values('stripe-safety-synthetic',2500,'USD',now(),$1,'Synthetic profile price')", [admin]);
    const legacy = await rpc("gef_create_test_order", [owner, "profile_service", null, "native:legacy:001"]);
    await db.exec(fs.readFileSync(path.resolve(__dirname, "../supabase/prepared-migrations/20261012055452_stripe_sandbox_safety.sql"), "utf8"));
    const rule = crypto.randomUUID();
    await db.query("insert into marketplace_price_rules(id,category,version,base_cents,floor_cents,max_buyers,lifetime_hours,effective_at,created_by,reason) values($1,'Painting','stripe-safety-synthetic',1000,100,1,24,now(),$2,'Synthetic price only')", [rule, admin]);
    async function opportunity() {
      const lead = crypto.randomUUID(), op = crypto.randomUUID();
      await db.query("insert into leads(id,service_type,full_name,email,phone,city,zip_code,status) values($1,'Painting','Synthetic Customer','synthetic@example.invalid','8135550199','Riverview','33569','published')", [lead]);
      await db.query("insert into opportunity_previews(id,lead_id,service_category,public_summary,city,zip_code,published_by) values($1,$2,'Painting','Synthetic Stripe safety request','Riverview','33569',$3)", [op, lead, admin]);
      const terms = (await rpc("gef_admin_configuration", [admin, "opportunity_terms", { opportunity_id: op, rule_id: rule }, "Synthetic safety terms", "terms:" + op])).id;
      return { lead, op, terms };
    }
    const quote = async (who, op) => (await rpc("gef_create_test_quote", [who, op.terms, 1000, new Date(Date.now() + 240000).toISOString()])).quote_id;
    const prepare = (who, q, key) => rpc("gef_prepare_test_order", [who, "contact", q, key, origin]);
    async function race(calls, lock, values) {
      const blocker = await db.connect(), clients = await Promise.all(calls.map(() => db.connect()));
      try {
        await blocker.query("begin"); await blocker.query(lock, values);
        const pids = [];
        for (const c of clients) { await c.query("begin;set local role service_role;set local statement_timeout='15s'"); pids.push((await c.query("select pg_backend_pid() pid")).rows[0].pid); }
        const tasks = clients.map((c, i) => c.query(calls[i].sql, calls[i].values).then(async r => { await c.query("commit"); return { ok: true, result: r.rows[0].result }; }, async e => { await c.query("rollback"); return { ok: false, message: e.message }; }));
        let waiting = 0; const deadline = Date.now() + 5000;
        while (Date.now() < deadline) { waiting = Number((await db.query("select count(*) n from pg_stat_activity where pid=any($1::integer[]) and wait_event_type='Lock'", [pids])).rows[0].n); if (waiting === clients.length) break; await new Promise(resolve => setTimeout(resolve, 20)); }
        assert.equal(waiting, clients.length, "independent sessions actually blocked on locks");
        await blocker.query("commit"); return await Promise.all(tasks);
      } finally { await blocker.query("rollback"); await blocker.end(); await Promise.all(clients.map(c => c.end())); }
    }
    await t.test("legacy rows are preserved and clients cannot execute financial/reconciliation functions", async () => {
      const after = await rpc("gef_test_order_read", [legacy.id]);
      assert.equal(after.reserved_until, legacy.reserved_until); assert.equal(after.checkout_expires_at, null);
      await assert.rejects(rpc("gef_create_test_order", [owner, "profile_service", null, "native:blocked:old"]), /Safety migration/);
      const functions = (await db.query("select p.proname,p.prosecdef,has_function_privilege('anon',p.oid,'execute') anon,has_function_privilege('authenticated',p.oid,'execute') authenticated from pg_proc p join pg_namespace n on n.oid=p.pronamespace where (n.nspname='public' and p.proname like 'gef_%') or n.nspname='gef_private'")).rows;
      assert(functions.every(f => !f.prosecdef && !f.anon && !f.authenticated));
      const table = (await db.query("select relrowsecurity,has_table_privilege('anon',oid,'select') anon,has_table_privilege('authenticated',oid,'select') authenticated from pg_class where oid='gef_private.test_refund_confirmations'::regclass")).rows[0];
      assert.equal(table.relrowsecurity, true); assert.equal(table.anon, false); assert.equal(table.authenticated, false);
    });
    let acquired;
    await t.test("two professionals competing for last reservation produce exactly one order", async () => {
      const op = await opportunity(), a = await quote(owner, op), b = await quote(other, op);
      const result = await race([rpcSql("gef_prepare_test_order", [owner, "contact", a, "safety:reserve:one", origin]), rpcSql("gef_prepare_test_order", [other, "contact", b, "safety:reserve:two", origin])], "select id from leads where id=$1 for update", [op.lead]);
      assert.equal(result.filter(r => r.ok).length, 1); acquired = result.find(r => r.ok).result;
      assert(result.find(r => !r.ok).message.includes("Buyer limit"));
      assert.equal(Date.parse(acquired.reserved_until) - Date.parse(acquired.checkout_expires_at), 300000);
      const again = await rpc("gef_prepare_test_order", [acquired.contractor_id, "contact", acquired.quote_id, acquired.operation_key, origin]);
      assert.equal(again.checkout_expires_at, acquired.checkout_expires_at); assert.equal(again.id, acquired.id);
    });
    await t.test("concurrent delivery of identical paid event fulfills once, no wallet credit", async () => {
      await rpc("gef_bind_test_session", [acquired.id, "cs_test_native_safety"]);
      const args = [acquired.id, "evt_native_safety_paid", "cs_test_native_safety", "pi_native_safety", "paid", 1000, "USD", "test"];
      const result = await race([rpcSql("gef_confirm_test_order", args), rpcSql("gef_confirm_test_order", args)], "select id from gef_private.test_checkout_orders where id=$1 for update", [acquired.id]);
      assert(result.every(r => r.ok)); assert.equal(result.filter(r => r.result.created).length, 1);
      assert.equal(Number((await db.query("select count(*) n from gef_private.contact_purchases where funding_source='stripe_test'")).rows[0].n), 1);
      assert.equal((await rpc("gef_wallet_summary", [acquired.contractor_id])).available_cents, 0);
    });
    await t.test("failure and expiration after payment cannot regress paid state or reveal contacts", async () => {
      for (const outcome of ["failed", "expired", "pending"]) {
        const result = await rpc("gef_confirm_test_order", [acquired.id, "evt_native_after_" + outcome, "cs_test_native_safety", null, outcome, 1000, "USD", "test"]);
        assert.equal(result.status, "paid"); assert.equal(result.contact_release_enabled, false);
      }
    });
    await t.test("refund request holds capacity; pending refund cannot complete and confirmed duplicate completes once", async () => {
      const requested = await rpc("gef_refund_test_order", [admin, acquired.id, "safety:refund:request", "Synthetic refund request"]);
      assert.equal(requested.processor_refund_confirmed, false); assert.equal(requested.status, "refund_required");
      assert.equal((await db.query("select status from gef_private.contact_purchases where id=(select purchase_id from gef_private.test_checkout_orders where id=$1)", [acquired.id])).rows[0].status, "acquired");
      await assert.rejects(rpc("gef_confirm_test_refund", [acquired.id, "re_native_safety", "pi_native_safety", 1000, "USD", "test", "pending"]));
      const args = [acquired.id, "re_native_safety", "pi_native_safety", 1000, "USD", "test", "succeeded"];
      const result = await race([rpcSql("gef_confirm_test_refund", args), rpcSql("gef_confirm_test_refund", args)], "select id from gef_private.test_checkout_orders where id=$1 for update", [acquired.id]);
      assert(result.every(r => r.ok)); assert.equal(result.filter(r => r.result.created).length, 1);
      assert.equal((await rpc("gef_test_order_read", [acquired.id])).status, "refunded");
      assert.equal((await rpc("gef_wallet_summary", [acquired.contractor_id])).available_cents, 0);
    });
    await t.test("expired orphan with late payment is refund_required, recovery never extends reservation", async () => {
      const op = await opportunity(), q = await quote(owner, op), o = await prepare(owner, q, "safety:late:order");
      await db.query("update gef_private.test_checkout_orders set checkout_expires_at=now()-interval '2 minutes',reserved_until=now()-interval '1 minute' where id=$1", [o.id]);
      const before = await rpc("gef_test_order_read", [o.id]);
      assert.equal((await rpc("gef_recover_test_session", [o.id, "cs_test_orphan"])).reservation_extended, false);
      assert.equal((await rpc("gef_test_order_read", [o.id])).reserved_until, before.reserved_until);
      const observation = crypto.randomUUID();
      const result = await rpc("gef_reconcile_test_order", [o.id, observation, "cs_test_orphan", "pi_native_late", "paid", 1000]);
      assert.equal(result.status, "refund_required");
      assert.equal((await rpc("gef_reconcile_test_order", [o.id, observation, "cs_test_orphan", "pi_native_late", "paid", 1000])).created, false);
      assert.equal((await db.query("select source from gef_private.test_checkout_events where order_id=$1", [o.id])).rows[0].source, "reconciliation");
      assert.equal((await rpc("gef_test_order_read", [o.id])).purchase_id, null);
    });
    await t.test("two orders cannot consume the same payment; profile service remains independent", async () => {
      const a = await rpc("gef_prepare_test_order", [owner, "profile_service", null, "safety:profile:one", origin]);
      const b = await rpc("gef_prepare_test_order", [other, "profile_service", null, "safety:profile:two", origin]);
      await rpc("gef_bind_test_session", [a.id, "cs_test_profile_safety_a"]); await rpc("gef_bind_test_session", [b.id, "cs_test_profile_safety_b"]);
      assert.equal((await rpc("gef_confirm_test_order", [a.id, "evt_profile_safety_a", "cs_test_profile_safety_a", "pi_profile_duplicate", "paid", 2500, "USD", "test"])).status, "paid");
      await assert.rejects(rpc("gef_confirm_test_order", [b.id, "evt_profile_safety_b", "cs_test_profile_safety_b", "pi_profile_duplicate", "paid", 2500, "USD", "test"]), /unique constraint/);
      assert.equal((await rpc("gef_test_order_read", [b.id])).status, "reserved");
      assert.equal((await rpc("gef_test_order_read", [a.id])).purchase_id, null);
      assert.equal(Number((await db.query("select count(*) n from gef_private.test_checkout_events where event_id='evt_profile_safety_b'")).rows[0].n), 0);
    });
  } finally { if (sandbox) await sandbox.close(); else await db.close(); }
});
