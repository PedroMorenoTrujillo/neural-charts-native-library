import { DestroyRef, Injectable, InjectionToken, inject } from '@angular/core';
import { Accessibility } from '@ng-native/device';
import { Haptics } from '@ng-native/expo/haptics';
import type { HapticPort } from '../library/contracts.js';

export interface NativeHapticEnvironment {
  supported(): boolean;
  active(): boolean;
  lowPower(): boolean;
  selection(): void | Promise<void>;
  destroy(): void;
}

/** Platform imports stay in the adapter and are lazy, replaceable in fake-Fabric tests. */
export const HAPTIC_ENVIRONMENT = new InjectionToken<NativeHapticEnvironment>('native-chart-haptics', {
  factory: () => {
    const haptics = inject(Haptics);
    const subscriptions: {remove(): void}[] = [];
    const stop = () => { for (const subscription of subscriptions.splice(0)) subscription.remove(); };
    try {
    const {Platform, AppState} = require('react-native') as typeof import('react-native');
    const device = require('expo-device') as typeof import('expo-device');
    const battery = require('expo-battery') as typeof import('expo-battery');
    const android = require('expo-haptics') as typeof import('expo-haptics');
    let alive = true;
    let lowPower: boolean | null = null;
    const refresh = () => { void battery.isLowPowerModeEnabledAsync().then(v => {if (alive) lowPower = v;}).catch(() => {}); };
    refresh();
    const batterySubscription = battery.addLowPowerModeListener(e => { lowPower = e.lowPowerMode; });
    subscriptions.push(batterySubscription);
    const appSubscription = AppState.addEventListener('change', state => { if (state === 'active') refresh(); });
    subscriptions.push(appSubscription);
    return {
      supported: () => device.isDevice && haptics.available && (Platform.OS === 'ios' || Platform.OS === 'android'),
      active: () => AppState.currentState === 'active',
      // Unknown battery state is conservatively silent.
      lowPower: () => lowPower !== false,
      selection: () => Platform.OS === 'android'
        // Uses View.performHapticFeedback with no IGNORE_GLOBAL_SETTING flag, unlike Vibrator.
        ? android.performAndroidHapticsAsync(android.AndroidHaptics.Segment_Frequent_Tick)
        : haptics.select(),
      destroy: () => { alive = false; stop(); },
    };
    } catch {
      stop();
      // A peer can be installed in JS yet absent from a development build's native binary.
      return {supported: () => false, active: () => false, lowPower: () => true, selection: () => {}, destroy: () => {}};
    }
  },
});

@Injectable({providedIn: 'root'})
export class ChartHaptics {
  private readonly environment = inject(HAPTIC_ENVIRONMENT);
  private readonly accessibility = inject(Accessibility);
  constructor() { inject(DestroyRef).onDestroy(() => this.environment.destroy()); }
  port(enabled: () => boolean): HapticPort {
    let lastRequest = -Infinity;
    return {
      allowed: () => enabled() && this.environment.supported() && this.environment.active()
        && !this.environment.lowPower() && !this.accessibility.reduceMotion()
        && performance.now() - lastRequest >= 45,
      selection: () => { lastRequest = performance.now(); return this.environment.selection(); },
    };
  }
}
