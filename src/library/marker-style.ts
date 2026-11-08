import type {NativeMarkerShape,NativeMarkerStyle} from './contracts.js';

export type ResolvedMarkerStyle=Readonly<{shape:NativeMarkerShape;fillColor:string|undefined;borderColor:string|undefined;borderWidth:number}>;
const shapes:readonly NativeMarkerShape[]=['circle','square','diamond','triangle'];
const color=/^#[\da-f]{6}$/i;

/** Constant-size presentation validation. It never projects data or changes hit targets. */
export function resolveMarkerStyle(input:NativeMarkerStyle|undefined):ResolvedMarkerStyle{
  if(input!==undefined&&(!input||typeof input!=='object'||Array.isArray(input)))throw Error('Invalid marker style');
  const descriptors=input?Object.getOwnPropertyDescriptors(input):{};
  for(const key of Reflect.ownKeys(descriptors)){
    if(typeof key!=='string'||!['shape','fillColor','borderColor','borderWidth'].includes(key)||descriptors[key]?.get||descriptors[key]?.set)throw Error('Invalid marker style property');
  }
  const shape=descriptors['shape']?.value??'circle',fillColor=descriptors['fillColor']?.value,borderColor=descriptors['borderColor']?.value,borderWidth=descriptors['borderWidth']?.value??0;
  if(!shapes.includes(shape)||fillColor!==undefined&&(typeof fillColor!=='string'||!color.test(fillColor))||borderColor!==undefined&&(typeof borderColor!=='string'||!color.test(borderColor))||typeof borderWidth!=='number'||!Number.isFinite(borderWidth)||borderWidth<0||borderWidth>6)throw Error('Invalid marker style value');
  return {shape,fillColor,borderColor,borderWidth};
}
export function sameMarkerStyle(a:ResolvedMarkerStyle,b:ResolvedMarkerStyle):boolean{
  return a.shape===b.shape&&a.fillColor===b.fillColor&&a.borderColor===b.borderColor&&a.borderWidth===b.borderWidth;
}
/** Geometry here is the display symbol around an already projected point. */
export function markerSvg(x:number,y:number,diameter:number,pointColor:string,style:ResolvedMarkerStyle):string{
  const radius=diameter/2,paint=`fill="${style.fillColor??pointColor}"${style.borderWidth?` stroke="${style.borderColor??pointColor}" stroke-width="${style.borderWidth}" stroke-linejoin="round"`:''}`;
  if(style.shape==='square')return `<rect x="${x-radius}" y="${y-radius}" width="${diameter}" height="${diameter}" ${paint}/>`;
  if(style.shape==='diamond')return `<path d="M${x} ${y-radius}L${x+radius} ${y}L${x} ${y+radius}L${x-radius} ${y}Z" ${paint}/>`;
  if(style.shape==='triangle')return `<path d="M${x} ${y-radius}L${x+radius} ${y+radius}L${x-radius} ${y+radius}Z" ${paint}/>`;
  return `<circle cx="${x}" cy="${y}" r="${radius}" ${paint}/>`;
}

/** Bounded point clouds keep every source symbol while batching by paint, not by SVG node. */
export function markerBatchSvg(points:readonly Readonly<{x:number;y:number;color:string}>[],transform:Readonly<{x:number;y:number;sx:number;sy:number}>,diameter:number,style:ResolvedMarkerStyle):string{
  const paths=new Map<string,string[]>(),r=diameter/2;
  for(const p of points){const x=transform.x+p.x*transform.sx,y=transform.y+p.y*transform.sy,color=style.fillColor??p.color;
    const contour=style.shape==='square'?`M${x-r} ${y-r}h${diameter}v${diameter}h${-diameter}Z`:style.shape==='diamond'?`M${x} ${y-r}L${x+r} ${y}L${x} ${y+r}L${x-r} ${y}Z`:style.shape==='triangle'?`M${x} ${y-r}L${x+r} ${y+r}L${x-r} ${y+r}Z`:`M${x-r} ${y}A${r} ${r} 0 1 0 ${x+r} ${y}A${r} ${r} 0 1 0 ${x-r} ${y}Z`;
    const key=color+':'+(style.borderColor??p.color),segments=paths.get(key)??[];segments.push(contour);paths.set(key,segments);
  }
  return [...paths].map(([key,segments])=>{const [fill,border]=key.split(':');return `<path d="${segments.join('')}" fill="${fill}"${style.borderWidth?` stroke="${border}" stroke-width="${style.borderWidth}" stroke-linejoin="round"`:''}/>`;}).join('');
}
