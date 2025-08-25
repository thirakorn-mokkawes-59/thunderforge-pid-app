<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import NumericInput from '../inputs/NumericInput.svelte';
  import PropertySection from '../ui/PropertySection.svelte';
  import type { DiagramElement } from '$lib/types/diagram';
  import { ValidationUtils, MathUtils } from '$lib/utils/domUtils';

  export let element: DiagramElement;
  export let expanded: boolean = true;

  const dispatch = createEventDispatcher<{
    update: { property: string; value: any };
  }>();

  function updateProperty(property: string, value: any) {
    dispatch('update', { property, value });
  }

  function handlePositionChange(axis: 'x' | 'y', value: number) {
    updateProperty(axis, Math.round(value));
  }

  function handleSizeChange(dimension: 'width' | 'height', value: number) {
    const clampedValue = Math.max(10, Math.round(value)); // Minimum size of 10px
    updateProperty(dimension, clampedValue);
  }

  function handleRotationChange(value: number) {
    // Normalize rotation to 0-359 degrees
    const normalizedRotation = ((value % 360) + 360) % 360;
    updateProperty('rotation', normalizedRotation);
  }

  function handleLabelOffsetChange(axis: 'X' | 'Y', value: number) {
    updateProperty(`labelOffset${axis}`, Math.round(value));
  }

  function handleTagOffsetChange(axis: 'X' | 'Y', value: number) {
    updateProperty(`tagOffset${axis}`, Math.round(value));
  }

  function toggleFlip(axis: 'X' | 'Y') {
    const property = `flip${axis}`;
    updateProperty(property, !element[property]);
  }

  function resetTransform() {
    updateProperty('rotation', 0);
    updateProperty('flipX', false);
    updateProperty('flipY', false);
  }

  function resetPosition() {
    updateProperty('x', 0);
    updateProperty('y', 0);
  }

  function resetSize() {
    // Reset to some default size - you might want to make this configurable
    updateProperty('width', 64);
    updateProperty('height', 64);
  }

  // Validation functions
  function validateSize(value: number): string | null {
    if (!ValidationUtils.isValidPositiveNumber(value)) return 'Must be a positive number';
    if (value < 10) return 'Minimum size is 10px';
    if (value > 1000) return 'Maximum size is 1000px';
    return null;
  }

  function validateRotation(value: number): string | null {
    if (!ValidationUtils.isValidNumber(value)) return 'Must be a number';
    return null;
  }

  function validateOffset(value: number): string | null {
    if (!ValidationUtils.isValidNumber(value)) return 'Must be a number';
    if (!ValidationUtils.isInRange(value, -500, 500)) return 'Must be between -500 and 500';
    return null;
  }
</script>

<PropertySection 
  title="Transform" 
  bind:expanded 
  icon="🔄"
>
  <div class="transform-controls">
    <!-- Position -->
    <div class="control-section">
      <div class="section-header">
        <span class="section-title">Position</span>
        <button 
          class="reset-button" 
          on:click={resetPosition}
          title="Reset position to origin"
        >
          Reset
        </button>
      </div>
      
      <div class="control-row">
        <NumericInput
          label="X"
          value={element.x || 0}
          step={1}
          unit="px"
          on:change={(e) => handlePositionChange('x', e.detail)}
        />
        <NumericInput
          label="Y"
          value={element.y || 0}
          step={1}
          unit="px"
          on:change={(e) => handlePositionChange('y', e.detail)}
        />
      </div>
    </div>

    <!-- Size -->
    <div class="control-section">
      <div class="section-header">
        <span class="section-title">Size</span>
        <button 
          class="reset-button" 
          on:click={resetSize}
          title="Reset to default size"
        >
          Reset
        </button>
      </div>
      
      <div class="control-row">
        <NumericInput
          label="Width"
          value={element.width || 64}
          min={10}
          max={1000}
          step={1}
          unit="px"
          validator={validateSize}
          on:change={(e) => handleSizeChange('width', e.detail)}
        />
        <NumericInput
          label="Height"
          value={element.height || 64}
          min={10}
          max={1000}
          step={1}
          unit="px"
          validator={validateSize}
          on:change={(e) => handleSizeChange('height', e.detail)}
        />
      </div>
    </div>

    <!-- Rotation & Flip -->
    <div class="control-section">
      <div class="section-header">
        <span class="section-title">Rotation & Flip</span>
        <button 
          class="reset-button" 
          on:click={resetTransform}
          title="Reset rotation and flips"
        >
          Reset
        </button>
      </div>
      
      <div class="control-row">
        <NumericInput
          label="Rotation"
          value={element.rotation || 0}
          step={15}
          unit="°"
          validator={validateRotation}
          on:change={(e) => handleRotationChange(e.detail)}
        />
      </div>

      <div class="flip-controls">
        <label class="flip-control">
          <input
            type="checkbox"
            checked={element.flipX || false}
            on:change={() => toggleFlip('X')}
          />
          <span class="flip-label">Flip Horizontal</span>
        </label>
        
        <label class="flip-control">
          <input
            type="checkbox"
            checked={element.flipY || false}
            on:change={() => toggleFlip('Y')}
          />
          <span class="flip-label">Flip Vertical</span>
        </label>
      </div>
    </div>

    <!-- Label Position -->
    {#if element.showLabel !== false}
      <div class="control-section">
        <div class="section-header">
          <span class="section-title">Label Position</span>
        </div>
        
        <div class="control-row">
          <NumericInput
            label="Offset X"
            value={element.labelOffsetX || 0}
            step={1}
            unit="px"
            validator={validateOffset}
            on:change={(e) => handleLabelOffsetChange('X', e.detail)}
          />
          <NumericInput
            label="Offset Y"
            value={element.labelOffsetY || 0}
            step={1}
            unit="px"
            validator={validateOffset}
            on:change={(e) => handleLabelOffsetChange('Y', e.detail)}
          />
        </div>
      </div>
    {/if}

    <!-- Tag Position -->
    {#if element.showTag !== false && element.tag}
      <div class="control-section">
        <div class="section-header">
          <span class="section-title">Tag Position</span>
        </div>
        
        <div class="control-row">
          <NumericInput
            label="Offset X"
            value={element.tagOffsetX || 0}
            step={1}
            unit="px"
            validator={validateOffset}
            on:change={(e) => handleTagOffsetChange('X', e.detail)}
          />
          <NumericInput
            label="Offset Y"
            value={element.tagOffsetY || 0}
            step={1}
            unit="px"
            validator={validateOffset}
            on:change={(e) => handleTagOffsetChange('Y', e.detail)}
          />
        </div>
      </div>
    {/if}
  </div>
</PropertySection>

<style>
  .transform-controls {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .control-section {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .section-title {
    font-size: 11px;
    font-weight: 600;
    color: #6B7280;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .reset-button {
    padding: 2px 8px;
    background: transparent;
    border: 1px solid #D1D5DB;
    border-radius: 4px;
    font-size: 10px;
    color: #6B7280;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .reset-button:hover {
    background: #F3F4F6;
    border-color: #9CA3AF;
    color: #374151;
  }

  .control-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }

  .flip-controls {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-top: 8px;
  }

  .flip-control {
    display: flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
    font-size: 12px;
    color: #374151;
  }

  .flip-control input[type="checkbox"] {
    width: 14px;
    height: 14px;
    accent-color: #3B82F6;
  }

  .flip-label {
    user-select: none;
  }

  /* Responsive adjustments */
  @media (max-width: 640px) {
    .control-row {
      grid-template-columns: 1fr;
      gap: 8px;
    }

    .section-header {
      flex-direction: column;
      align-items: stretch;
      gap: 4px;
    }
  }
</style>