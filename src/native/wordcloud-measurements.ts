import type {PlanWordCloudMeasurement,PlanWordCloudMeasurementRequest} from '@neural-charts/core/plan';

export interface WordCloudProbe {
  readonly token:string;
  readonly request:PlanWordCloudMeasurementRequest;
}
export interface WordCloudMeasurementState {
  readonly generation:number;
  readonly probes:readonly WordCloudProbe[];
  readonly remaining:number;
  readonly measurements:readonly PlanWordCloudMeasurement[]|null;
  readonly error:'INVALID_TEXT_BOUNDS'|'TEXT_MEASUREMENT_UNAVAILABLE'|null;
}
interface Bounds {readonly width:number;readonly height:number;}
interface Pending extends WordCloudProbe {readonly key:string;}

const requestKey=(request:PlanWordCloudMeasurementRequest):string=>JSON.stringify([request.fontKey,request.fontSize,request.text]);
const sameRequest=(a:PlanWordCloudMeasurementRequest,b:PlanWordCloudMeasurementRequest):boolean=>a.wordId===b.wordId&&a.text===b.text&&a.fontSize===b.fontSize&&a.fontKey===b.fontKey;
function ownRequests(values:readonly PlanWordCloudMeasurementRequest[]):readonly PlanWordCloudMeasurementRequest[]{
  if(!Array.isArray(values)||values.length>128)throw Error('Native word cloud measures at most128 words.');
  const ids=new Set<string>();
  return Object.freeze(values.map(value=>{
    if(!value||typeof value!=='object')throw Error('Invalid word cloud measurement request');
    const fields:Record<string,unknown>={};
    for(const key of ['wordId','text','fontSize','fontKey']){
      const property=Object.getOwnPropertyDescriptor(value,key);
      if(!property||property.get||property.set)throw Error('Invalid word cloud measurement request');
      fields[key]=property.value;
    }
    const {wordId,text,fontSize,fontKey}=fields;
    if(typeof wordId!=='string'||wordId.length<1||wordId.length>128||ids.has(wordId)||typeof text!=='string'||text.length<1||text.length>512||typeof fontKey!=='string'||fontKey.length<1||fontKey.length>512||typeof fontSize!=='number'||!Number.isFinite(fontSize)||fontSize<4||fontSize>128)throw Error('Invalid or unsupported native word cloud measurement request');
    ids.add(wordId);return Object.freeze({wordId,text,fontSize,fontKey});
  }));
}

/** Owns a bounded font-measurement queue. It never estimates text width. */
export class WordCloudMeasurements {
  private requests:readonly PlanWordCloudMeasurementRequest[]=[];
  private readonly cache=new Map<string,Bounds>();
  private readonly measured=new Map<string,Bounds>();
  private readonly active=new Map<string,Pending>();
  private queued:readonly Readonly<{key:string;request:PlanWordCloudMeasurementRequest}>[]=[];
  private next=0;
  private generation=0;
  private sequence=0;
  private started=false;
  private destroyed=false;
  private error:WordCloudMeasurementState['error']=null;
  private state:WordCloudMeasurementState=Object.freeze({generation:0,probes:Object.freeze([]),remaining:0,measurements:null,error:null});

  constructor(private readonly cacheLimit=256,private readonly batchLimit=8){
    if(!Number.isInteger(cacheLimit)||cacheLimit<1||cacheLimit>256||!Number.isInteger(batchLimit)||batchLimit<1||batchLimit>8)throw Error('Invalid native text measurement limits');
  }
  get snapshot():WordCloudMeasurementState{return this.state;}
  get cachedMeasurements():number{return this.cache.size;}

  /** Identical inputs retain their in-flight probes and completed result. */
  begin(values:readonly PlanWordCloudMeasurementRequest[]):boolean{
    if(this.destroyed)return false;
    const requests=ownRequests(values);
    if(this.started&&requests.length===this.requests.length&&requests.every((request,index)=>sameRequest(request,this.requests[index]!)))return false;
    this.started=true;this.requests=requests;this.generation++;this.error=null;
    this.active.clear();this.measured.clear();this.next=0;
    const unique=new Map<string,PlanWordCloudMeasurementRequest>();
    for(const request of requests){
      const key=requestKey(request),cached=this.cache.get(key);
      if(cached){this.cache.delete(key);this.cache.set(key,cached);this.measured.set(key,cached);}
      else if(!unique.has(key))unique.set(key,request);
    }
    this.queued=Array.from(unique,([key,request])=>Object.freeze({key,request}));
    this.fill();this.publish();return true;
  }

  /** The platform adapter supplies complete, actually measured logical bounds. */
  accept(token:string,bounds:Bounds):boolean{
    if(this.destroyed||this.error)return false;
    const pending=this.active.get(token);if(!pending)return false;
    if(!bounds||!Number.isFinite(bounds.width)||!Number.isFinite(bounds.height)||bounds.width<0||bounds.height<0||bounds.width>1_000_000||bounds.height>1_000_000){this.stop('INVALID_TEXT_BOUNDS');return true;}
    const owned=Object.freeze({width:bounds.width,height:bounds.height});
    this.active.delete(token);this.measured.set(pending.key,owned);
    this.cache.delete(pending.key);this.cache.set(pending.key,owned);
    if(this.cache.size>this.cacheLimit)this.cache.delete(this.cache.keys().next().value!);
    this.fill();this.publish();return true;
  }

  reject(token:string):boolean{
    if(this.destroyed||!this.active.has(token))return false;
    this.stop('TEXT_MEASUREMENT_UNAVAILABLE');return true;
  }
  destroy():void{
    if(this.destroyed)return;
    this.destroyed=true;this.generation++;this.active.clear();this.cache.clear();this.measured.clear();this.queued=[];this.requests=[];this.publish();
  }

  private stop(reason:NonNullable<WordCloudMeasurementState['error']>):void{
    this.error=reason;this.active.clear();this.queued=[];this.next=0;this.publish();
  }
  private fill():void{
    while(this.active.size<this.batchLimit&&this.next<this.queued.length){
      const entry=this.queued[this.next++]!,token='g'+this.generation+'-p'+(++this.sequence);
      this.active.set(token,Object.freeze({...entry,token}));
    }
  }
  private publish():void{
    const remaining=this.requests.reduce((count,request)=>count+(this.measured.has(requestKey(request))?0:1),0);
    const complete=this.started&&!this.destroyed&&!this.error&&remaining===0;
    this.state=Object.freeze({generation:this.generation,probes:Object.freeze(Array.from(this.active.values(),({token,request})=>Object.freeze({token,request}))),remaining,measurements:complete?Object.freeze(this.requests.map(request=>Object.freeze({...request,...this.measured.get(requestKey(request))!}))):null,error:this.error});
  }
}
