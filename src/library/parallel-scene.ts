import type {PlanParallelLayout,PlanParallelValue} from '@neural-charts/core/plan';
import type {NativeScene} from './contracts.js';
import {validateNativePath} from './path-validation.js';
export type NativeParallelValue=PlanParallelValue;
export interface NativeParallelLayout extends Omit<PlanParallelLayout,'commands'> {readonly path:string;}
const text=(v:unknown,max:number)=>typeof v==='string'&&v.length<=max;
/** Own the projected roles only; independent-axis scales remain exclusively in Core. */
export function ownParallel(value:NativeParallelLayout,scene:Pick<NativeScene,'family'|'width'|'height'|'observations'|'polarGrid'>):NativeParallelLayout{
  const point=(p:Readonly<{x:number;y:number}>)=>p&&typeof p==='object'&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.x>=-1e-8&&p.y>=-1e-8&&p.x<=scene.width+1e-8&&p.y<=scene.height+1e-8;
  if(scene.family!=='parallel'||!value||!['cartesian','polar'].includes(value.coordinates)||!Array.isArray(value.axes)||value.axes.length<(value.coordinates==='polar'?3:2)||value.axes.length>16||!text(value.path,32000))throw Error('Invalid parallel layout');
  if(value.coordinates==='polar'&&!scene.polarGrid||value.coordinates==='cartesian'&&scene.polarGrid)throw Error('Invalid parallel coordinate pivot');
  validateNativePath(value.path,scene.width,scene.height);
  const ids=new Set<string>();
  const axes=value.axes.map(a=>{
    if(!a||!text(a.id,128)||!a.id||ids.has(a.id)||!text(a.label,200)||!text(a.unit,64)||!Number.isInteger(a.sourceCount)||a.sourceCount<0||a.sourceCount>16||!point(a.from)||!point(a.to)||!point(a.labelAnchor)||!Array.isArray(a.ticks)||a.ticks.length>32)throw Error('Invalid parallel dimension');
    if(a.domain&&(!Array.isArray(a.domain)||a.domain.length!==2||!a.domain.every(Number.isFinite)||a.domain[0]>=a.domain[1]))throw Error('Invalid parallel domain');
    if(!a.domain&&a.ticks.length)throw Error('Unscaled dimension cannot invent ticks');
    ids.add(a.id);const ticks=a.ticks.map((t:NativeParallelLayout['axes'][number]['ticks'][number])=>{if(!Number.isFinite(t.value)||!text(t.label,64)||!point(t)||!a.domain||t.value<a.domain[0]||t.value>a.domain[1])throw Error('Invalid parallel tick');return Object.freeze({value:t.value,label:t.label,x:t.x,y:t.y});});
    return Object.freeze({id:a.id,label:a.label,unit:a.unit,sourceCount:a.sourceCount,...(a.domain?{domain:Object.freeze([...a.domain]) as readonly[number,number]}:{}),from:Object.freeze({...a.from}),to:Object.freeze({...a.to}),labelAnchor:Object.freeze({...a.labelAnchor}),ticks:Object.freeze(ticks)});
  });
  const expectedPath=axes.map(a=>'M'+a.from.x+' '+a.from.y+'L'+a.to.x+' '+a.to.y).join('');if(value.path!==expectedPath)throw Error('Parallel grid does not match its dimension endpoints');
  const byId=new Map(axes.map(a=>[a.id,a]));
  for(const p of scene.observations){const role=p.parallel,a=role?byId.get(role.axisId):undefined;if(!role||!a||role.axisLabel!==a.label||role.unit!==a.unit||!a.domain||p.value<a.domain[0]||p.value>a.domain[1])throw Error('Invalid parallel observation ownership');
    const dx=a.to.x-a.from.x,dy=a.to.y-a.from.y,length=dx*dx+dy*dy,px=p.x-a.from.x,py=p.y-a.from.y,dot=px*dx+py*dy;
    if(length<=0||Math.abs(px*dy-py*dx)>Math.sqrt(length)*1e-7||dot< -1e-7||dot>length+1e-7||p.hit?.type!=='circle'||p.hit.cx!==p.x||p.hit.cy!==p.y)throw Error('Parallel observation is not on its declared dimension');
  }
  return Object.freeze({coordinates:value.coordinates,path:value.path,axes:Object.freeze(axes)});
}
export function ownParallelValue(value:NativeParallelValue):NativeParallelValue{
  if(!value||!text(value.axisId,128)||!value.axisId||!text(value.axisLabel,200)||!text(value.unit,64))throw Error('Invalid parallel observation');return {axisId:value.axisId,axisLabel:value.axisLabel,unit:value.unit};
}
export function parallelGridSvg(layout:NativeParallelLayout,color:string,ticks=true):string{return `<path d="${layout.path}" fill="none" stroke="${color}" stroke-width="1.25"/>`+(ticks?layout.axes.flatMap(a=>a.ticks.map(t=>`<circle cx="${t.x}" cy="${t.y}" r="1.4" fill="${color}"/>`)).join(''):'');}
