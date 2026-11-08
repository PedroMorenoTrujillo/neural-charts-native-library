/** Structural native transport ports; these do not import the calculation engine. */
export interface TemporalIntervalPort {
  readonly type: 'linear' | 'time';
  readonly rowId: string;
  readonly rowLabel: string;
  readonly start: number;
  readonly end: number;
  readonly duration: number;
  readonly completed?: number | null;
}

export interface TemporalEventPort {
  readonly type: 'linear' | 'time';
  readonly coordinate: number;
  readonly title: string;
  readonly description?: string;
}

export interface TemporalObservationPort {
  readonly label: string;
  readonly interval?: TemporalIntervalPort;
  readonly event?: TemporalEventPort;
}

type NumberFormatter = (value: number) => string;
type Locale = 'en' | 'es';

function utcParts(value: number): Readonly<{date: string; time: string}> {
  const iso = new Date(value).toISOString();
  const split = iso.indexOf('T');
  const date = iso.slice(0, split), fullTime = iso.slice(split + 1, -1);
  const time = value % 1000 !== 0 ? fullTime : value % 60000 !== 0 ? fullTime.slice(0, 8) : fullTime.slice(0, 5);
  return {date, time};
}

export function temporalCoordinate(value: number, type: 'linear' | 'time', format: NumberFormatter): string {
  if (type === 'linear') return format(value);
  const {date, time} = utcParts(value);
  return `${date} ${time} UTC`;
}

/** Keep a date readable in the compact value line; exact time is a separate detail. */
export function eventPrimaryValue(event: TemporalEventPort, format: NumberFormatter): string {
  return event.type === 'time' ? utcParts(event.coordinate).date : format(event.coordinate);
}

export function temporalDetails(point: TemporalObservationPort, format: NumberFormatter, locale: Locale,showRow=true): readonly string[] {
  const en = locale === 'en';
  if (point.interval) {
    const interval = point.interval;
    const coordinate = (value: number) => temporalCoordinate(value, interval.type, format);
    return [
      ...(!showRow || point.label === interval.rowLabel ? [] : [(en ? 'Row: ' : 'Fila: ') + interval.rowLabel]),
      (en ? 'Start: ' : 'Inicio: ') + coordinate(interval.start),
      (en ? 'End: ' : 'Fin: ') + coordinate(interval.end),
      ...(interval.completed === undefined ? [] : [interval.completed === null
        ? en ? 'Progress: unknown' : 'Progreso: desconocido'
        : (en ? 'Progress: ' : 'Progreso: ') + format(interval.completed * 100) + '%']),
    ];
  }
  if (point.event) {
    const event = point.event;
    return [
      ...(event.type === 'time' ? [(en ? 'Time: ' : 'Hora: ') + utcParts(event.coordinate).time + ' UTC'] : []),
      ...(event.description ? [event.description] : []),
    ];
  }
  return [];
}
