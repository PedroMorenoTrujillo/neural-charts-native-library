import '@angular/compiler';
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createEnvironmentInjector, runInInjectionContext, signal} from '@angular/core';
import {Haptics} from '@ng-native/expo/haptics';
import {HAPTIC_ENVIRONMENT} from '../dist/native/haptics.js';

test('the native haptic adapter follows the framework availability signal', async t => {
  const available = signal(false);
  const select = t.mock.fn();
  const remove = t.mock.fn();
  const modules = {
    'react-native': {
      Platform: {OS: 'ios'},
      AppState: {currentState: 'active', addEventListener: () => ({remove})},
    },
    'expo-device': {isDevice: true},
    'expo-battery': {
      isLowPowerModeEnabledAsync: async () => false,
      addLowPowerModeListener: () => ({remove}),
    },
    'expo-haptics': {},
  };
  const originalRequire = Object.getOwnPropertyDescriptor(globalThis, 'require');
  Object.defineProperty(globalThis, 'require', {
    configurable: true,
    value: name => {
      assert.ok(name in modules, 'Unexpected native module ' + name);
      return modules[name];
    },
  });
  const injector = createEnvironmentInjector([{provide: Haptics, useValue: {available, select}}]);
  let environment;
  try {
    environment = runInInjectionContext(injector, () => HAPTIC_ENVIRONMENT.ɵprov.factory());
    await Promise.resolve();
    assert.equal(environment.supported(), false);
    available.set(true);
    assert.equal(environment.supported(), true);
    environment.selection();
    assert.equal(select.mock.callCount(), 1);
    available.set(false);
    assert.equal(environment.supported(), false);
  } finally {
    environment?.destroy();
    injector.destroy();
    if (originalRequire) Object.defineProperty(globalThis, 'require', originalRequire);
    else delete globalThis.require;
  }
  assert.equal(remove.mock.callCount(), 2);
});
