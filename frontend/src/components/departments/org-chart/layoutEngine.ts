import { Department } from '../types';
import {
  HierarchyNode,
  ConnectorLine,
  LayoutBounds,
  LayoutEngineResult,
} from './types';

export const NODE_WIDTH = 270;
export const NODE_HEIGHT = 148;
export const SIBLING_GAP_X = 52;
export const LEVEL_GAP_Y = 110;
export const ROOT_GAP_X = 80;

/**
 * Advanced Tree Geometry & Algorithmic Layout Engine
 * Converts raw relational department records into a 2D hierarchical canvas graph.
 */
export class OrgChartLayoutEngine {
  /**
   * Main computation pipeline
   */
  public static computeLayout(
    departments: Department[],
    collapsedNodeIds: Set<number> = new Set()
  ): LayoutEngineResult {
    if (!departments || departments.length === 0) {
      return {
        nodes: [],
        connectors: [],
        bounds: { minX: 0, maxX: 0, minY: 0, maxY: 0, width: 0, height: 0 },
        rootNodes: [],
        nodeMap: new Map(),
      };
    }

    // 1. Build initial tree structure with cycle detection
    const { roots, nodeMap } = this.buildForest(departments, collapsedNodeIds);

    // 2. First pass (Bottom-Up Post-Order): Compute subtree widths and aggregate counts
    for (const root of roots) {
      this.computeSubtreeWidths(root);
    }

    // 3. Second pass (Top-Down Pre-Order): Assign geometric (X, Y) coordinates
    let currentStartX = 40;
    for (const root of roots) {
      this.assignCoordinates(root, currentStartX, 0);
      currentStartX += root.subtreeWidth + ROOT_GAP_X;
    }

    // 4. Flatten all positioned nodes
    const allPositionedNodes: HierarchyNode[] = [];
    for (const root of roots) {
      this.collectVisibleNodes(root, allPositionedNodes);
    }

    // 5. Generate smooth cubic-bezier vector connectors between connected pairs
    const connectors: ConnectorLine[] = [];
    for (const node of allPositionedNodes) {
      if (!node.isCollapsed && node.children.length > 0) {
        for (const child of node.children) {
          const connector = this.createConnectorPath(node, child);
          connectors.push(connector);
        }
      }
    }

    // 6. Compute total bounding box for zoom-to-fit calculation
    const bounds = this.computeBounds(allPositionedNodes);

    return {
      nodes: allPositionedNodes,
      connectors,
      bounds,
      rootNodes: roots,
      nodeMap,
    };
  }

  /**
   * Step 1: Construct Forest (Tree Roots + Children)
   */
  private static buildForest(
    departments: Department[],
    collapsedNodeIds: Set<number>
  ): { roots: HierarchyNode[]; nodeMap: Map<number, HierarchyNode> } {
    const nodeMap = new Map<number, HierarchyNode>();
    const deptIdSet = new Set(departments.map((d) => d.id));

    // Initialize HierarchyNode for each department
    for (const dept of departments) {
      nodeMap.set(dept.id, {
        id: dept.id,
        department: dept,
        depth: 0,
        children: [],
        isCollapsed: collapsedNodeIds.has(dept.id),
        x: 0,
        y: 0,
        width: NODE_WIDTH,
        height: NODE_HEIGHT,
        subtreeWidth: NODE_WIDTH,
        totalDescendantCount: 0,
        totalSubtreeHeadcount:
          dept.employee_profiles_count || dept.members_count || 0,
      });
    }

    const roots: HierarchyNode[] = [];

    // Link parents to children with cycle prevention
    for (const dept of departments) {
      const node = nodeMap.get(dept.id)!;
      const parentId =
        dept.parent_department_id ??
        (dept.parent_department ? dept.parent_department.id : null);

      if (parentId && parentId !== dept.id && deptIdSet.has(parentId)) {
        const parentNode = nodeMap.get(parentId);
        if (parentNode) {
          parentNode.children.push(node);
        } else {
          roots.push(node);
        }
      } else {
        // Top-level root division
        roots.push(node);
      }
    }

    // Sort siblings alphabetically or by code for stable diagram geometry
    for (const node of nodeMap.values()) {
      node.children.sort((a, b) => (a.department.name || '').localeCompare(b.department.name || ''));
    }
    roots.sort((a, b) => (a.department.name || '').localeCompare(b.department.name || ''));

    return { roots, nodeMap };
  }

  /**
   * Step 2: Post-order bottom-up calculation of subtree widths and aggregate metrics
   */
  private static computeSubtreeWidths(node: HierarchyNode): void {
    const selfHeadcount =
      node.department.employee_profiles_count || node.department.members_count || 0;
    let descCount = 0;
    let subtreeHeadcount = selfHeadcount;

    if (node.isCollapsed || node.children.length === 0) {
      node.subtreeWidth = NODE_WIDTH;
      node.totalDescendantCount = 0;
      node.totalSubtreeHeadcount = selfHeadcount;
      return;
    }

    let childrenWidthSum = 0;
    for (let i = 0; i < node.children.length; i++) {
      const child = node.children[i];
      child.depth = node.depth + 1;
      this.computeSubtreeWidths(child);

      childrenWidthSum += child.subtreeWidth;
      descCount += 1 + child.totalDescendantCount;
      subtreeHeadcount += child.totalSubtreeHeadcount;
    }

    const totalGap = (node.children.length - 1) * SIBLING_GAP_X;
    node.subtreeWidth = Math.max(NODE_WIDTH, childrenWidthSum + totalGap);
    node.totalDescendantCount = descCount;
    node.totalSubtreeHeadcount = subtreeHeadcount;
  }

  /**
   * Step 3: Top-down pre-order assignment of coordinates
   */
  private static assignCoordinates(
    node: HierarchyNode,
    startX: number,
    depth: number
  ): void {
    node.depth = depth;
    node.y = depth * (NODE_HEIGHT + LEVEL_GAP_Y) + 50;

    if (node.isCollapsed || node.children.length === 0) {
      node.x = startX + (node.subtreeWidth - NODE_WIDTH) / 2;
      return;
    }

    // Position children left to right
    let childStartX = startX;
    for (const child of node.children) {
      this.assignCoordinates(child, childStartX, depth + 1);
      childStartX += child.subtreeWidth + SIBLING_GAP_X;
    }

    // Center parent directly above its children
    const firstChild = node.children[0];
    const lastChild = node.children[node.children.length - 1];
    node.x = (firstChild.x + lastChild.x) / 2;
  }

  /**
   * Step 4: Generate Vector Path (Smooth Cubic Bezier with midpoint inflection)
   */
  private static createConnectorPath(
    parent: HierarchyNode,
    child: HierarchyNode
  ): ConnectorLine {
    const startX = parent.x + NODE_WIDTH / 2;
    const startY = parent.y + NODE_HEIGHT;
    const endX = child.x + NODE_WIDTH / 2;
    const endY = child.y;

    const midY = (startY + endY) / 2;

    // Smooth vertical cubic bezier curve
    const pathData = `M ${startX} ${startY} C ${startX} ${midY}, ${endX} ${midY}, ${endX} ${endY}`;

    return {
      id: `conn-${parent.id}-${child.id}`,
      sourceId: parent.id,
      targetId: child.id,
      pathData,
      startX,
      startY,
      endX,
      endY,
    };
  }

  /**
   * Recursively collect visible nodes into a flat array
   */
  private static collectVisibleNodes(
    node: HierarchyNode,
    list: HierarchyNode[]
  ): void {
    list.push(node);
    if (!node.isCollapsed) {
      for (const child of node.children) {
        this.collectVisibleNodes(child, list);
      }
    }
  }

  /**
   * Step 5: Compute bounding box of entire visible graph
   */
  private static computeBounds(nodes: HierarchyNode[]): LayoutBounds {
    if (nodes.length === 0) {
      return { minX: 0, maxX: 0, minY: 0, maxY: 0, width: 0, height: 0 };
    }

    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

    for (const node of nodes) {
      if (node.x < minX) minX = node.x;
      if (node.x + node.width > maxX) maxX = node.x + node.width;
      if (node.y < minY) minY = node.y;
      if (node.y + node.height > maxY) maxY = node.y + node.height;
    }

    // Add comfort margins
    minX -= 60;
    minY -= 60;
    maxX += 60;
    maxY += 60;

    return {
      minX,
      maxX,
      minY,
      maxY,
      width: Math.max(800, maxX - minX),
      height: Math.max(500, maxY - minY),
    };
  }
}

