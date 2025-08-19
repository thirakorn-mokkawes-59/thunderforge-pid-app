<script lang="ts">
  import { onMount } from 'svelte';
  import { allSymbols } from '$lib/data/allSymbols';
  
  let searchQuery = '';
  let selectedCategory = 'all';
  let selectedStandard = 'all';
  let filteredSymbols = [];
  
  function filterSymbols() {
    filteredSymbols = allSymbols.filter(symbol => {
      const matchesSearch = !searchQuery || 
        symbol.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = selectedCategory === 'all' || 
        symbol.category === selectedCategory;
      const matchesStandard = selectedStandard === 'all' || 
        symbol.standard === selectedStandard;
      
      return matchesSearch && matchesCategory && matchesStandard;
    });
  }
  
  function handleDragStart(event, symbol) {
    event.dataTransfer.effectAllowed = 'copy';
    // Create element data that matches what Canvas expects
    const elementData = {
      id: `element_${Date.now()}`,
      symbolId: symbol.id,
      symbolPath: symbol.path,  // This is what we have from allSymbols
      name: symbol.name,
      x: 0,
      y: 0,
      width: 60,
      height: 60,
      rotation: 0
    };
    
    // Set the data
    event.dataTransfer.setData('application/json', JSON.stringify(elementData));
    event.dataTransfer.setData('text/plain', symbol.name);
  }
  
  onMount(() => {
    filterSymbols();
  });
  
  // React to changes in search and filters
  $: searchQuery, selectedCategory, selectedStandard, filterSymbols();
</script>

<div class="symbol-library">
  <div class="library-header">
    <div class="library-title">
      <h3>Symbols</h3>
      <span class="symbol-count">({filteredSymbols.length}/{allSymbols.length})</span>
    </div>
    
    <div class="filters">
      <input 
        type="text" 
        bind:value={searchQuery} 
        placeholder="Search symbols..."
        class="search-input"
      />
      
      <select bind:value={selectedStandard} class="filter-select">
        <option value="all">All Standards</option>
        <option value="ISO">ISO</option>
        <option value="PIP">PIP</option>
      </select>
      
      <select bind:value={selectedCategory} class="filter-select">
        <option value="all">All Categories</option>
        <option value="equipment">Equipment</option>
        <option value="valves">Valves</option>
        <option value="instruments">Instruments</option>
        <option value="fittings">Fittings</option>
        <option value="pipes">Pipes & Signals</option>
      </select>
    </div>
  </div>
  
  <div class="symbol-grid">
    {#if filteredSymbols.length === 0}
      <div class="no-symbols">
        <p>No symbols found</p>
        <p class="hint">Try adjusting your filters</p>
      </div>
    {:else}
      {#each filteredSymbols as symbol (symbol.id)}
        <div 
          class="symbol-item"
          draggable="true"
          on:dragstart={(e) => handleDragStart(e, symbol)}
          title="{symbol.name} ({symbol.standard})"
        >
          <span class="symbol-badge {symbol.standard.toLowerCase()}">{symbol.standard}</span>
          <div class="symbol-image">
            <img 
              src={symbol.path} 
              alt={symbol.name}
              loading="lazy"
            />
          </div>
          <div class="symbol-info">
            <span class="symbol-name">{symbol.name}</span>
          </div>
        </div>
      {/each}
    {/if}
  </div>
</div>

<style>
  .symbol-library {
    width: 320px;
    height: 100%;
    background: #ffffff;
    border-right: 1px solid #e5e7eb;
    display: flex;
    flex-direction: column;
  }
  
  .library-header {
    padding: 1rem;
    border-bottom: 1px solid #e5e7eb;
    background: #f9fafb;
  }
  
  .library-title {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
  }
  
  .library-header h3 {
    margin: 0;
    font-size: 1.125rem;
    font-weight: 600;
    color: #111827;
  }
  
  .symbol-count {
    font-weight: 400;
    color: #6b7280;
    font-size: 0.875rem;
  }
  
  .filters {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  
  .search-input, .filter-select {
    width: 100%;
    padding: 0.5rem;
    border: 1px solid #d1d5db;
    border-radius: 0.375rem;
    font-size: 0.875rem;
  }
  
  .filter-select {
    background: white;
  }
  
  .symbol-grid {
    flex: 1;
    overflow-y: auto;
    padding: 0.75rem;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(85px, 1fr));
    gap: 0.625rem;
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
    border-radius: 0.5rem;
    cursor: move;
    transition: all 0.2s;
    background: white;
    min-height: 95px;
    position: relative;
  }
  
  .symbol-item:hover {
    border-color: #3b82f6;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
    transform: translateY(-2px);
  }
  
  .symbol-item:active {
    transform: scale(0.95);
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
    gap: 0.125rem;
  }
  
  .symbol-name {
    font-size: 0.65rem;
    font-weight: 500;
    text-align: center;
    overflow: hidden;
    text-overflow: ellipsis;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    line-height: 1.1;
    width: 100%;
    color: #374151;
  }
  
  .symbol-badge {
    position: absolute;
    top: 0;
    left: 0;
    font-size: 0.55rem;
    padding: 0.125rem 0.25rem;
    border-radius: 0.5rem 0 0.25rem 0;
    font-weight: 600;
    text-transform: uppercase;
    z-index: 1;
  }
  
  .symbol-badge.iso {
    background: #dbeafe;
    color: #1e40af;
  }
  
  .symbol-badge.pip {
    background: #dcfce7;
    color: #166534;
  }
  
  .hint {
    font-size: 0.875rem;
    color: #9ca3af;
  }
  
  /* Scrollbar */
  .symbol-grid::-webkit-scrollbar {
    width: 6px;
  }
  
  .symbol-grid::-webkit-scrollbar-track {
    background: #f3f4f6;
  }
  
  .symbol-grid::-webkit-scrollbar-thumb {
    background: #d1d5db;
    border-radius: 3px;
  }
  
  .symbol-grid::-webkit-scrollbar-thumb:hover {
    background: #9ca3af;
  }
</style>