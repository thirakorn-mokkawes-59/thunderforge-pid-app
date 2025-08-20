<script lang="ts">
  import { BaseEdge, getSmoothStepPath } from '@xyflow/svelte';
  import type { EdgeProps } from '@xyflow/svelte';

  type $$Props = EdgeProps;

  export let id: $$Props['id'];
  export let sourceX: $$Props['sourceX'];
  export let sourceY: $$Props['sourceY'];
  export let targetX: $$Props['targetX'];
  export let targetY: $$Props['targetY'];
  export let sourcePosition: $$Props['sourcePosition'];
  export let targetPosition: $$Props['targetPosition'];
  export let style: $$Props['style'] = undefined;
  export let markerEnd: $$Props['markerEnd'] = undefined;
  export let markerStart: $$Props['markerStart'] = undefined;
  export let data: $$Props['data'] = undefined;

  // Extract offset values from data - use larger offsets to penetrate INTO symbols
  $: offsetStart = data?.offsetStart || 15;
  $: offsetEnd = data?.offsetEnd || 15;

  // Calculate extended path with offsets using step path
  $: extendedPath = (() => {
    // Calculate direction vectors for each handle position
    let extendedSourceX = sourceX;
    let extendedSourceY = sourceY;
    let extendedTargetX = targetX;
    let extendedTargetY = targetY;
    
    // Extend INTO the source symbol based on source position
    // Positive offset extends the edge INTO the symbol (past the handle point)
    if (sourcePosition === 0) { // Top - edge coming OUT from top
      extendedSourceY = sourceY - offsetStart; // Move up into symbol
    } else if (sourcePosition === 1) { // Right - edge coming OUT from right
      extendedSourceX = sourceX + offsetStart; // Move right into symbol
    } else if (sourcePosition === 2) { // Bottom - edge coming OUT from bottom
      extendedSourceY = sourceY + offsetStart; // Move down into symbol
    } else if (sourcePosition === 3) { // Left - edge coming OUT from left
      extendedSourceX = sourceX - offsetStart; // Move left into symbol
    }
    
    // Extend INTO the target symbol based on target position  
    // Positive offset extends the edge INTO the symbol (past the handle point)
    if (targetPosition === 0) { // Top - edge coming IN from top
      extendedTargetY = targetY - offsetEnd; // Move up into symbol
    } else if (targetPosition === 1) { // Right - edge coming IN from right
      extendedTargetX = targetX + offsetEnd; // Move right into symbol
    } else if (targetPosition === 2) { // Bottom - edge coming IN from bottom
      extendedTargetY = targetY + offsetEnd; // Move down into symbol
    } else if (targetPosition === 3) { // Left - edge coming IN from left
      extendedTargetX = targetX - offsetEnd; // Move left into symbol
    }
    
    return getSmoothStepPath({
      sourceX: extendedSourceX,
      sourceY: extendedSourceY,
      targetX: extendedTargetX,
      targetY: extendedTargetY,
      sourcePosition,
      targetPosition,
      borderRadius: 0 // Use 0 radius for sharp corners like step edges
    });
  })();

  $: [edgePath] = extendedPath;
  
  // Debug logging disabled for production - uncomment to debug edge offsets
  // $: if (id && (offsetStart || offsetEnd)) {
  //   console.log(`CustomEdge ${id}: offsets = ${offsetStart}/${offsetEnd}`);
  //   console.log(`Source pos: ${sourcePosition}, Target pos: ${targetPosition}`);
  //   console.log(`Original: (${sourceX.toFixed(1)}, ${sourceY.toFixed(1)}) -> (${targetX.toFixed(1)}, ${targetY.toFixed(1)})`);
  // }
</script>

<BaseEdge 
  {id}
  path={edgePath}
  {style}
  {markerEnd}
  {markerStart}
/>