import {tooltipOverlap,type TooltipOccupancy} from './tooltip-occupancy.js';
/** Display-point layout only; this never projects or transforms chart data. */
export function tooltipLayout(view:{width:number;height:number},anchor:{x:number;y:number},height:number,occupancy?:TooltipOccupancy){
  const inset=8,gap=18,width=Math.max(1,Math.min(220,view.width-inset*2));
  const x=Math.max(inset,Math.min(view.width-width-inset,anchor.x-width/2));
  const y=Math.max(inset,Math.min(view.height-height-inset,anchor.y-height/2));
  const above={x,y:anchor.y-height-gap},below={x,y:anchor.y+gap};
  // The datum owns the tooltip location. Prefer directly above it, then below
  // or beside it; a less occupied corner must not detach the detail from its value.
  const candidates=[above,below,{x:anchor.x-width-gap,y},{x:anchor.x+gap,y}];
  const fits=(p:{x:number;y:number})=>p.x>=inset&&p.y>=inset&&p.x+width<=view.width-inset&&p.y+height<=view.height-inset
    &&(anchor.x<p.x-8||anchor.x>p.x+width+8||anchor.y<p.y-8||anchor.y>p.y+height+8);
  const edges=[{x:inset,y:inset},{x:view.width-width-inset,y:inset},{x:inset,y:view.height-height-inset},{x:view.width-width-inset,y:view.height-height-inset}];
  let fit=candidates.find(fits);
  if(!fit){
    let distance=Infinity,overlap=Infinity;
    for(const candidate of edges)if(fits(candidate)){
      const dx=Math.max(candidate.x-anchor.x,0,anchor.x-candidate.x-width);
      const dy=Math.max(candidate.y-anchor.y,0,anchor.y-candidate.y-height);
      const nextDistance=dx*dx+dy*dy,nextOverlap=occupancy?tooltipOverlap(occupancy,{...candidate,width,height}):0;
      if(nextDistance<distance||nextDistance===distance&&nextOverlap<overlap){distance=nextDistance;overlap=nextOverlap;fit=candidate;}
    }
  }
  // Anchor above-content by its actual bottom edge. The first text measurement
  // must not move a tooltip that has already been painted for a new observation.
  return {width,x:fit?.x??inset,y:fit?.y??inset,bottom:fit===above?view.height-anchor.y+gap:undefined,docked:!fit};
}
