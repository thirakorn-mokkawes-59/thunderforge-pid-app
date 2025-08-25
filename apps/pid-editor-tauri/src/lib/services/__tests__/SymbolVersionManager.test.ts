import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SymbolVersionManager, type SymbolVersion, type SymbolMetadata, type SymbolProperties } from '../SymbolVersionManager';

// Mock DOM APIs
global.DOMParser = vi.fn().mockImplementation(() => ({
  parseFromString: vi.fn().mockReturnValue({
    querySelector: vi.fn((selector: string) => {
      if (selector === 'parsererror') {
        return null; // No parser errors
      }
      if (selector === 'svg') {
        return {
          getAttribute: vi.fn().mockReturnValue('100'),
          querySelector: vi.fn((innerSelector: string) => {
            if (innerSelector === 'title' || innerSelector === 'desc') {
              return null; // No title or desc elements
            }
            return null;
          })
        };
      }
      return null;
    })
  })
}));

describe('SymbolVersionManager', () => {
  let manager: SymbolVersionManager;

  const createTestSymbolVersion = (overrides: Partial<SymbolVersion> = {}): Omit<SymbolVersion, 'id' | 'createdAt' | 'status'> => ({
    symbolId: 'test-symbol',
    version: '1.0.0',
    name: 'Test Symbol',
    description: 'Test symbol description',
    svgContent: '<svg width="100" height="100"><circle cx="50" cy="50" r="30"/></svg>',
    metadata: {
      standard: 'CUSTOM',
      category: 'test',
      keywords: ['test', 'sample'],
      dimensions: { width: 100, height: 100, aspectRatio: 1 },
      complexity: 'moderate',
      usage: { frequency: 0, lastUsed: 0, contexts: [] }
    },
    properties: {
      scalable: true,
      rotatable: true,
      flippable: true,
      configurable: false,
      parameters: [],
      variants: [],
      constraints: []
    },
    connectionPoints: [
      {
        id: 'inlet',
        name: 'Inlet',
        position: { x: 10, y: 50 },
        direction: 'west',
        type: 'input',
        connectionTypes: ['process'],
        required: true,
        multiple: false,
        constraints: []
      }
    ],
    createdBy: 'test-user',
    changeLog: 'Initial version',
    tags: ['test'],
    ...overrides
  });

  beforeEach(() => {
    // Create fresh instance for each test
    (SymbolVersionManager as any).instance = undefined;
    manager = SymbolVersionManager.getInstance();
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const instance1 = SymbolVersionManager.getInstance();
      const instance2 = SymbolVersionManager.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('Symbol Version Management', () => {
    it('should create a new symbol version', async () => {
      const symbolData = createTestSymbolVersion();
      const versionId = await manager.createSymbolVersion('test-symbol', symbolData);

      expect(versionId).toBeDefined();
      expect(typeof versionId).toBe('string');

      const retrievedSymbol = manager.getSymbolVersion('test-symbol');
      expect(retrievedSymbol).toBeDefined();
      expect(retrievedSymbol!.name).toBe('Test Symbol');
      expect(retrievedSymbol!.version).toBe('1.0.0');
    });

    it('should get symbol version by version number', async () => {
      const symbolData = createTestSymbolVersion();
      await manager.createSymbolVersion('test-symbol', symbolData);

      // Create another version
      await manager.createSymbolVersion('test-symbol', {
        ...symbolData,
        version: '1.1.0',
        changeLog: 'Updated version'
      });

      const v1 = manager.getSymbolVersion('test-symbol', '1.0.0');
      const v2 = manager.getSymbolVersion('test-symbol', '1.1.0');
      const latest = manager.getSymbolVersion('test-symbol');

      expect(v1!.version).toBe('1.0.0');
      expect(v2!.version).toBe('1.1.0');
      expect(latest!.version).toBe('1.1.0'); // Should return latest
    });

    it('should get all versions of a symbol', async () => {
      const symbolData = createTestSymbolVersion();
      await manager.createSymbolVersion('test-symbol', symbolData);
      await manager.createSymbolVersion('test-symbol', {
        ...symbolData,
        version: '1.1.0'
      });
      await manager.createSymbolVersion('test-symbol', {
        ...symbolData,
        version: '2.0.0'
      });

      const versions = manager.getSymbolVersions('test-symbol');
      expect(versions).toHaveLength(3);
      expect(versions.map(v => v.version)).toEqual(['1.0.0', '1.1.0', '2.0.0']);
    });

    it('should update symbol version', async () => {
      const symbolData = createTestSymbolVersion();
      const versionId = await manager.createSymbolVersion('test-symbol', symbolData);

      await manager.updateSymbolVersion('test-symbol', versionId, {
        name: 'Updated Symbol Name',
        description: 'Updated description'
      });

      const updatedSymbol = manager.getSymbolVersion('test-symbol');
      expect(updatedSymbol!.name).toBe('Updated Symbol Name');
      expect(updatedSymbol!.description).toBe('Updated description');
    });

    it('should delete symbol version', async () => {
      const symbolData = createTestSymbolVersion();
      const versionId1 = await manager.createSymbolVersion('test-symbol', symbolData);
      const versionId2 = await manager.createSymbolVersion('test-symbol', {
        ...symbolData,
        version: '1.1.0'
      });

      const deleted = manager.deleteSymbolVersion('test-symbol', versionId1);
      expect(deleted).toBe(true);

      const versions = manager.getSymbolVersions('test-symbol');
      expect(versions).toHaveLength(1);
      expect(versions[0].version).toBe('1.1.0');
    });

    it('should not delete the only version', async () => {
      const symbolData = createTestSymbolVersion();
      const versionId = await manager.createSymbolVersion('test-symbol', symbolData);

      expect(() => {
        manager.deleteSymbolVersion('test-symbol', versionId);
      }).toThrow('Cannot delete the only version of a symbol');
    });
  });

  describe('Symbol Validation', () => {
    it('should validate a valid symbol', async () => {
      const symbolData = createTestSymbolVersion();
      const tempSymbol = {
        ...symbolData,
        id: 'temp-id',
        createdAt: Date.now(),
        status: 'draft' as const
      };

      const validation = await manager.validateSymbol(tempSymbol);

      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
      expect(validation.score).toBeGreaterThan(70);
    });

    it('should detect validation errors', async () => {
      const invalidSymbolData = createTestSymbolVersion({
        svgContent: 'invalid svg content',
        metadata: {
          standard: 'CUSTOM',
          category: '', // Missing category
          keywords: [],
          dimensions: { width: 100, height: 100, aspectRatio: 1 },
          complexity: 'moderate',
          usage: { frequency: 0, lastUsed: 0, contexts: [] }
        }
      });

      const tempSymbol = {
        ...invalidSymbolData,
        id: 'temp-id',
        createdAt: Date.now(),
        status: 'draft' as const
      };

      const validation = await manager.validateSymbol(tempSymbol);

      expect(validation.valid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
      expect(validation.score).toBeLessThan(100);
    });

    it('should provide validation suggestions', async () => {
      const symbolData = createTestSymbolVersion({
        connectionPoints: [], // No connection points
        metadata: {
          standard: 'CUSTOM',
          category: 'test',
          keywords: [], // No keywords
          dimensions: { width: 100, height: 100, aspectRatio: 1 },
          complexity: 'moderate',
          usage: { frequency: 0, lastUsed: 0, contexts: [] }
        },
        description: '' // No description
      });

      const tempSymbol = {
        ...symbolData,
        id: 'temp-id',
        createdAt: Date.now(),
        status: 'draft' as const
      };

      const validation = await manager.validateSymbol(tempSymbol);

      expect(validation.suggestions.length).toBeGreaterThan(0);
      expect(validation.suggestions.some(s => s.includes('connection points'))).toBe(true);
      expect(validation.suggestions.some(s => s.includes('keywords'))).toBe(true);
      expect(validation.suggestions.some(s => s.includes('description'))).toBe(true);
    });
  });

  describe('Symbol Templates', () => {
    it('should create symbol from template', async () => {
      const versionId = await manager.createSymbolFromTemplate('basic-pump', {
        symbolId: 'custom-pump',
        name: 'My Custom Pump',
        parameters: {
          radius: 25,
          fillColor: '#ff0000',
          strokeColor: '#000000'
        }
      });

      expect(versionId).toBeDefined();

      const symbol = manager.getSymbolVersion('custom-pump');
      expect(symbol).toBeDefined();
      expect(symbol!.name).toBe('My Custom Pump');
      expect(symbol!.metadata.category).toBe('pumps');
      expect(symbol!.connectionPoints).toHaveLength(2); // inlet and outlet
    });

    it('should handle template parameters correctly', async () => {
      await manager.createSymbolFromTemplate('basic-pump', {
        symbolId: 'custom-pump',
        name: 'Custom Pump',
        parameters: {
          radius: 40,
          fillColor: '#blue',
          strokeColor: '#red'
        }
      });

      const symbol = manager.getSymbolVersion('custom-pump');
      expect(symbol!.svgContent).toContain('40'); // radius parameter
      expect(symbol!.svgContent).toContain('#blue'); // fillColor parameter
      expect(symbol!.svgContent).toContain('#red'); // strokeColor parameter
    });
  });

  describe('Symbol Variants', () => {
    it('should create symbol variant', async () => {
      const symbolData = createTestSymbolVersion();
      const versionId = await manager.createSymbolVersion('test-symbol', symbolData);

      const variantId = await manager.createSymbolVariant('test-symbol', versionId, {
        name: 'Large Variant',
        description: 'A larger version of the symbol',
        parameterOverrides: {
          size: 'large',
          scale: 1.5
        }
      });

      expect(variantId).toBeDefined();

      const symbol = manager.getSymbolVersion('test-symbol');
      expect(symbol!.properties.variants).toHaveLength(1);
      expect(symbol!.properties.variants[0].name).toBe('Large Variant');
    });
  });

  describe('Symbol Relationships', () => {
    it('should create symbol relationships', () => {
      const relationshipId = manager.createSymbolRelationship({
        type: 'inherits',
        sourceSymbolId: 'child-symbol',
        targetSymbolId: 'parent-symbol',
        relationship: 'Child symbol inherits from parent',
        metadata: {}
      });

      expect(relationshipId).toBeDefined();

      const relationships = manager.getSymbolRelationships('child-symbol');
      expect(relationships).toHaveLength(1);
      expect(relationships[0].type).toBe('inherits');
    });

    it('should get inheritance chain', () => {
      manager.createSymbolRelationship({
        type: 'inherits',
        sourceSymbolId: 'grandchild',
        targetSymbolId: 'child',
        relationship: 'inheritance',
        metadata: {}
      });

      manager.createSymbolRelationship({
        type: 'inherits',
        sourceSymbolId: 'child',
        targetSymbolId: 'parent',
        relationship: 'inheritance',
        metadata: {}
      });

      const chain = manager.getSymbolInheritanceChain('grandchild');
      expect(chain).toEqual(['grandchild', 'child', 'parent']);
    });
  });

  describe('Symbol Search', () => {
    beforeEach(async () => {
      // Create test symbols
      await manager.createSymbolVersion('pump-1', createTestSymbolVersion({
        symbolId: 'pump-1',
        name: 'Centrifugal Pump',
        metadata: {
          standard: 'ISO',
          category: 'pumps',
          keywords: ['pump', 'centrifugal'],
          dimensions: { width: 100, height: 100, aspectRatio: 1 },
          complexity: 'moderate',
          usage: { frequency: 0, lastUsed: 0, contexts: [] }
        },
        tags: ['pump', 'equipment']
      }));

      await manager.createSymbolVersion('valve-1', createTestSymbolVersion({
        symbolId: 'valve-1',
        name: 'Gate Valve',
        metadata: {
          standard: 'PIP',
          category: 'valves',
          keywords: ['valve', 'gate'],
          dimensions: { width: 80, height: 60, aspectRatio: 1.33 },
          complexity: 'simple',
          usage: { frequency: 0, lastUsed: 0, contexts: [] }
        },
        tags: ['valve', 'control']
      }));
    });

    it('should find symbols by name', () => {
      const results = manager.findSymbols({ name: 'pump' });
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('Centrifugal Pump');
    });

    it('should find symbols by category', () => {
      const results = manager.findSymbols({ category: 'valves' });
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('Gate Valve');
    });

    it('should find symbols by standard', () => {
      const results = manager.findSymbols({ standard: 'ISO' });
      expect(results).toHaveLength(1);
      expect(results[0].metadata.standard).toBe('ISO');
    });

    it('should find symbols by tags', () => {
      const results = manager.findSymbols({ tags: ['equipment'] });
      expect(results).toHaveLength(1);
      expect(results[0].tags.includes('equipment')).toBe(true);
    });

    it('should find symbols with connection points', () => {
      const results = manager.findSymbols({ hasConnectionPoints: true });
      expect(results.length).toBeGreaterThan(0);
      results.forEach(symbol => {
        expect(symbol.connectionPoints.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Export/Import', () => {
    it('should export symbol data', async () => {
      const symbolData = createTestSymbolVersion();
      await manager.createSymbolVersion('test-symbol', symbolData);

      const exported = manager.exportSymbol('test-symbol');

      expect(exported.symbol).toBeDefined();
      expect(exported.symbol.name).toBe('Test Symbol');
      expect(exported.relationships).toEqual([]);
      expect(exported.variants).toEqual([]);
    });

    it('should import symbol data', async () => {
      const symbolData = createTestSymbolVersion({
        symbolId: 'imported-symbol',
        name: 'Imported Symbol'
      });

      const tempSymbol = {
        ...symbolData,
        id: 'temp-id',
        createdAt: Date.now(),
        status: 'draft' as const
      };

      const versionId = await manager.importSymbol({
        symbol: tempSymbol,
        relationships: [],
        variants: []
      });

      expect(versionId).toBeDefined();

      const importedSymbol = manager.getSymbolVersion('imported-symbol');
      expect(importedSymbol).toBeDefined();
      expect(importedSymbol!.name).toBe('Imported Symbol');
    });

    it('should reject invalid imported symbols', async () => {
      const invalidSymbolData = {
        ...createTestSymbolVersion(),
        svgContent: 'invalid svg',
        metadata: {
          ...createTestSymbolVersion().metadata,
          category: '' // Invalid: missing category
        }
      };

      const tempSymbol = {
        ...invalidSymbolData,
        id: 'temp-id',
        createdAt: Date.now(),
        status: 'draft' as const
      };

      await expect(manager.importSymbol({
        symbol: tempSymbol
      })).rejects.toThrow('Imported symbol validation failed');
    });
  });

  describe('Version Comparison', () => {
    it('should sort versions correctly', async () => {
      const symbolData = createTestSymbolVersion();
      
      // Create versions out of order
      await manager.createSymbolVersion('test-symbol', { ...symbolData, version: '2.0.0' });
      await manager.createSymbolVersion('test-symbol', { ...symbolData, version: '1.0.0' });
      await manager.createSymbolVersion('test-symbol', { ...symbolData, version: '1.5.0' });
      await manager.createSymbolVersion('test-symbol', { ...symbolData, version: '1.0.1' });

      const versions = manager.getSymbolVersions('test-symbol');
      const versionNumbers = versions.map(v => v.version);
      
      expect(versionNumbers).toEqual(['1.0.0', '1.0.1', '1.5.0', '2.0.0']);
    });
  });

  describe('Error Handling', () => {
    it('should handle non-existent symbol', () => {
      const symbol = manager.getSymbolVersion('non-existent');
      expect(symbol).toBeNull();
    });

    it('should handle non-existent version', () => {
      const symbol = manager.getSymbolVersion('test-symbol', '99.99.99');
      expect(symbol).toBeNull();
    });

    it('should handle invalid template', async () => {
      await expect(manager.createSymbolFromTemplate('non-existent-template', {
        symbolId: 'test',
        name: 'Test',
        parameters: {}
      })).rejects.toThrow('Template non-existent-template not found');
    });
  });
});