import {ownFan,ownFanValue,ownRegression,ownRegressionValue} from './uncertainty-scene.js';
import {ownStackGroups,ownMixedAxes,ownMixedRanges} from './composition-scene.js';
import {ownCircular,ownRadialSummary} from './circular-scene.js';
import {ownFlame,ownFlameValue,ownViolin,ownViolinValue} from './profile-scene.js';
import {ownDendrogram,ownDendrogramValue} from './dendrogram-scene.js';
import {ownParallel,ownParallelValue,parallelGridSvg} from './parallel-scene.js';
import {ownHeatmapScene,ownHeatmapPoint} from './heatmap-scene.js';
import {ownVennScene,ownVennPoint} from './venn-scene.js';
import {ownWordCloud,ownWordCloudGlyphs} from './wordcloud-scene.js';
import {ownTilemapScene,ownTilemapCells,ownTilemapPoint,tilemapCellsSvg} from './tilemap-scene.js';
import {ownContourSource,ownContourPoint,validateContourScene} from './contour-scene.js';
import {relationshipFamily,ownRelationshipPoint,validateRelationshipScene,relationshipAnnotations} from './relationship-scene.js';
import {ownTemporalObservation,ownTemporalSource} from './temporal-scene.js';
import {ownPictorialScene,ownPictorialPoint} from './pictorial-scene.js';
import {ownPictorialHit} from './pictorial-hit.js';
import {ownPolygon} from './polygon-hit.js';
import {ownPolarGrid,polarGridSvg} from './polar-grid.js';
import type { NativeScene,NativeMarkerStyle,NativeReferenceStyle,NativeReferenceBandStyle,NativePointAppearance,NativeAxisLabel } from './contracts.js';
import {ownComparisonScene,ownComparisonPoint} from './comparison-scene.js';
import {comparisonBackground,comparisonForeground,comparisonGrid} from './comparison-render.js';
import { identityKey } from './contracts.js';
import {validateNativePath} from './path-validation.js';
import {markerSvg,markerBatchSvg,resolveMarkerStyle} from './marker-style.js';
import {ownReferences,ownReferenceStyles,ownReferenceBands,ownReferenceBandStyles,ownPointAppearance,ownPrimitiveId,samePointAppearance,sameReferenceStyle,sameReferencePaint,sameReferenceBandStyle,sameReferenceBandPaint} from './scene-styles.js';
import {pointPaint,barPaintBatches,circlePaintBatches,referencePaint} from './scene-paint.js';

function ownTickValue({value,type}:Pick<NativeAxisLabel,'value'|'type'>):Pick<NativeAxisLabel,'value'|'type'>{
  if(value!==undefined&&!Number.isFinite(value)||type!==undefined&&type!=='number'&&type!=='time')throw Error('Invalid axis tick value');
  return {...(value===undefined?{}:{value}),...(type===undefined?{}:{type})};
}

function ownSecondaryGrid(scene:NativeScene):readonly NonNullable<NativeScene['secondaryGrid']>[number][]{
  if(scene.family!=='pareto'&&!(scene.family==='mixed'&&scene.mixedAxes)||!Array.isArray(scene.secondaryGrid)||scene.secondaryGrid.length>32)throw Error('Invalid secondary axis');
  return scene.secondaryGrid.map(g=>{if(!Number.isFinite(g.y)||g.y<0||g.y>scene.height||typeof g.label!=='string'||g.label.length>64)throw Error('Invalid secondary tick');return {y:g.y,label:g.label,...ownTickValue(g)};});
}
const color = /^#[\da-f]{6}$/i;
const path = /^[MLHVCSQTAZmlhvcsqtaz\d.,+\-\seE]*$/;
const owned = new WeakSet<object>();
const revisions = new WeakMap<NativeScene,{interaction:object;motion?:string;pointIds?:ReadonlySet<string>;legacyPointSeries?:ReadonlySet<string>;lastPaint?:Readonly<{signature:string;key:object}>}>();
const paintRevisions=new WeakMap<NativeScene,object>();
export type ScenePresentation = Readonly<{
  title?:string;description?:string;unit?:string;secondaryUnit?:string;
  series?:readonly Readonly<{id:string;name?:string;color?:string}>[];
  referenceStyles?:readonly NativeReferenceStyle[];
  referenceBandStyles?:readonly NativeReferenceBandStyle[];
  points?:readonly NativePointAppearance[];
}>;
/** Validate and own transport data once, never during each touch frame. */
export function ownScene(input: NativeScene): NativeScene {
  if (owned.has(input)) return input;
  if (input.observations.length > 10000 || input.series.length > 16 || (input.legend?.length??0)>16 || input.grid.length > (input.family==='xrange'?256:32) || input.labels.length > 64
    || (input.annotations?.length ?? 0)>(['sankey','timeline'].includes(input.family)?128:64) || (input.yLabels?.length??0)>(input.family==='xrange'?256:64)
    || input.series.reduce((n,s)=>n+(s.circles?.length??0)+(s.bars?.length??0),0)>10000
    || input.series.some(s => (s.circles?.length ?? 0)>10000 || (s.bars?.length ?? 0) > 10000 || ((s.path?.length ?? 0)+(s.areaPath?.length??0)+(s.nodePath?.length??0)) > 1000000)) {
    throw new Error('Unbounded native scene');
  }
  if(input.series.reduce((n,s)=>n+(s.path?.length??0)+(s.areaPath?.length??0)+(s.nodePath?.length??0),0)>2000000)throw Error('Unsupported or unbounded native scene');
  if(['vector','windbarb'].includes(input.family)&&input.observations.length>2048)throw Error('Directional point budget exceeded');
  if(input.family==='treemap'&&(input.observations.length>512||input.series.reduce((n,s)=>n+(s.bars?.length??0),0)>512))throw Error('Unbounded native hierarchy');
  if(['funnel','pyramid'].includes(input.family)&&input.observations.length>16)throw Error('Stage input limit');
  if(input.family==='sunburst'&&input.observations.length>512||['treegraph','organization','networkgraph'].includes(input.family)&&input.observations.length>128)throw Error('Hierarchy node budget exceeded');
  if(input.family==='sankey'&&(input.observations.length>640||input.observations.filter(point=>point.sankey?.type==='node').length>128||input.observations.filter(point=>point.sankey?.type==='link').length>512))throw Error('Sankey observation budget exceeded');
  if(input.family==='item'&&(input.observations.length>16||input.series.reduce((n,s)=>n+(s.circles?.length??0),0)>256||input.series.some(s=>!!s.path||!!s.areaPath||!!s.bars?.length)))throw Error('Item unit budget or geometry invalid');
  const bandDescriptor=Object.getOwnPropertyDescriptor(input,'referenceBands');
  if(bandDescriptor?.get||bandDescriptor?.set)throw Error('Invalid reference band property');
  const mixedRanges=input.mixedRanges?ownMixedRanges(input.mixedRanges,input):undefined;
  const circular=input.circular?ownCircular(input.circular,input):undefined,radialSummary=input.radialSummary?ownRadialSummary(input.radialSummary,input):undefined;
  const stackGroups=input.stackGroups?ownStackGroups(input.stackGroups,input):undefined,mixedAxes=input.mixedAxes?ownMixedAxes(input.mixedAxes,input):undefined;
  if(input.observations.some(p=>p.valueAxis!==undefined&&!mixedAxes)||input.secondaryUnit!==undefined&&(!mixedAxes||typeof input.secondaryUnit!=='string'||input.secondaryUnit.length>64))throw Error('Invalid mixed-axis presentation');
  const fan=input.family==='fan'?ownFan(input.fan!,input):undefined,regression=input.family==='regression'?ownRegression(input.regression!,input):undefined;
  if(input.family!=='fan'&&(input.fan||input.observations.some(p=>p.fan))||input.family!=='regression'&&(input.regression||input.observations.some(p=>p.regression)))throw Error('Uncertainty roles require their own family');
  const flame=input.family==='flame'?ownFlame(input.flame!,input):undefined;
  const violin=input.family==='violin'?ownViolin(input.violin!,input):undefined;
  if(input.family!=='flame'&&(input.flame||input.observations.some(p=>p.flame))||input.family!=='violin'&&(input.violin||input.observations.some(p=>p.violin)))throw Error('Profile/distribution roles require their declared family');
  const dendrogram=input.family==='dendrogram'?ownDendrogram(input.dendrogram!,input):undefined;
  if(input.family!=='dendrogram'&&(input.dendrogram||input.observations.some(p=>p.dendrogram)))throw Error('Dendrogram roles require their own family');
  const parallel=input.family==='parallel'?ownParallel(input.parallel!,input):undefined;
  if(input.family!=='parallel'&&(input.parallel||input.observations.some(p=>p.parallel)))throw Error('Parallel roles require the parallel family');
  const points=ownPointAppearance(input.points),pointColors=new Map((points??[]).map(point=>[identityKey(point),point.color]));
  if(points!==undefined&&!['waterfall','line','area','streamgraph','areaspline','spline','mixed','scatter','column','bar','bubble'].includes(input.family))throw Error('Point colors require a cartesian chart');
  const scene: NativeScene = {
    ...(fan?{fan}:{}),...(regression?{regression}:{}),...(flame?{flame}:{}),...(violin?{violin}:{}),...(dendrogram?{dendrogram}:{}),...(parallel?{parallel}:{}),...ownHeatmapScene(input),...ownVennScene(input),...ownWordCloud(input),
    ...ownContourSource(input),
    ...ownComparisonScene(input),
    ...ownPictorialScene(input),
    ...ownTilemapScene(input),
    ...ownTemporalSource(input),
    schema: input.schema, family: input.family, title: input.title, description: input.description,
    unit: input.unit, width: input.width, height: input.height,
    ...(input.clip?{clip:{x:input.clip.x,y:input.clip.y,width:input.clip.width,height:input.clip.height}}:{}),
    ...(input.distribution?{distribution:{derived:input.distribution.derived,sampleCount:input.distribution.sampleCount,...(input.distribution.mean===undefined?{}:{mean:input.distribution.mean}),...(input.distribution.sampleStandardDeviation===undefined?{}:{sampleStandardDeviation:input.distribution.sampleStandardDeviation})}}:{}),
    ...(circular?{circular}:{}),...(radialSummary?{radialSummary}:{}),...(stackGroups?{stackGroups}:{}),...(mixedAxes?{mixedAxes}:{}),...(mixedRanges?{mixedRanges}:{}),...(input.secondaryUnit===undefined?{}:{secondaryUnit:input.secondaryUnit}),
    ...(input.secondaryGrid?{secondaryGrid:ownSecondaryGrid(input)}:{}),
    ...(input.polarGrid?{polarGrid:ownPolarGrid(input)}:{}),
    ...(input.legend?{legend:input.legend.map(s=>({id:s.id,name:s.name,color:s.color,visible:s.visible}))}:{}),
    series: input.series.map(s => ({id: s.id, name: s.name, color: s.color,...ownWordCloudGlyphs(s),...ownTilemapCells(s,input),
      ...(s.path === undefined ? {} : {path: s.path}),
      ...(s.areaPath===undefined?{}:{areaPath:s.areaPath}),
      ...(s.nodePath===undefined?{}:{nodePath:s.nodePath}),
      ...(s.fill === undefined ? {} : {fill:s.fill}),
      ...(s.circles === undefined ? {} : {circles:s.circles.map(c=>{const pointId=ownPrimitiveId(c);return {...(pointId===undefined?{}:{pointId}),cx:c.cx,cy:c.cy,radius:c.radius};})}),
      ...(s.bars === undefined ? {} : {bars: s.bars.map(r => {const pointId=ownPrimitiveId(r);return {...(pointId===undefined?{}:{pointId}),x:r.x,y:r.y,width:r.width,height:r.height};})})})),
    observations: input.observations.map(p => ({...(p.valueAxis===undefined?{}:{valueAxis:p.valueAxis}),id: {seriesId: p.id.seriesId, pointId: p.id.pointId},
      ...(p.vector?{vector:{dx:p.vector.dx,dy:p.vector.dy}}:{}),...(p.wind?{wind:{direction:p.wind.direction}}:{}),...(p.yValue===undefined?{}:{yValue:p.yValue}),
      label: p.label, seriesName: p.seriesName, value: p.value,...(p.fan?{fan:ownFanValue(p.fan)}:{}),...(p.regression?{regression:ownRegressionValue(p.regression)}:{}),...(p.flame?{flame:ownFlameValue(p.flame)}:{}),...(p.violin?{violin:ownViolinValue(p.violin)}:{}),...(p.dendrogram?{dendrogram:ownDendrogramValue(p.dendrogram)}:{}),...(p.parallel?{parallel:ownParallelValue(p.parallel)}:{}),...ownHeatmapPoint(p,input.family),...ownVennPoint(p,input.family),...ownContourPoint(p,input.family),...ownComparisonPoint(p,input.family),...ownPictorialPoint(p,input.family),...ownTilemapPoint(p,input.family),...ownRelationshipPoint(p,input.family),...ownTemporalObservation(p,input.family),...(p.sankey?{sankey:p.sankey.type==='node'?{type:'node' as const,incoming:p.sankey.incoming,outgoing:p.sankey.outgoing,...(p.sankey.geometryOmitted?{geometryOmitted:true as const}:{})}:{type:'link' as const,from:p.sankey.from,to:p.sankey.to,fromLabel:p.sankey.fromLabel,toLabel:p.sankey.toLabel,...(p.sankey.geometryOmitted?{geometryOmitted:true as const}:{})}}:{}),...(p.node?{node:p.node.directed===false?{incoming:p.node.incoming,outgoing:p.node.outgoing,directed:false as const}:{incoming:p.node.incoming,outgoing:p.node.outgoing,depth:p.node.depth,...(p.node.directed?{directed:true as const}:{})}}:{}),...(p.stem?{stem:{x:p.stem.x,startY:p.stem.startY,endY:p.stem.endY}}:{}),...(p.minimumValue===undefined?{}:{minimumValue:p.minimumValue}),...(p.q1Value===undefined?{}:{q1Value:p.q1Value}),...(p.medianValue===undefined?{}:{medianValue:p.medianValue}),...(p.q3Value===undefined?{}:{q3Value:p.q3Value}),...(p.maximumValue===undefined?{}:{maximumValue:p.maximumValue}),...(p.lowValue===undefined?{}:{lowValue:p.lowValue}),...(p.highValue===undefined?{}:{highValue:p.highValue}), x: p.x, y: p.y, color: pointColors.get(identityKey(p.id))??p.color,
      ...(p.hit?{hit:p.hit.type==='compoundPolygon'?ownPictorialHit(p.hit,input.width,input.height):p.hit.type==='polygon'?ownPolygon(p.hit,input):p.hit.type==='sector'?{type:p.hit.type,cx:p.hit.cx,cy:p.hit.cy,radius:p.hit.radius,innerRadius:p.hit.innerRadius,start:p.hit.start,end:p.hit.end}:{type:p.hit.type,cx:p.hit.cx,cy:p.hit.cy,radius:p.hit.radius}}:{}),...(p.sizeValue===undefined?{}:{sizeValue:p.sizeValue}),...(p.xValue===undefined?{}:{xValue:p.xValue}),...(p.percentage===undefined?{}:{percentage:p.percentage}),...(p.valueUnit===undefined?{}:{valueUnit:p.valueUnit}),...(p.computedKind===undefined?{}:{computedKind:p.computedKind}),...(p.subtotal===undefined?{}:{subtotal:p.subtotal}),...(p.incomplete===undefined?{}:{incomplete:p.incomplete}),...(p.group?{group:{key:p.group.key,label:p.group.label,coordinate:p.group.coordinate}}:{})})),
    grid: input.grid.map(g => ({y: g.y, label: g.label,...ownTickValue(g)})), labels: input.labels.map(l => ({x: l.x, label: l.label,...ownTickValue(l)})),
    ...(input.annotations?{annotations:relationshipAnnotations(input).map(a=>({x:a.x,y:a.y,text:a.text,role:a.role,...(a.box?{box:{width:a.box.width,height:a.box.height,seriesId:a.box.seriesId}}:{}),...(a.stackTotal?{stackTotal:{value:a.stackTotal.value,sign:a.stackTotal.sign,...(a.stackTotal.percentage?{percentage:true as const}:{})}}:{})}))}:{}),
    ...(input.yLabels?{yLabels:input.yLabels.map(l=>({id:l.id,y:l.y,label:l.label}))}:{}),
    ...(input.references===undefined?{}:{references:ownReferences(input.references,input)!}),
    ...(bandDescriptor?.value===undefined?{}:{referenceBands:ownReferenceBands(bandDescriptor.value,input)!}),
    ...(points===undefined?{}:{points}),
  };
  const finite = (...xs: number[]) => xs.every(Number.isFinite);
  const text = (value: string, max: number) => typeof value === 'string' && value.length <= max;
  if(scene.clip&&(!['sankey','treegraph','organization','networkgraph','packedbubble'].includes(scene.family)||!finite(scene.clip.x,scene.clip.y,scene.clip.width,scene.clip.height)||scene.clip.x<0||scene.clip.y<0||scene.clip.width<=0||scene.clip.height<=0||scene.clip.x+scene.clip.width>scene.width||scene.clip.y+scene.clip.height>scene.height))throw Error('Invalid plot clip');
  const summary=scene.distribution;
  if(summary&&(!['histogram','bellcurve'].includes(scene.family)||summary.derived!==true||!Number.isInteger(summary.sampleCount)||summary.sampleCount<0||summary.sampleCount>10000||summary.mean!==undefined&&!Number.isFinite(summary.mean)||summary.sampleStandardDeviation!==undefined&&(!Number.isFinite(summary.sampleStandardDeviation)||summary.sampleStandardDeviation<0)))throw Error('Invalid distribution summary');
  if (scene.schema !== 'nc-native-scene/0' || !['fan','regression','flame','violin','dendrogram','parallel','heatmap','venn','wordcloud','pictorial','tilemap','contour','dependencywheel','arcdiagram','chord','bullet','variwide','xrange','timeline','sankey','vector','windbarb','networkgraph','packedbubble','sunburst','treegraph','organization','variablepie','item','polygon','areaspline','lollipop','dumbbell','columnpyramid','boxplot','errorbar','arearange','areasplinerange','columnrange','histogram','bellcurve','funnel','pyramid','pareto','radar','polar','windrose','radialbar','treemap','waterfall','line','area','streamgraph','areaspline','spline','mixed','scatter','column','bar','pie','donut','gauge','bubble'].includes(scene.family)
    || !finite(scene.width, scene.height) || scene.width <= 0 || scene.height <= 0
    || scene.width > 10000 || scene.height > 10000 || scene.observations.length > 10000
    || scene.series.length > 16 || scene.grid.length > (scene.family==='xrange'?256:32) || scene.labels.length > 64
    || !text(scene.title, scene.family==='pictorial'?512:scene.family==='tilemap'?512:200) || !text(scene.description, scene.family==='pictorial'?2048:scene.family==='tilemap'?2048:1000) || !text(scene.unit, 64)
    || scene.series.reduce((n, s) => n + ((s.path?.length ?? 0)+(s.areaPath?.length??0)+(s.nodePath?.length??0)), 0) > 2000000) {
    throw new Error('Unsupported or unbounded native scene');
  }
  validateRelationshipScene(scene);
  validateContourScene(scene);
  const ids = new Set<string>();
  const groups=new Map<string,{label:string;coordinate:number}>();
  const groupCoordinates=new Map<number,string>();
  const groupSeries=new Map<string,Set<string>>();
  const legendIds=new Set<string>();
  for(const item of scene.legend??[]){if(!item.id||!text(item.id,['pictorial','tilemap','contour','xrange','timeline'].includes(scene.family)?256:128)||legendIds.has(item.id)||!text(item.name,['venn','wordcloud','pictorial','tilemap','xrange','timeline','sankey','dependencywheel','arcdiagram','chord'].includes(scene.family)?256:200)||!color.test(item.color)||typeof item.visible!=='boolean')throw new Error('Invalid native legend');legendIds.add(item.id);}
  const seriesIds = new Set<string>();
  const primitiveIds=new Set<string>();
  const secondEndpoints=new Set<string>();
  const itemCounts=scene.family==='item'?new Map<string,number>():null;
  const legacyPointSeries=new Set<string>();
  const validCircle=(c:Readonly<{cx:number;cy:number;radius:number}>):boolean=>{if(!finite(c.cx,c.cy,c.radius)||c.radius<0)return false;const clip=scene.clip;if(scene.family==='packedbubble'&&clip)return c.radius<=8*Math.max(scene.width,scene.height)&&Math.hypot(c.cx-Math.max(clip.x,Math.min(clip.x+clip.width,c.cx)),c.cy-Math.max(clip.y,Math.min(clip.y+clip.height,c.cy)))<=c.radius;return c.cx>=0&&c.cx<=scene.width&&c.cy>=0&&c.cy<=scene.height&&c.radius<=Math.max(scene.width,scene.height);};
  if(scene.family==='windbarb'&&scene.unit!=='m/s')throw Error('Wind speed unit must be m/s');
  if(scene.family==='packedbubble'&&(scene.observations.length>256||scene.series.reduce((n,s)=>n+(s.circles?.length??0),0)>256))throw Error('Packed bubble point budget exceeded');
  const primitiveId=(seriesId:string,pointId:string|undefined,type:'circle'|'bar')=>{if(pointId===undefined){if(itemCounts)throw Error('Item units require source identity');return;}if(!text(pointId,['pictorial','tilemap','contour','xrange','timeline'].includes(scene.family)?256:128)||!pointId)throw Error('Invalid primitive point ID');const key=identityKey({seriesId,pointId});if(itemCounts){if(type!=='circle')throw Error('Item units must be circles');itemCounts.set(key,(itemCounts.get(key)??0)+1);}if(primitiveIds.has(key)&&!itemCounts){if(scene.family!=='dumbbell'||type!=='circle'||secondEndpoints.has(key))throw Error('Duplicate primitive point ID');secondEndpoints.add(key);}primitiveIds.add(key);};
  for (const s of scene.series) {
    if (!s.id || !text(s.id, ['pictorial','tilemap','contour','xrange','timeline'].includes(scene.family)?256:128) || !text(s.name, ['venn','wordcloud','pictorial','tilemap','xrange','timeline','sankey','dependencywheel','arcdiagram','chord'].includes(scene.family)?256:200) || seriesIds.has(s.id) || !color.test(s.color)
      || (s.path !== undefined && (s.path.length > 1000000 || !path.test(s.path)))) {
      throw new Error('Invalid native series');
    }
    seriesIds.add(s.id);
    if(s.fill!==undefined && typeof s.fill!=='boolean') throw new Error('Invalid fill');
    for(const c of s.circles??[]){if(c.pointId===undefined)legacyPointSeries.add(s.id);primitiveId(s.id,c.pointId,'circle');if(!validCircle(c))throw new Error('Invalid circle');}
    if(s.path)validateNativePath(s.path,scene.width,scene.height);
    if(s.nodePath!==undefined){if(!relationshipFamily(scene.family)||typeof s.nodePath!=='string'||s.nodePath.length>1000000||!path.test(s.nodePath))throw Error('Invalid relationship node path');validateNativePath(s.nodePath,scene.width,scene.height);}
    if(s.areaPath!==undefined){if(!['fan','violin','pictorial','dependencywheel','arcdiagram','chord','sankey','vector','windbarb','polygon','radar','area','streamgraph','areaspline','arearange','areasplinerange','mixed'].includes(scene.family)||typeof s.areaPath!=='string'||s.areaPath.length>1000000||!path.test(s.areaPath))throw Error('Invalid area path');validateNativePath(s.areaPath,scene.width,scene.height);}
    if ((s.bars?.length ?? 0) > 10000) throw new Error('Unbounded bars');
    for (const r of s.bars ?? []) {
      primitiveId(s.id,r.pointId,'bar');
      if(r.pointId===undefined)legacyPointSeries.add(s.id);
      if (!finite(r.x, r.y, r.width, r.height) || r.x < 0 || r.y < 0 || r.width < 0 || r.height < 0
        || r.x + r.width > scene.width || r.y + r.height > scene.height) throw new Error('Invalid bar');
    }
  }
  for (const p of scene.observations) {
    const key = identityKey(p.id);
    if (!p.id.pointId || !text(p.id.pointId, scene.family==='contour'?1024:['pictorial','tilemap','xrange','timeline'].includes(scene.family)?256:128) || !text(p.label, ['heatmap','venn'].includes(scene.family)?1024:scene.family==='wordcloud'?512:scene.family==='pictorial'?256:scene.family==='tilemap'?512:relationshipFamily(scene.family)?515:scene.family==='sankey'?2051:scene.family==='timeline'?512:['bullet','variwide','xrange'].includes(scene.family)?256:200) || !text(p.seriesName, scene.family==='venn'?1024:['venn','wordcloud','pictorial','tilemap','xrange','timeline','sankey','dependencywheel','arcdiagram','chord'].includes(scene.family)?256:200)
      || !seriesIds.has(p.id.seriesId) || ids.has(key) || !color.test(p.color)
      || !finite(p.value, p.x, p.y) || p.x < 0 || p.x > scene.width || p.y < 0 || p.y > scene.height) {
      throw new Error('Invalid or duplicate native observation');
    }
    ids.add(key);
    if(['treegraph','organization','networkgraph'].includes(scene.family)||p.node!==undefined){
      const node=p.node;
      if(!node||!['treegraph','organization','networkgraph'].includes(scene.family)||![node.incoming,node.outgoing].every(Number.isInteger)||node.incoming<0||node.outgoing<0||node.incoming>512||node.outgoing>512||(scene.family==='networkgraph'?(node.directed!==false||node.depth!==undefined):(node.directed===false||!Number.isInteger(node.depth)||node.depth<0||node.depth>127))||p.value!==node.incoming+node.outgoing)throw Error('Invalid computed node metrics');
    }
    if(itemCounts&&(!Number.isSafeInteger(p.value)||p.value<0||p.value>256||(itemCounts.get(key)??0)!==p.value))throw Error('Item count does not match exact units');
    if(p.stem&&(!['lollipop','dumbbell'].includes(scene.family)||!finite(p.stem.x,p.stem.startY,p.stem.endY)||p.stem.x<0||p.stem.x>scene.width||p.stem.startY<0||p.stem.startY>scene.height||p.stem.endY<0||p.stem.endY>scene.height))throw Error('Invalid stem geometry');
    if(scene.family==='boxplot'||p.minimumValue!==undefined||p.q1Value!==undefined||p.medianValue!==undefined||p.q3Value!==undefined||p.maximumValue!==undefined){
      const five=[p.minimumValue,p.q1Value,p.medianValue,p.q3Value,p.maximumValue];
      if(scene.family!=='boxplot'||five.some(v=>!Number.isFinite(v))||five.some((v,i)=>i>0&&v!<five[i-1]!)||p.lowValue!==p.minimumValue||p.highValue!==p.maximumValue||p.value!==p.medianValue)throw Error('Invalid five-number semantics');
    }
    if((p.lowValue!==undefined||p.highValue!==undefined)&&(!(scene.mixedRanges&&scene.family==='mixed')&&!['fan','dumbbell','boxplot','errorbar','arearange','areasplinerange','columnrange','histogram'].includes(scene.family)||!Number.isFinite(p.lowValue)||!Number.isFinite(p.highValue)||p.lowValue!>p.highValue!))throw Error('Invalid interval semantics');
    if(p.subtotal!==undefined&&(!['treemap','sunburst'].includes(scene.family)||typeof p.subtotal!=='boolean'))throw Error('Invalid hierarchy semantics');
    if(p.incomplete!==undefined&&(!['windrose','pictorial','dependencywheel','arcdiagram','chord','sankey','treemap','sunburst'].includes(scene.family)||typeof p.incomplete!=='boolean'||scene.family==='sankey'&&p.sankey?.type!=='node'))throw Error('Invalid incomplete semantics');
    if(p.valueUnit!==undefined&&(scene.family!=='pareto'||p.valueUnit!=='%'))throw Error('Invalid value unit');
    if(p.computedKind!==undefined&&(scene.family!=='waterfall'||!['subtotal','total'].includes(p.computedKind)))throw Error('Invalid computed flow value');
    if(p.sizeValue!==undefined&&(!Number.isFinite(p.sizeValue)||p.sizeValue<0))throw new Error('Invalid size');
    if(scene.family==='sankey'||p.sankey!==undefined){
      const flow=p.sankey;if(scene.family!=='sankey'||!flow||flow.geometryOmitted!==undefined&&flow.geometryOmitted!==true||flow.geometryOmitted===true&&p.hit!==undefined)throw Error('Invalid Sankey semantics');
      if(flow.type==='node'){if(!finite(flow.incoming,flow.outgoing)||flow.incoming<0||flow.outgoing<0||p.value!==Math.max(flow.incoming,flow.outgoing))throw Error('Invalid Sankey throughput');}
      else if(flow.type!=='link'||!text(flow.from,128)||!text(flow.to,128)||flow.from===flow.to||!text(flow.fromLabel,1024)||!text(flow.toLabel,1024)||p.value<=0)throw Error('Invalid Sankey link');
    }
    if(p.vector!==undefined&&(scene.family!=='vector'||!finite(p.vector.dx,p.vector.dy)||p.yValue===undefined||!Number.isFinite(p.yValue)||Math.hypot(p.vector.dx,p.vector.dy)!==p.value))throw Error('Invalid vector semantics');
    if(scene.family==='vector'&&!p.vector||p.yValue!==undefined&&scene.family!=='vector')throw Error('Missing vector metadata');
    if(p.wind!==undefined&&(scene.family!=='windbarb'||p.value<0||p.value>150||p.wind.direction!==null&&(!finite(p.wind.direction)||p.wind.direction<0||p.wind.direction>=360)))throw Error('Invalid wind semantics');
    if(scene.family==='windbarb'&&!p.wind)throw Error('Missing wind metadata');
    if(p.xValue!==undefined&&!Number.isFinite(p.xValue))throw new Error('Invalid x value');
    if(p.percentage!==undefined&&(!Number.isFinite(p.percentage)||p.percentage<0||p.percentage>100))throw new Error('Invalid percentage');
    if(p.group&&(!['fan','parallel','bullet','variwide','histogram','bellcurve','lollipop','dumbbell','columnpyramid','boxplot','errorbar','arearange','areasplinerange','columnrange','pareto','line','area','streamgraph','areaspline','spline','mixed','column','bar'].includes(scene.family)||!text(p.group.key,256)||!p.group.key||!text(p.group.label,['bullet','variwide'].includes(scene.family)?256:200)||!finite(p.group.coordinate)||p.group.coordinate<0||p.group.coordinate>((scene.family==='bar'||scene.family==='bullet'&&scene.bulletOrientation==='horizontal')?scene.height:scene.width)))throw new Error('Invalid observation group');
    if(p.group){const coordinateKey=groupCoordinates.get(p.group.coordinate);if(coordinateKey!==undefined&&coordinateKey!==p.group.key)throw new Error('Ambiguous observation group coordinate');groupCoordinates.set(p.group.coordinate,p.group.key);const previous=groups.get(p.group.key);if(previous&&(previous.coordinate!==p.group.coordinate||previous.label!==p.group.label))throw new Error('Inconsistent observation group');groups.set(p.group.key,p.group);const members=groupSeries.get(p.group.key)??new Set<string>();if(members.has(p.id.seriesId))throw new Error('Duplicate series in observation group');members.add(p.id.seriesId);groupSeries.set(p.group.key,members);}
    const h=p.hit;
    if(h&&h.type!=='polygon'&&h.type!=='compoundPolygon'){
      if(!['circle','sector'].includes(h.type)||!validCircle(h))throw new Error('Invalid hit region');
      if(h.type==='sector'&&(!finite(h.innerRadius,h.start,h.end)||h.innerRadius<0||h.innerRadius>h.radius||h.end<h.start||h.end-h.start>Math.PI*2+1e-10))throw new Error('Invalid sector');
      if(h.type==='circle'&&h.radius>256&&scene.family!=='packedbubble')throw new Error('Unbounded circle hit region');
    }
  }
  for(const key of primitiveIds)if(!ids.has(key))throw Error('Primitive point ID has no observation');
  for(const point of points??[]){if(!ids.has(identityKey(point)))throw Error('Unknown point color identity');if(legacyPointSeries.has(point.seriesId))throw Error('Explicit primitive pointId is required for point colors');}
  if(['variablepie','pie','donut','gauge'].includes(scene.family)){
    const sectors=scene.observations.flatMap(p=>p.hit?.type==='sector'?[p.hit]:[]);
    const frame=sectors[0];
    if(frame&&sectors.some(h=>h.cx!==frame.cx||h.cy!==frame.cy||(scene.family!=='variablepie'&&h.radius!==frame.radius)||h.innerRadius!==frame.innerRadius))throw new Error('Invalid shared radial frame');
    const ordered=[...sectors].sort((a,b)=>a.start-b.start);
    if(ordered.some((h,i)=>i>0&&h.start<ordered[i-1]!.end-1e-10))throw new Error('Overlapping sectors');
    if(ordered.length&&ordered.at(-1)!.end-ordered[0]!.start>Math.PI*2+1e-10)throw new Error('Invalid radial turn');
  }
  for(const a of scene.annotations??[])if(a.stackTotal&&(!['column','bar','area','areaspline'].includes(scene.family)||!Number.isFinite(a.stackTotal.value)||!['positive','negative'].includes(a.stackTotal.sign)||a.stackTotal.percentage!==undefined&&a.stackTotal.percentage!==true))throw Error('Invalid stack total');
  for(const a of scene.annotations??[])if(a.box&&(!['flame','dendrogram','heatmap','venn','contour','dependencywheel','arcdiagram','chord','timeline','sankey','sunburst','treemap','treegraph','organization','networkgraph','packedbubble'].includes(scene.family)||!finite(a.box.width,a.box.height)||a.box.width<=0||a.box.height<=0||a.x-a.box.width/2<0||a.x+a.box.width/2>scene.width||a.y-a.box.height/2<0||a.y+a.box.height/2>scene.height||!seriesIds.has(a.box.seriesId)))throw Error('Invalid annotation box');
  for (const g of scene.grid) if (!finite(g.y) || g.y < 0 || g.y > scene.height || !text(g.label, 128)) throw new Error('Invalid grid');
  for (const l of scene.labels) if (!finite(l.x) || l.x < 0 || l.x > scene.width || !text(l.label,scene.family==='heatmap'?512:['pictorial','bullet','variwide'].includes(scene.family)?256:128)) throw new Error('Invalid label');
  for(const a of scene.annotations??[])if(!finite(a.x,a.y)||a.x<0||a.x>scene.width||a.y<0||a.y>scene.height||!text(a.text,200)||!['value','label'].includes(a.role))throw new Error('Invalid annotation');
  const labelIds=new Set<string>();
  for(const l of scene.yLabels??[]){if(!text(l.id,['bullet','variwide','xrange','timeline'].includes(scene.family)?256:128)||!l.id||labelIds.has(l.id)||!finite(l.y)||l.y<0||l.y>scene.height||!text(l.label,scene.family==='heatmap'?512:['bullet','variwide','xrange'].includes(scene.family)?256:128))throw new Error('Invalid category label');labelIds.add(l.id);}
  // Deep freeze only owned data. Consumer objects and arrays remain untouched.
  const freeze = (value: object): void => {
    for (const child of Object.values(value)) if (child && typeof child === 'object') freeze(child);
    Object.freeze(value);
  };
  freeze(scene);
  owned.add(scene);
  revisions.set(scene,{interaction:{},legacyPointSeries});
  paintRevisions.set(scene,{});
  return scene;
}

/** Internal revision tokens survive safe presentation updates, never untrusted input objects. */
export function sceneInteractionKey(scene:NativeScene):object{return revisions.get(ownScene(scene))!.interaction;}
/** Text-only revisions do not invalidate rendered geometry; colour changes still do. */
export function sameScenePaint(a:NativeScene,b:NativeScene):boolean{
  return sceneInteractionKey(a)===sceneInteractionKey(b)&&paintRevisions.get(a)===paintRevisions.get(b);
}
export function sceneMotionSignature(scene:NativeScene):string{
  scene=ownScene(scene);const revision=revisions.get(scene)!;
  return revision.motion??=JSON.stringify({series:scene.series.map(({path,areaPath,nodePath,bars,circles,fill,cells,textGlyphs})=>({path,areaPath,nodePath,bars,circles,fill,cells,textGlyphs})),bulletBands:scene.bulletBands,bulletTargets:scene.bulletTargets});
}

/** Update bounded presentation without planning, copying geometry or rebuilding hit indices. */
export function updateScenePresentation(input:NativeScene,patch:ScenePresentation):NativeScene{
  const scene=ownScene(input),validText=(v:unknown,max:number)=>typeof v==='string'&&v.length<=max;
  if((patch.title!==undefined&&!validText(patch.title,200))||(patch.description!==undefined&&!validText(patch.description,1000))||(patch.unit!==undefined&&!validText(patch.unit,64))||(patch.secondaryUnit!==undefined&&(!scene.mixedAxes||!validText(patch.secondaryUnit,64)))||(patch.series?.length??0)>16)throw new Error('Invalid scene presentation');
  const changes=new Map<string,Readonly<{id:string;name?:string;color?:string}>>();
  // Structural connectors are a stable paint role, even when filtering leaves no
  // visible edges. They never become an independent legend or hidden-series ID.
  const structuralLinks=['treegraph','organization','networkgraph'].includes(scene.family);
  for(const item of patch.series??[]){
    const knownId=scene.series.some(series=>series.id===item.id)||scene.legend?.some(series=>series.id===item.id)||scene.regression?.models.some(m=>m.fitSeriesId===item.id)||(structuralLinks&&item.id==='links');
    if(changes.has(item.id)||!knownId||(item.name!==undefined&&!validText(item.name,['venn','pictorial'].includes(scene.family)?256:200))||(item.color!==undefined&&!color.test(item.color)))throw new Error('Invalid series presentation');
    changes.set(item.id,item);
  }
  const title=patch.title??scene.title,description=patch.description??scene.description,unit=patch.unit??scene.unit,secondaryUnit=patch.secondaryUnit??scene.secondaryUnit;
  const radial=['sunburst','variablepie','item','funnel','pyramid','polar','windrose','radialbar','pie','donut','gauge'].includes(scene.family);
  if(patch.points!==undefined&&(radial||scene.family==='tilemap'||scene.family==='heatmap'))throw Error('Point colors require a cartesian chart');
  const points=patch.points===undefined?scene.points:ownPointAppearance(patch.points),pointsChanged=!samePointAppearance(points,scene.points);
  if(points?.length){
    const revision=revisions.get(scene)!,ids=revision.pointIds??=new Set(scene.observations.map(point=>identityKey(point.id)));
    for(const point of points){if(!ids.has(identityKey(point)))throw Error('Unknown point color identity');if(revision.legacyPointSeries?.has(point.seriesId))throw Error('Explicit primitive pointId is required for point colors');}
  }
  const referenceStyles=patch.referenceStyles===undefined?undefined:ownReferenceStyles(patch.referenceStyles);
  if(referenceStyles?.some(style=>!scene.references?.some(reference=>reference.id===style.id)))throw Error('Unknown reference style ID');
  const references=referenceStyles===undefined?scene.references:scene.references?.map(reference=>{
    const style=referenceStyles.find(style=>style.id===reference.id)??{id:reference.id};
    const role=reference.valueAxis===undefined?{}:{valueAxis:reference.valueAxis};
    const next=reference.status==='visible'?{...style,...role,axis:reference.axis,status:'visible' as const,line:reference.line}:{...style,...role,axis:reference.axis,status:reference.status};
    return sameReferenceStyle(reference,next)?reference:Object.freeze(next);
  });
  const referencesChanged=references?.some((reference,index)=>reference!==scene.references?.[index])??false;
  const bandStyles=patch.referenceBandStyles===undefined?undefined:ownReferenceBandStyles(patch.referenceBandStyles);
  if(bandStyles?.some(style=>!scene.referenceBands?.some(band=>band.id===style.id)))throw Error('Unknown reference band style ID');
  const referenceBands=bandStyles===undefined?scene.referenceBands:scene.referenceBands?.map(band=>{
    const {label:_label,color:_color,opacity:_opacity,...geometry}=band,style=bandStyles.find(style=>style.id===band.id)??{id:band.id},next={...geometry,...style};
    return sameReferenceBandStyle(band,next)?band:Object.freeze(next);
  });
  const bandsChanged=referenceBands?.some((band,index)=>band!==scene.referenceBands?.[index])??false;
  let changed=title!==scene.title||description!==scene.description||unit!==scene.unit||secondaryUnit!==scene.secondaryUnit||pointsChanged||referencesChanged||bandsChanged;
  const series=scene.series.map(s=>{const p=changes.get(s.id),name=p?.name??((scene.family==='flame'||scene.family==='dendrogram'||scene.family==='gauge')&&s.name===scene.title?title:s.name),nextColor=p?.color??s.color;if(name===s.name&&nextColor===s.color)return s;changed=true;return Object.freeze({...s,name,color:nextColor});});
  const legend=scene.legend?.map(s=>{const p=changes.get(s.id),name=p?.name??s.name,nextColor=p?.color??s.color;if(name===s.name&&nextColor===s.color)return s;changed=true;return Object.freeze({...s,name,color:nextColor});});
  if(!changed)return scene;
  const byId=new Map(series.map(s=>[s.id,s]));
  const pointColors=new Map((points??[]).map(point=>[identityKey(point),point.color]));
  const observations=!pointsChanged&&![...changes.values()].some(change=>change.name!==undefined)&&series.every((s,i)=>s===scene.series[i])&&(!radial&&scene.family!=='flame'&&scene.family!=='dendrogram'||title===scene.title)?scene.observations:scene.observations.map(p=>{const s=byId.get(p.id.seriesId)!,label=p.venn?p.venn.sets.map(id=>legend?.find(set=>set.id===id)?.name??id).join(' ∩ '):scene.family==='gauge'&&p.label===scene.title?title:p.label,seriesName=p.venn?label:changes.get(p.id.seriesId)?.name??((radial||scene.family==='flame'||scene.family==='dendrogram')&&p.seriesName===scene.title?title:p.seriesName),color=scene.family==='tilemap'||scene.family==='heatmap'?p.color:pointColors.get(identityKey(p.id))??s.color;return label===p.label&&seriesName===p.seriesName&&color===p.color?p:Object.freeze({...p,label,seriesName,color});});
  const paintChanged=pointsChanged||series.some((item,index)=>item.color!==scene.series[index]!.color)||!!references?.some((item,index)=>!sameReferencePaint(item,scene.references![index]!))||!!referenceBands?.some((item,index)=>!sameReferenceBandPaint(item,scene.referenceBands![index]!));
  const result=Object.freeze({...scene,title,description,unit,...(secondaryUnit===undefined?{}:{secondaryUnit}),series:Object.freeze(series),observations:Object.freeze(observations),...(legend?{legend:Object.freeze(legend)}:{}),...(points===undefined?{}:{points:Object.freeze(points.map(point=>Object.freeze(point)))}),...(references===undefined?{}:{references:Object.freeze(references)}),...(referenceBands===undefined?{}:{referenceBands:Object.freeze(referenceBands)})});
  const revision=revisions.get(scene)!;
  let paintKey=paintRevisions.get(scene)!;
  if(paintChanged){
    // One bounded latest presentation, not a history of user color edits.
    // Reapplying metadata over the Core base must not repaint text-only changes.
    const signature=JSON.stringify([series.map(s=>[s.id,s.color]),points,references?.map(r=>[r.id,r.color,r.width,r.dash]),referenceBands?.map(b=>[b.id,b.color,b.opacity])]);
    paintKey=revision.lastPaint?.signature===signature?revision.lastPaint.key:{};
    revision.lastPaint={signature,key:paintKey};
  }
  owned.add(result);revisions.set(result,revision);paintRevisions.set(result,paintKey);return result;
}

/** Geometry only: text is always a native Text view, never an SVG/DOM text surrogate. */
export function sceneTransform(scene:NativeScene,viewport:Readonly<{width:number;height:number}>={width:scene.width,height:scene.height}){
  if(scene.circular){const b=scene.circular.bounds,scale=Math.min(viewport.width/b.width,viewport.height/b.height);return {sx:scale,sy:scale,x:(viewport.width-b.width*scale)/2-b.x*scale,y:(viewport.height-b.height*scale)/2-b.y*scale};}
  if(scene.family==='bubble'||scene.family==='scatter'){
    // Reserve the selected circle ring (three logical units on either side) and
    // one physical pixel of antialiasing. Do not fit individual observations:
    // zoomed data outside the frame must stay outside it.
    const scale=Math.min(Math.max(1,viewport.width-2)/(scene.width+6),Math.max(1,viewport.height-2)/(scene.height+6));
    return {sx:scale,sy:scale,x:(viewport.width-scene.width*scale)/2,y:(viewport.height-scene.height*scale)/2};
  }
  if((scene.family==='fan'||scene.family==='line'||scene.family==='area'||scene.family==='areaspline'||scene.family==='arearange'||scene.family==='areasplinerange'||scene.family==='bellcurve'||scene.family==='spline'||scene.family==='mixed')){
    // Markers are physical-size symbols: reserve their maximum radius + border
    // once for the whole frame, including axes and inverse hit coordinates.
    // Presentation changes therefore never move points or recalculate data.
    const x=Math.min(9,viewport.width/4),y=Math.min(9,viewport.height/4);
    return {sx:(viewport.width-2*x)/scene.width,sy:(viewport.height-2*y)/scene.height,x,y};
  }
  if(scene.family==='pie'||scene.family==='donut'||scene.family==='gauge'){
    const region=scene.observations.find(point=>point.hit?.type==='sector'&&point.hit.radius>0)?.hit;
    if(region?.type==='sector'){
      // The Core can reserve outer-label space that this native renderer does
      // not paint. Fit the actual circle, with an 8% inset on each side.
      const scale=Math.min(viewport.width,viewport.height)*.42/region.radius;
      return {sx:scale,sy:scale,x:viewport.width/2-region.cx*scale,y:viewport.height/2-region.cy*scale};
    }
  }
  const uniform=scene.parallel?.coordinates==='polar'||['venn','wordcloud','pictorial','tilemap','packedbubble','networkgraph','treegraph','arcdiagram','dependencywheel','chord','vector','windbarb','sunburst','variablepie','item','radar','polar','windrose','radialbar','pie','donut','gauge','bubble','scatter'].includes(scene.family);
  const scale=Math.min(viewport.width/scene.width,viewport.height/scene.height);
  const sx=uniform?scale:viewport.width/scene.width,sy=uniform?scale:viewport.height/scene.height;
  return {sx,sy,x:(viewport.width-scene.width*sx)/2,y:(viewport.height-scene.height*sy)/2};
}
export function sceneSvg(scene: NativeScene, gridColor: string, viewport?: Readonly<{width:number;height:number}>, showGrid=true, options:Readonly<{parallelAxes?:boolean;parallelTicks?:boolean;surfaceColor?:string;showMarkers?:boolean;strokeWidth?:number;markerSize?:number;markerStyle?:NativeMarkerStyle;layer?:'all'|'grid'|'series'|'references';seriesIds?:readonly string[]}>={}): string {
  scene = ownScene(scene);
  if (!color.test(gridColor)) throw new Error('Invalid grid color');
  if(options.surfaceColor!==undefined&&!color.test(options.surfaceColor))throw Error('Invalid surface color');
  const width = viewport?.width ?? scene.width, height = viewport?.height ?? scene.height;
  if (![width,height].every(Number.isFinite) || width <= 0 || height <= 0) throw new Error('Invalid SVG viewport');
  const transform=sceneTransform(scene,{width,height});
  const offset=transform.x||transform.y?`translate(${transform.x} ${transform.y}) `:'';
  // Prepare only the requested layer. In particular, every series redraw used
  // to build backgrounds, grid and target strings which were then discarded.
  const baseLayer=options.layer!=='series';
  const decorations=options.layer==='grid'||options.layer==='series'?'':comparisonForeground(scene,options.surfaceColor??'#FFFFFF',2.5/Math.sqrt(transform.sx*transform.sy));
  if(options.layer==='references')return `<svg viewBox="0 0 ${width} ${height}">${referencePaint(scene.references,transform)}${decorations?`<g transform="${offset}scale(${transform.sx} ${transform.sy})">${decorations}</g>`:''}</svg>`;
  const background=baseLayer?comparisonBackground(scene,options.surfaceColor)+(scene.pictorial?.backgroundPath?`<path d="${scene.pictorial.backgroundPath}" fill="${gridColor}" fill-opacity="0.42"/>`:''):'';
  let bandBackground='';
  if(baseLayer&&scene.referenceBands?.length){
    const surface=options.surfaceColor??'#FFFFFF',surfaceLightness=parseInt(surface.slice(1,3),16)+parseInt(surface.slice(3,5),16)+parseInt(surface.slice(5,7),16),bandColor=surfaceLightness<384?'#84B5FF':'#2C6DCD';
    bandBackground=scene.referenceBands.flatMap(band=>band.status==='visible'?[`<rect x="${band.box.x}" y="${band.box.y}" width="${band.box.width}" height="${band.box.height}" fill="${band.color??bandColor}" fill-opacity="${band.opacity??.12}"/>`]:[]).join('');
  }
  const grid=baseLayer&&showGrid?(scene.parallel?(options.parallelAxes===false?'':parallelGridSvg(scene.parallel,gridColor,options.parallelTicks!==false)):scene.family==='bullet'?comparisonGrid(scene,gridColor):scene.polarGrid?polarGridSvg(scene.polarGrid,gridColor):(scene.family==='bar'||scene.dendrogram?.orientation==='horizontal'?scene.labels.map(l=>`<path d="M${l.x} 0V${scene.height}" stroke="${gridColor}" stroke-width="1.5"/>`):scene.grid.map(g=>`<path d="M0 ${g.y}H${scene.width}" stroke="${gridColor}" stroke-width="1.5"/>`)).join('')):'';
  if(options.layer==='grid')return `<svg viewBox="0 0 ${width} ${height}"><g transform="${offset}scale(${transform.sx} ${transform.sy})">${background}${bandBackground}${grid}</g></svg>`;
  const strokeWidth=Math.max(1,Math.min(8,Number.isFinite(options.strokeWidth)?options.strokeWidth!:2))/Math.sqrt(transform.sx*transform.sy);
  const markerSize=Math.max(2,Math.min(12,Number.isFinite(options.markerSize)?options.markerSize!:6));
  const markerStyle=resolveMarkerStyle(options.markerStyle);
  const selected=options.seriesIds===undefined?null:new Set(options.seriesIds),paintSeries=selected?scene.series.filter(series=>selected.has(series.id)):scene.series;
  const paintObservations=selected?scene.observations.filter(point=>selected.has(point.id.seriesId)):scene.observations;
  const barBorder=scene.family==='histogram'||scene.family==='variwide'?` stroke="${options.surfaceColor??'#FFFFFF'}" stroke-width="${1/Math.sqrt(transform.sx*transform.sy)}" stroke-linejoin="miter"`:scene.family==='treemap'?` stroke="${gridColor}" stroke-width="1"`:'';
  const denseBars=paintSeries.reduce((n,s)=>n+(s.bars?.length??0),0)>256;
  const overrides=pointPaint(scene),paintColor=(seriesId:string,base:string,pointId:string|undefined)=>pointId===undefined?base:overrides.get(identityKey({seriesId,pointId}))??base;
  const areaFills=paintSeries.map(s=>s.areaPath?`<path d="${s.areaPath}" fill="${s.color}" fill-opacity="${scene.family==='pictorial'||scene.family==='vector'||scene.family==='windbarb'?1:scene.family==='sankey'||relationshipFamily(scene.family)?0.38:0.18}" stroke="none"/>`:'').join('');
  const surface=options.surfaceColor??'#FFFFFF';
  const connectorColor=parseInt(surface.slice(1,3),16)+parseInt(surface.slice(3,5),16)+parseInt(surface.slice(5,7),16)<384?'#94A3B8':'#64748B';
  const series=paintSeries.map(s=>{
    const path=s.path===undefined?'':`<path d="${s.path}" fill="${s.fill?s.color:'none'}" stroke="${scene.family==='waterfall'?connectorColor:s.fill&&scene.family==='sunburst'?(options.surfaceColor??'#FFFFFF'):s.color}" stroke-width="${scene.family==='waterfall'?1.25/Math.sqrt(transform.sx*transform.sy):s.fill?1:strokeWidth}" stroke-linecap="round" stroke-linejoin="round"/>`;
    const bars=denseBars?barPaintBatches(s.id,s.color,(s.bars??[]).filter(bar=>bar.width>0&&bar.height>0),overrides,scene.family==='boxplot'||barBorder!=='',Math.max(1/transform.sx,1/transform.sy)).map(([color,bars])=>`<path d="${bars.map(bar=>`M${bar.x} ${bar.y}h${bar.width}v${bar.height}h${-bar.width}Z`).join('')}" fill="${color}"${scene.family==='boxplot'?' fill-opacity="0.18"':''}${barBorder}/>`).join(''):(s.bars??[]).map(bar=>`<rect x="${bar.x}" y="${bar.y}" width="${bar.width}" height="${bar.height}" fill="${paintColor(s.id,s.color,bar.pointId)}"${scene.family==='boxplot'?' fill-opacity="0.18"':''}${barBorder}/>`).join('');
    const visibleCircles=(scene.family==='fan'||scene.family==='regression'||relationshipFamily(scene.family)?[]:s.circles??[]).filter(circle=>circle.radius>0);
    const circleOpacity=scene.family==='venn'?.45:.64;
    const circleSvg=(circle:(typeof visibleCircles)[number],color:string)=>`<circle cx="${circle.cx}" cy="${circle.cy}" r="${circle.radius}" fill="${color}" fill-opacity="${circleOpacity}" stroke="${color}" stroke-width="2"/>`;
    const circles=visibleCircles.length>256?circlePaintBatches(s.id,s.color,visibleCircles,overrides,1+Math.max(1/transform.sx,1/transform.sy)).map(([color,circles])=>circles.length===1?circleSvg(circles[0]!,color):`<path d="${circles.map(circle=>`M${circle.cx-circle.radius} ${circle.cy}A${circle.radius} ${circle.radius} 0 1 0 ${circle.cx+circle.radius} ${circle.cy}A${circle.radius} ${circle.radius} 0 1 0 ${circle.cx-circle.radius} ${circle.cy}Z`).join('')}" fill="${color}" fill-opacity="${circleOpacity}" stroke="${color}" stroke-width="2"/>`).join(''):visibleCircles.map(circle=>circleSvg(circle,paintColor(s.id,s.color,circle.pointId))).join('');
    return (s.cells?tilemapCellsSvg(s.cells):'')+(scene.family==='boxplot'?bars+path+circles:relationshipFamily(scene.family)?path+bars:path+bars+circles);
  }).join('');
  // Dense line markers add nodes without adding readable information. The path and all hit
  // observations remain intact; selection still paints its own full-size active marker.
  const markerBudget=Math.max(24,Math.min(512,Math.floor(width/8)));
  const lineSeries=new Set(paintSeries.filter(s=>s.path!==undefined).map(s=>s.id));
  const markerObservations=options.showMarkers===false?[]:scene.family==='fan'?paintObservations.filter(p=>p.fan?.type==='center'):scene.family==='regression'?paintObservations.filter(p=>p.regression?.type==='sample'):scene.family==='pareto'?paintObservations.filter(p=>p.id.seriesId==='cumulative'):scene.family==='mixed'?paintObservations.filter(p=>p.lowValue===undefined&&lineSeries.has(p.id.seriesId)):paintObservations;
  const markers = (scene.family==='fan'||scene.family==='regression')?(options.showMarkers===false?'':markerBatchSvg(markerObservations,transform,markerSize,markerStyle)):(scene.family==='pareto'||scene.family==='radar'||scene.family==='line'||scene.family==='area'||scene.family==='areaspline'||scene.family==='spline'||scene.family==='mixed') && options.showMarkers!==false && markerObservations.length<=markerBudget ? markerObservations.map(p => {const pointColor=overrides.get(identityKey(p.id));return markerSvg(transform.x+p.x*transform.sx,transform.y+p.y*transform.sy,markerSize,p.color,pointColor===undefined?markerStyle:{...markerStyle,fillColor:pointColor});}).join('') : '';
  // NgIcon preserves its viewBox aspect ratio. Match the actual native viewport,
  // then transform plot-local geometry so axes and hit coordinates stay aligned.
  const relationshipNodes=relationshipFamily(scene.family)?paintSeries.map(s=>`<path d="${s.nodePath??''}" fill="${s.color}"/>`+(s.circles??[]).filter(c=>c.radius>0).map(c=>`<circle cx="${c.cx}" cy="${c.cy}" r="${c.radius}" fill="${paintColor(s.id,s.color,c.pointId)}"/>`).join('')).join(''):'';
  const sourceClip=['sankey','treegraph','organization','networkgraph','packedbubble'].includes(scene.family)?scene.clip:undefined;
  // Paint may extend by half a node's stroke plus a physical antialias pixel.
  // Keep the data window untouched and retain clipping of off-window nodes.
  const bleed=['treegraph','networkgraph','packedbubble'].includes(scene.family)?1+1/Math.min(transform.sx,transform.sy):0;
  const clip=sourceClip?{x:sourceClip.x-bleed,y:sourceClip.y-bleed,width:sourceClip.width+2*bleed,height:sourceClip.height+2*bleed}:undefined;
  const clipId=clip?'nc-plot-'+[clip.x,clip.y,clip.width,clip.height].join('_').replace(/\./g,'d'):'';
  const definition=clip?`<defs><clipPath id="${clipId}"><rect x="${clip.x}" y="${clip.y}" width="${clip.width}" height="${clip.height}"/></clipPath></defs>`:'';
  return `<svg viewBox="0 0 ${width} ${height}">${definition}<g transform="${offset}scale(${transform.sx} ${transform.sy})"${clip?` clip-path="url(#${clipId})"`:''}>${options.layer==='series'?'':background+bandBackground+grid}${areaFills}${series}${relationshipNodes}${options.layer==='series'?'':decorations}</g>${markers}${options.layer==='series'?'':referencePaint(scene.references,transform)}</svg>`;
}
