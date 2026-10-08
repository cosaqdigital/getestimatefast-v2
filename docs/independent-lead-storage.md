# Independent lead storage (not enabled yet)

This is exclusively for **GetEstimateFast**, NOT Orçamentos Brasil. The linked Supabase account currently has no dedicated GetEstimateFast project, so **do not reuse an existing project**.

## Enable safely
1. Provision a separate Supabase project dedicated to GetEstimateFast, ideally a US region.
2. Run `sql/getestimatefast_leads.sql` in that project alone. Confirm RLS enabled; `anon` and `authenticated` have no grants or policies.
3. In the **GetEstimateFast Vercel project only**, add **server-side secrets**:
   - `GETESTIMATEFAST_SUPABASE_URL` = its unique Supabase URL (config/environment variable).
   - `GETESTIMATEFAST_SUPABASE_SECRET_KEY` = dedicated project secret/service-role key (sensitive secret; never public).
   - `LEAD_PERSISTENCE_ENABLED=true` (plain config, set only after schema and secrets have been verified).
4. Keep existing `RESEND_API_KEY`, `LEAD_TO_EMAIL` and `LEAD_FROM_EMAIL`; email stays as notification.
5. Test using an isolated preview deployment and a noncustomer test lead; verify exactly one row created, email sent, success redirect; test database failure returns 503 and **does not send** misleading success; test email failure after insert returns thank-you because lead exists.
6. Enable production only after validation and monitoring.

**Important:** This change does not migrate the eight old FormSubmit forms. Those still need a separate, validated migration.

**Known follow-up:** Add robust duplicate protection, upload size/count/type caps, rate limiting, retention/privacy consent and secure attachment storage before launching paid lead distribution. Current notification logic does not store attachment contents in the database; attachments are passed to email only.

**Key safety:** The backend checks that the configured endpoint is a Supabase HTTPS host and sends secrets server-side, but project identity must be verified during deployment. Do not use a Supabase project belonging to Orçamentos Brasil.
