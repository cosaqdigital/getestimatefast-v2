"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {
  MAX_PHOTO_COUNT,
  MAX_PHOTO_SIZE,
  validatePhotoMetadata,
  parsePhotoPaths
}=require("../api/_lib/lead-photo-storage");

const token="11111111-2222-4333-8444-555555555555";

test("lead photos allow up to five supported images",()=>{
  const files=Array.from({length:5},(_,index)=>({type:index%2?"image/png":"image/jpeg",size:1024+index}));
  const result=validatePhotoMetadata(files);
  assert.equal(result.length,5);
  assert.equal(MAX_PHOTO_COUNT,5);
});

test("lead photos reject a sixth image",()=>{
  const files=Array.from({length:6},()=>({type:"image/jpeg",size:1024}));
  assert.throws(()=>validatePhotoMetadata(files),/1 and 5/);
});

test("lead photos reject files over five megabytes",()=>{
  assert.equal(MAX_PHOTO_SIZE,5*1024*1024);
  assert.throws(()=>validatePhotoMetadata([{type:"image/webp",size:MAX_PHOTO_SIZE+1}]),/5 MB/);
});

test("photo paths are bound to the request submission token",()=>{
  const valid=token+"/01-aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee.jpg";
  const foreign="99999999-2222-4333-8444-555555555555/01-aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee.jpg";
  assert.deepEqual(parsePhotoPaths(JSON.stringify([valid,foreign]),token),[valid]);
});
