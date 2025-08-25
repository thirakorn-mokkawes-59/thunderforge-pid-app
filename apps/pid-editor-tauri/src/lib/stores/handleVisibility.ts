import { writable } from 'svelte/store';

function createHandleVisibilityStore() {
  const { subscribe, set, update } = writable(true);

  return {
    subscribe,
    show: () => set(true),
    hide: () => set(false),
    toggle: () => update(visible => !visible)
  };
}

export const handleVisibility = createHandleVisibilityStore();