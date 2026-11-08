import type {PlanContourLayout,PlanContourValue} from '@neural-charts/core/plan';
import type {NativeScene,Observation} from './contracts.js';

const finite=(v:unknown):v is number=>typeof v==='number'&&Number.isFinite(v);
const text=(v:unknown):v is string=>typeof v==='string'&&v.length>0&&v.length<=128;
const integer=(v:number,min:number,max:number)=>Number.isInteger(v)&&v>=min&&v<=max;
export function ownContourSource(scene:NativeScene):Readonly<{contour?:PlanContourLayout}>{
  const c=scene.contour;
  if(scene.family!=='contour'){if(c!==undefined)throw Error('Contour metadata on another family');return {};}
  if(!c||c.method!=='marching-squares-bilinear'||!text(c.gridId)||!integer(c.columns,2,64)||!integer(c.rows,2,64)||!integer(c.segmentBudget,1,8192)||!integer(c.segmentCount,0,c.segmentBudget)||!integer(c.visibleSegments,0,c.segmentCount)||!integer(c.knownSamples,0,c.columns*c.rows)||!integer(c.missingCells,0,(c.columns-1)*(c.rows-1))||!Array.isArray(c.samples)||c.samples.length!==c.columns*c.rows||!Array.isArray(c.levels)||c.levels.length<1||c.levels.length>8||c.emptyReason!==undefined&&!['hidden','missing','noCrossings','outsideViewport'].includes(c.emptyReason))throw Error('Invalid bounded contour source');
  const ids=new Set<string>();let known=0;
  const samples=c.samples.map((sample,index)=>{
    if(!sample||!text(sample.id)||ids.has(sample.id)||!finite(sample.x)||!finite(sample.y)||sample.value!==null&&!finite(sample.value))throw Error('Invalid contour sample');
    ids.add(sample.id);if(sample.value!==null)known++;
    if(index%c.columns>0&&sample.x<=c.samples[index-1]!.x||index>=c.columns&&sample.y<=c.samples[index-c.columns]!.y||index>=c.columns&&sample.x!==c.samples[index%c.columns]!.x||index%c.columns>0&&sample.y!==c.samples[index-index%c.columns]!.y)throw Error('Invalid contour grid coordinates');
    return {id:sample.id,x:sample.x,y:sample.y,value:sample.value};
  });
  const levels=c.levels.map((level,index)=>{if(!text(level.id)||!finite(level.value)||index>0&&level.value<=c.levels[index-1]!.value||c.levels.slice(0,index).some(other=>other.id===level.id))throw Error('Invalid contour threshold');return {id:level.id,value:level.value};});
  let missing=0;for(let row=0;row<c.rows-1;row++)for(let column=0;column<c.columns-1;column++){const i=row*c.columns+column;if([i,i+1,i+c.columns,i+c.columns+1].some(index=>samples[index]!.value===null))missing++;}
  if(known!==c.knownSamples||missing!==c.missingCells||c.visibleSegments!==scene.observations.length||scene.observations.length>0&&c.emptyReason!==undefined)throw Error('Contour source count differs');
  return {contour:{...c,samples,levels}};
}
export function ownContourPoint(point:Observation,family:NativeScene['family']):Readonly<{contour?:PlanContourValue}>{
  const c=point.contour;
  if(family!=='contour'){if(c!==undefined)throw Error('Contour observation on another family');return {};}
  if(!c||c.type!=='isoline'||!text(c.gridId)||!text(c.levelId)||!finite(c.level)||!integer(c.row,0,62)||!integer(c.column,0,62)||!Array.isArray(c.sourceIds)||c.sourceIds.length!==4||c.sourceIds.some(id=>!text(id))||!Array.isArray(c.sourceValues)||c.sourceValues.length!==4||c.sourceValues.some(v=>!finite(v))||[c.start,c.end,c.sourceStart,c.sourceEnd].some(p=>!p||!finite(p.x)||!finite(p.y))||point.hit!==undefined||point.value!==c.level||point.id.seriesId!==c.levelId)throw Error('Invalid derived contour observation');
  return {contour:{...c,sourceIds:[c.sourceIds[0]!,c.sourceIds[1]!,c.sourceIds[2]!,c.sourceIds[3]!],sourceValues:[c.sourceValues[0]!,c.sourceValues[1]!,c.sourceValues[2]!,c.sourceValues[3]!],start:{...c.start},end:{...c.end},sourceStart:{...c.sourceStart},sourceEnd:{...c.sourceEnd}}};
}
export function validateContourScene(scene:NativeScene):void{
  if(scene.family!=='contour')return;
  const c=scene.contour!,levels=new Map(c.levels.map(level=>[level.id,level.value]));
  if((scene.legend??scene.series).some(level=>!levels.has(level.id)))throw Error('Unknown contour legend threshold');
  for(const point of scene.observations){
    const p=point.contour!;
    if(p.gridId!==c.gridId||levels.get(p.levelId)!==p.level||p.row>=c.rows-1||p.column>=c.columns-1)throw Error('Contour cell differs from source');
    const i=p.row*c.columns+p.column,indices=[i,i+1,i+c.columns+1,i+c.columns];
    for(let corner=0;corner<4;corner++){const sample=c.samples[indices[corner]!]!;if(sample.id!==p.sourceIds[corner]||sample.value!==p.sourceValues[corner])throw Error('Contour corners differ from source');}
    for(const endpoint of [p.start,p.end])if(endpoint.x<0||endpoint.x>scene.width||endpoint.y<0||endpoint.y>scene.height)throw Error('Contour segment outside plot');
    const low=c.samples[i]!,high=c.samples[i+c.columns+1]!;
    for(const endpoint of [p.sourceStart,p.sourceEnd])if(endpoint.x<low.x||endpoint.x>high.x||endpoint.y<low.y||endpoint.y>high.y)throw Error('Contour source segment outside its cell');
    if(point.x!==p.start.x/2+p.end.x/2||point.y!==p.start.y/2+p.end.y/2)throw Error('Contour anchor differs from its segment');
  }
}
