const serviceConfigs = {
  "Bathroom Remodeling": {
    label: "Bathroom Remodeling",
    questions: [
      {
        id: "bathroom-project-type",
        name: "Bathroom Project Type",
        label: "What type of bathroom project do you need?",
        options: [
          "Full bathroom remodel",
          "Shower remodel",
          "Tub to shower conversion",
          "Vanity / sink replacement",
          "Toilet replacement",
          "Tile installation",
          "Bathroom flooring",
          "Plumbing fixtures",
          "Other"
        ]
      },
      {
        id: "bathroom-type",
        name: "Bathroom Type",
        label: "What is the current bathroom type?",
        options: ["Half bathroom", "Full bathroom", "Master bathroom", "Guest bathroom"]
      },
      {
        id: "bathroom-size",
        name: "Bathroom Project Size",
        label: "What best describes the project size?",
        options: ["Small update", "Medium remodel", "Full renovation", "Not sure"]
      },
      {
        id: "bathroom-plumbing",
        name: "Bathroom Plumbing Changes",
        label: "Do you need plumbing changes?",
        options: ["Yes", "No", "Not sure"]
      },
      {
        id: "bathroom-tile",
        name: "Bathroom Tile Work",
        label: "Do you need tile work?",
        options: ["Yes", "No", "Not sure"]
      }
    ]
  },
  "Flooring Installation": {
    label: "Flooring Installation",
    questions: [
      {
        id: "flooring-type",
        name: "Flooring Type",
        label: "What type of flooring do you need?",
        options: ["Vinyl / LVP", "Laminate", "Hardwood", "Tile", "Carpet", "Floor repair", "Floor removal", "Not sure yet"]
      },
      {
        id: "flooring-location",
        name: "Flooring Installation Area",
        label: "Where will the flooring be installed?",
        options: ["Living room", "Bedroom", "Kitchen", "Bathroom", "Stairs", "Whole house", "Other"]
      },
      {
        id: "flooring-size",
        name: "Flooring Area Size",
        label: "Approximate area size:",
        options: ["Under 300 sq ft", "300–700 sq ft", "700–1,500 sq ft", "Over 1,500 sq ft", "Not sure"]
      },
      {
        id: "flooring-materials",
        name: "Flooring Material Ready",
        label: "Do you already have the flooring material?",
        options: ["Yes", "No", "Need help choosing"]
      }
    ]
  },
  "Painting Services": {
    label: "Painting Services",
    questions: [
      {
        id: "painting-type",
        name: "Painting Service Type",
        label: "What type of painting do you need?",
        options: ["Interior painting", "Exterior painting", "Cabinets", "Doors / trim", "Fence / deck", "Touch-ups", "Other"]
      },
      {
        id: "painting-areas",
        name: "Painting Areas Count",
        label: "How many rooms or areas?",
        options: ["1 room", "2–3 rooms", "4+ rooms", "Whole house", "Exterior only", "Not sure"]
      },
      {
        id: "painting-walls",
        name: "Wall Condition",
        label: "Are walls in good condition?",
        options: ["Yes", "Minor repairs needed", "Major repairs needed", "Not sure"]
      },
      {
        id: "painting-paint",
        name: "Paint Included",
        label: "Do you need paint included?",
        options: ["Yes", "No", "Not sure"]
      }
    ]
  },
  "Drywall Services": {
    label: "Drywall Services",
    questions: [
      {
        id: "drywall-type",
        name: "Drywall Service Type",
        label: "What drywall service do you need?",
        options: ["Drywall repair", "Drywall installation", "Ceiling repair", "Texture matching", "Water damage repair", "Hole repair", "Popcorn ceiling removal", "Other"]
      },
      {
        id: "drywall-size",
        name: "Drywall Area Size",
        label: "How large is the affected area?",
        options: ["Small hole / patch", "One wall", "One room", "Multiple rooms", "Ceiling", "Not sure"]
      },
      {
        id: "drywall-cause",
        name: "Drywall Damage Cause",
        label: "What caused the damage?",
        options: ["Water leak", "Impact / accident", "Remodeling", "Cracks", "Unknown"]
      },
      {
        id: "drywall-painting",
        name: "Painting Needed After Drywall",
        label: "Do you need painting after drywall?",
        options: ["Yes", "No", "Not sure"]
      }
    ]
  },
  "Electrical Services": {
    label: "Electrical Services",
    questions: [
      {
        id: "electrical-type",
        name: "Electrical Service Type",
        label: "What electrical service do you need?",
        options: ["Outlet / switch installation", "Light fixture installation", "Ceiling fan installation", "Breaker / panel issue", "New wiring", "EV charger installation", "Electrical repair", "Safety inspection", "Other"]
      },
      {
        id: "electrical-emergency",
        name: "Electrical Emergency",
        label: "Is this an emergency?",
        options: ["Yes, urgent", "No, but soon", "Not urgent"]
      },
      {
        id: "electrical-location",
        name: "Electrical Issue Location",
        label: "Where is the issue located?",
        options: ["Kitchen", "Bathroom", "Bedroom", "Garage", "Outdoor", "Whole house", "Not sure"]
      },
      {
        id: "electrical-wiring",
        name: "Wiring Requirement",
        label: "Do you need new wiring or replacement?",
        options: ["New installation", "Replacement", "Repair only", "Not sure"]
      }
    ]
  },
  "Plumbing Services": {
    label: "Plumbing Services",
    questions: [
      {
        id: "plumbing-type",
        name: "Plumbing Service Type",
        label: "What plumbing service do you need?",
        options: ["Leak repair", "Faucet / sink installation", "Toilet repair / replacement", "Shower / tub issue", "Water heater", "Drain clog", "Garbage disposal", "Pipe repair", "Other"]
      },
      {
        id: "plumbing-leak",
        name: "Active Leak Status",
        label: "Is there active leaking or water damage?",
        options: ["Yes, active leak", "Water damage but not active", "No", "Not sure"]
      },
      {
        id: "plumbing-location",
        name: "Plumbing Issue Location",
        label: "Where is the issue located?",
        options: ["Kitchen", "Bathroom", "Laundry room", "Garage", "Outdoor", "Whole house", "Not sure"]
      },
      {
        id: "plumbing-work-type",
        name: "Plumbing Work Type",
        label: "Do you need repair or installation?",
        options: ["Repair", "Installation", "Replacement", "Not sure"]
      }
    ]
  },
  "Handyman Services": {
    label: "Handyman Services",
    questions: [
      {
        id: "handyman-type",
        name: "Handyman Service Type",
        label: "What handyman service do you need?",
        options: ["General repairs", "Furniture assembly", "TV mounting", "Door repair / installation", "Caulking / sealing", "Minor drywall repair", "Minor painting", "Fixture installation", "Shelving / hardware", "Other"]
      },
      {
        id: "handyman-tasks",
        name: "Handyman Task Count",
        label: "How many tasks do you need help with?",
        options: ["1 task", "2–3 tasks", "4+ tasks", "Ongoing help"]
      },
      {
        id: "handyman-location",
        name: "Handyman Work Location",
        label: "Where is the work located?",
        options: ["Indoor", "Outdoor", "Both"]
      },
      {
        id: "handyman-materials",
        name: "Handyman Materials Ready",
        label: "Do you already have materials?",
        options: ["Yes", "No", "Some materials"]
      }
    ]
  }
};

const body = document.body;
const currentService = body.dataset.service;
const serviceConfig = serviceConfigs[currentService];

const leadForm = document.getElementById("leadForm");
const requestedServiceInput = document.getElementById("requestedServiceInput");
const pageSourceInput = document.getElementById("pageSourceInput");
const landingPageUrlInput = document.getElementById("landingPageUrlInput");
const questionContainer = document.getElementById("questionContainer");
const currentStepLabel = document.getElementById("currentStepLabel");
const progressFill = document.getElementById("progressFill");
const progressIndicators = Array.from(document.querySelectorAll("[data-step-indicator]"));
const stepPanels = Array.from(document.querySelectorAll(".form-step"));
const emailSubject = document.getElementById("emailSubject");
const replyToEmail = document.getElementById("replyToEmail");
const customerSummary = document.getElementById("customerSummary");
const serviceSummary = document.getElementById("serviceSummary");
const projectSummary = document.getElementById("projectSummary");
const locationSummary = document.getElementById("locationSummary");
const urgencySummary = document.getElementById("urgencySummary");
const header = document.querySelector(".header");

let currentStep = 1;

function getHeaderOffset() {
  return header ? Math.ceil(header.getBoundingClientRect().height) + 16 : 24;
}

function scrollToElement(target, behavior = "smooth") {
  if (!target) {
    return;
  }

  const top = window.scrollY + target.getBoundingClientRect().top - getHeaderOffset();
  window.scrollTo({
    top: Math.max(0, top),
    behavior
  });
}

function clearStepError() {
  leadForm.querySelectorAll("[data-step-error]").forEach((errorBlock) => {
    errorBlock.textContent = "";
    errorBlock.classList.remove("show");
  });
}

function showStepError(message) {
  const stepError = leadForm.querySelector(`.form-step.is-active [data-step-error]`);
  if (!stepError) {
    return;
  }
  stepError.textContent = message;
  stepError.classList.add("show");
}

function createChoiceOption(question, option, index) {
  const label = document.createElement("label");
  label.className = "choice-option";

  const input = document.createElement("input");
  input.type = "radio";
  input.name = question.name;
  input.value = option;
  input.id = `${question.id}-${index}`;

  input.addEventListener("change", () => {
    leadForm.querySelectorAll(`input[name="${CSS.escape(question.name)}"]`).forEach((radio) => {
      radio.closest(".choice-option")?.classList.toggle("is-selected", radio.checked);
    });
    clearStepError();
  });

  label.appendChild(input);
  label.append(document.createTextNode(option));
  return label;
}

function createQuestionCard(question) {
  const fieldset = document.createElement("fieldset");
  fieldset.className = "question-card";

  const legend = document.createElement("legend");
  legend.textContent = question.label;
  fieldset.appendChild(legend);

  const grid = document.createElement("div");
  grid.className = "choice-grid";

  question.options.forEach((option, index) => {
    grid.appendChild(createChoiceOption(question, option, index));
  });

  fieldset.appendChild(grid);
  return fieldset;
}

function renderServiceQuestions() {
  if (!serviceConfig) {
    return;
  }

  questionContainer.innerHTML = "";
  serviceConfig.questions.forEach((question) => {
    questionContainer.appendChild(createQuestionCard(question));
  });
}

function updateProgress() {
  currentStepLabel.textContent = `Step ${currentStep} of 3`;
  progressFill.style.width = `${(currentStep / 3) * 100}%`;
  progressIndicators.forEach((indicator) => {
    const indicatorStep = Number(indicator.dataset.stepIndicator);
    indicator.classList.toggle("is-active", indicatorStep === currentStep);
  });
  stepPanels.forEach((panel) => {
    panel.classList.toggle("is-active", Number(panel.dataset.step) === currentStep);
  });
}

function getAnsweredQuestions() {
  if (!serviceConfig) {
    return [];
  }

  return serviceConfig.questions.map((question) => {
    const value = leadForm.querySelector(`input[name="${CSS.escape(question.name)}"]:checked`)?.value || "";
    return {
      label: question.label,
      name: question.name,
      value
    };
  });
}

function validateStepOne() {
  const answers = getAnsweredQuestions();
  const allAnswered = answers.every((answer) => Boolean(answer.value));
  if (!allAnswered) {
    showStepError("Please answer all service questions before continuing.");
    return false;
  }
  return true;
}

function validateStepTwo() {
  const urgency = leadForm.querySelector('input[name="When do you need this done?"]:checked');
  const description = document.getElementById("projectDescription");

  if (!urgency || !description.value.trim()) {
    showStepError("Please choose your timeline and describe your project before continuing.");
    return false;
  }

  return true;
}

function validateStepThree() {
  const requiredFields = Array.from(leadForm.querySelectorAll('[data-contact-step] [required]'));
  for (const field of requiredFields) {
    if (!field.checkValidity()) {
      field.reportValidity();
      return false;
    }
  }
  return true;
}

function validateCurrentStep() {
  clearStepError();
  if (currentStep === 1) {
    return validateStepOne();
  }
  if (currentStep === 2) {
    return validateStepTwo();
  }
  if (currentStep === 3) {
    return validateStepThree();
  }
  return true;
}

function populateHiddenFields() {
  const answers = getAnsweredQuestions();
  const urgency = leadForm.querySelector('input[name="When do you need this done?"]:checked')?.value || "";
  const description = document.getElementById("projectDescription").value.trim();
  const name = document.getElementById("fullName").value.trim();
  const phone = document.getElementById("phone").value.trim();
  const email = document.getElementById("email").value.trim();
  const city = document.getElementById("city").value.trim();
  const zipCode = document.getElementById("zipCode").value.trim();

  requestedServiceInput.value = currentService;
  pageSourceInput.value = `${currentService} landing page`;
  landingPageUrlInput.value = window.location.href;
  replyToEmail.value = email;
  emailSubject.value = `${name || "Customer"} - ${currentService} - ${zipCode || "ZIP"} - ${urgency || "Timeline"}`;

  customerSummary.value = `Customer Info\nName: ${name}\nPhone: ${phone}\nEmail: ${email}`;
  serviceSummary.value = `Service Requested\nService Type: ${currentService}\nLanding Page URL: ${window.location.href}`;
  projectSummary.value = `Project Details\n${answers.map((answer) => `${answer.label}: ${answer.value}`).join("\n")}\nWhen do you need this done?: ${urgency}\nDescribe your project: ${description}`;
  locationSummary.value = `Location\nCity: ${city}\nZIP Code: ${zipCode}`;
  urgencySummary.value = `Urgency\nWhen do you need this done?: ${urgency}`;
}

function goToStep(step) {
  currentStep = Math.max(1, Math.min(3, step));
  updateProgress();
  clearStepError();
  scrollToElement(leadForm);
}

function bindStepButtons() {
  leadForm.querySelectorAll("[data-next-step]").forEach((button) => {
    button.addEventListener("click", () => {
      if (!validateCurrentStep()) {
        return;
      }
      populateHiddenFields();
      goToStep(currentStep + 1);
    });
  });

  leadForm.querySelectorAll("[data-back-step]").forEach((button) => {
    button.addEventListener("click", () => {
      goToStep(currentStep - 1);
    });
  });
}

function bindAnchors() {
  document.querySelectorAll('a[href^="#"]').forEach((link) => {
    const href = link.getAttribute("href");
    if (!href || href === "#") {
      return;
    }

    const target = document.querySelector(href);
    if (!target) {
      return;
    }

    link.addEventListener("click", (event) => {
      event.preventDefault();
      if (href === "#get-quotes") {
        scrollToElement(leadForm);
        return;
      }
      scrollToElement(target);
    });
  });
}

function bindInputUpdates() {
  leadForm.addEventListener("input", () => {
    if (currentStep === 3) {
      populateHiddenFields();
    }
  });
  leadForm.addEventListener("change", () => {
    if (currentStep >= 1) {
      populateHiddenFields();
    }
  });
}

function init() {
  if (!serviceConfig || !leadForm) {
    return;
  }

  requestedServiceInput.value = currentService;
  pageSourceInput.value = `${currentService} landing page`;
  landingPageUrlInput.value = window.location.href;

  renderServiceQuestions();
  updateProgress();
  bindStepButtons();
  bindAnchors();
  bindInputUpdates();

  leadForm.addEventListener("submit", (event) => {
    if (!validateCurrentStep()) {
      event.preventDefault();
      return;
    }

    populateHiddenFields();
  });
}

init();
