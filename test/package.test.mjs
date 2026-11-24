import assert from 'node:assert/strict';
import {test} from 'node:test';
import {NativeChartSession} from '../dist/library/index.js';
import {planNativeChart} from '../dist/native/plan.js';

test('compiled planner preserves zero and skips missing data during selection', () => {
  const result = planNativeChart({
    family: 'line',
    title: 'Visits',
    axes: {
      x: {type: 'category', values: [
        {id: 'mon', label: 'Mon'}, {id: 'tue', label: 'Tue'}, {id: 'wed', label: 'Wed'},
      ]},
      y: {type: 'linear'},
    },
    series: [{id: 'visits', name: 'Visits', data: [
      {id: 'mon', x: 'mon', y: 29},
      {id: 'wed', x: 'wed', y: 0},
    ]}],
  }, {width: 360, height: 280});
  assert.equal(result.status, 'ok', result.status === 'invalid' ? JSON.stringify(result.diagnostic) : undefined);
  assert.deepEqual(result.scene.observations.map(({id, value}) => [id.pointId, value]), [
    ['mon', 29], ['wed', 0],
  ]);
  const snapshots = [];
  const session = new NativeChartSession(result.scene, {
    request: () => 1,
    cancel: () => {},
  }, {
    allowed: () => false,
    selection: () => assert.fail('Haptics are disabled'),
  }, snapshot => snapshots.push(snapshot));
  try {
    session.step('first');
    assert.deepEqual(session.snapshot.selected, {seriesId: 'visits', pointId: 'mon'});
    session.step(1);
    assert.deepEqual(snapshots.at(-1)?.selected, {seriesId: 'visits', pointId: 'wed'});
    session.clear();
    assert.equal(session.snapshot.selected, null);
  } finally {
    session.destroy();
  }
});

test('compiled planner rejects a malformed chart', () => {
  assert.equal(planNativeChart({family: 'line'}, {width: 360, height: 280}).status, 'invalid');
});

test('a mixed chart picks the column body and the line drawn over it', () => {
  const result = planNativeChart({
    family:'mixed', title:'Sales',
    axes:{x:{type:'category',values:[{id:'a',label:'A'},{id:'b',label:'B'}]},y:{type:'linear',includeZero:true}},
    series:[
      {type:'column',id:'sales',name:'Sales',data:[{id:'a',x:'a',y:80},{id:'b',x:'b',y:60}]},
      {type:'line',id:'trend',name:'Trend',data:[{id:'a',x:'a',y:30},{id:'b',x:'b',y:20}]},
    ],
  },{width:360,height:280});
  assert.equal(result.status,'ok');
  const bar=result.scene.series.find(s=>s.id==='sales').bars[0];
  const line=result.scene.observations.find(p=>p.id.seriesId==='trend' && p.id.pointId===bar.pointId);
  // A shared category can have subpixel roundoff between a rectangle centre and a line anchor.
  const scene={...result.scene,observations:result.scene.observations.map(p=>p===line?{...p,x:p.x+1e-10}:p)};
  const makeSession=mode=>new NativeChartSession(scene,{request:()=>1,cancel:()=>{}},{allowed:()=>false,selection:()=>{}},()=>{},null,mode);
  const session=makeSession('point'),shared=makeSession('shared');
  try {
    const x=bar.x+bar.width/2,y=bar.y+bar.height*.9;
    session.tap(x,y);
    assert.deepEqual(session.snapshot.selected,{seriesId:'sales',pointId:bar.pointId});
    session.tap(line.x-.25,line.y);
    assert.deepEqual(session.snapshot.selected,line.id);
    shared.tap(x,y);
    assert.deepEqual(shared.snapshot.shared.rows.map(r=>r.point.value),[80,30]);
  } finally {session.destroy();shared.destroy();}
});
