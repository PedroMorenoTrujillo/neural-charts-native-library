import type {PlanCompoundPolygonHit} from '@neural-charts/core/plan';
import {containsPolygon,ownPolygon} from './polygon-hit.js';

type Polygon=Parameters<typeof containsPolygon>[0];
type HitPoint=Readonly<{hit?:PlanCompoundPolygonHit}>;
interface Bounds {readonly left:number;readonly right:number;readonly top:number;readonly bottom:number;}
interface Entry<T> extends Bounds {readonly point:T;readonly polygons:readonly Polygon[];}
const owned=new WeakSet<PlanCompoundPolygonHit>();

/** Defensive ownership precedes indexing; consumer arrays never become cached geometry. */
export function ownPictorialHit(hit:PlanCompoundPolygonHit,width:number,height:number):PlanCompoundPolygonHit{
  if(!Number.isFinite(width)||!Number.isFinite(height)||width<=0||height<=0||width>10000||height>10000)throw Error('Invalid pictorial hit frame');
  if(!hit||hit.type!=='compoundPolygon'||!Array.isArray(hit.polygons)||hit.polygons.length<1||hit.polygons.length>64)throw Error('Invalid compound pictorial hit');
  // Revalidate extents even for an already owned hit: it may come from another scene.
  const polygons=hit.polygons.map(vertices=>{
    const polygon=ownPolygon({type:'polygon',vertices},{family:'pictorial',width,height});
    return Object.freeze(polygon.vertices.map(vertex=>Object.freeze(vertex)));
  });
  const result:PlanCompoundPolygonHit=Object.freeze({type:'compoundPolygon',polygons:Object.freeze(polygons)});
  owned.add(result);
  return result;
}

/** Construct once per immutable scene. No candidate arrays or polygon wrappers are
 * allocated during a move. Only actual filled pieces participate, never holes,
 * empty silhouettes or bounding-box fallback hits. */
export class PictorialHitIndex<T extends HitPoint> {
  private readonly cells:Entry<T>[][]=Array.from({length:144},()=>[]);
  constructor(points:readonly T[],private readonly width:number,private readonly height:number){
    if(!Number.isFinite(width)||!Number.isFinite(height)||width<=0||height<=0||width>10000||height>10000||points.length>64)throw Error('Invalid pictorial hit frame');
    let polygonCount=0;
    for(const point of points){
      const hit=point.hit;if(!hit)continue;
      if(!owned.has(hit))throw Error('Pictorial hit must be owned before indexing');
      let left=Infinity,right=-Infinity,top=Infinity,bottom=-Infinity;
      const polygons:Polygon[]=hit.polygons.map(vertices=>{
        if(++polygonCount>4096)throw Error('Pictorial polygon budget exceeded');
        for(const vertex of vertices){
          if(vertex.x<0||vertex.x>width||vertex.y<0||vertex.y>height)throw Error('Pictorial hit belongs to another frame');
          left=Math.min(left,vertex.x);right=Math.max(right,vertex.x);top=Math.min(top,vertex.y);bottom=Math.max(bottom,vertex.y);
        }
        return {type:'polygon',vertices};
      });
      const entry:Entry<T>={point,polygons,left,right,top,bottom};
      for(let cy=this.cell(top,height);cy<=this.cell(bottom,height);cy++)for(let cx=this.cell(left,width);cx<=this.cell(right,width);cx++)this.cells[cy*12+cx]!.push(entry);
    }
  }
  private cell(value:number,extent:number):number{return Math.max(0,Math.min(11,Math.floor(value/extent*12)));}
  pick(x:number,y:number):T|null{
    if(!Number.isFinite(x)||!Number.isFinite(y)||x<0||y<0||x>this.width||y>this.height)return null;
    const entries=this.cells[this.cell(y,this.height)*12+this.cell(x,this.width)]!;
    for(let i=entries.length-1;i>=0;i--){
      const entry=entries[i]!;
      if(x<entry.left||x>entry.right||y<entry.top||y>entry.bottom)continue;
      for(const polygon of entry.polygons)if(containsPolygon(polygon,x,y))return entry.point;
    }
    return null;
  }
}
