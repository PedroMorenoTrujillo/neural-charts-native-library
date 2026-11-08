import type {PlanHeatmapBand,PlanHeatmapSummary} from '@neural-charts/core/plan';
import type {Observation} from './contracts.js';
type Band=Readonly<{from:number;to:number;index:number}>;
export type HeatmapHit=Readonly<{type:'known';point:Observation}>|Readonly<{type:'unknown'|'absent'|'gap'|'outside'}>;
const UNKNOWN=Object.freeze({type:'unknown'} as const),ABSENT=Object.freeze({type:'absent'} as const),GAP=Object.freeze({type:'gap'} as const),OUTSIDE=Object.freeze({type:'outside'} as const);
export function heatmapBands(bands:readonly PlanHeatmapBand[],extent:number):readonly Band[]{
  if(bands.length>64)throw Error('Unbounded heatmap bands');
  const ids=new Set<string>(),indices=new Set<number>();
  const result=bands.map(b=>{if(!b||typeof b.id!=='string'||!b.id||b.id.length>128||ids.has(b.id)||!Number.isInteger(b.index)||b.index<0||b.index>=bands.length||indices.has(b.index)||!Number.isFinite(b.from)||!Number.isFinite(b.to)||b.from< -1e-8||b.to>extent+1e-8||b.to<=b.from)throw Error('Invalid heatmap band');ids.add(b.id);indices.add(b.index);return {from:b.from,to:b.to,index:b.index};}).sort((a,b)=>a.from-b.from);
  for(let i=1;i<result.length;i++)if(result[i]!.from<result[i-1]!.to-1e-8)throw Error('Overlapping heatmap bands');return result;
}
/** Exact Core bands; binary lookup and integer keys allocate nothing during a touch. */
export class HeatmapHitIndex {
  private readonly rows:readonly Band[];private readonly columns:readonly Band[];
  private readonly cells=new Map<number,HeatmapHit>();
  constructor(rows:readonly PlanHeatmapBand[],columns:readonly PlanHeatmapBand[],data:readonly PlanHeatmapSummary[],points:readonly Observation[],private readonly width:number,private readonly height:number){
    if(!Number.isFinite(width)||!Number.isFinite(height)||width<=0||height<=0||data.length>4096||points.length>4096)throw Error('Invalid heatmap frame');
    this.rows=heatmapBands(rows,height);this.columns=heatmapBands(columns,width);
    const byId=new Map(points.map(p=>[p.id.pointId,p]));
    for(const cell of data){const point=byId.get(cell.id),key=cell.row*64+cell.column;if(!Number.isInteger(cell.row)||!Number.isInteger(cell.column)||cell.row<0||cell.row>=rows.length||cell.column<0||cell.column>=columns.length||this.cells.has(key))throw Error('Invalid heatmap source coordinate');this.cells.set(key,cell.value===null?UNKNOWN:point?Object.freeze({type:'known',point}):ABSENT);}
  }
  private band(bands:readonly Band[],value:number):number{
    let lo=0,hi=bands.length;while(lo<hi){const mid=(lo+hi)>>>1;if(bands[mid]!.to<value)lo=mid+1;else hi=mid;}
    const b=bands[lo];return b&&value>=b.from&&value<=b.to?b.index:-1;
  }
  pick(x:number,y:number):HeatmapHit{
    if(!Number.isFinite(x)||!Number.isFinite(y)||x<0||x>this.width||y<0||y>this.height)return OUTSIDE;
    const row=this.band(this.rows,y),column=this.band(this.columns,x);if(row<0||column<0)return GAP;
    return this.cells.get(row*64+column)??ABSENT;
  }
}
