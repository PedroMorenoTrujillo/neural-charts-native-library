import type {NativeScene} from '../library/contracts.js';
import {sceneTransform} from '../library/scene.js';
export function dendrogramLabels(scene:NativeScene,viewport:Readonly<{width:number;height:number}>,fontScale=1){
  const layout=scene.dendrogram;if(!layout||fontScale>1.5||viewport.width<180)return [];
  const t=sceneTransform(scene,viewport),vertical=layout.orientation==='vertical',width=48,height=18;
  const ticks=(vertical?scene.grid.map(g=>({x:0,y:g.y,label:g.label})):scene.labels.map(l=>({x:l.x,y:scene.height-18,label:l.label}))).sort((a,b)=>vertical?a.y-b.y:a.x-b.x);
  let previous=-Infinity;
  return ticks.flatMap((tick,i)=>{const center=(vertical?tick.y*t.sy+t.y:tick.x*t.sx+t.x),spacing=vertical?24:52;if(center-previous<spacing)return [];previous=center;const left=vertical?0:Math.max(0,Math.min(viewport.width-width,center-width/2)),top=vertical?Math.max(0,Math.min(viewport.height-height,center-height/2)):viewport.height-height;return [{id:'height-'+i,left,top,width:vertical?26:width,height,text:tick.label}];});
}
