import type {HitRegion} from '../library/contracts.js';

/** Presentation of an already-projected sector; no data layout is repeated. */
export function sectorSelectionOutline(hit:HitRegion|undefined,view:Readonly<{width:number;height:number}>,transform:Readonly<{x:number;y:number;sx:number;sy:number}>,ink:string):string|undefined{
  if(hit?.type!=='sector'||hit.radius<=hit.innerRadius||hit.end<=hit.start)return undefined;
  const point=(radius:number,angle:number)=>({x:hit.cx+Math.sin(angle)*radius,y:hit.cy-Math.cos(angle)*radius});
  const position=(p:{x:number;y:number})=>p.x+' '+p.y;
  const arc=(radius:number,angle:number,direction:0|1)=>'A'+radius+' '+radius+' 0 0 '+direction+' '+position(point(radius,angle));
  const middle=(hit.start+hit.end)/2,full=hit.end-hit.start>=Math.PI*2-1e-10;
  let path='M'+position(point(hit.radius,hit.start))+arc(hit.radius,middle,1)+arc(hit.radius,hit.end,1);
  if(full){path+='Z';if(hit.innerRadius>0)path+='M'+position(point(hit.innerRadius,hit.end))+arc(hit.innerRadius,middle,0)+arc(hit.innerRadius,hit.start,0)+'Z';}
  else path+=hit.innerRadius>0?'L'+position(point(hit.innerRadius,hit.end))+arc(hit.innerRadius,middle,0)+arc(hit.innerRadius,hit.start,0)+'Z':'L'+hit.cx+' '+hit.cy+'Z';
  const unit=Math.sqrt(transform.sx*transform.sy);
  return '<svg viewBox="0 0 '+view.width+' '+view.height+'"><g transform="translate('+transform.x+' '+transform.y+') scale('+transform.sx+' '+transform.sy+')"><path d="'+path+'" fill="none" stroke="'+ink+'" stroke-width="'+4/unit+'"/><path d="'+path+'" fill="none" stroke="#FFFFFF" stroke-width="'+2/unit+'"/></g></svg>';
}
