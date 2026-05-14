(function () {
  initServiceStarter();

  const flow = window.flowConfig;
  if (!flow) return;

  const form = document.querySelector("[data-quote-flow-form]");
  if (!form) return;

  const steps = Array.from(form.querySelectorAll(".step"));
  const progressFill = document.getElementById("progressFill");
  const stepLabel = document.getElementById("stepLabel");
  const stepMiniTitle = document.getElementById("stepMiniTitle");
  const state = { currentStep: 0, lockedService: false };

  const standardServiceQuestions = {
    "bathroom-remodeling": { title: "What bathroom remodeling work do you need?", options: ["Full bathroom remodel", "Shower or tub", "Vanity / fixtures", "Tile", "Small update", "Not sure yet"] },
    "home-remodeling": { title: "What home remodeling work do you need?", options: ["Whole-home remodel", "Multiple rooms", "Layout changes", "Interior update", "Repair / replacement", "Not sure yet"] },
    "remodeling-services": { title: "What remodeling help do you need?", options: ["General remodel", "Planning help", "Multiple trades", "Interior renovation", "Exterior renovation", "Not sure yet"] },
    "room-additions": { title: "What type of addition are you planning?", options: ["Bedroom addition", "Office addition", "Garage conversion", "Enclosed patio", "Other addition", "Not sure yet"] },
    "general-contractors": { title: "What contractor help do you need?", options: ["Project planning", "Multiple trades", "Major renovation", "Addition / expansion", "Repair coordination", "Not sure yet"] },
    "office-cleaning": { title: "What office cleaning help do you need?", options: ["One-time cleaning", "Recurring cleaning", "Deep cleaning", "Move-in / move-out", "Post-construction cleaning", "Not sure yet"] },
    "commercial-cleaning": { title: "What commercial cleaning help do you need?", options: ["Office / workspace", "Retail / storefront", "Deep cleaning", "Recurring janitorial", "Post-construction cleaning", "Not sure yet"] },
    "roofing": { title: "What roofing help do you need?", options: ["Roof repair", "Roof replacement", "Leak", "Storm damage", "Inspection", "Not sure yet"] },
    "plumbing": { title: "What plumbing work do you need help with?", options: ["Leak repair", "Drain or clog", "Faucet / fixture", "Toilet", "Water heater", "Not sure yet"] },
    "electrical": { title: "What electrical work do you need?", options: ["Panel / breaker", "Outlet / switch", "Lighting", "Fan / fixture", "EV charger", "Not sure yet"] },
    "hvac": { title: "What HVAC service do you need?", options: ["AC repair", "New installation", "Replacement", "Ductwork", "Maintenance / tune-up", "Not sure yet"] },
    "drywall": { title: "What drywall work do you need?", options: ["Patch / repair", "New drywall", "Ceiling repair", "Texture matching", "Water damage", "Not sure yet"] },
    "painting": { title: "What painting work do you need?", options: ["Interior painting", "Exterior painting", "Cabinets", "Touch-ups", "Whole home", "Not sure yet"] },
    "flooring": { title: "What flooring work do you need?", options: ["Vinyl / laminate", "Tile", "Hardwood", "Floor repair", "Floor replacement", "Not sure yet"] },
    "landscaping": { title: "What landscaping help do you need?", options: ["Yard cleanup", "New planting", "Mulch / rock", "Sod / lawn", "Irrigation", "Not sure yet"] },
    "pressure-washing": { title: "What pressure washing do you need?", options: ["Driveway", "House exterior", "Patio / pavers", "Fence / deck", "Commercial surface", "Not sure yet"] },
    "fence-installation": { title: "What fence project do you need?", options: ["New fence", "Fence replacement", "Fence repair", "Gate", "Privacy fence", "Not sure yet"] },
    "paver-installation": { title: "What paver project do you need?", options: ["Patio", "Driveway", "Walkway", "Pool deck", "Repair / reset", "Not sure yet"] },
    "gutter-services": { title: "What gutter service do you need?", options: ["Gutter installation", "Gutter replacement", "Gutter repair", "Cleaning", "Drainage issue", "Not sure yet"] },
    "junk-removal": { title: "What junk removal help do you need?", options: ["Furniture removal", "Appliance removal", "Garage cleanout", "Yard debris", "Construction debris", "Not sure yet"] },
    "pest-control": { title: "What pest control help do you need?", options: ["Ants / roaches", "Rodents", "Termites", "Mosquitoes", "General treatment", "Not sure yet"] },
    "pool-services": { title: "What pool service do you need?", options: ["Pool cleaning", "Pool maintenance", "Equipment repair", "Green pool", "Inspection", "Not sure yet"] }
  };

  ensureLeadEndpointDefaults();
  prepareDynamicService();
  annotateFlow();
  bindInteractive();
  bindNavigation();
  showStep(getInitialStepIndex());

  function prepareDynamicService() {
    if (flow.type !== "standard") return;

    const serviceStep = flow.steps.find((step) => step.field === "Service Type");
    if (!serviceStep) return;

    const params = new URLSearchParams(window.location.search);
    const requested = slugify(params.get("service"));
    if (!requested) return;

    const selected = serviceStep.options.find((option) => slugify(option) === requested);
    if (!selected) return;

    const serviceField = document.getElementById("field-0");
    if (serviceField) serviceField.value = selected;

    const selectedButton = Array.from(form.querySelectorAll('[data-single-group="0"] .option-btn')).find((button) => slugify(button.dataset.value) === requested);
    if (selectedButton) selectedButton.classList.add("selected");

    state.lockedService = true;
    syncServiceLabel(selected);
    applyServiceSpecificStandardQuestion(requested);
  }

  function applyServiceSpecificStandardQuestion(serviceSlug) {
    if (flow.type !== "standard") return;
    const custom = standardServiceQuestions[serviceSlug];
    if (!custom || !steps[1] || !flow.steps[1]) return;

    flow.steps[1].title = custom.title;
    flow.steps[1].field = "Project Type";
    flow.steps[1].options = custom.options;

    const step = steps[1];
    const heading = step.querySelector("h2");
    const hidden = step.querySelector('input[type="hidden"]');
    const group = step.querySelector("[data-single-group]");

    if (heading) heading.textContent = custom.title;
    if (hidden) {
      hidden.name = "Project Type";
      hidden.value = "";
    }
    if (group) {
      group.innerHTML = custom.options.map((option) => `<button type="button" class="option-btn" data-target="field-1" data-value="${escapeHtml(option)}">${escapeHtml(option)}</button>`).join("");
      Array.from(group.querySelectorAll(".option-btn")).forEach(bindOptionButton);
    }
  }

  function annotateFlow() {
    syncServiceDatasets();

    steps.forEach((step, index) => {
      step.dataset.flowStep = String(index + 1);
      step.dataset.service = slugify(flow.serviceLabel);

      const error = step.querySelector(".error");
      if (error) {
        error.setAttribute("role", "alert");
        error.setAttribute("aria-live", "polite");
      }

      step.querySelectorAll("[data-next]").forEach((button) => {
        button.dataset.track = "flow_step_completed";
        button.dataset.cta = "continue";
        button.dataset.action = "continue";
        button.dataset.flowStep = String(index + 1);
        button.dataset.service = slugify(flow.serviceLabel);
      });

      step.querySelectorAll("[data-back]").forEach((button) => {
        button.dataset.track = "flow_back_clicked";
        button.dataset.cta = "back";
        button.dataset.action = "back";
        button.dataset.flowStep = String(index + 1);
        button.dataset.service = slugify(flow.serviceLabel);
      });

      step.querySelectorAll(".submit-btn").forEach((button) => {
        button.dataset.track = "form_submitted";
        button.dataset.cta = "submit-request";
        button.dataset.action = "submit";
        button.dataset.flowStep = String(index + 1);
        button.dataset.service = slugify(flow.serviceLabel);
      });
    });
  }

  function bindInteractive() {
    Array.from(form.querySelectorAll(".option-btn")).forEach(bindOptionButton);

    Array.from(form.querySelectorAll('.photo-field input[type="file"]')).forEach((input) => {
      input.addEventListener("change", () => {
        clearError(state.currentStep);
        const target = input.closest(".photo-field").querySelector(".photo-file-name");
        target.textContent = input.files && input.files[0] ? `Selected: ${input.files[0].name}` : "";
      });
    });

    Array.from(form.querySelectorAll('.checkbox-item input[type="checkbox"]')).forEach((input) => {
      input.addEventListener("change", () => {
        clearError(state.currentStep);
        input.closest(".checkbox-item").classList.toggle("selected", input.checked);
      });
    });

    Array.from(form.querySelectorAll("input, textarea, select")).forEach((field) => {
      field.addEventListener("input", () => clearError(state.currentStep));
      field.addEventListener("change", () => clearError(state.currentStep));
    });
  }

  function bindOptionButton(button) {
    button.addEventListener("click", () => {
      clearError(state.currentStep);
      const group = button.closest("[data-single-group]");
      if (group) Array.from(group.querySelectorAll(".option-btn")).forEach((item) => item.classList.remove("selected"));

      const conditionalGroup = button.closest("[data-conditional-group]");
      if (conditionalGroup) Array.from(conditionalGroup.querySelectorAll(".option-btn")).forEach((item) => item.classList.remove("selected"));

      button.classList.add("selected");
      const target = document.getElementById(button.dataset.target);
      if (target) target.value = button.dataset.value;

      if (group) {
        const groupIndex = Number(group.dataset.singleGroup);
        const config = flow.steps[groupIndex];

        if (config && config.field === "Service Type") syncServiceLabel(button.dataset.value);

        if (config && config.conditional) {
          const conditionalBox = document.getElementById(`conditional-${groupIndex}`);
          const conditionalInput = document.getElementById(`conditional-field-${groupIndex}`);
          const shouldShow = config.conditional.triggerValues.includes(button.dataset.value);

          if (conditionalBox) conditionalBox.style.display = shouldShow ? "block" : "none";
          if (!shouldShow && conditionalInput) {
            conditionalInput.value = "";
            if (conditionalBox) Array.from(conditionalBox.querySelectorAll(".option-btn")).forEach((item) => item.classList.remove("selected"));
          }
        }
      }
    });
  }

  function bindNavigation() {
    Array.from(form.querySelectorAll("[data-next]")).forEach((button) => {
      button.addEventListener("click", () => {
        if (!validateStep(state.currentStep)) return;
        const next = findNextVisibleStep(state.currentStep);
        if (next !== null) showStep(next);
      });
    });

    Array.from(form.querySelectorAll("[data-back]")).forEach((button) => {
      button.addEventListener("click", () => {
        const previous = findPreviousVisibleStep(state.currentStep);
        if (previous !== null) showStep(previous);
      });
    });

    form.addEventListener("submit", (event) => {
      if (!validateStep(state.currentStep)) event.preventDefault();
    });
  }

  function validateStep(index) {
    if (!isStepVisible(index)) return true;
    const step = steps[index];
    const config = flow.steps[index];
    const error = step.querySelector(".error");
    clearError(index);

    if (config.type === "single") {
      const hidden = document.getElementById(`field-${index}`);
      if (!hidden || !hidden.value.trim()) return showError(error, "Please choose one option to continue.");
      if (config.conditional) {
        const conditionalInput = document.getElementById(`conditional-field-${index}`);
        if (config.conditional.triggerValues.includes(hidden.value) && (!conditionalInput || !conditionalInput.value.trim())) return showError(error, "Please answer the follow-up question to continue.");
      }
      if (config.includeDescription) {
        const textarea = document.getElementById(`description-${index}`);
        const value = textarea ? textarea.value.trim() : "";
        if (config.descriptionRequired === true && value.length < 8) return showError(error, "Please add a little more detail so local professionals can understand the request.");
      }
    }
    if (config.type === "multi" && !step.querySelectorAll('input[type="checkbox"]:checked').length) return showError(error, "Please select at least one option to continue.");
    if (config.type === "textarea") {
      const textarea = step.querySelector("textarea");
      if (config.required && (!textarea || textarea.value.trim().length < 8)) return showError(error, "Please add a short project note before continuing.");
    }
    if (config.type === "location") {
      const city = getValue("city");
      const zip = getValue("zip");
      if (!city || city.length < 2 || !zip) return showError(error, "Please enter your city and a valid ZIP Code so we can route this request locally.");
      if (!/^\d{5}$/.test(zip)) return showError(error, "Please enter a valid 5-digit ZIP Code.");
    }
    if (config.type === "contact") return validateContactStep(error);
    if (config.type === "contact-location") {
      const city = getValue("city");
      const zip = getValue("zip");
      if (!city || city.length < 2 || !zip) return showError(error, "Please enter your city and a valid ZIP Code so we can route this request locally.");
      if (!/^\d{5}$/.test(zip)) return showError(error, "Please enter a valid 5-digit ZIP Code.");
      return validateContactStep(error);
    }
    return true;
  }

  function validateContactStep(error) {
    const name = getValue("fullName");
    const phone = getValue("phone");
    const email = getValue("email");
    const contactMethod = getValue("contactMethod");
    if (!name || !phone || !email || !contactMethod) return showError(error, "Please complete your name, phone number, email address, and preferred contact method.");
    if (phone.replace(/\D/g, "").length < 10) return showError(error, "Please enter a valid phone number.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return showError(error, "Please enter a valid email address.");
    return true;
  }

  function getValue(id) { const field = document.getElementById(id); return field ? field.value.trim() : ""; }
  function showError(box, message) { if (box) { box.textContent = message; box.style.display = "block"; } return false; }
  function clearError(index) { const step = steps[index]; if (!step) return; const box = step.querySelector(".error"); if (box) { box.textContent = ""; box.style.display = "none"; } }
  function getVisibleStepIndices() { const indices = []; for (let index = 0; index < flow.steps.length; index += 1) if (isStepVisible(index)) indices.push(index); return indices; }
  function isStepVisible(index) { const config = flow.steps[index]; if (!config) return false; if (flow.type === "standard" && state.lockedService && config.field === "Service Type") return false; if (config.visibleIfMultiIncludes) return hasCheckedValue(config.visibleIfMultiIncludes.field, config.visibleIfMultiIncludes.value); return true; }
  function hasCheckedValue(fieldName, value) { return Array.from(form.querySelectorAll(`input[name="${cssEscape(fieldName)}"]`)).some((input) => input.checked && input.value === value); }
  function findNextVisibleStep(currentIndex) { for (let index = currentIndex + 1; index < flow.steps.length; index += 1) if (isStepVisible(index)) return index; return null; }
  function findPreviousVisibleStep(currentIndex) { for (let index = currentIndex - 1; index >= 0; index -= 1) if (isStepVisible(index)) return index; return null; }
  function getInitialStepIndex() { const visible = getVisibleStepIndices(); return visible.length ? visible[0] : 0; }

  function showStep(index) {
    const visible = getVisibleStepIndices();
    if (!visible.length) return;
    const normalized = visible.includes(index) ? index : visible[0];
    steps.forEach((step, stepIndex) => step.classList.toggle("active", stepIndex === normalized));
    state.currentStep = normalized;
    const activePosition = visible.indexOf(normalized);
    if (stepLabel) stepLabel.textContent = `Step ${activePosition + 1} of ${visible.length}`;
    if (stepMiniTitle) stepMiniTitle.textContent = flow.steps[normalized].title;
    if (progressFill) progressFill.style.width = `${((activePosition + 1) / visible.length) * 100}%`;
    requestAnimationFrame(() => { scrollToFlowTop(); focusStep(steps[normalized]); });
  }

  function scrollToFlowTop() { const target = document.querySelector(".quote-shell") || document.querySelector(".quote-layout") || form; if (!target) return; const header = document.querySelector(".site-header"); const headerHeight = header ? header.offsetHeight : 0; const top = target.getBoundingClientRect().top + window.scrollY - headerHeight - 18; window.scrollTo({ top: Math.max(top, 0), behavior: "smooth" }); }
  function focusStep(step) { const target = step.querySelector("input:not([type=hidden]), textarea, select, .option-btn"); if (target && typeof target.focus === "function") target.focus({ preventScroll: true }); }

  function syncServiceLabel(label) {
    flow.serviceLabel = label;
    syncServiceDatasets();
    const title = document.querySelector("[data-flow-page-title]");
    const intro = document.querySelector("[data-flow-intro]");
    const sidebar = document.querySelector("[data-flow-service-label]");
    const serviceField = form.querySelector('input[name="Service Type"]');
    if (serviceField) serviceField.value = label;
    if (sidebar) sidebar.textContent = label;
    if (flow.type === "standard") {
      if (title) title.textContent = `Start your ${label.toLowerCase()} request`;
      if (intro) intro.textContent = `Share a few project details and connect with local professionals for ${label.toLowerCase()} in the Tampa Bay area.`;
    }
  }

  function syncServiceDatasets() { const slug = slugify(flow.serviceLabel); form.dataset.service = slug; steps.forEach((step) => { step.dataset.service = slug; step.querySelectorAll("[data-next], [data-back], .submit-btn").forEach((button) => { button.dataset.service = slug; }); }); }
  function ensureLeadEndpointDefaults() { form.action = "/api/lead"; form.method = "POST"; form.enctype = "multipart/form-data"; }
  function slugify(value) { return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""); }

  function initServiceStarter() {
    const root = document.querySelector("[data-service-starter]");
    const config = window.serviceStarterConfig;
    if (!root) return;
    const input = root.querySelector("[data-service-search-input], [data-service-starter-input]");
    const results = root.querySelector("[data-service-search-results], [data-service-starter-results]");
    if (!input || !results) return;
    const sourceItems = Array.isArray(config && config.items) ? config.items : [];
    const items = sourceItems.map((item) => ({ ...item, normalized: normalizeText(`${item.label} ${item.summary || ""} ${(item.keywords || []).join(" ")}`) }));
    if (!items.length) return;
    render(items.slice(0, 5));
    input.addEventListener("input", () => { const query = normalizeText(input.value); if (!query) { render(items.slice(0, 5)); return; } render(items.filter((item) => item.normalized.includes(query)).slice(0, 6)); });
    input.addEventListener("keydown", (event) => { if (event.key !== "Enter") return; const firstLink = results.querySelector("a.service-starter-item"); if (!firstLink) return; event.preventDefault(); window.location.href = firstLink.getAttribute("href"); });
    function render(itemsToRender) {
      if (!itemsToRender.length) { results.innerHTML = '<div class="service-starter-empty">No close match yet. Try kitchen, cleaning, roofing, or plumbing.</div>'; results.classList.add("is-visible"); return; }
      results.innerHTML = itemsToRender.map((item) => `<a class="service-starter-item" href="${item.href}" data-service-option data-track="service_selected" data-cta="service-search-result" data-service="${item.key}" data-action="starter-result-click"><strong>${escapeHtml(item.label)}</strong><span>${escapeHtml(item.cta)} · ${escapeHtml(item.summary || "")}</span></a>`).join("");
      results.classList.add("is-visible");
    }
  }

  function normalizeText(value) { return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim(); }
  function escapeHtml(value) { return String(value || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;").replace(/'/g, "&#39;"); }
  function cssEscape(value) { return String(value).replace(/"/g, '\\"'); }
})();

