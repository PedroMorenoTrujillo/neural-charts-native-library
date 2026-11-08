import type {PlanHeatmapLayout,PlanHeatmapSummary,PlanHeatmapValue,PlanColorAxisFrame,PlanCellPaint} from '@neural-charts/core/plan';
import type {NativeScene,Observation} from './contracts.js';
import {ownColorAxis,ownValueColor} from './tilemap-scene.js';
import {heatmapBands} from './heatmap-hit.js';
export interface NativeHeatmapValue extends PlanHeatmapValue {readonly classLabel?:string;}
export interface NativeHeatmapGeometry {readonly data:readonly PlanHeatmapSummary[];readonly layout:PlanHeatmapLayout;readonly colorAxis:PlanColorAxisFrame;}
const text=(s:unknown,max=128):s is string=>typeof s==='string'&&s.length>0&&s.length<=max;
const labelText=(s:unknown,max:number):s is string=>typeof s==='string'&&s.length<=max;
const finite=(n:unknown):n is number=>typeof n==='number'&&Number.isFinite(n);
const count=(n:unknown,max=4096):n is number=>finite(n)&&Number.isInteger(n)&&n>=0&&n<=max;
const close=(a:number,b:number)=>Math.abs(a-b)<=1e-7;
function rectangle(cell:PlanCellPaint,left:number,right:number,top:number,bottom:number){const g=cell.geometry;if(g.type!=='polygon'||g.vertices.length!==4)throw Error('Heatmap paint must be a rectangle');const expected=[[left,top],[right,top],[right,bottom],[left,bottom]];if(g.vertices.some((p,i)=>!close(p.x,expected[i]![0]!)||!close(p.y,expected[i]![1]!)))throw Error('Heatmap paint differs from exact category bands');}
export function ownHeatmapScene(scene:NativeScene):Readonly<{heatmap?:NativeHeatmapGeometry}>{
  const source=scene.heatmap;
  if(scene.family!=='heatmap'){if(source||scene.observations.some(p=>p.heatmap!==undefined))throw Error('Unexpected heatmap metadata');return {};}
  if(!source||!Array.isArray(source.data)||source.data.length>4096||scene.series.length!==1||scene.series[0]!.id!=='cells'||scene.legend?.length||scene.observations.length>4096)throw Error('Invalid bounded heatmap scene');
  const raw=source.layout;
  if(!raw||!['ready','noSource','allMissing','noInk'].includes(raw.status)||!count(raw.rowCount,64)||!count(raw.columnCount,64)||![raw.sourceCount,raw.knownCount,raw.missingCount,raw.absentCount,raw.paintedCellCount].every(n=>count(n))||!finite(raw.gapRatio)||raw.gapRatio<0||raw.gapRatio>.5||!finite(raw.opacity)||raw.opacity<0||raw.opacity>1||!Array.isArray(raw.rows)||!Array.isArray(raw.columns))throw Error('Invalid heatmap layout');
  const ownBands=(bands:PlanHeatmapLayout['rows'],length:number)=>{if(bands.length!==(raw.rowCount&&raw.columnCount?length:0))throw Error('Missing exact heatmap bands');return bands.map((b,i)=>{if(b.index!==i)throw Error('Heatmap category order changed');return {id:b.id,index:b.index,from:b.from,to:b.to};});};
  const rows=ownBands(raw.rows,raw.rowCount),columns=ownBands(raw.columns,raw.columnCount),ids=new Set<string>(),coordinates=new Set<number>();let known=0,painted=0;
  const data=source.data.map(cell=>{
    if(!cell||!text(cell.id)||ids.has(cell.id)||!text(cell.rowId)||!text(cell.columnId)||!labelText(cell.rowLabel,512)||!labelText(cell.columnLabel,512)||!count(cell.row,63)||!count(cell.column,63)||rows[cell.row]?.id!==cell.rowId||columns[cell.column]?.id!==cell.columnId||cell.value!==null&&!finite(cell.value)||typeof cell.painted!=='boolean'||cell.painted!==(raw.opacity>0))throw Error('Invalid original heatmap cell');
    const key=cell.row*64+cell.column;if(coordinates.has(key))throw Error('Duplicate heatmap coordinate');coordinates.add(key);ids.add(cell.id);
    const color=ownValueColor(cell.color);if(cell.value===null?color.type!=='missing':color.type==='missing'||color.value!==cell.value)throw Error('Heatmap source/color mismatch');
    if(cell.value!==null)known++;if(cell.painted)painted++;
    return {id:cell.id,rowId:cell.rowId,columnId:cell.columnId,value:cell.value,row:cell.row,column:cell.column,rowLabel:cell.rowLabel,columnLabel:cell.columnLabel,color,painted:cell.painted};
  });
  const series=scene.series[0]!,cells=series.cells??[],byId=new Map(data.map(c=>[c.id,c]));
  if(series.path||series.areaPath||series.nodePath||series.bars?.length||series.circles?.length||series.textGlyphs?.length||cells.length!==painted)throw Error('Invalid matrix paint role');
  const paintIds=new Set<string>();
  for(const cell of cells){const original=byId.get(cell.pointId);if(!original||!original.painted||paintIds.has(cell.pointId)||cell.color!==original.color.color||cell.opacity!==raw.opacity)throw Error('Matrix paint does not match source');paintIds.add(cell.pointId);const row=rows[original.row]!,column=columns[original.column]!;rectangle(cell,column.from,column.to,row.from,row.to);}
  if(scene.observations.length!==(raw.opacity>0?known:0))throw Error('Missing known matrix observations');
  for(const point of scene.observations){const cell=byId.get(point.id.pointId),value=point.heatmap;if(!cell||cell.value===null||!cell.painted||point.id.seriesId!=='cells'||point.value!==cell.value||point.color!==cell.color.color||!value||value.rowId!==cell.rowId||value.columnId!==cell.columnId||value.rowLabel!==cell.rowLabel||value.columnLabel!==cell.columnLabel||value.color.type!==cell.color.type||value.color.color!==cell.color.color||value.color.value!==cell.value||!point.hit||point.hit.type!=='polygon')throw Error('Matrix observation differs from source');const row=rows[cell.row]!,column=columns[cell.column]!;if(!close(point.x,(column.from+column.to)/2)||!close(point.y,(row.from+row.to)/2))throw Error('Matrix anchor differs from bands');rectangle({pointId:point.id.pointId,color:point.color,opacity:raw.opacity,geometry:point.hit},column.from,column.to,row.from,row.to);}
  const expectedStatus=!data.length?'noSource':!known?'allMissing':raw.opacity===0?'noInk':'ready';
  if(raw.status!==expectedStatus||raw.sourceCount!==data.length||raw.knownCount!==known||raw.missingCount!==data.length-known||raw.absentCount!==raw.rowCount*raw.columnCount-data.length||raw.paintedCellCount!==painted)throw Error('Matrix counts differ from original data');
  const layout:PlanHeatmapLayout={status:raw.status,rowCount:raw.rowCount,columnCount:raw.columnCount,sourceCount:data.length,knownCount:known,missingCount:data.length-known,absentCount:raw.absentCount,paintedCellCount:painted,gapRatio:raw.gapRatio,opacity:raw.opacity,rows,columns};
  // This validates band bounds and disjointness once, never during touch.
  heatmapBands(rows,scene.height);heatmapBands(columns,scene.width);
  return {heatmap:{data,layout,colorAxis:ownColorAxis(source.colorAxis)}};
}
export function ownHeatmapPoint(point:Observation,family:NativeScene['family']):Readonly<{heatmap?:NativeHeatmapValue}>{
  if(family!=='heatmap')return {};
  const p=point.heatmap!,color=ownValueColor(p.color);if(color.type==='missing'||p.classLabel!==undefined&&!labelText(p.classLabel,256))throw Error('Invalid heatmap value');
  return {heatmap:{rowId:p.rowId,columnId:p.columnId,rowLabel:p.rowLabel,columnLabel:p.columnLabel,color,...(p.classLabel===undefined?{}:{classLabel:p.classLabel})}};
}
