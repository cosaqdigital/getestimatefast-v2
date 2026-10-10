"use strict";
// Preparation only: no credentials, network, remote SQL or Auth writes.
const { DEVELOPMENT_REF, VALIDATION_BRANCH } = require("../api/_lib/preview-target");
function plan() {
  return {
    development_project_ref: DEVELOPMENT_REF,
    vercel_project_id: "prj_kA6x5rt1MChiNSQpa6pShHoUSuOF",
    vercel_team_id: "team_vRw9eJBijmUFe1SbbOFY5xZs",
    preview_branch: VALIDATION_BRANCH,
    remote_execution_enabled: false,
    auth_method: "Supabase Auth admin.createUser with email_confirm=true; never signup/invite/generateLink or direct auth.users SQL",
    password_variable_name: "GETESTIMATEFAST_FIXTURE_PASSWORD",
    accounts: [
      { label: "synthetic-admin", email: "gef-preview-admin@example.invalid", role: "admin" },
      { label: "synthetic-contractor", email: "gef-preview-contractor@example.invalid", role: "contractor", category: "Painting" },
      { label: "synthetic-other", email: "gef-preview-other@example.invalid", role: "contractor", category: "House Cleaning" }
    ],
    identity_mapping: "Use IDs returned by Auth; record fixture IDs privately, enroll only synthetic-admin in admin_users via an authorized development-only SQL step",
    contractor_defaults: { display_name: "SYNTHETIC Preview Business", city: "Riverview", state_code: "FL", base_zip: "33569", service_radius_miles: 25, contact_phone: "8135550100", sms_opt_in: false, privacyConsent: true, termsConsent: true },
    active_profile_requirements: "Before inserting an active synthetic profile, map administrative email confirmation to email_verified_at and fixture consent to privacy_accepted_at/terms_accepted_at with explicit synthetic consent versions. Never weaken contractor_active_requires_complete_profile.",
    opportunities: [
      { service_type: "Painting", full_name: "SYNTHETIC Preview Customer", email: "gef-preview-customer@example.invalid", phone: "8135550199", city: "Riverview", zip_code: "33569", status: "new", public_summary: "SYNTHETIC PREVIEW REQUEST: sample interior painting. No real customer or service." },
      { service_type: "House Cleaning", full_name: "SYNTHETIC Other Customer", email: "gef-preview-other-customer@example.invalid", phone: "8135550198", city: "Riverview", zip_code: "33569", status: "new", public_summary: "SYNTHETIC PREVIEW REQUEST: sample house cleaning. No real customer or service." }
    ],
    publication_flow: "Insert fictitious new leads, then admin_approve_lead and admin_publish_opportunity with the returned admin/lead IDs",
    pricing: { currency: "USD", base_cents: 1234, floor_cents: 100, max_buyers: 2, lifetime_hours: 24, synthetic_only: true },
    ledger_seeds: false,
    reviews: "Submit clearly labelled synthetic test reviews through invitation form; external source, pending until synthetic admin moderation; never import fabricated real testimonials",
    storage: "Upload a generated test image through portfolio-upload with rightsConsent=true; do not use customer photos",
    stripe_checkout_enabled: false,
    external_email_sms_enabled: false
  };
}
module.exports = { plan };
if (require.main === module) {
  if (process.argv.length !== 2) throw Error("Preparation only; remote execution flags are not supported");
  console.log(JSON.stringify(plan(), null, 2));
}
