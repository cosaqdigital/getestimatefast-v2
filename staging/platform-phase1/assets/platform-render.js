(function () {
  const data = window.platformData;
  if (!data) return;

  const app = document.getElementById("app");
  if (!app) return;

  const site = data.site;
  const page = document.body.dataset.page;

  function header(active) {
    return `
      <div class="stage-banner">Staging Phase 1 • Local functional build • No production changes</div>
      <header class="site-header">
        <div class="container">
          <div class="header-inner">
            <div class="brand-block">
              <a class="brand" href="index.html">${site.name}</a>
              <span class="brand-pill"><strong>Free</strong> to use for homeowners and businesses</span>
            </div>
            <nav class="nav">
              <a class="nav-link" href="services.html">Services</a>
              <a class="nav-link" href="category-remodeling-construction.html">Categories</a>
              <a class="nav-link" href="service-kitchen-remodeling.html">Popular Service</a>
              <a class="btn btn-primary" href="${active === "service" ? "quote-flow-kitchen.html" : "services.html"}">Get Quotes</a>
            </nav>
          </div>
        </div>
      </header>
    `;
  }

  function footer() {
    return `
      <footer class="footer">
        <div class="container">
          <div class="panel">
            <div class="footer-note">
              ${site.name} staging build • Regional coverage focus: ${site.region} • This implementation is isolated and not deployed
            </div>
          </div>
        </div>
      </footer>
    `;
  }

  function trustPills(items) {
    return items.map((item) => `<span class="trust-pill">${item}</span>`).join("");
  }

  function cardGrid(items) {
    return items.map((item) => `
      <a class="card" href="${item.href}">
        ${item.image ? `<img src="${item.image}" alt="${item.alt}">` : ""}
        <h3>${item.title}</h3>
        <p>${item.text}</p>
        <span class="btn btn-primary">${item.cta || "View Service"}</span>
      </a>
    `).join("");
  }

  function faqItems(items) {
    return items.map((item) => `
      <div class="faq-item">
        <h3>${item.q}</h3>
        <p>${item.a}</p>
      </div>
    `).join("");
  }

  function homePage() {
    const categoryCards = [
      {
        title: "Remodeling & Construction",
        text: "Kitchen remodeling, bathroom remodeling, additions, general contractors, and larger renovation projects.",
        href: "category-remodeling-construction.html",
        cta: "Explore Category"
      },
      {
        title: "Roofing & Exterior",
        text: "Roofing, roof repair, gutters, fencing, pavers, and exterior improvement projects.",
        href: "services.html",
        cta: "Explore Category"
      },
      {
        title: "Plumbing",
        text: "Plumbing repairs, drain work, fixture installs, leaks, and water heater services.",
        href: "services.html",
        cta: "Explore Category"
      },
      {
        title: "Electrical",
        text: "Panels, lighting, EV chargers, troubleshooting, inspections, and electrical upgrades.",
        href: "services.html",
        cta: "Explore Category"
      },
      {
        title: "HVAC",
        text: "AC repair, replacement, installation, duct cleaning, and indoor comfort services.",
        href: "services.html",
        cta: "Explore Category"
      },
      {
        title: "Flooring & Interior",
        text: "Flooring, drywall, tile, interior painting, and interior finish work.",
        href: "services.html",
        cta: "Explore Category"
      },
      {
        title: "Outdoor & Landscaping",
        text: "Landscaping, lawn care, trees, irrigation, and outdoor cleaning services.",
        href: "services.html",
        cta: "Explore Category"
      },
      {
        title: "Cleaning & General Home Services",
        text: "House cleaning, office cleaning, handyman, junk removal, and general service requests.",
        href: "services.html",
        cta: "Explore Category"
      }
    ];

    const popularServices = [
      data.services["kitchen-remodeling"],
      data.services["bathroom-remodeling"],
      data.services["plumbing"],
      data.services["electrical-services"]
    ].map((service) => ({
      title: service.label,
      text: service.shortText || service.heroText,
      href: service.key === "kitchen-remodeling" ? "service-kitchen-remodeling.html" : "services.html",
      image: service.image,
      alt: `${service.label} service image`,
      cta: "View Service"
    }));

    return `
      ${header("home")}
      <main>
        <section class="hero">
          <div class="container">
            <div class="panel hero-shell">
              <div>
                <div class="eyebrow">Regional platform for home and property services</div>
                <h1>Find trusted local pros and compare quotes with less back-and-forth</h1>
                <p class="lead">GetEstimateFast helps homeowners and businesses request fast estimates, compare local professionals, and submit enough project detail to get more accurate pricing from the start.</p>
                <div class="hero-search">
                  <span>What service do you need?</span>
                  <a class="btn btn-primary" href="services.html">Explore Services</a>
                </div>
                <div class="hero-points">${trustPills(site.trustPoints)}</div>
                <div class="trust-row" style="margin-top:14px;">
                  <span class="trust-pill">Detailed requests help professionals provide better estimates</span>
                  <span class="trust-pill">No spam blast</span>
                </div>
              </div>
              <div class="hero-media">
                <img src="../../assets/images/hero-home-improvement.jpg" alt="Homeowner reviewing project details with a local professional" />
                <div class="hero-review">
                  <div class="stars">${site.heroReviews[0].stars}</div>
                  <p>${site.heroReviews[0].quote}</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section class="section">
          <div class="container">
            <div class="panel">
              <div class="section-head">
                <div class="eyebrow">Most requested services</div>
                <h2>Popular services homeowners look for first</h2>
                <p>These service paths should be easy to find from the home page so users can move into the right quote flow without confusion.</p>
              </div>
              <div class="cards">
                ${cardGrid(popularServices)}
              </div>
            </div>
          </div>
        </section>

        <section class="section">
          <div class="container">
            <div class="panel">
              <div class="section-head">
                <div class="eyebrow">Popular in Tampa Bay</div>
                <h2>Explore categories by project type</h2>
                <p>The platform should feel broad enough to build trust, while still helping users narrow down the service they need quickly.</p>
              </div>
              <div class="cards">
                ${cardGrid(categoryCards)}
              </div>
            </div>
          </div>
        </section>

        <section class="section">
          <div class="container">
            <div class="panel">
              <div class="section-head">
                <div class="eyebrow">How it works</div>
                <h2>How GetEstimateFast helps you compare local professionals</h2>
                <p>Users should understand the process in seconds so the detailed request flow feels useful, not invasive.</p>
              </div>
              <div class="grid-4">
                <div class="detail-card"><div class="icon">1</div><h3>Choose a service</h3><p>Start with the type of work you need so you land on the right page and the right request flow.</p></div>
                <div class="detail-card"><div class="icon">2</div><h3>Share project details</h3><p>Answer guided questions that help professionals understand scope, size, timing, and location.</p></div>
                <div class="detail-card"><div class="icon">3</div><h3>We match your request</h3><p>Qualified requests are shared with relevant local professionals based on service type and coverage area.</p></div>
                <div class="detail-card"><div class="icon">4</div><h3>Compare quotes</h3><p>Review responses and compare local professionals without starting over across multiple sites.</p></div>
              </div>
            </div>
          </div>
        </section>

        <section class="section">
          <div class="container">
            <div class="panel">
              <div class="section-head">
                <div class="eyebrow">Why homeowners trust ${site.name}</div>
                <h2>Built to make detailed quote requests easier and more useful</h2>
                <p>The trust layer should explain why the platform exists and why the detailed form improves quote quality.</p>
              </div>
              <div class="grid-3">
                <div class="detail-card"><div class="icon">A</div><h3>Better request quality</h3><p>Detailed submissions help professionals understand projects earlier and reduce basic follow-up questions.</p></div>
                <div class="detail-card"><div class="icon">B</div><h3>No obligation</h3><p>Users can request quotes and compare options before deciding if they want to move forward.</p></div>
                <div class="detail-card"><div class="icon">C</div><h3>Regional focus</h3><p>The platform is built around Riverview and the Tampa Bay area instead of trying to feel generic or nationwide.</p></div>
              </div>
            </div>
          </div>
        </section>

        <section class="section">
          <div class="container">
            <div class="panel">
              <div class="section-head">
                <div class="eyebrow">Reviews and trust signals</div>
                <h2>What a stronger trust layer should look like</h2>
                <p>Instead of weak generic claims, the platform should combine real feedback, process clarity, and clear expectations.</p>
              </div>
              <div class="review-grid">
                ${data.reviews.map((review) => `
                  <div class="review-card">
                    <div class="stars">${review.stars}</div>
                    <p>${review.quote}</p>
                    <div class="footer-note" style="margin-top:12px; text-align:left;">${review.meta}</div>
                  </div>
                `).join("")}
              </div>
            </div>
          </div>
        </section>

        <section class="section">
          <div class="container">
            <div class="panel">
              <div class="section-head">
                <div class="eyebrow">FAQ</div>
                <h2>Questions users need answered before they submit</h2>
                <p>These answers should reduce fear about spam, explain why details matter, and support SEO.</p>
              </div>
              <div class="faq-list">
                ${faqItems(data.homeFaqs)}
              </div>
            </div>
          </div>
        </section>

        <section class="section">
          <div class="container">
            <div class="panel cta-band">
              <div class="section-head">
                <div class="eyebrow" style="background: rgba(255,255,255,0.12); border-color: rgba(255,255,255,0.18); color: #fff;">Areas we serve</div>
                <h2>Serving Riverview, Tampa Bay, and nearby Florida communities</h2>
                <p class="lead">Start with the service you need and compare local professionals in the areas we actively target.</p>
              </div>
              <div class="areas-list" style="justify-content:center; margin: 0 0 18px;">
                ${site.areas.slice(0, 8).map((area) => `<span class="area-pill">${area}</span>`).join("")}
              </div>
              <a class="btn btn-primary" href="services.html">Find My Service</a>
            </div>
          </div>
        </section>
      </main>
      ${footer()}
    `;
  }

  function servicesPage() {
    const cards = [
      {
        title: "Remodeling & Construction",
        text: "Kitchen remodeling, bathroom remodeling, additions, contractor-led remodels, and larger construction projects.",
        href: "category-remodeling-construction.html",
        cta: "Open Category"
      },
      {
        title: "Roofing & Exterior",
        text: "Roofing, gutters, pavers, fencing, and exterior improvement projects.",
        href: "category-remodeling-construction.html",
        cta: "Open Category"
      },
      {
        title: "Plumbing",
        text: "Leaks, drains, faucets, toilets, and water heater installation or repair.",
        href: "category-remodeling-construction.html",
        cta: "Open Category"
      },
      {
        title: "Electrical",
        text: "Panels, lighting, outlets, EV chargers, inspections, and electrical repairs.",
        href: "category-remodeling-construction.html",
        cta: "Open Category"
      },
      {
        title: "HVAC",
        text: "AC repair, HVAC installation, replacement, air quality, and duct services.",
        href: "category-remodeling-construction.html",
        cta: "Open Category"
      },
      {
        title: "Flooring & Interior",
        text: "Flooring, drywall, interior painting, tile, and indoor finish work.",
        href: "category-remodeling-construction.html",
        cta: "Open Category"
      },
      {
        title: "Outdoor & Landscaping",
        text: "Landscaping, lawn care, trees, irrigation, and pressure washing.",
        href: "category-remodeling-construction.html",
        cta: "Open Category"
      },
      {
        title: "Cleaning & General Home Services",
        text: "House cleaning, move-out cleaning, handyman, junk removal, and general home help.",
        href: "category-remodeling-construction.html",
        cta: "Open Category"
      }
    ];

    return `
      ${header("services")}
      <main class="section">
        <div class="container">
          <div class="panel">
            <div class="breadcrumbs"><a href="index.html">Home</a><span>/</span><span>Services</span></div>
            <div class="section-head">
              <div class="eyebrow">Services hub</div>
              <h1>Browse categories and find the right service faster</h1>
              <p class="lead">This page is built for users who know they need help but are not yet sure which specific service page best matches the project.</p>
            </div>
            <div class="cards">
              ${cardGrid(cards)}
            </div>
          </div>
        </div>
      </main>
      ${footer()}
    `;
  }

  function categoryPage() {
    const category = data.categories[document.body.dataset.categoryKey];
    if (!category) return `${header("category")}<main class="section"><div class="container"><div class="panel"><h1>Category not found</h1></div></div></main>${footer()}`;
    const services = category.services.map((key) => {
      const service = data.services[key];
      return {
        title: service.label,
        text: service.shortText || service.heroText,
        href: key === "kitchen-remodeling" ? "service-kitchen-remodeling.html" : "services.html",
        image: service.image,
        alt: `${service.label} card`,
        cta: "Explore Service"
      };
    });
    return `
      ${header("category")}
      <main class="section">
        <div class="container">
          <div class="panel">
            <div class="breadcrumbs"><a href="index.html">Home</a><span>/</span><a href="services.html">Services</a><span>/</span><span>${category.label}</span></div>
            <div class="section-head">
              <div class="eyebrow">Category page</div>
              <h1>${category.label} quotes near Riverview, FL</h1>
              <p class="lead">${category.intro}</p>
              <div class="trust-row">${trustPills(["Up to 3 free quotes", "Detailed request flow", "Local professionals", "No obligation"])}</div>
            </div>
            <div class="grid-2">
              <div class="copy">${category.seoIntro.map((p) => `<p>${p}</p>`).join("")}</div>
              <div class="detail-card">
                <h3>Why this category page matters</h3>
                <ul class="spec-list">${category.whyItWorks.map((item) => `<li>${item}</li>`).join("")}</ul>
              </div>
            </div>
          </div>

          <div class="panel" style="margin-top:18px;">
            <div class="section-head">
              <h2>Popular services in ${category.label}</h2>
              <p>Each service card should move the user into a more specific page with stronger local relevance and a better quote request flow.</p>
            </div>
            <div class="cards">
              ${cardGrid(services)}
            </div>
          </div>

          <div class="panel" style="margin-top:18px;">
            <div class="section-head">
              <h2>Frequently asked questions about ${category.label.toLowerCase()} quotes</h2>
              <p>These FAQs should support both decision confidence and search visibility.</p>
            </div>
            <div class="faq-list">${faqItems(category.faqs)}</div>
            <div style="margin-top:18px;"><a class="btn btn-primary" href="service-kitchen-remodeling.html">Start with Kitchen Remodeling</a></div>
          </div>
        </div>
      </main>
      ${footer()}
    `;
  }

  function servicePage() {
    const service = data.services[document.body.dataset.serviceKey];
    if (!service) return `${header("service")}<main class="section"><div class="container"><div class="panel"><h1>Service not found</h1></div></div></main>${footer()}`;
    return `
      ${header("service")}
      <main class="section">
        <div class="container">
          <div class="panel hero-shell">
            <div>
              <div class="breadcrumbs"><a href="index.html">Home</a><span>/</span><a href="services.html">Services</a><span>/</span><a href="category-remodeling-construction.html">Remodeling & Construction</a><span>/</span><span>${service.label}</span></div>
              <div class="eyebrow">Service page</div>
              <h1>${service.h1}</h1>
              <p class="lead">${service.heroText}</p>
              <div class="trust-row">${trustPills(["Free to use", "No obligation", "Compare local professionals", "Detailed requests help improve estimates"])}</div>
              <div style="margin-top:18px;"><a class="btn btn-primary" href="quote-flow-kitchen.html">Start My Kitchen Quote Request</a></div>
            </div>
            <div class="hero-media">
              <img src="${service.image}" alt="${service.label} service page image" />
            </div>
          </div>

          <div class="panel" style="margin-top:18px;">
            <div class="section-head">
              <h2>Why this page should convert better</h2>
              <p>The service page should explain the scope clearly, reduce hesitation, and show the user why the guided request is worth completing.</p>
            </div>
            <div class="grid-3">
              ${service.benefits.map((item, index) => `<div class="detail-card"><div class="icon">${String.fromCharCode(65 + index)}</div><h3>Benefit ${index + 1}</h3><p>${item}</p></div>`).join("")}
            </div>
          </div>

          <div class="panel" style="margin-top:18px;">
            <div class="section-head">
              <h2>What’s included in ${service.label.toLowerCase()} requests</h2>
              <p>A strong service page should help users recognize their project and support long-tail SEO naturally.</p>
            </div>
            <div class="grid-2">
              <div class="detail-card">
                <h3>Common project types</h3>
                <ul class="spec-list">${service.projectTypes.map((item) => `<li>${item}</li>`).join("")}</ul>
              </div>
              <div class="detail-card">
                <h3>What helps professionals estimate accurately</h3>
                <ul class="spec-list">
                  <li>Project type and priority</li>
                  <li>Approximate kitchen size or layout</li>
                  <li>Scope details like cabinets, counters, plumbing, or lighting</li>
                  <li>Material status</li>
                  <li>Timeline goals</li>
                  <li>Photos when available</li>
                </ul>
              </div>
            </div>
          </div>

          <div class="panel" style="margin-top:18px;">
            <div class="section-head">
              <h2>Pricing guidance and timeline expectations</h2>
            </div>
            <div class="grid-2">
              <div class="copy"><p>${service.pricingGuidance}</p></div>
              <div class="copy"><p>${service.timelineGuidance}</p></div>
            </div>
          </div>

          <div class="panel" style="margin-top:18px;">
            <div class="section-head">
              <h2>Frequently asked questions about ${service.label.toLowerCase()} quotes</h2>
            </div>
            <div class="faq-list">${faqItems(service.faqs)}</div>
            <div style="margin-top:18px;"><a class="btn btn-primary" href="quote-flow-kitchen.html">Get My ${service.label} Quotes</a></div>
          </div>
        </div>
      </main>
      ${footer()}
    `;
  }

  function locationPage() {
    const service = data.services[document.body.dataset.serviceKey];
    const city = data.cities[document.body.dataset.cityKey];
    if (!service || !city) return `${header("location")}<main class="section"><div class="container"><div class="panel"><h1>Location page not found</h1></div></div></main>${footer()}`;
    return `
      ${header("location")}
      <main class="section">
        <div class="container">
          <div class="panel">
            <div class="breadcrumbs"><a href="index.html">Home</a><span>/</span><a href="services.html">Services</a><span>/</span><a href="service-kitchen-remodeling.html">${service.label}</a><span>/</span><span>${city.label}</span></div>
            <div class="eyebrow">Local page</div>
            <h1>${service.label} in ${city.label}</h1>
            <p class="lead">Find local professionals for ${service.label.toLowerCase()} projects in ${city.city} and nearby areas with a request flow built to collect useful quote details without making the process feel overwhelming.</p>
            <div class="trust-row">${trustPills(["Local professionals near you", "No obligation", "Detailed requests improve quote quality", "Free to use"])}</div>
          </div>

          <div class="panel" style="margin-top:18px;">
            <div class="section-head">
              <h2>Why this page should feel local</h2>
            </div>
            <div class="grid-2">
              <div class="copy">${city.localContext.map((p) => `<p>${p}</p>`).join("")}</div>
              <div class="detail-card">
                <h3>Nearby areas to reference naturally</h3>
                <ul class="spec-list">${(city.nearby || []).map((key) => `<li>${data.cities[key].label}</li>`).join("")}</ul>
              </div>
            </div>
          </div>

          <div class="panel" style="margin-top:18px;">
            <div class="section-head">
              <h2>Frequently asked questions about ${service.label.toLowerCase()} in ${city.city}</h2>
            </div>
            <div class="faq-list">
              <div class="faq-item"><h3>Can I request ${service.label.toLowerCase()} quotes in ${city.city} and nearby areas?</h3><p>Yes. The local page should mention ${city.city} first and naturally include nearby areas when relevant.</p></div>
              <div class="faq-item"><h3>What details should I include for a quote request?</h3><p>Helpful details include the project type, what work is included, rough size or scope, timeline, and photos when available.</p></div>
              <div class="faq-item"><h3>Do I need exact measurements before I start?</h3><p>No. Users should still be able to submit a request even if they only know a general size or are not sure yet.</p></div>
              <div class="faq-item"><h3>What nearby pages should this page link to?</h3><p>It should link to nearby city pages to strengthen internal linking and regional SEO authority.</p></div>
            </div>
          </div>

          <div class="panel" style="margin-top:18px;">
            <div class="section-head">
              <h2>Explore nearby local pages</h2>
            </div>
            <div class="inline-links">
              ${service.nearbyCities.map((cityKey) => `<a class="inline-link" href="location-kitchen-remodeling-riverview-fl.html">${service.label} in ${data.cities[cityKey].label}</a>`).join("")}
            </div>
            <div style="margin-top:18px;"><a class="btn btn-primary" href="quote-flow-kitchen.html">Start My ${city.city} Quote Request</a></div>
          </div>
        </div>
      </main>
      ${footer()}
    `;
  }

  function thankYouPage() {
    return `
      ${header("thank-you")}
      <main class="section">
        <div class="container">
          <div class="panel cta-band">
            <div class="eyebrow" style="background: rgba(255,255,255,0.12); border-color: rgba(255,255,255,0.18); color: #fff;">Request received</div>
            <h1>Thanks, your request was submitted</h1>
            <p class="lead">The thank-you page should reassure the user immediately, explain the next step clearly, and reduce the fear that their request disappeared into a black hole.</p>
            <div class="grid-3">
              <div class="review-card"><h3>What happens next?</h3><p>Tell the user that the request is reviewed and then shared with relevant local professionals when available.</p></div>
              <div class="review-card"><h3>When should they expect contact?</h3><p>Set realistic expectations for response timing without promising more than the process can support.</p></div>
              <div class="review-card"><h3>What can they prepare?</h3><p>Suggest photos, measurements, or notes that may help matched professionals estimate more accurately.</p></div>
            </div>
            <div style="margin-top:22px;">
              <a class="btn btn-primary" href="services.html">Explore More Services</a>
            </div>
          </div>
        </div>
      </main>
      ${footer()}
    `;
  }

  const renderers = {
    home: homePage,
    services: servicesPage,
    category: categoryPage,
    service: servicePage,
    location: locationPage,
    "thank-you": thankYouPage
  };

  if (renderers[page]) {
    app.innerHTML = renderers[page]();
  }
})();
