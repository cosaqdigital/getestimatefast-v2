# Phase 2 Implementation Notes

## What changed from Phase 1

- content is now generated as final HTML instead of being rendered only into `#app` with JavaScript
- core page content is separated into data files
- dedicated FAQ and trust data files were added
- nearby-city relationships were separated for local SEO scaling
- quote flows are now rendered into the final HTML output and JavaScript only handles interaction
- flow copy was refined to reduce the feeling of a lead farm or generic aggregator

## Why this architecture is stronger

- search engines can review final HTML without depending on JavaScript page rendering
- page-level metadata is easier to control
- schemas can be generated consistently per page type
- services and local pages can scale from structured data instead of copy-paste
- the quote flows are easier to QA because their HTML exists before the page loads

## What still needs work before any public staging

- stronger real trust proof or verified reviews
- analytics and step-tracking plan
- richer validation and possibly masked phone/ZIP handling
- more complete schema coverage if more page types are added
- full mobile QA in a real browser
- performance review with final production images

## Recommended next phase

If this Phase 2 staging build is approved:
- expand generation rules for more services
- expand generation rules for more cities
- create a small content system for local differentiation
- build a QA checklist for CTA paths, forms, schemas, and internal links
