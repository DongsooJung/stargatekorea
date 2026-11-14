// Reuse the existing analytics service; send fixed action names only.
export const conversionNames = new Set(['plan_pdf_download','planning_desk_open','budget_calculated','checklist_updated','purchase_help_open','support_answer_view','support_draft_prepared','support_email_open','route_generated','profile_preset','plan_download','plan_print','plan_saved','plan_shared','checklist_download','personal_reading_open','matched_book_open','matched_custom_open','book_view','book_sample_download','book_checkout_open','custom_guide_view','enquiry_prepared','enquiry_email_open','essential_airport','essential_connectivity','essential_stays','essential_experiences']);
const sent = new Set();
let visitor, session;
function id(storage, key) {
  let value; try {value=storage.getItem(key);}catch{}
  if(!/^[0-9a-f-]{36}$/i.test(value||'')){value=crypto.randomUUID();try{storage.setItem(key,value);}catch{}}
  return value;
}
export function conversionPayload(name, context) {
  if(!conversionNames.has(name))return null;
  return {p_event_id:context.event,p_visitor_id:context.visitor,p_session_id:context.session,p_event_type:'click',p_page_path:context.path.split(/[?#]/)[0],p_page_title:'Stargate Korea',p_element_label:name,p_element_kind:'conversion',p_target_url:null,p_device_type:context.device};
}
export function trackConversion(name) {
  if(!conversionNames.has(name)||sent.has(name)||location.hostname!=='www.stargatekorea.net'||navigator.doNotTrack==='1'||new URLSearchParams(location.search).get('preview')==='1')return;
  sent.add(name);
  if(typeof window.gtag==='function')window.gtag('event',name,{event_category:'travel'});
  try{
    visitor ||= id(localStorage,'stargateKoreaVisitorV1:visitorId');session ||= id(sessionStorage,'stargateKoreaConversionSessionV1');
    const payload=conversionPayload(name,{event:crypto.randomUUID(),visitor,session,path:location.pathname,device:innerWidth<=620?'mobile':innerWidth<=1000?'tablet':'desktop'});
    fetch('https://stargate.stargate8225.workers.dev/api/analytics/record_site_usage_event',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'omit',keepalive:true,body:JSON.stringify(payload)}).catch(()=>{});
  }catch{/* Measurement never blocks a plan or checkout. */}
}
