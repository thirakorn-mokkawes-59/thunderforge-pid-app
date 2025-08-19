<script lang="ts">
  import { onMount } from 'svelte';
  import { symbols } from '$lib/stores/symbols';
  // import { symbolsSimple as symbols } from '$lib/stores/symbols-simple';
  import { SymbolCategory, SymbolStandard } from '$lib/types/symbol';
  import type { Symbol } from '$lib/types/symbol';
  
  let searchQuery = '';
  let selectedCategory: SymbolCategory | 'all' = SymbolCategory.Equipment;
  let selectedStandard: SymbolStandard | 'all' = 'all';
  let filteredSymbols: Symbol[] = [];
  let isLoading = true;
  let loadError = '';
  
  onMount(async () => {
    console.log('SymbolLibrary mounted, loading symbols...');
    try {
      await symbols.loadSymbols();
      console.log('Symbols loaded successfully');
      isLoading = false;
    } catch (error) {
      console.error('Error loading symbols:', error);
      loadError = 'Failed to load symbols';
      isLoading = false;
    }
  });
  
  $: {
    // Filter symbols based on search and selections
    if ($symbols && $symbols.length > 0) {
      console.log('Filtering symbols, total:', $symbols.length);
      filteredSymbols = $symbols.filter(symbol => {
        const matchesSearch = !searchQuery || 
          symbol.name.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesCategory = selectedCategory === 'all' || 
          symbol.category === selectedCategory;
        const matchesStandard = selectedStandard === 'all' || 
          symbol.standard === selectedStandard;
        
        return matchesSearch && matchesCategory && matchesStandard;
      });
      console.log('Filtered symbols:', filteredSymbols.length);
    } else {
      filteredSymbols = [];
    }
  }
  
  function handleDragStart(event: DragEvent, symbol: Symbol) {
    event.dataTransfer!.effectAllowed = 'copy';
    event.dataTransfer!.setData('application/json', JSON.stringify(symbol));
    
    // Don't set a custom drag image - let the browser handle it
    // The actual symbol image will be shown
  }
  
  function getCategoryLabel(category: SymbolCategory): string {
    switch(category) {
      case SymbolCategory.Equipment: return 'Equipment';
      case SymbolCategory.Valves: return 'Valves';
      case SymbolCategory.Instruments: return 'Instruments';
      case SymbolCategory.Fittings: return 'Fittings';
      case SymbolCategory.PipesAndSignals: return 'Pipes & Signals';
      default: return category;
    }
  }
  
  function clearFilters() {
    searchQuery = '';
    selectedCategory = 'all';
    selectedStandard = 'all';
  }
</script>

<div class="symbol-library">
  <div class="library-header">
    <h3>Symbol Library</h3>
    
    <div class="filters">
      <input 
        type="text" 
        bind:value={searchQuery} 
        placeholder="Search symbols..."
        class="search-input"
      />
      
      <select bind:value={selectedStandard} class="filter-select">
        <option value="all">All Standards</option>
        <option value={SymbolStandard.ISO}>ISO</option>
        <option value={SymbolStandard.PIP}>PIP</option>
      </select>
      
      <select bind:value={selectedCategory} class="filter-select">
        <option value="all">All Categories</option>
        <option value={SymbolCategory.Equipment}>Equipment</option>
        <option value={SymbolCategory.Valves}>Valves</option>
        <option value={SymbolCategory.Instruments}>Instruments</option>
        <option value={SymbolCategory.Fittings}>Fittings</option>
        <option value={SymbolCategory.PipesAndSignals}>Pipes & Signals</option>
      </select>
      
      <button class="clear-filter-btn" on:click={clearFilters} title="Clear all filters">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
        Clear Filters
      </button>
    </div>
  </div>
  
  <div class="symbol-grid">
    {#if filteredSymbols.length === 0}
      <div class="no-symbols">
        {#if $symbols.length === 0}
          <p>Loading symbols...</p>
          <p class="hint">Initializing symbol library</p>
        {:else}
          <p>No symbols found</p>
          <p class="hint">Try adjusting your filters</p>
        {/if}
      </div>
    {:else}
      {#each filteredSymbols as symbol (symbol.id)}
        <div 
          class="symbol-item"
          draggable="true"
          on:dragstart={(e) => handleDragStart(e, symbol)}
          title={symbol.name}
        >
          <div class="symbol-image">
            <img 
              src={symbol.svgPath} 
              alt={symbol.name}
              on:error={(e) => {
                console.error('Failed to load symbol:', symbol.svgPath);
                e.currentTarget.style.display = 'none';
              }}
              on:load={() => {
                console.log('Loaded symbol:', symbol.name);
              }}
            />
          </div>
          <div class="symbol-info">
            <span class="symbol-name">{symbol.name}</span>
            <span class="symbol-category">{getCategoryLabel(symbol.category)}</span>
          </div>
        </div>
      {/each}
    {/if}
  </div>
</div>

<style>
  .symbol-library {
    width: 300px;
    height: 100%;
    background: #ffffff;
    border-right: 1px solid #e5e7eb;
    display: flex;
    flex-direction: column;
  }
  
  .library-header {
    padding: 1rem;
    border-bottom: 1px solid #e5e7eb;
  }
  
  .library-header h3 {
    margin: 0 0 1rem 0;
    font-size: 1.125rem;
    font-weight: 600;
  }
  
  .filters {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  
  .search-input {
    width: 100%;
    padding: 0.5rem;
    border: 1px solid #d1d5db;
    border-radius: 0.375rem;
    font-size: 0.875rem;
  }
  
  .search-input:focus {
    outline: none;
    border-color: #3b82f6;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
  }
  
  .filter-select {
    width: 100%;
    padding: 0.5rem;
    border: 1px solid #d1d5db;
    border-radius: 0.375rem;
    font-size: 0.875rem;
    background: white;
  }
  
  .filter-select:focus {
    outline: none;
    border-color: #3b82f6;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
  }
  
  .clear-filter-btn {
    width: 100%;
    padding: 0.5rem 0.75rem;
    margin-top: 0.5rem;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    background: linear-gradient(135deg, #ffffff 0%, #f9fafb 100%);
    border: 1px solid #e5e7eb;
    border-radius: 0.375rem;
    font-size: 0.875rem;
    color: #6b7280;
    cursor: pointer;
    transition: all 0.2s;
  }
  
  .clear-filter-btn:hover {
    background: linear-gradient(135deg, #f9fafb 0%, #f3f4f6 100%);
    border-color: #d1d5db;
    color: #374151;
    transform: translateY(-1px);
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
  }
  
  .clear-filter-btn:active {
    transform: translateY(0);
  }
  
  .clear-filter-btn svg {
    width: 14px;
    height: 14px;
  }
  
  .symbol-grid {
    flex: 1;
    overflow-y: auto;
    padding: 1rem;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
    gap: 0.75rem;
  }
  
  .no-symbols {
    grid-column: 1 / -1;
    text-align: center;
    color: #6b7280;
    padding: 2rem;
  }
  
  .symbol-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 0.5rem;
    border: 1px solid #e5e7eb;
    border-radius: 0.375rem;
    cursor: move;
    transition: all 0.2s;
    background: white;
  }
  
  .symbol-item:hover {
    border-color: #3b82f6;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    transform: translateY(-2px);
  }
  
  .symbol-item:active {
    transform: translateY(0);
  }
  
  .symbol-image {
    width: 50px;
    height: 50px;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 0.25rem;
  }
  
  .symbol-image img {
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;
  }
  
  .symbol-info {
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 100%;
  }
  
  .symbol-name {
    font-size: 0.75rem;
    font-weight: 500;
    text-align: center;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    width: 100%;
  }
  
  .symbol-category {
    font-size: 0.625rem;
    color: #6b7280;
    margin-top: 0.125rem;
  }
</style>