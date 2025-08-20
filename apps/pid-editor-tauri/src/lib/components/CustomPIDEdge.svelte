<script lang="ts">
  import { BaseEdge, getStraightPath, getStepPath, type EdgeProps } from '@xyflow/svelte';
  
  type $$Props = EdgeProps;
  
  export let id: $$Props['id'];
  export let sourceX: $$Props['sourceX'];
  export let sourceY: $$Props['sourceY'];
  export let targetX: $$Props['targetX'];
  export let targetY: $$Props['targetY'];
  export let sourcePosition: $$Props['sourcePosition'];
  export let targetPosition: $$Props['targetPosition'];
  export let markerEnd: $$Props['markerEnd'];
  export let style: $$Props['style'] = '';
  export let data: $$Props['data'] = {};
  
  // Get offsets from data or use defaults
  $: offsetStart = data?.offsetStart || 0;
  $: offsetEnd = data?.offsetEnd || 0;
  
  // Calculate extended positions to eliminate gaps
  $: extendedPath = calculateExtendedPath(
    sourceX, sourceY, 
    targetX, targetY,
    offsetStart, offsetEnd
  );
  
  function calculateExtendedPath(sx: number, sy: number, tx: number, ty: number, startOffset: number, endOffset: number) {
    // Calculate direction vector
    const dx = tx - sx;
    const dy = ty - sy;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    if (distance === 0) {
      // If points are the same, use original positions
      return getStepPath({
        sourceX: sx,
        sourceY: sy,
        targetX: tx,
        targetY: ty,
        sourcePosition,
        targetPosition
      });
    }
    
    // Normalize direction vector
    const unitX = dx / distance;
    const unitY = dy / distance;
    
    // Apply offsets (negative values extend INTO the symbols)
    const extendedSourceX = sx - unitX * startOffset;
    const extendedSourceY = sy - unitY * startOffset;
    const extendedTargetX = tx + unitX * endOffset;
    const extendedTargetY = ty + unitY * endOffset;
    
    // Use step path for P&ID style routing
    return getStepPath({
      sourceX: extendedSourceX,
      sourceY: extendedSourceY,
      targetX: extendedTargetX,
      targetY: extendedTargetY,
      sourcePosition,
      targetPosition
    });
  }
</script>

<BaseEdge 
  {id}
  path={extendedPath[0]}
  {markerEnd}
  {style}
/>