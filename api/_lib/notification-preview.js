"use strict";
const {formatTelnyxOpportunityNotice}=require("./telnyx-us-provider");
function formatOpportunityNotification(city,opportunityId) {
  return formatTelnyxOpportunityNotice({city,opportunityId});
}
function simulate(recipients) {
  if (!Array.isArray(recipients) || recipients.length > 5) throw Error("Invalid recipient list");
  return { mode:"SIMULATION", selected_count:recipients.length,
    eligible_for_future_sms:recipients.filter(r=>r.active===true&&r.consent===true).length,
    blocked:recipients.filter(r=>r.active!==true||r.consent!==true).length,
    messages_sent:0, contacts_shared:false };
}
module.exports = {formatOpportunityNotification,simulate};
