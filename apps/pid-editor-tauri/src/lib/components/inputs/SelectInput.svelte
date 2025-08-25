<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { SelectInputProps } from '$lib/types/components';

  export let value: string = '';
  export let options: Array<{ value: string; label: string; disabled?: boolean }> = [];
  export let label: string = '';
  export let placeholder: string = 'Select...';
  export let disabled: boolean = false;
  export let searchable: boolean = false;
  export let clearable: boolean = false;

  let isOpen = false;
  let searchTerm = '';
  let selectRef: HTMLDivElement;
  let inputRef: HTMLInputElement;

  const dispatch = createEventDispatcher<{
    change: string;
  }>();

  $: filteredOptions = searchable && searchTerm 
    ? options.filter(option => 
        option.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
        option.value.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : options;

  $: selectedOption = options.find(opt => opt.value === value);

  function toggleDropdown() {
    if (disabled) return;
    isOpen = !isOpen;
    if (isOpen && searchable) {
      setTimeout(() => inputRef?.focus(), 50);
    }
  }

  function selectOption(optionValue: string) {
    if (optionValue !== value) {
      dispatch('change', optionValue);
    }
    isOpen = false;
    searchTerm = '';
  }

  function clearSelection() {
    dispatch('change', '');
    isOpen = false;
  }

  function handleKeydown(event: KeyboardEvent) {
    if (disabled) return;

    switch (event.key) {
      case 'Enter':
      case ' ':
        if (!searchable) {
          event.preventDefault();
          toggleDropdown();
        }
        break;
      case 'Escape':
        event.preventDefault();
        isOpen = false;
        searchTerm = '';
        break;
      case 'ArrowDown':
        event.preventDefault();
        if (!isOpen) {
          toggleDropdown();
        } else {
          // Navigate to next option
          const currentIndex = filteredOptions.findIndex(opt => opt.value === value);
          const nextIndex = Math.min(currentIndex + 1, filteredOptions.length - 1);
          if (nextIndex >= 0) {
            selectOption(filteredOptions[nextIndex].value);
          }
        }
        break;
      case 'ArrowUp':
        event.preventDefault();
        if (isOpen) {
          // Navigate to previous option
          const currentIndex = filteredOptions.findIndex(opt => opt.value === value);
          const prevIndex = Math.max(currentIndex - 1, 0);
          if (prevIndex >= 0) {
            selectOption(filteredOptions[prevIndex].value);
          }
        }
        break;
    }
  }

  function handleClickOutside(event: MouseEvent) {
    if (selectRef && !selectRef.contains(event.target as Node)) {
      isOpen = false;
      searchTerm = '';
    }
  }

  // Add click outside listener
  function addClickOutsideListener() {
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }

  $: if (isOpen) addClickOutsideListener();
</script>

<div class="select-input-container">
  {#if label}
    <label class="input-label">
      {label}
    </label>
  {/if}

  <div
    bind:this={selectRef}
    class="select-wrapper"
    class:open={isOpen}
    class:disabled
  >
    <div
      class="select-trigger"
      tabindex={disabled ? -1 : 0}
      role="combobox"
      aria-expanded={isOpen}
      aria-haspopup="listbox"
      on:click={toggleDropdown}
      on:keydown={handleKeydown}
    >
      {#if searchable && isOpen}
        <input
          bind:this={inputRef}
          bind:value={searchTerm}
          class="search-input"
          {placeholder}
          on:keydown={handleKeydown}
        />
      {:else}
        <span class="selected-text" class:placeholder={!selectedOption}>
          {selectedOption?.label || placeholder}
        </span>
      {/if}

      <div class="select-actions">
        {#if clearable && value && !disabled}
          <button
            class="clear-button"
            type="button"
            on:click|stopPropagation={clearSelection}
            aria-label="Clear selection"
          >
            ×
          </button>
        {/if}
        <div class="dropdown-arrow" class:rotated={isOpen}>
          ▼
        </div>
      </div>
    </div>

    {#if isOpen}
      <div class="dropdown-menu" role="listbox">
        {#if filteredOptions.length === 0}
          <div class="no-options">No options available</div>
        {:else}
          {#each filteredOptions as option}
            <button
              class="option"
              class:selected={option.value === value}
              class:disabled={option.disabled}
              disabled={option.disabled}
              role="option"
              aria-selected={option.value === value}
              on:click={() => selectOption(option.value)}
            >
              {option.label}
            </button>
          {/each}
        {/if}
      </div>
    {/if}
  </div>
</div>

<style>
  .select-input-container {
    display: flex;
    flex-direction: column;
    gap: 4px;
    position: relative;
  }

  .input-label {
    font-size: 12px;
    font-weight: 500;
    color: #374151;
    white-space: nowrap;
  }

  .select-wrapper {
    position: relative;
  }

  .select-trigger {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 6px 8px;
    border: 1px solid #D1D5DB;
    border-radius: 6px;
    background: white;
    cursor: pointer;
    transition: all 0.15s ease;
    min-height: 32px;
  }

  .select-wrapper:hover:not(.disabled) .select-trigger {
    border-color: #9CA3AF;
  }

  .select-wrapper.open .select-trigger {
    border-color: #3B82F6;
    box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1);
  }

  .select-wrapper.disabled .select-trigger {
    background: #F9FAFB;
    border-color: #E5E7EB;
    cursor: not-allowed;
    opacity: 0.6;
  }

  .selected-text {
    flex: 1;
    font-size: 12px;
    color: #111827;
    text-align: left;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .selected-text.placeholder {
    color: #9CA3AF;
  }

  .search-input {
    flex: 1;
    border: none;
    outline: none;
    background: transparent;
    font-size: 12px;
    color: #111827;
  }

  .select-actions {
    display: flex;
    align-items: center;
    gap: 4px;
    margin-left: 8px;
  }

  .clear-button {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 16px;
    height: 16px;
    border: none;
    background: transparent;
    border-radius: 2px;
    cursor: pointer;
    font-size: 14px;
    color: #9CA3AF;
    transition: all 0.15s ease;
  }

  .clear-button:hover {
    background: #F3F4F6;
    color: #6B7280;
  }

  .dropdown-arrow {
    font-size: 10px;
    color: #6B7280;
    transition: transform 0.15s ease;
  }

  .dropdown-arrow.rotated {
    transform: rotate(180deg);
  }

  .dropdown-menu {
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    background: white;
    border: 1px solid #D1D5DB;
    border-radius: 6px;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
    z-index: 1000;
    max-height: 200px;
    overflow-y: auto;
    margin-top: 2px;
  }

  .option {
    display: block;
    width: 100%;
    padding: 8px 12px;
    border: none;
    background: transparent;
    text-align: left;
    font-size: 12px;
    color: #111827;
    cursor: pointer;
    transition: background 0.15s ease;
  }

  .option:hover:not(:disabled) {
    background: #F3F4F6;
  }

  .option.selected {
    background: #EFF6FF;
    color: #2563EB;
  }

  .option:disabled {
    color: #9CA3AF;
    cursor: not-allowed;
  }

  .no-options {
    padding: 8px 12px;
    font-size: 12px;
    color: #9CA3AF;
    text-align: center;
  }

  /* Custom scrollbar for dropdown */
  .dropdown-menu::-webkit-scrollbar {
    width: 6px;
  }

  .dropdown-menu::-webkit-scrollbar-track {
    background: #F3F4F6;
  }

  .dropdown-menu::-webkit-scrollbar-thumb {
    background: #D1D5DB;
    border-radius: 3px;
  }

  .dropdown-menu::-webkit-scrollbar-thumb:hover {
    background: #9CA3AF;
  }
</style>