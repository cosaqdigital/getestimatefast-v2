"use strict";
const {json,method,requireAdmin,readJson}=require('./_auth');
const {client,signedAttachment,recoverBatch}=require('../_lib/lead-attachments');
function createHandler({getClient=client,authenticate=requireAdmin,readBody=readJson}={}) {return async function(req,res) {
  if(!method(req,res,['POST']))return;
  try {
    // Target gate before Auth, including Preview: never follow a production config.
    const db=getClient();
    if(!await authenticate(req,res))return;
    const body=await readBody(req,1024);
    if(body.action==='list') {
      if(!/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(body.leadId))return json(res,400,{error:'Invalid lead'});
      const {data,error}=await db.rpc('gef_list_lead_attachments',{p_lead:body.leadId}).retry(false);
      if(error)throw Error('UNAVAILABLE');
      return json(res,200,{attachments:data});
    }
    if(body.action==='pending') {
      const {data,error}=await db.rpc('gef_pending_attachment_cleanup').retry(false);
      if(error)throw Error('UNAVAILABLE');
      return json(res,200,{batches:data});
    }
    if(body.action==='sign')return json(res,200,await signedAttachment(body.leadId,body.attachmentId,db));
    if(body.action==='recover') {await recoverBatch(body.batchId,db);return json(res,200,{recovered:true});}
    return json(res,400,{error:'Invalid action'});
  }catch{return json(res,503,{error:'Attachment operation unavailable'});}
};}
module.exports=createHandler();
module.exports.createHandler=createHandler;
