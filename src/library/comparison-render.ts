import type {PlanBulletBandGeometry,PlanBulletTargetGeometry} from '@neural-charts/core/plan';

export interface ComparisonDecorations {
  readonly bulletBands?:readonly PlanBulletBandGeometry[];
  readonly automaticBulletBands?:readonly string[];
  readonly bulletTargets?:readonly PlanBulletTargetGeometry[];
  readonly bulletGrid?:readonly Readonly<{x1:number;y1:number;x2:number;y2:number}>[];
}
/** Plot-local SVG consumed by the same native NgIcon layer as measured geometry.
 * All coordinates are projected by Core; this layer does no scale calculation. */
function lightInk(fill:string,surface:string):boolean {
  const opacity=fill.length===9?parseInt(fill.slice(7,9),16)/255:1;
  const rgb=[1,3,5].map(i=>(parseInt(fill.slice(i,i+2),16)*opacity+parseInt(surface.slice(i,i+2),16)*(1-opacity))/255);
  const linear=rgb.map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);
  return linear[0]!*.2126+linear[1]!*.7152+linear[2]!*.0722<=.179;
}
function bandColor(scene:ComparisonDecorations,band:PlanBulletBandGeometry,index:number,surface:string):string {
  return lightInk(surface,surface)&&scene.automaticBulletBands?.includes(band.id)?['#1C2A3D','#293B52','#3B506B'][index%3]!:band.color;
}
export function comparisonBackground(scene:ComparisonDecorations,surface='#FFFFFF'):string {
  return (scene.bulletBands??[]).map((band,index)=>band.status==='visible'&&band.rect?`<rect x="${band.rect.x}" y="${band.rect.y}" width="${band.rect.width}" height="${band.rect.height}" fill="${bandColor(scene,band,index,surface)}"/>`:'').join('');
}
export function comparisonGrid(scene:ComparisonDecorations,color:string):string {
  return (scene.bulletGrid??[]).map(line=>`<path d="M${line.x1} ${line.y1}L${line.x2} ${line.y2}" stroke="${color}" stroke-width="1.5"/>`).join('');
}
/** Targets stay in the measured series layer: one target for one source datum,
 * never a fake legend row and never an independent overlay chart. */
export function comparisonForeground(scene:ComparisonDecorations,surface='#FFFFFF',strokeWidth=2.5):string {
  return (scene.bulletTargets??[]).map(target=>{
    if(target.status!=='visible'||!target.line)return '';
    const line=target.line,x=(line.x1+line.x2)/2,y=(line.y1+line.y2)/2;
    const bands=scene.bulletBands??[],index=bands.findLastIndex(b=>b.status==='visible'&&b.rect&&x>=b.rect.x&&x<=b.rect.x+b.rect.width&&y>=b.rect.y&&y<=b.rect.y+b.rect.height);
    const background=index<0?surface:bandColor(scene,bands[index]!,index,surface);
    const light=lightInk(background,surface),ink=light?'#FFFFFF':'#172438',halo=light?'#172438':'#FFFFFF';
    const path=`M${line.x1} ${line.y1}L${line.x2} ${line.y2}`;
    // The fine opposite halo also keeps the target distinct where it crosses a measure.
    return `<path d="${path}" fill="none" stroke="${halo}" stroke-width="${strokeWidth*1.8}"/><path d="${path}" fill="none" stroke="${ink}" stroke-width="${strokeWidth}"/>`;
  }).join('');
}
