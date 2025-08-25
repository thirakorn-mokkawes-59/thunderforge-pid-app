/**
 * Selection Store
 * Manages selected elements and selection operations
 */

import { writable, derived, get } from 'svelte/store';
import type { DiagramElement } from '$lib/types/diagram';
import { elements } from './elements';

interface SelectionState {
  selectedIds: Set<string>;
  lastSelectedId: string | null;
  selectionBounds: { x: number; y: number; width: number; height: number } | null;
}

interface SelectionBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

function createSelectionStore() {
  const { subscribe, set, update } = writable<SelectionState>({
    selectedIds: new Set(),
    lastSelectedId: null,
    selectionBounds: null
  });

  // Derived stores
  const selectedIds = derived({ subscribe }, state => state.selectedIds);
  const selectedElements = derived(
    [{ subscribe }, elements],
    ([selectionState, elementsState]) => {
      return elementsState.elements.filter(el => selectionState.selectedIds.has(el.id));
    }
  );

  const hasSelection = derived(selectedIds, ids => ids.size > 0);
  const hasMultipleSelection = derived(selectedIds, ids => ids.size > 1);
  const selectionCount = derived(selectedIds, ids => ids.size);

  function calculateSelectionBounds(elementList: DiagramElement[]): SelectionBounds | null {
    if (elementList.length === 0) return null;

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

    elementList.forEach(el => {
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

  function updateSelectionBounds() {
    update(state => {
      const elementsState = get(elements);
      const selectedElementList = elementsState.elements.filter(el => state.selectedIds.has(el.id));
      const bounds = calculateSelectionBounds(selectedElementList);

      return {
        ...state,
        selectionBounds: bounds
      };
    });
  }

  return {
    subscribe,
    selectedIds,
    selectedElements,
    hasSelection,
    hasMultipleSelection,
    selectionCount,

    // Selection Operations
    select(id: string, addToSelection: boolean = false) {
      update(state => {
        const newSelectedIds = addToSelection 
          ? new Set([...state.selectedIds, id])
          : new Set([id]);

        const newState = {
          ...state,
          selectedIds: newSelectedIds,
          lastSelectedId: id
        };

        return newState;
      });
      updateSelectionBounds();
    },

    selectMultiple(ids: string[], addToSelection: boolean = false) {
      update(state => {
        const newSelectedIds = addToSelection
          ? new Set([...state.selectedIds, ...ids])
          : new Set(ids);

        return {
          ...state,
          selectedIds: newSelectedIds,
          lastSelectedId: ids[ids.length - 1] || state.lastSelectedId
        };
      });
      updateSelectionBounds();
    },

    deselect(id: string) {
      update(state => {
        const newSelectedIds = new Set(state.selectedIds);
        newSelectedIds.delete(id);

        return {
          ...state,
          selectedIds: newSelectedIds,
          lastSelectedId: newSelectedIds.size > 0 ? state.lastSelectedId : null
        };
      });
      updateSelectionBounds();
    },

    deselectMultiple(ids: string[]) {
      update(state => {
        const newSelectedIds = new Set(state.selectedIds);
        ids.forEach(id => newSelectedIds.delete(id));

        return {
          ...state,
          selectedIds: newSelectedIds,
          lastSelectedId: newSelectedIds.size > 0 ? state.lastSelectedId : null
        };
      });
      updateSelectionBounds();
    },

    toggle(id: string, addToSelection: boolean = false) {
      const state = get({ subscribe });
      
      if (state.selectedIds.has(id)) {
        if (addToSelection || state.selectedIds.size === 1) {
          this.deselect(id);
        }
      } else {
        this.select(id, addToSelection);
      }
    },

    clear() {
      set({
        selectedIds: new Set(),
        lastSelectedId: null,
        selectionBounds: null
      });
    },

    selectAll() {
      const elementsState = get(elements);
      const allIds = elementsState.elements.map(el => el.id);
      this.selectMultiple(allIds, false);
    },

    // Selection by criteria
    selectByType(type: string, addToSelection: boolean = false) {
      const elementsState = get(elements);
      const typeIds = elementsState.elements
        .filter(el => el.type === type)
        .map(el => el.id);
      
      this.selectMultiple(typeIds, addToSelection);
    },

    selectInBounds(bounds: SelectionBounds, addToSelection: boolean = false) {
      const elementsState = get(elements);
      const elementList = elementsState.elements.filter(el => {
        const elRight = el.x + (el.width || 0);
        const elBottom = el.y + (el.height || 0);
        const boundsRight = bounds.x + bounds.width;
        const boundsBottom = bounds.y + bounds.height;

        // Check if element intersects with bounds
        return el.x < boundsRight &&
               elRight > bounds.x &&
               el.y < boundsBottom &&
               elBottom > bounds.y;
      });

      const ids = elementList.map(el => el.id);
      this.selectMultiple(ids, addToSelection);
    },

    // Utility functions
    isSelected(id: string): boolean {
      const state = get({ subscribe });
      return state.selectedIds.has(id);
    },

    getSelectedIds(): string[] {
      const state = get({ subscribe });
      return Array.from(state.selectedIds);
    },

    getSelectedElements(): DiagramElement[] {
      const state = get({ subscribe });
      const elementsState = get(elements);
      return elementsState.elements.filter(el => state.selectedIds.has(el.id));
    },

    getLastSelected(): DiagramElement | null {
      const state = get({ subscribe });
      if (!state.lastSelectedId) return null;

      const elementsState = get(elements);
      return elementsState.elements.find(el => el.id === state.lastSelectedId) || null;
    },

    getSelectionBounds(): SelectionBounds | null {
      const state = get({ subscribe });
      return state.selectionBounds;
    },

    // Advanced selection operations
    invertSelection() {
      const elementsState = get(elements);
      const state = get({ subscribe });
      
      const allIds = new Set(elementsState.elements.map(el => el.id));
      const selectedIds = state.selectedIds;
      const invertedIds = Array.from(allIds).filter(id => !selectedIds.has(id));
      
      this.selectMultiple(invertedIds, false);
    },

    selectSimilar(referenceId: string, criteria: 'type' | 'name' | 'color' | 'size' = 'type') {
      const elementsState = get(elements);
      const referenceElement = elementsState.elements.find(el => el.id === referenceId);
      
      if (!referenceElement) return;

      const similarElements = elementsState.elements.filter(el => {
        switch (criteria) {
          case 'type':
            return el.type === referenceElement.type;
          case 'name':
            return el.name === referenceElement.name;
          case 'color':
            return el.color === referenceElement.color;
          case 'size':
            return el.width === referenceElement.width && el.height === referenceElement.height;
          default:
            return false;
        }
      });

      const similarIds = similarElements.map(el => el.id);
      this.selectMultiple(similarIds, false);
    },

    // Group operations
    groupSelected(): string | null {
      const selectedElementList = this.getSelectedElements();
      if (selectedElementList.length < 2) return null;

      const bounds = calculateSelectionBounds(selectedElementList);
      if (!bounds) return null;

      const groupId = `group_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // This would integrate with elements store to create a group
      // For now, just return the group ID
      return groupId;
    },

    // Statistics
    getSelectionStats() {
      const selectedElementList = this.getSelectedElements();
      const typeCount = new Map<string, number>();
      
      selectedElementList.forEach(el => {
        typeCount.set(el.type, (typeCount.get(el.type) || 0) + 1);
      });

      return {
        count: selectedElementList.length,
        types: Object.fromEntries(typeCount),
        bounds: calculateSelectionBounds(selectedElementList)
      };
    }
  };
}

export const selection = createSelectionStore();