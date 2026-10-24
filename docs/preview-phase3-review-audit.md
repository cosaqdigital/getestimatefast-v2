# Phase 3 review audit — before implementation

Base: draft PR #55. Only Development `cpjsbijgijeyrwjpuciv` and its protected Preview are authorized.

## Existing protections

- Single-use, SHA-256 hashed invitations expire after 30 days; issuance is limited to 20 per professional per day.
- The submission transaction locks the invitation; unique constraints protect invitation reuse and repeated reviewer identity per professional.
- Email identity is a normalized HMAC, not proof of email ownership. External reviews retain their external source label.
- Reviews begin pending. Only approved reviews are projected publicly. Moderation requires an administrator, a reason and an idempotency key, and records an audit decision.
- Browser roles cannot execute the privileged review RPCs directly.

## Missing or incomplete functionality identified before changes

1. **Self-review prevention is absent.** Submission does not compare the reviewer with the professional. A different unverified email can also evade identity deduplication. A database function change needs additional authorization; none will be applied in this phase.
2. **Reviewer email ownership is unverified.** The form accepts a declared email. No email delivery or authentication requirement will be introduced without agreeing on the external-review flow.
3. **No aggregate public rating exists.** Profiles show individual approved ratings, not an average or total reputation score. A complete database aggregate needs a separately authorized function change.
4. Invitation reuse and identity conflicts currently return a generic HTTP 503 rather than a useful conflict message. An allowlisted server error mapping can improve this without changing SQL or privileges.
5. The report dialog has no accessible name or explicit focus restoration. These can be corrected in frontend code.
6. Review identity secrets differ between isolated branches sharing this development database. Identity deduplication is guaranteed only for the same identity-secret domain; cross-branch secret governance remains unresolved. Do not generate another secret and claim cross-branch uniqueness.
7. White normal-size text on the orange review/moderation buttons has a calculated contrast of 3.31:1, below the 4.5:1 minimum. Scope a darker orange to review submission, moderation and reporting controls.

The hosted audit will use the already configured PR #55 Preview. Code fixes will be proposed in a new draft PR; no remote schema changes, new grants, external deliveries or financial operations are authorized here.
