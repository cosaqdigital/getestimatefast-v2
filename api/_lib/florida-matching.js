"use strict";
// Backend-only geographic matching. ZIP centroids are approximate:
// geodesic distance is NOT actual driving distance, travel time or a legal service area.
const MAX_RADIUS_MILES = 100;
const MAX_CATEGORY_COUNT = 12;
let cachedLookup = null;

function lookupZip(zip) {
  if (!cachedLookup) cachedLookup = require("zipcodes").lookup;
  return cachedLookup(zip);
}
function cleanZip(value) {
  const zip = String(value ?? "").trim();
  return /^\d{5}$/.test(zip) ? zip : null;
}
function coordinates(value, lookup = lookupZip) {
  const zip = cleanZip(value);
  if (!zip) return null;
  const z = lookup(zip);
  if (!z || z.state !== "FL") return null;
  const latitude = Number(z.latitude), longitude = Number(z.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)
    || latitude < 24 || latitude > 32 || longitude < -89 || longitude > -79) return null;
  return { zip, latitude, longitude };
}
function haversineMiles(a, b) {
  const deg = Math.PI / 180;
  const dLat = (b.latitude - a.latitude) * deg, dLng = (b.longitude - a.longitude) * deg;
  const f = Math.sin(dLat / 2) ** 2
    + Math.cos(a.latitude * deg) * Math.cos(b.latitude * deg) * Math.sin(dLng / 2) ** 2;
  return 3958.7613 * 2 * Math.asin(Math.sqrt(Math.min(1, Math.max(0, f))));
}
function serviceMatches(profile, service) {
  return service === "Other Services"
    || (Array.isArray(profile.service_categories) && profile.service_categories.includes(service));
}
function validProfile(profile) {
  const radius = Number(profile?.service_radius_miles);
  return profile?.account_status === "active"
    && profile?.email_verified_at != null
    && profile?.state_code === "FL"
    && Array.isArray(profile?.service_categories)
    && profile.service_categories.length <= MAX_CATEGORY_COUNT
    && Number.isInteger(radius) && radius >= 1 && radius <= MAX_RADIUS_MILES;
}
function calculateMatch(profile, opportunity, lookup = lookupZip) {
  if (!validProfile(profile)) return { eligible: false, reason: "inactive_profile" };
  if (!serviceMatches(profile, opportunity.service_category)) return { eligible: false, reason: "different_category" };
  const from = coordinates(profile.base_zip, lookup), to = coordinates(opportunity.zip_code, lookup);
  if (!from || !to) return { eligible: false, reason: "unrecognized_zip" };
  const miles = haversineMiles(from, to);
  if (miles > Number(profile.service_radius_miles) + 1e-7) return { eligible: false, reason: "outside_radius" };
  return { eligible: true, reason: "within_radius", distance_miles: Math.round(miles * 10) / 10 };
}
function cityMatches(candidate, requestedCity) {
  return !requestedCity || String(candidate || "").trim().toLowerCase() === String(requestedCity).trim().toLowerCase();
}
module.exports = { MAX_RADIUS_MILES, cleanZip, coordinates, haversineMiles, serviceMatches, validProfile, calculateMatch, cityMatches };
