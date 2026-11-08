import type {NativeScene} from '../library/contracts.js';
import {sceneTransform} from '../library/scene.js';
import type {NativeViewportContext,NativeViewportRequest} from './viewport-state.js';

export interface ViewportGestureFrame {readonly scale:number;readonly x:number;readonly y:number;readonly dx:number;readonly dy:number;}
/** Physical axes only. The Core owns values, domains, clamping and category ranks. */
export function viewportCanvas(scene:NativeScene,context:NativeViewportContext,size:Readonly<{width:number;height:number}>){
  const transform=sceneTransform(scene,size),plot=context.model.plot??{x:0,y:0,width:scene.width,height:scene.height};
  const bar=scene.family==='bar',axisX=bar?'y':'x',axisY=bar?'x':'y';
  return {x:transform.x+plot.x*transform.sx,y:transform.y+plot.y*transform.sy,width:plot.width*transform.sx,height:plot.height*transform.sy,
    horizontal:context.model.axes==='xy'||context.model.axes===axisX,vertical:context.model.axes==='xy'||context.model.axes===axisY,
    axisX,axisY,positiveX:!context.model.reversed[axisX],positiveY:bar?!context.model.reversed.x:context.model.reversed.y} as const;
}
export function viewportGestureRequest(scene:NativeScene,context:NativeViewportContext,size:Readonly<{width:number;height:number}>,frame:ViewportGestureFrame,source:NativeViewportRequest['source']):NativeViewportRequest|null{
  if(![frame.scale,frame.x,frame.y,frame.dx,frame.dy,size.width,size.height].every(Number.isFinite)||frame.scale<=0||size.width<=0||size.height<=0)return null;
  const canvas=viewportCanvas(scene,context,size);if(canvas.width<=0||canvas.height<=0)return null;
  const anchor:{x?:number;y?:number}={},delta:{x?:number;y?:number}={},clamp=(value:number)=>Math.max(0,Math.min(1,value));
  if(canvas.horizontal){const fraction=clamp((frame.x-canvas.x)/canvas.width);anchor[canvas.axisX]=canvas.positiveX?fraction:1-fraction;if(context.pan)delta[canvas.axisX]=-frame.dx/canvas.width*(canvas.positiveX?1:-1);}
  if(canvas.vertical){const fraction=clamp((frame.y-canvas.y)/canvas.height);anchor[canvas.axisY]=canvas.positiveY?fraction:1-fraction;if(context.pan)delta[canvas.axisY]=-frame.dy/canvas.height*(canvas.positiveY?1:-1);}
  return {model:context.model,source,intent:{type:'transform',factor:context.pinch?Math.max(.25,Math.min(4,frame.scale)):1,anchor,...(context.pan?{delta}:{})}};
}

/** Two metadata axes only; never walk data or project during gesture moves. */
export function viewportScaleLimit(model:import('./plan.js').PlanViewportState):number{
 let maximum=4;for(const axis of ['x','y'] as const){if(!model.axes.includes(axis))continue;const bounds=model.bounds[axis],window=model.displayed[axis];if(bounds.type!=='category'&&'limits' in bounds&&bounds.limits&&window)maximum=Math.min(maximum,Math.max(1,(window[1]-window[0])/bounds.limits.minSpan));}return maximum;
}
