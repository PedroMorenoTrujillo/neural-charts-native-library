import type {Observation} from '../library/contracts.js';
export function tilemapDetails(point:Observation,format:(n:number)=>string,locale:'en'|'es'):readonly string[]{
  const value=point.heatmap??point.tilemap;if(!value)return [];
  const details=point.tilemap?[(locale==='en'?'Source cell: ':'Celda original: ')+format(point.tilemap.sourceX)+', '+format(point.tilemap.sourceY)]:[];
  if(value.color.type==='class')details.push((locale==='en'?'Color class: ':'Clase de color: ')+(value.classLabel||value.color.classId));
  else if(value.color.type==='unclassified')details.push(locale==='en'?'Value is outside the declared color classes.':'El valor queda fuera de las clases de color declaradas.');
  else if(value.color.type==='continuous'&&value.color.clamped)details.push(locale==='en'?'Color is clamped to the scale; the original value is preserved.':'El color se limita a la escala; se conserva el valor original.');
  return details;
}
