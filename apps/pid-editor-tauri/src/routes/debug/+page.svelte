<script lang="ts">
  import { onMount } from 'svelte';
  import { allSymbols } from '$lib/data/allSymbols';
  import { diagram } from '$lib/stores/diagram';
  
  let dragResult = '';
  let dropResult = '';
  let storeElements = [];
  
  // Subscribe to diagram store
  $: storeElements = $diagram.elements;
  
  // Test with first equipment symbol
  const testSymbol = allSymbols.find(s => s.category === 'equipment') || allSymbols[0];
  
  function handleDragStart(event) {
    const dragData = {
      id: `element_${Date.now()}`,
      symbolId: testSymbol.id,
      symbolPath: testSymbol.path,
      name: testSymbol.name,
      x: 100,
      y: 100,
      width: 60,
      height: 60,
      rotation: 0
    };
    
    dragResult = `Dragging: ${JSON.stringify(dragData, null, 2)}`;
    event.dataTransfer.effectAllowed = 'copy';
    event.dataTransfer.setData('application/json', JSON.stringify(dragData));
  }
  
  function handleDragOver(event) {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
  }
  
  function handleDrop(event) {
    event.preventDefault();
    const data = event.dataTransfer.getData('application/json');
    dropResult = `Dropped: ${data}`;
    
    if (data) {
      const element = JSON.parse(data);
      diagram.addElement(element);
    }
  }
  
  function testDirectAdd() {
    const element = {
      id: `element_${Date.now()}`,
      symbolId: testSymbol.id,
      symbolPath: testSymbol.path,
      name: testSymbol.name,
      x: 200,
      y: 200,
      width: 60,
      height: 60,
      rotation: 0
    };
    
    console.log('Direct adding:', element);
    diagram.addElement(element);
  }
  
  async function testFetch() {
    const response = await fetch(testSymbol.path);
    const text = await response.text();
    return `Fetch ${testSymbol.path}: ${response.status} - ${text.substring(0, 100)}...`;
  }
  
  let fetchResult = '';
  
  onMount(async () => {
    fetchResult = await testFetch();
  });
</script>

<div style="padding: 20px; font-family: monospace;">
  <h1>Drag & Drop Debug Page</h1>
  
  <div style="margin: 20px 0; padding: 20px; border: 2px solid #333;">
    <h2>Test Symbol:</h2>
    <pre>{JSON.stringify(testSymbol, null, 2)}</pre>
  </div>
  
  <div style="display: flex; gap: 20px;">
    <div style="flex: 1;">
      <h3>Drag Source</h3>
      <div 
        draggable="true"
        on:dragstart={handleDragStart}
        style="width: 100px; height: 100px; border: 2px solid blue; display: flex; align-items: center; justify-content: center; cursor: move; background: #e0e0ff;"
      >
        Drag Me
      </div>
      <pre>{dragResult}</pre>
    </div>
    
    <div style="flex: 1;">
      <h3>Drop Target</h3>
      <div 
        on:dragover={handleDragOver}
        on:drop={handleDrop}
        style="width: 200px; height: 200px; border: 2px dashed green; display: flex; align-items: center; justify-content: center; background: #e0ffe0;"
      >
        Drop Here
      </div>
      <pre>{dropResult}</pre>
    </div>
  </div>
  
  <div style="margin: 20px 0;">
    <h3>Direct Test</h3>
    <button on:click={testDirectAdd} style="padding: 10px; font-size: 16px;">
      Add Element Directly to Store
    </button>
  </div>
  
  <div style="margin: 20px 0;">
    <h3>Fetch Test</h3>
    <pre>{fetchResult}</pre>
  </div>
  
  <div style="margin: 20px 0;">
    <h3>Store Elements ({storeElements.length}):</h3>
    <pre>{JSON.stringify(storeElements, null, 2)}</pre>
  </div>
</div>