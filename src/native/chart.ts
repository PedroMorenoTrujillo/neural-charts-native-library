import {dendrogramLabels} from './dendrogram-labels.js';
import {controlAccessibilityState} from './control-accessibility.js';
import {parallelLabels} from './parallel-labels.js';
import {CHART_TOOLTIP_MOTION_FACTORY} from './tooltip-motion.js';
import {tooltipOccupancy} from './tooltip-occupancy.js';
import {chartCapabilities} from '../library/chart-capabilities.js';
import {forcedLabelLimit,nativeValueLabels} from './value-labels.js';
import type {NativeLabelLayout} from './data-options.js';
import {LabelHalo} from './label-halo.js';
import {chartEmptyState} from '../library/empty-state.js';
import {labelInk} from './label-ink.js';
import { Component, DestroyRef, ElementRef, type TemplateRef, computed, effect, inject, input, output, signal, untracked, viewChild } from '@angular/core';
import {NgTemplateOutlet} from '@angular/common';
import { Pressable, Text, View, ScrollView, type LayoutEvent, type ScrollEvent } from '@ng-native/components';
import { NativeGesture } from '@ng-native/components/gestures';
import {AnimatedStyle} from '@ng-native/components/animations';
import {WorkletStyle} from '@ng-native/components/reanimated';
import {CHART_MOTION_FACTORY} from './chart-motion.ts';
import {NativeRadialLayer} from './radial-layer.ts';
import {radialEntrance} from './radial-entrance.ts';
import {bubbleEntrance} from './bubble-entrance.ts';
import {WordCloudLayer} from './wordcloud-layer.js';
import {NativeTilemapColorAxis} from './tilemap-color-axis.js';
import {NativeLegend} from './legend.ts';
import { Accessibility, ColorScheme } from '@ng-native/device';
import { NgIcon } from '@ng-native/icons';
import { Gesture } from 'react-native-gesture-handler';
import type { NativeScene, InteractionSnapshot, TooltipMode, TooltipContent, LegendPosition,NativeMarkerStyle,NativeTextStyleOptions } from '../library/contracts.js';
import { NativeChartSession } from '../library/interaction.js';
import { ownScene, sceneSvg, sceneTransform,sceneMotionSignature,sceneInteractionKey,sameScenePaint } from '../library/scene.js';
import {observationValue,observationUnit,directionalDetails} from './observation-format.js';
import {tilemapCircleOutline} from './tilemap-selection.js';
import {sectorSelectionOutline} from './selection-outlines.js';
import { NativeTooltip } from './tooltip.ts';
import {tooltipLayout} from './tooltip-layout.ts';
import type {NativeChartAxisLabelContext,NativeChartLabelFormatters,NativeChartTooltipContext} from './chart-presentation.js';
import {compactTooltipHeight} from './tooltip-metrics.ts';
import type {NativeViewportContext,NativeViewportRequest} from './viewport-state.js';
import {transformPlanViewport,type PlanViewportIntent} from './plan.js';
import {sameViewportValue} from './viewport-state.js';
import {viewportCanvas,viewportGestureRequest,viewportScaleLimit} from './viewport-gestures.js';
import type {ViewportGestureFrame} from './viewport-gestures.js';
import {CHART_VIEWPORT_MOTION_FACTORY,type ViewportMotion,type ViewportGestureConfig} from './viewport-motion.js';
import {nativeReferenceLabels} from './reference-labels.js';
import {pointOverrideColor} from '../library/scene-paint.js';
import {sameInteractionContent} from '../library/interaction-content.js';
import {chartNumberFormatter} from './number-format.ts';
import {variwideAxisLabels} from './variwide-labels.js';
import {barCategoryLabels} from './bar-labels.ts';
import { ChartHaptics } from './haptics.ts';
import {ChartActivity} from './activity.js';
import {inputLease,pointLease} from './input-lease.js';
import {resolveMarkerStyle,sameMarkerStyle,markerSvg} from '../library/marker-style.js';
import {nativeTextStyle,sameTextStyle} from './text-style.js';
import { CHART_INPUT_BRIDGE } from './input-bridge.ts';

@Component({
  selector: 'neu-c-scene, nc-native-chart',
  host: {'[style.backgroundColor]':"dark() ? '#101C2C' : '#FFFFFF'"},
  imports: [LabelHalo,WordCloudLayer,View, Text, Pressable, ScrollView, NativeGesture, NgIcon, NativeTooltip,NativeLegend,NativeTilemapColorAxis,NativeRadialLayer,AnimatedStyle,WorkletStyle,NgTemplateOutlet],
  template: `
    @if(renderActive()){
    @if(scene().title){<text class="chart-title" testID="native-chart-title" [style.color]="titleAppearance().color" [style.textAlign]="titleAppearance().textAlign" [style.fontSize]="titleAppearance().fontSize" [style.fontWeight]="titleAppearance().fontWeight" [style.lineHeight.px]="titleAppearance().lineHeight" accessibilityRole="header">{{ scene().title }}</text>}
    @if(scene().description){<text class="description" testID="native-chart-subtitle" [style.color]="subtitleAppearance().color" [style.textAlign]="subtitleAppearance().textAlign" [style.fontSize]="subtitleAppearance().fontSize" [style.fontWeight]="subtitleAppearance().fontWeight" [style.lineHeight.px]="subtitleAppearance().lineHeight">{{ scene().description }}</text>}
    @if(missingSourceCount()){<text class="description" testID="chart-missing-source" [style.color]="muted()">{{missingSourceLabel()}}</text>}
    @if(scene().variwideLayout?.status==='no-positive-width'){<text class="description" testID="chart-empty-proportional" [style.color]="muted()">{{locale()==='en'?'No positive source widths: proportional areas cannot be drawn. Original values remain available.':'No hay anchos originales positivos: no se pueden dibujar áreas proporcionales. Se conservan los valores originales.'}}</text>}
    @if (showLegend() && scene().family!=='gauge' && effectiveLegendPosition() === 'top') {<nc-native-legend [items]="legendItems()" [interactive]="legendInteractive()&&!!ownedScene().legend" [locale]="locale()" [ink]="ink()" [muted]="muted()" (toggle)="toggleLegend($event)"/>}
    <view class="chart-body" testID="chart-layout-body" (layout)="measureBody($event)">
    @if(showLegend()&&scene().family!=='gauge'&&effectiveLegendPosition()==='left'){<nc-native-legend class="side-legend" testID="chart-side-legend" [items]="legendItems()" [vertical]="true" [maximumHeight]="boundedHeight()+40" [interactive]="legendInteractive()&&!!ownedScene().legend" [locale]="locale()" [ink]="ink()" [muted]="muted()" (toggle)="toggleLegend($event)"/>}
    <view class="chart-body-main">
    @if(hasAxes()&&showYAxis()&&yAxisTitle()||secondaryAxisVisible()&&secondaryYAxisTitle()){<view class="axis-titles">@if (hasAxes() && showYAxis() && yAxisTitle()) {<text class="axis-title" [style.flex]="1" testID="chart-y-axis-title" [style.color]="yTitleAppearance().color" [style.textAlign]="yTitleAppearance().textAlign" [style.fontSize]="yTitleAppearance().fontSize" [style.fontWeight]="yTitleAppearance().fontWeight" [style.lineHeight.px]="yTitleAppearance().lineHeight">{{ yAxisTitle() }}</text>}@if(secondaryAxisVisible()&&secondaryYAxisTitle()){<text class="axis-title" testID="chart-secondary-y-axis-title" [style.flex]="1" [style.color]="secondaryTitleAppearance().color" [style.textAlign]="secondaryTitleAppearance().textAlign" [style.fontSize]="secondaryTitleAppearance().fontSize" [style.fontWeight]="secondaryTitleAppearance().fontWeight" [style.lineHeight.px]="secondaryTitleAppearance().lineHeight">{{secondaryYAxisTitle()}}</text>}</view>}
    <view class="chart-frame" [style.height]="boundedHeight()+(cartesian()&&showXAxis()?40:0)">
      @if (cartesian() && displayedYAxis()) {
      <view class="y-axis" testID="chart-y-axis" [style.width]="primaryAxisWidth()" [class.bar-y-axis]="horizontalBars()||scene().family==='heatmap'" [class.temporal-y-axis]="temporalYAxis()" [accessible]="false">
        @if (categoryYAxis()) {
          @for (point of displayedCategoryLabels(); track point.id) {
            <view class="category-tick" [style.height]="categoryLabelHeight()" [style.width]="axisLabelLayout()==='all'?primaryAxisWidth()-18:undefined" [style.top]="mapY(point.y)-categoryLabelHeight()/2"><text class="category-label" [numberOfLines]="axisLabelLayout()==='truncate'||accessibility.fontScale()>1.5?1:2" [accessibilityLabel]="point.label" [style.color]="muted()">{{ point.label }}</text></view>
          }
        }
        @for (tick of primaryYTicks(); track tick.y) {
          @if(tick.label){<text class="y-tick" [numberOfLines]="axisLabelLayout()==='truncate'?1:undefined" [style.width]="axisLabelLayout()==='truncate'?primaryAxisWidth()-12:undefined" [style.textAlign]="axisLabelLayout()==='truncate'?'right':undefined" [style.color]="muted()" [style.top]="mapY(tick.y)">{{ tick.label }}</text>}
        }
      </view>
      }
      <scroll-view #plotScroller class="plot-scroll" testID="chart-scroll-viewport" [horizontal]="true" [gesture]="scrollGesture()" [scrollEnabled]="scrolling()&&!viewportInteracting()" [nestedScrollEnabled]="true" [showsHorizontalScrollIndicator]="false" [showsVerticalScrollIndicator]="false" [scrollEventThrottle]="16" [contentContainerStyle]="scrollContentStyle" (layout)="measureScroll($event)" (scroll)="scrollPlot($event)" [accessibilityLabel]="locale()==='en'?'Chart data':'Datos de la gráfica'">
      <view class="plot-content" [style.width]="contentWidth()||undefined" [style.minWidth]="boundedMinimumWidth()">
      <view #plot class="plot" [style.height]="boundedHeight()" testID="native-chart-plot" (layout)="measure($event)" [gesture]="gesture()"
        [accessible]="true" accessibilityRole="adjustable"
        [accessibilityLabel]="scene().title || (locale()==='en'?'Chart':'Gráfica')" [accessibilityValue]="accessibilityValue()"
        [accessibilityState]="{disabled:pinned()||ownedScene().observations.length===0}"
        [accessibilityHint]="accessibilityHint()"
        [accessibilityActions]="actions()" (accessibilityAction)="adjust($event)">
        @if(viewportDriver()?.styles?.native;as viewportStyles){<view class="motion-layer" [collapsable]="false" [workletStyle]="viewportStyles.base"><ng-container [ngTemplateOutlet]="chartVisuals"/></view>}
        @else if(viewportDriver()?.styles?.browser;as viewportStyles){<view class="motion-layer" [animatedStyle]="viewportStyles.base"><ng-container [ngTemplateOutlet]="chartVisuals"/></view>}
        @else{<ng-container [ngTemplateOutlet]="chartVisuals"/>}
        <ng-template #chartVisuals>
        <view class="motion-layer" testID="chart-decorative-geometry" [collapsable]="false" [accessible]="false" [accessibilityElementsHidden]="true" importantForAccessibility="no-hide-descendants" pointerEvents="none">
        <ng-icon class="geometry grid-geometry" [svg]="gridDrawing()" />
        @if(previousDrawing();as previous){
          @if(motionStyles().native?.previous;as style){<view class="motion-layer" testID="chart-previous-geometry" [collapsable]="false" [workletStyle]="style" pointerEvents="none"><ng-icon class="geometry" [svg]="previous"/></view>}
          @else if(motionStyles().browser?.previous;as style){<view class="motion-layer" testID="chart-previous-geometry" [animatedStyle]="style" pointerEvents="none"><ng-icon class="geometry" [svg]="previous"/></view>}
        }
        @if(motionStyles().native;as styles){
          <view class="motion-layer motion-clip" [collapsable]="false" [workletStyle]="styles.clip" pointerEvents="none"><view class="motion-layer" testID="chart-current-geometry" [collapsable]="false" [workletStyle]="styles.geometry" pointerEvents="none"><ng-icon class="geometry" [svg]="drawing()" />@if(scene().family==='wordcloud'){<nc-wordcloud-layer [scene]="paintScene()" [viewport]="viewport()" [surface]="dark()?'#101C2C':'#FFFFFF'"/>}</view></view>
        }@else if(motionStyles().browser;as styles){
          <view class="motion-layer motion-clip" [animatedStyle]="styles.clip" pointerEvents="none"><view class="motion-layer" testID="chart-current-geometry" [animatedStyle]="styles.geometry" pointerEvents="none"><ng-icon class="geometry" [svg]="drawing()" />@if(scene().family==='wordcloud'){<nc-wordcloud-layer [scene]="paintScene()" [viewport]="viewport()" [surface]="dark()?'#101C2C':'#FFFFFF'"/>}</view></view>
        }
        @if(radialLayout();as radial){
          @if(motionStyles().native?.entranceVisibility;as visibility){<view class="motion-layer" [collapsable]="false" [workletStyle]="visibility" pointerEvents="none"><nc-chart-radial-layer [layout]="radial" [drawing]="drawing()" [native]="motionStyles().native?.radial"/></view>}
          @else if(motionStyles().browser?.entranceVisibility;as visibility){<view class="motion-layer" [animatedStyle]="visibility" pointerEvents="none"><nc-chart-radial-layer [layout]="radial" [drawing]="drawing()" [browser]="motionStyles().browser?.radial"/></view>}
        }
        @if(bubbleLayout();as bubbles){
          @if(motionStyles().native?.entranceVisibility;as visibility){<view class="motion-layer" [collapsable]="false" [workletStyle]="visibility" pointerEvents="none">@for(bubble of bubbles;track bubble.id){<view class="bubble-entrance" [collapsable]="false" [style.left]="bubble.left" [style.top]="bubble.top" [style.width]="bubble.size" [style.height]="bubble.size" [workletStyle]="motionStyles().native!.bubble!" pointerEvents="none"><ng-icon class="geometry" [svg]="bubble.drawing"/></view>}</view>}
          @else if(motionStyles().browser?.entranceVisibility;as visibility){<view class="motion-layer" [animatedStyle]="visibility" pointerEvents="none">@for(bubble of bubbles;track bubble.id){<view class="bubble-entrance" [style.left]="bubble.left" [style.top]="bubble.top" [style.width]="bubble.size" [style.height]="bubble.size" [animatedStyle]="motionStyles().browser!.bubble!" pointerEvents="none"><ng-icon class="geometry" [svg]="bubble.drawing"/></view>}</view>}
        }
        @if(gaugeParts()){<ng-icon class="geometry grid-geometry" [svg]="gaugeOverlayDrawing()"/>}
        @if(scene().references?.length||scene().bulletTargets?.length){<ng-icon class="geometry grid-geometry" testID="chart-reference-lines" [svg]="referenceDrawing()"/>}
        </view>
        @for(label of referenceLabels();track label.id){<text class="reference-label" [style.left]="label.x" [style.top]="label.y" [style.width]="label.width" [style.height]="label.height" [style.color]="label.color" [style.backgroundColor]="label.backgroundColor??'transparent'" [style.paddingLeft]="label.backgroundColor?6:0" [style.paddingRight]="label.backgroundColor?6:0" [style.borderRadius]="label.backgroundColor?3:0" [numberOfLines]="1" pointerEvents="none">{{label.text}}</text>}
        @if(activeTile();as tile){<view class="active-tile" testID="chart-active-tile" [style.left]="mapX(tile.x)" [style.top]="mapY(tile.y)" [style.width]="tile.width*transform().sx" [style.height]="tile.height*transform().sy" [style.borderColor]="dark()?'#FFFFFF':'#172438'" pointerEvents="none"/>}
        @if (state().active; as point) {
          @if (showCrosshair() && cartesian()) {
          @if (horizontalBars()) {
            <view class="crosshair horizontal" [style.top]="mapY(state().shared?.coordinate??point.y)" pointerEvents="none" />
          } @else {
            <view class="crosshair vertical" [style.left]="mapX(state().shared?.coordinate??point.x)" pointerEvents="none" />
          }
          }
          @if(activeVennDrawing();as outline){<ng-icon class="geometry" testID="chart-active-sets" [svg]="outline" pointerEvents="none"/>}
          @if(activePolygonDrawing();as outline){<ng-icon class="geometry" testID="chart-active-polygon" [svg]="outline" pointerEvents="none"/>}
          @if(activeTilemapCircle();as outline){<ng-icon class="geometry" testID="chart-active-tile" [svg]="outline" pointerEvents="none"/>}
          @if(activeSectorDrawing();as outline){<ng-icon class="geometry" testID="chart-active-sector" [svg]="outline" pointerEvents="none"/>}
          @if(activeItemDrawing();as outline){<ng-icon class="geometry" testID="chart-active-item" [svg]="outline" pointerEvents="none"/>}
          @if((cartesian()&&scene().family!=='pictorial'&&scene().family!=='heatmap')||scene().family==='dendrogram'||scene().family==='parallel'||scene().family==='radar'||scene().family==='polar'||point.relationship?.type==='link'){@for(active of activeMarkerPoints();track active.id.seriesId){<view class="active-marker" testID="chart-active-marker" [style.left]="mapX(active.x)" [style.backgroundColor]="(scene().family==='line'||scene().family==='area'||scene().family==='areaspline'||scene().family==='spline'||scene().family==='mixed')?'transparent':dark()?'#17263A':'#FFFFFF'"
            [style.top]="mapY(active.y)" [style.borderWidth]="(scene().family==='line'||scene().family==='area'||scene().family==='areaspline'||scene().family==='spline'||scene().family==='mixed')?0:3" [style.borderColor]="active.color" pointerEvents="none">@if((scene().family==='line'||scene().family==='area'||scene().family==='areaspline'||scene().family==='spline'||scene().family==='mixed')){<ng-icon class="geometry" [svg]="activeMarkerSymbols().get(active.id.seriesId)!"/>}</view>}}
          @if(tooltipMode()==='floating' && !dockTooltip() && !pinned()){
            <ng-template #floatingContent><nc-native-tooltip [family]="scene().family" [point]="point" [shared]="state().shared" [detailRows]="tooltipDetails()" [compactHeight]="tooltipHeight()" [unit]="scene().unit" [secondaryUnit]="scene().secondaryUnit??''" [xTitle]="xAxisTitle()" [locale]="locale()" [dark]="dark()" /></ng-template>
            @if(tooltipMotionStyles.native;as style){<view class="floating-tooltip" [style.left]="0" [style.top]="0" [style.width]="tooltipPosition().width" [collapsable]="false" [workletStyle]="style" pointerEvents="none"><ng-container [ngTemplateOutlet]="floatingContent"/></view>}
            @else if(tooltipMotionStyles.browser;as style){<view class="floating-tooltip" [style.left]="0" [style.top]="0" [style.width]="tooltipPosition().width" [animatedStyle]="style" pointerEvents="none"><ng-container [ngTemplateOutlet]="floatingContent"/></view>}
          }
        }
        <ng-template #dataLabels>
        @if(emptyState();as empty){<view class="plot-empty" testID="chart-empty-state" pointerEvents="none"><text class="empty-title" [ncLabelHalo]="ink()" [style.color]="ink()">{{empty.title}}</text><text class="empty-description" [ncLabelHalo]="muted()" [style.color]="muted()">{{empty.description}}</text></view>}
        @for(label of valueLabels();track label.id){<text class="value-label" testID="chart-value-label" [style.left]="label.x" [style.top]="label.y" [style.width]="label.width" [style.height]="label.height" [style.color]="label.ink??ink()" [ncLabelHalo]="label.ink??ink()" [numberOfLines]="1" [accessible]="false" pointerEvents="none">{{label.text}}</text>}
        @for(label of tileLabels();track $index){<view class="tile-label-box" [style.left]="label.left" [style.top]="label.top" [style.width]="label.width" [style.height]="label.height" [accessible]="false" pointerEvents="none"><text class="tile-label" [ncLabelHalo]="label.color" [numberOfLines]="1" [style.color]="label.color" [accessible]="false">{{label.text}}</text></view>}
        @for(annotation of plainAnnotations();track $index){
          <text class="annotation" [class.annotation-value]="annotation.role==='value'" [style.color]="ink()"
            [style.left]="mapX(annotation.x)" [style.top]="mapY(annotation.y)" pointerEvents="none">{{annotation.text}}</text>
        }
        @for(label of dendrogramAxisLabels();track label.id){<text class="polar-axis-label" [style.height]="label.height" [style.fontSize]="10" [style.color]="muted()" [style.left]="label.left" [style.top]="label.top" [style.width]="label.width" [numberOfLines]="1" [accessible]="false" pointerEvents="none">{{label.text}}</text>}
        @for(label of parallelAxisLabels();track label.id){<text class="polar-axis-label" [style.height]="label.height" [style.fontSize]="label.type==='tick'?10:11" [style.color]="ink()" [style.left]="label.left" [style.top]="label.top" [style.width]="label.width" [style.fontWeight]="label.type==='name'?600:400" [numberOfLines]="1" [accessible]="false" pointerEvents="none">{{label.text}}</text>}
        @for(label of polarLabels();track label.id){<text class="polar-axis-label" [style.color]="ink()" [style.left]="label.left" [style.top]="label.top" [style.width]="label.width" [numberOfLines]="1" [accessible]="false" pointerEvents="none">{{label.text}}</text>}
        @for(label of radialLabels();track label.id){
          <text class="radial-label" [numberOfLines]="dataLabelLayout()==='auto'?undefined:1" [style.width]="label.width" [style.marginLeft]="label.width===undefined?undefined:-label.width/2" [ncLabelHalo]="label.ink" [style.color]="label.ink" [style.left]="mapX(label.x)" [style.top]="mapY(label.y)" [accessible]="false" pointerEvents="none">{{label.text}}</text>
        }
        </ng-template>
        @if(motionStyles().native;as styles){<view class="motion-layer" [collapsable]="false" [workletStyle]="styles.labels" pointerEvents="none"><ng-container [ngTemplateOutlet]="dataLabels"/></view>}
        @else if(motionStyles().browser;as styles){<view class="motion-layer" [animatedStyle]="styles.labels" pointerEvents="none"><ng-container [ngTemplateOutlet]="dataLabels"/></view>}
        </ng-template>
        @if(viewportSnapshot();as snapshot){
          @if(viewportDriver()?.styles?.native;as viewportStyles){<view class="motion-layer" testID="chart-viewport-preview" [collapsable]="false" [workletStyle]="viewportStyles.preview" pointerEvents="none"><ng-icon class="geometry grid-geometry" [svg]="snapshot.grid"/><ng-icon class="geometry grid-geometry" [svg]="snapshot.series"/><ng-icon class="geometry grid-geometry" [svg]="snapshot.references"/></view>}
          @else if(viewportDriver()?.styles?.browser;as viewportStyles){<view class="motion-layer" testID="chart-viewport-preview" [animatedStyle]="viewportStyles.preview" pointerEvents="none"><ng-icon class="geometry grid-geometry" [svg]="snapshot.grid"/><ng-icon class="geometry grid-geometry" [svg]="snapshot.series"/><ng-icon class="geometry grid-geometry" [svg]="snapshot.references"/></view>}
        }
      </view>
      @if (cartesian() && showXAxis()) {<view class="x-axis" testID="chart-x-axis" [accessible]="false">
        @if(scene().family==='variwide'){@for(tick of weightedLabels();track tick.id){<text class="x-tick" testID="chart-weighted-x-label" [accessibilityLabel]="tick.label" [numberOfLines]="1" [style.color]="muted()" [style.width]="tick.width" [style.left]="tick.left">{{tick.label}}</text>}}@else{
        @for (tick of displayedXLabels(); track tick.x) {
          <text class="x-tick" [numberOfLines]="1" [style.color]="muted()" [style.width]="xTickWidthFor(tick.label)" [style.left]="xTickLeft(tick.x,xTickWidthFor(tick.label))">{{ tick.label }}</text>
        }}
      </view>}
      </view>
      </scroll-view>
      @if(secondaryAxisVisible()&&secondaryYTicks();as ticks){<view class="secondary-y-axis" testID="chart-secondary-y-axis" [style.width]="valueAxisWidth()" [accessible]="false">@for(tick of ticks;track tick.y){<text class="secondary-y-tick" [numberOfLines]="axisLabelLayout()==='truncate'?1:undefined" [style.width]="axisLabelLayout()==='truncate'?valueAxisWidth()-12:undefined" [style.color]="muted()" [style.top]="mapY(tick.y)">{{tick.label}}</text>}</view>}
      @if(pinnedOverlay()){@if(state().active;as point){
        <view class="floating-tooltip" testID="chart-tooltip-details" [style.left]="(cartesian()&&showYAxis()?primaryAxisWidth():0)+8" [style.top]="8" [style.width]="pinnedWidth()">
          <nc-native-tooltip [family]="scene().family" [point]="point" [shared]="state().shared" [detailRows]="tooltipDetails()" [pinned]="true" [allowScroll]="true" [maximumHeight]="pinnedBodyHeight()" [unit]="scene().unit" [secondaryUnit]="scene().secondaryUnit??''" [xTitle]="xAxisTitle()" [locale]="locale()" [dark]="dark()" (dismiss)="clear()" />
        </view>
      }}
    </view>
    @if(scrolling()){<text class="touch-hint" [style.color]="muted()">{{locale()==='en'?'Swipe horizontally to see more data. Tap a point for its value.':'Desliza horizontalmente para ver más datos. Toca un punto para ver su valor.'}}</text>}
    @if(ownedScene().heatmap??ownedScene().tilemap;as tilemap){@if(showColorAxis()){<nc-tilemap-color-axis [axis]="tilemap.colorAxis" [locale]="locale()" [ink]="ink()" [unit]="scene().unit" [missingCount]="tilemap.layout.missingCount"/>}}
    @if (hasAxes() && showXAxis() && xAxisTitle()) {<text class="axis-title x-title" testID="chart-x-axis-title" [style.color]="xTitleAppearance().color" [style.textAlign]="xTitleAppearance().textAlign" [style.fontSize]="xTitleAppearance().fontSize" [style.fontWeight]="xTitleAppearance().fontWeight" [style.lineHeight.px]="xTitleAppearance().lineHeight">{{ xAxisTitle() }}</text>}
    </view>
    @if(showLegend()&&scene().family!=='gauge'&&effectiveLegendPosition()==='right'){<nc-native-legend class="side-legend" testID="chart-side-legend" [items]="legendItems()" [vertical]="true" [maximumHeight]="boundedHeight()+40" [interactive]="legendInteractive()&&!!ownedScene().legend" [locale]="locale()" [ink]="ink()" [muted]="muted()" (toggle)="toggleLegend($event)"/>}
    </view>
    @if (showLegend() && scene().family!=='gauge' && effectiveLegendPosition() === 'bottom') {<nc-native-legend [items]="legendItems()" [interactive]="legendInteractive()&&!!ownedScene().legend" [locale]="locale()" [ink]="ink()" [muted]="muted()" (toggle)="toggleLegend($event)"/>}
    @if(viewportContext();as context){@if(context.controls){<view class="viewport-controls" [accessibilityLabel]="locale()==='en'?'Chart zoom':'Zoom de la gráfica'">
      <pressable class="control" [disabled]="!zoomInAvailable()" [accessibilityState]="controlAccessibilityState(!zoomInAvailable())" [style.opacity]="zoomInAvailable()?1:.45" accessibilityRole="button" [accessibilityLabel]="locale()==='en'?'Zoom in':'Ampliar gráfica'" [style.backgroundColor]="dark()?'#202E42':'#EDF2F8'" (press)="requestView({type:'zoom',factor:2})"><text class="control-label" [style.color]="ink()">+</text></pressable>
      <pressable class="control" [disabled]="pinned()||!hasViewportWindow()" [accessibilityState]="controlAccessibilityState(pinned()||!hasViewportWindow())" accessibilityRole="button" [accessibilityLabel]="locale()==='en'?'Zoom out':'Reducir gráfica'" [style.backgroundColor]="dark()?'#202E42':'#EDF2F8'" (press)="requestView({type:'zoom',factor:.5})"><text class="control-label" [style.color]="ink()">−</text></pressable>
      <pressable class="control" [disabled]="pinned()||!hasViewportWindow()" [accessibilityState]="controlAccessibilityState(pinned()||!hasViewportWindow())" accessibilityRole="button" [accessibilityLabel]="locale()==='en'?'Reset zoom':'Restablecer zoom'" [style.backgroundColor]="dark()?'#202E42':'#EDF2F8'" (press)="requestView({type:'reset'})"><text class="control-label" [style.color]="ink()">{{locale()==='en'?'Reset':'Restablecer'}}</text></pressable>
      @if(context.pan&&hasViewportWindow()){
        @if(viewportAxes().horizontal){@for(direction of [-1,1];track direction){<pressable class="control" [disabled]="pinned()" [accessibilityState]="controlAccessibilityState(pinned())" accessibilityRole="button" [accessibilityLabel]="locale()==='en'?(direction===-1?'Pan left':'Pan right'):(direction===-1?'Desplazar a la izquierda':'Desplazar a la derecha')" [style.backgroundColor]="dark()?'#202E42':'#EDF2F8'" (press)="panView('x',direction)"><text class="control-label" [style.color]="ink()">{{direction===-1?'←':'→'}}</text></pressable>}}
        @if(viewportAxes().vertical){@for(direction of [-1,1];track direction){<pressable class="control" [disabled]="pinned()" [accessibilityState]="controlAccessibilityState(pinned())" accessibilityRole="button" [accessibilityLabel]="locale()==='en'?(direction===-1?'Pan up':'Pan down'):(direction===-1?'Desplazar hacia arriba':'Desplazar hacia abajo')" [style.backgroundColor]="dark()?'#202E42':'#EDF2F8'" (press)="panView('y',direction)"><text class="control-label" [style.color]="ink()">{{direction===-1?'↑':'↓'}}</text></pressable>}}
      }
    </view>}}
    @if(selectionControls() || (state().active && (tooltipMode()==='floating'||(tooltipPinnable()&&tooltipMode()!=='off')))){
    <view class="controls">
      @if(selectionControls()){
      <pressable class="control" [disabled]="pinned()||ownedScene().observations.length===0" [accessibilityState]="controlAccessibilityState(pinned()||ownedScene().observations.length===0)" [style.opacity]="pinned()||ownedScene().observations.length===0?0.45:1" [style.backgroundColor]="dark()?'#202E42':'#EDF2F8'" accessibilityRole="button" [accessibilityLabel]="locale()==='en'?'Previous observation':'Observación anterior'" (press)="step(-1)"><text class="control-label" [style.color]="ink()">{{locale()==='en'?'Previous':'Anterior'}}</text></pressable>
      <pressable class="control" [disabled]="pinned()||ownedScene().observations.length===0" [accessibilityState]="controlAccessibilityState(pinned()||ownedScene().observations.length===0)" [style.opacity]="pinned()||ownedScene().observations.length===0?0.45:1" [style.backgroundColor]="dark()?'#202E42':'#EDF2F8'" accessibilityRole="button" [accessibilityLabel]="locale()==='en'?'Next observation':'Observación siguiente'" (press)="step(1)"><text class="control-label" [style.color]="ink()">{{locale()==='en'?'Next':'Siguiente'}}</text></pressable>
      <pressable class="control" [disabled]="ownedScene().observations.length===0" [accessibilityState]="controlAccessibilityState(ownedScene().observations.length===0)" [style.backgroundColor]="dark()?'#202E42':'#EDF2F8'" accessibilityRole="button" [accessibilityLabel]="locale()==='en'?'Clear selection':'Limpiar selección'" (press)="clear()"><text class="control-label" [style.color]="ink()">{{locale()==='en'?'Clear':'Limpiar'}}</text></pressable>
      }
      @if(state().active && tooltipMode()==='floating'){
        <pressable class="control" [disabled]="pinned()" [style.opacity]="pinned()?0.45:1" accessibilityRole="button" [accessibilityState]="{expanded:expandedTooltip(),disabled:pinned()}" [accessibilityLabel]="locale()==='en'?(expandedTooltip()?'Collapse tooltip details':'Read full tooltip'):(expandedTooltip()?'Contraer detalles del tooltip':'Leer tooltip completo')" [style.backgroundColor]="dark()?'#202E42':'#EDF2F8'" (press)="toggleDetails()"><text class="control-label" [style.color]="ink()">{{locale()==='en'?(expandedTooltip()?'Collapse':'Details'):(expandedTooltip()?'Contraer':'Detalles')}}</text></pressable>
      }
      @if(state().active && tooltipPinnable() && tooltipMode()!=='off'){
        <pressable class="control" accessibilityRole="button" [accessibilityState]="{selected:pinned()}" [accessibilityLabel]="locale()==='en'?(pinned()?'Unpin tooltip':'Pin tooltip'):(pinned()?'Desfijar tooltip':'Fijar tooltip')" [style.backgroundColor]="dark()?'#202E42':'#EDF2F8'" (press)="togglePin()"><text class="control-label" [style.color]="ink()">{{locale()==='en'?(pinned()?'Unpin':'Pin'):(pinned()?'Desfijar':'Fijar')}}</text></pressable>
      }
    </view>}
    @if(dockTooltip()) {<view class="details" testID="chart-tooltip-details" [style.backgroundColor]="dark()?'#202E42':'#F1F5FA'">
      @if (state().active; as point) {
        @if(tooltipMode()==='docked' && tooltipTemplate();as template){
          <ng-container [ngTemplateOutlet]="template" [ngTemplateOutletContext]="dockedTooltipContext() ?? null"/>
        }@else{
        <nc-native-tooltip [family]="scene().family" [point]="point" [shared]="state().shared" [detailRows]="tooltipDetails()" [pinned]="pinned()" [allowScroll]="true" [unit]="scene().unit" [secondaryUnit]="scene().secondaryUnit??''" [xTitle]="xAxisTitle()" [locale]="locale()" [dark]="dark()" (dismiss)="clear()" />
        }
        <text class="detail-status" [style.color]="muted()">{{pinned()?(locale()==='en'?'Pinned · Unpin to explore':'Fijado · Desfija para explorar'):(locale()==='en'?(state().scrubbing?'Exploring':'Selected'):(state().scrubbing ? 'Explorando' : 'Seleccionado')) }}</text>
      } @else {
        <text class="detail-label" [style.color]="ink()">{{locale()==='en'?'Explore the data':'Explora los datos'}}</text>
        <text class="detail-value" [style.color]="ink()">{{locale()==='en'?'Touch a point':'Toca un punto'}}</text>
        <text class="detail-status" [style.color]="muted()">{{locale()==='en'?'Or use the accessible controls':'O utiliza los controles accesibles'}}</text>
      }
    </view>} @else {<text class="touch-hint" [style.color]="muted()">{{touchHint()}}</text>}}
  `,
  styles: `
    :host { display: flex; flex-direction: column; min-width: 0; gap: 12px; padding: 18px; }
    text { color: #263449; font-size: 15px; }
    .chart-title { font-size: 23px; font-weight: 600; }
    .description { color: #536174; line-height: 22px; }
    .axis-titles {flex-direction:row;gap:12px;justify-content:space-between;}
    .axis-title {font-size:12px;color:#536174;}
    .x-title {text-align:center;}
    .chart-body {flex-direction:row;gap:16px;min-width:0;align-items:flex-start;}
    .chart-body-main {flex:1;min-width:0;gap:12px;}
    .side-legend {width:180px;flex-shrink:0;}
    .chart-frame { flex-direction: row; height: 232px; margin-top: 20px; }
    @media (orientation: landscape) and (max-height: 500px) {
      :host {padding:4px;gap:4px;}
      .chart-body-main {gap:4px;}
      .chart-frame {margin-top:0;}
    }
    .secondary-y-axis {width:38px;}
    .secondary-y-tick {position:absolute;font-size:11px;margin-top:-7px;left:4px;}
    .y-axis { width: 38px; }
    .bar-y-axis { width: 90px; }
    .temporal-y-axis {width:72px;}
    .y-tick { position: absolute; right: 9px; margin-top: -9px; font-size: 12px; color: #536174; }
    .category-tick {position:absolute;right:9px;width:72px;justify-content:center;}
    .category-label {font-size:12px;text-align:right;line-height:14px;}
    .plot-scroll {flex:1;min-width:0;}
    .plot-content {flex-grow:1;min-width:0;}
    .plot { flex-shrink:0; overflow: hidden; }
    .floating-tooltip{position:absolute;z-index:4;}
    .value-label{position:absolute;font-size:12px;line-height:18px;text-align:center;}
    .plot-empty{position:absolute;left:12px;right:12px;top:38%;padding:10px;align-items:center;gap:4px;}.empty-title{font-size:14px;font-weight:600;text-align:center;}.empty-description{font-size:12px;text-align:center;}
    .active-tile{position:absolute;border-width:2px;} .tile-label-box{position:absolute;overflow:hidden;justify-content:center;padding-left:4px;padding-right:4px;} .tile-label{font-size:12px;line-height:16px;text-align:center;}
    .annotation{position:absolute;width:160px;margin-left:-80px;text-align:center;font-size:13px;}
    .annotation-value{font-size:28px;font-weight:600;margin-top:-18px;}
    .touch-hint{font-size:12px;}
    .reference-label{position:absolute;font-size:12px;line-height:18px;}
    .radial-label{position:absolute;width:52px;margin-left:-26px;margin-top:-8px;text-align:center;font-size:13px;font-weight:600;}
    .geometry { width: 100%; height: 100%; }
    .grid-geometry,.motion-layer {position:absolute;left:0;top:0;width:100%;height:100%;}
    .motion-clip {overflow:hidden;}
    .bubble-entrance{position:absolute;}
    .crosshair { position: absolute; background-color: #8C99AC; }
    .vertical { width: 1px; top: 0; bottom: 0; }
    .horizontal { height: 1px; left: 0; right: 0; }
    .polar-axis-label {position:absolute;font-size:11px;line-height:16px;text-align:center;}
    .active-marker { position: absolute; width: 14px; height: 14px; border-radius: 7px; border-width: 3px; background-color: #FFFFFF; margin-left: -7px; margin-top: -7px; }
    .x-axis { height:28px;margin-top:12px;flex-shrink:0; }
    .x-tick { position:absolute;text-align:center;font-size:12px;color:#536174; }
    .details { background-color: #F1F5FA; border-radius: 12px; padding: 18px; gap: 5px; min-height: 115px; }
    .detail-label { font-weight: 600; }
    .detail-value { font-size: 23px; font-weight: 600; }
    .detail-status { color: #536174; font-size: 13px; }
    .controls { flex-direction: row; flex-wrap: wrap; gap: 8px; margin-top: 8px; }
    .viewport-controls {flex-direction:row;flex-wrap:wrap;gap:8px;}.viewport-controls .control{min-width:44px;}
    .control { min-width: 72px; min-height: 48px; padding: 8px 10px; align-items: center; justify-content: center; border-radius: 6px; background-color: #EDF2F8; }
    .control-label { font-size: 13px; font-weight: 500; }
    .control:active { background-color: #D8E3F2; }
    @media (min-width: 700px) { .chart-frame { height: 330px; } }
    @media (prefers-color-scheme: dark) {
      text { color: #EDF2FA; }
      .description, .detail-status, .x-tick, .y-tick, .axis-title { color: #AFBDD1; }
      .details, .control { background-color: #202E42; }
      .active-marker { background-color: #152033; }
      .control:active { background-color: #31435D; }
    }
  `,
})
export class NativeChart {
  protected readonly controlAccessibilityState=controlAccessibilityState;
  /** Measured plot only; emitted on dimension changes, never on pointer moves. */
  readonly viewportChange=output<Readonly<{width:number;height:number}>>();
  readonly scene = input.required<NativeScene>();
  readonly viewportContext=input<NativeViewportContext|undefined>(undefined);
  readonly viewportRequest=output<NativeViewportRequest>();
  readonly hapticsEnabled = input(true);
  readonly showColorAxis=input(true);
  readonly showLegend = input(true);
  readonly legendPosition = input<LegendPosition>('top');
  readonly legendInteractive=input(false);
  readonly showDendrogramAxis=input(true);
  readonly showParallelAxes=input(true);readonly showParallelNames=input(true);readonly showParallelTicks=input(true);
  readonly showGrid = input(true);
  readonly showXAxis = input(true);
  readonly showYAxis = input(true);
  readonly showSecondaryYAxis=input<boolean>();
  readonly secondaryYAxisTitle=input('');
  readonly secondaryYAxisTitleStyle=input<NativeTextStyleOptions>();
  protected readonly secondaryAxisVisible=computed(()=>!!this.scene().secondaryGrid&&(this.showSecondaryYAxis()??this.showYAxis()));
  readonly xAxisTitle = input('');
  readonly yAxisTitle = input('');
  readonly titleStyle=input<NativeTextStyleOptions>();
  readonly subtitleStyle=input<NativeTextStyleOptions>();
  readonly xAxisTitleStyle=input<NativeTextStyleOptions>();
  readonly yAxisTitleStyle=input<NativeTextStyleOptions>();
  readonly locale=input<'es'|'en'>('es');
  readonly theme=input<'light'|'dark'|'system'>('system');
  readonly tooltipMode=input<TooltipMode>('floating');
  readonly tooltipContent=input<TooltipContent>('point');
  readonly tooltipPinnable=input(false);
  readonly tooltipTemplate=input<TemplateRef<NativeChartTooltipContext>>();
  readonly labelFormatters=input<NativeChartLabelFormatters>();
  protected readonly dockedTooltipContext=computed<NativeChartTooltipContext|undefined>(()=>{
    const state=this.state();
    return state.active?{$implicit:state.active,shared:state.shared,pinned:this.pinned(),scrubbing:state.scrubbing,unit:this.scene().unit,locale:this.locale()}:undefined;
  });
  readonly showCrosshair=input(false);
  readonly showMarkers=input(true);
  readonly showDataLabels=input(true);
  readonly dataLabelLayout=input<NativeLabelLayout>('auto');
  readonly axisLabelLayout=input<NativeLabelLayout>('auto');
  readonly showStackLabels=input(false);
  readonly strokeWidth=input(2);
  readonly markerSize=input(6);
  readonly markerStyle=input<NativeMarkerStyle>();
  readonly plotHeight=input(260);
  /** Only the data area and X labels grow; surrounding content keeps its width. */
  readonly minPlotWidth=input(0);
  readonly interactionMode=input<'explore'|'tap'>('explore');
  readonly selectionControls=input(true);
  readonly animationEnabled=input(true);
  readonly animationDuration=input(1100);
  readonly animationKey=input(0);
  protected readonly previousDrawing=signal<string|null>(null);
  private previousDrawingTimer:ReturnType<typeof setTimeout>|null=null;
  private readonly visibilitySignature=computed(()=>JSON.stringify((this.ownedScene().legend??[]).map(item=>[item.id,item.visible])));
  private readonly motion=inject(CHART_MOTION_FACTORY)();
  private readonly tooltipMotion=inject(CHART_TOOLTIP_MOTION_FACTORY)();
  protected readonly tooltipMotionStyles=this.tooltipMotion.styles;
  private readonly viewportFactory=inject(CHART_VIEWPORT_MOTION_FACTORY);
  protected readonly viewportDriver=signal<ViewportMotion|null>(null);
  protected readonly viewportSnapshot=signal<Readonly<{grid:string;series:string;references:string}>|null>(null);
  protected readonly viewportInteracting=signal(false);
  private viewportSession:NativeViewportContext|null=null;
  private viewportFrame:number|null=null;
  readonly interactionChange = output<InteractionSnapshot>();
  readonly legendChange=output<readonly string[]>();
  protected readonly state = signal<InteractionSnapshot>({active: null, selected: null, scrubbing: false});
  protected readonly pinned=computed(()=>this.state().pinned===true);
  private readonly viewport = signal<Readonly<{width:number;height:number}>|undefined>(undefined);
  private readonly plotScroller=viewChild<ScrollView>('plotScroller');
  private readonly visibleWidth=signal(0);
  private readonly scrollX=signal(0);
  private readonly bodyWidth=signal(0);
  protected readonly effectiveLegendPosition=computed(()=>{
    const position=this.legendPosition();return this.bodyWidth()>=640?position:position==='left'?'top':position==='right'?'bottom':position;
  });
  protected readonly scrollContentStyle={flexGrow:1};
  protected readonly boundedMinimumWidth=computed(()=>this.cartesian()||this.ownedScene().family==='arcdiagram'||this.ownedScene().parallel?.coordinates==='cartesian'?Math.max(0,Math.min(1600,Number.isFinite(this.minPlotWidth())?this.minPlotWidth():0)):0);
  protected readonly contentWidth=computed(()=>Math.max(this.visibleWidth(),this.boundedMinimumWidth()));
  protected readonly scrolling=computed(()=>this.visibleWidth()>0&&this.contentWidth()>this.visibleWidth()+1);
  protected readonly hasViewportWindow=computed(()=>{const value=this.viewportContext()?.model.value;return !!(value?.x||value?.y);});
  protected readonly emptyNodeWindow=computed(()=>this.hasViewportWindow()&&['treegraph','organization'].includes(this.scene().family)&&this.ownedScene().observations.length===0&&this.legendItems().some(item=>item.visible));
  protected readonly viewportAxes=computed(()=>{const context=this.viewportContext();return context?viewportCanvas(this.ownedScene(),context,this.viewport()??{width:this.scene().width,height:this.boundedHeight()}):{horizontal:false,vertical:false};});
  private readonly tooltipViewport=computed(()=>({width:this.visibleWidth()||this.viewport()?.width||300,height:this.viewport()?.height??this.boundedHeight()}));
  protected readonly ownedScene=computed(()=>ownScene(this.scene()));
  private readonly paintScene=computed(()=>this.ownedScene(),{equal:sameScenePaint});
  protected readonly legendItems=computed(()=>{
    const scene=this.ownedScene(),items=scene.legend??scene.series.map(s=>({...s,visible:true}));
    const formatter=this.labelFormatters()?.legendLabel;
    return formatter?items.map(item=>({...item,name:formatter({...item,text:item.name})??item.name})):items;
  });
  protected readonly activePoints=computed(()=>this.state().shared?.points??(this.state().active?[this.state().active!]:[]));
  protected readonly activeMarkerPoints=computed(()=>this.ownedScene().mixedRanges?this.activePoints().filter(point=>point.lowValue===undefined):this.activePoints());
  private readonly geometryScene=computed(()=>this.ownedScene(),{equal:(a,b)=>sceneInteractionKey(a)===sceneInteractionKey(b)});
  private readonly gridScene=computed(()=>this.ownedScene(),{equal:(a,b)=>sceneInteractionKey(a)===sceneInteractionKey(b)&&(a.referenceBands?.length??0)===(b.referenceBands?.length??0)&&(a.referenceBands??[]).every((band,index)=>band.id===b.referenceBands?.[index]?.id&&band.color===b.referenceBands[index]!.color&&band.opacity===b.referenceBands[index]!.opacity)});
  private readonly colorScheme=inject(ColorScheme);
  protected readonly dark=computed(()=>this.theme()==='system'?this.colorScheme.current()==='dark':this.theme()==='dark');
  protected readonly ink=computed(()=>this.dark()?'#EDF2FA':'#263449');
  protected readonly muted=computed(()=>this.dark()?'#B5C5DB':'#536174');
  protected readonly titleAppearance=computed(()=>nativeTextStyle(this.titleStyle(),{align:'left',color:this.ink(),fontSize:23,fontWeight:600}),{equal:sameTextStyle});
  protected readonly subtitleAppearance=computed(()=>nativeTextStyle(this.subtitleStyle(),{align:'left',color:this.muted(),fontSize:15,fontWeight:400}),{equal:sameTextStyle});
  protected readonly xTitleAppearance=computed(()=>nativeTextStyle(this.xAxisTitleStyle(),{align:'center',color:this.muted(),fontSize:12,fontWeight:400}),{equal:sameTextStyle});
  protected readonly yTitleAppearance=computed(()=>nativeTextStyle(this.yAxisTitleStyle(),{align:'left',color:this.muted(),fontSize:12,fontWeight:400}),{equal:sameTextStyle});
  private readonly markerAppearance=computed(()=>resolveMarkerStyle(this.markerStyle()),{equal:sameMarkerStyle});
  protected readonly activeMarkerSymbols=computed(()=>{
    const style=this.markerAppearance();
    return new Map(this.activeMarkerPoints().map(point=>{const override=pointOverrideColor(this.paintScene(),point.id),color=override??point.color,fill=override??style.fillColor??(this.dark()?'#17263A':'#FFFFFF');return [point.id.seriesId,`<svg viewBox="0 0 14 14">${markerSvg(7,7,11,color,{...style,fillColor:fill,borderColor:style.borderColor??color,borderWidth:3})}</svg>`];}));
  });
  protected readonly referenceDrawing=computed(()=>this.renderActive()?sceneSvg(this.paintScene(),this.dark()?'#35465E':'#DFE5ED',this.viewport(),false,{layer:'references',surfaceColor:this.dark()?'#101C2C':'#FFFFFF'}):'');
  protected readonly referenceLabels=computed(()=>nativeReferenceLabels(this.ownedScene(),this.viewport()??{width:this.scene().width,height:this.boundedHeight()},this.accessibility.fontScale(),{x:this.scrollX(),width:this.tooltipViewport().width},this.dark()?'#E7EEF9':'#17212B',this.dark()?'#101C2C':'#FFFFFF'));
  protected readonly cartesian=computed(()=>chartCapabilities[this.scene().family]?.axes==='cartesian');
  protected readonly hasAxes=computed(()=>this.cartesian()||!!this.ownedScene().polarGrid);
  protected readonly dendrogramAxisLabels=computed(()=>this.showDendrogramAxis()?dendrogramLabels(this.ownedScene(),this.viewport()??{width:this.scene().width,height:this.boundedHeight()},this.accessibility.fontScale()):[]);
  protected readonly parallelAxisLabels=computed(()=>parallelLabels(this.ownedScene(),this.viewport()??{width:this.scene().width,height:this.boundedHeight()},this.accessibility.fontScale(),{axes:this.showParallelAxes(),names:this.showParallelNames(),ticks:this.showParallelTicks()}));
  protected readonly polarLabels=computed(()=>{
    const scene=this.ownedScene(),g=scene.polarGrid;if(!g)return [];const t=this.transform(),width=this.viewport()?.width??scene.width,scale=this.accessibility.fontScale();if(width<180||scale>1.5)return [];
    const labels:{id:string;left:number;top:number;width:number;text:string}[]=[],stride=Math.max(1,Math.ceil(g.spokes.length/12));
    if(this.showXAxis())for(let i=0;i<g.spokes.length;i+=stride){const p=g.spokes[i]!,dx=p.x-g.cx,dy=p.y-g.cy,x=p.x*t.sx+t.x,y=p.y*t.sy+t.y,w=64;labels.push({id:'category:'+p.id,left:Math.max(0,Math.min(width-w,x+(dx>1?5:dx< -1?-w-5:-w/2))),top:Math.max(0,y+(dy>1?5:dy< -1?-23:-9)),width:w,text:p.label});}
    if(this.showYAxis())for(const [i,p]of g.rings.entries())if(p.radius>0)labels.push({id:'ring:'+i,left:g.cx*t.sx+t.x+4,top:(g.cy-p.radius)*t.sy+t.y+2,width:46,text:p.label});
    return labels;
  });
  protected readonly barLabels=computed(()=>barCategoryLabels(this.ownedScene()));
  protected readonly temporalYAxis=computed(()=>this.scene().family==='flame'||this.scene().family==='xrange'||this.scene().family==='timeline');
  protected readonly horizontalBars=computed(()=>this.scene().family==='bar'||this.scene().family==='bullet'&&this.scene().bulletOrientation==='horizontal');
  protected readonly categoryYAxis=computed(()=>this.horizontalBars()||this.temporalYAxis()||this.scene().family==='heatmap');
  protected readonly valueAxisWidth=computed(()=>{
    const scale=Math.max(1,this.accessibility.fontScale());
    if(this.axisLabelLayout()==='truncate'||(this.axisLabelLayout()==='auto'&&!this.labelFormatters()?.yAxisLabel))return Math.min(128,38*scale);
    const labels=[...this.primaryYTicks(),...(this.secondaryYTicks()??[])];
    const longest=Math.max(0,...labels.map(tick=>tick.label.length));
    return Math.min(128,Math.max(38*scale,12+longest*7*scale));
  });
  protected readonly primaryAxisWidth=computed(()=>{
    if(!this.categoryYAxis())return this.valueAxisWidth();
    const width=this.temporalYAxis()?72:90;
    if(this.axisLabelLayout()!=='all')return width;
    const maxLength=this.barLabels().reduce((max,label)=>Math.max(max,this.axisLabel('y',label.label,label.id,'category').length),0);
    return Math.min(160,Math.max(width,18+maxLength*8*Math.max(1,this.accessibility.fontScale())));
  });
  protected readonly displayedYAxis=computed(()=>this.showYAxis()&&(this.scene().family!=='timeline'||!!this.scene().yLabels?.length));
  protected readonly displayedCategoryLabels=computed(()=>{const labels=this.barLabels(),height=this.categoryLabelHeight();let last:number|undefined;const visible=this.axisLabelLayout()!=='auto'?labels:labels.filter(label=>{const y=this.mapY(label.y);if(last!==undefined&&Math.abs(y-last)<height)return false;last=y;return true;});
    return this.labelFormatters()?.yAxisLabel?visible.map(label=>({...label,label:this.axisLabel('y',label.label,label.id,'category')})):visible;
  });
  protected readonly categoryLabelHeight=computed(()=>Math.min(80,(this.accessibility.fontScale()>1.5?18:32)*this.accessibility.fontScale()));
  protected readonly radialLabels=computed(()=>{
    const scene=this.ownedScene(),layout=this.dataLabelLayout(),force=layout!=='auto';
    if(!this.showDataLabels()||!['pie','donut'].includes(scene.family)||(!force&&scene.observations.length>8))return[];
    return scene.observations.filter(p=>force?p.hit?.type==='sector'&&(p.percentage??0)>0:(p.percentage??0)>=5).slice(0,forcedLabelLimit).map(p=>{
      const rgb=[1,3,5].map(i=>parseInt(p.color.slice(i,i+2),16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);
      const luminance=rgb[0]!*.2126+rgb[1]!*.7152+rgb[2]!*.0722;
      const value=p.percentage??0,text=new Intl.NumberFormat(this.locale(),{maximumFractionDigits:1}).format(value)+'%';
      const label=this.labelFormatters()?.dataLabel?.({point:p,value,text})??text;
      const width=force?(layout==='truncate'?52:Math.min(this.contentWidth()||scene.width,Math.max(52,label.length*9*Math.max(1,this.accessibility.fontScale())+8))):undefined;
      return{id:p.id.pointId,x:p.x,y:p.y,text:label,width,ink:luminance>.179?'#000000':'#FFFFFF'};
    });
  });
  protected readonly boundedHeight=computed(()=>Math.max(180,Math.min(600,Number.isFinite(this.plotHeight())?this.plotHeight():260)));
  protected readonly valueLabels=computed(()=>nativeValueLabels(this.ownedScene(),this.viewport()??{width:this.scene().width,height:this.boundedHeight()},value=>this.formatNumber()(value),{locale:this.locale(),points:this.showDataLabels(),stacks:this.showStackLabels(),fontScale:this.accessibility.fontScale(),left:this.scrollX(),visibleWidth:this.tooltipViewport().width,surfaceColor:this.dark()?'#101C2C':'#FFFFFF',layout:this.dataLabelLayout(),markerSize:this.showMarkers()?this.markerSize():0,pointFormatter:this.labelFormatters()?.dataLabel}));
  protected readonly plainAnnotations=computed(()=>(this.ownedScene().annotations??[]).filter(a=>!a.box&&!a.stackTotal));
  protected readonly emptyState=computed(()=>chartEmptyState(this.ownedScene(),this.locale()));
  protected readonly activeTilemapCircle=computed(()=>this.scene().family==='tilemap'?tilemapCircleOutline(this.state().active?.hit,this.viewport()??{width:this.scene().width,height:this.boundedHeight()},this.transform(),this.dark()?'#F2F6FC':'#172438'):undefined);
  protected readonly activeVennDrawing=computed(()=>{const point=this.state().active,venn=this.ownedScene().venn;if(!venn||!point?.venn)return undefined;const circles=venn.layout.circles.filter(c=>c.radius>0&&(c.bit&point.venn!.mask)!==0);if(!circles.length)return undefined;const view=this.viewport()??{width:this.scene().width,height:this.boundedHeight()},t=this.transform(),unit=Math.sqrt(t.sx*t.sy),ink=this.dark()?'#F2F6FC':'#172438';return '<svg viewBox="0 0 '+view.width+' '+view.height+'"><g transform="translate('+t.x+' '+t.y+') scale('+t.sx+' '+t.sy+')">'+circles.map(c=>'<circle cx="'+c.cx+'" cy="'+c.cy+'" r="'+c.radius+'" fill="none" stroke="'+ink+'" stroke-width="'+4/unit+'"/><circle cx="'+c.cx+'" cy="'+c.cy+'" r="'+c.radius+'" fill="none" stroke="#FFFFFF" stroke-width="'+1/unit+'"/>').join('')+'</g></svg>';});
  protected readonly activePolygonDrawing=computed(()=>{
    const point=this.state().active,h=point?.hit;if(h?.type!=='polygon'||point?.relationship?.type==='link'||point?.regression?.type==='fit')return undefined;const view=this.viewport()??{width:this.scene().width,height:this.boundedHeight()},t=this.transform(),path=h.vertices.map((p,i)=>(i?'L':'M')+p.x+' '+p.y).join('')+'Z',unit=Math.sqrt(t.sx*t.sy),ink=this.dark()?'#F2F6FC':'#172438';
    return '<svg viewBox="0 0 '+view.width+' '+view.height+'"><g transform="translate('+t.x+' '+t.y+') scale('+t.sx+' '+t.sy+')"><path d="'+path+'" fill="none" stroke="'+ink+'" stroke-width="'+4/unit+'"/><path d="'+path+'" fill="none" stroke="#FFFFFF" stroke-width="'+2/unit+'"/></g></svg>';
  });
  protected readonly activeItemDrawing=computed(()=>{
    if(!['item','treegraph','networkgraph','packedbubble'].includes(this.scene().family))return undefined;const id=this.state().active?.id;if(!id)return undefined;
    const circles=this.ownedScene().series.find(s=>s.id===id.seriesId)?.circles?.filter(c=>c.pointId===id.pointId);if(!circles?.length)return undefined;
    const view=this.viewport()??{width:this.scene().width,height:this.boundedHeight()},t=this.transform(),ink=this.dark()?'#F2F6FC':'#172438';
    const sourceClip=this.ownedScene().clip,pad=3+1/Math.min(t.sx,t.sy),clip=sourceClip?{x:sourceClip.x-pad,y:sourceClip.y-pad,width:sourceClip.width+2*pad,height:sourceClip.height+2*pad}:undefined,clipId='nc-active-circles',defs=clip?'<defs><clipPath id="'+clipId+'"><rect x="'+(t.x+clip.x*t.sx)+'" y="'+(t.y+clip.y*t.sy)+'" width="'+clip.width*t.sx+'" height="'+clip.height*t.sy+'"/></clipPath></defs>':'';
    return '<svg viewBox="0 0 '+view.width+' '+view.height+'">'+defs+'<g'+(clip?' clip-path="url(#'+clipId+')"':'')+'>'+circles.map(c=>'<circle cx="'+(t.x+c.cx*t.sx)+'" cy="'+(t.y+c.cy*t.sy)+'" r="'+(c.radius*Math.sqrt(t.sx*t.sy)+2)+'" fill="none" stroke="'+ink+'" stroke-width="2"/>').join('')+'</g></svg>';
  });
  protected readonly activeSectorDrawing=computed(()=>sectorSelectionOutline(this.state().active?.hit,this.viewport()??{width:this.scene().width,height:this.boundedHeight()},this.transform(),this.dark()?'#F2F6FC':'#172438'));
  protected readonly activeTile=computed(()=>{const id=this.state().active?.id;if(this.scene().family==='wordcloud')return id?this.ownedScene().series.find(s=>s.id===id.seriesId)?.textGlyphs?.find(word=>word.pointId===id.pointId)?.bounds:undefined;if(this.scene().family!=='treemap')return undefined;return id?this.ownedScene().series.find(s=>s.id===id.seriesId)?.bars?.find(rect=>rect.pointId===id.pointId):undefined;});
  protected readonly tileLabels=computed(()=>{const scene=this.ownedScene();if(!['flame','dendrogram','dependencywheel','arcdiagram','chord','sankey','sunburst','treemap','treegraph','organization','networkgraph','packedbubble'].includes(scene.family)||!this.showDataLabels())return [];const t=this.transform(),colors=new Map(scene.series.map(s=>[s.id,s.color]));return (scene.annotations??[]).flatMap(a=>a.box?[{text:a.text,left:this.mapX(a.x-a.box.width/2),top:this.mapY(a.y-a.box.height/2),width:a.box.width*t.sx,height:a.box.height*t.sy,color:['dendrogram','dependencywheel','arcdiagram','chord','sankey','treegraph','networkgraph'].includes(scene.family)?this.ink():scene.family==='packedbubble'?labelInk(colors.get(a.box.seriesId)!,this.dark()?'#101C2C':'#FFFFFF',.64):labelInk(colors.get(a.box.seriesId)!)}]:[]);});
  protected readonly transform=computed(()=>sceneTransform(this.ownedScene(),this.viewport()??{width:this.scene().width,height:this.boundedHeight()}));
  protected readonly expandedTooltip=signal(false);
  protected readonly pinnedOverlay=computed(()=>this.pinned()&&this.tooltipMode()==='floating'&&!this.expandedTooltip()&&this.accessibility.fontScale()<=1.5&&this.tooltipViewport().width>=200&&(this.viewport()?.height??this.boundedHeight())>=220);
  protected readonly pinnedBodyHeight=computed(()=>Math.min(220,(this.viewport()?.height??this.boundedHeight())-88));
  protected readonly pinnedWidth=computed(()=>this.tooltipViewport().width-16);
  protected readonly toggle=(value:boolean)=>!value;
  private readonly tooltipActive=computed(()=>this.state().active);
  private readonly tooltipShared=computed(()=>this.state().shared);
  protected readonly tooltipDetails=computed(()=>{const point=this.tooltipActive();return point&&!this.tooltipShared()?directionalDetails(point,this.formatNumber(),this.locale(),this.ownedScene().unit,this.ownedScene().family,this.ownedScene().regression):[];});
  protected readonly tooltipHeight=computed(()=>compactTooltipHeight(this.tooltipActive(),this.tooltipShared(),this.accessibility.fontScale(),this.ownedScene().family,this.tooltipDetails().length));
  private readonly fullTextTooltip=computed(()=>{
    const state=this.state();
    // Prefer readable, stable full-text details over alternating overlay/panel
    // placement for the same long series names at consecutive observations.
    return state.shared?state.shared.rows.some(row=>row.name.length>48):!!state.active&&(state.active.label.length+state.active.seriesName.length>80);
  });
  protected readonly dockTooltip=computed(()=>this.tooltipMode()==='docked'||(this.tooltipMode()==='floating'&&!this.pinnedOverlay()&&(this.pinned()||(this.scene().family==='boxplot'&&!!this.state().shared)||this.expandedTooltip()||this.fullTextTooltip()||(this.state().shared?.rows.length??0)>4||this.tooltipViewport().width<160||this.accessibility.fontScale()>1.5||!!this.state().active&&this.tooltipPosition().docked)));
  protected readonly gaugeParts=computed(()=>{
    const scene=this.geometryScene();if(scene.family!=='gauge'||!scene.circular&&!radialEntrance(scene,this.viewport()??{width:scene.width,height:this.boundedHeight()}))return null;
    return {base:scene.series.filter(series=>series.id!=='reading'&&series.id!=='target').map(series=>series.id),reading:['reading'],overlay:scene.series.filter(series=>series.id==='target').map(series=>series.id)};
  });
  protected readonly drawing = computed(() =>this.renderActive()? sceneSvg(this.paintScene(), this.dark()?'#35465E':'#DFE5ED', this.viewport(),false,{surfaceColor:this.dark()?'#101C2C':'#FFFFFF',showMarkers:this.showMarkers(),strokeWidth:this.strokeWidth(),markerSize:this.markerSize(),markerStyle:this.markerAppearance(),layer:'series',seriesIds:this.gaugeParts()?.reading}):'');
  protected readonly gridDrawing=computed(()=>this.renderActive()?this.gaugeParts()?sceneSvg(this.paintScene(),this.dark()?'#35465E':'#DFE5ED',this.viewport(),false,{layer:'series',seriesIds:this.gaugeParts()!.base}):sceneSvg(this.gridScene(),this.dark()?'#35465E':'#DFE5ED',this.viewport(),this.showGrid(),{layer:'grid',surfaceColor:this.dark()?'#101C2C':'#FFFFFF',parallelAxes:this.showParallelAxes(),parallelTicks:this.showParallelTicks()}):'');
  protected readonly gaugeOverlayDrawing=computed(()=>this.renderActive()?sceneSvg(this.paintScene(),this.dark()?'#35465E':'#DFE5ED',this.viewport(),false,{layer:'series',seriesIds:this.gaugeParts()?.overlay??[]}):'');
  protected readonly motionStyles=computed(()=>this.motion.styles(this.geometryScene(),this.viewport()??{width:this.geometryScene().width,height:this.boundedHeight()}));
  protected readonly radialLayout=computed(()=>this.animationEnabled()&&!this.accessibility.reduceMotion()?radialEntrance(this.geometryScene(),this.viewport()??{width:this.geometryScene().width,height:this.boundedHeight()}):undefined);
  protected readonly bubbleLayout=computed(()=>this.animationEnabled()&&!this.accessibility.reduceMotion()?bubbleEntrance(this.paintScene(),this.viewport()??{width:this.geometryScene().width,height:this.boundedHeight()}):undefined);
  private readonly motionSignature=computed(()=>this.animationEnabled()&&!this.accessibility.reduceMotion()&&this.animationDuration()>0?sceneMotionSignature(this.ownedScene()):'');
  private readonly tooltipDensity=computed(()=>tooltipOccupancy(this.ownedScene(),this.viewport()??{width:300,height:this.boundedHeight()},this.tooltipViewport().width,this.scrollX()));
  protected readonly tooltipPosition=computed(()=>{
    const point=this.state().active,view=this.tooltipViewport(),offset=this.scrollX();
    // Idle/off tooltips do not need a density map, including during scrolling.
    if(!point||this.tooltipMode()!=='floating')return {x:offset,y:0,width:Math.max(0,view.width-16),docked:false};
    const height=this.tooltipHeight();
    const group=this.state().shared,x=point?this.mapX(!this.horizontalBars()&&group?group.coordinate:point.x):0,y=point?this.mapY(this.horizontalBars()&&group?group.coordinate:point.y):0;
    const layout=tooltipLayout(view,{x:x-offset,y},height,this.tooltipDensity());return {...layout,x:layout.x+offset};
  });
  protected mapX(x:number):number{const t=this.transform();return t.x+x*t.sx;}
  private axisLabel(axis:NativeChartAxisLabelContext['axis'],text:string,value?:string|number,type?:NativeChartAxisLabelContext['type']):string{
    const formatters=this.labelFormatters(),formatter=axis==='x'?formatters?.xAxisLabel:formatters?.yAxisLabel;
    return formatter?.({axis,text,value,type})??text;
  }
  protected readonly primaryYTicks=computed(()=>{
    const ticks=this.scene().grid;
    return this.labelFormatters()?.yAxisLabel?ticks.map(tick=>({...tick,label:tick.label?this.axisLabel('y',tick.label,tick.value,tick.type):''})):ticks;
  });
  protected readonly secondaryYTicks=computed(()=>this.scene().secondaryGrid?.map(tick=>({
    ...tick,label:this.axisLabel('secondaryY',this.secondaryTickLabel(tick.label),tick.value,tick.type),
  })));
  private readonly formattedXLabels=computed(()=>{
    const labels=this.scene().labels;
    return this.labelFormatters()?.xAxisLabel?labels.map(tick=>({...tick,label:this.axisLabel('x',tick.label,tick.value,tick.type)})):labels;
  });
  protected readonly weightedLabels=computed(()=>{
    const layout=this.axisLabelLayout(),ticks=variwideAxisLabels(this.ownedScene(),this.transform(),layout!=='auto');
    if(layout==='auto'&&!this.labelFormatters()?.xAxisLabel)return ticks;
    return ticks.map(tick=>{
      const label=this.axisLabel('x',tick.label,tick.id,'category');
      const width=layout==='all'?this.xTickWidthFor(label):tick.width;
      const left=layout==='auto'?tick.left:Math.max(0,Math.min((this.viewport()?.width??this.contentWidth())-width,tick.left+(tick.width-width)/2));
      return {...tick,label,width,left};
    });
  });
  protected readonly xLabelGap=computed(()=>{
    const scale=this.accessibility.fontScale();
    return (this.scene().family==='heatmap'||scale>1.5?48:24)*Math.max(1,scale);
  });
  protected readonly displayedXLabels=computed(()=>{
    const labels=this.formattedXLabels(),gap=this.xLabelGap();
    if(this.axisLabelLayout()!=='auto')return labels;
    const sparse=this.scene().family!=='heatmap'&&this.accessibility.fontScale()<=1.5&&
      labels.every((label,index)=>index===0||Math.abs(this.mapX(label.x)-this.mapX(labels[index-1]!.x))>=gap);
    if(sparse)return labels;
    const separation=Math.max(gap,this.xTickWidth());
    let prior:number|undefined;
    return labels.filter(label=>{
      const left=this.xTickLeft(label.x);
      if(prior!==undefined&&Math.abs(left-prior)<separation-.01)return false;
      prior=left;return true;
    });
  });
  protected readonly xTickWidth=computed(()=>{
    const width=this.viewport()?.width??this.contentWidth();
    const slots=Math.min(this.scene().labels.length,Math.max(1,Math.floor(width/this.xLabelGap())));
    return Math.max(0,Math.min(width,80,Math.max(24,width/Math.max(1,slots))));
  });
  protected xTickWidthFor(label:string):number{
    if(this.axisLabelLayout()!=='all')return this.xTickWidth();
    const width=this.viewport()?.width??this.contentWidth();
    return Math.min(width,Math.max(this.xTickWidth(),Math.ceil(label.length*8*Math.max(1,this.accessibility.fontScale())+8)));
  }
  protected xTickLeft(x:number,labelWidth=this.xTickWidth()):number{
    const width=this.viewport()?.width??this.contentWidth();
    return Math.max(0,Math.min(width-labelWidth,this.mapX(x)-labelWidth/2));
  }
  protected mapY(y:number):number{const t=this.transform();return t.y+y*t.sy;}
  protected readonly secondaryTitleAppearance=computed(()=>nativeTextStyle(this.secondaryYAxisTitleStyle(),{align:'right',color:this.muted(),fontSize:12,fontWeight:400}),{equal:sameTextStyle});
  protected secondaryTickLabel(label:string):string{return this.scene().mixedAxes&&label.trim()&&Number.isFinite(Number(label))?this.formatNumber()(Number(label)):label;}
  private readonly formatNumber=computed(()=>chartNumberFormatter(this.locale()));
  protected readonly touchHint=computed(()=>{
    if(this.pinned())return this.locale()==='en'?'Tooltip pinned. Unpin to explore, or close the detail.':'Tooltip fijado. Desfija para explorar o cierra el detalle.';
    const en=this.locale()==='en';
    const heatmap=this.ownedScene().heatmap;if(heatmap){const status=heatmap.layout.status;if(status==='allMissing')return en?'All supplied cells are unknown. Missing values are not zero.':'Todas las celdas aportadas son desconocidas. Los valores ausentes no son cero.';if(status==='noInk')return en?'The matrix is transparent. Original values are retained.':'La matriz es transparente. Se conservan los valores originales.';if(status==='noSource')return en?'No original matrix cells.':'No hay celdas originales en la matriz.';}
    const venn=this.ownedScene().venn;if(venn){const status=venn.layout.status;if(status==='unknown')return en?'Unknown intersections: circles are not drawn. Use Previous/Next for known values.':'Intersecciones desconocidas: no se dibujan círculos. Usa Anterior/Siguiente para los valores conocidos.';if(status==='allZero')return en?'All measurements are zero. Use Previous and Next.':'Todas las medidas son cero. Usa Anterior y Siguiente.';if(status==='approximate')return en?'Circle areas approximate these measurements; tooltips show original inclusive values.':'Los círculos aproximan estas medidas; los tooltips muestran valores inclusivos originales.';if(status==='exact')return en?'Touch a region to read its original inclusive measurement.':'Toca una región para consultar su medida inclusiva original.';}
    if(!this.ownedScene().observations.length){
      const items=this.legendItems();
      if(items.length>0&&items.every(item=>!item.visible)){
        const canRestore=this.showLegend()&&this.legendInteractive()&&!!this.ownedScene().legend;
        return en?'All series are hidden.'+(canRestore?' Show one in the legend.':''):'Todas las series están ocultas.'+(canRestore?' Activa una en la leyenda.':'');
      }
      if(this.emptyNodeWindow()){
        const context=this.viewportContext(),canZoom=context?.controls||context?.pinch,canPan=context?.pan;
        return (en?'No nodes in this region.':'No hay nodos en esta zona.')+(canZoom?(en?' Zoom out or reset the view.':' Aleja o restablece la vista.'):canPan?(en?' Pan to another region.':' Desplaza la vista a otra zona.'):'');
      }
      if(this.ownedScene().wordcloud){const words=this.ownedScene().wordcloud!;return words.status==='measuring'?(en?'Measuring text…':'Midiendo texto…'):words.layout.emptyReason==='noSpace'?(en?'No terms fit this plot at the requested sizes. Reduce font sizes or use a taller plot. Original weights are retained.':'Ningún término cabe con estos tamaños. Reduce la fuente o aumenta la altura. Se conservan los pesos originales.'):en?'No positive known term weights to display. Original terms are retained.':'No hay términos con peso positivo conocido. Se conservan los términos originales.';}
      if(this.ownedScene().tilemap?.layout.status==='allMissing')return en?'All source values are unknown. Original cell positions are preserved.':'Todos los valores originales son desconocidos. Se conservan las posiciones originales de las celdas.';
      if(this.ownedScene().tilemap?.layout.status==='noInk')return en?'No cells can be drawn with these settings. Original values are preserved.':'No se pueden dibujar celdas con estas opciones. Se conservan los valores originales.';
      if(this.scene().family==='polygon'&&this.ownedScene().series.some(s=>!!s.areaPath))return en?'No source vertices inside this window. Reset zoom to inspect them.':'No hay vértices de origen en esta ventana. Restablece el zoom para explorarlos.';
      if(this.ownedScene().contour){const reason=this.ownedScene().contour!.emptyReason;return reason==='outsideViewport'?(en?'No isolines in this window. Zoom out or reset.':'No hay isolíneas en esta ventana. Aleja o restablece la vista.'):reason==='missing'?(en?'Unknown samples interrupt every available cell. Original values remain in the source data.':'Las muestras desconocidas interrumpen todas las celdas disponibles. Los valores originales se conservan.'):en?'No crossings at the requested levels. The original measurements are retained.':'No hay cruces en los niveles solicitados. Se conservan las medidas originales.';}
      return en?'No data to display':'No hay datos para mostrar';
    }
    if(['variablepie','item','pie','donut'].includes(this.scene().family)&&this.ownedScene().observations.every(p=>p.value===0))return en?'All values are zero. Use Previous and Next.':'Todos los valores son cero. Usa Anterior y Siguiente.';
    if(this.scene().family==='heatmap')return en?'Touch a known cell to read its original value. The colour scale identifies unknown cells; absent coordinates remain empty.':'Toca una celda conocida para consultar su valor original. La escala de color identifica desconocidos; las coordenadas ausentes quedan vacías.';
    if(this.scene().family==='wordcloud')return en?'Touch a word to read its original weight.':'Toca una palabra para consultar su peso original.';
    if(this.scene().family==='contour')return en?'Touch an isoline to inspect its level and original corner samples.':'Toca una isolínea para consultar su nivel y las medidas originales de sus esquinas.';
    return this.tooltipMode()==='off'?(en?'Explore with the navigation controls':'Explora con los controles de navegación'):(en?'Touch a point to see its value':'Toca un punto para ver su valor');
  });
  protected readonly accessibilityHint = computed(() => {
    const en=this.locale()==='en';
    if(!this.ownedScene().observations.length)return this.touchHint();
    if(this.pinned())return en?'Tooltip pinned. Use Unpin tooltip to explore again.':'Tooltip fijado. Usa Desfijar tooltip para volver a explorar.';
    if(this.inputBridge)return en?'Use the arrow keys to change observation, and Home or End to jump to the first or last.':'Usa las flechas para cambiar de observación e Inicio o Fin para ir a la primera o la última.';
    return en?'Swipe up or down to change observation. Previous and Next are also available.':'Desliza arriba o abajo para cambiar de observación. También puedes usar Anterior y Siguiente.';
  });
  protected readonly accessibilityValue = computed(() => {
    const text=this.accessibilityValueText(this.state());
    if(!this.inputBridge)return {text};
    return {...(this.session?.navigationRange??{min:0,max:0,now:0}),text};
  });
  private accessibilityValueText(state:InteractionSnapshot):string{
    const p=state.active,en=this.locale()==='en',format=this.formatNumber();
    const empty=this.emptyState();if(!p&&empty&&!this.emptyNodeWindow())return empty.title+'. '+empty.description;
    if(!p&&(this.ownedScene().heatmap||this.ownedScene().tilemap)&&this.ownedScene().observations.length===0)return this.touchHint();
    if(!p&&this.ownedScene().contour&&!this.ownedScene().observations.length)return this.touchHint();
    if(!p)return this.ownedScene().observations.length?(en?'No selection':'Sin selección'):this.emptyNodeWindow()?(en?'No nodes in this region':'No hay nodos en esta zona'):(en?'No data':'Sin datos');
    const shared=state.shared;if(shared)return shared.label+', '+shared.rows.map(row=>row.name+': '+(row.point?observationValue(row.point,this.scene().family,format,this.locale())+' '+observationUnit(row.point,this.scene().family,this.scene().unit,this.scene().secondaryUnit):en?'No value':'Sin dato')).join(', ');
    return [p.label,this.scene().family==='heatmap'||p.seriesName===p.label||p.seriesName===this.scene().unit?'':p.seriesName,observationValue(p,this.scene().family,format,this.locale())+' '+observationUnit(p,this.scene().family,this.scene().unit,this.scene().secondaryUnit),
      ...(p.node&&p.node.directed!==false?[(en?'Incoming':'Entrantes')+': '+format(p.node.incoming),(en?'Outgoing':'Salientes')+': '+format(p.node.outgoing),(en?'Depth':'Profundidad')+': '+format(p.node.depth)]:[]),
      ...directionalDetails(p,format,this.locale(),this.ownedScene().unit,this.ownedScene().family,this.ownedScene().regression),
      ...(p.xValue===undefined?[]:[(this.xAxisTitle()||'X')+': '+format(p.xValue)]),
      ...(p.sizeValue===undefined?[]:[(en?'Size':'Tamaño')+': '+format(p.sizeValue)]),
      ...(p.percentage===undefined?[]:[format(p.percentage)+'%']),...(p.subtotal?[(en?'Subtotal':'Subtotal')+(p.incomplete?(en?' · incomplete known values':' · valores conocidos incompletos'):'')]:[])].filter(Boolean).join(', ');
  }
  protected readonly actions = computed(()=>this.pinned()?[]:[{name: 'increment', label: this.locale()==='en'?'Next':'Siguiente'}, {name: 'decrement', label: this.locale()==='en'?'Previous':'Anterior'}]);
  protected readonly missingSourceCount=computed(()=>{const scene=this.ownedScene();if(scene.family==='bullet')return (scene.bulletData??[]).filter(point=>point.visible&&point.measure===null&&typeof point.target!=='number').length;if(scene.family==='variwide')return (scene.variwideData??[]).filter(point=>point.visible&&(point.missingValue||point.missingWidth)).length;return (scene.intervals??scene.events??[]).filter(point=>point.visible&&point.missing).length;});
  protected readonly missingSourceLabel=computed(()=>{const count=this.missingSourceCount();if(this.scene().family==='bullet'||this.scene().family==='variwide')return this.locale()==='en'?`${count} source items have unknown measurements or widths. Their original values are retained.`:`${count} datos originales tienen medidas o anchos desconocidos. Se conservan sus valores originales.`;return this.locale()==='en'?`${count} data ${count===1?'item has':'items have'} unknown coordinates and cannot be plotted.`:`${count} ${count===1?'dato tiene':'datos tienen'} coordenadas desconocidas y no ${count===1?'se puede':'se pueden'} dibujar.`;});
  private readonly accessibility = inject(Accessibility);
  private readonly activity=inject(ChartActivity);
  readonly active=input(true);
  /** Settle a remounted host's first frame; later motion remains enabled. */
  readonly skipEntrance=input(false);
  protected readonly renderActive=computed(()=>this.activity.active()&&this.active());
  private destroyed=false;
  private hostInput:ReturnType<typeof inputLease>|undefined;
  private acceptsInput():boolean{return !this.destroyed&&this.renderActive();}
  private readonly haptics = inject(ChartHaptics);
  private readonly inputBridge = inject(CHART_INPUT_BRIDGE, {optional: true});
  private readonly plot = viewChild<unknown, ElementRef<unknown>>('plot', {read: ElementRef});
  private session: NativeChartSession | null = null;
  private width = 0;
  private height = 0;
  private pendingEntranceResize=false;
  private tooltipPanConsumed=false;
  private pointInput:ReturnType<typeof pointLease>|undefined;
  // Keep JS callbacks outside the gesture builder: the Worklets Babel plugin auto-transforms
  // inline onStart/onEnd arrows and loses their lexical component `this` on Hermes.
  private readonly onPanStart = (e: {x: number; y: number;numberOfPointers?:number}): void => {if(!this.viewportInteracting()&&(e.numberOfPointers??1)<2)this.begin(e.x,e.y);};
  private readonly onPanUpdate = (e: {x: number; y: number;numberOfPointers?:number}): void => {if(!this.acceptsInput())return;if(this.viewportInteracting()||(e.numberOfPointers??1)>1){this.session?.end(false);return;}this.move(e.x,e.y);};
  private readonly onPanEnd = (e: {x: number; y: number;numberOfPointers?:number}, success: boolean): void => {
    if(!this.acceptsInput())return;
    if(this.viewportInteracting()||(e.numberOfPointers??1)>1){this.session?.end(false);return;}
    if(this.tooltipPanConsumed){this.tooltipPanConsumed=false;this.session?.end(false);return;}
    if (success) { this.move(e.x, e.y); this.session?.end(true); }
    else this.session?.end(false);
  };
  private readonly onPanFinalize = (_event: unknown, success: boolean): void => {
    if(!this.acceptsInput())return;
    this.tooltipPanConsumed=false;
    if (!success) this.session?.end(false);
  };
  private readonly onTapEnd = (e: {x: number; y: number}, success: boolean): void => {
    if (success&&!this.viewportInteracting()) this.tap(e.x,e.y);
  };
  protected readonly scrollGesture=computed(()=>Gesture.Native().enabled(!!this.viewportContext()&&this.scrolling()).shouldActivateOnStart(false).disallowInterruption(false));
  private readonly viewportGesture=computed(()=>{
    const context=this.viewportContext(),driver=this.viewportDriver(),size=this.viewport();if(!context||!driver||!size)return undefined;
    return driver.gesture(this.viewportGestureConfig(context,size),{begin:()=>this.beginViewport(context),end:(frame,success,source)=>this.endViewport(context,frame,success,source)},this.scrollGesture());
  });
  protected readonly gesture = computed(()=>{this.renderActive();this.pointInput?.revoke();
    const lease=pointLease({start:this.onPanStart,move:this.onPanUpdate,end:this.onPanEnd,finalize:this.onPanFinalize,tap:this.onTapEnd});this.pointInput=lease;
    const pointGesture=Gesture.Race(
    Gesture.Pan().enabled(this.renderActive()&&!this.pinned() && !this.scrolling() && this.interactionMode()==='explore' && this.ownedScene().observations.length>0).minDistance(8).maxPointers(1).runOnJS(true)
      .onStart(lease.callbacks.start).onUpdate(lease.callbacks.move)
      .onEnd(lease.callbacks.end).onFinalize(lease.callbacks.finalize),
    Gesture.Tap().enabled(this.renderActive()&&!this.pinned() && this.ownedScene().observations.length>0).maxDistance(8).runOnJS(true).onEnd(lease.callbacks.tap),
  );const viewportGesture=this.viewportGesture();return viewportGesture?Gesture.Simultaneous(pointGesture,viewportGesture):pointGesture;});
  constructor() {
    effect(()=>{
      const context=this.viewportContext();
      if(this.renderActive()&&context&&(context.pinch||context.pan)){if(!untracked(this.viewportDriver))this.viewportDriver.set(this.viewportFactory());}
      else untracked(()=>{this.finishViewport();this.viewportDriver()?.destroy();this.viewportDriver.set(null);});
    });
    let previousContext:NativeViewportContext|undefined,previousSize:Readonly<{width:number;height:number}>|undefined;
    effect(()=>{
      const context=this.viewportContext(),size=this.viewport(),pinned=this.pinned();
      const changed=context?.model!==previousContext?.model||context?.acknowledgment!==previousContext?.acknowledgment||context?.pinch!==previousContext?.pinch||context?.pan!==previousContext?.pan||size!==previousSize;
      if(untracked(this.viewportInteracting)&&(changed||pinned))this.afterViewportPaint(()=>this.finishViewport());
      previousContext=context;previousSize=size;
    });
    effect(()=>{const maximum=Math.max(0,this.contentWidth()-this.visibleWidth());if(untracked(this.scrollX)>maximum){untracked(()=>this.scrollX.set(maximum));this.plotScroller()?.scrollTo({x:maximum,animated:false});}});
    effect(()=>{if(!this.tooltipPinnable()||this.tooltipMode()==='off')untracked(()=>this.session?.setPinned(false));});
    effect(()=>{if(!this.state().active||this.tooltipMode()!=='floating')this.expandedTooltip.set(false);});
    let tooltipSize='',tooltipScroll=0;
    effect(()=>{
      const active=this.state().active;
      if(!this.renderActive()||!active||this.tooltipMode()!=='floating'||this.dockTooltip()||this.pinned()){this.tooltipMotion.hide();return;}
      const position=this.tooltipPosition(),view=this.tooltipViewport(),scroll=this.scrollX();
      const size=view.width+':'+view.height,resized=size!==tooltipSize||scroll!==tooltipScroll;tooltipSize=size;tooltipScroll=scroll;
      this.tooltipMotion.move(position.x,position.y,resized||!this.animationEnabled()||this.accessibility.reduceMotion()?0:Math.min(180,this.animationDuration()));
    });
    let previousMotionScene:NativeScene|undefined,previousVisibility='';
    let previousSignature='',previousKey:number|undefined,previousViewportGeneration:object|undefined,previousViewportRevision:number|undefined;
    let wasSuspended=false;
    const suspend=()=>{
      wasSuspended=true;previousMotionScene=undefined;previousSignature='';previousVisibility='';
      this.motion.finish();this.tooltipMotion.hide();this.clearPreviousDrawing();this.finishViewport();
      this.viewportDriver()?.destroy();this.viewportDriver.set(null);
      this.hostInput?.revoke();this.gesture();this.pointInput?.revoke();
      const prior=this.session?.snapshot;
      this.session?.destroy();this.session=null;
      const empty={active:null,selected:null,scrubbing:false} as const;
      this.state.set(empty);
      if(prior&&(prior.active||prior.selected||prior.scrubbing||prior.pinned))this.interactionChange.emit(empty);
      this.drawing();this.gridDrawing();this.referenceDrawing();this.gaugeOverlayDrawing();
    };
    inject(DestroyRef).onDestroy(this.activity.onSuspend(()=>untracked(suspend)));
    effect(()=>{
      if(!this.renderActive()){
        suspend();
        return;
      }
      const viewport=this.viewport(),signature=this.motionSignature(),key=this.animationKey(),visibility=this.visibilitySignature();
      const context=this.viewportContext(),windowChanged=!!context&&context.generation===previousViewportGeneration&&context.revision!==previousViewportRevision;
      previousViewportGeneration=context?.generation;previousViewportRevision=context?.revision;
      const pendingResize=this.pendingEntranceResize;this.pendingEntranceResize=false;
      const replay=previousKey!==undefined&&key!==previousKey;
      previousKey=key;
      if(replay)untracked(()=>this.session?.clear());
      const duration=this.animationDuration(),enabled=this.animationEnabled()&&!this.accessibility.reduceMotion()&&duration>0;
      const scene=untracked(this.ownedScene),prior=previousMotionScene,visibilityChanged=previousVisibility!==''&&visibility!==previousVisibility;
      previousMotionScene=scene;previousVisibility=visibility;
      this.clearPreviousDrawing();
      if(wasSuspended){wasSuspended=false;this.motion.finish();previousSignature=signature;return;}
      const dataChanged=previousSignature!==''&&signature!==previousSignature;
      if(enabled&&(visibilityChanged||dataChanged)&&!replay&&!windowChanged&&viewport&&prior&&prior.family===scene.family&&this.motion.update){
        const ms=Math.min(220,duration);
        this.previousDrawing.set(sceneSvg(prior,this.dark()?'#35465E':'#DFE5ED',viewport,false,{surfaceColor:this.dark()?'#101C2C':'#FFFFFF',showMarkers:this.showMarkers(),strokeWidth:this.strokeWidth(),markerSize:this.markerSize(),markerStyle:this.markerAppearance(),layer:'series'}));
        this.motion.update(ms);this.previousDrawingTimer=setTimeout(()=>{this.previousDrawingTimer=null;this.previousDrawing.set(null);},ms+250);
        previousSignature=signature;return;
      }
      if(!enabled||scene.observations.length===0){this.motion.finish();previousSignature=signature;previousKey=key;return;}
      if(!viewport)return;
      if(this.skipEntrance()&&previousSignature===''&&!replay){this.motion.finish();previousSignature=signature;return;}
      if(windowChanged&&!replay){this.motion.finish();previousSignature=signature;return;}
      if(signature!==previousSignature||replay){
        const selected=this.session?.snapshot;
        const retainsSelection=!replay&&this.session?.scene.family===scene.family&&selected?.selected&&scene.observations.some(p=>selected.shared?p.group?.key===selected.shared.key:p.id.seriesId===selected.selected!.seriesId&&p.id.pointId===selected.selected!.pointId);
        // A retained tooltip describes the final projected datum, so settle its geometry.
        if(retainsSelection)this.motion.finish();else this.motion.start(duration);
        previousSignature=signature;
      }
      // Native/web layout may commit a second size before the first paint. Restart only
      // that pending entrance; a resize after it has begun still settles stale motion.
      else if(pendingResize||this.motion.pending)this.motion.start(duration);
      else this.motion.finish();
    });
    effect(onCleanup => {
      const target = this.plot()?.nativeElement;
      if (!target || !this.inputBridge) return;
      this.renderActive();this.pinned();
      const context=this.viewportContext(),driver=this.viewportDriver();
      const lease=inputLease({
        active:()=>this.acceptsInput(),
        enabled:()=>this.acceptsInput()&&!this.pinned(),
        layout: (width,height) => this.resize(width,height),
        begin: (x, y, width, height) => { this.resize(width,height); this.begin(x, y); },
        consumeTap:(x,y,width,height)=>{this.resize(width,height);return this.dismissFloatingTooltipAt(x,y);},
        tap: (x,y,width,height)=>{this.resize(width,height);this.tap(x,y);},
        move: (x, y) => this.move(x, y), end: commit => this.session?.end(commit),
        step: delta => this.step(delta), jump: edge => this.step(edge), clear: () => this.clear(),
        ...(context&&driver&&(context.pinch||context.pan)?{viewport:{enabled:()=>this.acceptsInput()&&!this.pinned(),pinch:context.pinch,pan:context.pan,
          begin:(frame:ViewportGestureFrame,width:number,height:number)=>{this.resize(width,height);this.beginViewport(context);driver.preview(frame,this.viewportGestureConfig(context,{width,height}));},
          update:(frame:ViewportGestureFrame)=>{const size=this.viewport();if(size&&this.viewportSession===context&&[frame.scale,frame.x,frame.y,frame.dx,frame.dy].every(Number.isFinite))driver.preview(frame,this.viewportGestureConfig(context,size));},
          end:(frame:ViewportGestureFrame,success:boolean)=>this.endViewport(context,frame,success,Math.abs(frame.scale-1)>.01?'pinch':'pan'),
        }}:{}),
      });
      const disconnect=this.inputBridge.connect(target,lease.callbacks,this.geometryScene());
      this.hostInput=lease;
      onCleanup(()=>{lease.revoke();if(this.hostInput===lease)this.hostInput=undefined;disconnect();});
    });
    effect(() => {
      if(!this.renderActive()){
        const prior=this.session?.snapshot;
        this.session?.destroy();this.session=null;
        const empty={active:null,selected:null,scrubbing:false} as const;
        this.state.set(empty);
        if(prior&&(prior.active||prior.selected||prior.scrubbing||prior.pinned))untracked(()=>this.interactionChange.emit(empty));
        return;
      }
      const scene = this.ownedScene(),content=this.tooltipContent();
      if(this.session?.contentMode===content&&this.session.updatePresentation(scene))return;
      const selected=this.session?.scene.family===scene.family?this.session.snapshot.selected:null;
      const selectedGroup=this.session?.scene.family===scene.family?this.session.snapshot.shared?.key:undefined;
      const previous=this.session?.snapshot;
      this.session?.destroy();
      const session = new NativeChartSession(scene,
        {request: fn => requestAnimationFrame(fn), cancel: handle => cancelAnimationFrame(handle)},
        this.haptics.port(() => this.hapticsEnabled()), snapshot => {
          untracked(()=>{this.state.set(snapshot); this.interactionChange.emit(snapshot);});
        },selected,content,selectedGroup);
      this.session = session;
      this.state.set(session.snapshot);
      if(previous&&!sameInteractionContent(previous,session.snapshot))untracked(()=>this.interactionChange.emit(session.snapshot));
    });
    inject(DestroyRef).onDestroy(() => {this.destroyed=true;this.pointInput?.revoke();this.finishViewport();this.viewportDriver()?.destroy();this.session?.destroy();this.session=null;this.motion.stop();this.tooltipMotion.destroy();this.clearPreviousDrawing();});
  }
  protected measure(event: LayoutEvent): void {
    this.resize(event.nativeEvent.layout.width,event.nativeEvent.layout.height);
  }
  protected measureScroll(event:LayoutEvent):void{
    const width=event.nativeEvent.layout.width;
    if(Number.isFinite(width)&&width>0&&width!==untracked(this.visibleWidth))this.visibleWidth.set(width);
  }
  protected measureBody(event:LayoutEvent):void{const width=event.nativeEvent.layout.width;if(Number.isFinite(width)&&width>0)this.bodyWidth.set(width);}
  protected scrollPlot(event:ScrollEvent):void{
    const x=event.nativeEvent.contentOffset.x;
    if(Number.isFinite(x))this.scrollX.set(Math.max(0,Math.min(this.contentWidth()-this.visibleWidth(),x)));
  }
  private resize(width:number,height:number):void {
    if(this.destroyed)return;
    if (!Number.isFinite(width)||!Number.isFinite(height)||width<=0||height<=0) return;
    this.width=width;this.height=height;
    const previous=untracked(this.viewport);
    if(previous?.width===width&&previous?.height===height)return;
    // Capture this at measurement time: the queued frame can start before the
    // signal effect runs, but this is still the entrance's initial layout.
    this.pendingEntranceResize ||= this.motion.pending===true;
    this.viewport.set({width,height});
    this.viewportChange.emit({width,height});
    this.session?.end(false);
  }
  private begin(x: number, y: number): void {
    if(!this.acceptsInput())return;
    this.tooltipPanConsumed=this.dismissFloatingTooltipAt(x,y);if(this.tooltipPanConsumed)return;
    this.pendingEntranceResize=false;
    this.motion.finish();
    if (this.width > 0 && this.height > 0 && !this.accessibility.screenReader()){
      const t=this.transform();this.session?.begin((x-t.x)/t.sx,(y-t.y)/t.sy,24/Math.min(t.sx,t.sy));
    }
  }
  private tap(x:number,y:number):void{
    if(!this.acceptsInput())return;
    if(this.dismissFloatingTooltipAt(x,y))return;
    this.pendingEntranceResize=false;
    this.motion.finish();
    if(this.width>0&&this.height>0&&!this.accessibility.screenReader()){
      const t=this.transform();this.session?.tap((x-t.x)/t.sx,(y-t.y)/t.sy,24/Math.min(t.sx,t.sy));
    }
  }
  private move(x: number, y: number): void {
    if(!this.acceptsInput())return;
    if(this.tooltipPanConsumed)return;
    if (this.width > 0 && this.height > 0){
      const t=this.transform();this.session?.move((x-t.x)/t.sx,(y-t.y)/t.sy);
    }
  }
  protected step(direction: -1 | 1 | 'first' | 'last'): void {
    if(!this.acceptsInput())return;
    this.pendingEntranceResize=false;this.motion.finish();this.session?.step(direction);
    const active=this.session?.snapshot.active,width=this.visibleWidth();
    if(!active||!this.scrolling())return;
    const x=this.mapX(active.x),current=this.scrollX(),next=Math.max(0,Math.min(this.contentWidth()-width,x<current+24?x-24:x>current+width-24?x-width+24:current));
    if(next!==current){this.scrollX.set(next);this.plotScroller()?.scrollTo({x:next,animated:false});}
  }
  protected readonly zoomInAvailable=computed(()=>{const context=this.viewportContext();if(!context||this.pinned())return false;const next=transformPlanViewport(context.model,{type:'zoom',factor:2});return next.status==='ok'&&!sameViewportValue(next.value,context.model.value);});
  protected requestView(intent:PlanViewportIntent):void{if(!this.acceptsInput())return;const context=this.viewportContext();if(!context||this.pinned())return;this.motion.finish();this.session?.clear();this.viewportRequest.emit({intent,source:'controls',model:context.model});}
  private viewportGestureConfig(context:NativeViewportContext,size:Readonly<{width:number;height:number}>):ViewportGestureConfig{
    const axes=viewportCanvas(this.ownedScene(),context,size);return {width:size.width,height:size.height,maximumScale:viewportScaleLimit(context.model),horizontal:axes.horizontal,vertical:axes.vertical,pinch:context.pinch,pan:context.pan,enabled:!this.pinned()&&this.ownedScene().observations.length>0};
  }
  private beginViewport(context:NativeViewportContext):void{
    if(!this.acceptsInput())return;
    if(this.viewportContext()?.model!==context.model||this.pinned()){this.viewportDriver()?.finish();return;}
    this.motion.finish();this.session?.end(false);this.viewportSession=context;
    this.viewportSnapshot.set({grid:this.gridDrawing(),series:this.drawing(),references:this.referenceDrawing()});this.viewportInteracting.set(true);
    this.afterViewportPaint(()=>{if(this.viewportSession===context)this.viewportDriver()?.show();});
  }
  private endViewport(context:NativeViewportContext,frame:ViewportGestureFrame,success:boolean,source:'pinch'|'pan'):void{
    if(!this.acceptsInput())return;
    if(!success||this.viewportSession!==context||this.viewportContext()?.model!==context.model||this.pinned()){this.finishViewport();return;}
    const size=this.viewport();if(!size){this.finishViewport();return;}
    const request=viewportGestureRequest(this.ownedScene(),context,size,frame,source);
    if(!request){this.finishViewport();return;}
    this.session?.clear();this.viewportRequest.emit(request);
  }
  private afterViewportPaint(callback:()=>void):void{
    if(this.viewportFrame!==null)cancelAnimationFrame(this.viewportFrame);
    this.viewportFrame=requestAnimationFrame(()=>{this.viewportFrame=requestAnimationFrame(()=>{this.viewportFrame=null;callback();});});
  }
  private finishViewport():void{
    if(this.viewportFrame!==null){cancelAnimationFrame(this.viewportFrame);this.viewportFrame=null;}
    this.viewportDriver()?.finish();this.viewportSession=null;this.viewportSnapshot.set(null);this.viewportInteracting.set(false);
  }
  protected panView(axis:'x'|'y',direction:number):void{
    const context=this.viewportContext();if(!context||this.pinned())return;
    const size=this.viewport()??{width:this.scene().width,height:this.boundedHeight()},canvas=viewportCanvas(this.ownedScene(),context,size);
    const request=viewportGestureRequest(this.ownedScene(),context,size,{scale:1,x:canvas.x+canvas.width/2,y:canvas.y+canvas.height/2,dx:axis==='x'?-direction*canvas.width*.25:0,dy:axis==='y'?-direction*canvas.height*.25:0},'controls');
    if(request)this.requestView(request.intent);
  }
  protected toggleDetails():void{if(!this.acceptsInput())return;if(!this.pinned())this.expandedTooltip.update(this.toggle);}
  protected togglePin():void{if(!this.acceptsInput())return;if(this.tooltipPinnable()&&this.tooltipMode()!=='off')this.session?.setPinned(!this.session.snapshot.pinned);}
  protected toggleLegend(id:string):void{if(!this.acceptsInput())return;
    const legend=this.ownedScene().legend;if(!this.legendInteractive()||!legend?.some(item=>item.id===id))return;
    this.legendChange.emit(Object.freeze(legend.filter(item=>item.id===id?item.visible:!item.visible).map(item=>item.id)));
  }
  private clearPreviousDrawing():void{if(this.previousDrawingTimer!==null){clearTimeout(this.previousDrawingTimer);this.previousDrawingTimer=null;}this.previousDrawing.set(null);}
  protected clear(): void {if(!this.acceptsInput())return; this.session?.clear(); }
  private dismissFloatingTooltipAt(x:number,y:number):boolean{
    if(!this.state().active||this.tooltipMode()!=='floating'||this.dockTooltip()||this.pinned())return false;
    const target=this.tooltipPosition(),height=this.tooltipHeight(),position=this.tooltipMotion.position()??target;
    if(x<position.x||x>position.x+target.width||y<position.y||y>position.y+height)return false;
    this.session?.clear();return true;
  }
  protected adjust(event: {nativeEvent: {actionName: string}}): void {
    if (event.nativeEvent.actionName === 'increment') this.step(1);
    if (event.nativeEvent.actionName === 'decrement') this.step(-1);
  }
}
