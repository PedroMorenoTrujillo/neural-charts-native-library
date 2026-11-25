import {registerHooks} from 'node:module';
import '@angular/compiler';
import * as angular from '@angular/core';
import {Accessibility, ColorScheme} from '@ng-native/device';
import {CHART_ACTIVITY_ENVIRONMENT} from '../dist/native/activity.js';
import {HAPTIC_ENVIRONMENT} from '../dist/native/haptics.js';
import {CHART_INPUT_BRIDGE} from '../dist/native/input-bridge.js';

// The installed Native lab exercises the platform renderer. Node only drives
// Angular state and event handlers, so a request to execute a worklet is an error.
const noPlatformMotion = 'const unavailable=()=>{throw Error("Native animation used in the Node chart harness")};';
const gestureModule = `
  function builder(type) {
    const state = {type, handlers:{}};
    for (const name of ['enabled','minDistance','maxDistance','maxPointers','runOnJS','shouldActivateOnStart','disallowInterruption']) {
      state[name] = value => {state[name+'Value']=value;return state;};
    }
    for (const event of ['onStart','onUpdate','onEnd','onFinalize']) {
      state[event] = handler => {state.handlers[event]=handler;return state;};
    }
    return state;
  }
  export const Gesture = {
    Pan:()=>builder('pan'), Tap:()=>builder('tap'), Native:()=>builder('native'),
    Race:(...members)=>({type:'race',members}),
    Simultaneous:(...members)=>({type:'simultaneous',members}),
  };
`;
const platformModules = new Map(Object.entries({
  '@ng-native/components/gestures':'export class NativeGesture {}',
  '@ng-native/components/animations':'export class AnimatedStyle {}',
  '@ng-native/components/reanimated':noPlatformMotion+'export class WorkletStyle {};export {unavailable as sharedValue,unavailable as workletStyle};',
  'react-native-reanimated':noPlatformMotion+'export {unavailable as withTiming,unavailable as cancelAnimation};export const Easing={};',
  'react-native-gesture-handler':gestureModule,
  'react-native-worklets':noPlatformMotion+'export {unavailable as scheduleOnRN};',
}));
const nativeDist = new URL('../dist/native/', import.meta.url).href;
const hook = registerHooks({
  resolve(specifier, context, next) {
    const source = context.parentURL?.startsWith(nativeDist) ? platformModules.get(specifier) : undefined;
    return source ? {url:'data:text/javascript,'+encodeURIComponent(source),shortCircuit:true} : next(specifier,context);
  },
});
let NativeChart, CHART_MOTION_FACTORY, CHART_TOOLTIP_MOTION_FACTORY, CHART_VIEWPORT_MOTION_FACTORY;
try {
  ({NativeChart}=await import('../dist/native/chart.js'));
  ({CHART_MOTION_FACTORY}=await import('../dist/native/chart-motion.js'));
  ({CHART_TOOLTIP_MOTION_FACTORY}=await import('../dist/native/tooltip-motion.js'));
  ({CHART_VIEWPORT_MOTION_FACTORY}=await import('../dist/native/viewport-motion.js'));
} finally {
  hook.deregister();
}

function writeInput(input,value) {
  const node=input[angular.ɵSIGNAL];
  node.applyValueToInputSignal(node,value);
}

export function createNativeSceneChartHarness(scene, inputs={}, {inputBridge}={}) {
  const scale=angular.signal(1), screenReader=angular.signal(false), reduceMotion=angular.signal(false), scheme=angular.signal('light');
  const callbacks=new Set(), calls={motion:[],tooltip:[],viewport:[],haptics:[]};
  let appStatus='active', tooltipPosition=null;
  const motion={
    pending:false,
    start:duration=>calls.motion.push(['start',duration]),
    update:duration=>calls.motion.push(['update',duration]),
    stop:()=>calls.motion.push(['stop']),
    finish:()=>calls.motion.push(['finish']),
    styles:()=>({}),
  };
  const tooltipMotion={
    styles:{},
    move(x,y,duration) {tooltipPosition={x,y};calls.tooltip.push(['move',x,y,duration]);},
    position:()=>tooltipPosition,
    hide() {tooltipPosition=null;calls.tooltip.push(['hide']);},
    destroy() {tooltipPosition=null;calls.tooltip.push(['destroy']);},
  };
  const viewportMotion={
    styles:{},
    gesture:(configuration,handlers)=>({configuration,handlers}),
    preview:(frame,configuration)=>calls.viewport.push(['preview',frame,configuration]),
    show:()=>calls.viewport.push(['show']),
    finish:()=>calls.viewport.push(['finish']),
    destroy:()=>calls.viewport.push(['destroy']),
  };
  const injector=angular.createEnvironmentInjector([
    {provide:angular.ɵINJECTOR_SCOPE,useValue:'root'},
    angular.provideZonelessChangeDetection(),
    {provide:ColorScheme,useValue:{current:scheme}},
    {provide:Accessibility,useValue:{fontScale:scale,screenReader,reduceMotion}},
    {provide:CHART_ACTIVITY_ENVIRONMENT,useValue:{
      current:()=>appStatus,
      subscribe(callback) {callbacks.add(callback);return ()=>callbacks.delete(callback);},
    }},
    {provide:HAPTIC_ENVIRONMENT,useValue:{
      supported:()=>true,active:()=>appStatus==='active',lowPower:()=>false,
      selection:()=>calls.haptics.push('selection'),destroy:()=>calls.haptics.push('destroy'),
    }},
    {provide:CHART_MOTION_FACTORY,useValue:()=>motion},
    {provide:CHART_TOOLTIP_MOTION_FACTORY,useValue:()=>tooltipMotion},
    {provide:CHART_VIEWPORT_MOTION_FACTORY,useValue:()=>viewportMotion},
    ...(inputBridge?[{provide:CHART_INPUT_BRIDGE,useValue:inputBridge}]:[]),
  ],angular.Injector.NULL);
  const destroy=()=>{if(!injector.destroyed)injector.destroy();};
  try {
    const chart=angular.runInInjectionContext(injector,()=>new NativeChart());
    const flush=()=>injector.get(angular.ɵEffectScheduler).flush();
    const host=angular.signal(undefined);
    // The host supplies only an element identity and input callbacks. Angular
    // has no rendered view in the harness to resolve this query.
    if(inputBridge)chart.plot=host;
    const setHost=nativeElement=>{host.set(nativeElement?{nativeElement}:undefined);flush();};
    const set = (values,{flushEffects=true}={}) => {
      for (const [name,value] of Object.entries(values)) writeInput(chart[name],value);
      if(flushEffects)flush();
    };
    const events={interaction:[],layout:[],legend:[],viewport:[]};
    chart.interactionChange.subscribe(value=>events.interaction.push(value));
    chart.viewportChange.subscribe(value=>events.layout.push(value));
    chart.legendChange.subscribe(value=>events.legend.push(value));
    chart.viewportRequest.subscribe(value=>events.viewport.push(value));
    const measure=(width,height)=>{
      chart.measure({nativeEvent:{layout:{width,height}}});
      flush();
    };
    const act=(name,...args)=>{
      const result=chart[name](...args);
      flush();
      return result;
    };
    const setAppStatus=status=>{
      appStatus=status;
      for(const callback of callbacks) callback(status);
      flush();
    };
    set({scene,animationEnabled:false,...inputs});
    return {chart,events,flush,set,measure,act,setAppStatus,setHost,scheme,scale,screenReader,reduceMotion,motion,calls,destroy};
  } catch (error) {
    destroy();
    throw error;
  }
}
