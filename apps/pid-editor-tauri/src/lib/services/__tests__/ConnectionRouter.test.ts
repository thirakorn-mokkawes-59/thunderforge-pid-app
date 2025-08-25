import { describe, it, expect, beforeEach } from 'vitest';
import { ConnectionRouter, type ConnectionPoint, type Obstacle } from '../ConnectionRouter';

describe('ConnectionRouter', () => {
  let router: ConnectionRouter;

  beforeEach(() => {
    router = ConnectionRouter.getInstance();
    router.clear();
  });

  describe('Obstacle Management', () => {
    it('should register and retrieve obstacles', () => {
      const obstacle: Obstacle = {
        id: 'test-obstacle',
        bounds: { x: 10, y: 10, width: 50, height: 30 },
        type: 'node'
      };

      router.registerObstacle(obstacle);
      const obstacles = router.getObstacles();

      expect(obstacles).toHaveLength(1);
      expect(obstacles[0]).toEqual(obstacle);
    });

    it('should remove obstacles', () => {
      const obstacle: Obstacle = {
        id: 'test-obstacle',
        bounds: { x: 10, y: 10, width: 50, height: 30 },
        type: 'node'
      };

      router.registerObstacle(obstacle);
      expect(router.getObstacles()).toHaveLength(1);

      router.removeObstacle('test-obstacle');
      expect(router.getObstacles()).toHaveLength(0);
    });
  });

  describe('Connection Point Management', () => {
    it('should register and retrieve connection points', () => {
      const connectionPoint: ConnectionPoint = {
        id: 'test-point',
        position: { x: 100, y: 100 },
        direction: 'east',
        type: 'output',
        occupied: false,
        nodeId: 'node1'
      };

      router.registerConnectionPoint(connectionPoint);
      const points = router.getConnectionPoints();

      expect(points).toHaveLength(1);
      expect(points[0]).toEqual(connectionPoint);
    });

    it('should get available connection points for a node', () => {
      const points: ConnectionPoint[] = [
        {
          id: 'node1-point1',
          position: { x: 100, y: 100 },
          direction: 'east',
          type: 'output',
          occupied: false,
          nodeId: 'node1'
        },
        {
          id: 'node1-point2',
          position: { x: 100, y: 120 },
          direction: 'west',
          type: 'input',
          occupied: true,
          nodeId: 'node1'
        },
        {
          id: 'node2-point1',
          position: { x: 200, y: 100 },
          direction: 'west',
          type: 'input',
          occupied: false,
          nodeId: 'node2'
        }
      ];

      points.forEach(p => router.registerConnectionPoint(p));

      const availableForNode1 = router.getAvailableConnectionPoints('node1');
      expect(availableForNode1).toHaveLength(1);
      expect(availableForNode1[0].id).toBe('node1-point1');
    });
  });

  describe('Connection Routing', () => {
    it('should create direct route when no obstacles exist', () => {
      const start = { x: 0, y: 0 };
      const end = { x: 100, y: 0 };

      const result = router.routeConnection(start, end);

      expect(result.valid).toBe(true);
      expect(result.path).toHaveLength(2);
      expect(result.path[0]).toEqual(start);
      expect(result.path[1]).toEqual(end);
      expect(result.segments).toBe(1);
    });

    it('should avoid obstacles when routing', () => {
      // Register obstacle in the middle
      router.registerObstacle({
        id: 'middle-obstacle',
        bounds: { x: 45, y: -10, width: 10, height: 20 },
        type: 'node'
      });

      const start = { x: 0, y: 0 };
      const end = { x: 100, y: 0 };

      const result = router.routeConnection(start, end, { 
        avoidObstacles: true,
        gridSize: 10 
      });

      expect(result.valid).toBe(true);
      expect(result.path.length).toBeGreaterThan(2); // Should route around obstacle
    });

    it('should snap points to grid', () => {
      const start = { x: 7, y: 13 };
      const end = { x: 107, y: 23 };
      const gridSize = 10;

      const result = router.routeConnection(start, end, { 
        gridSize,
        avoidObstacles: false 
      });

      expect(result.path[0].x).toBe(10); // snapped to grid
      expect(result.path[0].y).toBe(10);
      expect(result.path[1].x).toBe(110);
      expect(result.path[1].y).toBe(20);
    });
  });

  describe('Optimal Connection Point Finding', () => {
    beforeEach(() => {
      // Set up two nodes with connection points
      const node1Points: ConnectionPoint[] = [
        {
          id: 'node1-east',
          position: { x: 100, y: 50 },
          direction: 'east',
          type: 'output',
          occupied: false,
          nodeId: 'node1'
        },
        {
          id: 'node1-west',
          position: { x: 0, y: 50 },
          direction: 'west',
          type: 'input',
          occupied: false,
          nodeId: 'node1'
        }
      ];

      const node2Points: ConnectionPoint[] = [
        {
          id: 'node2-west',
          position: { x: 200, y: 50 },
          direction: 'west',
          type: 'input',
          occupied: false,
          nodeId: 'node2'
        },
        {
          id: 'node2-east',
          position: { x: 300, y: 50 },
          direction: 'east',
          type: 'output',
          occupied: false,
          nodeId: 'node2'
        }
      ];

      [...node1Points, ...node2Points].forEach(p => 
        router.registerConnectionPoint(p)
      );
    });

    it('should find optimal connection points between nodes', () => {
      const result = router.findOptimalConnectionPoints('node1', 'node2');

      expect(result).not.toBeNull();
      expect(result!.source.direction).toBe('east');
      expect(result!.target.direction).toBe('west');
      expect(result!.source.nodeId).toBe('node1');
      expect(result!.target.nodeId).toBe('node2');
    });

    it('should return null if no compatible points exist', () => {
      // Mark all points as occupied
      const points = router.getConnectionPoints();
      points.forEach(p => p.occupied = true);

      const result = router.findOptimalConnectionPoints('node1', 'node2');
      expect(result).toBeNull();
    });
  });

  describe('Path Validation', () => {
    it('should validate path with no issues', () => {
      const path = [
        { x: 0, y: 0 },
        { x: 50, y: 0 },
        { x: 100, y: 0 }
      ];

      const validation = router.validatePath(path, {
        minimumSegmentLength: 20,
        avoidObstacles: false,
        preferStraightLines: true,
        gridSize: 10,
        cornerRadius: 5,
        obstacleMargin: 10
      });

      expect(validation.valid).toBe(true);
      expect(validation.issues).toHaveLength(0);
    });

    it('should detect short segments', () => {
      const path = [
        { x: 0, y: 0 },
        { x: 5, y: 0 }, // Too short
        { x: 100, y: 0 }
      ];

      const validation = router.validatePath(path, {
        minimumSegmentLength: 20,
        avoidObstacles: false,
        preferStraightLines: true,
        gridSize: 10,
        cornerRadius: 5,
        obstacleMargin: 10
      });

      expect(validation.valid).toBe(false);
      expect(validation.issues).toHaveLength(1);
      expect(validation.issues[0]).toContain('too short');
    });

    it('should detect obstacle intersections', () => {
      // Register obstacle that intersects with path
      router.registerObstacle({
        id: 'blocking-obstacle',
        bounds: { x: 40, y: -10, width: 20, height: 20 },
        type: 'node'
      });

      const path = [
        { x: 0, y: 0 },
        { x: 100, y: 0 }
      ];

      const validation = router.validatePath(path, {
        minimumSegmentLength: 10,
        avoidObstacles: true,
        preferStraightLines: true,
        gridSize: 10,
        cornerRadius: 5,
        obstacleMargin: 5
      });

      expect(validation.valid).toBe(false);
      expect(validation.issues.some(issue => 
        issue.includes('intersects obstacles')
      )).toBe(true);
    });
  });

  describe('Path Optimization', () => {
    it('should optimize straight path segments', () => {
      const originalPath = [
        { x: 0, y: 0 },
        { x: 25, y: 0 },
        { x: 50, y: 0 },
        { x: 75, y: 0 },
        { x: 100, y: 0 }
      ];

      const optimized = router.optimizePath(originalPath);

      expect(optimized.length).toBeLessThan(originalPath.length);
      expect(optimized[0]).toEqual(originalPath[0]);
      expect(optimized[optimized.length - 1]).toEqual(originalPath[originalPath.length - 1]);
    });

    it('should preserve necessary waypoints', () => {
      // Add obstacle to force waypoints
      router.registerObstacle({
        id: 'waypoint-obstacle',
        bounds: { x: 45, y: -10, width: 10, height: 20 },
        type: 'node'
      });

      const pathWithWaypoint = [
        { x: 0, y: 0 },
        { x: 40, y: 0 },
        { x: 40, y: -20 },
        { x: 60, y: -20 },
        { x: 60, y: 0 },
        { x: 100, y: 0 }
      ];

      const optimized = router.optimizePath(pathWithWaypoint);

      // Should still avoid the obstacle
      expect(optimized.length).toBeGreaterThan(2);
    });
  });
});