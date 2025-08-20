<script lang="ts">
  import { onDestroy } from 'svelte';
  import { diagram } from '$lib/stores/diagram';
  import Icon from './Icon.svelte';
  import { Save, FolderOpen, Image, FileCode, RotateCcw } from '$lib/icons';
  
  // Save diagram to JSON file
  function saveDiagram() {
    const state = $diagram;
    const data = {
      version: '1.0',
      created: new Date().toISOString(),
      elements: state.elements,
      connections: state.connections,
      settings: {
        showGrid: state.showGrid,
        snapToGrid: state.snapToGrid,
        gridSize: state.gridSize
      }
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pid-diagram-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    console.log('Diagram saved');
  }
  
  // Load diagram from JSON file
  function loadDiagram() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e: Event) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const data = JSON.parse(event.target?.result as string);
          
          // Clear current diagram
          diagram.clear();
          
          // Load elements
          if (data.elements) {
            data.elements.forEach(element => {
              diagram.addElement(element);
            });
          }
          
          // Load connections
          if (data.connections) {
            data.connections.forEach(connection => {
              diagram.addConnection(connection);
            });
          }
          
          // Load settings
          if (data.settings?.showGrid !== undefined) {
            diagram.toggleGrid();
          }
          if (data.settings?.snapToGrid !== undefined) {
            diagram.toggleSnapToGrid();
          }
          
          console.log('Diagram loaded successfully');
          
          // Trigger fit view after loading
          setTimeout(() => {
            window.dispatchEvent(new CustomEvent('fit-view'));
          }, 200);
        } catch (error) {
          console.error('Failed to load diagram:', error);
          alert('Failed to load diagram file. Please check the file format.');
        }
      };
      reader.readAsText(file);
    };
    input.click();
  }
  
  // Export canvas as PNG
  function exportAsPNG() {
    const canvas = document.querySelector('.diagram-canvas') as SVGElement;
    if (!canvas) return;
    
    const svgData = new XMLSerializer().serializeToString(canvas);
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);
    
    const img = new Image();
    img.onload = () => {
      const canvas2d = document.createElement('canvas');
      canvas2d.width = img.width;
      canvas2d.height = img.height;
      const ctx = canvas2d.getContext('2d');
      if (!ctx) return;
      
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, canvas2d.width, canvas2d.height);
      ctx.drawImage(img, 0, 0);
      
      canvas2d.toBlob((blob) => {
        if (!blob) return;
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `pid-diagram-${Date.now()}.png`;
        a.click();
      });
    };
    img.src = url;
  }
  
  // Export as SVG
  function exportAsSVG() {
    const canvas = document.querySelector('.diagram-canvas') as SVGElement;
    if (!canvas) return;
    
    const svgData = new XMLSerializer().serializeToString(canvas);
    const blob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pid-diagram-${Date.now()}.svg`;
    a.click();
  }
  
  // Auto-save to localStorage
  function autoSave() {
    const state = $diagram;
    localStorage.setItem('pid-editor-autosave', JSON.stringify({
      timestamp: new Date().toISOString(),
      elements: state.elements,
      connections: state.connections
    }));
    console.log('Auto-saved to browser storage');
  }
  
  // Load auto-save
  function loadAutoSave() {
    const saved = localStorage.getItem('pid-editor-autosave');
    if (saved) {
      try {
        const data = JSON.parse(saved);
        if (confirm(`Load auto-saved diagram from ${new Date(data.timestamp).toLocaleString()}?`)) {
          diagram.clear();
          data.elements?.forEach(el => diagram.addElement(el));
          data.connections?.forEach(conn => diagram.addConnection(conn));
        }
      } catch (e) {
        console.error('Failed to load auto-save:', e);
      }
    }
  }
  
  // Auto-save every 30 seconds
  const autoSaveInterval = setInterval(autoSave, 30000);
  
  // Cleanup interval on component destroy
  onDestroy(() => {
    clearInterval(autoSaveInterval);
  });
</script>

<div class="file-operations">
  <button on:click={saveDiagram} title="Save Diagram (Ctrl+S)" aria-label="Save diagram">
    <Icon title="Save">
      <Save size={14} strokeWidth={2} />
    </Icon>
    Save
  </button>
  <button on:click={loadDiagram} title="Load Diagram (Ctrl+O)" aria-label="Load diagram">
    <Icon title="Load">
      <FolderOpen size={14} strokeWidth={2} />
    </Icon>
    Load
  </button>
  <button on:click={exportAsPNG} title="Export as PNG" aria-label="Export as PNG image">
    <Icon title="Export PNG">
      <Image size={14} strokeWidth={2} />
    </Icon>
    PNG
  </button>
  <button on:click={exportAsSVG} title="Export as SVG" aria-label="Export as SVG vector">
    <Icon title="Export SVG">
      <FileCode size={14} strokeWidth={2} />
    </Icon>
    SVG
  </button>
  <button on:click={loadAutoSave} title="Load Auto-save" aria-label="Restore from auto-save">
    <Icon title="Restore">
      <RotateCcw size={14} strokeWidth={2} />
    </Icon>
    Restore
  </button>
</div>

<style>
  .file-operations {
    display: flex;
    gap: 0.25rem;
  }
  
  button {
    background: transparent;
    border: none;
    padding: 2px 6px;
    color: #9ca3af;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 0.25rem;
    transition: color 0.2s;
    font-size: 0.75rem;
    border-radius: 3px;
  }
  
  button:hover:not(:disabled) {
    color: #e5e7eb;
    background: rgba(156, 163, 175, 0.1);
  }
  
  button:active,
  button:focus {
    outline: none;
    color: inherit;
  }
  
  button:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }
  
  button svg {
    width: 14px;
    height: 14px;
  }
</style>