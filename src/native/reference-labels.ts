import type {NativeScene} from '../library/contracts.js';
import {sceneTransform} from '../library/scene.js';

export interface NativeReferenceLabel {readonly id:string;readonly text:string;readonly x:number;readonly y:number;readonly width:number;readonly height:number;readonly color:string;readonly backgroundColor?:string;}
/** Display boxes only. Reference data values have already been projected by Core.
 * Overlapping/truncated labels remain complete in NativeScene metadata. */
export function nativeReferenceLabels(scene:NativeScene,viewport:Readonly<{width:number;height:number}>,fontScale=1,visibleWindow?:Readonly<{x:number;width:number}>,bandTextColor='#17212B',bandSurfaceColor='#FFFFFF'):readonly NativeReferenceLabel[]{
  const left=Math.max(0,visibleWindow?.x??0),right=Math.min(viewport.width,left+(visibleWindow?.width??viewport.width));
  const transform=sceneTransform(scene,viewport),width=Math.max(0,Math.min(160,right-left-16)),height=Math.ceil(18*Math.max(1,Number.isFinite(fontScale)?fontScale:1)),labels:NativeReferenceLabel[]=[];
  if(width<32||height>viewport.height-16)return labels;
  for(const reference of scene.references??[]){
    if(reference.status!=='visible'||!reference.label)continue;
    const line=reference.line,vertical=line.x1===line.x2,x=transform.x+line.x1*transform.sx,y=transform.y+line.y1*transform.sy;
    if(vertical&&(x<left||x>right))continue;
    const box={x:Math.max(left+8,Math.min(right-width-8,vertical?x+4:transform.x+Math.min(line.x1,line.x2)*transform.sx+4)),y:Math.max(8,Math.min(viewport.height-height-8,vertical?transform.y+Math.min(line.y1,line.y2)*transform.sy+4:y-height-4)),width,height};
    if(labels.some(label=>box.x<label.x+label.width+4&&box.x+box.width+4>label.x&&box.y<label.y+label.height+4&&box.y+box.height+4>label.y))continue;
    labels.push({id:JSON.stringify(['line',reference.id]),text:reference.label,...box,color:reference.color??'#8B6CCE'});
  }
  for(const band of scene.referenceBands??[]){
    if(band.status!=='visible'||!band.label)continue;
    const scale=Math.max(1,Number.isFinite(fontScale)?fontScale:1),cells=[...band.label].reduce((count,letter)=>count+((letter.codePointAt(0)??0)>0x2e7f?2:1),0),labelWidth=Math.ceil(cells*12*scale+12);
    const x=Math.max(left,transform.x+band.box.x*transform.sx),y=Math.max(0,transform.y+band.box.y*transform.sy),endX=Math.min(right,transform.x+(band.box.x+band.box.width)*transform.sx),endY=Math.min(viewport.height,transform.y+(band.box.y+band.box.height)*transform.sy);
    // Conservative native text envelope, clipped to the visible band itself.
    // Small bands keep the full label in metadata instead of forcing overlap.
    if(labelWidth+12>endX-x||height+8>endY-y)continue;
    const box={x:x+6,y:y+4,width:labelWidth,height};
    if(labels.some(label=>box.x<label.x+label.width+4&&box.x+box.width+4>label.x&&box.y<label.y+label.height+4&&box.y+box.height+4>label.y))continue;
    labels.push({id:JSON.stringify(['band',band.id]),text:band.label,...box,color:bandTextColor,backgroundColor:bandSurfaceColor});
  }
  return labels;
}
