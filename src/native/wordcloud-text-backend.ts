import {InjectionToken} from '@angular/core';
import type {PlanWordCloudMeasurementRequest} from '@neural-charts/core/plan';

export interface WordCloudTextBounds {readonly width:number;readonly height:number;}
export interface WordCloudTextJob {readonly result:Promise<WordCloudTextBounds>;cancel():void;}
/** Optional host-specific measurement; the native default uses intrinsic layout. */
export interface WordCloudTextBackend {
  measure(testID:string,request:PlanWordCloudMeasurementRequest):WordCloudTextJob;
}
export const WORDCLOUD_TEXT_BACKEND=new InjectionToken<WordCloudTextBackend|null>('NEURAL_WORDCLOUD_TEXT_BACKEND',{factory:()=>null});
