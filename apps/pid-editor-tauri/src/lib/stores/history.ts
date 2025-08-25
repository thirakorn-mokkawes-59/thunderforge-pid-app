import { writable, get } from 'svelte/store';
import type { DiagramElement, Connection } from '$lib/types/diagram';

interface HistoryState {
  elements: DiagramElement[];
  connections: Connection[];
  elementNameCounts: Map<string, number>;
}

interface HistoryStore {
  past: HistoryState[];
  present: HistoryState | null;
  future: HistoryState[];
  maxHistorySize: number;
}

function createHistoryStore() {
  const initialState: HistoryStore = {
    past: [],
    present: null,
    future: [],
    maxHistorySize: 50
  };

  const { subscribe, set, update } = writable<HistoryStore>(initialState);

  return {
    subscribe,

    pushState(state: HistoryState) {
      update(history => {
        const newPast = history.present 
          ? [...history.past, history.present].slice(-history.maxHistorySize)
          : history.past;
        
        return {
          ...history,
          past: newPast,
          present: state,
          future: []
        };
      });
    },

    undo(): HistoryState | null {
      const history = get({ subscribe });
      
      if (history.past.length === 0 || !history.present) {
        return null;
      }

      const previous = history.past[history.past.length - 1];
      const newPast = history.past.slice(0, -1);
      
      update(h => ({
        ...h,
        past: newPast,
        present: previous,
        future: [history.present, ...h.future].slice(0, h.maxHistorySize)
      }));

      return previous;
    },

    redo(): HistoryState | null {
      const history = get({ subscribe });
      
      if (history.future.length === 0 || !history.present) {
        return null;
      }

      const next = history.future[0];
      const newFuture = history.future.slice(1);
      
      update(h => ({
        ...h,
        past: [...h.past, history.present!].slice(-h.maxHistorySize),
        present: next,
        future: newFuture
      }));

      return next;
    },

    canUndo(): boolean {
      const history = get({ subscribe });
      return history.past.length > 0;
    },

    canRedo(): boolean {
      const history = get({ subscribe });
      return history.future.length > 0;
    },

    clear() {
      set(initialState);
    }
  };
}

export const history = createHistoryStore();