import type {NativeChartPanelData,NativeChartPanelOptionsByType} from './chart-panels-options.js';
import type {PlanViewportValue} from './plan.js';

export type PanelXWindow=PlanViewportValue['x'];
const numericWindow=(value:PanelXWindow):value is readonly[number,number]=>Array.isArray(value);
export interface PanelXContract {readonly key:string;readonly initialKey:string;readonly initial:PlanViewportValue;readonly epochKey:string;}
function field(value:unknown,key:string):unknown{
  if(!value||typeof value!=='object'||Array.isArray(value))return undefined;
  const prototype=Object.getPrototypeOf(value);if(prototype!==Object.prototype&&prototype!==null)throw Error('Viewport coordinate metadata must use plain records.');
  const d=Object.getOwnPropertyDescriptor(value,key);if(d?.get||d?.set)throw Error('Viewport coordinate metadata cannot contain accessors.');return d?.value;
}
function entries(value:unknown,maximum:number):readonly unknown[]{
  if(!Array.isArray(value)||Object.getPrototypeOf(value)!==Array.prototype||value.length>maximum)throw Error('Invalid viewport coordinate array.');
  const d=Object.getOwnPropertyDescriptors(value);
  if(Reflect.ownKeys(d).some(k=>typeof k!=='string'||k!=='length'&&(!/^(0|[1-9]\d*)$/.test(k)||Number(k)>=value.length)||typeof k==='string'&&(d[k]?.get||d[k]?.set)))throw Error('Invalid viewport coordinate array property.');
  return Array.from({length:value.length},(_,i)=>{const p=d[String(i)];if(!p)throw Error('Sparse viewport coordinates.');return p.value;});
}
function window(value:unknown):PanelXWindow{
  if(value===undefined)return undefined;
  if(Array.isArray(value)){const v=entries(value,2);if(v.length!==2||!v.every(n=>typeof n==='number'&&Number.isFinite(n))||!(Number(v[0])<Number(v[1])))throw Error('Invalid numeric viewport interval.');return Object.freeze([Number(v[0]),Number(v[1])] as const);}
  const first=field(value,'firstId'),last=field(value,'lastId');if(typeof first!=='string'||!first||typeof last!=='string'||!last)throw Error('Invalid category viewport interval.');return Object.freeze({firstId:first,lastId:last});
}
export function panelViewportValue(value:PlanViewportValue):PlanViewportValue{
  const x=window(field(value,'x')),y=window(field(value,'y'));if(y!==undefined&&!numericWindow(y))throw Error('Panel Y windows must remain numeric.');
  return Object.freeze({...(x===undefined?{}:{x}),...(y===undefined?{}:{y})});
}
export function panelXKey(value:PanelXWindow):string{return value===undefined?'reset':JSON.stringify(value);}
/** Compatibility is a bounded inspection of source coordinates, not planning
 * or scale mathematics. Every child still validates/projects its own window. */
export function panelXContract(data:NativeChartPanelData,options:NativeChartPanelOptionsByType[NativeChartPanelData['type']]):PanelXContract{
  if(data.type!=='line'&&data.type!=='area'&&data.type!=='spline'&&data.type!=='column'&&data.type!=='mixed')throw Error('X viewport links support line, area, spline, column and mixed panels only.');
  const viewport=field(options,'viewport'),axes=field(viewport,'axes');
  if(!viewport||axes!==undefined&&axes!=='x'&&axes!=='xy')throw Error('Every linked panel must explicitly enable an X or XY viewport.');
  const presentation=field(field(options,'axes'),'x');if(field(presentation,'scale')!==undefined)throw Error('Logarithmic X viewport links are not supported in this version.');
  const x=field(field(data,'axes'),'x'),type=field(x,'type');let key:string,categories:readonly unknown[]|undefined,domainValues:readonly unknown[]|undefined;
  if(type==='category'){
    const values=entries(field(x,'values'),64),ids=values.map(v=>field(v,'id'));
    if(!ids.length||ids.some(v=>typeof v!=='string'||!v||v.length>128)||new Set(ids).size!==ids.length)throw Error('Linked category axes require unique original IDs.');
    categories=ids;key=JSON.stringify(['category',ids]);
  }else if(type==='linear'||type==='time'){
    const domain=entries(field(x,'domain'),2),nice=field(x,'nice');
    if(domain.length!==2||domain.some(v=>typeof v!=='number'||!Number.isFinite(v))||!(Number(domain[0])<Number(domain[1]))||nice!==undefined&&nice!==false)throw Error('Numeric/time X links require equal explicit domains and nice:false or omitted.');
    if(type==='time'&&domain.some(v=>!Number.isInteger(v)||Math.abs(Number(v))>8.64e15))throw Error('Linked time domains require supported integer timestamps.');
    domainValues=domain;key=JSON.stringify([type,domain]);
  }else throw Error('Unsupported linked X coordinate type.');
  const initial=panelViewportValue((field(viewport,'initial')??{}) as PlanViewportValue),layout=field(options,'layout');
  if(initial.x!==undefined){
    if(categories){if(numericWindow(initial.x)||categories.indexOf(initial.x.firstId)<0||categories.indexOf(initial.x.lastId)<categories.indexOf(initial.x.firstId))throw Error('Initial linked X windows must name an ordered interval of source category IDs.');}
    else if(!numericWindow(initial.x)||!domainValues||initial.x[0]<Number(domainValues[0])||initial.x[1]>Number(domainValues[1])||type==='time'&&!initial.x.every(Number.isInteger))throw Error('Initial linked X windows must use the original numeric/time domain.');
  }
  const appearanceAxes=field(options,'axes');
  return {key,initial,initialKey:panelXKey(initial.x),epochKey:JSON.stringify([key,axes??'x',initial,field(layout,'stacking'),field(layout,'stackGroups'),field(field(appearanceAxes,'y'),'scale'),field(field(appearanceAxes,'secondaryY'),'scale')])};
}
