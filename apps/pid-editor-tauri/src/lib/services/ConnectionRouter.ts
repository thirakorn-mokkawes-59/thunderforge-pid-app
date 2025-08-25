/**
 * Connection Router Service
 * Provides intelligent routing algorithms for PID connections
 */

export interface Point {
  x: number;
  y: number;
}

export interface ConnectionPoint {
  id: string;
  position: Point;
  direction: 'north' | 'south' | 'east' | 'west';
  type: 'input' | 'output' | 'bidirectional';
  occupied: boolean;
  nodeId: string;
}

export interface RouteOptions {
  avoidObstacles: boolean;
  preferStraightLines: boolean;
  minimumSegmentLength: number;
  gridSize: number;
  cornerRadius: number;
  obstacleMargin: number;
}

export interface RoutingResult {
  path: Point[];
  distance: number;
  segments: number;
  valid: boolean;
  obstacles: string[];
}

export interface Obstacle {
  id: string;
  bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  type: 'node' | 'connection' | 'custom';
}

/**
 * A* pathfinding implementation for connection routing
 */
class PathNode {
  constructor(
    public x: number,
    public y: number,
    public g: number = 0,
    public h: number = 0,
    public parent?: PathNode
  ) {}

  get f(): number {
    return this.g + this.h;
  }

  equals(other: PathNode): boolean {
    return this.x === other.x && this.y === other.y;
  }

  key(): string {
    return `${this.x},${this.y}`;
  }
}

export class ConnectionRouter {
  private static instance: ConnectionRouter;
  
  private obstacles: Map<string, Obstacle> = new Map();
  private connectionPoints: Map<string, ConnectionPoint> = new Map();
  
  private readonly defaultOptions: RouteOptions = {
    avoidObstacles: true,
    preferStraightLines: true,
    minimumSegmentLength: 20,
    gridSize: 10,
    cornerRadius: 5,
    obstacleMargin: 10
  };

  static getInstance(): ConnectionRouter {
    if (!ConnectionRouter.instance) {
      ConnectionRouter.instance = new ConnectionRouter();
    }
    return ConnectionRouter.instance;
  }

  /**
   * Register an obstacle for pathfinding
   */
  registerObstacle(obstacle: Obstacle): void {
    this.obstacles.set(obstacle.id, obstacle);
  }

  /**
   * Remove an obstacle
   */
  removeObstacle(id: string): void {
    this.obstacles.delete(id);
  }

  /**
   * Register a connection point
   */
  registerConnectionPoint(point: ConnectionPoint): void {
    this.connectionPoints.set(point.id, point);
  }

  /**
   * Remove a connection point
   */
  removeConnectionPoint(id: string): void {
    this.connectionPoints.delete(id);
  }

  /**
   * Get available connection points for a node
   */
  getAvailableConnectionPoints(nodeId: string): ConnectionPoint[] {
    return Array.from(this.connectionPoints.values())
      .filter(point => point.nodeId === nodeId && !point.occupied);
  }

  /**
   * Find optimal connection points between two nodes
   */
  findOptimalConnectionPoints(
    sourceNodeId: string,
    targetNodeId: string
  ): { source: ConnectionPoint; target: ConnectionPoint } | null {
    const sourcePoints = this.getAvailableConnectionPoints(sourceNodeId);
    const targetPoints = this.getAvailableConnectionPoints(targetNodeId);

    if (sourcePoints.length === 0 || targetPoints.length === 0) {
      return null;
    }

    let bestDistance = Infinity;
    let bestPair: { source: ConnectionPoint; target: ConnectionPoint } | null = null;

    // Find the pair with shortest distance and compatible directions
    for (const source of sourcePoints) {
      for (const target of targetPoints) {
        if (this.areCompatible(source, target)) {
          const distance = this.distance(source.position, target.position);
          
          // Prefer connections that align with port directions
          const directionBonus = this.getDirectionBonus(source, target);
          const adjustedDistance = distance - directionBonus;

          if (adjustedDistance < bestDistance) {
            bestDistance = adjustedDistance;
            bestPair = { source, target };
          }
        }
      }
    }

    return bestPair;
  }

  /**
   * Route a connection between two points
   */
  routeConnection(
    start: Point,
    end: Point,
    options: Partial<RouteOptions> = {}
  ): RoutingResult {
    const opts = { ...this.defaultOptions, ...options };

    // Snap points to grid
    const gridStart = this.snapToGrid(start, opts.gridSize);
    const gridEnd = this.snapToGrid(end, opts.gridSize);

    // Try direct connection first if obstacles are not a concern
    if (!opts.avoidObstacles || this.isDirectPathClear(gridStart, gridEnd, opts)) {
      return this.createDirectRoute(gridStart, gridEnd);
    }

    // Use A* pathfinding for complex routing
    return this.findPathAStar(gridStart, gridEnd, opts);
  }

  /**
   * Route connection between connection points
   */
  routeConnectionPoints(
    sourcePoint: ConnectionPoint,
    targetPoint: ConnectionPoint,
    options: Partial<RouteOptions> = {}
  ): RoutingResult {
    const opts = { ...this.defaultOptions, ...options };
    
    // Calculate entry/exit points based on connection point directions
    const startPoint = this.getConnectionEntryPoint(sourcePoint, opts.gridSize);
    const endPoint = this.getConnectionEntryPoint(targetPoint, opts.gridSize);

    return this.routeConnection(startPoint, endPoint, opts);
  }

  /**
   * Optimize an existing path
   */
  optimizePath(path: Point[], options: Partial<RouteOptions> = {}): Point[] {
    const opts = { ...this.defaultOptions, ...options };
    
    if (path.length < 3) return path;

    const optimized: Point[] = [path[0]];
    
    for (let i = 1; i < path.length - 1; i++) {
      const prev = optimized[optimized.length - 1];
      const current = path[i];
      const next = path[i + 1];

      // Skip intermediate points if direct path is clear
      if (!this.isDirectPathClear(prev, next, opts)) {
        optimized.push(current);
      }
    }

    optimized.push(path[path.length - 1]);
    return this.smoothPath(optimized, opts);
  }

  /**
   * Validate a connection path
   */
  validatePath(path: Point[], options: Partial<RouteOptions> = {}): {
    valid: boolean;
    issues: string[];
  } {
    const opts = { ...this.defaultOptions, ...options };
    const issues: string[] = [];

    if (path.length < 2) {
      return { valid: false, issues: ['Path must have at least 2 points'] };
    }

    // Check minimum segment lengths
    for (let i = 1; i < path.length; i++) {
      const distance = this.distance(path[i - 1], path[i]);
      if (distance < opts.minimumSegmentLength) {
        issues.push(`Segment ${i} is too short: ${distance.toFixed(1)}px`);
      }
    }

    // Check for obstacle intersections
    if (opts.avoidObstacles) {
      for (let i = 1; i < path.length; i++) {
        const intersectingObstacles = this.getIntersectingObstacles(
          path[i - 1], 
          path[i], 
          opts.obstacleMargin
        );
        
        if (intersectingObstacles.length > 0) {
          issues.push(`Segment ${i} intersects obstacles: ${intersectingObstacles.join(', ')}`);
        }
      }
    }

    return {
      valid: issues.length === 0,
      issues
    };
  }

  /**
   * Private helper methods
   */

  private snapToGrid(point: Point, gridSize: number): Point {
    return {
      x: Math.round(point.x / gridSize) * gridSize,
      y: Math.round(point.y / gridSize) * gridSize
    };
  }

  private distance(a: Point, b: Point): number {
    return Math.sqrt(Math.pow(b.x - a.x, 2) + Math.pow(b.y - a.y, 2));
  }

  private manhattanDistance(a: Point, b: Point): number {
    return Math.abs(b.x - a.x) + Math.abs(b.y - a.y);
  }

  private areCompatible(source: ConnectionPoint, target: ConnectionPoint): boolean {
    // Check if connection types are compatible
    if (source.type === 'input' && target.type === 'input') return false;
    if (source.type === 'output' && target.type === 'output') return false;
    
    return true;
  }

  private getDirectionBonus(source: ConnectionPoint, target: ConnectionPoint): number {
    const dx = target.position.x - source.position.x;
    const dy = target.position.y - source.position.y;

    let bonus = 0;

    // Bonus for aligned directions
    if (source.direction === 'east' && dx > 0) bonus += 50;
    if (source.direction === 'west' && dx < 0) bonus += 50;
    if (source.direction === 'north' && dy < 0) bonus += 50;
    if (source.direction === 'south' && dy > 0) bonus += 50;

    if (target.direction === 'west' && dx > 0) bonus += 50;
    if (target.direction === 'east' && dx < 0) bonus += 50;
    if (target.direction === 'south' && dy < 0) bonus += 50;
    if (target.direction === 'north' && dy > 0) bonus += 50;

    return bonus;
  }

  private getConnectionEntryPoint(point: ConnectionPoint, gridSize: number): Point {
    const offset = gridSize * 2;
    let entryPoint = { ...point.position };

    switch (point.direction) {
      case 'north':
        entryPoint.y -= offset;
        break;
      case 'south':
        entryPoint.y += offset;
        break;
      case 'east':
        entryPoint.x += offset;
        break;
      case 'west':
        entryPoint.x -= offset;
        break;
    }

    return entryPoint;
  }

  private isDirectPathClear(start: Point, end: Point, options: RouteOptions): boolean {
    return this.getIntersectingObstacles(start, end, options.obstacleMargin).length === 0;
  }

  private getIntersectingObstacles(start: Point, end: Point, margin: number): string[] {
    const intersecting: string[] = [];

    for (const [id, obstacle] of this.obstacles) {
      if (this.lineIntersectsRect(start, end, obstacle.bounds, margin)) {
        intersecting.push(id);
      }
    }

    return intersecting;
  }

  private lineIntersectsRect(
    start: Point, 
    end: Point, 
    rect: { x: number; y: number; width: number; height: number },
    margin: number
  ): boolean {
    const expandedRect = {
      x: rect.x - margin,
      y: rect.y - margin,
      width: rect.width + 2 * margin,
      height: rect.height + 2 * margin
    };

    return this.lineIntersectsExpandedRect(start, end, expandedRect);
  }

  private lineIntersectsExpandedRect(
    start: Point, 
    end: Point, 
    rect: { x: number; y: number; width: number; height: number }
  ): boolean {
    // Use line-rectangle intersection algorithm
    const x1 = start.x;
    const y1 = start.y;
    const x2 = end.x;
    const y2 = end.y;
    
    const rectLeft = rect.x;
    const rectTop = rect.y;
    const rectRight = rect.x + rect.width;
    const rectBottom = rect.y + rect.height;

    // Check if either endpoint is inside the rectangle
    if ((x1 >= rectLeft && x1 <= rectRight && y1 >= rectTop && y1 <= rectBottom) ||
        (x2 >= rectLeft && x2 <= rectRight && y2 >= rectTop && y2 <= rectBottom)) {
      return true;
    }

    // Check intersection with each edge of the rectangle
    return this.lineSegmentsIntersect(x1, y1, x2, y2, rectLeft, rectTop, rectRight, rectTop) ||
           this.lineSegmentsIntersect(x1, y1, x2, y2, rectRight, rectTop, rectRight, rectBottom) ||
           this.lineSegmentsIntersect(x1, y1, x2, y2, rectRight, rectBottom, rectLeft, rectBottom) ||
           this.lineSegmentsIntersect(x1, y1, x2, y2, rectLeft, rectBottom, rectLeft, rectTop);
  }

  private lineSegmentsIntersect(
    x1: number, y1: number, x2: number, y2: number,
    x3: number, y3: number, x4: number, y4: number
  ): boolean {
    const denominator = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
    
    if (denominator === 0) return false;
    
    const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denominator;
    const u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / denominator;
    
    return t >= 0 && t <= 1 && u >= 0 && u <= 1;
  }

  private createDirectRoute(start: Point, end: Point): RoutingResult {
    return {
      path: [start, end],
      distance: this.distance(start, end),
      segments: 1,
      valid: true,
      obstacles: []
    };
  }

  private findPathAStar(start: Point, end: Point, options: RouteOptions): RoutingResult {
    const openList: PathNode[] = [];
    const closedList: Set<string> = new Set();
    const startNode = new PathNode(start.x, start.y, 0, this.manhattanDistance(start, end));
    
    openList.push(startNode);

    while (openList.length > 0) {
      // Find node with lowest f cost
      openList.sort((a, b) => a.f - b.f);
      const currentNode = openList.shift()!;
      const currentKey = currentNode.key();

      if (closedList.has(currentKey)) continue;
      closedList.add(currentKey);

      // Check if we reached the destination
      if (this.distance({ x: currentNode.x, y: currentNode.y }, end) <= options.gridSize) {
        return this.reconstructPath(currentNode, end);
      }

      // Generate neighbors
      const neighbors = this.getNeighbors(currentNode, options);
      
      for (const neighbor of neighbors) {
        const neighborKey = neighbor.key();
        
        if (closedList.has(neighborKey)) continue;
        
        // Check if this path to neighbor is better
        const existingNode = openList.find(node => node.key() === neighborKey);
        
        if (!existingNode || neighbor.g < existingNode.g) {
          if (existingNode) {
            openList.splice(openList.indexOf(existingNode), 1);
          }
          openList.push(neighbor);
        }
      }
    }

    // No path found, return direct route as fallback
    return this.createDirectRoute(start, end);
  }

  private getNeighbors(node: PathNode, options: RouteOptions): PathNode[] {
    const neighbors: PathNode[] = [];
    const directions = [
      { x: 0, y: -options.gridSize }, // North
      { x: options.gridSize, y: 0 },  // East
      { x: 0, y: options.gridSize },  // South
      { x: -options.gridSize, y: 0 }  // West
    ];

    // Add diagonal directions if not preferring straight lines
    if (!options.preferStraightLines) {
      directions.push(
        { x: options.gridSize, y: -options.gridSize },  // NE
        { x: options.gridSize, y: options.gridSize },   // SE
        { x: -options.gridSize, y: options.gridSize },  // SW
        { x: -options.gridSize, y: -options.gridSize }  // NW
      );
    }

    for (const dir of directions) {
      const newX = node.x + dir.x;
      const newY = node.y + dir.y;
      
      // Check if position is clear
      if (!this.isPositionBlocked({ x: newX, y: newY }, options)) {
        const moveCost = Math.sqrt(dir.x * dir.x + dir.y * dir.y);
        const neighbor = new PathNode(
          newX,
          newY,
          node.g + moveCost,
          this.manhattanDistance({ x: newX, y: newY }, { x: node.x, y: node.y }),
          node
        );
        neighbors.push(neighbor);
      }
    }

    return neighbors;
  }

  private isPositionBlocked(position: Point, options: RouteOptions): boolean {
    for (const obstacle of this.obstacles.values()) {
      const expandedBounds = {
        x: obstacle.bounds.x - options.obstacleMargin,
        y: obstacle.bounds.y - options.obstacleMargin,
        width: obstacle.bounds.width + 2 * options.obstacleMargin,
        height: obstacle.bounds.height + 2 * options.obstacleMargin
      };

      if (position.x >= expandedBounds.x && 
          position.x <= expandedBounds.x + expandedBounds.width &&
          position.y >= expandedBounds.y && 
          position.y <= expandedBounds.y + expandedBounds.height) {
        return true;
      }
    }
    return false;
  }

  private reconstructPath(endNode: PathNode, target: Point): RoutingResult {
    const path: Point[] = [];
    let current: PathNode | undefined = endNode;
    
    while (current) {
      path.unshift({ x: current.x, y: current.y });
      current = current.parent;
    }
    
    // Add final target point if different
    const lastPoint = path[path.length - 1];
    if (this.distance(lastPoint, target) > 1) {
      path.push(target);
    }

    const totalDistance = this.calculatePathDistance(path);
    
    return {
      path,
      distance: totalDistance,
      segments: path.length - 1,
      valid: true,
      obstacles: []
    };
  }

  private calculatePathDistance(path: Point[]): number {
    let distance = 0;
    for (let i = 1; i < path.length; i++) {
      distance += this.distance(path[i - 1], path[i]);
    }
    return distance;
  }

  private smoothPath(path: Point[], options: RouteOptions): Point[] {
    if (path.length < 3) return path;

    const smoothed: Point[] = [path[0]];
    
    for (let i = 1; i < path.length - 1; i++) {
      const prev = path[i - 1];
      const current = path[i];
      const next = path[i + 1];

      // Apply corner rounding
      if (options.cornerRadius > 0) {
        const smoothedPoint = this.applyCornersRounding(prev, current, next, options.cornerRadius);
        smoothed.push(smoothedPoint);
      } else {
        smoothed.push(current);
      }
    }

    smoothed.push(path[path.length - 1]);
    return smoothed;
  }

  private applyCornersRounding(prev: Point, current: Point, next: Point, radius: number): Point {
    // For simplicity, just return the current point
    // In a full implementation, this would calculate rounded corners
    return current;
  }

  /**
   * Get all registered obstacles
   */
  getObstacles(): Obstacle[] {
    return Array.from(this.obstacles.values());
  }

  /**
   * Get all registered connection points
   */
  getConnectionPoints(): ConnectionPoint[] {
    return Array.from(this.connectionPoints.values());
  }

  /**
   * Clear all obstacles and connection points
   */
  clear(): void {
    this.obstacles.clear();
    this.connectionPoints.clear();
  }
}

export const connectionRouter = ConnectionRouter.getInstance();