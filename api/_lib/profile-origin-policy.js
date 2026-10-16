"use strict";
// Public profile request acceptance for the independent US Development preview.
const catalog=require("../../assets/launch-categories");
const {normalizeUsPhone}=require("./zenvia-us-provider");
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SLUG=/^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const EMAIL=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;
function field(value,max){
 if(typeof value!=="string"||value.length>max*2)throw Error("Please check the information in your request.");
 const s=value.trim();if(s.length>max)return null;return s;
}
function prepareProfileRequest(input){
 if(!input||typeof input!=="object"||Array.isArray(input))throw Error("Invalid request.");
 if(input.website||input.company||input.gef_hp_trap_47b)throw Error("Request could not be accepted.");
 const slug=field(input.profileSlug,80),token=field(input.submissionToken,36);
 const service=field(input.service,120),name=field(input.fullName,120);
 const email=field(input.email,254)?.toLowerCase(),phone=field(input.phone,35);
 const city=field(input.city,80),zip=field(input.zipCode,5);
 const description=field(input.description,2000),contact=field(input.contactMethod,10);
 const usPhone=phone?normalizeUsPhone(phone):null;
 if(!slug||!SLUG.test(slug)||!token||!UUID.test(token)||!catalog.names.includes(service)||
   !name||name.length<2||!email||!EMAIL.test(email)||!usPhone||
   !city||!/^[A-Za-z][A-Za-z .-]{1,79}$/.test(city)||
   !zip||!/^(32|33|34)[0-9]{3}$/.test(zip)||
   !description||description.length<20||!["email","phone"].includes(contact)){
   throw Error("Please complete the service, project details and valid Florida contact information.");
 }
 if(input.marketplaceConsent!==true||input.contactConsent!==true||input.privacyConsent!==true)
   throw Error("Please confirm how your request will be shared and how professionals may contact you.");
 return Object.freeze({
  p_slug:slug,p_token:token,p_service:service,p_full_name:name,p_email:email,
  p_phone:"+"+usPhone,p_city:city,p_zip:zip,p_description:description,
  p_contact_method:contact,p_marketplace_consent:true
 });
}
function publicProfileRequestPath(slug){
 if(typeof slug!=="string"||!SLUG.test(slug)||slug.length>80)throw Error("Invalid profile URL");
 return "/request-estimate.html?profile="+encodeURIComponent(slug);
}
module.exports={prepareProfileRequest,publicProfileRequestPath};
