import {observationValue,observationUnit} from './observation-format.js';
import type {NativeChartLabelFormatters,NativeChartDataLabelContext} from './chart-presentation.js';
import type {NativeLabelLayout} from './data-options.js';
import type {NativeScene} from '../library/contracts.js';
import {supportsDataLabelLayout} from '../library/chart-capabilities.js';
import {sceneTransform} from '../library/scene.js';
import {containsPolygon} from '../library/polygon-hit.js';
import {labelInk,labelInkOnFill} from './label-contrast.js';
import {contourLabelAnchors} from '../library/contour-label-anchors.js';
import {labelAbovePoint,labelPoints} from '../library/point-label-placement.js';

export interface NativeValueLabel {readonly id:string;readonly text:string;readonly x:number;readonly y:number;readonly width:number;readonly height:number;readonly ink?:string;}
export const forcedLabelLimit=256;
/** Bounded display placement only. Values, stack totals and anchors come from Core. */
export function nativeValueLabels(scene:NativeScene,view:Readonly<{width:number;height:number}>,format:(value:number)=>string,settings:Readonly<{points:boolean;stacks:boolean;fontScale:number;left:number;visibleWidth:number;surfaceColor?:string;locale?:'en'|'es';layout?:NativeLabelLayout;markerSize?:number;pointFormatter?:NativeChartLabelFormatters['dataLabel']}>):readonly NativeValueLabel[]{
  const pointText=(point:NativeChartDataLabelContext['point'],value:number,text=format(value))=>settings.pointFormatter?.({point,value,text})??text;
  if(!supportsDataLabelLayout(scene.family)||scene.family==='pie'||scene.family==='donut')return [];
  const t=sceneTransform(scene,view),scale=Math.max(1,Number.isFinite(settings.fontScale)?settings.fontScale:1),height=Math.ceil(18*scale),left=Math.max(0,settings.left),right=Math.min(view.width,left+settings.visibleWidth),labels:NativeValueLabel[]=[];
  const force=settings.layout==='all'||settings.layout==='truncate';
  if(right<=left||view.height<=0||(!force&&(right-left<48||height>view.height/3)))return labels;
  const forceLabel=(id:string,text:string,x:number,y:number,ink?:string)=>{
    if(labels.length>=forcedLabelLimit||x<left||x>right||y<0||y>view.height)return;
    const width=Math.min(Math.ceil(text.length*9*scale+10),right-left,settings.layout==='truncate'?64*scale:Infinity);
    const boxHeight=Math.min(height,view.height);
    labels.push({id,text,x:Math.max(left,Math.min(right-width,x-width/2)),y:Math.max(0,Math.min(view.height-boxHeight,y-boxHeight/2)),width,height:boxHeight,...(ink?{ink}:{})});
  };
  if(scene.family==='windrose'||scene.family==='radialbar'||scene.family==='variablepie'){
    if(!settings.points||(!force&&scene.observations.length>64))return labels;
    const variablePie=scene.family==='variablepie';
    for(const p of scene.observations){
      if(force&&labels.length>=forcedLabelLimit)break;
      const h=p.hit;if(h?.type!=='sector')continue;
      const text=pointText(p,variablePie?(p.sizeValue??p.value):p.value);
      if(force){forceLabel(JSON.stringify(p.id),text,t.x+p.x*t.sx,t.y+p.y*t.sy,labelInk(p.color));continue;}
      const width=Math.ceil(variablePie?(text.length*7.5+4)*scale:text.length*7*scale+10);
      const halfSweep=Math.min(Math.PI/2,(h.end-h.start)/2);
      const sideClearance=Math.sin(halfSweep);
      let centerX=p.x,centerY=p.y;
      if(variablePie){
        if(sideClearance<=0)continue;
        const angle=(h.start+h.end)/2;
        const directionX=Math.sin(angle),directionY=-Math.cos(angle);
        const halfWidth=(width/2+1)/t.sx,halfHeight=(height/2+1)/t.sy;
        const edgeInset=(edge:number)=>Math.abs(Math.cos(edge))*halfWidth+Math.abs(Math.sin(edge))*halfHeight;
        // Keep the whole text rectangle between the radial edges and inside the arc.
        const minimum=Math.max(edgeInset(angle-halfSweep),edgeInset(angle+halfSweep))/sideClearance;
        const fitsArc=(distance:number)=>Math.hypot(Math.abs(directionX*distance)+halfWidth,Math.abs(directionY*distance)+halfHeight)<=h.radius;
        const preferred=Math.max(minimum,h.radius*.55);
        const distance=fitsArc(preferred)?preferred:minimum;
        if(!fitsArc(distance))continue;
        centerX=h.cx+directionX*distance;
        centerY=h.cy+directionY*distance;
      }else{
        const mid=(h.radius+h.innerRadius)/2;
        const room=Math.min((h.radius-h.innerRadius)/2,mid*sideClearance)*Math.min(t.sx,t.sy);
        if(Math.hypot(width/2,height/2)+3>room)continue;
      }
      const x=t.x+centerX*t.sx-width/2,y=t.y+centerY*t.sy-height/2;
      if(x<left||x+width>right||y<0||y+height>view.height)continue;
      labels.push({id:JSON.stringify(p.id),text,x,y,width,height,ink:labelInk(p.color)});
    }
    return labels;
  }
  if(scene.family==='heatmap'||scene.family==='venn'){
    if(!settings.points)return labels;
    const annotations=(scene.annotations??[]).filter(a=>a.role==='value'&&a.box);if(!annotations.length)return labels;
    const byAnchor=new Map(scene.observations.filter(p=>scene.family!=='venn'||p.venn?.geometry==='placed').map(p=>[p.x+','+p.y,p]));
    for(const annotation of annotations){
      if(force&&labels.length>=forcedLabelLimit)break;
      const p=byAnchor.get(annotation.x+','+annotation.y),box=annotation.box!;if(!p)continue;
      const text=pointText(p,p.value),width=Math.ceil(text.length*7*scale+10),x=t.x+annotation.x*t.sx-width/2,y=t.y+annotation.y*t.sy-height/2;
      const ink=scene.heatmap?labelInkOnFill(p.color,scene.heatmap.layout.opacity,settings.surfaceColor??'#FFFFFF'):undefined;
      if(force){forceLabel(JSON.stringify(p.id),text,x+width/2,y+height/2,ink);continue;}
      if(width>box.width*t.sx-8||height>box.height*t.sy-4||x<left||x+width>right||y<0||y+height>view.height)continue;
      labels.push({id:JSON.stringify(p.id),text,x,y,width,height,...(ink?{ink}:{})});
    }
    return labels;
  }
  if(scene.family==='funnel'||scene.family==='pyramid'){
    if(!settings.points)return labels;
    for(const p of scene.observations){
      if(force&&labels.length>=forcedLabelLimit)break;
      const h=p.hit;if(h?.type!=='polygon')continue;
      const text=pointText(p,p.value),width=Math.ceil(text.length*7*scale+10),x=t.x+p.x*t.sx-width/2,y=t.y+p.y*t.sy-height/2;
      if(force){forceLabel(JSON.stringify(p.id),text,x+width/2,y+height/2,labelInk(p.color));continue;}
      if(width>Math.min(120*scale,right-left-8)||x<left||x+width>right||y<0||y+height>view.height)continue;
      if(![[x,y],[x+width,y],[x,y+height],[x+width,y+height]].every(([px,py])=>containsPolygon(h,(px!-t.x)/t.sx,(py!-t.y)/t.sy)))continue;
      labels.push({id:JSON.stringify(p.id),text,x,y,width,height,ink:labelInk(p.color)});
    }
    return labels;
  }
  if(scene.family==='waterfall'){
    if(!settings.points||(!force&&scene.observations.length>64))return labels;
    const bars=scene.series.flatMap(series=>(series.bars??[]).map(bar=>({
      seriesId:series.id,pointId:bar.pointId,
      x:t.x+bar.x*t.sx,y:t.y+bar.y*t.sy,width:bar.width*t.sx,height:bar.height*t.sy,
    })));
    const fits=(box:Pick<NativeValueLabel,'x'|'y'|'width'|'height'>)=>
      box.x>=left+2&&box.x+box.width<=right-2&&box.y>=2&&box.y+box.height<=view.height-2&&
      !labels.some(label=>box.x<label.x+label.width+3&&box.x+box.width+3>label.x&&box.y<label.y+label.height+2&&box.y+box.height+2>label.y);
    for(const point of scene.observations){
      if(force&&labels.length>=forcedLabelLimit)break;
      const center=t.x+point.x*t.sx;
      if(center<left||center>right)continue;
      const bar=bars.find(item=>item.seriesId===point.id.seriesId&&
        (item.pointId===point.id.pointId||item.pointId===undefined&&Math.abs(item.x+item.width/2-center)<.01));
      if(!bar)continue;
      const text=pointText(point,point.value),width=Math.ceil((text.length*7.5+4)*scale);
      const x=center-width/2,bottom=bar.y+bar.height;
      // Follow the actual value edge, including reversed scales and negative totals.
      const atBottom=t.y+point.y*t.sy>bar.y+bar.height/2;
      const outside={x,y:atBottom?bottom+4:bar.y-height-4,width,height};
      const id=JSON.stringify(point.id);
      if(force){
        const halfHeight=Math.min(height,view.height)/2;
        const centerY=Math.max(halfHeight,Math.min(view.height-halfHeight,outside.y+height/2));
        forceLabel(id,text,center,centerY,centerY>=bar.y&&centerY<=bottom?labelInk(point.color):undefined);
        continue;
      }
      if(fits(outside)&&!bars.some(rect=>outside.x<rect.x+rect.width&&outside.x+width>rect.x&&outside.y<rect.y+rect.height&&outside.y+height>rect.y)){
        labels.push({id,text,...outside});
        continue;
      }
      // Top/bottom limits can use the bar itself if the full label fits.
      const inside={x,y:atBottom?bottom-height-2:bar.y+2,width,height};
      if(width+4<=bar.width&&height+4<=bar.height&&fits(inside))labels.push({id,text,...inside,ink:labelInk(point.color)});
    }
    return labels;
  }
  const points=force?[]:labelPoints(scene,t,settings.markerSize);
  const place=(id:string,text:string,x:number,y:number,negative=false)=>{
    if(force){
      if(y>=0&&y<=view.height)forceLabel(id,text,x,Math.max(0,y-height/2-4));
      return;
    }
    if(labels.length>=64||x<left||x>right||y<0||y>view.height)return;
    const width=Math.ceil(text.length*7*scale+10);if(width>Math.min(120*scale,right-left-8))return;
    const box=scene.family==='bar'?{x:negative?x-width-8:x+8,y:y-height/2,width,height}:labelAbovePoint(x,y,width,height,{left,right,height:view.height},points);
    if(!box)return;
    if(scene.family==='bar'&&(box.x<left+4||box.x+box.width>right-4||box.y<0||box.y+box.height>view.height))return;
    if(labels.some(label=>box.x<label.x+label.width+4&&box.x+box.width+4>label.x&&box.y<label.y+label.height+3&&box.y+box.height+3>label.y))return;
    labels.push({id,text,...box});
  };
  if(scene.family==='contour'){
    if(settings.points)for(const label of contourLabelAnchors(scene)){
      place('contour-'+label.id,format(label.value),t.x+label.x*t.sx,t.y+label.y*t.sy);
    }
    return labels;
  }
  if(settings.stacks)for(const [i,a]of (scene.annotations??[]).entries())if(a.stackTotal)place('stack-'+i,format(a.stackTotal.value)+(a.stackTotal.percentage?'%':''),t.x+a.x*t.sx,t.y+a.y*t.sy,a.stackTotal.sign==='negative');
  // Automatic mode keeps its smaller budget. Forced labels are bounded to the visible plot.
  if(settings.points&&(force||scene.observations.length<=64))for(const p of scene.observations){
    if(force&&labels.length>=forcedLabelLimit)break;
    if(p.fan?.type==='interval'||p.regression?.type==='fit')continue;
    place(JSON.stringify(p.id),pointText(p,p.sizeValue??(scene.family==='boxplot'?(p.medianValue??p.value):p.value),(p.sizeValue===undefined?(scene.family==='boxplot'?format(p.medianValue??p.value):observationValue(p,scene.family,format,settings.locale??'en')):format(p.sizeValue))+observationUnit(p,scene.family,'')),t.x+p.x*t.sx,t.y+p.y*t.sy,p.value<0);
  }
  return labels;
}
