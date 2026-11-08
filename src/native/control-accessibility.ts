const enabledState=Object.freeze({disabled:false});
const disabledState=Object.freeze({disabled:true});

/** Keep false explicit when a control becomes usable again. Omitting the state
 * can leave the previous native accessibility disabled flag in place. Shared
 * immutable objects avoid allocations while exploring observations. */
export function controlAccessibilityState(disabled:boolean):Readonly<{disabled:boolean}>{
  return disabled?disabledState:enabledState;
}
