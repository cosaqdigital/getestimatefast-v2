"use strict";
// Prepared native process lifecycle. This module NEVER starts anything on import.
const cp = require("node:child_process"), fs = require("node:fs"), path = require("node:path");
const { OperationalError, timed } = require("./stripe-operational-control");
const { selectDeployment } = require("./stripe-authorized-deployments");
const ACCOUNT = "acct_1UOl9qH5rFe1usWF";
function assertNativeAuthorization(authorization, selection, now = Date.now()) {
  const d = selectDeployment(selection);
  if (!authorization || !Object.isFrozen(authorization) || authorization.allowRealProcesses !== true ||
      authorization.purpose !== "stripe-relay-operator" || authorization.deploymentId !== d.id || authorization.sha !== d.sha ||
      authorization.origin !== d.origin || authorization.projectId !== d.projectId || authorization.teamId !== d.teamId ||
      authorization.accountId !== ACCOUNT || typeof authorization.allowListener !== "boolean" ||
      !Number.isSafeInteger(authorization.expiresAt) || authorization.expiresAt <= now || authorization.expiresAt > now + 900000) throw Error("Explicit scoped native authorization required");
  return d;
}
function createNativeProcessController({ authorization, selection, validatePlan, timeoutMs = 5000 }) {
  assertNativeAuthorization(authorization, selection);
  if (typeof validatePlan !== "function" || !Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 5000) throw Error("Native lifecycle dependencies required");
  const owned = new WeakSet();
  const results = new WeakMap();
  return {
    spawn(spec, environment) {
      assertNativeAuthorization(authorization, selection); validatePlan(spec, authorization);
      if (process.platform !== "win32" || spec.options.shell !== false || !path.isAbsolute(spec.file) || !fs.statSync(spec.file).isFile()) throw Error("Reviewed Windows executable required");
      const child = cp.spawn(spec.file, [...spec.args], { ...spec.options, env: environment });
      child.once("close", (exitCode, signal) => results.set(child, { exitCode, signal })); owned.add(child); return child;
    },
    async stop(child) {
      if (!owned.has(child)) throw new OperationalError("PROCESS_CLEANUP_FAILED");
      if (results.has(child)) return results.get(child);
      if (!Number.isInteger(child.pid) || child.pid <= 0) throw new OperationalError("PROCESS_CLEANUP_FAILED");
      const closed = new Promise(resolve => child.once("close", (exitCode, signal) => resolve({ exitCode, signal })));
      // Exit/killed flags alone do not prove pipes/descendants are closed.
      if (child.exitCode !== null || child.signalCode !== null) return timed(() => closed, timeoutMs, undefined, "PROCESS_CLEANUP_TIMEOUT");
      // Kill only the owned process tree, with structured argv; never shell/PID discovery.
      const terminate = new Promise((resolve, reject) => cp.execFile(path.join(process.env.SystemRoot || "C:\\Windows", "System32", "taskkill.exe"),
        ["/PID", String(child.pid), "/T", "/F"], { shell: false, windowsHide: true, timeout: timeoutMs, encoding: "buffer", maxBuffer: 65536 },
        (error, out, err) => { out?.fill(0); err?.fill(0); if (error && child.exitCode === null && child.signalCode === null) reject(new OperationalError("PROCESS_CLEANUP_FAILED")); else resolve(); }));
      await timed(() => terminate, timeoutMs, undefined, "PROCESS_CLEANUP_TIMEOUT");
      return timed(() => closed, timeoutMs, undefined, "PROCESS_CLEANUP_TIMEOUT");
    }
  };
}
module.exports = { assertNativeAuthorization, createNativeProcessController };
