"use strict";
const crypto=require("node:crypto");
const catalog=require("../../assets/launch-categories");
const {normalizeUsPhone}=require("./zenvia-us-provider");
function text(v,min,max){if(typeof v!=="string"||v.trim().length<min||v.trim().length>max)throw Error("Invalid text field");return v.trim();}
function httpsUrl(v){if(!v)return null;const u=new URL(text(v,8,500));if(u.protocol!=="https:"||u.username||u.password)throw Error("Use a public HTTPS link");return u.href;}
function parsePublicProfile(v){
 if(!v||typeof v!=="object"||Array.isArray(v))throw Error("Invalid profile");
 const slug=text(v.slug,3,80);if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug))throw Error("Use lowercase letters, numbers and hyphens for your link");
 if(typeof v.published!=="boolean"||typeof v.publish_email!=="boolean"||typeof v.publish_phone!=="boolean")throw Error("Choose profile privacy settings");
 const categories=v.categories,languages=v.languages;
 if(!Array.isArray(categories)||!categories.length||categories.length>12||new Set(categories).size!==categories.length||!categories.every(c=>catalog.names.includes(c)))throw Error("Choose existing service categories");
 if(!Array.isArray(languages)||languages.length>10||new Set(languages).size!==languages.length||!languages.every(l=>typeof l==="string"&&/^[A-Za-z][A-Za-z -]{1,35}$/.test(l)))throw Error("Invalid languages");
 const zip=text(v.zip_code,5,5);if(!/^\d{5}$/.test(zip))throw Error("Invalid ZIP Code");
 const state=text(v.state_code,2,2).toUpperCase();if(state!=="FL"||!require("./florida-matching").coordinates(zip))throw Error("Choose a recognized Florida ZIP Code");
 if(!Number.isInteger(v.radius_miles)||v.radius_miles<1||v.radius_miles>100)throw Error("Choose a radius from 1 to 100 miles");
 const portfolio=v.portfolio||[];
 if(!Array.isArray(portfolio)||portfolio.length>12)throw Error("At most 12 portfolio items");
 const social=v.social_links||[];
 if(!Array.isArray(social)||social.length>6)throw Error("At most six social links");
 const clean={slug,display_name:text(v.display_name,2,150),headline:text(v.headline||"",0,180),about:text(v.about||"",0,2000),city:text(v.city,2,80),state_code:state,zip_code:zip,radius_miles:v.radius_miles,categories,languages,published:v.published,publish_email:v.publish_email,publish_phone:v.publish_phone,social_links:social.map(httpsUrl),portfolio:portfolio.map(p=>{
  const path=text(p.image_path,1,200);if(!/^[0-9a-f-]{36}\/[0-9a-f-]{36}\.(jpg|png|webp)$/.test(path))throw Error("Upload the portfolio image first");
  return {title:text(p.title,2,120),description:text(p.description||"",0,600),image_path:path};
 })};
 // Contacts are explicit public copies, never implicitly taken from private registration.
 clean.public_email=v.publish_email?text(v.public_email,5,254):null;
 if(clean.public_email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean.public_email))throw Error("Invalid public email");
 const normalized=v.publish_phone?normalizeUsPhone(v.public_phone):null;
 if(v.publish_phone&&!normalized)throw Error("Invalid public US phone");
 clean.public_phone=normalized?"+"+normalized:null;
 return clean;
}
function tokenHash(value){if(typeof value!=="string"||!/^[A-Za-z0-9_-]{43}$/.test(value))throw Error("Invalid review invitation");return crypto.createHash("sha256").update(value).digest("hex");}
function identityHash(email,secret){if(typeof secret!=="string"||secret.length<32)throw Error("Review identity secret not configured");return crypto.createHmac("sha256",secret).update(text(email,5,254).toLowerCase()).digest("hex");}
function parseReview(v,secret){
 if(!v||!Number.isInteger(v.rating)||v.rating<1||v.rating>5||v.consent!==true||v.website)throw Error("Please complete a valid review and consent");
 const email=text(v.email,5,254);if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw Error("Invalid email");
 return {token_hash:tokenHash(v.token),identity_hash:identityHash(email,secret),display_name:text(v.display_name,2,80),rating:v.rating,comment:text(v.comment,10,1500)};
}
function publicProjection(row){
 if(!row||row.published!==true)return null;
 return Object.fromEntries(["slug","display_name","headline","about","city","state_code","zip_code","radius_miles","categories","languages","social_links","portfolio"].map(k=>[k,row[k]]).concat([["public_email",row.publish_email===true?row.public_email:null],["public_phone",row.publish_phone===true?row.public_phone:null]]));
}
module.exports={text,httpsUrl,parsePublicProfile,tokenHash,identityHash,parseReview,publicProjection};
