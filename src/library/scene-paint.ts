import type {NativeScene,NativeReference,DatumId} from './contracts.js';
import {identityKey} from './contracts.js';

const colors=new WeakMap<NativeScene,ReadonlyMap<string,string>>();
export function pointPaint(scene:NativeScene):ReadonlyMap<string,string>{
  let cached=colors.get(scene);if(!cached){cached=new Map((scene.points??[]).map(point=>[identityKey(point),point.color]));colors.set(scene,cached);}return cached;
}
export function pointOverrideColor(scene:NativeScene,id:DatumId):string|undefined{return pointPaint(scene).get(identityKey(id));}
export function paintGroups<T extends {readonly pointId?:string}>(seriesId:string,baseColor:string,items:readonly T[],overrides:ReadonlyMap<string,string>):ReadonlyMap<string,readonly T[]>{
  const groups=new Map<string,T[]>();
  for(const primitive of items){const color=primitive.pointId===undefined?baseColor:overrides.get(identityKey({seriesId,pointId:primitive.pointId}))??baseColor;const group=groups.get(color);if(group)group.push(primitive);else groups.set(color,[primitive]);}
  return groups;
}
/** Same-colour paint commutes; keep colour runs ordered and each path disjoint.
 * Coarse cell masks bound work independently of the number of prior circles. */
export function circlePaintBatches<T extends {readonly pointId?:string;readonly cx:number;readonly cy:number;readonly radius:number}>(seriesId:string,baseColor:string,items:readonly T[],overrides:ReadonlyMap<string,string>,padding=2):readonly (readonly [string,readonly T[]])[]{
  const batches:[string,T[]][]=[];
  let runColor:string|undefined;
  const reusable:T[][]=[],cells=new Map<string,Uint32Array>(),occupied=new Uint32Array(32),cellSize=Math.max(16,padding*2);
  for(const circle of items){
    const color=circle.pointId===undefined?baseColor:overrides.get(identityKey({seriesId,pointId:circle.pointId}))??baseColor;
    if(color!==runColor){runColor=color;reusable.length=0;cells.clear();}
    // Include the half stroke and the caller's native-pixel rasterisation guard.
    const radius=circle.radius+padding;
    const left=Math.floor((circle.cx-radius)/cellSize),right=Math.floor((circle.cx+radius)/cellSize),top=Math.floor((circle.cy-radius)/cellSize),bottom=Math.floor((circle.cy+radius)/cellSize);
    if((right-left+1)*(bottom-top+1)>64){batches.push([color,[circle]]);continue;}
    const keys:string[]=[],words=Math.min(32,(reusable.length>>>5)+1);occupied.fill(0);
    for(let x=left;x<=right;x++)for(let y=top;y<=bottom;y++){
      const key=x+':'+y;keys.push(key);const mask=cells.get(key);
      if(mask)for(let word=0;word<words;word++)occupied[word]=occupied[word]!|mask[word]!;
    }
    let index=-1;
    for(let word=0;word<words;word++){
      const free=(~occupied[word]!)>>>0;
      if(free){index=word*32+31-Math.clz32(free&-free);break;}
    }
    // Never reuse an unindexed fallback path. Every reusable path occupies
    // disjoint cells, a conservative guarantee of disjoint guarded bounds.
    if(index<0){batches.push([color,[circle]]);continue;}
    let group=reusable[index];if(!group){group=[];reusable.push(group);batches.push([color,group]);}
    group.push(circle);
    const word=index>>>5,bit=1<<(index&31);
    for(const key of keys){
      let mask=cells.get(key);if(!mask){mask=new Uint32Array(32);cells.set(key,mask);}
      mask[word]=mask[word]!|bit;
    }
  }
  return batches;
}
/** Preserve paint order; alpha and stroked rectangles also need disjoint bounds. */
export function barPaintBatches<T extends {readonly pointId?:string;readonly x:number;readonly y:number;readonly width:number;readonly height:number}>(seriesId:string,baseColor:string,items:readonly T[],overrides:ReadonlyMap<string,string>,separateOverlaps:boolean,padding=0):readonly (readonly [string,readonly T[]])[]{
  const batches:[string,T[]][]=[];
  let batch:[string,T[]]|undefined,left=0,top=0,right=0,bottom=0;
  for(const bar of items){
    const color=bar.pointId===undefined?baseColor:overrides.get(identityKey({seriesId,pointId:bar.pointId}))??baseColor;
    const disjoint=!separateOverlaps||bar.x+bar.width+padding<left||bar.x-padding>right||bar.y+bar.height+padding<top||bar.y-padding>bottom;
    if(!batch||batch[0]!==color||!disjoint){
      batch=[color,[bar]];batches.push(batch);left=bar.x-padding;top=bar.y-padding;right=bar.x+bar.width+padding;bottom=bar.y+bar.height+padding;
    }else{
      batch[1].push(bar);
      if(separateOverlaps){left=Math.min(left,bar.x-padding);top=Math.min(top,bar.y-padding);right=Math.max(right,bar.x+bar.width+padding);bottom=Math.max(bottom,bar.y+bar.height+padding);}
    }
  }
  return batches;
}
export function referencePaint(references:readonly NativeReference[]|undefined,transform:Readonly<{x:number;y:number;sx:number;sy:number}>):string{
  return (references??[]).filter(reference=>reference.status==='visible').map(reference=>{
    if(reference.status!=='visible')return '';
    const {line}=reference,dash=reference.dash??'dash',paint=`stroke="${reference.color??'#8B6CCE'}" stroke-width="${reference.width??1.5}"${dash==='solid'?'':` stroke-dasharray="${dash==='dot'?'1 4':'6 4'}"`}${dash==='dot'?' stroke-linecap="round"':''}`;
    return `<path d="M${transform.x+line.x1*transform.sx} ${transform.y+line.y1*transform.sy}L${transform.x+line.x2*transform.sx} ${transform.y+line.y2*transform.sy}" fill="none" ${paint}/>`;
  }).join('');
}
