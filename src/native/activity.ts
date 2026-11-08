import {DestroyRef,Injectable,inject,signal,untracked} from '@angular/core';
import {AppState} from '@ng-native/device';

/** Use Angular Native's platform source, shared by all chart instances. */
export const CHART_ACTIVITY_ENVIRONMENT=AppState.SOURCE;
@Injectable({providedIn:'root'})
export class ChartActivity {
  private readonly source=inject(CHART_ACTIVITY_ENVIRONMENT);
  private readonly value=signal(this.source.current()==='active');
  private readonly listeners=new Set<()=>void>();
  readonly active=this.value.asReadonly();
  onSuspend(listener:()=>void):()=>void{this.listeners.add(listener);return ()=>{this.listeners.delete(listener);};}
  constructor(){
    const unsubscribe=this.source.subscribe(status=>{
      const active=status==='active',suspending=this.value()&&!active;
      this.value.set(active);
      // Native may stop rendering frames before an Angular effect can run.
      if(suspending)untracked(()=>{for(const listener of this.listeners)listener();});
    });
    inject(DestroyRef).onDestroy(()=>{unsubscribe();this.listeners.clear();});
  }
}
