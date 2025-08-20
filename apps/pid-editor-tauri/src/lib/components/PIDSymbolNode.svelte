<script lang="ts">
  import { Handle, Position } from '@xyflow/svelte';
  import { onMount, onDestroy } from 'svelte';
  import type { NodeProps } from '@xyflow/svelte';
  import { diagram } from '$lib/stores/diagram';
  import { UI_CONSTANTS } from '$lib/constants/ui';
  import { writable } from 'svelte/store';
  import { handleVisibility } from '$lib/stores/handleVisibility';
  
  type $$Props = NodeProps;
  
  export let id: $$Props['id'];
  export let data: $$Props['data'];
  export let selected: $$Props['selected'] = false;
  export let dragging: $$Props['dragging'] = false;
  
  // Debug mode to visualize handle areas (set to true during development)
  const DEBUG_HANDLES = false;
  
  // Use our store to determine if selected
  $: isSelected = $diagram.selectedIds.has(id);
  
  // Track if we're currently in a connection process
  let isConnecting = false;
  let connectingNodeId: string | null = null;
  
  // Listen for connection events to determine handle behavior
  function handleConnectionStart(event: CustomEvent) {
    isConnecting = true;
    connectingNodeId = event.detail?.nodeId || null;
  }
  
  function handleConnectionEnd() {
    isConnecting = false;
    connectingNodeId = null;
  }
  
  onMount(() => {
    window.addEventListener('connection-start', handleConnectionStart as EventListener);
    window.addEventListener('connection-end', handleConnectionEnd as EventListener);
  });
  
  
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
        
        console.log(`Found ${redElements.length} red elements in SVG:`, id);
        
        // Improved approach: find T-shape groups and calculate connection edge
        const tShapeGroups = new Map();
        
        // Detect symbol type based on path or name
        const isTankFloatingRoof = data.symbolPath?.includes('tank_floating_roof');
        const isVesselGeneral = data.symbolPath?.includes('vessel_general');
        const isTankGeneralBasin = data.symbolPath?.includes('tank_general_basin');
        
        // Find all 4 T-junctions based on symbol type
        const tJunctions = {
          top: { h: null, v: null },
          right: { h: null, v: null },
          bottom: { h: null, v: null },
          left: { h: null, v: null }
        };
        
        // First pass: find all horizontal and vertical lines for each T-junction
        Array.from(redElements).forEach((el, index) => {
          if (el.tagName.toLowerCase() === 'path') {
            const d = el.getAttribute('d') || '';
            const parentGroup = el.parentElement;
            
            if (parentGroup) {
              const transform = parentGroup.getAttribute('transform') || '';
              
              if (isTankFloatingRoof) {
                // Tank Floating Roof specific patterns
                // TOP T-junction
                if (transform.includes('translate(24 2)') && transform.includes('rotate(180 2 0)')) {
                  tJunctions.top.h = { transform, element: el };
                }
                if (transform.includes('translate(26 0)') && transform.includes('rotate(180 0 1)')) {
                  tJunctions.top.v = { transform, element: el };
                }
                
                // LEFT T-junction
                if (transform.includes('translate(0 14)') && transform.includes('rotate(90 2 0)')) {
                  tJunctions.left.h = { transform, element: el };
                }
                if (transform.includes('translate(1 13)') && transform.includes('rotate(90 0 1)')) {
                  tJunctions.left.v = { transform, element: el };
                }
                
                // RIGHT T-junction
                if (transform.includes('translate(48 14)') && transform.includes('rotate(270 2 0)')) {
                  tJunctions.right.h = { transform, element: el };
                }
                if (transform.includes('translate(51 13)') && transform.includes('rotate(270 0 1)')) {
                  tJunctions.right.v = { transform, element: el };
                }
                
                // BOTTOM T-junction
                if (transform.includes('translate(24 28)') && !transform.includes('rotate')) {
                  tJunctions.bottom.h = { transform, element: el };
                }
                if (transform.includes('translate(26 28)') && !transform.includes('rotate')) {
                  tJunctions.bottom.v = { transform, element: el };
                }
                
              } else if (isVesselGeneral) {
                // Vessel General specific patterns
                // TOP T-junction
                if (transform.includes('translate(11 2)') && transform.includes('rotate(180 2 0)')) {
                  tJunctions.top.h = { transform, element: el };
                }
                if (transform.includes('translate(13 0)') && transform.includes('rotate(180 0 1)')) {
                  tJunctions.top.v = { transform, element: el };
                }
                
                // LEFT T-junction
                if (transform.includes('translate(0 24)') && transform.includes('rotate(90 2 0)')) {
                  tJunctions.left.h = { transform, element: el };
                }
                if (transform.includes('translate(1 23)') && transform.includes('rotate(90 0 1)')) {
                  tJunctions.left.v = { transform, element: el };
                }
                
                // RIGHT T-junction
                if (transform.includes('translate(22 24)') && transform.includes('rotate(270 2 0)')) {
                  tJunctions.right.h = { transform, element: el };
                }
                if (transform.includes('translate(25 23)') && transform.includes('rotate(270 0 1)')) {
                  tJunctions.right.v = { transform, element: el };
                }
                
                // BOTTOM T-junction
                if (transform.includes('translate(11 46)') && !transform.includes('rotate')) {
                  tJunctions.bottom.h = { transform, element: el };
                }
                if (transform.includes('translate(13 46)') && !transform.includes('rotate')) {
                  tJunctions.bottom.v = { transform, element: el };
                }
                
              } else if (isTankGeneralBasin) {
                // Tank General Basin specific patterns
                // TOP T-junction
                if (transform.includes('translate(23 2)') && transform.includes('rotate(180 2 0)')) {
                  tJunctions.top.h = { transform, element: el };
                }
                if (transform.includes('translate(25 0)') && transform.includes('rotate(180 0 1)')) {
                  tJunctions.top.v = { transform, element: el };
                }
                
                // LEFT T-junction  
                if (transform.includes('translate(1 19)') && transform.includes('rotate(90 2 0)')) {
                  tJunctions.left.h = { transform, element: el };
                }
                if (transform.includes('translate(2 18)') && transform.includes('rotate(90 0 1)')) {
                  tJunctions.left.v = { transform, element: el };
                }
                
                // RIGHT T-junction
                if (transform.includes('translate(45 19)') && transform.includes('rotate(270 2 0)')) {
                  tJunctions.right.h = { transform, element: el };
                }
                if (transform.includes('translate(48 18)') && transform.includes('rotate(270 0 1)')) {
                  tJunctions.right.v = { transform, element: el };
                }
                
                // BOTTOM T-junction
                if (transform.includes('translate(23 36)') && !transform.includes('rotate')) {
                  tJunctions.bottom.h = { transform, element: el };
                }
                if (transform.includes('translate(25 36)') && !transform.includes('rotate')) {
                  tJunctions.bottom.v = { transform, element: el };
                }
              }
            }
          }
        });
        
        // Calculate intersection points for each T-junction
        const junctionPoints = [];
        // Different main group offsets for different symbols
        let mainGroupOffsetX = 0;
        let mainGroupOffsetY = 0;
        
        if (isTankFloatingRoof) {
          mainGroupOffsetX = 6.5;
          mainGroupOffsetY = 18.5;
        } else if (isVesselGeneral) {
          mainGroupOffsetX = 19.5;
          mainGroupOffsetY = 8.5;
        } else if (isTankGeneralBasin) {
          mainGroupOffsetX = 7.5;
          mainGroupOffsetY = 13.5;
        }
        
        // Process each T-junction in the correct order (top, right, bottom, left)
        const orderedPositions = ['top', 'right', 'bottom', 'left'];
        orderedPositions.forEach(position => {
          const junction = tJunctions[position];
          if (junction.h && junction.v) {
            console.log(`Processing ${position} T-junction`);
            
            // Extract coordinates
            const hMatch = junction.h.transform.match(/translate\(([-\d.]+)[\s,]+([-\d.]+)\)/);
            const vMatch = junction.v.transform.match(/translate\(([-\d.]+)[\s,]+([-\d.]+)\)/);
            
            if (hMatch && vMatch) {
              const hX = parseFloat(hMatch[1]);
              const hY = parseFloat(hMatch[2]);
              const vX = parseFloat(vMatch[1]);
              const vY = parseFloat(vMatch[2]);
              
              // Calculate intersection based on position and symbol type
              let intersectionX, intersectionY;
              
              if (isTankFloatingRoof) {
                if (position === 'top') {
                  intersectionX = vX; // Use vertical line X (26)
                  intersectionY = hY; // Use horizontal line Y (2)
                } else if (position === 'left') {
                  intersectionX = hX + 1; // Center of left T (0 + 1 = 1)
                  intersectionY = hY; // Use horizontal line Y (14)
                } else if (position === 'right') {
                  intersectionX = hX + 1.5; // Center of right T (48 + 1.5 = 49.5)
                  intersectionY = hY; // Use horizontal line Y (14)
                } else if (position === 'bottom') {
                  intersectionX = vX; // Use vertical line X (26)
                  intersectionY = hY; // Use horizontal line Y (28)
                }
              } else if (isVesselGeneral) {
                if (position === 'top') {
                  intersectionX = vX; // Use vertical line X (13)
                  intersectionY = hY; // Use horizontal line Y (2)
                } else if (position === 'left') {
                  intersectionX = hX + 1; // Center of left T (0 + 1 = 1)
                  intersectionY = hY; // Use horizontal line Y (24)
                } else if (position === 'right') {
                  intersectionX = hX + 1.5; // Center of right T (22 + 1.5 = 23.5)
                  intersectionY = hY; // Use horizontal line Y (24)
                } else if (position === 'bottom') {
                  intersectionX = vX; // Use vertical line X (13)
                  intersectionY = hY; // Use horizontal line Y (46)
                }
              } else if (isTankGeneralBasin) {
                if (position === 'top') {
                  intersectionX = vX; // Use vertical line X (25)
                  intersectionY = hY; // Use horizontal line Y (2)
                } else if (position === 'left') {
                  intersectionX = hX + 1; // Center of left T (1 + 1 = 2)
                  intersectionY = hY; // Use horizontal line Y (19)
                } else if (position === 'right') {
                  intersectionX = hX + 1.5; // Center of right T (45 + 1.5 = 46.5)
                  intersectionY = hY; // Use horizontal line Y (19)
                } else if (position === 'bottom') {
                  intersectionX = vX; // Use vertical line X (25)
                  intersectionY = hY; // Use horizontal line Y (36)
                }
              }
              
              // Apply main group offset
              const absoluteX = mainGroupOffsetX + intersectionX;
              const absoluteY = mainGroupOffsetY + intersectionY;
              
              // Scale to actual symbol size
              let scaledX = absoluteX * scaleX;
              let scaledY = absoluteY * scaleY;
              
              // Add 0.7px adjustment to move handles slightly right
              // This compensates for the slight left shift from T-junction calculations
              if (position === 'left' || position === 'right') {
                scaledX += 0.7;
              }
              
              // Determine Position enum value and handle index
              let positionEnum;
              let handleIndex;
              if (position === 'top') {
                positionEnum = Position.Top;
                handleIndex = 0;
              } else if (position === 'right') {
                positionEnum = Position.Right;
                handleIndex = 1;
              } else if (position === 'bottom') {
                positionEnum = Position.Bottom;
                handleIndex = 2;
              } else if (position === 'left') {
                positionEnum = Position.Left;
                handleIndex = 3;
              }
              
              junctionPoints.push({
                x: scaledX,
                y: scaledY,
                id: `handle-${handleIndex}`,
                position: positionEnum
              });
              
              console.log(`${position} T-junction at (${scaledX}, ${scaledY})`);
            }
          }
        });
        
        // Use all detected T-junction points
        if (junctionPoints.length > 0) {
          connectionPoints = junctionPoints;
          console.log(`Using ${junctionPoints.length} T-junctions for ${id}`);
        } else {
          console.log('No T-junctions found, using fallback');
          connectionPoints = []; // Will trigger fallback handles
        }
        // Skip the complex logic for now - we're testing simple approach
        
        // Debug logging to understand connection points (disabled for performance)
        // console.log(`Node ${id} connection points:`, connectionPoints.length, connectionPoints);
        // console.log(`Node dimensions: ${data.width}x${data.height}`);
        
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
    // Position handle exactly at T-shape center
    // Ensure we're at the exact calculated position
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
  
  // Determine if handles should be connectable based on connection state
  $: isThisNodeConnecting = connectingNodeId === id;
  $: isOtherNodeConnecting = isConnecting && connectingNodeId !== id && connectingNodeId !== null;
  
  // When this node starts connecting, it acts as source (only source handles enabled)
  // When another node is connecting, this node can be target (only target handles enabled)
  // When no connection is happening, both handles are enabled
  $: sourceHandlesEnabled = !isConnecting || isThisNodeConnecting;
  $: targetHandlesEnabled = !isConnecting || isOtherNodeConnecting;
  
  // Cleanup on component destroy
  onDestroy(() => {
    // Remove event listeners
    window.removeEventListener('connection-start', handleConnectionStart as EventListener);
    window.removeEventListener('connection-end', handleConnectionEnd as EventListener);
    
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
  
  <!-- Always render 4 fixed handles at standard positions (top, right, bottom, left) -->
  <!-- Each position has BOTH source and target handles for bidirectional connections -->
  <!-- Handles are dynamically enabled based on connection state -->
  
  <!-- Store T-intersection depths for each handle direction -->
  <div style="display:none" 
       data-t-depth-top="{connectionPoints.find(p => p.y < data.height * 0.4)?.edgeDistance || 12}"
       data-t-depth-right="{connectionPoints.find(p => p.x > data.width * 0.6)?.edgeDistance || 12}"
       data-t-depth-bottom="{connectionPoints.find(p => p.y > data.height * 0.6)?.edgeDistance || 12}"
       data-t-depth-left="{connectionPoints.find(p => p.x < data.width * 0.4)?.edgeDistance || 12}"
       data-node-id="{id}"
       id="t-depths-{id}">
  </div>
  
  <!-- Dynamic handles positioned at actual T-junction points -->
  {#if $handleVisibility}
    {#each connectionPoints as point, index}
      <!-- Use position from point if available, otherwise calculate it -->
      {@const handlePosition = point.position || getHandlePosition(point)}
      
      <!-- Source handle at T-junction -->
      <Handle
        type="source"
        position={handlePosition}
        id={point.id}
        style="left: {(point.x / data.width) * 100}%; top: {(point.y / data.height) * 100}%; transform: translate(-50%, -50%);"
        class="connection-handle connection-handle-source"
        isConnectable={sourceHandlesEnabled}
      />
      
      <!-- Target handle at T-junction (overlapping) -->
      <Handle
        type="target"
        position={handlePosition}
        id={point.id}
        style="left: {(point.x / data.width) * 100}%; top: {(point.y / data.height) * 100}%; transform: translate(-50%, -50%);"
        class="connection-handle connection-handle-target"
        isConnectable={targetHandlesEnabled}
      />
    {/each}
  {/if}
  
  <!-- Fallback handles if no T-junctions detected -->
  {#if connectionPoints.length === 0 && $handleVisibility}
    <!-- Top Handle -->
    <Handle
      type="source"
      position={Position.Top}
      id="handle-0"
      style="left: 50%; top: 0%;"
      isConnectable={sourceHandlesEnabled}
    />
    <Handle
      type="target"
      position={Position.Top}
      id="handle-0"
      style="left: 50%; top: 0%;"
      isConnectable={targetHandlesEnabled}
    />
    
    <!-- Right Handle -->
    <Handle
      type="source"
      position={Position.Right}
      id="handle-1"
      style="left: 100%; top: 50%;"
      isConnectable={sourceHandlesEnabled}
    />
    <Handle
      type="target"
      position={Position.Right}
      id="handle-1"
      style="left: 100%; top: 50%;"
      isConnectable={targetHandlesEnabled}
    />
    
    <!-- Bottom Handle -->
    <Handle
      type="source"
      position={Position.Bottom}
      id="handle-2"
      style="left: 50%; top: 100%;"
      isConnectable={sourceHandlesEnabled}
    />
    <Handle
      type="target"
      position={Position.Bottom}
      id="handle-2"
      style="left: 50%; top: 100%;"
      isConnectable={targetHandlesEnabled}
    />
    
    <!-- Left Handle -->
    <Handle
      type="source"
      position={Position.Left}
      id="handle-3"
      style="left: 0%; top: 50%;"
      isConnectable={sourceHandlesEnabled}
    />
    <Handle
      type="target"
      position={Position.Left}
      id="handle-3"
      style="left: 0%; top: 50%;"
      isConnectable={targetHandlesEnabled}
    />
  {/if}
  
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
  
  /* Connection handles - visible square handles */
  :global(.connection-handle) {
    /* Visible handle for connection */
    width: 8px !important;
    height: 8px !important;
    background: #ff0000 !important;
    border: none !important;
    border-radius: 0% !important;
    overflow: visible !important;
    cursor: crosshair;
    pointer-events: all;
    z-index: 100 !important;
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
  
  /* Ensure both source and target handles overlap perfectly and are below edges */
  :global(.connection-handle-source),
  :global(.connection-handle-target) {
    position: absolute;
    z-index: 100 !important; /* Below edges (which are z-index 9999) */
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
    /* Removed transition to prevent drag stuttering */
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