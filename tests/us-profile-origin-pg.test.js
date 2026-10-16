"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const {createSandbox}=require("../scripts/local-marketplace-sandbox");
const read=()=>fs.readFileSync(path.join(__dirname,"../supabase/prepared-migrations/us-profile-sourced-leads.sql"),"utf8");
const params=[
 "synthetic-profile-painting","6f2c66de-221d-4b6b-a1bc-9b17271618e6",
 "Painting","Synthetic Source Customer","profile-customer@example.invalid","+18135550100",
 "Riverview","33569","Paint the interior of a residential living room, including trim and ceilings.","email",true
];
const asJson=x=>typeof x==="string"?JSON.parse(x):x;
test("disposable PostgreSQL: profile-source capture, review, $0 owner release and paid-owner block",async()=>{
 const box=await createSandbox();
 try{
  await box.db.exec(read());
  const {contractor,other,admin}=box.ids;
  await box.db.query(
   "insert into public.contractor_public_profiles(contractor_id,slug,display_name,city,state_code,zip_code,radius_miles,categories,published) values($1,$2,'Synthetic Painting Business','Riverview','FL','33569',25,'[\"Painting\"]'::jsonb,true)",
   [contractor,params[0]]
  );
  const insert=await box.db.query(
   "select public.gef_create_profile_lead($1,$2::uuid,$3,$4,$5,$6,$7,$8,$9,$10,$11) as result",params
  );
  const initial=asJson(insert.rows[0].result);
  assert.equal(initial.status,"new");assert.equal(initial.duplicate,false);
  const leadId=initial.lead_id;assert(leadId);
  const source=await box.db.query(
   "select contractor_id,profile_slug from gef_private.profile_lead_origins where lead_id=$1",[leadId]
  );
  assert.equal(source.rows[0].contractor_id,contractor);
  assert.equal(source.rows[0].profile_slug,params[0]);
  const duplicate=await box.db.query(
   "select public.gef_create_profile_lead($1,$2::uuid,$3,$4,$5,$6,$7,$8,$9,$10,$11) as result",params
  );
  assert.equal(asJson(duplicate.rows[0].result).duplicate,true);
  assert.equal(asJson(duplicate.rows[0].result).lead_id,leadId);
  assert.equal((await box.db.query("select count(*)::int as n from gef_private.profile_lead_origins")).rows[0].n,1);
  await assert.rejects(box.db.query("select public.gef_profile_origin_contact($1,$2) as result",[contractor,leadId]),/Contact not available/);
  await assert.rejects(box.db.query("select public.gef_profile_origin_contact($1,$2) as result",[other,leadId]),/Contact not available/);

  await box.db.query("select public.admin_approve_lead($1::uuid,'Painting',true,true,null,$2::uuid)",[leadId,admin]);
  const contacts=await box.db.query("select public.gef_profile_origin_contact($1,$2) as result",[contractor,leadId]);
  const free=asJson(contacts.rows[0].result);
  assert.equal(free.amount_cents,0);
  assert.equal(free.phone,"+18135550100");
  assert.equal(free.email,"profile-customer@example.invalid");
  const audit=await box.db.query("select view_count from gef_private.profile_lead_contact_access where lead_id=$1",[leadId]);
  assert.equal(audit.rows[0].view_count,1);
  await box.db.query("select public.gef_profile_origin_contact($1,$2)",[contractor,leadId]);
  const audit2=await box.db.query("select view_count from gef_private.profile_lead_contact_access where lead_id=$1",[leadId]);
  assert.equal(audit2.rows[0].view_count,2);
  const list=asJson((await box.db.query("select public.gef_profile_origin_leads($1) as result",[contractor])).rows[0].result);
  const origin=list.find(r=>r.lead_id===leadId);
  assert(origin);assert.equal(origin.contact_available,true);
  assert.equal(origin.status,"qualified");
  assert.equal(Object.hasOwn(origin,"phone"),false);
  assert.equal(Object.hasOwn(origin,"email"),false);

  const summary="SYNTHETIC DEVELOPMENT REQUEST: interior painting for a living room in Riverview. No personal contact information.";
  await box.db.query("select public.admin_publish_opportunity($1::uuid,$2,$3::uuid)",[leadId,summary,admin]);
  const listed=asJson((await box.db.query("select public.gef_profile_origin_leads($1) as result",[contractor])).rows[0].result);
  const opportunity=listed.find(x=>x.lead_id===leadId)?.opportunity_id;assert(opportunity);
  await assert.rejects(
   box.db.query("insert into gef_private.contact_purchases(contractor_id,opportunity_id) values($1,$2)",[contractor,opportunity]),
   /Your own profile-generated contact is free/
  );
  const paidCount=await box.db.query("select count(*)::int as n from gef_private.contact_purchases where opportunity_id=$1",[opportunity]);
  assert.equal(paidCount.rows[0].n,0);
  const otherList=await box.db.query("select * from public.list_contractor_opportunities($1,0,null)",[other]);
  assert(otherList.rows.some(row=>row.opportunity_id===opportunity));

  const acl=await box.db.query(
   "select has_function_privilege('anon','public.gef_profile_origin_contact(uuid,uuid)','execute') as anonymous,has_function_privilege('authenticated','public.gef_profile_origin_contact(uuid,uuid)','execute') as authenticated,has_function_privilege('service_role','public.gef_profile_origin_contact(uuid,uuid)','execute') as server"
  );
  assert.equal(acl.rows[0].anonymous,false);
  assert.equal(acl.rows[0].authenticated,false);
  assert.equal(acl.rows[0].server,true);
 }finally{await box.close();}
});
