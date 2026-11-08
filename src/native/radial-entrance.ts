import type {NativeScene} from '../library/contracts.js';
import {sceneTransform} from '../library/scene.js';
import {gaugeEntrance} from './gauge-entrance.js';

/** Presentation geometry only. Values, radii and sectors come from the Core. */
export interface RadialEntrance {
  readonly left:number;readonly top:number;readonly size:number;readonly radius:number;
  readonly canvasLeft:number;readonly canvasTop:number;readonly canvasWidth:number;readonly canvasHeight:number;
  readonly startRadians:number;readonly sweepRadians:number;
  readonly baseStyle:Readonly<{transform:readonly Readonly<{rotate:string}>[]}>;
}

export function radialEntrance(scene:NativeScene,viewport:Readonly<{width:number;height:number}>):RadialEntrance|undefined{
  if(scene.circular?.style==='needle-gauge')return undefined;
  if(scene.family!=='pie'&&scene.family!=='donut'&&scene.family!=='gauge')return undefined;
  if(scene.observations.length>16||scene.series.reduce((length,series)=>length+(series.path?.length??0),0)>65536)return undefined;
  const sectors=scene.observations.map(point=>point.hit).filter(hit=>hit?.type==='sector');
  const frame=sectors[0];if(!frame||frame.radius<=0)return undefined;
  const gauge=scene.family==='gauge'?gaugeEntrance(scene):undefined;if(scene.family==='gauge'&&!gauge)return undefined;
  const start=gauge?.startRadians??Math.min(...sectors.map(hit=>hit.start)),sweep=gauge?.sweepRadians??Math.max(...sectors.map(hit=>hit.end))-start;
  const t=sceneTransform(scene,viewport),paintRadius=frame.radius*t.sx;
  const cx=t.x+frame.cx*t.sx,cy=t.y+frame.cy*t.sy;
  // Include the painted stroke, not only the fill. Keep the exact Core centre
  // so the revealing edge cannot leak a neighbouring sector near the origin.
  const radius=Math.ceil(paintRadius)+5,left=cx-radius,top=cy-radius;
  return {left,top,size:2*radius,radius,canvasLeft:-left,canvasTop:-top,canvasWidth:viewport.width,canvasHeight:viewport.height,startRadians:start,sweepRadians:Math.max(0,Math.min(Math.PI*2,sweep)),baseStyle:{transform:[{rotate:(start*180/Math.PI)+'deg'}]}};
}
