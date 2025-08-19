<script lang="ts">
  import SymbolLibrary from '$lib/components/SymbolLibraryAllWorking.svelte';
  // import Canvas from '$lib/components/Canvas.svelte';
  import Canvas from '$lib/components/CanvasFlow.svelte';
  import PropertyPanel from '$lib/components/PropertyPanel.svelte';
  import Toolbar from '$lib/components/Toolbar.svelte';
  import StatusBar from '$lib/components/StatusBar.svelte';
  import { ui } from '$lib/stores/ui';
</script>

<div class="app">
  <Toolbar />
  <div class="main-content">
    {#if $ui.leftPanelVisible}
      <SymbolLibrary />
    {/if}
    <Canvas />
    {#if $ui.rightPanelVisible}
      <PropertyPanel />
    {/if}
  </div>
  <StatusBar />
</div>

<style>
  :global(html, body) {
    margin: 0;
    padding: 0;
    height: 100%;
    overflow: hidden;
    font-family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
  }
  
  :global(*, *::before, *::after) {
    box-sizing: border-box;
  }
  
  .app {
    height: 100vh;
    display: flex;
    flex-direction: column;
    background: #f9fafb;
  }
  
  .main-content {
    flex: 1;
    display: flex;
    overflow: hidden;
  }
</style>