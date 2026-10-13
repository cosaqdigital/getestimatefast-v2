"use strict";
/** @typedef {Readonly<{id:string,sha:string,origin:string,alias:string,projectId:string,teamId:string,repository:string,repoId:number,branch:string,environment:'preview'}>} AuthorizedDeployment */
const PROJECT = "prj_kA6x5rt1MChiNSQpa6pShHoUSuOF", TEAM = "team_vRw9eJBijmUFe1SbbOFY5xZs";
// Reviewed source catalog only. No environment, CLI object or remote response can add entries.
/** @type {Readonly<Record<string, AuthorizedDeployment>>} */
const CATALOG = Object.freeze({
  "pr60-stage7": Object.freeze({
    id: "dpl_AbusK9zKzKP8Ddejvu6VgNyV6jsx", sha: "6386dd8f38f45f40056353b9f146b478556e3024",
    origin: "https://getestimatefast-v2-flyqq13ds-get-estimate-fast.vercel.app",
    alias: "getestimatefast-v2-git-feat-stripe-san-f12bd7-get-estimate-fast.vercel.app",
    projectId: PROJECT, teamId: TEAM, repository: "cosaqdigital/getestimatefast-v2", repoId: 1211705834,
    branch: "feat/stripe-sandbox-safety-20261012", environment: "preview"
  })
});
function selectDeployment(key) {
  if (typeof key !== "string" || !Object.hasOwn(CATALOG, key)) throw Error("Explicit authorized deployment selection required");
  const d = CATALOG[key], u = new URL(d.origin);
  if (d.projectId !== PROJECT || d.teamId !== TEAM || d.repository !== "cosaqdigital/getestimatefast-v2" || d.repoId !== 1211705834 ||
      d.environment !== "preview" || d.branch !== "feat/stripe-sandbox-safety-20261012" || !/^dpl_[A-Za-z0-9]+$/.test(d.id) || !/^[a-f0-9]{40}$/.test(d.sha) ||
      u.origin !== d.origin || u.protocol !== "https:" || !u.hostname.endsWith(".vercel.app") || u.username || u.password || u.port || u.pathname !== "/" || u.search || u.hash ||
      !/^[a-z0-9-]+\.vercel\.app$/.test(d.alias) || u.hostname === d.alias) throw Error("Invalid authorized deployment catalog");
  return d;
}
function assertAuthorizedTarget(target) {
  const entry = Object.values(CATALOG).find(d => ["id", "sha", "origin", "projectId", "teamId", "branch", "environment"].every(k => target?.[k] === d[k]));
  if (!entry) throw Error("Destination is not explicitly authorized");
  return entry;
}
module.exports = { PROJECT, TEAM, selectDeployment, assertAuthorizedTarget };
