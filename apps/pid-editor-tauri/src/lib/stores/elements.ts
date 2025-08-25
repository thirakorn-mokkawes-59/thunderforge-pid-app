/**
 * Elements Store
 * Manages diagram elements (nodes, groups, etc.) with operations and persistence
 */

import { writable, derived, get } from 'svelte/store';
import type { DiagramElement, Connection } from '$lib/types/diagram';

interface ElementsState {
  elements: DiagramElement[];
  connections: Connection[];
  elementNameCounts: Map<string, number>;
}

export interface ElementUpdate {
  id: string;
  properties: Partial<DiagramElement>;
}

export interface ElementOperation {
  type: 'add' | 'update' | 'delete' | 'move' | 'duplicate';
  elementId?: string;
  element?: DiagramElement;
  updates?: ElementUpdate[];
  position?: { x: number; y: number };
}

function createElementsStore() {
  const { subscribe, set, update } = writable<ElementsState>({
    elements: [],
    connections: [],
    elementNameCounts: new Map()
  });

  // Derived stores for easier access
  const elements = derived({ subscribe }, state => state.elements);
  const connections = derived({ subscribe }, state => state.connections);

  return {
    subscribe,
    elements,
    connections,

    // Element Operations
    addElement(element: DiagramElement) {
      update(state => {
        const newElements = [...state.elements, element];
        const newCounts = new Map(state.elementNameCounts);
        
        // Update name counter
        const baseName = element.name?.replace(/_\d+$/, '') || 'Element';
        const count = (newCounts.get(baseName) || 0) + 1;
        newCounts.set(baseName, count);

        return {
          ...state,
          elements: newElements,
          elementNameCounts: newCounts
        };
      });
    },

    updateElement(id: string, properties: Partial<DiagramElement>) {
      update(state => ({
        ...state,
        elements: state.elements.map(el => 
          el.id === id ? { ...el, ...properties } : el
        )
      }));
    },

    updateMultipleElements(updates: ElementUpdate[]) {
      update(state => {
        const updateMap = new Map(updates.map(u => [u.id, u.properties]));
        
        return {
          ...state,
          elements: state.elements.map(el => {
            const update = updateMap.get(el.id);
            return update ? { ...el, ...update } : el;
          })
        };
      });
    },

    deleteElement(id: string) {
      update(state => ({
        ...state,
        elements: state.elements.filter(el => el.id !== id),
        connections: state.connections.filter(conn => 
          conn.source !== id && conn.target !== id
        )
      }));
    },

    deleteMultipleElements(ids: string[]) {
      const idSet = new Set(ids);
      update(state => ({
        ...state,
        elements: state.elements.filter(el => !idSet.has(el.id)),
        connections: state.connections.filter(conn => 
          !idSet.has(conn.source) && !idSet.has(conn.target)
        )
      }));
    },

    duplicateElement(id: string, offset: { x: number; y: number } = { x: 20, y: 20 }): string | null {
      const currentState = get({ subscribe });
      const element = currentState.elements.find(el => el.id === id);
      
      if (!element) return null;

      const newId = `${element.type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const baseName = element.name?.replace(/_\d+$/, '') || 'Element';
      const count = (currentState.elementNameCounts.get(baseName) || 0) + 1;
      const newName = `${baseName}_${count}`;

      const duplicatedElement: DiagramElement = {
        ...element,
        id: newId,
        name: newName,
        x: element.x + offset.x,
        y: element.y + offset.y
      };

      update(state => {
        const newCounts = new Map(state.elementNameCounts);
        newCounts.set(baseName, count);

        return {
          ...state,
          elements: [...state.elements, duplicatedElement],
          elementNameCounts: newCounts
        };
      });

      return newId;
    },

    moveElement(id: string, position: { x: number; y: number }) {
      update(state => ({
        ...state,
        elements: state.elements.map(el => 
          el.id === id ? { ...el, x: position.x, y: position.y } : el
        )
      }));
    },

    // Layer Operations
    sendToBack(id: string) {
      update(state => {
        const element = state.elements.find(el => el.id === id);
        if (!element) return state;

        const otherElements = state.elements.filter(el => el.id !== id);
        return {
          ...state,
          elements: [element, ...otherElements]
        };
      });
    },

    sendBackward(id: string) {
      update(state => {
        const index = state.elements.findIndex(el => el.id === id);
        if (index <= 0) return state;

        const newElements = [...state.elements];
        [newElements[index - 1], newElements[index]] = [newElements[index], newElements[index - 1]];
        
        return {
          ...state,
          elements: newElements
        };
      });
    },

    bringForward(id: string) {
      update(state => {
        const index = state.elements.findIndex(el => el.id === id);
        if (index === -1 || index === state.elements.length - 1) return state;

        const newElements = [...state.elements];
        [newElements[index], newElements[index + 1]] = [newElements[index + 1], newElements[index]];
        
        return {
          ...state,
          elements: newElements
        };
      });
    },

    bringToFront(id: string) {
      update(state => {
        const element = state.elements.find(el => el.id === id);
        if (!element) return state;

        const otherElements = state.elements.filter(el => el.id !== id);
        return {
          ...state,
          elements: [...otherElements, element]
        };
      });
    },

    // Connection Operations
    addConnection(connection: Connection) {
      update(state => ({
        ...state,
        connections: [...state.connections, connection]
      }));
    },

    updateConnection(id: string, properties: Partial<Connection>) {
      update(state => ({
        ...state,
        connections: state.connections.map(conn => 
          conn.id === id ? { ...conn, ...properties } : conn
        )
      }));
    },

    deleteConnection(id: string) {
      update(state => ({
        ...state,
        connections: state.connections.filter(conn => conn.id !== id)
      }));
    },

    // Utility Operations
    getElementById(id: string): DiagramElement | null {
      const state = get({ subscribe });
      return state.elements.find(el => el.id === id) || null;
    },

    getElementsByType(type: string): DiagramElement[] {
      const state = get({ subscribe });
      return state.elements.filter(el => el.type === type);
    },

    getElementsInBounds(bounds: { x: number; y: number; width: number; height: number }): DiagramElement[] {
      const state = get({ subscribe });
      return state.elements.filter(el => {
        const elRight = el.x + (el.width || 0);
        const elBottom = el.y + (el.height || 0);
        const boundsRight = bounds.x + bounds.width;
        const boundsBottom = bounds.y + bounds.height;

        return el.x < boundsRight &&
               elRight > bounds.x &&
               el.y < boundsBottom &&
               elBottom > bounds.y;
      });
    },

    // Bulk Operations
    clear() {
      set({
        elements: [],
        connections: [],
        elementNameCounts: new Map()
      });
    },

    loadElements(elements: DiagramElement[], connections: Connection[] = []) {
      // Rebuild name counts
      const nameCounts = new Map<string, number>();
      elements.forEach(el => {
        const baseName = el.name?.replace(/_\d+$/, '') || 'Element';
        const match = el.name?.match(/_(\d+)$/);
        const count = match ? parseInt(match[1]) : 1;
        nameCounts.set(baseName, Math.max(nameCounts.get(baseName) || 0, count));
      });

      set({
        elements,
        connections,
        elementNameCounts: nameCounts
      });
    },

    // Statistics
    getStats() {
      const state = get({ subscribe });
      const elementsByType = new Map<string, number>();
      
      state.elements.forEach(el => {
        elementsByType.set(el.type, (elementsByType.get(el.type) || 0) + 1);
      });

      return {
        totalElements: state.elements.length,
        totalConnections: state.connections.length,
        elementsByType: Object.fromEntries(elementsByType),
        bounds: this.getBounds()
      };
    },

    getBounds() {
      const state = get({ subscribe });
      if (state.elements.length === 0) {
        return { x: 0, y: 0, width: 0, height: 0 };
      }

      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

      state.elements.forEach(el => {
        minX = Math.min(minX, el.x);
        minY = Math.min(minY, el.y);
        maxX = Math.max(maxX, el.x + (el.width || 0));
        maxY = Math.max(maxY, el.y + (el.height || 0));
      });

      return {
        x: minX,
        y: minY,
        width: maxX - minX,
        height: maxY - minY
      };
    }
  };
}

export const elements = createElementsStore();