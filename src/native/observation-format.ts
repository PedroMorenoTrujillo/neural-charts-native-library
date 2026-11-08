import {regressionDetails} from './uncertainty-format.js';
import {pictorialDetails} from './pictorial-format.js';
import {tilemapDetails} from './tilemap-format.js';
import {contourDetails} from './contour-format.js';
import {relationshipDetails,relationshipPrimaryLabel} from './relationship-format.js';
import {comparisonPrimaryLabel,comparisonDetails} from './comparison-format.js';
import {eventPrimaryValue,temporalDetails} from './temporal-format.js';
import type {ChartFamily,Observation} from '../library/contracts.js';
function utcDuration(value:number,format:(value:number)=>string,locale:'en'|'es'):string{
  const divisor=value>=86400000?86400000:value>=3600000?3600000:value>=60000?60000:value>=1000?1000:1;
  const unit=divisor===86400000?(locale==='es'?'días':'days'):divisor===3600000?'h':divisor===60000?'min':divisor===1000?'s':'ms';
  return format(value/divisor)+' '+unit;
}

/** Range intervals are values; histogram intervals describe a frequency bin. */
/** UTC values already contain their human-readable temporal unit. */
export function observationUnit(point:Observation,family:ChartFamily,unit:string,secondaryUnit=''):string{
  if(point.valueAxis==='secondary')return secondaryUnit;
  if(point.dendrogram)return point.dendrogram.heightMode==='topology'?'':point.dendrogram.unit;
  if(point.parallel)return point.parallel.unit;
  return (family==='flame'||family==='xrange')&&point.interval?.type==='time'||family==='timeline'&&point.event?.type==='time'?'':point.valueUnit??unit;
}
export function observationValue(point:Observation,family:ChartFamily,format:(value:number)=>string,locale:'en'|'es'='en'):string{
  if(point.fan?.type==='interval')return format(point.fan.low)+' – '+format(point.fan.high);
  if(point.regression?.type==='fit')return (locale==='es'?'Estimación: ':'Estimate: ')+format(point.value);
  if(point.violin)return (locale==='es'?'Mediana: ':'Median: ')+format(point.violin.median);
  if(point.dendrogram)return (point.dendrogram.heightMode==='topology'?(locale==='es'?'Nivel calculado: ':'Computed level: '):(locale==='es'?'Distancia: ':'Distance: '))+format(point.value);
  if(point.contour)return (locale==='es'?'Nivel: ':'Level: ')+format(point.contour.level);
  if(point.relationship)return relationshipPrimaryLabel(point,locale)+': '+format(point.value);
  if(family==='bullet'&&point.bullet?.type==='target')return comparisonPrimaryLabel(point,locale)+': '+format(point.value);
  if(family==='timeline'&&point.event)return eventPrimaryValue(point.event,format);
  if((family==='flame'||family==='xrange')&&point.interval){const value=point.interval.duration;return point.interval.type==='linear'?format(value):utcDuration(value,format,locale);}
  if(family==='sankey'){
    const display=(value:number)=>point.sankey?.geometryOmitted&&value!==0?String(value):format(value);
    if(point.sankey?.type==='node')return (locale==='es'?'Entrada: ':'Incoming: ')+display(point.sankey.incoming)+' · '+(locale==='es'?'Salida: ':'Outgoing: ')+display(point.sankey.outgoing)+(point.incomplete?(locale==='es'?' · valores conocidos, datos incompletos':' · known values, incomplete data'):'');
    return (locale==='es'?'Flujo: ':'Flow: ')+display(point.value)+(point.sankey?.geometryOmitted?(locale==='es'?' · inferior a la precisión de dibujo':' · below drawing precision'):'');
  }
  if(family==='vector')return (locale==='es'?'Magnitud: ':'Magnitude: ')+format(point.value);
  if(family==='windbarb')return (locale==='es'?'Velocidad: ':'Speed: ')+format(point.value);
  if(family==='boxplot'&&point.minimumValue!==undefined&&point.q1Value!==undefined&&point.medianValue!==undefined&&point.q3Value!==undefined&&point.maximumValue!==undefined)return (locale==='es'?'Mín. ':'Min ')+format(point.minimumValue)+' · Q1 '+format(point.q1Value)+' · '+(locale==='es'?'Mediana ':'Median ')+format(point.medianValue)+' · Q3 '+format(point.q3Value)+' · Max '+format(point.maximumValue);
  return (family==='mixed'||family==='arearange'||family==='areasplinerange'||family==='columnrange'||family==='errorbar'||family==='dumbbell')&&point.lowValue!==undefined&&point.highValue!==undefined
    ?format(point.lowValue)+' – '+format(point.highValue):format(point.value);
}

/** Directional source values are distinct from projected glyph coordinates. */
export function directionalDetails(point:Observation,format:(value:number)=>string,locale:'en'|'es',unit='',family:ChartFamily='line',regression?:import('../library/contracts.js').NativeRegressionLayout):readonly string[]{
  return [
    ...regressionDetails(point,regression,format,locale),
    ...(point.fan?.type==='interval'?[(locale==='es'?'Cobertura declarada: ':'Declared coverage: ')+format(point.fan.coverage*100)+'%']:[]),
    ...(point.flame?[(locale==='es'?'Tiempo propio: ':'Self duration: ')+(point.interval?.type==='time'?utcDuration(point.flame.selfDuration,format,locale):format(point.flame.selfDuration)+(unit?' '+unit:'')),(locale==='es'?'Profundidad: ':'Depth: ')+format(point.flame.depth),(locale==='es'?'Llamadas hijas: ':'Child calls: ')+format(point.flame.childCount)]:[]),
    ...(point.violin?['Q1: '+format(point.violin.q1)+' · Q3: '+format(point.violin.q3),(locale==='es'?'Intervalo: ':'Range: ')+format(point.violin.minimum)+' – '+format(point.violin.maximum),(locale==='es'?'Media: ':'Mean: ')+format(point.violin.mean),(locale==='es'?'Muestras conocidas: ':'Known samples: ')+format(point.violin.sampleCount),(locale==='es'?'Desconocidas: ':'Unknown: ')+format(point.violin.missingCount),point.violin.bandwidth===null?(locale==='es'?'Muestra constante, sin dispersión inventada':'Constant sample, no invented spread'):(locale==='es'?'Ancho del núcleo: ':'Kernel bandwidth: ')+format(point.violin.bandwidth)+(unit?' '+unit:'')]:[]),
    ...(point.dendrogram?[(locale==='es'?'Hojas: ':'Leaves: ')+format(point.dendrogram.leafCount),(locale==='es'?'Profundidad: ':'Depth: ')+format(point.dendrogram.depth)]:[]),
    ...(family==='windrose'&&point.incomplete?[locale==='es'?'Dirección incompleta: hay frecuencias desconocidas.':'Incomplete direction: some frequencies are unknown.']:[]),
    ...(point.pictorial?pictorialDetails(point.pictorial,locale,format).map(detail=>detail.label+': '+detail.value):[]),
    ...tilemapDetails(point,format,locale),
    ...temporalDetails(point,format,locale,!point.flame),
    ...contourDetails(point,format,locale),
    ...(point.relationship?relationshipDetails(point,family==='dependencywheel'?'dependencywheel':family==='arcdiagram'?'arcdiagram':'chord',locale,format).map(detail=>detail.label+': '+detail.value):[]),
    ...comparisonDetails(point,locale,format,unit).map(detail=>detail.label+': '+detail.value),
    ...(point.yValue===undefined?[]:['Y: '+format(point.yValue)]),
    ...(point.vector?['dx: '+format(point.vector.dx)+' · dy: '+format(point.vector.dy)]:[]),
    ...(point.wind?[(point.wind.direction===null?(locale==='es'?'Dirección desconocida':'Unknown direction'):(locale==='es'?'Desde: ':'From: ')+format(point.wind.direction)+'°')]:[]),
  ];
}
