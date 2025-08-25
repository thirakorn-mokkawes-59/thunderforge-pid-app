<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import { fade } from 'svelte/transition';
  import { clickOutside } from '$lib/utils/domUtils';
  import { 
    COLOR_PALETTE, 
    PRESET_COLORS, 
    getRecentColors, 
    addRecentColor, 
    isValidHexColor,
    getContrastColor 
  } from '$lib/constants/colors';
  import type { ColorPickerProps } from '$lib/types/components';

  // Props
  export let value: string = '#000000';
  export let label: string = 'Color';
  export let isOpen: boolean = false;
  export let position: 'above' | 'below' | 'left' | 'right' = 'below';
  export let showPresets: boolean = true;
  export let showRecent: boolean = true;
  export let showInput: boolean = true;
  export let compact: boolean = false;

  // Internal state
  let customValue = value;
  let recentColors: string[] = [];
  let colorPickerRef: HTMLDivElement;
  
  const dispatch = createEventDispatcher<{
    change: string;
    close: void;
  }>();

  onMount(() => {
    recentColors = getRecentColors();
  });

  // Update custom value when prop changes
  $: customValue = value;

  function selectColor(color: string) {
    if (color !== value) {
      addRecentColor(color);
      recentColors = getRecentColors();
      dispatch('change', color);
    }
  }

  function handleCustomInput() {
    const trimmed = customValue.trim();
    if (isValidHexColor(trimmed)) {
      selectColor(trimmed);
    }
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      event.preventDefault();
      handleCustomInput();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      closeColorPicker();
    }
  }

  function closeColorPicker() {
    isOpen = false;
    dispatch('close');
  }

  function handleClickOutside() {
    if (isOpen) {
      closeColorPicker();
    }
  }

  // Color swatch component
  function getSwatchStyle(color: string, isSelected: boolean = false) {
    const border = isSelected ? '2px solid #3B82F6' : '1px solid #E5E7EB';
    return `background: ${color}; border: ${border};`;
  }

  $: positionClass = `position-${position}`;
</script>

<!-- Color Picker Trigger -->
<div class="color-picker-trigger">
  <label class="color-label">{label}</label>
  <button
    class="color-swatch-button"
    class:compact
    style={getSwatchStyle(value)}
    on:click={() => isOpen = !isOpen}
    aria-label="Open color picker"
  >
    <span class="sr-only">Current color: {value}</span>
  </button>
</div>

<!-- Color Picker Dropdown -->
{#if isOpen}
  <div
    bind:this={colorPickerRef}
    class="color-picker-dropdown {positionClass}"
    class:compact
    use:clickOutside
    on:clickOutside={handleClickOutside}
    transition:fade={{ duration: 150 }}
  >
    <!-- Custom Color Input -->
    {#if showInput}
      <div class="color-input-section">
        <input
          type="text"
          bind:value={customValue}
          on:blur={handleCustomInput}
          on:keydown={handleKeydown}
          placeholder="#000000"
          class="color-input"
          maxlength="7"
        />
        <button
          class="apply-button"
          on:click={handleCustomInput}
          disabled={!isValidHexColor(customValue.trim())}
        >
          Apply
        </button>
      </div>
    {/if}

    <!-- Preset Colors -->
    {#if showPresets}
      <div class="color-section">
        <div class="section-label">Presets</div>
        <div class="color-grid preset-grid">
          {#each PRESET_COLORS as color}
            <button
              class="color-swatch"
              class:selected={color === value}
              style={getSwatchStyle(color, color === value)}
              on:click={() => selectColor(color)}
              title={color}
              aria-label="Select color {color}"
            />
          {/each}
        </div>
      </div>
    {/if}

    <!-- Recent Colors -->
    {#if showRecent && recentColors.length > 0}
      <div class="color-section">
        <div class="section-label">Recent</div>
        <div class="color-grid recent-grid">
          {#each recentColors as color}
            <button
              class="color-swatch"
              class:selected={color === value}
              style={getSwatchStyle(color, color === value)}
              on:click={() => selectColor(color)}
              title={color}
              aria-label="Select recent color {color}"
            />
          {/each}
        </div>
      </div>
    {/if}

    <!-- Full Color Palette -->
    <div class="color-section">
      <div class="section-label">Palette</div>
      <div class="color-grid palette-grid">
        {#each COLOR_PALETTE as color}
          <button
            class="color-swatch"
            class:selected={color === value}
            style={getSwatchStyle(color, color === value)}
            on:click={() => selectColor(color)}
            title={color}
            aria-label="Select color {color}"
          />
        {/each}
      </div>
    </div>
  </div>
{/if}

<style>
  .color-picker-trigger {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .color-label {
    font-size: 12px;
    font-weight: 500;
    color: #374151;
    white-space: nowrap;
  }

  .color-swatch-button {
    width: 32px;
    height: 24px;
    border-radius: 4px;
    cursor: pointer;
    transition: all 0.15s ease;
    position: relative;
  }

  .color-swatch-button.compact {
    width: 24px;
    height: 20px;
  }

  .color-swatch-button:hover {
    transform: scale(1.05);
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  }

  .color-picker-dropdown {
    position: absolute;
    background: white;
    border: 1px solid #E5E7EB;
    border-radius: 8px;
    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15);
    padding: 12px;
    min-width: 240px;
    z-index: 1000;
  }

  .color-picker-dropdown.compact {
    min-width: 200px;
    padding: 8px;
  }

  .position-below {
    top: 100%;
    margin-top: 4px;
  }

  .position-above {
    bottom: 100%;
    margin-bottom: 4px;
  }

  .position-left {
    right: 100%;
    margin-right: 4px;
    top: 0;
  }

  .position-right {
    left: 100%;
    margin-left: 4px;
    top: 0;
  }

  .color-input-section {
    display: flex;
    gap: 8px;
    margin-bottom: 12px;
    align-items: center;
  }

  .color-input {
    flex: 1;
    padding: 6px 8px;
    border: 1px solid #D1D5DB;
    border-radius: 4px;
    font-size: 12px;
    font-family: monospace;
  }

  .color-input:focus {
    outline: none;
    border-color: #3B82F6;
    box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1);
  }

  .apply-button {
    padding: 6px 12px;
    background: #3B82F6;
    color: white;
    border: none;
    border-radius: 4px;
    font-size: 12px;
    cursor: pointer;
    transition: background 0.15s ease;
  }

  .apply-button:hover:not(:disabled) {
    background: #2563EB;
  }

  .apply-button:disabled {
    background: #9CA3AF;
    cursor: not-allowed;
  }

  .color-section {
    margin-bottom: 12px;
  }

  .color-section:last-child {
    margin-bottom: 0;
  }

  .section-label {
    font-size: 11px;
    font-weight: 500;
    color: #6B7280;
    margin-bottom: 6px;
    text-transform: uppercase;
    letter-spacing: 0.025em;
  }

  .color-grid {
    display: grid;
    gap: 2px;
  }

  .preset-grid {
    grid-template-columns: repeat(6, 1fr);
  }

  .recent-grid {
    grid-template-columns: repeat(6, 1fr);
  }

  .palette-grid {
    grid-template-columns: repeat(10, 1fr);
  }

  .color-swatch {
    width: 20px;
    height: 20px;
    border-radius: 3px;
    cursor: pointer;
    transition: all 0.15s ease;
    position: relative;
  }

  .color-swatch:hover {
    transform: scale(1.1);
    z-index: 1;
  }

  .color-swatch.selected {
    transform: scale(1.1);
    z-index: 1;
  }

  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }

  /* Responsive adjustments */
  @media (max-width: 640px) {
    .color-picker-dropdown {
      min-width: 200px;
    }

    .preset-grid,
    .recent-grid {
      grid-template-columns: repeat(4, 1fr);
    }

    .palette-grid {
      grid-template-columns: repeat(8, 1fr);
    }
  }
</style>