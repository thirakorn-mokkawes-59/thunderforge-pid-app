<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import ColorPicker from '../ColorPicker.svelte';
  import NumericInput from '../inputs/NumericInput.svelte';
  import SelectInput from '../inputs/SelectInput.svelte';
  import PropertySection from '../ui/PropertySection.svelte';
  import type { DiagramElement } from '$lib/types/diagram';
  import { ValidationUtils } from '$lib/utils/domUtils';

  export let element: DiagramElement;
  export let expanded: boolean = true;

  const dispatch = createEventDispatcher<{
    update: { property: string; value: any };
  }>();

  // Style options
  const strokeLinecapOptions = [
    { value: 'butt', label: 'Butt' },
    { value: 'round', label: 'Round' },
    { value: 'square', label: 'Square' }
  ];

  const strokeWeightOptions = [
    { value: 'normal', label: 'Normal' },
    { value: 'bold', label: 'Bold' },
    { value: '100', label: 'Thin' },
    { value: '300', label: 'Light' },
    { value: '500', label: 'Medium' },
    { value: '600', label: 'Semi Bold' },
    { value: '700', label: 'Bold' },
    { value: '800', label: 'Extra Bold' },
    { value: '900', label: 'Black' }
  ];

  const strokeStyleOptions = [
    { value: 'normal', label: 'Normal' },
    { value: 'italic', label: 'Italic' },
    { value: 'oblique', label: 'Oblique' }
  ];

  // Color picker states
  let showColorPicker = false;
  let showLabelColorPicker = false;
  let showLabelBgPicker = false;
  let showTagColorPicker = false;
  let showTagBgPicker = false;

  function updateProperty(property: string, value: any) {
    dispatch('update', { property, value });
  }

  function handleColorChange(property: string, color: string) {
    updateProperty(property, color);
    // Close the color picker
    showColorPicker = showLabelColorPicker = showLabelBgPicker = showTagColorPicker = showTagBgPicker = false;
  }

  function handleOpacityChange(value: number) {
    const clampedValue = Math.max(0, Math.min(1, value));
    updateProperty('opacity', clampedValue);
  }

  function handleStrokeWidthChange(value: number) {
    const clampedValue = Math.max(0.1, Math.min(10, value));
    updateProperty('strokeWidth', clampedValue);
  }

  // Validation functions
  function validateOpacity(value: number): string | null {
    if (!ValidationUtils.isValidNumber(value)) return 'Must be a number';
    if (!ValidationUtils.isInRange(value, 0, 1)) return 'Must be between 0 and 1';
    return null;
  }

  function validateStrokeWidth(value: number): string | null {
    if (!ValidationUtils.isValidPositiveNumber(value)) return 'Must be a positive number';
    if (value > 10) return 'Maximum value is 10';
    return null;
  }
</script>

<PropertySection 
  title="Style" 
  bind:expanded 
  icon="🎨"
>
  <div class="style-controls">
    <!-- Element Color -->
    <div class="control-group">
      <ColorPicker
        label="Color"
        value={element.color || '#000000'}
        bind:isOpen={showColorPicker}
        on:change={(e) => handleColorChange('color', e.detail)}
      />
    </div>

    <!-- Opacity -->
    <div class="control-group">
      <NumericInput
        label="Opacity"
        value={element.opacity || 1}
        min={0}
        max={1}
        step={0.1}
        unit=""
        validator={validateOpacity}
        on:change={(e) => handleOpacityChange(e.detail)}
      />
    </div>

    <!-- Stroke Width -->
    <div class="control-group">
      <NumericInput
        label="Stroke Width"
        value={element.strokeWidth || 1}
        min={0.1}
        max={10}
        step={0.1}
        unit="px"
        validator={validateStrokeWidth}
        on:change={(e) => handleStrokeWidthChange(e.detail)}
      />
    </div>

    <!-- Stroke Linecap -->
    <div class="control-group">
      <SelectInput
        label="Line End"
        value={element.strokeLinecap || 'butt'}
        options={strokeLinecapOptions}
        on:change={(e) => updateProperty('strokeLinecap', e.detail)}
      />
    </div>

    <!-- Label Styling -->
    {#if element.showLabel !== false}
      <div class="subsection">
        <div class="subsection-title">Label</div>
        
        <div class="control-group">
          <ColorPicker
            label="Text Color"
            value={element.labelFontColor || '#666666'}
            bind:isOpen={showLabelColorPicker}
            compact
            on:change={(e) => handleColorChange('labelFontColor', e.detail)}
          />
        </div>

        <div class="control-group">
          <ColorPicker
            label="Background"
            value={element.labelBgColor || 'rgba(255, 255, 255, 0.9)'}
            bind:isOpen={showLabelBgPicker}
            compact
            on:change={(e) => handleColorChange('labelBgColor', e.detail)}
          />
        </div>

        <div class="control-group">
          <NumericInput
            label="Font Size"
            value={element.labelFontSize || 10}
            min={6}
            max={24}
            step={1}
            unit="px"
            on:change={(e) => updateProperty('labelFontSize', e.detail)}
          />
        </div>

        <div class="control-group">
          <SelectInput
            label="Font Weight"
            value={element.labelFontWeight || 'normal'}
            options={strokeWeightOptions}
            on:change={(e) => updateProperty('labelFontWeight', e.detail)}
          />
        </div>

        <div class="control-group">
          <SelectInput
            label="Font Style"
            value={element.labelFontStyle || 'normal'}
            options={strokeStyleOptions}
            on:change={(e) => updateProperty('labelFontStyle', e.detail)}
          />
        </div>
      </div>
    {/if}

    <!-- Tag Styling -->
    {#if element.showTag !== false && element.tag}
      <div class="subsection">
        <div class="subsection-title">Tag</div>
        
        <div class="control-group">
          <ColorPicker
            label="Text Color"
            value={element.tagFontColor || '#666666'}
            bind:isOpen={showTagColorPicker}
            compact
            on:change={(e) => handleColorChange('tagFontColor', e.detail)}
          />
        </div>

        <div class="control-group">
          <ColorPicker
            label="Background"
            value={element.tagBgColor || 'rgba(255, 255, 255, 0.9)'}
            bind:isOpen={showTagBgPicker}
            compact
            on:change={(e) => handleColorChange('tagBgColor', e.detail)}
          />
        </div>

        <div class="control-group">
          <NumericInput
            label="Font Size"
            value={element.tagFontSize || 10}
            min={6}
            max={24}
            step={1}
            unit="px"
            on:change={(e) => updateProperty('tagFontSize', e.detail)}
          />
        </div>

        <div class="control-group">
          <SelectInput
            label="Font Weight"
            value={element.tagFontWeight || 'normal'}
            options={strokeWeightOptions}
            on:change={(e) => updateProperty('tagFontWeight', e.detail)}
          />
        </div>

        <div class="control-group">
          <SelectInput
            label="Font Style"
            value={element.tagFontStyle || 'normal'}
            options={strokeStyleOptions}
            on:change={(e) => updateProperty('tagFontStyle', e.detail)}
          />
        </div>
      </div>
    {/if}
  </div>
</PropertySection>

<style>
  .style-controls {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .control-group {
    display: flex;
    align-items: center;
    justify-content: space-between;
    min-height: 28px;
  }

  .subsection {
    border-top: 1px solid #E5E7EB;
    padding-top: 12px;
    margin-top: 8px;
  }

  .subsection-title {
    font-size: 11px;
    font-weight: 600;
    color: #6B7280;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-bottom: 12px;
  }

  /* Responsive adjustments */
  @media (max-width: 640px) {
    .control-group {
      flex-direction: column;
      align-items: stretch;
      gap: 4px;
    }
  }
</style>