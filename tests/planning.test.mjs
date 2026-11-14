import test, { before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { PDFDocument } from 'pdf-lib';
import * as pdfLib from 'pdf-lib';
import { build } from '../build.mjs';
import { personalizeTrip } from '../static/personalization.mjs';
import { calculateBudget, normalizeWorkspace, tripChecklist, supportAdvice } from '../static/planning-tools.mjs';
import { createPlanPdf } from '../static/plan-pdf.mjs';

before(()=>build());

test('shared room costs, per-person daily costs and group extras are counted once in their correct units',()=>{
  const result=calculateBudget({people:2,nights:4,lodging:120000,food:30000,transport:10000,activities:80000,extra:50000},5);
  assert.equal(result.total,1010000);assert.equal(result.perPerson,505000);
  assert.deepEqual(result.rows.map(row=>row.value),[480000,300000,100000,80000,50000]);
  assert.equal(calculateBudget({people:4,nights:1,lodging:100000},1).total,100000);
  assert.equal(calculateBudget({},3).hasValues,false);
  assert.equal(calculateBudget({nights:0,lodging:50000},1).total,0);
  const bounded=calculateBudget({people:0,nights:-4,food:Infinity,transport:'NaN',extra:1e20},999);
  assert.equal(bounded.days,3);assert.equal(bounded.values.people,1);assert.equal(bounded.values.nights,0);
  assert.ok(Number.isFinite(bounded.total));assert.equal(bounded.values.extra,100000000);
});

test('personal checklist changes with family, interests and season and discards unrelated saved fields',()=>{
  const profile={party:'family',interest:'food',season:'winter',days:'5'};
  const tasks=tripChecklist(profile),ids=tasks.map(t=>t.id);
  assert.ok(ids.includes('family')&&ids.includes('food')&&ids.includes('weather'));
  assert.equal(new Set(ids).size,ids.length);
  assert.ok(!tripChecklist({party:'solo',season:'spring'}).some(t=>['family','weather'].includes(t.id)));
  const state=normalizeWorkspace({completed:['family','family','<script>','food','design'],budget:{people:2,email:'private@example.com'},notes:'secret'},profile);
  assert.deepEqual(state.completed,['family','food']);assert.equal(state.budget.nights,4);
  assert.ok(!JSON.stringify(state).includes('private')&&!JSON.stringify(state).includes('secret'));
  assert.deepEqual(normalizeWorkspace(null,profile).completed,[]);
});

test('downloaded personalized PDFs reopen with the right number of pages and real interactive checkbox values',async()=>{
  for(const profile of [
    {days:'1',party:'couple',interest:'design',pace:'slow'},
    {days:'3',party:'solo',interest:'mixed'},
    {days:'5',party:'family',interest:'food',season:'winter',pace:'slow'},
    {days:'5',interest:'culture',pace:'slow'},
  ]){
    const trip=personalizeTrip(profile),bytes=await createPlanPdf(trip,{completed:['hotel','food'],budget:{people:2,food:25000}},pdfLib);
    const document=await PDFDocument.load(bytes),fields=document.getForm();
    assert.equal(document.getPageCount(),trip.count+2);
    assert.equal(document.getTitle(),'Your Seoul starting plan - '+trip.count+' days');
    assert.equal(fields.getFields().length,tripChecklist(profile).length);
    assert.equal(fields.getCheckBox('check_hotel').isChecked(),true);
    assert.equal(fields.getCheckBox('check_arrival').isChecked(),false);
    if(profile.interest==='food')assert.equal(fields.getCheckBox('check_food').isChecked(),true);
    assert.ok(document.getPages().at(-1).node.Annots().size()>=fields.getFields().length+3);
  }
});

test('self-service help and optional product comparison are live without claiming an order is accessed or an email sent',()=>{
  const help=fs.readFileSync(new URL('../dist/book-help/index.html',import.meta.url),'utf8');
  assert.match(help,/Korean store labels/);assert.match(help,/Preparing this draft does not send it/);
  assert.match(help,/cannot see or change your order/);assert.match(help,/KRW 9,900/);
  const book=fs.readFileSync(new URL('../dist/books/index.html',import.meta.url),'utf8');
  assert.match(book,/id="guide-options"/);assert.match(book,/href="\/book-help\/"/);
  const home=fs.readFileSync(new URL('../dist/index.html',import.meta.url),'utf8');
  assert.match(home,/id="download-pdf"/);assert.match(home,/id="budget-calculator"/);
  assert.ok(fs.statSync(new URL('../dist/vendor/pdf-lib.esm.min.js',import.meta.url)).size>100000);
  assert.ok(!home.includes('<script src="/vendor/'));
  assert.equal(supportAdvice('arbitrary attacker text').title,'Before buying');
  assert.ok(supportAdvice('download').steps.some(s=>s.includes('payment is confirmed')));
});
