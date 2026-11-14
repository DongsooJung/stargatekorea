import { profileOptions, profileQuery } from './personalization.mjs';
import { tripChecklist, normalizeWorkspace, calculateBudget, krw } from './planning-tools.mjs';

const ascii = value => String(value).normalize('NFKD').replace(/[‘’]/g,"'").replace(/[“”]/g,'"').replace(/[–—·]/g,' - ').replace(/×/g,' x ').replace(/→|↗/g,' > ').replace(/₩/g,'KRW ').replace(/[^\x20-\x7E\n]/g,'');

export async function createPlanPdf(trip, input = {}, library, photoBytes) {
  const lib = library || await import('/vendor/pdf-lib.esm.min.js');
  const { PDFDocument, StandardFonts, rgb, PDFString } = lib;
  const pdf = await PDFDocument.create();
  pdf.setTitle('Your Seoul starting plan - ' + trip.count + ' days');
  pdf.setAuthor('Stargate Korea');pdf.setSubject('Free personalized editorial outline');pdf.setLanguage('en-US');
  const regular = await pdf.embedFont(StandardFonts.Helvetica), bold = await pdf.embedFont(StandardFonts.HelveticaBold), serif = await pdf.embedFont(StandardFonts.TimesRoman);
  const ink=rgb(.14,.22,.18), muted=rgb(.34,.38,.34), accent=rgb(.65,.29,.18), paper=rgb(.97,.96,.93), panel=rgb(.91,.93,.87);
  const W=595.28,H=841.89,M=44,CW=W-M*2;
  const state=normalizeWorkspace(input,trip.profile), tasks=tripChecklist(trip.profile), budget=calculateBudget(state.budget,trip.count);
  function page(label){const p=pdf.addPage([W,H]);p.drawRectangle({x:0,y:0,width:W,height:H,color:paper});p.drawText('STARGATE KOREA',{x:M,y:H-42,size:10,font:bold,color:ink});p.drawText(ascii(label),{x:M,y:H-61,size:9,font:regular,color:muted});return p;}
  function text(p,value,y,{size=11,font=regular,color=ink,width=CW,x=M,leading=size*1.5}={}){
    const words=ascii(value).split(/\s+/);let line='';
    for(const word of words){const next=line?line+' '+word:word;if(line&&font.widthOfTextAtSize(next,size)>width){p.drawText(line,{x,y,size,font,color});y-=leading;line=word;}else line=next;}
    if(line){p.drawText(line,{x,y,size,font,color});y-=leading;}return y;
  }
  function link(p,label,url,y){p.drawText(ascii(label),{x:M,y,size:10,font:bold,color:accent});const a=pdf.context.obj({Type:'Annot',Subtype:'Link',Rect:[M,y-3,M+Math.min(CW,bold.widthOfTextAtSize(ascii(label),10)),y+12],Border:[0,0,0],A:{Type:'Action',S:'URI',URI:PDFString.of(url)}});const ref=pdf.context.register(a);p.node.addAnnot(ref);return y-25;}
  const cover=page('FREE PERSONAL OUTLINE / ' + trip.count + ' DAYS');
  let y=text(cover,'Seoul, around you.',H-116,{font:serif,size:35,leading:42});
  y=text(cover,trip.summary,y-7,{size:13});y=text(cover,trip.label,y-1,{size:11,color:muted});
  if(photoBytes){const photo=await pdf.embedJpg(photoBytes);const height=206;
    // The supplied palace photo already has a landscape crop; contain it without clipping content.
    const contained=photo.scaleToFit(CW,height);cover.drawRectangle({x:M,y:y-height-7,width:CW,height,color:panel});cover.drawImage(photo,{x:M+(CW-contained.width)/2,y:y-height-7+(height-contained.height)/2,width:contained.width,height:contained.height});y-=height+28;
  }else{cover.drawRectangle({x:M,y:y-90,width:CW,height:82,color:panel});cover.drawText('YOUR TIME. YOUR INTERESTS. YOUR SEOUL.',{x:M+18,y:y-55,size:15,font:bold,color:ink});y-=113;}
  y=text(cover,'Why this starting plan fits your choices',y,{font:bold,size:15});
  for(const note of trip.why)y=text(cover,note,y-7,{size:10.5,color:muted,leading:15});
  y=text(cover,'Budget style: '+profileOptions.budget[trip.profile.budget]+' / Season: '+profileOptions.season[trip.profile.season],y-5,{size:10});
  text(cover,'Use the route pages as a starting outline. Check the venue calendar, access, weather and your journey before booking. This free PDF is separate from the paid 24-page standard guide.',y-10,{size:10,color:muted});
  for(const day of trip.days){const p=page('YOUR NEIGHBORHOOD DAYS / DAY '+day.number);let at=H-117;
    at=text(p,'Day '+day.number,at,{font:serif,size:38,leading:44});at=text(p,day.title,at-5,{font:bold,size:23,leading:29});at=text(p,day.area,at-5,{size:11,color:accent});
    at=text(p,day.route,at-14,{font:bold,size:12,leading:18});at=text(p,day.detail,at-10,{size:12,leading:19});
    at=text(p,'If the day needs to change',at-18,{font:bold,size:15});at=text(p,day.alternative,at-7,{size:11.5,color:muted,leading:18});
    at=link(p,'Open the map starting point',day.map,at-14);
    at=text(p,'Make the day your own',at-14,{font:serif,size:24});
    for(const label of ['My one must-do','Meal / longer pause','Indoor fallback / route back']){at-=22;p.drawText(label,{x:M,y:at,size:10,font:bold,color:muted});p.drawLine({start:{x:M,y:at-31},end:{x:W-M,y:at-31},thickness:.5,color:rgb(.75,.78,.72)});at-=44;}
  }
  const desk=page('PREPARATION / YOUR FIGURES');let at=text(desk,'A calmer start.',H-116,{font:serif,size:32});
  at=text(desk,'Your preparation checklist',at-12,{font:bold,size:16});
  const form=pdf.getForm();
  for(const task of tasks){const box=form.createCheckBox('check_'+task.id);box.addToPage(desk,{x:M,y:at-3,width:11,height:11,borderWidth:.8,borderColor:muted,backgroundColor:paper});if(state.completed.includes(task.id))box.check();else box.uncheck();
    at=text(desk,task.title,at,{x:M+21,width:CW-21,size:10.5,font:bold,leading:14})-10;}
  at=text(desk,'Your budget estimate',at-14,{font:bold,size:16});
  at=text(desk,`${budget.values.people} people / ${trip.count} days / ${budget.values.nights} nights. Your inputs only; no live prices.`,at-5,{size:10,color:muted});
  if(budget.hasValues){for(const row of budget.rows)at=text(desk,row.label+': '+krw(row.value),at-3,{size:10});at=text(desk,'Group total: '+krw(budget.total)+' / Per person: '+krw(budget.perPerson),at-7,{font:bold,size:12});}
  else at=text(desk,'No estimates entered. Add your food, transport, accommodation, activity and other allowances in the online planning desk, then download again.',at-5,{size:10.5,color:muted});
  at=text(desk,'The estimate excludes anything you have not included. The optional paid PDF or custom brief is separate. Ticking a box does not confirm a reservation or access.',at-7,{size:9.5,color:muted});
  at=link(desk,'Reopen these trip preferences', 'https://www.stargatekorea.net/?'+profileQuery(trip.profile)+'#plan',at-8);
  at=link(desk,'Compare the free outline, standard PDF and custom brief','https://www.stargatekorea.net/books/#guide-options',at);
  link(desk,'Buying or download help','https://www.stargatekorea.net/book-help/',at);
  form.updateFieldAppearances(regular);
  pdf.getPages().forEach((p,index)=>{p.drawLine({start:{x:M,y:39},end:{x:W-M,y:39},thickness:.5,color:rgb(.76,.78,.73)});p.drawText('stargatekorea.net | Free editorial starting plan',{x:M,y:25,size:8,font:regular,color:muted});p.drawText(`${index+1} / ${pdf.getPageCount()}`,{x:W-M-28,y:25,size:8,font:regular,color:muted});});
  return pdf.save();
}
