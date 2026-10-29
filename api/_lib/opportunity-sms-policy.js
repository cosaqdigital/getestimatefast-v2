"use strict";
const {normalizeUsPhone}=require("./telnyx-us-provider");

function opportunitySmsEligibility(profile){
  if(!profile||profile.account_status!=="active"||!profile.email_verified_at){
    return {eligible:false,status:"BLOCKED_INACTIVE",phone:null};
  }
  if(profile.sms_opt_in!==true||!profile.sms_opt_in_at||profile.sms_opt_out_at){
    return {eligible:false,status:"BLOCKED_NO_CONSENT",phone:null};
  }
  const phone=normalizeUsPhone(profile.sms_phone_e164||"");
  if(!phone)return {eligible:false,status:"BLOCKED_INVALID_PHONE",phone:null};
  return {eligible:true,status:"QUEUED",phone};
}

module.exports={opportunitySmsEligibility};
