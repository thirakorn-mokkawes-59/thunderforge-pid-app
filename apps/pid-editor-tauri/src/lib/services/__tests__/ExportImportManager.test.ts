import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ExportImportManager, type DiagramData, type ExportOptions } from '../ExportImportManager';

// Mock DOM APIs
global.Blob = vi.fn().mockImplementation((content, options) => ({
  text: vi.fn().mockResolvedValue(content[0]),
  size: content[0]?.length || 0,
  type: options?.type || 'text/plain'
})) as any;

global.URL = {
  createObjectURL: vi.fn().mockReturnValue('mock-url'),
  revokeObjectURL: vi.fn()
} as any;

describe('ExportImportManager', () => {
  let manager: ExportImportManager;

  beforeEach(() => {
    manager = ExportImportManager.getInstance();
    vi.clearAllMocks();
  });

  describe('Format Support', () => {
    it('should return supported export formats', () => {
      const formats = manager.getSupportedExportFormats();
      
      expect(formats).toHaveLength(7);
      expect(formats.some(f => f.format === 'json')).toBe(true);
      expect(formats.some(f => f.format === 'svg')).toBe(true);
      expect(formats.some(f => f.format === 'png')).toBe(true);
      expect(formats.some(f => f.format === 'pdf')).toBe(true);
    });

    it('should return supported import formats', () => {
      const formats = manager.getSupportedImportFormats();
      
      expect(formats.length).toBeGreaterThan(0);
      expect(formats.some(f => f.format === 'json')).toBe(true);
      expect(formats.some(f => f.format === 'svg')).toBe(true);
    });
  });

  describe('JSON Export/Import', () => {
    const sampleDiagramData: DiagramData = {
      version: '1.0.0',
      metadata: {
        title: 'Test Diagram',
        description: 'Test description',
        author: 'Test Author',
        company: 'Test Company',
        project: 'Test Project',
        version: '1.0',
        createdAt: '2024-01-01T00:00:00Z',
        modifiedAt: '2024-01-01T00:00:00Z',
        tags: ['test'],
        standard: 'ISO',
        units: 'metric'
      },
      elements: [
        {
          id: 'element-1',
          type: 'pump',
          position: { x: 100, y: 100 },
          data: { label: 'Test Pump' },
          style: {},
          layer: 'default',
          locked: false,
          visible: true
        }
      ],
      connections: [
        {
          id: 'connection-1',
          source: 'element-1',
          target: 'element-2',
          sourceHandle: 'out',
          targetHandle: 'in',
          type: 'default',
          data: {},
          style: {},
          layer: 'default'
        }
      ],
      layers: [
        {
          id: 'default',
          name: 'Default',
          visible: true,
          locked: false,
          opacity: 1,
          color: '#000000',
          order: 0
        }
      ],
      settings: {
        grid: {
          enabled: true,
          size: 20,
          color: '#e0e0e0',
          opacity: 0.5
        },
        snap: {
          enabled: true,
          threshold: 10
        },
        theme: 'light',
        units: 'metric',
        precision: 2
      },
      viewport: {
        x: 0,
        y: 0,
        zoom: 1
      },
      exportedAt: '2024-01-01T00:00:00Z',
      exportedBy: 'Test'
    };

    it('should export diagram to JSON format', async () => {
      const options: ExportOptions = {
        format: 'json',
        includeMetadata: true,
        includePerformanceData: false,
        compressionLevel: 'none',
        exportScope: 'all'
      };

      const result = await manager.exportDiagram(
        sampleDiagramData.elements,
        sampleDiagramData.connections,
        options
      );

      expect(result.success).toBe(true);
      expect(result.mimeType).toBe('application/json');
      expect(result.filename).toContain('.json');
      expect(result.data).toBeDefined();
      expect(result.errors).toHaveLength(0);
    });

    it('should import diagram from JSON format', async () => {
      const jsonContent = JSON.stringify(sampleDiagramData);
      const file = new File([jsonContent], 'test.json', { type: 'application/json' });

      const result = await manager.importDiagram(file);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.elements).toHaveLength(1);
      expect(result.data?.connections).toHaveLength(1);
      expect(result.errors).toHaveLength(0);
      expect(result.metadata.format).toBe('json');
      expect(result.metadata.elementsCount).toBe(1);
      expect(result.metadata.connectionsCount).toBe(1);
    });

    it('should handle malformed JSON gracefully', async () => {
      const invalidJson = '{ invalid json }';
      const file = new File([invalidJson], 'invalid.json', { type: 'application/json' });

      const result = await manager.importDiagram(file);

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('JSON import failed');
    });
  });

  describe('CSV Export', () => {
    it('should export diagram to CSV format', async () => {
      const elements = [
        {
          id: 'pump-1',
          type: 'pump',
          position: { x: 100, y: 200 },
          data: { label: 'Main Pump', width: 80, height: 60 },
          style: {},
          layer: 'equipment',
          locked: false,
          visible: true
        },
        {
          id: 'valve-1',
          type: 'valve',
          position: { x: 300, y: 200 },
          data: { label: 'Control Valve', width: 40, height: 40 },
          style: {},
          layer: 'equipment',
          locked: false,
          visible: true
        }
      ];

      const options: ExportOptions = {
        format: 'csv',
        includeMetadata: false,
        includePerformanceData: false,
        compressionLevel: 'none',
        exportScope: 'all'
      };

      const result = await manager.exportDiagram(elements, [], options);

      expect(result.success).toBe(true);
      expect(result.mimeType).toBe('text/csv');
      expect(result.filename).toContain('.csv');
      expect(result.data).toBeDefined();
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('Export Scope Filtering', () => {
    const elements = [
      {
        id: 'visible-element',
        type: 'pump',
        position: { x: 100, y: 100 },
        data: {},
        style: {},
        layer: 'default',
        locked: false,
        visible: true
      },
      {
        id: 'hidden-element',
        type: 'valve',
        position: { x: 200, y: 100 },
        data: {},
        style: {},
        layer: 'default',
        locked: false,
        visible: false
      }
    ];

    const connections = [
      {
        id: 'visible-connection',
        source: 'visible-element',
        target: 'visible-element',
        sourceHandle: 'out',
        targetHandle: 'in',
        type: 'default',
        data: {},
        style: {},
        layer: 'default'
      },
      {
        id: 'hidden-connection',
        source: 'visible-element',
        target: 'hidden-element',
        sourceHandle: 'out',
        targetHandle: 'in',
        type: 'default',
        data: {},
        style: {},
        layer: 'default'
      }
    ];

    it('should export all elements when scope is "all"', async () => {
      const options: ExportOptions = {
        format: 'json',
        includeMetadata: true,
        includePerformanceData: false,
        compressionLevel: 'none',
        exportScope: 'all'
      };

      const result = await manager.exportDiagram(elements, connections, options);
      
      expect(result.success).toBe(true);
      
      if (result.data) {
        const jsonContent = await (result.data as Blob).text();
        const exportedData = JSON.parse(jsonContent) as DiagramData;
        
        expect(exportedData.elements).toHaveLength(2);
        expect(exportedData.connections).toHaveLength(2);
      }
    });

    it('should export only visible elements when scope is "visible"', async () => {
      const options: ExportOptions = {
        format: 'json',
        includeMetadata: true,
        includePerformanceData: false,
        compressionLevel: 'none',
        exportScope: 'visible'
      };

      const result = await manager.exportDiagram(elements, connections, options);
      
      expect(result.success).toBe(true);
      
      if (result.data) {
        const jsonContent = await (result.data as Blob).text();
        const exportedData = JSON.parse(jsonContent) as DiagramData;
        
        expect(exportedData.elements).toHaveLength(1);
        expect(exportedData.elements[0].id).toBe('visible-element');
        // Connections should be filtered to only include those between visible elements
        expect(exportedData.connections).toHaveLength(1);
        expect(exportedData.connections[0].id).toBe('visible-connection');
      }
    });
  });

  describe('Data Validation', () => {
    it('should validate imported diagram data', async () => {
      const invalidDiagramData = {
        version: '1.0.0',
        metadata: {},
        elements: [
          {
            // Missing required id
            type: 'pump',
            position: { x: 100, y: 100 },
            data: {},
            style: {},
            layer: 'default',
            locked: false,
            visible: true
          }
        ],
        connections: [
          {
            id: 'conn-1',
            source: 'non-existent-source',
            target: 'non-existent-target',
            sourceHandle: 'out',
            targetHandle: 'in',
            type: 'default',
            data: {},
            style: {},
            layer: 'default'
          }
        ],
        layers: [],
        settings: {},
        viewport: { x: 0, y: 0, zoom: 1 },
        exportedAt: '2024-01-01T00:00:00Z',
        exportedBy: 'Test'
      };

      const jsonContent = JSON.stringify(invalidDiagramData);
      const file = new File([jsonContent], 'invalid.json', { type: 'application/json' });

      const result = await manager.importDiagram(file);

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it('should handle missing elements array', async () => {
      const invalidData = {
        version: '1.0.0',
        // Missing elements array
        connections: []
      };

      const jsonContent = JSON.stringify(invalidData);
      const file = new File([jsonContent], 'invalid.json', { type: 'application/json' });

      const result = await manager.importDiagram(file);

      expect(result.success).toBe(false);
      expect(result.errors.some(error => error.includes('elements array'))).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle unsupported export format', async () => {
      const options: ExportOptions = {
        format: 'unsupported' as any,
        includeMetadata: true,
        includePerformanceData: false,
        compressionLevel: 'none',
        exportScope: 'all'
      };

      const result = await manager.exportDiagram([], [], options);

      expect(result.success).toBe(false);
      expect(result.errors[0]).toContain('Unsupported export format');
    });

    it('should handle unsupported import format', async () => {
      const file = new File(['content'], 'test.unknown', { type: 'application/unknown' });

      const result = await manager.importDiagram(file);

      expect(result.success).toBe(false);
      expect(result.errors[0]).toContain('Unsupported import format');
    });

    it('should handle file reading errors', async () => {
      // Create a mock file that will cause reading to fail
      const mockFile = {
        name: 'test.json',
        type: 'application/json',
        size: 100
      } as File;

      // Mock FileReader to simulate error
      const originalFileReader = global.FileReader;
      global.FileReader = vi.fn().mockImplementation(() => ({
        readAsText: vi.fn().mockImplementation(function() {
          setTimeout(() => this.onerror?.(), 0);
        }),
        readAsArrayBuffer: vi.fn().mockImplementation(function() {
          setTimeout(() => this.onerror?.(), 0);
        })
      })) as any;

      const result = await manager.importDiagram(mockFile);

      expect(result.success).toBe(false);
      expect(result.errors[0]).toContain('Import failed');

      // Restore FileReader
      global.FileReader = originalFileReader;
    });
  });

  describe('Format Detection', () => {
    it('should detect JSON format from extension', async () => {
      const file = new File(['{}'], 'test.json', { type: '' });
      const result = await manager.importDiagram(file);
      
      // Should attempt JSON import even if it fails due to empty object
      expect(result.metadata.format).toBe('json');
    });

    it('should detect SVG format from extension', async () => {
      const file = new File(['<svg></svg>'], 'test.svg', { type: 'image/svg+xml' });
      const result = await manager.importDiagram(file);
      
      expect(result.metadata.format).toBe('svg');
    });

    it('should detect unknown format for unsupported extensions', async () => {
      const file = new File(['{}'], 'test.unknown', { type: '' });
      const result = await manager.importDiagram(file);
      
      expect(result.metadata.format).toBe('unknown');
      expect(result.success).toBe(false);
      expect(result.errors[0]).toContain('Unsupported import format');
    });
  });
});