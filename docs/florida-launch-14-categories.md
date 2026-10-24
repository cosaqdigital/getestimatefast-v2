# Florida launch — approved 14 categories

The public catalog is the ordered list in `assets/launch-categories.js`. That module is used both by the browser and the lead-submission and contractor-profile APIs.

## Approved categories
1. House Cleaning
2. Pressure Washing
3. Flooring
4. Painting
5. Cabinets & Countertops
6. Furniture Assembly
7. Handyman
8. Drywall
9. Yard Cleanup & Other Cleanup
10. Lawn Care & Gardening
11. Pool Cleaning
12. Window Cleaning
13. Carpet & Upholstery Cleaning
14. Other Services

## Other Services — distinct category
- This is not a synonym for Other Cleanup: it is for household work not represented in the thirteen named categories.
- The client describes the requested work in an **English free-text field with at least 60 characters**; both frontend and server enforce the minimum. Server also caps description at 3,000 characters.
- All submissions still require contact and location details.
- `Other Services` carries `reviewRequired: true` and `generalAudience: true` as catalog intent flags. **There is currently NO automatic all-contractor broadcast or contractor opportunity browsing** in the implemented code: publishing/notification and lead purchases are future phases.
- Admin should inspect the actual text before publishing any Other Services request, filter out regulated/hazardous work outside launch scope, and later let independent professionals decide whether they want that opportunity. Broad audience must not mean unbounded disclosure of personal customer information.

## Controlled launch
- Only approved category names are accepted by `api/lead.js` (including posts to older forms); legacy regulated services are rejected rather than stored.
- Only approved categories are accepted by `api/contractor/profile.js` via the shared allowlist. Existing contractor records with a legacy category are **not deleted**: a future migration/UX mapping is required before enabling public editing.
- The homepage and services directory display the approved catalog. Legacy SEO landing pages and direct quote pages still exist and may contain outdated service offers: **audit redirects, SEO and internal links before opening public launch**. Do not claim the entire site is globally sanitized.
- Location-dependent restrictions (e.g. Tampa water-use rules), contractor-license boundaries and disposal requirements remain operational/legal release gates.
- Automatic contractor registration is not yet public; privacy/terms are still pending.
- Do not publish contact details or sell unreviewed leads, and do not promise service availability, licenses or guaranteed customer responses.
- Production is unchanged; changes reside on stacked draft Preview branches.
