"use strict";
function formatOpportunityNotification(city) {
  if (typeof city !== "string" || !/^[A-Za-z][A-Za-z .-]{1,79}$/.test(city.trim())) throw Error("Invalid city");
  return "GetEstimateFast: New service opportunity near " + city.trim() + ", FL. Sign in to view details. Reply STOP to opt out.";
}
function simulate(recipients) {
  if (!Array.isArray(recipients) || recipients.length > 5) throw Error("Invalid recipient list");
  return { mode:"SIMULATION", selected_count:recipients.length,
    eligible_for_future_sms:recipients.filter(r=>r.active===true&&r.consent===true).length,
    blocked:recipients.filter(r=>r.active!==true||r.consent!==true).length,
    messages_sent:0, contacts_shared:false };
}
module.exports = {formatOpportunityNotification,simulate};
