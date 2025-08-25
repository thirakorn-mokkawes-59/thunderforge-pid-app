<script>
  import { onMount, onDestroy } from 'svelte';
  
  let observer = null;
  
  // This component ensures edge markers are defined in the SVG
  onMount(() => {
    // Function to setup markers
    const setupMarkers = () => {
      const svgElement = document.querySelector('.svelte-flow__edges svg');
      if (!svgElement) {
        // Try again if SVG not ready
        setTimeout(setupMarkers, 10);
        return;
      }
      
      let defs = svgElement.querySelector('defs');
      if (!defs) {
        defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
        svgElement.prepend(defs);
      }
      
      // Create a generic sharp arrow marker that all edges can use
      if (!defs.querySelector('#sharp-arrow-marker')) {
        const marker = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
        marker.setAttribute('id', 'sharp-arrow-marker');
        marker.setAttribute('viewBox', '0 0 8.8 7');
        marker.setAttribute('refX', '0');
        marker.setAttribute('refY', '3.5');
        marker.setAttribute('markerWidth', '8.8');
        marker.setAttribute('markerHeight', '7');
        marker.setAttribute('orient', 'auto');
        marker.setAttribute('markerUnits', 'userSpaceOnUse');
        
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', 'M 8.8 3.5 L 0 0 L 0 7 Z');
        path.setAttribute('fill', 'currentColor'); // Use currentColor to inherit stroke color
        
        marker.appendChild(path);
        defs.appendChild(marker);
      }
    };
    
    // Setup markers immediately
    setupMarkers();
    
    // Also watch for any new SVG elements that might be created
    observer = new MutationObserver(() => {
      setupMarkers();
    });
    
    // Observe the entire flow container for changes
    const flowContainer = document.querySelector('.svelte-flow');
    if (flowContainer) {
      observer.observe(flowContainer, { 
        childList: true, 
        subtree: true 
      });
    }
    
    return () => {
      if (observer) {
        observer.disconnect();
      }
    };
  });
</script>

<!-- This component has no visual output, it just sets up SVG markers -->