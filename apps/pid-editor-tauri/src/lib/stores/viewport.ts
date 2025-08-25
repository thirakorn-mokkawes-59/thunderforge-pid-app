/**
 * Viewport Store
 * Manages canvas viewport state (zoom, pan, grid settings)
 */

import { writable, derived, get } from 'svelte/store';
import { browser } from '$app/environment';

interface ViewportState {
  zoom: number;
  pan: { x: number; y: number };
  gridSize: number;
  snapToGrid: boolean;
  showGrid: boolean;
  canvasSize: { width: number; height: number };
  viewportBounds: { x: number; y: number; width: number; height: number };
}

interface Point {
  x: number;
  y: number;
}

interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 5;
const DEFAULT_GRID_SIZE = 20;

function createViewportStore() {
  const initialState: ViewportState = {
    zoom: 1,
    pan: { x: 0, y: 0 },
    gridSize: DEFAULT_GRID_SIZE,
    snapToGrid: true,
    showGrid: true,
    canvasSize: { width: 1000, height: 1000 },
    viewportBounds: { x: 0, y: 0, width: 1000, height: 1000 }
  };

  const { subscribe, set, update } = writable<ViewportState>(initialState);

  // Derived stores for easier access
  const zoom = derived({ subscribe }, state => state.zoom);
  const pan = derived({ subscribe }, state => state.pan);
  const gridSettings = derived({ subscribe }, state => ({
    size: state.gridSize,
    snapToGrid: state.snapToGrid,
    showGrid: state.showGrid
  }));

  // Load saved viewport settings
  function loadSavedSettings() {
    if (!browser) return;

    try {
      const saved = localStorage.getItem('pid-viewport-settings');
      if (saved) {
        const parsed = JSON.parse(saved);
        update(state => ({
          ...state,
          zoom: parsed.zoom ?? state.zoom,
          pan: parsed.pan ?? state.pan,
          gridSize: parsed.gridSize ?? state.gridSize,
          snapToGrid: parsed.snapToGrid ?? state.snapToGrid,
          showGrid: parsed.showGrid ?? state.showGrid
        }));
      }
    } catch (error) {
      console.warn('Failed to load viewport settings:', error);
    }
  }

  // Save viewport settings
  function saveSettings() {
    if (!browser) return;

    try {
      const state = get({ subscribe });
      const toSave = {
        zoom: state.zoom,
        pan: state.pan,
        gridSize: state.gridSize,
        snapToGrid: state.snapToGrid,
        showGrid: state.showGrid
      };
      localStorage.setItem('pid-viewport-settings', JSON.stringify(toSave));
    } catch (error) {
      console.warn('Failed to save viewport settings:', error);
    }
  }

  loadSavedSettings();

  return {
    subscribe,
    zoom,
    pan,
    gridSettings,

    // Zoom Operations
    setZoom(newZoom: number, centerPoint?: Point) {
      update(state => {
        const clampedZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, newZoom));
        
        if (centerPoint) {
          // Adjust pan to keep center point in same screen position
          const zoomRatio = clampedZoom / state.zoom;
          const newPan = {
            x: centerPoint.x - (centerPoint.x - state.pan.x) * zoomRatio,
            y: centerPoint.y - (centerPoint.y - state.pan.y) * zoomRatio
          };
          
          return {
            ...state,
            zoom: clampedZoom,
            pan: newPan
          };
        }
        
        return {
          ...state,
          zoom: clampedZoom
        };
      });
      saveSettings();
    },

    zoomIn(centerPoint?: Point, factor: number = 1.2) {
      const state = get({ subscribe });
      this.setZoom(state.zoom * factor, centerPoint);
    },

    zoomOut(centerPoint?: Point, factor: number = 1.2) {
      const state = get({ subscribe });
      this.setZoom(state.zoom / factor, centerPoint);
    },

    zoomToFit(bounds: Bounds, padding: number = 50) {
      update(state => {
        const availableWidth = state.viewportBounds.width - 2 * padding;
        const availableHeight = state.viewportBounds.height - 2 * padding;
        
        const scaleX = availableWidth / bounds.width;
        const scaleY = availableHeight / bounds.height;
        const newZoom = Math.min(scaleX, scaleY, MAX_ZOOM);
        
        // Center the bounds in the viewport
        const centerX = bounds.x + bounds.width / 2;
        const centerY = bounds.y + bounds.height / 2;
        
        const viewportCenterX = state.viewportBounds.width / 2;
        const viewportCenterY = state.viewportBounds.height / 2;
        
        const newPan = {
          x: viewportCenterX - centerX * newZoom,
          y: viewportCenterY - centerY * newZoom
        };

        return {
          ...state,
          zoom: Math.max(MIN_ZOOM, newZoom),
          pan: newPan
        };
      });
      saveSettings();
    },

    resetZoom() {
      update(state => ({
        ...state,
        zoom: 1
      }));
      saveSettings();
    },

    // Pan Operations
    setPan(x: number, y: number) {
      update(state => ({
        ...state,
        pan: { x, y }
      }));
      saveSettings();
    },

    panBy(deltaX: number, deltaY: number) {
      update(state => ({
        ...state,
        pan: {
          x: state.pan.x + deltaX,
          y: state.pan.y + deltaY
        }
      }));
      saveSettings();
    },

    centerView() {
      update(state => ({
        ...state,
        pan: { x: 0, y: 0 }
      }));
      saveSettings();
    },

    // Grid Operations
    setGridSize(size: number) {
      const clampedSize = Math.max(5, Math.min(100, size));
      update(state => ({
        ...state,
        gridSize: clampedSize
      }));
      saveSettings();
    },

    toggleSnapToGrid() {
      update(state => ({
        ...state,
        snapToGrid: !state.snapToGrid
      }));
      saveSettings();
    },

    toggleShowGrid() {
      update(state => ({
        ...state,
        showGrid: !state.showGrid
      }));
      saveSettings();
    },

    setGridSettings(settings: { size?: number; snapToGrid?: boolean; showGrid?: boolean }) {
      update(state => ({
        ...state,
        gridSize: settings.size !== undefined ? Math.max(5, Math.min(100, settings.size)) : state.gridSize,
        snapToGrid: settings.snapToGrid ?? state.snapToGrid,
        showGrid: settings.showGrid ?? state.showGrid
      }));
      saveSettings();
    },

    // Canvas Operations
    setCanvasSize(width: number, height: number) {
      update(state => ({
        ...state,
        canvasSize: { width, height }
      }));
    },

    setViewportBounds(bounds: Bounds) {
      update(state => ({
        ...state,
        viewportBounds: bounds
      }));
    },

    // Coordinate Transformations
    screenToWorld(screenPoint: Point): Point {
      const state = get({ subscribe });
      return {
        x: (screenPoint.x - state.pan.x) / state.zoom,
        y: (screenPoint.y - state.pan.y) / state.zoom
      };
    },

    worldToScreen(worldPoint: Point): Point {
      const state = get({ subscribe });
      return {
        x: worldPoint.x * state.zoom + state.pan.x,
        y: worldPoint.y * state.zoom + state.pan.y
      };
    },

    snapToGrid(point: Point): Point {
      const state = get({ subscribe });
      
      if (!state.snapToGrid) return point;
      
      return {
        x: Math.round(point.x / state.gridSize) * state.gridSize,
        y: Math.round(point.y / state.gridSize) * state.gridSize
      };
    },

    getVisibleBounds(): Bounds {
      const state = get({ subscribe });
      const topLeft = this.screenToWorld({ x: 0, y: 0 });
      const bottomRight = this.screenToWorld({
        x: state.viewportBounds.width,
        y: state.viewportBounds.height
      });

      return {
        x: topLeft.x,
        y: topLeft.y,
        width: bottomRight.x - topLeft.x,
        height: bottomRight.y - topLeft.y
      };
    },

    isPointVisible(point: Point, margin: number = 0): boolean {
      const visibleBounds = this.getVisibleBounds();
      return point.x >= visibleBounds.x - margin &&
             point.x <= visibleBounds.x + visibleBounds.width + margin &&
             point.y >= visibleBounds.y - margin &&
             point.y <= visibleBounds.y + visibleBounds.height + margin;
    },

    isBoundsVisible(bounds: Bounds, margin: number = 0): boolean {
      const visibleBounds = this.getVisibleBounds();
      return bounds.x < visibleBounds.x + visibleBounds.width + margin &&
             bounds.x + bounds.width > visibleBounds.x - margin &&
             bounds.y < visibleBounds.y + visibleBounds.height + margin &&
             bounds.y + bounds.height > visibleBounds.y - margin;
    },

    // Utility functions
    getState(): ViewportState {
      return get({ subscribe });
    },

    reset() {
      set({
        zoom: 1,
        pan: { x: 0, y: 0 },
        gridSize: DEFAULT_GRID_SIZE,
        snapToGrid: true,
        showGrid: true,
        canvasSize: { width: 1000, height: 1000 },
        viewportBounds: { x: 0, y: 0, width: 1000, height: 1000 }
      });
      saveSettings();
    },

    // Animation support
    animateToZoom(targetZoom: number, duration: number = 300, centerPoint?: Point) {
      const startState = get({ subscribe });
      const startTime = performance.now();
      
      const animate = (currentTime: number) => {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // Easing function (ease-out)
        const easeOut = 1 - Math.pow(1 - progress, 3);
        
        const currentZoom = startState.zoom + (targetZoom - startState.zoom) * easeOut;
        this.setZoom(currentZoom, centerPoint);
        
        if (progress < 1) {
          requestAnimationFrame(animate);
        }
      };
      
      requestAnimationFrame(animate);
    },

    animateToPan(targetPan: Point, duration: number = 300) {
      const startState = get({ subscribe });
      const startTime = performance.now();
      
      const animate = (currentTime: number) => {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // Easing function (ease-out)
        const easeOut = 1 - Math.pow(1 - progress, 3);
        
        const currentPan = {
          x: startState.pan.x + (targetPan.x - startState.pan.x) * easeOut,
          y: startState.pan.y + (targetPan.y - startState.pan.y) * easeOut
        };
        
        this.setPan(currentPan.x, currentPan.y);
        
        if (progress < 1) {
          requestAnimationFrame(animate);
        }
      };
      
      requestAnimationFrame(animate);
    }
  };
}

export const viewport = createViewportStore();