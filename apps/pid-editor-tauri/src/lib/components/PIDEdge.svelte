<script lang="ts">
  import { getSmoothStepPath } from '@xyflow/svelte';
  import type { EdgeProps } from '@xyflow/svelte';
  import { onMount } from 'svelte';

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
  
  // Track if component is mounted to ensure fresh calculations
  let mounted = false;
  let initialized = false;
  
  onMount(() => {
    mounted = true;
    // Force immediate recalculation on mount to override any cached positions
    setTimeout(() => {
      initialized = true;
      recalculatePath();
    }, 0);
    
    return () => {
      mounted = false;
      initialized = false;
    };
  });

  // Configuration constants
  const HANDLE_OFFSET = 4;  // Offset from handle border (half of 8px handle)
  const ARROW_LENGTH = 8.8;   // Length of arrow (from SVG)
  const ARROW_WIDTH = 7;     // Width of arrow (from SVG)
  
  let edgePath = '';
  let adjSourceX = sourceX;
  let adjSourceY = sourceY;
  let adjTargetX = targetX;
  let adjTargetY = targetY;
  
  function recalculatePath() {
    // Adjust source position
    adjSourceX = sourceX;
    adjSourceY = sourceY;
    if (sourcePosition === 'left') adjSourceX += HANDLE_OFFSET;
    else if (sourcePosition === 'right') adjSourceX -= HANDLE_OFFSET;
    else if (sourcePosition === 'top') adjSourceY += HANDLE_OFFSET;
    else if (sourcePosition === 'bottom') adjSourceY -= HANDLE_OFFSET;
    
    // Adjust target position - same as source calculation, then subtract arrow length
    // First apply handle offset (same as source), then pull back by arrow length
    adjTargetX = targetX;
    adjTargetY = targetY;
    
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
    
    // Get edge path - using smooth step with borderRadius: 0 for sharp 90-degree corners
    const [path] = getSmoothStepPath({
      sourceX: adjSourceX,
      sourceY: adjSourceY,
      targetX: adjTargetX,
      targetY: adjTargetY,
      sourcePosition,
      targetPosition,
      borderRadius: 0  // This creates sharp 90-degree corners
    });
    
    edgePath = path;
  }
  
  // Recalculate whenever props change or component initializes
  $: if (sourceX !== undefined && targetX !== undefined) {
    recalculatePath();
  }
  
  // Force recalculation when initialized changes
  $: if (initialized) {
    recalculatePath();
  }
  
  // Extract stroke color from style if provided
  const strokeColor = style?.match(/stroke:\s*([^;]+)/)?.[1] || '#000000';
</script>

<g>
  <!-- Main edge path with marker -->
  <path
    id={id}
    d={edgePath}
    fill="none"
    stroke={strokeColor}
    stroke-width="2"
    marker-end="url(#sharp-arrow-marker)"
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