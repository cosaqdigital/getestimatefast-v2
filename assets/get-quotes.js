const serviceConfigs = {
  bathroom: {
    label: "Bathroom Remodeling",
    intro: "Answer a few quick questions about your bathroom project.",
    questions: [
      { id: "bathroom-project-type", name: "Bathroom Project Type", label: "What type of bathroom project do you need?", options: ["Full bathroom remodel", "Shower remodel", "Tub to shower conversion", "Vanity / sink replacement", "Toilet replacement", "Tile installation", "Bathroom flooring", "Plumbing fixtures", "Other"] },
      { id: "bathroom-type", name: "Bathroom Type", label: "What is the current bathroom type?", options: ["Half bathroom", "Full bathroom", "Master bathroom", "Guest bathroom"] },
      { id: "bathroom-size", name: "Bathroom Project Size", label: "What best describes the project size?", options: ["Small update", "Medium remodel", "Full renovation", "Not sure"] },
      { id: "bathroom-plumbing", name: "Bathroom Plumbing Changes", label: "Do you need plumbing changes?", options: ["Yes", "No", "Not sure"] },
      { id: "bathroom-tile", name: "Bathroom Tile Work", label: "Do you need tile work?", options: ["Yes", "No", "Not sure"] }
    ]
  },
  flooring: {
    label: "Flooring Installation",
    intro: "Answer a few quick questions about your flooring project.",
    questions: [
      { id: "flooring-type", name: "Flooring Type", label: "What type of flooring do you need?", options: ["Vinyl / LVP", "Laminate", "Hardwood", "Tile", "Carpet", "Floor repair", "Floor removal", "Not sure yet"] },
      { id: "flooring-location", name: "Flooring Installation Area", label: "Where will the flooring be installed?", options: ["Living room", "Bedroom", "Kitchen", "Bathroom", "Stairs", "Whole house", "Other"] },
      { id: "flooring-size", name: "Flooring Area Size", label: "Approximate area size:", options: ["Under 300 sq ft", "300-700 sq ft", "700-1,500 sq ft", "Over 1,500 sq ft", "Not sure"] },
      { id: "flooring-materials", name: "Flooring Material Ready", label: "Do you already have the flooring material?", options: ["Yes", "No", "Need help choosing"] }
    ]
  },
  painting: {
    label: "Painting Services",
    intro: "Answer a few quick questions about your painting project.",
    questions: [
      { id: "painting-type", name: "Painting Service Type", label: "What type of painting do you need?", options: ["Interior painting", "Exterior painting", "Cabinets", "Doors / trim", "Fence / deck", "Touch-ups", "Other"] },
      { id: "painting-areas", name: "Painting Areas Count", label: "How many rooms or areas?", options: ["1 room", "2-3 rooms", "4+ rooms", "Whole house", "Exterior only", "Not sure"] },
      { id: "painting-walls", name: "Wall Condition", label: "Are walls in good condition?", options: ["Yes", "Minor repairs needed", "Major repairs needed", "Not sure"] },
      { id: "painting-paint", name: "Paint Included", label: "Do you need paint included?", options: ["Yes", "No", "Not sure"] }
    ]
  },
  drywall: {
    label: "Drywall Services",
    intro: "Answer a few quick questions about your drywall project.",
    questions: [
      { id: "drywall-type", name: "Drywall Service Type", label: "What drywall service do you need?", options: ["Drywall repair", "Drywall installation", "Ceiling repair", "Texture matching", "Water damage repair", "Hole repair", "Popcorn ceiling removal", "Other"] },
      { id: "drywall-size", name: "Drywall Area Size", label: "How large is the affected area?", options: ["Small hole / patch", "One wall", "One room", "Multiple rooms", "Ceiling", "Not sure"] },
      { id: "drywall-cause", name: "Drywall Damage Cause", label: "What caused the damage?", options: ["Water leak", "Impact / accident", "Remodeling", "Cracks", "Unknown"] },
      { id: "drywall-painting", name: "Painting Needed After Drywall", label: "Do you need painting after drywall?", options: ["Yes", "No", "Not sure"] }
    ]
  },
  electrical: {
    label: "Electrical Services",
    intro: "Answer a few quick questions about your electrical project.",
    questions: [
      { id: "electrical-type", name: "Electrical Service Type", label: "What electrical service do you need?", options: ["Outlet / switch installation", "Light fixture installation", "Ceiling fan installation", "Breaker / panel issue", "New wiring", "EV charger installation", "Electrical repair", "Safety inspection", "Other"] },
      { id: "electrical-emergency", name: "Electrical Emergency", label: "Is this an emergency?", options: ["Yes, urgent", "No, but soon", "Not urgent"] },
      { id: "electrical-location", name: "Electrical Issue Location", label: "Where is the issue located?", options: ["Kitchen", "Bathroom", "Bedroom", "Garage", "Outdoor", "Whole house", "Not sure"] },
      { id: "electrical-wiring", name: "Wiring Requirement", label: "Do you need new wiring or replacement?", options: ["New installation", "Replacement", "Repair only", "Not sure"] }
    ]
  },
  plumbing: {
    label: "Plumbing Services",
    intro: "Answer a few quick questions about your plumbing project.",
    questions: [
      { id: "plumbing-type", name: "Plumbing Service Type", label: "What plumbing service do you need?", options: ["Leak repair", "Faucet / sink installation", "Toilet repair / replacement", "Shower / tub issue", "Water heater", "Drain clog", "Garbage disposal", "Pipe repair", "Other"] },
      { id: "plumbing-leak", name: "Active Leak Status", label: "Is there active leaking or water damage?", options: ["Yes, active leak", "Water damage but not active", "No", "Not sure"] },
      { id: "plumbing-location", name: "Plumbing Issue Location", label: "Where is the issue located?", options: ["Kitchen", "Bathroom", "Laundry room", "Garage", "Outdoor", "Whole house", "Not sure"] },
      { id: "plumbing-work-type", name: "Plumbing Work Type", label: "Do you need repair or installation?", options: ["Repair", "Installation", "Replacement", "Not sure"] }
    ]
  },
  handyman: {
    label: "Handyman Services",
    intro: "Answer a few quick questions about your handyman project.",
    questions: [
      { id: "handyman-type", name: "Handyman Service Type", label: "What handyman service do you need?", options: ["General repairs", "Furniture assembly", "TV mounting", "Door repair / installation", "Caulking / sealing", "Minor drywall repair", "Minor painting", "Fixture installation", "Shelving / hardware", "Other"] },
      { id: "handyman-tasks", name: "Handyman Task Count", label: "How many tasks do you need help with?", options: ["1 task", "2-3 tasks", "4+ tasks", "Ongoing help"] },
      { id: "handyman-location", name: "Handyman Work Location", label: "Where is the work located?", options: ["Indoor", "Outdoor", "Both"] },
      { id: "handyman-materials", name: "Handyman Materials Ready", label: "Do you already have materials?", options: ["Yes", "No", "Some materials"] }
    ]
  }
};

const leadForm = document.getElementById("leadForm");
const serviceSelector = document.getElementById("serviceSelector");
const questionContainer = document.getElementById("questionContainer");
const requestedServiceInput = document.getElementById("requestedServiceInput");
const pageSourceInput = document.getElementById("pageSourceInput");
const landingPageUrlInput = document.getElementById("landingPageUrlInput");
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
const serviceStepIntro = document.getElementById("serviceStepIntro");
const header = document.querySelector(".header");
const queryService = new URLSearchParams(window.location.search).get("service");

let selectedServiceKey = serviceConfigs[queryService] ? queryService : "";
let currentStep = selectedServiceKey ? 2 : 1;

function getHeaderOffset() {
  return header ? Math.ceil(header.getBoundingClientRect().height) + 16 : 24;
}

function scrollToElement(target, behavior = "smooth") {
  if (!target) {
    return;
  }

  const top = window.scrollY + target.getBoundingClientRect().top - getHeaderOffset();
  window.scrollTo({ top: Math.max(0, top), behavior });
}

function getCurrentConfig() {
  return serviceConfigs[selectedServiceKey] || null;
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

function updateSelectedServiceButtons() {
  serviceSelector.querySelectorAll(".service-choice").forEach((button) => {
    button.classList.toggle("is-selected", button.dataset.serviceKey === selectedServiceKey);
  });
}

function createServiceButtons() {
  Object.entries(serviceConfigs).forEach(([key, config]) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "service-choice";
    button.dataset.serviceKey = key;
    button.innerHTML = `<strong>${config.label}</strong><span>Continue with ${config.label.toLowerCase()} questions</span>`;
    button.addEventListener("click", () => {
      selectedServiceKey = key;
      requestedServiceInput.value = config.label;
      updateSelectedServiceButtons();
      renderServiceQuestions();
      clearStepError();
      focusCurrentStepField();
    });
    serviceSelector.appendChild(button);
  });
  updateSelectedServiceButtons();
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
  const config = getCurrentConfig();
  questionContainer.innerHTML = "";

  if (!config) {
    serviceStepIntro.textContent = "Choose a service first to see the questions for that type of project.";
    return;
  }

  serviceStepIntro.textContent = config.intro;
  config.questions.forEach((question) => {
    questionContainer.appendChild(createQuestionCard(question));
  });
}

function getAnsweredQuestions() {
  const config = getCurrentConfig();
  if (!config) {
    return [];
  }

  return config.questions.map((question) => ({
    label: question.label,
    name: question.name,
    value: leadForm.querySelector(`input[name="${CSS.escape(question.name)}"]:checked`)?.value || ""
  }));
}

function validateStepOne() {
  if (!selectedServiceKey || !getCurrentConfig()) {
    showStepError("Please choose a service before continuing.");
    return false;
  }
  return true;
}

function validateStepTwo() {
  const answers = getAnsweredQuestions();
  const allAnswered = answers.every((answer) => Boolean(answer.value));
  if (!allAnswered) {
    showStepError("Please answer all service questions before continuing.");
    return false;
  }
  return true;
}

function validateStepThree() {
  const urgency = leadForm.querySelector('input[name="When do you need this done?"]:checked');
  const description = document.getElementById("projectDescription");

  if (!urgency || !description.value.trim()) {
    showStepError("Please choose your timeline and describe your project before continuing.");
    return false;
  }
  return true;
}

function validateStepFour() {
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
  if (currentStep === 1) return validateStepOne();
  if (currentStep === 2) return validateStepTwo();
  if (currentStep === 3) return validateStepThree();
  if (currentStep === 4) return validateStepFour();
  return true;
}

function populateHiddenFields() {
  const config = getCurrentConfig();
  const serviceLabel = config ? config.label : "";
  const answers = getAnsweredQuestions();
  const urgency = leadForm.querySelector('input[name="When do you need this done?"]:checked')?.value || "";
  const description = document.getElementById("projectDescription").value.trim();
  const name = document.getElementById("fullName").value.trim();
  const phone = document.getElementById("phone").value.trim();
  const email = document.getElementById("email").value.trim();
  const city = document.getElementById("city").value.trim();
  const zipCode = document.getElementById("zipCode").value.trim();

  requestedServiceInput.value = serviceLabel;
  pageSourceInput.value = selectedServiceKey ? `Standalone quote form (${selectedServiceKey})` : "Standalone quote form";
  landingPageUrlInput.value = window.location.href;
  replyToEmail.value = email;
  emailSubject.value = `${name || "Customer"} - ${serviceLabel || "Service"} - ${zipCode || "ZIP"} - ${urgency || "Timeline"}`;

  customerSummary.value = `Customer Info\nName: ${name}\nPhone: ${phone}\nEmail: ${email}`;
  serviceSummary.value = `Service Requested\nService Type: ${serviceLabel}\nPage Source: ${pageSourceInput.value}\nLanding Page URL: ${window.location.href}`;
  projectSummary.value = `Project Details\n${answers.map((answer) => `${answer.label}: ${answer.value}`).join("\n")}\nWhen do you need this done?: ${urgency}\nDescribe your project: ${description}`;
  locationSummary.value = `Location\nCity: ${city}\nZIP Code: ${zipCode}`;
  urgencySummary.value = `Urgency\nWhen do you need this done?: ${urgency}`;
}

function focusCurrentStepField() {
  const activeStep = leadForm.querySelector(`.form-step[data-step="${currentStep}"]`);
  if (!activeStep) {
    return;
  }

  let target = null;
  if (currentStep === 1) {
    target = activeStep.querySelector(".service-choice");
  } else if (currentStep === 2) {
    target = activeStep.querySelector('input[type="radio"]');
  } else if (currentStep === 3) {
    target = activeStep.querySelector('input[type="radio"]') || activeStep.querySelector("textarea");
  } else if (currentStep === 4) {
    target = activeStep.querySelector("input, textarea, select");
  }

  window.setTimeout(() => {
    target?.focus({ preventScroll: true });
  }, 120);
}

function updateProgress() {
  currentStepLabel.textContent = `Step ${currentStep} of 4`;
  progressFill.style.width = `${(currentStep / 4) * 100}%`;
  progressIndicators.forEach((indicator) => {
    indicator.classList.toggle("is-active", Number(indicator.dataset.stepIndicator) === currentStep);
  });
  stepPanels.forEach((panel) => {
    panel.classList.toggle("is-active", Number(panel.dataset.step) === currentStep);
  });
  scrollToElement(leadForm);
  focusCurrentStepField();
}

function goToStep(step) {
  currentStep = Math.max(1, Math.min(4, step));
  clearStepError();
  updateProgress();
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
      scrollToElement(target);
    });
  });
}

function bindChoiceSelectionStyles() {
  leadForm.addEventListener("change", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement) || target.type !== "radio") {
      return;
    }
    leadForm.querySelectorAll(`input[name="${CSS.escape(target.name)}"]`).forEach((radio) => {
      radio.closest(".choice-option")?.classList.toggle("is-selected", radio.checked);
    });
    populateHiddenFields();
    clearStepError();
  });
}

function initPreselectedService() {
  if (!selectedServiceKey) {
    renderServiceQuestions();
    return;
  }
  requestedServiceInput.value = getCurrentConfig().label;
  updateSelectedServiceButtons();
  renderServiceQuestions();
}

function init() {
  if (!leadForm) {
    return;
  }

  createServiceButtons();
  initPreselectedService();
  bindStepButtons();
  bindAnchors();
  bindChoiceSelectionStyles();

  leadForm.addEventListener("input", () => {
    if (currentStep >= 3) {
      populateHiddenFields();
    }
  });

  leadForm.addEventListener("submit", (event) => {
    if (!validateStepOne() || !validateStepTwo() || !validateStepThree() || !validateStepFour()) {
      event.preventDefault();
      return;
    }
    populateHiddenFields();
    const submitButton = document.getElementById("submitButton");
    submitButton.disabled = true;
    submitButton.textContent = "Sending...";
  });

  updateProgress();
}

init();
