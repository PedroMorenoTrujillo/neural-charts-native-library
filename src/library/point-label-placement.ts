import type {NativeScene} from './contracts.js';

export interface LabelPoint {readonly x:number;readonly y:number;readonly radius:number;}
export interface LabelBounds {readonly left:number;readonly right:number;readonly height:number;}
/** Paint geometry, never the larger invisible touch target. Work is bounded by
 * the label budget; dense charts keep their values in the tooltip. */
export function labelPoints(scene:NativeScene,t:Readonly<{x:number;y:number;sx:number;sy:number}>,diameter=6):readonly LabelPoint[]{
  if(scene.observations.length>64)return [];
  if(scene.family==='bubble'||scene.family==='scatter')return scene.series.flatMap(s=>(s.circles??[]).map(c=>({x:t.x+c.cx*t.sx,y:t.y+c.cy*t.sy,radius:c.radius*Math.max(t.sx,t.sy)+1})));
  if(!['line','spline','area','areaspline','mixed','radar','fan','regression','pareto','lollipop','dumbbell'].includes(scene.family))return [];
  return scene.observations.map(p=>({x:t.x+p.x*t.sx,y:t.y+p.y*t.sy,radius:Math.max(0,diameter)/2+1}));
}
export function labelCoversPoint(box:Readonly<{x:number;y:number;width:number;height:number}>,points:readonly LabelPoint[]):boolean{
  return points.some(p=>Math.hypot(p.x-Math.max(box.x,Math.min(box.x+box.width,p.x)),p.y-Math.max(box.y,Math.min(box.y+box.height,p.y)))<p.radius+2);
}
/** Keep the complete text above its mark. Omit it when headroom runs out rather
 * than clamping it back over the point. */
export function labelAbovePoint(x:number,y:number,width:number,height:number,bounds:LabelBounds,points:readonly LabelPoint[]=[]){
  const radius=points.reduce((r,p)=>Math.abs(p.x-x)<.01&&Math.abs(p.y-y)<.01?Math.max(r,p.radius):r,0);
  const box={x:Math.max(bounds.left+2,Math.min(bounds.right-width-2,x-width/2)),y:y-radius-4-height,width,height};
  if(box.x<bounds.left||box.x+width>bounds.right||box.y<2||box.y+height>bounds.height-2||labelCoversPoint(box,points))return undefined;
  return box;
}
