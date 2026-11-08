import {directionalDetails} from './observation-format.js';
import type {Observation,SharedSelection,ChartFamily} from '../library/contracts.js';
import {comparisonDetailCount} from './comparison-format.js';

/** Compact overlay has explicit line boxes; it never waits for an asynchronous layout. */
export function compactTooltipHeight(point:Observation|null,shared:SharedSelection|undefined,fontScale:number,family:ChartFamily='line',detailCount?:number):number{
  const scale=Number.isFinite(fontScale)?Math.max(1,fontScale):1;
  if(shared)return Math.ceil(26+16*scale+shared.rows.reduce((height,row)=>height+17+18*scale+((row.point?.percentage!==undefined?1:0)+(row.point?comparisonDetailCount(row.point):0))*(3+16*scale),0));
  const extras=point?(detailCount??directionalDetails(point,String,'en','',family).length)+Number(point.xValue!==undefined&&!point.interval&&!point.event)+Number(point.percentage!==undefined)+Number(point.sizeValue!==undefined)+Number(!!point.subtotal)+Number(!!point.computedKind)+2*Number(point.minimumValue!==undefined)+2*Number(point.node!==undefined&&point.node.directed!==false):0;
  return Math.ceil(29+41*scale+extras*(3+16*scale));
}
