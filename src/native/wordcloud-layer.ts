import {Component,Directive,ElementRef,Renderer2,computed,effect,inject,input} from '@angular/core';
import {Text,View} from '@ng-native/components';
import type {NativeScene} from '../library/contracts.js';
import {sceneTransform} from '../library/scene.js';
import {textColorOnSurface} from './label-contrast.js';

type WordTransform=readonly [Readonly<{rotate:string}>,Readonly<{scale:number}>];
/** Native transforms are property values, not CSS style strings. */
@Directive({selector:'[ncWordTransform]'})
class WordTransformBinding {
  readonly ncWordTransform=input.required<WordTransform>();
  private readonly pose=computed(()=>this.ncWordTransform(),{equal:(a,b)=>a[0].rotate===b[0].rotate&&a[1].scale===b[1].scale});
  constructor(){
    const renderer=inject(Renderer2),element=inject<ElementRef<unknown>>(ElementRef);
    // Use the renderer's style channel: Fabric retains the native array and
    // the official web host serializes it. Angular's CSS bindings must not.
    effect(()=>renderer.setStyle(element.nativeElement,'transform',this.pose()));
  }
}

/** Native text at its measured size. Only the containing pose is transformed. */
@Component({
  selector:'nc-wordcloud-layer',imports:[Text,View,WordTransformBinding],
  styles:':host{position:absolute;left:0;top:0;width:100%;height:100%;pointer-events:none;} .word{position:absolute;flex-shrink:0;overflow:visible;}',
  template:`@for(word of glyphs();track word.id){<view class="word" pointerEvents="none" [accessible]="false"
    [testID]="'wordcloud-glyph-'+word.id" [style]="{left:word.left,top:word.top,width:word.width,height:word.height}" [ncWordTransform]="word.transform">
    <text class="glyph" [accessible]="false" [allowFontScaling]="true" [style]="{width:word.width,height:word.height,flexShrink:0,fontSize:word.fontSize,fontWeight:'400',fontStyle:'normal',color:word.color}">{{word.text}}</text>
  </view>}`,
})
export class WordCloudLayer {
  readonly scene=input.required<NativeScene>();
  readonly viewport=input<Readonly<{width:number;height:number}>>();
  readonly surface=input('#FFFFFF');
  protected readonly glyphs=computed(()=>{
    const scene=this.scene(),t=sceneTransform(scene,this.viewport()),surface=this.surface();
    return scene.series.flatMap(series=>{
      const color=textColorOnSurface(series.color,surface);
      return (series.textGlyphs??[]).map(g=>({
        id:series.id+'-'+g.pointId,text:g.text,fontSize:g.fontSize,color,
        width:g.measured.width,height:g.measured.height,
        left:t.x+g.center.x*t.sx-g.measured.width/2,top:t.y+g.center.y*t.sy-g.measured.height/2,
        transform:[{rotate:g.rotation+'deg'},{scale:Math.min(t.sx,t.sy)}] as const,
      }));
    });
  });
}
