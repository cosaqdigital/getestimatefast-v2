"use strict";
const DEVELOPMENT_REF = "cpjsbijgijeyrwjpuciv";
const VALIDATION_BRANCH = "feat/hosted-preview-validation-20261010";
const PREVIEW_BRANCHES = Object.freeze([
  "feat/isolated-preview-stripe-test-20261009",
  "feat/development-db-preflight-20261009",
  VALIDATION_BRANCH,
  "feat/preview-auth-validation-20261010",
  "feat/preview-phase2-validation-20261010",
  "feat/preview-reviews-validation-20261010",
  "feat/google-review-auth-20261010"
]);
function protectedPreview(env = process.env) {
  return env.VERCEL_ENV === "preview" && PREVIEW_BRANCHES.includes(env.VERCEL_GIT_COMMIT_REF);
}
module.exports = { DEVELOPMENT_REF, VALIDATION_BRANCH, PREVIEW_BRANCHES, protectedPreview };
