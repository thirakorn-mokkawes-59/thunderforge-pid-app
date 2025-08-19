<script lang="ts">
  import { onMount } from 'svelte';
  
  let symbols: any[] = [];
  let error = '';
  let loading = true;
  
  onMount(async () => {
    console.log('Test page mounted');
    
    // Test 1: Can we fetch an SVG directly?
    try {
      const response = await fetch('/symbols/ISO/PID-ISO-Equipments-Symbols/svg/pid_iso_equipment_000_tank_general_basin.svg');
      console.log('SVG fetch response:', response.status, response.statusText);
      if (!response.ok) {
        error = `SVG fetch failed: ${response.status} ${response.statusText}`;
      } else {
        const text = await response.text();
        console.log('SVG content length:', text.length);
      }
    } catch (e) {
      console.error('SVG fetch error:', e);
      error = `SVG fetch error: ${e}`;
    }
    
    // Test 2: Create simple symbol list
    symbols = [
      {
        name: 'Tank',
        path: '/symbols/ISO/PID-ISO-Equipments-Symbols/svg/pid_iso_equipment_000_tank_general_basin.svg'
      },
      {
        name: 'Pump',
        path: '/symbols/ISO/PID-ISO-Equipments-Symbols/svg/pid_iso_equipment_018_pump.svg'
      },
      {
        name: 'Valve',
        path: '/symbols/ISO/PID-ISO-Valves-Symbols/svg/pid_iso_valves_000_gate_valve.svg'
      }
    ];
    
    loading = false;
  });
</script>

<div style="padding: 20px;">
  <h1>Symbol Loading Test</h1>
  
  {#if error}
    <div style="color: red; padding: 10px; border: 1px solid red;">
      Error: {error}
    </div>
  {/if}
  
  {#if loading}
    <p>Loading...</p>
  {:else}
    <h2>Direct Image Tags:</h2>
    <div style="display: flex; gap: 20px; padding: 10px; border: 1px solid #ccc;">
      {#each symbols as symbol}
        <div style="text-align: center;">
          <img 
            src={symbol.path} 
            alt={symbol.name}
            width="60" 
            height="60"
            style="border: 1px solid #ddd;"
            on:error={(e) => console.error('Image failed:', symbol.path)}
            on:load={() => console.log('Image loaded:', symbol.name)}
          />
          <div>{symbol.name}</div>
        </div>
      {/each}
    </div>
    
    <h2>Object Tag Test:</h2>
    <object 
      data="/symbols/ISO/PID-ISO-Equipments-Symbols/svg/pid_iso_equipment_000_tank_general_basin.svg"
      type="image/svg+xml"
      width="100"
      height="100"
      style="border: 1px solid #ddd;">
      SVG not supported
    </object>
    
    <h2>Console Output:</h2>
    <p>Check browser console (F12) for detailed logs</p>
  {/if}
</div>