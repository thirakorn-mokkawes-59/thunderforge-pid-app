import { writable } from 'svelte/store';
import type { DiagramElement } from '$lib/types/diagram';

interface ClipboardState {
  copiedElements: DiagramElement[];
  copiedAt: number | null;
}

function createClipboardStore() {
  const initialState: ClipboardState = {
    copiedElements: [],
    copiedAt: null
  };

  const { subscribe, set, update } = writable<ClipboardState>(initialState);

  return {
    subscribe,

    copy(elements: DiagramElement[]) {
      console.log('Copying elements to clipboard:', elements);
      update(() => ({
        copiedElements: elements.map(el => ({
          ...el,
          // Remove the ID so it gets a new one when pasted
          id: ''
        })),
        copiedAt: Date.now()
      }));
    },

    getCopiedElements(): DiagramElement[] {
      let elements: DiagramElement[] = [];
      const unsubscribe = subscribe(state => {
        elements = state.copiedElements;
      });
      unsubscribe();
      return elements;
    },

    clear() {
      set(initialState);
    },

    hasCopiedElements(): boolean {
      let hasElements = false;
      const unsubscribe = subscribe(state => {
        hasElements = state.copiedElements.length > 0;
      });
      unsubscribe();
      return hasElements;
    }
  };
}

export const clipboard = createClipboardStore();