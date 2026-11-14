import test, { before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { JSDOM } from 'jsdom';
import * as pdfLib from 'pdf-lib';
import { build } from '../build.mjs';
import { personalizeTrip } from '../static/personalization.mjs';
import { initPlanningDesk } from '../static/journey.js';
import { createPlanPdf } from '../static/plan-pdf.mjs';

before(()=>build());
let caseId=0;
function setup(t,page,url){
  const html=fs.readFileSync(new URL('../dist/'+page,import.meta.url),'utf8');
  const dom=new JSDOM(html,{url});
  for(const key of ['window','document','location','navigator','localStorage','sessionStorage','FormData','CustomEvent']){
    const prior=Object.getOwnPropertyDescriptor(globalThis,key);Object.defineProperty(globalThis,key,{value:dom.window[key],configurable:true,writable:true});
    t.after(()=>{if(prior)Object.defineProperty(globalThis,key,prior);else delete globalThis[key];});
  }
  t.after(()=>dom.window.close());return dom;
}
const load=()=>import('../static/travel.js?dom='+ ++caseId);

test('the actual planner saves, restores and forgets checklist, budget and changed preferences together',async t=>{
  const dom=setup(t,'index.html','http://127.0.0.1/?days=5&party=family&interest=food&season=winter');
  await load();const d=dom.window.document;
  assert.equal(d.querySelector('#profile-caption').textContent,'With children / family · Food & neighborhoods');
  assert.equal(d.querySelectorAll('#trip-checklist input').length,9);
  for(const [key,value]of Object.entries({people:2,nights:4,lodging:120000,food:30000,transport:10000,activities:80000,extra:50000})){
    const input=d.getElementById('budget-'+key);input.value=String(value);input.dispatchEvent(new dom.window.Event('input',{bubbles:true}));
  }
  d.querySelector('[data-task="hotel"]').click();d.getElementById('save-plan').click();
  assert.match(d.getElementById('budget-result').textContent,/KRW 1,010,000/);
  assert.match(d.getElementById('checklist-progress').textContent,/1 of 9/);
  assert.deepEqual(JSON.parse(localStorage.getItem('stargateKoreaWorkspaceV1')).completed,['hotel']);
  d.getElementById('trip-days').value='3';d.getElementById('trip-planner').dispatchEvent(new dom.window.Event('submit',{bubbles:true,cancelable:true}));
  assert.equal(JSON.parse(localStorage.getItem('stargateKoreaSavedPlanV1')).days,'3');
  assert.equal(JSON.parse(localStorage.getItem('stargateKoreaWorkspaceV1')).budget.nights,4,'Explicitly edited nights stay as chosen');
  // Start the actual application in a fresh DOM with only its saved state.
  const savedProfile=localStorage.getItem('stargateKoreaSavedPlanV1'),savedDesk=localStorage.getItem('stargateKoreaWorkspaceV1');
  const next=setup(t,'index.html','http://127.0.0.1/');next.window.localStorage.setItem('stargateKoreaSavedPlanV1',savedProfile);next.window.localStorage.setItem('stargateKoreaWorkspaceV1',savedDesk);
  await load();assert.equal(next.window.document.getElementById('budget-food').value,'30000');assert.equal(next.window.document.querySelector('[data-task="hotel"]').checked,true);
  next.window.document.getElementById('forget-plan').click();assert.equal(localStorage.getItem('stargateKoreaWorkspaceV1'),null);assert.equal(localStorage.getItem('stargateKoreaSavedPlanV1'),null);
});

test('changing length updates default nights; clearing the desk resets amounts without replacing the selected trip',async t=>{
  const dom=setup(t,'index.html','http://127.0.0.1/?days=3&party=solo');await load();const d=dom.window.document;
  d.getElementById('trip-days').value='5';d.getElementById('trip-planner').dispatchEvent(new dom.window.Event('submit',{bubbles:true,cancelable:true}));
  assert.equal(d.getElementById('budget-nights').value,'4');
  d.querySelector('[data-task="hotel"]').click();d.getElementById('budget-food').value='25000';d.getElementById('budget-food').dispatchEvent(new dom.window.Event('input',{bubbles:true}));
  d.getElementById('reset-workspace').click();assert.equal(d.getElementById('budget-food').value,'');assert.equal(d.querySelector('[data-task="hotel"]').checked,false);assert.equal(d.getElementById('trip-days').value,'5');
});

test('the PDF button passes current customer inputs to the real PDF writer and provides the downloadable result',async t=>{
  const dom=setup(t,'index.html','http://127.0.0.1/');const d=dom.window.document;let bytes,name;
  t.mock.timers.enable({apis:['setTimeout']});t.mock.method(globalThis,'fetch',async()=>({ok:false}));
  t.mock.method(dom.window.HTMLAnchorElement.prototype,'click',function(){name=this.download;});
  initPlanningDesk(personalizeTrip({days:'3'}),{makePdf:async(trip,state)=>{assert.equal(trip.count,3);assert.equal(state.budget.food,30000);bytes=await createPlanPdf(trip,state,pdfLib);return bytes;}});
  d.getElementById('budget-food').value='30000';d.getElementById('budget-food').dispatchEvent(new dom.window.Event('input',{bubbles:true}));
  d.querySelector('[data-task="hotel"]').click();d.getElementById('download-pdf').click();
  d.getElementById('budget-food').value='50000';d.getElementById('budget-food').dispatchEvent(new dom.window.Event('input',{bubbles:true}));
  d.dispatchEvent(new dom.window.CustomEvent('seoul-plan-update',{detail:personalizeTrip({days:'5'})}));
  for(let i=0;i<30&&!d.getElementById('pdf-download-status').textContent.includes('ready for download');i++)await new Promise(resolve=>setImmediate(resolve));
  assert.equal(name,'my-seoul-3-day-plan.pdf');assert.match(d.getElementById('pdf-download-status').textContent,/ready for download/);
  const pdf=await pdfLib.PDFDocument.load(bytes);assert.equal(pdf.getForm().getCheckBox('check_hotel').isChecked(),true);
  assert.equal(d.getElementById('download-pdf').disabled,false);t.mock.timers.tick(30000);
});

test('the self-service support form renders targeted answers and prepares an inert draft without sending',async t=>{
  const dom=setup(t,'book-help/index.html','http://127.0.0.1/book-help/');await load();const d=dom.window.document;
  d.getElementById('support-kind').value='download';d.getElementById('support-kind').dispatchEvent(new dom.window.Event('change',{bubbles:true}));
  assert.match(d.getElementById('support-answer').textContent,/deposit confirmation/);
  d.getElementById('support-order').value='TEST-ORDER-ONLY';d.getElementById('support-notes').value='<img src=x onerror=alert(1)> The file is unavailable.';
  d.getElementById('book-support').dispatchEvent(new dom.window.Event('submit',{bubbles:true,cancelable:true}));
  assert.equal(d.getElementById('support-preview').hidden,false);assert.ok(d.getElementById('support-text').value.includes('TEST-ORDER-ONLY'));
  assert.equal(d.querySelectorAll('#support-preview img').length,0);
  assert.match(d.getElementById('support-email').href,/^mailto:ceo@stargateedu.co.kr\?/);
  assert.equal(localStorage.length,0,'The support helper does not store the order reference or text');
});

test('comparing offers and opening help keeps the trip preferences on site, without adding them to store checkout',async t=>{
  const dom=setup(t,'books/index.html','http://127.0.0.1/books/?days=5&party=family&interest=food&private=not-for-links');await load();
  const d=dom.window.document;
  for(const link of d.querySelectorAll('a[data-carry-profile]')){
    const target=new URL(link.href);assert.equal(target.searchParams.get('party'),'family');assert.equal(target.searchParams.get('days'),'5');assert.equal(target.searchParams.has('private'),false);
  }
  for(const link of d.querySelectorAll('[data-conversion="book_checkout_open"]')){
    const target=new URL(link.href);assert.equal(target.searchParams.get('idx'),'10');assert.equal(target.searchParams.has('party'),false);
  }
});
