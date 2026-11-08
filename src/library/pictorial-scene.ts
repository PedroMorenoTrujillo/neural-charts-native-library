import type {PlanPictorialGlyph,PlanPictorialGlyphId,PlanPictorialSummary,PlanPictorialLayoutSummary,PlanPictorialValue} from '@neural-charts/core/plan';
import type {NativeScene,Observation,ChartFamily} from './contracts.js';
import {validateNativePath} from './path-validation.js';

export interface NativePictorialGeometry {
  readonly backgroundPath:string;
  readonly glyphs:readonly Omit<PlanPictorialGlyph,'backgroundCommands'>[];
  readonly data:readonly PlanPictorialSummary[];
  readonly layout:PlanPictorialLayoutSummary;
}
const finite=(value:unknown):value is number=>typeof value==='number'&&Number.isFinite(value);
const nonnegative=(value:unknown):value is number=>finite(value)&&value>=0;
const nullable=(value:unknown):value is number|null=>value===null||nonnegative(value);
const text=(value:unknown):value is string=>typeof value==='string'&&value.length>0&&value.length<=256;
const validPath=/^[MLZmlz\d.,+\-\seE]*$/;

function glyphId(id:PlanPictorialGlyphId):PlanPictorialGlyphId{
  if(!id||!text(id.categoryId))throw Error('Invalid pictorial glyph identity');
  if(id.type==='stacked')return {type:'stacked',categoryId:id.categoryId};
  if(id.type==='grouped'&&text(id.seriesId))return {type:'grouped',categoryId:id.categoryId,seriesId:id.seriesId};
  throw Error('Invalid pictorial glyph identity');
}

export function ownPictorialPoint(point:Observation,family:ChartFamily):Readonly<{pictorial?:PlanPictorialValue}>{
  const p=point.pictorial;
  if(family!=='pictorial'){
    if(p!==undefined||point.hit?.type==='compoundPolygon')throw Error('Pictorial roles require pictorial family');
    return {};
  }
  if(!p||!text(p.categoryId)||!text(p.shapeId)||!['displayed','zero','noInk'].includes(p.status)||!nonnegative(p.low)||!nonnegative(p.high)||p.low>p.high||!nullable(p.capacity)||!nullable(p.total)||!['known','overflow'].includes(p.totalStatus)||typeof p.incomplete!=='boolean')throw Error('Invalid pictorial observation');
  if(p.status==='zero'&&point.value!==0||p.status!=='zero'&&!(point.value>0)||p.status==='displayed'&&point.hit?.type!=='compoundPolygon'||p.status!=='displayed'&&point.hit!==undefined)throw Error('Invalid pictorial value/hit state');
  const id=glyphId(p.glyphId);
  if(id.categoryId!==p.categoryId||id.type==='grouped'&&id.seriesId!==point.id.seriesId)throw Error('Pictorial glyph/source identity mismatch');
  return {pictorial:{categoryId:p.categoryId,glyphId:id,shapeId:p.shapeId,status:p.status,low:p.low,high:p.high,capacity:p.capacity,total:p.total,totalStatus:p.totalStatus,incomplete:p.incomplete}};
}

/** Own bounded public roles without retaining the Core's command arrays twice. */
export function ownPictorialScene(scene:NativeScene):Readonly<{pictorial?:NativePictorialGeometry}>{
  const source=scene.pictorial;
  if(scene.family!=='pictorial'){
    if(source!==undefined)throw Error('Unexpected pictorial scene metadata');
    return {};
  }
  if(!source||typeof source.backgroundPath!=='string'||source.backgroundPath.length>1_000_000||!validPath.test(source.backgroundPath)||!Array.isArray(source.glyphs)||source.glyphs.length>256||!Array.isArray(source.data)||source.data.length>64||scene.observations.length>64||scene.series.length>8)throw Error('Invalid or unbounded pictorial scene');
  validateNativePath(source.backgroundPath,scene.width,scene.height);
  const ids=new Set<string>();
  const glyphs=source.glyphs.map(g=>{
    const id=glyphId(g.id),key=JSON.stringify(id),b=g.bounds;
    if(ids.has(key)||!text(g.categoryId)||!text(g.shapeId)||g.categoryId!==id.categoryId||!b||![b.x,b.y,b.width,b.height].every(nonnegative)||b.x+b.width>scene.width+1e-8||b.y+b.height>scene.height+1e-8)throw Error('Invalid pictorial glyph');
    ids.add(key);
    return {id,categoryId:g.categoryId,shapeId:g.shapeId,bounds:{x:b.x,y:b.y,width:b.width,height:b.height}};
  });
  const sourceIds=new Set<string>();
  const data=source.data.map(p=>{
    if(!p||!p.id||!text(p.id.seriesId)||!text(p.id.pointId)||!text(p.categoryId)||!nullable(p.y)||!nullable(p.low)||!nullable(p.high)||!nullable(p.total)||!['known','overflow'].includes(p.totalStatus)||typeof p.visible!=='boolean'||typeof p.incomplete!=='boolean'||!['displayed','zero','null','hidden','noInk'].includes(p.status)||p.percentage!==undefined&&(!nonnegative(p.percentage)||p.percentage>100+1e-8))throw Error('Invalid pictorial source summary');
    const key=JSON.stringify([p.id.seriesId,p.id.pointId]);if(sourceIds.has(key))throw Error('Duplicate pictorial source identity');sourceIds.add(key);
    if(p.y===null&&p.status!=='null'&&p.status!=='hidden'||p.status==='zero'&&p.y!==0||p.status==='null'&&p.y!==null)throw Error('Invalid pictorial summary state');
    return {id:{seriesId:p.id.seriesId,pointId:p.id.pointId},categoryId:p.categoryId,y:p.y,visible:p.visible,status:p.status,low:p.low,high:p.high,total:p.total,totalStatus:p.totalStatus,incomplete:p.incomplete,...(p.percentage===undefined?{}:{percentage:p.percentage})};
  });
  const l=source.layout;
  if(!l||!['grouped','sum','percent'].includes(l.mode)||!nullable(l.capacity)||!nonnegative(l.layoutCapacity)||!['domain','source','none'].includes(l.capacitySource)||l.emptyReason!==undefined&&!['noSource','noPositiveValues','hidden'].includes(l.emptyReason)||l.capacityRoundoff!==undefined&&(!nonnegative(l.capacityRoundoff.maxExcess)||!nonnegative(l.capacityRoundoff.tolerance)))throw Error('Invalid pictorial layout summary');
  for(const p of scene.observations){
    const owned=ownPictorialPoint(p,'pictorial').pictorial!;
    if(!sourceIds.has(JSON.stringify([p.id.seriesId,p.id.pointId]))||!ids.has(JSON.stringify(owned.glyphId)))throw Error('Unmatched pictorial observation identity');
  }
  return {pictorial:{backgroundPath:source.backgroundPath,glyphs,data,layout:{mode:l.mode,capacity:l.capacity,layoutCapacity:l.layoutCapacity,capacitySource:l.capacitySource,...(l.emptyReason===undefined?{}:{emptyReason:l.emptyReason}),...(l.capacityRoundoff?{capacityRoundoff:{maxExcess:l.capacityRoundoff.maxExcess,tolerance:l.capacityRoundoff.tolerance}}:{})}}};
}
