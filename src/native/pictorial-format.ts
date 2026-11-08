import type {PlanPictorialValue} from '@neural-charts/core/plan';

export interface PictorialDetail {readonly label:string;readonly value:string;}
/** Describe Core source metadata without summing, rounding or inventing values. */
export function pictorialDetails(value:PlanPictorialValue,locale:'en'|'es',format:(n:number)=>string):readonly PictorialDetail[]{
  const es=locale==='es',details:PictorialDetail[]=[];
  details.push({label:es?'Capacidad':'Capacity',value:value.capacity===null?(es?'Sin capacidad positiva conocida':'No known positive capacity'):format(value.capacity)});
  details.push({label:value.incomplete?(es?'Total visible conocido':'Known visible total'):(es?'Total visible':'Visible total'),value:value.totalStatus==='overflow'?(es?'Fuera del rango numérico representable':'Outside the representable numeric range'):value.total===null?(es?'Desconocido':'Unknown'):format(value.total)});
  if(value.incomplete)details.push({label:es?'Datos':'Data',value:es?'Total incompleto: hay valores ausentes o desconocidos':'Incomplete total: some values are absent or unknown'});
  if(value.status==='zero')details.push({label:es?'Representación':'Representation',value:es?'Cero conocido, sin área rellena inventada':'Known zero, without invented filled area'});
  else if(value.status==='noInk')details.push({label:es?'Representación':'Representation',value:es?'Sin zona rellena; el dato original se conserva':'No filled region; the original datum is preserved'});
  return details;
}
