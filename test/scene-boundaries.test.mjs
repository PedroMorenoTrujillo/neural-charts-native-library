import assert from 'node:assert/strict';
import test from 'node:test';
import { ownScene, sceneSvg } from '../dist/library/scene.js';
import { planNativeChart } from '../dist/native/plan.js';

const size = { width: 360, height: 240 };
const axes = {
  x: { type: 'linear', domain: [0, 10] },
  y: { type: 'linear', domain: [0, 10] },
};
const source = { id: 's', name: 'Samples' };
const line = {family: 'line', axes, series: [{...source, data: [{id: 'a', x: 1, y: 2}, {id: 'b', x: 5, y: 7}]}]};
const datum = { id: 'one', label: 'One', value: 1 };
const nodes = [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }];
const edge = { id: 'a-b', from: 'a', to: 'b' };

function planned(spec = line, options = size) {
  const result = planNativeChart({title: 'Measurements', ...spec}, options);
  assert.equal(result.status, 'ok', JSON.stringify(result.diagnostic));
  return result.scene;
}

function repeatedPoints(template, count, prefix = 'sample') {
  return Array.from({length: count}, (_, i) => ({...template, id: {...template.id, pointId: prefix + '-' + i}}));
}

function seriesWith(scene, changes) {
  return {...scene, series: [{...scene.series[0], ...changes}, ...scene.series.slice(1)]};
}

function pointWith(scene, changes, index = 0) {
  return {...scene, observations: scene.observations.map((point, i) => i === index ? {...point, ...changes} : point)};
}

test('Native transports exactly 16 distinct series through the public planner and rejects a larger envelope', () => {
  const series = Array.from({length: 16}, (_, i) => ({
    id: 's-' + i, name: 'Sample ' + i, data: [{id: 'same-point-id', x: 4, y: i / 2}],
  }));
  const scene = planned({...line, series});
  assert.equal(scene.series.length, 16);
  assert.deepEqual(scene.observations.map(point => point.id.seriesId), series.map(item => item.id));
  assert.equal(scene.observations[0].value, 0);
  const last = {...scene.series.at(-1), id: 'extra', name: 'Extra'};
  assert.throws(() => ownScene({...scene, series: [...scene.series, last]}), /Unbounded native scene/);
  assert.throws(() => ownScene({...scene, legend: [...scene.legend, {...scene.legend[0], id: 'extra'}]}), /Unbounded native scene/);
});

test('Native transport enforces independent observation, axis and annotation budgets', () => {
  const scene = planned(), [point] = scene.observations;
  const withoutGroup = {...point, group: undefined};
  const observations = repeatedPoints(withoutGroup, 10_000);
  const full = {...scene, series: [scene.series[0]], observations,
    grid: Array.from({length: 32}, (_, i) => ({y: i, label: String(i), value: i, type: 'number'})),
    labels: Array.from({length: 64}, (_, i) => ({x: i, label: 'tick-' + i})),
    annotations: Array.from({length: 64}, (_, i) => ({x: i, y: 4, text: String(i), role: 'label'})),
    yLabels: Array.from({length: 64}, (_, i) => ({id: 'row-' + i, y: i, label: 'Row ' + i})),
  };
  const owned = ownScene(full);
  assert.equal(owned.observations.at(-1).id.pointId, 'sample-9999');
  assert.equal(owned.grid.at(-1).value, 31);
  assert.ok(Object.isFrozen(owned.observations[0].id));
  for (const key of ['observations', 'grid', 'labels', 'annotations', 'yLabels']) {
    assert.throws(() => ownScene({...full, [key]: [...full[key], full[key][0]]}), /Unbounded native scene/);
  }
});

test('Native transport applies smaller family budgets to valid Core scenes', () => {
  const samples = [
    [{family: 'vector', axes, series: [{...source, data: [{id: 'a', x: 1, y: 2, dx: 3, dy: 4}]}]}, 2048, /Directional point budget exceeded/],
    [{family: 'funnel', data: [datum]}, 16, /Stage input limit/],
    [{family: 'sunburst', root: {id: 'root', children: [datum]}}, 512, /Hierarchy node budget exceeded/],
    [{family: 'treemap', root: {id: 'root', children: [datum]}}, 512, /Unbounded native hierarchy/],
    [{family: 'networkgraph', nodes, links: [edge]}, 128, /Hierarchy node budget exceeded/],
    [{family: 'packedbubble', series: [{...source, data: [datum]}]}, 256, /Packed bubble point budget exceeded/],
    [{family: 'item', data: [datum]}, 16, /Item unit budget or geometry invalid/],
  ];
  for (const [spec, limit, diagnostic] of samples) {
    const scene = planned(spec);
    assert.throws(() => ownScene({...scene, observations: repeatedPoints(scene.observations[0], limit + 1)}),
      diagnostic, spec.family);
  }
  const tree = planned({family: 'treemap', root: {id: 'root', children: [datum]}});
  const group = tree.series.find(item => item.bars?.length);
  assert.ok(group);
  assert.throws(() => ownScene({...tree, series: [{...group, bars: Array(513).fill(group.bars[0])}]}), /Unbounded native hierarchy/);
  for (const [spec, limit, diagnostic] of [samples[5], samples[6]]) {
    const scene = planned(spec);
    assert.throws(() => ownScene(seriesWith(scene, {circles: Array(limit === 16 ? 257 : limit + 1).fill(scene.series[0].circles[0])})), diagnostic);
  }
});

test('Sankey caps node, link and aggregate observations independently and preserves measured throughput', () => {
  const scene = planned({family: 'sankey', nodes, links: [{...edge, value: 1}]});
  const node = scene.observations.find(point => point.sankey?.type === 'node');
  const link = scene.observations.find(point => point.sankey?.type === 'link');
  assert.equal(node.value, Math.max(node.sankey.incoming, node.sankey.outgoing));
  assert.equal(link.value, 1);
  for (const observations of [repeatedPoints(node,129), repeatedPoints(link,513), repeatedPoints(node,641)]) {
    assert.throws(() => ownScene({...scene, observations}), /Sankey observation budget exceeded/);
  }
  assert.throws(() => ownScene(pointWith(scene, {value: 2}, scene.observations.indexOf(node))), /Invalid Sankey throughput/);
  assert.throws(() => ownScene(pointWith(scene, {sankey: {...link.sankey, to: link.sankey.from}}, scene.observations.indexOf(link))), /Invalid Sankey link/);
  assert.throws(() => ownScene(pointWith(scene, {sankey: {...link.sankey, geometryOmitted: true}}, scene.observations.indexOf(link))), /Invalid Sankey semantics/);
});

test('Native SVG preserves accepted relative geometry and rejects invalid numeric path segments', () => {
  const scene = planned();
  const geometry = 'm 10 10 5 5 h 7 v -4 c 1 2 3 4 5 6 s 0 1 2 3 q 1 2 3 4 t 5 6 a 2 3 0 1 0 2 3 z M 0 0 L 1.2e+1,-.5';
  const transported = ownScene(seriesWith(scene, {path: geometry}));
  assert.equal(transported.series[0].path, geometry);
  assert.ok(sceneSvg(transported, '#eeeeee').includes('d="' + geometry + '"'));
  for (const path of ['L 1 0', 'M ,1 1', 'M 2', 'M 0 0 L 3,,1', 'M 0 0 A -2 3 0 0 1 4 5',
    'M 0 0 A 2 -3 0 0 1 4 5', 'M 0 0 A 2 3 0 2 1 4 5', 'M 0 0 A 2 3 0 0 2 4 5',
    'M 400000 0', 'M 360000 0 h 10000', 'M 0 360000 v 10000', 'M 1 1 z 2 3']) {
    assert.throws(() => ownScene(seriesWith(scene, {path})), /Invalid native path geometry/, path);
  }
  assert.throws(() => ownScene(seriesWith(scene, {path: 'M 1e999 0'})), /Nonfinite native path geometry/);
  assert.throws(() => ownScene(seriesWith(scene, {areaPath: 'M 1 1 L 2 2'})), /Invalid area path/);
  assert.throws(() => ownScene(seriesWith(scene, {nodePath: 'M 1 1'})), /Invalid relationship node path/);
});

test('Native rejects oversized transport paths before parsing their geometry', () => {
  const scene = planned(), path = 'M 0 0' + ' '.repeat(999_995);
  assert.equal(path.length, 1_000_000);
  assert.throws(() => ownScene(seriesWith(scene, {path: path + ' '})), /Unbounded native scene/);
  const series = [0,1,2].map(i => ({id:'s-' + i,name:'Sample ' + i,color:'#112233',path}));
  assert.ok(ownScene({...scene, series: series.slice(0,2), observations: [], legend: []}).series.every(s=>s.path.length===1_000_000));
  assert.throws(() => ownScene({...scene, series, observations: [], legend: []}), /Unsupported or unbounded native scene/);
});

test('Native rejects invalid plot clips and preserves true clipped packed-bubble geometry', () => {
  const scene = planned({family: 'packedbubble', series: [{...source, data: [datum]}]});
  const [packed] = scene.series, [original] = packed.circles;
  const clip = {x: 60, y: 40, width: 180, height: 160};
  const clipped = { ...original, cx: -10, cy: 120, radius: 80 };
  const transported = ownScene({...seriesWith(scene, {circles: [clipped]}), clip});
  assert.equal(transported.series[0].circles[0].cx, -10);
  assert.equal(transported.series[0].circles[0].radius, 80);
  for (const bad of [{...clip,x:-1},{...clip,y:-1},{...clip,width:0},{...clip,height:0},{...clip,width:361},{...clip,height:240}]) {
    assert.throws(() => ownScene({...scene, clip: bad}), /Invalid plot clip/);
  }
  assert.throws(() => ownScene({...planned(), clip}), /Invalid plot clip/);
  for (const bad of [{...clipped,cx:-30},{...clipped,radius:2881},{...clipped,radius:-1},{...clipped,cy:NaN}]) {
    assert.throws(() => ownScene({...seriesWith(scene, {circles:[bad]}), clip}), /Invalid circle/);
  }
});

test('Native binds primitive identity to measured values and rejects corrupt bar and hit geometry', () => {
  const scene = planned();
  const [p] = scene.observations;
  const bar = {pointId: p.id.pointId, x: 10, y: 10, width: 10, height: 10};
  for (const changed of [{x:-1},{y:-1},{width:-1},{height:-1},{x:355},{y:235},{x:Infinity}]) {
    assert.throws(() => ownScene(seriesWith(scene, {circles: undefined, bars: [{...bar,...changed}]})), /Invalid bar/);
  }
  assert.throws(() => ownScene(seriesWith(scene, {circles:undefined,bars:[{...bar,pointId:'unknown'}]})), /Primitive point ID has no observation/);
  assert.throws(() => ownScene(seriesWith(scene, {circles:undefined,bars:[bar,bar]})), /Duplicate primitive point ID/);
  assert.throws(() => ownScene(pointWith(scene, {hit:{type:'circle',cx:p.x,cy:p.y,radius:257}})), /Unbounded circle hit region/);
  assert.throws(() => ownScene(pointWith(scene, {hit:{type:'circle',cx:-1,cy:p.y,radius:10}})), /Invalid hit region/);
});

test('Native radial hit regions must share a center and fit within one non-overlapping revolution', () => {
  const scene = planned({family:'donut',data:[datum,{id:'two',label:'Two',value:3}]});
  const [first, second] = scene.observations.map(point => point.hit);
  assert.ok(first.end <= second.start + 1e-10);
  for (const bad of [{innerRadius:-1},{innerRadius:first.radius+1},{start:first.end+1},{end:first.start+7},{end:NaN}]) {
    assert.throws(() => ownScene(pointWith(scene,{hit:{...first,...bad}})), /Invalid sector/);
  }
  assert.throws(() => ownScene(pointWith(scene,{hit:{...first,cx:first.cx+1}})), /Invalid shared radial frame/);
  assert.throws(() => ownScene(pointWith(scene,{hit:{...second,start:first.start}},1)), /Overlapping sectors/);
  assert.throws(() => ownScene(pointWith(scene,{hit:{...second,start:second.start+1,end:second.end+1}},1)), /Invalid radial turn/);
});

test('native axes preserve independent units and typed tick values while rejecting malformed coordinates', () => {
  const categories = {type:'category',values:[{id:'a'},{id:'b'}]};
  const scene = planned({
    family:'mixed',axes:{x:categories,y:{type:'linear',domain:[0,10]},secondaryY:{type:'linear',domain:[0,20]}},
    series:[{...source,type:'column',data:[{id:'a',x:'a',y:2}]},
      {id:'other',name:'Other',type:'line',yAxis:'secondary',data:[{id:'a',x:'a',y:12}]}],
  });
  const first = {y:4,label:'Twelve',value:12,type:'number'};
  const typed = ownScene({...scene,secondaryUnit:'litres',secondaryGrid:[first]});
  assert.equal(typed.secondaryUnit,'litres');
  assert.deepEqual(typed.secondaryGrid,[first]);
  assert.ok(Object.isFrozen(typed.secondaryGrid[0]));
  assert.throws(() => ownScene({...scene,secondaryUnit:'x'.repeat(65)}), /Invalid mixed-axis presentation/);
  for (const override of [{y:-1},{y:241},{y:Infinity},{label:'x'.repeat(65)},{label:1}]) {
    assert.throws(() => ownScene({...scene,secondaryGrid:[{...first,...override}]}), /Invalid secondary tick/);
  }
  for (const override of [{value:NaN},{type:'category'}]) {
    assert.throws(() => ownScene({...scene,secondaryGrid:[{...first,...override}]}), /Invalid axis tick value/);
  }
  assert.throws(() => ownScene({...scene,secondaryGrid:Array(33).fill(first)}), /Invalid secondary axis/);
  const primary = planned();
  assert.throws(() => ownScene({...primary,secondaryGrid:[first]}), /Invalid secondary axis/);
  assert.throws(() => ownScene(pointWith(primary,{valueAxis:'secondary'})), /Invalid mixed-axis presentation/);
  assert.throws(() => ownScene({...primary,grid:[{y:-1,label:'Invalid'}]}), /Invalid grid/);
  assert.throws(() => ownScene({...primary,labels:[{x:361,label:'Outside'}]}), /Invalid label/);
  const row = {id:'same',y:5,label:'Duplicated'};
  assert.throws(() => ownScene({...primary,yLabels:[row,row]}), /Invalid category label/);
});

test('group coordinates and primitive descriptors keep their original identity without evaluating accessors', () => {
  const scene = planned();
  const [first, second] = scene.observations;
  assert.notEqual(first.group.key,second.group.key);
  assert.throws(() => ownScene(pointWith(scene,{group:{...first.group,coordinate:second.group.coordinate}})),
    /Ambiguous observation group coordinate/);
  assert.throws(() => ownScene(pointWith(scene,{group:{...first.group,key:second.group.key}})), /Inconsistent observation group/);
  const circle = {cx:first.x,cy:first.y,radius:2};
  let reads = 0;
  Object.defineProperty(circle,'pointId',{get(){reads++;return first.id.pointId;}});
  assert.throws(() => ownScene(seriesWith(scene,{circles:[circle]})), /Invalid primitive identity/);
  const raw = {...scene};
  Object.defineProperty(raw,'referenceBands',{get(){reads++;return [];}});
  assert.throws(() => ownScene(raw), /Invalid reference band property/);
  assert.equal(reads,0);
});

test('item and dumbbell geometries preserve the exact number of source-matched primitives', () => {
  const item = planned({family:'item',data:[{...datum,value:2}]});
  const [units] = item.series;
  assert.equal(units.circles.length,2);
  assert.equal(units.circles[0].pointId,item.observations[0].id.pointId);
  assert.throws(() => ownScene(seriesWith(item,{circles:units.circles.slice(1)})), /Item count does not match exact units/);
  const [first] = units.circles;
  assert.throws(() => ownScene(seriesWith(item,{circles:[{cx:first.cx,cy:first.cy,radius:first.radius}]})),
    /Item units require source identity/);
  assert.throws(() => ownScene(seriesWith(item,{path:'M 1 1 L 2 2'})), /Item unit budget or geometry invalid/);

  const range = planned({family:'dumbbell',axes:{x:{type:'category',values:[{id:'a'}]},y:{type:'linear',domain:[0,10]}},
    series:[{...source,data:[{id:'interval',x:'a',low:2,high:7}]}]});
  const [pair] = range.series, [observation] = range.observations;
  assert.deepEqual(pair.circles.map(circle=>circle.pointId),['interval','interval']);
  assert.throws(() => ownScene(seriesWith(range,{circles:[...pair.circles,pair.circles[0]]})), /Duplicate primitive point ID/);
  assert.throws(() => ownScene(pointWith(range,{stem:{...observation.stem,startY:-1}})), /Invalid stem geometry/);
  assert.throws(() => ownScene(pointWith(range,{lowValue:8})), /Invalid interval semantics/);
});

test('polygon hits reject out-of-frame, collapsed and crossing geometry before reaching the renderer', () => {
  const scene = planned({family:'funnel',data:[datum,{id:'two',label:'Two',value:3}]});
  const hit = vertices => ({type:'polygon',vertices:vertices.map(([x,y])=>({x,y}))});
  const valid=hit([[10,10],[30,10],[18,15],[30,30],[10,30]]);
  assert.deepEqual(ownScene(pointWith(scene,{hit:valid})).observations[0].hit,valid);
  for (const [polygon,diagnostic] of [
    [hit([[0,0],[1,1]]), /Invalid polygon hit region/],
    [hit([[0,0],[1,1],[361,2]]), /Invalid polygon vertex/],
    [hit([[0,0],[3,2],[3,2],[0,3]]), /Collapsed polygon edge/],
    [hit([[0,0],[1,1],[2,2]]), /Degenerate polygon hit region/],
    [hit([[1,1],[20,20],[1,18],[10,1]]), /Self-intersecting polygon hit region/],
  ]) {
    assert.throws(() => ownScene(pointWith(scene,{hit:polygon})), diagnostic);
  }
});
