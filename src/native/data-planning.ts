import type {PlanPictorialSpec} from '@neural-charts/core/plan';
import type {PlanTilemapSpec} from '@neural-charts/core/plan';
import {chartCapabilities,isChartFamily} from '../library/chart-capabilities.js';
import {planNativeChart,type PlanSpec,type PlanOptions,type PlanContourLevel,type PlanBulletBand,type NativePlanningResult} from './plan.js';
import type {NativeChartData} from './data-options.js';

/** Reject presentation fields instead of silently ignoring a second source of truth. */
export interface NativeShapePlanningOptions {readonly neckWidth?:number;readonly neckHeight?:number;readonly reversed?:boolean;}
export interface NativeRelationshipPlanningOptions {readonly startAngle?:number;readonly nodePadding?:number;readonly nodeWidth?:number;readonly reversed?:boolean;readonly nodeRadius?:number;readonly linkWidth?:number;}
export interface NativeComparisonPlanningOptions {readonly orientation?:'horizontal'|'vertical';readonly pointPadding?:number;readonly bands?:readonly PlanBulletBand[];}
export interface NativeSankeyPlanningOptions {readonly orientation?:'horizontal'|'vertical';readonly nodeWidth?:number;readonly nodePadding?:number;}
export function planChartData(data:NativeChartData,hiddenSeriesIds:readonly string[]=[],viewport?:Readonly<{width:number;height:number}>,calculation:Pick<PlanOptions,'stacking'|'stackGroups'|'viewport'|'references'|'referenceBands'|'scales'|'hierarchy'|'wordcloudText'>&Readonly<{radialDisplay?:PlanOptions['circular'];profile?:Readonly<{rowPadding?:number;bandwidth?:number;resolution?:number;normalization?:'width'|'area'|'count';gapRatio?:number}>;dendrogram?:Readonly<{orientation?:'horizontal'|'vertical'}>;parallel?:Readonly<{coordinates?:'cartesian'|'polar'}>;circular?:Readonly<{gapRatio?:number;innerRadiusRatio?:number;stacking?:'sum'|'percent'}>;heatmap?:Pick<import('./plan.js').PlanHeatmapSpec,'gapRatio'|'opacity'|'colorAxis'>;venn?:Readonly<{padding?:number}>;wordcloud?:import('./wordcloud-data.js').NativeWordCloudLayoutOptions;pictorial?:PlanPictorialSpec['pictorial'];tilemap?:Pick<PlanTilemapSpec,'tileShape'|'pointPadding'|'opacity'|'colorAxis'>;contour?:Readonly<{levels:readonly Pick<PlanContourLevel,'id'|'value'>[];segmentBudget?:number}>;relationship?:NativeRelationshipPlanningOptions;comparison?:NativeComparisonPlanningOptions;temporal?:Readonly<{grouping?:'grouped'|'overlap';rowPadding?:number;labelPosition?:'alternate'|'above'|'below';labelMaxWidth?:number;markerRadius?:number}>;sankey?:NativeSankeyPlanningOptions;shape?:NativeShapePlanningOptions;glyphs?:Readonly<{whiskerWidth?:number;capWidth?:number;markerRadius?:number;columns?:number;minRadiusRatio?:number;radiusScale?:'area'|'radius';splitSeries?:boolean}>}>={}):NativePlanningResult{
  const invalid=(path:string,message='Move presentation properties from data to supported options groups.',reason='PRESENTATION_IN_DATA'):NativePlanningResult=>({status:'invalid',diagnostic:{code:'INVALID_CONFIG',reason,path,message}});
  if(!data||typeof data!=='object')return invalid('data','Expected a typed chart data definition.','INVALID_DATA_TYPE');
  const descriptors=Object.getOwnPropertyDescriptors(data);
  if(Object.values(descriptors).some(d=>d.get||d.set))return invalid('data');
  if(Object.hasOwn(descriptors,'family'))return invalid('data.family','Use data.type as the chart discriminator. family is not a public data property.','LEGACY_DATA_DISCRIMINATOR');
  const type:unknown=descriptors['type']?.value;
  if(!isChartFamily(type)||type==='bar')return invalid('data.type','Expected a supported chart type.','INVALID_DATA_TYPE');
  if(type==='fan'){for(const key of ['centerName','centerColor'])if(Object.hasOwn(descriptors,key))return invalid('data.'+key);const bands=descriptors['bands']?.value;if(Array.isArray(bands)){if(bands.length>6)return invalid('data.bands','Maximum six uncertainty bands.','INPUT_LIMIT');for(let i=0;i<bands.length;i++){const b=Object.getOwnPropertyDescriptor(bands,String(i));if(b?.get||b?.set)return invalid('data.bands.'+i);if(b?.value&&Object.hasOwn(b.value,'color'))return invalid('data.bands.'+i+'.color');}}}
  if(type==='flame'&&Object.hasOwn(descriptors,'rowPadding'))return invalid('data.rowPadding','Use options.layout.rowPadding.');
  if(type==='violin'){for(const key of ['bandwidth','resolution','normalization','gapRatio'])if(Object.hasOwn(descriptors,key))return invalid('data.'+key,'Density settings belong to options.layout.');const groups=descriptors['groups']?.value;if(Array.isArray(groups)&&groups.length<=16)for(let i=0;i<groups.length;i++){const group=Object.getOwnPropertyDescriptor(groups,String(i))?.value;if(group&&Object.hasOwn(group,'color'))return invalid('data.groups.'+i+'.color');}}
  if(type==='dendrogram'&&Object.hasOwn(descriptors,'orientation'))return invalid('data.orientation','Use options.layout.orientation.');
  if(type==='parallel'&&Object.hasOwn(descriptors,'coordinates'))return invalid('data.coordinates','Use options.layout.coordinates.');
  if(type==='windrose'||type==='radialbar')for(const key of ['gapRatio','innerRadiusRatio','stacking'])if(Object.hasOwn(descriptors,key))return invalid('data.'+key,'Circular layout belongs to options.layout.');
  if(type==='heatmap')for(const key of ['gapRatio','opacity','colorAxis'])if(Object.hasOwn(descriptors,key))return invalid('data.'+key,'Cell spacing, opacity and colour scale belong to options.');
  if(type==='venn'&&Object.hasOwn(descriptors,'padding'))return invalid('data.padding','Set spacing belongs to options.layout.padding.');
  if(type==='wordcloud')for(const key of ['minFontSize','maxFontSize','padding','rotations','seed','maxWords'])if(Object.hasOwn(descriptors,key))return invalid('data.'+key,'Wordcloud font and packing settings belong to options.layout.');
  if(type==='pictorial'&&Object.hasOwn(descriptors,'pictorial'))return invalid('data.pictorial','Silhouette configuration belongs to options.layout.');
  if(type==='tilemap')for(const key of ['tileShape','pointPadding','opacity','colorAxis'])if(Object.hasOwn(descriptors,key))return invalid('data.'+key,'Tile shape and color scale belong to options.');
  if(type==='contour')for(const key of ['contour','levels','segmentBudget'])if(Object.hasOwn(descriptors,key))return invalid('data.'+key,'Isoline thresholds belong to options.layout.');
  if(type==='dependencywheel'||type==='arcdiagram'||type==='chord')for(const key of ['startAngle','nodePadding','nodeWidth','reversed','nodeRadius','linkWidth'])if(Object.hasOwn(descriptors,key))return invalid('data.'+key,'Relationship geometry belongs to options.layout.');
  if(type==='variablepie'||type==='item')for(const key of ['columns','minRadiusRatio','radiusScale'])if(Object.hasOwn(descriptors,key))return invalid('data.'+key,'Chart geometry belongs to options.layout.');
  if(type==='xrange'||type==='timeline')for(const key of ['grouping','rowPadding','labelPosition','labelMaxWidth','markerRadius'])if(Object.hasOwn(descriptors,key))return invalid('data.'+key,'Temporal geometry belongs to options.layout.');
  if(type==='bullet'||type==='variwide')for(const key of ['orientation','pointPadding','bands'])if(Object.hasOwn(descriptors,key))return invalid('data.'+key,'Comparison layout belongs to options.layout.');
  if(type==='packedbubble'&&Object.hasOwn(descriptors,'splitSeries'))return invalid('data.splitSeries','Use options.layout.splitSeries.');
  if(type==='funnel'||type==='pyramid')for(const key of ['neckWidth','neckHeight','reversed'])if(Object.hasOwn(descriptors,key))return invalid('data.'+key,'Shape geometry belongs to options.layout.');
  if(type==='boxplot'||type==='errorbar'||type==='lollipop'||type==='dumbbell')for(const key of ['whiskerWidth','capWidth','markerRadius'])if(Object.hasOwn(descriptors,key))return invalid('data.'+key,'Glyph dimensions belong to options.layout.');
  for(const key of ['title','description','color'])if(Object.hasOwn(data,key))return invalid('data.'+key);
  const axes=descriptors['axes']?.value;
  if(axes&&typeof axes==='object')for(const name of ['x','y','secondaryY']){
    const axis=Object.getOwnPropertyDescriptor(axes,name);
    if(axis?.get||axis?.set)return invalid('data.axes.'+name);
    if(axis?.value)for(const key of ['title','grid','labels'])if(Object.hasOwn(axis.value,key))return invalid('data.axes.'+name+'.'+key,key==='labels'?'Axis label-width settings are not supported.':'Use options.axes for display settings.');
  }
  for(const key of ['series','data']){
    const items=descriptors[key]?.value;
    if(Array.isArray(items)){
      if(items.length>(type==='fan'&&key==='data'?1024:type==='regression'&&key==='series'?8:type==='heatmap'&&key==='data'?4096:type==='flame'&&key==='data'?2048:type==='pareto'&&key==='data'?64:16))return invalid('data.'+key,type==='fan'?'Maximum 1024 original estimates.':type==='regression'?'Maximum eight original sample series.':'Maximum 16 series or segments.','INPUT_LIMIT');
      let points=0;
      for(let i=0;i<items.length;i++){
        const item=Object.getOwnPropertyDescriptor(items,String(i));
        if(item?.get||item?.set)return invalid('data.'+key+'.'+i);
        if(key==='series'&&(type==='xrange'||type==='timeline')&&item?.value){
          const id=Object.getOwnPropertyDescriptor(item.value,'id');
          if(id?.get||id?.set)return invalid('data.series.'+i+'.id');
          if(typeof id?.value==='string'&&id.value.length>128)return invalid('data.series.'+i+'.id','Temporal series IDs support at most128 characters, including legend hide/restore.','SERIES_ID_LIMIT');
        }
        if(item?.value&&Object.hasOwn(item.value,'color'))return invalid('data.'+key+'.'+i+'.color');
        if(item?.value&&Object.hasOwn(item.value,'datum'))return invalid('data.'+key+'.'+i+'.datum','Keep application payload outside the chart and look it up by stable ID.');
        if(key==='series'&&item?.value){
          for(const field of ['markers','dash'])if(Object.hasOwn(item.value,field))return invalid('data.series.'+i+'.'+field,field==='markers'?'Use options.appearance.markers.':'Line dash styles are not supported.');
          const descriptor=Object.getOwnPropertyDescriptor(item.value,'data');if(descriptor?.get||descriptor?.set)return invalid('data.series.'+i+'.data');
          const values=descriptor?.value;
          if(Array.isArray(values)){
            points+=values.length;if(points>10000)return invalid('data.series','Maximum 10,000 input observations.','INPUT_LIMIT');
            for(let j=0;j<values.length;j++){
              const point=Object.getOwnPropertyDescriptor(values,String(j));if(point?.get||point?.set)return invalid('data.series.'+i+'.data.'+j);
              if(point?.value&&Object.hasOwn(point.value,'datum'))return invalid('data.series.'+i+'.data.'+j+'.datum','Keep application payload outside the chart and look it up by stable ID.');
            }
          }
        }
      }
    }
  }
  // Bubble radii and positions must be planned for the real container. Scaling
  // a canonical wide scene uniformly leaves mobile axes and data letterboxed.
  // Keep the renderer mounted during transient collapsed layouts so it can
  // report the next real size. These are the public Core viewport bounds.
  const size=chartCapabilities[data.type].measured&&viewport?{width:Math.max(64,Math.min(10000,viewport.width)),height:Math.max(64,Math.min(10000,viewport.height))}:{width:1000,height:500};
  // Rename only at the shared planning boundary. Core and projected scenes keep
  // their existing contract; interaction never repeats this data conversion.
  const {type:_,...definition}=data;
  if(type==='sankey')for(const key of ['orientation','nodeWidth','nodePadding'])if(Object.hasOwn(descriptors,key))return invalid('data.'+key,'Sankey dimensions and orientation belong to options.layout.');
  const {radialDisplay,profile,dendrogram,parallel,circular,heatmap,venn,wordcloud,contour,shape,glyphs,sankey,temporal,comparison,relationship,pictorial,tilemap,...planning}=calculation;
  return planNativeChart({...definition,...(type==='flame'&&profile?{...(profile.rowPadding===undefined?{}:{rowPadding:profile.rowPadding})}:{}),...(type==='violin'&&profile?{...(profile.bandwidth===undefined?{}:{bandwidth:profile.bandwidth}),...(profile.resolution===undefined?{}:{resolution:profile.resolution}),...(profile.normalization===undefined?{}:{normalization:profile.normalization}),...(profile.gapRatio===undefined?{}:{gapRatio:profile.gapRatio})}:{}),...(type==='dendrogram'&&dendrogram?dendrogram:{}),...(type==='parallel'&&parallel?parallel:{}),...((type==='windrose'||type==='radialbar')&&circular?circular:{}),...(type==='heatmap'&&heatmap?heatmap:{}),...(type==='venn'&&venn?venn:{}),...(type==='wordcloud'&&wordcloud?wordcloud:{}),...(type==='pictorial'&&pictorial?{pictorial}:{}),...(type==='tilemap'&&tilemap?tilemap:{}),...(type==='contour'?{contour:contour??{levels:[]}}:{}),...((type==='dependencywheel'||type==='arcdiagram'||type==='chord')&&relationship?relationship:{}),...((type==='bullet'||type==='variwide')&&comparison?comparison:{}),...((type==='xrange'||type==='timeline')&&temporal?temporal:{}),...(type==='sankey'&&sankey?sankey:{}),...((type==='packedbubble'||type==='variablepie'||type==='item'||type==='boxplot'||type==='errorbar'||type==='lollipop'||type==='dumbbell')&&glyphs?glyphs:{}),...((type==='funnel'||type==='pyramid')&&shape?shape:{}),family:type,title:'Chart'} as PlanSpec,{...size,hiddenSeriesIds,...planning,...(radialDisplay?{circular:radialDisplay}:{})});
}
