/**
 * SVG Parser Utility
 * Handles SVG loading, parsing, and processing for PID symbols
 */

export interface SVGParseResult {
  svgContent: string;
  viewBox: { x: number; y: number; width: number; height: number };
  redElements: NodeListOf<Element>;
  scaleFactors: { x: number; y: number };
}

export interface SVGProcessingOptions {
  targetWidth: number;
  targetHeight: number;
  strokeWidth: number;
  strokeLinecap: string;
  removeRedElements?: boolean;
  removePipeLabels?: boolean;
}

export class SVGParser {
  private static cache = new Map<string, SVGParseResult>();

  /**
   * Load and parse an SVG file
   */
  static async loadSvg(
    symbolPath: string, 
    options: SVGProcessingOptions,
    abortSignal?: AbortSignal
  ): Promise<SVGParseResult> {
    const cacheKey = `${symbolPath}-${JSON.stringify(options)}`;
    
    // Return cached result if available
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    try {
      const response = await fetch(symbolPath, { signal: abortSignal });
      const text = await response.text();
      
      const result = this.parseSvgContent(text, options);
      
      // Cache the result
      this.cache.set(cacheKey, result);
      
      return result;
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw error;
      }
      throw new Error(`Failed to load SVG: ${error}`);
    }
  }

  /**
   * Parse SVG content from string
   */
  static parseSvgContent(
    svgText: string, 
    options: SVGProcessingOptions
  ): SVGParseResult {
    // Parse SVG
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgText, 'image/svg+xml');
    const svg = doc.documentElement;

    // Check for parsing errors
    if (svg.tagName !== 'svg') {
      throw new Error('Invalid SVG content');
    }

    // Get viewBox
    const viewBoxAttr = svg.getAttribute('viewBox') || '0 0 64 64';
    const [vbX, vbY, vbWidth, vbHeight] = viewBoxAttr.split(' ').map(Number);
    const viewBox = { x: vbX, y: vbY, width: vbWidth, height: vbHeight };

    // Calculate scale factors
    const scaleFactors = {
      x: options.targetWidth / vbWidth,
      y: options.targetHeight / vbHeight
    };

    // Find connection indicator elements (red for equipment/valves, gray for pipes/signals)
    const redElements = svg.querySelectorAll(
      '[stroke="#ff0000"], [stroke="rgb(255,0,0)"], [stroke="red"], [stroke="#646464"], [stroke="rgb(100,100,100)"]'
    );

    // Process the SVG
    this.processSvgElements(svg, options);

    // Generate final SVG content
    const svgContent = new XMLSerializer().serializeToString(svg);

    return {
      svgContent,
      viewBox,
      redElements,
      scaleFactors
    };
  }

  /**
   * Process SVG elements - apply styling, remove unwanted elements
   */
  private static processSvgElements(svg: SVGElement, options: SVGProcessingOptions): void {
    const { strokeWidth, strokeLinecap, removeRedElements = false, removePipeLabels = true } = options;

    // Hide or remove red connection indicator elements
    if (removeRedElements) {
      const redElements = svg.querySelectorAll(
        '[stroke="#ff0000"], [stroke="rgb(255,0,0)"], [stroke="red"]'
      );
      redElements.forEach(el => el.remove());
    } else {
      // Hide red elements initially instead of removing them
      const redElements = svg.querySelectorAll(
        '[stroke="#ff0000"], [stroke="rgb(255,0,0)"], [stroke="red"]'
      );
      redElements.forEach(el => {
        el.setAttribute('class', 'connection-indicator');
        el.setAttribute('opacity', '0');
      });
    }

    // Remove pipe labels (T and PIPE text) for cleaner display
    if (removePipeLabels) {
      const blueTextElements = svg.querySelectorAll('[fill="#004c99"], [fill="rgb(0,76,153)"]');
      blueTextElements.forEach(el => {
        // Check if it's a text path or contains text content
        if (el.tagName.toLowerCase() === 'path' && el.parentElement) {
          const parentTransform = el.parentElement.getAttribute('transform') || '';
          // These are typically text paths in pipe symbols
          if (parentTransform.includes('translate')) {
            el.parentElement.remove();
          }
        }
      });
    }

    // Process fill attributes and apply stroke properties
    const allElements = svg.querySelectorAll('*');
    allElements.forEach(el => {
      const fill = el.getAttribute('fill');
      
      // Preserve white fills explicitly
      if (fill === 'white') {
        (el as HTMLElement).style.fill = 'white';
      } else if (fill === 'none' || !fill) {
        (el as HTMLElement).style.fill = 'none';
      }
      
      // Apply stroke width and linecap to elements with stroke (except connection indicators)
      if (!el.classList.contains('connection-indicator')) {
        const hasStroke = el.getAttribute('stroke');
        if (hasStroke && hasStroke !== 'none') {
          el.setAttribute('stroke-width', strokeWidth.toString());
          (el as HTMLElement).style.strokeWidth = strokeWidth + 'px';
          el.setAttribute('stroke-linecap', strokeLinecap);
          (el as HTMLElement).style.strokeLinecap = strokeLinecap;
        }
      }
    });
  }

  /**
   * Extract transform coordinates from SVG transform attribute
   */
  static parseTransform(transform: string): { x: number; y: number; rotation?: number } {
    const translateMatch = transform.match(/translate\(([-\d.]+)[\s,]+([-\d.]+)\)/);
    const rotateMatch = transform.match(/rotate\(([-\d.]+)(?:\s+([-\d.]+)\s+([-\d.]+))?\)/);

    const result: { x: number; y: number; rotation?: number } = {
      x: translateMatch ? parseFloat(translateMatch[1]) : 0,
      y: translateMatch ? parseFloat(translateMatch[2]) : 0
    };

    if (rotateMatch) {
      result.rotation = parseFloat(rotateMatch[1]);
    }

    return result;
  }

  /**
   * Check if transform includes specific pattern
   */
  static transformIncludes(transform: string, pattern: string): boolean {
    return transform.includes(pattern);
  }

  /**
   * Clear the SVG cache
   */
  static clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get cache size
   */
  static getCacheSize(): number {
    return this.cache.size;
  }
}