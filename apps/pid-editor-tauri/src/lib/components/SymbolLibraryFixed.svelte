<script lang="ts">
  import { onMount } from 'svelte';
  
  // Define symbols directly here - no complex stores
  let allSymbols = [
    // Equipment symbols
    { id: 'eq1', name: 'Tank Basin', category: 'equipment', standard: 'ISO', path: '/symbols/ISO/PID-ISO-Equipments-Symbols/svg/pid_iso_equipment_000_tank_general_basin.svg' },
    { id: 'eq2', name: 'Tank Floating', category: 'equipment', standard: 'ISO', path: '/symbols/ISO/PID-ISO-Equipments-Symbols/svg/pid_iso_equipment_001_tank_floating_roof.svg' },
    { id: 'eq3', name: 'Vessel Column', category: 'equipment', standard: 'ISO', path: '/symbols/ISO/PID-ISO-Equipments-Symbols/svg/pid_iso_equipment_002_vessel_general_column.svg' },
    { id: 'eq4', name: 'Vessel General', category: 'equipment', standard: 'ISO', path: '/symbols/ISO/PID-ISO-Equipments-Symbols/svg/pid_iso_equipment_003_vessel_general.svg' },
    { id: 'eq5', name: 'Pump', category: 'equipment', standard: 'ISO', path: '/symbols/ISO/PID-ISO-Equipments-Symbols/svg/pid_iso_equipment_018_pump.svg' },
    { id: 'eq6', name: 'Compressor', category: 'equipment', standard: 'ISO', path: '/symbols/ISO/PID-ISO-Equipments-Symbols/svg/pid_iso_equipment_019_compressor.svg' },
    { id: 'eq7', name: 'Heat Exchanger', category: 'equipment', standard: 'ISO', path: '/symbols/ISO/PID-ISO-Equipments-Symbols/svg/pid_iso_equipment_021_heat_exchanger_general_1.svg' },
    
    // Valve symbols
    { id: 'v1', name: 'Gate Valve', category: 'valves', standard: 'ISO', path: '/symbols/ISO/PID-ISO-Valves-Symbols/svg/pid_iso_valves_000_gate_valve.svg' },
    { id: 'v2', name: 'Globe Valve', category: 'valves', standard: 'ISO', path: '/symbols/ISO/PID-ISO-Valves-Symbols/svg/pid_iso_valves_001_globe_valve.svg' },
    { id: 'v3', name: 'Ball Valve', category: 'valves', standard: 'ISO', path: '/symbols/ISO/PID-ISO-Valves-Symbols/svg/pid_iso_valves_002_ball_valve.svg' },
    { id: 'v4', name: 'Butterfly Valve', category: 'valves', standard: 'ISO', path: '/symbols/ISO/PID-ISO-Valves-Symbols/svg/pid_iso_valves_003_butterfly_valve.svg' },
    { id: 'v5', name: 'Check Valve', category: 'valves', standard: 'ISO', path: '/symbols/ISO/PID-ISO-Valves-Symbols/svg/pid_iso_valves_004_check_valve.svg' },
    
    // Instrument symbols
    { id: 'i1', name: 'Indicator', category: 'instruments', standard: 'ISO', path: '/symbols/ISO/PID-ISO-Instruments-Symbols/svg/pid_iso_instruments_000_indicator_circle_with_horizontal_lines.svg' },
    { id: 'i2', name: 'Controller', category: 'instruments', standard: 'ISO', path: '/symbols/ISO/PID-ISO-Instruments-Symbols/svg/pid_iso_instruments_001_controller_square_circle_with_lines.svg' },
    
    // Fitting symbols
    { id: 'f1', name: 'Reducer', category: 'fittings', standard: 'ISO', path: '/symbols/ISO/PID-ISO-Fittings-Symbols/svg/pid_iso_fittings_000_reducer_concentric.svg' },
    { id: 'f2', name: 'T-Joint', category: 'fittings', standard: 'ISO', path: '/symbols/ISO/PID-ISO-Fittings-Symbols/svg/pid_iso_fittings_004_t_joint_horizontal.svg' },
  ];
  
  let searchQuery = '';
  let selectedCategory = 'all';
  let selectedStandard = 'ISO';
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
    event.dataTransfer.effectAllowed = 'copy';
    event.dataTransfer.setData('application/json', JSON.stringify({
      id: `element_${Date.now()}`,
      symbolId: symbol.id,
      symbolPath: symbol.path,
      name: symbol.name,
      x: 0,
      y: 0,
      width: 60,
      height: 60,
      rotation: 0
    }));
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
    <h3>Symbol Library</h3>
    
    <div class="filters">
      <input 
        type="text" 
        bind:value={searchQuery} 
        placeholder="Search symbols..."
        class="search-input"
        on:input={filterSymbols}
      />
      
      <select bind:value={selectedStandard} on:change={filterSymbols} class="filter-select">
        <option value="ISO">ISO</option>
        <option value="PIP">PIP</option>
        <option value="all">All Standards</option>
      </select>
      
      <select bind:value={selectedCategory} on:change={filterSymbols} class="filter-select">
        <option value="all">All Categories</option>
        <option value="equipment">Equipment</option>
        <option value="valves">Valves</option>
        <option value="instruments">Instruments</option>
        <option value="fittings">Fittings</option>
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
      {#each filteredSymbols as symbol}
        <div 
          class="symbol-item"
          draggable="true"
          on:dragstart={(e) => handleDragStart(e, symbol)}
          title={symbol.name}
        >
          <div class="symbol-image">
            {#if imagesLoaded}
              <img 
                src={symbol.path} 
                alt={symbol.name}
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
  
  .filter-select {
    width: 100%;
    padding: 0.5rem;
    border: 1px solid #d1d5db;
    border-radius: 0.375rem;
    font-size: 0.875rem;
    background: white;
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
  
  .loading-placeholder {
    width: 40px;
    height: 40px;
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
  
  .hint {
    font-size: 0.875rem;
    color: #9ca3af;
  }
</style>