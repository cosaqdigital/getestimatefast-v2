# Platform Phase 1 Staging Build

This folder contains the first real functional implementation of the new GetEstimateFast platform direction.

## Scope

Included in this phase:
- Homepage
- Services hub
- Remodeling & Construction category page
- Kitchen Remodeling service page
- Kitchen Remodeling in Riverview local page
- Complex kitchen quote flow
- Fast house cleaning quote flow
- Improved thank-you page

## Safety

- no deploy
- no production changes
- no replacement of live files

## Architecture

Shared assets:
- `assets/platform.css`
- `assets/platform-data.js`
- `assets/platform-render.js`
- `assets/platform-forms.js`

## Review locally

Open these files directly:
- `index.html`
- `services.html`
- `category-remodeling-construction.html`
- `service-kitchen-remodeling.html`
- `location-kitchen-remodeling-riverview-fl.html`
- `quote-flow-kitchen.html`
- `quote-flow-house-cleaning.html`
- `thank-you.html`

## Notes

- Forms use FormSubmit temporarily
- Redirect still points to the live thank-you URL for compatibility
- Robots remain `noindex,nofollow` in this staging build
