import type {NativeScene} from './contracts.js';
import {validateNativePath} from './path-validation.js';

/** Own the small, bounded radial grid produced by Core. No projection occurs here. */
export function ownPolarGrid(scene:NativeScene):NonNullable<NativeScene['polarGrid']>{
  const g=scene.polarGrid!;
  const finite=(v:number)=>typeof v==='number'&&Number.isFinite(v);
  const label=(v:string)=>typeof v==='string'&&v.length<=200;
  if(!['parallel','radar','polar','windrose','radialbar'].includes(scene.family)||!g||![g.cx,g.cy,g.radius].every(finite)||g.radius<=0||g.cx-g.radius<0||g.cy-g.radius<0||g.cx+g.radius>scene.width||g.cy+g.radius>scene.height||!Array.isArray(g.rings)||g.rings.length>32||!Array.isArray(g.spokes)||g.spokes.length>32)throw Error('Invalid polar grid');
  const ids=new Set<string>();
  const rings=g.rings.map(r=>{
    if(!finite(r.radius)||r.radius<0||r.radius>g.radius+1e-8||!label(r.label)||r.path!==undefined&&(typeof r.path!=='string'||r.path.length>16000))throw Error('Invalid polar ring');
    if(r.path!==undefined)validateNativePath(r.path,scene.width,scene.height);
    return {radius:r.radius,label:r.label,...(r.path===undefined?{}:{path:r.path})};
  });
  const spokes=g.spokes.map(s=>{
    if(typeof s.id!=='string'||!s.id||s.id.length>128||ids.has(s.id)||!label(s.label)||![s.x,s.y].every(finite)||s.x<0||s.x>scene.width||s.y<0||s.y>scene.height)throw Error('Invalid polar spoke');
    ids.add(s.id);return {id:s.id,label:s.label,x:s.x,y:s.y};
  });
  return {cx:g.cx,cy:g.cy,radius:g.radius,rings,spokes};
}

export function polarGridSvg(g:NonNullable<NativeScene['polarGrid']>,color:string):string{
  return g.rings.filter(r=>r.radius>0).map(r=>r.path?`<path d="${r.path}" fill="none" stroke="${color}" stroke-width="1"/>`:`<circle cx="${g.cx}" cy="${g.cy}" r="${r.radius}" fill="none" stroke="${color}" stroke-width="1"/>`).join('')+g.spokes.map(s=>`<path d="M${g.cx} ${g.cy}L${s.x} ${s.y}" stroke="${color}" stroke-width="1"/>`).join('');
}
