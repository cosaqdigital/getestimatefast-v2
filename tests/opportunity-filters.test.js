"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),{parseFilters,matchesFilters}=require("../api/_lib/opportunity-filters");
const lookup=zip=>({33569:{state:"FL",latitude:27.85,longitude:-82.3},33578:{state:"FL",latitude:27.86,longitude:-82.34},33701:{state:"FL",latitude:27.77,longitude:-82.64}})[zip];
const p={account_status:"active",email_verified_at:"2026-10-09",state_code:"FL",base_zip:"33569",service_radius_miles:25,service_categories:["Painting"]};
const o={service_category:"Painting",city:"Riverview",zip_code:"33578",commercial:null};
test("new filters cannot enlarge authorized coverage or categories",()=>{
 assert(matchesFilters(o,p,parseFilters({}),lookup));assert(!matchesFilters({...o,service_category:"Flooring"},p,parseFilters({}),lookup));
 assert(!matchesFilters({...o,zip_code:"33701"},{...p,service_radius_miles:10},parseFilters({zip:"33701",radius:100}),lookup));
 assert(!matchesFilters(o,p,parseFilters({city:"Tampa"}),lookup));assert(!matchesFilters(o,p,parseFilters({category:"Flooring"}),lookup));
 assert.throws(()=>parseFilters({category:"Unknown"}));assert.throws(()=>parseFilters({zip:"10001"}));assert.throws(()=>parseFilters({radius:0}));
});
test("expired opportunities are separated without exposing contacts",()=>{
 const expired={...o,commercial:{available:false,reason:"expired"}};
 assert(!matchesFilters(expired,p,parseFilters({}),lookup));assert(matchesFilters(expired,p,parseFilters({availability:"expired"}),lookup));assert(!matchesFilters(o,p,parseFilters({availability:"expired"}),lookup));
});

test("direct opportunity filter narrows but never expands access",()=>{
 const id="123e4567-e89b-42d3-a456-426614174000";
 const other="123e4567-e89b-42d3-a456-426614174001";
 const direct=parseFilters({opportunity_id:id});
 assert.equal(direct.opportunity_id,id);
 assert(matchesFilters({...o,opportunity_id:id},p,direct,lookup));
 assert(!matchesFilters({...o,opportunity_id:other},p,direct,lookup));
 assert(!matchesFilters({...o,opportunity_id:id,service_category:"Flooring"},p,direct,lookup));
 assert.throws(()=>parseFilters({opportunity_id:"not-a-uuid"}));
});
