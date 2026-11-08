import type {PlanRelationshipNode,PlanRelationshipLink,PlanHierarchyGroup} from '@neural-charts/core/plan';

type SourceNode=PlanRelationshipNode&Readonly<{color?:never;datum?:never}>;
type SourceLink=PlanRelationshipLink&Readonly<{color?:never;datum?:never}>;
type SourceGroup=Omit<PlanHierarchyGroup,'color'>&Readonly<{color?:never}>;
export interface NativeRelationshipData<F extends 'dependencywheel'|'arcdiagram'|'chord'> {
  readonly type:F;
  readonly nodes:readonly SourceNode[];
  readonly links:readonly SourceLink[];
  readonly groups?:readonly SourceGroup[];
  readonly family?:never;readonly title?:never;readonly description?:never;readonly color?:never;
  readonly startAngle?:never;readonly nodePadding?:never;readonly nodeWidth?:never;
  readonly reversed?:never;readonly nodeRadius?:never;readonly linkWidth?:never;
}
export type NativeDependencyWheelData=NativeRelationshipData<'dependencywheel'>;
export type NativeChordData=NativeRelationshipData<'chord'>;
export type NativeArcDiagramData=NativeRelationshipData<'arcdiagram'>;
interface RelationshipLayoutBoundary {
  readonly minRadiusRatio?:never;readonly radiusScale?:never;readonly columns?:never;readonly markerRadius?:never;readonly whiskerWidth?:never;readonly capWidth?:never;readonly neckWidth?:never;readonly neckHeight?:never;
}
export interface NativeRadialRelationshipLayoutOptions extends RelationshipLayoutBoundary {
  readonly reversed?:never;readonly nodeRadius?:never;readonly linkWidth?:never;
  readonly startAngle?:number;
  readonly nodePadding?:number;
  readonly nodeWidth?:number;
  readonly stacking?:never;readonly stackLabels?:never;
}
export interface NativeArcDiagramLayoutOptions extends RelationshipLayoutBoundary {
  readonly startAngle?:never;readonly nodePadding?:never;readonly nodeWidth?:never;
  readonly reversed?:boolean;
  readonly nodeRadius?:number;
  readonly linkWidth?:number;
  readonly stacking?:never;readonly stackLabels?:never;
}
