import type {PlanViewportState} from '@neural-charts/core/plan';
import type {NativeScene} from '../library/contracts.js';

/** Compact painted UTC ticks only. Observation labels keep their full instant. */
export function nativeTimeAxisLabels(labels:NativeScene['labels'],viewport:PlanViewportState|undefined,timeAxis=viewport?.bounds.x.type==='time'):NativeScene['labels']{
  if(!timeAxis||!labels.length)return labels;
  const dates=labels.map(label=>/^[-+]?\d{4,6}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(label.label)?new Date(label.label):null);
  if(dates.some(date=>!date||!Number.isFinite(date.getTime())))return labels;
  const instants=dates.map(date=>date!.getTime());
  const shown=viewport?.displayed.x;
  const span=shown?shown[1]-shown[0]:Math.max(...instants)-Math.min(...instants),day=86400000;
  const fractional=dates.some(date=>date!.getUTCMilliseconds()!==0);
  const years=span>=365*day&&dates.every(date=>date!.getUTCMonth()===0&&date!.getUTCDate()===1);
  const months=span>=365*day&&dates.every(date=>date!.getUTCDate()===1);
  const formatted=labels.map((label,index)=>{
    const date=dates[index]!,iso=date.toISOString(),dateText=iso.split('T')[0]!,timeText=iso.slice(iso.indexOf('T')+1,-1);
    const text=span<day?(fractional?timeText:timeText.slice(0,8)):years?String(date.getUTCFullYear()):months?dateText.slice(0,dateText.lastIndexOf('-')):dateText;
    return {...label,label:text};
  });
  // Use original tick positions and a bounded text budget. Never manufacture
  // another tick or shorten all instants to the same truncated date prefix.
  const gap=Math.min(80,Math.max(24,...formatted.map(label=>label.label.length*7.5+8)));
  const ordered=formatted.map((label,index)=>({x:label.x,index})).sort((a,b)=>a.x-b.x);
  const width=viewport?.plot?.width??ordered.at(-1)!.x-ordered[0]!.x;
  const count=Math.min(ordered.length,Math.max(2,Math.floor(width/110)));
  const positions=count===1?ordered:Array.from({length:count},(_,index)=>ordered[Math.round(index*(ordered.length-1)/(count-1))]!);
  const last=positions.at(-1)!;
  const kept=new Set([positions[0]!.index]);let prior=positions[0]!.x;
  for(const point of positions.slice(1,-1))if(point.x-prior>=gap&&last.x-point.x>=gap){kept.add(point.index);prior=point.x;}
  if(last.x-prior>=gap)kept.add(last.index);
  return formatted.filter((_,index)=>kept.has(index));
}
