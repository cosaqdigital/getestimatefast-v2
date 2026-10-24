"use strict";
// Non-secret identity supplied from the user's Sandbox Dashboard. Never accept
// an account chosen by a browser request or infer identity from sk_test alone.
const EXPECTED_TEST_ACCOUNT_ID = "acct_1UOl9qH5rFe1usWF";
function accountConfiguration(env = process.env) {
  if (env.GETESTIMATEFAST_STRIPE_TEST_ACCOUNT_ID !== EXPECTED_TEST_ACCOUNT_ID) throw Error("Approved Stripe Sandbox account configuration required");
  return EXPECTED_TEST_ACCOUNT_ID;
}
async function verifyTestAccount(settings, client) {
  if (settings.expectedAccountId !== EXPECTED_TEST_ACCOUNT_ID || !/^sk_test_[A-Za-z0-9]+$/.test(settings.key || "")) throw Error("Approved Stripe Sandbox account configuration required");
  try {
    // Null selects GET /v1/account, the owner of this key. Do not request
    // /v1/accounts/:expectedId: a Connect lookup would not prove key ownership.
    const account = await client.accounts.retrieve(null);
    if (account?.object !== "account" || account.id !== EXPECTED_TEST_ACCOUNT_ID || account.deleted === true) throw Error("Mismatch");
  } catch {
    // Provider errors may contain identifying data. No cause/raw payload/logging.
    throw Error("Stripe Sandbox identity verification failed");
  }
  return { verified: true };
}
module.exports = { EXPECTED_TEST_ACCOUNT_ID, accountConfiguration, verifyTestAccount };
