import type {NativeRegressionLayout,Observation} from '../library/contracts.js';
export function regressionDetails(point:Observation,layout:NativeRegressionLayout|undefined,format:(n:number)=>string,locale:'en'|'es'):readonly string[]{
  if(!point.regression)return [];
  const model=layout?.models.find(m=>m.sourceSeriesId===point.regression!.modelId),en=locale==='en';
  if(!model)return [en?'Calculated fit from original samples':'Ajuste calculado desde las muestras originales'];
  const counts=[(en?'Known pairs: ':'Pares conocidos: ')+format(model.sampleCount),(en?'Unknown pairs: ':'Pares desconocidos: ')+format(model.missingCount)];
  return model.status==='ready'?[...counts,(en?'Slope: ':'Pendiente: ')+format(model.slope),(en?'Intercept: ':'Ordenada: ')+format(model.intercept),'R²: '+(model.rSquared===null?(en?'Undefined for a constant response':'Indefinido para una respuesta constante'):format(model.rSquared))]:[...counts,model.status==='constant-x'?(en?'No fit: all known X values are equal':'Sin ajuste: todos los valores X conocidos son iguales'):(en?'No fit: at least two known XY pairs are required':'Sin ajuste: se necesitan al menos dos pares XY conocidos')];
}
