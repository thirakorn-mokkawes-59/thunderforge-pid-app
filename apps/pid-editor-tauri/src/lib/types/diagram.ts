export interface Point {
  x: number;
  y: number;
}

export interface Rectangle {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DiagramElement {
  id: string;
  symbolId: string;
  symbolPath: string;
  name: string;
  tag?: string;
  tagPosition?: 'below' | 'above' | 'left' | 'right';
  tagStyle?: 'badge' | 'simple';
  showTag?: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
  color?: string;
  opacity?: number;
  flipX?: boolean;
  flipY?: boolean;
  locked?: boolean;
  showLabel?: boolean;
  zIndex?: number;
  properties?: Record<string, any>;
}

export interface ConnectionPoint extends Point {
  elementId: string;
  pointIndex: number;
  type: 'input' | 'output' | 'bidirectional';
}

export interface Connection {
  id: string;
  from: ConnectionPoint;
  to: ConnectionPoint;
  path: string;
  style: ConnectionStyle;
  routing: RoutingAlgorithm;
}

export interface ConnectionStyle {
  strokeWidth: number;
  strokeColor: string;
  strokeDasharray?: string;
  arrowStart?: boolean;
  arrowEnd?: boolean;
}

export enum RoutingAlgorithm {
  Direct = 'direct',
  Orthogonal = 'orthogonal',
  Curved = 'curved',
  Smart = 'smart'
}

export interface Diagram {
  id: string;
  name: string;
  elements: DiagramElement[];
  connections: Connection[];
  metadata: DiagramMetadata;
}

export interface DiagramMetadata {
  created: string;
  modified: string;
  version: string;
  author: string;
}