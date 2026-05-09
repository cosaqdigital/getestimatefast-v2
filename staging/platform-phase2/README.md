# Platform Phase 2 SEO-Ready Staging

This folder contains the isolated Phase 2 staging build for GetEstimateFast.

## Goals
- static HTML output for review
- SEO-ready page structure
- stronger trust and anti-spam messaging
- refined quote flows for complex and simple services
- scalable data-driven architecture

## Folder structure
- `data/`
  - `site.json`
  - `categories.json`
  - `services.json`
  - `cities.json`
  - `faqs.json`
  - `nearby-city-relationships.json`
  - `trust-blocks.json`
  - `flows.json`
- `templates/`
  - `base-page.html`
  - `flow-page.html`
- `assets/`
  - `platform.css`
  - `platform-forms.js`
- `scripts/`
  - `generate.ps1`
- `generated-pages/`
  - SEO-ready HTML output for review

## Generate pages

Run:

`powershell -ExecutionPolicy Bypass -File .\scripts\generate.ps1`

## Review the generated pages

Open:
- `generated-pages/index.html`
- `generated-pages/services.html`
- `generated-pages/category-remodeling-construction.html`
- `generated-pages/service-kitchen-remodeling.html`
- `generated-pages/location-kitchen-remodeling-riverview-fl.html`
- `generated-pages/quote-flow-kitchen.html`
- `generated-pages/quote-flow-house-cleaning.html`
- `generated-pages/thank-you.html`

## How to add a new service later
1. Add or expand the service entry in `data/services.json`
2. Add FAQ entries in `data/faqs.json`
3. Add trust copy in `data/trust-blocks.json` if needed
4. Add or expand the request flow in `data/flows.json` if the service gets a dedicated flow
5. Update `scripts/generate.ps1` to include the new page in output if it becomes part of the active build
6. Regenerate pages

## How to add a new city later
1. Add the city in `data/cities.json`
2. Add nearby relationships in `data/nearby-city-relationships.json`
3. Add local FAQ entries in `data/faqs.json` for the relevant page key
4. Update the generator to output that local page
5. Regenerate pages

## Notes
- The generated HTML is intentionally marked `noindex,nofollow` for staging review.
- Canonicals already point to intended production URLs.
- Production files in the repo root were not changed.
- No deploy was performed.
