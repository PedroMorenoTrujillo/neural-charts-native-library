import type {DatumId,InteractionSnapshot,Observation} from './contracts.js';

const sameId=(a:DatumId|null,b:DatumId|null)=>a===b||!!a&&!!b&&a.seriesId===b.seriesId&&a.pointId===b.pointId;
function sameTilemap(a:Observation['tilemap'],b:Observation['tilemap']):boolean{
  if(a===b)return true;if(!a||!b)return false;
  if(a.sourceX!==b.sourceX||a.sourceY!==b.sourceY||a.name!==b.name||a.classLabel!==b.classLabel||a.color.type!==b.color.type||a.color.color!==b.color.color)return false;
  if(a.color.type==='continuous'&&b.color.type==='continuous')return a.color.ratio===b.color.ratio&&a.color.clamped===b.color.clamped;
  if(a.color.type==='class'&&b.color.type==='class')return a.color.classId===b.color.classId;
  return true;
}
function samePoint(a:Observation|null,b:Observation|null):boolean{
  return a===b||!!a&&!!b&&sameId(a.id,b.id)&&a.label===b.label&&a.seriesName===b.seriesName&&a.value===b.value&&sameTilemap(a.tilemap,b.tilemap)&&a.pictorial?.status===b.pictorial?.status&&a.pictorial?.capacity===b.pictorial?.capacity&&a.pictorial?.total===b.pictorial?.total&&a.pictorial?.totalStatus===b.pictorial?.totalStatus&&a.pictorial?.incomplete===b.pictorial?.incomplete&&a.pictorial?.low===b.pictorial?.low&&a.pictorial?.high===b.pictorial?.high&&a.pictorial?.categoryId===b.pictorial?.categoryId&&a.pictorial?.shapeId===b.pictorial?.shapeId&&a.yValue===b.yValue&&a.vector?.dx===b.vector?.dx&&a.vector?.dy===b.vector?.dy&&a.wind?.direction===b.wind?.direction&&a.node?.incoming===b.node?.incoming&&a.node?.outgoing===b.node?.outgoing&&a.node?.depth===b.node?.depth&&a.minimumValue===b.minimumValue&&a.q1Value===b.q1Value&&a.medianValue===b.medianValue&&a.q3Value===b.q3Value&&a.maximumValue===b.maximumValue&&a.lowValue===b.lowValue&&a.highValue===b.highValue&&a.valueUnit===b.valueUnit&&a.computedKind===b.computedKind&&a.subtotal===b.subtotal&&a.incomplete===b.incomplete&&a.color===b.color&&a.xValue===b.xValue&&a.sizeValue===b.sizeValue&&a.percentage===b.percentage&&a.group?.key===b.group?.key&&a.group?.label===b.group?.label;
}
/** Selection/content notifications exclude projected geometry-only revisions. */
export function sameInteractionContent(a:InteractionSnapshot,b:InteractionSnapshot):boolean{
  if(!sameId(a.selected,b.selected)||!samePoint(a.active,b.active)||a.scrubbing!==b.scrubbing||!!a.pinned!==!!b.pinned)return false;
  if(a.shared===b.shared)return true;
  if(!a.shared||!b.shared||a.shared.key!==b.shared.key||a.shared.label!==b.shared.label||a.shared.rows.length!==b.shared.rows.length)return false;
  return a.shared.rows.every((row,i)=>{const other=b.shared!.rows[i]!;return row.seriesId===other.seriesId&&row.name===other.name&&row.color===other.color&&samePoint(row.point,other.point);});
}
