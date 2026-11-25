import assert from 'node:assert/strict';
import test from 'node:test';
import {planNativeChart, transformPlanViewport} from '../dist/native/plan.js';
import {updateScenePresentation} from '../dist/library/scene.js';
import {measuringWordCloud,prepareNativeWordCloud} from '../dist/native/wordcloud-planning.js';
import {createNativeSceneChartHarness} from './native-scene-chart-harness.mjs';

const frame={width:480,height:340};
const category={type:'category',values:['a','b','c','d'].map(id=>({id,label:'Category '+id.toUpperCase()}))};
const axes={x:category,y:{type:'linear',domain:[0,10]}};
const numbers=[3,6,4,7];
const data=numbers.map((y,index)=>({id:'point-'+index,x:category.values[index].id,y}));
const base={id:'observed',name:'Observations',data};
const trace={family:'line',title:'Values by category',axes,series:[base]};

function plan(spec,options={}) {
  const result=planNativeChart(spec,{...frame,...options});
  assert.notEqual(result.status,'invalid',JSON.stringify(result.diagnostic));
  return result;
}

function harness(t,spec,{options={},inputs={}}={}) {
  const h=createNativeSceneChartHarness(plan(spec,options).scene,inputs);
  t.after(h.destroy);
  return h;
}

function tap(h,point) {
  const gesture=h.chart.gesture();
  const pointGesture=gesture.type==='simultaneous'?gesture.members[0]:gesture;
  const target=pointGesture.members.find(item=>item.type==='tap');
  assert(target.enabledValue);
  target.handlers.onEnd({x:h.chart.mapX(point.x),y:h.chart.mapY(point.y)},true);
  h.flush();
}

function installFrameClock(t) {
  const callbacks=new Map();
  let next=0;
  const request=(callback)=>{const handle=++next;callbacks.set(handle,callback);return handle;};
  const cancel=handle=>callbacks.delete(handle);
  for (const [key,value] of Object.entries({requestAnimationFrame:request,cancelAnimationFrame:cancel})) {
    const previous=Object.getOwnPropertyDescriptor(globalThis,key);
    Object.defineProperty(globalThis,key,{value,configurable:true,writable:true});
    t.after(()=>{if(previous)Object.defineProperty(globalThis,key,previous);else delete globalThis[key];});
  }
  return ()=>{
    for(const [handle,callback] of [...callbacks]) {
      if(callbacks.delete(handle))callback(16);
    }
  };
}

test('the native tooltip follows navigation, pinning, clearing and accessibility size', t=>{
  const h=harness(t,trace,{inputs:{locale:'en',tooltipPinnable:true}});
  h.measure(frame.width,frame.height);
  const {chart}=h;
  assert.deepEqual(chart.accessibilityValue(),{text:'No selection'});
  assert.equal(chart.dockedTooltipContext(),undefined);
  h.act('adjust',{nativeEvent:{actionName:'increment'}});
  const active=h.events.interaction.at(-1).active;
  assert.equal(active.id.pointId,'point-0');
  assert.equal(chart.dockedTooltipContext().$implicit,active);
  assert.equal(chart.dockedTooltipContext().locale,'en');
  assert.equal(chart.dockTooltip(),false);
  assert.equal(h.calls.tooltip.at(-1)[0],'move');
  assert.equal(h.calls.tooltip.at(-1)[3],0);
  assert.match(chart.accessibilityValue().text,/Category A, Observations, 3/);
  h.act('toggleDetails');
  assert(chart.expandedTooltip());
  assert(chart.dockTooltip());
  h.act('toggleDetails');
  h.act('togglePin');
  assert(chart.pinnedOverlay());
  assert.equal(chart.dockTooltip(),false);
  assert.deepEqual(chart.actions(),[]);
  assert.equal(chart.pinnedWidth(),frame.width-16);
  assert.equal(chart.pinnedBodyHeight(),220);
  assert.match(chart.accessibilityHint(),/Tooltip pinned/);
  h.act('toggleDetails');
  assert.equal(chart.expandedTooltip(),false);

  h.scale.set(1.75);
  h.flush();
  assert.equal(chart.pinnedOverlay(),false);
  assert(chart.dockTooltip());
  h.set({locale:'es'});
  assert.match(chart.accessibilityHint(),/Tooltip fijado/);
  h.set({tooltipMode:'off'});
  assert.equal(chart.pinned(),false);
  assert.equal(chart.dockTooltip(),false);
  assert.equal(h.calls.tooltip.at(-1)[0],'hide');
  assert.deepEqual(chart.actions().map(action=>action.label),['Siguiente','Anterior']);
  h.act('adjust',{nativeEvent:{actionName:'unknown'}});
  assert.equal(chart.state().active.id.pointId,'point-0');
  h.act('adjust',{nativeEvent:{actionName:'increment'}});
  assert.equal(chart.state().active.id.pointId,'point-1');
  h.act('adjust',{nativeEvent:{actionName:'decrement'}});
  assert.equal(chart.state().active.id.pointId,'point-0');
  h.act('clear');
  assert.equal(chart.dockedTooltipContext(),undefined);
  assert.deepEqual(chart.accessibilityValue(),{text:'Sin selección'});
});

test('mixed range shared tooltips preserve raw intervals and exclude their synthetic active markers', t=>{
  const mixed={family:'mixed',title:'Observed and interval',axes,series:[
    {id:'interval',name:'Expected',type:'arearange',data:[
      {id:'range-a',x:'a',low:2,high:6},
      {id:'range-b',x:'b',low:3,high:9},
    ]},
    {...base,type:'line'},
  ]};
  const h=harness(t,mixed,{inputs:{locale:'en',tooltipContent:'shared',tooltipMode:'docked'}});
  h.measure(frame.width,frame.height);
  h.act('step','first');
  const {chart}=h;
  const tooltip=chart.dockedTooltipContext();
  assert.equal(tooltip.shared.label,'Category A');
  assert.deepEqual(tooltip.shared.rows.map(row=>[row.seriesId,row.point.value]),[['interval',4],['observed',3]]);
  assert.deepEqual([tooltip.shared.rows[0].point.lowValue,tooltip.shared.rows[0].point.highValue],[2,6]);
  assert.deepEqual(chart.activeMarkerPoints().map(point=>point.id.seriesId),['observed']);
  assert.deepEqual([...chart.activeMarkerSymbols().keys()],['observed']);
  assert.deepEqual(chart.tooltipDetails(),[]);
  assert(chart.dockTooltip());
  h.act('step','last');
  const missing=chart.dockedTooltipContext().shared.rows;
  assert.equal(missing[0].point,null);
  assert.equal(missing[1].point.value,7);
  assert.match(chart.accessibilityValue().text,/Expected: No value/);
  h.set({locale:'es',tooltipContent:'point'});
  assert.equal(chart.dockedTooltipContext().shared,undefined);
  assert.equal(chart.dockedTooltipContext().$implicit.id.pointId,'point-3');
  assert.match(chart.accessibilityValue().text,/Category D, Observations, 7/);
});

test('the controlled legend keeps source IDs and adapts its placement and callbacks to available width', t=>{
  const series=[base,{id:'projected',name:'Projected',data:data.map(item=>({...item,y:item.y+1}))}];
  const line={...trace,series};
  const h=harness(t,line,{inputs:{locale:'en',legendPosition:'left'}});
  const {chart}=h;
  assert.equal(chart.effectiveLegendPosition(),'top');
  h.act('measureBody',{nativeEvent:{layout:{width:639}}});
  assert.equal(chart.effectiveLegendPosition(),'top');
  h.act('measureBody',{nativeEvent:{layout:{width:640}}});
  assert.equal(chart.effectiveLegendPosition(),'left');
  h.set({legendPosition:'right'});
  assert.equal(chart.effectiveLegendPosition(),'right');
  h.act('measureBody',{nativeEvent:{layout:{width:320}}});
  assert.equal(chart.effectiveLegendPosition(),'bottom');
  h.act('measureBody',{nativeEvent:{layout:{width:NaN}}});
  assert.equal(chart.effectiveLegendPosition(),'bottom');
  h.act('toggleLegend','observed');
  assert.deepEqual(h.events.legend,[]);
  h.set({legendInteractive:true,labelFormatters:{legendLabel:item=>item.id==='observed'?'Live '+item.text:undefined}});
  assert.deepEqual(chart.legendItems().map(item=>[item.id,item.name]),[['observed','Live Observations'],['projected','Projected']]);
  h.act('toggleLegend','foreign');
  assert.deepEqual(h.events.legend,[]);
  h.act('toggleLegend','observed');
  assert.deepEqual(h.events.legend,[['observed']]);
  assert(Object.isFrozen(h.events.legend[0]));
  assert(chart.legendItems()[0].visible);
  h.set({scene:plan(line,{hiddenSeriesIds:h.events.legend[0]}).scene});
  assert.equal(chart.legendItems()[0].visible,false);
  h.act('toggleLegend','observed');
  assert.deepEqual(h.events.legend.at(-1),[]);
});

test('measurement and scroll keep layout finite and move controls to the active observation', t=>{
  const h=harness(t,trace,{inputs:{locale:'en',plotHeight:900,minPlotWidth:1200}});
  const {chart}=h;
  assert.equal(chart.boundedHeight(),600);
  h.set({plotHeight:100});
  assert.equal(chart.boundedHeight(),180);
  h.set({plotHeight:NaN});
  assert.equal(chart.boundedHeight(),260);
  h.measure(0,200);
  h.measure(220,Infinity);
  assert.deepEqual(h.events.layout,[]);
  h.measure(1200,340);
  h.measure(1200,340);
  assert.deepEqual(h.events.layout,[{width:1200,height:340}]);
  const scroll=(x)=>h.act('scrollPlot',{nativeEvent:{contentOffset:{x}}});
  h.act('measureScroll',{nativeEvent:{layout:{width:320}}});
  assert(chart.scrolling());
  assert.equal(chart.contentWidth(),1200);
  scroll(-30);
  assert.equal(chart.tooltipPosition().x,0);
  scroll(3000);
  assert.equal(chart.tooltipPosition().x,880);
  scroll(Infinity);
  assert.equal(chart.tooltipPosition().x,880);
  h.act('step','first');
  assert.equal(chart.state().active.id.pointId,'point-0');
  h.set({tooltipMode:'off'});
  const firstOffset=chart.tooltipPosition().x;
  assert(firstOffset<880);
  h.act('step','last');
  assert.equal(chart.state().active.id.pointId,'point-3');
  assert(chart.tooltipPosition().x>firstOffset);
  h.set({minPlotWidth:NaN});
  assert.equal(chart.contentWidth(),320);
  assert.equal(chart.scrolling(),false);
  assert.equal(chart.tooltipPosition().x,0);
});

test('native plot selection remains on the tapped datum across formatting changes and suspends cleanly', t=>{
  const h=harness(t,trace,{inputs:{locale:'en',tooltipMode:'docked',legendInteractive:true,markerStyle:{shape:'diamond'}}});
  h.measure(frame.width,frame.height);
  const {chart}=h;
  const point=chart.ownedScene().observations[1];
  const gesture=chart.gesture();
  assert.equal(gesture.members[0].enabledValue,true);
  h.set({interactionMode:'tap'});
  assert.equal(chart.gesture().members[0].enabledValue,false);
  const before=h.events.interaction.length;
  gesture.members[1].handlers.onEnd({x:chart.mapX(point.x),y:chart.mapY(point.y)},true);
  assert.equal(h.events.interaction.length,before);
  h.screenReader.set(true);
  h.flush();
  tap(h,point);
  assert.equal(chart.state().active,null);
  h.screenReader.set(false);
  h.flush();
  tap(h,point);
  assert.equal(chart.state().selected.pointId,'point-1');
  assert(chart.activeMarkerSymbols().get('observed').includes('<path'));
  h.scheme.set('dark');
  h.flush();
  assert(chart.dark());
  assert.match(chart.activeMarkerSymbols().get('observed'),/fill="#17263A"/);
  h.set({theme:'light',titleStyle:{align:'right',fontSize:20,fontWeight:700,color:'#113344'}});
  assert.equal(chart.dark(),false);
  assert.deepEqual(chart.titleAppearance(),{textAlign:'right',color:'#113344',fontSize:20,fontWeight:'700',lineHeight:29});
  assert.equal(chart.state().selected.pointId,'point-1');
  h.setAppStatus('background');
  assert.deepEqual(h.events.interaction.at(-1),{active:null,selected:null,scrubbing:false});
  assert.equal(chart.drawing(),'');
  assert.equal(chart.gridDrawing(),'');
  assert.equal(chart.referenceDrawing(),'');
  h.act('toggleLegend','observed');
  h.act('step','last');
  assert.deepEqual(h.events.legend,[]);
  assert.equal(chart.state().active,null);
  h.setAppStatus('active');
  assert(chart.drawing().includes('<svg'));
  assert.equal(chart.state().active,null);
  h.act('step','last');
  assert.equal(chart.state().active.id.pointId,'point-3');
});

test('native viewport controls request real Core transforms and block changes while the tooltip is pinned', t=>{
  const existing=plan(trace,{viewport:{axes:'x',value:{x:{firstId:'b',lastId:'c'}}}});
  const context={model:existing.viewport,generation:{},revision:0,acknowledgment:0,pinch:true,pan:true,controls:true};
  const h=createNativeSceneChartHarness(existing.scene,{locale:'en',viewportContext:context,tooltipPinnable:true});
  t.after(h.destroy);
  h.measure(frame.width,frame.height);
  const {chart}=h;
  assert(chart.hasViewportWindow());
  assert.equal(chart.viewportAxes().horizontal,true);
  assert.equal(chart.viewportAxes().vertical,false);
  assert(chart.zoomInAvailable());
  assert.equal(chart.gesture().type,'simultaneous');
  h.act('step','first');
  assert.equal(chart.state().active.id.pointId,'point-1');
  h.act('togglePin');
  assert.equal(chart.zoomInAvailable(),false);
  h.act('requestView',{type:'reset'});
  h.act('panView','x',1);
  assert.deepEqual(h.events.viewport,[]);
  h.act('togglePin');
  h.act('panView','y',1);
  const orthogonal=h.events.viewport.at(-1);
  assert.deepEqual(transformPlanViewport(existing.viewport,orthogonal.intent),{status:'ok',value:existing.viewport.value});
  h.act('panView','x',1);
  const first=h.events.viewport.at(-1);
  assert.equal(first.source,'controls');
  assert.equal(first.model,context.model);
  assert.deepEqual(transformPlanViewport(existing.viewport,first.intent),{
    status:'ok',value:{x:{firstId:'c',lastId:'d'}},
  });
  assert.equal(chart.state().active,null);
  h.act('requestView',{type:'reset'});
  assert.deepEqual(h.events.viewport.at(-1).intent,{type:'reset'});
  h.set({viewportContext:undefined});
  assert.deepEqual(chart.viewportAxes(),{horizontal:false,vertical:false});
  assert.equal(chart.hasViewportWindow(),false);
  assert.equal(chart.zoomInAvailable(),false);
  assert.equal(chart.gesture().type,'race');
  assert(h.calls.viewport.some(([event])=>event==='destroy'));
});

test('axis formatters receive original axis IDs and long text adapts to the chosen layout', t=>{
  const categories=Array.from({length:18},(_,i)=>({id:'category-'+i,label:'Long category '+i}));
  const mixed={family:'mixed',title:'Two independent scales',axes:{
    x:{type:'category',values:categories},
    y:{type:'linear',domain:[0,10]},
    secondaryY:{type:'linear',domain:[0,2.5],reversed:true},
  },series:[
    {...base,type:'line',data:categories.map((category,index)=>({id:category.id,x:category.id,y:index%10}))},
    {id:'second',name:'Second scale',type:'line',yAxis:'secondary',data:[{id:'sec',x:categories[0].id,y:1.5}]},
  ]};
  const h=harness(t,mixed,{inputs:{locale:'es'}});
  h.measure(210,220);
  const {chart}=h;
  assert(chart.secondaryAxisVisible());
  assert.equal(chart.valueAxisWidth(),38);
  assert(chart.displayedXLabels().length<chart.scene().labels.length);
  h.set({showYAxis:false});
  assert.equal(chart.displayedYAxis(),false);
  assert.equal(chart.secondaryAxisVisible(),false);
  const formatterCalls=[];
  h.set({showSecondaryYAxis:true,axisLabelLayout:'all',secondaryYAxisTitleStyle:{fontSize:17,color:'#445566'},labelFormatters:{
    xAxisLabel:context=>{formatterCalls.push(context);return context.axis==='x'?'Month '+context.text:undefined;},
    yAxisLabel:({axis,text})=>axis==='secondaryY'?'Right '+text:'Primary quantities '+text,
  }});
  assert(chart.secondaryAxisVisible());
  assert.equal(chart.displayedXLabels().length,chart.scene().labels.length);
  assert(chart.displayedXLabels().every(tick=>tick.label.startsWith('Month Long category')));
  assert.deepEqual(formatterCalls,chart.scene().labels.map(tick=>({axis:'x',text:tick.label,type:tick.type,value:tick.value})));
  assert(chart.primaryYTicks().every(tick=>!tick.label||tick.label.startsWith('Primary quantities ')));
  assert(chart.secondaryYTicks().some(tick=>tick.label.includes('Right 0,5')));
  assert.equal(chart.valueAxisWidth(),128);
  assert.equal(chart.primaryAxisWidth(),128);
  const long=chart.displayedXLabels()[0].label;
  assert.equal(chart.xTickWidthFor(long),Math.min(210,Math.ceil(long.length*8+8)));
  assert.equal(chart.xTickLeft(-999),0);
  assert.equal(chart.xTickLeft(999),210-chart.xTickWidth());
  assert.equal(chart.secondaryTitleAppearance().lineHeight,25);
  assert.equal(chart.secondaryTitleAppearance().color,'#445566');
  h.set({axisLabelLayout:'truncate'});
  assert.equal(chart.valueAxisWidth(),38);
  assert.equal(chart.xTickWidthFor(long),chart.xTickWidth());
});

test('native chart requests entrance, data transitions and replay through the injected animation port', t=>{
  t.mock.timers.enable({apis:['setTimeout']});
  const h=harness(t,trace,{inputs:{animationEnabled:true,animationDuration:630}});
  const {chart}=h;
  assert.equal(h.calls.motion.some(([operation])=>operation==='start'),false);
  h.measure(frame.width,frame.height);
  assert.deepEqual(h.calls.motion.at(-1),['start',630]);
  h.motion.pending=true;
  h.measure(frame.width+20,frame.height);
  h.motion.pending=false;
  assert.deepEqual(h.calls.motion.at(-1),['start',630]);
  h.measure(frame.width+30,frame.height);
  assert.deepEqual(h.calls.motion.at(-1),['finish']);
  const changed={...trace,series:[{...base,data:data.map(point=>({...point,y:point.y+1}))}]};
  h.set({scene:plan(changed).scene});
  assert.deepEqual(h.calls.motion.at(-1),['update',220]);
  assert.match(chart.previousDrawing(),/<svg/);
  t.mock.timers.tick(470);
  assert.equal(chart.previousDrawing(),null);
  h.act('step','first');
  assert.equal(chart.state().active.value,4);
  h.set({animationKey:1});
  assert.deepEqual(h.calls.motion.at(-1),['start',630]);
  assert.equal(chart.state().active,null);
  h.reduceMotion.set(true);
  h.flush();
  assert.deepEqual(h.calls.motion.at(-1),['finish']);
  h.set({animationKey:2});
  assert.deepEqual(h.calls.motion.at(-1),['finish']);
  assert.equal(chart.radialLayout(),undefined);
});

test('native gesture callbacks scrub, commit and cancel without leaks between selections', t=>{
  const tick=installFrameClock(t);
  const h=harness(t,trace,{inputs:{locale:'en',tooltipMode:'docked'}});
  h.measure(frame.width,frame.height);
  const {chart}=h;
  const [first,second,third]=chart.ownedScene().observations;
  const event=(point,numberOfPointers)=>({x:chart.mapX(point.x),y:chart.mapY(point.y),numberOfPointers});
  const pan=chart.gesture().members.find(member=>member.type==='pan').handlers;
  pan.onStart(event(first,2));
  assert.equal(chart.state().active,null);
  pan.onStart(event(first,1));
  assert.equal(chart.state().active.id.pointId,first.id.pointId);
  assert(chart.state().scrubbing);
  pan.onUpdate(event(second,1));
  pan.onUpdate(event(third,1));
  tick();
  h.flush();
  assert.equal(chart.state().active.id.pointId,third.id.pointId);
  pan.onEnd(event(second,1),true);
  pan.onFinalize({},true);
  h.flush();
  assert.equal(chart.state().selected.pointId,second.id.pointId);
  assert.equal(chart.state().scrubbing,false);

  pan.onStart(event(first,1));
  pan.onUpdate(event(third,2));
  h.flush();
  assert.equal(chart.state().active.id.pointId,second.id.pointId);
  assert.equal(chart.state().scrubbing,false);
  pan.onStart(event(first,1));
  pan.onEnd(event(third,2),true);
  h.flush();
  assert.equal(chart.state().selected.pointId,second.id.pointId);
  pan.onStart(event(first,1));
  pan.onEnd(event(first,1),false);
  pan.onFinalize({},false);
  tick();
  h.flush();
  assert.equal(chart.state().active.id.pointId,second.id.pointId);
});

test('tap inside the visible tooltip dismisses it before hitting the underlying plot', t=>{
  const h=harness(t,trace,{inputs:{locale:'en'}});
  h.measure(frame.width,frame.height);
  h.act('step','first');
  const {chart}=h;
  const target=chart.tooltipPosition();
  assert.equal(target.docked,false);
  const gesture=chart.gesture().members.find(member=>member.type==='tap').handlers;
  gesture.onEnd({x:target.x+1,y:target.y+1},false);
  assert.equal(chart.state().selected.pointId,'point-0');
  gesture.onEnd({x:target.x+1,y:target.y+1},true);
  h.flush();
  assert.equal(chart.state().active,null);
  assert.equal(h.calls.tooltip.at(-1)[0],'hide');
  const point=chart.ownedScene().observations[2];
  tap(h,point);
  assert.equal(chart.state().selected.pointId,'point-2');
});

test('large shared and long point tooltips dock to keep full original text usable', t=>{
  const line={...trace,series:Array.from({length:5},(_,index)=>({
    ...base,id:index?'series-'+index:base.id,name:'Original '+index,data:data.map(point=>({...point,y:point.y+index/10})),
  }))};
  const h=harness(t,line,{inputs:{tooltipContent:'shared',locale:'en'}});
  h.measure(frame.width,frame.height);
  h.act('step','first');
  assert.equal(h.chart.dockedTooltipContext().shared.rows.length,5);
  assert(h.chart.dockTooltip());
  const label='A long category title which describes the original measurement in full';
  const name='Long series name preserving the source name';
  const long={...trace,axes:{...axes,x:{...category,values:[{...category.values[0],label},...category.values.slice(1)]}},series:[{...base,name}]};
  h.set({scene:plan(long).scene,tooltipContent:'point'});
  assert.equal(h.chart.state().selected.pointId,'point-0');
  assert.equal(h.chart.dockedTooltipContext().$implicit.label,label);
  assert.equal(h.chart.dockedTooltipContext().$implicit.seriesName,name);
  assert(h.chart.dockTooltip());
  h.set({scene:plan(trace).scene});
  h.act('measureScroll',{nativeEvent:{layout:{width:150}}});
  assert(h.chart.dockTooltip());
  h.act('measureScroll',{nativeEvent:{layout:{width:frame.width}}});
  assert.equal(h.chart.dockTooltip(),false);
});

test('pie label density and sector overlay preserve the original positive and zero values', t=>{
  const values=[94,2,1,1,1,1,0,0,0];
  const pie={family:'pie',title:'Shares',data:values.map((value,index)=>({id:'slice-'+index,label:'Slice '+index,value}))};
  const h=harness(t,pie,{inputs:{locale:'en',animationEnabled:true}});
  h.measure(frame.width,frame.height);
  const {chart}=h;
  assert.deepEqual(chart.radialLabels(),[]);
  assert(chart.radialLayout());
  assert.equal(chart.hasAxes(),false);
  h.set({dataLabelLayout:'truncate',labelFormatters:{dataLabel:({point,text})=>point.label+' '+text}});
  assert.deepEqual(chart.radialLabels().map(label=>label.width),Array(6).fill(52));
  assert.deepEqual(chart.radialLabels().map(label=>label.text),values.slice(0,6).map((value,index)=>'Slice '+index+' '+value+'%'));
  h.set({dataLabelLayout:'all'});
  assert(chart.radialLabels().every(label=>label.width>52));
  h.set({showDataLabels:false,minPlotWidth:1400});
  assert.deepEqual(chart.radialLabels(),[]);
  assert.equal(chart.boundedMinimumWidth(),0);
  h.act('step','first');
  assert.match(chart.activeSectorDrawing(),/<path/);
  h.act('step','last');
  assert.equal(chart.state().active.value,0);
  assert.equal(chart.activeSectorDrawing(),undefined);
  assert.equal(chart.showDataLabels(),false);
});

test('native viewport driver cancels interrupted previews and emits only live gestures', t=>{
  const tick=installFrameClock(t);
  const initial=plan(trace,{viewport:{axes:'x',value:{x:{firstId:'b',lastId:'c'}}}});
  const context={model:initial.viewport,generation:{},revision:0,acknowledgment:0,pinch:true,pan:true,controls:true};
  const h=createNativeSceneChartHarness(initial.scene,{viewportContext:context});
  t.after(h.destroy);
  h.measure(frame.width,frame.height);
  const {chart}=h;
  const preview=chart.gesture().members[1];
  assert(preview.configuration.horizontal);
  assert.equal(preview.configuration.vertical,false);
  const box=chart.viewportAxes();
  const gestureFrame={scale:2,x:box.x+box.width*.6,y:box.y+box.height*.5,dx:0,dy:0};
  preview.handlers.begin();
  assert(chart.viewportInteracting());
  assert.deepEqual(chart.viewportSnapshot(),{grid:chart.gridDrawing(),series:chart.drawing(),references:chart.referenceDrawing()});
  tick();
  assert(!h.calls.viewport.some(([call])=>call==='show'));
  tick();
  assert.deepEqual(h.calls.viewport.at(-1),['show']);
  preview.handlers.end(gestureFrame,false,'pinch');
  assert.equal(chart.viewportInteracting(),false);
  assert.equal(chart.viewportSnapshot(),null);
  assert.deepEqual(h.events.viewport,[]);
  preview.handlers.begin();
  preview.handlers.end(gestureFrame,true,'pinch');
  assert.equal(h.events.viewport.length,1);
  assert.equal(h.events.viewport[0].source,'pinch');
  const zoomed=transformPlanViewport(initial.viewport,h.events.viewport[0].intent);
  assert.equal(zoomed.status,'ok');
  assert.notDeepEqual(zoomed.value,initial.viewport.value);
  h.set({viewportContext:{...context,acknowledgment:1}});
  tick();
  tick();
  assert.equal(chart.viewportInteracting(),false);
  const other=plan(trace,{viewport:{axes:'x',value:{x:{firstId:'c',lastId:'d'}}}});
  h.set({scene:other.scene,viewportContext:{...context,model:other.viewport,generation:{}}});
  preview.handlers.begin();
  assert.equal(chart.viewportInteracting(),false);
  preview.handlers.end(gestureFrame,true,'pinch');
  assert.equal(h.events.viewport.length,1);
});

test('radar axis controls preserve original category and ring text and suppress crowded labels', t=>{
  const radar={...trace,family:'radar',title:'Radar'};
  const h=harness(t,radar);
  h.measure(frame.width,frame.height);
  const {chart}=h;
  assert(chart.hasAxes());
  const ticks=chart.polarLabels();
  assert.deepEqual(ticks.filter(tick=>tick.id.startsWith('category:')).map(tick=>tick.text),category.values.map(item=>item.label));
  assert.deepEqual(ticks.filter(tick=>tick.id.startsWith('ring:')).map(tick=>tick.text),['2.5','5','7.5','10']);
  assert(ticks.every(tick=>Number.isFinite(tick.left)&&Number.isFinite(tick.top)));
  h.set({showXAxis:false});
  assert(chart.polarLabels().every(tick=>tick.id.startsWith('ring:')));
  h.set({showXAxis:true,showYAxis:false});
  assert(chart.polarLabels().every(tick=>tick.id.startsWith('category:')));
  h.scale.set(1.6);
  h.flush();
  assert.deepEqual(chart.polarLabels(),[]);
  h.scale.set(1);
  h.flush();
  h.measure(170,220);
  assert.deepEqual(chart.polarLabels(),[]);
});

test('native gauge keeps reading, target and bands in independent layers', t=>{
  const gauge={family:'gauge',title:'Measurement',value:72,domain:[0,100],unit:'%',
    bands:[{id:'safe',from:0,to:80,color:'#638A35'}],target:{value:80,label:'Target'}};
  const h=harness(t,gauge,{inputs:{animationEnabled:true,locale:'en'}});
  h.measure(frame.width,frame.height);
  const {chart}=h;
  assert.deepEqual(chart.gaugeParts(),{base:['track','band:safe'],reading:['reading'],overlay:['target']});
  const [bands,reading,target]=[chart.gridDrawing(),chart.drawing(),chart.gaugeOverlayDrawing()];
  assert.match(bands,/#638a35/i);
  assert.doesNotMatch(reading,/#638a35/i);
  assert.doesNotMatch(target,/#638a35/i);
  assert.match(reading,/<path/);
  assert.match(target,/<path/);
  assert.notEqual(reading,target);
  assert(chart.radialLayout());
  h.act('step','first');
  assert.equal(chart.dockedTooltipContext().$implicit.value,72);
  assert.equal(chart.dockedTooltipContext().unit,'%');
  assert.match(chart.activeSectorDrawing(),/<path/);
});

test('treemap and item selections expose only the actual painted geometry', t=>{
  const tree={family:'treemap',title:'Work',root:{id:'root',children:[
    {id:'large',label:'Large',value:6},{id:'small',label:'Small',value:3},{id:'zero',label:'Zero',value:0},
  ]}};
  const h=harness(t,tree,{inputs:{locale:'en'}});
  h.measure(frame.width,frame.height);
  const {chart}=h;
  assert.deepEqual(chart.tileLabels().map(label=>label.text),['root','Large','Small']);
  h.act('step','first');
  assert.equal(chart.activeTile().pointId,'root');
  assert(chart.activeTile().width>0);
  h.act('step','last');
  assert.equal(chart.state().active.value,0);
  assert.equal(chart.activeTile(),undefined);
  h.set({showDataLabels:false});
  assert.deepEqual(chart.tileLabels(),[]);
  const item={family:'item',title:'Units',columns:3,data:[
    {id:'many',label:'Many',value:3},{id:'zero',label:'Zero',value:0},
  ]};
  h.set({scene:plan(item).scene});
  assert.equal(chart.activeItemDrawing(),undefined);
  h.act('step','first');
  assert.equal((chart.activeItemDrawing().match(/<circle/g)??[]).length,3);
  assert.equal(chart.state().active.value,3);
  h.act('step','last');
  assert.equal(chart.state().active.value,0);
  assert.equal(chart.activeItemDrawing(),undefined);
});

test('the accessible touch hint distinguishes hidden series, missing cells and transparent matrices', t=>{
  const h=harness(t,trace,{options:{hiddenSeriesIds:[base.id]},inputs:{locale:'en'}});
  const {chart}=h;
  assert.equal(chart.accessibilityHint(),'All series are hidden.');
  h.set({legendInteractive:true});
  assert.equal(chart.accessibilityHint(),'All series are hidden. Show one in the legend.');
  h.set({locale:'es'});
  assert.equal(chart.accessibilityHint(),'Todas las series están ocultas. Activa una en la leyenda.');
  h.set({showLegend:false});
  assert.equal(chart.accessibilityHint(),'Todas las series están ocultas.');
  const matrix={family:'heatmap',title:'Matrix',axes:{x:category,y:category}};
  const states=[
    [{...matrix,data:[]},'No original matrix cells.','No hay celdas originales en la matriz.'],
    [{...matrix,data:[{id:'gap',rowId:'a',columnId:'a',value:null}]},'All supplied cells are unknown. Missing values are not zero.','Todas las celdas aportadas son desconocidas. Los valores ausentes no son cero.'],
    [{...matrix,opacity:0,data:[{id:'real',rowId:'a',columnId:'a',value:0}]},'The matrix is transparent. Original values are retained.','La matriz es transparente. Se conservan los valores originales.'],
  ];
  for(const [spec,en,es] of states) {
    h.set({scene:plan(spec).scene,locale:'en'});
    assert.equal(chart.touchHint(),en);
    h.set({locale:'es'});
    assert.equal(chart.touchHint(),es);
  }
  const known=plan({...matrix,data:[{id:'real',rowId:'a',columnId:'a',value:0}]}).scene;
  h.set({scene:known,locale:'en'});
  assert.match(chart.touchHint(),/Touch a known cell to read its original value/);
  h.act('step','first');
  assert.equal(chart.dockedTooltipContext().$implicit.value,0);
  assert.match(chart.accessibilityValue().text,/0/);
});

test('column and interval category labels stay format-aware when native vertical space shrinks', t=>{
  const many=Array.from({length:16},(_,index)=>({id:'id-'+index,label:'Original category '+index}));
  const bars={family:'column',title:'Horizontal columns',orientation:'horizontal',axes:{...axes,x:{type:'category',values:many}},series:[
    {...base,data:many.map(({id},index)=>({id,x:id,y:1+index%7}))},
  ]};
  const h=harness(t,bars,{inputs:{locale:'en'}});
  h.measure(280,185);
  const {chart}=h;
  assert(chart.horizontalBars());
  assert(chart.displayedYAxis());
  const raw=chart.barLabels();
  assert.equal(raw.length,many.length);
  assert(chart.displayedCategoryLabels().length<raw.length);
  assert.equal(chart.primaryAxisWidth(),90);
  assert.equal(chart.categoryLabelHeight(),32);
  const records=[];
  h.set({axisLabelLayout:'all',labelFormatters:{yAxisLabel:record=>{records.push(record);return 'Full '+record.text;}}});
  const shown=chart.displayedCategoryLabels();
  assert.equal(shown.length,raw.length);
  assert.equal(records[0].type,'category');
  assert.equal(records[0].value,raw[0].id);
  assert.deepEqual(shown.map(label=>label.label),raw.map(label=>'Full '+label.label));
  assert.equal(chart.primaryAxisWidth(),160);
  h.scale.set(1.75);
  h.flush();
  assert.equal(chart.categoryLabelHeight(),31.5);
  const timeline={family:'timeline',title:'Measured events',axes:{x:{type:'time',domain:[0,1000]}},
    series:[{id:'dates',name:'Releases',data:[
      {id:'late',x:1000,title:'Later'},{id:'epoch',x:0,title:'Epoch'},{id:'unknown',x:null,title:'Unscheduled'},
    ]}]};
  h.set({scene:plan(timeline).scene,axisLabelLayout:'auto'});
  assert(chart.temporalYAxis());
  assert.equal(chart.primaryAxisWidth(),72);
  assert.equal(chart.missingSourceCount(),1);
  assert.match(chart.missingSourceLabel(),/1 data item has unknown coordinates/);
  h.set({locale:'es'});
  assert.match(chart.missingSourceLabel(),/1 dato tiene coordenadas desconocidas/);
  h.act('step','first');
  assert.equal(chart.dockedTooltipContext().$implicit.id.pointId,'late');
  h.act('step','last');
  assert.equal(chart.dockedTooltipContext().$implicit.id.pointId,'epoch');
  assert.match(chart.accessibilityValue().text,/1970-01-01/);
});

test('selected tilemap cells and Venn intersections draw markers for owned regions only', t=>{
  const tile={family:'tilemap',title:'Source cells',tileShape:'circle',series:[{
    ...base,data:[{id:'zero',x:0,y:0,value:0,name:'Origin'},{id:'unknown',x:1,y:0,value:null}],
  }]};
  const h=harness(t,tile,{inputs:{locale:'en',tooltipMode:'docked'}});
  h.measure(frame.width,frame.height);
  const {chart}=h;
  assert.equal(chart.activeTilemapCircle(),undefined);
  tap(h,chart.ownedScene().observations[0]);
  assert.equal(chart.state().active.value,0);
  assert.equal((chart.activeTilemapCircle().match(/<circle/g)??[]).length,2);
  assert.equal(chart.activePolygonDrawing(),undefined);
  h.set({theme:'dark'});
  assert.match(chart.activeTilemapCircle(),/#F2F6FC/);
  const square=plan({...tile,tileShape:'square'}).scene;
  h.set({scene:square});
  assert.equal(chart.state().active.id.pointId,'zero');
  assert.equal(chart.activeTilemapCircle(),undefined);
  assert.match(chart.activePolygonDrawing(),/<path/);
  const venn={family:'venn',title:'Original inclusive count',sets:[{id:'a',label:'A'},{id:'b',label:'B'}],
    data:[{id:'all-a',sets:['a'],value:12},{id:'all-b',sets:['b'],value:9},{id:'overlap',sets:['a','b'],value:2}]};
  h.set({scene:plan(venn).scene});
  assert.equal(chart.activeVennDrawing(),undefined);
  const overlap=chart.ownedScene().observations.find(point=>point.id.pointId==='overlap');
  tap(h,overlap);
  assert.equal(chart.state().active.value,2);
  assert.equal((chart.activeVennDrawing().match(/<circle/g)??[]).length,4);
  assert.match(chart.touchHint(),/inclusive measurement/);
});

test('a connected host exposes keyboard navigation and revokes stale leases on pin, unmount and destroy', t=>{
  const connections=[];
  const host={connect(element,callbacks,scene) {
    const connection={element,callbacks,scene,disconnected:false};
    connections.push(connection);
    return ()=>{connection.disconnected=true;};
  }};
  const h=createNativeSceneChartHarness(plan(trace).scene,{locale:'en',tooltipPinnable:true,tooltipMode:'docked'},{inputBridge:host});
  t.after(h.destroy);
  const element={};
  h.setHost(element);
  const first=connections.at(-1);
  assert.equal(first.element,element);
  assert.equal(first.scene.family,'line');
  assert(first.callbacks.active());
  assert(first.callbacks.enabled());
  first.callbacks.layout(frame.width,frame.height);
  assert.deepEqual(h.events.layout,[frame]);
  first.callbacks.jump('last');
  h.flush();
  const value=h.chart.accessibilityValue();
  assert.deepEqual([value.min,value.max,value.now],[1,4,4]);
  assert.match(value.text,/Category D/);
  assert.match(h.chart.accessibilityHint(),/arrow keys.*Home or End/);
  first.callbacks.step(-1);
  h.flush();
  assert.equal(h.chart.state().active.id.pointId,'point-2');
  assert.equal(h.chart.accessibilityValue().now,3);
  h.act('togglePin');
  assert(first.disconnected);
  assert.equal(first.callbacks.active(),false);
  const pinned=connections.at(-1);
  assert.notEqual(pinned,first);
  assert(pinned.callbacks.active());
  assert.equal(pinned.callbacks.enabled(),false);
  first.callbacks.clear();
  pinned.callbacks.step(1);
  h.flush();
  assert.equal(h.chart.state().active.id.pointId,'point-2');
  pinned.callbacks.clear();
  h.flush();
  assert.equal(h.chart.state().active,null);
  assert.equal(h.chart.pinned(),false);
  const current=connections.at(-1);
  h.setHost(undefined);
  assert(current.disconnected);
  current.callbacks.jump('first');
  h.flush();
  assert.equal(h.chart.state().active,null);
  h.setHost(element);
  const finalConnection=connections.at(-1);
  h.destroy();
  assert(finalConnection.disconnected);
  assert.equal(finalConnection.callbacks.enabled(),false);
  assert.equal(h.calls.haptics.at(-1),'destroy');
  assert.equal(h.calls.tooltip.at(-1)[0],'destroy');
});

test('the host forwards only finite viewport updates for the active scene', t=>{
  const tick=installFrameClock(t);
  const initial=plan(trace,{viewport:{axes:'x',value:{x:{firstId:'b',lastId:'c'}}}});
  const context={model:initial.viewport,generation:{},revision:0,acknowledgment:0,pinch:true,pan:true,controls:true};
  let live;
  const inputBridge={connect(_element,callbacks){live=callbacks;return ()=>{};}};
  const h=createNativeSceneChartHarness(initial.scene,{viewportContext:context},{inputBridge});
  t.after(h.destroy);
  h.setHost({});
  const viewport=live.viewport;
  assert(viewport.pinch);
  assert(viewport.pan);
  assert(viewport.enabled());
  const box=h.chart.viewportAxes();
  const change={scale:1,x:box.x+box.width/2,y:box.y+box.height/2,dx:-box.width*.25,dy:0};
  viewport.update(change);
  assert.equal(h.calls.viewport.filter(([call])=>call==='preview').length,0);
  viewport.begin(change,frame.width,frame.height);
  viewport.update({...change,x:NaN});
  viewport.update(change);
  assert.equal(h.calls.viewport.filter(([call])=>call==='preview').length,2);
  assert.deepEqual(h.calls.viewport.at(-1).slice(0,2),['preview',change]);
  tick();
  tick();
  viewport.end(change,true);
  assert.equal(h.events.viewport.length,1);
  assert.equal(h.events.viewport[0].source,'pan');
  h.set({viewportContext:undefined});
  viewport.update(change);
  viewport.end(change,true);
  assert.equal(viewport.enabled(),false);
  assert.equal(h.events.viewport.length,1);
  assert(h.calls.viewport.some(([operation])=>operation==='destroy'));
});

test('native text explains an empty graph window according to the enabled recovery controls', t=>{
  const tree={family:'treegraph',title:'Hierarchy',nodes:[{id:'root',label:'Root'},{id:'leaf',label:'Leaf'}],
    links:[{id:'edge',from:'root',to:'leaf'}]};
  const view=plan(tree,{viewport:{axes:'xy',value:{x:[0,.15],y:[0,.15]}}});
  assert.equal(view.scene.observations.length,0);
  const context={model:view.viewport,generation:{},revision:0,acknowledgment:0,pinch:true,pan:true,controls:true};
  const h=createNativeSceneChartHarness(view.scene,{locale:'en',viewportContext:context});
  t.after(h.destroy);
  const {chart}=h;
  assert(chart.emptyNodeWindow());
  assert.deepEqual(chart.accessibilityValue(),{text:'No nodes in this region'});
  assert.equal(chart.accessibilityHint(),'No nodes in this region. Zoom out or reset the view.');
  h.set({locale:'es'});
  assert.deepEqual(chart.accessibilityValue(),{text:'No hay nodos en esta zona'});
  assert.equal(chart.accessibilityHint(),'No hay nodos en esta zona. Aleja o restablece la vista.');
  h.set({viewportContext:{...context,controls:false,pinch:false}});
  assert.equal(chart.accessibilityHint(),'No hay nodos en esta zona. Desplaza la vista a otra zona.');
  h.set({locale:'en'});
  assert.equal(chart.accessibilityHint(),'No nodes in this region. Pan to another region.');
  h.set({viewportContext:{...context,controls:false,pinch:false,pan:false}});
  assert.equal(chart.accessibilityHint(),'No nodes in this region.');
  const full=plan(tree);
  h.set({scene:full.scene,viewportContext:undefined});
  h.act('step','last');
  assert.equal(chart.state().active.id.pointId,'leaf');
  assert.match(chart.accessibilityValue().text,/Incoming.*Outgoing.*Depth/);
});

test('word cloud presentation distinguishes pending measurement, no fit and a visible measured word', t=>{
  const source={type:'wordcloud',words:[{id:'real',text:'Measured word',weight:9}]};
  const prepare=words=>{
    const result=prepareNativeWordCloud({type:'wordcloud',words},undefined,frame,[],'native-chart-test-font');
    assert.equal(result.status,'ok');
    return result;
  };
  const measured=(prepared,width,height)=>plan(prepared.spec,{wordcloudText:{
    fontKey:prepared.fontKey,measurements:prepared.preparation.requests.map(request=>({...request,width,height})),
  }}).scene;
  const prepared=prepare(source.words);
  const h=createNativeSceneChartHarness(measuringWordCloud(prepared),{locale:'en',tooltipMode:'docked'});
  t.after(h.destroy);
  const {chart}=h;
  assert.equal(chart.touchHint(),'Measuring text…');
  assert.equal(chart.activeTile(),undefined);
  h.set({locale:'es'});
  assert.equal(chart.touchHint(),'Midiendo texto…');
  const noFit=measured(prepared,1000,1000);
  assert.equal(noFit.wordcloud.layout.emptyReason,'noSpace');
  h.set({scene:noFit});
  assert.match(chart.touchHint(),/Ningún término cabe/);
  h.set({locale:'en'});
  assert.match(chart.touchHint(),/No terms fit.*Original weights are retained/);
  const unknown=prepare([{id:'zero',text:'Zero',weight:0},{id:'unknown',text:'Unknown',weight:null}]);
  h.set({scene:measured(unknown,48,20)});
  assert.match(chart.touchHint(),/No positive known term weights/);
  h.set({locale:'es'});
  assert.match(chart.touchHint(),/No hay términos con peso positivo conocido/);
  const ready=measured(prepared,48,20);
  h.set({scene:ready,locale:'en'});
  assert.equal(chart.touchHint(),'Touch a word to read its original weight.');
  h.act('step','first');
  assert.equal(chart.state().active.value,9);
  assert.deepEqual(chart.activeTile(),ready.series[0].textGlyphs[0].bounds);
});

test('contour accessibility keeps missing samples separate from empty viewport and levels', t=>{
  const numeric={x:{type:'linear',domain:[0,4]},y:{type:'linear',domain:[0,5]}};
  const contour={family:'contour',title:'Contours',axes:numeric,contour:{levels:[{id:'mark',value:1}]},
    grid:{id:'field',x:[0,4],y:[0,5],ids:['a','b','c','d'],values:[0,2,0,2]}};
  const h=harness(t,contour,{inputs:{locale:'en'}});
  const {chart}=h;
  assert.match(chart.touchHint(),/Touch an isoline.*original corner samples/);
  const cases=[
    [plan(contour,{viewport:{axes:'xy',value:{x:[0,.5]}}}).scene,'outsideViewport',/No isolines in this window/,/No hay isolíneas en esta ventana/],
    [plan({...contour,grid:{...contour.grid,values:[null,2,0,2]}}).scene,'missing',/Unknown samples interrupt/,/Las muestras desconocidas interrumpen/],
    [plan({...contour,contour:{levels:[{id:'mark',value:3}]}}).scene,'noCrossings',/No crossings at the requested levels/,/No hay cruces en los niveles solicitados/],
  ];
  for(const [scene,reason,en,es] of cases) {
    assert.equal(scene.contour.emptyReason,reason);
    assert.equal(scene.contour.samples.length,4);
    h.set({scene,locale:'en'});
    assert.match(chart.accessibilityHint(),en);
    h.set({locale:'es'});
    assert.match(chart.accessibilityHint(),es);
  }
});

test('changing the bands palette redraws the native grid without disturbing the selection', t=>{
  const band={id:'waterline',axis:'y',from:1,to:3};
  const withBand=plan(trace,{referenceBands:[band]}).scene;
  const styled=(scene,id,color,opacity)=>updateScenePresentation(scene,{referenceBandStyles:[{id,label:'Target band',color,opacity}]});
  const initial=styled(withBand,band.id,'#112233',.4);
  const h=createNativeSceneChartHarness(initial,{theme:'dark',locale:'en',tooltipMode:'docked'});
  t.after(h.destroy);
  const {chart}=h;
  h.act('step','first');
  const before=chart.gridDrawing();
  assert.match(before,/fill="#112233" fill-opacity="0.4"/);
  assert.match(before,/#35465E/);
  assert.equal(chart.referenceLabels()[0].text,'Target band');
  h.set({scene:styled(withBand,band.id,'#445566',.4)});
  assert.match(chart.gridDrawing(),/fill="#445566" fill-opacity="0.4"/);
  h.set({scene:styled(withBand,band.id,'#445566',.6)});
  assert.match(chart.gridDrawing(),/fill="#445566" fill-opacity="0.6"/);
  const other={...band,id:'alternate'};
  h.set({scene:styled(plan(trace,{referenceBands:[other]}).scene,other.id,'#445566',.6)});
  assert.equal(chart.referenceLabels()[0].id,'["band","alternate"]');
  h.set({scene:plan(trace).scene});
  assert.doesNotMatch(chart.gridDrawing(),/#445566|#112233/);
  assert.deepEqual(chart.referenceLabels(),[]);
  assert.equal(chart.state().selected.pointId,'point-0');
});

test('a filled polygon viewport with no original vertices explains how to restore navigation', t=>{
  const polygon={family:'polygon',title:'Covered territory',axes:{x:{type:'linear'},y:{type:'linear'}},series:[
    {id:'region',name:'Region',data:[[0,0],[4,0],[4,4],[0,4]].map(([x,y],index)=>({id:'v'+index,x,y}))},
  ]};
  const result=plan(polygon,{viewport:{axes:'xy',value:{x:[1,2],y:[1,2]}}});
  assert.deepEqual(result.scene.observations,[]);
  const h=createNativeSceneChartHarness(result.scene,{locale:'en'});
  t.after(h.destroy);
  assert.match(h.chart.drawing(),/<path/);
  assert.match(h.chart.accessibilityHint(),/No source vertices inside this window. Reset zoom/);
  h.set({locale:'es'});
  assert.match(h.chart.accessibilityHint(),/No hay vértices de origen.*Restablece el zoom/);
});

test('native legend fallback and weighted labels retain source identity without inventing controls', t=>{
  const laid=plan(trace).scene;
  const {legend:_omitted,...scene}=laid;
  const h=createNativeSceneChartHarness(scene,{legendInteractive:true,locale:'en'});
  t.after(h.destroy);
  assert.deepEqual(h.chart.legendItems().map(item=>[item.id,item.name,item.visible]),[['observed','Observations',true]]);
  h.act('toggleLegend','observed');
  assert.deepEqual(h.events.legend,[]);
  const weighted={family:'variwide',title:'Output and capacity',axes,series:[
    {...base,data:data.map((point,index)=>({...point,z:index+1}))},
  ]};
  h.set({scene:plan(weighted).scene,axisLabelLayout:'all',labelFormatters:{xAxisLabel:tick=>'Full '+tick.text}});
  h.act('measureScroll',{nativeEvent:{layout:{width:280}}});
  const labels=h.chart.weightedLabels();
  assert.deepEqual(labels.map(label=>label.id),category.values.map(item=>item.id));
  assert.deepEqual(labels.map(label=>label.label),category.values.map(item=>'Full '+item.label));
  assert(labels.every(label=>label.left>=0&&label.left+label.width<=280));
  h.measure(280,300);
  h.set({axisLabelLayout:'truncate'});
  const compact=h.chart.weightedLabels();
  assert.deepEqual(compact.map(label=>label.label),labels.map(label=>label.label));
  assert(compact.every(label=>label.left>=0&&label.left+label.width<=280));
  h.set({axisLabelLayout:'auto'});
  assert(h.chart.weightedLabels().every(label=>label.label.startsWith('Full ')));
});

test('a finite animation does not restart over a retained selected point or shared category', t=>{
  const both={...trace,series:[base,{id:'other',name:'Other',data:data.map(point=>({...point,y:point.y-1}))}]};
  for(const tooltipContent of ['point','shared']) {
    const h=harness(t,both,{inputs:{tooltipContent,tooltipMode:'docked'}});
    h.measure(frame.width,frame.height);
    h.act('step','first');
    const earlier=h.chart.state().active;
    h.calls.motion.length=0;
    h.set({animationEnabled:true,animationDuration:600});
    assert.deepEqual(h.calls.motion.at(-1),['finish']);
    assert.equal(h.calls.motion.filter(([call])=>call==='start').length,0);
    assert.deepEqual(h.chart.state().active.id,earlier.id);
    if(tooltipContent==='shared')assert.equal(h.chart.state().shared.key,earlier.group.key);
  }
  const fresh=harness(t,trace,{inputs:{animationEnabled:true,skipEntrance:true}});
  fresh.measure(frame.width,frame.height);
  assert.deepEqual(fresh.calls.motion.at(-1),['finish']);
  assert.equal(fresh.calls.motion.filter(([call])=>call==='start').length,0);
  fresh.set({animationKey:1});
  assert.deepEqual(fresh.calls.motion.at(-1),['start',1100]);
});

test('host consume, tap and drag use the same transformed datum and state as native controls', t=>{
  const tick=installFrameClock(t);
  let input;
  const bridge={connect(_target,callbacks){input=callbacks;return ()=>{};}};
  const h=createNativeSceneChartHarness(plan(trace).scene,{locale:'en'},{inputBridge:bridge});
  t.after(h.destroy);
  h.setHost({});
  input.layout(frame.width,frame.height);
  const {chart}=h;
  const [first,second,last]=[chart.ownedScene().observations[0],chart.ownedScene().observations[1],chart.ownedScene().observations.at(-1)];
  const coordinates=point=>[chart.mapX(point.x),chart.mapY(point.y)];
  input.tap(...coordinates(first),frame.width,frame.height);
  h.flush();
  assert.equal(chart.state().selected.pointId,first.id.pointId);
  assert.equal(input.consumeTap(-1,-1,frame.width,frame.height),false);
  const tooltip=chart.tooltipPosition();
  assert.equal(input.consumeTap(tooltip.x+1,tooltip.y+1,frame.width,frame.height),true);
  h.flush();
  assert.equal(chart.state().active,null);
  input.begin(...coordinates(second),frame.width,frame.height);
  assert.equal(chart.state().active.id.pointId,second.id.pointId);
  input.move(...coordinates(last));
  tick();
  h.flush();
  input.end(true);
  h.flush();
  assert.equal(chart.state().selected.pointId,last.id.pointId);
  assert.equal(chart.state().scrubbing,false);
});

test('inactive native chart ignores callbacks already queued before effects have revoked the lease', t=>{
  const h=harness(t,trace,{inputs:{tooltipPinnable:true}});
  h.measure(frame.width,frame.height);
  h.act('step','first');
  const {chart}=h;
  const gesture=chart.gesture();
  const [pan,tap]=gesture.members.map(member=>member.handlers);
  const point=chart.ownedScene().observations.at(-1);
  const event={x:chart.mapX(point.x),y:chart.mapY(point.y)};
  const before=h.events.interaction.length;
  h.set({active:false},{flushEffects:false});
  pan.onStart(event);
  pan.onUpdate(event);
  pan.onEnd(event,true);
  pan.onFinalize(event,false);
  tap.onEnd(event,true);
  chart.requestView({type:'reset'});
  chart.toggleDetails();
  chart.togglePin();
  chart.clear();
  assert.equal(h.events.interaction.length,before);
  assert.deepEqual(h.events.viewport,[]);
  h.flush();
  assert.deepEqual(h.events.interaction.at(-1),{active:null,selected:null,scrubbing:false});
  assert.equal(chart.drawing(),'');
  h.set({active:true});
  h.act('step','last');
  assert.equal(chart.state().active.id.pointId,point.id.pointId);
  const sizes=h.events.layout.length;
  h.destroy();
  chart.measure({nativeEvent:{layout:{width:600,height:400}}});
  assert.equal(h.events.layout.length,sizes);
});

test('native movement outside a floating detail does not consume the tap and dragging its box clears it', t=>{
  const h=harness(t,trace,{inputs:{locale:'en',animationEnabled:true,animationDuration:500}});
  h.measure(frame.width,frame.height);
  h.act('step','first');
  const {chart}=h;
  assert.deepEqual(h.calls.tooltip.at(-1).slice(-1),[0]);
  assert.match(chart.touchHint(),/Touch a point to see its value/);
  h.act('step',1);
  assert.deepEqual(h.calls.tooltip.at(-1).slice(-1),[180]);
  h.measure(frame.width+20,frame.height);
  assert.deepEqual(h.calls.tooltip.at(-1).slice(-1),[0]);
  const body=chart.tooltipPosition();
  const pan=chart.gesture().members.find(member=>member.type==='pan').handlers;
  pan.onStart({x:body.x+3,y:body.y+3});
  assert.equal(chart.state().active,null);
  const point=chart.ownedScene().observations.at(-1);
  const elsewhere={x:chart.mapX(point.x),y:chart.mapY(point.y)};
  pan.onUpdate(elsewhere);
  pan.onEnd(elsewhere,true);
  h.flush();
  assert.equal(chart.state().active,null);
  const tap=chart.gesture().members.find(member=>member.type==='tap').handlers;
  tap.onEnd(elsewhere,true);
  h.flush();
  assert.equal(chart.state().selected.pointId,point.id.pointId);
  h.set({tooltipMode:'off'});
  assert.match(chart.touchHint(),/Explore with the navigation controls/);
});

test('long shared-series names keep a two-row tooltip docked without shortening the source', t=>{
  const name='Original series name with sufficient length to require a full-text tooltip';
  const series=[base,{id:'peer',name,data:data.map(point=>({...point,y:point.y+.25}))}];
  const h=harness(t,{...trace,series},{inputs:{locale:'en',tooltipContent:'shared'}});
  h.measure(frame.width,frame.height);
  h.act('step','first');
  assert.equal(h.chart.dockedTooltipContext().shared.rows.length,2);
  assert.equal(h.chart.dockedTooltipContext().shared.rows[1].name,name);
  assert(h.chart.dockTooltip());
  assert.match(h.chart.accessibilityValue().text,/require a full-text tooltip: 3.25/);
  h.set({tooltipPinnable:true});
  h.act('togglePin');
  assert.match(h.chart.touchHint(),/Tooltip pinned. Unpin to explore/);
  h.set({locale:'es'});
  assert.match(h.chart.touchHint(),/Tooltip fijado. Desfija para explorar/);
});

test('Venn guidance distinguishes omitted and approximate geometry while retaining measured counts', t=>{
  const venn=values=>{
    const sets=(values.length===7?['a','b','c']:['a','b']).map(id=>({id,label:id.toUpperCase()}));
    return {family:'venn',title:'Measured inclusive counts',sets,data:values.map((value,index)=>({
      id:'measure-'+index,value,sets:sets.filter((_,offset)=>((index+1)&(1<<offset))!==0).map(set=>set.id),
    }))};
  };
  const h=harness(t,venn([12,9,null]),{inputs:{locale:'en'}});
  const {chart}=h;
  assert.match(chart.touchHint(),/Unknown intersections.*not drawn/);
  h.act('step','first');
  assert.equal(chart.state().active.value,12);
  assert.equal(chart.activeVennDrawing(),undefined);
  h.set({scene:plan(venn([0,0,0])).scene});
  assert.match(chart.touchHint(),/All measurements are zero/);
  h.act('step','first');
  assert.equal(chart.state().active.value,0);
  assert.equal(chart.activeVennDrawing(),undefined);
  const measurements=[100,90,40,80,35,30,15];
  const approximate=plan(venn(measurements)).scene;
  assert.equal(approximate.venn.layout.status,'approximate');
  h.set({scene:approximate});
  assert.match(chart.touchHint(),/Circle areas approximate.*original inclusive values/);
  assert.deepEqual(chart.ownedScene().observations.map(point=>point.value),measurements);
});

test('source summaries distinguish size, partial sums and unknown coordinates in English and Spanish', t=>{
  const bubble={family:'bubble',title:'Measured bubbles',axes:{x:{type:'linear'},y:{type:'linear'}},
    series:[{...base,data:[{id:'datum',x:3,y:5,z:9}]}]};
  const h=harness(t,bubble,{inputs:{locale:'en',animationEnabled:true}});
  const {chart}=h;
  assert(chart.bubbleLayout());
  h.act('step','first');
  assert.match(chart.accessibilityValue().text,/X: 3, Size: 9/);
  h.set({locale:'es',xAxisTitle:'Posición'});
  assert.match(chart.accessibilityValue().text,/Posición: 3, Tamaño: 9/);
  const tree={family:'treemap',title:'Totals',root:{id:'root',label:'Total',children:[
    {id:'known',label:'Known',value:6},{id:'missing',label:'Unknown',value:null},
  ]}};
  h.set({scene:plan(tree).scene,locale:'en'});
  h.act('step','first');
  assert.equal(chart.state().active.value,6);
  assert.match(chart.accessibilityValue().text,/Subtotal · incomplete known values/);
  h.set({locale:'es'});
  assert.match(chart.accessibilityValue().text,/Subtotal · valores conocidos incompletos/);
  const timeline={family:'timeline',title:'Events with unknown time',axes:{x:{type:'time',domain:[0,1000]}},series:[
    {id:'releases',name:'Releases',data:[
      {id:'date',x:0,title:'Epoch'},{id:'first-unknown',x:null,title:'Unknown 1'},{id:'second-unknown',x:null,title:'Unknown 2'},
    ]},
  ]};
  h.set({scene:plan(timeline).scene});
  assert.match(chart.missingSourceLabel(),/2 datos tienen coordenadas desconocidas y no se pueden dibujar/);
  h.set({locale:'en'});
  assert.match(chart.missingSourceLabel(),/2 data items have unknown coordinates and cannot be plotted/);
});

test('missing bullet and variwide data are announced separately from known targets and sizes', t=>{
  const bullet={family:'bullet',title:'Measurements',orientation:'horizontal',axes,series:[
    {...base,data:[
      {id:'unknown',x:'a',y:null},{id:'target',x:'b',y:null,target:6},{id:'reading',x:'c',y:4},
    ]},
  ]};
  const h=harness(t,bullet,{inputs:{locale:'en'}});
  const {chart}=h;
  assert(chart.horizontalBars());
  assert.equal(chart.missingSourceCount(),1);
  assert.match(chart.missingSourceLabel(),/1 source items have unknown measurements or widths/);
  h.act('step','first');
  assert.equal(chart.state().active.id.pointId,'target');
  assert.match(chart.accessibilityValue().text,/Target.*6/);
  const variwide={family:'variwide',title:'Measures by width',axes,series:[
    {...base,data:[
      {id:'width',x:'a',y:4,z:null},{id:'height',x:'b',y:null,z:3},{id:'complete',x:'c',y:2,z:6},
    ]},
  ]};
  h.set({scene:plan(variwide).scene,locale:'es'});
  assert.equal(chart.missingSourceCount(),2);
  assert.match(chart.missingSourceLabel(),/2 datos originales tienen medidas o anchos desconocidos/);
  h.act('step','first');
  assert.equal(chart.state().active.id.pointId,'complete');
  assert.match(chart.accessibilityValue().text,/Ancho.*6/);
});

test('tilemap dark and compact fallback drawings preserve geometry and distinguish no ink from missing data', t=>{
  const tile={family:'tilemap',title:'Raw grid',tileShape:'circle',series:[
    {...base,data:[{id:'original',x:0,y:0,value:0,name:'Original cell'}]},
  ]};
  const h=harness(t,tile,{inputs:{locale:'en',theme:'dark'}});
  const {chart}=h;
  h.act('step','first');
  assert.match(chart.activeTilemapCircle(),/viewBox="0 0 480 260"/);
  assert.match(chart.activeTilemapCircle(),/#F2F6FC/);
  h.set({scene:plan({...tile,opacity:0}).scene});
  assert.equal(chart.state().active,null);
  assert.match(chart.touchHint(),/No cells can be drawn.*Original values are preserved/);
  h.set({locale:'es'});
  assert.match(chart.touchHint(),/No se pueden dibujar celdas.*Se conservan los valores originales/);
  h.set({scene:plan({...tile,series:[{...base,data:[{id:'original',x:0,y:0,value:null}]}]}).scene,locale:'en'});
  assert.match(chart.touchHint(),/All source values are unknown.*positions are preserved/);
});

test('native mixed columns win inside painted rectangles and let line markers retain their own targets', t=>{
  const mixed={family:'mixed',title:'Columns and measurements',axes,series:[
    {id:'column',name:'Painted column',type:'column',data:data.map(point=>({...point,y:9}))},
    {id:'line',name:'Raw reading',type:'line',data:data.map(point=>({...point,y:2}))},
  ]};
  const h=harness(t,mixed,{inputs:{locale:'en',tooltipMode:'docked'}});
  h.measure(frame.width,frame.height);
  const {chart}=h;
  const scene=chart.ownedScene();
  const columns=scene.series.find(series=>series.id==='column').bars;
  for (const bar of columns) {
    tap(h,{x:bar.x+bar.width/2,y:bar.y+bar.height*.9});
    assert.deepEqual(chart.state().selected,{seriesId:'column',pointId:bar.pointId});
    assert.equal(chart.dockedTooltipContext().$implicit.value,9);
    const marker=scene.observations.find(point=>point.id.seriesId==='line'&&point.id.pointId===bar.pointId);
    tap(h,marker);
    assert.deepEqual(chart.state().selected,{seriesId:'line',pointId:bar.pointId});
    assert.equal(chart.dockedTooltipContext().$implicit.value,2);
  }
  h.set({tooltipContent:'shared'});
  h.act('step','first');
  assert.deepEqual(chart.dockedTooltipContext().shared.rows.map(row=>[row.seriesId,row.point.value]),[['column',9],['line',2]]);
});

test('heatmap scrubbing distinguishes cell padding, absent coordinates and unknown values', t=>{
  const tick=installFrameClock(t);
  const matrix={family:'heatmap',title:'Measured cells',axes:{x:category,y:category},gapRatio:.2,data:[
    {id:'known',rowId:'a',columnId:'a',value:0},
    {id:'unknown',rowId:'a',columnId:'c',value:null},
    {id:'other',rowId:'b',columnId:'d',value:7},
  ]};
  const h=harness(t,matrix,{inputs:{tooltipMode:'docked'}});
  h.measure(frame.width,frame.height);
  const {chart}=h;
  const layout=chart.ownedScene().heatmap.layout;
  const mid=band=>(band.from+band.to)/2;
  const at=(row,column)=>({
    x:chart.mapX(mid(layout.columns.find(band=>band.id===column))),
    y:chart.mapY(mid(layout.rows.find(band=>band.id===row))),
  });
  const gesture=chart.gesture();
  const pan=gesture.members.find(member=>member.type==='pan').handlers;
  const tap=gesture.members.find(member=>member.type==='tap').handlers;
  tap.onEnd(at('a','b'),true);
  assert.equal(chart.state().active,null);
  pan.onStart(at('a','a'));
  assert.equal(chart.state().active.value,0);
  const [firstColumn,nextColumn]=layout.columns;
  assert(firstColumn.to<nextColumn.from);
  pan.onUpdate({x:chart.mapX((firstColumn.to+nextColumn.from)/2),y:at('a','a').y});
  tick();
  assert.equal(chart.state().active.id.pointId,'known');
  pan.onUpdate(at('a','b'));
  tick();
  assert.equal(chart.state().active,null);
  pan.onUpdate(at('a','a'));
  tick();
  assert.equal(chart.state().active.value,0);
  pan.onUpdate(at('a','c'));
  tick();
  assert.equal(chart.state().active,null);
  pan.onEnd(at('b','d'),true);
  h.flush();
  assert.equal(chart.state().selected.pointId,'other');
  assert.equal(chart.dockedTooltipContext().$implicit.value,7);
});

test('a touch to an empty Venn region differs from dragging over the same gap', t=>{
  const tick=installFrameClock(t);
  const venn={family:'venn',title:'Counts',sets:[{id:'a',label:'A'},{id:'b',label:'B'}],
    data:[{id:'first',sets:['a'],value:12},{id:'second',sets:['b'],value:9},{id:'overlap',sets:['a','b'],value:2}]};
  const h=harness(t,venn,{inputs:{tooltipMode:'docked'}});
  h.measure(frame.width,frame.height);
  const {chart}=h;
  const overlap=chart.ownedScene().observations.find(point=>point.id.pointId==='overlap');
  const gesture=chart.gesture();
  const pan=gesture.members.find(member=>member.type==='pan').handlers;
  const tap=gesture.members.find(member=>member.type==='tap').handlers;
  const empty={x:chart.mapX(1),y:chart.mapY(1)};
  tap.onEnd(empty,true);
  assert.equal(chart.state().active,null);
  pan.onStart({x:chart.mapX(overlap.x),y:chart.mapY(overlap.y)});
  pan.onUpdate(empty);
  tick();
  assert.equal(chart.state().active.value,2);
  pan.onEnd(empty,true);
  h.flush();
  assert.equal(chart.state().selected.pointId,'overlap');
});

test('contour and timeline preserve the last hit during scrubbing away from painted geometry', t=>{
  const tick=installFrameClock(t);
  const numeric={x:{type:'linear',domain:[0,4]},y:{type:'linear',domain:[0,5]}};
  const contour={family:'contour',title:'Contours',axes:numeric,contour:{levels:[{id:'mark',value:1}]},
    grid:{id:'field',x:[0,4],y:[0,5],ids:['a','b','c','d'],values:[0,2,0,2]}};
  const h=harness(t,contour,{inputs:{tooltipMode:'docked',locale:'en'}});
  h.measure(frame.width,frame.height);
  const {chart}=h;
  const timeline={family:'timeline',title:'Recorded dates',axes:{x:{type:'time',domain:[0,1000]}},
    series:[{id:'s',name:'Dates',data:[{id:'first',x:100,title:'First'},{id:'last',x:900,title:'Last'}]}]};
  for(const scene of [plan(contour).scene,plan(timeline).scene]) {
    h.set({scene});
    const point=chart.ownedScene().observations[0];
    const gesture=chart.gesture();
    const pan=gesture.members.find(member=>member.type==='pan').handlers;
    const press=gesture.members.find(member=>member.type==='tap').handlers;
    const blank={x:chart.mapX(1),y:chart.mapY(1)};
    const target={x:chart.mapX(point.x),y:chart.mapY(point.y)};
    press.onEnd(blank,true);
    assert.equal(chart.state().active,null);
    pan.onStart(target);
    assert.equal(chart.state().active.id.pointId,point.id.pointId);
    pan.onUpdate(blank);
    tick();
    assert.equal(chart.state().active.id.pointId,point.id.pointId);
    pan.onEnd(blank,true);
    h.flush();
    assert.equal(chart.state().selected.pointId,point.id.pointId);
  }
});

test('compiled pictorial shapes accept hits inside a glyph and reject the surrounding plot', t=>{
  const pictorial={family:'pictorial',title:'Recorded amounts',axes,
    series:[{...base,data:[{id:'painted',x:'a',y:6},{id:'zero',x:'b',y:0}]}]};
  const h=harness(t,pictorial,{inputs:{tooltipMode:'docked'}});
  h.measure(frame.width,frame.height);
  const {chart}=h;
  const point=chart.ownedScene().observations.find(item=>item.id.pointId==='painted');
  const vertices=point.hit.polygons[0];
  const center={x:vertices.reduce((sum,v)=>sum+v.x,0)/vertices.length,y:vertices.reduce((sum,v)=>sum+v.y,0)/vertices.length};
  tap(h,center);
  assert.equal(chart.state().selected.pointId,'painted');
  assert.equal(chart.dockedTooltipContext().$implicit.value,6);
  tap(h,{x:1,y:1});
  assert.equal(chart.state().active,null);
  assert.equal(chart.dockedTooltipContext(),undefined);
});

test('zero-only radial data remains keyboard-navigable without painted-sector hits', t=>{
  const pie={family:'pie',title:'Recorded zeros',data:[
    {id:'a',label:'A',value:0},{id:'b',label:'B',value:0},
  ]};
  const h=harness(t,pie,{inputs:{locale:'en',tooltipMode:'docked'}});
  h.measure(frame.width,frame.height);
  assert.match(h.chart.touchHint(),/All values are zero. Use Previous and Next/);
  tap(h,{x:frame.width/2,y:frame.height/2});
  assert.equal(h.chart.state().active,null);
  h.act('step','last');
  assert.equal(h.chart.state().active.id.pointId,'b');
  assert.equal(h.chart.state().active.value,0);
  assert.equal(h.chart.activeSectorDrawing(),undefined);
  h.set({locale:'es'});
  assert.match(h.chart.touchHint(),/Todos los valores son cero. Usa Anterior y Siguiente/);
});

test('a scalar line wins its coincident mixed-range midpoint in either series order', t=>{
  const series=[
    {id:'band',name:'Source interval',type:'arearange',data:[
      {id:'band-a',x:'a',low:1,high:5},{id:'band-b',x:'b',low:4,high:8},
    ]},
    {...base,type:'line'},
  ];
  for(const current of [series,[...series].reverse()]) {
    const h=harness(t,{family:'mixed',title:'Measured points and intervals',axes,series:current},{inputs:{tooltipMode:'docked'}});
    h.measure(frame.width,frame.height);
    const real=h.chart.ownedScene().observations.find(point=>point.id.pointId==='point-0');
    tap(h,real);
    assert.equal(h.chart.state().selected.seriesId,'observed');
    assert.equal(h.chart.state().active.value,3);
    assert.equal(h.chart.state().active.lowValue,undefined);
  }
});

test('boxplot taps require actual glyph geometry while scrubbing follows the source category', t=>{
  const tick=installFrameClock(t);
  const box={family:'boxplot',title:'Observed distribution',axes:{x:category,y:{type:'linear',domain:[0,20]}},
    series:[
      {id:'primary',name:'Primary',data:[
        {id:'a1',x:'a',minimum:1,q1:4,median:7,q3:10,maximum:14},
        {id:'b1',x:'b',minimum:2,q1:5,median:6,q3:12,maximum:18},
      ]},
      {id:'secondary',name:'Secondary',data:[{id:'a2',x:'a',minimum:2,q1:3,median:5,q3:8,maximum:12}]},
    ]};
  const h=harness(t,box,{inputs:{locale:'en',tooltipMode:'docked'}});
  h.measure(frame.width,frame.height);
  const {chart}=h;
  const original=chart.ownedScene().observations.find(point=>point.id.pointId==='a1');
  const other=chart.ownedScene().observations.find(point=>point.id.pointId==='b1');
  const blank={x:chart.mapX(other.x),y:chart.mapY(1)};
  const gesture=chart.gesture();
  const pan=gesture.members.find(member=>member.type==='pan').handlers;
  const press=gesture.members.find(member=>member.type==='tap').handlers;
  press.onEnd(blank,true);
  assert.equal(chart.state().active,null);
  pan.onStart({x:chart.mapX(original.x),y:chart.mapY(original.y)});
  assert.equal(chart.state().active.id.pointId,'a1');
  pan.onUpdate(blank);
  tick();
  assert.equal(chart.state().active.id.pointId,'b1');
  pan.onEnd(blank,true);
  assert.equal(chart.state().selected.pointId,'b1');
  h.set({tooltipContent:'shared',tooltipMode:'floating'});
  h.act('step','first');
  assert(chart.dockTooltip());
  assert.deepEqual(chart.dockedTooltipContext().shared.rows.map(row=>row.point.medianValue),[7,5]);
});
