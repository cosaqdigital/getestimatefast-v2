"use strict";
const assert = require("node:assert/strict");
const test = require("node:test");
const { calculateMatch, coordinates, haversineMiles, cityMatches } = require("../api/_lib/florida-matching");
// Artificial ZIP coordinates only, for deterministic isolated logic tests.
const zipLookup = zip => ({
  "33569": {state:"FL",latitude:27.85,longitude:-82.3},
  "33578": {state:"FL",latitude:27.86,longitude:-82.34},
  "33701": {state:"FL",latitude:27.77,longitude:-82.64},
  "10001": {state:"NY",latitude:40.75,longitude:-73.99}
})[zip] || null;
const p = {account_status:"active",email_verified_at:"2026-10-09T00:00:00Z",state_code:"FL",
  base_zip:"33569",service_radius_miles:25,service_categories:["Flooring"]};
const o = {service_category:"Flooring",zip_code:"33578",city:"Riverview"};
test("same zip = 0 miles", () => assert.equal(calculateMatch(p,{...o,zip_code:"33569"},zipLookup).distance_miles,0));
test("nearby city within radius", () => assert.equal(calculateMatch(p,o,zipLookup).eligible,true));
test("farther than the chosen radius fails closed", () => assert.equal(calculateMatch({...p,service_radius_miles:20},{...o,zip_code:"33701"},zipLookup).eligible,false));
test("larger radius covers neighboring cities", () => assert.equal(calculateMatch({...p,service_radius_miles:60},{...o,zip_code:"33701"},zipLookup).eligible,true));
test("category must match", () => assert.equal(calculateMatch(p,{...o,service_category:"Painting"},zipLookup).reason,"different_category"));
test("Other Services matches any active professional within radius", () => assert.equal(calculateMatch(p,{...o,service_category:"Other Services"},zipLookup).eligible,true));
test("inactive and unverified professionals cannot see opportunities", () => {
  assert.equal(calculateMatch({...p,email_verified_at:null},o,zipLookup).eligible,false);
  assert.equal(calculateMatch({...p,account_status:"suspended"},o,zipLookup).eligible,false);
});
test("unknown or out-of-state ZIP has no automatic match",()=>{
  assert.equal(calculateMatch(p,{...o,zip_code:"99999"},zipLookup).reason,"unrecognized_zip");
  assert.equal(calculateMatch(p,{...o,zip_code:"10001"},zipLookup).reason,"unrecognized_zip");
});
test("distance is symmetric and city filter optional",()=>{
  const a=coordinates("33569",zipLookup),b=coordinates("33701",zipLookup);
  assert(Math.abs(haversineMiles(a,b)-haversineMiles(b,a))<1e-9);
  assert(cityMatches("Riverview","riverview"));
  assert(cityMatches("Tampa",""));
  assert(!cityMatches("Tampa","Riverview"));
});
