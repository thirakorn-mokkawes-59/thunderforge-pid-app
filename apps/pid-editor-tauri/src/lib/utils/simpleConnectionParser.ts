/**
 * Simplified Connection Point Parser for P&ID Symbols
 * Focuses on extracting red connection markers from SVG
 */

export interface SimpleConnectionPoint {
  x: number;
  y: number;
  color: string;
}

/**
 * Simple parser that just finds all red stroked elements and their positions
 */
export function parseConnectionPointsSimple(svgContent: string): SimpleConnectionPoint[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgContent, 'image/svg+xml');
  const svgElement = doc.querySelector('svg');
  
  if (!svgElement) {
    console.warn('No SVG element found');
    return [];
  }

  const connectionPoints: SimpleConnectionPoint[] = [];
  
  // Find all elements with red stroke
  const redElements = svgElement.querySelectorAll('[stroke="#ff0000"]');
  console.log('Found red elements:', redElements.length);
  
  redElements.forEach((element, index) => {
    // Get the parent g element which should have the transform
    const parentG = element.closest('g[transform]');
    if (parentG) {
      const transform = parentG.getAttribute('transform');
      console.log(`Red element ${index} transform:`, transform);
      
      if (transform) {
        // Parse transform to get x,y coordinates
        // Handle translate(x y) or translate(x, y)
        const translateMatch = transform.match(/translate\(([^)]+)\)/);
        if (translateMatch) {
          const coords = translateMatch[1].split(/[,\s]+/).map(Number);
          const x = coords[0] || 0;
          const y = coords[1] || 0;
          
          // Also need to account for parent group transforms
          let totalX = x;
          let totalY = y;
          
          // Check if there's a parent group with additional transform
          let ancestor = parentG.parentElement;
          while (ancestor && ancestor.tagName === 'g') {
            const ancestorTransform = ancestor.getAttribute('transform');
            if (ancestorTransform) {
              const ancestorMatch = ancestorTransform.match(/translate\(([^)]+)\)/);
              if (ancestorMatch) {
                const ancestorCoords = ancestorMatch[1].split(/[,\s]+/).map(Number);
                totalX += ancestorCoords[0] || 0;
                totalY += ancestorCoords[1] || 0;
              }
            }
            ancestor = ancestor.parentElement;
          }
          
          connectionPoints.push({
            x: totalX,
            y: totalY,
            color: '#ff0000'
          });
          
          console.log(`Connection point ${index}: (${totalX}, ${totalY})`);
        }
      }
    }
  });
  
  // Also look for small black elements that might be connection points
  // These would be the black T-shapes
  const blackPaths = svgElement.querySelectorAll('path[stroke="#000000"]');
  blackPaths.forEach((element) => {
    const d = element.getAttribute('d') || '';
    // Check if it's a small path (likely a connection marker)
    const coords = d.match(/[\d.]+/g)?.map(Number) || [];
    const maxCoord = Math.max(...coords);
    
    if (maxCoord <= 5) { // Small geometric shape
      const parentG = element.closest('g[transform]');
      if (parentG) {
        const transform = parentG.getAttribute('transform');
        if (transform) {
          const translateMatch = transform.match(/translate\(([^)]+)\)/);
          if (translateMatch) {
            const coords = translateMatch[1].split(/[,\s]+/).map(Number);
            const x = coords[0] || 0;
            const y = coords[1] || 0;
            
            // Account for parent transforms
            let totalX = x;
            let totalY = y;
            
            let ancestor = parentG.parentElement;
            while (ancestor && ancestor.tagName === 'g') {
              const ancestorTransform = ancestor.getAttribute('transform');
              if (ancestorTransform) {
                const ancestorMatch = ancestorTransform.match(/translate\(([^)]+)\)/);
                if (ancestorMatch) {
                  const ancestorCoords = ancestorMatch[1].split(/[,\s]+/).map(Number);
                  totalX += ancestorCoords[0] || 0;
                  totalY += ancestorCoords[1] || 0;
                }
              }
              ancestor = ancestor.parentElement;
            }
            
            connectionPoints.push({
              x: totalX,
              y: totalY,
              color: '#000000'
            });
          }
        }
      }
    }
  });
  
  return connectionPoints;
}

/**
 * Get connection points for a symbol element on the canvas
 */
export function getSimpleElementConnectionPoints(
  element: any, // DiagramElement
  connectionPoints: SimpleConnectionPoint[]
): SimpleConnectionPoint[] {
  // Scale connection points to element's position and size
  // Assuming original viewBox is 64x64
  const scale = element.width / 64;
  
  return connectionPoints.map(point => ({
    ...point,
    x: element.x + (point.x * scale),
    y: element.y + (point.y * scale)
  }));
}