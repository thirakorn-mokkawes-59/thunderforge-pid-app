import { writable, get } from 'svelte/store';
import type { DiagramElement, Connection, Diagram, Point } from '$lib/types/diagram';
import { history } from './history';

interface DiagramState {
  name: string;
  elements: DiagramElement[];
  connections: Connection[];
  selectedIds: Set<string>;
  zoom: number;
  pan: Point;
  gridSize: number;
  snapToGrid: boolean;
  showGrid: boolean;
  elementNameCounts: Map<string, number>;
}

function createDiagramStore() {
  // Load saved state from localStorage
  const loadSavedState = (): DiagramState => {
    if (typeof window === 'undefined') {
      return {
        name: 'Untitled',
        elements: [],
        connections: [],
        selectedIds: new Set(),
        zoom: 1,
        pan: { x: 0, y: 0 },
        gridSize: 20,
        snapToGrid: true,
        showGrid: true,
        elementNameCounts: new Map()
      };
    }
    
    try {
      const saved = localStorage.getItem('pid-diagram-state');
      if (saved) {
        const parsed = JSON.parse(saved);
        // Convert arrays back to Set/Map
        return {
          ...parsed,
          selectedIds: new Set(parsed.selectedIds || []),
          elementNameCounts: new Map(parsed.elementNameCounts || [])
        };
      }
    } catch (e) {
      console.error('Failed to load saved diagram state:', e);
    }
    
    return {
      name: 'Untitled',
      elements: [],
      connections: [],
      selectedIds: new Set(),
      zoom: 1,
      pan: { x: 0, y: 0 },
      gridSize: 20,
      snapToGrid: true,
      showGrid: true,
      elementNameCounts: new Map()
    };
  };

  const initialState = loadSavedState();
  const { subscribe, set, update } = writable<DiagramState>(initialState);
  
  // Initialize history with the loaded state
  if (initialState.elements.length > 0 || initialState.connections.length > 0) {
    history.pushState({
      elements: [...initialState.elements],
      connections: [...initialState.connections],
      elementNameCounts: new Map(initialState.elementNameCounts)
    });
  }
  
  // Save state to localStorage whenever it changes
  const saveState = (state: DiagramState) => {
    if (typeof window !== 'undefined') {
      try {
        const toSave = {
          ...state,
          selectedIds: Array.from(state.selectedIds),
          elementNameCounts: Array.from(state.elementNameCounts)
        };
        localStorage.setItem('pid-diagram-state', JSON.stringify(toSave));
      } catch (e) {
        console.error('Failed to save diagram state:', e);
      }
    }
  };
  
  // Save current state to history before mutations
  const saveToHistory = () => {
    const currentState = get({ subscribe });
    history.pushState({
      elements: [...currentState.elements],
      connections: [...currentState.connections],
      elementNameCounts: new Map(currentState.elementNameCounts)
    });
  };
  
  return {
    subscribe,
    
    addElement(element: DiagramElement) {
      console.log('Adding element to diagram:', element);
      saveToHistory();
      update(state => {
        // Get the base name (without any numbering)
        const baseName = element.name;
        
        // Get the current count for this base name
        const currentCount = state.elementNameCounts.get(baseName) || 0;
        
        // Generate unique name
        let uniqueName = baseName;
        if (currentCount > 0) {
          uniqueName = `${baseName} - ${currentCount}`;
        }
        
        // Find the highest zIndex
        const highestZIndex = Math.max(0, ...state.elements.map(el => el.zIndex || 0));
        
        // Update the element with unique name and zIndex
        const elementWithUniqueName = {
          ...element,
          name: uniqueName,
          zIndex: element.zIndex ?? highestZIndex + 1
        };
        
        // Update the name count map
        const newNameCounts = new Map(state.elementNameCounts);
        newNameCounts.set(baseName, currentCount + 1);
        
        const newState = {
          ...state,
          elements: [...state.elements, elementWithUniqueName],
          elementNameCounts: newNameCounts
        };
        console.log('New elements array:', newState.elements);
        saveState(newState);
        return newState;
      });
    },
    
    updateElement(id: string, updates: Partial<DiagramElement>) {
      saveToHistory();
      update(state => {
        const newState = {
          ...state,
          elements: state.elements.map(el => 
            el.id === id ? { ...el, ...updates } : el
          )
        };
        saveState(newState);
        return newState;
      });
    },
    
    addConnection(connection: Connection) {
      console.log('Adding connection to diagram:', connection);
      saveToHistory();
      update(state => {
        const newState = {
          ...state,
          connections: [...state.connections, connection]
        };
        saveState(newState);
        return newState;
      });
    },
    
    updateConnection(id: string, updates: Partial<Connection>) {
      update(state => {
        const newState = {
          ...state,
          connections: state.connections.map(conn => 
            conn.id === id ? { ...conn, ...updates } : conn
          )
        };
        saveState(newState);
        return newState;
      });
    },
    
    removeConnection(id: string) {
      update(state => {
        const newState = {
          ...state,
          connections: state.connections.filter(conn => conn.id !== id)
        };
        saveState(newState);
        return newState;
      });
    },
    
    removeConnectionsForElement(elementId: string) {
      update(state => {
        const newState = {
          ...state,
          connections: state.connections.filter(conn => 
            conn.from.elementId !== elementId && conn.to.elementId !== elementId
          )
        };
        saveState(newState);
        return newState;
      });
    },
    
    removeElement(id: string) {
      saveToHistory();
      update(state => {
        // Find the element being removed
        const elementToRemove = state.elements.find(el => el.id === id);
        
        if (elementToRemove) {
          // Extract base name (remove the " - number" suffix if present)
          const nameMatch = elementToRemove.name.match(/^(.+?)(?:\s-\s\d+)?$/);
          const baseName = nameMatch ? nameMatch[1] : elementToRemove.name;
          
          // Decrement the count for this base name
          const newNameCounts = new Map(state.elementNameCounts);
          const currentCount = newNameCounts.get(baseName) || 0;
          if (currentCount > 0) {
            newNameCounts.set(baseName, currentCount - 1);
          }
          
          const newState = {
            ...state,
            elements: state.elements.filter(el => el.id !== id),
            connections: state.connections.filter(
              conn => conn.from.elementId !== id && conn.to.elementId !== id
            ),
            selectedIds: new Set([...state.selectedIds].filter(sid => sid !== id)),
            elementNameCounts: newNameCounts
          };
          saveState(newState);
          return newState;
        }
        
        return state;
      });
    },
    
    selectElement(id: string, multi = false) {
      console.log('Store: selectElement called with id:', id);
      update(state => {
        const newSelection = multi ? new Set(state.selectedIds) : new Set<string>();
        newSelection.add(id);
        console.log('Store: new selection:', Array.from(newSelection));
        return { ...state, selectedIds: newSelection };
      });
    },
    
    deselectAll() {
      update(state => ({
        ...state,
        selectedIds: new Set()
      }));
    },
    
    setZoom(zoom: number) {
      update(state => ({
        ...state,
        zoom: Math.max(0.1, Math.min(10, zoom))
      }));
    },
    
    setPan(pan: Point) {
      update(state => ({
        ...state,
        pan
      }));
    },
    
    toggleGrid() {
      update(state => {
        const newShowGrid = !state.showGrid;
        console.log('Toggling grid from', state.showGrid, 'to', newShowGrid);
        const newState = {
          ...state,
          showGrid: newShowGrid
        };
        // Don't save to localStorage during toggle to avoid conflicts
        // saveState(newState);
        return newState;
      });
    },
    
    toggleSnapToGrid() {
      update(state => ({
        ...state,
        snapToGrid: !state.snapToGrid
      }));
    },
    
    clear() {
      const newState = {
        name: 'Untitled',
        elements: [],
        connections: [],
        selectedIds: new Set(),
        zoom: 1,
        pan: { x: 0, y: 0 },
        gridSize: 20,
        snapToGrid: true,
        showGrid: true,
        elementNameCounts: new Map()
      };
      set(newState);
      saveState(newState);
    },
    
    setName(name: string) {
      update(state => {
        const newState = { ...state, name };
        saveState(newState);
        return newState;
      });
    },
    
    clearStorage() {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('pid-diagram-state');
      }
    },
    
    saveCurrentState() {
      const currentState = get({ subscribe });
      saveState(currentState);
    },
    
    undo() {
      const previousState = history.undo();
      if (previousState) {
        update(state => {
          const newState = {
            ...state,
            elements: previousState.elements,
            connections: previousState.connections,
            elementNameCounts: previousState.elementNameCounts
          };
          saveState(newState);
          return newState;
        });
        return true;
      }
      return false;
    },
    
    redo() {
      const nextState = history.redo();
      if (nextState) {
        update(state => {
          const newState = {
            ...state,
            elements: nextState.elements,
            connections: nextState.connections,
            elementNameCounts: nextState.elementNameCounts
          };
          saveState(newState);
          return newState;
        });
        return true;
      }
      return false;
    },
    
    canUndo() {
      return history.canUndo();
    },
    
    canRedo() {
      return history.canRedo();
    },
    
    bringToFront(elementId: string) {
      saveToHistory();
      update(state => {
        const element = state.elements.find(el => el.id === elementId);
        if (!element) return state;
        
        // Find the highest zIndex
        const highestZIndex = Math.max(0, ...state.elements.map(el => el.zIndex || 0));
        
        const newState = {
          ...state,
          elements: state.elements.map(el => 
            el.id === elementId ? { ...el, zIndex: highestZIndex + 1 } : el
          )
        };
        saveState(newState);
        return newState;
      });
    },
    
    sendToBack(elementId: string) {
      saveToHistory();
      update(state => {
        const element = state.elements.find(el => el.id === elementId);
        if (!element) return state;
        
        // Find the lowest zIndex
        const lowestZIndex = Math.min(0, ...state.elements.map(el => el.zIndex || 0));
        
        const newState = {
          ...state,
          elements: state.elements.map(el => 
            el.id === elementId ? { ...el, zIndex: lowestZIndex - 1 } : el
          )
        };
        saveState(newState);
        return newState;
      });
    },
    
    bringForward(elementId: string) {
      saveToHistory();
      update(state => {
        const element = state.elements.find(el => el.id === elementId);
        if (!element) return state;
        
        const currentZ = element.zIndex || 0;
        // Find the next higher zIndex
        const higherZIndexes = state.elements
          .filter(el => el.id !== elementId && (el.zIndex || 0) > currentZ)
          .map(el => el.zIndex || 0)
          .sort((a, b) => a - b);
        
        const nextZ = higherZIndexes[0];
        if (nextZ === undefined) {
          // Already at the front, bring to absolute front
          const highestZIndex = Math.max(0, ...state.elements.map(el => el.zIndex || 0));
          const newState = {
            ...state,
            elements: state.elements.map(el => 
              el.id === elementId ? { ...el, zIndex: highestZIndex + 1 } : el
            )
          };
          saveState(newState);
          return newState;
        }
        
        // Swap zIndex with the next element
        const newState = {
          ...state,
          elements: state.elements.map(el => {
            if (el.id === elementId) return { ...el, zIndex: nextZ };
            if ((el.zIndex || 0) === nextZ) return { ...el, zIndex: currentZ };
            return el;
          })
        };
        saveState(newState);
        return newState;
      });
    },
    
    sendBackward(elementId: string) {
      saveToHistory();
      update(state => {
        const element = state.elements.find(el => el.id === elementId);
        if (!element) return state;
        
        const currentZ = element.zIndex || 0;
        // Find the next lower zIndex
        const lowerZIndexes = state.elements
          .filter(el => el.id !== elementId && (el.zIndex || 0) < currentZ)
          .map(el => el.zIndex || 0)
          .sort((a, b) => b - a);
        
        const nextZ = lowerZIndexes[0];
        if (nextZ === undefined) {
          // Already at the back, send to absolute back
          const lowestZIndex = Math.min(0, ...state.elements.map(el => el.zIndex || 0));
          const newState = {
            ...state,
            elements: state.elements.map(el => 
              el.id === elementId ? { ...el, zIndex: lowestZIndex - 1 } : el
            )
          };
          saveState(newState);
          return newState;
        }
        
        // Swap zIndex with the previous element
        const newState = {
          ...state,
          elements: state.elements.map(el => {
            if (el.id === elementId) return { ...el, zIndex: nextZ };
            if ((el.zIndex || 0) === nextZ) return { ...el, zIndex: currentZ };
            return el;
          })
        };
        saveState(newState);
        return newState;
      });
    }
  };
}

export const diagram = createDiagramStore();