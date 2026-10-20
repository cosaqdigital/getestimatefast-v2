'use strict';
// Test preload only. Mocks may replace fetch; the default transport cannot
// contact Supabase, Resend, Stripe or other external HTTP endpoints.
const nativeFetch=global.fetch;
global.fetch=(input,options)=>{
  let url;
  try {url=new URL(typeof input==='string'||input instanceof URL?input:input.url);}
  catch {return Promise.reject(Error('OFFLINE_FETCH_BLOCKED'));}
  if(!['127.0.0.1','localhost','[::1]'].includes(url.hostname))return Promise.reject(Error('OFFLINE_FETCH_BLOCKED'));
  return nativeFetch(input,options);
};
