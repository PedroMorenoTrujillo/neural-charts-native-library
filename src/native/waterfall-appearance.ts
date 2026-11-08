import type {NativeChartData,NativeChartOptions,NativePointAppearance,NativeSeriesAppearance} from './data-options.js';
import {identityKey} from '../library/contracts.ts';

export const waterfallPositiveColor='#2E8153';

/** Semantic paint only; flow accumulation and geometry remain in Core. */
export function waterfallAppearance(data:NativeChartData,options:NativeChartOptions):Readonly<{points:readonly NativePointAppearance[]|undefined;series:readonly NativeSeriesAppearance[]|undefined}>{
  const appearance=options.appearance;
  if(data.type!=='waterfall')return {points:appearance?.points,series:appearance?.series};
  const flow=data.series[0],style=appearance?.waterfall,points=new Map<string,NativePointAppearance>();
  for(const point of flow.data){const color=point.type==='delta'?(point.value<0?style?.negativeColor??'#CC4F55':style?.positiveColor??waterfallPositiveColor):style?.totalColor??'#2C6DCD',value={seriesId:flow.id,pointId:point.id,color};points.set(identityKey(value),value);}
  for(const point of appearance?.points??[])points.set(identityKey(point),point);
  const series=style?.connectorColor?[...(appearance?.series??[]).filter(s=>s.id!==flow.id),{id:flow.id,color:style.connectorColor}]:appearance?.series;
  return {points:[...points.values()],series};
}
