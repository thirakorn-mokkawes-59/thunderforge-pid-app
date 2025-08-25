import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SVGParser } from '../svgParser';
import type { SVGProcessingOptions } from '../svgParser';

describe('SVGParser', () => {
  const defaultOptions: SVGProcessingOptions = {
    targetWidth: 100,
    targetHeight: 100,
    strokeWidth: 1,
    strokeLinecap: 'butt'
  };

  beforeEach(() => {
    vi.clearAllMocks();
    SVGParser.clearCache();
  });

  describe('loadSvg', () => {
    it('should load SVG content successfully', async () => {
      const mockSvgContent = '<svg viewBox="0 0 64 64"><rect width="100" height="100"/></svg>';
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(mockSvgContent),
      });

      const result = await SVGParser.loadSvg('/test.svg', defaultOptions);

      expect(result.svgContent).toContain('svg');
      expect(result.viewBox).toEqual({ x: 0, y: 0, width: 64, height: 64 });
      expect(global.fetch).toHaveBeenCalledWith('/test.svg', expect.any(Object));
    });

    it('should throw error for failed fetch', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 404,
        text: () => Promise.resolve('')
      });

      await expect(SVGParser.loadSvg('/nonexistent.svg', defaultOptions)).rejects.toThrow(
        'Failed to load SVG'
      );
    });

    it('should use cached content on subsequent calls', async () => {
      const mockSvgContent = '<svg viewBox="0 0 64 64"><circle r="50"/></svg>';
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(mockSvgContent),
      });

      // First call
      const result1 = await SVGParser.loadSvg('/cached.svg', defaultOptions);
      expect(result1.svgContent).toContain('svg');

      // Second call - should use cache
      const result2 = await SVGParser.loadSvg('/cached.svg', defaultOptions);
      expect(result2.svgContent).toContain('svg');
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('should handle abort signal', async () => {
      const controller = new AbortController();
      global.fetch = vi.fn().mockRejectedValueOnce(new DOMException('Aborted', 'AbortError'));

      controller.abort();

      await expect(SVGParser.loadSvg('/test.svg', defaultOptions, controller.signal))
        .rejects.toThrow('AbortError');
    });
  });

  describe('parseSvgContent', () => {
    it('should parse valid SVG content', () => {
      const svgContent = '<svg viewBox="0 0 100 100"><rect x="10" y="10"/></svg>';
      const result = SVGParser.parseSvgContent(svgContent, defaultOptions);

      expect(result.viewBox).toEqual({ x: 0, y: 0, width: 100, height: 100 });
      expect(result.svgContent).toContain('svg');
      expect(result.scaleFactors).toEqual({ x: 1, y: 1 });
    });

    it('should throw error for invalid SVG content', () => {
      const invalidContent = '<invalid>not svg</invalid>';
      
      expect(() => SVGParser.parseSvgContent(invalidContent, defaultOptions))
        .toThrow('Invalid SVG content');
    });

    it('should handle SVG with namespace', () => {
      const svgContent = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><path d="M0,0L10,10"/></svg>';
      const result = SVGParser.parseSvgContent(svgContent, defaultOptions);

      expect(result.viewBox).toEqual({ x: 0, y: 0, width: 64, height: 64 });
      expect(result.svgContent).toContain('xmlns');
    });
  });

  describe('parseTransform', () => {
    it('should extract translate coordinates', () => {
      const transform = 'translate(10, 20)';
      const result = SVGParser.parseTransform(transform);

      expect(result.x).toBe(10);
      expect(result.y).toBe(20);
      expect(result.rotation).toBeUndefined();
    });

    it('should extract translate and rotate', () => {
      const transform = 'translate(10, 20) rotate(45)';
      const result = SVGParser.parseTransform(transform);

      expect(result.x).toBe(10);
      expect(result.y).toBe(20);
      expect(result.rotation).toBe(45);
    });

    it('should handle empty transform', () => {
      const result = SVGParser.parseTransform('');

      expect(result.x).toBe(0);
      expect(result.y).toBe(0);
      expect(result.rotation).toBeUndefined();
    });
  });

  describe('transformIncludes', () => {
    it('should check if transform includes pattern', () => {
      const transform = 'translate(10, 20) rotate(45) scale(2)';
      
      expect(SVGParser.transformIncludes(transform, 'translate')).toBe(true);
      expect(SVGParser.transformIncludes(transform, 'rotate')).toBe(true);
      expect(SVGParser.transformIncludes(transform, 'matrix')).toBe(false);
    });

    it('should handle empty transform', () => {
      expect(SVGParser.transformIncludes('', 'translate')).toBe(false);
    });
  });

  describe('cache management', () => {
    it('should clear cache', async () => {
      const mockSvgContent = '<svg viewBox="0 0 64 64"><rect/></svg>';
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(mockSvgContent),
      });

      await SVGParser.loadSvg('/test.svg', defaultOptions);
      expect(SVGParser.getCacheSize()).toBe(1);
      
      SVGParser.clearCache();
      expect(SVGParser.getCacheSize()).toBe(0);
      
      // After clearing, should fetch again
      await SVGParser.loadSvg('/test.svg', defaultOptions);
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it('should get cache size', async () => {
      const mockSvgContent = '<svg viewBox="0 0 64 64"><rect/></svg>';
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(mockSvgContent),
      });

      expect(SVGParser.getCacheSize()).toBe(0);

      await SVGParser.loadSvg('/test1.svg', defaultOptions);
      expect(SVGParser.getCacheSize()).toBe(1);
      
      await SVGParser.loadSvg('/test2.svg', defaultOptions);
      expect(SVGParser.getCacheSize()).toBe(2);
    });
  });

});