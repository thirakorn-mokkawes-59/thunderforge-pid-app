<script lang="ts">
  import { diagram } from '$lib/stores/diagram';
  import { history } from '$lib/stores/history';
  import { ui } from '$lib/stores/ui';
  import { handleVisibility } from '$lib/stores/handleVisibility';
  import { Magnet } from '$lib/icons';
  import PanelLeft from '$lib/icons/PanelLeft.svelte';
  import PanelRight from '$lib/icons/PanelRight.svelte';
  import { Plus, Minus, Maximize2, Lock, Unlock, Circle } from 'lucide-svelte';
  
  let canUndo = false;
  let canRedo = false;
  let isLocked = false;
  
  // Subscribe to history changes
  history.subscribe(() => {
    canUndo = history.canUndo();
    canRedo = history.canRedo();
  });
  
  function toggleLeftPanel() {
    console.log('StatusBar: Toggle left panel button clicked');
    ui.toggleLeftPanel();
  }
  
  function toggleRightPanel() {
    console.log('StatusBar: Toggle right panel button clicked');
    ui.toggleRightPanel();
  }
  
  function toggleGrid() {
    console.log('StatusBar: Toggle grid button clicked');
    diagram.toggleGrid();
  }
  
  function toggleSnap() {
    console.log('StatusBar: Toggle snap to grid button clicked');
    diagram.toggleSnapToGrid();
  }
  
  function handleUndo() {
    diagram.undo();
  }
  
  function handleRedo() {
    diagram.redo();
  }
  
  function handleZoomIn() {
    // Dispatch zoom event that InnerCanvas listens to
    window.dispatchEvent(new CustomEvent('zoom-change', { 
      detail: { type: 'in' } 
    }));
  }
  
  function handleZoomOut() {
    // Dispatch zoom event that InnerCanvas listens to
    window.dispatchEvent(new CustomEvent('zoom-change', { 
      detail: { type: 'out' } 
    }));
  }
  
  function handleFitView() {
    // Dispatch fit view event that InnerCanvas listens to
    window.dispatchEvent(new CustomEvent('fit-view'));
  }
  
  function handleToggleLock() {
    isLocked = !isLocked;
    // Dispatch lock event that InnerCanvas listens to
    window.dispatchEvent(new CustomEvent('toggle-lock', { 
      detail: { locked: isLocked } 
    }));
  }
  
  function handleToggleHandles() {
    handleVisibility.toggle();
  }
</script>

<div class="status-bar">
  <div class="status-left">
    <button 
      class="status-button" 
      class:active={$ui.leftPanelVisible}
      on:click={toggleLeftPanel}
      title="Toggle Left Panel"
      aria-label="Toggle Left Panel"
    >
      <PanelLeft size={14} strokeWidth={2} />
    </button>
    <button 
      class="status-button" 
      class:active={$diagram.showGrid}
      on:click={toggleGrid}
      title="Toggle Grid"
      aria-label="Toggle Grid"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
        <line x1="9" y1="3" x2="9" y2="21"></line>
        <line x1="15" y1="3" x2="15" y2="21"></line>
        <line x1="3" y1="9" x2="21" y2="9"></line>
        <line x1="3" y1="15" x2="21" y2="15"></line>
      </svg>
    </button>
    <button 
      class="status-button" 
      class:active={$diagram.snapToGrid}
      on:click={toggleSnap}
      title="Snap to Grid"
      aria-label="Snap to Grid"
    >
      <Magnet size={14} strokeWidth={2} />
    </button>
  </div>
  
  <div class="status-center">
    <button 
      class="status-button zoom-button"
      on:click={handleZoomIn}
      title="Zoom In"
      aria-label="Zoom In"
    >
      <Plus size={14} strokeWidth={2} />
    </button>
    <button 
      class="status-button zoom-button"
      on:click={handleZoomOut}
      title="Zoom Out"
      aria-label="Zoom Out"
    >
      <Minus size={14} strokeWidth={2} />
    </button>
    <button 
      class="status-button zoom-button"
      on:click={handleFitView}
      title="Fit View"
      aria-label="Fit View"
    >
      <Maximize2 size={14} strokeWidth={2} />
    </button>
    <button 
      class="status-button zoom-button"
      class:active={isLocked}
      on:click={handleToggleLock}
      title={isLocked ? "Unlock Canvas" : "Lock Canvas"}
      aria-label={isLocked ? "Unlock Canvas" : "Lock Canvas"}
    >
      {#if isLocked}
        <Lock size={14} strokeWidth={2} />
      {:else}
        <Unlock size={14} strokeWidth={2} />
      {/if}
    </button>
  </div>
  
  <div class="status-right">
    <button 
      class="status-button" 
      class:active={$handleVisibility}
      on:click={handleToggleHandles}
      title={$handleVisibility ? "Hide Handles" : "Show Handles"}
      aria-label={$handleVisibility ? "Hide Handles" : "Show Handles"}
    >
      <Circle size={14} strokeWidth={2} fill={$handleVisibility ? "currentColor" : "none"} />
    </button>
    <button 
      class="status-button" 
      disabled={!canUndo}
      on:click={handleUndo}
      title="Undo (Ctrl+Z)"
      aria-label="Undo"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M3 7v6h6"></path>
        <path d="M21 17a9 9 0 00-9-9 9 9 0 00-6 2.3L3 13"></path>
      </svg>
    </button>
    <button 
      class="status-button" 
      disabled={!canRedo}
      on:click={handleRedo}
      title="Redo (Ctrl+Y)"
      aria-label="Redo"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M21 7v6h-6"></path>
        <path d="M3 17a9 9 0 019-9 9 9 0 016 2.3L21 13"></path>
      </svg>
    </button>
    <button 
      class="status-button" 
      class:active={$ui.rightPanelVisible}
      on:click={toggleRightPanel}
      title="Toggle Right Panel"
      aria-label="Toggle Right Panel"
    >
      <PanelRight size={14} strokeWidth={2} />
    </button>
  </div>
</div>

<style>
  .status-bar {
    height: 24px;
    background: #1f2937;
    border-top: 1px solid #374151;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 1rem;
    font-size: 0.75rem;
    color: #9ca3af;
    flex-shrink: 0;
  }
  
  .status-left {
    display: flex;
    align-items: center;
  }
  
  .status-center {
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }
  
  .status-right {
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }
  
  .status-button {
    background: transparent;
    border: none;
    padding: 2px 4px;
    color: #9ca3af;
    cursor: pointer;
    display: flex;
    align-items: center;
    transition: color 0.2s;
  }
  
  .status-button:hover:not(:disabled) {
    color: #e5e7eb;
  }
  
  .status-button.active:hover:not(:disabled) {
    color: #93bbfc;
  }
  
  .status-button:active,
  .status-button:focus {
    outline: none;
    color: inherit;
  }
  
  .status-button.active:active,
  .status-button.active:focus {
    color: #60a5fa;
  }
  
  .status-button:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }
  
  .status-button.active {
    color: #60a5fa;
  }
  
  .status-button svg {
    width: 14px;
    height: 14px;
  }
  
  .zoom-button {
    background: rgba(96, 165, 250, 0.1);
    border: 1px solid #374151;
    border-radius: 4px;
    padding: 2px 6px;
  }
  
  .zoom-button:hover {
    background: rgba(96, 165, 250, 0.2);
    border-color: #60a5fa;
  }
</style>