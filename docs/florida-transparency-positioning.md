# GetEstimateFast — Transparency-first positioning (Florida only)

**Approved positioning:** "We Connect. You Decide."

## What GetEstimateFast does
- Provides a way for Florida customers to describe projects and request contact from independent service providers.
- May facilitate availability of project details and contact information to interested providers, including via paid contact access when that feature is implemented.
- Enables the customer and provider to speak and negotiate directly.
- May restrict accounts or listings if information is deceptive, abusive or unlawful.

## What GetEstimateFast does NOT claim
- Does not perform, contract for, price, direct or supervise construction services.
- Does not endorse, certify, recommend or independently vet contractors.
- Does not promise a number of bids, responses, estimates, contact attempts, project leads, jobs, hiring outcomes, workmanship, pricing or availability.
- Automatic account activation means only that the email and required registration fields were completed; it is **not** a quality credential or verified trade qualification.
- Does not guarantee that any provider has required licenses, insurance, permits or qualifications.

## Copy rules on all public pages
- Use "independent service provider", "connection", "request", "may respond", "no obligation to hire".
- Avoid "trusted pros", "licensed/insured pros", "vetted", "verified", "certified", "approved", "background-checked", "guaranteed matches", "get multiple bids" or "best" unless the specific claim is substantiated and reviewed.
- Acknowledge that provider replies, availability and quotes are **not guaranteed**.
- Present customer choice and direct dealings between customers and providers.
- Where personal details are collected, clearly describe potential sharing of request/contact data; full consent, privacy policy, retention and sharing terms still require dedicated implementation.
- Explain transparently, before any provider pays, that the fee purchases access to a contact opportunity rather than a guaranteed job.
- Respect advertising and licensure requirements for regulated work in Florida. Not making licensing claims **does not waive** legal duties: final release requires Florida counsel review of categories, advertising, referral fees (especially insurance claims), and platform agreements.

## Public profile design (NOT YET BUILT)
Proposed heading: "<Business name> — Independent Service Provider".
Info: provider-supplied name, category, service region, job examples (after content moderation) and genuine customer reviews (once built).
Neutral notice:
"Profile information is provided by the service provider. GetEstimateFast is a connection platform and does not endorse or certify providers or guarantee their work. Before hiring, confirm that the provider meets any qualifications and legal requirements applicable to your project."
No "verified" check badge; a future email-confirmed indicator must never imply professional credentials.
Avoid publishing private contact information, exact addresses or submissions without proper consent and access controls.

## Administrative account status
- `active`: registration complete and email confirmed; **not** an endorsement or qualification claim.
- `suspended` / `rejected`: restriction for platform-policy or safety reasons, not an authoritative finding about trade licensing.
- Moderation is exception-only; no default manual approval.

## Implementation gates
- These changes are proposed in a feature branch and Preview only. Production remains on existing `main`.
- Review public copy across service/location pages, form screens, FAQs, structured data and ad creatives to remove unsupported claims before launch.
- Build legally reviewed privacy/terms, independent-provider terms, required customer sharing notices, lead payment disclosures and reporting flow.
- Ensure licensing/advertising and consumer-protection compliance for regulated services; keep Florida as initial operating state.
- Confirm old FormSubmit pages and all contact collection mechanisms separately before a production rollout.
- No connection to Orçamentos Brasil infrastructure.
