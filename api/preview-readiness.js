"use strict";
const { json, method } = require("./admin/_auth");
const { protectedPreview } = require("./_lib/preview-target");
const { inspect } = require("../scripts/preview-readiness");
module.exports = function handler(req, res) {
  if (!method(req, res, ["GET"])) return;
  if (!protectedPreview()) return json(res, 404, { error: "Not found" });
  // Available while the marketplace flag is false; no DB calls or secret values.
  const result = inspect(process.env, { requireMarketplaceEnabled: false });
  return json(res, result.ready ? 200 : 503, {
    ...result,
    marketplace_enabled: process.env.GETESTIMATEFAST_MARKETPLACE_PREVIEW === "true",
    configuration_only: true,
    database_integrity_verified: false
  });
};
