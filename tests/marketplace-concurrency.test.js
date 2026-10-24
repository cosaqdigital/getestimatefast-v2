"use strict";
const test = require("node:test"), assert = require("node:assert/strict"), crypto = require("node:crypto");
const { createLocalPostgres } = require("../scripts/local-postgres");
const { createSandbox } = require("../scripts/local-marketplace-sandbox");
test("native PostgreSQL: six scripts, real session races and independent Stripe test orders", { timeout: 120000 }, async t => {
  const db = await createLocalPostgres(); let sandbox;
  try {
    sandbox = await createSandbox(0, { db });
    const owner = sandbox.ids.contractor, other = sandbox.ids.other, admin = sandbox.ids.admin;
    const query = (sql, values = []) => db.query(sql, values);
    const rpc = async (name, values) => (await query(`select public.${name}(${values.map((_, i) => "$" + (i + 1)).join(",")}) result`, values)).rows[0].result;
    const ruleId = crypto.randomUUID();
    await query("insert into marketplace_price_rules(id,category,version,base_cents,floor_cents,max_buyers,lifetime_hours,effective_at,created_by,reason) values($1,'Painting','native-synthetic',1000,100,1,24,now(),$2,'Synthetic native test price')", [ruleId, admin]);
    async function opportunity() {
      const lead = crypto.randomUUID(), op = crypto.randomUUID();
      await query("insert into leads(id,service_type,full_name,email,phone,city,zip_code,status) values($1,'Painting','Synthetic Customer','synthetic@example.invalid','8135550199','Riverview','33569','published')", [lead]);
      await query("insert into opportunity_previews(id,lead_id,service_category,public_summary,city,zip_code,published_by) values($1,$2,'Painting','Synthetic request for concurrency only','Riverview','33569',$3)", [op, lead, admin]);
      const terms = (await rpc("gef_admin_configuration", [admin, "opportunity_terms", { opportunity_id: op, rule_id: ruleId }, "Synthetic native terms", "terms:" + op])).id;
      return { lead, op, terms };
    }
    const quote = async (who, op) => (await rpc("gef_create_test_quote", [who, op.terms, 1000, new Date(Date.now() + 240000).toISOString()])).quote_id;
    async function race(calls, lockSql, lockValues) {
      const blocker = await db.connect(), connections = await Promise.all(calls.map(() => db.connect()));
      try {
        await blocker.query("begin"); await blocker.query(lockSql, lockValues);
        const pids = [];
        for (const c of connections) { await c.query("begin;set local role service_role;set local statement_timeout='15s'"); pids.push((await c.query("select pg_backend_pid() pid")).rows[0].pid); }
        assert.equal(new Set(pids).size, calls.length);
        const results = connections.map((c, i) => c.query(calls[i].sql, calls[i].values).then(async r => { await c.query("commit"); return { ok: true, result: r.rows[0]?.result }; }, async e => { await c.query("rollback"); return { ok: false, code: e.code, message: e.message }; }));
        const deadline = Date.now() + 5000; let waiting = 0;
        while (Date.now() < deadline) {
          waiting = Number((await query("select count(*) n from pg_stat_activity where pid=any($1::integer[]) and wait_event_type='Lock'", [pids])).rows[0].n);
          if (waiting === calls.length) break;
          await new Promise(resolve => setTimeout(resolve, 20));
        }
        assert.equal(waiting, calls.length, "independent sessions must actually contend on locks");
        await blocker.query("commit"); return await Promise.all(results);
      } finally { await blocker.query("rollback"); await blocker.end(); await Promise.all(connections.map(c => c.end())); }
    }
    const call = (name, values) => ({ sql: `select ${name}(${values.map((_, i) => "$" + (i + 1)).join(",")}) result`, values });
    await t.test("all six DDL scripts compile and every new RPC/private table rejects browser roles", async () => {
      assert.equal((await query("select public,file_size_limit,allowed_mime_types from storage.buckets where id='gef-portfolio'")).rows[0].file_size_limit, 3000000);
      const rows = (await query("select n.nspname,p.proname,has_function_privilege('anon',p.oid,'execute') anon,has_function_privilege('authenticated',p.oid,'execute') authenticated,p.prosecdef from pg_proc p join pg_namespace n on n.oid=p.pronamespace where (n.nspname='public' and p.proname like 'gef_%') or n.nspname='gef_private'")).rows;
      assert(rows.length > 20); assert(rows.every(r => !r.anon && !r.authenticated && !r.prosecdef));
      assert.equal(Number((await query("select count(*) n from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='gef_private' and c.relkind='r' and (not c.relrowsecurity or has_table_privilege('anon',c.oid,'select') or has_table_privilege('authenticated',c.oid,'select'))")).rows[0].n), 0);
    });
    await t.test("two buyers compete for the last slot: one debit, one rejection", async () => {
      const op = await opportunity(), a = await quote(owner, op), b = await quote(other, op);
      for (const who of [owner, other]) await rpc("gef_adjust_wallet", [admin, who, "paid", 1000, "Synthetic available balance", "credit:" + crypto.randomUUID()]);
      const result = await race([call("gef_purchase_contact", [owner, a, "native:buyer001"]), call("gef_purchase_contact", [other, b, "native:buyer002"])], "select id from leads where id=$1 for update", [op.lead]);
      assert.equal(result.filter(r => r.ok).length, 1);
      assert(result.filter(r => !r.ok).every(r => r.message.includes("Buyer limit")));
      assert.equal(Number((await query("select count(*) n from gef_private.contact_purchases where opportunity_id=$1", [op.op])).rows[0].n), 1);
      assert.equal((await rpc("gef_wallet_summary", [owner])).available_cents + (await rpc("gef_wallet_summary", [other])).available_cents, 1000);
    });
    await t.test("simultaneous same-key adjustment credits once and protects ledger sums", async () => {
      const args = [admin, owner, "paid", 37, "Synthetic repeated credit", "native:adjust001"];
      const before = await rpc("gef_wallet_summary", [owner]);
      const result = await race([call("gef_adjust_wallet", args), call("gef_adjust_wallet", args)], "select contractor_id from gef_private.wallets where contractor_id=$1 for update", [owner]);
      assert(result.every(r => r.ok)); assert.equal(result.filter(r => r.result.created).length, 1);
      assert.equal((await rpc("gef_wallet_summary", [owner])).available_cents, before.available_cents + 37);
    });
    await t.test("simultaneous refunds restore the exact amount once", async () => {
      const p = (await query("select id,contractor_id,amount_cents,opportunity_id from gef_private.contact_purchases where funding_source='wallet' limit 1")).rows[0];
      const before = await rpc("gef_wallet_summary", [p.contractor_id]);
      const args = [admin, p.id, "Synthetic invalid contact", "native:refund001"];
      const result = await race([call("gef_refund_contact", args), call("gef_refund_contact", args)], "select id from opportunity_previews where id=$1 for update", [p.opportunity_id]);
      assert(result.every(r => r.ok)); assert.equal(result.filter(r => r.result.created).length, 1);
      assert.equal((await rpc("gef_wallet_summary", [p.contractor_id])).available_cents, before.available_cents + p.amount_cents);
    });
    await t.test("simultaneous debits on one wallet cannot create a negative bucket", async () => {
      await rpc("gef_adjust_wallet", [admin, owner, "promotional", 500, "Synthetic bonus race", "native:neg:credit"]);
      const result = await race([call("gef_adjust_wallet", [admin, owner, "promotional", -400, "Synthetic first debit", "native:neg:debit1"]), call("gef_adjust_wallet", [admin, owner, "promotional", -400, "Synthetic second debit", "native:neg:debit2"])], "select contractor_id from gef_private.wallets where contractor_id=$1 for update", [owner]);
      assert.equal(result.filter(r => r.ok).length, 1); assert(result.find(r => !r.ok).message.includes("Insufficient bucket balance"));
      assert.equal((await rpc("gef_wallet_summary", [owner])).promotional_cents, 100);
    });
    await t.test("two Checkouts reserve one slot; a wallet purchase cannot bypass its hold", async () => {
      const op = await opportunity(), a = await quote(owner, op), b = await quote(other, op);
      const result = await race([call("gef_create_test_order", [owner, "contact", a, "native:reserve001"]), call("gef_create_test_order", [other, "contact", b, "native:reserve002"])], "select id from leads where id=$1 for update", [op.lead]);
      assert.equal(result.filter(r => r.ok).length, 1);
      const winner = result.find(r => r.ok).result, loser = winner.contractor_id === owner ? other : owner, loserQuote = loser === owner ? a : b;
      await rpc("gef_adjust_wallet", [admin, loser, "paid", 1000, "Synthetic wallet bypass test", "native:bypass001"]);
      await assert.rejects(() => rpc("gef_purchase_contact", [loser, loserQuote, "native:bypassbuy"]), /Buyer limit/);
      await rpc("gef_bind_test_session", [winner.id, "cs_test_native001"]);
      const before = await rpc("gef_wallet_summary", [winner.contractor_id]);
      const args = [winner.id, "evt_native001", "cs_test_native001", "pi_native001", "paid", 1000, "USD", "test"];
      const paid = await race([call("gef_confirm_test_order", args), call("gef_confirm_test_order", args)], "select id from leads where id=$1 for update", [op.lead]);
      assert(paid.every(r => r.ok)); assert.equal(paid.filter(r => r.result.created).length, 1);
      assert.deepEqual(await rpc("gef_wallet_summary", [winner.contractor_id]), before);
      const purchase = (await query("select id,funding_source from gef_private.contact_purchases where opportunity_id=$1", [op.op])).rows[0];
      assert.equal(purchase.funding_source, "stripe_test");
      await assert.rejects(() => rpc("gef_refund_contact", [admin, purchase.id, "Synthetic provider refund", "native:wrongrefund"]), /separate provider refund/);
      await rpc("gef_refund_test_order", [admin, winner.id, "native:striperefund", "Synthetic refund acknowledgment"]);
      assert.equal((await rpc("gef_refund_test_order", [admin, winner.id, "native:striperefund", "Synthetic refund acknowledgment"])).created, false);
      assert.deepEqual(await rpc("gef_wallet_summary", [winner.contractor_id]), before);
    });
    await t.test("profile-service payment has its own price and never changes opportunity wallet", async () => {
      await rpc("gef_admin_configuration", [admin, "profile_service_price", { version: "native-service", amount_cents: 2500, effective_at: new Date().toISOString() }, "Synthetic assisted profile price", "native:serviceprice"]);
      const order = await rpc("gef_create_test_order", [owner, "profile_service", null, "native:service001"]);
      assert.equal(order.amount_cents, 2500); assert.equal(order.quote_id, null);
      await rpc("gef_bind_test_session", [order.id, "cs_test_service001"]);
      const before = await rpc("gef_wallet_summary", [owner]);
      await assert.rejects(() => rpc("gef_confirm_test_order", [order.id, "evt_service001", "cs_test_service001", "pi_service001", "paid", 2501, "USD", "test"]));
      await assert.rejects(() => rpc("gef_confirm_test_order", [order.id, "evt_service001", "cs_test_service001", "pi_service001", "paid", 2500, "USD", "live"]));
      await rpc("gef_confirm_test_order", [order.id, "evt_service001", "cs_test_service001", "pi_service001", "paid", 2500, "USD", "test"]);
      await rpc("gef_confirm_test_order", [order.id, "evt_service002", "cs_test_service001", "pi_service001", "expired", 2500, "USD", "test"]);
      assert.equal((await rpc("gef_test_order_read", [order.id])).status, "paid");
      assert.deepEqual(await rpc("gef_wallet_summary", [owner]), before);
    });
    await t.test("failed/expired Checkout releases its reservation; late payment requires refund", async () => {
      const op = await opportunity(), a = await quote(owner, op), b = await quote(other, op);
      const order = await rpc("gef_create_test_order", [owner, "contact", a, "native:cancel001"]);
      await rpc("gef_bind_test_session", [order.id, "cs_test_cancel001"]);
      await rpc("gef_confirm_test_order", [order.id, "evt_cancel001", "cs_test_cancel001", null, "expired", 1000, "USD", "test"]);
      await rpc("gef_create_test_order", [other, "contact", b, "native:cancel002"]);
      const late = await rpc("gef_confirm_test_order", [order.id, "evt_cancel002", "cs_test_cancel001", "pi_cancel001", "paid", 1000, "USD", "test"]);
      assert.equal(late.status, "refund_required");
      assert.equal(Number((await query("select count(*) n from gef_private.contact_purchases where opportunity_id=$1", [op.op])).rows[0].n), 0);
    });
  } finally { if (sandbox) await sandbox.close(); else await db.close(); }
});
