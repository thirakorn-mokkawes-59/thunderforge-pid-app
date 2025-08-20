<script lang="ts">
  import { Handle, Position } from '@xyflow/svelte';
  import { onMount, onDestroy } from 'svelte';
  import type { NodeProps } from '@xyflow/svelte';
  import { diagram } from '$lib/stores/diagram';
  import { UI_CONSTANTS } from '$lib/constants/ui';
  
  type $$Props = NodeProps;
  
  export let id: $$Props['id'];
  export let data: $$Props['data'];
  export let selected: $$Props['selected'] = false;
  export let dragging: $$Props['dragging'] = false;
  
  // Debug mode to visualize handle areas (set to true during development)
  const DEBUG_HANDLES = false;
  
  // Use our store to determine if selected
  $: isSelected = $diagram.selectedIds.has(id);
  
  
  // Apply visual properties
  $: nodeColor = data.color || '#000000';
  $: nodeOpacity = data.opacity || 1;
  $: nodeStrokeWidth = data.strokeWidth || UI_CONSTANTS.STROKE.DEFAULT_WIDTH;
  $: nodeStrokeLinecap = data.strokeLinecap || UI_CONSTANTS.STROKE.DEFAULT_LINECAP;
  $: transformStyle = `
    rotate(${data.rotation || 0}deg)
    ${data.flipX ? 'scaleX(-1)' : ''}
    ${data.flipY ? 'scaleY(-1)' : ''}
  `;
  
  let svgContent = '';
  let connectionPoints: Array<{x: number, y: number, id: string}> = [];
  let isLoading = true;
  
  // Track active timeouts and animation frames for cleanup
  let activeTimeouts: Set<number> = new Set();
  let activeAnimationFrames: Set<number> = new Set();
  let abortController: AbortController | null = null;
  
  // Load SVG and parse connection points - only on path change
  $: if (data.symbolPath && !svgContent) loadSvg(data.symbolPath);
  
  // Update stroke width and linecap when they change
  $: if (svgContent && (nodeStrokeWidth !== undefined || nodeStrokeLinecap !== undefined)) {
    // Use a small delay to ensure DOM is ready
    const timeoutId = setTimeout(() => {
      updateStrokePropertiesDirectly(nodeStrokeWidth, nodeStrokeLinecap);
      activeTimeouts.delete(timeoutId);
    }, 0);
    activeTimeouts.add(timeoutId);
  }
  
  async function loadSvg(symbolPath: string) {
    if (symbolPath) {
      // Cancel any pending fetch
      if (abortController) {
        abortController.abort();
      }
      abortController = new AbortController();
      
      try {
        const response = await fetch(data.symbolPath, { signal: abortController.signal });
        const text = await response.text();
        
        // Parse SVG
        const parser = new DOMParser();
        const doc = parser.parseFromString(text, 'image/svg+xml');
        const svg = doc.documentElement;
        
        // Get viewBox
        const viewBox = svg.getAttribute('viewBox') || '0 0 64 64';
        const [vbX, vbY, vbWidth, vbHeight] = viewBox.split(' ').map(Number);
        
        // Calculate scale
        const scaleX = data.width / vbWidth;
        const scaleY = data.height / vbHeight;
        
        // Find connection indicator elements (red for equipment/valves, gray for pipes/signals)
        const redElements = svg.querySelectorAll('[stroke="#ff0000"], [stroke="rgb(255,0,0)"], [stroke="red"], [stroke="#646464"], [stroke="rgb(100,100,100)"]');
        
        // Simple approach: find red elements and calculate centers directly
        const rawPoints = Array.from(redElements).map((el, index) => {
          // Try to get the center of the T-shape more accurately
          let finalX = 0, finalY = 0;
          
          // If it's a line element, get the midpoint
          if (el.tagName.toLowerCase() === 'line') {
            const x1 = parseFloat(el.getAttribute('x1') || '0');
            const y1 = parseFloat(el.getAttribute('y1') || '0');
            const x2 = parseFloat(el.getAttribute('x2') || '0');
            const y2 = parseFloat(el.getAttribute('y2') || '0');
            finalX = (x1 + x2) / 2;
            finalY = (y1 + y2) / 2;
          }
          
          // Get all transforms from element and parents
          let currentElement = el;
          
          // Collect all translations
          while (currentElement && currentElement !== svg) {
            const transform = currentElement.getAttribute('transform') || '';
            const translateMatch = transform.match(/translate\(([-\d.]+)[\s,]+([-\d.]+)\)/);
            if (translateMatch) {
              finalX += parseFloat(translateMatch[1]);
              finalY += parseFloat(translateMatch[2]);
            }
            
            // Add rotation center if present
            const rotateMatch = transform.match(/rotate\(([-\d.]+)(?:\s+([-\d.]+)\s+([-\d.]+))?\)/);
            if (rotateMatch && rotateMatch[2] && rotateMatch[3]) {
              // Don't add rotation center to position, it's just for rotation
              // finalX += parseFloat(rotateMatch[2]);
              // finalY += parseFloat(rotateMatch[3]);
            }
            
            currentElement = currentElement.parentElement;
          }
          
          // Apply scaling - position handle exactly at T-shape center
          const scaledX = finalX * scaleX;
          const scaledY = finalY * scaleY;
          
          
          return {
            x: scaledX,
            y: scaledY,
            id: `handle-${index}`
          };
        });
        
        
        // Group nearby points (within 5 pixels) to eliminate duplicates
        const groupedPoints: typeof rawPoints = [];
        const threshold = 5; // pixels
        
        rawPoints.forEach(point => {
          const existingPoint = groupedPoints.find(p => 
            Math.abs(p.x - point.x) < threshold && 
            Math.abs(p.y - point.y) < threshold
          );
          
          if (!existingPoint) {
            groupedPoints.push(point);
          } else {
            // Average the positions for more accuracy
            existingPoint.x = (existingPoint.x + point.x) / 2;
            existingPoint.y = (existingPoint.y + point.y) / 2;
          }
        });
        
        // Re-index the grouped points
        connectionPoints = groupedPoints.map((point, index) => ({
          ...point,
          id: `handle-${index}`
        }));
        
        // Hide red elements initially instead of removing them
        redElements.forEach(el => {
          el.setAttribute('class', 'connection-indicator');
          el.setAttribute('opacity', '0');
        });
        
        // Remove pipe labels (T and PIPE text) for cleaner display
        const blueTextElements = svg.querySelectorAll('[fill="#004c99"], [fill="rgb(0,76,153)"]');
        blueTextElements.forEach(el => {
          // Check if it's a text path or contains text content
          if (el.tagName.toLowerCase() === 'path' && el.parentElement) {
            const parentTransform = el.parentElement.getAttribute('transform') || '';
            // These are typically text paths in pipe symbols
            if (parentTransform.includes('translate')) {
              el.parentElement.remove();
            }
          }
        });
        
        // Process fill attributes to prevent flash and apply stroke-width
        const allElements = svg.querySelectorAll('*');
        allElements.forEach(el => {
          const fill = el.getAttribute('fill');
          // Preserve white fills explicitly
          if (fill === 'white') {
            el.style.fill = 'white';
          } else if (fill === 'none' || !fill) {
            el.style.fill = 'none';
          }
          
          // Apply stroke width and linecap to elements with stroke (except connection indicators)
          if (!el.classList.contains('connection-indicator')) {
            const hasStroke = el.getAttribute('stroke');
            if (hasStroke && hasStroke !== 'none') {
              el.setAttribute('stroke-width', nodeStrokeWidth.toString());
              el.style.strokeWidth = nodeStrokeWidth + 'px';
              el.setAttribute('stroke-linecap', nodeStrokeLinecap);
              el.style.strokeLinecap = nodeStrokeLinecap;
            }
          }
        });
        
        // Set the SVG content with processed fills
        svgContent = new XMLSerializer().serializeToString(svg);
        isLoading = false;
        
        // Apply current stroke properties after SVG is rendered
        const timeoutId = setTimeout(() => {
          updateStrokePropertiesDirectly(nodeStrokeWidth, nodeStrokeLinecap);
          activeTimeouts.delete(timeoutId);
        }, 10);
        activeTimeouts.add(timeoutId);
      } catch (error) {
        // Only log if not aborted
        if (error.name !== 'AbortError') {
          console.error('Failed to load SVG:', error);
        }
        isLoading = false;
      }
    }
  }
  
  // Update stroke properties without reloading entire SVG
  function updateStrokePropertiesDirectly(strokeWidth: number, strokeLinecap: string) {
    // Wait for next tick to ensure DOM is ready
    const frameId = requestAnimationFrame(() => {
      const container = document.querySelector(`[data-node-id="${id}"] .symbol-content`);
      if (container) {
        const svgElement = container.querySelector('svg');
        if (svgElement) {
          // Get all stroke elements, not just specific types
          const allElements = svgElement.querySelectorAll('*');
          allElements.forEach(el => {
            // Skip connection indicators 
            if (!el.classList.contains('connection-indicator')) {
              const hasStroke = el.getAttribute('stroke');
              // Apply to any element with a stroke that's not a connection indicator
              if (hasStroke && hasStroke !== 'none') {
                // Skip red connection indicators
                if (hasStroke === '#ff0000' || hasStroke === '#646464' || 
                    hasStroke === 'red' || hasStroke === 'rgb(255,0,0)' ||
                    hasStroke === 'rgb(100,100,100)') {
                  return;
                }
                // Force update with important to override any CSS
                (el as SVGElement).style.setProperty('stroke-width', strokeWidth + 'px', 'important');
                el.setAttribute('stroke-width', strokeWidth.toString());
                (el as SVGElement).style.setProperty('stroke-linecap', strokeLinecap, 'important');
                el.setAttribute('stroke-linecap', strokeLinecap);
              }
            }
          });
        }
      }
      activeAnimationFrames.delete(frameId);
    });
    activeAnimationFrames.add(frameId);
  }
  
  // Get handle rotation based on position
  function getHandleRotation(point: {x: number, y: number}): number {
    const position = getHandlePosition(point);
    switch(position) {
      case Position.Right: return 180;
      case Position.Top: return 90;
      case Position.Bottom: return -90;
      case Position.Left:
      default: return 0;
    }
  }
  
  // Calculate handle position as percentage - centered on T-shape
  function getHandleStyle(point: {x: number, y: number}) {
    // No offset - position handle exactly at T-shape center
    const left = `${(point.x / data.width) * 100}%`;
    const top = `${(point.y / data.height) * 100}%`;
    return `left: ${left}; top: ${top};`;
  }
  
  // Determine handle position type based on location
  function getHandlePosition(point: {x: number, y: number}): Position {
    const centerX = data.width / 2;
    const centerY = data.height / 2;
    
    const dx = Math.abs(point.x - centerX);
    const dy = Math.abs(point.y - centerY);
    
    if (dx > dy) {
      return point.x > centerX ? Position.Right : Position.Left;
    } else {
      return point.y > centerY ? Position.Bottom : Position.Top;
    }
  }
  
  // Get tag transform based on position and offsets
  function getTagTransform(position: string, offsetX: number, offsetY: number): string {
    const baseOffsetX = offsetX || 0;
    const baseOffsetY = offsetY || 0;
    
    switch (position) {
      case 'below':
        return `translateX(calc(-50% + ${baseOffsetX}px)) translateY(${baseOffsetY}px)`;
      case 'above':
        return `translateX(calc(-50% + ${baseOffsetX}px)) translateY(${baseOffsetY}px)`;
      case 'left':
        return `translateX(calc(-100% + ${baseOffsetX}px)) translateY(calc(-50% + ${baseOffsetY}px))`;
      case 'right':
        return `translateX(calc(100% + ${baseOffsetX}px)) translateY(calc(-50% + ${baseOffsetY}px))`;
      default:
        return `translateX(calc(-50% + ${baseOffsetX}px)) translateY(${baseOffsetY}px)`;
    }
  }
  
  // Cleanup on component destroy
  onDestroy(() => {
    // Clear all active timeouts
    activeTimeouts.forEach(id => clearTimeout(id));
    activeTimeouts.clear();
    
    // Cancel all active animation frames
    activeAnimationFrames.forEach(id => cancelAnimationFrame(id));
    activeAnimationFrames.clear();
    
    // Abort any pending fetch
    if (abortController) {
      abortController.abort();
      abortController = null;
    }
    
    // Clear SVG content to free memory
    svgContent = '';
    connectionPoints = [];
  });
</script>

<div 
  class="pid-symbol-node"
  class:selected={isSelected}
  class:dragging
  class:locked={data.locked}
  data-node-id={id}
  style="width: {data.width}px; height: {data.height}px; transform: {transformStyle}; opacity: {nodeOpacity}; background: {isLoading ? 'white' : 'transparent'};"
>
  {#if svgContent}
    <!-- Display the SVG symbol with color and stroke width -->
    <div class="symbol-content" style="color: {nodeColor}; --stroke-width: {nodeStrokeWidth}px;">
      {@html svgContent}
    </div>
  {:else if !isLoading}
    <!-- Fallback to image if SVG parsing fails -->
    <img src={data.symbolPath} alt={data.name} style="filter: brightness(0) saturate(100%) {nodeColor !== '#000000' ? `drop-shadow(0 0 0 ${nodeColor})` : ''};" />
  {/if}
  
  <!-- Add dual handles at connection points for true bidirectional connections -->
  {#each connectionPoints as point, i}
    <!-- Debug: Show exact T-shape center -->
    {#if DEBUG_HANDLES}
      <div 
        class="debug-t-center" 
        style="left: {(point.x / data.width) * 100}%; top: {(point.y / data.height) * 100}%;"
        title="T-shape center"
      ></div>
    {/if}
    
    <!-- Target handle for incoming connections -->
    <Handle
      type="target"
      position={getHandlePosition(point)}
      id={`handle-${i}`}
      style={getHandleStyle(point)}
      class="connection-handle connection-handle-target {DEBUG_HANDLES ? 'debug-handle' : ''}"
      isConnectable={true}
      title="Click and drag to connect"
    />
    <!-- Source handle for outgoing connections -->
    <Handle
      type="source"
      position={getHandlePosition(point)}
      id={`handle-${i}`}
      style={getHandleStyle(point)}
      class="connection-handle connection-handle-source {DEBUG_HANDLES ? 'debug-handle' : ''}"
      isConnectable={true}
      title="Click and drag to connect"
    />
  {/each}
  
  <!-- Label and Tag -->
  {#if data.showLabel !== false}
    <div class="symbol-label" style="
      font-size: {data.labelFontSize || 10}px;
      font-weight: {data.labelFontWeight || 'normal'};
      font-style: {data.labelFontStyle || 'normal'};
      color: {data.labelFontColor || '#666666'};
      background: {data.labelBgColor === 'transparent' ? 'transparent' : (data.labelBgColor || 'rgba(255, 255, 255, 0.9)')};
      padding: 2px 4px;
      transform: translateX(calc(-50% + {data.labelOffsetX || 0}px)) translateY({data.labelOffsetY || 0}px);
    ">{data.name}</div>
  {/if}
  
  {#if data.tag && data.showTag !== false}
    <div class="symbol-tag tag-position-{data.tagPosition || 'below'} {data.showLabel === false && (data.tagPosition === 'below' || !data.tagPosition) ? 'no-label' : ''}" style="
      font-size: {data.tagFontSize || 10}px;
      font-weight: {data.tagFontWeight || 'normal'};
      font-style: {data.tagFontStyle || 'normal'};
      color: {data.tagFontColor || '#666666'};
      background: {data.tagBgColor === 'transparent' ? 'transparent' : (data.tagBgColor || 'rgba(255, 255, 255, 0.9)')};
      padding: 2px 4px;
      transform: {getTagTransform(data.tagPosition || 'below', data.tagOffsetX, data.tagOffsetY)};
    ">
      {data.tag}
    </div>
  {/if}
</div>

<style>
  .pid-symbol-node {
    position: relative;
    background: transparent;
    border: none;
    padding: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    overflow: visible;
  }
  
  .symbol-content {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  
  .symbol-content :global(svg) {
    width: 100%;
    height: 100%;
  }
  
  /* Apply color to SVG strokes only, preserve fills */
  .symbol-content :global(svg path),
  .symbol-content :global(svg line),
  .symbol-content :global(svg rect),
  .symbol-content :global(svg circle),
  .symbol-content :global(svg ellipse),
  .symbol-content :global(svg polygon),
  .symbol-content :global(svg polyline) {
    stroke: currentColor !important;
  }
  
  /* Don't apply stroke width to connection indicators */
  .symbol-content :global(svg .connection-indicator) {
    stroke-width: 0.5px !important;
  }
  
  /* Preserve white fills for vessels and equipment */
  .symbol-content :global(svg [fill="white"]) {
    fill: white !important;
  }
  
  /* For elements with no fill or fill="none", keep them transparent */
  .symbol-content :global(svg *:not([fill])),
  .symbol-content :global(svg [fill="none"]) {
    fill: none !important;
  }
  
  /* For non-white, non-none fills, use currentColor */
  .symbol-content :global(svg [fill]:not([fill="none"]):not([fill="white"])) {
    fill: currentColor !important;
  }
  
  /* Stable blue glow effect for selected nodes */
  .pid-symbol-node.selected {
    outline: 2px solid rgba(59, 130, 246, 0.5);
    outline-offset: 3px;
    background: radial-gradient(circle at center, rgba(59, 130, 246, 0.05), transparent 70%);
    border-radius: 4px;
  }
  
  .pid-symbol-node.dragging {
    opacity: 0.5;
    cursor: grabbing !important;
  }
  
  /* Locked element styling */
  .pid-symbol-node.locked {
    cursor: not-allowed !important;
  }
  
  .pid-symbol-node.locked::after {
    content: '🔒';
    position: absolute;
    top: -8px;
    right: -8px;
    font-size: 10px;
    background: white;
    border-radius: 50%;
    padding: 2px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
    z-index: 1000;
  }
  
  .symbol-content {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
  }
  
  .symbol-content :global(svg) {
    width: 100% !important;
    height: 100% !important;
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;
  }
  
  .symbol-label {
    position: absolute;
    bottom: -20px;
    left: 50%;
    white-space: nowrap;
    border-radius: 2px;
  }
  
  /* Tag styles - simple only */
  .symbol-tag {
    position: absolute;
    white-space: nowrap;
    border-radius: 2px;
  }
  
  /* Tag positions */
  .symbol-tag.tag-position-below {
    bottom: -38px;
    left: 50%;
  }
  
  /* When label is hidden and tag is below, move tag closer to node */
  .symbol-tag.tag-position-below.no-label {
    bottom: -20px;
  }
  
  .symbol-tag.tag-position-above {
    top: -22px;
    left: 50%;
  }
  
  /* When label is hidden and tag is above, it stays the same */
  .symbol-tag.tag-position-above.no-label {
    top: -22px;
  }
  
  .symbol-tag.tag-position-left {
    left: -10px;
    top: 50%;
  }
  
  .symbol-tag.tag-position-right {
    right: -10px;
    top: 50%;
  }
  
  /* Connection handles - small actual handle for precise connection */
  :global(.connection-handle) {
    /* Small handle for precise edge connection */
    width: 1px !important;
    height: 1px !important;
    background: transparent !important;
    border: none !important;
    /* Center the handle exactly on the T-shape */
    transform: translate(-50%, -50%);
    overflow: visible !important;
    cursor: crosshair;
    opacity: 0 !important;
    pointer-events: all;
    /* Add subtle indicator on hover for better feedback */
    transition: opacity 0.2s, transform 0.2s;
  }
  
  /* Create larger hit area using ::before pseudo-element */
  :global(.connection-handle::before) {
    content: '';
    position: absolute;
    width: 20px;
    height: 20px;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    background: transparent;
    pointer-events: all;
    cursor: crosshair;
  }
  
  /* Show a subtle circle on hover for visual feedback */
  :global(.connection-handle:hover::before) {
    opacity: 0.4 !important;
    background: radial-gradient(circle, rgba(59, 130, 246, 0.6) 0%, rgba(59, 130, 246, 0.2) 50%, transparent 70%) !important;
    animation: pulse-handle 1.5s ease-in-out infinite;
  }
  
  @keyframes pulse-handle {
    0% {
      transform: translate(-50%, -50%) scale(1);
    }
    50% {
      transform: translate(-50%, -50%) scale(1.1);
    }
    100% {
      transform: translate(-50%, -50%) scale(1);
    }
  }
  
  /* During connection dragging, make handles more visible */
  :global(.connecting .connection-handle) {
    opacity: 0.2 !important;
    background: radial-gradient(circle, rgba(59, 130, 246, 0.3) 0%, transparent 70%) !important;
  }
  
  /* Ensure both source and target handles overlap perfectly */
  :global(.connection-handle-target),
  :global(.connection-handle-source) {
    position: absolute;
  }
  
  /* Make valid connection targets more prominent during dragging */
  :global(.valid-connection-target .connection-handle) {
    opacity: 0.5 !important;
    background: radial-gradient(circle, rgba(34, 197, 94, 0.5) 0%, transparent 70%) !important;
    width: 24px !important;
    height: 24px !important;
  }
  
  /* Debug mode - visualize handle areas */
  :global(.debug-handle) {
    opacity: 0.3 !important;
    background: rgba(255, 0, 0, 0.2) !important;
    border: 1px dashed red !important;
  }
  
  /* Debug T-shape center marker */
  .debug-t-center {
    position: absolute;
    width: 4px;
    height: 4px;
    background: lime;
    border: 1px solid darkgreen;
    transform: translate(-50%, -50%);
    z-index: 10000;
    pointer-events: none;
  }
  
  /* Show the actual red T-shapes from SVG on hover */
  .symbol-content :global(.connection-indicator) {
    transition: opacity 0.2s, stroke 0.2s;
  }
  
  /* Show red T-shapes in blue when hovering over the node */
  .pid-symbol-node:hover .symbol-content :global(.connection-indicator) {
    opacity: 1 !important;
    stroke: #3b82f6 !important;
  }
  
  /* Show red T-shapes in red when hovering near them */
  .pid-symbol-node:hover .symbol-content :global(.connection-indicator:hover) {
    opacity: 1 !important;
    stroke: #ff0000 !important;
  }
  
  /* Override edge path to connect flush with symbols */
  :global(.svelte-flow__edge-path) {
    stroke-linecap: butt !important;
    /* Ensure edges connect properly without gaps */
  }
  
  /* Remove any edge offset */
  :global(.svelte-flow__edge) {
    /* Ensure edges reach all the way to connection points */
  }
  
  img {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }
</style>