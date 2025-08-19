<script lang="ts">
  import { diagram } from '$lib/stores/diagram';
  import type { DiagramElement } from '$lib/types/diagram';
  import { fade, slide } from 'svelte/transition';
  import { Trash2, Wrench } from 'lucide-svelte';
  
  let selectedElement: DiagramElement | null = null;
  let symbolStandard: string = 'PID';
  let activeTab: 'properties' | 'style' | 'transform' | 'layers' = 'properties';
  let showColorPicker = false;
  let recentColors: string[] = [];
  
  // Preset colors - more refined palette
  const presetColors = [
    '#000000', '#FFFFFF', '#FF0000', '#00FF00', '#0000FF', '#FFFF00',
    '#FF00FF', '#00FFFF', '#FFA500', '#800080', '#FFC0CB', '#A52A2A'
  ];
  
  // Full color palette - organized by hue, dark to light in rows
  const colorPalette = [
    // Row 1: Dark shades
    '#000000', '#7F1D1D', '#7C2D12', '#713F12', '#14532D', '#134E4A', '#1E3A8A', '#312E81', '#581C87', '#831843',
    
    // Row 2: Medium-dark shades
    '#374151', '#991B1B', '#9A3412', '#A16207', '#166534', '#115E59', '#1E40AF', '#3730A3', '#6B21A8', '#9F1239',
    
    // Row 3: Medium shades
    '#6B7280', '#DC2626', '#EA580C', '#EAB308', '#16A34A', '#0D9488', '#2563EB', '#4F46E5', '#9333EA', '#E11D48',
    
    // Row 4: Medium-light shades
    '#9CA3AF', '#EF4444', '#F97316', '#FACC15', '#22C55E', '#14B8A6', '#3B82F6', '#6366F1', '#A855F7', '#F43F5E',
    
    // Row 5: Light shades
    '#D1D5DB', '#F87171', '#FB923C', '#FDE047', '#4ADE80', '#2DD4BF', '#60A5FA', '#818CF8', '#C084FC', '#FB7185',
    
    // Row 6: Pale shades
    '#F3F4F6', '#FCA5A5', '#FDBA74', '#FEF08A', '#86EFAC', '#5EEAD4', '#93C5FD', '#A5B4FC', '#D8B4FE', '#FDA4AF'
  ];
  
  $: {
    // Get the first selected element
    const selectedId = Array.from($diagram.selectedIds)[0];
    selectedElement = selectedId 
      ? $diagram.elements.find(el => el.id === selectedId) || null
      : null;
    
    // Determine the standard (ISO or PIP) from the symbol path
    if (selectedElement && selectedElement.symbolPath) {
      if (selectedElement.symbolPath.includes('/ISO/') || selectedElement.symbolPath.includes('_iso_')) {
        symbolStandard = 'ISO';
      } else if (selectedElement.symbolPath.includes('/PIP/') || selectedElement.symbolPath.includes('_pip_')) {
        symbolStandard = 'PIP';
      } else {
        symbolStandard = 'PID';
      }
    }
  }
  
  function addToRecentColors(color: string) {
    // Don't add if it's already in preset colors
    if (presetColors.includes(color)) return;
    
    // Remove if already exists in recent
    recentColors = recentColors.filter(c => c !== color);
    
    // Add to beginning
    recentColors = [color, ...recentColors];
    
    // Keep only last 6
    if (recentColors.length > 6) {
      recentColors = recentColors.slice(0, 6);
    }
  }

  function updateProperty(property: keyof DiagramElement, value: any) {
    if (selectedElement) {
      // Track color selections
      if (property === 'color' && value) {
        addToRecentColors(value);
      }
      
      // Convert string inputs to numbers where needed
      let processedValue = value;
      if (['x', 'y', 'width', 'height', 'rotation'].includes(property)) {
        processedValue = parseFloat(value) || 0;
      }
      
      // Handle size changes
      if (property === 'width' || property === 'height') {
        const updates = {
          width: processedValue,
          height: processedValue
        };
        
        diagram.updateElement(selectedElement.id, updates);
        
        // Dispatch event to update node size in SvelteFlow
        window.dispatchEvent(new CustomEvent('update-node-size', {
          detail: {
            nodeId: selectedElement.id,
            width: updates.width,
            height: updates.height
          }
        }));
      }
      // For position changes, trigger a node position update event
      else if (property === 'x' || property === 'y') {
        const updates: any = { [property]: processedValue };
        diagram.updateElement(selectedElement.id, updates);
        
        // Dispatch event to update the node position in SvelteFlow
        window.dispatchEvent(new CustomEvent('update-node-position', {
          detail: {
            nodeId: selectedElement.id,
            x: property === 'x' ? processedValue : selectedElement.x,
            y: property === 'y' ? processedValue : selectedElement.y
          }
        }));
      } else {
        diagram.updateElement(selectedElement.id, { [property]: processedValue });
      }
    }
  }
  
  function deleteSelected() {
    if (selectedElement) {
      diagram.removeElement(selectedElement.id);
    }
  }
  
  function duplicateSelected() {
    if (selectedElement) {
      diagram.deselectAll();
      const newElement = {
        ...selectedElement,
        id: `element_${Date.now()}`,
        x: selectedElement.x + 20,
        y: selectedElement.y + 20
      };
      diagram.addElement(newElement);
      diagram.selectElement(newElement.id);
    }
  }
</script>

<div class="property-panel">
  <div class="panel-header">
    <Wrench size={20} />
    <h3>Properties</h3>
  </div>
  
  <div class="panel-content">
    {#if selectedElement}
      <!-- Element Header Card -->
      <div class="element-card" in:fade={{duration: 200}}>
        <div class="element-header">
          <div class="element-badge {symbolStandard.toLowerCase()}">
            {symbolStandard}
          </div>
          <div class="element-details">
            <div class="element-name">{selectedElement.name}</div>
            <div class="element-id">#{selectedElement.id.slice(-8)}</div>
          </div>
        </div>
        
        <!-- Action Bar -->
        <div class="action-bar">
          <button 
            class="action-btn icon-only"
            on:click={duplicateSelected}
            title="Duplicate Element"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
            </svg>
          </button>
          
          <button 
            class="action-btn icon-only"
            class:active={selectedElement.locked}
            on:click={() => updateProperty('locked', !selectedElement.locked)}
            title={selectedElement.locked ? 'Unlock Element' : 'Lock Element'}
          >
            {#if selectedElement.locked}
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                <path d="M7 11V7a5 5 0 0110 0v4"></path>
              </svg>
            {:else}
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                <path d="M7 11V7a5 5 0 019.9-1"></path>
              </svg>
            {/if}
          </button>
          
          <button 
            class="action-btn icon-only delete"
            on:click={deleteSelected}
            title="Delete Element"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>
      
      <!-- Tab Navigation -->
      <div class="tab-nav">
        <button 
          class="tab-btn"
          class:active={activeTab === 'properties'}
          on:click={() => activeTab = 'properties'}
          title="Basic Properties"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M4 7h16M4 12h16M4 17h10"></path>
          </svg>
          <span>Basic</span>
        </button>
        <button 
          class="tab-btn"
          class:active={activeTab === 'style'}
          on:click={() => activeTab = 'style'}
          title="Style & Appearance"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"></circle>
            <path d="M8 14s1.5 2 4 2 4-2 4-2"></path>
            <line x1="9" y1="9" x2="9.01" y2="9"></line>
            <line x1="15" y1="9" x2="15.01" y2="9"></line>
          </svg>
          <span>Style</span>
        </button>
        <button 
          class="tab-btn"
          class:active={activeTab === 'transform'}
          on:click={() => activeTab = 'transform'}
          title="Transform & Rotation"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="5 9 2 12 5 15"></polyline>
            <polyline points="9 5 12 2 15 5"></polyline>
            <polyline points="15 19 12 22 9 19"></polyline>
            <polyline points="19 9 22 12 19 15"></polyline>
          </svg>
          <span>Transform</span>
        </button>
        <button 
          class="tab-btn"
          class:active={activeTab === 'layers'}
          on:click={() => activeTab = 'layers'}
          title="Layer Ordering"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polygon points="12 2 2 7 12 12 22 7 12 2"></polygon>
            <polyline points="2 17 12 22 22 17"></polyline>
            <polyline points="2 12 12 17 22 12"></polyline>
          </svg>
          <span>Layers</span>
        </button>
      </div>
      
      <!-- Tab Content -->
      <div class="tab-content-wrapper">
        {#if activeTab === 'properties'}
          <div class="tab-pane" in:slide={{duration: 200}}>
            <div class="input-group">
              <label>
                <span class="label-text">Label</span>
                <input 
                  type="text" 
                  value={selectedElement.name}
                  on:input={(e) => updateProperty('name', e.currentTarget.value)}
                  placeholder="Enter label text"
                />
              </label>
            </div>
            
            <div class="input-group">
              <label>
                <span class="label-text">Tag Number</span>
                <input 
                  type="text" 
                  value={selectedElement.tag || ''}
                  on:input={(e) => updateProperty('tag', e.currentTarget.value)}
                  placeholder="e.g., V-101, P-201"
                />
              </label>
            </div>
            
            <div class="input-group {!selectedElement.tag ? 'disabled' : ''}">
              <span class="label-text">Tag Style</span>
              <div class="tag-style-buttons">
                <button 
                  class="style-option-btn"
                  class:active={!selectedElement.tagStyle || selectedElement.tagStyle === 'badge'}
                  on:click={() => selectedElement.tag && updateProperty('tagStyle', 'badge')}
                  disabled={!selectedElement.tag}
                  title="Badge Style"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="3" y="9" width="18" height="6" rx="3"/>
                    <text x="12" y="13" text-anchor="middle" font-size="8" fill="currentColor">TAG</text>
                  </svg>
                  Badge
                </button>
                <button 
                  class="style-option-btn"
                  class:active={selectedElement.tagStyle === 'simple'}
                  on:click={() => selectedElement.tag && updateProperty('tagStyle', 'simple')}
                  disabled={!selectedElement.tag}
                  title="Simple Text"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="4" y1="12" x2="20" y2="12"/>
                    <text x="12" y="11" text-anchor="middle" font-size="10" fill="currentColor">Aa</text>
                  </svg>
                  Simple
                </button>
              </div>
            </div>
            
            <div class="input-group {!selectedElement.tag ? 'disabled' : ''}">
              <span class="label-text">Tag Position</span>
              <div class="tag-position-buttons">
                <button 
                  class="position-btn"
                  class:active={!selectedElement.tagPosition || selectedElement.tagPosition === 'below'}
                  on:click={() => selectedElement.tag && updateProperty('tagPosition', 'below')}
                  disabled={!selectedElement.tag}
                  title="Below"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="8" y="8" width="8" height="8" rx="1"/>
                    <line x1="12" y1="18" x2="12" y2="20"/>
                  </svg>
                  Below
                </button>
                <button 
                  class="position-btn"
                  class:active={selectedElement.tagPosition === 'above'}
                  on:click={() => selectedElement.tag && updateProperty('tagPosition', 'above')}
                  disabled={!selectedElement.tag}
                  title="Above"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="8" y="8" width="8" height="8" rx="1"/>
                    <line x1="12" y1="6" x2="12" y2="4"/>
                  </svg>
                  Above
                </button>
                <button 
                  class="position-btn"
                  class:active={selectedElement.tagPosition === 'left'}
                  on:click={() => selectedElement.tag && updateProperty('tagPosition', 'left')}
                  disabled={!selectedElement.tag}
                  title="Left"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="8" y="8" width="8" height="8" rx="1"/>
                    <line x1="6" y1="12" x2="4" y2="12"/>
                  </svg>
                  Left
                </button>
                <button 
                  class="position-btn"
                  class:active={selectedElement.tagPosition === 'right'}
                  on:click={() => selectedElement.tag && updateProperty('tagPosition', 'right')}
                  disabled={!selectedElement.tag}
                  title="Right"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="8" y="8" width="8" height="8" rx="1"/>
                    <line x1="18" y1="12" x2="20" y2="12"/>
                  </svg>
                  Right
                </button>
              </div>
            </div>
            
            <div class="input-row">
              <div class="input-group">
                <label>
                  <span class="label-text">X Position</span>
                  <div class="position-input-wrapper">
                    <input 
                      type="number" 
                      value={Math.round(selectedElement.x)}
                      on:input={(e) => updateProperty('x', e.currentTarget.value)}
                      class="position-input"
                    />
                    <span class="position-unit">px</span>
                  </div>
                </label>
              </div>
              
              <div class="input-group">
                <label>
                  <span class="label-text">Y Position</span>
                  <div class="position-input-wrapper">
                    <input 
                      type="number" 
                      value={Math.round(selectedElement.y)}
                      on:input={(e) => updateProperty('y', e.currentTarget.value)}
                      class="position-input"
                    />
                    <span class="position-unit">px</span>
                  </div>
                </label>
              </div>
            </div>
            
            <div class="checkbox-group">
              <label class="checkbox-label">
                <input 
                  type="checkbox" 
                  checked={selectedElement.showLabel !== false}
                  on:change={(e) => updateProperty('showLabel', e.currentTarget.checked)}
                />
                <span>Show Label</span>
              </label>
              {#if selectedElement.tag}
                <label class="checkbox-label">
                  <input 
                    type="checkbox" 
                    checked={selectedElement.showTag !== false}
                    on:change={(e) => updateProperty('showTag', e.currentTarget.checked)}
                  />
                  <span>Show Tag</span>
                </label>
              {/if}
            </div>
          </div>
        {/if}
        
        {#if activeTab === 'style'}
          <div class="tab-pane" in:slide={{duration: 200}}>
            <!-- Size Control -->
            <div class="control-section">
              <div class="section-header">
                <span class="section-title">Size</span>
                <span class="section-value">{selectedElement.width}px</span>
              </div>
              
              <div class="size-presets">
                <button 
                  class="preset-btn"
                  class:active={selectedElement.width === 30}
                  on:click={() => updateProperty('width', 30)}
                >
                  XS
                </button>
                <button 
                  class="preset-btn"
                  class:active={selectedElement.width === 40}
                  on:click={() => updateProperty('width', 40)}
                >
                  S
                </button>
                <button 
                  class="preset-btn"
                  class:active={selectedElement.width === 60}
                  on:click={() => updateProperty('width', 60)}
                >
                  M
                </button>
                <button 
                  class="preset-btn"
                  class:active={selectedElement.width === 80}
                  on:click={() => updateProperty('width', 80)}
                >
                  L
                </button>
                <button 
                  class="preset-btn"
                  class:active={selectedElement.width === 120}
                  on:click={() => updateProperty('width', 120)}
                >
                  XL
                </button>
              </div>
              
              <input 
                type="range" 
                class="slider"
                min="10" 
                max="2000"
                value={selectedElement.width}
                on:input={(e) => updateProperty('width', e.currentTarget.value)}
              />
            </div>
            
            <!-- Color Control -->
            <div class="control-section">
              <div class="section-header">
                <span class="section-title">Color</span>
              </div>
              
              <div class="color-presets">
                {#each presetColors as color}
                  <button
                    class="color-btn"
                    class:active={selectedElement.color === color || (!selectedElement.color && color === '#000000')}
                    style="background-color: {color}"
                    on:click={() => updateProperty('color', color)}
                    title={color}
                  >
                    {#if selectedElement.color === color || (!selectedElement.color && color === '#000000')}
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M5 12l5 5L20 7"></path>
                      </svg>
                    {/if}
                  </button>
                {/each}
                <button
                  class="color-btn more"
                  on:click={() => showColorPicker = !showColorPicker}
                  title="More colors"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="2"></circle>
                    <circle cx="12" cy="4" r="2"></circle>
                    <circle cx="12" cy="20" r="2"></circle>
                  </svg>
                </button>
              </div>
              
              {#if recentColors.length > 0}
                <div class="recent-colors-section">
                  <span class="recent-label">Recent</span>
                  <div class="recent-colors">
                    {#each recentColors as color}
                      <button
                        class="color-btn"
                        class:active={selectedElement.color === color}
                        style="background-color: {color}"
                        on:click={() => updateProperty('color', color)}
                        title={color}
                      >
                        {#if selectedElement.color === color}
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M5 12l5 5L20 7"></path>
                          </svg>
                        {/if}
                      </button>
                    {/each}
                  </div>
                </div>
              {/if}
              
              {#if showColorPicker}
                <div class="color-grid" in:slide={{duration: 200}}>
                  {#each colorPalette as color}
                    <button
                      class="color-grid-btn"
                      style="background-color: {color}"
                      on:click={() => {
                        updateProperty('color', color);
                        showColorPicker = false;
                      }}
                      title={color}
                    ></button>
                  {/each}
                </div>
              {/if}
            </div>
            
            <!-- Opacity Control -->
            <div class="control-section">
              <div class="section-header">
                <span class="section-title">Opacity</span>
                <span class="section-value">{Math.round((selectedElement.opacity || 1) * 100)}%</span>
              </div>
              
              <input 
                type="range" 
                class="slider"
                min="0" 
                max="1"
                step="0.05"
                value={selectedElement.opacity || 1}
                on:input={(e) => updateProperty('opacity', parseFloat(e.currentTarget.value))}
              />
            </div>
            
            <!-- Stroke Width Control -->
            <div class="control-section">
              <div class="section-header">
                <span class="section-title">Line Weight</span>
                <span class="section-value">{selectedElement.strokeWidth || 0.5}px</span>
              </div>
              
              <input 
                type="range" 
                class="slider"
                min="0.1" 
                max="5" 
                step="0.1"
                value={selectedElement.strokeWidth || 0.5}
                on:input={(e) => updateProperty('strokeWidth', parseFloat(e.currentTarget.value))}
              />
              
              <div class="stroke-presets">
                <button 
                  class="preset-btn small"
                  class:active={selectedElement.strokeWidth === 0.5 || !selectedElement.strokeWidth}
                  on:click={() => updateProperty('strokeWidth', 0.5)}
                >
                  Thin
                </button>
                <button 
                  class="preset-btn small"
                  class:active={selectedElement.strokeWidth === 1}
                  on:click={() => updateProperty('strokeWidth', 1)}
                >
                  Normal
                </button>
                <button 
                  class="preset-btn small"
                  class:active={selectedElement.strokeWidth === 2}
                  on:click={() => updateProperty('strokeWidth', 2)}
                >
                  Bold
                </button>
                <button 
                  class="preset-btn small"
                  class:active={selectedElement.strokeWidth === 3}
                  on:click={() => updateProperty('strokeWidth', 3)}
                >
                  Heavy
                </button>
              </div>
            </div>
            
            <!-- Line Cap Style Control -->
            <div class="control-section">
              <div class="section-header">
                <span class="section-title">Line Cap Style</span>
              </div>
              
              <div class="linecap-options">
                <button 
                  class="style-option-btn"
                  class:active={!selectedElement.strokeLinecap || selectedElement.strokeLinecap === 'butt'}
                  on:click={() => updateProperty('strokeLinecap', 'butt')}
                  title="Flat line endings"
                >
                  <svg width="40" height="20" viewBox="0 0 40 20">
                    <line x1="5" y1="10" x2="35" y2="10" stroke="currentColor" stroke-width="3" stroke-linecap="butt"/>
                  </svg>
                  <span>Flat</span>
                </button>
                <button 
                  class="style-option-btn"
                  class:active={selectedElement.strokeLinecap === 'round'}
                  on:click={() => updateProperty('strokeLinecap', 'round')}
                  title="Rounded line endings"
                >
                  <svg width="40" height="20" viewBox="0 0 40 20">
                    <line x1="5" y1="10" x2="35" y2="10" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>
                  </svg>
                  <span>Round</span>
                </button>
              </div>
            </div>
          </div>
        {/if}
        
        {#if activeTab === 'transform'}
          <div class="tab-pane" in:slide={{duration: 200}}>
            <!-- Rotation Control -->
            <div class="control-section">
              <div class="section-header">
                <span class="section-title">Rotation</span>
                <span class="section-value">{selectedElement.rotation || 0}°</span>
              </div>
              
              <div class="rotation-presets">
                <button 
                  class="preset-btn"
                  class:active={selectedElement.rotation === 0}
                  on:click={() => updateProperty('rotation', 0)}
                >
                  0°
                </button>
                <button 
                  class="preset-btn"
                  class:active={selectedElement.rotation === 45}
                  on:click={() => updateProperty('rotation', 45)}
                >
                  45°
                </button>
                <button 
                  class="preset-btn"
                  class:active={selectedElement.rotation === 90}
                  on:click={() => updateProperty('rotation', 90)}
                >
                  90°
                </button>
                <button 
                  class="preset-btn"
                  class:active={selectedElement.rotation === 180}
                  on:click={() => updateProperty('rotation', 180)}
                >
                  180°
                </button>
                <button 
                  class="preset-btn"
                  class:active={selectedElement.rotation === 270}
                  on:click={() => updateProperty('rotation', 270)}
                >
                  270°
                </button>
              </div>
              
              <input 
                type="range" 
                class="slider"
                min="0" 
                max="360"
                step="15"
                value={selectedElement.rotation || 0}
                on:input={(e) => updateProperty('rotation', e.currentTarget.value)}
              />
            </div>
            
            <!-- Flip Controls -->
            <div class="control-section">
              <div class="section-header">
                <span class="section-title">Flip</span>
              </div>
              
              <div class="flip-controls">
                <button 
                  class="flip-btn"
                  class:active={selectedElement.flipX}
                  on:click={() => updateProperty('flipX', !selectedElement.flipX)}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M21 12H3M21 12L15 6M21 12L15 18M3 12L9 6M3 12L9 18"/>
                  </svg>
                  <span>Horizontal</span>
                </button>
                <button 
                  class="flip-btn"
                  class:active={selectedElement.flipY}
                  on:click={() => updateProperty('flipY', !selectedElement.flipY)}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M12 3V21M12 3L6 9M12 3L18 9M12 21L6 15M12 21L18 15"/>
                  </svg>
                  <span>Vertical</span>
                </button>
              </div>
            </div>
          </div>
        {/if}
        
        {#if activeTab === 'layers'}
          <div class="tab-pane" in:slide={{duration: 200}}>
            <div class="layer-controls">
              <button 
                class="layer-btn"
                on:click={() => diagram.bringToFront(selectedElement.id)}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="8" y="8" width="13" height="13" rx="1"/>
                  <path d="M4 16V6a2 2 0 012-2h10" opacity="0.5"/>
                </svg>
                <span>Bring to Front</span>
              </button>
              
              <button 
                class="layer-btn"
                on:click={() => diagram.bringForward(selectedElement.id)}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M12 2l7 7-7 7-7-7z"/>
                  <path d="M12 12l7 7-7 7-7-7z" opacity="0.5"/>
                </svg>
                <span>Bring Forward</span>
              </button>
              
              <button 
                class="layer-btn"
                on:click={() => diagram.sendBackward(selectedElement.id)}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M12 12l7 7-7 7-7-7z"/>
                  <path d="M12 2l7 7-7 7-7-7z" opacity="0.5"/>
                </svg>
                <span>Send Backward</span>
              </button>
              
              <button 
                class="layer-btn"
                on:click={() => diagram.sendToBack(selectedElement.id)}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="3" y="3" width="13" height="13" rx="1" opacity="0.5"/>
                  <rect x="8" y="8" width="13" height="13" rx="1"/>
                </svg>
                <span>Send to Back</span>
              </button>
            </div>
            
            <div class="layer-info-card">
              <div class="info-row">
                <span class="info-label">Current Z-Index</span>
                <span class="info-value">{selectedElement.zIndex || 0}</span>
              </div>
              <div class="info-row">
                <span class="info-label">Total Elements</span>
                <span class="info-value">{$diagram.elements.length}</span>
              </div>
            </div>
          </div>
        {/if}
      </div>
    {:else}
      <div class="empty-state">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.5">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
          <line x1="9" y1="9" x2="15" y2="9"></line>
          <line x1="9" y1="15" x2="15" y2="15"></line>
        </svg>
        <h4>No Selection</h4>
        <p>Select an element to view and edit its properties</p>
      </div>
    {/if}
  </div>
</div>

<style>
  /* Typography System Variables */
  :root {
    --font-primary: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Helvetica Neue', sans-serif;
    --font-mono: 'SF Mono', 'Monaco', 'Inconsolata', 'Courier New', monospace;
    
    /* Font Sizes - Consistent scale */
    --text-xs: 0.75rem;    /* 12px - small labels */
    --text-sm: 0.875rem;   /* 14px - body text */
    --text-base: 1rem;     /* 16px - headings */
    --text-lg: 1.125rem;   /* 18px - title */
    
    /* Font Weights */
    --font-normal: 400;
    --font-medium: 500;
    --font-semibold: 600;
    --font-bold: 700;
  }

  .property-panel {
    width: 400px;
    min-width: 400px;
    max-width: 400px;
    height: 100%;
    background: linear-gradient(to bottom, #ffffff 0%, #fefefe 100%);
    border-left: 1px solid #e5e7eb;
    display: flex;
    flex-direction: column;
    font-family: var(--font-primary);
    font-size: var(--text-sm);
    overflow: hidden;
    box-shadow: -8px 0 32px rgba(0, 0, 0, 0.08), -2px 0 8px rgba(0, 0, 0, 0.04);
    backdrop-filter: blur(8px);
  }
  
  .panel-header {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 1.25rem 1.5rem;
    border-bottom: 1px solid #e5e7eb;
    background: linear-gradient(135deg, #ffffff 0%, #f8fafc 50%, #f1f5f9 100%);
    flex-shrink: 0;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
  }
  
  .panel-header svg {
    color: #6366f1;
    flex-shrink: 0;
    filter: drop-shadow(0 1px 2px rgba(99, 102, 241, 0.2));
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }
  
  .panel-header svg:hover {
    transform: scale(1.05);
    filter: drop-shadow(0 2px 4px rgba(99, 102, 241, 0.3));
  }
  
  .panel-header h3 {
    margin: 0;
    font-size: var(--text-lg);
    font-weight: var(--font-bold);
    color: #111827;
    white-space: nowrap;
    letter-spacing: -0.025em;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
  }
  
  .panel-content {
    flex: 1;
    overflow-y: scroll;
    overflow-x: hidden;
    padding: 1.5rem;
    min-height: 0;
    scroll-behavior: smooth;
    width: 100%;
    box-sizing: border-box;
  }
  
  /* Element Card */
  .element-card {
    background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 60%, #dbeafe 100%);
    border: 1px solid #bae6fd;
    border-radius: 0 0 1rem 1rem;
    padding: 1.25rem;
    margin-bottom: 1.5rem;
    box-shadow: 0 4px 16px rgba(99, 102, 241, 0.08), 0 1px 4px rgba(0, 0, 0, 0.04);
    transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
    position: relative;
    width: 100%;
    box-sizing: border-box;
  }
  
  .element-card::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 2px;
    background: linear-gradient(90deg, #6366f1, #3b82f6, #06b6d4);
  }
  
  .element-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 24px rgba(99, 102, 241, 0.12), 0 2px 8px rgba(0, 0, 0, 0.06);
  }
  
  .element-header {
    display: grid;
    grid-template-columns: 65px 1fr;
    align-items: center;
    gap: 0.75rem;
    margin-bottom: 0.75rem;
  }
  
  .element-badge {
    width: 65px;
    padding: 0.375rem 0;
    text-align: center;
    border-radius: 0.5rem;
    font-size: var(--text-xs);
    font-weight: var(--font-bold);
    text-transform: uppercase;
    letter-spacing: 0.075em;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }
  
  .element-badge.iso {
    background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%);
    color: #1e40af;
    border: 1px solid #93c5fd;
  }
  
  .element-badge.pip {
    background: linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%);
    color: #065f46;
    border: 1px solid #6ee7b7;
  }
  
  .element-badge.pid {
    background: linear-gradient(135deg, #ede9fe 0%, #ddd6fe 100%);
    color: #5b21b6;
    border: 1px solid #c4b5fd;
  }
  
  .element-details {
    min-width: 0;
    overflow: hidden;
  }
  
  .element-name {
    font-weight: var(--font-bold);
    color: #111827;
    font-size: var(--text-base);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    letter-spacing: -0.025em;
    line-height: 1.3;
    max-width: 100%;
  }
  
  .element-id {
    font-size: var(--text-xs);
    color: #6b7280;
    font-family: var(--font-mono);
    background: rgba(107, 114, 128, 0.1);
    padding: 0.125rem 0.375rem;
    border-radius: 0.25rem;
    margin-top: 0.25rem;
    display: inline-block;
  }
  
  /* Action Bar */
  .action-bar {
    display: flex;
    gap: 0.5rem;
    justify-content: flex-start;
  }
  
  .action-btn {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.375rem;
    padding: 0.625rem 0.75rem;
    background: linear-gradient(135deg, #ffffff 0%, #f9fafb 100%);
    border: 1px solid #d1d5db;
    border-radius: 0.625rem;
    font-size: var(--text-xs);
    font-weight: var(--font-semibold);
    color: #374151;
    cursor: pointer;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    min-width: 0;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
    letter-spacing: 0.025em;
  }
  
  .action-btn.icon-only {
    width: 38px;
    height: 38px;
    padding: 0;
    flex: 0 0 auto;
    border-radius: 0.5rem;
  }
  
  .action-btn.icon-only svg {
    width: 18px;
    height: 18px;
  }
  
  .action-btn span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  
  .action-btn:hover {
    background: linear-gradient(135deg, #f9fafb 0%, #f3f4f6 100%);
    border-color: #9ca3af;
    transform: translateY(-2px) scale(1.02);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1), 0 2px 4px rgba(0, 0, 0, 0.06);
  }
  
  .action-btn.active {
    background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%);
    border-color: #6366f1;
    color: white;
    box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3), 0 2px 4px rgba(0, 0, 0, 0.06);
  }
  
  .action-btn.delete {
    color: #dc2626;
  }
  
  .action-btn.delete:hover {
    background: linear-gradient(135deg, #fee2e2 0%, #fecaca 100%);
    border-color: #f87171;
    color: #b91c1c;
    box-shadow: 0 4px 12px rgba(239, 68, 68, 0.2), 0 2px 4px rgba(0, 0, 0, 0.06);
  }
  
  /* Tab Navigation */
  .tab-nav {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 0.25rem;
    padding: 0.375rem;
    background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
    border-radius: 0.75rem;
    margin-bottom: 1.5rem;
    box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.1);
    border: 1px solid #e2e8f0;
  }
  
  .tab-btn {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.25rem;
    padding: 0.75rem 0.5rem;
    background: transparent;
    border: none;
    border-radius: 0.5rem;
    font-size: var(--text-xs);
    font-weight: var(--font-semibold);
    color: #6b7280;
    cursor: pointer;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    position: relative;
    letter-spacing: 0.025em;
  }
  
  .tab-btn svg {
    flex-shrink: 0;
  }
  
  .tab-btn span {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 100%;
  }
  
  .tab-btn:hover {
    color: #374151;
    background: rgba(255, 255, 255, 0.7);
    transform: translateY(-1px);
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
  }
  
  .tab-btn.active {
    background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%);
    color: #6366f1;
    box-shadow: 0 3px 8px rgba(0, 0, 0, 0.12), 0 1px 3px rgba(0, 0, 0, 0.08);
    transform: translateY(-1px);
    border: 1px solid rgba(99, 102, 241, 0.2);
  }
  
  /* Tab Content */
  .tab-content-wrapper {
    flex: 1;
    min-height: 0;
    overflow-y: scroll;
    overflow-x: hidden;
    padding-bottom: 0.5rem;
    width: 100%;
    box-sizing: border-box;
  }
  
  .tab-pane {
    animation: slideInFade 0.4s cubic-bezier(0.4, 0, 0.2, 1);
    width: 100%;
    box-sizing: border-box;
    padding: 0;
  }
  
  @keyframes slideInFade {
    from { 
      opacity: 0;
      transform: translateY(8px);
    }
    to { 
      opacity: 1;
      transform: translateY(0);
    }
  }
  
  /* Input Groups */
  .input-group {
    margin-bottom: 1rem;
  }
  
  .input-group.disabled {
    opacity: 0.4;
    pointer-events: none;
  }
  
  .input-group.disabled .label-text {
    color: #9ca3af;
  }
  
  .input-group label {
    display: block;
  }
  
  .label-text {
    display: block;
    margin-bottom: 0.5rem;
    font-size: var(--text-sm);
    font-weight: var(--font-semibold);
    color: #374151;
    letter-spacing: 0.025em;
    text-transform: uppercase;
    font-size: var(--text-xs);
  }
  
  .input-group input[type="text"],
  .input-group input[type="number"] {
    width: 100%;
    padding: 0.75rem 1rem;
    border: 1px solid #d1d5db;
    border-radius: 0.5rem;
    font-size: var(--text-sm);
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    background: linear-gradient(135deg, #ffffff 0%, #fafafa 100%);
    box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.05);
  }
  
  .input-group input:focus {
    outline: none;
    border-color: #6366f1;
    box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.15), inset 0 1px 2px rgba(0, 0, 0, 0.05);
    transform: translateY(-1px);
    background: #ffffff;
  }
  
  .input-group input:hover {
    border-color: #9ca3af;
    box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.05), 0 1px 3px rgba(0, 0, 0, 0.05);
  }
  
  .input-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.75rem;
  }
  
  .input-with-unit {
    display: flex;
    align-items: center;
    position: relative;
  }
  
  .input-with-unit input {
    padding-right: 2rem;
  }
  
  .unit {
    position: absolute;
    right: 0.75rem;
    color: #9ca3af;
    font-size: var(--text-xs);
    pointer-events: none;
  }
  
  /* Position input styling */
  .position-input-wrapper {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  
  .position-input {
    flex: 1;
    padding: 0.5rem 0.75rem;
    background: white;
    border: 1px solid #e5e7eb;
    border-radius: 0.5rem;
    font-size: var(--text-sm);
    color: #1f2937;
    transition: all 0.2s;
    /* Keep space for native number arrows */
    padding-right: 0.5rem;
  }
  
  .position-input:hover {
    border-color: #9ca3af;
  }
  
  .position-input:focus {
    outline: none;
    border-color: #6366f1;
    box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
  }
  
  .position-unit {
    color: #6b7280;
    font-size: var(--text-xs);
    font-weight: var(--font-medium);
    min-width: 20px;
  }
  
  .checkbox-group {
    margin: 1rem 0;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  
  .checkbox-label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    cursor: pointer;
    font-size: var(--text-sm);
    color: #374151;
  }
  
  .checkbox-label input[type="checkbox"] {
    width: 16px;
    height: 16px;
    cursor: pointer;
  }
  
  /* Tag Style Buttons */
  .tag-style-buttons {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 0.5rem;
    margin-top: 0.375rem;
  }
  
  .style-option-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 0.75rem;
    background: linear-gradient(135deg, #ffffff 0%, #f9fafb 100%);
    border: 1px solid #d1d5db;
    border-radius: 0.5rem;
    font-size: var(--text-sm);
    color: #6b7280;
    cursor: pointer;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    font-weight: var(--font-medium);
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
  }
  
  .style-option-btn:hover {
    background: linear-gradient(135deg, #f9fafb 0%, #f3f4f6 100%);
    border-color: #9ca3af;
    color: #374151;
    transform: translateY(-1px) scale(1.02);
    box-shadow: 0 3px 6px rgba(0, 0, 0, 0.1);
  }
  
  .style-option-btn.active {
    background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%);
    border-color: #3b82f6;
    color: #1e40af;
    box-shadow: 0 3px 8px rgba(59, 130, 246, 0.2), 0 1px 3px rgba(0, 0, 0, 0.1);
    transform: translateY(-1px);
  }
  
  /* Tag Position Buttons */
  .tag-position-buttons {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 0.375rem;
    margin-top: 0.375rem;
  }
  
  .position-btn {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.25rem;
    padding: 0.5rem;
    background: white;
    border: 1px solid #d1d5db;
    border-radius: 0.375rem;
    font-size: var(--text-xs);
    color: #6b7280;
    cursor: pointer;
    transition: all 0.2s;
  }
  
  .position-btn:hover {
    background: #f9fafb;
    border-color: #9ca3af;
    color: #374151;
  }
  
  .position-btn.active {
    background: #e0f2fe;
    border-color: #3b82f6;
    color: #1e40af;
  }
  
  /* Control Sections */
  .control-section {
    margin-bottom: 1rem;
    padding: 0 0.75rem;
  }
  
  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.75rem;
  }
  
  .section-title {
    font-size: var(--text-sm);
    font-weight: var(--font-semibold);
    color: #374151;
  }
  
  .section-value {
    font-size: var(--text-xs);
    font-weight: var(--font-medium);
    color: #6b7280;
    background: #f3f4f6;
    padding: 0.125rem 0.5rem;
    border-radius: 0.25rem;
  }
  
  /* Size Presets */
  .size-presets,
  .rotation-presets {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 0.75rem;
  }
  
  .preset-btn {
    flex: 1;
    padding: 0.625rem 0.75rem;
    background: linear-gradient(135deg, #ffffff 0%, #f9fafb 100%);
    border: 1px solid #d1d5db;
    border-radius: 0.5rem;
    font-size: var(--text-sm);
    font-weight: var(--font-bold);
    color: #6b7280;
    cursor: pointer;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
    letter-spacing: 0.025em;
  }
  
  .preset-btn:hover {
    background: linear-gradient(135deg, #f9fafb 0%, #f3f4f6 100%);
    border-color: #9ca3af;
    color: #374151;
    transform: translateY(-1px) scale(1.05);
    box-shadow: 0 3px 6px rgba(0, 0, 0, 0.1);
  }
  
  .preset-btn.active {
    background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%);
    border-color: #6366f1;
    color: white;
    box-shadow: 0 3px 8px rgba(99, 102, 241, 0.3), 0 1px 3px rgba(0, 0, 0, 0.1);
    transform: translateY(-1px) scale(1.05);
  }
  
  .stroke-presets {
    display: flex;
    gap: 0.25rem;
    margin-top: 0.5rem;
  }
  
  .linecap-options {
    display: flex;
    gap: 0.5rem;
  }
  
  .preset-btn.small {
    padding: 0.25rem 0.5rem;
    font-size: var(--text-xs);
  }
  
  /* Color Controls */
  .color-preview {
    width: 24px;
    height: 24px;
    border-radius: 0.375rem;
    border: 2px solid white;
    box-shadow: 0 0 0 1px #d1d5db;
  }
  
  .color-presets {
    display: flex;
    flex-wrap: wrap;
    gap: 0.375rem;
    margin-bottom: 0.5rem;
    padding: 2px;
    margin-left: -2px;
    margin-right: -2px;
  }
  
  .recent-colors-section {
    margin-top: 0.75rem;
    margin-bottom: 0.5rem;
  }
  
  .recent-label {
    display: block;
    font-size: var(--text-xs);
    font-weight: var(--font-semibold);
    color: #6b7280;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-bottom: 0.5rem;
  }
  
  .recent-colors {
    display: flex;
    gap: 0.375rem;
  }
  
  .color-btn {
    width: 32px;
    height: 32px;
    border: 1px solid rgba(0, 0, 0, 0.1);
    border-radius: 0.375rem;
    cursor: pointer;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
  }
  
  .color-btn:hover {
    border-color: #6b7280;
  }
  
  .color-btn.active {
    border-color: #6366f1;
    border-width: 2px;
  }
  
  .color-btn.more {
    background: white;
    border: 1px solid #d1d5db;
  }
  
  .color-grid {
    display: grid;
    grid-template-columns: repeat(10, 1fr);
    gap: 0.25rem;
    padding: 0.5rem;
    background: #f9fafb;
    border-radius: 0.5rem;
    width: 100%;
    box-sizing: border-box;
  }
  
  .color-grid-btn {
    aspect-ratio: 1;
    border: 1px solid rgba(0, 0, 0, 0.1);
    border-radius: 0.375rem;
    cursor: pointer;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
  }
  
  .color-grid-btn:hover {
    border-color: #6b7280;
    z-index: 1;
  }
  
  /* Slider */
  .slider {
    width: 100%;
    height: 8px;
    background: linear-gradient(90deg, #f1f5f9 0%, #e2e8f0 100%);
    border-radius: 4px;
    outline: none;
    -webkit-appearance: none;
    appearance: none;
    box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.1);
    border: 1px solid #e2e8f0;
  }
  
  .slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 16px;
    height: 16px;
    background: #6366f1;
    border-radius: 50%;
    cursor: pointer;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
    transition: all 0.2s;
    border: none;
  }
  
  .slider::-webkit-slider-thumb:hover {
    background: #4f46e5;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.4);
  }
  
  .slider::-moz-range-thumb {
    width: 16px;
    height: 16px;
    background: #6366f1;
    border-radius: 50%;
    cursor: pointer;
    border: none;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
    transition: all 0.2s;
  }
  
  .slider::-moz-range-thumb:hover {
    background: #4f46e5;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.4);
  }
  
  /* Flip Controls */
  .flip-controls {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 0.75rem;
  }
  
  .flip-btn {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.25rem;
    padding: 0.75rem;
    background: white;
    border: 1px solid #d1d5db;
    border-radius: 0.5rem;
    font-size: var(--text-xs);
    color: #6b7280;
    cursor: pointer;
    transition: all 0.2s;
  }
  
  .flip-btn:hover {
    background: #f9fafb;
    border-color: #9ca3af;
    color: #374151;
  }
  
  .flip-btn.active {
    background: #6366f1;
    border-color: #6366f1;
    color: white;
  }
  
  /* Layer Controls */
  .layer-controls {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 0.5rem;
    margin-bottom: 1rem;
    padding: 0.5rem;
  }
  
  .layer-btn {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.25rem;
    padding: 0.75rem 0.5rem;
    background: white;
    border: 1px solid #d1d5db;
    border-radius: 0.5rem;
    font-size: var(--text-xs);
    color: #6b7280;
    cursor: pointer;
    transition: all 0.2s;
    font-weight: var(--font-medium);
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
  }
  
  .layer-btn span {
    font-size: var(--text-xs);
  }
  
  .layer-btn:hover {
    background: #f9fafb;
    border-color: #9ca3af;
    color: #374151;
    transform: translateY(-1px);
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.08);
  }
  
  .layer-info-card {
    background: #f9fafb;
    border-radius: 0.5rem;
    padding: 0.75rem;
    margin: 0 0.5rem;
  }
  
  .info-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.375rem 0;
  }
  
  .info-label {
    font-size: var(--text-xs);
    color: #6b7280;
  }
  
  .info-value {
    font-size: var(--text-sm);
    font-weight: var(--font-semibold);
    color: #111827;
    font-family: var(--font-mono);
  }
  
  /* Empty State */
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 4rem 1.5rem;
    text-align: center;
    background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
    border-radius: 1rem;
    margin: 2rem 0;
    border: 2px dashed #cbd5e1;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }
  
  .empty-state:hover {
    border-color: #94a3b8;
    background: linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%);
  }
  
  .empty-state svg {
    color: #d1d5db;
    margin-bottom: 1rem;
  }
  
  .empty-state h4 {
    margin: 0 0 0.75rem 0;
    font-size: var(--text-lg);
    font-weight: var(--font-bold);
    color: #374151;
    letter-spacing: -0.025em;
  }
  
  .empty-state p {
    margin: 0;
    font-size: var(--text-sm);
    color: #64748b;
    line-height: 1.5;
    max-width: 280px;
  }
  
  /* Scrollbar */
  .panel-content::-webkit-scrollbar {
    width: 8px;
  }
  
  .panel-content::-webkit-scrollbar-track {
    background: linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%);
    border-radius: 4px;
  }
  
  .panel-content::-webkit-scrollbar-thumb {
    background: linear-gradient(180deg, #cbd5e1 0%, #94a3b8 100%);
    border-radius: 4px;
    border: 1px solid #e2e8f0;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }
  
  .panel-content::-webkit-scrollbar-thumb:hover {
    background: linear-gradient(180deg, #94a3b8 0%, #64748b 100%);
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  }
  
  .tab-content-wrapper::-webkit-scrollbar {
    width: 6px;
  }
  
  .tab-content-wrapper::-webkit-scrollbar-track {
    background: transparent;
  }
  
  .tab-content-wrapper::-webkit-scrollbar-thumb {
    background: #cbd5e1;
    border-radius: 3px;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }
  
  .tab-content-wrapper::-webkit-scrollbar-thumb:hover {
    background: #94a3b8;
  }
</style>