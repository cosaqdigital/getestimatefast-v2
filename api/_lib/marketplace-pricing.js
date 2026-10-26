"use strict";
const MAX_CENTS=100000000;
function cents(value,allowZero=false){
 if(!Number.isSafeInteger(value)||value<(allowZero?0:1)||value>MAX_CENTS)throw Error("Invalid USD cents");
 return value;
}
function parseUsd(value){
 if(typeof value!=="string"||!/^\d{1,6}(\.\d{1,2})?$/.test(value.trim()))throw Error("Use a USD amount with at most two decimal places");
 const [d,f=""]=value.trim().split(".");return cents(Number(d)*100+Number(f.padEnd(2,"0")));
}
function formatUsd(value){cents(value,true);return new Intl.NumberFormat("en-US",{style:"currency",currency:"USD"}).format(value/100);}
function validateRule(rule){
 if(!rule||rule.currency!=="USD"||typeof rule.category!=="string"||!rule.category||typeof rule.version!=="string"||!rule.version)throw Error("Invalid pricing rule");
 cents(rule.base_cents);cents(rule.floor_cents);
 if(rule.floor_cents>rule.base_cents)throw Error("Price floor exceeds base price");
 if(!Number.isInteger(rule.max_buyers)||rule.max_buyers<1||rule.max_buyers>100)throw Error("Configure a buyer limit");
 if(!Number.isInteger(rule.lifetime_hours)||rule.lifetime_hours<1||rule.lifetime_hours>2160)throw Error("Invalid lifetime");
 for(const map of [rule.scope_bps||{},rule.urgency_bps||{}])for(const [key,v] of Object.entries(map)){
  if(!/^[a-z0-9_-]{1,40}$/.test(key)||!Number.isInteger(v)||v<100||v>100000)throw Error("Invalid pricing multiplier");
 }
 let previous=-1,previousDiscount=-1;
 if(!Array.isArray(rule.discounts)||rule.discounts.length>20)throw Error("Invalid discount schedule");
 for(const step of rule.discounts){
  if(!Number.isInteger(step.after_hours)||step.after_hours<0||step.after_hours>=rule.lifetime_hours||step.after_hours<=previous||!Number.isInteger(step.bps)||step.bps<0||step.bps>10000||step.bps<previousDiscount)throw Error("Invalid discount step");
  previous=step.after_hours;previousDiscount=step.bps;
 }
 return rule;
}
function roundRatio(amount,multiplier){return Number((BigInt(amount)*BigInt(multiplier)+5000n)/10000n);}
function quotePrice(rule,input,now=new Date()){
 validateRule(rule);
 if(input.category!==rule.category)throw Error("Category does not match pricing rule");
 const published=Date.parse(input.published_at),at=now.getTime();
 if(!Number.isFinite(published)||!Number.isFinite(at)||published>at)throw Error("Invalid publication time");
 const expires=published+rule.lifetime_hours*3600000;
 if(at>=expires)return {available:false,reason:"expired",currency:"USD",expires_at:new Date(expires).toISOString()};
 if(!Number.isInteger(input.buyer_count)||input.buyer_count<0)throw Error("Invalid buyer count");
 if(input.buyer_count>=rule.max_buyers)return {available:false,reason:"buyer_limit",currency:"USD"};
 const scopes=rule.scope_bps||{},urgencies=rule.urgency_bps||{};
 if(input.scope&&!Object.hasOwn(scopes,input.scope))throw Error("Scope requires pricing review");
 if(input.urgency&&!Object.hasOwn(urgencies,input.urgency))throw Error("Urgency requires pricing review");
 let amount=roundRatio(rule.base_cents,input.scope?scopes[input.scope]:10000);
 amount=roundRatio(amount,input.urgency?urgencies[input.urgency]:10000);
 let discount=0,nextChange=expires;
 for(const step of rule.discounts){const instant=published+step.after_hours*3600000;if(at>=instant)discount=step.bps;else{nextChange=Math.min(nextChange,instant);break;}}
 amount=Math.max(rule.floor_cents,roundRatio(amount,10000-discount));cents(amount);
 return {available:true,currency:"USD",amount_cents:amount,discount_bps:discount,rule_version:rule.version,max_buyers:rule.max_buyers,expires_at:new Date(expires).toISOString(),quote_valid_until:new Date(Math.min(at+300000,nextChange)).toISOString()};
}
function topupChoices(price,balance,promotions=[],now=new Date()){
 cents(price);cents(balance,true);const needed=Math.max(0,price-balance);
 const choices=[{kind:"exact",amount_cents:needed,bonus_cents:0,total_cents:needed,promotion_id:null}];
 for(const p of promotions){
  cents(p.amount_cents);cents(p.bonus_cents,true);
  if(!p.enabled||Date.parse(p.starts_at)>now.getTime()||Date.parse(p.ends_at)<=now.getTime()||!Number.isFinite(Date.parse(p.starts_at))||!Number.isFinite(Date.parse(p.ends_at)))continue;
  cents(p.amount_cents+p.bonus_cents);
  choices.push({kind:"optional_promotion",amount_cents:p.amount_cents,bonus_cents:p.bonus_cents,total_cents:p.amount_cents+p.bonus_cents,promotion_id:p.id});
 }
 return choices;
}
module.exports={cents,parseUsd,formatUsd,validateRule,quotePrice,topupChoices};
