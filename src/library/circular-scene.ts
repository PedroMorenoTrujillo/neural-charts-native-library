import type {NativeScene} from './contracts.js';
export interface NativeCircularGeometry{
 readonly startAngle:number;readonly endAngle:number;
 readonly cx:number;readonly cy:number;readonly radius:number;readonly innerRadius:number;
 readonly bounds:Readonly<{x:number;y:number;width:number;height:number}>;
}
export interface NativeSectorCircularFrame extends NativeCircularGeometry{
 readonly style:'sectors';readonly domain?:never;readonly valueState?:never;readonly needle?:never;readonly ticks?:never;
}
export interface NativeGaugeCircularBase extends NativeCircularGeometry{
 readonly domain:readonly[number,number];readonly valueState:'missing'|'under'|'within'|'over';
}
export interface NativeSolidGaugeFrame extends NativeGaugeCircularBase{
 readonly style:'solid-gauge';readonly needle?:never;readonly ticks?:never;
}
export interface NativeNeedleGaugeFrame extends NativeGaugeCircularBase{
 readonly style:'needle-gauge';readonly needle:Readonly<{from:number;to:number|null}>;
 readonly ticks:readonly Readonly<{value:number;x:number;y:number}>[];
}
export type NativeCircularFrame=NativeSectorCircularFrame|NativeSolidGaugeFrame|NativeNeedleGaugeFrame;
export interface NativeRadialSummary{
 readonly knownTotal:number|null;readonly overflow:boolean;
 readonly missingCount:number;readonly hiddenCount:number;readonly knownCount:number;
 readonly percentageBasis:'complete-visible-total'|'known-visible-subtotal';
}
const finite=(value:unknown):value is number=>typeof value==='number'&&Number.isFinite(value);
export function ownCircular(c:NativeCircularFrame,s:NativeScene):NativeCircularFrame{
 if(!c||!['pie','donut','gauge'].includes(s.family)||!finite(c.startAngle)||!finite(c.endAngle)||c.startAngle< -360||c.startAngle>360||c.endAngle-c.startAngle<1||c.endAngle-c.startAngle>360||c.endAngle>720||c.endAngle< -359)throw Error('Invalid circular sweep');
 if(![c.cx,c.cy,c.radius,c.innerRadius].every(finite)||c.radius<=0||c.innerRadius<0||c.innerRadius>=c.radius||c.cx-c.radius<0||c.cx+c.radius>s.width||c.cy-c.radius<0||c.cy+c.radius>s.height)throw Error('Invalid circular frame');
 const b=c.bounds;if(!b||![b.x,b.y,b.width,b.height].every(finite)||b.x<0||b.y<0||b.width<=0||b.height<=0||b.x+b.width>s.width||b.y+b.height>s.height)throw Error('Invalid circular fit extent');
 const base={cx:c.cx,cy:c.cy,radius:c.radius,innerRadius:c.innerRadius,startAngle:c.startAngle,endAngle:c.endAngle,bounds:{x:b.x,y:b.y,width:b.width,height:b.height}};
 if(c.style==='sectors'){
  if(s.family==='gauge'||c.domain!==undefined||c.valueState!==undefined||c.needle!==undefined||c.ticks!==undefined)throw Error('Foreign scalar dial roles');
  return {...base,style:'sectors'};
 }
 if(s.family!=='gauge'||!['solid-gauge','needle-gauge'].includes(c.style)||!Array.isArray(c.domain)||c.domain.length!==2||!c.domain.every(finite)||c.domain[0]>=c.domain[1]||!['missing','under','within','over'].includes(c.valueState))throw Error('Invalid scalar dial');
 const known=s.observations[0]?.value,state=known===undefined?'missing':known<c.domain[0]?'under':known>c.domain[1]?'over':'within';
 if(s.observations.length>1||state!==c.valueState)throw Error('Scalar value lost its original domain state');
 const dial={...base,domain:[c.domain[0],c.domain[1]] as const,valueState:c.valueState};
 if(c.style==='solid-gauge'){if(c.needle!==undefined||c.ticks!==undefined)throw Error('Needle roles require a needle dial');return {...dial,style:'solid-gauge'};}
 const n=c.needle;if(!n||!finite(n.from)||n.from<0||n.from>=Math.PI*2||n.to!==null&&(!finite(n.to)||n.to<n.from||n.to-n.from>Math.PI*2+1e-12)||(state==='missing')!==(n.to===null)||!Array.isArray(c.ticks)||c.ticks.length>16)throw Error('Invalid needle state');
 const ticks=c.ticks.map(t=>{if(!t||![t.value,t.x,t.y].every(finite)||t.value<c.domain[0]||t.value>c.domain[1]||t.x<0||t.x>s.width||t.y<0||t.y>s.height)throw Error('Invalid dial tick');return {value:t.value,x:t.x,y:t.y};});
 return {...dial,style:'needle-gauge',needle:{from:n.from,to:n.to},ticks};
}
export function ownRadialSummary(v:NativeRadialSummary,s:NativeScene):NativeRadialSummary{
 if(!v||!['pie','donut'].includes(s.family)||typeof v.overflow!=='boolean'||![v.knownCount,v.missingCount,v.hiddenCount].every(n=>Number.isInteger(n)&&n>=0&&n<=16)||v.knownCount!==s.observations.length||v.knownCount+v.missingCount+v.hiddenCount!==(s.legend??s.series).length||v.knownTotal!==null&&(!finite(v.knownTotal)||v.knownTotal<0)||v.knownCount===0&&(v.knownTotal!==null||v.overflow)||v.knownCount>0&&(v.knownTotal===null)!==v.overflow||v.percentageBasis!==(v.missingCount?'known-visible-subtotal':'complete-visible-total'))throw Error('Invalid radial denominator summary');
 return {knownTotal:v.knownTotal,overflow:v.overflow,knownCount:v.knownCount,missingCount:v.missingCount,hiddenCount:v.hiddenCount,percentageBasis:v.percentageBasis};
}
