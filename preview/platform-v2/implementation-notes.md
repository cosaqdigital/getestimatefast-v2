# Platform V2 Implementation Notes

## UX / CRO decisions

- The home now frames the business as a regional matching platform, not just a form.
- The main CTA points to exploration first, because trust and service clarity must come before a detailed form.
- Trust is repeated in short, readable units.
- The service page explains why detailed requests exist before the user reaches the form.
- The local page is designed to feel geographically real, not mass-produced.
- Different quote flows are shown for different service complexity levels.

## SEO decisions

- Category pages are used for broader intent and internal linking.
- Service pages are used for high-intent commercial searches.
- Local pages are used for service + city combinations.
- FAQs should support both search intent and objection handling.
- Nearby-area internal links should strengthen regional topical authority.

## Scalability recommendation

Before implementing dozens or hundreds of pages, move to a template/data system such as:
- one HTML template per page type
- shared CSS component system
- shared content/data files for:
  - services
  - categories
  - cities
  - FAQs
  - nearby city relationships

Recommended content data model:
- `services.json`
- `categories.json`
- `cities.json`
- `faq-service.json`
- `faq-location.json`

This will reduce manual maintenance and improve consistency across the platform.
