import type {NativeScene} from '../library/contracts.js';
import {sceneTransform} from '../library/scene.js';
export interface NativeParallelLabel {readonly id:string;readonly text:string;readonly left:number;readonly top:number;readonly width:number;readonly height:number;readonly type:'name'|'tick';}
/** Bounded Native Text placement; values and axes come from the measured public plan. */
export function parallelLabels(scene:NativeScene,view:Readonly<{width:number;height:number}>,fontScale:number,settings:Readonly<{axes:boolean;names:boolean;ticks:boolean}>):readonly NativeParallelLabel[]{
  const layout=scene.parallel;if(!layout||!settings.axes)return [];
  const scale=Math.max(1,Math.min(4,Number.isFinite(fontScale)?fontScale:1)),t=sceneTransform(scene,view),labels:NativeParallelLabel[]=[];
  if(view.width<180||scale>2.5)return labels;
  const capacity=Math.max(2,Math.floor(view.width/(64*scale))),stride=layout.coordinates==='polar'?Math.max(1,Math.ceil(layout.axes.length/Math.min(8,capacity*2))):Math.max(1,Math.ceil((layout.axes.length-1)/Math.max(1,capacity-1)));
  const place=(id:string,text:string,x:number,y:number,width:number,type:'name'|'tick')=>{
    const height=(type==='tick'?14:18)*scale;
    const left=Math.max(2,Math.min(view.width-width-2,t.x+x*t.sx-width/2)),top=Math.max(0,Math.min(view.height-height,t.y+y*t.sy-height/2));
    if(labels.some(l=>left<l.left+l.width+3&&left+width+3>l.left&&top<l.top+l.height+2&&top+height+2>l.top))return;
    labels.push({id,text,left,top,width,height,type});
  };
  if(layout.coordinates==='polar'){
    for(const [i,a]of layout.axes.entries()){
      if(i%stride!==0&&i!==layout.axes.length-1)continue;
      const dx=a.to.x-a.from.x,dy=a.to.y-a.from.y,side=Math.abs(dx)>Math.abs(dy)*1.3,outerX=t.x+a.to.x*t.sx;
      const outside=dx>0?view.width-outerX-10:outerX-10;
      const width=Math.min(104*scale,side?Math.max(24,outside):view.width-8);
      const x=side?((dx>0?outerX+8+width/2:outerX-8-width/2)-t.x)/t.sx:a.labelAnchor.x;
      if(settings.names)place(a.id+'/name',a.label+(a.unit?' · '+a.unit:''),x,a.labelAnchor.y,width,'name');
      if(settings.ticks&&a.domain){const range=String(a.domain[0])+'–'+String(a.domain[1]),offset=settings.names?((!side&&dy<0?-24:22)/t.sy):0;place(a.id+'/domain',range,x,a.labelAnchor.y+offset,width,'tick');}
    }
    return labels;
  }
  // Names take priority; a long name remains fully available in tooltips/data.
  const spacing=layout.coordinates==='cartesian'&&layout.axes.length>1?Math.abs(layout.axes[1]!.from.x-layout.axes[0]!.from.x)*t.sx:104*scale;
  if(settings.names)for(const [i,a]of layout.axes.entries())if(i%stride===0||i===layout.axes.length-1){const text=a.label+(a.unit?' · '+a.unit:''),width=Math.min(text.length*6*scale+10,104*scale,Math.max(44,spacing*stride-8),view.width-8);place(a.id+'/name',text,a.labelAnchor.x,a.labelAnchor.y-(layout.coordinates==='cartesian'?4/t.sy:0),width,'name');}
  if(settings.ticks)for(const [i,a]of layout.axes.entries()){
    if(i%stride!==0&&i!==layout.axes.length-1)continue;
    const tickStride=Math.max(1,Math.ceil(a.ticks.length/5));for(const [j,tick]of a.ticks.entries())if(j%tickStride===0||j===a.ticks.length-1)place(a.id+'/tick/'+j,tick.label,tick.x+(layout.coordinates==='cartesian'?16:12),tick.y,Math.min(54*scale,view.width-8),'tick');
  }
  return labels;
}
