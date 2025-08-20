<script lang="ts">
  import { getSmoothStepPath } from '@xyflow/svelte';
  import { onMount } from 'svelte';
  import type { EdgeProps } from '@xyflow/svelte';

  type $$Props = EdgeProps;

  export let id: $$Props['id'];
  export let sourceX: $$Props['sourceX'];
  export let sourceY: $$Props['sourceY'];  
  export let targetX: $$Props['targetX'];
  export let targetY: $$Props['targetY'];
  export let sourcePosition: $$Props['sourcePosition'];
  export let targetPosition: $$Props['targetPosition'];
  export let style: $$Props['style'] = '';
  export let data: $$Props['data'] = {};
  export let label: $$Props['label'] = undefined;

  // Configuration constants
  const HANDLE_OFFSET = 4;  // Offset from handle border (half of 8px handle)
  const ARROW_LENGTH = 8.8;   // Length of arrow (from SVG)
  const ARROW_WIDTH = 7;     // Width of arrow (from SVG)
  
  // Adjust source position
  let adjSourceX = sourceX;
  let adjSourceY = sourceY;
  if (sourcePosition === 'left') adjSourceX += HANDLE_OFFSET;
  else if (sourcePosition === 'right') adjSourceX -= HANDLE_OFFSET;
  else if (sourcePosition === 'top') adjSourceY += HANDLE_OFFSET;
  else if (sourcePosition === 'bottom') adjSourceY -= HANDLE_OFFSET;
  
  // Adjust target position - same as source calculation, then subtract arrow length
  // First apply handle offset (same as source), then pull back by arrow length
  let adjTargetX = targetX;
  let adjTargetY = targetY;
  
  if (targetPosition === 'left') {
    // First apply handle offset, then subtract arrow length
    adjTargetX = targetX + HANDLE_OFFSET - ARROW_LENGTH;
  } else if (targetPosition === 'right') {
    // First apply handle offset, then subtract arrow length
    adjTargetX = targetX - HANDLE_OFFSET + ARROW_LENGTH;
  } else if (targetPosition === 'top') {
    // First apply handle offset, then subtract arrow length
    adjTargetY = targetY + HANDLE_OFFSET - ARROW_LENGTH;
  } else if (targetPosition === 'bottom') {
    // First apply handle offset, then subtract arrow length
    adjTargetY = targetY - HANDLE_OFFSET + ARROW_LENGTH;
  }
  
  // Get edge path
  const [edgePath] = getSmoothStepPath({
    sourceX: adjSourceX,
    sourceY: adjSourceY,
    targetX: adjTargetX,
    targetY: adjTargetY,
    sourcePosition,
    targetPosition,
  });
  
  // Extract stroke color from style if provided
  const strokeColor = style?.match(/stroke:\s*([^;]+)/)?.[1] || '#000000';
  
  // Create unique marker ID for this edge
  const markerId = `sharp-arrow-marker-${id}`;
  
  // Inject marker definition on mount
  onMount(() => {
    const svgElement = document.querySelector('.svelte-flow__edges svg');
    if (!svgElement) return;
    
    let defs = svgElement.querySelector('defs');
    if (!defs) {
      defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
      svgElement.prepend(defs);
    }
    
    // Check if marker already exists
    if (defs.querySelector(`#${markerId}`)) return;
    
    // Create marker element
    const marker = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
    marker.setAttribute('id', markerId);
    marker.setAttribute('viewBox', '0 0 8.8 7');
    marker.setAttribute('refX', '0'); // Position at arrow base (since line stops at base)
    marker.setAttribute('refY', '3.5');
    marker.setAttribute('markerWidth', '8.8');
    marker.setAttribute('markerHeight', '7');
    marker.setAttribute('orient', 'auto');
    marker.setAttribute('markerUnits', 'userSpaceOnUse');
    
    // Create the sharp triangle path (from sharp-triangle.svg)
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', 'M 8.8 3.5 L 0 0 L 0 7 Z');
    path.setAttribute('fill', strokeColor);
    
    marker.appendChild(path);
    defs.appendChild(marker);
    
    return () => {
      // Cleanup marker on unmount
      const markerToRemove = defs?.querySelector(`#${markerId}`);
      if (markerToRemove) markerToRemove.remove();
    };
  });
</script>

<g>
  <!-- Main edge path with marker -->
  <path
    id={id}
    d={edgePath}
    fill="none"
    stroke={strokeColor}
    stroke-width="2"
    marker-end={`url(#${markerId})`}
    class="svelte-flow__edge-path"
    {style}
  />
  
  <!-- Interaction path for easier clicking -->
  <path
    d={edgePath}
    fill="none"
    stroke="transparent"
    stroke-width="20"
    class="svelte-flow__edge-interaction"
  />
  
  <!-- Optional label -->
  {#if label}
    <text
      x={(adjSourceX + adjTargetX) / 2}
      y={(adjSourceY + adjTargetY) / 2}
      text-anchor="middle"
      dominant-baseline="middle"
      font-size="12"
      fill="#000000"
      class="svelte-flow__edge-label"
    >
      {label}
    </text>
  {/if}
</g>