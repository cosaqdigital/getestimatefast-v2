"use strict";
const CODES = new Set(["PROCESS_START_FAILED", "PROCESS_EXIT_NONZERO", "PROCESS_INTERRUPTED", "PROCESS_TIMEOUT", "PROCESS_CLEANUP_FAILED", "PROCESS_CLEANUP_TIMEOUT", "LAUNCHER_STOPPED", "LAUNCHER_STARTUP_TIMEOUT", "LAUNCHER_INTERRUPTED", "LAUNCHER_CHILD_EXIT", "LAUNCHER_DESTINATION_FAILED", "LAUNCHER_SECRET_CHANGED", "LAUNCHER_START_FAILED", "OIDC_REFRESH_TIMEOUT", "OPERATION_ABORTED"]);
class OperationalError extends Error {
  constructor(code, details = {}) {
    const safe = CODES.has(code) ? code : "LAUNCHER_START_FAILED";
    super("Private operation unavailable: " + safe); this.code = safe;
    if (Number.isInteger(details.exitCode)) this.exitCode = details.exitCode;
    if (["SIGINT", "SIGTERM", "SIGKILL"].includes(details.signal)) this.signal = details.signal;
  }
}
function timed(operation, ms, signal, code = "PROCESS_TIMEOUT") {
  if (!Number.isInteger(ms) || ms < 1 || ms > 30000) return Promise.reject(new OperationalError(code));
  const controller = new AbortController(), scope = signal ? AbortSignal.any([signal, controller.signal]) : controller.signal;
  return new Promise((resolve, reject) => {
    let timer;
    const cleanup = () => { clearTimeout(timer); scope.removeEventListener("abort", aborted); };
    const aborted = () => { cleanup(); reject(new OperationalError(controller.signal.aborted ? code : "OPERATION_ABORTED")); };
    if (scope.aborted) return aborted();
    scope.addEventListener("abort", aborted, { once: true }); timer = setTimeout(() => controller.abort(), ms);
    Promise.resolve().then(() => { if (scope.aborted) throw new OperationalError("OPERATION_ABORTED"); return operation(scope); }).then(v => { cleanup(); resolve(v); }, e => { cleanup(); reject(e); });
  });
}
function safeStatus(value) {
  const code = CODES.has(value?.code) ? value.code : "LAUNCHER_START_FAILED";
  return Object.freeze({ code, ...(Number.isInteger(value?.exitCode) ? { exitCode: value.exitCode } : {}), ...(["SIGINT", "SIGTERM", "SIGKILL"].includes(value?.signal) ? { signal: value.signal } : {}) });
}
module.exports = { OperationalError, timed, safeStatus };
