import type {ChartFamily} from './contracts.js';
export interface ChartCapabilities {readonly axes:'cartesian'|'radial'|'parallel'|'hierarchy'|'none';readonly viewport:false|'any'|'x'|'y'|'xy';readonly measured:boolean;}
const cartesian=Object.freeze({axes:'cartesian',viewport:'any',measured:false} as const);
const measured=Object.freeze({...cartesian,measured:true} as const);
const statistics=Object.freeze({...cartesian,viewport:false} as const);
const plain=Object.freeze({axes:'none',viewport:false,measured:false} as const);
const shaped=Object.freeze({...plain,measured:true} as const);
const graph=Object.freeze({...shaped,viewport:'any'} as const);
const uniform=Object.freeze({...graph,viewport:'xy'} as const);
const radial=Object.freeze({...shaped,axes:'radial'} as const);
/** Shared runtime capabilities. Adding a family must explicitly define its contract. */
export const chartCapabilities=Object.freeze({
 fan:measured,regression:measured,flame:Object.freeze({...measured,viewport:'x'} as const),violin:Object.freeze({...measured,viewport:false} as const),dendrogram:Object.freeze({...shaped,axes:'hierarchy'} as const),parallel:Object.freeze({...shaped,axes:'parallel'} as const),heatmap:Object.freeze({...measured,viewport:false} as const),venn:shaped,wordcloud:shaped,pictorial:Object.freeze({...measured,viewport:false} as const),tilemap:shaped,contour:measured,dependencywheel:shaped,arcdiagram:shaped,chord:shaped,
 bullet:Object.freeze({...measured,viewport:false} as const),variwide:Object.freeze({...measured,viewport:'y'} as const),
 xrange:Object.freeze({...measured,viewport:'x'} as const),timeline:Object.freeze({...measured,viewport:'x'} as const),vector:measured,windbarb:measured,line:cartesian,column:cartesian,bar:cartesian,area:cartesian,spline:cartesian,areaspline:cartesian,streamgraph:cartesian,arearange:cartesian,areasplinerange:cartesian,columnrange:cartesian,boxplot:cartesian,errorbar:cartesian,mixed:cartesian,waterfall:cartesian,
 lollipop:measured,dumbbell:measured,columnpyramid:measured,scatter:measured,bubble:measured,polygon:measured,
 histogram:statistics,bellcurve:statistics,pareto:Object.freeze({...cartesian,viewport:'x'} as const),
 pie:plain,donut:plain,gauge:plain,variablepie:shaped,item:shaped,treemap:shaped,sunburst:shaped,funnel:shaped,pyramid:shaped,
 sankey:uniform,treegraph:graph,organization:graph,networkgraph:graph,packedbubble:uniform,radar:radial,polar:radial,windrose:radial,radialbar:shaped,
} as const satisfies Readonly<Record<ChartFamily,ChartCapabilities>>);
export function isChartFamily(value:unknown):value is ChartFamily{return typeof value==='string'&&Object.hasOwn(chartCapabilities,value);}

/** Families with a dedicated label renderer or no point-value labels. */
export const fixedDataLabelFamilies=['flame','dendrogram','parallel','wordcloud','pictorial','tilemap','gauge','sankey','networkgraph','packedbubble','sunburst','treegraph','organization','treemap'] as const;
export function supportsDataLabelLayout(family:ChartFamily):boolean{
  return !(fixedDataLabelFamilies as readonly ChartFamily[]).includes(family);
}

const defaultDataLabelFamilies:readonly ChartFamily[]=['flame','dendrogram','arcdiagram','timeline','sankey','networkgraph','packedbubble','sunburst','treegraph','organization','pie','donut','treemap'];
export function dataLabelsByDefault(family:ChartFamily):boolean{
  return defaultDataLabelFamilies.includes(family);
}

/** Semantic source axes, shared by option validation and projected-scene ownership. */
const referenceAxes=Object.freeze({
 fan:'xy',regression:'xy',flame:'x',contour:'xy',bullet:'xy',variwide:'xy',xrange:'x',timeline:'x',
 vector:'xy',windbarb:'xy',polygon:'xy',lollipop:'xy',dumbbell:'xy',columnpyramid:'xy',
 boxplot:'xy',errorbar:'xy',streamgraph:'xy',arearange:'xy',areasplinerange:'xy',columnrange:'xy',
 areaspline:'xy',waterfall:'y',mixed:'xy',line:'xy',area:'xy',spline:'xy',scatter:'xy',column:'y',bar:'y',bubble:'xy',
} as const satisfies Partial<Record<ChartFamily,'x'|'y'|'xy'>>);
export function supportsReferenceAxis(family:ChartFamily,axis:'x'|'y'):boolean{
 return Object.hasOwn(referenceAxes,family)&&(referenceAxes as Partial<Record<ChartFamily,string>>)[family]!.includes(axis);
}
