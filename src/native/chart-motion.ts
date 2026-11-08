import {InjectionToken} from '@angular/core';
import {sharedValue,workletStyle,type WorkletStyleSpec} from '@ng-native/components/reanimated';
import {withTiming,cancelAnimation,Easing} from 'react-native-reanimated';
import type {NativeScene} from '../library/contracts.js';
import {sceneTransform} from '../library/scene.js';
import {radialEntrance} from './radial-entrance.js';
import {hasBubbleEntrance} from './bubble-entrance.js';
import type {RadialNativeStyles,RadialBrowserStyles} from './radial-layer.js';

export type MotionStyles=Readonly<{native?:Readonly<{clip:WorkletStyleSpec;geometry:WorkletStyleSpec;labels:WorkletStyleSpec;previous?:WorkletStyleSpec;entranceVisibility?:WorkletStyleSpec;bubble?:WorkletStyleSpec;radial?:RadialNativeStyles}>;browser?:Readonly<{clip:Record<string,unknown>;geometry:Record<string,unknown>;labels:Record<string,unknown>;previous?:Record<string,unknown>;entranceVisibility?:Record<string,unknown>;bubble?:Record<string,unknown>;radial?:RadialBrowserStyles}>}>;
export interface ChartMotion {readonly pending?:boolean;start(duration:number):void;update?(duration:number):void;stop():void;finish():void;styles(scene:NativeScene,viewport:Readonly<{width:number;height:number}>):MotionStyles;}
export const CHART_MOTION_FACTORY=new InjectionToken<()=>ChartMotion>('CHART_MOTION_FACTORY',{providedIn:'root',factory:()=>()=>new NativeChartMotion()});

/** Presentation transforms only: the shared Core still owns all data geometry. */
export function motionParameters(scene:NativeScene,viewport:Readonly<{width:number;height:number}>){
  const radial=radialEntrance(scene,viewport);
  const needle=scene.circular?.style==='needle-gauge'&&scene.circular.needle.to!==null?scene.circular:undefined;
  const needleAngle=needle?(needle.needle.from-needle.needle.to!)*180/Math.PI:0;
  const bubbles=hasBubbleEntrance(scene);
  const radialGrowthFamily=scene.parallel?.coordinates==='polar'||scene.family==='polar'||scene.family==='radar'||scene.family==='windrose'||scene.family==='radialbar';
  const sectorGrowthFamily=['variablepie','sunburst','dependencywheel','chord'].includes(scene.family);
  let radialGrowth:Readonly<{cx:number;cy:number}>|undefined=radialGrowthFamily?scene.polarGrid:undefined;
  if(sectorGrowthFamily){
    let common:Readonly<{cx:number;cy:number}>|undefined,concentric=true;
    for(const point of scene.observations){const hit=point.hit;if(hit?.type!=='sector')continue;
      if(!common)common=hit;else if(hit.cx!==common.cx||hit.cy!==common.cy){concentric=false;break;}}
    if(concentric)radialGrowth=common;
  }
  let revealBase=0,revealTop=Infinity;
  if(scene.family==='pictorial'&&scene.pictorial){
    const t=sceneTransform(scene,viewport);
    for(const glyph of scene.pictorial.glyphs)revealBase=Math.max(revealBase,t.y+(glyph.bounds.y+glyph.bounds.height)*t.sy);
    for(const point of scene.observations)if(point.hit?.type==='compoundPolygon')for(const polygon of point.hit.polygons)for(const vertex of polygon)revealTop=Math.min(revealTop,t.y+vertex.y*t.sy);
  }
  const pictorialInk=Number.isFinite(revealTop)&&revealTop<revealBase;
  if(!pictorialInk)revealTop=0;
  const verticalReveal=['funnel','pyramid','treemap','organization'].includes(scene.family);
  const delayedLabels=['dendrogram','heatmap','venn','boxplot','errorbar','waterfall','lollipop','dumbbell','columnpyramid','columnrange','pareto','arcdiagram','treegraph'].includes(scene.family);
  const type=needle?10:scene.family==='dendrogram'?(scene.dendrogram?.orientation==='vertical'?8:0):scene.parallel?.coordinates==='polar'?7:['fan','regression','flame','violin','parallel','contour','xrange','line','area','streamgraph','areaspline','arearange','areasplinerange','bellcurve','spline','mixed','boxplot','errorbar','waterfall','lollipop','dumbbell','columnpyramid','columnrange','pareto','arcdiagram','treegraph'].includes(scene.family)?0:(scene.family==='variwide'||scene.family==='bullet'&&scene.bulletOrientation==='vertical'||scene.family==='column'||scene.family==='histogram')?1:(scene.family==='bar'||scene.family==='bullet')?2:radial?4:bubbles?6:pictorialInk?9:verticalReveal?8:radialGrowthFamily||sectorGrowthFamily?(radialGrowth?7:5):5;
  let offset=0;
  if(type===1||type===2){
    const t=sceneTransform(scene,viewport),horizontal=type===2;
    const series=scene.series.find(s=>s.bars?.some(b=>b.width>0&&b.height>0));
    const index=series?.bars?.findIndex(b=>b.width>0&&b.height>0)??-1,bar=series?.bars?.[index];
    // Observation order is semantic navigation order, not a geometry association.
    const epsilon=Math.max(scene.width,scene.height,1)*1e-8;
    const edge=bar?(horizontal?bar.x:bar.y):0,length=bar?(horizontal?bar.width:bar.height):0;
    const center=bar?(horizontal?bar.y+bar.height/2:bar.x+bar.width/2):0;
    const point=bar?scene.observations.find(p=>p.id.seriesId===series?.id&&Math.abs((horizontal?p.y:p.x)-center)<=epsilon&&Math.min(Math.abs((horizontal?p.x:p.y)-edge),Math.abs((horizontal?p.x:p.y)-edge-length))<=epsilon):undefined;
    const endpoint=point?(horizontal?point.x:point.y):undefined;
    const baseline=bar?(endpoint===undefined?(horizontal?edge:edge+length):Math.abs(endpoint-edge)<=Math.abs(endpoint-edge-length)?edge+length:edge):0;
    offset=horizontal?t.x+baseline*t.sx-viewport.width/2:t.y+baseline*t.sy-viewport.height/2;
  }
  // Keep the Core-projected centre fixed while the radii grow. The native View
  // transforms around its own midpoint, which need not coincide with that centre.
  const pivot=needle??radialGrowth;
  const growthTransform=pivot?sceneTransform(scene,viewport):undefined;
  const pivotX=growthTransform&&pivot?growthTransform.x+pivot.cx*growthTransform.sx-viewport.width/2:0;
  const pivotY=growthTransform&&pivot?growthTransform.y+pivot.cy*growthTransform.sy-viewport.height/2:0;
  return {type,offset,width:viewport.width,height:viewport.height,radial,pivotX,pivotY,needleAngle,delayedLabels,revealBase,revealTop};
}

/** One progress value drives presentation bindings; no per-frame Angular/SVG work. */
export class NativeChartMotion implements ChartMotion {
  readonly progress:ReturnType<typeof sharedValue<number>>=sharedValue(0);
  private frame:number|null=null;
  get pending():boolean{return this.frame!==null;}
  start(duration:number):void {this.animate(0,1,duration);}
  update(duration:number):void {this.animate(2,3,duration);}
  private animate(from:number,to:number,duration:number):void {
    if(Number.isFinite(duration)&&duration<=0){this.finish();return;}
    this.stop();this.progress.set(from);
    this.frame=requestAnimationFrame(()=>{this.frame=requestAnimationFrame(()=>{this.frame=null;this.progress.set(withTiming(to,{duration:Math.max(0,Math.min(2000,Number.isFinite(duration)?duration:1100)),easing:Easing.bezier(.45,0,.2,1)}));});});
  }
  stop():void {if(this.frame!==null){cancelAnimationFrame(this.frame);this.frame=null;}cancelAnimation(this.progress);}
  finish():void {this.stop();this.progress.set(1);}
  styles(scene:NativeScene,viewport:Readonly<{width:number;height:number}>):MotionStyles {
    const {type,offset,width,height,radial,pivotX,pivotY,needleAngle,delayedLabels,revealBase,revealTop}=motionParameters(scene,viewport);
    const sweep=radial?.sweepRadians??0,start=radial?.startRadians??0;
    return {native:{
      clip:workletStyle([this.progress],p=>{'worklet';const alpha=p.value>=2?Math.max(0,Math.min(1,p.value-2)):1;return {opacity:(type===4||type===6?(p.value>=1?1:0):1)*alpha,transform:type===9?[{translateY:p.value<1?revealBase+(revealTop-revealBase)*Math.max(0,p.value):0}]:type===8?[{translateY:p.value<1?-height*(1-p.value):0}]:[{translateX:type===0&&p.value<1?-width*(1-p.value):0}]};}),
      labels:workletStyle([this.progress],p=>{'worklet';const alpha=p.value>=2?Math.max(0,Math.min(1,p.value-2)):1;return {opacity:(type===7||type===8||type===9||delayedLabels?Math.max(0,Math.min(1,(p.value-.82)/.18)):type===6||type===4&&sweep>0?Math.max(0,Math.min(1,(p.value-.95)/.05)):type===5?Math.max(0,Math.min(1,p.value)):1)*alpha};}),
      previous:workletStyle([this.progress],p=>{'worklet';return {opacity:p.value>=2?Math.max(0,Math.min(1,3-p.value)):0};}),
      geometry:workletStyle([this.progress],p=>{
        'worklet';const v=Math.min(1,p.value);
        if(type===10)return {opacity:1,transform:[{translateX:pivotX},{translateY:pivotY},{rotate:(needleAngle*(1-v))+'deg'},{translateX:-pivotX},{translateY:-pivotY}]};
        if(type===0)return {opacity:1,transform:[{translateX:width*(1-v)}]};
        if(type===1)return {opacity:1,transform:[{translateY:offset*(1-v)},{scaleY:v}]};
        if(type===2)return {opacity:1,transform:[{translateX:offset*(1-v)},{scaleX:v}]};
        if(type===4)return {opacity:1,transform:[]};
        if(type===5)return {opacity:v,transform:[]};
        if(type===6)return {opacity:1,transform:[]};
        if(type===7)return {opacity:1,transform:[{translateX:pivotX*(1-v)},{translateY:pivotY*(1-v)},{scale:v}]};
        if(type===8)return {opacity:1,transform:[{translateY:height*(1-v)}]};
        if(type===9)return {opacity:1,transform:[{translateY:p.value<1?-(revealBase+(revealTop-revealBase)*v):0}]};
        return {opacity:v,transform:[]};
      }),
      ...(radial||type===6?{entranceVisibility:workletStyle([this.progress],p=>{'worklet';return {opacity:p.value>=1?0:Math.max(0,Math.min(1,p.value*50))};})}:{}),
      ...(type===6?{bubble:workletStyle([this.progress],p=>{'worklet';return {transform:[{scale:Math.max(0,Math.min(1,p.value))}]};})}:{}),
      ...(radial?{radial:{
        first:workletStyle([this.progress],p=>{'worklet';return {transform:[{rotate:(Math.min(Math.PI,Math.max(0,sweep*p.value))*180/Math.PI)+'deg'}]};}),
        firstCounter:workletStyle([this.progress],p=>{'worklet';return {transform:[{rotate:(-(start+Math.min(Math.PI,Math.max(0,sweep*p.value)))*180/Math.PI)+'deg'}]};}),
        second:workletStyle([this.progress],p=>{'worklet';return {transform:[{rotate:(Math.min(Math.PI,Math.max(0,sweep*p.value-Math.PI))*180/Math.PI)+'deg'}]};}),
        secondCounter:workletStyle([this.progress],p=>{'worklet';return {transform:[{rotate:(-(start+Math.min(Math.PI,Math.max(0,sweep*p.value-Math.PI)))*180/Math.PI)+'deg'}]};}),
      }}:{}),
    }};
  }
}
