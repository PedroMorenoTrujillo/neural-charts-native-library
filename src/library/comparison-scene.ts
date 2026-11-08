import type {PlanBulletFrame,PlanVariwideFrame,PlanBulletValue,PlanVariwideValue} from '@neural-charts/core/plan';

export interface ComparisonFields {
  readonly bulletData?:PlanBulletFrame['bulletData'];
  readonly bulletBands?:PlanBulletFrame['bulletBands'];
  /** Band IDs whose colour was omitted by the caller; renderer resolves the theme. */
  readonly automaticBulletBands?:readonly string[];
  readonly bulletTargets?:PlanBulletFrame['bulletTargets'];
  readonly bulletOrientation?:PlanBulletFrame['bulletOrientation'];
  readonly bulletGrid?:PlanBulletFrame['bulletGrid'];
  readonly categoryBands?:PlanVariwideFrame['categoryBands'];
  readonly variwideData?:PlanVariwideFrame['variwideData'];
  readonly variwideLayout?:PlanVariwideFrame['variwideLayout'];
}
export interface ComparisonPoint {
  readonly id:Readonly<{seriesId:string;pointId:string}>;
  readonly value:number;
  readonly bullet?:PlanBulletValue;
  readonly variwide?:PlanVariwideValue;
}
export interface ComparisonScene extends ComparisonFields {
  readonly family:string;readonly width:number;readonly height:number;
  readonly series:readonly Readonly<{id:string}>[];
  readonly legend?:readonly Readonly<{id:string;visible:boolean}>[];
  readonly observations:readonly ComparisonPoint[];
}
const finite=(value:unknown):value is number=>typeof value==='number'&&Number.isFinite(value);
const text=(value:unknown,max=128):value is string=>typeof value==='string'&&value.length>0&&value.length<=max;
const key=(id:ComparisonPoint['id'])=>JSON.stringify([id.seriesId,id.pointId]);
const ink=(value:unknown):value is string=>typeof value==='string'&&/^#[0-9a-f]{6}(?:[0-9a-f]{2})?$/i.test(value);

export function ownComparisonPoint(point:ComparisonPoint,family:string):Pick<ComparisonPoint,'bullet'|'variwide'> {
  if(family==='bullet'||point.bullet!==undefined){
    const value=point.bullet;
    if(family!=='bullet'||!value||point.variwide!==undefined||!['measure','target'].includes(value.type)||value.measure!==null&&!finite(value.measure)||value.target!==undefined&&value.target!==null&&!finite(value.target)||point.value!==(value.type==='measure'?value.measure:value.target)||value.type==='measure'&&value.measure===null||value.type==='target'&&typeof value.target!=='number')throw Error('Invalid bullet observation');
    return {bullet:{type:value.type,measure:value.measure,...(value.target===undefined?{}:{target:value.target})}};
  }
  if(family==='variwide'||point.variwide!==undefined){
    const value=point.variwide;
    if(family!=='variwide'||!value||!finite(value.z)||value.z<0||!finite(value.share)||value.share<0||value.share>1||typeof value.zeroWidth!=='boolean'||value.zeroWidth!==(value.z===0)||typeof value.geometryOmitted!=='boolean')throw Error('Invalid proportional observation');
    return {variwide:{z:value.z,share:value.share,zeroWidth:value.zeroWidth,geometryOmitted:value.geometryOmitted}};
  }
  return {};
}

/** Defensive ownership only. The planner remains the sole owner of domains,
 * weighted allocation and geometry; null source values are never zero-filled. */
export function ownComparisonScene(scene:ComparisonScene):ComparisonFields {
  const hasBullet=scene.bulletData!==undefined||scene.bulletBands!==undefined||scene.automaticBulletBands!==undefined||scene.bulletTargets!==undefined||scene.bulletOrientation!==undefined||scene.bulletGrid!==undefined;
  const hasVariwide=scene.variwideData!==undefined||scene.categoryBands!==undefined||scene.variwideLayout!==undefined;
  if(!hasBullet&&!hasVariwide){if(scene.family==='bullet'||scene.family==='variwide')throw Error('Missing comparison source');return {};}
  const visibility=new Map((scene.legend??scene.series.map(s=>({id:s.id,visible:true}))).map(s=>[s.id,s.visible])),ids=new Set<string>();
  const identity=(id:ComparisonPoint['id'],visible:boolean)=>{if(!id||!text(id.seriesId)||!text(id.pointId)||!visibility.has(id.seriesId)||typeof visible!=='boolean'||visibility.get(id.seriesId)!==visible||ids.has(key(id)))throw Error('Invalid comparison source identity');ids.add(key(id));return {seriesId:id.seriesId,pointId:id.pointId};};
  const line=(value:Readonly<{x1:number;y1:number;x2:number;y2:number}>)=>{if(!value||![value.x1,value.y1,value.x2,value.y2].every(finite)||Math.min(value.x1,value.x2)<0||Math.max(value.x1,value.x2)>scene.width||Math.min(value.y1,value.y2)<0||Math.max(value.y1,value.y2)>scene.height)throw Error('Invalid comparison line');return {x1:value.x1,y1:value.y1,x2:value.x2,y2:value.y2};};
  if(hasBullet){
    if(scene.family!=='bullet'||hasVariwide||!Array.isArray(scene.bulletData)||scene.bulletData.length>1024||!Array.isArray(scene.bulletBands)||scene.bulletBands.length>32||!Array.isArray(scene.bulletTargets)||scene.bulletTargets.length>1024||!Array.isArray(scene.bulletGrid)||scene.bulletGrid.length>32||!['horizontal','vertical'].includes(scene.bulletOrientation??''))throw Error('Invalid bullet frame');
    const perSeries=new Map<string,Set<string>>(),categoryIds=new Set<string>();
    const bulletData=scene.bulletData.map(p=>{const id=identity(p.id,p.visible),categories=perSeries.get(id.seriesId)??new Set<string>();if(!text(p.categoryId,256)||categories.has(p.categoryId)||p.measure!==null&&!finite(p.measure)||p.target!==undefined&&p.target!==null&&!finite(p.target))throw Error('Invalid bullet source');categories.add(p.categoryId);categoryIds.add(p.categoryId);perSeries.set(id.seriesId,categories);if(categories.size>64||categoryIds.size>64||perSeries.size>16)throw Error('Bullet source budget exceeded');return {id,categoryId:p.categoryId,measure:p.measure,...(p.target===undefined?{}:{target:p.target}),visible:p.visible};});
    const source=new Map(bulletData.map(p=>[key(p.id),p]));
    for(const p of scene.observations){const s=source.get(key(p.id)),v=ownComparisonPoint(p,scene.family).bullet;if(!s||!s.visible||!v||s.measure!==v.measure||s.target!==v.target)throw Error('Bullet observation differs from source');}
    const bands=new Set<string>(),targets=new Set<string>();
    const bulletBands=scene.bulletBands.map(b=>{if(!text(b.id)||bands.has(b.id)||!finite(b.from)||!finite(b.to)||b.to<=b.from||typeof b.label!=='string'||b.label.length>256||!ink(b.color)||!['visible','outside'].includes(b.status)||(b.status==='visible')!==(b.rect!==undefined))throw Error('Invalid bullet band');bands.add(b.id);const r=b.rect;if(r&&(![r.x,r.y,r.width,r.height].every(finite)||r.x<0||r.y<0||r.width<0||r.height<0||r.x+r.width>scene.width||r.y+r.height>scene.height))throw Error('Invalid bullet band bounds');return {id:b.id,from:b.from,to:b.to,label:b.label,color:b.color,status:b.status,...(r?{rect:{x:r.x,y:r.y,width:r.width,height:r.height}}:{})};});
    const bulletTargets=scene.bulletTargets.map(t=>{const s=source.get(key(t.id));if(!s||!s.visible||targets.has(key(t.id))||!finite(t.value)||s.target!==t.value||!['visible','outside'].includes(t.status)||(t.status==='visible')!==(t.line!==undefined))throw Error('Invalid bullet target');targets.add(key(t.id));return {id:{seriesId:t.id.seriesId,pointId:t.id.pointId},value:t.value,status:t.status,...(t.line?{line:line(t.line)}:{})};});
    const automatic=scene.automaticBulletBands;
    if(automatic!==undefined&&(!Array.isArray(automatic)||automatic.length>32||new Set(automatic).size!==automatic.length||automatic.some(id=>!bands.has(id))))throw Error('Invalid automatic bullet band IDs');
    return {bulletData,bulletBands,...(automatic?{automaticBulletBands:[...automatic]}:{}),bulletTargets,bulletOrientation:scene.bulletOrientation,bulletGrid:scene.bulletGrid.map(line)};
  }
  if(scene.family!=='variwide'||!Array.isArray(scene.variwideData)||scene.variwideData.length>64||!Array.isArray(scene.categoryBands)||scene.categoryBands.length>64||!scene.variwideLayout||!['ready','no-positive-width'].includes(scene.variwideLayout.status)||typeof scene.variwideLayout.incomplete!=='boolean')throw Error('Invalid proportional frame');
  if(scene.series.length>1||(scene.legend?.length??0)>1)throw Error('Proportional layout supports one source series');
  const sourceCategories=new Set<string>();
  const variwideData=scene.variwideData.map(p=>{const id=identity(p.id,p.visible);if(!text(p.categoryId,256)||sourceCategories.has(p.categoryId)||p.y!==null&&!finite(p.y)||p.z!==null&&(!finite(p.z)||p.z<0)||p.missingValue!==(p.y===null)||p.missingWidth!==(p.z===null))throw Error('Invalid proportional source');sourceCategories.add(p.categoryId);return {id,categoryId:p.categoryId,y:p.y,z:p.z,visible:p.visible,missingValue:p.missingValue,missingWidth:p.missingWidth};});
  const source=new Map(variwideData.map(p=>[key(p.id),p]));
  for(const p of scene.observations){const s=source.get(key(p.id)),v=ownComparisonPoint(p,scene.family).variwide;if(!s||!s.visible||!v||s.y!==p.value||s.z!==v.z)throw Error('Proportional observation differs from source');}
  const categories=new Set<string>();
  const categoryBands=scene.categoryBands.map(b=>{if(!text(b.categoryId,256)||categories.has(b.categoryId)||typeof b.label!=='string'||b.label.length>256||b.pointId!==undefined&&!text(b.pointId)||b.z!==null&&(!finite(b.z)||b.z<0)||!['visible','zero','unknown','below-precision','hidden','no-positive-width'].includes(b.status)||(b.left===null)!==(b.right===null)||b.left!==null&&(!finite(b.left)||!finite(b.right)||b.left<0||b.right!<b.left||b.right!>scene.width))throw Error('Invalid proportional band');categories.add(b.categoryId);return {categoryId:b.categoryId,label:b.label,...(b.pointId===undefined?{}:{pointId:b.pointId}),z:b.z,left:b.left,right:b.right,status:b.status};});
  return {variwideData,categoryBands,variwideLayout:{status:scene.variwideLayout.status,incomplete:scene.variwideLayout.incomplete}};
}
