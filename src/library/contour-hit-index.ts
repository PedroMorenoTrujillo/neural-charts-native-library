import type {NativeScene,Observation} from './contracts.js';

/** Bounded segment grid, built once per geometry revision. No allocation per move. */
export class ContourHitIndex {
  private readonly bins:readonly number[][];
  private readonly seen:Uint32Array;
  private stamp=0;
  private readonly columns=32;
  private readonly rows=32;
  constructor(private readonly scene:NativeScene){
    const bins=Array.from({length:this.columns*this.rows},()=>[] as number[]);
    this.seen=new Uint32Array(scene.observations.length);
    for(let i=0;i<scene.observations.length;i++){
      const segment=scene.observations[i]!.contour;if(!segment)continue;
      const a=segment.start,b=segment.end,dx=b.x-a.x,dy=b.y-a.y;
      let column=this.column(a.x),row=this.row(a.y);
      const endColumn=this.column(b.x),endRow=this.row(b.y),stepX=Math.sign(dx),stepY=Math.sign(dy);
      const cellWidth=scene.width/this.columns,cellHeight=scene.height/this.rows;
      const deltaX=dx===0?Infinity:cellWidth/Math.abs(dx),deltaY=dy===0?Infinity:cellHeight/Math.abs(dy);
      let boundaryX=dx===0?Infinity:((stepX>0?column+1:column)*cellWidth-a.x)/dx;
      let boundaryY=dy===0?Infinity:((stepY>0?row+1:row)*cellHeight-a.y)/dy;
      // A straight segment traverses at most columns+rows cells, even diagonally.
      for(let step=0;step<=this.columns+this.rows;step++){
        bins[row*this.columns+column]!.push(i);
        if(column===endColumn&&row===endRow)break;
        if(boundaryX<boundaryY){column+=stepX;boundaryX+=deltaX;}
        else if(boundaryY<boundaryX){row+=stepY;boundaryY+=deltaY;}
        else{column+=stepX;row+=stepY;boundaryX+=deltaX;boundaryY+=deltaY;}
        if(column<0||column>=this.columns||row<0||row>=this.rows)break;
      }
    }
    this.bins=bins;
  }
  private column(x:number):number{return Math.max(0,Math.min(this.columns-1,Math.floor(x/this.scene.width*this.columns)));}
  private row(y:number):number{return Math.max(0,Math.min(this.rows-1,Math.floor(y/this.scene.height*this.rows)));}
  pick(x:number,y:number,tolerance:number):Observation|null{
    const reach=Math.max(6,tolerance),left=this.column(x-reach),right=this.column(x+reach),top=this.row(y-reach),bottom=this.row(y+reach);
    if(++this.stamp===0xffffffff){this.seen.fill(0);this.stamp=1;}
    let selected:Observation|null=null,best=reach*reach;
    for(let row=top;row<=bottom;row++)for(let column=left;column<=right;column++)for(const index of this.bins[row*this.columns+column]!){
      if(this.seen[index]===this.stamp)continue;this.seen[index]=this.stamp;
      const point=this.scene.observations[index]!,segment=point.contour!,a=segment.start,b=segment.end,dx=b.x-a.x,dy=b.y-a.y,length=dx*dx+dy*dy;
      const t=length?Math.max(0,Math.min(1,((x-a.x)*dx+(y-a.y)*dy)/length)):0;
      const distance=(x-a.x-t*dx)**2+(y-a.y-t*dy)**2;
      if(distance<best||distance===best&&selected===null){selected=point;best=distance;}
    }
    return selected;
  }
}
