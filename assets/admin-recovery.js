(function () {
  "use strict";
  const endpoint = "/api/admin/password-recovery";
  const $ = id => document.getElementById(id);
  let accessToken = "", linkState = "request", urlCleared = false;
  let ready = false, state = "loading", lifecycle = 0, activeRequest = null;

  // The fragment is consumed once. No refresh token or URL parameter is persisted.
  (function consumeRecoveryFragment() {
    const fragment = window.location.hash;
    const hadQuery = Boolean(window.location.search);
    try {
      window.history.replaceState(null, "", window.location.pathname);
      urlCleared = !window.location.hash && !window.location.search;
      if (!urlCleared) return;
      if (!fragment) { linkState = hadQuery ? "expired" : "request"; return; }
      const fields = new URLSearchParams(fragment.slice(1));
      const tokens = fields.getAll("access_token");
      const types = fields.getAll("type");
      const tokenTypes = fields.getAll("token_type");
      linkState = "expired";
      if (fields.has("error") || fields.has("error_code") || tokens.length !== 1 ||
          types.length !== 1 || types[0] !== "recovery" || tokenTypes.length > 1 ||
          (tokenTypes.length && tokenTypes[0].toLowerCase() !== "bearer")) return;
      if (tokens[0].length > 16384 || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(tokens[0])) return;
      // This shape check is not authorization. The server must validate the account.
      accessToken = tokens[0];
      linkState = "recovery";
    } catch (_) { accessToken = ""; linkState = "expired"; }
  })();

  function clearPasswords() {
    $("newPassword").value = "";
    $("confirmPassword").value = "";
    $("newPassword").removeAttribute("aria-invalid");
    $("confirmPassword").removeAttribute("aria-invalid");
  }
  function clearSecrets() { accessToken = ""; clearPasswords(); }
  function show(next, message = "") {
    state = next;
    $("recoveryApp").dataset.state = next;
    $("recoveryApp").setAttribute("aria-busy", String(["loading", "requesting", "saving"].includes(next)));
    $("status").textContent = message;
    for (const [id, states] of [
      ["unavailableView", ["unavailable"]], ["requestForm", ["request", "requesting"]],
      ["requestedView", ["requested"]], ["passwordForm", ["recovery", "saving"]],
      ["expiredView", ["expired"]], ["successView", ["success"]]
    ]) $(id).hidden = !states.includes(next);
    $("requestFields").disabled = next !== "request" || !ready;
    $("requestSubmit").disabled = next !== "request" || !ready || !$("requestConsent").checked;
    $("passwordFields").disabled = next !== "recovery" || !ready || !accessToken;
    $("newRecovery").disabled = !ready;
  }
  function unavailable(message, canRetry = false) {
    ready = false;
    $("unavailableMessage").textContent = message;
    $("retryCheck").hidden = !canRetry;
    show("unavailable");
  }
  function expired(message) {
    clearSecrets(); linkState = "expired";
    $("expiredMessage").textContent = message || "This recovery link is missing, expired, or could not be verified. Request a new email to continue.";
    show("expired");
  }
  function accessDenied() {
    clearSecrets();
    unavailable("Administrator access could not be verified. Complete any required account verification before trying again.");
  }
  async function api(method, body, bearer = "") {
    const controller = new AbortController();
    activeRequest = controller;
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch(endpoint, {
        method, mode: "cors", credentials: "same-origin", cache: "no-store", redirect: "error",
        // CORS mode preserves the Origin header even under the no-referrer page policy.
        referrerPolicy: "no-referrer", signal: controller.signal,
        headers: { Accept: "application/json", ...(body ? { "Content-Type": "application/json" } : {}),
          ...(bearer ? { Authorization: "Bearer " + bearer } : {}) },
        ...(body ? { body: JSON.stringify(body) } : {})
      });
      const data = await response.json();
      if (!response.ok) throw { code: typeof data.code === "string" ? data.code : "service_unavailable" };
      return data;
    } finally {
      clearTimeout(timeout);
      if (activeRequest === controller) activeRequest = null;
    }
  }
  function validConfiguration(data) {
    return data && data.enabled === true && data.recipient === "admin@getestimatefast.com" &&
      data.minPasswordLength === 8 && data.maxPasswordLength === 256;
  }
  async function bootstrap() {
    const current = lifecycle;
    ready = false;
    show("loading", "Checking recovery availability…");
    if (!urlCleared) {
      clearSecrets();
      unavailable("This page could not safely open the recovery link. Close it and reopen the link in your browser.");
      return;
    }
    try {
      const config = await api("GET");
      if (current !== lifecycle) return;
      if (!validConfiguration(config)) {
        clearSecrets(); unavailable("Account recovery has not been enabled for this environment."); return;
      }
      ready = true;
      if (linkState === "expired") { expired(); return; }
      if (!accessToken) { show("request"); return; }
      show("loading", "Verifying your recovery link…");
      const session = await api("GET", undefined, accessToken);
      if (current !== lifecycle) return;
      if (!validConfiguration(session)) {
        clearSecrets(); unavailable("Account recovery is not available in this environment."); return;
      }
      if (session.sessionValidated !== true) { expired(); return; }
      show("recovery");
    } catch (error) {
      if (current !== lifecycle) return;
      if (error?.code === "access_denied") { accessDenied(); return; }
      if (["session_invalid", "authentication_required"].includes(error?.code)) {
        if (ready) expired();
        else { clearSecrets(); unavailable("Account recovery could not be authorized in this environment."); }
        return;
      }
      if (["recovery_disabled", "origin_not_allowed"].includes(error?.code)) {
        clearSecrets(); unavailable("Account recovery is not available in this environment."); return;
      }
      unavailable("We could not check account recovery right now. Try again in a moment.", true);
    }
  }
  function openRequest() {
    if (!ready) return;
    clearSecrets(); linkState = "request";
    $("requestConsent").checked = false;
    $("requestError").textContent = "";
    $("passwordError").textContent = "";
    show("request");
    $("requestConsent").focus();
  }
  $("requestConsent").addEventListener("change", () => {
    $("requestError").textContent = "";
    if (state === "request") show("request");
  });
  $("requestForm").addEventListener("submit", async event => {
    event.preventDefault();
    if (!ready || state !== "request") return;
    if (!$("requestConsent").checked) {
      $("requestError").textContent = "Confirm that you want to send the recovery email.";
      $("requestConsent").focus(); return;
    }
    const current = lifecycle;
    show("requesting", "Requesting the recovery email…");
    try {
      const result = await api("POST", { action: "request" });
      if (current !== lifecycle) return;
      if (result?.ok !== true || result.requested !== true) throw { code: "request_uncertain" };
      $("requestedMessage").textContent = "The recovery email was requested. Delivery has not been confirmed.";
      show("requested");
    } catch (error) {
      if (current !== lifecycle) return;
      if (error?.code === "access_denied") { accessDenied(); return; }
      if (["recovery_disabled", "origin_not_allowed", "session_invalid"].includes(error?.code)) {
        clearSecrets(); unavailable("Account recovery is not available in this environment."); return;
      }
      if (error?.code === "rate_limited") {
        $("requestConsent").checked = false;
        $("requestError").textContent = "Too many requests. Wait a few minutes before trying again.";
        show("request"); return;
      }
      if (error?.code === "email_delivery_unavailable") {
        $("requestConsent").checked = false;
        $("requestError").textContent = "The recovery email could not be sent. Try again later.";
        show("request"); return;
      }
      // A timeout does not prove that an email was not sent. Never resend automatically.
      $("requestedMessage").textContent = "We could not confirm the email request. Check your inbox before requesting another email.";
      show("requested");
    }
  });
  $("passwordForm").addEventListener("submit", async event => {
    event.preventDefault();
    if (!ready || state !== "recovery" || !accessToken) return;
    $("passwordError").textContent = "";
    const password = $("newPassword").value;
    const invalid = password.length < 8 || password.length > 256 ? "newPassword" :
      password !== $("confirmPassword").value ? "confirmPassword" : "";
    if (invalid) {
      $(invalid).setAttribute("aria-invalid", "true");
      $("passwordError").textContent = invalid === "newPassword" ? "Use a password with 8–256 characters." : "The passwords do not match. Enter the same password twice.";
      $(invalid).focus(); return;
    }
    const current = lifecycle;
    show("saving", "Updating your password…");
    const pending = api("POST", { action: "complete", password }, accessToken);
    clearPasswords();
    try {
      const result = await pending;
      if (current !== lifecycle) return;
      if (result?.ok !== true || result.redirectPath !== "/admin.html") throw { code: "result_uncertain" };
      clearSecrets(); linkState = "expired";
      show("success");
    } catch (error) {
      if (current !== lifecycle) return;
      if (error?.code === "access_denied") { accessDenied(); return; }
      if (["session_invalid", "authentication_required"].includes(error?.code)) { expired(); return; }
      if (["recovery_disabled", "origin_not_allowed"].includes(error?.code)) {
        clearSecrets(); unavailable("Account recovery is not available in this environment."); return;
      }
      if (["invalid_password", "rate_limited"].includes(error?.code)) {
        $("passwordError").textContent = error.code === "invalid_password" ? "This password was not accepted. Choose a different password and try again." : "Too many attempts. Wait a few minutes before trying again.";
        show("recovery"); return;
      }
      expired("We could not confirm whether your password changed. Try signing in with your new password first. If needed, request a new recovery email.");
    }
  });
  for (const id of ["newPassword", "confirmPassword"]) $(id).addEventListener("input", () => {
    $(id).removeAttribute("aria-invalid"); $("passwordError").textContent = "";
  });
  for (const id of ["requestAnother", "newRecovery", "cancelRecovery"]) $(id).addEventListener("click", openRequest);
  $("retryCheck").addEventListener("click", () => { if (state === "unavailable") void bootstrap(); });
  window.addEventListener("pagehide", () => {
    lifecycle += 1;
    activeRequest?.abort();
    clearSecrets(); linkState = "expired";
    $("requestConsent").checked = false;
    unavailable("This recovery session has been cleared. Reopen your recovery email to continue.");
  });
  window.addEventListener("pageshow", event => { if (event.persisted) void bootstrap(); });
  void bootstrap();
})();
