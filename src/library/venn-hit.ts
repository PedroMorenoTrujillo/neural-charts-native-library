import type {Observation} from './contracts.js';
export interface NativeVennHitCircle {readonly bit:number;readonly cx:number;readonly cy:number;readonly radius:number;}
/** Exact visible set membership; construction is bounded, queries allocate no
 * arrays and retain the canonical observation for stable tooltip identity. */
export class VennHitIndex {
  private readonly circles:readonly NativeVennHitCircle[];
  private readonly points=new Map<number,Observation>();
  constructor(circles:readonly NativeVennHitCircle[],points:readonly Readonly<{mask:number;point:Observation}>[],private readonly width:number,private readonly height:number){
    if(circles.length>3||points.length>7||!Number.isFinite(width)||!Number.isFinite(height)||width<=0||height<=0)throw Error('Invalid bounded Venn frame');
    const bits=new Set<number>();
    this.circles=circles.map(c=>{
      if(![1,2,4].includes(c.bit)||bits.has(c.bit)||![c.cx,c.cy,c.radius].every(Number.isFinite)||c.radius<0||c.cx-c.radius< -1e-6||c.cx+c.radius>width+1e-6||c.cy-c.radius< -1e-6||c.cy+c.radius>height+1e-6)throw Error('Invalid Venn circle');
      bits.add(c.bit);return {bit:c.bit,cx:c.cx,cy:c.cy,radius:c.radius};
    });
    const visible=[...bits].reduce((mask,bit)=>mask|bit,0);
    for(const {mask,point}of points){if(!Number.isInteger(mask)||mask<1||mask>7||(mask&visible)!==mask||this.points.has(mask))throw Error('Invalid Venn membership');this.points.set(mask,point);}
  }
  pick(x:number,y:number):Observation|null{
    if(!Number.isFinite(x)||!Number.isFinite(y)||x<0||y<0||x>this.width||y>this.height)return null;
    let mask=0;for(const c of this.circles)if(c.radius>0&&(x-c.cx)**2+(y-c.cy)**2<=c.radius*c.radius)mask|=c.bit;
    return this.points.get(mask)??null;
  }
}
