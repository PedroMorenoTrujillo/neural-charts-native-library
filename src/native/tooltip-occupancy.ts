import type {NativeScene} from '../library/contracts.js';
import {sceneTransform} from '../library/scene.js';

export interface TooltipOccupancy{readonly width:number;readonly height:number;readonly columns:number;readonly rows:number;readonly integral:Float32Array;}
/** A bounded display-density estimate, memoized per scene/layout by the host.
 * 512 samples and a 24×20 summed-area grid; candidate scoring is constant time. */
export function tooltipOccupancy(scene:NativeScene,viewport:Readonly<{width:number;height:number}>,visibleWidth:number,scrollX=0):TooltipOccupancy{
  const columns=24,rows=20,stride=columns+1,difference=new Float32Array((columns+1)*(rows+1));
  const width=Math.max(1,visibleWidth),height=Math.max(1,viewport.height),t=sceneTransform(scene,viewport);
  const samples=scene.observations,regression=scene.family==='regression',count=regression?samples.reduce((n,p)=>n+(p.regression?.type==='fit'?0:1),0):samples.length,step=Math.max(1,Math.ceil(count/512));let sourceIndex=0;
  for(let i=0;i<samples.length;i+=regression?1:step){
    // The fitted segment owns a generous touch strip, not a filled polygon.
    // Counting its bounding rectangle would invent occlusion across the plot.
    if(samples[i]?.regression?.type==='fit')continue;
    if(regression&&sourceIndex++%step!==0)continue;
    const p=samples[i]!;let left=p.x-6,top=p.y-6,right=p.x+6,bottom=p.y+6;
    if(p.hit?.type==='polygon'){
      const vertices=p.hit.vertices;left=Infinity;top=Infinity;right=-Infinity;bottom=-Infinity;
      for(let j=0;j<vertices.length;j+=Math.max(1,Math.ceil(vertices.length/64))){const v=vertices[j]!;left=Math.min(left,v.x);top=Math.min(top,v.y);right=Math.max(right,v.x);bottom=Math.max(bottom,v.y);}
    }else if(p.hit?.type==='circle'){const h=p.hit;left=h.cx-h.radius;right=h.cx+h.radius;top=h.cy-h.radius;bottom=h.cy+h.radius;}
    left=t.x+left*t.sx-scrollX;right=t.x+right*t.sx-scrollX;top=t.y+top*t.sy;bottom=t.y+bottom*t.sy;
    if(right<0||left>width||bottom<0||top>height)continue;
    const x1=Math.max(0,Math.min(columns-1,Math.floor(left/width*columns))),x2=Math.max(x1+1,Math.min(columns,Math.ceil(right/width*columns)));
    const y1=Math.max(0,Math.min(rows-1,Math.floor(top/height*rows))),y2=Math.max(y1+1,Math.min(rows,Math.ceil(bottom/height*rows)));
    difference[y1*stride+x1]!+=1;difference[y1*stride+x2]!-=1;difference[y2*stride+x1]!-=1;difference[y2*stride+x2]!+=1;
  }
  const integral=new Float32Array((columns+1)*(rows+1));
  for(let y=0;y<rows;y++)for(let x=0;x<columns;x++){
    const i=y*stride+x;
    difference[i]!+=(x?difference[i-1]!:0)+(y?difference[i-stride]!:0)-(x&&y?difference[i-stride-1]!:0);
    integral[(y+1)*stride+x+1]=difference[i]!+integral[(y+1)*stride+x]!+integral[y*stride+x+1]!-integral[y*stride+x]!;
  }
  return {width,height,columns,rows,integral};
}
export function tooltipOverlap(map:TooltipOccupancy,box:Readonly<{x:number;y:number;width:number;height:number}>):number{
  const {columns,rows,width,height,integral}=map,stride=columns+1;
  const x1=Math.max(0,Math.min(columns,Math.floor(box.x/width*columns))),x2=Math.max(0,Math.min(columns,Math.ceil((box.x+box.width)/width*columns)));
  const y1=Math.max(0,Math.min(rows,Math.floor(box.y/height*rows))),y2=Math.max(0,Math.min(rows,Math.ceil((box.y+box.height)/height*rows)));
  return integral[y2*stride+x2]!-integral[y1*stride+x2]!-integral[y2*stride+x1]!+integral[y1*stride+x1]!;
}
