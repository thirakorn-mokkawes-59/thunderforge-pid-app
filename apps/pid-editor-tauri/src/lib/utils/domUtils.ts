/**
 * DOM Utility Functions
 * Common DOM operations and helpers for PID editor components
 */

export interface ElementBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Point {
  x: number;
  y: number;
}

/**
 * DOM Query Utilities
 */
export class DOMUtils {
  /**
   * Safely query selector with null check
   */
  static querySelector<T extends Element = Element>(
    selector: string, 
    parent: Document | Element = document
  ): T | null {
    try {
      return parent.querySelector<T>(selector);
    } catch (error) {
      console.warn(`Invalid selector: ${selector}`, error);
      return null;
    }
  }

  /**
   * Safely query selector all with null check
   */
  static querySelectorAll<T extends Element = Element>(
    selector: string, 
    parent: Document | Element = document
  ): NodeListOf<T> {
    try {
      return parent.querySelectorAll<T>(selector);
    } catch (error) {
      console.warn(`Invalid selector: ${selector}`, error);
      return document.createDocumentFragment().querySelectorAll<T>(selector);
    }
  }

  /**
   * Get element bounds (position + dimensions)
   */
  static getElementBounds(element: Element): ElementBounds | null {
    if (!element) return null;

    const rect = element.getBoundingClientRect();
    return {
      x: rect.left,
      y: rect.top,
      width: rect.width,
      height: rect.height
    };
  }

  /**
   * Get element center point
   */
  static getElementCenter(element: Element): Point | null {
    const bounds = this.getElementBounds(element);
    if (!bounds) return null;

    return {
      x: bounds.x + bounds.width / 2,
      y: bounds.y + bounds.height / 2
    };
  }

  /**
   * Check if point is inside element
   */
  static isPointInElement(point: Point, element: Element): boolean {
    const bounds = this.getElementBounds(element);
    if (!bounds) return false;

    return point.x >= bounds.x && 
           point.x <= bounds.x + bounds.width &&
           point.y >= bounds.y && 
           point.y <= bounds.y + bounds.height;
  }

  /**
   * Get closest element to a point
   */
  static getClosestElement(point: Point, elements: Element[]): Element | null {
    let closest: Element | null = null;
    let minDistance = Infinity;

    for (const element of elements) {
      const center = this.getElementCenter(element);
      if (!center) continue;

      const distance = Math.sqrt(
        Math.pow(point.x - center.x, 2) + Math.pow(point.y - center.y, 2)
      );

      if (distance < minDistance) {
        minDistance = distance;
        closest = element;
      }
    }

    return closest;
  }
}

/**
 * SVG-specific DOM utilities
 */
export class SVGUtils {
  /**
   * Get SVG point from screen coordinates
   */
  static screenToSVG(svgElement: SVGSVGElement, screenX: number, screenY: number): Point {
    const point = svgElement.createSVGPoint();
    point.x = screenX;
    point.y = screenY;
    return point.matrixTransform(svgElement.getScreenCTM()?.inverse());
  }

  /**
   * Get screen coordinates from SVG point
   */
  static svgToScreen(svgElement: SVGSVGElement, svgX: number, svgY: number): Point {
    const point = svgElement.createSVGPoint();
    point.x = svgX;
    point.y = svgY;
    return point.matrixTransform(svgElement.getScreenCTM());
  }

  /**
   * Parse SVG viewBox
   */
  static parseViewBox(viewBoxString: string): { x: number; y: number; width: number; height: number } {
    const values = viewBoxString.split(/\s+/).map(Number);
    return {
      x: values[0] || 0,
      y: values[1] || 0,
      width: values[2] || 100,
      height: values[3] || 100
    };
  }

  /**
   * Create SVG element with namespace
   */
  static createSVGElement<K extends keyof SVGElementTagNameMap>(
    tagName: K
  ): SVGElementTagNameMap[K] {
    return document.createElementNS('http://www.w3.org/2000/svg', tagName);
  }

  /**
   * Set multiple SVG attributes
   */
  static setAttributes(element: SVGElement, attributes: Record<string, string | number>): void {
    for (const [key, value] of Object.entries(attributes)) {
      element.setAttribute(key, String(value));
    }
  }
}

/**
 * Event handling utilities
 */
export class EventUtils {
  /**
   * Add event listener with cleanup
   */
  static addEventListenerWithCleanup<K extends keyof WindowEventMap>(
    target: Window,
    type: K,
    listener: (this: Window, ev: WindowEventMap[K]) => any,
    options?: boolean | AddEventListenerOptions
  ): () => void;
  static addEventListenerWithCleanup<K extends keyof DocumentEventMap>(
    target: Document,
    type: K,
    listener: (this: Document, ev: DocumentEventMap[K]) => any,
    options?: boolean | AddEventListenerOptions
  ): () => void;
  static addEventListenerWithCleanup<K extends keyof HTMLElementEventMap>(
    target: HTMLElement,
    type: K,
    listener: (this: HTMLElement, ev: HTMLElementEventMap[K]) => any,
    options?: boolean | AddEventListenerOptions
  ): () => void;
  static addEventListenerWithCleanup(
    target: EventTarget,
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | AddEventListenerOptions
  ): () => void {
    target.addEventListener(type, listener, options);
    return () => target.removeEventListener(type, listener, options);
  }

  /**
   * Debounce function calls
   */
  static debounce<T extends (...args: any[]) => any>(
    func: T,
    wait: number
  ): (...args: Parameters<T>) => void {
    let timeout: NodeJS.Timeout;
    return (...args: Parameters<T>) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(null, args), wait);
    };
  }

  /**
   * Throttle function calls
   */
  static throttle<T extends (...args: any[]) => any>(
    func: T,
    limit: number
  ): (...args: Parameters<T>) => void {
    let inThrottle: boolean;
    return (...args: Parameters<T>) => {
      if (!inThrottle) {
        func.apply(null, args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  }

  /**
   * Get mouse/touch position from event
   */
  static getEventPosition(event: MouseEvent | TouchEvent): Point {
    if (event instanceof MouseEvent) {
      return { x: event.clientX, y: event.clientY };
    } else {
      const touch = event.touches[0] || event.changedTouches[0];
      return { x: touch.clientX, y: touch.clientY };
    }
  }

  /**
   * Prevent default and stop propagation
   */
  static preventDefault(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
  }
}

/**
 * Animation utilities
 */
export class AnimationUtils {
  /**
   * Request animation frame with cleanup
   */
  static requestAnimationFrameWithCleanup(callback: FrameRequestCallback): () => void {
    const id = requestAnimationFrame(callback);
    return () => cancelAnimationFrame(id);
  }

  /**
   * Simple easing functions
   */
  static easing = {
    linear: (t: number): number => t,
    easeInQuad: (t: number): number => t * t,
    easeOutQuad: (t: number): number => t * (2 - t),
    easeInOutQuad: (t: number): number => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t,
    easeInCubic: (t: number): number => t * t * t,
    easeOutCubic: (t: number): number => (--t) * t * t + 1,
    easeInOutCubic: (t: number): number => t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1
  };

  /**
   * Animate numeric value
   */
  static animate(
    from: number,
    to: number,
    duration: number,
    onUpdate: (value: number) => void,
    easing: (t: number) => number = this.easing.easeOutQuad
  ): () => void {
    const startTime = performance.now();
    let animationId: number;

    const tick = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easedProgress = easing(progress);
      const currentValue = from + (to - from) * easedProgress;

      onUpdate(currentValue);

      if (progress < 1) {
        animationId = requestAnimationFrame(tick);
      }
    };

    animationId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animationId);
  }
}

/**
 * Color utilities
 */
export class ColorUtils {
  /**
   * Convert hex to RGB
   */
  static hexToRgb(hex: string): { r: number; g: number; b: number } | null {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : null;
  }

  /**
   * Convert RGB to hex
   */
  static rgbToHex(r: number, g: number, b: number): string {
    return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
  }

  /**
   * Get contrast color (black or white)
   */
  static getContrastColor(hex: string): string {
    const rgb = this.hexToRgb(hex);
    if (!rgb) return '#000000';

    const brightness = (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000;
    return brightness > 128 ? '#000000' : '#ffffff';
  }

  /**
   * Lighten or darken color
   */
  static adjustBrightness(hex: string, amount: number): string {
    const rgb = this.hexToRgb(hex);
    if (!rgb) return hex;

    const adjust = (channel: number) => {
      const adjusted = channel + amount;
      return Math.max(0, Math.min(255, adjusted));
    };

    return this.rgbToHex(adjust(rgb.r), adjust(rgb.g), adjust(rgb.b));
  }
}

/**
 * Math utilities for UI calculations
 */
export class MathUtils {
  /**
   * Clamp value between min and max
   */
  static clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
  }

  /**
   * Linear interpolation
   */
  static lerp(start: number, end: number, t: number): number {
    return start + (end - start) * t;
  }

  /**
   * Distance between two points
   */
  static distance(p1: Point, p2: Point): number {
    return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
  }

  /**
   * Angle between two points (in radians)
   */
  static angle(p1: Point, p2: Point): number {
    return Math.atan2(p2.y - p1.y, p2.x - p1.x);
  }

  /**
   * Round to nearest multiple
   */
  static roundToNearest(value: number, multiple: number): number {
    return Math.round(value / multiple) * multiple;
  }

  /**
   * Check if number is in range
   */
  static inRange(value: number, min: number, max: number): boolean {
    return value >= min && value <= max;
  }
}

/**
 * Validation utilities
 */
export class ValidationUtils {
  /**
   * Check if value is a valid hex color
   */
  static isValidHexColor(value: string): boolean {
    return /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(value);
  }

  /**
   * Check if value is a valid number
   */
  static isValidNumber(value: any): value is number {
    return typeof value === 'number' && !isNaN(value) && isFinite(value);
  }

  /**
   * Check if value is a valid positive number
   */
  static isValidPositiveNumber(value: any): value is number {
    return this.isValidNumber(value) && value > 0;
  }

  /**
   * Check if value is in valid range
   */
  static isInRange(value: number, min: number, max: number): boolean {
    return this.isValidNumber(value) && value >= min && value <= max;
  }

  /**
   * Sanitize file name
   */
  static sanitizeFileName(fileName: string): string {
    return fileName.replace(/[^a-z0-9.-]/gi, '_').replace(/_{2,}/g, '_');
  }
}

/**
 * Svelte action for click outside detection
 */
export function clickOutside(node: HTMLElement) {
  const handleClick = (event: MouseEvent) => {
    if (node && !node.contains(event.target as Node) && !event.defaultPrevented) {
      node.dispatchEvent(new CustomEvent('clickOutside', { detail: event }));
    }
  };

  document.addEventListener('click', handleClick, true);

  return {
    destroy() {
      document.removeEventListener('click', handleClick, true);
    }
  };
}