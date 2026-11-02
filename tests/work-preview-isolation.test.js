"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {protectedPreview,DEVELOPMENT_REF}=require("../api/_lib/preview-target");
const {config}=require("../api/admin/_auth");

test("Work Opportunities feature Preview is protected as a Development-only backend",()=>{
 const env={VERCEL_ENV:"preview",VERCEL_GIT_COMMIT_REF:"feature/work-opportunities-mvp"};
 assert.equal(protectedPreview(env),true);
 assert.throws(
  ()=>config({...env,GETESTIMATEFAST_ISOLATED_BACKEND:"false"}),
  /requires its isolated development backend/
 );
});

test("Work Opportunities feature Preview accepts only the approved Development project",()=>{
 const base={
  VERCEL_ENV:"preview",
  VERCEL_GIT_COMMIT_REF:"feature/work-opportunities-mvp",
  GETESTIMATEFAST_ISOLATED_BACKEND:"true",
  GETESTIMATEFAST_SUPABASE_URL:"https://wrongprojectrefxxxxx.supabase.co",
  GETESTIMATEFAST_SUPABASE_SECRET_KEY:"sb_secret_synthetic",
  GETESTIMATEFAST_SUPABASE_PUBLISHABLE_KEY:"sb_publishable_synthetic"
 };
 assert.throws(
  ()=>config({...base,GETESTIMATEFAST_DEVELOPMENT_PROJECT_REF:"wrongprojectrefxxxxx"}),
  /requires the approved development project/
 );
 assert.equal(DEVELOPMENT_REF,"cpjsbijgijeyrwjpuciv");
});
