(function () {
  const data = window.platformData;
  if (!data) return;
  const formRoot = document.getElementById("formApp");
  if (!formRoot) return;

  const flow = data.flows[document.body.dataset.flowKey];
  if (!flow) return;

  const stepTitles = flow.steps.map((step) => step.title);

  formRoot.innerHTML = `
    <div class="stage-banner">Staging Phase 1 • Functional quote flow • No production changes</div>
    <div class="container quote-page">
      <div class="quote-layout">
        <aside class="quote-sidebar">
          <div class="panel">
            <div class="eyebrow">${flow.type === "complex" ? "Complex flow" : "Fast flow"}</div>
            <h2>${flow.pageTitle}</h2>
            <p class="step-help">${flow.intro}</p>
            <div class="progress-wrap">
              <div class="progress-top">
                <span id="stepLabel">Step 1 of ${flow.steps.length}</span>
                <span id="stepMiniTitle">${stepTitles[0]}</span>
              </div>
              <div class="progress-bar"><div id="progressFill" class="progress-fill"></div></div>
            </div>
            <div class="microcopy-box">
              <h3>Why we ask for details</h3>
              <div class="microcopy-list">
                ${flow.microcopy.map((item) => `<div class="microcopy-item">${item}</div>`).join("")}
              </div>
            </div>
          </div>
        </aside>

        <div class="panel">
          <form id="requestForm" action="/api/lead" method="POST" enctype="multipart/form-data">
            <input type="hidden" name="Service Type" value="${flow.serviceLabel}" />
            <input type="hidden" name="Landing Page" value="${window.location.pathname.split("/").pop()}" />
            <input type="hidden" name="Landing Page URL" value="${window.location.href}" />
            ${flow.steps.map((step, index) => renderStep(step, index)).join("")}
          </form>
        </div>
      </div>
    </div>
  `;

  const steps = Array.from(formRoot.querySelectorAll(".step"));
  const form = document.getElementById("requestForm");
  const progressFill = document.getElementById("progressFill");
  const stepLabel = document.getElementById("stepLabel");
  const stepMiniTitle = document.getElementById("stepMiniTitle");
  const state = { currentStep: 0 };

  bindInteractiveElements();
  bindNavigation();
  showStep(0);

  function renderStep(step, index) {
    if (step.type === "single") {
      return `
        <section class="step" data-step="${index}">
          <h2>${step.title}</h2>
          <p class="step-help">${step.help}</p>
          <input type="hidden" name="${step.field}" id="field-${index}" />
          <div class="option-grid ${step.options.length > 6 ? "three-col" : "two-col"}" data-single-group="${index}">
            ${step.options.map((option) => `<button type="button" class="option-btn" data-target="field-${index}" data-value="${option}">${option}</button>`).join("")}
          </div>
          ${step.conditional ? `
            <div id="conditional-${index}" class="detail-card" style="margin-top:16px; display:none;">
              <p class="step-help" style="margin-bottom:14px;">${step.conditional.title}</p>
              <input type="hidden" name="${step.conditional.field}" id="conditional-field-${index}" />
              <div class="option-grid two-col" data-conditional-group="${index}">
                ${step.conditional.options.map((option) => `<button type="button" class="option-btn" data-target="conditional-field-${index}" data-value="${option}">${option}</button>`).join("")}
              </div>
            </div>
          ` : ""}
          ${step.includeDescription ? `
            <div style="margin-top:18px;">
              <label class="field-label" for="description-${index}">${flow.descriptionPrompt}</label>
              <textarea id="description-${index}" name="Project Description" placeholder="${flow.descriptionPlaceholder}"></textarea>
              <div class="hint">The more relevant detail you provide, the easier it is for professionals to understand your request.</div>
            </div>
          ` : ""}
          ${renderStepFooter(index)}
        </section>
      `;
    }

    if (step.type === "multi") {
      return `
        <section class="step" data-step="${index}">
          <h2>${step.title}</h2>
          <p class="step-help">${step.help}</p>
          <div class="option-grid three-col">
            ${step.options.map((option) => `
              <label class="checkbox-item">
                <input type="checkbox" name="${step.field}" value="${option}" />
                <span>${option}</span>
              </label>
            `).join("")}
          </div>
          ${renderStepFooter(index)}
        </section>
      `;
    }

    if (step.type === "photos-location") {
      return `
        <section class="step" data-step="${index}">
          <h2>${step.title}</h2>
          <p class="step-help">${step.help}</p>
          <div class="upload-box">
            <strong>Upload up to 3 photos</strong>
            <div class="hint">Photos are optional, but they can help professionals understand the scope and provide better estimates.</div>
            <div class="photo-grid" style="margin-top:14px;">
              ${[1,2,3].map((i) => `
                <div class="photo-field">
                  <label class="field-label" for="photo-${i}">Photo ${i}</label>
                  <input id="photo-${i}" type="file" name="Photo ${i}" accept="image/*" />
                  <span class="photo-file-name"></span>
                </div>
              `).join("")}
            </div>
          </div>
          <div class="field-grid two-col" style="margin-top:18px;">
            <div>
              <label class="field-label" for="city">City</label>
              <input id="city" name="City" type="text" placeholder="City" />
            </div>
            <div>
              <label class="field-label" for="zip">ZIP Code</label>
              <input id="zip" name="ZIP Code" type="text" placeholder="ZIP Code" />
            </div>
          </div>
          ${renderStepFooter(index)}
        </section>
      `;
    }

    if (step.type === "location") {
      return `
        <section class="step" data-step="${index}">
          <h2>${step.title}</h2>
          <p class="step-help">${step.help}</p>
          <div class="field-grid two-col">
            <div>
              <label class="field-label" for="city">City</label>
              <input id="city" name="City" type="text" placeholder="City" />
            </div>
            <div>
              <label class="field-label" for="zip">ZIP Code</label>
              <input id="zip" name="ZIP Code" type="text" placeholder="ZIP Code" />
            </div>
          </div>
          ${renderStepFooter(index)}
        </section>
      `;
    }

    if (step.type === "contact") {
      return `
        <section class="step" data-step="${index}">
          <h2>${step.title}</h2>
          <p class="step-help">${step.help}</p>
          <div class="field-grid two-col">
            <div>
              <label class="field-label" for="fullName">Full Name</label>
              <input id="fullName" name="Full Name" type="text" placeholder="Full Name" />
            </div>
            <div>
              <label class="field-label" for="phone">Phone Number</label>
              <input id="phone" name="Phone Number" type="tel" placeholder="Phone Number" />
            </div>
            <div>
              <label class="field-label" for="email">Email Address</label>
              <input id="email" name="Email Address" type="email" placeholder="Email Address" />
            </div>
            <div>
              <label class="field-label" for="contactMethod">Preferred contact method</label>
              <select id="contactMethod" name="Preferred contact method">
                <option value="">Choose contact method</option>
                <option>Phone call</option>
                <option>Text message</option>
                <option>Email</option>
              </select>
            </div>
          </div>
          <div class="trust-note">Your information is shared only with qualified local professionals for this request.</div>
          <div class="nav-row">
            ${index > 0 ? `<button type="button" class="nav-btn secondary" data-back>Back</button>` : ""}
            <button type="submit" class="submit-btn">Get My Free Quotes</button>
          </div>
          <div class="microcopy">Free • No obligation • Designed to reduce unnecessary follow-up calls</div>
          <div class="error"></div>
        </section>
      `;
    }

    return `
      <section class="step" data-step="${index}">
        <h2>${step.title}</h2>
        <p class="step-help">${step.help}</p>
        <div>
          <label class="field-label" for="description-${index}">${flow.descriptionPrompt}</label>
          <textarea id="description-${index}" name="Project Description" placeholder="${flow.descriptionPlaceholder}"></textarea>
        </div>
        ${renderStepFooter(index)}
      </section>
    `;
  }

  function renderStepFooter(index) {
    return `
      <div class="nav-row">
        ${index > 0 ? `<button type="button" class="nav-btn secondary" data-back>Back</button>` : ""}
        <button type="button" class="nav-btn" data-next>Next</button>
      </div>
      <div class="error"></div>
    `;
  }

  function bindInteractiveElements() {
    Array.from(form.querySelectorAll(".option-btn")).forEach((button) => {
      button.addEventListener("click", () => {
        const group = button.closest("[data-single-group]");
        if (group) {
          Array.from(group.querySelectorAll(".option-btn")).forEach((item) => item.classList.remove("selected"));
        }
        const conditionalGroup = button.closest("[data-conditional-group]");
        if (conditionalGroup) {
          Array.from(conditionalGroup.querySelectorAll(".option-btn")).forEach((item) => item.classList.remove("selected"));
        }
        button.classList.add("selected");
        const target = document.getElementById(button.dataset.target);
        if (target) target.value = button.dataset.value;

        if (group) {
          const groupIndex = Number(group.dataset.singleGroup);
          const config = flow.steps[groupIndex];
          if (config && config.conditional) {
            const conditionalBox = document.getElementById(`conditional-${groupIndex}`);
            const conditionalInput = document.getElementById(`conditional-field-${groupIndex}`);
            const shouldShow = config.conditional.triggerValues.includes(button.dataset.value);
            conditionalBox.style.display = shouldShow ? "block" : "none";
            if (!shouldShow && conditionalInput) {
              conditionalInput.value = "";
              Array.from(conditionalBox.querySelectorAll(".option-btn")).forEach((item) => item.classList.remove("selected"));
            }
          }
        }
      });
    });

    Array.from(form.querySelectorAll('.photo-field input[type="file"]')).forEach((input) => {
      input.addEventListener("change", () => {
        const nameTarget = input.closest(".photo-field").querySelector(".photo-file-name");
        nameTarget.textContent = input.files && input.files[0] ? `Selected: ${input.files[0].name}` : "";
      });
    });

    Array.from(form.querySelectorAll('.checkbox-item input[type="checkbox"]')).forEach((input) => {
      input.addEventListener("change", () => {
        input.closest(".checkbox-item").classList.toggle("selected", input.checked);
      });
    });
  }

  function bindNavigation() {
    Array.from(form.querySelectorAll("[data-next]")).forEach((button) => {
      button.addEventListener("click", () => {
        if (!validateStep(state.currentStep)) return;
        showStep(state.currentStep + 1);
      });
    });

    Array.from(form.querySelectorAll("[data-back]")).forEach((button) => {
      button.addEventListener("click", () => {
        showStep(state.currentStep - 1);
      });
    });

    form.addEventListener("submit", (event) => {
      if (!validateStep(state.currentStep)) {
        event.preventDefault();
      }
    });
  }

  function validateStep(index) {
    const step = steps[index];
    const error = step.querySelector(".error");
    if (error) error.style.display = "none";
    const config = flow.steps[index];

    if (config.type === "single") {
      const hidden = document.getElementById(`field-${index}`);
      if (!hidden.value.trim()) return showError(error, "Please select one option to continue.");
      if (config.conditional) {
        const conditionalInput = document.getElementById(`conditional-field-${index}`);
        if (config.conditional.triggerValues.includes(hidden.value) && !conditionalInput.value.trim()) {
          return showError(error, "Please answer the follow-up question to continue.");
        }
      }
    }

    if (config.type === "multi") {
      if (!step.querySelectorAll('input[type="checkbox"]:checked').length) return showError(error, "Please select at least one option to continue.");
    }

    if (config.type !== "contact" && step.querySelector('textarea[name="Project Description"]')) {
      const textarea = step.querySelector('textarea[name="Project Description"]');
      if (textarea.value.trim().length < 10) return showError(error, "Please add a short project description to continue.");
    }

    if (config.type === "photos-location" || config.type === "location") {
      const city = document.getElementById("city").value.trim();
      const zip = document.getElementById("zip").value.trim();
      if (!city || !zip) return showError(error, "Please complete city and ZIP Code to continue.");
    }

    if (config.type === "contact") {
      const requiredIds = ["fullName", "phone", "email", "contactMethod"];
      const incomplete = requiredIds.some((id) => !document.getElementById(id).value.trim());
      if (incomplete) return showError(error, "Please complete your name, phone number, email address, and preferred contact method.");
    }

    return true;
  }

  function showError(errorBox, message) {
    if (errorBox) {
      errorBox.textContent = message;
      errorBox.style.display = "block";
    }
    return false;
  }

  function showStep(index) {
    if (index < 0 || index >= steps.length) return;
    steps.forEach((step, stepIndex) => step.classList.toggle("active", stepIndex === index));
    state.currentStep = index;
    stepLabel.textContent = `Step ${index + 1} of ${steps.length}`;
    stepMiniTitle.textContent = stepTitles[index];
    progressFill.style.width = `${((index + 1) / steps.length) * 100}%`;
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
})();
