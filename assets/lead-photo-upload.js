(()=>{"use strict";
const MAX_COUNT=5,MAX_SIZE=5*1024*1024,ALLOWED=new Set(["image/jpeg","image/png","image/webp"]);
function fileInputs(form){return [...form.querySelectorAll('input[type="file"]')].filter(input=>input.files&&input.files[0]);}
function hidden(form,name,value){
  let input=[...form.elements].find(el=>el.name===name);
  if(!input){input=document.createElement("input");input.type="hidden";input.name=name;form.append(input);}
  input.value=value;
}
async function prepare(form){
  const inputs=fileInputs(form);
  if(!inputs.length){hidden(form,"Project Photo Count","0");return [];}
  if(inputs.length>MAX_COUNT)throw Error("You can upload up to 5 project photos.");
  const files=inputs.map(input=>input.files[0]);
  for(const file of files){
    if(!ALLOWED.has(String(file.type||"").toLowerCase()))throw Error("Project photos must be JPG, PNG or WebP.");
    if(!file.size||file.size>MAX_SIZE)throw Error("Each project photo must be 5 MB or smaller.");
  }
  const token=form.querySelector('input[name="Submission Token"]')?.value||"";
  if(!token)throw Error("Reload the form before uploading photos.");
  const prep=await fetch("/api/lead-photo-upload",{method:"POST",cache:"no-store",credentials:"same-origin",headers:{"Content-Type":"application/json"},body:JSON.stringify({submission_token:token,files:files.map(file=>({type:file.type,size:file.size}))})});
  const payload=await prep.json().catch(()=>({}));
  if(!prep.ok||!Array.isArray(payload.uploads)||payload.uploads.length!==files.length)throw Error(payload.error||"We couldn't prepare your project photos.");
  for(let i=0;i<files.length;i++){
    const formData=new FormData();
    formData.append("cacheControl","3600");
    formData.append("",files[i]);
    const uploaded=await fetch(payload.uploads[i].signed_url,{method:"PUT",headers:{"x-upsert":"false"},body:formData});
    if(!uploaded.ok)throw Error("One of your project photos could not be uploaded. Please try again.");
  }
  const paths=payload.uploads.map(item=>item.path);
  hidden(form,"Project Photo Paths",JSON.stringify(paths));
  hidden(form,"Project Photo Count",String(paths.length));
  inputs.forEach(input=>{input.disabled=true;});
  return paths;
}
window.GetEstimateFastLeadPhotos={prepare,MAX_COUNT,MAX_SIZE};
})();