import { personalizeTrip, tripQuery } from './personalization.mjs?v=20261122-analytics1';

export function normalizeStartDate(value) {
  if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return '';
  const year=Number(value.slice(0,4));if(year<2000||year>2100)return '';
  const date=new Date(value+'T00:00:00Z');
  return Number.isFinite(date.getTime())&&date.toISOString().slice(0,10)===value?value:'';
}

export function dateForDay(startDate, offset=0) {
  const start=normalizeStartDate(startDate);if(!start||!Number.isInteger(offset)||offset<0||offset>5)return '';
  const date=new Date(start+'T00:00:00Z');date.setUTCDate(date.getUTCDate()+offset);
  return date.toISOString().slice(0,10);
}

export function monthReading(startDate) {
  const date=normalizeStartDate(startDate);if(!date)return null;
  const month=['January','February','March','April','May','June','July','August','September','October','November','December'][Number(date.slice(5,7))-1];
  return {title:'Planning Seoul in '+month+'? Read the month guide →',href:'/seoul-in-'+month.toLowerCase()+'/'};
}

const text=value=>String(value).replace(/\\/g,'\\\\').replace(/\r\n|\r|\n/g,'\\n').replace(/;/g,'\\;').replace(/,/g,'\\,');
function foldLine(value) {
  const encoder=new TextEncoder();let line='',bytes=0;const lines=[];
  for(const char of value){const size=encoder.encode(char).length;if(bytes+size>75){lines.push(line);line=' ';bytes=1;}line+=char;bytes+=size;}
  lines.push(line);return lines.join('\r\n');
}

export function createTripCalendar(trip, startDate, now=new Date()) {
  const start=normalizeStartDate(startDate);if(!start)throw new Error('Choose a valid first sightseeing date.');
  const current=personalizeTrip(trip?.profile,Array.isArray(trip?.days)?trip.days.map(day=>day.id):[]);
  const timestamp=new Date(now);if(!Number.isFinite(timestamp.getTime()))throw new Error('Invalid calendar timestamp.');
  const stamp=timestamp.toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'');
  const lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Stargate Korea//Personal Seoul Plan//EN','CALSCALE:GREGORIAN'];
  for(const day of current.days){
    const date=dateForDay(start,day.number-1).replaceAll('-',''),end=dateForDay(start,day.number).replaceAll('-','');
    lines.push('BEGIN:VEVENT',`UID:seoul-${date}-${day.id}@stargatekorea.net`,'DTSTAMP:'+stamp,'DTSTART;VALUE=DATE:'+date,'DTEND;VALUE=DATE:'+end,
      'SUMMARY:'+text('Seoul day '+day.number+': '+day.title),'LOCATION:'+text(day.area),
      'DESCRIPTION:'+text([day.route,day.detail,day.alternative,'Suggested all-day outline. Check actual venue access and transport; this is not a booking.','Map: '+day.map].join('\n\n')),
      'URL:https://www.stargatekorea.net/?'+tripQuery(current)+'#plan','STATUS:TENTATIVE','TRANSP:TRANSPARENT','CLASS:PRIVATE','END:VEVENT');
  }
  lines.push('END:VCALENDAR');return lines.map(foldLine).join('\r\n')+'\r\n';
}
