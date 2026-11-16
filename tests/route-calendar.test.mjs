import test from 'node:test';
import assert from 'node:assert/strict';
import { personalizeTrip, routeOptions, changeTripDay, moveTripDay, tripQuery, tripFromQuery, tripPreferences, planAsText } from '../static/personalization.mjs';
import { normalizeStartDate, dateForDay, monthReading, createTripCalendar } from '../static/trip-calendar.mjs';
import { normalizeWorkspace } from '../static/planning-tools.mjs';
import { PDFDocument } from 'pdf-lib';
import * as pdfLib from 'pdf-lib';
import { createPlanPdf } from '../static/plan-pdf.mjs';

test('editing and moving days preserves the requested length, unique routes and family/slow limits',()=>{
  for(const days of ['1','3','5'])for(const party of ['solo','family'])for(const interest of ['mixed','culture','food','design']){
    const trip=personalizeTrip({days,party,interest});
    for(const option of routeOptions()){
      const edited=changeTripDay(trip,0,option.id);
      assert.equal(edited.days[0].id,option.id);assert.equal(edited.days.length,Number(days));
      assert.equal(new Set(edited.days.map(day=>day.id)).size,Number(days));
      if(party==='family')assert.ok(edited.days.every(day=>day.stops.length<=2));
      if(Number(days)>1){const moved=moveTripDay(edited,0,1);assert.equal(moved.days[1].id,option.id);assert.deepEqual(moveTripDay(moved,1,-1).days,edited.days);}
      assert.deepEqual(tripFromQuery(tripQuery(edited)).days,edited.days);
      assert.deepEqual(personalizeTrip(tripPreferences(edited),tripPreferences(edited).routes).days,edited.days);
    }
  }
  const start=personalizeTrip({days:'3'});assert.deepEqual(moveTripDay(start,0,-1).days,start.days);
  assert.deepEqual(changeTripDay(start,0,'__proto__').days,start.days);
  assert.deepEqual(personalizeTrip({days:'3'},['<script>','museum','museum',null]).days.map(d=>d.id),['museum','old','market']);
});

test('shared and exported outlines retain edited order without carrying local dates, amounts or unknown input',()=>{
  const trip=personalizeTrip({days:'3',party:'family',email:'private@example.com'},['seongsu','museum','market']);
  const query=tripQuery({...trip,startDate:'2026-11-20',budget:9999});
  assert.ok(query.includes('routes=seongsu%2Cmuseum%2Cmarket'));
  assert.ok(!query.includes('private')&&!query.includes('2026-11-20')&&!query.includes('9999'));
  const exported=planAsText(trip);assert.ok(exported.includes(query));assert.ok(exported.indexOf('Day 1: Design')<exported.indexOf('Day 2: One museum'));
  assert.deepEqual(tripFromQuery('?days=3&routes=seongsu,seongsu,unknown,__proto__').days.map(d=>d.id),['seongsu','old','market']);
});

test('calendar dates are real civil dates and day boundaries survive leap years and year changes',()=>{
  for(const invalid of ['',null,'2026-02-30','2026-13-01','1999-12-31','2026-11-20\r\nATTENDEE:someone'])assert.equal(normalizeStartDate(invalid),'');
  assert.equal(normalizeStartDate('2028-02-29'),'2028-02-29');
  assert.equal(dateForDay('2028-02-28',2),'2028-03-01');assert.equal(dateForDay('2026-12-30',3),'2027-01-02');
  assert.equal(monthReading('2026-11-20').href,'/seoul-in-november/');
  assert.equal(monthReading(''),null);
  assert.equal(normalizeWorkspace({startDate:'2026-11-20'},{days:'3'}).startDate,'2026-11-20');
});

test('iCalendar export uses tentative all-day events, UTF-8-safe folding and the edited order',()=>{
  const trip=personalizeTrip({days:'3'},['seongsu','museum','market']);
  const calendar=createTripCalendar(trip,'2026-12-30',new Date('2026-11-16T10:00:00Z'));
  for(const line of calendar.split('\r\n'))assert.ok(Buffer.byteLength(line,'utf8')<=75);
  assert.ok(!/(?<!\r)\n/.test(calendar));
  const unfolded=calendar.replace(/\r\n /g,'');
  assert.equal((unfolded.match(/BEGIN:VEVENT/g)||[]).length,3);
  assert.equal((unfolded.match(/STATUS:TENTATIVE/g)||[]).length,3);
  assert.equal((unfolded.match(/CLASS:PRIVATE/g)||[]).length,3);
  assert.ok(unfolded.includes('DTSTART;VALUE=DATE:20261230\r\nDTEND;VALUE=DATE:20261231'));
  assert.ok(unfolded.includes('DTSTART;VALUE=DATE:20270101\r\nDTEND;VALUE=DATE:20270102'));
  assert.ok(unfolded.includes('DTSTAMP:20261116T100000Z'));assert.ok(unfolded.indexOf('Design discoveries')<unfolded.indexOf('One museum'));
  assert.ok(unfolded.includes('routes=seongsu%2Cmuseum%2Cmarket'));
  assert.ok(!unfolded.includes('ATTENDEE:')&&!unfolded.includes('ORGANIZER:')&&!unfolded.includes('METHOD:REQUEST'));
  const hostile={...trip,days:[{id:'seongsu',title:'\r\nATTENDEE:attacker'},...trip.days.slice(1)]};
  assert.ok(!createTripCalendar(hostile,'2026-11-20').includes('ATTENDEE:'));
  assert.throws(()=>createTripCalendar(trip,'bad date'),/valid first sightseeing date/);
});

test('PDF reopen links contain the edited order while checkbox fields stay usable',async()=>{
  const trip=personalizeTrip({days:'3'},['seongsu','museum','market']);
  const bytes=await createPlanPdf(trip,{completed:['hotel'],startDate:'2026-11-20'},pdfLib);
  const pdf=await PDFDocument.load(bytes);assert.equal(pdf.getPageCount(),5);assert.equal(pdf.getForm().getCheckBox('check_hotel').isChecked(),true);
  const links=pdf.getPages().at(-1).node.Annots().asArray().map(ref=>pdf.context.lookup(ref)).filter(a=>a.get(pdfLib.PDFName.of('Subtype'))?.toString()==='/Link');
  const uris=links.map(link=>link.lookup(pdfLib.PDFName.of('A'),pdfLib.PDFDict).lookup(pdfLib.PDFName.of('URI'),pdfLib.PDFString).decodeText());
  assert.ok(uris.some(uri=>uri.includes('routes=seongsu%2Cmuseum%2Cmarket')));assert.ok(uris.every(uri=>!uri.includes('2026-11-20')));
});
