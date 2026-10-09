"use strict";
const catalog=require("../../assets/launch-categories"),{cityMatches,calculateMatch,coordinates}=require("./florida-matching");
function parseFilters(query={}){
 const page=Number(query.page??0),city=String(query.city??"").trim(),category=String(query.category??""),zip=String(query.zip??""),radius=query.radius===undefined||query.radius===null||query.radius===""?null:Number(query.radius),availability=String(query.availability||"available");
 if(!Number.isInteger(page)||page<0||page>100||city.length>80||!/^[A-Za-z .-]*$/.test(city)||(category&&!catalog.names.includes(category))||(zip&&!coordinates(zip))||(radius!==null&&(!Number.isInteger(radius)||radius<1||radius>100))||!["available","expired","all"].includes(availability))throw Error("Invalid opportunity filter");
 return {page,city,category,zip,radius,availability};
}
function matchesFilters(item,profile,filters,lookup){
 const match=calculateMatch(profile,item,lookup);
 if(!match.eligible||!cityMatches(item.city,filters.city)||(filters.category&&filters.category!==item.service_category))return false;
 if(filters.zip||filters.radius!==null){
  const extra=calculateMatch({...profile,base_zip:filters.zip||profile.base_zip,service_radius_miles:Math.min(filters.radius||profile.service_radius_miles,profile.service_radius_miles)},item,lookup);
  if(!extra.eligible)return false;
 }
 const expired=item.commercial?.reason==="expired";
 if(filters.availability==="expired"&&!expired)return false;
 if(filters.availability==="available"&&(expired||item.commercial?.reason==="buyer_limit"))return false;
 return true;
}
module.exports={parseFilters,matchesFilters};
