import type {PlanRelationshipSpec, PlanRelationshipMetadata} from '@neural-charts/core/plan';

export interface RelationshipObservationPort {readonly relationship?: PlanRelationshipMetadata; readonly incomplete?: boolean; readonly value: number;}
export interface RelationshipDetail {readonly label: string; readonly value: string;}
export function relationshipPrimaryLabel(observation: RelationshipObservationPort, locale: 'en' | 'es'): string | undefined {
  if (observation.relationship?.type === 'node') return locale === 'es' ? 'Total incidente conocido' : 'Known incident total';
  if (observation.relationship?.type === 'link') return locale === 'es' ? 'Valor de la relación' : 'Relation value';
  return undefined;
}
export function relationshipDetails(observation: RelationshipObservationPort, family: PlanRelationshipSpec['family'], locale: 'en' | 'es', format: (value: number) => string): readonly RelationshipDetail[] {
  const metadata = observation.relationship, es = locale === 'es', details: RelationshipDetail[] = [];
  if (!metadata) return details;
  if (metadata.type === 'node') {
    if (family === 'dependencywheel') details.push(
      {label: es ? 'Entrada conocida' : 'Known incoming', value: format(metadata.incoming)},
      {label: es ? 'Salida conocida' : 'Known outgoing', value: format(metadata.outgoing)},
    );
    if (observation.incomplete) details.push({label: es ? 'Datos' : 'Data', value: es ? 'Total incompleto: hay relaciones con valor desconocido' : 'Incomplete total: some relation values are unknown'});
  } else details.push(
    {label: metadata.directed ? es ? 'Origen' : 'From' : es ? 'Extremo A' : 'Endpoint A', value: metadata.fromLabel},
    {label: metadata.directed ? es ? 'Destino' : 'To' : es ? 'Extremo B' : 'Endpoint B', value: metadata.toLabel},
  );
  if (metadata.geometryOmitted) details.push({label: es ? 'Representación' : 'Representation', value: observation.value === 0
    ? es ? 'Valor cero sin área inventada' : 'Zero value without invented area'
    : es ? 'Inferior a la precisión geométrica; el valor original se conserva' : 'Below geometric precision; original value preserved'});
  return details;
}
