import type {Observation} from '../library/contracts.js';

export function contourDetails(point:Observation,format:(value:number)=>string,locale:'en'|'es'):readonly string[]{
  const c=point.contour;if(!c)return [];
  return [
    locale==='es'?'Isolínea interpolada · no es una muestra medida':'Interpolated isoline · not a measured sample',
    (locale==='es'?'Celda':'Cell')+`: ${c.row+1}, ${c.column+1}`,
    ...c.sourceIds.map((id,index)=>id+': '+format(c.sourceValues[index]!)),
  ];
}
