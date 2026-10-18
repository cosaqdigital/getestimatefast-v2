# GetEstimateFast — MVP that can operate for one customer and one professional

**Goal:** prove one end-to-end service opportunity in the independent US platform before investing in scale. The Brazilian marketplace is a read-only business-process reference; never link its code, database, users, domains, payments or APIs.

1. **Marketing entry (this PR):** Home with honest conversion copy, customer service picker and professional registration entry, plus English professional landing and signup deep-link. Keep professional marketing page noindex while account flow is preview-only.
2. **One lead saved and emailed:** One synthetic US customer form reaches GetEstimateFast Supabase **Development** and also generates a received notification in the business Gmail. Verify a recorded ID, duplicate handling and admin visibility. No real submission until authorized. The current base branch has optional post-insert Resend while newer draft PRs introduce an outbox worker; select exactly one reviewed operational delivery path, not both.
3. **Admin validates:** Operator inspects category, ZIP, timing, phone and project details, marks the lead qualified and manually publishes one opportunity without exposing customer contacts publicly.
4. **Professional arrives:** One US contractor registers, confirms email, sets ZIP + radius and service, builds and shares a public profile, then views the matched opportunity.
5. **Financial checkout:** Set a simple USD contact fee; verify Stripe TEST mode Checkout/webhook, and release contact only after payment confirmation. No real charges until a separate authorization. SMS is not needed for the first E2E cycle.
6. **Controlled launch:** After hosted Development signoff, request explicit approval to merge/deploy to US Production, observe one real lead and professional, then improve conversion and expand services.

**Deferred:** malware scanner/storage, large attachments (hide file inputs until supported), complex retention, broad automations, extra territories, subscriptions and SMS. Do not turn on draft storage/worker paths prematurely.

**Current state:** Production main uses email-forwarding API without durable Supabase lead capture. Development has code for admin, contractor, public profile, US radius matching and Stripe sandbox, but complete hosted acceptance is not yet demonstrated. This PR changes ONLY marketing and signup routing. No database change, external email, payment, SMS, deploy or merge. Keep preview form submissions disabled until deliberate hosted-test authorization.
