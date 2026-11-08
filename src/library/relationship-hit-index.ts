import type {NativeScene,Observation,HitRegion} from './contracts.js';
import {containsPolygon} from './polygon-hit.js';
type Entry=Readonly<{nodes:Observation[];links:Observation[]}>;
/** Fixed 12×12 plot-local index. Construct once per owned geometry, never per pointer move. */
export class RelationshipHitIndex {
  private readonly cells:Entry[]=Array.from({length:144},()=>({nodes:[],links:[]}));
  private readonly circles:Observation[]=[];
  constructor(private readonly scene:NativeScene){
    for(const point of scene.observations){const hit=point.hit;if(!hit)continue;
      if(hit.type==='compoundPolygon')throw Error('Unsupported relationship hit geometry');
      if(point.relationship?.type==='node'&&hit.type==='circle')this.circles.push(point);
      let left:number,right:number,top:number,bottom:number;
      if(hit.type==='polygon'){left=Infinity;right=-Infinity;top=Infinity;bottom=-Infinity;for(const vertex of hit.vertices){left=Math.min(left,vertex.x);right=Math.max(right,vertex.x);top=Math.min(top,vertex.y);bottom=Math.max(bottom,vertex.y);}}
      else{left=hit.cx-hit.radius;right=hit.cx+hit.radius;top=hit.cy-hit.radius;bottom=hit.cy+hit.radius;}
      for(let y=this.cell(top,scene.height);y<=this.cell(bottom,scene.height);y++)for(let x=this.cell(left,scene.width);x<=this.cell(right,scene.width);x++)this.cells[y*12+x]![point.relationship?.type==='node'?'nodes':'links'].push(point);
    }
  }
  private cell(value:number,extent:number):number{return Math.max(0,Math.min(11,Math.floor(value/extent*12)));}
  private contains(hit:HitRegion,x:number,y:number):boolean{
    if(hit.type==='compoundPolygon')return false;
    if(hit.type==='polygon')return containsPolygon(hit,x,y);
    const radius=Math.hypot(x-hit.cx,y-hit.cy);if(radius>hit.radius)return false;if(hit.type==='circle')return true;
    if(radius<hit.innerRadius)return false;
    const turn=2*Math.PI,angle=(Math.atan2(x-hit.cx,hit.cy-y)-hit.start)%turn,relative=(angle+turn)%turn;
    return relative<=hit.end-hit.start+1e-10;
  }
  pick(x:number,y:number,tolerance=0):Observation|null{
    if(x<0||y<0||x>this.scene.width||y>this.scene.height)return null;
    const cell=this.cells[this.cell(y,this.scene.height)*12+this.cell(x,this.scene.width)]!;
    for(const point of cell.nodes)if(point.hit&&this.contains(point.hit,x,y))return point;
    // A miss inside the ring must fall through to its actual ribbon polygons.
    for(let i=cell.links.length-1;i>=0;i--){const point=cell.links[i]!;if(point.hit&&this.contains(point.hit,x,y))return point;}
    // A larger touch target is separate from drawn radius and never steals an
    // actual ribbon hit. At most64 source nodes; no move-time collections.
    let nearest:Observation|null=null,distance=Infinity;
    const reach=Number.isFinite(tolerance)?Math.max(0,Math.min(256,tolerance)):0;
    for(const point of this.circles){const hit=point.hit;if(hit?.type!=='circle')continue;const d=(x-hit.cx)**2+(y-hit.cy)**2;if(d<=Math.max(hit.radius,reach)**2&&d<distance){nearest=point;distance=d;}}
    return nearest;
  }
}
