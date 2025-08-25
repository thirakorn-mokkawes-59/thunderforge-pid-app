<script lang="ts">
  import { onMount } from 'svelte';
  import { allSymbols } from '$lib/data/allSymbols';
  
  let searchQuery = '';
  let selectedCategory = 'all';
  let selectedStandard = 'all';
  let filteredSymbols = [];
  let imagesLoaded = false;
  
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
    const dragData = {
      id: `element_${Date.now()}`,
      symbolId: symbol.id,
      symbolPath: symbol.path,
      name: symbol.name,
      x: 0,
      y: 0,
      width: 60,
      height: 60,
      rotation: 0
    };
    console.log('Starting drag with data:', dragData);
    event.dataTransfer.effectAllowed = 'copy';
    event.dataTransfer.setData('application/json', JSON.stringify(dragData));
  }
  
  onMount(() => {
    filterSymbols();
    setTimeout(() => {
      imagesLoaded = true;
    }, 100);
  });
  
  $: {
    filterSymbols();
  }
</script>

<div class="symbol-library">
  <div class="library-header">
    <h3>Symbol Library ({filteredSymbols.length}/{allSymbols.length})</h3>
    
    <div class="filters">
      <input 
        type="text" 
        bind:value={searchQuery} 
        placeholder="Search symbols..."
        class="search-input"
        on:input={filterSymbols}
      />
      
      <select bind:value={selectedStandard} on:change={filterSymbols} class="filter-select">
        <option value="all">All Standards</option>
        <option value="ISO">ISO ({allSymbols.filter(s => s.standard === 'ISO').length})</option>
        <option value="PIP">PIP ({allSymbols.filter(s => s.standard === 'PIP').length})</option>
      </select>
      
      <select bind:value={selectedCategory} on:change={filterSymbols} class="filter-select">
        <option value="all">All Categories</option>
        <option value="equipment">Equipment</option>
        <option value="valves">Valves</option>
        <option value="instruments">Instruments</option>
        <option value="fittings">Fittings</option>
        <option value="pipes">Pipes & Signals</option>
      </select>
    </div>
    
    <div class="stats">
      <span class="stat-item">{selectedStandard === 'all' ? 'All' : selectedStandard}</span>
      <span class="stat-item">{selectedCategory === 'all' ? 'All' : selectedCategory}</span>
    </div>
  </div>
  
  <div class="symbol-grid">
    {#if filteredSymbols.length === 0}
      <div class="no-symbols">
        <p>No symbols found</p>
        <p class="hint">Try adjusting your filters</p>
      </div>
    {:else}
      {#each filteredSymbols as symbol}
        <div 
          class="symbol-item"
          draggable="true"
          on:dragstart={(e) => handleDragStart(e, symbol)}
          title="{symbol.name} ({symbol.standard})"
        >
          <div class="symbol-image">
            {#if imagesLoaded}
              <img 
                src={symbol.path} 
                alt={symbol.name}
                loading="lazy"
                on:error={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
            {:else}
              <div class="loading-placeholder">...</div>
            {/if}
          </div>
          <div class="symbol-info">
            <span class="symbol-name">{symbol.name}</span>
            <span class="symbol-badge {symbol.standard.toLowerCase()}">{symbol.standard}</span>
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
  
  .library-header h3 {
    margin: 0 0 1rem 0;
    font-size: 1.125rem;
    font-weight: 600;
    color: #111827;
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
  
  .stats {
    display: flex;
    gap: 0.5rem;
    margin-top: 0.75rem;
  }
  
  .stat-item {
    padding: 0.25rem 0.5rem;
    background: #e5e7eb;
    border-radius: 0.25rem;
    font-size: 0.75rem;
    font-weight: 500;
    color: #4b5563;
  }
  
  .symbol-grid {
    flex: 1;
    overflow-y: auto;
    padding: 0.75rem;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(90px, 1fr));
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
    padding: 0.625rem 0.375rem;
    border: 1px solid #e5e7eb;
    border-radius: 0.5rem;
    cursor: move;
    transition: all 0.2s;
    background: white;
    min-height: 100px;
  }
  
  .symbol-item:hover {
    border-color: #3b82f6;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
    transform: translateY(-2px);
  }
  
  .symbol-image {
    width: 55px;
    height: 55px;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 0.375rem;
  }
  
  .symbol-image img {
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;
  }
  
  .loading-placeholder {
    width: 45px;
    height: 45px;
    background: #f3f4f6;
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #9ca3af;
  }
  
  .symbol-info {
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 100%;
    gap: 0.25rem;
  }
  
  .symbol-name {
    font-size: 0.7rem;
    font-weight: 500;
    text-align: center;
    overflow: hidden;
    text-overflow: ellipsis;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    line-height: 1.2;
    width: 100%;
    color: #374151;
  }
  
  .symbol-badge {
    font-size: 0.625rem;
    padding: 0.125rem 0.375rem;
    border-radius: 0.25rem;
    font-weight: 600;
    text-transform: uppercase;
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
  
  /* Scrollbar styling */
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