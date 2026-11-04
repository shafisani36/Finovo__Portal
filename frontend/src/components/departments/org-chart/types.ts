import { Department } from '../types';

export interface HierarchyNode {
  id: number;
  department: Department;
  depth: number;
  children: HierarchyNode[];
  isCollapsed?: boolean;
  
  // Geometric layout properties computed by engine
  x: number;
  y: number;
  width: number;
  height: number;
  subtreeWidth: number;
  
  // Aggregated metadata
  totalDescendantCount: number;
  totalSubtreeHeadcount: number;
}

export interface ConnectorLine {
  id: string;
  sourceId: number;
  targetId: number;
  pathData: string;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
}

export interface LayoutBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  width: number;
  height: number;
}

export interface LayoutEngineResult {
  nodes: HierarchyNode[];
  connectors: ConnectorLine[];
  bounds: LayoutBounds;
  rootNodes: HierarchyNode[];
  nodeMap: Map<number, HierarchyNode>;
}

