<script lang="ts">
  import { onMount } from 'svelte';
  import { parseConnectionPoints } from '$lib/utils/connectionPointParser';

  let svgContent = '';
  let connectionPoints: any[] = [];
  let error = '';

  async function testConnectionPointParsing() {
    try {
      // Test with a known symbol file
      const response = await fetch('/symbols/ISO/PID-ISO-Equipments-Symbols/svg/pid_iso_equipment_000_tank_general_basin.svg');
      svgContent = await response.text();
      
      console.log('SVG Content loaded:', svgContent.length, 'chars');
      
      const result = parseConnectionPoints(svgContent);
      connectionPoints = result.connectionPoints;
      
      console.log('Connection points found:', connectionPoints);
      
    } catch (e) {
      error = e.message;
      console.error('Error:', e);
    }
  }

  onMount(() => {
    testConnectionPointParsing();
  });
</script>

<h1>Connection Point Test</h1>

{#if error}
  <div style="color: red;">Error: {error}</div>
{/if}

<div style="display: flex; gap: 20px;">
  <div style="flex: 1;">
    <h2>SVG Content ({svgContent.length} chars)</h2>
    <textarea value={svgContent} readonly style="width: 100%; height: 200px;"></textarea>
  </div>
  
  <div style="flex: 1;">
    <h2>Connection Points ({connectionPoints.length})</h2>
    <div style="background: #f5f5f5; padding: 10px; height: 200px; overflow: auto;">
      {#each connectionPoints as point, i}
        <div style="margin-bottom: 10px; padding: 5px; background: white; border-radius: 4px;">
          <strong>Point {i + 1}:</strong><br>
          Position: ({point.x}, {point.y})<br>
          Type: {point.type}<br>
          Color: {point.color}<br>
          Direction: {point.direction}
        </div>
      {/each}
      
      {#if connectionPoints.length === 0}
        <div style="color: #666;">No connection points detected</div>
      {/if}
    </div>
  </div>
</div>

{#if svgContent}
  <div style="margin-top: 20px;">
    <h2>SVG Preview</h2>
    <div style="border: 1px solid #ddd; padding: 10px; background: white;">
      {@html svgContent}
    </div>
  </div>
{/if}