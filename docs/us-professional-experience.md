# US Professional Portal UX — GetEstimateFast Development

The Brazilian professional dashboard was analyzed as a **read-only business-process reference**, not integrated.

The independent US portal now features an initial overview, separate opportunities/public profile/account/finance screens, a 2-step business profile, phone-friendly service categories, and collapsed optional public fields. Existing endpoint names, validation and consent flags remain unchanged. Public profile publication still requires a deliberate publish checkbox; private phone/email remain opt-in only.

No production deployments or public registrations are enabled. SMS remains dry-run, marketplace payments and contact releases stay disabled. Test using the private Development preview with a confirmed contractor account, then validate mobile, public-profile editing, and a synthetic opportunity before rollout.

Because the simplified interface is progressive enhancement and uses the current DOM structure, automated and real browser tests are required before merging.
