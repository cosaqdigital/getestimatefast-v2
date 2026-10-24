"use strict";
const fs = require("node:fs"), path = require("node:path"), crypto = require("node:crypto");
// Inventory only. Cannot connect, migrate, seed users or configure any environment.
const projectRef = "cpjsbijgijeyrwjpuciv";
const files = [
 "development_baseline_permissions.sql",
 "getestimatefast_leads.sql", "getestimatefast_marketplace_foundation.sql",
 "getestimatefast_admin_status_rpc.sql", "admin_approve_lead.sql",
 "getestimatefast_contractors_foundation.sql", "contractor_consent_fields.sql",
 "contractor_auto_enable.sql", "opportunity_publication_preview.sql",
 "admin_reconfirm_legacy_review.sql", "controlled_matching_rounds.sql",
 "sms_simulation_preview.sql", "zenvia_us_webhook_safety.sql",
 "us_marketplace_financial_foundation.sql", "us_public_profiles_reviews.sql",
 "us_marketplace_read_models.sql", "us_topup_test_contract.sql",
 "us_public_review_rate_limit.sql", "us_portfolio_storage.sql", "us_stripe_test_checkout.sql"
];
function inventory() {
 return { project_ref: projectRef, project_name: "getestimatefast-development", remote_execution_enabled: false,
  scripts: files.map((name, index) => { const data = fs.readFileSync(path.join(__dirname, "../sql", name)); return { order: index + 1, name, sha256: crypto.createHash("sha256").update(data).digest("hex") }; }),
  excluded: [{ name: "contractor_admin_review_rpc.sql", reason: "Superseded by contractor_auto_enable.sql; applying it later weakens current moderation rules." }] };
}
module.exports = { projectRef, files, inventory };
if (require.main === module) console.log(JSON.stringify(inventory(), null, 2));
