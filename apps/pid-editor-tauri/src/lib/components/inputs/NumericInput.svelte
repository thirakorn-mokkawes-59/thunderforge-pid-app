<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { NumericInputProps } from '$lib/types/components';

  export let value: number = 0;
  export let min: number | undefined = undefined;
  export let max: number | undefined = undefined;
  export let step: number = 1;
  export let unit: string = '';
  export let label: string = '';
  export let placeholder: string = '';
  export let validator: ((value: number) => string | null) | undefined = undefined;
  export let disabled: boolean = false;

  let inputValue = String(value);
  let error: string | null = null;
  let focused = false;

  const dispatch = createEventDispatcher<{
    change: number;
    input: number;
  }>();

  $: inputValue = String(value);

  function handleInput(event: Event) {
    const target = event.target as HTMLInputElement;
    inputValue = target.value;
    
    const numValue = parseFloat(inputValue);
    if (!isNaN(numValue)) {
      validateAndDispatch(numValue, 'input');
    }
  }

  function handleBlur() {
    focused = false;
    const numValue = parseFloat(inputValue);
    
    if (isNaN(numValue)) {
      inputValue = String(value); // Reset to last valid value
      error = null;
      return;
    }

    validateAndDispatch(numValue, 'change');
  }

  function handleFocus() {
    focused = true;
    error = null;
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      event.preventDefault();
      (event.target as HTMLInputElement).blur();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      inputValue = String(value); // Reset to original value
      error = null;
      (event.target as HTMLInputElement).blur();
    } else if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      event.preventDefault();
      const currentValue = parseFloat(inputValue) || 0;
      const increment = event.shiftKey ? step * 10 : step;
      const newValue = event.key === 'ArrowUp' ? currentValue + increment : currentValue - increment;
      validateAndDispatch(newValue, 'change');
    }
  }

  function validateAndDispatch(numValue: number, eventType: 'input' | 'change') {
    // Apply min/max constraints
    let clampedValue = numValue;
    if (min !== undefined) clampedValue = Math.max(min, clampedValue);
    if (max !== undefined) clampedValue = Math.min(max, clampedValue);

    // Custom validation
    if (validator) {
      error = validator(clampedValue);
      if (error && eventType === 'change') {
        return; // Don't dispatch if validation fails on blur
      }
    } else {
      error = null;
    }

    // Update input value if clamped
    if (clampedValue !== numValue) {
      inputValue = String(clampedValue);
    }

    dispatch(eventType, clampedValue);
  }

  function increment() {
    const currentValue = parseFloat(inputValue) || 0;
    validateAndDispatch(currentValue + step, 'change');
  }

  function decrement() {
    const currentValue = parseFloat(inputValue) || 0;
    validateAndDispatch(currentValue - step, 'change');
  }
</script>

<div class="numeric-input-container">
  {#if label}
    <label class="input-label" for="numeric-input-{label}">
      {label}
    </label>
  {/if}
  
  <div class="input-wrapper" class:focused class:error class:disabled>
    <input
      id="numeric-input-{label}"
      type="number"
      bind:value={inputValue}
      {min}
      {max}
      {step}
      {placeholder}
      {disabled}
      class="numeric-input"
      on:input={handleInput}
      on:blur={handleBlur}
      on:focus={handleFocus}
      on:keydown={handleKeydown}
    />
    
    {#if unit}
      <span class="unit">{unit}</span>
    {/if}

    <div class="stepper-buttons">
      <button
        type="button"
        class="stepper-button up"
        {disabled}
        on:click={increment}
        aria-label="Increase value"
      >
        ▲
      </button>
      <button
        type="button"
        class="stepper-button down"
        {disabled}
        on:click={decrement}
        aria-label="Decrease value"
      >
        ▼
      </button>
    </div>
  </div>

  {#if error}
    <div class="error-message" role="alert">
      {error}
    </div>
  {/if}
</div>

<style>
  .numeric-input-container {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .input-label {
    font-size: 12px;
    font-weight: 500;
    color: #374151;
    white-space: nowrap;
  }

  .input-wrapper {
    position: relative;
    display: flex;
    align-items: center;
    border: 1px solid #D1D5DB;
    border-radius: 6px;
    background: white;
    transition: all 0.15s ease;
  }

  .input-wrapper:hover:not(.disabled) {
    border-color: #9CA3AF;
  }

  .input-wrapper.focused {
    border-color: #3B82F6;
    box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1);
  }

  .input-wrapper.error {
    border-color: #EF4444;
    box-shadow: 0 0 0 2px rgba(239, 68, 68, 0.1);
  }

  .input-wrapper.disabled {
    background: #F9FAFB;
    border-color: #E5E7EB;
    opacity: 0.6;
  }

  .numeric-input {
    flex: 1;
    padding: 6px 8px;
    border: none;
    outline: none;
    background: transparent;
    font-size: 12px;
    color: #111827;
    width: 0; /* Prevent flex overflow */
  }

  .numeric-input:disabled {
    cursor: not-allowed;
  }

  .unit {
    padding-right: 8px;
    font-size: 11px;
    color: #6B7280;
    white-space: nowrap;
  }

  .stepper-buttons {
    display: flex;
    flex-direction: column;
    border-left: 1px solid #E5E7EB;
  }

  .stepper-button {
    width: 20px;
    height: 12px;
    border: none;
    background: transparent;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 8px;
    color: #6B7280;
    transition: all 0.15s ease;
  }

  .stepper-button:hover:not(:disabled) {
    background: #F3F4F6;
    color: #374151;
  }

  .stepper-button:active:not(:disabled) {
    background: #E5E7EB;
  }

  .stepper-button:disabled {
    cursor: not-allowed;
    opacity: 0.4;
  }

  .stepper-button.up {
    border-bottom: 1px solid #E5E7EB;
    border-top-right-radius: 5px;
  }

  .stepper-button.down {
    border-bottom-right-radius: 5px;
  }

  .error-message {
    font-size: 11px;
    color: #EF4444;
    margin-top: 2px;
  }

  /* Hide browser's number input spinners */
  .numeric-input::-webkit-outer-spin-button,
  .numeric-input::-webkit-inner-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }

  .numeric-input[type=number] {
    -moz-appearance: textfield;
  }
</style>