"use strict";
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{JSDOM}=require('jsdom');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const settle=()=>new Promise(resolve=>setTimeout(resolve,25));
const contractor={user_id:'11111111-1111-4111-8111-111111111111',display_name:'SYNTHETIC <img src=x onerror=alert(1)>',business_name:'',contact_phone:'8135550100',contact_email:'synthetic@example.invalid',city:'Riverview',state_code:'FL',base_zip:'33569',service_radius_miles:25,service_categories:['Painting'],account_status:'active',email_verified_at:'2026-01-01',created_at:'2026-10-01'};
async function admin(mock){
 const dom=new JSDOM(read('admin.html'),{url:'http://localhost/admin.html',runScripts:'outside-only'}),w=dom.window,calls=[];
 w.fetch=async(url,opts)=>{calls.push({url,opts});let data;
  if(url.endsWith('/login'))data={access_token:'synthetic-token'};
  else if(url.includes('/leads?'))data={leads:[]};
  else if(url.endsWith('/overview'))data={counts:{}};
  else data=await mock(url,opts);
  return {ok:true,status:200,json:async()=>data};
 };
 w.eval(read('assets/admin.js'));
 const d=w.document;d.querySelector('#email').value='synthetic@example.invalid';d.querySelector('#password').value='SYNTHETIC_ONLY';
 d.querySelector('#loginForm').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));await settle();
 return {dom,w,d,calls};
}
test('Contractors/history render safely, mobile labels and keyboard control names exist',async()=>{
 const {dom,d}=await admin(url=>url.includes('contractor-history')?{events:[{created_at:'2026-10-01',prior_status:'pending_review',next_status:'active',note:'<script>SYNTHETIC</script>'}]}:{contractors:[contractor],has_more:false});
 try{
  d.querySelector('#showContractors').click();await settle();assert.equal(d.querySelectorAll('#contractorRows tr').length,1);
  assert.equal(d.querySelectorAll('#contractorRows td[data-label]').length,4);assert.equal(d.querySelectorAll('#contractorRows img, #contractorRows script').length,0);
  assert.ok(d.querySelector('#contractorRows select[aria-label]'));assert.ok(d.querySelector('#contractorRows textarea[aria-label]'));
  [...d.querySelectorAll('#contractorRows button')].find(b=>b.textContent==='History').click();await settle();assert.match(d.querySelector('#contractorRows').textContent,/<script>SYNTHETIC/);
  assert.ok(d.querySelector('link[href="/assets/admin-readiness.css"]'));assert.match(read('assets/admin-readiness.css'),/max-width: 720px/);
 }finally{dom.window.close();}
});
test('Logout clears private DOM and ignores a delayed authenticated response',async()=>{
 let release;const {dom,d}=await admin(()=>new Promise(resolve=>{release=resolve;}));
 try{d.querySelector('#showContractors').click();await settle();d.querySelector('#logout').click();release({contractors:[contractor],has_more:false});await settle();assert.equal(d.querySelector('#contractorRows').children.length,0);assert.ok(d.querySelector('#dashboard').hidden);assert.ok(!d.querySelector('#dashboard').textContent.includes('synthetic@example.invalid'));}
 finally{dom.window.close();}
});
test('Older contractor filter responses cannot overwrite the latest selection',async()=>{
 const pending=[];const {dom,w,d}=await admin(()=>new Promise(resolve=>pending.push(resolve)));
 try{d.querySelector('#showContractors').click();await settle();d.querySelector('#contractorFilter').value='suspended';d.querySelector('#contractorFilter').dispatchEvent(new w.Event('change'));await settle();pending[1]({contractors:[{...contractor,display_name:'LATEST ONLY',account_status:'suspended'}],has_more:false});await settle();pending[0]({contractors:[contractor],has_more:false});await settle();assert.match(d.querySelector('#contractorRows').textContent,/LATEST ONLY/);assert.ok(!d.querySelector('#contractorRows').textContent.includes('SYNTHETIC <img'));}
 finally{dom.window.close();}
});
test('Sensitive shell pages have explicit no-store and CDN no-store headers',()=>{
 const v=JSON.parse(read('vercel.json'));
 for(const source of ['/admin.html','/marketplace-admin.html','/contractor-portal.html']){
  const h=v.headers.find(x=>x.source===source).headers;
  for(const key of ['Cache-Control','CDN-Cache-Control','Vercel-CDN-Cache-Control'])assert.match(h.find(x=>x.key===key).value,/no-store/);
 }
});
test('Closed commercial portal shows unavailable states, avoids commercial calls and clears referral PII on logout',()=>{
 const dom=new JSDOM(read('contractor-portal.html'),{url:'http://localhost/contractor-portal.html',runScripts:'outside-only'}),w=dom.window,d=w.document,calls=[];
 try{
  w.GetEstimateFastPortal={api:async(...args)=>{calls.push(args);throw Error('No commercial call allowed');},say(){}};
  w.eval(read('assets/marketplace-portal.js'));w.eval(read('assets/contractor-ux.js'));
  w.dispatchEvent(new w.CustomEvent('gef-signed-in'));
  w.dispatchEvent(new w.CustomEvent('gef-profile',{detail:{categories:['Painting'],profile:{display_name:'SYNTHETIC ONLY',account_status:'active',base_zip:'33569',city:'Riverview',contact_phone:'8135550100',service_categories:['Painting'],service_radius_miles:25},capabilities:{marketplace_enabled:false,profile_editing_enabled:false,payments_enabled:false}}}));
  assert.match(d.querySelector('#dashboardNotice').textContent,/not open yet/);assert.match(d.querySelector('#profileAvailability').textContent,/not open yet/);
  assert.match(d.querySelector('.pro-hero h1').textContent,/Get More Local Service Leads/);
  assert.ok(d.querySelector('.pro-hero-actions a[href="#accountSettingsPanel"]'));
  assert.equal([...d.querySelectorAll('.pro-hero-actions a')].some(a=>/public profile/i.test(a.textContent)),false);
  assert.match(d.querySelector('.pro-coming').textContent,/Coming soon to your account/);
  assert.equal(d.querySelector('#workspace > h1').hidden,true);
  const legacyWorkspaceCopy=[...d.querySelectorAll('#workspace > p')].filter(p=>!p.id);assert.ok(legacyWorkspaceCopy.every(p=>p.hidden));
  for(const screen of ['opportunityPanel','myReferralsPanel','publicProfilePanel','walletPanel','purchasePanel']){
    const link=d.querySelector('.pro-navigation a[data-screen="'+screen+'"]');assert.equal(link.getAttribute('aria-disabled'),'true');assert.equal(link.dataset.coming,'true');assert.match(link.textContent,/Coming soon/);
  }
  assert.equal(d.querySelector('.pro-navigation a[data-screen="contractorDashboard"]').getAttribute('aria-disabled'),'false');
  assert.equal(d.querySelector('.pro-navigation a[data-screen="accountSettingsPanel"]').getAttribute('aria-disabled'),'false');
  const redundant=d.querySelector('#dashboardNotice');redundant.textContent='Your account is available. Marketplace, wallet access, profile publishing and payments are not open yet.';await settle();assert.equal(redundant.hidden,true);
  redundant.textContent='Unexpected marketplace error';await settle();assert.equal(redundant.hidden,false);
  assert.equal(d.querySelector('#walletBalance').textContent,'—');assert.ok(d.querySelector('#publicProfileForm button').disabled);
  d.querySelector('a[data-screen="myReferralsPanel"]').click();assert.equal(calls.length,0);
  d.querySelector('.pro-referral-cards').textContent='SYNTHETIC PRIVATE CONTACT';
  w.dispatchEvent(new w.CustomEvent('gef-signed-out'));assert.equal(d.querySelector('.pro-referral-cards').textContent,'');
 }finally{dom.window.close();}
});
test('Marketplace admin keeps authenticated session visible while Production marketplace gate is closed',async()=>{
 const dom=new JSDOM(read('marketplace-admin.html'),{url:'http://localhost/marketplace-admin.html',runScripts:'outside-only'}),w=dom.window,d=w.document;
 try{
  w.GetEstimateFastLaunch={names:['Painting']};
  w.fetch=async(url)=>{
   if(url.endsWith('/api/admin/login'))return {ok:true,status:200,json:async()=>({access_token:'synthetic-admin-token'})};
   if(url.endsWith('/api/admin/marketplace'))return {ok:false,status:503,json:async()=>({error:'This feature is not enabled for this environment.'})};
   throw Error('Unexpected request '+url);
  };
  w.eval(read('assets/marketplace-admin.js'));
  d.querySelector('#adminLogin input[name="email"]').value='admin@getestimatefast.com';
  d.querySelector('#adminLogin input[name="password"]').value='SYNTHETIC_ONLY';
  d.querySelector('#adminLogin').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));await settle();
  assert.ok(d.querySelector('#adminAuth').hidden);assert.ok(!d.querySelector('#adminWorkspace').hidden);
  assert.match(d.querySelector('#marketplaceState').textContent,/disabled in Production/);
  assert.match(d.querySelector('#adminMessage').textContent,/Signed in/);
  for(const id of ['pricingForm','termsForm','promotionForm','profilePriceForm'])for(const control of d.querySelector('#'+id).elements)assert.ok(control.disabled);
 }finally{dom.window.close();}
});
test('Customer homepage navigation and legal destinations exist; no Development ref in served UI',()=>{
 const dom=new JSDOM(read('index.html'));
 try{for(const a of dom.window.document.querySelectorAll('header a[href],footer a[href]')){
  const href=a.getAttribute('href');if(!href||href.startsWith('#')||/^(https?:|tel:|mailto:)/.test(href))continue;
  assert.ok(fs.existsSync(path.join(__dirname,'..',href.replace(/^\//,'').split(/[?#]/)[0])),'Missing local navigation target');
 }
 assert.ok(dom.window.document.querySelector('meta[name="viewport"]'));for(const p of ['privacy.html','terms.html'])assert.ok(fs.existsSync(path.join(__dirname,'..',p)));
 for(const p of ['admin.html','assets/admin.js','marketplace-admin.html','assets/marketplace-admin.js','contractor-portal.html','assets/contractor-ux.js','assets/marketplace-portal.js'])assert.doesNotMatch(read(p),/cpjsbijgijeyrwjpuciv|Development preview|isolated preview backend|Isolated development only|Private Development preview|Marketplace preview/);
 }finally{dom.window.close();}
});
