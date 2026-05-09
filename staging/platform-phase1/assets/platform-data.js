window.platformData = {
  site: {
    name: "GetEstimateFast",
    baseUrl: "https://www.getestimatefast.com",
    email: "getestimatefast@gmail.com",
    phoneDisplay: "(813) 591-7560",
    phoneHref: "+18135917560",
    region: "Tampa Bay",
    trustPoints: [
      "Free to use",
      "No obligation",
      "Compare local professionals",
      "Your information is shared only with qualified local pros"
    ],
    areas: [
      "Riverview",
      "Tampa",
      "Brandon",
      "Valrico",
      "Apollo Beach",
      "Sun City Center",
      "Ruskin",
      "Wimauma",
      "Lithia",
      "Seffner",
      "Plant City",
      "Gibsonton",
      "Wesley Chapel",
      "Lutz",
      "Land O' Lakes",
      "Odessa",
      "Clearwater",
      "Largo",
      "St. Petersburg",
      "Bradenton",
      "Parrish",
      "Lakeland",
      "Palm Harbor",
      "Dunedin",
      "Sarasota",
      "Spring Hill"
    ],
    heroReviews: [
      {
        stars: "★★★★★",
        quote: "Detailed requests make it easier for local pros to understand the project before they reach out."
      },
      {
        stars: "★★★★★",
        quote: "Compare local professionals without starting over on every site."
      },
      {
        stars: "★★★★★",
        quote: "Built for homeowners who want clearer quotes and less back-and-forth."
      }
    ]
  },
  categories: {
    "remodeling-construction": {
      key: "remodeling-construction",
      label: "Remodeling & Construction",
      slug: "remodeling-construction",
      intro: "Find local professionals for kitchens, bathrooms, additions, contractor-led remodels, and larger home improvement projects.",
      seoIntro: [
        "Homeowners searching for remodeling help often start broad. They may know they want to renovate a kitchen, update a bathroom, add a room, or hire a general contractor, but they are not always sure which service page best matches the project.",
        "This category page is designed to capture broader remodeling and construction intent near Riverview and across the Tampa Bay area, while guiding users into more specific request flows that collect the right level of detail."
      ],
      whyItWorks: [
        "It helps users choose the right service before filling out a detailed quote request.",
        "It supports broader SEO around remodeling, renovation, construction, and contractor searches.",
        "It creates internal links to more specific service pages and future local pages."
      ],
      services: [
        "kitchen-remodeling",
        "bathroom-remodeling",
        "home-remodeling",
        "room-additions",
        "general-contractors"
      ],
      faqs: [
        {
          q: "What remodeling projects can I request quotes for?",
          a: "Users should be able to request estimates for kitchens, bathrooms, whole-home remodels, additions, and contractor-led renovation work."
        },
        {
          q: "Why does GetEstimateFast ask detailed questions?",
          a: "Detailed project information helps professionals understand scope earlier and respond with more accurate quotes or next-step pricing."
        },
        {
          q: "Can I compare more than one professional?",
          a: "The platform is designed to help users compare local professionals when matching and availability support it."
        },
        {
          q: "Do I have to commit after submitting a request?",
          a: "No. Quote requests remain free to use and there is no obligation to move forward with any professional."
        }
      ]
    }
  },
  services: {
    "kitchen-remodeling": {
      key: "kitchen-remodeling",
      label: "Kitchen Remodeling",
      slug: "kitchen-remodeling",
      categoryKey: "remodeling-construction",
      image: "../../assets/images/service-kitchen.png",
      title: "Kitchen Remodeling Quotes Near Riverview, FL | GetEstimateFast",
      meta: "GetEstimateFast helps you compare kitchen remodeling quotes from trusted local professionals near Riverview, FL. Request fast, detailed, and no-obligation estimates.",
      h1: "Get up to 3 free kitchen remodeling quotes near Riverview, FL",
      heroText: "Request kitchen remodeling quotes from trusted local professionals for cabinets, countertops, flooring, backsplashes, lighting, layouts, and full kitchen renovation projects.",
      benefits: [
        "Collect enough detail for more useful first responses",
        "Compare local professionals instead of starting over on multiple websites",
        "Explain the project once and reduce avoidable follow-up calls"
      ],
      included: [
        "Full kitchen remodels",
        "Cabinet replacement or refacing",
        "Countertop replacement",
        "Backsplash installation",
        "Sink and faucet upgrades",
        "Kitchen flooring updates",
        "Lighting and electrical improvements",
        "Appliance installation coordination"
      ],
      projectTypes: [
        "Full kitchen remodel",
        "Cabinet replacement",
        "Cabinet refacing",
        "Countertop replacement",
        "Backsplash installation",
        "Sink or faucet replacement",
        "Kitchen flooring",
        "Lighting upgrade",
        "Appliance installation"
      ],
      pricingGuidance: "Kitchen remodeling costs can vary widely depending on the scope of cabinet work, countertops, layout changes, plumbing updates, electrical work, appliances, materials, and finishes. The goal of the request flow is to collect enough information for more relevant first responses and fewer basic follow-up questions.",
      timelineGuidance: "Smaller kitchen updates may move faster, while larger remodels often require more planning, material decisions, measurements, and scheduling. The platform should make it easy to communicate whether the project is ready soon or still in the planning stage.",
      faqs: [
        {
          q: "Can I request quotes for a small kitchen update?",
          a: "Yes. The flow should support smaller projects like countertops, backsplash, lighting, sink upgrades, or cabinet refreshes, not just full remodels."
        },
        {
          q: "Do I need measurements before I start?",
          a: "No. Users should be able to continue even if they only know the kitchen is small, medium, large, or open-concept."
        },
        {
          q: "Can photos help with pricing?",
          a: "Yes. Photos are optional, but they often help professionals understand the current kitchen layout and scope more accurately."
        },
        {
          q: "Will I receive calls immediately?",
          a: "Response timing depends on project type and availability. The page should explain that matched local professionals may contact the user using the selected contact method."
        }
      ],
      nearbyCities: ["brandon-fl", "valrico-fl", "apollo-beach-fl", "tampa-fl"]
    },
    "bathroom-remodeling": {
      key: "bathroom-remodeling",
      label: "Bathroom Remodeling",
      slug: "bathroom-remodeling",
      image: "../../assets/images/service-bathroom.jpg",
      shortText: "Showers, tubs, vanities, tile, fixtures, waterproofing, and full bathroom remodel projects."
    },
    "home-remodeling": {
      key: "home-remodeling",
      label: "Home Remodeling",
      slug: "home-remodeling",
      image: "../../assets/images/hero-home-improvement.jpg",
      shortText: "Whole-home updates, layout changes, multi-room renovations, and contractor-led remodels."
    },
    "room-additions": {
      key: "room-additions",
      label: "Room Additions",
      slug: "room-additions",
      image: "../../assets/images/hero-home-improvement.jpg",
      shortText: "Bedroom additions, office additions, enclosed spaces, and larger expansion projects."
    },
    "general-contractors": {
      key: "general-contractors",
      label: "General Contractors",
      slug: "general-contractors",
      image: "../../../assets/images/hero-home-improvement.jpg",
      shortText: "Projects requiring planning, multiple trades, coordination, and contractor-level oversight."
    },
    "plumbing": {
      key: "plumbing",
      label: "Plumbing",
      slug: "plumbing",
      image: "../../assets/images/service-plumbing.jpg",
      shortText: "Leaks, drains, faucets, toilets, and water heater installation or repair."
    },
    "electrical-services": {
      key: "electrical-services",
      label: "Electrical Services",
      slug: "electrical-services",
      image: "../../assets/images/service-electrical.jpg",
      shortText: "Panels, outlets, fans, lighting, EV chargers, and electrical repairs."
    },
    "house-cleaning": {
      key: "house-cleaning",
      label: "House Cleaning",
      slug: "house-cleaning",
      image: "../../assets/images/hero-home-improvement.jpg",
      shortText: "Recurring cleanings, deep cleaning, move-in and move-out cleaning, and more."
    }
  },
  cities: {
    "riverview-fl": {
      key: "riverview-fl",
      label: "Riverview, FL",
      city: "Riverview",
      state: "FL",
      nearby: ["brandon-fl", "valrico-fl", "apollo-beach-fl", "gibsonton-fl"],
      localContext: [
        "Many Riverview homeowners look for kitchen upgrades when updating older layouts, refreshing cabinets and countertops, improving lighting, or opening kitchens into adjacent living areas.",
        "A local page should naturally mention Riverview, nearby communities, and the types of remodeling requests that are common in the area without sounding copy-pasted."
      ]
    },
    "brandon-fl": { key: "brandon-fl", label: "Brandon, FL", city: "Brandon", state: "FL" },
    "valrico-fl": { key: "valrico-fl", label: "Valrico, FL", city: "Valrico", state: "FL" },
    "apollo-beach-fl": { key: "apollo-beach-fl", label: "Apollo Beach, FL", city: "Apollo Beach", state: "FL" },
    "gibsonton-fl": { key: "gibsonton-fl", label: "Gibsonton, FL", city: "Gibsonton", state: "FL" },
    "tampa-fl": { key: "tampa-fl", label: "Tampa, FL", city: "Tampa", state: "FL" }
  },
  reviews: [
    {
      stars: "★★★★★",
      quote: "The process felt more organized than sending messages to random contractors and repeating the same project details over and over.",
      meta: "Review layout example • Tampa Bay homeowner"
    },
    {
      stars: "★★★★★",
      quote: "I liked being able to explain the scope once and compare responses instead of starting over on each site.",
      meta: "Review layout example • Riverview homeowner"
    },
    {
      stars: "★★★★★",
      quote: "The platform concept makes sense for projects where you want better quote quality without a lot of back-and-forth.",
      meta: "Review layout example • Brandon property owner"
    }
  ],
  homeFaqs: [
    {
      q: "Is GetEstimateFast free to use?",
      a: "Yes. Users can request quotes and compare local professionals without paying to submit a request."
    },
    {
      q: "Why do you ask for detailed project information?",
      a: "Detailed requests help professionals understand the work, estimate more accurately, and reduce avoidable follow-up calls."
    },
    {
      q: "Will my information be shared widely?",
      a: "The platform message should make it clear that information is only shared with relevant local professionals for the selected request."
    },
    {
      q: "Can I request help for residential and commercial projects?",
      a: "Yes. The future platform should support homeowners, landlords, and businesses with service-specific request flows."
    }
  ],
  flows: {
    kitchen: {
      key: "kitchen",
      serviceLabel: "Kitchen Remodeling",
      type: "complex",
      pageTitle: "Start your kitchen remodeling quote request",
      intro: "Answer a few guided questions so matched local professionals can better understand your kitchen project before reaching out.",
      microcopy: [
        "Free to use",
        "No obligation",
        "Detailed requests help improve quote quality",
        "Shared only with qualified local professionals"
      ],
      steps: [
        {
          title: "What kind of kitchen project is this?",
          help: "Start with the project type so we can show the most relevant follow-up questions.",
          field: "Project Type",
          type: "single",
          options: [
            "Full kitchen remodel",
            "Cabinet replacement",
            "Cabinet refacing",
            "Countertop replacement",
            "Backsplash installation",
            "Sink / faucet replacement",
            "Kitchen flooring",
            "Lighting upgrade",
            "Appliance installation"
          ],
          conditional: {
            triggerValues: [
              "Full kitchen remodel",
              "Cabinet replacement",
              "Cabinet refacing"
            ],
            title: "Will the kitchen layout change?",
            field: "Layout Change",
            options: [
              "Yes, I expect layout changes",
              "No, I plan to keep the layout",
              "Not sure yet"
            ]
          }
        },
        {
          title: "What work is included?",
          help: "Select the items that apply. This helps professionals understand the scope before contacting you.",
          field: "Scope of Work[]",
          type: "multi",
          options: [
            "Demolition",
            "Cabinet installation",
            "Countertop installation",
            "Backsplash",
            "Flooring",
            "Plumbing updates",
            "Electrical updates",
            "Lighting",
            "Appliance install",
            "Painting",
            "Drywall repair",
            "Final cleaning"
          ]
        },
        {
          title: "How big is the project?",
          help: "A rough size or layout helps matched professionals estimate more accurately. It's okay if you're not sure.",
          field: "Kitchen Size",
          type: "single",
          options: [
            "Small kitchen",
            "Medium kitchen",
            "Large kitchen",
            "Open-concept kitchen",
            "Not sure yet"
          ]
        },
        {
          title: "When would you like to start?",
          help: "Timeline helps us route your request to professionals with the right availability.",
          field: "Timeline",
          type: "single",
          options: [
            "As soon as possible",
            "Within 30 days",
            "Within 60 days",
            "Just planning"
          ],
          includeDescription: true
        },
        {
          title: "Add photos if you have them",
          help: "Photos are optional, but they can help professionals understand the layout and provide better estimates.",
          type: "photos-location"
        },
        {
          title: "How should professionals contact you?",
          help: "Your information is only shared with qualified local professionals for this request.",
          type: "contact"
        }
      ],
      descriptionPrompt: "Tell us more about your kitchen project",
      descriptionPlaceholder: "Example: Replace cabinets and countertops, install backsplash, upgrade sink and faucet, and add new lighting."
    },
    cleaning: {
      key: "cleaning",
      serviceLabel: "House Cleaning",
      type: "fast",
      pageTitle: "Start your house cleaning quote request",
      intro: "This faster flow is designed for simpler services where users should be able to request quotes quickly without losing the details that matter.",
      microcopy: [
        "Free to use",
        "No obligation",
        "No spam blast",
        "Shared only with relevant local professionals"
      ],
      steps: [
        {
          title: "What type of cleaning do you need?",
          help: "Choose the option that best matches the job.",
          field: "Cleaning Type",
          type: "single",
          options: [
            "House cleaning",
            "Deep cleaning",
            "Move-in cleaning",
            "Move-out cleaning",
            "Office cleaning",
            "Airbnb cleaning"
          ],
          conditional: {
            triggerValues: [
              "House cleaning",
              "Deep cleaning",
              "Airbnb cleaning"
            ],
            title: "How often do you need service?",
            field: "Cleaning Frequency",
            options: [
              "One-time service",
              "Weekly",
              "Biweekly",
              "Monthly",
              "Not sure yet"
            ]
          }
        },
        {
          title: "How large is the job?",
          help: "A rough size helps us match your request without making the process feel too technical.",
          field: "Job Size",
          type: "single",
          options: [
            "1-2 bedrooms",
            "3-4 bedrooms",
            "5+ bedrooms",
            "Office or commercial space",
            "Not sure"
          ]
        },
        {
          title: "When do you need service?",
          help: "Tell us if this is urgent, one-time, or recurring so the request goes to the right providers.",
          field: "Timeline",
          type: "single",
          options: [
            "As soon as possible",
            "This week",
            "Recurring weekly or biweekly",
            "Just getting quotes"
          ],
          includeDescription: true
        },
        {
          title: "Where is the property located?",
          help: "We ask for location before contact information so we can route the request locally.",
          type: "location"
        },
        {
          title: "How should professionals contact you?",
          help: "Your information is only shared with qualified local professionals for this request.",
          type: "contact"
        }
      ],
      descriptionPrompt: "Anything else professionals should know?",
      descriptionPlaceholder: "Example: Deep clean before move-in, pet hair concerns, focus on bathrooms and kitchen."
    }
  }
};
