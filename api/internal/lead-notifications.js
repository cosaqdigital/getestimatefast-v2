"use strict";
const {createWorker}=require('../_lib/lead-notifications');
const {json,method}=require('../admin/_auth');
module.exports=async function handler(req,res){
  if(!method(req,res,['POST']))return;
  try {return json(res,200,await createWorker()(req.headers?.authorization));}
  catch {return json(res,503,{error:'Notification worker unavailable'});}
};
