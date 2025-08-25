/**
 * Symbol Cache Service
 * High-performance caching system for SVG symbols and T-junction data
 */

import type { SVGParseResult } from '$lib/utils/svgParser';
import type { ConnectionPoint } from '$lib/services/TJunctionDetector';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  accessCount: number;
  lastAccessed: number;
  size: number; // estimated size in bytes
}

interface CacheOptions {
  maxSize: number; // maximum number of entries
  maxMemory: number; // maximum memory usage in bytes
  ttl: number; // time to live in milliseconds
  cleanupInterval: number; // cleanup interval in milliseconds
}

export interface SymbolCacheData extends SVGParseResult {
  connectionPoints: ConnectionPoint[];
  symbolKey: string | null;
}

/**
 * Generic LRU Cache with TTL and memory management
 */
class LRUCache<T> {
  private cache = new Map<string, CacheEntry<T>>();
  private memoryUsage = 0;
  private cleanupTimer?: NodeJS.Timeout;

  constructor(private options: CacheOptions) {
    this.startCleanupTimer();
  }

  set(key: string, data: T): void {
    const size = this.estimateSize(data);
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      accessCount: 0,
      lastAccessed: Date.now(),
      size
    };

    // Remove existing entry if it exists
    if (this.cache.has(key)) {
      const existingEntry = this.cache.get(key)!;
      this.memoryUsage -= existingEntry.size;
    }

    // Check memory limits before adding
    if (this.memoryUsage + size > this.options.maxMemory) {
      this.evictLeastRecentlyUsed(size);
    }

    // Check size limits
    if (this.cache.size >= this.options.maxSize) {
      this.evictLeastRecentlyUsed();
    }

    this.cache.set(key, entry);
    this.memoryUsage += size;
  }

  get(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    // Check TTL
    if (Date.now() - entry.timestamp > this.options.ttl) {
      this.delete(key);
      return null;
    }

    // Update access statistics
    entry.lastAccessed = Date.now();
    entry.accessCount++;

    // Move to end (most recently used)
    this.cache.delete(key);
    this.cache.set(key, entry);

    return entry.data;
  }

  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;

    // Check TTL
    if (Date.now() - entry.timestamp > this.options.ttl) {
      this.delete(key);
      return false;
    }

    return true;
  }

  delete(key: string): boolean {
    const entry = this.cache.get(key);
    if (entry) {
      this.memoryUsage -= entry.size;
      return this.cache.delete(key);
    }
    return false;
  }

  clear(): void {
    this.cache.clear();
    this.memoryUsage = 0;
  }

  private evictLeastRecentlyUsed(requiredSize: number = 0): void {
    const targetMemory = this.options.maxMemory - requiredSize;
    const entries = Array.from(this.cache.entries());
    
    // Sort by last accessed time (oldest first)
    entries.sort(([, a], [, b]) => a.lastAccessed - b.lastAccessed);

    // Remove entries until we're under the target memory usage
    for (const [key] of entries) {
      if (this.memoryUsage <= targetMemory && this.cache.size < this.options.maxSize) {
        break;
      }
      this.delete(key);
    }
  }

  private cleanup(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.options.ttl) {
        keysToDelete.push(key);
      }
    }

    for (const key of keysToDelete) {
      this.delete(key);
    }
  }

  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, this.options.cleanupInterval);
  }

  private estimateSize(data: T): number {
    try {
      // Rough estimation of object size in bytes
      const serialized = JSON.stringify(data);
      return serialized.length * 2; // Rough estimate for UTF-16 encoding
    } catch {
      return 1000; // Default size estimate
    }
  }

  // Statistics and monitoring
  getStats() {
    return {
      size: this.cache.size,
      memoryUsage: this.memoryUsage,
      maxSize: this.options.maxSize,
      maxMemory: this.options.maxMemory,
      hitRate: this.calculateHitRate()
    };
  }

  private calculateHitRate(): number {
    const totalAccesses = Array.from(this.cache.values())
      .reduce((total, entry) => total + entry.accessCount, 0);
    
    return totalAccesses > 0 ? (this.cache.size / totalAccesses) : 0;
  }

  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
    this.clear();
  }
}

/**
 * Symbol Cache Service
 */
export class SymbolCache {
  private static instance: SymbolCache;
  
  private svgCache: LRUCache<SymbolCacheData>;
  private previewCache: LRUCache<string>; // For base64 image previews
  private metadataCache: LRUCache<any>; // For symbol metadata

  private constructor() {
    // SVG cache - larger since these are the main data
    this.svgCache = new LRUCache<SymbolCacheData>({
      maxSize: 200,
      maxMemory: 50 * 1024 * 1024, // 50MB
      ttl: 30 * 60 * 1000, // 30 minutes
      cleanupInterval: 5 * 60 * 1000 // 5 minutes
    });

    // Preview cache - smaller, more frequent access
    this.previewCache = new LRUCache<string>({
      maxSize: 500,
      maxMemory: 20 * 1024 * 1024, // 20MB
      ttl: 60 * 60 * 1000, // 1 hour
      cleanupInterval: 10 * 60 * 1000 // 10 minutes
    });

    // Metadata cache - small objects, long TTL
    this.metadataCache = new LRUCache<any>({
      maxSize: 1000,
      maxMemory: 5 * 1024 * 1024, // 5MB
      ttl: 2 * 60 * 60 * 1000, // 2 hours
      cleanupInterval: 15 * 60 * 1000 // 15 minutes
    });
  }

  static getInstance(): SymbolCache {
    if (!SymbolCache.instance) {
      SymbolCache.instance = new SymbolCache();
    }
    return SymbolCache.instance;
  }

  /**
   * SVG Cache Methods
   */
  setSymbolData(key: string, data: SymbolCacheData): void {
    this.svgCache.set(this.normalizeKey(key), data);
  }

  getSymbolData(key: string): SymbolCacheData | null {
    return this.svgCache.get(this.normalizeKey(key));
  }

  hasSymbolData(key: string): boolean {
    return this.svgCache.has(this.normalizeKey(key));
  }

  /**
   * Preview Cache Methods
   */
  setPreview(key: string, base64Image: string): void {
    this.previewCache.set(this.normalizeKey(key), base64Image);
  }

  getPreview(key: string): string | null {
    return this.previewCache.get(this.normalizeKey(key));
  }

  hasPreview(key: string): boolean {
    return this.previewCache.has(this.normalizeKey(key));
  }

  /**
   * Metadata Cache Methods
   */
  setMetadata(key: string, metadata: any): void {
    this.metadataCache.set(this.normalizeKey(key), metadata);
  }

  getMetadata(key: string): any | null {
    return this.metadataCache.get(this.normalizeKey(key));
  }

  hasMetadata(key: string): boolean {
    return this.metadataCache.has(this.normalizeKey(key));
  }

  /**
   * Batch Operations
   */
  preloadSymbols(symbolPaths: string[]): Promise<void> {
    const promises = symbolPaths.map(async (path) => {
      if (!this.hasSymbolData(path)) {
        try {
          // This would integrate with your existing SVG loading logic
          console.log(`Preloading symbol: ${path}`);
          // Implementation would go here
        } catch (error) {
          console.warn(`Failed to preload symbol: ${path}`, error);
        }
      }
    });

    return Promise.allSettled(promises).then(() => {});
  }

  invalidateSymbol(key: string): void {
    const normalizedKey = this.normalizeKey(key);
    this.svgCache.delete(normalizedKey);
    this.previewCache.delete(normalizedKey);
    this.metadataCache.delete(normalizedKey);
  }

  /**
   * Cache Management
   */
  clearAll(): void {
    this.svgCache.clear();
    this.previewCache.clear();
    this.metadataCache.clear();
  }

  getStats() {
    return {
      svg: this.svgCache.getStats(),
      preview: this.previewCache.getStats(),
      metadata: this.metadataCache.getStats(),
      totalMemory: this.svgCache.getStats().memoryUsage + 
                   this.previewCache.getStats().memoryUsage + 
                   this.metadataCache.getStats().memoryUsage
    };
  }

  private normalizeKey(key: string): string {
    // Normalize keys to handle different path formats
    return key.toLowerCase().replace(/\\/g, '/');
  }

  /**
   * Cleanup on page unload
   */
  destroy(): void {
    this.svgCache.destroy();
    this.previewCache.destroy();
    this.metadataCache.destroy();
  }
}

// Global cache instance
export const symbolCache = SymbolCache.getInstance();

// Cleanup on page unload
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    symbolCache.destroy();
  });
}

/**
 * Cache-aware symbol loader function
 */
export async function loadSymbolWithCache(
  symbolPath: string,
  options: any,
  abortSignal?: AbortSignal
): Promise<SymbolCacheData> {
  const cacheKey = `${symbolPath}-${JSON.stringify(options)}`;
  
  // Try cache first
  const cached = symbolCache.getSymbolData(cacheKey);
  if (cached) {
    return cached;
  }

  // Load from network/file system
  try {
    // This would integrate with your SVGParser and TJunctionDetector
    // const svgResult = await SVGParser.loadSvg(symbolPath, options, abortSignal);
    // const symbolKey = TJunctionDetector.getSymbolKeyFromPath(symbolPath);
    // const connectionPoints = symbolKey ? 
    //   TJunctionDetector.calculateConnectionPoints(...) : [];
    
    // Placeholder for now - would be replaced with actual loading logic
    const symbolData: SymbolCacheData = {
      svgContent: '',
      viewBox: { x: 0, y: 0, width: 64, height: 64 },
      redElements: document.createDocumentFragment().querySelectorAll('*'),
      scaleFactors: { x: 1, y: 1 },
      connectionPoints: [],
      symbolKey: null
    };

    // Cache the result
    symbolCache.setSymbolData(cacheKey, symbolData);
    
    return symbolData;
  } catch (error) {
    throw new Error(`Failed to load symbol: ${error}`);
  }
}