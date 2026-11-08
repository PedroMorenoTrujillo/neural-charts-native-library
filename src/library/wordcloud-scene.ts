import type {PlanWordCloudTextGlyph,PlanWordCloudLayout,PlanWordCloudSummary} from '@neural-charts/core/plan';
import type {NativeScene,NativeSeries} from './contracts.js';

export type NativeWordCloudGeometry=Readonly<{status:'measuring';fontKey:string}>
  |Readonly<{status:'ready';fontKey:string;data:readonly PlanWordCloudSummary[];layout:PlanWordCloudLayout}>;
const bounded=(v:unknown,max:number):v is number=>typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<=max;
const text=(v:unknown,max:number):v is string=>typeof v==='string'&&v.length>0&&v.length<=max;
const reasons=['hidden','unknown','zero','budget','noInk','noSpace'] as const;
/** Own glyph/source roles once; touches never measure fonts or repeat packing. */
export function ownWordCloud(scene:NativeScene):Readonly<{wordcloud?:NativeWordCloudGeometry}>{
  const source=scene.wordcloud;
  if(scene.family!=='wordcloud'){if(source||scene.series.some(s=>s.textGlyphs!==undefined))throw Error('Text glyphs require Wordcloud');return {};}
  if(!source||!text(source.fontKey,512)||scene.observations.length>128)throw Error('Missing bounded font source');
  if(source.status==='measuring'){
    if(scene.observations.length||scene.series.some(s=>s.textGlyphs?.length))throw Error('Pending text cannot be interactive');
    return {wordcloud:{status:'measuring',fontKey:source.fontKey}};
  }
  if(source.status!=='ready'||!Array.isArray(source.data)||source.data.length>2048)throw Error('Invalid word source');
  const ids=new Set<string>();
  const data=source.data.map(word=>{
    if(!word||!text(word.id?.pointId,128)||!text(word.id?.seriesId,128)||ids.has(word.id.pointId)||!text(word.text,512)||/[\r\n\u000b\u000c\u0085\u2028\u2029]/u.test(word.text)||word.weight!==null&&!bounded(word.weight,Number.MAX_VALUE))throw Error('Invalid original word');
    ids.add(word.id.pointId);const d=word.decision;
    if(!d||d.type==='displayed'&&(!bounded(d.fontSize,128)||d.fontSize<4||d.rotation!==0&&d.rotation!==90)||d.type==='notDisplayed'&&!reasons.includes(d.reason)||d.type!=='displayed'&&d.type!=='notDisplayed')throw Error('Invalid word decision');
    return {id:{...word.id},text:word.text,weight:word.weight,decision:{...d}};
  });
  const l=source.layout,counts=Object.fromEntries(reasons.map(reason=>[reason,data.filter(word=>word.decision.type==='notDisplayed'&&word.decision.reason===reason).length]));
  if(!l||l.sourceWords!==data.length||l.displayedWords!==scene.observations.length||!bounded(l.requestedWords,128)||!bounded(l.attempts,32768)||!bounded(l.collisionChecks,4194304)||typeof l.budgetExhausted!=='boolean'||reasons.some(r=>l.notDisplayed?.[r]!==counts[r])||l.emptyReason!==undefined&&!['noSource','noEligibleWords','noInk','noSpace'].includes(l.emptyReason))throw Error('Invalid word layout');
  const byId=new Map(data.map(word=>[word.id.pointId,word])),glyphIds=new Set<string>();
  for(const series of scene.series)for(const g of series.textGlyphs??[]){
    const original=byId.get(g.pointId);
    if(!original||original.id.seriesId!==series.id||original.decision.type!=='displayed'||glyphIds.has(g.pointId)||g.text!==original.text||g.fontKey!==source.fontKey||g.fontSize!==original.decision.fontSize||g.rotation!==original.decision.rotation)throw Error('Glyph identity differs from source');
    glyphIds.add(g.pointId);
    if(!bounded(g.measured?.width,1e6)||!bounded(g.measured?.height,1e6)||!g.measured.width||!g.measured.height||!bounded(g.bounds?.x,scene.width)||!bounded(g.bounds?.y,scene.height)||!bounded(g.bounds?.width,scene.width)||!bounded(g.bounds?.height,scene.height)||g.bounds.x+g.bounds.width>scene.width+1e-6||g.bounds.y+g.bounds.height>scene.height+1e-6||!bounded(g.center?.x,scene.width)||!bounded(g.center?.y,scene.height)||!/^#[\da-f]{6}$/iu.test(g.color))throw Error('Invalid measured glyph');
    const point=scene.observations.find(p=>p.id.pointId===g.pointId&&p.id.seriesId===series.id);
    if(!point||point.label!==original.text||point.value!==original.weight||point.hit?.type!=='polygon')throw Error('Word hit differs from source');
  }
  if(glyphIds.size!==scene.observations.length||data.filter(w=>w.decision.type==='displayed').length!==glyphIds.size)throw Error('Missing text glyph');
  return {wordcloud:{status:'ready',fontKey:source.fontKey,data,layout:{...l,notDisplayed:{...l.notDisplayed}}}};
}
export function ownWordCloudGlyphs(series:NativeSeries):Readonly<{textGlyphs?:readonly PlanWordCloudTextGlyph[]}>{
  if(series.textGlyphs===undefined)return {};
  if(!Array.isArray(series.textGlyphs)||series.textGlyphs.length>128)throw Error('Text glyph budget');
  return {textGlyphs:series.textGlyphs.map(g=>({...g,center:{...g.center},measured:{...g.measured},bounds:{...g.bounds}}))};
}
