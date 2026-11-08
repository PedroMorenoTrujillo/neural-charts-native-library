import type {NativeScene,NativeBar,Observation} from './contracts.js';
import {identityKey} from './contracts.js';

/** Bounded render-coordinate lookup. Tiling and hierarchy arithmetic stay in Core. */
export class TileIndex {
  private readonly cells=new Map<number,readonly Readonly<{rect:NativeBar;point:Observation}>[]>();
  constructor(private readonly scene:NativeScene){
    const points=new Map(scene.observations.map(point=>[identityKey(point.id),point]));
    const cells=new Map<number,{rect:NativeBar;point:Observation}[]>();
    for(const series of scene.series)for(const rect of series.bars??[]){
      const point=rect.pointId===undefined?undefined:points.get(identityKey({seriesId:series.id,pointId:rect.pointId}));
      if(!point||rect.width<=0||rect.height<=0)continue;
      for(let y=this.cell(rect.y,scene.height);y<=this.cell(rect.y+rect.height,scene.height);y++)
        for(let x=this.cell(rect.x,scene.width);x<=this.cell(rect.x+rect.width,scene.width);x++){
          const key=y*12+x,bucket=cells.get(key)??[];bucket.push({rect,point});cells.set(key,bucket);
        }
    }
    for(const [key,bucket]of cells)this.cells.set(key,bucket.sort((a,b)=>a.rect.width*a.rect.height-b.rect.width*b.rect.height));
  }
  private cell(value:number,extent:number):number{return Math.max(0,Math.min(11,Math.floor(value/extent*12)));}
  pick(x:number,y:number):Observation|null{
    if(!Number.isFinite(x)||!Number.isFinite(y)||x<0||y<0||x>this.scene.width||y>this.scene.height)return null;
    const candidates=this.cells.get(this.cell(y,this.scene.height)*12+this.cell(x,this.scene.width))??[];
    for(const {rect,point}of candidates)if(x>=rect.x&&x<=rect.x+rect.width&&y>=rect.y&&y<=rect.y+rect.height)return point;
    return null;
  }
  destroy():void{this.cells.clear();}
}
