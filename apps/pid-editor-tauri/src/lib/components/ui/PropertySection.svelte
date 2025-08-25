<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import { slide } from 'svelte/transition';
  import type { PropertySectionProps } from '$lib/types/components';

  export let title: string = '';
  export let expanded: boolean = true;
  export let icon: string = '';
  export let collapsible: boolean = true;
  export let headerClass: string = '';
  export let contentClass: string = '';

  const dispatch = createEventDispatcher<{
    toggle: boolean;
    expand: void;
    collapse: void;
  }>();

  function toggle() {
    if (!collapsible) return;
    
    expanded = !expanded;
    dispatch('toggle', expanded);
    
    if (expanded) {
      dispatch('expand');
    } else {
      dispatch('collapse');
    }
  }

  function handleKeydown(event: KeyboardEvent) {
    if (!collapsible) return;
    
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      toggle();
    }
  }
</script>

<div class="property-section" class:expanded class:collapsible>
  <div
    class="section-header {headerClass}"
    class:clickable={collapsible}
    role={collapsible ? 'button' : undefined}
    tabindex={collapsible ? 0 : undefined}
    aria-expanded={collapsible ? expanded : undefined}
    on:click={toggle}
    on:keydown={handleKeydown}
  >
    <div class="header-content">
      {#if icon}
        <span class="section-icon" aria-hidden="true">{icon}</span>
      {/if}
      <h3 class="section-title">{title}</h3>
    </div>
    
    {#if collapsible}
      <div class="expand-indicator" class:expanded aria-hidden="true">
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path
            d="M4.5 3L7.5 6L4.5 9"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      </div>
    {/if}
  </div>

  {#if expanded}
    <div
      class="section-content {contentClass}"
      transition:slide={{ duration: 200 }}
    >
      <slot />
    </div>
  {/if}
</div>

<style>
  .property-section {
    border: 1px solid #E5E7EB;
    border-radius: 8px;
    background: white;
    overflow: hidden;
    transition: all 0.15s ease;
  }

  .property-section:hover {
    border-color: #D1D5DB;
  }

  .property-section.expanded {
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  }

  .section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    background: #F9FAFB;
    border-bottom: 1px solid transparent;
    transition: all 0.15s ease;
  }

  .section-header.clickable {
    cursor: pointer;
    user-select: none;
  }

  .section-header.clickable:hover {
    background: #F3F4F6;
  }

  .section-header.clickable:focus {
    outline: none;
    background: #F3F4F6;
    box-shadow: inset 0 0 0 2px rgba(59, 130, 246, 0.2);
  }

  .expanded .section-header {
    border-bottom-color: #E5E7EB;
  }

  .header-content {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .section-icon {
    font-size: 14px;
  }

  .section-title {
    margin: 0;
    font-size: 13px;
    font-weight: 600;
    color: #374151;
    letter-spacing: 0.025em;
  }

  .expand-indicator {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    color: #9CA3AF;
    transition: all 0.2s ease;
  }

  .expand-indicator.expanded {
    transform: rotate(90deg);
    color: #6B7280;
  }

  .section-content {
    padding: 16px;
  }

  /* Accessibility improvements */
  @media (prefers-reduced-motion: reduce) {
    .expand-indicator {
      transition: none;
    }
    
    .property-section,
    .section-header {
      transition: none;
    }
  }

  /* Focus styles for better keyboard navigation */
  .section-header.clickable:focus-visible {
    outline: 2px solid #3B82F6;
    outline-offset: -2px;
  }
</style>