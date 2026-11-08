import type {HitRegion,NativeScene,Observation} from './contracts.js';
type Polygon=Extract<HitRegion,{type:'polygon'}>;
type Vertex=Polygon['vertices'][number];
const cross=(a:Vertex,b:Vertex,c:Vertex)=>(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
const orientation=(a:Vertex,b:Vertex,c:Vertex)=>{
  const product1=(b.x-a.x)*(c.y-a.y),product2=(b.y-a.y)*(c.x-a.x),det=product1-product2,error=Number.EPSILON*8*(Math.abs(product1)+Math.abs(product2));
  return det>error?1:det< -error?-1:0;
};
const onSegment=(a:Vertex,b:Vertex,p:Vertex)=>orientation(a,b,p)===0&&p.x>=Math.min(a.x,b.x)&&p.x<=Math.max(a.x,b.x)&&p.y>=Math.min(a.y,b.y)&&p.y<=Math.max(a.y,b.y);
function intersects(a:Vertex,b:Vertex,c:Vertex,d:Vertex):boolean{
  const x=orientation(a,b,c),y=orientation(a,b,d),z=orientation(c,d,a),w=orientation(c,d,b);
  return (x*y<0&&z*w<0)||onSegment(a,b,c)||onSegment(a,b,d)||onSegment(c,d,a)||onSegment(c,d,b);
}
/** Bounded ownership/validation. Neck-crossing funnel polygons may be concave. */
export function ownPolygon(hit:Polygon,scene:Readonly<{family:NativeScene['family']|'pictorial';width:number;height:number;stackGroups?:NativeScene['stackGroups']}>):Polygon{
  if(!(['column','bar'].includes(scene.family)&&scene.stackGroups)&&!['regression','flame','violin','heatmap','wordcloud','pictorial','tilemap','dependencywheel','arcdiagram','chord','bullet','variwide','xrange','sankey','organization','treegraph','funnel','pyramid','lollipop','dumbbell','columnpyramid','boxplot','errorbar','columnrange'].includes(scene.family)||!Array.isArray(hit.vertices)||hit.vertices.length<3||hit.vertices.length>(scene.family==='violin'?256:scene.family==='pictorial'?5:scene.family==='sankey'?40:['dependencywheel','arcdiagram','chord'].includes(scene.family)?34:6))throw Error('Invalid polygon hit region');
  const vertices=hit.vertices.map(p=>{if(!p||typeof p.x!=='number'||typeof p.y!=='number'||!Number.isFinite(p.x)||!Number.isFinite(p.y)||p.x<0||p.x>scene.width||p.y<0||p.y>scene.height)throw Error('Invalid polygon vertex');return {x:p.x,y:p.y};});
  const origin=vertices[0]!;let area=0;for(let i=0;i<vertices.length;i++){const a=vertices[i]!,b=vertices[(i+1)%vertices.length]!;if(a.x===b.x&&a.y===b.y)throw Error('Collapsed polygon edge');area+=cross(origin,a,b);}
  if(!Number.isFinite(area)||area===0)throw Error('Degenerate polygon hit region');
  // A compact-kernel violin can pinch to zero between separate sample clusters.
  // Validate the two mirrored, monotone chains in linear time: these boundary
  // touches are valid density gaps, rather than self-crossing arbitrary polygons.
  if(scene.family==='violin'&&vertices.length>4){
    if(vertices.length%2!==0)throw Error('Invalid violin contour');
    const steps=vertices.length/2,center=vertices[0]!.x,direction=Math.sign(vertices[1]!.y-vertices[0]!.y);
    if(!direction||vertices[steps]!.x!==center)throw Error('Invalid violin contour');
    for(let i=1;i<steps;i++){
      const left=vertices[i]!,right=vertices[vertices.length-i]!;
      if(direction*(left.y-vertices[i-1]!.y)<=0||left.x>center||right.x<center||left.y!==right.y||Math.abs((left.x-center)+(right.x-center))>1e-7)throw Error('Invalid violin contour');
    }
    if(direction*(vertices[steps]!.y-vertices[steps-1]!.y)<=0)throw Error('Invalid violin contour');
    return {type:'polygon',vertices};
  }
  for(let i=0;i<vertices.length;i++)for(let j=i+1;j<vertices.length;j++){if(j===i+1||i===0&&j===vertices.length-1)continue;if(intersects(vertices[i]!,vertices[(i+1)%vertices.length]!,vertices[j]!,vertices[(j+1)%vertices.length]!))throw Error('Self-intersecting polygon hit region');}
  return {type:'polygon',vertices};
}
export function containsPolygon(hit:Polygon,x:number,y:number):boolean{
  const p={x,y},v=hit.vertices;let inside=false;
  for(let i=0,j=v.length-1;i<v.length;j=i++){
    const a=v[j]!,b=v[i]!;if(onSegment(a,b,p))return true;
    if((a.y>y)!==(b.y>y)&&x<(b.x-a.x)*(y-a.y)/(b.y-a.y)+a.x)inside=!inside;
  }
  return inside;
}
/** Each candidate has at most six edges; callers bound the candidate set. */
export function polygonObservation(points:readonly Observation[],x:number,y:number):Observation|null{
  return points.find(p=>p.hit?.type==='polygon'&&containsPolygon(p.hit,x,y))??null;
}

const boundsCache=new WeakMap<Polygon,Readonly<{left:number;right:number;top:number;bottom:number}>>();
/** Cache bounds on immutable scene polygons; no arrays are allocated per move. */
export function sankeyObservation(points:readonly Observation[],x:number,y:number):Observation|null{
  let selected:Observation|null=null;
  for(const point of points){
    const hit=point.hit;if(hit?.type!=='polygon')continue;
    let bounds=boundsCache.get(hit);
    if(!bounds){let left=Infinity,right=-Infinity,top=Infinity,bottom=-Infinity;for(const vertex of hit.vertices){left=Math.min(left,vertex.x);right=Math.max(right,vertex.x);top=Math.min(top,vertex.y);bottom=Math.max(bottom,vertex.y);}bounds={left,right,top,bottom};boundsCache.set(hit,bounds);}
    if(x<bounds.left||x>bounds.right||y<bounds.top||y>bounds.bottom||!containsPolygon(hit,x,y))continue;
    if(point.sankey?.type==='node')return point;
    selected=point;
  }
  return selected;
}
