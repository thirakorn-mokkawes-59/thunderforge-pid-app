import { describe, it, expect, beforeEach, vi } from 'vitest';
import { get } from 'svelte/store';
import { viewport } from '../viewport';

describe('Viewport Store', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    viewport.reset();
  });

  describe('initialization', () => {
    it('should initialize with default values', () => {
      const state = viewport.getState();
      
      expect(state.zoom).toBe(1);
      expect(state.pan).toEqual({ x: 0, y: 0 });
      expect(state.gridSize).toBe(20);
      expect(state.snapToGrid).toBe(true);
      expect(state.showGrid).toBe(true);
      expect(state.canvasSize).toEqual({ width: 1000, height: 1000 });
    });
  });

  describe('zoom operations', () => {
    it('should set zoom level', () => {
      viewport.setZoom(2);
      expect(viewport.getState().zoom).toBe(2);
    });

    it('should clamp zoom to valid range', () => {
      viewport.setZoom(0.05); // Below minimum
      expect(viewport.getState().zoom).toBe(0.1);
      
      viewport.setZoom(10); // Above maximum
      expect(viewport.getState().zoom).toBe(5);
    });

    it('should zoom with center point', () => {
      const centerPoint = { x: 100, y: 100 };
      const initialState = viewport.getState();
      
      viewport.setZoom(2, centerPoint);
      const newState = viewport.getState();
      
      expect(newState.zoom).toBe(2);
      expect(newState.pan).not.toEqual(initialState.pan);
    });

    it('should zoom in by factor', () => {
      viewport.setZoom(1);
      viewport.zoomIn(undefined, 1.5);
      
      expect(viewport.getState().zoom).toBe(1.5);
    });

    it('should zoom out by factor', () => {
      viewport.setZoom(3);
      viewport.zoomOut(undefined, 1.5);
      
      expect(viewport.getState().zoom).toBe(2);
    });

    it('should zoom to fit bounds', () => {
      const bounds = { x: 0, y: 0, width: 500, height: 300 };
      viewport.setViewportBounds({ x: 0, y: 0, width: 800, height: 600 });
      
      viewport.zoomToFit(bounds);
      const state = viewport.getState();
      
      expect(state.zoom).toBeGreaterThan(0);
      expect(state.zoom).toBeLessThanOrEqual(5);
    });

    it('should reset zoom to 1', () => {
      viewport.setZoom(3);
      viewport.resetZoom();
      
      expect(viewport.getState().zoom).toBe(1);
    });
  });

  describe('pan operations', () => {
    it('should set pan position', () => {
      viewport.setPan(50, -30);
      expect(viewport.getState().pan).toEqual({ x: 50, y: -30 });
    });

    it('should pan by delta', () => {
      viewport.setPan(10, 20);
      viewport.panBy(5, -10);
      
      expect(viewport.getState().pan).toEqual({ x: 15, y: 10 });
    });

    it('should center view', () => {
      viewport.setPan(100, 200);
      viewport.centerView();
      
      expect(viewport.getState().pan).toEqual({ x: 0, y: 0 });
    });
  });

  describe('grid operations', () => {
    it('should set grid size', () => {
      viewport.setGridSize(25);
      expect(viewport.getState().gridSize).toBe(25);
    });

    it('should clamp grid size to valid range', () => {
      viewport.setGridSize(3); // Below minimum
      expect(viewport.getState().gridSize).toBe(5);
      
      viewport.setGridSize(150); // Above maximum
      expect(viewport.getState().gridSize).toBe(100);
    });

    it('should toggle snap to grid', () => {
      const initialSnap = viewport.getState().snapToGrid;
      viewport.toggleSnapToGrid();
      
      expect(viewport.getState().snapToGrid).toBe(!initialSnap);
    });

    it('should toggle show grid', () => {
      const initialShow = viewport.getState().showGrid;
      viewport.toggleShowGrid();
      
      expect(viewport.getState().showGrid).toBe(!initialShow);
    });

    it('should set grid settings', () => {
      viewport.setGridSettings({
        size: 15,
        snapToGrid: false,
        showGrid: false
      });
      
      const state = viewport.getState();
      expect(state.gridSize).toBe(15);
      expect(state.snapToGrid).toBe(false);
      expect(state.showGrid).toBe(false);
    });
  });

  describe('coordinate transformations', () => {
    beforeEach(() => {
      viewport.setZoom(2);
      viewport.setPan(10, 20);
    });

    it('should transform screen to world coordinates', () => {
      const screenPoint = { x: 100, y: 80 };
      const worldPoint = viewport.screenToWorld(screenPoint);
      
      expect(worldPoint.x).toBe((100 - 10) / 2); // (screen.x - pan.x) / zoom
      expect(worldPoint.y).toBe((80 - 20) / 2);  // (screen.y - pan.y) / zoom
    });

    it('should transform world to screen coordinates', () => {
      const worldPoint = { x: 50, y: 30 };
      const screenPoint = viewport.worldToScreen(worldPoint);
      
      expect(screenPoint.x).toBe(50 * 2 + 10); // world.x * zoom + pan.x
      expect(screenPoint.y).toBe(30 * 2 + 20); // world.y * zoom + pan.y
    });

    it('should snap point to grid when enabled', () => {
      viewport.setGridSettings({ snapToGrid: true });
      viewport.setGridSize(20);
      
      const point = { x: 27, y: 33 };
      const snapped = viewport.snapToGrid(point);
      
      expect(snapped.x).toBe(20); // Nearest grid point
      expect(snapped.y).toBe(40);
    });

    it('should not snap when snap to grid disabled', () => {
      viewport.setGridSettings({ snapToGrid: false });
      
      const point = { x: 27, y: 33 };
      const result = viewport.snapToGrid(point);
      
      expect(result).toEqual(point);
    });
  });

  describe('visibility checks', () => {
    beforeEach(() => {
      viewport.setViewportBounds({ x: 0, y: 0, width: 800, height: 600 });
      viewport.setZoom(1);
      viewport.setPan(0, 0);
    });

    it('should check if point is visible', () => {
      const visiblePoint = { x: 400, y: 300 };
      const invisiblePoint = { x: 900, y: 700 };
      
      expect(viewport.isPointVisible(visiblePoint)).toBe(true);
      expect(viewport.isPointVisible(invisiblePoint)).toBe(false);
    });

    it('should check if bounds are visible', () => {
      const visibleBounds = { x: 100, y: 100, width: 200, height: 150 };
      const invisibleBounds = { x: 900, y: 700, width: 100, height: 100 };
      
      expect(viewport.isBoundsVisible(visibleBounds)).toBe(true);
      expect(viewport.isBoundsVisible(invisibleBounds)).toBe(false);
    });

    it('should get visible bounds', () => {
      const bounds = viewport.getVisibleBounds();
      
      expect(bounds.x).toBe(0);
      expect(bounds.y).toBe(0);
      expect(bounds.width).toBe(800);
      expect(bounds.height).toBe(600);
    });
  });

  describe('canvas operations', () => {
    it('should set canvas size', () => {
      viewport.setCanvasSize(1200, 800);
      
      const state = viewport.getState();
      expect(state.canvasSize).toEqual({ width: 1200, height: 800 });
    });

    it('should set viewport bounds', () => {
      const bounds = { x: 0, y: 0, width: 1024, height: 768 };
      viewport.setViewportBounds(bounds);
      
      expect(viewport.getState().viewportBounds).toEqual(bounds);
    });
  });

  describe('derived stores', () => {
    it('should provide zoom derived store', () => {
      viewport.setZoom(1.5);
      const zoomValue = get(viewport.zoom);
      
      expect(zoomValue).toBe(1.5);
    });

    it('should provide pan derived store', () => {
      viewport.setPan(25, -15);
      const panValue = get(viewport.pan);
      
      expect(panValue).toEqual({ x: 25, y: -15 });
    });

    it('should provide grid settings derived store', () => {
      viewport.setGridSettings({
        size: 30,
        snapToGrid: false,
        showGrid: true
      });
      
      const gridSettings = get(viewport.gridSettings);
      expect(gridSettings).toEqual({
        size: 30,
        snapToGrid: false,
        showGrid: true
      });
    });
  });

  describe('animations', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should animate to zoom level', () => {
      viewport.setZoom(1);
      viewport.animateToZoom(2, 100);
      
      // Fast forward animation
      vi.advanceTimersByTime(50);
      const midZoom = viewport.getState().zoom;
      
      vi.advanceTimersByTime(50);
      const finalZoom = viewport.getState().zoom;
      
      expect(midZoom).toBeGreaterThan(1);
      expect(midZoom).toBeLessThan(2);
      expect(finalZoom).toBe(2);
    });

    it('should animate to pan position', () => {
      viewport.setPan(0, 0);
      viewport.animateToPan({ x: 100, y: 50 }, 100);
      
      // Fast forward animation
      vi.advanceTimersByTime(50);
      const midPan = viewport.getState().pan;
      
      vi.advanceTimersByTime(50);
      const finalPan = viewport.getState().pan;
      
      expect(midPan.x).toBeGreaterThan(0);
      expect(midPan.x).toBeLessThan(100);
      expect(finalPan).toEqual({ x: 100, y: 50 });
    });
  });

  describe('state management', () => {
    it('should reset to defaults', () => {
      viewport.setZoom(3);
      viewport.setPan(100, 200);
      viewport.setGridSize(50);
      
      viewport.reset();
      
      const state = viewport.getState();
      expect(state.zoom).toBe(1);
      expect(state.pan).toEqual({ x: 0, y: 0 });
      expect(state.gridSize).toBe(20);
    });

    it('should get current state', () => {
      viewport.setZoom(1.5);
      viewport.setPan(30, -20);
      
      const state = viewport.getState();
      expect(state.zoom).toBe(1.5);
      expect(state.pan).toEqual({ x: 30, y: -20 });
    });
  });
});