import type {PlanCellPaint,PlanColorAxisFrame,PlanValueColor,PlanTilemapSummary,PlanTilemapLayout,PlanTilemapValue} from '@neural-charts/core/plan';
import type {NativeScene,NativeSeries,Observation,ChartFamily} from './contracts.js';
import {ownPolygon} from './polygon-hit.js';

export interface NativeTilemapValue extends PlanTilemapValue {readonly classLabel?:string;}
export interface NativeTilemapGeometry {readonly data:readonly PlanTilemapSummary[];readonly layout:PlanTilemapLayout;readonly colorAxis:PlanColorAxisFrame;}
const color=/^#[\da-f]{6}$/i;
const finite=(n:unknown):n is number=>typeof n==='number'&&Number.isFinite(n);
const text=(s:unknown,max=256):s is string=>typeof s==='string'&&s.length<=max;
const coordinate=(n:unknown):n is number=>finite(n)&&Number.isSafeInteger(n)&&Math.abs(n)<=1_000_000;

export function ownValueColor(p:PlanValueColor):PlanValueColor{
  if(!p||typeof p.color!=='string'||!color.test(p.color))throw Error('Invalid tilemap color');
  if(p.type==='missing')return {type:'missing',color:p.color};
  if(!finite(p.value))throw Error('Invalid tilemap color value');
  if(p.type==='continuous'){
    if(!finite(p.ratio)||p.ratio<0||p.ratio>1||typeof p.clamped!=='boolean')throw Error('Invalid continuous color');
    return {type:p.type,value:p.value,ratio:p.ratio,clamped:p.clamped,color:p.color};
  }
  if(p.type==='class'&&text(p.classId,128)&&p.classId.length)return {type:p.type,value:p.value,classId:p.classId,color:p.color};
  if(p.type==='unclassified')return {type:p.type,value:p.value,color:p.color};
  throw Error('Invalid tilemap color type');
}
export function ownColorAxis(axis:PlanColorAxisFrame):PlanColorAxisFrame{
  if(!axis||!color.test(axis.missingColor))throw Error('Invalid tilemap color axis');
  if(axis.type==='continuous'){
    if(!['explicit','source','none'].includes(axis.domainSource)||axis.domain!==null&&(!Array.isArray(axis.domain)||axis.domain.length!==2||!axis.domain.every(finite)||axis.domain[0]>axis.domain[1])||!Array.isArray(axis.stops)||axis.stops.length<2||axis.stops.length>8)throw Error('Invalid continuous color axis');
    let prior=-1;
    const stops=axis.stops.map(s=>{if(!finite(s.at)||s.at<0||s.at>1||s.at<=prior||!color.test(s.color))throw Error('Invalid color stop');prior=s.at;return{at:s.at,color:s.color};});
    if(stops[0]!.at!==0||stops.at(-1)!.at!==1)throw Error('Color stops must span zero to one');
    return {type:'continuous',domain:axis.domain===null?null:[axis.domain[0],axis.domain[1]],domainSource:axis.domainSource,stops,missingColor:axis.missingColor};
  }
  if(axis.type!=='classes'||!color.test(axis.unclassifiedColor)||!Array.isArray(axis.classes)||axis.classes.length<1||axis.classes.length>16)throw Error('Invalid class color axis');
  const ids=new Set<string>();
  const classes=axis.classes.map(c=>{if(!text(c.id,128)||!c.id||ids.has(c.id)||!text(c.label)||!color.test(c.color)||c.minInclusive!==undefined&&!finite(c.minInclusive)||c.maxExclusive!==undefined&&!finite(c.maxExclusive)||c.minInclusive!==undefined&&c.maxExclusive!==undefined&&c.minInclusive>=c.maxExclusive)throw Error('Invalid color class');ids.add(c.id);return{id:c.id,label:c.label,color:c.color,...(c.minInclusive===undefined?{}:{minInclusive:c.minInclusive}),...(c.maxExclusive===undefined?{}:{maxExclusive:c.maxExclusive})};});
  return {type:'classes',classes,missingColor:axis.missingColor,unclassifiedColor:axis.unclassifiedColor};
}

export function ownTilemapCells(series:NativeSeries,scene:NativeScene):Readonly<{cells?:readonly PlanCellPaint[]}>{
  if(series.cells===undefined)return {};
  if(!['heatmap','tilemap'].includes(scene.family)||!Array.isArray(series.cells)||series.cells.length>(scene.family==='heatmap'?4096:2048))throw Error('Invalid tilemap cells');
  const ids=new Set<string>();
  const cells=series.cells.map(c=>{
    if(!text(c.pointId)||!c.pointId||ids.has(c.pointId)||!color.test(c.color)||!finite(c.opacity)||c.opacity<0||c.opacity>1)throw Error('Invalid tilemap paint');ids.add(c.pointId);
    const g=c.geometry;
    if(g?.type==='polygon')return {pointId:c.pointId,color:c.color,opacity:c.opacity,geometry:ownPolygon(g,scene)};
    if(g?.type!=='circle'||![g.cx,g.cy,g.radius].every(finite)||g.radius<=0||g.cx-g.radius< -1e-8||g.cy-g.radius< -1e-8||g.cx+g.radius>scene.width+1e-8||g.cy+g.radius>scene.height+1e-8)throw Error('Invalid tilemap circle');
    return {pointId:c.pointId,color:c.color,opacity:c.opacity,geometry:{type:'circle' as const,cx:g.cx,cy:g.cy,radius:g.radius}};
  });
  return {cells};
}
export function ownTilemapPoint(point:Observation,family:ChartFamily):Readonly<{tilemap?:NativeTilemapValue}>{
  const p=point.tilemap;
  if(family!=='tilemap'){if(p!==undefined)throw Error('Unexpected tilemap value');return {};}
  if(!p||!coordinate(p.sourceX)||!coordinate(p.sourceY)||p.name!==undefined&&!text(p.name,512)||p.classLabel!==undefined&&!text(p.classLabel)||!point.hit||point.hit.type!=='polygon'&&point.hit.type!=='circle')throw Error('Invalid tilemap observation');
  const mapped=ownValueColor(p.color);
  if(mapped.type==='missing'||mapped.value!==point.value||mapped.color!==point.color)throw Error('Tilemap source/color mismatch');
  return {tilemap:{sourceX:p.sourceX,sourceY:p.sourceY,...(p.name===undefined?{}:{name:p.name}),color:mapped,...(p.classLabel===undefined?{}:{classLabel:p.classLabel})}};
}
export function ownTilemapScene(scene:NativeScene):Readonly<{tilemap?:NativeTilemapGeometry}>{
  const source=scene.tilemap;
  if(scene.family!=='tilemap'){if(source!==undefined)throw Error('Unexpected tilemap scene');return {};}
  if(!source||!Array.isArray(source.data)||source.data.length>2048||scene.series.length>1||scene.observations.length>2048)throw Error('Unbounded tilemap scene');
  const ids=new Set<string>();
  const data=source.data.map(p=>{
    if(!p||!p.id||!text(p.id.seriesId,128)||!p.id.seriesId||!text(p.id.pointId)||!p.id.pointId||!coordinate(p.x)||!coordinate(p.y)||p.value!==null&&!finite(p.value)||p.name!==undefined&&!text(p.name,512)||typeof p.visible!=='boolean'||typeof p.observed!=='boolean'||!['painted','noInk','hidden'].includes(p.geometryDecision))throw Error('Invalid tilemap source');
    const key=JSON.stringify([p.id.seriesId,p.id.pointId]);if(ids.has(key))throw Error('Duplicate tilemap source');ids.add(key);
    const mapped=ownValueColor(p.color);
    if(p.value===null?mapped.type!=='missing':mapped.type==='missing'||mapped.value!==p.value)throw Error('Invalid tilemap source color');
    return {id:{seriesId:p.id.seriesId,pointId:p.id.pointId},x:p.x,y:p.y,value:p.value,...(p.name===undefined?{}:{name:p.name}),visible:p.visible,geometryDecision:p.geometryDecision,color:mapped,observed:p.observed};
  });
  const l=source.layout,count=(n:unknown)=>finite(n)&&Number.isInteger(n)&&n>=0&&n<=2048;
  if(!l||!['noSource','allMissing','allHidden','noInk','ready'].includes(l.status)||!['hexagon','circle','diamond','square'].includes(l.shape)||![l.sourceCount,l.knownCount,l.missingCount,l.paintedCellCount,l.observedCellCount,l.omittedCellCount].every(count)||l.sourceCount!==data.length||l.knownCount+l.missingCount!==l.sourceCount||l.observedCellCount!==scene.observations.length||l.paintedCellCount!==scene.series.reduce((n,s)=>n+(s.cells?.length??0),0)||!finite(l.scale)||l.scale<0)throw Error('Invalid tilemap layout');
  const b=l.bounds;
  if(b!==null&&(!b||![b.x,b.y,b.width,b.height].every(finite)||b.width<0||b.height<0))throw Error('Invalid tilemap bounds');
  for(const p of scene.observations)if(!ids.has(JSON.stringify([p.id.seriesId,p.id.pointId])))throw Error('Unmatched tilemap observation');
  return {tilemap:{data,colorAxis:ownColorAxis(source.colorAxis),layout:{status:l.status,shape:l.shape,sourceCount:l.sourceCount,knownCount:l.knownCount,missingCount:l.missingCount,paintedCellCount:l.paintedCellCount,observedCellCount:l.observedCellCount,omittedCellCount:l.omittedCellCount,scale:l.scale,bounds:b===null?null:{x:b.x,y:b.y,width:b.width,height:b.height}}}};
}

/** Exact color/opacity buckets reduce view count without quantizing source colors. */
export function tilemapCellsSvg(cells:readonly PlanCellPaint[]):string{
  const buckets=new Map<string,{color:string;opacity:number;parts:string[]}>();
  let length=0;
  for(const c of cells){
    const key=c.color+':'+c.opacity,bucket=buckets.get(key)??{color:c.color,opacity:c.opacity,parts:[]},g=c.geometry;
    const path=g.type==='circle'?`M${g.cx-g.radius} ${g.cy}A${g.radius} ${g.radius} 0 1 0 ${g.cx+g.radius} ${g.cy}A${g.radius} ${g.radius} 0 1 0 ${g.cx-g.radius} ${g.cy}Z`:g.vertices.map((v,i)=>`${i?'L':'M'}${v.x} ${v.y}`).join('')+'Z';
    length+=path.length;if(length>2_000_000)throw Error('Tilemap path budget exceeded');
    bucket.parts.push(path);buckets.set(key,bucket);
  }
  return [...buckets.values()].map(b=>`<path d="${b.parts.join('')}" fill="${b.color}" fill-opacity="${b.opacity}"/>`).join('');
}
