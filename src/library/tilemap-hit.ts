import type {Observation} from './contracts.js';
import {containsPolygon} from './polygon-hit.js';
interface Entry {readonly point:Observation;readonly left:number;readonly right:number;readonly top:number;readonly bottom:number;}
/** Exact filled-cell hits; gaps and painted unknown cells never select a known neighbour. */
export class TilemapHitIndex {
  private readonly cells:Entry[][]=Array.from({length:144},()=>[]);
  constructor(points:readonly Observation[],private readonly width:number,private readonly height:number){
    if(points.length>2048||!Number.isFinite(width)||!Number.isFinite(height)||width<=0||height<=0)throw Error('Invalid tilemap hit frame');
    for(const point of points){
      const hit=point.hit;if(!hit)continue;
      let left:number,right:number,top:number,bottom:number;
      if(hit.type==='circle'){left=hit.cx-hit.radius;right=hit.cx+hit.radius;top=hit.cy-hit.radius;bottom=hit.cy+hit.radius;}
      else if(hit.type==='polygon'){left=Infinity;right=-Infinity;top=Infinity;bottom=-Infinity;for(const v of hit.vertices){left=Math.min(left,v.x);right=Math.max(right,v.x);top=Math.min(top,v.y);bottom=Math.max(bottom,v.y);}}
      else throw Error('Unsupported tilemap hit');
      const entry={point,left,right,top,bottom};
      for(let row=this.cell(top,height);row<=this.cell(bottom,height);row++)for(let col=this.cell(left,width);col<=this.cell(right,width);col++)this.cells[row*12+col]!.push(entry);
    }
  }
  private cell(value:number,extent:number):number{return Math.max(0,Math.min(11,Math.floor(value/extent*12)));}
  pick(x:number,y:number):Observation|null{
    if(!Number.isFinite(x)||!Number.isFinite(y)||x<0||x>this.width||y<0||y>this.height)return null;
    let selected:Observation|null=null,best=Infinity;
    for(const entry of this.cells[this.cell(y,this.height)*12+this.cell(x,this.width)]!){
      if(x<entry.left||x>entry.right||y<entry.top||y>entry.bottom)continue;
      const hit=entry.point.hit!,inside=hit.type==='circle'?(x-hit.cx)**2+(y-hit.cy)**2<=hit.radius**2:hit.type==='polygon'&&containsPolygon(hit,x,y);
      if(!inside)continue;const distance=(x-entry.point.x)**2+(y-entry.point.y)**2;
      if(distance<=best){best=distance;selected=entry.point;}
    }
    return selected;
  }
}
