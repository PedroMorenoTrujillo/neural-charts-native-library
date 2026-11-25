import assert from 'node:assert/strict';
import test from 'node:test';
import { directionalDetails, observationUnit, observationValue } from '../dist/native/observation-format.js';
import { comparisonDetailCount, comparisonDetails } from '../dist/native/comparison-format.js';

const number = String;
const point = { label: 'A', value: 12 };

test('Temporal points use UTC and preserve unknown, zero and absent completion', () => {
  const start = Date.UTC(2026, 0, 1);
  const interval = { type: 'time', start, end: start + 90001, duration: 90001, rowLabel: 'Server' };
  const event = { type: 'time', coordinate: interval.end, description: 'Deployed' };
  const timeline = { ...point, event };
  assert.equal(observationUnit(timeline, 'timeline', 'ms'), '');
  assert.equal(observationValue(timeline, 'timeline', number), '2026-01-01');
  assert.deepEqual(directionalDetails(timeline, number, 'en', '', 'timeline'), ['Time: 00:01:30.001 UTC', 'Deployed']);
  assert.deepEqual(directionalDetails({ ...point, event: { type: 'linear', coordinate: 0 } }, number, 'en'), []);

  const range = { ...point, interval };
  assert.equal(observationUnit(range, 'xrange', 'ms'), '');
  assert.equal(observationValue(range, 'xrange', number), '1.5000166666666668 min');
  const endpoints = ['Fila: Server', 'Inicio: 2026-01-01 00:00 UTC', 'Fin: 2026-01-01 00:01:30.001 UTC'];
  assert.deepEqual(directionalDetails(range, number, 'es', '', 'xrange'), endpoints);
  for (const [completed, progress] of [[null, 'Progreso: desconocido'], [0, 'Progreso: 0%']]) {
    const datum = { ...range, interval: { ...interval, completed } };
    assert.deepEqual(directionalDetails(datum, number, 'es', '', 'xrange'), [...endpoints, progress]);
  }

  for (const [duration, es, en] of [
    [172800000, '2 días', '2 days'], [7200000, '2 h', '2 h'],
    [2000, '2 s', '2 s'], [2, '2 ms', '2 ms'],
  ]) {
    const task = { ...point, flame: { depth: 3, childCount: 2, selfDuration: duration }, interval: { ...interval, duration } };
    assert.equal(observationValue(task, 'flame', number, 'es'), es);
    assert.equal(observationValue(task, 'flame', number, 'en'), en);
    assert.deepEqual(directionalDetails(task, number, 'es', '', 'flame').slice(0, 3),
      ['Tiempo propio: ' + es, 'Profundidad: 3', 'Llamadas hijas: 2']);
  }
  const duration = { ...point, flame: { depth: 0, childCount: 0, selfDuration: 0 }, interval: { ...interval, type: 'linear', duration: 2 } };
  assert.equal(observationValue(duration, 'flame', number), '2');
  assert.equal(directionalDetails(duration, number, 'en', 'requests', 'flame')[0], 'Self duration: 0 requests');
});

test('Uncertainty and directional values retain independent units and explicit unknowns', () => {
  const violin = { ...point, violin: { median: 0, q1: -1, q3: 2, minimum: -5, maximum: 5, mean: 1, sampleCount: 8, missingCount: 2, bandwidth: null } };
  assert.equal(observationValue(violin, 'violin', number, 'es'), 'Mediana: 0');
  assert.deepEqual(directionalDetails(violin, number, 'en', 'ms', 'violin'),
    ['Q1: -1 · Q3: 2', 'Range: -5 – 5', 'Mean: 1', 'Known samples: 8', 'Unknown: 2', 'Constant sample, no invented spread']);
  const dispersed = { ...violin, violin: { ...violin.violin, bandwidth: 1.5 } };
  assert.equal(directionalDetails(dispersed, number, 'es', 'ms', 'violin').at(-1), 'Ancho del núcleo: 1.5 ms');
  const bounded = { ...point, minimumValue: -5, q1Value: -1, medianValue: 0, q3Value: 2, maximumValue: 5 };
  assert.equal(observationValue(bounded, 'boxplot', number, 'es'), 'Mín. -5 · Q1 -1 · Mediana 0 · Q3 2 · Max 5');
  assert.equal(observationValue({ ...bounded, maximumValue: undefined }, 'boxplot', number), '12');
  assert.equal(observationValue({ ...point, lowValue: 0, highValue: 2 }, 'dumbbell', number), '0 – 2');
  const secondary = { ...point, valueAxis: 'secondary', valueUnit: 'm' };
  assert.equal(observationUnit(secondary, 'mixed', 'kg', 'L'), 'L');
  assert.equal(observationUnit({ ...secondary, valueAxis: undefined }, 'mixed', 'kg', 'L'), 'm');
  assert.equal(observationUnit({ ...point, parallel: { unit: 'kg' } }, 'parallel', 'ignored'), 'kg');
  for (const [heightMode, unit, value] of [['topology', '', 'Computed level: 12'], ['distance', 'km', 'Distance: 12']]) {
    const observation = { ...point, dendrogram: { heightMode, unit: 'km', leafCount: 2, depth: 1 } };
    assert.equal(observationUnit(observation, 'dendrogram', 'ignored'), unit);
    assert.equal(observationValue(observation, 'dendrogram', number), value);
    assert.deepEqual(directionalDetails(observation, number, 'es'), ['Hojas: 2', 'Profundidad: 1']);
  }
  assert.deepEqual(directionalDetails({ ...point, wind: { direction: 0 } }, number, 'es'), ['Desde: 0°']);
  assert.deepEqual(directionalDetails({ ...point, wind: { direction: null } }, number, 'es'), ['Dirección desconocida']);
  assert.deepEqual(directionalDetails({ ...point, incomplete: true }, number, 'es', '', 'windrose'),
    ['Dirección incompleta: hay frecuencias desconocidas.']);
});

test('Comparison details distinguish unknown goals and width omitted at drawing precision', () => {
  const target = { ...point, bullet: { type: 'target', measure: null } };
  assert.equal(observationValue(target, 'bullet', number, 'es'), 'Objetivo: 12');
  assert.deepEqual(comparisonDetails(target, 'es', number, 'kg'), [{ label: 'Medida', value: 'Desconocido' }]);
  assert.deepEqual(comparisonDetails({ bullet: { type: 'measure', target: 0 } }, 'es', number, 'kg'),
    [{ label: 'Objetivo', value: '0 kg' }]);
  assert.deepEqual(comparisonDetails({ bullet: { type: 'measure', target: null } }, 'en', number),
    [{ label: 'Target', value: 'Unknown' }]);
  const negligible = { variwide: { z: Number.MIN_VALUE, share: 0, geometryOmitted: true, zeroWidth: false } };
  const zero = { variwide: { z: 0, share: 0, geometryOmitted: true, zeroWidth: true } };
  assert.deepEqual(comparisonDetails(negligible, 'es', number).slice(1), [
    { label: 'Proporción del ancho', value: 'Inferior a la precisión de representación' },
    { label: 'Representación', value: 'Marcador por límite de precisión' },
  ]);
  assert.deepEqual(comparisonDetails(zero, 'en', number).slice(1), [
    { label: 'Width share', value: '0%' },
    { label: 'Representation', value: 'Zero-width marker' },
  ]);
  for (const observation of [point, target, negligible, zero, { bullet: { type: 'measure', target: undefined } }]) {
    assert.equal(comparisonDetailCount(observation), comparisonDetails(observation, 'en', number).length);
  }
});

test('Relationship details preserve direction, incident totals and source values below drawing precision', () => {
  const node = { ...point, incomplete: true, relationship: { type: 'node', incoming: 0, outgoing: 12 } };
  assert.equal(observationValue(node, 'dependencywheel', number, 'en'), 'Known incident total: 12');
  assert.equal(observationValue(node, 'arcdiagram', number, 'es'), 'Total incidente conocido: 12');
  assert.deepEqual(directionalDetails(node, number, 'en', '', 'dependencywheel'), [
    'Known incoming: 0', 'Known outgoing: 12', 'Data: Incomplete total: some relation values are unknown',
  ]);
  assert.deepEqual(directionalDetails(node, number, 'es', '', 'arcdiagram'),
    ['Datos: Total incompleto: hay relaciones con valor desconocido']);
  const link = { type: 'link', fromLabel: 'A', toLabel: 'B', geometryOmitted: true };
  assert.deepEqual(directionalDetails({ ...point, value: 0, relationship: { ...link, directed: true } }, number, 'es', '', 'dependencywheel'),
    ['Origen: A', 'Destino: B', 'Representación: Valor cero sin área inventada']);
  assert.deepEqual(directionalDetails({ ...point, relationship: { ...link, directed: false } }, number, 'en', '', 'chord'),
    ['Endpoint A: A', 'Endpoint B: B', 'Representation: Below geometric precision; original value preserved']);

  const tiny = Number.MIN_VALUE;
  const sankey = { ...point, value: tiny, sankey: { type: 'link', geometryOmitted: true } };
  assert.equal(observationValue(sankey, 'sankey', value => value.toFixed(2), 'es'),
    'Flujo: 5e-324 · inferior a la precisión de dibujo');
  assert.equal(observationValue({ ...point, incomplete: true, sankey: { type: 'node', incoming: 0, outgoing: 12 } }, 'sankey', number),
    'Incoming: 0 · Outgoing: 12 · known values, incomplete data');
});

test('Pictorial and tile details distinguish missing, out-of-range and unknown values', () => {
  const pictorial = { capacity: null, total: null, totalStatus: 'overflow', status: 'noInk', incomplete: true };
  assert.deepEqual(directionalDetails({ ...point, pictorial }, number, 'es'), [
    'Capacidad: Sin capacidad positiva conocida',
    'Total visible conocido: Fuera del rango numérico representable',
    'Datos: Total incompleto: hay valores ausentes o desconocidos',
    'Representación: Sin zona rellena; el dato original se conserva',
  ]);
  const knownZero = { capacity: 20, total: 0, status: 'zero', incomplete: false };
  assert.deepEqual(directionalDetails({ ...point, pictorial: knownZero }, number, 'en'),
    ['Capacity: 20', 'Visible total: 0', 'Representation: Known zero, without invented filled area']);
  const unknown = { ...knownZero, total: null, status: 'filled' };
  assert.deepEqual(directionalDetails({ ...point, pictorial: unknown }, number, 'en'),
    ['Capacity: 20', 'Visible total: Unknown']);
  const cell = { sourceX: -2, sourceY: 0 };
  assert.deepEqual(directionalDetails({ ...point, tilemap: { ...cell, color: { type: 'class', classId: 'x' } } }, number, 'es'),
    ['Celda original: -2, 0', 'Clase de color: x']);
  assert.deepEqual(directionalDetails({ ...point, tilemap: { ...cell, color: { type: 'unclassified' } } }, number, 'es'),
    ['Celda original: -2, 0', 'El valor queda fuera de las clases de color declaradas.']);
  assert.deepEqual(directionalDetails({ ...point, heatmap: { color: { type: 'continuous', clamped: true } } }, number, 'en'),
    ['Color is clamped to the scale; the original value is preserved.']);
});

test('Contour and regression details explain derived values without replacing original samples', () => {
  const contour = { row: 0, column: 2, level: 9, sourceIds: ['a', 'b'], sourceValues: [0, -4] };
  assert.equal(observationValue({ ...point, contour }, 'contour', number, 'es'), 'Nivel: 9');
  assert.deepEqual(directionalDetails({ ...point, contour }, number, 'es'),
    ['Isolínea interpolada · no es una muestra medida', 'Celda: 1, 3', 'a: 0', 'b: -4']);
  const modelId = 'fitted';
  const fit = { ...point, regression: { type: 'fit', modelId } };
  assert.equal(observationValue(fit, 'regression', number, 'es'), 'Estimación: 12');
  assert.deepEqual(directionalDetails(fit, number, 'en'), ['Calculated fit from original samples']);
  const base = { sourceSeriesId: modelId, sampleCount: 5, missingCount: 2 };
  const details = (locale, model) => directionalDetails(fit, number, locale, '', 'regression', { models: [{ ...base, ...model }] });
  assert.deepEqual(details('es', { status: 'ready', slope: 0, intercept: -2, rSquared: null }),
    ['Pares conocidos: 5', 'Pares desconocidos: 2', 'Pendiente: 0', 'Ordenada: -2', 'R²: Indefinido para una respuesta constante']);
  assert.deepEqual(details('en', { status: 'ready', slope: 2, intercept: 1, rSquared: 0.95 }).slice(2),
    ['Slope: 2', 'Intercept: 1', 'R²: 0.95']);
  assert.equal(details('en', { status: 'constant-x' }).at(-1), 'No fit: all known X values are equal');
  assert.equal(details('es', { status: 'insufficient-data' }).at(-1), 'Sin ajuste: se necesitan al menos dos pares XY conocidos');
});

test('Both locales preserve source values, units and inference labels in tooltip text', () => {
  const cases = [
    ['regression', { regression: { type: 'fit' } }, 'Estimación: 12', 'Estimate: 12'],
    ['violin', { violin: { median: 0 } }, 'Mediana: 0', 'Median: 0'],
    ['contour', { contour: { level: -4 } }, 'Nivel: -4', 'Level: -4'],
    ['sankey', { sankey: { type: 'node', incoming: 0, outgoing: 12 }, incomplete: true },
      'Entrada: 0 · Salida: 12 · valores conocidos, datos incompletos',
      'Incoming: 0 · Outgoing: 12 · known values, incomplete data'],
    ['sankey', { value: Number.MIN_VALUE, sankey: { type: 'link', geometryOmitted: true } },
      'Flujo: 5e-324 · inferior a la precisión de dibujo', 'Flow: 5e-324 · below drawing precision'],
    ['vector', {}, 'Magnitud: 12', 'Magnitude: 12'],
    ['windbarb', {}, 'Velocidad: 12', 'Speed: 12'],
    ['boxplot', { minimumValue: 0, q1Value: 2, medianValue: 3, q3Value: 5, maximumValue: 8 },
      'Mín. 0 · Q1 2 · Mediana 3 · Q3 5 · Max 8', 'Min 0 · Q1 2 · Median 3 · Q3 5 · Max 8'],
  ];
  for (const [family, patch, es, en] of cases) {
    for (const [locale, expected] of [['es', es], ['en', en]]) {
      assert.equal(observationValue({ ...point, ...patch }, family, number, locale), expected);
    }
  }
  for (const [locale, coverage, speed, unknown, partial] of [
    ['es', 'Cobertura declarada: 90%', 'Desde: 270°', 'Dirección desconocida', /frecuencias desconocidas/],
    ['en', 'Declared coverage: 90%', 'From: 270°', 'Unknown direction', /frequencies are unknown/],
  ]) {
    const fan = { type: 'interval', coverage: .9 };
    assert(directionalDetails({ ...point, fan }, number, locale).includes(coverage));
    assert(directionalDetails({ ...point, wind: { direction: 270 } }, number, locale).includes(speed));
    assert(directionalDetails({ ...point, wind: { direction: null } }, number, locale).includes(unknown));
    assert.match(directionalDetails({ ...point, incomplete: true }, number, locale, '', 'windrose')[0], partial);
  }
  const flame = { selfDuration: 0, depth: 2, childCount: 1 };
  const violin = { median: 0, q1: -1, q3: 2, minimum: -2, maximum: 3, mean: 0, sampleCount: 3, missingCount: 1, bandwidth: 2 };
  assert.equal(directionalDetails({ ...point, flame }, number, 'en', 'cycles', 'flame')[0], 'Self duration: 0 cycles');
  assert.equal(directionalDetails({ ...point, flame }, number, 'es', '', 'flame')[0], 'Tiempo propio: 0');
  assert.equal(directionalDetails({ ...point, violin }, number, 'en', '', 'violin').at(-1), 'Kernel bandwidth: 2');
  assert.equal(directionalDetails({ ...point, violin }, number, 'es', 'µs', 'violin').at(-1), 'Ancho del núcleo: 2 µs');
});
