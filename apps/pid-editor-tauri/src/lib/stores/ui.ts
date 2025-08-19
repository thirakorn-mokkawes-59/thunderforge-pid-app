import { writable } from 'svelte/store';

interface UIState {
  leftPanelVisible: boolean;
  rightPanelVisible: boolean;
}

function createUIStore() {
  const { subscribe, update } = writable<UIState>({
    leftPanelVisible: true,
    rightPanelVisible: true
  });

  return {
    subscribe,
    
    toggleLeftPanel() {
      update(state => ({
        ...state,
        leftPanelVisible: !state.leftPanelVisible
      }));
    },
    
    toggleRightPanel() {
      update(state => ({
        ...state,
        rightPanelVisible: !state.rightPanelVisible
      }));
    },
    
    setLeftPanelVisible(visible: boolean) {
      update(state => ({
        ...state,
        leftPanelVisible: visible
      }));
    },
    
    setRightPanelVisible(visible: boolean) {
      update(state => ({
        ...state,
        rightPanelVisible: visible
      }));
    }
  };
}

export const ui = createUIStore();