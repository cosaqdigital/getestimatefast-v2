# GetEstimateFast Platform Restructure Plan

This document defines a non-production proposal for repositioning GetEstimateFast as a regional platform that connects homeowners and businesses with local professionals.

## 1. Positioning

Primary positioning:
- Find trusted local professionals
- Compare estimates
- Request fast quotes
- Get matched for residential and commercial services

Primary user promise:
- `Tell us what service you need and compare local estimates without obligation.`

Platform framing:
- GetEstimateFast is not only a quote form
- GetEstimateFast is a regional service discovery and lead qualification platform
- The platform helps users submit enough project detail so professionals can estimate with less back-and-forth

## 2. Proposed Site Architecture

### Core pages
- `/`
- `/services/`
- `/thank-you.html`
- `/about/`
- `/how-it-works/`
- `/areas/`

### Category pages
- `/services/remodeling-construction/`
- `/services/roofing-exterior/`
- `/services/plumbing/`
- `/services/electrical/`
- `/services/hvac/`
- `/services/flooring-interior/`
- `/services/outdoor-landscaping/`
- `/services/cleaning-services/`
- `/services/general-home-services/`

### Individual service pages

#### Remodeling & Construction
- `/kitchen-remodeling/`
- `/bathroom-remodeling/`
- `/home-remodeling/`
- `/room-additions/`
- `/general-contractors/`

#### Roofing & Exterior
- `/roofing/`
- `/roof-repair/`
- `/roof-replacement/`
- `/gutters/`
- `/fence-installation/`
- `/pavers/`

#### Plumbing
- `/plumbing/`
- `/drain-cleaning/`
- `/water-heater-installation/`
- `/leak-repair/`

#### Electrical
- `/electrical-services/`
- `/ev-charger-installation/`
- `/panel-upgrade/`
- `/lighting-installation/`

#### HVAC
- `/ac-repair/`
- `/hvac-installation/`
- `/air-conditioning-replacement/`
- `/air-duct-cleaning/`

#### Flooring & Interior
- `/flooring-installation/`
- `/tile-installation/`
- `/drywall-repair/`
- `/interior-painting/`
- `/exterior-painting/`

#### Outdoor & Landscaping
- `/landscaping/`
- `/lawn-care/`
- `/tree-removal/`
- `/irrigation-systems/`
- `/pressure-washing/`

#### Cleaning Services
- `/house-cleaning/`
- `/deep-cleaning/`
- `/move-in-cleaning/`
- `/move-out-cleaning/`
- `/office-cleaning/`
- `/commercial-cleaning/`
- `/post-construction-cleaning/`
- `/airbnb-cleaning/`

#### General Home Services
- `/handyman/`
- `/junk-removal/`
- `/pool-services/`
- `/pest-control/`

### Local page templates
- `/{service}/{city}-fl/`
- examples:
  - `/house-cleaning/tampa-fl/`
  - `/roofing/riverview-fl/`
  - `/plumbing/brandon-fl/`
  - `/kitchen-remodeling/wesley-chapel-fl/`

### SEO content structure
- `/blog/`
- `/blog/category/home-improvement/`
- `/blog/category/local-guides/`
- `/blog/category/maintenance-tips/`

## 3. Phase 1 Priority Rollout

### Keep
- Current production home
- Current thank-you page
- Current service-specific HTML pages

### Build in preview first
- New platform-style home
- Services hub
- Category template
- Service page template
- Location page template
- Improved thank-you page
- Smart form flow concept page

## 4. Navigation Proposal

Header:
- Services
- Areas We Serve
- How It Works
- For Pros
- Get Quotes

Footer:
- Categories
- Popular Services
- Popular Cities
- How It Works
- Contact
- Privacy / Terms

## 5. Home Page UX Proposal

### Hero
- headline focused on finding trusted local pros
- input-like CTA: `What service do you need?`
- secondary supporting text about fast quotes and no obligation
- proof strip with fast response / compare estimates / local professionals

### Main blocks
1. Hero
2. Core categories
3. Popular services
4. How it works
5. Why homeowners use GetEstimateFast
6. Areas served
7. Reviews / trust proof
8. Final CTA

## 6. Smart Form Strategy

### Shared logic
- one question per screen or one small grouped block per screen
- progress indicator
- context microcopy
- trust microcopy before personal data
- conditional questions by service complexity

### Complex-service flow
- remodeling
- roofing
- additions
- general contractors

Recommended flow:
1. Service needed
2. Project type
3. Scope
4. Size / condition
5. Timeline
6. Photos
7. Location
8. Contact

### Simple-service flow
- cleaning
- lawn care
- pressure washing
- handyman

Recommended flow:
1. Service needed
2. Job type
3. Size / frequency
4. Timeline
5. Location
6. Contact
7. Optional photos

## 7. Trust Strategy

Before asking for contact details:
- `No obligation`
- `Free to use`
- `Your request is only shared with matched local professionals`
- `Detailed requests help pros estimate without multiple follow-up calls`

Before submit:
- `You choose how you prefer to be contacted`
- `Used only for this request`
- `Photos are optional`

## 8. Local SEO Strategy

### Initial target cities
- Riverview
- Tampa
- Brandon
- Valrico
- Apollo Beach
- Sun City Center
- Ruskin
- Wimauma
- Lithia
- Seffner
- Plant City
- Gibsonton
- Wesley Chapel
- Lutz
- Land O' Lakes
- Odessa
- Clearwater
- Largo
- St. Petersburg
- Bradenton
- Parrish
- Lakeland
- Palm Harbor
- Dunedin
- Sarasota
- Spring Hill

### City page template structure
1. Service + city headline
2. Local trust paragraph
3. What we help with
4. How it works
5. Nearby areas
6. FAQs
7. CTA

## 9. Suggested Folder Direction

Current repo is flat. For a scalable next phase:

```text
/assets/
/preview/platform-v1/
/templates/
/data/
  services.json
  categories.json
  cities.json
/docs/
```

## 10. Reversible Rollout Rule

Nothing in this preview should replace production until:
1. page-by-page approval
2. CTA flow approval
3. content approval
4. local SEO approval
5. QA approval on mobile
