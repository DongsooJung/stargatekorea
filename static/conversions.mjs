// Reuse the existing analytics service; send fixed action names only.
export const conversionNames = new Set(['route_edited','calendar_download','month_guide_open','plan_pdf_download','planning_desk_open','budget_calculated','checklist_updated','purchase_help_open','support_answer_view','support_draft_prepared','support_email_open','route_generated','profile_preset','plan_download','plan_print','plan_saved','plan_shared','checklist_download','personal_reading_open','matched_book_open','matched_custom_open','book_view','book_sample_download','book_checkout_open','custom_guide_view','enquiry_prepared','enquiry_email_open','essential_airport','essential_connectivity','essential_stays','essential_experiences','page_plan_open','page_book_open','page_custom_open','month_guide_open','weekly_roundup_open','weekly_archive_open']);
const sent = new Set();
let visitor, session;
const endpoint = 'https://stargate.stargate8225.workers.dev/api/analytics/record_site_usage_event';
const liveHost = 'www.stargatekorea.net';
function id(storage, key) {
  let value; try {value=storage.getItem(key);}catch{}
  if(!/^[0-9a-f-]{36}$/i.test(value||'')){value=crypto.randomUUID();try{storage.setItem(key,value);}catch{}}
  return value;
}
function measurable() {
  return location.hostname===liveHost && navigator.doNotTrack!=='1' && new URLSearchParams(location.search).get('preview')!=='1';
}
function device() {
  return innerWidth<=620?'mobile':innerWidth<=1000?'tablet':'desktop';
}
// The analytics service rejects query strings and fragments, so keep the bare path.
function pathOnly(value) {
  return String(value||'/').split(/[?#]/)[0] || '/';
}
// Same-origin links stay relative; external links keep origin and path. Nothing else is sent.
export function linkTarget(link) {
  if(!link) return null;
  const raw = (link.getAttribute?.('href')||'').trim();
  if(!raw || raw.startsWith('#')) return null;
  let url; try {url=new URL(link.href, location.href);}catch {return null;}
  if(!['http:','https:'].includes(url.protocol)) return null;
  return url.origin===location.origin ? url.pathname : `${url.origin}${url.pathname}`;
}
export function conversionPayload(name, context) {
  if(!conversionNames.has(name))return null;
  return {p_event_id:context.event,p_visitor_id:context.visitor,p_session_id:context.session,p_event_type:'click',p_page_path:pathOnly(context.path),p_page_title:'Stargate Korea',p_element_label:name,p_element_kind:'conversion',p_target_url:context.target??null,p_device_type:context.device};
}
export function pageViewPayload(context) {
  return {p_event_id:context.event,p_visitor_id:context.visitor,p_session_id:context.session,p_event_type:'page_view',p_page_path:pathOnly(context.path),p_page_title:context.title,p_element_label:'page_view',p_element_kind:'page',p_target_url:null,p_device_type:context.device};
}
function send(payload) {
  fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},credentials:'omit',keepalive:true,body:JSON.stringify(payload)}).catch(()=>{});
}
export function trackConversion(name, link) {
  if(!conversionNames.has(name)||sent.has(name)||!measurable())return;
  sent.add(name);
  if(typeof window.gtag==='function')window.gtag('event',name,{event_category:'travel'});
  try{
    visitor ||= id(localStorage,'stargateKoreaVisitorV1:visitorId');session ||= id(sessionStorage,'stargateKoreaConversionSessionV1');
    const payload=conversionPayload(name,{event:crypto.randomUUID(),visitor,session,path:location.pathname,device:device(),target:linkTarget(link)});
    send(payload);
  }catch{/* Measurement never blocks a plan or checkout. */}
}
// One page view per page load. The visitor id is shared with the visitor counter, so the
// daily visitor total still counts each browser once per day.
export function trackPageView() {
  if(sent.has('page_view')||!measurable())return;
  sent.add('page_view');
  try{
    visitor ||= id(localStorage,'stargateKoreaVisitorV1:visitorId');session ||= id(sessionStorage,'stargateKoreaConversionSessionV1');
    const payload=pageViewPayload({event:crypto.randomUUID(),visitor,session,path:location.pathname,title:(document.title||'Stargate Korea').slice(0,200),device:device()});
    send(payload);
  }catch{/* Measurement never blocks reading a page. */}
}
