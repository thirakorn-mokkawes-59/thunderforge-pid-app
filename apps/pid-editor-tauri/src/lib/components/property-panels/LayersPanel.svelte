<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import PropertySection from '../ui/PropertySection.svelte';
  import SelectInput from '../inputs/SelectInput.svelte';
  import type { DiagramElement } from '$lib/types/diagram';
  import { diagram } from '$lib/stores/diagram';

  export let element: DiagramElement;
  export let expanded: boolean = true;

  const dispatch = createEventDispatcher<{
    update: { property: string; value: any };
    action: { type: string; data?: any };
  }>();

  // Tag position options
  const tagPositionOptions = [
    { value: 'above', label: 'Above' },
    { value: 'below', label: 'Below' },
    { value: 'left', label: 'Left' },
    { value: 'right', label: 'Right' }
  ];

  function updateProperty(property: string, value: any) {
    dispatch('update', { property, value });
  }

  function toggleVisibility(property: 'showLabel' | 'showTag') {
    updateProperty(property, !element[property]);
  }

  function sendToBack() {
    dispatch('action', { type: 'sendToBack' });
  }

  function sendBackward() {
    dispatch('action', { type: 'sendBackward' });
  }

  function bringForward() {
    dispatch('action', { type: 'bringForward' });
  }

  function bringToFront() {
    dispatch('action', { type: 'bringToFront' });
  }

  function duplicateElement() {
    dispatch('action', { type: 'duplicate' });
  }

  function deleteElement() {
    dispatch('action', { type: 'delete' });
  }

  function lockElement() {
    updateProperty('locked', !element.locked);
  }

  function groupElements() {
    dispatch('action', { type: 'group' });
  }

  function ungroupElements() {
    dispatch('action', { type: 'ungroup' });
  }

  // Get current layer position
  $: currentIndex = $diagram.elements.findIndex(el => el.id === element.id);
  $: totalElements = $diagram.elements.length;
  $: isTopLayer = currentIndex === totalElements - 1;
  $: isBottomLayer = currentIndex === 0;
  $: canGroup = $diagram.selectedIds.size > 1;
</script>

<PropertySection 
  title="Layers & Visibility" 
  bind:expanded 
  icon="👁️"
>
  <div class="layers-controls">
    <!-- Visibility Controls -->
    <div class="control-section">
      <div class="section-title">Visibility</div>
      
      <div class="visibility-controls">
        <label class="visibility-control">
          <input
            type="checkbox"
            checked={element.showLabel !== false}
            on:change={() => toggleVisibility('showLabel')}
          />
          <span class="control-label">Show Label</span>
        </label>
        
        <label class="visibility-control">
          <input
            type="checkbox"
            checked={element.showTag !== false}
            on:change={() => toggleVisibility('showTag')}
          />
          <span class="control-label">Show Tag</span>
        </label>
      </div>

      {#if element.showTag !== false}
        <div class="tag-position-control">
          <SelectInput
            label="Tag Position"
            value={element.tagPosition || 'below'}
            options={tagPositionOptions}
            on:change={(e) => updateProperty('tagPosition', e.detail)}
          />
        </div>
      {/if}
    </div>

    <!-- Layer Controls -->
    <div class="control-section">
      <div class="section-title">Layer Order</div>
      
      <div class="layer-info">
        <span class="layer-position">
          Layer {currentIndex + 1} of {totalElements}
        </span>
      </div>

      <div class="layer-buttons">
        <button
          class="layer-button"
          disabled={isTopLayer}
          on:click={bringToFront}
          title="Bring to front"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M2 2h12v12H2V2z" stroke="currentColor" fill="none"/>
            <path d="M4 4h8v8H4V4z" fill="currentColor"/>
          </svg>
          To Front
        </button>

        <button
          class="layer-button"
          disabled={isTopLayer}
          on:click={bringForward}
          title="Bring forward"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M2 2h12v12H2V2z" stroke="currentColor" fill="none"/>
            <path d="M4 6h8v6H4V6z" fill="currentColor"/>
          </svg>
          Forward
        </button>

        <button
          class="layer-button"
          disabled={isBottomLayer}
          on:click={sendBackward}
          title="Send backward"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M2 2h12v12H2V2z" stroke="currentColor" fill="none"/>
            <path d="M4 4h8v6H4V4z" fill="currentColor"/>
          </svg>
          Backward
        </button>

        <button
          class="layer-button"
          disabled={isBottomLayer}
          on:click={sendToBack}
          title="Send to back"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M2 2h12v12H2V2z" stroke="currentColor" fill="none"/>
            <path d="M4 4h8v4H4V4z" fill="currentColor"/>
          </svg>
          To Back
        </button>
      </div>
    </div>

    <!-- Element Actions -->
    <div class="control-section">
      <div class="section-title">Actions</div>
      
      <div class="action-buttons">
        <button
          class="action-button lock-button"
          class:locked={element.locked}
          on:click={lockElement}
          title={element.locked ? 'Unlock element' : 'Lock element'}
        >
          {#if element.locked}
            🔒 Locked
          {:else}
            🔓 Unlocked
          {/if}
        </button>

        <button
          class="action-button"
          on:click={duplicateElement}
          title="Duplicate element"
        >
          📋 Duplicate
        </button>

        {#if canGroup}
          <button
            class="action-button"
            on:click={groupElements}
            title="Group selected elements"
          >
            📦 Group
          </button>
        {/if}

        {#if element.type === 'group'}
          <button
            class="action-button"
            on:click={ungroupElements}
            title="Ungroup elements"
          >
            📂 Ungroup
          </button>
        {/if}

        <button
          class="action-button danger"
          on:click={deleteElement}
          title="Delete element"
        >
          🗑️ Delete
        </button>
      </div>
    </div>
  </div>
</PropertySection>

<style>
  .layers-controls {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .control-section {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .section-title {
    font-size: 11px;
    font-weight: 600;
    color: #6B7280;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .visibility-controls {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .visibility-control {
    display: flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
    font-size: 12px;
    color: #374151;
  }

  .visibility-control input[type="checkbox"] {
    width: 14px;
    height: 14px;
    accent-color: #3B82F6;
  }

  .control-label {
    user-select: none;
  }

  .tag-position-control {
    margin-top: 8px;
  }

  .layer-info {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 8px;
    background: #F9FAFB;
    border: 1px solid #E5E7EB;
    border-radius: 4px;
  }

  .layer-position {
    font-size: 11px;
    color: #6B7280;
    font-weight: 500;
  }

  .layer-buttons {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 4px;
  }

  .layer-button {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
    padding: 6px 8px;
    background: white;
    border: 1px solid #D1D5DB;
    border-radius: 4px;
    font-size: 10px;
    color: #374151;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .layer-button:hover:not(:disabled) {
    background: #F3F4F6;
    border-color: #9CA3AF;
  }

  .layer-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .layer-button svg {
    width: 12px;
    height: 12px;
  }

  .action-buttons {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .action-button {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 8px 12px;
    background: white;
    border: 1px solid #D1D5DB;
    border-radius: 4px;
    font-size: 11px;
    color: #374151;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .action-button:hover {
    background: #F3F4F6;
    border-color: #9CA3AF;
  }

  .action-button.lock-button.locked {
    background: #FEF3C7;
    border-color: #F59E0B;
    color: #92400E;
  }

  .action-button.danger {
    color: #DC2626;
    border-color: #FCA5A5;
  }

  .action-button.danger:hover {
    background: #FEF2F2;
    border-color: #F87171;
  }

  /* Responsive adjustments */
  @media (max-width: 640px) {
    .layer-buttons {
      grid-template-columns: 1fr;
    }
  }
</style>