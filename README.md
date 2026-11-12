# Neural Charts Native

Native charts for Angular Native apps on iOS and Android. The beta includes 62 chart families with typed data and options, touch selection, tooltips, legends and accessible navigation. The shared Neural Charts Core calculates scales and geometry. Neural Charts Native renders them and handles interaction on the device.

**[Open the documentation and interactive demos](https://charts-native.neuralui.org/)**

## Get started

Start with Angular 22.2 or later in the 22.x series, Angular Native 0.22.2, Expo SDK 58 (58.0.16 or later within 58.0.x), React Native 0.88.x and `react-native-svg` 15.15.4. This host can also install Neural Native 0.1.0-beta.7. Expo Go for SDK 58 ships with SVG 15.16.0, so build your app with SVG 15.15.4. Use the Angular Native Metro preset and a `GestureRoot`. Follow the [installation guide](https://charts-native.neuralui.org/docs/installation).

Install the beta in your app:

```sh
npm install @neural-charts/native@beta
```

Core is installed as a pinned dependency. The chart package declares Angular, Angular Native and the Expo/React Native modules it uses as peers.

If an iOS build of `NgNativeExpo` fails with `Unable to resolve module dependency: ExpoModulesCore`, Expo SDK 58 supports building its modules from source. Install `expo-build-properties` with `npx expo install expo-build-properties` and set `ios.usePrecompiledModules` to `false` in that plugin's options. Regenerate the iOS project and rebuild. [Expo SDK 58 BuildProperties](https://docs.expo.dev/versions/v58.0.0/sdk/build-properties/)

In your screen's TypeScript file, import `NativeDataChart`, register it in the component's `imports` and bind the chart's data and options. This example receives the line data from its parent.

```ts
import {Component, input} from '@angular/core';
import {NativeDataChart, type NativeChartOptions, type NativeLineData}
  from '@neural-charts/native';

@Component({
  selector: 'app-example-chart',
  imports: [NativeDataChart],
  template: '<neu-c-chart [data]="data()" [options]="options" />',
})
export class ExampleChart {
  readonly data = input.required<NativeLineData>();
  readonly options = {
    axes: {grid: true, x: {title: 'Day'}, y: {title: 'Visits'}},
    legend: {visible: true, position: 'bottom'},
    tooltip: {content: 'shared'},
  } as const satisfies NativeChartOptions<'line'>;
}
```

[Open the line demo](https://charts-native.neuralui.org/charts/line/basic) for runnable data and code. The code accordion follows the selected example and its configuration.

## API

| Entry point | Use |
| --- | --- |
| `@neural-charts/native` | Components and types for data, options and events. Start with `NativeDataChart` and `<neu-c-chart>`. |
| `@neural-charts/native/plan` | Plan a native scene from typed source data. |
| `@neural-charts/native/interaction` | Work with projected scenes and the renderer-independent selection session. |

Use `<neu-c-panels>` for coordinated charts and `<neu-c-drilldown>` for navigation through related datasets. Listen to `interactionChange` for selection updates and `planningError` for invalid data or options.

[Component API](https://charts-native.neuralui.org/docs/api) · [Chart catalog](https://charts-native.neuralui.org/docs/catalog) · [Accessibility](https://charts-native.neuralui.org/docs/accessibility)

The web demos render the chart with browser input. Haptic feedback is available in the installed native app.

## Test your charts

Use Vitest and `@ng-native/testing` to check selection, legend visibility and invalid data in your app. The [testing guide](https://charts-native.neuralui.org/docs/testing) includes the setup and a complete spec to copy.

## Develop the library

Run `npm ci` followed by `npm run verify` to compile the library, run the package tests and validate the distribution. The package checks build a fresh distribution. CI also packs the beta, installs it with Neural Native in a clean consumer using npm's peer resolution, and checks the chart screen with Angular's strict template compiler. The source is published with the package license field `UNLICENSED`. Third-party terms are recorded in [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md).
