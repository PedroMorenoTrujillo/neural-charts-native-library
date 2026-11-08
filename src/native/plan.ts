export type {PlanCircularOptions,PlanCircularFrame,PlanRadialSummary,PlanStackGroup,PlanStackGroupsLayout,PlanMixedAxesLayout,PlanMixedYAxisFrame,PlanMixedSeries,PlanFanSpec,PlanFanBand,PlanFanInterval,PlanFanPoint,PlanFanValue,PlanFanLayout,PlanRegressionSpec,PlanRegressionModel,PlanRegressionValue,PlanRegressionLayout} from '@neural-charts/core/plan';
import {flameNativeLabels} from './profile-labels.js';
import {nativeTimeAxisLabels} from './time-axis-labels.js';
import {nativeLogAxisLabels} from './log-axis-labels.js';
export type {PlanFlameSpec,PlanFlameSpan,PlanFlameValue,PlanFlameLayout,PlanViolinSpec,PlanViolinSample,PlanViolinGroup,PlanViolinValue,PlanViolinDensity,PlanViolinGroupFrame,PlanViolinLayout} from '@neural-charts/core/plan';
export type {PlanDendrogramSpec,PlanDendrogramNode,PlanDendrogramValue,PlanDendrogramLayout} from '@neural-charts/core/plan';
export type {PlanParallelSpec,PlanParallelAxis,PlanParallelPoint,PlanParallelSeries,PlanParallelValue,PlanParallelAxisFrame,PlanParallelLayout} from '@neural-charts/core/plan';
export type {PlanWindRoseSpec,PlanRadialBarSpec} from '@neural-charts/core/plan';
export type {PlanHeatmapCategory,PlanHeatmapAxis,PlanHeatmapCell,PlanHeatmapSpec,PlanHeatmapValue,PlanHeatmapSummary,PlanHeatmapBand,PlanHeatmapLayout,PlanHeatmapFrame,PlanHeatmapObservation,PlanHeatmapResult} from '@neural-charts/core/plan';
export type {PlanVennSpec,PlanVennSet,PlanVennMeasure,PlanVennSummary,PlanVennLayout,PlanVennValue,PlanVennCircle} from '@neural-charts/core/plan';
export type {PlanWordCloudSpec,PlanWordCloudWord,PlanWordCloudGroup,PlanWordCloudTextGlyph,PlanWordCloudMeasurement,PlanWordCloudMeasurementRequest,PlanWordCloudLayout,PlanWordCloudSummary} from '@neural-charts/core/plan';
export type {PlanContourSpec,PlanContourAxis,PlanContourGrid,PlanContourLevel,PlanContourValue,PlanContourSample,PlanContourLayout,PlanContourObservation,PlanContourFrame} from '@neural-charts/core/plan';
export type {PlanTilemapSpec,PlanTilemapPoint,PlanTilemapSeries,PlanTilemapValue,PlanTilemapSummary,PlanTilemapLayout,PlanColorAxisSpec,PlanColorAxisFrame,PlanCellPaint} from '@neural-charts/core/plan';
export type {PlanPictorialSpec,PlanPictorialPoint,PlanPictorialSeries,PlanPictorialShape,PlanPictorialMesh,PlanPictorialValue,PlanPictorialSummary} from '@neural-charts/core/plan';
export type {PlanBulletSpec,PlanBulletPoint,PlanBulletSeries,PlanBulletBand,PlanBulletValue,PlanBulletFrame,PlanVariwideSpec,PlanVariwidePoint,PlanVariwideSeries,PlanVariwideValue,PlanVariwideFrame} from '@neural-charts/core/plan';
export type {PlanTemporalAxis,PlanXRangeSpec,PlanXRangePoint,PlanXRangeRow,PlanXRangeSeries,PlanTimelineSpec,PlanTimelinePoint,PlanTimelineSeries,PlanIntervalValue,PlanTimelineEvent} from '@neural-charts/core/plan';
export type {PlanSankeySpec,PlanSankeyNode,PlanSankeyLink} from '@neural-charts/core/plan';
export type {PlanVectorSpec,PlanWindbarbSpec,PlanVectorPoint,PlanWindbarbPoint,PlanDirectionalSeries} from '@neural-charts/core/plan';
export type {PlanNetworkgraphSpec,PlanPackedBubbleSpec,PlanPackedBubblePoint,PlanPackedBubbleSeries,PlanSunburstSpec,PlanNodeGraphSpec,PlanTreegraphSpec,PlanOrganizationSpec,PlanHierarchyNode,PlanHierarchyLink,PlanHierarchyGroup,PlanVariablePieSpec,PlanVariablePiePoint,PlanItemSpec,PlanItemPoint,PlanPolygonSpec,PlanLollipopSpec,PlanDumbbellSpec,PlanColumnPyramidSpec,PlanBoxplotSpec,PlanErrorbarSpec,PlanBoxplotPoint,PlanBoxplotSeries,PlanErrorbarPoint,PlanErrorbarSeries,PlanStreamgraphSpec,PlanAreaSplineSpec,PlanRangeSpec,PlanRangeSeries,PlanRangePoint,PlanHistogramSpec,PlanBellcurveSpec,PlanDistributionSummary} from '@neural-charts/core/plan';
export type {PlanFunnelSpec,PlanPyramidSpec,PlanFunnelPoint} from '@neural-charts/core/plan';
export type {PlanParetoSpec} from '@neural-charts/core/plan';
import {hasPictorialFrameRoles,pictorialPaint} from './pictorial-paint.js';
import {isChartFamily} from '../library/chart-capabilities.js';
import {planChart, type PlanSpec as CorePlanSpec, type PlanOptions, type PlanCommand, type PlanResult,type PlanViewportState,type PlanObservation,type PlanTilemapFrame,type PlanWordCloudFrame,type PlanFrame,type PlanSeries} from '@neural-charts/core/plan';
import type {NativeScene,ChartFamily,HitRegion} from '../library/contracts.js';
/** Native support is explicit; future Core families are not exposed automatically. */
export type PlanSpec=Extract<CorePlanSpec,{family:ChartFamily}>;
export type {PlanRelationshipSpec,PlanRelationshipNode,PlanRelationshipLink,PlanRelationshipMetadata} from '@neural-charts/core/plan';
import {ownScene} from '../library/scene.js';

export type {PlanRadarSpec,PlanPolarSpec} from '@neural-charts/core/plan';
export type {PlanMixedSpec,PlanAreaSpec,PlanSplineSpec,PlanScatterSpec} from '@neural-charts/core/plan';
export type {PlanTreemapSpec,PlanTreemapNode} from '@neural-charts/core/plan';
export type {PlanWaterfallSpec,PlanWaterfallPoint,PlanWaterfallSeries} from '@neural-charts/core/plan';
export type {PlanLineSpec, PlanColumnSpec, PlanPieSpec, PlanDonutSpec, PlanGaugeSpec, PlanBubbleSpec, PlanOptions} from '@neural-charts/core/plan';
export {transformPlanViewport} from '@neural-charts/core/plan';
export type {PlanViewportValue,PlanViewportState,PlanViewportIntent,PlanViewportResult} from '@neural-charts/core/plan';
export type {PlanReference,PlanProjectedReference} from '@neural-charts/core/plan';
export type {PlanReferenceBand,PlanProjectedReferenceBand} from '@neural-charts/core/plan';
export type NativePlanningResult =
  | Readonly<{status:'ok'|'empty';scene:NativeScene;viewport?:PlanViewportState}>
  | Extract<PlanResult,{status:'invalid'}>;

/** Serialization only: domains, ticks, gaps and projection remain in the shared Core. */
function commandText(command: PlanCommand): string {
  switch(command.type){
    case 'M':case 'L':return `${command.type}${command.x} ${command.y}`;
    case 'A':return `A${command.radius} ${command.radiusY??command.radius} 0 ${command.largeArc} ${command.sweep} ${command.x} ${command.y}`;
    case 'Q':return `Q${command.cx} ${command.cy} ${command.x} ${command.y}`;
    case 'Z':return 'Z';
  }
}

class NativePathLimit extends Error {constructor(readonly seriesIndex:number,readonly wholeFrame=false){super('Native path budget exceeded');}}
/** Bound allocation while serializing, before creating a giant SVG string. */
function seriesPaths(series:PlanSeries,index:number,total:{remaining:number},areaOverride?:string):Readonly<{path?:string;areaPath?:string;nodePath?:string}>{
  let remaining=1000000;
  const consume=(length:number):void=>{remaining-=length;total.remaining-=length;if(remaining<0)throw new NativePathLimit(index);if(total.remaining<0)throw new NativePathLimit(index,true);};
  const serialize=(commands:readonly PlanCommand[]):string=>{
    const pieces:string[]=[];
    for(const command of commands){const text=commandText(command);consume(text.length);pieces.push(text);}
    return pieces.join('');
  };
  if(areaOverride!==undefined)consume(areaOverride.length);
  const path=series.commands?serialize(series.commands):undefined;
  const areaPath=areaOverride??(series.areaCommands?serialize(series.areaCommands):undefined);
  const nodePath=series.nodeCommands?serialize(series.nodeCommands):undefined;
  return {...(path===undefined?{}:{path}),...(areaPath===undefined?{}:{areaPath}),...(nodePath===undefined?{}:{nodePath})};
}

/** A dependency upgrade must not silently expose new geometry roles. */
function hasNativeHitRoles(points:readonly PlanObservation[],family:ChartFamily):points is readonly (PlanObservation&Readonly<{hit?:HitRegion}>)[]{
  return points.every(point=>!point.hit||point.hit.type==='circle'||point.hit.type==='sector'||point.hit.type==='polygon'||family==='pictorial'&&point.hit.type==='compoundPolygon');
}

function hasTilemapRoles(frame:PlanFrame):frame is PlanTilemapFrame{return frame.family==='tilemap'&&Array.isArray(frame.tilemapData)&&frame.tilemapLayout!==undefined&&frame.colorAxis!==undefined&&frame.series.every(series=>Array.isArray(series.cells));}

/** Public raw-data planning; the shared Core owns all numeric projection. */
export function planNativeChart(spec: PlanSpec, options: PlanOptions): NativePlanningResult {
  const descriptor=spec&&typeof spec==='object'?Object.getOwnPropertyDescriptor(spec,'family'):undefined;
  if(!descriptor||descriptor.get||descriptor.set||!isChartFamily(descriptor.value)||descriptor.value==='bar')return {status:'invalid',diagnostic:{code:'INVALID_CONFIG',reason:'UNSUPPORTED_NATIVE_FAMILY',path:'spec.family',message:'This chart family is not supported by the native renderer.'}};
  const result=planChart(spec,options);
  if(result.status==='invalid')return result;
  const {viewport,parallel:parallelFrame,...sourceFrame}=result.frame;
  const axes:unknown=Object.getOwnPropertyDescriptor(spec,'axes')?.value;
  const sourceX:unknown=axes&&typeof axes==='object'?Object.getOwnPropertyDescriptor(axes,'x')?.value:undefined;
  const timeAxis=!!sourceX&&typeof sourceX==='object'&&Object.getOwnPropertyDescriptor(sourceX,'type')?.value==='time';
  const frame={...sourceFrame,labels:nativeLogAxisLabels(nativeTimeAxisLabels(sourceFrame.labels,viewport,timeAxis),options.scales?.x?.type==='log'),grid:nativeLogAxisLabels(sourceFrame.grid,options.scales?.y?.type==='log')},family=frame.family;
  if(!isChartFamily(family))return {status:'invalid',diagnostic:{code:'INVALID_CONFIG',reason:'UNSUPPORTED_NATIVE_FAMILY',path:'frame.family',message:'This chart family is not supported by the native renderer.'}};
  try{
    const pathBudget={remaining:2000000};
    const sourceObservations=frame.observations;
    const wordcloudFrame=frame.family==='wordcloud'?frame as PlanWordCloudFrame:undefined;
    const wordcloud=wordcloudFrame?{status:'ready' as const,fontKey:options.wordcloudText?.fontKey??'',data:wordcloudFrame.wordcloudData,layout:wordcloudFrame.wordcloudLayout}:undefined;
    if(!hasNativeHitRoles(sourceObservations,family))throw Error('Unsupported native hit geometry');
    if(family==='tilemap'&&!hasTilemapRoles(frame))throw Error('Missing tilemap roles');
    const tilemap=hasTilemapRoles(frame)?{data:frame.tilemapData,layout:frame.tilemapLayout,colorAxis:frame.colorAxis}:undefined;
    if(family==='parallel'&&!parallelFrame)throw Error('Missing independent-axis roles');
    if(family==='heatmap'&&(!frame.heatmapData||!frame.heatmapLayout||!frame.colorAxis))throw Error('Missing exact heatmap roles');
    const heatmap=family==='heatmap'?{data:frame.heatmapData!,layout:frame.heatmapLayout!,colorAxis:frame.colorAxis!}:undefined;
    const axis=heatmap?.colorAxis??tilemap?.colorAxis;
    const classes=new Map(axis?.type==='classes'?axis.classes.map(c=>[c.id,c.label]):[]);
    if(family==='pictorial'&&!hasPictorialFrameRoles(frame))throw Error('Missing pictorial roles');
    const pictorialFrame=hasPictorialFrameRoles(frame)?frame:undefined;
    const paint=pictorialFrame?pictorialPaint(pictorialFrame,commands=>commands.map(commandText).join('')):undefined;
    const fills=new Map(paint?.series.map(series=>[series.id,series.fillPath]));
    const pictorial=pictorialFrame&&paint?{backgroundPath:paint.backgroundPath,glyphs:pictorialFrame.pictorialGlyphs.map(({backgroundCommands,...glyph})=>glyph),data:pictorialFrame.pictorialData,layout:pictorialFrame.pictorialLayout}:undefined;
    const observations=family==='heatmap'?sourceObservations.map(p=>({...p,...(p.heatmap?{heatmap:{...p.heatmap,...(p.heatmap.color.type==='class'?{classLabel:classes.get(p.heatmap.color.classId)}:{})}}:{})})):family==='tilemap'?sourceObservations.map(p=>({...p,...(p.tilemap?{tilemap:{...p.tilemap,...(p.tilemap.color.type==='class'?{classLabel:classes.get(p.tilemap.color.classId)}:{})}}:{})})):['xrange','timeline'].includes(family)?sourceObservations.map(({group,...point})=>point):sourceObservations;
    const scene=ownScene({...frame,...(spec.family==='bullet'?{automaticBulletBands:(spec.bands??[]).filter(band=>band.color===undefined).map(band=>band.id)}:{}),...(family==='flame'?{annotations:flameNativeLabels(frame)}:{}),parallel:parallelFrame?{coordinates:parallelFrame.coordinates,axes:parallelFrame.axes,path:parallelFrame.commands.map(commandText).join('')}:undefined,family,schema:'nc-native-scene/0',observations,...(heatmap?{heatmap,...(!heatmap.layout.rows.length||!heatmap.layout.columns.length?{labels:[],yLabels:[]}:{} )}:{}),...(family==='venn'?{venn:{data:frame.vennData!,layout:frame.vennLayout!}}:{}),...(wordcloud?{wordcloud}:{}),...(pictorial?{pictorial}:{}),...(tilemap?{tilemap}:{}),...(['sankey','treegraph','organization','networkgraph','packedbubble'].includes(frame.family)&&viewport?{clip:viewport.plot}:{}),...(frame.polarGrid?{polarGrid:{...frame.polarGrid,rings:frame.polarGrid.rings.map(({commands,...ring})=>({...ring,...(frame.family==='windrose'&&Object.getOwnPropertyDescriptor(spec,'stacking')?.value==='percent'?{label:ring.label+'%'}:{}),...(commands?{path:commands.map(commandText).join('')}:{})}))}}:{}),...(frame.family==='waterfall'?{points:frame.observations.map(point=>({...point.id,color:point.color}))}:{}),series:frame.series.map((series,index)=>({
      id:series.id,name:series.name,color:series.color,...(wordcloudFrame?{textGlyphs:wordcloudFrame.series.find(item=>item.id===series.id)?.textGlyphs??[]}:{}),...(series.cells?{cells:series.cells}:{}),
      ...seriesPaths(series,index,pathBudget,family==='pictorial'?fills.get(series.id)??'':undefined),
      ...(series.bars?{bars:series.bars}:{}),
      ...(series.fill===undefined?{}:{fill:series.fill}),
      ...(series.circles?{circles:series.circles}:{}),
    }))});
    return {status:result.status,scene,...(viewport?{viewport}:{})};
  }catch(error){
    if(error instanceof NativePathLimit)return {status:'invalid',diagnostic:{code:'INVALID_CONFIG',reason:'NATIVE_PATH_LIMIT',path:error.wholeFrame?'frame.series':'frame.series['+error.seriesIndex+']',message:'The projected geometry exceeds the native path budget. Reduce source density.'}};
    return {status:'invalid',diagnostic:{code:'INTERNAL_INVARIANT',reason:'NATIVE_SCENE_REJECTED',path:'frame',message:'The planned geometry could not be represented by the native scene contract.'}};
  }
}

export type {PlanCartesianMixedSpec,PlanMixedScalarSeries,PlanMixedRangeSeries,PlanMixedRangeLineSeries,PlanMixedRangeSpec,PlanMixedRangesLayout} from '@neural-charts/core/plan';
