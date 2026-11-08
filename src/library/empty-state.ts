import type {NativeScene} from './contracts.js';

export interface ChartEmptyState {readonly title:string;readonly description:string;}
/** Describe the absence of drawable marks, not the absence of source records. */
export function chartEmptyState(scene:NativeScene,locale:'en'|'es'):ChartEmptyState|undefined{
  if(scene.wordcloud?.status==='measuring')return undefined;
  const marks=scene.series.some(series=>series.path||series.areaPath||series.nodePath||series.textGlyphs?.length||series.cells?.length||series.circles?.some(circle=>circle.radius>0)||series.bars?.some(bar=>bar.width>0&&bar.height>0));
  if(marks)return undefined;
  const en=locale==='en';
  if(scene.legend?.length&&scene.legend.every(item=>!item.visible))return {title:en?'All series are hidden':'Todas las series están ocultas',description:en?'No series are visible with this configuration.':'Ninguna serie es visible con esta configuración.'};
  if(scene.family==='contour'){
    if(scene.contour?.emptyReason==='outsideViewport')return {title:en?'No isolines in this window':'Sin isolíneas en esta ventana',description:en?'Zoom out or reset the data window.':'Aleja o restablece la ventana de datos.'};
    if(scene.contour?.emptyReason==='missing')return {title:en?'Unknown samples':'Muestras desconocidas',description:en?'Unknown values interrupt every available cell.':'Los valores desconocidos interrumpen todas las celdas disponibles.'};
    return {title:en?'No level crossings':'Sin cruces de nivel',description:en?'The samples do not cross the configured levels.':'Las muestras no cruzan los niveles configurados.'};
  }
  if(scene.family==='bellcurve')return {title:en?'No drawable density curve':'Sin curva de densidad representable',description:en?'A normal curve requires valid samples with nonzero variance.':'Una curva normal necesita muestras válidas con variación.'};
  if(scene.family==='variwide'&&scene.variwideLayout?.status==='no-positive-width')return {title:en?'No positive widths':'Sin anchuras positivas',description:en?'The category widths are zero or unknown.':'Las anchuras de las categorías son cero o desconocidas.'};
  if(scene.family==='venn'&&scene.venn?.layout.status==='unknown')return {title:en?'Unknown intersection':'Intersección desconocida',description:en?'The supplied values do not determine a drawable intersection.':'Los valores suministrados no determinan una intersección representable.'};
  if((scene.family==='venn'&&scene.venn?.layout.status==='allZero')||(scene.observations.length>0&&scene.observations.every(point=>point.value===0)))return {title:en?'All values are zero':'Todos los valores son cero',description:en?'Zero is preserved; no positive area is filled.':'Se conserva el cero; no hay área positiva que rellenar.'};
  if(!scene.observations.length)return {title:en?'No data available':'Sin datos disponibles',description:en?'There are no values to display.':'No hay valores que mostrar.'};
  return {title:en?'No visible marks':'Sin marcas visibles',description:en?'This configuration has no drawable values.':'Esta configuración no tiene valores representables.'};
}
