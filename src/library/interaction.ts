import {AnnularSectorHitIndex} from './annular-hit.js';
import {HeatmapHitIndex} from './heatmap-hit.js';
import {VennHitIndex} from './venn-hit.js';
import {ContourHitIndex} from './contour-hit-index.js';
import {relationshipFamily} from './relationship-scene.js';
import {PictorialHitIndex} from './pictorial-hit.js';
import type {PlanCompoundPolygonHit} from '@neural-charts/core/plan';
import {TilemapHitIndex} from './tilemap-hit.js';
import {RelationshipHitIndex} from './relationship-hit-index.js';
import {polygonObservation,sankeyObservation} from './polygon-hit.js';
import { identityKey, type DatumId, type FrameClock, type HapticPort, type InteractionSnapshot, type NativeScene, type Observation,type SharedSelection } from './contracts.js';
import { ownScene,sceneInteractionKey } from './scene.js';
import {TileIndex} from './tile-index.js';
import {TemporalHitIndex} from './temporal-hit-index.js';

/** Platform-free interaction owner. No scales, domains, Angular or native dependencies. */
export class NativeChartSession {
  private currentScene: NativeScene;
  get scene():NativeScene{return this.currentScene;}
  private readonly positions=new Map<string,number>();
  private readonly semanticGroups=new Map<string,readonly Observation[]>();
  private sharedCache:SharedSelection|undefined;
  private readonly sharedOrder:readonly Observation[];
  private readonly groupPositions=new Map<string,number>();
  private readonly groups: readonly Readonly<{ coordinate: number; points: readonly Observation[] }>[];
  private listener: ((snapshot: InteractionSnapshot) => void) | null;
  private lastEmitted:InteractionSnapshot|undefined;
  private active: Observation | null = null;
  private selected: DatumId | null = null;
  private scrubbing = false;
  private pinned = false;
  private pending: { x: number; y: number } | null = null;
  private frame: number | null = null;
  private destroyed = false;
  private readonly hapticState = {busy:false};
  private touchTolerance = 0;
  private readonly hitCells = new Map<string, Observation[]>();
  private readonly glyphCircles=new Map<string,{cx:number;cy:number;radius:number}[]>();
  private glyphPoints:readonly Observation[]=[];
  private maximumGlyphRadius=1;
  private readonly pictorial:PictorialHitIndex<Readonly<{point:Observation;hit?:PlanCompoundPolygonHit}>>|null;
  private readonly tilemap:TilemapHitIndex|null;
  private readonly relationships:RelationshipHitIndex|null;
  private readonly annular:AnnularSectorHitIndex|null;
  private readonly radial: readonly Observation[];
  private readonly radialOrigin:number;
  private readonly radialPhase:number;
  private readonly cellSize = 128;
  private readonly tiles:TileIndex|null;
  private readonly temporal:TemporalHitIndex|null;
  private readonly contours:ContourHitIndex|null;
  private readonly venn:VennHitIndex|null;
  private readonly heatmap:HeatmapHitIndex|null;

  constructor(scene: NativeScene, private readonly clock: FrameClock,
    private readonly haptics: HapticPort, listener: (snapshot: InteractionSnapshot) => void,initialSelection:DatumId|null=null,readonly contentMode:'point'|'shared'='point',initialGroup?:string) {
    this.currentScene = ownScene(scene);
    this.pictorial=scene.family==='pictorial'?new PictorialHitIndex(this.scene.observations.map(point=>({point,...(point.hit?.type==='compoundPolygon'?{hit:point.hit}:{})})),scene.width,scene.height):null;
    this.tilemap=scene.family==='tilemap'||scene.family==='wordcloud'?new TilemapHitIndex(this.scene.observations,scene.width,scene.height):null;
    this.heatmap=this.scene.heatmap?new HeatmapHitIndex(this.scene.heatmap.layout.rows,this.scene.heatmap.layout.columns,this.scene.heatmap.data,this.scene.observations,scene.width,scene.height):null;
    this.venn=scene.venn?new VennHitIndex(this.scene.venn!.layout.circles,this.scene.observations.filter(point=>point.venn?.geometry==='placed').map(point=>({mask:point.venn!.mask,point})),scene.width,scene.height):null;
    this.contours=scene.family==='contour'?new ContourHitIndex(this.currentScene):null;
    this.temporal=['regression','flame','violin','bullet','variwide','xrange','timeline'].includes(scene.family)?new TemporalHitIndex(this.currentScene,scene.family==='bullet'||scene.family==='variwide'):null;
    if(scene.family==='lollipop'||scene.family==='dumbbell'){
      for(const series of this.scene.series)for(const circle of series.circles??[]){
        if(circle.pointId===undefined)continue;
        const key=identityKey({seriesId:series.id,pointId:circle.pointId}),circles=this.glyphCircles.get(key)??[];
        circles.push(circle);this.glyphCircles.set(key,circles);this.maximumGlyphRadius=Math.max(this.maximumGlyphRadius,circle.radius);
      }
      this.glyphPoints=this.scene.observations.filter(p=>!!p.stem||this.glyphCircles.has(identityKey(p.id))).sort((a,b)=>a.x-b.x);
    }
    this.tiles=(scene.family==='treemap'||scene.family==='organization')?new TileIndex(this.currentScene):null;
    if(contentMode==='shared'&&(!['fan','parallel','bullet','streamgraph','lollipop','dumbbell','columnpyramid','boxplot','errorbar','arearange','areasplinerange','columnrange','pareto','line','area','streamgraph','areaspline','spline','mixed','column','bar'].includes(scene.family)||scene.observations.some(p=>!p.group)))throw new Error('Shared tooltip requires semantic groups on line, column or bar observations');
    this.scene.observations.forEach((p,i)=>this.positions.set(identityKey(p.id),i));
    const initial=initialSelection?this.point(initialSelection):null;
    this.active=initial;this.selected=initial?.id??null;
    this.listener = listener;
    const groups = new Map<number, Observation[]>();
    for (const p of ['fan','bullet','streamgraph','lollipop','dumbbell','columnpyramid','boxplot','errorbar','arearange','areasplinerange','columnrange','histogram','bellcurve','pareto','waterfall','line','area','streamgraph','areaspline','spline','mixed','column','bar'].includes(this.scene.family)?this.scene.observations:[]) {
      const coordinate = contentMode==='shared'?p.group!.coordinate:(this.scene.family==='bar'||this.scene.family==='bullet'&&this.scene.bulletOrientation==='horizontal')?p.y:p.x;
      const bucket = groups.get(coordinate) ?? [];
      bucket.push(p);
      groups.set(coordinate, bucket);
    }
    this.groups = [...groups].sort(([a], [b]) => a - b).map(([coordinate, points]) => ({coordinate, points}));
    const semantic=new Map<string,Observation[]>();
    if(contentMode==='shared')for(const point of this.scene.observations){if(!point.group)continue;const rows=semantic.get(point.group.key)??[];rows.push(point);semantic.set(point.group.key,rows);}
    const order=new Map((scene.legend??scene.series).map((s,i)=>[s.id,i]));
    for(const [key,points]of semantic)this.semanticGroups.set(key,Object.freeze(points.sort((a,b)=>order.get(a.id.seriesId)!-order.get(b.id.seriesId)!)));
    this.sharedOrder=[...this.semanticGroups.values()].map(points=>points[0]!).sort((a,b)=>a.group!.coordinate-b.group!.coordinate);
    this.sharedOrder.forEach((p,i)=>this.groupPositions.set(p.group!.key,i));
    if(contentMode==='shared'&&initialGroup){const restored=this.semanticGroups.get(initialGroup)?.[0];if(restored){this.active=restored;this.selected=restored.id;}}
    this.relationships=relationshipFamily(scene.family)?new RelationshipHitIndex(scene):null;
    this.annular=scene.family==='windrose'||scene.family==='radialbar'?new AnnularSectorHitIndex(this.scene.observations):null;
    this.radial = scene.family==='variablepie'||scene.family==='polar'||scene.family==='pie'||scene.family==='donut'||scene.family==='gauge'
      ? this.scene.observations.filter(p=>p.hit?.type==='sector'&&p.hit.end>p.hit.start&&p.hit.radius>p.hit.innerRadius).sort((a,b)=>(a.hit!.type==='sector'?a.hit!.start:0)-(b.hit!.type==='sector'?b.hit!.start:0)):[];
    const firstSector=this.radial[0]?.hit;
    this.radialOrigin=firstSector?.type==='sector'?firstSector.start:0;
    this.radialPhase=(this.radialOrigin%(Math.PI*2)+Math.PI*2)%(Math.PI*2);
    // Bubble hit regions are indexed once. A touch only examines the cell under the finger.
    if((scene.family==='vector'||scene.family==='windbarb'||scene.family==='networkgraph'||scene.family==='packedbubble'||scene.family==='treegraph'||scene.family==='polygon'||scene.family==='dendrogram'||scene.family==='parallel'||scene.family==='radar'||scene.family==='bubble'||scene.family==='scatter'))for(const p of this.scene.observations){const h=p.hit;if(!h||h.type!=='circle'||h.radius<=0)continue;
      for(let x=Math.max(0,Math.floor((h.cx-h.radius)/this.cellSize));x<=Math.min(Math.floor(this.scene.width/this.cellSize),Math.floor((h.cx+h.radius)/this.cellSize));x++)
        for(let y=Math.max(0,Math.floor((h.cy-h.radius)/this.cellSize));y<=Math.min(Math.floor(this.scene.height/this.cellSize),Math.floor((h.cy+h.radius)/this.cellSize));y++){
          const key=x+','+y;const points=this.hitCells.get(key)??[];points.push(p);this.hitCells.set(key,points);
        }
    }
  }
  get snapshot(): InteractionSnapshot {const shared=this.shared();return Object.freeze({active: this.active, selected: this.selected, scrubbing: this.scrubbing,...(shared?{shared}:{}),...(this.pinned?{pinned:true as const}:{})});}
  /** Freeze the last displayed observation, dropping any queued exploration. No new haptic. */
  setPinned(value:boolean):boolean{
    if(this.destroyed)return false;
    if(value===this.pinned)return this.pinned;
    if(value&&!this.active)return false;
    this.cancelFrame();this.pending=null;this.scrubbing=false;
    if(value)this.selected=this.active!.id;
    this.pinned=value;this.emit();return this.pinned;
  }
  private shared():SharedSelection|undefined{
    const group=this.contentMode==='shared'?this.active?.group:undefined;if(!group)return undefined;
    if(this.sharedCache?.key===group.key)return this.sharedCache;
    const points=Object.freeze((this.semanticGroups.get(group.key)??[]).map(p=>this.point(p.id)!)),bySeries=new Map(points.map(p=>[p.id.seriesId,p]));
    const order=new Map((this.scene.legend??this.scene.series).map((s,i)=>[s.id,i]));
    const series=this.scene.family==='mixed'||this.scene.family==='fan'?[...this.scene.series].sort((a,b)=>order.get(a.id)!-order.get(b.id)!):this.scene.series;
    return this.sharedCache=Object.freeze({...group,points,rows:Object.freeze(series.map(s=>Object.freeze({seriesId:s.id,name:s.name,color:s.color,point:bySeries.get(s.id)??null})))});
  }
  /** Safe presentation revisions share immutable geometry and index order. */
  updatePresentation(input:NativeScene):boolean{
    if(this.destroyed)return false;const scene=ownScene(input);
    if(scene===this.currentScene)return true;
    if(sceneInteractionKey(scene)!==sceneInteractionKey(this.scene))return false;
    const id=this.active?.id;this.currentScene=scene;this.sharedCache=undefined;this.active=id?this.point(id):null;this.emit();return true;
  }
  private point(id:DatumId):Observation|null{const index=this.positions.get(identityKey(id));return index===undefined?null:this.scene.observations[index]??null;}
  /** Repeating a tap closes the same observation; an exploration gesture never toggles it. */
  tap(x:number,y:number,tolerance=0):void{
    if(this.destroyed||this.pinned||!Number.isFinite(x)||!Number.isFinite(y))return;
    this.touchTolerance=Number.isFinite(tolerance)?Math.max(0,Math.min(256,tolerance)):0;
    const next=this.nearest(x,y);
    const previous=this.selected?this.point(this.selected):null;
    if(!this.scrubbing&&next&&previous&&(this.contentMode==='shared'?next.group?.key===previous.group?.key:next.id.seriesId===previous.id.seriesId&&next.id.pointId===previous.id.pointId)){this.clear();return;}
    this.begin(x,y,tolerance);this.end(true);
  }
  begin(x: number, y: number, tolerance = 0): void {
    if (this.destroyed || this.pinned || !Number.isFinite(x) || !Number.isFinite(y)) return;
    this.cancelFrame();this.pending=null;
    this.scrubbing = true;
    this.touchTolerance=Number.isFinite(tolerance)?Math.max(0,Math.min(256,tolerance)):0;
    this.setActive(this.nearest(x, y));
  }
  move(x: number, y: number): void {
    if (this.destroyed || this.pinned || !this.scrubbing || !Number.isFinite(x) || !Number.isFinite(y)) return;
    if(this.pending){this.pending.x=x;this.pending.y=y;}else this.pending={x,y};
    if (this.frame === null) this.frame = this.clock.request(() => {
      this.frame = null;
      this.flush();
    });
  }
  end(commit: boolean): void {
    if (this.destroyed || this.pinned || !this.scrubbing) return;
    this.cancelFrame();
    if (commit) {
      this.flush();
      this.selected = this.active?.id ?? null;
    } else {
      this.pending = null;
      this.active = this.selected ? this.point(this.selected) : null;
    }
    this.scrubbing = false;
    this.emit();
  }
  private get navigationPoints():readonly Observation[]{
    return this.contentMode==='shared'?this.sharedOrder:this.scene.observations;
  }
  private get navigationIndex():number|undefined{
    if(!this.active)return undefined;
    return this.contentMode==='shared'?this.groupPositions.get(this.active.group!.key):this.positions.get(identityKey(this.active.id));
  }
  /** The slider range counts navigation stops, including shared groups rather than their rows. */
  get navigationRange():{min:number;max:number;now:number}{
    const max=this.navigationPoints.length;
    return max?{min:1,max,now:(this.navigationIndex??0)+1}:{min:0,max:0,now:0};
  }
  /** Native adjustable, keyboard and explicit buttons share the same datum model. */
  step(direction: -1 | 1 | 'first' | 'last'): void {
    if (this.destroyed || this.pinned || this.scene.observations.length === 0) return;
    this.cancelFrame(); this.pending = null; this.scrubbing = false;
    const points=this.navigationPoints;
    let index:number;
    if(direction==='first')index=0;
    else if(direction==='last')index=points.length-1;
    else{
      const current=this.navigationIndex??(direction===1?-1:points.length);
      index=Math.max(0,Math.min(points.length-1,current+direction));
    }
    const next = this.point(points[index]!.id)!;
    this.selected = next.id;
    this.setActive(next);
  }
  clear(): void {
    if (this.destroyed) return;
    this.cancelFrame(); this.pending = null; this.scrubbing = false; this.pinned=false; this.active = null; this.selected = null; this.emit();
  }
  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.tiles?.destroy();
    this.temporal?.destroy();
    this.glyphCircles.clear();this.glyphPoints=[];
    this.pinned=false;
    this.lastEmitted=undefined;
    this.cancelFrame(); this.pending = null; this.listener = null; this.active = null; this.selected = null;this.hitCells.clear();this.positions.clear();this.semanticGroups.clear();this.groupPositions.clear();this.sharedCache=undefined;
  }
  private cancelFrame(): void { if (this.frame !== null) this.clock.cancel(this.frame); this.frame = null; }
  private flush(): void { const p = this.pending; this.pending = null; if (p && !this.destroyed) this.setActive(this.nearest(p.x, p.y,true)); }
  private nearest(x: number, y: number,continuous=false): Observation | null {
    if(x<0||y<0||x>this.scene.width||y>this.scene.height)return null;
    if(this.pictorial){const hit=this.pictorial.pick(x,y);return hit?this.point(hit.point.id):null;}
    if(this.heatmap){const hit=this.heatmap.pick(x,y);return hit.type==='known'?this.point(hit.point.id):continuous&&hit.type==='gap'?this.active:null;}
    if(this.venn){const point=this.venn.pick(x,y);return point?this.point(point.id):continuous?this.active:null;}
    if(this.tilemap){const point=this.tilemap.pick(x,y);return point?this.point(point.id):continuous&&this.scene.family==='wordcloud'?this.active:null;}
    if(this.contours){const point=this.contours.pick(x,y,this.touchTolerance);return point?this.point(point.id):(continuous?this.active:null);}
    if(this.temporal)return this.temporal.pick(x,y,this.touchTolerance)??(continuous?this.active:null);
    if(['sankey','treegraph','organization','networkgraph','packedbubble'].includes(this.scene.family)){
      const plot=this.scene.clip;
      if(plot&&(x<plot.x||x>plot.x+plot.width||y<plot.y||y>plot.y+plot.height))return null;
    }
    if(this.scene.family==='sunburst'){
      let selected:Observation|null=null,deepest=-1;
      for(const point of this.scene.observations){const hit=point.hit;if(hit?.type!=='sector'||hit.radius<=hit.innerRadius)continue;
        const radius=Math.hypot(x-hit.cx,y-hit.cy),angle=Math.atan2(x-hit.cx,hit.cy-y),delta=((angle-hit.start)%(Math.PI*2)+Math.PI*2)%(Math.PI*2);
        if(radius>=hit.innerRadius&&radius<=hit.radius&&delta<=hit.end-hit.start+1e-10&&hit.innerRadius>deepest){selected=point;deepest=hit.innerRadius;}
      }
      return selected;
    }
    if(this.scene.family==='item'){
      let selected:Readonly<{seriesId:string;pointId:string}>|null=null,score=Infinity;
      for(const series of this.scene.series)for(const circle of series.circles??[]){
        if(circle.pointId===undefined)continue;
        const distance=(x-circle.cx)**2+(y-circle.cy)**2,radius=Math.max(circle.radius,this.touchTolerance);
        if(distance<=radius*radius&&distance<score){selected={seriesId:series.id,pointId:circle.pointId};score=distance;}
      }
      return selected?this.point(selected):null;
    }
    if(this.scene.family==='lollipop'||this.scene.family==='dumbbell')return this.nearestGlyph(x,y);
    if(this.tiles)return this.tiles.pick(x,y);
    if(this.relationships)return this.relationships.pick(x,y,this.touchTolerance)??(continuous?this.active:null);
    if(this.scene.family==='sankey')return sankeyObservation(this.scene.observations,x,y)??(continuous?this.active:null);
    if(this.scene.family==='funnel'||this.scene.family==='pyramid')return polygonObservation(this.scene.observations,x,y);
    if((this.scene.family==='vector'||this.scene.family==='windbarb'||this.scene.family==='networkgraph'||this.scene.family==='packedbubble'||this.scene.family==='treegraph'||this.scene.family==='polygon'||this.scene.family==='dendrogram'||this.scene.family==='parallel'||this.scene.family==='radar'||this.scene.family==='bubble'||this.scene.family==='scatter')){
      const candidates=new Set<Observation>();
      for(let cx=Math.floor((x-this.touchTolerance)/this.cellSize);cx<=Math.floor((x+this.touchTolerance)/this.cellSize);cx++)
        for(let cy=Math.floor((y-this.touchTolerance)/this.cellSize);cy<=Math.floor((y+this.touchTolerance)/this.cellSize);cy++)
          for(const p of this.hitCells.get(cx+','+cy)??[])candidates.add(p);
      let best:Observation|null=null,score=Infinity;
      for(const p of candidates){const h=p.hit!;if(h.type!=='circle')continue;const distance=(x-h.cx)**2+(y-h.cy)**2;if(distance<=Math.max(h.radius,this.touchTolerance)**2&&distance<score){best=p;score=distance;}}
      return best?this.point(best.id):null;
    }
    if(this.annular){const point=this.annular.pick(x,y);return point?this.point(point.id):null;}
    if(this.radial.length){
      // Shared-frame sectors allow a binary angular lookup, independent of the slice count.
      const first=this.radial[0]!,h=first.hit!;if(h.type!=='sector')return null;
      const radius=Math.hypot(x-h.cx,y-h.cy),angle=(Math.atan2(x-h.cx,h.cy-y)+Math.PI*2)%(Math.PI*2);
      const position=this.radialOrigin+(angle-this.radialPhase+Math.PI*2)%(Math.PI*2);
      let low=0,high=this.radial.length;
      while(low<high){const mid=(low+high)>>>1;const region=this.radial[mid]!.hit!;if(region.type==='sector'&&region.start<=position)low=mid+1;else high=mid;}
      const point=this.radial[Math.max(0,low-1)]!,region=point.hit!;
      if(region.type==='sector'){
        const relative=position-region.start;
        return radius>=region.innerRadius&&radius<=region.radius&&relative>=-1e-10&&relative<=region.end-region.start+1e-10?this.point(point.id):null;
      }
      return null;
    }
    if(['variablepie','polar','pie','donut','gauge'].includes(this.scene.family))return null;
    if (this.groups.length === 0) return null;
    const target = this.scene.family === 'bar' ? y : x;
    let low = 0, high = this.groups.length;
    while (low < high) { const mid = (low + high) >>> 1; if (this.groups[mid]!.coordinate < target) low = mid + 1; else high = mid; }
    const left = this.groups[Math.max(0, low - 1)]!;
    const right = this.groups[Math.min(low, this.groups.length - 1)]!;
    const group = Math.abs(target - left.coordinate) <= Math.abs(target - right.coordinate) ? left : right;
    if(this.scene.stackGroups||this.scene.family==='columnrange'||this.scene.family==='boxplot'||this.scene.family==='errorbar'||this.scene.family==='columnpyramid'){
      const precise=polygonObservation(left.points,x,y)??(left===right?null:polygonObservation(right.points,x,y));
      // Taps require a painted target. Continuous exploration follows the nearest
      // semantic group through the whitespace between boxes/ranges instead of
      // destroying and recreating the tooltip at every gap.
      if(precise||!continuous)return precise;
    }
    const other = this.scene.family === 'bar' ? x : y;
    if(this.contentMode==='shared')return this.semanticGroups.get(group.points[0]!.group!.key)?.[0]??null;
    return group.points.reduce((best,p)=>{
      const distance=Math.abs((this.scene.family==='bar'?p.x:p.y)-other),current=Math.abs((this.scene.family==='bar'?best.x:best.y)-other);
      // Supplied bands paint below scalar lines. At the same anchor, touch the
      // visible line rather than the interval's compatible midpoint. Semantic
      // navigation order and shared-tooltip grouping remain source ordered.
      if(this.scene.mixedRanges&&Math.abs(distance-current)<=Math.max(1,this.scene.height)*1e-10){
        // Treat rounding noise symmetrically: a later interval cannot displace
        // a scalar already chosen at the same visible anchor.
        return p.lowValue===undefined?p:best;
      }
      return distance<current?p:best;
    });
  }
  private nearestGlyph(x:number,y:number):Observation|null{
    const reach=Math.max(this.maximumGlyphRadius,this.touchTolerance),points=this.glyphPoints;
    let low=0,high=points.length;
    while(low<high){const mid=(low+high)>>>1;if(points[mid]!.x<x-reach)low=mid+1;else high=mid;}
    let best:Observation|null=null,score=Infinity;
    for(let i=low;i<points.length&&points[i]!.x<=x+reach;i++){
      const point=points[i]!;
      for(const circle of this.glyphCircles.get(identityKey(point.id))??[]){
        const distance=(x-circle.cx)**2+(y-circle.cy)**2,radius=Math.max(circle.radius,this.touchTolerance);
        if(distance<=radius*radius&&distance<score){best=point;score=distance;}
      }
      const stem=point.stem;
      if(stem){const first=Math.min(stem.startY,stem.endY),last=Math.max(stem.startY,stem.endY),dy=y<first?first-y:y>last?y-last:0,distance=(x-stem.x)**2+dy*dy,radius=Math.max(1,this.touchTolerance);
        if(distance<=radius*radius&&distance<score){best=point;score=distance;}
      }
    }
    return best;
  }
  private setActive(point: Observation | null): void {
    if(point!==this.active)point=point?this.point(point.id):null;
    const changed = this.contentMode==='shared'?point?.group?.key!==this.active?.group?.key:point!==this.active;
    this.active = point;
    const hapticState=this.hapticState;
    if (changed && point && !hapticState.busy) {
      try {
        if (this.haptics.allowed()) {
          hapticState.busy = true;
          // A stalled platform promise may outlive the chart. Its completion
          // needs only this gate, never the session or its component owner.
          void Promise.resolve(this.haptics.selection()).catch(() => {}).finally(() => { hapticState.busy = false; });
        }
      } catch { hapticState.busy = false; }
    }
    this.emit();
  }
  private emit(): void {
    if(!this.listener)return;
    const previous=this.lastEmitted,shared=this.shared();
    if(previous&&previous.active===this.active&&previous.selected===this.selected&&previous.scrubbing===this.scrubbing&&!!previous.pinned===this.pinned&&previous.shared===shared)return;
    const next=this.snapshot;this.lastEmitted=next;this.listener(next);
  }
}
