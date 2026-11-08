import type {NativeViewportChange} from './data-options.js';
import type {PlanViewportValue} from './plan.js';
import type {NativeChartPanelViewportChange,NativeChartPanelDiagnostic,NativeChartPanelsVisibility} from './chart-panels-options.js';
import type {OwnedChartPanels,NativeChartPanelRender} from './chart-panels-state.js';
import {panelViewportValue,panelXKey,type PanelXWindow} from './panel-viewport-contract.js';

export interface NativeChartPanelActivation extends NativeChartPanelRender {readonly epoch:object;readonly epochKey:string;}
/** Only data/coordinate ownership changes replace a child view. Theme, text,
 * colors and other presentation updates keep the same activation token. */
export function panelActivations(owned:OwnedChartPanels,previous:readonly NativeChartPanelActivation[]=[]):readonly NativeChartPanelActivation[]{
  return owned.panels.map(panel=>{
    const contract=owned.viewports.get(panel.id),link=owned.viewportLinks.find(link=>link.panelIds.includes(panel.id)),epochKey=contract?JSON.stringify([contract.epochKey,link?.id,link?.panelIds]):'',prior=previous.find(p=>p.id===panel.id);
    return {...panel,options:owned.options.get(panel.id)!,epochKey,epoch:prior?.data===panel.data&&prior.epochKey===epochKey?prior.epoch:{}};
  });
}
interface Request {readonly revision:number;readonly value:PlanViewportValue;echoed:boolean;}
interface State {readonly epoch:object;readonly initial:PlanViewportValue;value:PlanViewportValue;hiddenKey:string;pending:Request|null;applying:Request|null;}
export interface PanelViewportPort {setViewport(value:PlanViewportValue):boolean;}
const withX=(value:PlanViewportValue,x:PanelXWindow):PlanViewportValue=>Object.freeze({...(value.y===undefined?{}:{y:value.y}),...(x===undefined?{}:{x})});

/** Bounded coordination only: the initiating child has already committed;
 * each affected peer receives one public setViewport call, never a new planner. */
export class PanelViewportSync {
  private owned:OwnedChartPanels|null=null;
  private readonly states=new Map<string,State>();
  private revision=0;
  clear():void{this.owned=null;this.states.clear();}
  reconcile(owned:OwnedChartPanels,panels:readonly NativeChartPanelActivation[],visibility:NativeChartPanelsVisibility):void{
    this.owned=owned;const reset=new Set<string>(),ids=new Set(panels.map(p=>p.id));
    for(const id of this.states.keys())if(!ids.has(id))this.states.delete(id);
    for(const panel of panels){
      const old=this.states.get(panel.id),hiddenKey=JSON.stringify(Object.getOwnPropertyDescriptor(visibility,panel.id)?.value??[]);
      if(!old||old.epoch!==panel.epoch){
        const initial=panelViewportValue(owned.viewports.get(panel.id)?.initial??panel.options.viewport?.initial??{});
        this.states.set(panel.id,{epoch:panel.epoch,initial,value:initial,hiddenKey,pending:null,applying:null});reset.add(panel.id);
      }else if(old.hiddenKey!==hiddenKey){old.hiddenKey=hiddenKey;old.value=old.initial;old.pending=null;old.applying=null;reset.add(panel.id);}
    }
    // Data/legend changes follow the child's existing initial-window reset.
    // Unchanged peers retain their independent Y interval.
    for(const link of owned.viewportLinks)if(link.panelIds.some(id=>reset.has(id))){const initial=owned.viewports.get(link.panelIds[0]!)!.initial;this.queue(link.panelIds,initial.x);}
  }
  accept(panelId:string,epoch:object,event:NativeViewportChange):NativeChartPanelViewportChange|null{
    const state=this.states.get(panelId);if(!state||state.epoch!==epoch||!this.owned)return null;
    const value=panelViewportValue(event.value),xKey=panelXKey(value.x),applying=state.applying;
    if(applying&&event.source==='api'&&panelXKey(applying.value.x)===xKey){applying.echoed=true;state.value=value;return null;}
    const priorX=panelXKey(state.value.x),pending=state.pending;state.value=value;
    state.pending=pending&&priorX===xKey?{...pending,value:withX(value,pending.value.x)}:null;
    const link=this.owned.viewportLinks.find(link=>link.panelIds.includes(panelId));
    const revision=++this.revision;if(link&&priorX!==xKey)this.queue(link.panelIds.filter(id=>id!==panelId),value.x,revision);
    return {panelId,change:{value,source:event.source},linkId:link?.id??null,revision};
  }
  private queue(panelIds:readonly string[],x:PanelXWindow,revision=++this.revision):void{
    for(const id of panelIds){const state=this.states.get(id);if(!state)continue;
      state.pending=panelXKey(state.value.x)===panelXKey(x)?null:{revision,value:withX(state.value,x),echoed:false};
    }
  }
  flush(panelId:string,epoch:object,port:PanelViewportPort):NativeChartPanelDiagnostic|null{
    const state=this.states.get(panelId),request=state?.pending;if(!state||state.epoch!==epoch||!request)return null;
    state.pending=null;state.applying=request;
    try{
      if(!port.setViewport(request.value))return {panelId,diagnostic:{code:'INVALID_CONFIG',reason:'PANEL_VIEWPORT_REJECTED',path:'data.viewportLinks',message:'The linked chart could not accept this X window; its last valid viewport is retained.'}};
      if(!request.echoed)state.value=request.value;
      return null;
    }catch{return {panelId,diagnostic:{code:'INVALID_CONFIG',reason:'PANEL_VIEWPORT_REJECTED',path:'data.viewportLinks',message:'The linked chart could not commit this X window; its last valid viewport is retained.'}};
    }finally{if(state.applying===request)state.applying=null;}
  }
}
