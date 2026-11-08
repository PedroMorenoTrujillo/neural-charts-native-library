import type {PlanBulletValue,PlanVariwideValue} from '@neural-charts/core/plan';
type BulletPort=PlanBulletValue;
type VariwidePort=PlanVariwideValue;
export interface ComparisonObservationPort {readonly bullet?: BulletPort; readonly variwide?: VariwidePort;}
export interface ComparisonDetail {readonly label: string; readonly value: string;}

export function comparisonPrimaryLabel(observation: ComparisonObservationPort, locale: 'en' | 'es'): string | undefined {
  return observation.bullet?.type === 'target' ? locale === 'es' ? 'Objetivo' : 'Target' : undefined;
}

export function comparisonDetailCount(observation:ComparisonObservationPort):number {
  return observation.bullet?(observation.bullet.type==='target'?1:Number(observation.bullet.target!==undefined)):observation.variwide?2+Number(observation.variwide.geometryOmitted):0;
}
export function comparisonDetails(observation: ComparisonObservationPort, locale: 'en' | 'es', format: (value: number) => string,unit=''): readonly ComparisonDetail[] {
  const es = locale === 'es', unknown = es ? 'Desconocido' : 'Unknown', details: ComparisonDetail[] = [];
  const measure=(value:number)=>format(value)+(unit?' '+unit:'');
  if (observation.bullet) {
    const bullet = observation.bullet;
    if (bullet.type === 'target') details.push({label: es ? 'Medida' : 'Measure', value: bullet.measure === null ? unknown : measure(bullet.measure)});
    if (bullet.type !== 'target' && bullet.target !== undefined) details.push({label: es ? 'Objetivo' : 'Target', value: bullet.target === null ? unknown : measure(bullet.target)});
  }
  if (observation.variwide) {
    const width = observation.variwide;
    details.push({label: es ? 'Ancho original' : 'Source width', value: format(width.z)});
    details.push({label: es ? 'Proporción del ancho' : 'Width share', value: width.z > 0 && width.share === 0 ? es ? 'Inferior a la precisión de representación' : 'Below representable precision' : format(width.share * 100) + '%'});
    if (width.geometryOmitted) details.push({label: es ? 'Representación' : 'Representation', value: width.zeroWidth ? es ? 'Marcador de ancho cero' : 'Zero-width marker' : es ? 'Marcador por límite de precisión' : 'Precision-limit marker'});
  }
  return details;
}
