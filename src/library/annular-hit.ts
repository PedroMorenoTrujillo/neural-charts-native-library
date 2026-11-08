import type {Observation} from './contracts.js';
type Sector=Observation&Readonly<{hit:Extract<NonNullable<Observation['hit']>,{type:'sector'}>}>;
const tau=Math.PI*2,bucketCount=256;
const phase=(angle:number)=>(angle%tau+tau)%tau;

/** Indexed once per geometry: each angle bucket holds only nearby original bands. */
export class AnnularSectorHitIndex {
  private readonly buckets:readonly (readonly Sector[])[];
  private readonly cx:number;
  private readonly cy:number;
  constructor(points:readonly Observation[]){
    const sectors=points.filter((p):p is Sector=>p.hit?.type==='sector'&&p.hit.radius>p.hit.innerRadius&&p.hit.end>p.hit.start);
    this.cx=sectors[0]?.hit.cx??0;this.cy=sectors[0]?.hit.cy??0;
    const buckets=Array.from({length:bucketCount},()=>new Set<Sector>());
    for(const p of sectors){
      if(p.hit.cx!==this.cx||p.hit.cy!==this.cy)throw Error('Annular sectors must share their original pivot');
      const first=phase(p.hit.start)/tau*bucketCount,last=first+Math.min(tau,p.hit.end-p.hit.start)/tau*bucketCount;
      for(let i=Math.floor(first);i<=Math.floor(last);i++)buckets[i%bucketCount]!.add(p);
    }
    this.buckets=buckets.map(bucket=>Object.freeze([...bucket].sort((a,b)=>a.hit.innerRadius-b.hit.innerRadius)));
  }
  pick(x:number,y:number):Observation|null{
    const radius=Math.hypot(x-this.cx,y-this.cy),angle=phase(Math.atan2(x-this.cx,this.cy-y));
    const bucket=this.buckets[Math.min(bucketCount-1,Math.floor(angle/tau*bucketCount))]!;
    let low=0,high=bucket.length;
    while(low<high){const mid=(low+high)>>>1;if(bucket[mid]!.hit.innerRadius<=radius)low=mid+1;else high=mid;}
    // Adjacent directions can share a bucket, so validate both radius and angle.
    // No sets, arrays, strings or result objects are allocated during a pick.
    for(let i=low-1;i>=0;i--){const p=bucket[i]!,h=p.hit,relative=phase(angle-h.start);if(radius<=h.radius&&relative<=h.end-h.start+1e-10)return p;}
    return null;
  }
}
