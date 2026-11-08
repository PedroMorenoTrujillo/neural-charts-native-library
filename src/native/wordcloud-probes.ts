import {Component,DestroyRef,effect,inject,input,output} from '@angular/core';
import {Text,View,type LayoutEvent,type TextLayoutEvent} from '@ng-native/components';
import type {WordCloudProbe} from './wordcloud-measurements.js';
import {WORDCLOUD_TEXT_BACKEND,type WordCloudTextJob} from './wordcloud-text-backend.js';
let nextProbeOwner=0;

export interface WordCloudLayoutMeasurement {
  readonly token:string;
  readonly width:number;
  readonly height:number;
}
export interface WordCloudTextMeasurement {
  readonly token:string;
  readonly complete:boolean;
  readonly lineCount:number;
  readonly width:number;
  readonly height:number;
}

/** Intrinsic native text probes; the queue owns the eight-node maximum. */
@Component({
  selector:'nc-wordcloud-text-probes',
  imports:[Text,View],
  styles:':host{position:absolute;left:0;top:0;width:1px;height:1px;overflow:hidden;}',
  template:`<view [style]="hostStyle" pointerEvents="none" [accessible]="false" [accessibilityElementsHidden]="true" importantForAccessibility="no-hide-descendants">
    @for(probe of probes();track probe.token){
      <text [testID]="testID(probe.token)" [accessible]="false" [allowFontScaling]="true"
        [style]="{position:'absolute',alignSelf:'flex-start',flexShrink:0,fontSize:probe.request.fontSize,fontWeight:'400',fontStyle:'normal'}"
        (layout)="onLayout(probe,$event)" (textLayout)="onTextLayout(probe,$event)">{{probe.request.text}}</text>
    }
  </view>`,
})
export class WordCloudTextProbes {
  readonly probes=input.required<readonly WordCloudProbe[]>();
  readonly measuredLayout=output<WordCloudLayoutMeasurement>();
  readonly measuredText=output<WordCloudTextMeasurement>();
  readonly measuredBounds=output<WordCloudLayoutMeasurement>();
  readonly measurementFailed=output<Readonly<{token:string}>>();
  private readonly backend=inject(WORDCLOUD_TEXT_BACKEND);
  private readonly owner='wordcloud-font-'+(++nextProbeOwner)+'-';
  private readonly deadlines=new Map<string,ReturnType<typeof setTimeout>>();
  private readonly jobs=new Map<string,WordCloudTextJob>();
  private readonly finished=new Set<string>();
  private destroyed=false;
  protected readonly hostStyle={position:'relative',width:1,height:1,flexDirection:'row',overflow:'hidden',opacity:0} as const;

  constructor(){
    effect(()=>{const current=new Set(this.probes().map(probe=>probe.token));for(const [token,job]of this.jobs)if(!current.has(token)){job.cancel();this.jobs.delete(token);}for(const [token,timer]of this.deadlines)if(!current.has(token)){clearTimeout(timer);this.deadlines.delete(token);}for(const token of this.finished)if(!current.has(token))this.finished.delete(token);for(const token of current)if(!this.finished.has(token)&&!this.deadlines.has(token))this.deadlines.set(token,setTimeout(()=>this.fail(token),8000));});
    inject(DestroyRef).onDestroy(()=>{this.destroyed=true;for(const job of this.jobs.values())job.cancel();for(const timer of this.deadlines.values())clearTimeout(timer);this.deadlines.clear();this.jobs.clear();this.finished.clear();});
  }
  protected testID(token:string):string{return this.owner+token;}
  private finish(token:string):void{const timer=this.deadlines.get(token);if(timer)clearTimeout(timer);this.deadlines.delete(token);this.finished.add(token);}
  private fail(token:string):void{if(this.destroyed||this.finished.has(token))return;this.jobs.get(token)?.cancel();this.jobs.delete(token);this.finish(token);this.measurementFailed.emit({token});}

  protected onLayout(probe:WordCloudProbe,event:LayoutEvent):void{
    const bounds=event?.nativeEvent?.layout;
    if(!bounds||!Number.isFinite(bounds.width)||!Number.isFinite(bounds.height))return;
    this.measuredLayout.emit({token:probe.token,width:bounds.width,height:bounds.height});
    if(this.destroyed||this.finished.has(probe.token)||this.jobs.has(probe.token))return;
    if(/[\r\n\u000b\u000c\u0085\u2028\u2029]/u.test(probe.request.text)){this.fail(probe.token);return;}
    if(!this.backend){this.finish(probe.token);this.measuredBounds.emit({token:probe.token,width:bounds.width,height:bounds.height});return;}
    let job:WordCloudTextJob;try{job=this.backend.measure(this.testID(probe.token),probe.request);}catch{this.fail(probe.token);return;}this.jobs.set(probe.token,job);
    void job.result.then(value=>{
      if(this.destroyed||this.jobs.get(probe.token)!==job)return;
      this.jobs.delete(probe.token);this.finish(probe.token);this.measuredBounds.emit({token:probe.token,...value});
    }).catch(()=>{if(this.destroyed||this.jobs.get(probe.token)!==job)return;this.fail(probe.token);});
  }
  protected onTextLayout(probe:WordCloudProbe,event:TextLayoutEvent):void{
    const lines=event?.nativeEvent?.lines;if(!Array.isArray(lines)||lines.length>512)return;
    let width=0,height=0,text='';
    for(const line of lines){
      if(!line||typeof line.text!=='string'||![line.x,line.y,line.width,line.height].every(Number.isFinite))return;
      width=Math.max(width,line.x+line.width);height=Math.max(height,line.y+line.height);text+=line.text;
    }
    this.measuredText.emit({token:probe.token,complete:text===probe.request.text,lineCount:lines.length,width,height});
  }
}
