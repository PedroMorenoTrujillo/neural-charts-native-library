import type {NativeScene} from '../library/contracts.js';
export interface WeightedAxisLabel {readonly id:string;readonly label:string;readonly left:number;readonly width:number;}
/** Text fits the projected quantitative band. Narrow or zero-width categories
 * keep their full source name in selection and the alternative source table. */
export function variwideAxisLabels(scene:NativeScene,transform:Readonly<{x:number;sx:number}>,allowOverlap=false):readonly WeightedAxisLabel[]{
  if(scene.family!=='variwide')return [];
  const result:WeightedAxisLabel[]=[];let labelIndex=0;
  for(const band of scene.categoryBands??[]){
    if(band.left===null||band.right===null)continue;
    const label=scene.labels[labelIndex++];if(!label||band.status!=='visible')continue;
    const available=Math.min(80,(band.right-band.left)*transform.sx-8);
    if(available<24&&!allowOverlap)continue;
    const width=Math.max(24,available);
    result.push({id:band.categoryId,label:label.label,left:transform.x+label.x*transform.sx-width/2,width});
  }
  return result;
}
