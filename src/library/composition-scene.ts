import type {NativeScene} from './contracts.js';
export interface NativeMixedRangesLayout{
 readonly mode:'range-line';readonly series:readonly Readonly<{id:string;type:'line'|'arearange'|'areasplinerange'}>[];
}
export function ownMixedRanges(v:NativeMixedRangesLayout,s:NativeScene):NativeMixedRangesLayout{
 if(s.family!=='mixed'||s.mixedAxes||!v||v.mode!=='range-line'||!Array.isArray(v.series)||v.series.length<2||v.series.length>16)throw Error('Invalid coordinated interval layout');
 const known=new Set((s.legend??s.series).map(x=>x.id)),kinds=new Map<string,'line'|'arearange'|'areasplinerange'>();
 for(const row of v.series){if(!row||!known.has(row.id)||kinds.has(row.id)||!['line','arearange','areasplinerange'].includes(row.type))throw Error('Invalid original interval series');kinds.set(row.id,row.type);}
 if(kinds.size!==known.size||!v.series.some(s=>s.type==='line')||!v.series.some(s=>s.type!=='line')||v.series.some(s=>s.type==='arearange')&&v.series.some(s=>s.type==='areasplinerange'))throw Error('Ambiguous interval composition');
 for(const p of s.observations){const type=kinds.get(p.id.seriesId);if(!type||type==='line'&&(p.lowValue!==undefined||p.highValue!==undefined)||type!=='line'&&(!Number.isFinite(p.lowValue)||!Number.isFinite(p.highValue)||p.lowValue!>p.highValue!||p.value!==p.lowValue!/2+p.highValue!/2))throw Error('Original interval endpoints were lost');}
 return {mode:'range-line',series:v.series.map(s=>({id:s.id,type:s.type}))};
}
export interface NativeStackGroupsLayout{
  readonly groups:readonly Readonly<{id:string;label:string;seriesIds:readonly string[]}>[];
  readonly placement:'grouped';readonly stacking:'sum'|'percent';
}
export interface NativeMixedYAxisFrame{
  readonly domain:readonly[number,number]|null;
  readonly displayed:readonly[number,number]|null;
  readonly reversed:boolean;
}
export interface NativeMixedAxesLayout{
  readonly mode:'dual-y';
  readonly primary:NativeMixedYAxisFrame;readonly secondary:NativeMixedYAxisFrame;
  readonly series:readonly Readonly<{id:string;yAxis:'primary'|'secondary'}>[];
}
function domain(v:readonly[number,number]|null):boolean{return v===null||Array.isArray(v)&&v.length===2&&v.every(Number.isFinite)&&v[0]!<v[1]!;}
export function ownStackGroups(v:NativeStackGroupsLayout,s:NativeScene):NativeStackGroupsLayout{
  if(!['column','bar'].includes(s.family)||!v||v.placement!=='grouped'||!['sum','percent'].includes(v.stacking)||!Array.isArray(v.groups)||v.groups.length<1||v.groups.length>8)throw Error('Invalid grouped stack layout');
  const ids=new Set<string>(),series=new Set<string>(),known=new Set((s.legend??s.series).map(x=>x.id));
  const groups=v.groups.map(g=>{if(!g||typeof g.id!=='string'||!g.id||g.id.length>64||ids.has(g.id)||typeof g.label!=='string'||g.label.length>200||!Array.isArray(g.seriesIds)||g.seriesIds.length<1||g.seriesIds.length>16)throw Error('Invalid stack group');ids.add(g.id);
    for(const id of g.seriesIds){if(!known.has(id)||series.has(id))throw Error('Invalid stack partition');series.add(id);}return Object.freeze({id:g.id,label:g.label,seriesIds:Object.freeze([...g.seriesIds])});
  });
  if(known.size!==series.size||s.observations.some(p=>!series.has(p.id.seriesId)))throw Error('Incomplete stack ownership');
  return Object.freeze({placement:'grouped',stacking:v.stacking,groups:Object.freeze(groups)});
}
function ownAxis(a:NativeMixedYAxisFrame):NativeMixedYAxisFrame{
  if(!a||!domain(a.domain)||!domain(a.displayed)||typeof a.reversed!=='boolean'||a.domain===null&&a.displayed!==null||a.domain!==null&&a.displayed===null||a.domain&&a.displayed&&(a.displayed[0]<a.domain[0]||a.displayed[1]>a.domain[1]))throw Error('Invalid mixed value scale');
  return Object.freeze({domain:a.domain===null?null:Object.freeze([a.domain[0],a.domain[1]] as const),displayed:a.displayed===null?null:Object.freeze([a.displayed[0],a.displayed[1]] as const),reversed:a.reversed});
}
export function ownMixedAxes(v:NativeMixedAxesLayout,s:NativeScene):NativeMixedAxesLayout{
  if(s.family!=='mixed'||!v||v.mode!=='dual-y'||!Array.isArray(v.series)||v.series.length<2||v.series.length>16)throw Error('Invalid mixed scale ownership');
  const primary=ownAxis(v.primary),secondary=ownAxis(v.secondary),ids=new Set<string>(),known=new Set((s.legend??s.series).map(x=>x.id));
  const series=v.series.map(item=>{if(!item||!known.has(item.id)||ids.has(item.id)||!['primary','secondary'].includes(item.yAxis))throw Error('Invalid mixed series scale');ids.add(item.id);return Object.freeze({id:item.id,yAxis:item.yAxis});});
  const byId=new Map(series.map(s=>[s.id,s.yAxis]));
  if(known.size!==ids.size||!series.some(s=>s.yAxis==='primary')||!series.some(s=>s.yAxis==='secondary')||s.observations.some(p=>p.valueAxis!==byId.get(p.id.seriesId)))throw Error('Mixed source values lost their scale identity');
  return Object.freeze({mode:'dual-y',primary,secondary,series:Object.freeze(series)});
}
