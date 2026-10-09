"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {parseUsd,quotePrice,topupChoices}=require("../api/_lib/marketplace-pricing");
// Synthetic values only, never launch prices.
const rule={version:"synthetic-v1",category:"Painting",currency:"USD",base_cents:1999,floor_cents:100,max_buyers:2,lifetime_hours:120,scope_bps:{small:10000,large:15000},urgency_bps:{urgent:12000},discounts:[{after_hours:24,bps:1000},{after_hours:48,bps:2000}]};
const input={category:"Painting",published_at:"2026-10-09T00:00:00Z",buyer_count:0,scope:"small"};
test("USD parsing rejects fractions beyond cents, floating numbers and negatives",()=>{
 assert.equal(parseUsd("19.99"),1999);assert.equal(parseUsd("0.01"),1);
 for(const v of [19.99,"1.005","-5","$10","1e3","0","NaN"])assert.throws(()=>parseUsd(v));
});
test("category, scope and urgency rules use exact integer rounding",()=>{
 assert.equal(quotePrice(rule,{...input,scope:"large",urgency:"urgent"},new Date("2026-10-09T12:00:00Z")).amount_cents,3599);
 assert.throws(()=>quotePrice(rule,{...input,scope:"unknown"}));
 assert.throws(()=>quotePrice(rule,{...input,category:"Flooring"}));
});
test("discount boundaries expire quotes and opportunity independently of SMS recipient count",()=>{
 const q=quotePrice(rule,input,new Date("2026-10-09T23:59:00Z"));assert.equal(q.quote_valid_until,"2026-10-10T00:00:00.000Z");
 assert.equal(quotePrice(rule,input,new Date("2026-10-10T00:00:00Z")).amount_cents,1799);
 assert.equal(quotePrice(rule,input,new Date("2026-10-14T00:00:00Z")).reason,"expired");
 assert.equal(quotePrice(rule,{...input,buyer_count:2},new Date("2026-10-09T01:00:00Z")).reason,"buyer_limit");
});
test("no default rules or definitive prices; invalid rules fail closed",()=>{
 assert.throws(()=>quotePrice(null,input));assert.throws(()=>quotePrice({...rule,max_buyers:0},input));
 assert.throws(()=>quotePrice({...rule,currency:"BRL"},input));
});
test("exact shortfall stays available even when optional promotions exist",()=>{
 const options=topupChoices(1999,999,[{id:"synthetic",enabled:true,amount_cents:10000,bonus_cents:1000,starts_at:"2026-10-01",ends_at:"2026-11-01"}],new Date("2026-10-09"));
 assert.deepEqual(options[0],{kind:"exact",amount_cents:1000,bonus_cents:0,total_cents:1000,promotion_id:null});assert.equal(options[1].kind,"optional_promotion");
 assert.equal(topupChoices(500,500)[0].amount_cents,0);
});
