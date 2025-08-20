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

  // Get T-intersection depth from DOM for precise connection
  function getTIntersectionDepth(nodeId, position) {
    try {
      const depthElement = document.getElementById(`t-depths-${nodeId}`);
      if (!depthElement) return 12; // Fallback
      
      const positionMap = {
        'top': 'data-t-depth-top',
        'right': 'data-t-depth-right', 
        'bottom': 'data-t-depth-bottom',
        'left': 'data-t-depth-left'
      };
      
      const depth = depthElement.getAttribute(positionMap[position]);
      return parseFloat(depth) || 12;
    } catch (error) {
      return 12; // Fallback on error
    }
  }
  
  // Auto-calculate optimal offset based on T-intersection position
  function calculateOptimalOffset(nodeData, nodeId, position) {
    // First try to get exact T-intersection depth
    if (nodeId && position) {
      const tDepth = getTIntersectionDepth(nodeId, position);
      // Add small buffer to ensure we reach the T-intersection
      return Math.max(8, Math.min(tDepth + 2, 30));
    }
    
    // Fallback to symbol-based calculation
    let offset = 12;
    
    // Adjust based on symbol size (larger symbols need more offset)
    if (nodeData?.width) {
      const sizeRatio = nodeData.width / 60; // 60px is default size
      offset = Math.round(12 * sizeRatio); // Scale offset proportionally
    }
    
    // Adjust for stroke width (thicker strokes need more offset)
    if (nodeData?.strokeWidth) {
      offset += Math.round(nodeData.strokeWidth);
    }
    
    // Ensure minimum and maximum bounds
    return Math.max(8, Math.min(offset, 25)); // Between 8px and 25px
  }
  
  // Get node data if available (would need to be passed from parent)
  $: sourceNodeData = data?.sourceNodeData;
  $: targetNodeData = data?.targetNodeData;
  $: sourceNodeId = data?.sourceNodeId;
  $: targetNodeId = data?.targetNodeId;
  
  // Since handles are now positioned exactly at T-junctions, no offset needed for flush connections
  $: offsetStart = 0; // No offset - handles are at precise T-junction positions
  $: offsetEnd = 0;   // No offset - handles are at precise T-junction positions

  // Calculate extended path with offsets using step path
  $: extendedPath = (() => {
    // Calculate direction vectors for each handle position
    let extendedSourceX = sourceX;
    let extendedSourceY = sourceY;
    let extendedTargetX = targetX;
    let extendedTargetY = targetY;
    
    // Extend INTO the source symbol based on source position
    // Handles are at the edge, we need to move INWARD toward center
    if (sourcePosition === 'top') {
      extendedSourceY = sourceY + offsetStart; // Move DOWN into symbol
    } else if (sourcePosition === 'right') {
      extendedSourceX = sourceX - offsetStart; // Move LEFT into symbol
    } else if (sourcePosition === 'bottom') {
      extendedSourceY = sourceY - offsetStart; // Move UP into symbol
    } else if (sourcePosition === 'left') {
      extendedSourceX = sourceX + offsetStart; // Move RIGHT into symbol
    }
    
    // Extend INTO the target symbol based on target position
    // Handles are at the edge, we need to move INWARD toward center
    if (targetPosition === 'top') {
      extendedTargetY = targetY + offsetEnd; // Move DOWN into symbol
    } else if (targetPosition === 'right') {
      extendedTargetX = targetX - offsetEnd; // Move LEFT into symbol
    } else if (targetPosition === 'bottom') {
      extendedTargetY = targetY - offsetEnd; // Move UP into symbol
    } else if (targetPosition === 'left') {
      extendedTargetX = targetX + offsetEnd; // Move RIGHT into symbol
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