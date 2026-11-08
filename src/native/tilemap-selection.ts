import type {HitRegion} from '../library/contracts.js';
/** Outline only the selected Core-projected circle. Polygons use the shared outline. */
export function tilemapCircleOutline(hit:HitRegion|undefined,view:Readonly<{width:number;height:number}>,t:Readonly<{x:number;y:number;sx:number;sy:number}>,ink:string):string|undefined{
  if(hit?.type!=='circle'||hit.radius<=0)return undefined;
  const unit=Math.sqrt(t.sx*t.sy);
  return `<svg viewBox="0 0 ${view.width} ${view.height}"><g transform="translate(${t.x} ${t.y}) scale(${t.sx} ${t.sy})"><circle cx="${hit.cx}" cy="${hit.cy}" r="${hit.radius}" fill="none" stroke="${ink}" stroke-width="${4/unit}"/><circle cx="${hit.cx}" cy="${hit.cy}" r="${hit.radius}" fill="none" stroke="#FFFFFF" stroke-width="${2/unit}"/></g></svg>`;
}
