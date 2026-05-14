# Phase 2 QA Checklist

## Mobile QA
- Check header spacing and button tap targets
- Check hero readability on small screens
- Check card spacing in home, services, category, and service pages
- Check active vs coming-soon service states on cards and service chips
- Check quote flow progress bar and step transitions
- Check keyboard behavior on phone/email/ZIP inputs
- Check that step changes scroll to the quote shell, not the top of the page
- Check that validation errors are readable and disappear after correction

## CTA path QA
- Home primary CTA -> services page
- Home secondary CTA -> services page
- Services hub -> category and service targets
- Services hub -> premium services, standard services, and neutral inactive states
- Category page -> kitchen service page
- Service page -> kitchen quote flow
- Local page -> kitchen quote flow
- Thank-you page -> services/home

## Form QA
- Kitchen flow:
  - 8-step structure
  - project type selection
  - multi-select kitchen areas step
  - conditional layout question only when `Layout changes` is selected
  - size step
  - timeline step
  - optional description field
  - optional photo upload
  - location validation
  - contact validation
  - hidden subject line output after submit preparation
- House cleaning flow:
  - cleaning type selection
  - cleaning frequency step
  - home size step
  - optional note
  - location validation
  - contact validation
- Standard flow:
  - service preselection via `?service=roofing` style query param
  - service step hidden when preselected
  - project intent step
  - project description step
  - timeline step
  - location validation
  - contact validation
- Endpoint:
  - `action="/api/lead"`
  - `method="POST"`
  - `enctype="multipart/form-data"`
- Subject line behavior:
  - Kitchen and standard flows: `Customer Name - Service Type - ZIP Code - Timeline`
  - House cleaning flow: `Customer Name - House Cleaning - ZIP Code - Cleaning Type/Frequency`
- Serverless lead handling:
  - successful submit returns `303` to `/thank-you.html`
  - invalid input returns friendly error page
  - honeypot field remains empty on real submissions

## SEO QA
- Check `title` and `meta description` per page
- Check `canonical` per page
- Check `noindex,nofollow` remains on staging pages
- Check schema presence:
  - Organization
  - FAQPage where applicable
  - BreadcrumbList
  - Service or CollectionPage
- Check internal links between home, services, category, service, local, and quote pages
- Check that inactive items do not create dead-end hrefs

## Performance QA
- Check CSS size and render consistency
- Check if any images feel oversized
- Check form interactivity on slower mobile devices
- Check if page load feels blocked by non-critical assets

## Tracking Attribute QA
- Check key CTAs for:
  - `data-track`
  - `data-cta`
- Check flow steps for:
  - `data-flow-step`
  - `data-service`
- Check flow buttons for:
  - `data-action="continue"`
  - `data-action="back"`
  - `data-action="submit"`
- Check local CTAs for:
  - `data-city`
