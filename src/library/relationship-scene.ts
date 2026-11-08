import type {NativeScene,Observation,NativeAnnotation} from './contracts.js';
import type {PlanRelationshipMetadata} from '@neural-charts/core/plan';

export const relationshipFamily=(family:string):family is 'dependencywheel'|'arcdiagram'|'chord'=>family==='dependencywheel'||family==='arcdiagram'||family==='chord';
const text=(value:unknown,max:number):value is string=>typeof value==='string'&&value.length>0&&value.length<=max;
/** Own the public Core metadata without recomputing totals or projecting geometry. */
export function ownRelationshipPoint(point:Observation,family:NativeScene['family']):Readonly<{relationship?:PlanRelationshipMetadata}>{
  const value=point.relationship;
  if(!relationshipFamily(family)){if(value!==undefined)throw Error('Unexpected relationship metadata');return {};}
  if(!value||point.value<0||value.geometryOmitted!==undefined&&value.geometryOmitted!==true||value.geometryOmitted&&point.hit!==undefined)throw Error('Invalid relationship metadata');
  const omitted=value.geometryOmitted?{geometryOmitted:true as const}:{};
  if(value.type==='node'){
    if(!text(point.label,256)||![value.incoming,value.outgoing,value.incident].every(n=>Number.isFinite(n)&&n>=0)||point.value!==value.incident)throw Error('Invalid relationship totals');
    return {relationship:{type:'node',incoming:value.incoming,outgoing:value.outgoing,incident:value.incident,...omitted}};
  }
  if(value.type!=='link'||!text(value.from,128)||!text(value.to,128)||value.from===value.to||!text(value.fromLabel,256)||!text(value.toLabel,256)||value.directed!==(family==='dependencywheel')||point.incomplete!==undefined||point.value===0&&!value.geometryOmitted)throw Error('Invalid relationship endpoints');
  return {relationship:{type:'link',from:value.from,to:value.to,fromLabel:value.fromLabel,toLabel:value.toLabel,directed:value.directed,...omitted}};
}
export function validateRelationshipScene(scene:NativeScene):void{
  if(!relationshipFamily(scene.family))return;
  let nodes=0,links=0;
  for(const point of scene.observations){if(point.relationship?.type==='node')nodes++;else if(point.relationship?.type==='link')links++;else throw Error('Missing relationship metadata');}
  if(nodes>64||links>256||scene.observations.length>320||(scene.annotations?.length??0)>64||scene.grid.length||scene.labels.length||scene.yLabels?.length||scene.references?.length)throw Error('Invalid relationship frame budget or unsupported axes');
}

/** Text boxes are presentation constraints, not source values or projected arcs.
 * Core supplies a requested width; the native label must fit around its anchor. */
export function relationshipAnnotations(scene:NativeScene):readonly NativeAnnotation[]{
  if(!relationshipFamily(scene.family))return scene.annotations??[];
  const allocated:Readonly<{left:number;right:number;top:number;bottom:number}>[]=[];
  if((scene.annotations?.length??0)>64)throw Error('Relationship label budget exceeded');
  return (scene.annotations??[]).flatMap(annotation=>{
    const box=annotation.box;if(!box)return [annotation];
    if(![annotation.x,annotation.y,box.width,box.height].every(Number.isFinite)||annotation.x<0||annotation.x>scene.width||annotation.y<0||annotation.y>scene.height||box.width<=0||box.width>240||box.height<=0||box.height>64)throw Error('Invalid relationship text box');
    const width=Math.min(box.width,2*annotation.x,2*(scene.width-annotation.x)),height=Math.min(box.height,2*annotation.y,2*(scene.height-annotation.y));
    if(width<16||height<12)return [];
    const rect={left:annotation.x-width/2,right:annotation.x+width/2,top:annotation.y-height/2,bottom:annotation.y+height/2};
    if(allocated.some(previous=>rect.left<previous.right+2&&rect.right>previous.left-2&&rect.top<previous.bottom+2&&rect.bottom>previous.top-2))return [];
    allocated.push(rect);
    return [{...annotation,box:{...box,width,height}}];
  });
}
