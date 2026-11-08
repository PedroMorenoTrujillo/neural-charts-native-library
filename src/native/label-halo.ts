import {Directive,ElementRef,Renderer2,effect,inject,input} from '@angular/core';
import {labelInk} from './label-contrast.js';

/** Native text paint only: no backdrop view, duplicate glyphs or layout work. */
@Directive({selector:'[ncLabelHalo]'})
export class LabelHalo {
  readonly ncLabelHalo=input.required<string>();
  constructor(){
    const renderer=inject(Renderer2),element=inject<ElementRef<unknown>>(ElementRef);
    effect(()=>{
      renderer.setStyle(element.nativeElement,'textShadowColor',labelInk(this.ncLabelHalo()));
      renderer.setStyle(element.nativeElement,'textShadowOffset',{width:0,height:0});
      renderer.setStyle(element.nativeElement,'textShadowRadius',1.25);
    });
  }
}
