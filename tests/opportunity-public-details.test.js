"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const opportunities=require("../api/contractor/opportunities");

test("public opportunity details expose useful scope fields but never customer PII or internal fields",()=>{
 const source={
  "City":"Riverview",
  "ZIP Code":"33569",
  "Full Name":"Private Customer",
  "Phone Number":"8135550100",
  "Email Address":"private@example.invalid",
  "Preferred contact method":"Text message",
  "Service Type":"House Cleaning",
  "Cleaning Type":"Deep cleaning",
  "Cleaning Frequency":"One time",
  "Job Size":"Apartment / condo",
  "Project Description":"Deep clean kitchen, bathrooms and floors.",
  "Timeline":"Within 30 days",
  "Submission Token":"00000000-0000-4000-8000-000000000000",
  "Project Photo Paths":"[\"private/path.png\"]",
  "Project Photo Count":"1",
  "Landing Page":"quote-flow-house-cleaning.html",
  "Landing Page URL":"https://www.getestimatefast.com/house-cleaning/request/",
  "_platform_review":{"required":false},
  "_profile_referral":{"customer_share_accepted":true}
 };
 const safe=opportunities.publicProjectDetails(source);
 assert.deepEqual(safe,{
  "Cleaning Type":"Deep cleaning",
  "Cleaning Frequency":"One time",
  "Job Size":"Apartment / condo",
  "Project Description":"Deep clean kitchen, bathrooms and floors.",
  "Timeline":"Within 30 days"
 });
 for(const blocked of ["Full Name","Phone Number","Email Address","Preferred contact method","Submission Token","Project Photo Paths","Project Photo Count","Landing Page","Landing Page URL","City","ZIP Code","Service Type","_platform_review","_profile_referral"]){
  assert.equal(Object.prototype.hasOwnProperty.call(safe,blocked),false);
 }
});

test("opportunity response binding keeps safe details available without photos",()=>{
 const safe=opportunities.publicProjectDetails({
  "Project Description":"Replace damaged drywall in living room.",
  "Timeline":"Within 30 days",
  "Full Name":"Private Customer",
  "Project Photo Paths":"[]",
  "Submission Token":"00000000-0000-4000-8000-000000000000"
 });
 assert.equal(safe["Project Description"],"Replace damaged drywall in living room.");
 assert.equal(safe["Timeline"],"Within 30 days");
 assert.equal(safe["Full Name"],undefined);
});
