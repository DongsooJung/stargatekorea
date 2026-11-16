import { tripPreferences } from './personalization.mjs?v=20261116-editor1';
import { createTripCalendar, normalizeStartDate, monthReading } from './trip-calendar.mjs?v=20261116-editor1';
import { tripChecklist, normalizeWorkspace, calculateBudget, krw, supportAdvice } from './planning-tools.mjs?v=20261116-editor1';
import { createPlanPdf } from './plan-pdf.mjs?v=20261116-editor1';
import { trackConversion as track } from './conversions.mjs?v=20261116-editor1';

const workspaceKey='stargateKoreaWorkspaceV1', profileKey='stargateKoreaSavedPlanV1';
const node=(tag,text,className='')=>{const e=document.createElement(tag);e.textContent=text;e.className=className;return e;};

export function initPlanningDesk(initialTrip,{makePdf=createPlanPdf}={}) {
  const form=document.getElementById('budget-calculator');if(!form)return;
  let trip=initialTrip, saved=false, previousDays=trip.count, nightsEdited=false, state=normalizeWorkspace({},trip.profile);
  try{saved=Boolean(localStorage.getItem(profileKey));if(saved)state=normalizeWorkspace(JSON.parse(localStorage.getItem(workspaceKey)),trip.profile);}catch{}
  const status=document.getElementById('plan-tool-status'), result=document.getElementById('budget-result'), pdfButton=document.getElementById('download-pdf');
  const announcePdf=message=>{status.textContent=message;document.getElementById('pdf-download-status').textContent=message;};
  const readBudget=()=>Object.fromEntries(new FormData(form));
  const persist=()=>{if(saved)try{localStorage.setItem(profileKey,JSON.stringify(tripPreferences(trip)));localStorage.setItem(workspaceKey,JSON.stringify(state));}catch{status.textContent='Device storage is full or unavailable. Your PDF can still keep this plan.';}};
  function updateEstimate(){
    state.budget=calculateBudget(readBudget(),trip.count).values;
    if(!form.checkValidity()){result.textContent='Use whole numbers within the limits shown. Amounts must be zero or above, with at least one traveler.';return;}
    const estimate=calculateBudget(state.budget,trip.count);result.replaceChildren();
    if(!estimate.hasValues){result.textContent='Add your figures to see the group and per-person totals.';return;}
    result.append(node('p',`Your ${trip.count}-day group estimate`,'eyebrow'),node('strong',krw(estimate.total),'budget-total'),node('p',krw(estimate.perPerson)+' per person · '+estimate.values.people+' people','small'));
    const list=node('dl','','budget-breakdown');for(const row of estimate.rows){list.append(node('dt',row.label),node('dd',krw(row.value)));}result.append(list);
  }
  function updateProgress(){const tasks=tripChecklist(trip.profile);document.getElementById('checklist-progress').textContent=state.completed.length+' of '+tasks.length+' checks done';}
  function renderChecklist(){
    const list=document.getElementById('trip-checklist');list.replaceChildren();
    for(const task of tripChecklist(trip.profile)){
      const box=node('div','','checklist-item'),label=node('label',''),input=node('input',''),title=node('span',task.title),note=node('p',task.note+' '),link=node('a','Check →');
      input.type='checkbox';input.dataset.task=task.id;input.checked=state.completed.includes(task.id);link.href=task.href;
      input.addEventListener('change',()=>{state.completed=[...list.querySelectorAll('input:checked')].map(i=>i.dataset.task);updateProgress();persist();track('checklist_updated');});
      note.append(link);label.append(input,title);box.append(label,note);list.append(box);
    }updateProgress();
  }
  const calendar=document.getElementById('trip-calendar'),startInput=document.getElementById('trip-start-date'),calendarStatus=document.getElementById('calendar-status');
  function syncCalendar(){startInput.value=state.startDate;const reading=monthReading(state.startDate),link=document.getElementById('month-guide-link');link.hidden=!reading;if(reading){link.textContent=reading.title;link.href=reading.href;link.dataset.conversion='month_guide_open';}}
  startInput.addEventListener('change',()=>{state.startDate=normalizeStartDate(startInput.value);syncCalendar();persist();calendarStatus.textContent=state.startDate?'Date ready. The calendar will use your current neighborhood order.':'';});
  calendar.addEventListener('submit',event=>{event.preventDefault();if(!calendar.reportValidity())return;const date=normalizeStartDate(startInput.value);if(!date){calendarStatus.textContent='Choose a valid first sightseeing date.';return;}state.startDate=date;syncCalendar();persist();
    const blob=new Blob([createTripCalendar(trip,date)],{type:'text/calendar;charset=utf-8'}),url=URL.createObjectURL(blob),a=node('a','');a.href=url;a.download='seoul-'+trip.count+'-day-'+date+'.ics';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);calendarStatus.textContent='Calendar file prepared. Import it in your calendar app; no calendar account was accessed.';track('calendar_download');});
  document.querySelectorAll('a[href="#planning-desk"],a[href="#calendar-tools"]').forEach(link=>link.addEventListener('click',()=>{document.getElementById('planning-desk').open=true;}));
  function fillBudget(){for(const [key,value]of Object.entries(state.budget))form.elements[key].value=['people','nights'].includes(key)||value?value:'';updateEstimate();}
  fillBudget();renderChecklist();syncCalendar();
  form.addEventListener('input',event=>{if(event.target.name==='nights')nightsEdited=true;updateEstimate();persist();});
  form.addEventListener('submit',event=>{event.preventDefault();if(form.reportValidity()){updateEstimate();persist();track('budget_calculated');}});
  document.getElementById('planning-desk').addEventListener('toggle',event=>{if(event.target.open)track('planning_desk_open');});
  document.addEventListener('seoul-plan-update',event=>{
    const next=event.detail;
    if(!nightsEdited&&state.budget.nights===previousDays-1)state.budget.nights=Math.max(0,next.count-1);
    trip=next;previousDays=trip.count;state=normalizeWorkspace(state,trip.profile);fillBudget();renderChecklist();syncCalendar();persist();
  });
  document.getElementById('save-plan').addEventListener('click',()=>{try{saved=Boolean(localStorage.getItem(profileKey));persist();if(saved)status.textContent='Plan, checklist and budget saved on this device. “Forget saved plan” removes the saved copy.';}catch{}});
  document.getElementById('forget-plan').addEventListener('click',()=>{saved=false;try{localStorage.removeItem(workspaceKey);}catch{}});
  document.getElementById('reset-workspace').addEventListener('click',()=>{state=normalizeWorkspace({},trip.profile);nightsEdited=false;fillBudget();renderChecklist();syncCalendar();persist();calendarStatus.textContent='';status.textContent='Checklist, budget and calendar date cleared. Your chosen trip preferences stay as selected.';});
  pdfButton.addEventListener('click',async()=>{
    if(!form.reportValidity())return;
    const exportTrip=trip,exportState=normalizeWorkspace(state,trip.profile);
    pdfButton.disabled=true;pdfButton.setAttribute('aria-busy','true');announcePdf('Preparing your free PDF with the current itinerary, checklist and estimates…');
    try{
      let image;try{const response=await fetch('/images/seoul-palace.jpg');if(response.ok)image=new Uint8Array(await response.arrayBuffer());}catch{}
      const bytes=await makePdf(exportTrip,exportState,undefined,image),blob=new Blob([bytes],{type:'application/pdf'}),url=URL.createObjectURL(blob),a=node('a','');
      a.href=url;a.download='my-seoul-'+exportTrip.count+'-day-plan.pdf';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);
      announcePdf('Your free PDF is ready for download, including your current checklist and estimate. No email or payment is needed.');track('plan_pdf_download');
    }catch{announcePdf('The PDF could not be prepared in this browser. Use “Print / save as PDF” or download the text outline below.');}
    finally{pdfButton.disabled=false;pdfButton.removeAttribute('aria-busy');}
  });
}

export function initBookSupport(){
  const form=document.getElementById('book-support');if(!form)return;
  const answer=document.getElementById('support-answer');
  function renderAnswer(){const advice=supportAdvice(form.elements.kind.value),list=node('ol','');answer.replaceChildren(node('h3',advice.title));advice.steps.forEach(step=>list.append(node('li',step)));answer.append(list);}
  form.elements.kind.addEventListener('change',()=>{renderAnswer();document.getElementById('support-preview').hidden=true;track('support_answer_view');});renderAnswer();
  form.addEventListener('submit',event=>{
    event.preventDefault();const advice=supportAdvice(form.elements.kind.value);
    const text=['Hello Stargate Korea,','','I need help with the Seoul, at your own pace English PDF.','Situation: '+advice.title,'Order reference: '+(form.elements.order.value.trim()||'Not available / before ordering'),'','Issue: '+(form.elements.notes.value.trim()||'Please help me understand the next step.'),'','Please check the order or file issue and advise me. I have not included payment details or identity documents.'].join('\n');
    document.getElementById('support-text').value=text;document.getElementById('support-email').href='mailto:ceo@stargateedu.co.kr?subject='+encodeURIComponent('Seoul PDF - '+advice.title)+'&body='+encodeURIComponent(text);
    document.getElementById('support-preview').hidden=false;document.getElementById('support-copy-status').textContent='';track('support_draft_prepared');
  });
  document.getElementById('copy-support').addEventListener('click',async()=>{
    const text=document.getElementById('support-text'),status=document.getElementById('support-copy-status');try{await navigator.clipboard.writeText(text.value);status.textContent='Copied. Paste it into your email app and send when ready.';}catch{text.focus();text.select();status.textContent='Draft selected. Use your device’s Copy command.';}
  });
}
