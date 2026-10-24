# GetEstimateFast contractor onboarding - secure foundation

## Current scope
- Created dedicated GetEstimateFast-only contractor_profiles and contractor_verification_events tables.
- Contractors require a verified Supabase Auth account and have fields for name, business, phone, email, city, state, base ZIP, coverage radius, categories and description.
- Accounts default to pending_review. Only an authorized admin may activate, suspend or reject accounts through future protected endpoints.
- All tables have RLS enabled and no anon/authenticated grants or public policies. Only server-side service credentials may access them.
- This phase intentionally has NO self-service signup, login, public contractor search, customer-data access or lead purchase API. Never imply otherwise.

## Next implementation steps
1. Create a complete privacy policy and consent records, define retention limits.
2. Add rate limiting, validation, verification email flow and a server-only contractor signup endpoint.
3. Connect contractor login, profile editing and account review queues to backend-verified Supabase Auth.
4. Build admin review flow, record verification events and do not equate email verification with trade license verification.
5. Test anonymous and unauthorized access, duplicate registration, ZIP and category validation, admin approval, and all failure paths.
6. After explicit signoff, merge staged PRs and roll to production.

## Design intent
- Coverage by five-digit ZIP and 1-100 mile radius; matching engine and real distance computation will be implemented later.
- Never reuse Orçamentos Brasil accounts, databases or tokens.
- Only publish profiles after explicit review and consent.
