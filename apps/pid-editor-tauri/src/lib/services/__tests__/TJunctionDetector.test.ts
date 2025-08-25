import { describe, it, expect, beforeEach } from 'vitest';
import { TJunctionDetector } from '../TJunctionDetector';

describe('TJunctionDetector', () => {
  let detector: TJunctionDetector;

  beforeEach(() => {
    detector = new TJunctionDetector();
  });

  describe('vessel detection', () => {
    it('should detect T-junctions for vessel dished head', () => {
      const result = detector.detectTJunctionsForSymbol('vessel-dished-head', 100, 80);

      expect(result).toHaveLength(4);
      
      // Check positions
      const positions = result.map(tj => ({ x: tj.x, y: tj.y }));
      expect(positions).toContainEqual({ x: 50, y: 0 });   // top
      expect(positions).toContainEqual({ x: 50, y: 80 });  // bottom
      expect(positions).toContainEqual({ x: 0, y: 40 });   // left
      expect(positions).toContainEqual({ x: 100, y: 40 }); // right
    });

    it('should detect T-junctions for vessel flat head', () => {
      const result = detector.detectTJunctionsForSymbol('vessel-flat-head', 120, 100);

      expect(result).toHaveLength(4);
      expect(result[0]).toMatchObject({
        x: 60,
        y: 0,
        direction: 'vertical',
        side: 'top'
      });
    });

    it('should handle vessel with custom dimensions', () => {
      const result = detector.detectTJunctionsForSymbol('vessel-dished-head', 150, 200);

      expect(result).toHaveLength(4);
      expect(result.find(tj => tj.side === 'top')).toMatchObject({
        x: 75, // 150/2
        y: 0
      });
      expect(result.find(tj => tj.side === 'left')).toMatchObject({
        x: 0,
        y: 100 // 200/2
      });
    });
  });

  describe('storage tank detection', () => {
    it('should detect T-junctions for storage tank', () => {
      const result = detector.detectTJunctionsForSymbol('storage-tank', 80, 80);

      expect(result).toHaveLength(4);
      expect(result.every(tj => tj.type === 'connection')).toBe(true);
    });

    it('should detect T-junctions for storage tank floating roof', () => {
      const result = detector.detectTJunctionsForSymbol('storage-tank-floating-roof', 100, 120);

      expect(result).toHaveLength(4);
      expect(result.find(tj => tj.side === 'bottom')).toMatchObject({
        x: 50,
        y: 120
      });
    });
  });

  describe('heat exchanger detection', () => {
    it('should detect T-junctions for shell and tube heat exchanger', () => {
      const result = detector.detectTJunctionsForSymbol('heat-exchanger-shell-tube', 140, 60);

      expect(result).toHaveLength(4);
      
      // Should have proper handle IDs
      const handleIds = result.map(tj => tj.handleId);
      expect(handleIds).toContain('top-connection');
      expect(handleIds).toContain('bottom-connection');
      expect(handleIds).toContain('left-connection');
      expect(handleIds).toContain('right-connection');
    });

    it('should detect T-junctions for plate heat exchanger', () => {
      const result = detector.detectTJunctionsForSymbol('heat-exchanger-plate', 100, 80);

      expect(result).toHaveLength(4);
      expect(result.every(tj => tj.direction === 'vertical' || tj.direction === 'horizontal')).toBe(true);
    });
  });

  describe('pump detection', () => {
    it('should detect T-junctions for centrifugal pump', () => {
      const result = detector.detectTJunctionsForSymbol('pump-centrifugal', 60, 60);

      expect(result).toHaveLength(2);
      
      // Should have inlet and outlet
      const sides = result.map(tj => tj.side);
      expect(sides).toContain('left');
      expect(sides).toContain('right');
    });

    it('should detect T-junctions for positive displacement pump', () => {
      const result = detector.detectTJunctionsForSymbol('pump-positive-displacement', 80, 50);

      expect(result).toHaveLength(2);
      expect(result.find(tj => tj.side === 'left')).toMatchObject({
        direction: 'horizontal',
        type: 'connection'
      });
    });
  });

  describe('compressor detection', () => {
    it('should detect T-junctions for centrifugal compressor', () => {
      const result = detector.detectTJunctionsForSymbol('compressor-centrifugal', 70, 70);

      expect(result).toHaveLength(2);
      expect(result.every(tj => tj.side === 'left' || tj.side === 'right')).toBe(true);
    });

    it('should detect T-junctions for reciprocating compressor', () => {
      const result = detector.detectTJunctionsForSymbol('compressor-reciprocating', 90, 60);

      expect(result).toHaveLength(2);
      const positions = result.map(tj => ({ x: tj.x, y: tj.y }));
      expect(positions).toContainEqual({ x: 0, y: 30 });
      expect(positions).toContainEqual({ x: 90, y: 30 });
    });
  });

  describe('column detection', () => {
    it('should detect T-junctions for distillation column', () => {
      const result = detector.detectTJunctionsForSymbol('column-distillation', 60, 200);

      expect(result).toHaveLength(6);
      
      // Should have top, bottom, and multiple side connections
      const sides = result.map(tj => tj.side);
      expect(sides).toContain('top');
      expect(sides).toContain('bottom');
      expect(sides.filter(side => side === 'left').length).toBeGreaterThan(0);
      expect(sides.filter(side => side === 'right').length).toBeGreaterThan(0);
    });

    it('should detect T-junctions for packed column', () => {
      const result = detector.detectTJunctionsForSymbol('column-packed', 80, 250);

      expect(result).toHaveLength(6);
      expect(result.find(tj => tj.side === 'left' && tj.y === 83.33)).toBeDefined(); // height/3
    });
  });

  describe('tower detection', () => {
    it('should detect T-junctions for cooling tower', () => {
      const result = detector.detectTJunctionsForSymbol('tower-cooling', 100, 150);

      expect(result).toHaveLength(4);
      expect(result.every(tj => ['top', 'bottom', 'left', 'right'].includes(tj.side))).toBe(true);
    });

    it('should detect T-junctions for fractionation tower', () => {
      const result = detector.detectTJunctionsForSymbol('tower-fractionation', 70, 180);

      expect(result).toHaveLength(6);
    });
  });

  describe('reactor detection', () => {
    it('should detect T-junctions for reactor stirred', () => {
      const result = detector.detectTJunctionsForSymbol('reactor-stirred', 100, 120);

      expect(result).toHaveLength(4);
      expect(result.find(tj => tj.side === 'top')).toMatchObject({
        x: 50,
        y: 0,
        direction: 'vertical'
      });
    });

    it('should detect T-junctions for reactor fixed bed', () => {
      const result = detector.detectTJunctionsForSymbol('reactor-fixed-bed', 80, 100);

      expect(result).toHaveLength(4);
    });
  });

  describe('edge cases', () => {
    it('should return empty array for unknown symbol types', () => {
      const result = detector.detectTJunctionsForSymbol('unknown-symbol', 100, 100);
      expect(result).toHaveLength(0);
    });

    it('should handle zero dimensions', () => {
      const result = detector.detectTJunctionsForSymbol('vessel-dished-head', 0, 0);
      expect(result).toHaveLength(4);
      expect(result.every(tj => tj.x >= 0 && tj.y >= 0)).toBe(true);
    });

    it('should handle negative dimensions', () => {
      const result = detector.detectTJunctionsForSymbol('vessel-dished-head', -10, -20);
      expect(result).toHaveLength(4);
      // Should clamp to positive values or handle gracefully
      expect(result.every(tj => typeof tj.x === 'number' && typeof tj.y === 'number')).toBe(true);
    });

    it('should generate unique handle IDs', () => {
      const result = detector.detectTJunctionsForSymbol('vessel-dished-head', 100, 100);
      const handleIds = result.map(tj => tj.handleId);
      const uniqueIds = new Set(handleIds);
      
      expect(uniqueIds.size).toBe(handleIds.length);
    });

    it('should assign correct connection types', () => {
      const result = detector.detectTJunctionsForSymbol('vessel-dished-head', 100, 100);
      
      expect(result.every(tj => tj.type === 'connection')).toBe(true);
      expect(result.every(tj => ['vertical', 'horizontal'].includes(tj.direction))).toBe(true);
    });
  });

  describe('configuration validation', () => {
    it('should have valid configurations for all supported symbols', () => {
      const supportedSymbols = [
        'vessel-dished-head',
        'vessel-flat-head', 
        'vessel-semi-tube-coil',
        'vessel-full-tube-coil',
        'storage-tank',
        'storage-tank-floating-roof',
        'storage-tank-fixed-roof',
        'storage-sphere',
        'heat-exchanger-shell-tube',
        'heat-exchanger-plate',
        'pump-centrifugal',
        'pump-positive-displacement',
        'compressor-centrifugal',
        'compressor-reciprocating',
        'column-distillation',
        'column-packed',
        'tower-cooling',
        'tower-fractionation',
        'reactor-stirred',
        'reactor-fixed-bed'
      ];

      supportedSymbols.forEach(symbol => {
        const result = detector.detectTJunctionsForSymbol(symbol, 100, 100);
        expect(result).toBeInstanceOf(Array);
        expect(result.length).toBeGreaterThan(0);
        
        result.forEach(tj => {
          expect(tj).toHaveProperty('x');
          expect(tj).toHaveProperty('y');
          expect(tj).toHaveProperty('direction');
          expect(tj).toHaveProperty('side');
          expect(tj).toHaveProperty('type');
          expect(tj).toHaveProperty('handleId');
          expect(typeof tj.x).toBe('number');
          expect(typeof tj.y).toBe('number');
          expect(['vertical', 'horizontal'].includes(tj.direction)).toBe(true);
          expect(['top', 'bottom', 'left', 'right'].includes(tj.side)).toBe(true);
          expect(tj.type).toBe('connection');
          expect(typeof tj.handleId).toBe('string');
          expect(tj.handleId.length).toBeGreaterThan(0);
        });
      });
    });
  });
});