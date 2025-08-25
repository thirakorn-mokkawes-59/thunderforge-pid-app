/**
 * T-Junction Detector Service
 * Handles detection and calculation of T-junction connection points for PID symbols
 */

import type { Position } from '@xyflow/svelte';

export interface TJunctionElement {
  transform: string;
  element: Element;
}

export interface TJunctionSide {
  h: TJunctionElement | null;
  v: TJunctionElement | null;
}

export interface TJunctions {
  top: TJunctionSide;
  right: TJunctionSide;
  bottom: TJunctionSide;
  left: TJunctionSide;
}

export interface AdditionalJunction {
  position: string;
  h: TJunctionElement;
  v?: TJunctionElement;
  x?: number;
  y?: number;
}

export interface ConnectionPoint {
  x: number;
  y: number;
  id: string;
  position: Position;
  edgeDistance: number;
}

export interface TJunctionConfig {
  top?: { h: string; v: string };
  right?: { h: string; v: string };
  bottom?: { h: string; v: string };
  left?: { h: string; v: string };
  mainGroupOffset?: { x: number; y: number };
  additionalJunctions?: Array<{
    position: string;
    h: string;
    v: string;
    x?: number;
    y?: number;
  }>;
}

export interface DetectionResult {
  tJunctions: TJunctions;
  additionalJunctions: AdditionalJunction[];
  connectionPoints: ConnectionPoint[];
}

export class TJunctionDetector {
  private static readonly TJUNCTION_CONFIGS: Record<string, TJunctionConfig> = {
    'tank_floating_roof': {
      top: { h: 'translate(24 2) rotate(180 2 0)', v: 'translate(26 0) rotate(180 0 1)' },
      right: { h: 'translate(48 14) rotate(270 2 0)', v: 'translate(51 13) rotate(270 0 1)' },
      bottom: { h: 'translate(24 28)', v: 'translate(26 28)' },
      left: { h: 'translate(0 14) rotate(90 2 0)', v: 'translate(1 13) rotate(90 0 1)' },
      mainGroupOffset: { x: 6.5, y: 18.5 }
    },
    'vessel_general': {
      top: { h: 'translate(11 2) rotate(180 2 0)', v: 'translate(13 0) rotate(180 0 1)' },
      right: { h: 'translate(22 11) rotate(270 2 0)', v: 'translate(25 10) rotate(270 0 1)' },
      bottom: { h: 'translate(11 22)', v: 'translate(13 22)' },
      left: { h: 'translate(0 11) rotate(90 2 0)', v: 'translate(1 10) rotate(90 0 1)' },
      mainGroupOffset: { x: 19.5, y: 8.5 }
    },
    'heat_exchanger_general_1': {
      top: { h: 'translate(20 2) rotate(180)', v: 'translate(22 0) rotate(180)' },
      right: { h: 'translate(40.304 10) rotate(270)', v: 'translate(42.702 9.202) rotate(270)' },
      bottom: { h: 'translate(20 42)', v: 'translate(22 42)' },
      left: { h: 'translate(0 22) rotate(90)', v: 'translate(1 21) rotate(90)' },
      mainGroupOffset: { x: 10.5, y: 10.5 },
      additionalJunctions: [{
        position: 'right2',
        h: 'translate(40.304 34) rotate(270)',
        v: 'translate(42.702 33.202) rotate(270)',
        x: 40.304,
        y: 34
      }]
    },
    'vessel_full_tube_coil': {
      top: { h: 'translate(11 2) rotate(180 2 0)', v: 'translate(13 0) rotate(180 0 1)' },
      right: { h: 'translate(22 11) rotate(270 2 0)', v: 'translate(25 10) rotate(270 0 1)' },
      bottom: { h: 'translate(11 22)', v: 'translate(13 22)' },
      left: { h: 'translate(0 11) rotate(90 2 0)', v: 'translate(1 10) rotate(90 0 1)' },
      mainGroupOffset: { x: 19.5, y: 8.5 },
      additionalJunctions: [
        { position: 'right2', h: 'translate(22 17) rotate(270 2 0)', v: 'translate(25 16) rotate(270 0 1)', x: 22, y: 17 },
        { position: 'left2', h: 'translate(0 17) rotate(90 2 0)', v: 'translate(1 16) rotate(90 0 1)', x: 0, y: 17 }
      ]
    },
    'vessel_semi_tube_coil': {
      top: { h: 'translate(11 2) rotate(180 2 0)', v: 'translate(13 0) rotate(180 0 1)' },
      right: { h: 'translate(22 11) rotate(270 2 0)', v: 'translate(25 10) rotate(270 0 1)' },
      bottom: { h: 'translate(11 22)', v: 'translate(13 22)' },
      left: { h: 'translate(0 11) rotate(90 2 0)', v: 'translate(1 10) rotate(90 0 1)' },
      mainGroupOffset: { x: 19.5, y: 8.5 },
      additionalJunctions: [
        { position: 'right2', h: 'translate(22 17) rotate(270 2 0)', v: 'translate(25 16) rotate(270 0 1)', x: 22, y: 17 }
      ]
    }
  };

  /**
   * Get symbol key from symbol path
   */
  static getSymbolKeyFromPath(symbolPath: string): string | null {
    if (!symbolPath) return null;
    
    const symbolKeys = Object.keys(this.TJUNCTION_CONFIGS);
    return symbolKeys.find(key => symbolPath.includes(key)) || null;
  }

  /**
   * Detect T-junctions for a specific symbol type
   */
  static detectTJunctionsForSymbol(
    symbolKey: string, 
    redElements: NodeListOf<Element>
  ): { tJunctions: TJunctions; additionalJunctions: AdditionalJunction[] } {
    const config = this.TJUNCTION_CONFIGS[symbolKey];
    if (!config) {
      return { 
        tJunctions: { 
          top: { h: null, v: null }, 
          right: { h: null, v: null }, 
          bottom: { h: null, v: null }, 
          left: { h: null, v: null } 
        }, 
        additionalJunctions: [] 
      };
    }

    const tJunctions: TJunctions = { 
      top: { h: null, v: null }, 
      right: { h: null, v: null }, 
      bottom: { h: null, v: null }, 
      left: { h: null, v: null } 
    };
    const additionalJunctions: AdditionalJunction[] = [];

    Array.from(redElements).forEach((el) => {
      if (el.tagName.toLowerCase() === 'path') {
        const parentGroup = el.parentElement;
        if (parentGroup) {
          const transform = parentGroup.getAttribute('transform') || '';

          // Check main T-junctions
          Object.entries(config).forEach(([position, patterns]) => {
            if (position === 'additionalJunctions' || position === 'mainGroupOffset') return;
            
            const pos = position as keyof TJunctions;
            const patternConfig = patterns as { h: string; v: string };
            
            if (patternConfig.h && transform.includes(patternConfig.h)) {
              tJunctions[pos].h = { transform, element: el };
            }
            if (patternConfig.v && transform.includes(patternConfig.v)) {
              tJunctions[pos].v = { transform, element: el };
            }
          });

          // Check additional junctions
          if (config.additionalJunctions) {
            config.additionalJunctions.forEach(junction => {
              if (transform.includes(junction.h)) {
                const existingJunction = additionalJunctions.find(j => j.position === junction.position);
                if (!existingJunction) {
                  additionalJunctions.push({
                    position: junction.position,
                    h: { transform, element: el },
                    x: junction.x,
                    y: junction.y
                  });
                } else {
                  existingJunction.h = { transform, element: el };
                }
              }
              if (transform.includes(junction.v)) {
                const existingJunction = additionalJunctions.find(j => j.position === junction.position);
                if (existingJunction) {
                  existingJunction.v = { transform, element: el };
                }
              }
            });
          }
        }
      }
    });

    return { tJunctions, additionalJunctions };
  }

  /**
   * Calculate connection points from detected T-junctions
   */
  static calculateConnectionPoints(
    tJunctions: TJunctions,
    additionalJunctions: AdditionalJunction[],
    symbolKey: string,
    scaleFactors: { x: number; y: number }
  ): ConnectionPoint[] {
    const config = this.TJUNCTION_CONFIGS[symbolKey];
    if (!config) return [];

    const junctionPoints: ConnectionPoint[] = [];
    const mainGroupOffset = config.mainGroupOffset || { x: 0, y: 0 };

    // Process main T-junctions in order (top, right, bottom, left)
    const orderedPositions: (keyof TJunctions)[] = ['top', 'right', 'bottom', 'left'];
    
    orderedPositions.forEach(position => {
      const junction = tJunctions[position];
      if (junction.h && junction.v) {
        const intersectionPoint = this.calculateIntersectionPoint(
          junction, 
          position, 
          symbolKey,
          mainGroupOffset,
          scaleFactors
        );

        if (intersectionPoint) {
          junctionPoints.push(intersectionPoint);
        }
      }
    });

    // Process additional junctions
    additionalJunctions.forEach(addJunction => {
      if (addJunction.h && addJunction.v) {
        const intersectionPoint = this.calculateAdditionalIntersectionPoint(
          addJunction,
          symbolKey,
          mainGroupOffset,
          scaleFactors,
          junctionPoints.length
        );

        if (intersectionPoint) {
          junctionPoints.push(intersectionPoint);
        }
      }
    });

    return junctionPoints;
  }

  /**
   * Calculate intersection point for main T-junctions
   */
  private static calculateIntersectionPoint(
    junction: TJunctionSide,
    position: keyof TJunctions,
    symbolKey: string,
    mainGroupOffset: { x: number; y: number },
    scaleFactors: { x: number; y: number }
  ): ConnectionPoint | null {
    if (!junction.h || !junction.v) return null;

    // Extract coordinates from transforms
    const hMatch = junction.h.transform.match(/translate\(([-\d.]+)[\s,]+([-\d.]+)\)/);
    const vMatch = junction.v.transform.match(/translate\(([-\d.]+)[\s,]+([-\d.]+)\)/);

    if (!hMatch || !vMatch) return null;

    const hX = parseFloat(hMatch[1]);
    const hY = parseFloat(hMatch[2]);
    const vX = parseFloat(vMatch[1]);
    const vY = parseFloat(vMatch[2]);

    // Calculate intersection based on position and symbol type
    const intersectionPoint = this.getIntersectionForSymbol(
      symbolKey,
      position,
      { hX, hY, vX, vY }
    );

    if (!intersectionPoint) return null;

    // Apply main group offset and scaling
    const absoluteX = mainGroupOffset.x + intersectionPoint.x;
    const absoluteY = mainGroupOffset.y + intersectionPoint.y;
    const scaledX = absoluteX * scaleFactors.x;
    const scaledY = absoluteY * scaleFactors.y;

    // Determine handle position
    const handlePosition = this.getHandlePosition(position);

    return {
      x: scaledX,
      y: scaledY,
      id: `handle-${position}`,
      position: handlePosition,
      edgeDistance: 4
    };
  }

  /**
   * Calculate intersection point for additional junctions
   */
  private static calculateAdditionalIntersectionPoint(
    addJunction: AdditionalJunction,
    symbolKey: string,
    mainGroupOffset: { x: number; y: number },
    scaleFactors: { x: number; y: number },
    handleIndex: number
  ): ConnectionPoint | null {
    if (!addJunction.h || !addJunction.v) return null;

    // Use stored coordinates if available
    let intersectionX: number;
    let intersectionY: number;

    if (addJunction.x !== undefined && addJunction.y !== undefined) {
      intersectionX = addJunction.x + (symbolKey === 'heat_exchanger_general_1' ? 1.6 : 1.5);
      intersectionY = addJunction.y;
    } else {
      // Parse from transform as fallback
      const hMatch = addJunction.h.transform.match(/translate\(([-\d.]+)[\s,]+([-\d.]+)\)/);
      if (!hMatch) return null;

      intersectionX = parseFloat(hMatch[1]) + 1.5;
      intersectionY = parseFloat(hMatch[2]);
    }

    // Apply main group offset and scaling
    const absoluteX = mainGroupOffset.x + intersectionX;
    const absoluteY = mainGroupOffset.y + intersectionY;
    const scaledX = absoluteX * scaleFactors.x;
    const scaledY = absoluteY * scaleFactors.y;

    // Determine position type
    const handlePosition = addJunction.position.includes('right') 
      ? 'Right' as Position
      : 'Left' as Position;

    return {
      x: scaledX,
      y: scaledY,
      id: `handle-${handleIndex}`,
      position: handlePosition,
      edgeDistance: 4
    };
  }

  /**
   * Get intersection coordinates for specific symbol and position
   */
  private static getIntersectionForSymbol(
    symbolKey: string,
    position: keyof TJunctions,
    coords: { hX: number; hY: number; vX: number; vY: number }
  ): { x: number; y: number } | null {
    const { hX, hY, vX, vY } = coords;

    // Symbol-specific intersection calculations
    switch (symbolKey) {
      case 'tank_floating_roof':
        switch (position) {
          case 'top': return { x: vX, y: hY };
          case 'left': return { x: hX + 2, y: hY };
          case 'right': return { x: hX + 1.5, y: hY };
          case 'bottom': return { x: vX, y: hY };
        }
        break;

      case 'vessel_general':
      case 'vessel_full_tube_coil':
      case 'vessel_semi_tube_coil':
        switch (position) {
          case 'top': return { x: vX, y: hY };
          case 'left': return { x: hX + 1, y: hY };
          case 'right': return { x: hX + 1.5, y: hY };
          case 'bottom': return { x: vX, y: hY };
        }
        break;

      case 'heat_exchanger_general_1':
        switch (position) {
          case 'top': return { x: vX, y: hY };
          case 'left': return { x: hX + 2, y: hY };
          case 'right': return { x: hX + 1.6, y: hY };
          case 'bottom': return { x: vX, y: hY };
        }
        break;
    }

    return null;
  }

  /**
   * Get handle position enum from position string
   */
  private static getHandlePosition(position: keyof TJunctions): Position {
    const positionMap: Record<keyof TJunctions, Position> = {
      top: 'Top' as Position,
      right: 'Right' as Position,
      bottom: 'Bottom' as Position,
      left: 'Left' as Position
    };

    return positionMap[position];
  }

  /**
   * Get all supported symbol keys
   */
  static getSupportedSymbols(): string[] {
    return Object.keys(this.TJUNCTION_CONFIGS);
  }

  /**
   * Add or update a symbol configuration
   */
  static addSymbolConfig(symbolKey: string, config: TJunctionConfig): void {
    this.TJUNCTION_CONFIGS[symbolKey] = config;
  }

  /**
   * Get symbol configuration
   */
  static getSymbolConfig(symbolKey: string): TJunctionConfig | null {
    return this.TJUNCTION_CONFIGS[symbolKey] || null;
  }
}