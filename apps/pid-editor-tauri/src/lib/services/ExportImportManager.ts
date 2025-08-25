/**
 * Export/Import Manager Service
 * Handles exporting and importing PID diagrams in multiple formats
 */

export interface ExportOptions {
  format: ExportFormat;
  includeMetadata: boolean;
  includePerformanceData: boolean;
  compressionLevel: 'none' | 'low' | 'medium' | 'high';
  exportScope: 'visible' | 'selected' | 'all';
  imageOptions?: ImageExportOptions;
  pdfOptions?: PDFExportOptions;
}

export interface ImageExportOptions {
  width?: number;
  height?: number;
  scale: number;
  backgroundColor: string;
  quality: number; // 0-100 for JPEG
  dpi: number;
}

export interface PDFExportOptions {
  pageSize: 'A4' | 'A3' | 'A2' | 'A1' | 'A0' | 'letter' | 'legal' | 'tabloid';
  orientation: 'portrait' | 'landscape';
  margin: { top: number; right: number; bottom: number; left: number };
  includeTitle: boolean;
  includeLegend: boolean;
  includeTimestamp: boolean;
}

export interface DiagramData {
  version: string;
  metadata: DiagramMetadata;
  elements: DiagramElement[];
  connections: DiagramConnection[];
  layers: DiagramLayer[];
  settings: DiagramSettings;
  viewport: ViewportState;
  exportedAt: string;
  exportedBy: string;
}

export interface DiagramMetadata {
  title: string;
  description: string;
  author: string;
  company: string;
  project: string;
  version: string;
  createdAt: string;
  modifiedAt: string;
  tags: string[];
  standard: 'ISO' | 'PIP' | 'ANSI';
  units: 'metric' | 'imperial';
}

export interface DiagramElement {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: Record<string, any>;
  style: Record<string, any>;
  layer: string;
  locked: boolean;
  visible: boolean;
  metadata?: Record<string, any>;
}

export interface DiagramConnection {
  id: string;
  source: string;
  target: string;
  sourceHandle: string;
  targetHandle: string;
  type: string;
  data: Record<string, any>;
  path?: { x: number; y: number }[];
  style: Record<string, any>;
  layer: string;
  metadata?: Record<string, any>;
}

export interface DiagramLayer {
  id: string;
  name: string;
  visible: boolean;
  locked: boolean;
  opacity: number;
  color: string;
  order: number;
}

export interface DiagramSettings {
  grid: {
    enabled: boolean;
    size: number;
    color: string;
    opacity: number;
  };
  snap: {
    enabled: boolean;
    threshold: number;
  };
  theme: 'light' | 'dark' | 'auto';
  units: 'metric' | 'imperial';
  precision: number;
}

export interface ViewportState {
  x: number;
  y: number;
  zoom: number;
}

export interface ImportResult {
  success: boolean;
  data?: DiagramData;
  errors: string[];
  warnings: string[];
  metadata: {
    format: ExportFormat;
    version: string;
    elementsCount: number;
    connectionsCount: number;
  };
}

export interface ExportResult {
  success: boolean;
  data?: Blob | string;
  filename: string;
  mimeType: string;
  errors: string[];
}

export type ExportFormat = 
  | 'json'          // Native format
  | 'svg'           // Scalable Vector Graphics
  | 'png'           // Portable Network Graphics
  | 'jpeg'          // Joint Photographic Experts Group
  | 'pdf'           // Portable Document Format
  | 'dxf'           // AutoCAD Drawing Exchange Format
  | 'visio'         // Microsoft Visio
  | 'drawio'        // Draw.io XML format
  | 'lucidchart'    // Lucidchart format
  | 'plant-uml'     // PlantUML text format
  | 'bpmn'          // Business Process Model and Notation
  | 'xml'           // Generic XML format
  | 'csv'           // Comma Separated Values (element list)
  | 'excel';        // Microsoft Excel format

export class ExportImportManager {
  private static instance: ExportImportManager;
  
  private formatHandlers: Map<ExportFormat, FormatHandler> = new Map();
  private compressionWorker?: Worker;

  static getInstance(): ExportImportManager {
    if (!ExportImportManager.instance) {
      ExportImportManager.instance = new ExportImportManager();
    }
    return ExportImportManager.instance;
  }

  constructor() {
    this.initializeFormatHandlers();
    this.setupCompressionWorker();
  }

  /**
   * Export diagram to specified format
   */
  async exportDiagram(
    elements: DiagramElement[],
    connections: DiagramConnection[],
    options: ExportOptions
  ): Promise<ExportResult> {
    try {
      const handler = this.formatHandlers.get(options.format);
      if (!handler) {
        return {
          success: false,
          filename: '',
          mimeType: '',
          errors: [`Unsupported export format: ${options.format}`]
        };
      }

      // Filter elements based on export scope
      const filteredData = this.filterExportData(elements, connections, options.exportScope);

      // Create diagram data
      const diagramData: DiagramData = {
        version: '1.0.0',
        metadata: this.createMetadata(),
        elements: filteredData.elements,
        connections: filteredData.connections,
        layers: this.getActiveLayers(),
        settings: this.getDiagramSettings(),
        viewport: this.getCurrentViewport(),
        exportedAt: new Date().toISOString(),
        exportedBy: 'PID Editor'
      };

      // Export using format handler
      const result = await handler.export(diagramData, options);

      // Apply compression if requested
      if (options.compressionLevel !== 'none' && result.success && result.data) {
        result.data = await this.compressData(result.data, options.compressionLevel);
      }

      return result;
    } catch (error) {
      return {
        success: false,
        filename: '',
        mimeType: '',
        errors: [`Export failed: ${error instanceof Error ? error.message : 'Unknown error'}`]
      };
    }
  }

  /**
   * Import diagram from file
   */
  async importDiagram(file: File): Promise<ImportResult> {
    try {
      // Detect format from file extension or MIME type
      const format = this.detectFormat(file);
      const handler = this.formatHandlers.get(format);

      if (!handler) {
        return {
          success: false,
          errors: [`Unsupported import format: ${format}`],
          warnings: [],
          metadata: {
            format,
            version: '',
            elementsCount: 0,
            connectionsCount: 0
          }
        };
      }

      // Read file content
      const content = await this.readFileContent(file);

      // Import using format handler
      const result = await handler.import(content, file);

      // Validate imported data
      if (result.success && result.data) {
        const validation = this.validateDiagramData(result.data);
        result.warnings.push(...validation.warnings);
        
        if (validation.errors.length > 0) {
          result.success = false;
          result.errors.push(...validation.errors);
        }
      }

      return result;
    } catch (error) {
      return {
        success: false,
        errors: [`Import failed: ${error instanceof Error ? error.message : 'Unknown error'}`],
        warnings: [],
        metadata: {
          format: 'json',
          version: '',
          elementsCount: 0,
          connectionsCount: 0
        }
      };
    }
  }

  /**
   * Get supported export formats
   */
  getSupportedExportFormats(): Array<{
    format: ExportFormat;
    name: string;
    description: string;
    extension: string;
    mimeType: string;
  }> {
    return [
      {
        format: 'json',
        name: 'JSON',
        description: 'Native PID Editor format with full fidelity',
        extension: '.json',
        mimeType: 'application/json'
      },
      {
        format: 'svg',
        name: 'SVG',
        description: 'Scalable Vector Graphics for web and print',
        extension: '.svg',
        mimeType: 'image/svg+xml'
      },
      {
        format: 'png',
        name: 'PNG',
        description: 'High-quality raster image',
        extension: '.png',
        mimeType: 'image/png'
      },
      {
        format: 'pdf',
        name: 'PDF',
        description: 'Portable document for sharing and printing',
        extension: '.pdf',
        mimeType: 'application/pdf'
      },
      {
        format: 'dxf',
        name: 'DXF',
        description: 'AutoCAD Drawing Exchange Format',
        extension: '.dxf',
        mimeType: 'application/dxf'
      },
      {
        format: 'visio',
        name: 'Visio',
        description: 'Microsoft Visio format',
        extension: '.vsdx',
        mimeType: 'application/vnd.ms-visio.drawing'
      },
      {
        format: 'csv',
        name: 'CSV',
        description: 'Element list for data analysis',
        extension: '.csv',
        mimeType: 'text/csv'
      }
    ];
  }

  /**
   * Get supported import formats
   */
  getSupportedImportFormats(): Array<{
    format: ExportFormat;
    name: string;
    extensions: string[];
    mimeTypes: string[];
  }> {
    return [
      {
        format: 'json',
        name: 'JSON',
        extensions: ['.json'],
        mimeTypes: ['application/json', 'text/plain']
      },
      {
        format: 'svg',
        name: 'SVG',
        extensions: ['.svg'],
        mimeTypes: ['image/svg+xml', 'text/xml']
      },
      {
        format: 'dxf',
        name: 'DXF',
        extensions: ['.dxf'],
        mimeTypes: ['application/dxf', 'text/plain']
      },
      {
        format: 'visio',
        name: 'Visio',
        extensions: ['.vsdx', '.vsd'],
        mimeTypes: ['application/vnd.ms-visio.drawing']
      },
      {
        format: 'drawio',
        name: 'Draw.io',
        extensions: ['.drawio', '.xml'],
        mimeTypes: ['application/xml', 'text/xml']
      }
    ];
  }

  /**
   * Private helper methods
   */

  private initializeFormatHandlers(): void {
    // JSON Format Handler
    this.formatHandlers.set('json', new JsonFormatHandler());
    
    // SVG Format Handler
    this.formatHandlers.set('svg', new SvgFormatHandler());
    
    // PNG Format Handler
    this.formatHandlers.set('png', new PngFormatHandler());
    
    // PDF Format Handler
    this.formatHandlers.set('pdf', new PdfFormatHandler());
    
    // CSV Format Handler
    this.formatHandlers.set('csv', new CsvFormatHandler());
    
    // DXF Format Handler
    this.formatHandlers.set('dxf', new DxfFormatHandler());
  }

  private setupCompressionWorker(): void {
    if (typeof Worker !== 'undefined') {
      // TODO: Set up web worker for compression
    }
  }

  private filterExportData(
    elements: DiagramElement[],
    connections: DiagramConnection[],
    scope: 'visible' | 'selected' | 'all'
  ): { elements: DiagramElement[]; connections: DiagramConnection[] } {
    switch (scope) {
      case 'visible':
        return {
          elements: elements.filter(el => el.visible),
          connections: connections.filter(conn => {
            const sourceEl = elements.find(el => el.id === conn.source);
            const targetEl = elements.find(el => el.id === conn.target);
            return sourceEl?.visible && targetEl?.visible;
          })
        };
      
      case 'selected':
        // TODO: Implement selection tracking
        return { elements, connections };
      
      case 'all':
      default:
        return { elements, connections };
    }
  }

  private createMetadata(): DiagramMetadata {
    return {
      title: 'PID Diagram',
      description: '',
      author: '',
      company: '',
      project: '',
      version: '1.0',
      createdAt: new Date().toISOString(),
      modifiedAt: new Date().toISOString(),
      tags: [],
      standard: 'ISO',
      units: 'metric'
    };
  }

  private getActiveLayers(): DiagramLayer[] {
    // TODO: Get from layer manager
    return [
      {
        id: 'default',
        name: 'Default',
        visible: true,
        locked: false,
        opacity: 1,
        color: '#000000',
        order: 0
      }
    ];
  }

  private getDiagramSettings(): DiagramSettings {
    // TODO: Get from settings store
    return {
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
    };
  }

  private getCurrentViewport(): ViewportState {
    // TODO: Get from viewport store
    return {
      x: 0,
      y: 0,
      zoom: 1
    };
  }

  private detectFormat(file: File): ExportFormat {
    const extension = file.name.toLowerCase().split('.').pop() || '';
    const mimeType = file.type.toLowerCase();

    // Map extensions and MIME types to formats
    const formatMap: Record<string, ExportFormat> = {
      'json': 'json',
      'svg': 'svg',
      'png': 'png',
      'jpg': 'jpeg',
      'jpeg': 'jpeg',
      'pdf': 'pdf',
      'dxf': 'dxf',
      'vsdx': 'visio',
      'vsd': 'visio',
      'drawio': 'drawio',
      'xml': 'drawio',
      'csv': 'csv',
      'xlsx': 'excel',
      'xls': 'excel'
    };

    // Check if extension is supported, if not return a special 'unknown' format
    const detectedFormat = formatMap[extension];
    return detectedFormat || ('unknown' as ExportFormat);
  }

  private async readFileContent(file: File): Promise<string | ArrayBuffer> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (event) => {
        resolve(event.target?.result || '');
      };
      
      reader.onerror = () => {
        reject(new Error('Failed to read file'));
      };

      // Read as text for most formats, binary for images
      if (file.type.startsWith('image/') || file.name.endsWith('.pdf')) {
        reader.readAsArrayBuffer(file);
      } else {
        reader.readAsText(file);
      }
    });
  }

  private validateDiagramData(data: DiagramData): { errors: string[]; warnings: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Basic structure validation
    if (!data.elements || !Array.isArray(data.elements)) {
      errors.push('Invalid or missing elements array');
    }

    if (!data.connections || !Array.isArray(data.connections)) {
      errors.push('Invalid or missing connections array');
    }

    // Version compatibility
    if (data.version && data.version !== '1.0.0') {
      warnings.push(`Diagram version ${data.version} may not be fully compatible`);
    }

    // Element validation
    data.elements?.forEach((element, index) => {
      if (!element.id) {
        errors.push(`Element at index ${index} is missing required id`);
      }
      if (!element.type) {
        errors.push(`Element ${element.id} is missing required type`);
      }
      if (!element.position || typeof element.position.x !== 'number' || typeof element.position.y !== 'number') {
        errors.push(`Element ${element.id} has invalid position`);
      }
    });

    // Connection validation
    data.connections?.forEach((connection, index) => {
      if (!connection.id) {
        errors.push(`Connection at index ${index} is missing required id`);
      }
      if (!connection.source || !connection.target) {
        errors.push(`Connection ${connection.id} is missing source or target`);
      }
      
      // Check if referenced elements exist
      const sourceExists = data.elements?.some(el => el.id === connection.source);
      const targetExists = data.elements?.some(el => el.id === connection.target);
      
      if (!sourceExists) {
        warnings.push(`Connection ${connection.id} references non-existent source element ${connection.source}`);
      }
      if (!targetExists) {
        warnings.push(`Connection ${connection.id} references non-existent target element ${connection.target}`);
      }
    });

    return { errors, warnings };
  }

  private async compressData(data: Blob | string, level: 'low' | 'medium' | 'high'): Promise<Blob | string> {
    // TODO: Implement compression using CompressionStream API or a library
    return data;
  }
}

/**
 * Abstract base class for format handlers
 */
abstract class FormatHandler {
  abstract export(data: DiagramData, options: ExportOptions): Promise<ExportResult>;
  abstract import(content: string | ArrayBuffer, file: File): Promise<ImportResult>;
}

/**
 * JSON Format Handler
 */
class JsonFormatHandler extends FormatHandler {
  async export(data: DiagramData, options: ExportOptions): Promise<ExportResult> {
    try {
      const jsonString = JSON.stringify(data, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      
      return {
        success: true,
        data: blob,
        filename: `pid-diagram-${Date.now()}.json`,
        mimeType: 'application/json',
        errors: []
      };
    } catch (error) {
      return {
        success: false,
        filename: '',
        mimeType: '',
        errors: [`JSON export failed: ${error instanceof Error ? error.message : 'Unknown error'}`]
      };
    }
  }

  async import(content: string | ArrayBuffer, file: File): Promise<ImportResult> {
    try {
      const jsonString = typeof content === 'string' ? content : new TextDecoder().decode(content);
      const data = JSON.parse(jsonString) as DiagramData;
      
      return {
        success: true,
        data,
        errors: [],
        warnings: [],
        metadata: {
          format: 'json',
          version: data.version || '1.0.0',
          elementsCount: data.elements?.length || 0,
          connectionsCount: data.connections?.length || 0
        }
      };
    } catch (error) {
      return {
        success: false,
        errors: [`JSON import failed: ${error instanceof Error ? error.message : 'Unknown error'}`],
        warnings: [],
        metadata: {
          format: 'json',
          version: '',
          elementsCount: 0,
          connectionsCount: 0
        }
      };
    }
  }
}

/**
 * SVG Format Handler
 */
class SvgFormatHandler extends FormatHandler {
  async export(data: DiagramData, options: ExportOptions): Promise<ExportResult> {
    try {
      const svg = await this.createSvgFromDiagram(data, options);
      const blob = new Blob([svg], { type: 'image/svg+xml' });
      
      return {
        success: true,
        data: blob,
        filename: `pid-diagram-${Date.now()}.svg`,
        mimeType: 'image/svg+xml',
        errors: []
      };
    } catch (error) {
      return {
        success: false,
        filename: '',
        mimeType: '',
        errors: [`SVG export failed: ${error instanceof Error ? error.message : 'Unknown error'}`]
      };
    }
  }

  async import(content: string | ArrayBuffer, file: File): Promise<ImportResult> {
    // SVG import would require parsing SVG and converting to diagram elements
    // This is complex and would need symbol recognition
    return {
      success: false,
      errors: ['SVG import not yet implemented'],
      warnings: [],
      metadata: {
        format: 'svg',
        version: '',
        elementsCount: 0,
        connectionsCount: 0
      }
    };
  }

  private async createSvgFromDiagram(data: DiagramData, options: ExportOptions): Promise<string> {
    // Calculate bounds
    const bounds = this.calculateDiagramBounds(data.elements);
    const padding = 50;
    
    const width = bounds.maxX - bounds.minX + padding * 2;
    const height = bounds.maxY - bounds.minY + padding * 2;
    const viewBox = `${bounds.minX - padding} ${bounds.minY - padding} ${width} ${height}`;

    // Create SVG header
    let svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" 
     xmlns:xlink="http://www.w3.org/1999/xlink"
     viewBox="${viewBox}" 
     width="${width}" 
     height="${height}">
  <defs>
    <!-- Styles and markers -->
  </defs>
`;

    // Add background if specified
    if (options.imageOptions?.backgroundColor && options.imageOptions.backgroundColor !== 'transparent') {
      svg += `  <rect x="${bounds.minX - padding}" y="${bounds.minY - padding}" width="${width}" height="${height}" fill="${options.imageOptions.backgroundColor}"/>
`;
    }

    // Add grid if enabled
    if (data.settings.grid.enabled) {
      svg += this.createGridSvg(data.settings.grid, bounds, padding);
    }

    // Add connections first (so they appear behind elements)
    for (const connection of data.connections) {
      svg += this.createConnectionSvg(connection, data.elements);
    }

    // Add elements
    for (const element of data.elements) {
      if (element.visible) {
        svg += await this.createElementSvg(element);
      }
    }

    svg += '</svg>';
    return svg;
  }

  private calculateDiagramBounds(elements: DiagramElement[]): {
    minX: number; minY: number; maxX: number; maxY: number;
  } {
    if (elements.length === 0) {
      return { minX: 0, minY: 0, maxX: 100, maxY: 100 };
    }

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

    for (const element of elements) {
      if (element.visible) {
        const elementWidth = 100; // Default width
        const elementHeight = 50; // Default height
        
        minX = Math.min(minX, element.position.x);
        minY = Math.min(minY, element.position.y);
        maxX = Math.max(maxX, element.position.x + elementWidth);
        maxY = Math.max(maxY, element.position.y + elementHeight);
      }
    }

    return { minX, minY, maxX, maxY };
  }

  private createGridSvg(grid: DiagramSettings['grid'], bounds: any, padding: number): string {
    const { size, color, opacity } = grid;
    const startX = Math.floor((bounds.minX - padding) / size) * size;
    const startY = Math.floor((bounds.minY - padding) / size) * size;
    const endX = bounds.maxX + padding;
    const endY = bounds.maxY + padding;

    let gridSvg = `  <g class="grid" stroke="${color}" stroke-width="0.5" opacity="${opacity}">
`;

    // Vertical lines
    for (let x = startX; x <= endX; x += size) {
      gridSvg += `    <line x1="${x}" y1="${bounds.minY - padding}" x2="${x}" y2="${bounds.maxY + padding}"/>
`;
    }

    // Horizontal lines
    for (let y = startY; y <= endY; y += size) {
      gridSvg += `    <line x1="${bounds.minX - padding}" y1="${y}" x2="${bounds.maxX + padding}" y2="${y}"/>
`;
    }

    gridSvg += '  </g>\n';
    return gridSvg;
  }

  private createConnectionSvg(connection: DiagramConnection, elements: DiagramElement[]): string {
    const sourceElement = elements.find(el => el.id === connection.source);
    const targetElement = elements.find(el => el.id === connection.target);

    if (!sourceElement || !targetElement) {
      return '';
    }

    // Use path if available, otherwise create direct line
    if (connection.path && connection.path.length > 0) {
      const pathData = connection.path.map((point, index) => 
        `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`
      ).join(' ');

      return `  <path d="${pathData}" stroke="black" stroke-width="2" fill="none" marker-end="url(#arrowhead)"/>
`;
    } else {
      // Direct line
      const sourceX = sourceElement.position.x + 50; // Approximate center
      const sourceY = sourceElement.position.y + 25;
      const targetX = targetElement.position.x + 50;
      const targetY = targetElement.position.y + 25;

      return `  <line x1="${sourceX}" y1="${sourceY}" x2="${targetX}" y2="${targetY}" stroke="black" stroke-width="2" marker-end="url(#arrowhead)"/>
`;
    }
  }

  private async createElementSvg(element: DiagramElement): Promise<string> {
    // This would need to render the actual element based on its type
    // For now, create a simple rectangle representation
    const width = 100;
    const height = 50;
    
    return `  <g class="element" data-element-id="${element.id}">
    <rect x="${element.position.x}" y="${element.position.y}" width="${width}" height="${height}" 
          fill="white" stroke="black" stroke-width="1"/>
    <text x="${element.position.x + width/2}" y="${element.position.y + height/2}" 
          text-anchor="middle" dominant-baseline="central" font-size="12">
      ${element.type}
    </text>
  </g>
`;
  }
}

/**
 * PNG Format Handler
 */
class PngFormatHandler extends FormatHandler {
  async export(data: DiagramData, options: ExportOptions): Promise<ExportResult> {
    try {
      // First create SVG
      const svgHandler = new SvgFormatHandler();
      const svgResult = await svgHandler.export(data, options);
      
      if (!svgResult.success || !svgResult.data) {
        throw new Error('Failed to create SVG for PNG export');
      }

      // Convert SVG to PNG using canvas
      const svgBlob = svgResult.data as Blob;
      const svgText = await svgBlob.text();
      const pngBlob = await this.svgToPng(svgText, options.imageOptions);
      
      return {
        success: true,
        data: pngBlob,
        filename: `pid-diagram-${Date.now()}.png`,
        mimeType: 'image/png',
        errors: []
      };
    } catch (error) {
      return {
        success: false,
        filename: '',
        mimeType: '',
        errors: [`PNG export failed: ${error instanceof Error ? error.message : 'Unknown error'}`]
      };
    }
  }

  async import(content: string | ArrayBuffer, file: File): Promise<ImportResult> {
    return {
      success: false,
      errors: ['PNG import not supported'],
      warnings: [],
      metadata: {
        format: 'png',
        version: '',
        elementsCount: 0,
        connectionsCount: 0
      }
    };
  }

  private async svgToPng(svgText: string, imageOptions?: ImageExportOptions): Promise<Blob> {
    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        reject(new Error('Could not get canvas context'));
        return;
      }

      const img = new Image();
      
      img.onload = () => {
        const scale = imageOptions?.scale || 1;
        canvas.width = (imageOptions?.width || img.width) * scale;
        canvas.height = (imageOptions?.height || img.height) * scale;
        
        // Set background color
        if (imageOptions?.backgroundColor && imageOptions.backgroundColor !== 'transparent') {
          ctx.fillStyle = imageOptions.backgroundColor;
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
        
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        
        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error('Failed to create PNG blob'));
            }
          },
          'image/png',
          1.0
        );
      };
      
      img.onerror = () => {
        reject(new Error('Failed to load SVG image'));
      };
      
      const svgBlob = new Blob([svgText], { type: 'image/svg+xml' });
      const url = URL.createObjectURL(svgBlob);
      img.src = url;
    });
  }
}

/**
 * PDF Format Handler
 */
class PdfFormatHandler extends FormatHandler {
  async export(data: DiagramData, options: ExportOptions): Promise<ExportResult> {
    // PDF export would require a library like jsPDF or PDFKit
    return {
      success: false,
      filename: '',
      mimeType: '',
      errors: ['PDF export requires additional dependencies']
    };
  }

  async import(content: string | ArrayBuffer, file: File): Promise<ImportResult> {
    return {
      success: false,
      errors: ['PDF import not supported'],
      warnings: [],
      metadata: {
        format: 'pdf',
        version: '',
        elementsCount: 0,
        connectionsCount: 0
      }
    };
  }
}

/**
 * CSV Format Handler
 */
class CsvFormatHandler extends FormatHandler {
  async export(data: DiagramData, options: ExportOptions): Promise<ExportResult> {
    try {
      const csvContent = this.createCsvFromDiagram(data);
      const blob = new Blob([csvContent], { type: 'text/csv' });
      
      return {
        success: true,
        data: blob,
        filename: `pid-elements-${Date.now()}.csv`,
        mimeType: 'text/csv',
        errors: []
      };
    } catch (error) {
      return {
        success: false,
        filename: '',
        mimeType: '',
        errors: [`CSV export failed: ${error instanceof Error ? error.message : 'Unknown error'}`]
      };
    }
  }

  async import(content: string | ArrayBuffer, file: File): Promise<ImportResult> {
    return {
      success: false,
      errors: ['CSV import not yet implemented'],
      warnings: [],
      metadata: {
        format: 'csv',
        version: '',
        elementsCount: 0,
        connectionsCount: 0
      }
    };
  }

  private createCsvFromDiagram(data: DiagramData): string {
    const headers = [
      'ID', 'Type', 'X', 'Y', 'Layer', 'Visible', 'Locked',
      'Width', 'Height', 'Label', 'Description'
    ];
    
    let csv = headers.join(',') + '\n';
    
    for (const element of data.elements) {
      const row = [
        `"${element.id}"`,
        `"${element.type}"`,
        element.position.x.toString(),
        element.position.y.toString(),
        `"${element.layer}"`,
        element.visible.toString(),
        element.locked.toString(),
        (element.data?.width || 100).toString(),
        (element.data?.height || 50).toString(),
        `"${element.data?.label || ''}"`,
        `"${element.data?.description || ''}"`
      ];
      
      csv += row.join(',') + '\n';
    }
    
    return csv;
  }
}

/**
 * DXF Format Handler (basic implementation)
 */
class DxfFormatHandler extends FormatHandler {
  async export(data: DiagramData, options: ExportOptions): Promise<ExportResult> {
    // DXF export would require a specialized library
    return {
      success: false,
      filename: '',
      mimeType: '',
      errors: ['DXF export requires additional dependencies']
    };
  }

  async import(content: string | ArrayBuffer, file: File): Promise<ImportResult> {
    return {
      success: false,
      errors: ['DXF import not yet implemented'],
      warnings: [],
      metadata: {
        format: 'dxf',
        version: '',
        elementsCount: 0,
        connectionsCount: 0
      }
    };
  }
}

export const exportImportManager = ExportImportManager.getInstance();