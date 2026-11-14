import { initPlanningDesk, initBookSupport } from './journey.js';
import { personalizeTrip, profileOptions, defaults, normalizeProfile, profileFromQuery, profileQuery, planAsText } from './personalization.mjs';
import { trackConversion as track } from './conversions.mjs';

const planner=document.getElementById('trip-planner'),savedKey='stargateKoreaSavedPlanV1';
const element=(tag,text,className='')=>{const item=document.createElement(tag);item.textContent=text;item.className=className;return item;};
const choicesFrom=form=>normalizeProfile(Object.fromEntries(Object.keys(defaults).map(key=>[key,form.elements[key]?.value])));
const applyChoices=(form,profile)=>Object.entries(profile).forEach(([key,value])=>{if(form.elements[key])form.elements[key].value=value;});
let activeTrip=personalizeTrip();

function renderTrip(trip){
  activeTrip=trip;
  document.getElementById('plan-caption').textContent=trip.summary;
  document.getElementById('profile-caption').textContent=trip.label;
  const context=document.getElementById('plan-context');context.replaceChildren();
  const panel=element('div','','plan-context'),why=element('div','');
  why.append(element('p','Chosen for your trip','eyebrow'),element('h3','A little planning, around you.'));
  const whyList=element('ul','');trip.why.forEach(note=>whyList.append(element('li',note)));why.append(whyList);
  const resources=element('div','','personal-reading');resources.append(element('p','Read next','eyebrow'));
  trip.resources.forEach(resource=>{const link=element('a','');link.href=resource.href;link.dataset.conversion='personal_reading_open';link.append(element('strong',resource.title+' →'),element('span',resource.reason));resources.append(link);});
  panel.append(why,resources);context.append(panel);
  const list=document.getElementById('route-list');list.replaceChildren();
  for(const day of trip.days){
    const li=element('li','','route-day'),number=element('span',String(day.number).padStart(2,'0'),'day-number'),content=element('div','');
    content.append(element('p',day.area,'route-area'),element('h3',day.title),element('p',day.route,'route-stops'),element('p',day.detail));
    const map=element('a','Check the starting point on a map ↗','route-map');map.href=day.map;map.target='_blank';map.rel='noopener';content.append(map);
    const details=element('details','');details.append(element('summary','Weather & planning note'),element('p',day.alternative));content.append(details);li.append(number,content);list.append(li);
  }
  const customUrl='/custom-guide/?'+profileQuery(trip.profile),offer=document.getElementById('matched-offer');offer.dataset.offer=trip.offer.kind;
  offer.querySelector('h3').textContent=trip.offer.title;offer.querySelector('[data-offer-reason]').textContent=trip.offer.reason;
  const primary=offer.querySelector('[data-offer-primary]'),secondary=offer.querySelector('[data-offer-secondary]');
  primary.href=trip.offer.kind==='custom'?customUrl:'/books/?'+profileQuery(trip.profile);
  primary.textContent=trip.offer.kind==='custom'?'Ask for a custom brief quote →':'See the '+primary.dataset.bookPrice+' PDF & sample →';
  primary.dataset.conversion=trip.offer.kind==='custom'?'matched_custom_open':'matched_book_open';
  secondary.href=trip.offer.kind==='custom'?'/books/':customUrl;
  secondary.textContent=trip.offer.kind==='custom'?'Prefer a fixed-price guide? →':'Need research around specific needs? →';
  secondary.dataset.conversion=trip.offer.kind==='custom'?'book_view':'custom_guide_view';
  document.getElementById('personalize-link').href=customUrl;
  document.getElementById('compare-guide-link').href='/books/?'+profileQuery(trip.profile)+'#guide-options';
  document.dispatchEvent(new CustomEvent('seoul-plan-update',{detail:trip}));
}

if(planner){
  const status=document.getElementById('planner-status'),toolStatus=document.getElementById('plan-tool-status');
  let remembered=false;try{remembered=Boolean(localStorage.getItem(savedKey));}catch{}
  document.getElementById('forget-plan').hidden=!remembered;
  const params=new URLSearchParams(location.search);let initial=defaults;
  if(Object.keys(defaults).some(key=>params.has(key)))initial=profileFromQuery(location.search);
  else if(remembered){try{initial=normalizeProfile(JSON.parse(localStorage.getItem(savedKey)));}catch{initial=defaults;}}
  applyChoices(planner,initial);renderTrip(personalizeTrip(initial));
  planner.addEventListener('submit',event=>{
    event.preventDefault();renderTrip(personalizeTrip(choicesFrom(planner)));
    status.textContent='Your '+activeTrip.count+'-day plan is ready. '+(activeTrip.profile.party==='family'?'Family days keep at most two core stops.':'Your choices have been applied.');
    toolStatus.textContent='';track('route_generated');
  });
  const presets={solo:{party:'solo',interest:'culture',pace:'balanced'},couple:{party:'couple',interest:'design',pace:'slow'},family:{party:'family',interest:'mixed',pace:'slow'},friends:{party:'friends',interest:'food',pace:'balanced'}};
  document.querySelectorAll('[data-profile]').forEach(button=>button.addEventListener('click',()=>{applyChoices(planner,{...choicesFrom(planner),...presets[button.dataset.profile]});planner.requestSubmit();track('profile_preset');}));
  document.getElementById('download-plan').addEventListener('click',()=>{
    const blob=new Blob([planAsText(activeTrip)],{type:'text/markdown;charset=utf-8'}),url=URL.createObjectURL(blob),link=element('a','');
    link.href=url;link.download='seoul-'+activeTrip.count+'-day-'+activeTrip.profile.interest+'-plan.md';document.body.append(link);link.click();link.remove();
    setTimeout(()=>URL.revokeObjectURL(url),30000);toolStatus.textContent='Your free plan was prepared for download. Keep the current venue checks with it.';track('plan_download');
  });
  document.getElementById('print-plan').addEventListener('click',()=>{track('plan_print');window.print();});
  document.getElementById('save-plan').addEventListener('click',()=>{
    try{localStorage.setItem(savedKey,JSON.stringify(activeTrip.profile));document.getElementById('forget-plan').hidden=false;toolStatus.textContent='Saved on this device. Use “Forget saved plan” to remove these choices.';track('plan_saved');}
    catch{toolStatus.textContent='Device storage is unavailable. Download your plan or copy its link instead.';}
  });
  document.getElementById('forget-plan').addEventListener('click',()=>{try{localStorage.removeItem(savedKey);}catch{}document.getElementById('forget-plan').hidden=true;toolStatus.textContent='The saved choices were removed from this device.';});
  document.getElementById('share-plan').addEventListener('click',async()=>{
    const url=location.origin+'/?'+profileQuery(activeTrip.profile)+'#plan';
    try{await navigator.clipboard.writeText(url);toolStatus.textContent='Plan link copied. The link contains the selected travel preferences.';track('plan_shared');}
    catch{toolStatus.replaceChildren(element('span','Copy this plan link: '));const field=element('input','');field.value=url;field.readOnly=true;field.setAttribute('aria-label','Link to your plan');toolStatus.append(field);field.select();}
  });
  initPlanningDesk(activeTrip);
}

const enquiry=document.getElementById('guide-enquiry');
if(enquiry){
  applyChoices(enquiry,profileFromQuery(location.search));
  enquiry.addEventListener('submit',event=>{
    event.preventDefault();const profile=choicesFrom(enquiry),trip=personalizeTrip(profile);
    const labels={days:'Days in Seoul',party:'Travel group',interest:'Main interest',pace:'Pace',budget:'Spending style',season:'Season'};
    const message=['Hello Stargate Korea,','','I would like a quote for a custom digital Seoul travel brief.','',...Object.entries(profile).map(([key,value])=>labels[key]+': '+profileOptions[key][value]),
      'Travel month: '+(enquiry.elements.month.value||'To be confirmed'),'Particular requests: '+(enquiry.elements.notes.value.trim()||'None added'),'','My free starting outline:',...trip.days.map(day=>'Day '+day.number+': '+day.route),'',
      'Please confirm the scope, total fee, delivery date, revisions and cancellation/refund terms before I order.',
      'I understand that this enquiry is for a digital information document, not travel bookings or an in-person tour.'].join('\n');
    document.getElementById('enquiry-text').value=message;
    document.getElementById('enquiry-email').href='mailto:ceo@stargateedu.co.kr?subject='+encodeURIComponent('Custom digital Seoul guide enquiry')+'&body='+encodeURIComponent(message);
    document.getElementById('enquiry-preview').hidden=false;document.getElementById('copy-status').textContent='';track('enquiry_prepared');
  });
  document.getElementById('copy-enquiry').addEventListener('click',async()=>{
    const text=document.getElementById('enquiry-text'),status=document.getElementById('copy-status');
    try{await navigator.clipboard.writeText(text.value);status.textContent='Copied. Paste into your email app and send it when ready.';}
    catch{text.focus();text.select();status.textContent='The draft is selected. Use your device’s Copy command.';}
  });
}
const bookFit=document.getElementById('book-fit');
if(bookFit&&Object.keys(defaults).some(key=>new URLSearchParams(location.search).has(key))){
  const trip=personalizeTrip(profileFromQuery(location.search));bookFit.hidden=false;
  bookFit.querySelector('p').textContent=trip.offer.kind==='custom'
    ? 'Your profile includes needs that may call for extra research. This PDF is a standard edition. Read the sample before choosing it, or ask for a separate custom brief quote.'
    : 'This standard 1–5 day English guide is a useful match for your starting plan. Preview the sample, then decide whether offline checklists and worksheets would help your trip.';
  bookFit.querySelector('a').href='/custom-guide/?'+profileQuery(trip.profile);
}
document.addEventListener('click',event=>{const link=event.target.closest?.('[data-conversion]');if(link)track(link.dataset.conversion);});

initBookSupport();

if(Object.keys(defaults).some(key=>new URLSearchParams(location.search).has(key))){
  const profile=profileFromQuery(location.search);
  document.querySelectorAll('a[data-carry-profile]').forEach(link=>{const url=new URL(link.getAttribute('href'),location.origin);if(url.origin!==location.origin)return;for(const [key,value]of Object.entries(profile))url.searchParams.set(key,value);link.href=url.pathname+url.search+url.hash;});
}
