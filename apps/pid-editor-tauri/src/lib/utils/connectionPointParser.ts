/**
 * Connection Point Parser for P&ID Symbols
 * Extracts connection points from SVG symbols based on red and black connection markers
 */

export interface ParsedConnectionPoint {
  x: number;
  y: number;
  type: 'input' | 'output' | 'bidirectional';
  color: 'red' | 'black';
  direction: 'top' | 'bottom' | 'left' | 'right' | 'center';
}

export interface SymbolConnectionData {
  connectionPoints: ParsedConnectionPoint[];
  symbolBounds: { width: number; height: number };
}

/**
 * Parse connection points from SVG content
 */
export function parseConnectionPoints(svgContent: string): SymbolConnectionData {
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgContent, 'image/svg+xml');
  const svgElement = doc.querySelector('svg');
  
  if (!svgElement) {
    return { connectionPoints: [], symbolBounds: { width: 64, height: 64 } };
  }

  const connectionPoints: ParsedConnectionPoint[] = [];
  
  // Get symbol bounds from viewBox
  const viewBox = svgElement.getAttribute('viewBox') || '0 0 64 64';
  const [, , width, height] = viewBox.split(' ').map(Number);
  const symbolBounds = { width, height };

  // Find red connection points (primary markers)
  const redElements = svgElement.querySelectorAll('[stroke="#ff0000"]');
  redElements.forEach((element, index) => {
    const point = extractConnectionPoint(element, 'red', symbolBounds);
    if (point) {
      connectionPoints.push(point);
    }
  });

  // Find black/grey connection points (secondary markers)
  const blackElements = svgElement.querySelectorAll('[stroke="#000000"]');
  blackElements.forEach((element, index) => {
    // Only consider small elements that look like connection markers
    if (isConnectionMarker(element)) {
      const point = extractConnectionPoint(element, 'black', symbolBounds);
      if (point) {
        connectionPoints.push(point);
      }
    }
  });

  return { connectionPoints, symbolBounds };
}

/**
 * Extract connection point coordinates and properties from SVG element
 */
function extractConnectionPoint(
  element: Element, 
  color: 'red' | 'black',
  symbolBounds: { width: number; height: number }
): ParsedConnectionPoint | null {
  try {
    // Get the parent g element's transform if it exists
    let transform = { x: 0, y: 0 };
    
    // Check if this element is inside a g with transform
    let parent = element.parentElement;
    while (parent && parent.tagName !== 'svg') {
      const parentTransform = parent.getAttribute('transform');
      if (parentTransform) {
        const parsed = parseTransform(parentTransform);
        if (parsed) {
          transform.x += parsed.x;
          transform.y += parsed.y;
        }
      }
      parent = parent.parentElement;
    }

    // If no transform found, skip
    if (transform.x === 0 && transform.y === 0) {
      return null;
    }
    
    // Determine direction based on position relative to symbol center
    const direction = getConnectionDirection(transform.x, transform.y, symbolBounds);
    
    // Determine connection type based on position and direction
    const type = inferConnectionType(transform.x, transform.y, direction, symbolBounds);

    return {
      x: transform.x,
      y: transform.y,
      type,
      color,
      direction
    };
  } catch (error) {
    console.warn('Error parsing connection point:', error);
    return null;
  }
}

/**
 * Check if element looks like a connection marker (small geometric shape)
 */
function isConnectionMarker(element: Element): boolean {
  const strokeWidth = element.getAttribute('stroke-width');
  const width = parseFloat(strokeWidth || '0');
  
  // Connection markers typically have small stroke width
  if (width > 1) return false;
  
  // Check if it's a path element with small coordinates
  if (element.tagName === 'path') {
    const d = element.getAttribute('d') || '';
    // Look for small coordinate values typical of connection markers
    const coords = d.match(/[\d.]+/g)?.map(Number) || [];
    const maxCoord = Math.max(...coords);
    return maxCoord <= 10; // Small geometric shapes
  }
  
  return false;
}

/**
 * Extract transform coordinates from SVG element
 */
function getElementTransform(element: Element): { x: number; y: number } | null {
  // Check parent groups for transform attributes
  let currentElement: Element | null = element;
  let totalX = 0;
  let totalY = 0;
  
  while (currentElement && currentElement.tagName !== 'svg') {
    const transform = currentElement.getAttribute('transform');
    if (transform) {
      const translate = parseTransform(transform);
      if (translate) {
        totalX += translate.x;
        totalY += translate.y;
      }
    }
    currentElement = currentElement.parentElement;
  }
  
  return totalX !== 0 || totalY !== 0 ? { x: totalX, y: totalY } : null;
}

/**
 * Parse transform attribute to extract translation
 */
function parseTransform(transform: string): { x: number; y: number } | null {
  // Handle translate(x, y) or translate(x y)
  const translateMatch = transform.match(/translate\(([^)]+)\)/);
  if (translateMatch) {
    const coords = translateMatch[1].split(/[,\s]+/).map(Number);
    return { x: coords[0] || 0, y: coords[1] || 0 };
  }
  return null;
}

/**
 * Determine connection direction based on position
 */
function getConnectionDirection(
  x: number, 
  y: number, 
  bounds: { width: number; height: number }
): 'top' | 'bottom' | 'left' | 'right' | 'center' {
  const centerX = bounds.width / 2;
  const centerY = bounds.height / 2;
  const threshold = 8; // Pixels from edge to consider as edge connection
  
  if (y <= threshold) return 'top';
  if (y >= bounds.height - threshold) return 'bottom';
  if (x <= threshold) return 'left';
  if (x >= bounds.width - threshold) return 'right';
  
  return 'center';
}

/**
 * Infer connection type based on position and direction
 */
function inferConnectionType(
  x: number, 
  y: number, 
  direction: string,
  bounds: { width: number; height: number }
): 'input' | 'output' | 'bidirectional' {
  // For P&ID symbols, common conventions:
  // - Top connections: often outputs (vapor, gas)
  // - Bottom connections: often outputs (liquid)
  // - Side connections: often inputs or bidirectional
  
  switch (direction) {
    case 'top':
      return 'output'; // Vapor/gas outlet
    case 'bottom':
      return 'output'; // Liquid outlet
    case 'left':
      return 'input'; // Feed inlet (left-to-right flow convention)
    case 'right':
      return 'output'; // Product outlet
    default:
      return 'bidirectional'; // General purpose connection
  }
}

/**
 * Get connection points for a symbol element on the canvas
 */
export function getElementConnectionPoints(
  element: any, // DiagramElement
  svgContent: string
): ParsedConnectionPoint[] {
  const parsed = parseConnectionPoints(svgContent);
  
  // Transform connection points to element's position and scale
  return parsed.connectionPoints.map(point => ({
    ...point,
    x: element.x + (point.x * element.width / parsed.symbolBounds.width),
    y: element.y + (point.y * element.height / parsed.symbolBounds.height)
  }));
}

/**
 * Find the nearest connection point to given coordinates
 */
export function findNearestConnectionPoint(
  targetX: number,
  targetY: number,
  connectionPoints: ParsedConnectionPoint[],
  maxDistance: number = 20
): ParsedConnectionPoint | null {
  let nearest: ParsedConnectionPoint | null = null;
  let minDistance = maxDistance;
  
  connectionPoints.forEach(point => {
    const distance = Math.sqrt(
      Math.pow(point.x - targetX, 2) + Math.pow(point.y - targetY, 2)
    );
    
    if (distance < minDistance) {
      minDistance = distance;
      nearest = point;
    }
  });
  
  return nearest;
}