import assert from 'node:assert/strict';
import test from 'node:test';
import {ownScene, sceneSvg} from '../dist/library/scene.js';
import {ownColorAxis, ownValueColor, tilemapCellsSvg} from '../dist/library/tilemap-scene.js';
import {chartEmptyState} from '../dist/library/empty-state.js';
import {HeatmapHitIndex} from '../dist/library/heatmap-hit.js';
import {PictorialHitIndex} from '../dist/library/pictorial-hit.js';
import {VennHitIndex} from '../dist/library/venn-hit.js';
import {RelationshipHitIndex} from '../dist/library/relationship-hit-index.js';
import {markerBatchSvg,markerSvg,resolveMarkerStyle,sameMarkerStyle} from '../dist/library/marker-style.js';
import {planNativeChart} from '../dist/native/plan.js';
import {prepareNativeWordCloud, measuringWordCloud} from '../dist/native/wordcloud-planning.js';
import {WordCloudMeasurements} from '../dist/native/wordcloud-measurements.js';
import {ownChartPanels, panelVisibility, samePanelVisibility, updatePanelVisibility} from '../dist/native/chart-panels-state.js';
import {forcedLabelLimit, nativeValueLabels} from '../dist/native/value-labels.js';
import {dendrogramLabels} from '../dist/native/dendrogram-labels.js';
import {nativeLogAxisLabels} from '../dist/native/log-axis-labels.js';
import {nativeTimeAxisLabels} from '../dist/native/time-axis-labels.js';
import {textColorOnSurface} from '../dist/native/label-contrast.js';

const size = {width:360,height:240};
const category = {type:'category',values:[{id:'a',label:'A'},{id:'b',label:'B'}]};
const axes = {x:category,y:{type:'linear',domain:[0,10]}};
const source = {id:'s',name:'Source'};
const tile = {family:'tilemap',tileShape:'circle',series:[{...source,data:[
  {id:'zero',x:0,y:0,value:0,name:'Origin'}, {id:'missing',x:1,y:0,value:null},
]}]};
const heat = {family:'heatmap',axes:{x:category,y:category},data:[
  {id:'zero',rowId:'a',columnId:'a',value:0}, {id:'missing',rowId:'b',columnId:'b',value:null},
]};
const bullet = {family:'bullet',axes,bands:[{id:'acceptable',from:1,to:8,color:'#446688',label:'Range'}],series:[{...source,data:[
  {id:'observed',x:'a',y:6,target:8},{id:'missing',x:'b',y:null,target:5},
]}]};
const variwide = {family:'variwide',axes,series:[{...source,data:[
  {id:'active',x:'a',y:6,z:1},{id:'zero',x:'b',y:0,z:0},
]}]};
const venn = {family:'venn',sets:[{id:'a',label:'A'},{id:'b',label:'B'}],data:[
  {id:'point-a',sets:['a'],value:12},{id:'point-b',sets:['b'],value:9},{id:'overlap',sets:['a','b'],value:2},
]};
const pictorial = {family:'pictorial',axes,series:[{...source,data:[
  {id:'active',x:'a',y:6},{id:'zero',x:'b',y:0},
]}]};
const baseLine = {family:'line',axes,series:[{...source,data:[{id:'point',x:'a',y:2}]}]};

function scene(spec, options={}) {
  const result=planNativeChart({title:'Original data',...spec},{...size,...options});
  assert.notEqual(result.status,'invalid',JSON.stringify(result.diagnostic));
  return result.scene;
}
function rejected(original, patch, expected) {
  assert.throws(() => ownScene({...original,...patch}), error => error.message===expected);
}
function replaceFirst(items, patch) {
  return [{...items[0],...patch},...items.slice(1)];
}
function firstSeries(original, patch) {
  return {series:replaceFirst(original.series,patch)};
}
function firstObservation(original, patch) {
  return {observations:replaceFirst(original.observations,patch)};
}

test('color axes own explicit and observed bounds, retain exact classes and reject malformed scales',()=>{
  const stops=[{at:0,color:'#112233'},{at:1,color:'#aabbcc'}];
  const continuous={type:'continuous',domain:[-1,4],domainSource:'explicit',stops,missingColor:'#ddeeff'};
  const owned=ownColorAxis(continuous);
  assert.deepEqual(owned,continuous);
  assert.notEqual(owned.domain,continuous.domain);
  assert.notEqual(owned.stops[0],stops[0]);
  assert.equal(ownColorAxis({...continuous,domain:null,domainSource:'none'}).domain,null);
  for(const patch of [{domainSource:'unknown'},{domain:{0:0,1:1}},{domain:[0]},{domain:[1,0]},{domain:[0,Infinity]},
    {stops:null},{stops:[stops[0]]},{stops:Array(9).fill(stops[0])}]){
    assert.throws(()=>ownColorAxis({...continuous,...patch}),/Invalid continuous color axis/);
  }
  for(const at of [-1,2,NaN,0]){
    assert.throws(()=>ownColorAxis({...continuous,stops:[stops[0],{...stops[1],at}]}),/Invalid color stop/);
  }
  assert.throws(()=>ownColorAxis({...continuous,stops:[...stops.slice(0,1),{...stops[1],at:.9}]}),/Color stops must span zero to one/);
  const classes={type:'classes',missingColor:'#ddeeff',unclassifiedColor:'#bbbbbb',classes:[
    {id:'low',label:'Below zero',color:'#224466',maxExclusive:0},
    {id:'high',label:'Zero or more',color:'#663311',minInclusive:0},
  ]};
  assert.deepEqual(ownColorAxis(classes),classes);
  assert.throws(()=>ownColorAxis({...classes,unclassifiedColor:'red'}),/Invalid class color axis/);
  assert.throws(()=>ownColorAxis({...classes,classes:[]}),/Invalid class color axis/);
  assert.throws(()=>ownColorAxis({...classes,classes:[classes.classes[0],classes.classes[0]]}),/Invalid color class/);
  for(const patch of [{id:''},{minInclusive:NaN},{maxExclusive:Infinity},{minInclusive:0,maxExclusive:0}]){
    assert.throws(()=>ownColorAxis({...classes,classes:replaceFirst(classes.classes,patch)}),/Invalid color class/);
  }
  const swatch={type:'continuous',value:0,ratio:.25,clamped:false,color:'#223344'};
  assert.deepEqual(ownValueColor(swatch),swatch);
  for(const patch of [{value:Infinity},{ratio:-.1},{ratio:1.1},{clamped:'no'},{color:'red'},{type:'class',classId:''}]){
    assert.throws(()=>ownValueColor({...swatch,...patch}),/Invalid/);
  }
});

test('tilemap ownership retains known zero and missing paint while rejecting mismatched cells and bounds',()=>{
  const original=scene(tile), own=ownScene({...original});
  assert.deepEqual(own.tilemap.data.map(row=>[row.value,row.color.type]),[[0,'continuous'],[null,'missing']]);
  assert.deepEqual(own.observations.map(row=>row.value),[0]);
  assert.match(sceneSvg(own,'#cccccc'),/fill-opacity="1"/);
  const {tilemap}=original, [point]=original.observations, [paint]=own.series[0].cells;
  const sourcePatch=(patch,diagnostic)=>rejected(original,{tilemap:{...tilemap,...patch}},diagnostic);
  const layout=(patch,diagnostic='Invalid tilemap layout')=>sourcePatch({layout:{...tilemap.layout,...patch}},diagnostic);
  rejected(original,{tilemap:undefined},'Unbounded tilemap scene');
  sourcePatch({data:[...tilemap.data,tilemap.data[0]]},'Duplicate tilemap source');
  for(const patch of [{x:1.5},{y:1_000_001},{visible:'yes'},{observed:0},{geometryDecision:'outside'}]){
    sourcePatch({data:replaceFirst(tilemap.data,patch)},'Invalid tilemap source');
  }
  sourcePatch({data:replaceFirst(tilemap.data,{color:{type:'missing',color:'#bbbbbb'}})},'Invalid tilemap source color');
  for(const patch of [{scale:-1},{paintedCellCount:0},{observedCellCount:0},{knownCount:0},{shape:'triangle'}])layout(patch);
  layout({bounds:{x:0,y:0,width:-1,height:30}},'Invalid tilemap bounds');
  rejected(original,firstObservation(original,{id:{...point.id,pointId:'not-source'}}),'Unmatched tilemap observation');
  rejected(original,firstObservation(original,{tilemap:{...point.tilemap,classLabel:'x'.repeat(257)}}),'Invalid tilemap observation');
  rejected(original,firstObservation(original,{tilemap:{...point.tilemap,color:{...point.tilemap.color,value:1}}}),'Tilemap source/color mismatch');
  for(const patch of [{pointId:''},{opacity:1.5},{opacity:-.1},{color:'green'}]){
    rejected(original,firstSeries(original,{cells:replaceFirst(own.series[0].cells,patch)}),'Invalid tilemap paint');
  }
  for(const patch of [{cx:0},{cy:0},{radius:0},{cx:size.width},{cy:size.height},{radius:NaN}]){
    rejected(original,firstSeries(original,{cells:replaceFirst(own.series[0].cells,{geometry:{...paint.geometry,...patch}})}),
      'Invalid tilemap circle');
  }
  const line=scene(baseLine);
  rejected(line,{tilemap},'Unexpected tilemap scene');
  rejected(line,firstObservation(line,{tilemap:point.tilemap}),'Unexpected tilemap value');
  rejected(line,firstSeries(line,{cells:[paint]}),'Invalid tilemap cells');
  const group=tilemapCellsSvg([paint,{...paint,pointId:'peer'},{...paint,pointId:'translucent',opacity:.5}]);
  assert.equal((group.match(/<path /g)??[]).length,2);
  assert.match(group,/fill-opacity="0\.5"/);
});

test('heatmap verifies exact source coordinates, the channel of color assignment and rectangle paint',()=>{
  const original=scene(heat), matrix=original.heatmap, [point]=original.observations, [series]=original.series;
  const [paint]=series.cells;
  assert.equal(matrix.layout.knownCount,1);
  assert.equal(matrix.layout.missingCount,1);
  assert.equal(matrix.layout.absentCount,2);
  assert.equal(ownScene({...original}).observations[0].value,0);
  const transparent=scene({...heat,opacity:0});
  assert.equal(transparent.heatmap.layout.status,'noInk');
  assert.deepEqual(transparent.observations,[]);
  assert.deepEqual(transparent.heatmap.data.map(row=>row.value),[0,null]);
  const patch=(changes,diagnostic)=>rejected(original,{heatmap:{...matrix,...changes}},diagnostic);
  const layout=(changes,diagnostic='Invalid heatmap layout')=>patch({layout:{...matrix.layout,...changes}},diagnostic);
  rejected(original,{heatmap:undefined},'Invalid bounded heatmap scene');
  for(const changes of [{rowCount:65},{gapRatio:-1},{opacity:2},{columns:null}])layout(changes);
  layout({rows:[]},'Missing exact heatmap bands');
  layout({rows:replaceFirst(matrix.layout.rows,{index:1})},'Heatmap category order changed');
  layout({knownCount:2},'Matrix counts differ from original data');
  for(const changes of [{column:99},{rowId:'invalid'},{painted:false},{rowLabel:'x'.repeat(513)}]){
    patch({data:replaceFirst(matrix.data,changes)},'Invalid original heatmap cell');
  }
  patch({data:[...matrix.data,{...matrix.data[0],id:'duplicate-coordinates'}]},'Duplicate heatmap coordinate');
  patch({data:replaceFirst(matrix.data,{value:1})},'Heatmap source/color mismatch');
  rejected(original,firstSeries(original,{path:'M0 0'}),'Invalid matrix paint role');
  rejected(original,firstSeries(original,{cells:[]}),'Invalid matrix paint role');
  for(const cell of [{pointId:'outside'},{color:'#000000'},{opacity:.5}]){
    rejected(original,firstSeries(original,{cells:replaceFirst(series.cells,cell)}),'Matrix paint does not match source');
  }
  rejected(original,firstSeries(original,{cells:replaceFirst(series.cells,{geometry:{type:'circle',cx:20,cy:20,radius:5}})}),
    'Heatmap paint must be a rectangle');
  const [a,b,c,d]=paint.geometry.vertices;
  rejected(original,firstSeries(original,{cells:replaceFirst(series.cells,{geometry:{...paint.geometry,vertices:[{...a,x:a.x+1},b,c,d]}})}),
    'Heatmap paint differs from exact category bands');
  rejected(original,{observations:[]},'Missing known matrix observations');
  rejected(original,firstObservation(original,{heatmap:{...point.heatmap,rowId:'unknown'}}),'Matrix observation differs from source');
  rejected(original,firstObservation(original,{x:point.x+1}),'Matrix anchor differs from bands');
  rejected(original,firstObservation(original,{heatmap:{...point.heatmap,classLabel:'x'.repeat(257)}}),'Invalid heatmap value');
  const line=scene(baseLine);
  rejected(line,{heatmap:matrix},'Unexpected heatmap metadata');
  rejected(line,firstObservation(line,{heatmap:point.heatmap}),'Unexpected heatmap metadata');
});

test('comparison scenes preserve known targets independent of missing measures and validate their own bands',()=>{
  const original=scene(bullet);
  const {bulletData,bulletBands,bulletTargets,bulletGrid}=original;
  const known=original.observations.find(point=>point.id.pointId==='missing');
  assert.deepEqual(known.bullet,{type:'target',measure:null,target:5});
  assert.deepEqual(ownScene({...original}).bulletTargets,bulletTargets);
  rejected(original,{bulletOrientation:'diagonal'},'Invalid bullet frame');
  rejected(original,{bulletBands:Array(33).fill(bulletBands[0])},'Invalid bullet frame');
  rejected(original,{bulletData:[...bulletData,bulletData[0]]},'Invalid comparison source identity');
  rejected(original,{bulletData:replaceFirst(bulletData,{visible:false})},'Invalid comparison source identity');
  rejected(original,{bulletData:replaceFirst(bulletData,{target:Infinity})},'Invalid bullet source');
  rejected(original,firstObservation(original,{value:99}),'Invalid bullet observation');
  rejected(original,firstObservation(original,{bullet:{...original.observations[0].bullet,target:99}}),'Bullet observation differs from source');
  rejected(original,{bulletBands:replaceFirst(bulletBands,{to:bulletBands[0].from})},'Invalid bullet band');
  rejected(original,{bulletBands:replaceFirst(bulletBands,{rect:{...bulletBands[0].rect,width:size.width+1}})},'Invalid bullet band bounds');
  rejected(original,{bulletTargets:replaceFirst(bulletTargets,{value:99})},'Invalid bullet target');
  rejected(original,{bulletGrid:replaceFirst(bulletGrid,{x2:size.width+1})},'Invalid comparison line');
  rejected(original,{automaticBulletBands:['unknown']},'Invalid automatic bullet band IDs');
});

test('weighted widths preserve original zero and reject orphaned metadata and out-of-frame bands',()=>{
  const original=scene(variwide), {variwideData,categoryBands}=original;
  assert.deepEqual(ownScene({...original}).observations.map(point=>[point.value,point.variwide.z]),[[6,1],[0,0]]);
  rejected(original,{variwideData:undefined,categoryBands:undefined,variwideLayout:undefined},'Missing comparison source');
  rejected(original,{variwideLayout:{...original.variwideLayout,incomplete:'no'}},'Invalid proportional frame');
  rejected(original,{series:[...original.series,{...original.series[0],id:'second'}]},'Proportional layout supports one source series');
  rejected(original,{variwideData:replaceFirst(variwideData,{z:-1})},'Invalid proportional source');
  rejected(original,{variwideData:replaceFirst(variwideData,{missingWidth:true})},'Invalid proportional source');
  rejected(original,firstObservation(original,{value:2}),'Proportional observation differs from source');
  const point=original.observations[0];
  for(const patch of [{z:-1},{share:1.1},{share:-.1},{zeroWidth:true},{geometryOmitted:1}]){
    rejected(original,firstObservation(original,{variwide:{...point.variwide,...patch}}),'Invalid proportional observation');
  }
  for(const patch of [{left:-1},{right:size.width+1},{left:null},{status:'outside'}]){
    rejected(original,{categoryBands:replaceFirst(categoryBands,patch)},'Invalid proportional band');
  }
});

test('Venn owns source membership, exact anchors and fit residuals independently from drawing roles',()=>{
  const original=scene(venn), {venn:source}=original, {layout,data}=source;
  const owned=ownScene({...original});
  assert.deepEqual(owned.venn.data.map(row=>row.value),[12,9,2]);
  assert.deepEqual(owned.observations.map(point=>point.venn.mask),[1,2,3]);
  const patch=(changes,diagnostic)=>rejected(original,{venn:{...source,...changes}},diagnostic);
  const fit=(changes,diagnostic)=>patch({layout:{...layout,...changes}},diagnostic);
  patch({data:data.slice(1)},'Invalid bounded Venn source');
  fit({budgetExhausted:0},'Invalid bounded Venn source');
  fit({objectiveEvaluations:578},'Invalid bounded Venn source');
  rejected(original,{legend:[original.legend[0],original.legend[0]]},'Duplicate Venn set');
  patch({data:replaceFirst(data,{sets:['a','a']})},'Invalid original Venn measurement');
  patch({data:[data[0],{...data[0],id:{...data[0].id,pointId:'other-a'}},data[2]]},'Duplicate Venn relation');
  fit({circles:replaceFirst(layout.circles,{bit:4})},'Circle differs from original set');
  fit({omittedAnchors:1},'Missing known Venn observation');
  rejected(original,firstObservation(original,{x:0,y:0}),'Venn anchor outside its exact region');
  rejected(original,firstObservation(original,{value:100}),'Venn observation differs from source');
  fit({status:'hidden'},'Invalid Venn layout status');
  rejected(original,{series:[]},'Missing visible Venn series');
  rejected(original,firstSeries(original,{path:'M 0 0'}),'Unsupported Venn rendering role');
  rejected(original,firstSeries(original,{circles:replaceFirst(original.series[0].circles,{radius:1})}),'Circle rendering differs from layout');
  fit({errors:[{sets:null,expected:2,actual:2}]},'Invalid Venn fit members');
  fit({errors:[{sets:['a','b'],expected:3,actual:2}]},'Invalid Venn fit residual');
  fit({errors:[{sets:['a','b'],expected:2,actual:0}]},'Venn fit error differs');
});

test('pictorial roles reject glyph mismatch and distinguish displayed values from a real unpainted zero',()=>{
  const original=scene(pictorial), {pictorial:source}=original, {layout,data,glyphs}=source;
  const [point,zero]=original.observations;
  assert.equal(point.hit.type,'compoundPolygon');
  assert.equal(zero.value,0);
  assert.equal(zero.hit,undefined);
  assert.deepEqual(ownScene({...original}).pictorial.data.map(row=>row.y),[6,0]);
  const patch=(changes,diagnostic)=>rejected(original,{pictorial:{...source,...changes}},diagnostic);
  patch({backgroundPath:'C 1 2 3 4 5 6'},'Invalid or unbounded pictorial scene');
  patch({backgroundPath:'L 1 2'},'Invalid native path geometry');
  patch({glyphs:[...glyphs,glyphs[0]]},'Invalid pictorial glyph');
  patch({glyphs:replaceFirst(glyphs,{id:{...glyphs[0].id,type:'foreign'}})},'Invalid pictorial glyph identity');
  patch({glyphs:replaceFirst(glyphs,{bounds:{...glyphs[0].bounds,width:size.width+1}})},'Invalid pictorial glyph');
  patch({data:[...data,data[0]]},'Duplicate pictorial source identity');
  patch({data:replaceFirst(data,{percentage:110})},'Invalid pictorial source summary');
  patch({data:replaceFirst(data,{status:'zero'})},'Invalid pictorial summary state');
  patch({layout:{...layout,capacityRoundoff:{maxExcess:-1,tolerance:0}}},'Invalid pictorial layout summary');
  rejected(original,firstObservation(original,{pictorial:{...point.pictorial,high:-1}}),'Invalid pictorial observation');
  rejected(original,firstObservation(original,{hit:undefined}),'Invalid pictorial value/hit state');
  rejected(original,firstObservation(original,{pictorial:{...point.pictorial,glyphId:{...point.pictorial.glyphId,seriesId:'wrong'}}}),
    'Pictorial glyph/source identity mismatch');
  rejected(original,firstObservation(original,{id:{...point.id,pointId:'foreign'}}),'Unmatched pictorial observation identity');
  const line=scene(baseLine);
  rejected(line,{pictorial:source},'Unexpected pictorial scene metadata');
  rejected(line,firstObservation(line,{hit:point.hit}),'Pictorial roles require pictorial family');
});

test('matrix hit testing separates known zero, missing cells, absent slots and inter-band gaps',()=>{
  const original=scene(heat),matrix=original.heatmap;
  const {rows,columns}=matrix.layout;
  const index=(r=rows,c=columns,data=matrix.data,points=original.observations,w=size.width,h=size.height)=>
    new HeatmapHitIndex(r,c,data,points,w,h);
  const hit=index();
  const center=band=>(band.from+band.to)/2;
  const [known]=original.observations;
  assert.deepEqual(hit.pick(center(columns[0]),center(rows[0])),{type:'known',point:known});
  assert.deepEqual(hit.pick(center(columns[1]),center(rows[1])),{type:'unknown'});
  assert.deepEqual(hit.pick(center(columns[0]),center(rows[1])),{type:'absent'});
  assert.deepEqual(hit.pick((columns[0].to+columns[1].from)/2,center(rows[0])),{type:'gap'});
  assert.deepEqual(hit.pick(NaN,center(rows[0])),{type:'outside'});
  assert.deepEqual(index(rows,columns,matrix.data,[]).pick(known.x,known.y),{type:'absent'});
  assert.throws(()=>index(rows,columns,matrix.data,original.observations,0),/Invalid heatmap frame/);
  assert.throws(()=>index(rows,columns,[...matrix.data,matrix.data[0]]),/Invalid heatmap source coordinate/);
  assert.throws(()=>index(replaceFirst(rows,{to:rows[1].to})),/Overlapping heatmap bands/);
  assert.throws(()=>index([rows[0],{...rows[1],id:rows[0].id}]),/Invalid heatmap band/);
  assert.throws(()=>index(rows,replaceFirst(columns,{from:-1})),/Invalid heatmap band/);
});

test('region indices preserve consumed source geometry and reject foreign masks and hit frames',()=>{
  const picture=scene(pictorial),[point]=picture.observations;
  const geometry=point.hit;
  const make=(entries=[point],width=picture.width,height=picture.height)=>new PictorialHitIndex(entries,width,height);
  const index=make();
  const vertices=geometry.polygons[0];
  const x=vertices.reduce((sum,v)=>sum+v.x,0)/vertices.length,y=vertices.reduce((sum,v)=>sum+v.y,0)/vertices.length;
  assert.equal(index.pick(x,y),point);
  assert.equal(index.pick(picture.width,picture.height),null);
  assert.equal(index.pick(Infinity,y),null);
  assert.throws(()=>make([point],1,1),/Pictorial hit belongs to another frame/);
  assert.throws(()=>make([{...point,hit:structuredClone(geometry)}]),/Pictorial hit must be owned before indexing/);
  assert.throws(()=>make([],0),/Invalid pictorial hit frame/);
  for(const polygons of [[],Array.from({length:65},()=>vertices)]){
    rejected(picture,firstObservation(picture,{hit:{type:'compoundPolygon',polygons}}),'Invalid compound pictorial hit');
  }

  const overlap=scene(venn),circles=overlap.venn.layout.circles;
  const points=overlap.observations.map(point=>({mask:point.venn.mask,point}));
  const setIndex=new VennHitIndex(circles,points,overlap.width,overlap.height);
  for(const {point} of points)assert.equal(setIndex.pick(point.x,point.y),point);
  assert.equal(setIndex.pick(overlap.width+1,0),null);
  assert.throws(()=>new VennHitIndex(circles,[...points,points[0]],size.width,size.height),/Invalid Venn membership/);
  assert.throws(()=>new VennHitIndex(circles,[{...points[0],mask:4}],size.width,size.height),/Invalid Venn membership/);
  assert.throws(()=>new VennHitIndex([...circles,circles[0]],[],size.width,size.height),/Invalid Venn circle/);
});

test('wordcloud rejects stale measurement callbacks and keeps only complete matching glyphs interactive',()=>{
  const source={type:'wordcloud',words:[{id:'old',text:'Previous',weight:4}]};
  const words={type:'wordcloud',words:[
    {id:'cat',text:'Cat',weight:4},{id:'dog',text:'Dog',weight:3},
    {id:'zero',text:'Zero',weight:0},{id:'unknown',text:'Unknown',weight:null},
  ]};
  const prepare=data=>prepareNativeWordCloud(data,undefined,size,[],'native-test-font');
  const a=prepare(source),b=prepare(words);
  assert.equal(a.status,'ok');
  assert.equal(b.status,'ok');
  const idle=measuringWordCloud(b);
  assert.equal(chartEmptyState(idle,'es'),undefined);
  assert.deepEqual(idle.observations,[]);
  const measurements=new WordCloudMeasurements(8,2);
  assert(measurements.begin(a.preparation.requests));
  const stale=measurements.snapshot.probes[0].token;
  assert(measurements.begin(b.preparation.requests));
  assert.equal(measurements.accept(stale,{width:20,height:14}),false);
  for(const [i,probe] of measurements.snapshot.probes.entries()){
    assert(measurements.accept(probe.token,{width:38+i*3,height:20+i*2}));
  }
  const options={wordcloudText:{fontKey:b.fontKey,measurements:measurements.snapshot.measurements}};
  const ready=scene(b.spec,options);
  assert.deepEqual(ready.observations.map(point=>[point.id.pointId,point.value]),[['cat',4],['dog',3]]);
  assert.equal(ready.wordcloud.layout.notDisplayed.zero,1);
  assert.equal(ready.wordcloud.layout.notDisplayed.unknown,1);
  assert.equal(chartEmptyState(ready,'en'),undefined);
  const [glyph]=ready.series[0].textGlyphs;
  rejected(idle,firstSeries(idle,{textGlyphs:[glyph]}),'Pending text cannot be interactive');
  const wordcloud=(patch,diagnostic)=>rejected(ready,{wordcloud:{...ready.wordcloud,...patch}},diagnostic);
  for(const text of ['Cat\nDog','Cat\u2028Dog','Cat\u2029Dog']){
    wordcloud({data:replaceFirst(ready.wordcloud.data,{text})},'Invalid original word');
  }
  wordcloud({data:replaceFirst(ready.wordcloud.data,{decision:{type:'displayed',fontSize:24,rotation:45}})},'Invalid word decision');
  wordcloud({layout:{...ready.wordcloud.layout,displayedWords:3}},'Invalid word layout');
  for(const patch of [{text:'Other'},{fontKey:'foreign-font'},{rotation:glyph.rotation===0?90:0}]){
    rejected(ready,firstSeries(ready,{textGlyphs:replaceFirst(ready.series[0].textGlyphs,patch)}),'Glyph identity differs from source');
  }
  rejected(ready,firstSeries(ready,{textGlyphs:replaceFirst(ready.series[0].textGlyphs,{measured:{width:0,height:20}})}),
    'Invalid measured glyph');
  rejected(ready,firstObservation(ready,{label:'Different word'}),'Word hit differs from source');
  rejected(ready,firstSeries(ready,{textGlyphs:[]}),'Missing text glyph');
  rejected(scene(baseLine),{wordcloud:ready.wordcloud},'Text glyphs require Wordcloud');
  measurements.destroy();
  assert.equal(measurements.begin(b.preparation.requests),false);
});

test('localized empty states distinguish missing samples, hidden sets and zero measurements',()=>{
  const missing=scene({...venn,data:replaceFirst(venn.data,{value:null})});
  const zero=scene({...venn,data:venn.data.map(row=>({...row,value:0}))});
  const hidden=scene(venn,{hiddenSeriesIds:['a','b']});
  assert.equal(chartEmptyState(missing,'en').title,'Unknown intersection');
  assert.equal(chartEmptyState(missing,'es').title,'Intersección desconocida');
  assert.equal(chartEmptyState(zero,'en').title,'All values are zero');
  assert.equal(chartEmptyState(zero,'es').title,'Todos los valores son cero');
  assert.equal(chartEmptyState(hidden,'en').title,'All series are hidden');
  assert.equal(chartEmptyState(hidden,'es').title,'Todas las series están ocultas');
});

const panelSource={type:'line',axes,series:[
  {...source,data:[{id:'point',x:'a',y:2}]},
  {id:'secondary',name:'Secondary',data:[{id:'point',x:'b',y:6}]},
]};
const panelDonut={type:'donut',data:[{id:'shared',label:'Linked share',value:4},{id:'local',label:'Local share',value:3}]};
const panelData={panels:[{id:'first',data:panelSource},{id:'second',data:panelDonut}],
  links:[{id:'pair',members:[{panelId:'first',seriesId:'s'},{panelId:'second',seriesId:'shared'}]}]};

test('panel visibility follows original link identities, preserves own order and ignores inaccessible selections',()=>{
  const result=ownChartPanels(panelData,{
    layout:{columns:2,minPanelWidth:320,gap:8},appearance:{locale:'es',theme:'dark'},
    panels:{second:{appearance:{theme:'light'}}},
  });
  assert.equal(result.status,'ok',JSON.stringify(result.error));
  const owner=result.value;
  assert.deepEqual(owner.layout,{columns:2,minPanelWidth:320,gap:8});
  assert.deepEqual(owner.options.get('first').appearance,{locale:'es',theme:'dark'});
  assert.deepEqual(owner.options.get('second').appearance,{locale:'es',theme:'light'});
  const linked=panelVisibility(owner,{first:['secondary','s','unknown','s'],second:['local']});
  assert.deepEqual(linked,{first:['s','secondary'],second:['shared','local']});
  assert(Object.isFrozen(linked.first));
  const restored=updatePanelVisibility(owner,linked,'second',['local']);
  assert.deepEqual(restored,{first:['secondary'],second:['local']});
  assert.equal(samePanelVisibility(linked,restored),false);
  assert.equal(samePanelVisibility(restored,panelVisibility(owner,restored)),true);
  assert.equal(updatePanelVisibility(owner,restored,'missing',[]),restored);
  assert.equal(updatePanelVisibility(owner,restored,'first',null),restored);
  let reads=0;
  const input={first:Object.defineProperty([],0,{get(){reads++;return 's';}})};
  Object.defineProperty(input,'second',{get(){reads++;return ['local'];}});
  assert.deepEqual(panelVisibility(owner,input),{first:[],second:[]});
  assert.equal(reads,0);
  assert.deepEqual(panelVisibility(owner,null),{first:[],second:[]});
});

test('panel errors identify the bad source, conflicting link or incompatible shared viewport',()=>{
  const failed=(data,options,reason,path,panelId=null)=>{
    const result=ownChartPanels(data,options);
    assert.equal(result.status,'invalid');
    assert.equal(result.error.diagnostic.reason,reason);
    assert.equal(result.error.diagnostic.path,path);
    assert.equal(result.error.panelId,panelId);
  };
  const unsupported={...panelData,panels:replaceFirst(panelData.panels,{data:{type:'unavailable'}})};
  failed(unsupported,{},'UNSUPPORTED_PANEL_TYPE','data.panels[0].data','first');
  failed({...panelData,panels:[panelData.panels[0],panelData.panels[0]]},{},'INVALID_PANEL_ID','data.panels[1]');
  const [goodLink]=panelData.links;
  failed({...panelData,links:[goodLink,{...goodLink,id:'next'}]},{},'CONFLICTING_PANEL_MEMBER','data.links[1].members[0]');
  failed({...panelData,links:[goodLink,goodLink]},{},'INVALID_LINK_ID','data.links[1]');
  failed({...panelData,links:[{...goodLink,members:replaceFirst(goodLink.members,{seriesId:'unknown'})}]},{},
    'UNKNOWN_PANEL_MEMBER','data.links[0].members[0]');
  failed(panelData,{layout:{columns:3}},'INVALID_PANEL_LAYOUT','options');
  failed(panelData,{layout:{gap:65}},'INVALID_PANEL_LAYOUT','options');
  failed(panelData,{appearance:{theme:'other'}},'INVALID_PANEL_APPEARANCE','options.appearance');
  failed(panelData,{panels:{lost:{}}},'UNKNOWN_PANEL_OPTIONS','options.panels');
  failed({...panelData,viewportLinks:[{id:'non-x',axis:'y',panelIds:['first','second']}]},{},
    'INVALID_VIEWPORT_LINK','data.viewportLinks[0]');
  failed({...panelData,viewportLinks:[{id:'scope',axis:'x',panelIds:['first','second']}]},{},
    'INCOMPATIBLE_PANEL_VIEWPORT','data.viewportLinks[0].panelIds[0]');
  failed({...panelData,viewportLinks:[{id:'scope',axis:'x',panelIds:['lost','first']}]},{},
    'INVALID_VIEWPORT_MEMBER','data.viewportLinks[0].panelIds[0]');
});

const labelSettings={points:true,stacks:false,fontScale:1,left:0,visibleWidth:size.width};
const valuesOf=(frame,patch={},format=String,view=size)=>nativeValueLabels(frame,view,format,{...labelSettings,...patch});

test('forced labels preserve original IDs and text while automatic dense labels stay bounded',()=>{
  const axis={type:'linear',domain:[0,300]};
  const source={family:'line',axes:{x:axis,y:{type:'linear',domain:[0,5]}},
    series:[{id:'density',name:'Density',data:Array.from({length:300},(_,x)=>({id:String(x),x,y:2}))}]};
  const dense=scene(source);
  assert.deepEqual(valuesOf(dense),[]);
  const labels=valuesOf(dense,{layout:'truncate',fontScale:Infinity,pointFormatter:({point,value})=>'Original '+point.id.pointId+': '+value});
  assert.equal(labels.length,forcedLabelLimit);
  assert.equal(labels[0].text,'Original 0: 2');
  assert.equal(labels.at(-1).text,'Original 255: 2');
  for(const label of labels){
    assert(label.width<=64);
    assert(label.x>=0&&label.x+label.width<=size.width);
  }
  assert.deepEqual(valuesOf(dense,{visibleWidth:0,layout:'all'}),[]);
});

test('value labels distinguish bubble size, interval median and polygon area from source position',()=>{
  const xy={x:{type:'linear',domain:[0,10]},y:{type:'linear',domain:[0,10]}};
  const bubble=scene({family:'bubble',axes:xy,series:[{...source,data:[{id:'sample',x:4,y:3,z:12}]}]});
  const sizes=valuesOf(bubble,{layout:'all'},n=>'Measure '+n);
  assert.equal(sizes[0].text,'Measure 12');
  assert.equal(bubble.observations[0].value,3);
  const box=scene({family:'boxplot',axes,series:[{...source,data:[{id:'spread',x:'a',minimum:1,q1:2,median:4,q3:6,maximum:9}]}]});
  assert.deepEqual(valuesOf(box,{layout:'all'},n=>'Median '+n).map(label=>label.text),['Median 4']);
  const funnel=scene({family:'funnel',data:[{id:'measured',label:'Measured',value:6},{id:'zero',label:'Zero',value:0}]});
  assert.deepEqual(valuesOf(funnel,{layout:'truncate'},n=>'Long description of '+n).map(label=>label.text),['Long description of 6']);
  assert.deepEqual(valuesOf(funnel,{points:false}),[]);
  assert.deepEqual(valuesOf(funnel,{},n=>'A very long description that does not fit '+n),[]);
});

test('waterfall label placement follows the rendered value edge under axis reversal and fallback bar identities',()=>{
  const data={family:'waterfall',axes:{...axes,y:{type:'linear',domain:[-5,10]}},
    series:[{...source,data:[{id:'positive',x:'a',type:'delta',value:6},{id:'negative',x:'b',type:'delta',value:-3}]}]};
  const create=(reversed)=>scene({...data,axes:{...data.axes,y:{...data.axes.y,reversed}}});
  for(const reversed of [false,true]){
    const frame=create(reversed),labels=valuesOf(frame,{layout:'all'});
    assert.deepEqual(labels.map(label=>label.text),['6','-3']);
    const legacy=ownScene({...frame,points:undefined,
      series:frame.series.map(series=>({...series,bars:series.bars.map(({pointId,...bar})=>bar)}))});
    assert.deepEqual(valuesOf(legacy,{layout:'all'}),labels);
    assert.equal(labels[0].y<labels[1].y,!reversed);
  }
});

async function createProbeHarness(t, backend) {
  await import('@angular/compiler');
  // The tests drive renderer event inputs in a root injection scope, without a native view.
  const ng = await import('@angular/core');
  const {WordCloudTextProbes} = await import('../dist/native/wordcloud-probes.js');
  const {WORDCLOUD_TEXT_BACKEND} = await import('../dist/native/wordcloud-text-backend.js');
  const injector=ng.createEnvironmentInjector([
    {provide:ng.ɵINJECTOR_SCOPE,useValue:'root'},ng.provideZonelessChangeDetection(),
    {provide:WORDCLOUD_TEXT_BACKEND,useValue:backend},
  ],ng.Injector.NULL);
  t.after(()=>{if(!injector.destroyed)injector.destroy();});
  const component=ng.runInInjectionContext(injector,()=>new WordCloudTextProbes());
  const input=ng.signal([]);
  component.probes=input;
  const update=(probes)=>{
    input.set(probes);
    injector.get(ng.ɵEffectScheduler).flush();
  };
  const events={layout:[],text:[],bounds:[],failed:[]};
  component.measuredLayout.subscribe(value=>events.layout.push(value));
  component.measuredText.subscribe(value=>events.text.push(value));
  component.measuredBounds.subscribe(value=>events.bounds.push(value));
  component.measurementFailed.subscribe(value=>events.failed.push(value));
  return {component,events,update,destroy:()=>injector.destroy()};
}

const glyphRequest=(token,text)=>({token,request:{wordId:token,text,fontKey:'test-native-font',fontSize:18}});
const glyphBounds=(width=44,height=18)=>({nativeEvent:{layout:{width,height}}});

test('native word probes fall back to real layout bounds and assemble only complete text events', async t=>{
  const {component,events,update}=await createProbeHarness(t,null);
  const probe=glyphRequest('good','Café au lait');
  update([probe]);
  component.onLayout(probe,{nativeEvent:{layout:{width:NaN,height:18}}});
  component.onLayout(probe);
  assert.deepEqual(events.layout,[]);
  component.onLayout(probe,glyphBounds(95,18));
  component.onLayout(probe,glyphBounds(96,18));
  assert.deepEqual(events.layout,[{token:'good',width:95,height:18},{token:'good',width:96,height:18}]);
  assert.deepEqual(events.bounds,[{token:'good',width:95,height:18}]);
  component.onTextLayout(probe,{nativeEvent:{lines:[{text:'Café ',x:0,y:0,width:37,height:12},
    {text:'au lait',x:3,y:12,width:51,height:12}]}});
  assert.deepEqual(events.text,[{token:'good',complete:true,lineCount:2,width:54,height:24}]);
  component.onTextLayout(probe,{nativeEvent:{lines:[{text:'Café',x:0,y:0,width:35,height:12}]}});
  assert.equal(events.text.at(-1).complete,false);
  component.onTextLayout(probe,{nativeEvent:{lines:[{text:'Café',x:0,y:NaN,width:35,height:12}]}});
  component.onTextLayout(probe,{nativeEvent:{lines:Array(513)}});
  assert.equal(events.text.length,2);
  const newline=glyphRequest('newline','Café\nau lait');
  update([newline]);
  component.onLayout(newline,glyphBounds());
  assert.deepEqual(events.failed,[{token:'newline'}]);
});

test('native word probes cancel superseded backend jobs and ignore their late completions',async t=>{
  const jobs=new Map();
  const backend={measure(key,request){
    if(request.text==='unavailable')throw Error('Font unavailable');
    let resolve,reject;
    const result=new Promise((done,fail)=>{resolve=done;reject=fail;});
    const job={result,resolve,reject,cancels:0,cancel(){this.cancels++;}};
    jobs.set(request.wordId,job);
    return job;
  }};
  const {component,events,update,destroy}=await createProbeHarness(t,backend);
  const before=glyphRequest('old','Previous'), next=glyphRequest('new','Next');
  update([before]);
  component.onLayout(before,glyphBounds());
  component.onLayout(before,glyphBounds());
  assert.equal(jobs.size,1);
  update([next]);
  assert.equal(jobs.get('old').cancels,1);
  jobs.get('old').resolve({width:100,height:20});
  component.onLayout(next,glyphBounds());
  jobs.get('new').resolve({width:48,height:16});
  await Promise.resolve();
  assert.deepEqual(events.bounds,[{token:'new',width:48,height:16}]);
  const rejected=glyphRequest('failed','Rejected');
  update([rejected]);
  component.onLayout(rejected,glyphBounds());
  jobs.get('failed').reject(Error('Backend rejected the measurement'));
  await Promise.resolve();
  await Promise.resolve();
  assert.deepEqual(events.failed,[{token:'failed'}]);
  const unavailable=glyphRequest('sync','unavailable');
  update([unavailable]);
  component.onLayout(unavailable,glyphBounds());
  assert.deepEqual(events.failed,[{token:'failed'},{token:'sync'}]);
  const pending=glyphRequest('pending','Pending');
  update([pending]);
  component.onLayout(pending,glyphBounds());
  destroy();
  assert.equal(jobs.get('pending').cancels,1);
  jobs.get('pending').resolve({width:50,height:18});
  await Promise.resolve();
  assert.deepEqual(events.bounds,[{token:'new',width:48,height:16}]);
});

test('native word probes time out only the live generation and reject late successes from it',async t=>{
  const {component,events,update}=await createProbeHarness(t,null);
  t.mock.timers.enable({apis:['setTimeout']});
  const before=glyphRequest('expired','Previous'), current=glyphRequest('live','Current');
  update([before]);
  t.mock.timers.tick(7000);
  update([current]);
  t.mock.timers.tick(1000);
  assert.deepEqual(events.failed,[]);
  t.mock.timers.tick(6980);
  assert.deepEqual(events.failed,[]);
  t.mock.timers.tick(20);
  assert.deepEqual(events.failed,[{token:'live'}]);
  component.onLayout(current,glyphBounds());
  assert.deepEqual(events.bounds,[]);
  assert.deepEqual(events.failed,[{token:'live'}]);
});

test('panel viewport links reject different initial windows even when their original axes agree',()=>{
  const sharedAxes={x:{type:'linear',domain:[0,10]},y:{type:'linear'}};
  const data={type:'line',axes:sharedAxes,series:[{...source,data:[{id:'first',x:1,y:2},{id:'second',x:8,y:5}]}]};
  const request={panels:[{id:'one',data},{id:'two',data}],viewportLinks:[{id:'shared',axis:'x',panelIds:['one','two']}]};
  const override=range=>({viewport:{axes:'x',initial:{x:range}}});
  const same={panels:{one:override([1,8]),two:override([1,8])}};
  const accepted=ownChartPanels(request,same);
  assert.equal(accepted.status,'ok',JSON.stringify(accepted.error));
  assert.equal(accepted.value.viewports.get('one').initialKey,accepted.value.viewports.get('two').initialKey);
  const different={panels:{...same.panels,two:override([2,8])}};
  const result=ownChartPanels(request,different);
  assert.equal(result.status,'invalid');
  assert.equal(result.error.diagnostic.reason,'INCOMPATIBLE_PANEL_VIEWPORT');
  assert.equal(result.error.diagnostic.path,'data.viewportLinks[0].panelIds[1]');
  assert.equal(samePanelVisibility({one:['s'],two:[]},{one:['different'],two:[]}),false);
});

test('forced wind-rose labels preserve source values when automatic dense labels are suppressed',()=>{
  const values=Array.from({length:8},(_,i)=>({id:'direction-'+i}));
  const wind=scene({family:'windrose',axes:{x:{type:'category',values},y:{type:'linear'}},
    series:Array.from({length:9},(_,i)=>({id:'sensor-'+i,name:'Sensor '+i,
      data:values.map(({id})=>({id,x:id,y:i+1}))}))});
  assert.equal(wind.observations.length,72);
  assert.deepEqual(valuesOf(wind),[]);
  const forced=valuesOf(wind,{layout:'all'});
  assert.deepEqual(forced.map(label=>label.text),wind.observations.map(point=>String(point.value)));
  assert(forced.every(label=>/^#(?:0{6}|f{6})$/i.test(label.ink)));
  const radial=scene({family:'radialbar',data:[{id:'reading',label:'Reading',value:10},{id:'zero',label:'Zero',value:0}]});
  assert.deepEqual(radial.observations.map(point=>point.value),[10,0]);
  assert.deepEqual(valuesOf(radial,{layout:'all'}).map(label=>label.text),['10']);
});

test('data labels retain raw observations and skip derived fit and fan-band roles',()=>{
  const numeric={x:{type:'linear',domain:[0,10]},y:{type:'linear',domain:[0,10]}};
  const fan=scene({family:'fan',bands:[{id:'range',label:'Range',coverage:.8}],axes:numeric,data:[
    {id:'first',x:1,value:2,intervals:[{bandId:'range',low:1,high:3}]},
    {id:'second',x:8,value:7,intervals:[{bandId:'range',low:5,high:9}]},
  ]});
  const regression=scene({family:'regression',axes:numeric,series:[{...source,data:[
    {id:'first',x:1,y:2},{id:'second',x:8,y:7},
  ]}]});
  for(const planned of [fan,regression]){
    assert.equal(planned.observations.length,4);
    const cases=valuesOf(planned,{layout:'all',
      pointFormatter:({point,value})=>point.id.pointId+': '+value,
    });
    assert.deepEqual(cases.map(label=>label.text),['first: 2','second: 7']);
  }
  const contour=scene({family:'contour',axes:numeric,contour:{levels:[{id:'guide',value:1}]},
    grid:{id:'field',x:[0,2],y:[0,5],ids:['a','b','c','d'],values:[0,2,0,2]}});
  const labels=valuesOf(contour,{layout:'all'},n=>'Level '+n);
  assert.deepEqual(labels.map(label=>[label.id,label.text]),[['contour-guide','Level 1']]);
  assert.deepEqual(valuesOf(contour,{points:false}),[]);
});

test('source stack label values remain raw except for the declared percentage total',()=>{
  const data={family:'column',axes:{x:{...category,values:[category.values[0]]},y:{type:'linear'}},series:[
    {...source,data:[{id:'first',x:'a',y:4}]},
    {id:'peer',name:'Peer',data:[{id:'second',x:'a',y:6}]},
  ]};
  const percent=scene(data,{stacking:'percent'});
  assert.deepEqual(valuesOf(percent,{layout:'all',points:false,stacks:true}).map(label=>label.text),['100%']);
  assert.deepEqual(valuesOf(percent,{layout:'all',points:true,stacks:true}).map(label=>label.text),['100%','4','6']);
  const signed={...data,series:replaceFirst(data.series,{data:[{id:'first',x:'a',y:-4}]})};
  const labels=valuesOf(scene(signed,{stacking:'sum'}),{layout:'all',points:false,stacks:true});
  assert.deepEqual(labels.map(label=>label.text),['6','-4']);
  assert(labels[0].y<labels[1].y);
});

test('matrix labels keep the exact measured cell and select readable ink on the composite surface',()=>{
  const matrix=scene({...heat,opacity:.5,colorAxis:{type:'classes',classes:[
    {id:'measured',label:'Measured',color:'#000000'},
  ],missingColor:'#444444',unclassifiedColor:'#777777'}});
  const light=valuesOf(matrix,{layout:'all',surfaceColor:'#FFFFFF'},n=>'Measured '+n);
  const dark=valuesOf(matrix,{layout:'all',surfaceColor:'#000000'},n=>'Measured '+n);
  assert.deepEqual(light.map(label=>[label.text,label.ink]),[['Measured 0','#000000']]);
  assert.deepEqual(dark.map(label=>[label.text,label.ink]),[['Measured 0','#FFFFFF']]);
  assert.equal(light[0].id,JSON.stringify(matrix.observations[0].id));
  assert.deepEqual(valuesOf(scene({...heat,opacity:0}),{layout:'all'}),[]);
  assert.deepEqual(valuesOf(matrix,{points:false}),[]);
});

test('logarithmic ticks retain their positions and enough precision to remain distinct', () => {
  const nearby = [
    {label:'1.234565300', x:15, id:'first'},
    {label:'1.234565400', x:85, id:'second'},
  ];
  assert.deepEqual(nativeLogAxisLabels(nearby,true), [
    {...nearby[0],label:'1.2345653'},
    {...nearby[1],label:'1.2345654'},
  ]);
  const indistinguishableAtShortPrecision = [
    {label:'1.234567890123451',x:15},
    {label:'1.234567890123452',x:85},
  ];
  assert.equal(nativeLogAxisLabels(indistinguishableAtShortPrecision,true),indistinguishableAtShortPrecision);
  const outsideLogDomain = [{label:'0',x:15},{label:'1000',x:85}];
  assert.equal(nativeLogAxisLabels(outsideLogDomain,true),outsideLogDomain);
  const empty = [];
  assert.equal(nativeLogAxisLabels(empty,true),empty);
  assert.equal(nativeLogAxisLabels(nearby,false),nearby);
});

test('UTC ticks preserve fractional seconds and distinguish calendar periods at longer spans', () => {
  const cases = [
    [['2024-03-01T09:00:00.001Z','2024-03-01T09:00:00.002Z'],['09:00:00.001','09:00:00.002']],
    [['2024-01-01T00:00:00Z','2025-01-01T00:00:00Z'],['2024','2025']],
    [['2024-02-01T00:00:00Z','2025-03-01T00:00:00Z'],['2024-02','2025-03']],
    [['2024-01-04T00:00:00Z','2024-02-05T00:00:00Z'],['2024-01-04','2024-02-05']],
  ];
  for (const [values,text] of cases) {
    const ticks = values.map((label,index)=>({label,x:index*160}));
    assert.deepEqual(nativeTimeAxisLabels(ticks,undefined,true),ticks.map((tick,index)=>({...tick,label:text[index]})));
    assert.deepEqual(ticks.map(tick=>tick.label),values);
  }
  const ticks = [0,50,252,300,480].map((x,index)=>({x,label:'2025-11-01T00:0'+index+':00Z'}));
  assert.deepEqual(nativeTimeAxisLabels(ticks,undefined,true), [
    {x:0,label:'00:00:00'},
    {x:300,label:'00:03:00'},
    {x:480,label:'00:04:00'},
  ]);
  const impossible = [{x:0,label:'2025-13-01T00:00:00Z'}];
  assert.equal(nativeTimeAxisLabels(impossible,undefined,true),impossible);
});

test('dendrogram tick text follows the distance axis with scale and density constraints', () => {
  const root = {id:'root',height:10,children:[
    {id:'inner',height:4,children:[{id:'first',label:'First'},{id:'second',label:'Second'}]},
    {id:'last',label:'Last'},
  ]};
  const area = {width:500,height:300};
  const vertical = scene({family:'dendrogram',root,orientation:'vertical',unit:'km'},area);
  const horizontal = scene({family:'dendrogram',root,orientation:'horizontal',unit:'km'},area);
  const expected = ['10','7.5','5','2.5','0'];
  const verticalTicks = dendrogramLabels(vertical,area);
  const horizontalTicks = dendrogramLabels(horizontal,area);
  assert.deepEqual(verticalTicks.map(tick=>tick.text),expected);
  assert.deepEqual(horizontalTicks.map(tick=>tick.text),expected);
  assert(verticalTicks.every(tick=>tick.left===0&&tick.top>=0&&tick.top+tick.height<=area.height));
  assert(horizontalTicks.every(tick=>tick.top+tick.height===area.height&&tick.left+tick.width<=area.width));
  assert.deepEqual(horizontal.annotations.map(label=>label.text),['First','Second','Last']);
  const narrow = dendrogramLabels(vertical,{width:180,height:64});
  assert(narrow.length>0&&narrow.length<verticalTicks.length);
  assert(narrow.every(tick=>verticalTicks.some(original=>original.text===tick.text)));
  assert.deepEqual(dendrogramLabels(vertical,{width:179,height:64}),[]);
  assert.deepEqual(dendrogramLabels(horizontal,area,1.51),[]);
  assert.deepEqual(dendrogramLabels(scene(baseLine),area),[]);
});

test('flame labels follow measured bar bounds and retain all spans for navigation', () => {
  const flame = {family:'flame',axes:{x:{type:'linear',unit:'ms',nice:false}},data:[
    {id:'main',label:'Main',start:0,end:100},
    {id:'load',label:'Load',parentId:'main',start:0,end:80},
    {id:'tiny',label:'Tiny',parentId:'main',start:81,end:82},
  ]};
  const viewed = scene(flame,{width:500,height:300});
  assert.deepEqual(viewed.annotations.map(label=>label.text),['Main','Load']);
  assert.deepEqual(viewed.observations.map(p=>p.label),['Main','Load','Tiny']);
  for (const [index,label] of viewed.annotations.entries()) {
    const bar = viewed.series[0].bars[index];
    assert.equal(label.x,bar.x+bar.width/2);
    assert.equal(label.y,bar.y+bar.height/2);
    assert.equal(label.box.width,bar.width-8);
    assert.equal(label.box.height,bar.height);
  }
  const manySpans = Array.from({length:67},(_,index)=>({
    id:'task-'+index,label:'Task '+index,start:100*index,end:100*index+99,
  }));
  const dense = scene({...flame,data:manySpans},{width:8192,height:300});
  assert.deepEqual(dense.annotations.map(label=>label.text),manySpans.slice(0,64).map(span=>span.label));
  assert.deepEqual(dense.observations.map(observation=>observation.label),manySpans.map(span=>span.label));
});

test('text on the plot preserves readable series ink and adjusts light ink on light fills', () => {
  assert.equal(textColorOnSurface('#fbffff','#000000'),'#fbffff');
  assert.equal(textColorOnSurface('#fbffff','#FFFFFF'),'#646666');
  assert.equal(textColorOnSurface('#fbffff','#777777'),'#000000');
  assert.equal(textColorOnSurface('#202020','#000000'),'#797979');
});

test('mixed range transport requires the original endpoints and line readings at shared categories', () => {
  const mixed = scene({family:'mixed',axes,series:[
    {id:'range',name:'Interval',type:'arearange',data:[{id:'range-a',x:'a',low:2,high:6}]},
    {id:'measured',name:'Measured',type:'line',data:[{id:'line-a',x:'a',y:4}]},
  ]});
  const [interval,reading] = mixed.observations;
  assert.equal(interval.x,reading.x);
  assert(Math.abs(interval.y-reading.y)<1e-9);
  assert.deepEqual([interval.lowValue,interval.highValue,interval.value,reading.value],[2,6,4,4]);
  assert.deepEqual(mixed.mixedRanges.series,[{id:'range',type:'arearange'},{id:'measured',type:'line'}]);
  const roles = mixed.mixedRanges.series;
  rejected(mixed,{mixedRanges:{...mixed.mixedRanges,series:[roles[0],roles[0]]}},'Invalid original interval series');
  rejected(mixed,{mixedRanges:{...mixed.mixedRanges,series:[roles[0],{...roles[1],type:'areasplinerange'}]}},'Ambiguous interval composition');
  rejected(mixed,firstObservation(mixed,{value:5}),'Original interval endpoints were lost');
  rejected(mixed,firstObservation(mixed,{lowValue:7}),'Original interval endpoints were lost');
  rejected(mixed,{observations:[interval,{...reading,lowValue:4},...mixed.observations.slice(2)]},'Original interval endpoints were lost');
});

test('mixed dual-axis transport retains each reading on its own displayed scale', () => {
  const mixed = scene({family:'mixed',axes:{...axes,secondaryY:{type:'linear',domain:[0,100],reversed:true}},series:[
    {id:'measured',name:'Measured',type:'line',data:[{id:'line-a',x:'a',y:4}]},
    {id:'other',name:'Other',type:'column',yAxis:'secondary',data:[{id:'other-a',x:'a',y:60}]},
  ]});
  const layout = mixed.mixedAxes;
  assert.deepEqual(layout.primary,{domain:[0,10],displayed:[0,10],reversed:false});
  assert.deepEqual(layout.secondary,{domain:[0,100],displayed:[0,100],reversed:true});
  assert.deepEqual(mixed.observations.map(point=>[point.value,point.valueAxis]),[[4,'primary'],[60,'secondary']]);
  for (const secondary of [
    {...layout.secondary,domain:null}, {...layout.secondary,displayed:null},
    {...layout.secondary,displayed:[-1,100]}, {...layout.secondary,displayed:[0,101]},
  ]) {
    rejected(mixed,{mixedAxes:{...layout,secondary}},'Invalid mixed value scale');
  }
  rejected(mixed,{mixedAxes:{...layout,series:[layout.series[0],layout.series[0]]}},'Invalid mixed series scale');
  rejected(mixed,{mixedAxes:{...layout,series:layout.series.map(row=>({...row,yAxis:'primary'}))}},'Mixed source values lost their scale identity');
  rejected(mixed,firstObservation(mixed,{valueAxis:'secondary'}),'Mixed source values lost their scale identity');
});

test('grouped stack transport partitions every source series and owns the groups independently', () => {
  const stackGroups = [
    {id:'east',label:'East',seriesIds:['east-base','east-extra']},
    {id:'west',label:'West',seriesIds:['west-base']},
  ];
  const bars = scene({family:'column',axes,series:[
    {id:'east-base',name:'East base',data:[{id:'base',x:'a',y:2}]},
    {id:'east-extra',name:'East extra',data:[{id:'extra',x:'a',y:3}]},
    {id:'west-base',name:'West base',data:[{id:'west',x:'a',y:4}]},
  ]},{stacking:'sum',stackGroups});
  const grouped = bars.stackGroups;
  assert.deepEqual(grouped,{placement:'grouped',stacking:'sum',groups:stackGroups});
  const [base,extra,west] = bars.series.map(series=>series.bars[0]);
  assert.equal(base.x,extra.x);
  assert(base.x+base.width<=west.x);
  assert(stackGroups[0].seriesIds!==grouped.groups[0].seriesIds);
  rejected(bars,{stackGroups:{...grouped,groups:[]} },'Invalid grouped stack layout');
  rejected(bars,{stackGroups:{...grouped,groups:[grouped.groups[0],grouped.groups[0]]}},'Invalid stack group');
  rejected(bars,{stackGroups:{...grouped,groups:[grouped.groups[0],{...grouped.groups[1],seriesIds:['east-base']}]}},'Invalid stack partition');
  rejected(bars,{stackGroups:{...grouped,groups:[grouped.groups[0]]}},'Incomplete stack ownership');
});

test('relationship hit indices distinguish painted links, circle touch targets and ring sectors', () => {
  const nodes = [{id:'a',label:'Alpha'},{id:'b',label:'Beta'},{id:'c',label:'Gamma'}];
  const links = [{id:'ab',from:'a',to:'b',value:12},{id:'bc',from:'b',to:'c',value:8},{id:'ca',from:'c',to:'a',value:4}];
  const arc = scene({family:'arcdiagram',nodes,links},{width:420,height:300});
  const chord = scene({family:'chord',nodes,links},{width:420,height:300});
  for (const layout of [arc,chord]) {
    const index = new RelationshipHitIndex(layout);
    assert(index.pick(-1,0)===null);
    assert(index.pick(0,-1)===null);
    assert(index.pick(layout.width+1,0)===null);
    assert(index.pick(0,layout.height+1)===null);
    for (const point of layout.observations) {
      assert.equal(index.pick(point.x,point.y,256)?.id.pointId,point.id.pointId);
    }
  }
  const node = arc.observations.find(point=>point.id.pointId==='a');
  const link = arc.observations.find(point=>point.id.pointId==='ab');
  const arcIndex = new RelationshipHitIndex(arc);
  const near = [node.x-10,node.y];
  assert.equal(arcIndex.pick(...near),null);
  assert.equal(arcIndex.pick(...near,NaN),null);
  assert.equal(arcIndex.pick(...near,-15),null);
  assert.equal(arcIndex.pick(...near,14)?.id.pointId,'a');
  assert.equal(arcIndex.pick(link.x,link.y,256)?.id.pointId,'ab');
  const isolated = scene({family:'arcdiagram',nodes,links:[]});
  assert.deepEqual(isolated.observations.map(point=>point.value),[0,0,0]);
  assert.equal(new RelationshipHitIndex(isolated).pick(0,0),null);
  const sector = chord.observations.find(point=>point.relationship.type==='node').hit;
  assert.notEqual(new RelationshipHitIndex(chord).pick(sector.cx,sector.cy)?.relationship.type,'node');
});

test('contour transport validates segments against the exact original cell and threshold', () => {
  const numeric = {x:{type:'linear',domain:[0,4]},y:{type:'linear',domain:[0,5]}};
  const spec = {family:'contour',axes:numeric,contour:{levels:[{id:'low',value:1},{id:'high',value:3}]},
    grid:{id:'field',x:[0,2,4],y:[0,5],ids:['a','b','c','d','e','f'],values:[null,0,4,0,0,4]}};
  const contour = scene(spec);
  const data = contour.contour;
  assert.equal(data.missingCells,1);
  assert.equal(data.knownSamples,5);
  assert.deepEqual(contour.observations.map(point=>point.contour.sourceIds),[['b','c','f','e'],['b','c','f','e']]);
  const anchor = contour.observations[0];
  assert.deepEqual(anchor.contour.sourceValues,[0,4,4,0]);
  const point = patch => firstObservation(contour,{contour:{...anchor.contour,...patch}});
  rejected(contour,{contour:{...data,missingCells:0}},'Contour source count differs');
  rejected(contour,{contour:{...data,samples:replaceFirst(data.samples,{value:Infinity})}},'Invalid contour sample');
  rejected(contour,{contour:{...data,samples:replaceFirst(data.samples,{y:6})}},'Invalid contour grid coordinates');
  rejected(contour,{contour:{...data,levels:replaceFirst(data.levels,{value:5})}},'Invalid contour threshold');
  rejected(contour,point({gridId:'wrong-field'}),'Contour cell differs from source');
  rejected(contour,point({sourceIds:['a','c','f','e']}),'Contour corners differ from source');
  rejected(contour,point({sourceStart:{x:0,y:0}}),'Contour source segment outside its cell');
  rejected(contour,point({start:{x:-1,y:0}}),'Contour segment outside plot');
  rejected(contour,firstObservation(contour,{x:anchor.x+1}),'Contour anchor differs from its segment');
});

test('an uncertainty band retains its level, ordered endpoints and owning observation group', () => {
  const numeric = {x:{type:'linear',domain:[0,10]},y:{type:'linear',domain:[0,10]}};
  const fan = scene({family:'fan',bands:[
    {id:'inner',label:'Inner',coverage:.5},{id:'outer',label:'Outer',coverage:.9},
  ],axes:numeric,data:[
    {id:'first',x:1,value:2,intervals:[{bandId:'inner',low:1.5,high:2.5},{bandId:'outer',low:1,high:3}]},
    {id:'second',x:8,value:7,intervals:[{bandId:'inner',low:6,high:8},{bandId:'outer',low:5,high:9}]},
  ]});
  assert.deepEqual(fan.fan.bands.map(band=>[band.id,band.coverage]),[['inner',.5],['outer',.9]]);
  const point = fan.observations.find(item=>item.id.seriesId==='inner');
  assert.deepEqual(point.fan,{type:'interval',coverage:.5,low:1.5,high:2.5});
  const change = patch => ({observations:fan.observations.map(item=>item===point?{...item,...patch}:item)});
  rejected(fan,{fan:{...fan.fan,bands:[]}},'Invalid uncertainty layout');
  rejected(fan,{fan:{...fan.fan,bands:[...fan.fan.bands].reverse()}},'Invalid uncertainty band');
  rejected(fan,change({fan:{...point.fan,coverage:1}}),'Invalid uncertainty interval');
  rejected(fan,change({fan:{...point.fan,low:3}}),'Invalid uncertainty interval');
  rejected(fan,change({fan:{...point.fan,coverage:.6}}),'Uncertainty source ownership mismatch');
  rejected(fan,change({lowValue:1}),'Uncertainty source ownership mismatch');
  rejected(fan,change({group:undefined}),'Uncertainty source ownership mismatch');
});

test('regression transport distinguishes fitted paths, original samples and unavailable models', () => {
  const numeric = {x:{type:'linear'},y:{type:'linear'}};
  const regression = scene({family:'regression',axes:numeric,series:[
    {id:'ready',name:'Ready',data:[{id:'first',x:1,y:3},{id:'second',x:3,y:7}]},
    {id:'equal-x',name:'Equal x',data:[{id:'a',x:2,y:5},{id:'b',x:2,y:6}]},
    {id:'one',name:'One sample',data:[{id:'c',x:5,y:8},{id:'d',x:6,y:null}]},
  ]});
  const metadata = regression.regression;
  const [ready,constant,insufficient] = metadata.models;
  assert.deepEqual(metadata.models.map(model=>[model.status,model.sampleCount,model.missingCount]),[
    ['ready',2,0],['constant-x',2,0],['insufficient-data',1,1],
  ]);
  assert.deepEqual([ready.slope,ready.intercept,ready.rSquared],[2,1,1]);
  const changedModels = models => ({regression:{...metadata,models}});
  rejected(regression,changedModels([{...ready,rSquared:1.1},constant,insufficient]),'Invalid regression coefficients');
  rejected(regression,changedModels([{...ready,fitSeriesId:'another-fit'},constant,insufficient]),'Invalid regression source');
  rejected(regression,changedModels([ready,{...constant,sampleCount:1},insufficient]),'Invalid unavailable regression');
  rejected(regression,changedModels([ready,constant,{...insufficient,sampleCount:2}]),'Invalid unavailable regression');
  const fit = regression.observations.find(point=>point.regression.type==='fit');
  assert(fit);
  const update = patch => ({observations:regression.observations.map(point=>point===fit?{...point,...patch}:point)});
  rejected(regression,update({hit:undefined}),'Regression observation ownership mismatch');
  rejected(regression,update({regression:{...fit.regression,modelId:'equal-x'}}),'Regression observation ownership mismatch');
});

test('flame scene retains source ancestry and rejects mismatches between depth and the timed row', () => {
  const flame = scene({family:'flame',axes:{x:{type:'linear',unit:'ms'}},data:[
    {id:'root',label:'Root',start:1,end:11},
    {id:'child',parentId:'root',label:'Child',start:2,end:5},
    {id:'other',parentId:'root',label:'Other',start:6,end:7},
  ]});
  const [root,child] = flame.observations;
  assert.deepEqual(flame.flame,{maxDepth:1,nodeCount:3,rootCount:1});
  assert.deepEqual(root.flame,{depth:0,childCount:2,selfDuration:6});
  assert.deepEqual(child.flame,{parentId:'root',depth:1,childCount:0,selfDuration:3});
  assert.equal(child.interval.rowId,'depth-1');
  const change = patch => ({observations:flame.observations.map(point=>point===child?{...point,...patch}:point)});
  rejected(flame,{flame:{...flame.flame,rootCount:0}},'Invalid flame layout');
  rejected(flame,{flame:{...flame.flame,nodeCount:2}},'Invalid flame layout');
  rejected(flame,change({flame:{...child.flame,parentId:'unknown'}}),'Invalid flame source role');
  rejected(flame,change({flame:{...child.flame,selfDuration:4}}),'Invalid flame source role');
  rejected(flame,change({flame:{...child.flame,parentId:undefined}}),'Invalid flame observation');
  rejected(flame,change({flame:{...child.flame,depth:0}}),'Invalid flame observation');
});

test('violin transport keeps exact summaries, density points and invisible source groups separate', () => {
  const samples = values => values.map((value,index)=>({id:'sample-'+index,value}));
  const violin = scene({family:'violin',axes:{y:{type:'linear',unit:'ms'}},groups:[
    {id:'many',label:'Many',samples:samples([0,2,4,6,null])},
    {id:'single',label:'Single',samples:samples([5])},
    {id:'missing',label:'Missing',samples:samples([null])},
  ]});
  const metadata = violin.violin;
  const [many,single,missing] = metadata.groups;
  assert.equal(metadata.kernel,'epanechnikov');
  assert.equal(many.summary.median,3);
  assert.equal(many.summary.missingCount,1);
  assert.equal(many.density.length,metadata.resolution+1);
  assert.equal(single.summary.bandwidth,null);
  assert.deepEqual(single.density,[]);
  assert.equal(missing.summary,undefined);
  assert.deepEqual(violin.observations.map(point=>[point.id.seriesId,point.value]),[['many',3],['single',5]]);
  const change = patch => ({violin:{...metadata,groups:[{...many,...patch},single,missing]}});
  rejected(violin,change({visible:false}),'Hidden or unknown violin group cannot invent a summary');
  rejected(violin,change({summary:{...many.summary,bandwidth:null}}),'Invalid violin summary');
  rejected(violin,change({summary:{...many.summary,mean:100}}),'Invalid violin summary');
  rejected(violin,change({summary:{...many.summary,sampleCount:3}}),'Invalid violin summary ownership');
  rejected(violin,change({density:[] }),'Invalid violin summary ownership');
  rejected(violin,change({density:replaceFirst(many.density,{density:-1})}),'Invalid violin density');
  rejected(violin,firstObservation(violin,{value:4}),'Invalid violin observation ownership');
});

test('markers paint their requested shape around the same projected center', () => {
  const color = '#123456';
  const circular = resolveMarkerStyle(undefined);
  assert.equal(markerSvg(10,20,8,color,circular),'<circle cx="10" cy="20" r="4" fill="#123456"/>');
  const square = resolveMarkerStyle({shape:'square',fillColor:'#abcdef',borderWidth:2,borderColor:'#000000'});
  assert.equal(markerSvg(10,20,8,color,square),'<rect x="6" y="16" width="8" height="8" fill="#abcdef" stroke="#000000" stroke-width="2" stroke-linejoin="round"/>');
  const diamond = resolveMarkerStyle({shape:'diamond',borderWidth:1});
  assert.equal(markerSvg(10,20,8,color,diamond),'<path d="M10 16L14 20L10 24L6 20Z" fill="#123456" stroke="#123456" stroke-width="1" stroke-linejoin="round"/>');
  const triangle = resolveMarkerStyle({shape:'triangle'});
  assert.equal(markerSvg(10,20,8,color,triangle),'<path d="M10 16L14 24L6 24Z" fill="#123456"/>');
  assert(sameMarkerStyle(circular,resolveMarkerStyle({shape:'circle'})));
  assert(!sameMarkerStyle(square,{...square,fillColor:color}));
  assert(!sameMarkerStyle(square,{...square,borderColor:color}));
  assert(!sameMarkerStyle(square,{...square,borderWidth:3}));
});

test('scatter batches preserve each transformed marker and group by effective paint', () => {
  const scatter = scene({family:'scatter',axes:{x:{type:'linear'},y:{type:'linear'}},series:[
    {id:'source',name:'Source',color:'#123456',data:[{id:'first',x:1,y:1},{id:'second',x:2,y:3}]},
    {id:'peer',name:'Peer',color:'#654321',data:[{id:'third',x:3,y:1}]},
  ]});
  const points = scatter.observations;
  const transform = {x:5,y:-4,sx:1.5,sy:2};
  const projected = points.map(point=>({x:5+point.x*1.5,y:-4+point.y*2}));
  const shapes = [
    ['circle',({x,y})=>'M'+(x-3)+' '+y+'A3 3 0 1 0 '+(x+3)+' '+y+'A3 3 0 1 0 '+(x-3)+' '+y+'Z'],
    ['square',({x,y})=>'M'+(x-3)+' '+(y-3)+'h6v6h-6Z'],
    ['diamond',({x,y})=>'M'+x+' '+(y-3)+'L'+(x+3)+' '+y+'L'+x+' '+(y+3)+'L'+(x-3)+' '+y+'Z'],
    ['triangle',({x,y})=>'M'+x+' '+(y-3)+'L'+(x+3)+' '+(y+3)+'L'+(x-3)+' '+(y+3)+'Z'],
  ];
  for (const [shape,subpath] of shapes) {
    const style = resolveMarkerStyle({shape,borderWidth:1});
    const svg = markerBatchSvg(points,transform,6,style);
    assert.equal((svg.match(/<path/g)??[]).length,2);
    assert(svg.includes('d="'+projected.slice(0,2).map(subpath).join('')+'" fill="#123456" stroke="#123456"'));
    assert(svg.includes('d="'+subpath(projected[2])+'" fill="#654321" stroke="#654321"'));
  }
  const common = resolveMarkerStyle({fillColor:'#abcdef',borderColor:'#002244'});
  const svg = markerBatchSvg(points,transform,6,common);
  assert.equal((svg.match(/<path/g)??[]).length,1);
  assert(svg.includes(projected.map(shapes[0][1]).join('')));
  assert(svg.includes('fill="#abcdef"'));
  assert(!svg.includes('stroke='));
  assert.equal(markerBatchSvg([],transform,6,common),'');
});

async function mountComputedInputs(t, loadComponent) {
  await import('@angular/compiler');
  const angular = await import('@angular/core');
  const Component = await loadComponent();
  const injector = angular.createEnvironmentInjector([],angular.Injector.NULL);
  t.after(()=>injector.destroy());
  // These tests drive Angular input signals directly. They do not mount a native view.
  const create = () => angular.runInInjectionContext(injector,()=>new Component());
  const write = (input,value) => {
    const node = input[angular.ɵSIGNAL];
    node.applyValueToInputSignal(node,value);
  };
  return {create,write};
}

test('word cloud computed glyphs keep the measured box and transform its pose on resize', async t => {
  const {create,write} = await mountComputedInputs(t,async()=>(await import('../dist/native/wordcloud-layer.js')).WordCloudLayer);
  const data = {type:'wordcloud',groups:[{id:'g',label:'Words'}],words:[
    {id:'first',text:'First glyph',groupId:'g',weight:4},
    {id:'zero',text:'Zero',groupId:'g',weight:0},
    {id:'unknown',text:'Unknown',groupId:'g',weight:null},
  ]};
  const prepared = prepareNativeWordCloud(data,{rotations:[90]},size,[],'test-render-font');
  assert.equal(prepared.status,'ok');
  const layer = create();
  write(layer.scene,measuringWordCloud(prepared));
  assert.deepEqual(layer.glyphs(),[]);
  const measurements = new WordCloudMeasurements(8,2);
  assert(measurements.begin(prepared.preparation.requests));
  for (const probe of measurements.snapshot.probes) {
    assert(measurements.accept(probe.token,{width:48,height:20}));
  }
  const ready = scene(prepared.spec,{wordcloudText:{
    fontKey:prepared.fontKey,measurements:measurements.snapshot.measurements,
  }});
  write(layer.scene,ready);
  const [visible] = layer.glyphs();
  const [glyph] = ready.series[0].textGlyphs;
  assert.equal(layer.glyphs().length,1);
  assert.deepEqual(visible,{
    id:'g-first',text:'First glyph',fontSize:glyph.fontSize,color:ready.series[0].color,
    width:48,height:20,left:glyph.center.x-24,top:glyph.center.y-10,
    transform:[{rotate:'90deg'},{scale:1}],
  });
  write(layer.viewport,{width:size.width/2,height:size.height});
  write(layer.surface,'#000000');
  const [resized] = layer.glyphs();
  assert.deepEqual(resized,{
    ...visible,color:textColorOnSurface(ready.series[0].color,'#000000'),
    left:glyph.center.x/2-24,top:size.height/4+glyph.center.y/2-10,
    transform:[{rotate:'90deg'},{scale:.5}],
  });
  assert.notEqual(resized.color,visible.color);
  write(layer.scene,measuringWordCloud(prepared));
  assert.deepEqual(layer.glyphs(),[]);
});

test('tilemap color axis computed presentation updates exact ranges, locale and paint', async t => {
  const {create,write} = await mountComputedInputs(t,async()=>(await import('../dist/native/tilemap-color-axis.js')).NativeTilemapColorAxis);
  const data = {...tile,series:[{...source,data:[
    {id:'first',x:0,y:0,value:2.5},
    {id:'second',x:1,y:0,value:20.75},
    {id:'unknown',x:1,y:1,value:null},
  ]}]};
  const continuous = scene(data).tilemap.colorAxis;
  const component = create();
  write(component.axis,continuous);
  assert.equal(component.domainLabel(),'2.5 — 20.75');
  assert.equal(component.unclassified(),continuous.missingColor);
  assert.deepEqual(component.classes(),[]);
  write(component.unit,'ms');
  write(component.locale,'es');
  assert.equal(component.domainLabel(),'2,5 — 20,75 ms');
  const svg = component.ramp();
  const id = svg.match(/linearGradient id="([^"]+)"/)[1];
  assert(svg.includes('fill="url(#'+id+')"'));
  for (const stop of continuous.stops) {
    assert(svg.includes('offset="'+(stop.at*100)+'%" stop-color="'+stop.color+'"'));
  }
  const other = create();
  write(other.axis,continuous);
  assert.notEqual(other.ramp().match(/linearGradient id="([^"]+)"/)[1],id);

  const classified = scene({...data,colorAxis:{type:'classes',classes:[
    {id:'less',label:'Less',maxExclusive:2.5,color:'#000000'},
    {id:'between',label:'Between',minInclusive:2.5,maxExclusive:20.75,color:'#FFAA00'},
    {id:'more',label:'More',minInclusive:20.75,color:'#FFFFFF'},
  ],missingColor:'#222222',unclassifiedColor:'#333333'}}).tilemap.colorAxis;
  write(component.axis,classified);
  assert.deepEqual(component.classes(),classified.classes);
  assert.equal(component.unclassified(),'#333333');
  assert.deepEqual(component.classes().map(row=>component.classRange(row)),['< 2,5','[2,5, 20,75)','≥ 20,75']);
  assert.equal(component.classRange({}),'Todos los valores finitos');
  assert.equal(component.ramp(),'<svg viewBox="0 0 200 12"/>');
  const missing = scene({...data,series:[{...source,data:[{id:'all-missing',x:0,y:0,value:null}]}]}).tilemap.colorAxis;
  assert.equal(missing.domain,null);
  write(component.axis,missing);
  assert.equal(component.domainLabel(),'No hay valores conocidos');
  write(component.locale,'en');
  assert.equal(component.domainLabel(),'No known values');
  assert.equal(component.classRange({}),'All finite values');
});
