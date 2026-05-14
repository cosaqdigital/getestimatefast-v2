const serviceConfigs = {
  bathroom: {
    label: "Bathroom Remodeling",
    step1Title: "What type of bathroom project do you need?",
    step1Description: "Select the option that best matches your bathroom project.",
    projectTypes: [
      "Full bathroom remodel",
      "Tub to shower conversion",
      "Shower remodel only",
      "Bathtub remodel only",
      "Half bathroom remodel",
      "Guest bathroom remodel",
      "Master bathroom remodel",
      "Vanity or fixture update"
    ],
    scopeOptions: [
      "Demolition",
      "Debris removal",
      "Plumbing replacement",
      "Plumbing relocation",
      "Waterproofing",
      "Tile installation",
      "Shower pan installation",
      "Bathtub installation",
      "Vanity replacement",
      "Toilet replacement",
      "Drywall repair",
      "Painting",
      "Glass door installation",
      "Exhaust fan",
      "Lighting",
      "Final cleaning"
    ],
    materialsDescription: "Choose the option that best matches your project.",
    materialsOptions: [
      "I already have materials",
      "I need help choosing materials",
      "I want help purchasing materials",
      "Labor only",
      "Labor + rough materials"
    ],
    measurement: {
      type: "bathroom",
      title: "Do you know your bathroom measurements?",
      description: "Measurements help professionals provide a more accurate quote."
    },
    descriptionPlaceholder: "Describe your bathroom project.\nExample:\n- Replace tub with a walk-in shower\n- Install new tile and vanity\n- Update lighting and fixtures\n- Remodel master bathroom layout"
  },
  flooring: {
    label: "Flooring Installation",
    step1Title: "What type of flooring project do you need?",
    step1Description: "Select the option that best matches your flooring project.",
    projectTypes: [
      "Vinyl / LVP flooring",
      "Laminate flooring",
      "Hardwood flooring",
      "Tile flooring",
      "Carpet installation",
      "Floor replacement",
      "Floor repair",
      "Floor removal"
    ],
    scopeOptions: [
      "Remove old flooring",
      "Install new flooring",
      "Subfloor repair",
      "Leveling",
      "Baseboards",
      "Stairs",
      "Moisture barrier",
      "Trim transitions",
      "Furniture moving",
      "Disposal of old flooring",
      "Bathroom flooring",
      "Kitchen flooring",
      "Whole house flooring"
    ],
    materialsDescription: "Choose the option that best matches your flooring project.",
    materialsOptions: [
      "I already have flooring materials",
      "I need help choosing flooring",
      "I want help purchasing materials",
      "Labor only",
      "Labor + materials"
    ],
    measurement: {
      type: "conditional-size",
      title: "Do you know the approximate square footage?",
      description: "If you know the approximate size, select the closest option below.",
      knowledgeName: "Do you know the approximate square footage?",
      sizeName: "Approximate square footage",
      yesLabel: "Yes, I know the square footage",
      noLabel: "No, I am not sure",
      sizeOptions: [
        "Under 300 sq ft",
        "300-700 sq ft",
        "700-1,500 sq ft",
        "Over 1,500 sq ft",
        "Different size / not listed"
      ]
    },
    descriptionPlaceholder: "Describe your flooring project.\nExample:\n- Replace carpet with LVP\n- Install flooring in living room and bedrooms\n- Remove old tile\n- Repair uneven subfloor"
  },
  painting: {
    label: "Painting Services",
    step1Title: "What type of painting project do you need?",
    step1Description: "Select the option that best matches your painting project.",
    projectTypes: [
      "Interior painting",
      "Exterior painting",
      "Cabinet painting",
      "Doors and trim",
      "Fence or deck painting",
      "Touch-ups",
      "Whole house painting",
      "Commercial painting"
    ],
    scopeOptions: [
      "Wall painting",
      "Ceiling painting",
      "Trim painting",
      "Door painting",
      "Cabinet painting",
      "Drywall patching",
      "Pressure washing",
      "Exterior siding",
      "Stucco painting",
      "Garage painting",
      "Color change",
      "Paint included",
      "Primer needed"
    ],
    materialsDescription: "Choose the option that best matches your painting project.",
    materialsOptions: [
      "I already have paint",
      "I need help choosing paint",
      "I want help purchasing paint",
      "Labor only",
      "Labor + paint"
    ],
    measurement: {
      type: "single-choice",
      title: "How many areas need painting?",
      description: "Select the option that best matches your project.",
      fieldName: "How many areas need painting?",
      options: [
        "1 room",
        "2-3 rooms",
        "4+ rooms",
        "Whole interior",
        "Exterior only",
        "Not sure"
      ]
    },
    descriptionPlaceholder: "Describe your painting project.\nExample:\n- Paint 3 bedrooms and hallway\n- Repaint exterior stucco\n- Paint cabinets white\n- Patch small holes before painting"
  },
  drywall: {
    label: "Drywall Services",
    step1Title: "What type of drywall project do you need?",
    step1Description: "Select the option that best matches your drywall project.",
    projectTypes: [
      "Drywall repair",
      "Drywall installation",
      "Ceiling repair",
      "Texture matching",
      "Water damage repair",
      "Hole repair",
      "Popcorn ceiling removal",
      "Room drywall installation"
    ],
    scopeOptions: [
      "Patch holes",
      "Replace damaged drywall",
      "Install new drywall",
      "Tape and mud",
      "Sanding",
      "Texture matching",
      "Ceiling repair",
      "Water damage area",
      "Corner bead repair",
      "Paint-ready finish",
      "Popcorn removal",
      "Multiple rooms"
    ],
    materialsDescription: "Choose the option that best matches your drywall project.",
    materialsOptions: [
      "I already have materials",
      "I need help choosing materials",
      "I want help purchasing materials",
      "Labor only",
      "Labor + materials"
    ],
    measurement: {
      type: "single-choice",
      title: "How large is the affected area?",
      description: "Select the option that best matches your drywall project.",
      fieldName: "Affected area size",
      options: [
        "Small patch / hole",
        "One wall",
        "One room",
        "Multiple rooms",
        "Ceiling",
        "Not sure"
      ]
    },
    descriptionPlaceholder: "Describe your drywall project.\nExample:\n- Repair water damage on ceiling\n- Patch holes after plumbing work\n- Install drywall in one room\n- Match existing wall texture"
  },
  electrical: {
    label: "Electrical Services",
    step1Title: "What type of electrical project do you need?",
    step1Description: "Select the option that best matches your electrical project.",
    projectTypes: [
      "Outlet / switch installation",
      "Light fixture installation",
      "Ceiling fan installation",
      "Breaker / panel issue",
      "New wiring",
      "EV charger installation",
      "Electrical repair",
      "Safety inspection"
    ],
    scopeOptions: [
      "Install outlets",
      "Replace outlets",
      "Install switches",
      "Install light fixtures",
      "Install ceiling fan",
      "Troubleshoot power issue",
      "Panel inspection",
      "Breaker replacement",
      "Outdoor electrical",
      "Garage electrical",
      "Kitchen electrical",
      "Bathroom electrical",
      "EV charger wiring",
      "New circuit"
    ],
    materialsDescription: "Choose the option that best matches your electrical project.",
    materialsOptions: [
      "I already have fixtures/materials",
      "I need help choosing fixtures/materials",
      "I want help purchasing materials",
      "Labor only",
      "Labor + materials"
    ],
    measurement: {
      type: "single-choice",
      title: "Where is the electrical work located?",
      description: "Select the option that best matches the project location.",
      fieldName: "Electrical work location",
      options: [
        "Kitchen",
        "Bathroom",
        "Bedroom",
        "Living room",
        "Garage",
        "Outdoor",
        "Whole house",
        "Not sure"
      ]
    },
    descriptionPlaceholder: "Describe your electrical project.\nExample:\n- Install new ceiling fan\n- Add outlets in garage\n- Replace light fixtures\n- Troubleshoot breaker issue"
  },
  plumbing: {
    label: "Plumbing Services",
    step1Title: "What type of plumbing project do you need?",
    step1Description: "Select the option that best matches your plumbing project.",
    projectTypes: [
      "Leak repair",
      "Faucet / sink installation",
      "Toilet repair / replacement",
      "Shower / tub issue",
      "Water heater",
      "Drain clog",
      "Garbage disposal",
      "Pipe repair"
    ],
    scopeOptions: [
      "Fix leak",
      "Replace faucet",
      "Install sink",
      "Replace toilet",
      "Repair toilet",
      "Clear drain",
      "Repair pipe",
      "Replace pipe",
      "Install garbage disposal",
      "Water heater issue",
      "Shower valve",
      "Tub drain",
      "Kitchen plumbing",
      "Bathroom plumbing"
    ],
    materialsDescription: "Choose the option that best matches your plumbing project.",
    materialsOptions: [
      "I already have fixtures/materials",
      "I need help choosing fixtures/materials",
      "I want help purchasing materials",
      "Labor only",
      "Labor + materials"
    ],
    measurement: {
      type: "single-choice",
      title: "Where is the plumbing issue located?",
      description: "Select the option that best matches the project location.",
      fieldName: "Plumbing issue location",
      options: [
        "Kitchen",
        "Bathroom",
        "Laundry room",
        "Garage",
        "Outdoor",
        "Whole house",
        "Not sure"
      ]
    },
    descriptionPlaceholder: "Describe your plumbing project.\nExample:\n- Fix leak under kitchen sink\n- Replace toilet\n- Install new faucet\n- Clear clogged drain"
  },
  handyman: {
    label: "Handyman Services",
    step1Title: "What type of handyman project do you need?",
    step1Description: "Select the option that best matches your handyman project.",
    projectTypes: [
      "General repairs",
      "Furniture assembly",
      "TV mounting",
      "Door repair / installation",
      "Caulking / sealing",
      "Minor drywall repair",
      "Minor painting",
      "Fixture installation",
      "Shelving / hardware"
    ],
    scopeOptions: [
      "Mount TV",
      "Install shelves",
      "Assemble furniture",
      "Repair door",
      "Install hardware",
      "Caulking",
      "Small drywall patch",
      "Small painting job",
      "Replace fixtures",
      "Hang pictures/mirrors",
      "Repair trim",
      "General maintenance",
      "Multiple small tasks"
    ],
    materialsDescription: "Choose the option that best matches your handyman project.",
    materialsOptions: [
      "I already have materials",
      "I need help choosing materials",
      "I want help purchasing materials",
      "Labor only",
      "Labor + materials"
    ],
    measurement: {
      type: "single-choice",
      title: "How many tasks do you need help with?",
      description: "Select the option that best matches your project.",
      fieldName: "Task count",
      options: [
        "1 task",
        "2-3 tasks",
        "4+ tasks",
        "Ongoing help",
        "Not sure"
      ]
    },
    descriptionPlaceholder: "Describe your handyman project.\nExample:\n- Mount TV and hide wires\n- Install shelves\n- Repair door handle\n- Assemble furniture"
  },
  kitchen: {
    label: "Kitchen Remodeling",
    step1Title: "What type of kitchen project do you need?",
    step1Description: "Select the option that best matches your kitchen project.",
    projectTypes: [
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
    scopeOptions: [
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
    ],
    materialsDescription: "Choose the option that best matches your project.",
    materialsOptions: [
      "I already have materials",
      "I need help choosing materials",
      "I want help purchasing materials",
      "Labor only",
      "Labor + rough materials"
    ],
    measurement: {
      type: "conditional-size",
      title: "Do you know the approximate kitchen size?",
      description: "If you know the approximate size, select the closest option below.",
      knowledgeName: "Do you know the approximate kitchen size?",
      sizeName: "Approximate kitchen size",
      yesLabel: "Yes, I know the kitchen size",
      noLabel: "No, I am not sure",
      sizeOptions: [
        "Small kitchen",
        "Medium kitchen",
        "Large kitchen",
        "Open-concept kitchen",
        "Different size / not listed"
      ]
    },
    descriptionPlaceholder: "Describe your kitchen project.\nExample:\n- Replace cabinets and countertops\n- Install backsplash\n- Upgrade sink and faucet\n- Add new lighting\n- Replace kitchen flooring"
  }
};

const stepTitles = [
  "Project Type",
  "Scope of Work",
  "Materials",
  "Measurements",
  "Project Details",
  "Photos",
  "Contact"
];

const steps = Array.from(document.querySelectorAll(".step"));
const progressFill = document.getElementById("progressFill");
const stepLabel = document.getElementById("stepLabel");
const stepTitleMini = document.getElementById("stepTitleMini");
const projectTypeTitle = document.getElementById("projectTypeTitle");
const projectTypeDescription = document.getElementById("projectTypeDescription");
const projectTypeOptions = document.getElementById("projectTypeOptions");
const scopeTitle = document.getElementById("scopeTitle");
const scopeDescription = document.getElementById("scopeDescription");
const scopeOptions = document.getElementById("scopeOptions");
const materialsTitle = document.getElementById("materialsTitle");
const materialsDescription = document.getElementById("materialsDescription");
const materialsOptions = document.getElementById("materialsOptions");
const measurementsTitle = document.getElementById("measurementsTitle");
const measurementsDescription = document.getElementById("measurementsDescription");
const measurementsContainer = document.getElementById("measurementsContainer");
const projectDescription = document.getElementById("projectDescription");
const timelineOptions = document.getElementById("timelineOptions");
const serviceForm = document.getElementById("serviceForm");
const serviceKey = document.body.dataset.serviceKey;
const serviceConfig = serviceConfigs[serviceKey];

const state = {
  currentStep: 0,
  projectType: "",
  materials: "",
  timeline: ""
};

function getErrorBox(stepIndex) {
  return steps[stepIndex].querySelector(".error");
}

function showError(stepIndex, message) {
  const box = getErrorBox(stepIndex);
  if (!box) {
    return;
  }
  box.textContent = message;
  box.style.display = "block";
}

function hideError(stepIndex) {
  const box = getErrorBox(stepIndex);
  if (!box) {
    return;
  }
  box.style.display = "none";
}

function clearAllErrors() {
  steps.forEach((_, index) => hideError(index));
}

function setHiddenValue(id, value) {
  const input = document.getElementById(id);
  if (input) {
    input.value = value;
  }
}

function getHiddenValue(id) {
  const input = document.getElementById(id);
  return input ? input.value.trim() : "";
}

function createOptionButton(option) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "option-btn";
  button.dataset.value = option;
  button.textContent = option;
  return button;
}

function bindSingleChoice(container, hiddenId, stateKey) {
  const buttons = Array.from(container.querySelectorAll(".option-btn"));
  buttons.forEach((button) => {
    button.addEventListener("click", () => {
      buttons.forEach((item) => item.classList.remove("selected"));
      button.classList.add("selected");
      setHiddenValue(hiddenId, button.dataset.value);
      if (stateKey) {
        state[stateKey] = button.dataset.value;
      }
      clearAllErrors();
    });
  });
}

function renderProjectTypes() {
  projectTypeTitle.textContent = serviceConfig.step1Title;
  projectTypeDescription.textContent = serviceConfig.step1Description;
  projectTypeOptions.innerHTML = "";
  serviceConfig.projectTypes.forEach((option) => {
    projectTypeOptions.appendChild(createOptionButton(option));
  });
  bindSingleChoice(projectTypeOptions, "projectTypeInput", "projectType");
}

function renderScopeOptions() {
  scopeTitle.textContent = "What work is needed?";
  scopeDescription.textContent = "Select all that apply. This helps professionals understand the full scope.";
  scopeOptions.innerHTML = "";

  serviceConfig.scopeOptions.forEach((option) => {
    const label = document.createElement("label");
    label.className = "checkbox-item";

    const input = document.createElement("input");
    input.type = "checkbox";
    input.name = "Scope of Work[]";
    input.value = option;

    input.addEventListener("change", () => {
      label.classList.toggle("selected", input.checked);
      clearAllErrors();
    });

    label.appendChild(input);
    label.appendChild(document.createTextNode(option));
    scopeOptions.appendChild(label);
  });
}

function renderMaterials() {
  materialsTitle.textContent = "How will materials be handled?";
  materialsDescription.textContent = serviceConfig.materialsDescription;
  materialsOptions.innerHTML = "";
  serviceConfig.materialsOptions.forEach((option) => {
    materialsOptions.appendChild(createOptionButton(option));
  });
  bindSingleChoice(materialsOptions, "materialsInput", "materials");
}

function clearMeasurementMethodSelections() {
  const methodButtons = measurementsContainer.querySelectorAll('[data-group="measurementMethod"] .option-btn');
  methodButtons.forEach((button) => button.classList.remove("selected"));
}

function renderBathroomMeasurements() {
  measurementsTitle.textContent = serviceConfig.measurement.title;
  measurementsDescription.textContent = serviceConfig.measurement.description;
  measurementsContainer.innerHTML = `
    <input type="hidden" id="knowsMeasurementsInput" name="Do you know the measurements?" />
    <input type="hidden" id="measurementMethodInput" name="Measurement Method" />
    <input type="hidden" id="standardSizeInput" name="Standard Bathroom Size" />
    <div class="option-grid two-col" data-group="measurementKnowledge">
      <button type="button" class="option-btn" data-value="Yes, I know the measurements">Yes, I know the measurements</button>
      <button type="button" class="option-btn" data-value="No, I do not know the measurements">No, I do not know the measurements</button>
    </div>
    <div id="measurementNoBox" class="notice-box hidden">No problem. You can still continue. A professional may ask for details later if needed.</div>
    <div id="measurementYesBox" class="hidden">
      <div class="soft-box">
        <p class="step-desc" style="margin-bottom:14px;">How would you like to provide the bathroom size?</p>
        <div class="option-grid two-col" data-group="measurementMethod">
          <button type="button" class="option-btn" data-value="Select a standard bathroom size">Select a standard bathroom size</button>
          <button type="button" class="option-btn" data-value="Enter custom measurements">Enter custom measurements</button>
        </div>
        <div id="standardSizeBox" class="hidden" style="margin-top:16px;">
          <label class="field-label" for="standardBathroomSize">Select a standard bathroom size</label>
          <select id="standardBathroomSize">
            <option value="">Select a standard bathroom size</option>
            <option>Small bathroom - around 5' x 8'</option>
            <option>Standard bathroom - around 6' x 8'</option>
            <option>Master bathroom - around 8' x 10'</option>
            <option>Large master bathroom - around 10' x 12'</option>
            <option>Different size / not listed</option>
          </select>
        </div>
        <div id="customSizeBox" class="hidden" style="margin-top:16px;">
          <div class="field-grid three-col">
            <div>
              <label class="field-label" for="bathLength">Length (feet)</label>
              <input type="text" id="bathLength" name="Bathroom Length (feet)" placeholder="Length (feet)" />
            </div>
            <div>
              <label class="field-label" for="bathWidth">Width (feet)</label>
              <input type="text" id="bathWidth" name="Bathroom Width (feet)" placeholder="Width (feet)" />
            </div>
            <div>
              <label class="field-label" for="bathHeight">Ceiling height (feet)</label>
              <input type="text" id="bathHeight" name="Ceiling Height (feet)" placeholder="Ceiling height (feet)" />
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  const knowledgeButtons = Array.from(measurementsContainer.querySelectorAll('[data-group="measurementKnowledge"] .option-btn'));
  const methodButtons = Array.from(measurementsContainer.querySelectorAll('[data-group="measurementMethod"] .option-btn'));
  const measurementNoBox = document.getElementById("measurementNoBox");
  const measurementYesBox = document.getElementById("measurementYesBox");
  const standardSizeBox = document.getElementById("standardSizeBox");
  const customSizeBox = document.getElementById("customSizeBox");
  const standardBathroomSize = document.getElementById("standardBathroomSize");

  knowledgeButtons.forEach((button) => {
    button.addEventListener("click", () => {
      knowledgeButtons.forEach((item) => item.classList.remove("selected"));
      button.classList.add("selected");
      setHiddenValue("knowsMeasurementsInput", button.dataset.value);
      const knowsMeasurements = button.dataset.value === "Yes, I know the measurements";
      measurementYesBox.classList.toggle("hidden", !knowsMeasurements);
      measurementNoBox.classList.toggle("hidden", knowsMeasurements);

      if (!knowsMeasurements) {
        setHiddenValue("measurementMethodInput", "");
        setHiddenValue("standardSizeInput", "");
        clearMeasurementMethodSelections();
        standardSizeBox.classList.add("hidden");
        customSizeBox.classList.add("hidden");
        standardBathroomSize.value = "";
        document.getElementById("bathLength").value = "";
        document.getElementById("bathWidth").value = "";
        document.getElementById("bathHeight").value = "";
      }

      clearAllErrors();
    });
  });

  methodButtons.forEach((button) => {
    button.addEventListener("click", () => {
      methodButtons.forEach((item) => item.classList.remove("selected"));
      button.classList.add("selected");
      setHiddenValue("measurementMethodInput", button.dataset.value);
      const useStandard = button.dataset.value === "Select a standard bathroom size";
      standardSizeBox.classList.toggle("hidden", !useStandard);
      customSizeBox.classList.toggle("hidden", useStandard);

      if (useStandard) {
        document.getElementById("bathLength").value = "";
        document.getElementById("bathWidth").value = "";
        document.getElementById("bathHeight").value = "";
      } else {
        standardBathroomSize.value = "";
        setHiddenValue("standardSizeInput", "");
      }

      clearAllErrors();
    });
  });

  standardBathroomSize.addEventListener("change", () => {
    setHiddenValue("standardSizeInput", standardBathroomSize.value);
    clearAllErrors();
  });
}

function renderConditionalSizeMeasurements() {
  const config = serviceConfig.measurement;
  measurementsTitle.textContent = config.title;
  measurementsDescription.textContent = config.description;
  measurementsContainer.innerHTML = `
    <input type="hidden" id="measurementKnowledgeInput" name="${config.knowledgeName}" />
    <input type="hidden" id="measurementSizeInput" name="${config.sizeName}" />
    <div class="option-grid two-col" data-group="measurementKnowledge">
      <button type="button" class="option-btn" data-value="${config.yesLabel}">${config.yesLabel}</button>
      <button type="button" class="option-btn" data-value="${config.noLabel}">${config.noLabel}</button>
    </div>
    <div id="measurementNotSureBox" class="notice-box hidden">No problem. You can still continue even if you are not sure.</div>
    <div id="measurementSizeBox" class="hidden">
      <div class="soft-box">
        <label class="field-label" for="measurementSizeSelect">Select the closest option</label>
        <select id="measurementSizeSelect">
          <option value="">Select a size option</option>
          ${config.sizeOptions.map((option) => `<option>${option}</option>`).join("")}
        </select>
      </div>
    </div>
  `;

  const knowledgeButtons = Array.from(measurementsContainer.querySelectorAll('[data-group="measurementKnowledge"] .option-btn'));
  const measurementNotSureBox = document.getElementById("measurementNotSureBox");
  const measurementSizeBox = document.getElementById("measurementSizeBox");
  const measurementSizeSelect = document.getElementById("measurementSizeSelect");

  knowledgeButtons.forEach((button) => {
    button.addEventListener("click", () => {
      knowledgeButtons.forEach((item) => item.classList.remove("selected"));
      button.classList.add("selected");
      setHiddenValue("measurementKnowledgeInput", button.dataset.value);
      const knowsSize = button.dataset.value === config.yesLabel;
      measurementSizeBox.classList.toggle("hidden", !knowsSize);
      measurementNotSureBox.classList.toggle("hidden", knowsSize);
      if (!knowsSize) {
        measurementSizeSelect.value = "";
        setHiddenValue("measurementSizeInput", "");
      }
      clearAllErrors();
    });
  });

  measurementSizeSelect.addEventListener("change", () => {
    setHiddenValue("measurementSizeInput", measurementSizeSelect.value);
    clearAllErrors();
  });
}

function renderSingleChoiceMeasurements() {
  const config = serviceConfig.measurement;
  measurementsTitle.textContent = config.title;
  measurementsDescription.textContent = config.description;
  measurementsContainer.innerHTML = `<input type="hidden" id="measurementSingleInput" name="${config.fieldName}" /><div class="option-grid two-col" id="measurementSingleOptions"></div>`;
  const measurementSingleOptions = document.getElementById("measurementSingleOptions");
  config.options.forEach((option) => {
    measurementSingleOptions.appendChild(createOptionButton(option));
  });
  bindSingleChoice(measurementSingleOptions, "measurementSingleInput");
}

function renderMeasurements() {
  if (serviceConfig.measurement.type === "bathroom") {
    renderBathroomMeasurements();
    return;
  }

  if (serviceConfig.measurement.type === "conditional-size") {
    renderConditionalSizeMeasurements();
    return;
  }

  renderSingleChoiceMeasurements();
}

function bindTimelineButtons() {
  Array.from(timelineOptions.querySelectorAll(".option-btn")).forEach((button) => {
    button.addEventListener("click", () => {
      Array.from(timelineOptions.querySelectorAll(".option-btn")).forEach((item) => item.classList.remove("selected"));
      button.classList.add("selected");
      setHiddenValue("timelineInput", button.dataset.value);
      state.timeline = button.dataset.value;
      clearAllErrors();
    });
  });
}

function bindPhotoInputs() {
  Array.from(document.querySelectorAll('.photo-field input[type="file"]')).forEach((input) => {
    input.addEventListener("change", () => {
      const fileName = input.files && input.files[0] ? input.files[0].name : "";
      const nameTarget = input.closest(".photo-field").querySelector(".photo-file-name");
      if (nameTarget) {
        nameTarget.textContent = fileName ? `Selected: ${fileName}` : "";
      }
    });
  });
}

function focusCurrentStep() {
  const activeStep = steps[state.currentStep];
  const firstField = activeStep.querySelector("button, input, textarea, select");
  if (!firstField) {
    return;
  }
  window.setTimeout(() => {
    firstField.focus({ preventScroll: true });
  }, 120);
}

function showStep(index) {
  steps.forEach((step, stepIndex) => {
    step.classList.toggle("active", stepIndex === index);
  });
  state.currentStep = index;
  stepLabel.textContent = `Step ${index + 1} of ${steps.length}`;
  stepTitleMini.textContent = stepTitles[index];
  progressFill.style.width = `${((index + 1) / steps.length) * 100}%`;
  window.scrollTo({ top: 0, behavior: "smooth" });
  focusCurrentStep();
}

function validateStep(index) {
  hideError(index);

  if (index === 0 && !getHiddenValue("projectTypeInput")) {
    showError(index, "Please select one option to continue.");
    return false;
  }

  if (index === 1) {
    const checkedScope = serviceForm.querySelectorAll('input[name="Scope of Work[]"]:checked');
    if (!checkedScope.length) {
      showError(index, "Please select at least one scope item.");
      return false;
    }
  }

  if (index === 2 && !getHiddenValue("materialsInput")) {
    showError(index, "Please select one option to continue.");
    return false;
  }

  if (index === 3) {
    if (serviceConfig.measurement.type === "bathroom") {
      const knowsMeasurements = getHiddenValue("knowsMeasurementsInput");
      if (!knowsMeasurements) {
        showError(index, "Please complete the measurement step to continue.");
        return false;
      }

      if (knowsMeasurements === "Yes, I know the measurements") {
        const measurementMethod = getHiddenValue("measurementMethodInput");
        if (!measurementMethod) {
          showError(index, "Please choose how you want to provide the bathroom size.");
          return false;
        }

        if (measurementMethod === "Select a standard bathroom size" && !getHiddenValue("standardSizeInput")) {
          showError(index, "Please select a standard bathroom size.");
          return false;
        }

        if (measurementMethod === "Enter custom measurements") {
          const length = document.getElementById("bathLength").value.trim();
          const width = document.getElementById("bathWidth").value.trim();
          if (!length || !width) {
            showError(index, "Please enter at least the bathroom length and width.");
            return false;
          }
        }
      }
    }

    if (serviceConfig.measurement.type === "conditional-size") {
      const measurementKnowledge = getHiddenValue("measurementKnowledgeInput");
      if (!measurementKnowledge) {
        showError(index, "Please complete the measurement step to continue.");
        return false;
      }
      if (measurementKnowledge === serviceConfig.measurement.yesLabel && !getHiddenValue("measurementSizeInput")) {
        showError(index, "Please select a size option.");
        return false;
      }
    }

    if (serviceConfig.measurement.type === "single-choice" && !getHiddenValue("measurementSingleInput")) {
      showError(index, "Please select one option to continue.");
      return false;
    }
  }

  if (index === 4) {
    const description = projectDescription.value.trim();
    if (description.length < 10 || !getHiddenValue("timelineInput")) {
      showError(index, "Please add a short project description and choose a timeline.");
      return false;
    }
  }

  if (index === 6) {
    const city = document.getElementById("city").value.trim();
    const zipCode = document.getElementById("zipCode").value.trim();
    const fullName = document.getElementById("fullName").value.trim();
    const phoneNumber = document.getElementById("phoneNumber").value.trim();
    const emailAddress = document.getElementById("emailAddress").value.trim();
    const contactMethod = document.getElementById("preferredContactMethod").value.trim();

    if (!city || !zipCode || !fullName || !phoneNumber || !emailAddress || !contactMethod) {
      showError(index, "Please complete city, ZIP code, name, phone number, email address, and preferred contact method.");
      return false;
    }
  }

  return true;
}

function nextStep() {
  if (!validateStep(state.currentStep)) {
    return;
  }
  if (state.currentStep < steps.length - 1) {
    showStep(state.currentStep + 1);
  }
}

function prevStep() {
  if (state.currentStep > 0) {
    showStep(state.currentStep - 1);
  }
}

function setDynamicSubject() {
  const landingPage = window.location.pathname.split("/").pop() || "";

  document.getElementById("serviceTypeInput").value = serviceConfig.label;
  document.getElementById("landingPageInput").value = landingPage;
  document.getElementById("pageSourceInput").value = window.location.href;
}

function init() {
  if (!serviceConfig || !serviceForm) {
    return;
  }

  renderProjectTypes();
  renderScopeOptions();
  renderMaterials();
  renderMeasurements();
  bindTimelineButtons();
  bindPhotoInputs();

  projectDescription.placeholder = serviceConfig.descriptionPlaceholder;
  setHiddenValue("serviceTypeInput", serviceConfig.label);
  setHiddenValue("landingPageInput", window.location.pathname.split("/").pop() || "");
  setHiddenValue("pageSourceInput", window.location.href);

  Array.from(serviceForm.querySelectorAll("[data-next]")).forEach((button) => {
    button.addEventListener("click", nextStep);
  });

  Array.from(serviceForm.querySelectorAll("[data-back]")).forEach((button) => {
    button.addEventListener("click", prevStep);
  });

  serviceForm.addEventListener("submit", (event) => {
    if (!validateStep(state.currentStep)) {
      event.preventDefault();
      return;
    }

    setDynamicSubject();
    const submitButton = document.getElementById("submitButton");
    submitButton.disabled = true;
    submitButton.textContent = "Sending...";
  });

  showStep(0);
}

init();
