<script lang="ts">
  import { diagram } from '$lib/stores/diagram';
  import { toSvg, toPng } from 'html-to-image';
  
  export let show = false;
  export let onClose: () => void;
  
  $: console.log('ExportImportModal show state:', show);
  
  let activeTab: 'export' | 'import' = 'export';
  let exportFormat: 'json' | 'svg' | 'png' = 'json';
  let fileInput: HTMLInputElement;
  
  async function handleExport() {
    const state = $diagram;
    
    // Use diagram name for the filename, sanitize it for file system
    const safeName = state.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const fileName = safeName || 'pid_diagram';
    
    if (exportFormat === 'json') {
      // Export as JSON
      const exportData = {
        version: '1.0',
        timestamp: new Date().toISOString(),
        name: state.name,
        elements: state.elements,
        connections: state.connections,
        elementNameCounts: Array.from(state.elementNameCounts)
      };
      
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${fileName}.json`;
      a.click();
      URL.revokeObjectURL(url);
      
      console.log('Diagram exported as JSON');
      onClose();
    } else if (exportFormat === 'svg' || exportFormat === 'png') {
      // Get the flow container
      const flowContainer = document.querySelector('.svelte-flow');
      if (!flowContainer) {
        console.error('Flow container not found');
        return;
      }
      
      try {
        if (exportFormat === 'svg') {
          const svgData = await toSvg(flowContainer as HTMLElement);
          
          const blob = new Blob([svgData], { type: 'image/svg+xml' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `${fileName}.svg`;
          a.click();
          URL.revokeObjectURL(url);
          
          console.log('Diagram exported as SVG');
        } else {
          const pngData = await toPng(flowContainer as HTMLElement);
          
          const a = document.createElement('a');
          a.href = pngData;
          a.download = `${fileName}.png`;
          a.click();
          
          console.log('Diagram exported as PNG');
        }
        onClose();
      } catch (error) {
        console.error('Export failed:', error);
        alert('Failed to export diagram. Please try again.');
      }
    }
  }
  
  function handleImport() {
    fileInput?.click();
  }
  
  async function handleFileSelect(event: Event) {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];
    
    if (!file) return;
    
    if (!file.name.endsWith('.json')) {
      alert('Please select a JSON file');
      return;
    }
    
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      
      // Validate the imported data
      if (!data.elements || !Array.isArray(data.elements)) {
        throw new Error('Invalid diagram file: missing elements');
      }
      
      // Clear current diagram
      diagram.clear();
      
      // Set diagram name from the saved name or file name
      const diagramName = data.name || file.name.replace('.json', '');
      diagram.setName(diagramName);
      
      // Import elements
      data.elements.forEach((element: any) => {
        diagram.addElement(element);
      });
      
      // Import connections
      if (data.connections && Array.isArray(data.connections)) {
        data.connections.forEach((connection: any) => {
          diagram.addConnection(connection);
        });
      }
      
      console.log(`Diagram "${diagramName}" imported successfully`);
      onClose();
      
      // Trigger fit view after importing
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('fit-view'));
      }, 200);
    } catch (error) {
      console.error('Import failed:', error);
      alert('Failed to import diagram. Please check the file format.');
    }
    
    // Reset file input
    if (target) {
      target.value = '';
    }
  }
  
  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      onClose();
    }
  }
</script>

{#if show}
  <div class="modal-overlay" on:click={onClose} on:keydown={handleKeyDown}>
    <div class="modal-content" on:click|stopPropagation>
      <div class="modal-header">
        <h2>Export/Import Diagram</h2>
        <button class="close-button" on:click={onClose} aria-label="Close">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
      
      <div class="tabs">
        <button 
          class="tab" 
          class:active={activeTab === 'export'}
          on:click={() => activeTab = 'export'}
        >
          Export
        </button>
        <button 
          class="tab" 
          class:active={activeTab === 'import'}
          on:click={() => activeTab = 'import'}
        >
          Import
        </button>
      </div>
      
      <div class="modal-body">
        {#if activeTab === 'export'}
          <div class="export-section">
            <p class="description">Export your diagram in various formats:</p>
            
            <div class="format-options">
              <label class="format-option">
                <input 
                  type="radio" 
                  name="format" 
                  value="json"
                  bind:group={exportFormat}
                />
                <div class="format-info">
                  <strong>JSON</strong>
                  <span>Complete diagram data that can be imported later</span>
                </div>
              </label>
              
              <label class="format-option">
                <input 
                  type="radio" 
                  name="format" 
                  value="svg"
                  bind:group={exportFormat}
                />
                <div class="format-info">
                  <strong>SVG</strong>
                  <span>Vector image for editing in graphics software</span>
                </div>
              </label>
              
              <label class="format-option">
                <input 
                  type="radio" 
                  name="format" 
                  value="png"
                  bind:group={exportFormat}
                />
                <div class="format-info">
                  <strong>PNG</strong>
                  <span>Raster image for documentation and sharing</span>
                </div>
              </label>
            </div>
            
            <button class="action-button primary" on:click={handleExport}>
              Export as {exportFormat.toUpperCase()}
            </button>
          </div>
        {:else}
          <div class="import-section">
            <p class="description">Import a previously saved diagram:</p>
            
            <div class="import-box" on:click={handleImport}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="7 10 12 15 17 10"></polyline>
                <line x1="12" y1="15" x2="12" y2="3"></line>
              </svg>
              <p>Click to select a JSON file</p>
              <span class="file-hint">or drag and drop</span>
            </div>
            
            <input 
              type="file" 
              accept=".json"
              bind:this={fileInput}
              on:change={handleFileSelect}
              style="display: none;"
            />
            
            <div class="warning">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
              </svg>
              <span>Importing will replace the current diagram</span>
            </div>
          </div>
        {/if}
      </div>
    </div>
  </div>
{/if}

<style>
  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
  }
  
  .modal-content {
    background: white;
    border-radius: 8px;
    width: 90%;
    max-width: 500px;
    max-height: 80vh;
    display: flex;
    flex-direction: column;
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
  }
  
  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1.5rem;
    border-bottom: 1px solid #e5e7eb;
  }
  
  .modal-header h2 {
    margin: 0;
    font-size: 1.25rem;
    font-weight: 600;
    color: #111827;
  }
  
  .close-button {
    background: transparent;
    border: none;
    cursor: pointer;
    color: #6b7280;
    padding: 0.25rem;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
    transition: background-color 0.2s;
  }
  
  .close-button:hover {
    background-color: #f3f4f6;
  }
  
  .tabs {
    display: flex;
    border-bottom: 1px solid #e5e7eb;
  }
  
  .tab {
    flex: 1;
    padding: 1rem;
    background: transparent;
    border: none;
    cursor: pointer;
    font-size: 0.875rem;
    font-weight: 500;
    color: #6b7280;
    position: relative;
    transition: color 0.2s;
  }
  
  .tab:hover {
    color: #374151;
  }
  
  .tab.active {
    color: #3b82f6;
  }
  
  .tab.active::after {
    content: '';
    position: absolute;
    bottom: -1px;
    left: 0;
    right: 0;
    height: 2px;
    background: #3b82f6;
  }
  
  .modal-body {
    padding: 1.5rem;
    overflow-y: auto;
  }
  
  .description {
    color: #6b7280;
    margin-bottom: 1.5rem;
  }
  
  .format-options {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    margin-bottom: 1.5rem;
  }
  
  .format-option {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
    padding: 1rem;
    border: 1px solid #e5e7eb;
    border-radius: 6px;
    cursor: pointer;
    transition: border-color 0.2s, background-color 0.2s;
  }
  
  .format-option:hover {
    background-color: #f9fafb;
  }
  
  .format-option:has(input:checked) {
    border-color: #3b82f6;
    background-color: #eff6ff;
  }
  
  .format-option input[type="radio"] {
    margin-top: 2px;
  }
  
  .format-info {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }
  
  .format-info strong {
    color: #111827;
    font-weight: 600;
  }
  
  .format-info span {
    color: #6b7280;
    font-size: 0.875rem;
  }
  
  .import-box {
    border: 2px dashed #d1d5db;
    border-radius: 8px;
    padding: 3rem 2rem;
    text-align: center;
    cursor: pointer;
    transition: border-color 0.2s, background-color 0.2s;
    margin-bottom: 1rem;
  }
  
  .import-box:hover {
    border-color: #9ca3af;
    background-color: #f9fafb;
  }
  
  .import-box svg {
    color: #9ca3af;
    margin: 0 auto 1rem;
  }
  
  .import-box p {
    color: #374151;
    font-weight: 500;
    margin-bottom: 0.5rem;
  }
  
  .file-hint {
    color: #9ca3af;
    font-size: 0.875rem;
  }
  
  .warning {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem;
    background-color: #fef3c7;
    border-radius: 6px;
    margin-top: 1rem;
  }
  
  .warning svg {
    color: #f59e0b;
    flex-shrink: 0;
  }
  
  .warning span {
    color: #92400e;
    font-size: 0.875rem;
  }
  
  .action-button {
    width: 100%;
    padding: 0.75rem 1rem;
    border-radius: 6px;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
    border: none;
  }
  
  .action-button.primary {
    background-color: #3b82f6;
    color: white;
  }
  
  .action-button.primary:hover {
    background-color: #2563eb;
  }
</style>