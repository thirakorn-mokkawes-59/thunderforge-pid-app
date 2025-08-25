/**
 * Handle Configuration for P&ID Symbols
 * 
 * IMPORTANT: This configuration defines how connection handles work in the P&ID editor.
 * DO NOT modify without understanding the implications on React Flow connections.
 * 
 * @description
 * React Flow requires connections to be made from source to target handles.
 * We use a single bidirectional handle per connection point that can act as both.
 * This prevents z-index conflicts and ensures stable connections.
 */

export const HANDLE_CONFIG = {
  /**
   * Handle type configuration
   * CRITICAL: Always use 'source' type with isConnectable=true for bidirectional behavior
   * Using separate source/target handles causes z-index conflicts and connection failures
   */
  type: 'source' as const,
  isConnectable: true,
  
  /**
   * Handle ID format
   * Format: 'handle-{index}' for standard positions (0-3)
   * Format: 'handle-{position}' for additional positions (left2, right2, etc.)
   * DO NOT add suffixes like '-source' or '-target' - this breaks the bidirectional behavior
   */
  idFormat: {
    prefix: 'handle',
    separator: '-',
    // Standard positions: top=0, right=1, bottom=2, left=3
    standardPositions: {
      top: 0,
      right: 1,
      bottom: 2,
      left: 3
    }
  },
  
  /**
   * Visual configuration
   */
  visual: {
    size: 10, // px
    hitAreaSize: 28, // px - larger than visual for easier interaction
    color: '#ff0000',
    borderColor: '#ffffff',
    borderWidth: 1,
    borderRadius: 2,
    hoverScale: 1.2,
    hoverColor: '#ff4444',
    transition: 'all 0.2s ease'
  },
  
  /**
   * Z-index configuration
   * Single handle type prevents z-index conflicts
   */
  zIndex: {
    default: 100,
    hover: 101,
    connecting: 102
  },
  
  /**
   * Connection validation
   */
  validation: {
    allowSelfConnection: false,
    requireHandles: true,
    connectionMode: 'loose', // 'loose' or 'strict'
    connectOnClick: true // Enable click-to-connect instead of just drag
  }
} as const;

/**
 * Generate handle ID based on position
 * @param position - Either numeric index (0-3) or position name (left2, right2, etc.)
 */
export function generateHandleId(position: number | string): string {
  const { prefix, separator } = HANDLE_CONFIG.idFormat;
  return `${prefix}${separator}${position}`;
}

/**
 * Parse handle ID to extract position
 * @param handleId - Handle ID in format 'handle-{position}'
 * @returns Parsed position (number or string) or null if invalid
 */
export function parseHandleId(handleId: string): number | string | null {
  const { prefix, separator } = HANDLE_CONFIG.idFormat;
  const pattern = new RegExp(`^${prefix}${separator}(.+)$`);
  const match = handleId?.match(pattern);
  
  if (!match) return null;
  
  const position = match[1];
  const parsed = parseInt(position, 10);
  return isNaN(parsed) ? position : parsed;
}

/**
 * Validate if a connection is allowed
 * @param source - Source node ID
 * @param target - Target node ID  
 * @param sourceHandle - Source handle ID
 * @param targetHandle - Target handle ID
 */
export function isValidConnection(
  source: string,
  target: string,
  sourceHandle?: string,
  targetHandle?: string
): boolean {
  const { allowSelfConnection, requireHandles } = HANDLE_CONFIG.validation;
  
  // Check self-connection
  if (!allowSelfConnection && source === target) {
    return false;
  }
  
  // Check handles exist
  if (requireHandles && (!sourceHandle || !targetHandle)) {
    return false;
  }
  
  return true;
}

/**
 * Get CSS styles for handle based on configuration
 */
export function getHandleStyles(): {
  handle: string;
  hitArea: string;
} {
  const { size, hitAreaSize, color, borderColor, borderWidth, borderRadius, transition } = HANDLE_CONFIG.visual;
  
  return {
    handle: `
      width: ${size}px !important;
      height: ${size}px !important;
      background: ${color} !important;
      border: ${borderWidth}px solid ${borderColor} !important;
      border-radius: ${borderRadius}px !important;
      transition: ${transition};
    `,
    hitArea: `
      width: ${hitAreaSize}px;
      height: ${hitAreaSize}px;
    `
  };
}