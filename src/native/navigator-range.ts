import type {NativeNumericWindow} from './data-options.js';
import type {PlanViewportState,PlanViewportValue} from './plan.js';

export interface NavigatorRange {
  readonly domain: NativeNumericWindow;
  readonly value: NativeNumericWindow;
  readonly minimumSpan: number;
  readonly time: boolean;
}

export function navigatorRange(state:PlanViewportState|undefined):NavigatorRange|undefined {
  const axis=state?.bounds.x;
  if(!state||state.axes==='y'||!axis||(axis.type!=='linear'&&axis.type!=='time')||!axis.domain)return undefined;
  const [min,max]=axis.domain;
  const span=max-min;
  if(!Number.isFinite(span)||span<=0)return undefined;
  const x=state.value.x;
  const value:NativeNumericWindow=Array.isArray(x)?[x[0],x[1]]:axis.domain;
  const resolution=Number.EPSILON*Math.max(Math.abs(min),Math.abs(max));
  const minimumSpan=Math.min(span,Math.max(resolution,axis.limits?.minSpan??0,axis.type==='time'?1:0));
  return {domain:axis.domain,value,minimumSpan,time:axis.type==='time'};
}

export function moveNavigatorEdge(range:NavigatorRange,edge:0|1,value:number):NativeNumericWindow {
  if(!Number.isFinite(value))return range.value;
  const [min,max]=range.domain,[start,end]=range.value;
  const next=range.time?Math.round(value):value;
  return edge===0
    ? [Math.max(min,Math.min(end-range.minimumSpan,next)),end]
    : [start,Math.min(max,Math.max(start+range.minimumSpan,next))];
}

/** Resetting the X window must preserve the vertical view. */
export function navigatorViewport(state:PlanViewportState,value?:NativeNumericWindow):PlanViewportValue {
  const domain=navigatorRange(state)?.domain;
  const x=value&&(!domain||value[0]!==domain[0]||value[1]!==domain[1])?value:undefined;
  return {...(x?{x}:{}),...(state.value.y?{y:state.value.y}:{})};
}

type OverviewPoint=Readonly<{x:string|number;y:number|null}>;

/** Sample in domain coordinates, retaining extrema in each of 80 columns. */
export function navigatorOverview(points:readonly OverviewPoint[],[min,max]:NativeNumericWindow):string {
  if(!Number.isFinite(max-min)||max<=min)return '';
  const bins:Array<{low:{x:number;y:number};high:{x:number;y:number}}|undefined>=new Array(80);
  const gaps=new Set<number>();
  let floor=Infinity,ceiling=-Infinity;
  for(const {x,y} of points){
    if(typeof x!=='number'||x<min||x>max||!Number.isFinite(x))continue;
    const column=Math.min(bins.length-1,Math.floor((x-min)/(max-min)*bins.length));
    if(y===null){gaps.add(column);continue;}
    if(!Number.isFinite(y))continue;
    const current=bins[column],point={x,y};
    if(!current)bins[column]={low:point,high:point};
    else {
      if(y<current.low.y)current.low=point;
      if(y>current.high.y)current.high=point;
    }
    floor=Math.min(floor,y);ceiling=Math.max(ceiling,y);
  }
  const path:string[]=[];
  let connect=false;
  for(const [column,bin] of bins.entries()){
    const gap=gaps.has(column);
    if(gap)connect=false;
    if(!bin)continue;
    const ordered=bin.low===bin.high?[bin.low]:bin.low.x<=bin.high.x?[bin.low,bin.high]:[bin.high,bin.low];
    for(const point of ordered){
      const x=2+156*((point.x-min)/(max-min));
      // Divide before subtraction so opposite finite extrema cannot overflow.
      const extent=ceiling/2-floor/2;
      const y=extent===0?18:32-28*((point.y/2-floor/2)/extent);
      path.push((connect?'L':'M')+x.toFixed(2)+' '+y.toFixed(2));
      connect=!gap;
    }
  }
  return path.join(' ');
}
