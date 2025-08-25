import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SymbolCache, symbolCache, type SymbolCacheData } from '../SymbolCache';

describe('SymbolCache', () => {
  let testCache: SymbolCache;

  beforeEach(() => {
    testCache = SymbolCache.getInstance();
    testCache.clearAll();
    vi.clearAllMocks();
  });

  afterEach(() => {
    testCache.clearAll();
  });

  describe('symbol data operations', () => {
    it('should store and retrieve symbol data', () => {
      const mockData: SymbolCacheData = {
        svgContent: '<svg><rect/></svg>',
        viewBox: { x: 0, y: 0, width: 64, height: 64 },
        redElements: document.createDocumentFragment().querySelectorAll('*'),
        scaleFactors: { x: 1, y: 1 },
        connectionPoints: [],
        symbolKey: 'test-symbol'
      };

      testCache.setSymbolData('test-key', mockData);
      const retrieved = testCache.getSymbolData('test-key');

      expect(retrieved).toBeDefined();
      expect(retrieved?.symbolKey).toBe('test-symbol');
      expect(retrieved?.svgContent).toContain('rect');
    });

    it('should return null for missing symbol data', () => {
      expect(testCache.getSymbolData('nonexistent')).toBeNull();
    });

    it('should check if symbol data exists', () => {
      const mockData: SymbolCacheData = {
        svgContent: '<svg></svg>',
        viewBox: { x: 0, y: 0, width: 64, height: 64 },
        redElements: document.createDocumentFragment().querySelectorAll('*'),
        scaleFactors: { x: 1, y: 1 },
        connectionPoints: [],
        symbolKey: null
      };

      testCache.setSymbolData('test-key', mockData);
      
      expect(testCache.hasSymbolData('test-key')).toBe(true);
      expect(testCache.hasSymbolData('nonexistent')).toBe(false);
    });
  });

  describe('preview operations', () => {
    it('should store and retrieve preview images', () => {
      const mockPreview = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgA...';
      
      testCache.setPreview('test-symbol', mockPreview);
      const retrieved = testCache.getPreview('test-symbol');

      expect(retrieved).toBe(mockPreview);
    });

    it('should return null for missing previews', () => {
      expect(testCache.getPreview('nonexistent')).toBeNull();
    });

    it('should check if preview exists', () => {
      const mockPreview = 'data:image/png;base64,test';
      
      testCache.setPreview('test-symbol', mockPreview);
      
      expect(testCache.hasPreview('test-symbol')).toBe(true);
      expect(testCache.hasPreview('nonexistent')).toBe(false);
    });
  });

  describe('metadata operations', () => {
    it('should store and retrieve metadata', () => {
      const mockMetadata = {
        name: 'Test Symbol',
        category: 'equipment',
        description: 'A test symbol',
        tags: ['vessel', 'equipment']
      };

      testCache.setMetadata('test-symbol', mockMetadata);
      const retrieved = testCache.getMetadata('test-symbol');

      expect(retrieved).toEqual(mockMetadata);
      expect(retrieved.name).toBe('Test Symbol');
    });

    it('should return null for missing metadata', () => {
      expect(testCache.getMetadata('nonexistent')).toBeNull();
    });

    it('should check if metadata exists', () => {
      const mockMetadata = { name: 'Test' };
      
      testCache.setMetadata('test-symbol', mockMetadata);
      
      expect(testCache.hasMetadata('test-symbol')).toBe(true);
      expect(testCache.hasMetadata('nonexistent')).toBe(false);
    });
  });

  describe('batch operations', () => {
    it('should preload multiple symbols', async () => {
      const symbolPaths = ['/symbol1.svg', '/symbol2.svg', '/symbol3.svg'];
      
      // Mock console.log to verify preloading
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation();

      await testCache.preloadSymbols(symbolPaths);

      expect(consoleSpy).toHaveBeenCalledTimes(3);
      expect(consoleSpy).toHaveBeenCalledWith('Preloading symbol: /symbol1.svg');
      
      consoleSpy.mockRestore();
    });

    it('should skip already cached symbols during preload', async () => {
      const mockData: SymbolCacheData = {
        svgContent: '<svg></svg>',
        viewBox: { x: 0, y: 0, width: 64, height: 64 },
        redElements: document.createDocumentFragment().querySelectorAll('*'),
        scaleFactors: { x: 1, y: 1 },
        connectionPoints: [],
        symbolKey: null
      };

      testCache.setSymbolData('/symbol1.svg', mockData);
      
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation();
      
      await testCache.preloadSymbols(['/symbol1.svg', '/symbol2.svg']);

      // Should only preload symbol2 since symbol1 is already cached
      expect(consoleSpy).toHaveBeenCalledTimes(1);
      expect(consoleSpy).toHaveBeenCalledWith('Preloading symbol: /symbol2.svg');
      
      consoleSpy.mockRestore();
    });

    it('should invalidate symbol across all caches', () => {
      const mockData: SymbolCacheData = {
        svgContent: '<svg></svg>',
        viewBox: { x: 0, y: 0, width: 64, height: 64 },
        redElements: document.createDocumentFragment().querySelectorAll('*'),
        scaleFactors: { x: 1, y: 1 },
        connectionPoints: [],
        symbolKey: null
      };

      testCache.setSymbolData('test-symbol', mockData);
      testCache.setPreview('test-symbol', 'preview-data');
      testCache.setMetadata('test-symbol', { name: 'Test' });

      expect(testCache.hasSymbolData('test-symbol')).toBe(true);
      expect(testCache.hasPreview('test-symbol')).toBe(true);
      expect(testCache.hasMetadata('test-symbol')).toBe(true);

      testCache.invalidateSymbol('test-symbol');

      expect(testCache.hasSymbolData('test-symbol')).toBe(false);
      expect(testCache.hasPreview('test-symbol')).toBe(false);
      expect(testCache.hasMetadata('test-symbol')).toBe(false);
    });
  });

  describe('cache management', () => {
    it('should clear all caches', () => {
      const mockData: SymbolCacheData = {
        svgContent: '<svg></svg>',
        viewBox: { x: 0, y: 0, width: 64, height: 64 },
        redElements: document.createDocumentFragment().querySelectorAll('*'),
        scaleFactors: { x: 1, y: 1 },
        connectionPoints: [],
        symbolKey: null
      };

      testCache.setSymbolData('symbol1', mockData);
      testCache.setPreview('symbol1', 'preview');
      testCache.setMetadata('symbol1', { name: 'Test' });

      testCache.clearAll();

      expect(testCache.hasSymbolData('symbol1')).toBe(false);
      expect(testCache.hasPreview('symbol1')).toBe(false);
      expect(testCache.hasMetadata('symbol1')).toBe(false);
    });

    it('should provide cache statistics', () => {
      const mockData: SymbolCacheData = {
        svgContent: '<svg></svg>',
        viewBox: { x: 0, y: 0, width: 64, height: 64 },
        redElements: document.createDocumentFragment().querySelectorAll('*'),
        scaleFactors: { x: 1, y: 1 },
        connectionPoints: [],
        symbolKey: null
      };

      testCache.setSymbolData('symbol1', mockData);
      testCache.setPreview('symbol1', 'preview-data');
      testCache.setMetadata('symbol1', { name: 'Test' });

      const stats = testCache.getStats();

      expect(stats.svg).toBeDefined();
      expect(stats.preview).toBeDefined();
      expect(stats.metadata).toBeDefined();
      expect(stats.totalMemory).toBeGreaterThan(0);
      expect(typeof stats.svg.size).toBe('number');
      expect(typeof stats.preview.size).toBe('number');
      expect(typeof stats.metadata.size).toBe('number');
    });
  });

  describe('key normalization', () => {
    it('should normalize keys consistently', () => {
      const mockData: SymbolCacheData = {
        svgContent: '<svg></svg>',
        viewBox: { x: 0, y: 0, width: 64, height: 64 },
        redElements: document.createDocumentFragment().querySelectorAll('*'),
        scaleFactors: { x: 1, y: 1 },
        connectionPoints: [],
        symbolKey: null
      };

      // Test different key formats that should be normalized to the same key
      testCache.setSymbolData('PATH\\TO\\SYMBOL.svg', mockData);
      
      expect(testCache.hasSymbolData('path/to/symbol.svg')).toBe(true);
      expect(testCache.hasSymbolData('PATH/TO/SYMBOL.SVG')).toBe(true);
      expect(testCache.getSymbolData('path\\to\\symbol.svg')).toBeDefined();
    });
  });

  describe('singleton pattern', () => {
    it('should return the same instance', () => {
      const instance1 = SymbolCache.getInstance();
      const instance2 = SymbolCache.getInstance();

      expect(instance1).toBe(instance2);
    });

    it('should maintain state across getInstance calls', () => {
      const mockData: SymbolCacheData = {
        svgContent: '<svg></svg>',
        viewBox: { x: 0, y: 0, width: 64, height: 64 },
        redElements: document.createDocumentFragment().querySelectorAll('*'),
        scaleFactors: { x: 1, y: 1 },
        connectionPoints: [],
        symbolKey: null
      };

      const instance1 = SymbolCache.getInstance();
      instance1.setSymbolData('persistent-key', mockData);

      const instance2 = SymbolCache.getInstance();
      expect(instance2.hasSymbolData('persistent-key')).toBe(true);
      expect(instance2.getSymbolData('persistent-key')).toBeDefined();
    });
  });

  describe('global symbol cache', () => {
    it('should use the global instance', () => {
      expect(symbolCache).toBeInstanceOf(SymbolCache);
      expect(symbolCache).toBe(SymbolCache.getInstance());
    });
  });

  describe('edge cases', () => {
    it('should handle empty or null keys gracefully', () => {
      const mockData: SymbolCacheData = {
        svgContent: '<svg></svg>',
        viewBox: { x: 0, y: 0, width: 64, height: 64 },
        redElements: document.createDocumentFragment().querySelectorAll('*'),
        scaleFactors: { x: 1, y: 1 },
        connectionPoints: [],
        symbolKey: null
      };

      // Empty key should be handled
      testCache.setSymbolData('', mockData);
      expect(testCache.hasSymbolData('')).toBe(true);
    });

    it('should handle large data objects', () => {
      const largeData: SymbolCacheData = {
        svgContent: '<svg>' + 'x'.repeat(10000) + '</svg>', // Large SVG content
        viewBox: { x: 0, y: 0, width: 64, height: 64 },
        redElements: document.createDocumentFragment().querySelectorAll('*'),
        scaleFactors: { x: 1, y: 1 },
        connectionPoints: Array(100).fill(0).map((_, i) => ({
          x: i,
          y: i,
          direction: 'horizontal' as const,
          side: 'top' as const,
          type: 'connection' as const,
          handleId: `handle-${i}`
        })),
        symbolKey: 'large-symbol'
      };

      // Should handle large data without throwing
      expect(() => {
        testCache.setSymbolData('large-symbol', largeData);
      }).not.toThrow();

      expect(testCache.hasSymbolData('large-symbol')).toBe(true);
    });
  });
});