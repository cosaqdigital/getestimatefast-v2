"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const {JSDOM}=require("jsdom");
const root=path.join(__dirname,"..");
test("directory treats professional-controlled text as text, including city markup",async()=>{
 const dom=new JSDOM('<form id="professionalSearch"></form><select id="professionalCategory"></select><input id="professionalCity"><input id="professionalZip"><div id="professionalResults"></div><div id="professionalResultsMeta"></div><div id="professionalEmpty"></div>',{runScripts:"outside-only",url:"https://example.invalid"});
 try{
  const w=dom.window,payload='<img src=x onerror="void 0">';
  w.GetEstimateFastLaunch={categories:[{name:"Painting"}],names:["Painting"]};
  w.fetch=async()=>({ok:true,json:async()=>({professionals:[{rank:1,slug:"test-pro",display_name:"< Name",headline:payload,city:payload,state_code:"FL",radius_miles:25,portfolio_count:0,badges:{new_professional:true}}]})});
  w.eval(fs.readFileSync(path.join(root,"assets/professionals-directory.js"),"utf8"));
  w.document.getElementById("professionalSearch").dispatchEvent(new w.Event("submit",{cancelable:true}));
  await new Promise(resolve=>setImmediate(resolve));
  const result=w.document.getElementById("professionalResults");
  assert.equal(result.querySelectorAll("img, [onerror]").length,0);
  assert(result.textContent.includes(payload));
  assert.equal(result.querySelector("h2").textContent,"< Name");
  assert.equal(result.querySelector("a").getAttribute("href"),"/professionals/test-pro");
 }finally{dom.window.close();}
});
test("profile cover uses an image permitted by the existing strict CSP",()=>{
 const {profileHtml}=require("../api/_lib/public-profile-html");
 const html=profileHtml({profile:{slug:"test-pro",display_name:"Test Pro",about:"Example",city:"Riverview",state_code:"FL",radius_miles:25,categories:["Painting"],languages:[],portfolio:[],cover_image_path:"owner/cover.webp"}},"https://www.getestimatefast.com","https://example.supabase.co");
 const dom=new JSDOM(html);
 try{
  const hero=dom.window.document.querySelector(".gef-profile-hero");
  assert.equal(hero.hasAttribute("style"),false);
  assert(hero.classList.contains("gef-profile-has-cover"));
  assert.equal(hero.querySelector(".gef-profile-cover-image").getAttribute("src"),"https://example.supabase.co/storage/v1/object/public/gef-portfolio/owner/cover.webp");
  assert.equal(hero.querySelector(".gef-profile-cover-image").alt,"");
  const handler=fs.readFileSync(path.join(root,"api/public-profile.js"),"utf8");
  assert(handler.includes("style-src 'self'"));
 }finally{dom.window.close();}
});
