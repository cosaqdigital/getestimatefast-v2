# Work Opportunities MVP

Status: implementation design approved for Development only.
Scope: a second marketplace inside GetEstimateFast for service professionals to post short-term helper/professional opportunities and for registered workers/professionals to apply.

## 1. Product separation

This module is separate from homeowner customer leads.

Customer marketplace:
customer request -> customer lead -> contractor unlocks customer contact.

Work marketplace:
eligible contractor -> work opportunity -> matching workers -> application/contact slot -> opportunity filled.

Do not reuse `leads` or customer lead purchase records for work opportunities.

## 2. Roles and access

### Contractor / service professional
May post a work opportunity only when:
- authenticated;
- `contractor_profiles.account_status = active`;
- required contractor profile fields are complete;
- professional public profile is published/complete.

Capabilities:
- post opportunities;
- choose Helper or Professional;
- set service category from the existing GetEstimateFast launch catalog;
- view applicants and their work profiles;
- close/cancel an opportunity;
- report/block users.

### Work candidate
Registers with a simpler work profile.

Required MVP data:
- profile photo;
- display name;
- contact phone;
- ZIP code;
- work radius;
- service categories;
- languages: English, Portuguese, Spanish;
- opportunity preference: Helper, Professional, or Both;
- short experience/about text.

Capabilities:
- see authenticated-only opportunities that match;
- receive notifications for matching opportunities;
- apply while a contact slot remains;
- view own applications;
- report an opportunity/poster;
- maintain a profile accessible to an eligible poster.

A work candidate does not automatically receive customer leads and does not need a full contractor profile.

A contractor may also create a work profile and apply to work opportunities.

## 3. Opportunity posting flow

Target: publish in under one minute.

Fields:
1. Need type: Helper / Professional.
2. Service category: reuse `assets/launch-categories.js`.
3. ZIP code only. Do not collect job-site street address.
4. Required description.
5. Pay amount.
6. Pay basis: Day initially; data model remains extensible to Hour / Fixed later.
7. Work date.
8. Start time optional.
9. Number of workers/professionals needed.
10. Maximum contact/application slots.
11. Accepted languages: English / Portuguese / Spanish, multi-select.

Poster identity comes from the existing contractor/profile account. Do not ask again for company name, phone, logo, or business details.

## 4. Candidate experience

Opportunity card shows:
- Helper or Professional;
- service category;
- ZIP/city label derived from ZIP;
- description;
- pay;
- work date/time;
- positions needed;
- languages;
- poster company/profile identity;
- remaining contact slots.

Candidate action: `I'm Interested`.

Applying must be atomic:
- reject duplicate application;
- reject if opportunity is closed/filled/cancelled;
- reject when max contact slots is reached;
- reserve exactly one contact slot;
- notify the poster;
- make applicant profile available to the poster.

No paywall for candidates.

## 5. Closing behavior

Two independent limits:
- `workers_needed`: number of people the poster needs.
- `max_contacts`: maximum candidates/contact releases the poster accepts.

When `max_contacts` is reached:
- no new applications/contact releases;
- show Applications Closed.

When all required workers are selected:
- set opportunity to Filled;
- stop notifications;
- prevent new applications;
- keep historical records.

Poster may manually cancel/close before either limit.

## 6. Matching and notifications

Matching inputs:
- service category;
- Helper/Professional preference;
- ZIP distance vs candidate work radius;
- accepted/spoken language compatibility;
- active work profile.

Notification channels for MVP:
- in-platform: always;
- email: matching opportunities;
- SMS: only where the worker has explicitly opted in.

Do not notify after opportunity is filled, cancelled, expired, or contact limit is reached.

Reuse existing Florida ZIP/matching logic where possible, but keep work-marketplace matching tables separate from customer lead matching.

## 7. Visibility and privacy

Work opportunities are not public SEO pages.

Unauthenticated visitors:
- may see a marketing CTA for Find Work;
- may not see live opportunity details.

Authenticated work candidates:
- may see eligible opportunity details;
- may not access other applicants;
- may not access unrelated private user data.

Street address is never collected in MVP. Exact job address is exchanged directly between the parties outside the opportunity form.

## 8. Reports and blocking

Reviews are out of MVP.

Include from day one:
- Report User;
- Report Opportunity;
- Block User.

Suggested report reasons:
- spam;
- fake profile;
- misleading job details;
- payment issue;
- no-show;
- harassment/inappropriate behavior;
- other.

Reports are private/admin-only.

## 9. Monetization

Per eligible contractor:
- 4 free work opportunity posts per calendar month.
- Extra pack: +4 posts for USD 7.
- Extra pack: +15 posts for USD 15.
- Purchased post credits do not expire.
- New monthly free allowance is consumed before purchased credits.

MVP database must support balances/ledger from the start, but paid checkout may be connected after the free posting flow is validated.

Candidate application remains free.

## 10. Proposed data model

Public/authenticated product tables:
- `work_profiles`
- `work_opportunities`
- `work_applications`
- `work_assignments`
- `work_user_blocks`

Private/admin/financial tables:
- `gef_private.work_reports`
- `gef_private.work_post_credit_balances`
- `gef_private.work_post_credit_ledger`

Do not add work data to `leads`.

## 11. RLS principles

Every new public-schema table must have RLS enabled.

Examples:
- work profile owner may update own profile;
- authenticated eligible users may view only the work-profile fields needed for the marketplace;
- opportunity owner may update/cancel own opportunity;
- eligible work users may read open eligible opportunities;
- applicant may create/read own application;
- opportunity owner may read applications only for opportunities they own;
- no user may read another user's reports;
- private financial/reporting tables are not exposed to browser roles.

Authorization must not rely on user-editable JWT user metadata.

## 12. UI placement

### Existing contractor portal
Add a distinct Work Opportunities area:
- Post Opportunity
- My Opportunities
- Applicants

If the contractor also has a work profile:
- Find Work
- My Applications

### Work-only portal
Simple navigation:
- Find Work
- My Applications
- My Profile

Keep customer leads visually and functionally separate.

## 13. Implementation order

1. Create database schema + RLS in Development.
2. Add work-profile registration/profile API.
3. Add contractor posting API with eligibility + monthly credit check.
4. Add candidate opportunity feed + matching.
5. Add atomic application/contact-slot API.
6. Add contractor applicants view and selection/fill flow.
7. Add email/SMS notifications and stop conditions.
8. Add reports/blocking.
9. Add UI to contractor portal and work-only portal.
10. Add checkout for +4 / +15 posting credits.
11. Automated tests + RLS/security regression tests.
12. Hosted Preview acceptance.
13. Only then prepare Production migration.

## 14. Current platform reuse

Reuse:
- Supabase Auth;
- `contractor_profiles`;
- `contractor_public_profiles`;
- launch category catalog;
- Florida ZIP validation/matching utilities;
- existing notification/payment infrastructure where appropriate.

Keep separate:
- customer leads;
- customer contact purchases;
- customer opportunity matching;
- work applications;
- work-post credits.

