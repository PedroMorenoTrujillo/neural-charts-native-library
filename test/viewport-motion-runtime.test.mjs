import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import test from 'node:test';

const viewportMotionUrl = new URL('../dist/native/viewport-motion.js', import.meta.url);
const platform = {
  '@ng-native/components/reanimated': `
    export const sharedValue = initial => ({
      value: initial,
      get() { return this.value; },
      set(value) { this.value = value; },
    });
    export const workletStyle = (values, result) => () => result(...values);
  `,
  'react-native-gesture-handler': `
    function recognizer() {
      const port = { handlers: {}, options: {} };
      for (const option of ['enabled', 'runOnJS', 'minPointers', 'maxPointers', 'minDistance', 'averageTouches', 'simultaneousWithExternalGesture']) {
        port[option] = value => { port.options[option] = value; return port; };
      }
      for (const event of ['onStart', 'onUpdate', 'onFinalize']) {
        port[event] = callback => { port.handlers[event] = callback; return port; };
      }
      return port;
    }
    export const Gesture = { Pinch: recognizer, Pan: recognizer, Simultaneous: (...ports) => ports };
  `,
  'react-native-worklets': `
    const pending = [];
    export const scheduleOnRN = (callback, ...args) => pending.push(() => callback(...args));
    export const drain = () => { for (const cue of pending.splice(0)) cue(); };
  `,
};
const moduleUrl = source => 'data:text/javascript,' + encodeURIComponent(source);
const hook = registerHooks({
  resolve(specifier, context, next) {
    const source = context.parentURL === viewportMotionUrl.href && platform[specifier];
    return source ? { url: moduleUrl(source), shortCircuit: true } : next(specifier, context);
  },
});
let NativeViewportMotion;
try {
  ({ NativeViewportMotion } = await import(viewportMotionUrl.href));
} finally {
  hook.deregister();
}
const { drain } = await import(moduleUrl(platform['react-native-worklets']));

const defaults = { width: 200, height: 100, horizontal: true, vertical: true, pinch: true, pan: true, enabled: true };
const pinchAt = (scale, numberOfPointers = 2) => ({ scale, numberOfPointers, focalX: 120, focalY: 25 });
const panAt = (translationX, translationY, numberOfPointers = 2) => ({ translationX, translationY, numberOfPointers, x: 120, y: 25 });

function fixture(t) {
  const motion = new NativeViewportMotion();
  const events = [];
  const callbacks = {
    begin: () => events.push({ type: 'begin' }),
    end: (frame, success, source) => events.push({ frame, success, source }),
  };
  t.after(() => { motion.destroy(); drain(); });
  return { motion, events, callbacks };
}

test('Native motion joins pinch and pan, holds its preview, then commits its original affine frame once', t => {
  const { motion, events, callbacks } = fixture(t);
  const scroll = {};
  const [pinch, pan] = motion.gesture({ ...defaults, horizontal: false, maximumScale: 2 }, callbacks, scroll);
  assert.equal(pinch.options.simultaneousWithExternalGesture, scroll);
  assert.equal(pan.options.simultaneousWithExternalGesture, scroll);
  pinch.handlers.onUpdate(pinchAt(9));
  pan.handlers.onUpdate(panAt(5, 10));
  pinch.handlers.onFinalize({}, true);
  pan.handlers.onFinalize({}, true);
  pinch.handlers.onStart(pinchAt(1, 1));
  drain();
  assert.deepEqual(events, []);
  pan.handlers.onStart(panAt(0, 0));
  pinch.handlers.onStart(pinchAt(1));
  pinch.handlers.onUpdate(pinchAt(9));
  pan.handlers.onUpdate(panAt(5, 10));
  drain();
  assert.deepEqual(events, [{ type: 'begin' }]);
  assert.equal(motion.styles.native.base().opacity, 1);
  motion.show();
  assert.equal(motion.styles.native.base().opacity, 0);
  assert.deepEqual(motion.styles.native.preview(), {
    opacity: 1, transform: [{ translateX: 0 }, { translateY: 35 }, { scaleX: 1 }, { scaleY: 2 }],
  });
  pan.handlers.onFinalize({}, true);
  drain();
  assert.equal(events.length, 1);
  pinch.handlers.onFinalize({}, true);
  drain();
  assert.deepEqual(events[1], { frame: { scale: 2, x: 120, y: 25, dx: 0, dy: 10 }, success: true, source: 'pinch' });
  pinch.handlers.onStart(pinchAt(1));
  drain();
  assert.equal(events.length, 2);
  assert.equal(motion.styles.native.preview().opacity, 1);
  motion.finish();
  assert.equal(motion.styles.native.preview().opacity, 0);
  assert.equal(motion.styles.native.base().opacity, 1);
});

test('Native motion cancels malformed frames and revokes queued callbacks when configured again or destroyed', t => {
  const { motion, events, callbacks } = fixture(t);
  const [pinch, pan] = motion.gesture(defaults, callbacks);
  pinch.handlers.onStart(pinchAt(1));
  pinch.handlers.onUpdate(pinchAt(Infinity));
  pinch.handlers.onUpdate(pinchAt(2));
  pinch.handlers.onFinalize({}, true);
  drain();
  assert.deepEqual(events.at(-1), {
    frame: { scale: 1, x: 120, y: 25, dx: 0, dy: 0 }, success: false, source: 'pinch',
  });
  pan.handlers.onStart(panAt(0, 0));
  pan.handlers.onUpdate(panAt(50, 50, 3));
  pan.handlers.onUpdate(panAt(20, 20));
  pan.handlers.onFinalize({}, true);
  drain();
  assert.deepEqual(events.at(-1), {
    frame: { scale: 1, x: 120, y: 25, dx: 0, dy: 0 }, success: false, source: 'pan',
  });
  pan.handlers.onStart(panAt(0, 0));
  motion.show();
  assert.equal(motion.styles.native.preview().opacity, 1);
  const [newPinch, newPan] = motion.gesture({ ...defaults, pan: false, vertical: false }, callbacks);
  assert.equal(motion.styles.native.preview().opacity, 0);
  assert.equal(newPan.options.enabled, true);
  pan.handlers.onUpdate(panAt(90, 90));
  pinch.handlers.onUpdate(pinchAt(2));
  pan.handlers.onFinalize({}, true);
  drain();
  assert.equal(events.length, 4);
  newPinch.handlers.onStart(pinchAt(1));
  newPinch.handlers.onUpdate(pinchAt(1, 3));
  newPinch.handlers.onFinalize({}, true);
  drain();
  assert.equal(events.at(-1).success, false);
  newPan.handlers.onStart(panAt(0, 0));
  newPan.handlers.onUpdate(panAt(10, 10));
  newPan.handlers.onFinalize({}, true);
  drain();
  assert.deepEqual(events.at(-1), {
    frame: { scale: 1, x: 120, y: 25, dx: 0, dy: 0 }, success: true, source: 'pan',
  });
  motion.finish();
  newPinch.handlers.onStart(pinchAt(1));
  motion.destroy();
  drain();
  assert.equal(events.length, 8);
});

test('Native motion constrains a programmatic preview to enabled axes and motion settings', t => {
  const { motion } = fixture(t);
  assert.deepEqual(motion.styles.native.preview(), {
    opacity: 0, transform: [{ translateX: 0 }, { translateY: 0 }, { scaleX: 1 }, { scaleY: 1 }],
  });
  const frame = { scale: 8, x: 125, y: 20, dx: 10, dy: 15 };
  motion.preview(frame, { ...defaults, horizontal: false, maximumScale: 3 });
  motion.show();
  assert.deepEqual(motion.styles.native.preview(), {
    opacity: 1, transform: [{ translateX: 0 }, { translateY: 75 }, { scaleX: 1 }, { scaleY: 3 }],
  });
  motion.finish();
  motion.preview(frame, { ...defaults, vertical: false, pinch: false });
  motion.show();
  assert.deepEqual(motion.styles.native.preview(), {
    opacity: 1, transform: [{ translateX: 10 }, { translateY: 0 }, { scaleX: 1 }, { scaleY: 1 }],
  });
  motion.finish();
  motion.preview(frame, { ...defaults, pan: false });
  motion.show();
  assert.deepEqual(motion.styles.native.preview(), {
    opacity: 1, transform: [{ translateX: -75 }, { translateY: 90 }, { scaleX: 4 }, { scaleY: 4 }],
  });
});
