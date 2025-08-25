/**
 * Symbol Version Manager Service
 * Handles symbol versioning, custom symbol creation, and symbol relationships
 */

export interface SymbolVersion {
  id: string;
  version: string;
  symbolId: string;
  name: string;
  description: string;
  svgContent: string;
  metadata: SymbolMetadata;
  properties: SymbolProperties;
  connectionPoints: ConnectionPointDef[];
  createdAt: number;
  createdBy: string;
  parentVersion?: string;
  status: SymbolStatus;
  changeLog: string;
  tags: string[];
}

export interface SymbolMetadata {
  standard: 'ISO' | 'PIP' | 'ANSI' | 'CUSTOM';
  category: string;
  subcategory?: string;
  keywords: string[];
  dimensions: {
    width: number;
    height: number;
    aspectRatio: number;
  };
  complexity: 'simple' | 'moderate' | 'complex';
  usage: {
    frequency: number;
    lastUsed: number;
    contexts: string[];
  };
}

export interface SymbolProperties {
  scalable: boolean;
  rotatable: boolean;
  flippable: boolean;
  configurable: boolean;
  parameters: SymbolParameter[];
  variants: SymbolVariant[];
  constraints: SymbolConstraint[];
}

export interface SymbolParameter {
  id: string;
  name: string;
  type: 'number' | 'string' | 'boolean' | 'color' | 'enum';
  defaultValue: any;
  options?: any[];
  min?: number;
  max?: number;
  required: boolean;
  description: string;
  affects: ('geometry' | 'appearance' | 'behavior')[];
}

export interface SymbolVariant {
  id: string;
  name: string;
  description: string;
  parameterOverrides: Record<string, any>;
  svgContent?: string;
  previewUrl?: string;
}

export interface SymbolConstraint {
  id: string;
  type: 'size' | 'position' | 'connection' | 'parameter';
  rule: string;
  message: string;
  severity: 'error' | 'warning' | 'info';
}

export interface ConnectionPointDef {
  id: string;
  name: string;
  position: { x: number; y: number };
  direction: 'north' | 'south' | 'east' | 'west' | 'any';
  type: 'input' | 'output' | 'bidirectional';
  connectionTypes: string[];
  required: boolean;
  multiple: boolean;
  constraints: string[];
}

export interface SymbolRelationship {
  id: string;
  type: 'inherits' | 'variant' | 'replacement' | 'alternative';
  sourceSymbolId: string;
  targetSymbolId: string;
  relationship: string;
  metadata: Record<string, any>;
}

export interface SymbolValidationResult {
  valid: boolean;
  errors: SymbolValidationError[];
  warnings: SymbolValidationError[];
  suggestions: string[];
  score: number;
}

export interface SymbolValidationError {
  code: string;
  message: string;
  severity: 'error' | 'warning' | 'info';
  location?: {
    element?: string;
    attribute?: string;
    line?: number;
    column?: number;
  };
  fix?: string;
}

export type SymbolStatus = 'draft' | 'review' | 'approved' | 'deprecated' | 'archived';

export interface SymbolTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  svgTemplate: string;
  parameters: SymbolParameter[];
  connectionPoints: ConnectionPointDef[];
  previewImage: string;
}

export class SymbolVersionManager {
  private static instance: SymbolVersionManager;
  
  private symbolVersions: Map<string, SymbolVersion[]> = new Map();
  private symbolRelationships: Map<string, SymbolRelationship[]> = new Map();
  private symbolTemplates: Map<string, SymbolTemplate> = new Map();
  private validationRules: Map<string, Function> = new Map();
  
  static getInstance(): SymbolVersionManager {
    if (!SymbolVersionManager.instance) {
      SymbolVersionManager.instance = new SymbolVersionManager();
    }
    return SymbolVersionManager.instance;
  }

  constructor() {
    this.initializeValidationRules();
    this.loadSymbolTemplates();
  }

  /**
   * Create a new symbol version
   */
  async createSymbolVersion(
    symbolId: string,
    versionData: Omit<SymbolVersion, 'id' | 'createdAt' | 'status'>
  ): Promise<string> {
    const version: SymbolVersion = {
      id: this.generateVersionId(),
      createdAt: Date.now(),
      status: 'draft',
      ...versionData
    };

    // Validate the symbol
    const validation = await this.validateSymbol(version);
    if (!validation.valid) {
      throw new Error(`Symbol validation failed: ${validation.errors.map(e => e.message).join(', ')}`);
    }

    // Store the version
    const versions = this.symbolVersions.get(symbolId) || [];
    versions.push(version);
    versions.sort((a, b) => this.compareVersions(a.version, b.version));
    this.symbolVersions.set(symbolId, versions);

    // Update usage metadata
    await this.updateUsageMetadata(symbolId);

    return version.id;
  }

  /**
   * Get symbol version
   */
  getSymbolVersion(symbolId: string, version?: string): SymbolVersion | null {
    const versions = this.symbolVersions.get(symbolId);
    if (!versions || versions.length === 0) return null;

    if (!version) {
      // Return latest approved version, or latest if no approved versions
      const approvedVersions = versions.filter(v => v.status === 'approved');
      if (approvedVersions.length > 0) {
        return approvedVersions[approvedVersions.length - 1];
      }
      return versions[versions.length - 1];
    }

    return versions.find(v => v.version === version) || null;
  }

  /**
   * Get all versions of a symbol
   */
  getSymbolVersions(symbolId: string): SymbolVersion[] {
    return this.symbolVersions.get(symbolId) || [];
  }

  /**
   * Update symbol version
   */
  async updateSymbolVersion(
    symbolId: string,
    versionId: string,
    updates: Partial<SymbolVersion>
  ): Promise<void> {
    const versions = this.symbolVersions.get(symbolId);
    if (!versions) throw new Error(`Symbol ${symbolId} not found`);

    const versionIndex = versions.findIndex(v => v.id === versionId);
    if (versionIndex === -1) throw new Error(`Version ${versionId} not found`);

    const updatedVersion = { ...versions[versionIndex], ...updates };
    
    // Validate if structure changed
    if (updates.svgContent || updates.connectionPoints || updates.properties) {
      const validation = await this.validateSymbol(updatedVersion);
      if (!validation.valid) {
        throw new Error(`Symbol validation failed: ${validation.errors.map(e => e.message).join(', ')}`);
      }
    }

    versions[versionIndex] = updatedVersion;
    this.symbolVersions.set(symbolId, versions);
  }

  /**
   * Delete symbol version
   */
  deleteSymbolVersion(symbolId: string, versionId: string): boolean {
    const versions = this.symbolVersions.get(symbolId);
    if (!versions) return false;

    const versionIndex = versions.findIndex(v => v.id === versionId);
    if (versionIndex === -1) return false;

    // Don't allow deletion if it's the only version
    if (versions.length === 1) {
      throw new Error('Cannot delete the only version of a symbol');
    }

    // Don't allow deletion of approved versions unless explicitly allowed
    const version = versions[versionIndex];
    if (version.status === 'approved') {
      throw new Error('Cannot delete approved symbol version');
    }

    versions.splice(versionIndex, 1);
    this.symbolVersions.set(symbolId, versions);
    return true;
  }

  /**
   * Create symbol from template
   */
  async createSymbolFromTemplate(
    templateId: string,
    symbolData: {
      symbolId: string;
      name: string;
      parameters: Record<string, any>;
      customizations?: {
        connectionPoints?: Partial<ConnectionPointDef>[];
        metadata?: Partial<SymbolMetadata>;
      };
    }
  ): Promise<string> {
    const template = this.symbolTemplates.get(templateId);
    if (!template) throw new Error(`Template ${templateId} not found`);

    // Generate SVG from template
    const svgContent = await this.generateSvgFromTemplate(template, symbolData.parameters);

    // Create symbol version
    const version: Omit<SymbolVersion, 'id' | 'createdAt' | 'status'> = {
      symbolId: symbolData.symbolId,
      version: '1.0.0',
      name: symbolData.name,
      description: `Symbol created from template: ${template.name}`,
      svgContent,
      metadata: {
        standard: 'CUSTOM',
        category: template.category,
        keywords: [template.name, 'custom'],
        dimensions: this.calculateSvgDimensions(svgContent),
        complexity: 'moderate',
        usage: {
          frequency: 0,
          lastUsed: 0,
          contexts: []
        },
        ...symbolData.customizations?.metadata
      },
      properties: {
        scalable: true,
        rotatable: true,
        flippable: true,
        configurable: template.parameters.length > 0,
        parameters: template.parameters,
        variants: [],
        constraints: []
      },
      connectionPoints: symbolData.customizations?.connectionPoints?.map((cp, index) => ({
        ...template.connectionPoints[index],
        ...cp
      })) || template.connectionPoints,
      createdBy: 'current-user', // TODO: Get from auth context
      parentVersion: undefined,
      changeLog: 'Initial version created from template',
      tags: ['custom', template.category]
    };

    return await this.createSymbolVersion(symbolData.symbolId, version);
  }

  /**
   * Create symbol variant
   */
  async createSymbolVariant(
    symbolId: string,
    baseVersionId: string,
    variantData: {
      name: string;
      description: string;
      parameterOverrides: Record<string, any>;
      svgModifications?: string;
    }
  ): Promise<string> {
    const baseVersion = this.getSymbolVersionById(symbolId, baseVersionId);
    if (!baseVersion) throw new Error(`Base version ${baseVersionId} not found`);

    const variantId = this.generateVariantId();
    const variant: SymbolVariant = {
      id: variantId,
      name: variantData.name,
      description: variantData.description,
      parameterOverrides: variantData.parameterOverrides,
      svgContent: variantData.svgModifications,
      previewUrl: undefined // TODO: Generate preview
    };

    // Add variant to base version
    baseVersion.properties.variants.push(variant);
    await this.updateSymbolVersion(symbolId, baseVersionId, { properties: baseVersion.properties });

    return variantId;
  }

  /**
   * Validate symbol
   */
  async validateSymbol(symbol: SymbolVersion): Promise<SymbolValidationResult> {
    const errors: SymbolValidationError[] = [];
    const warnings: SymbolValidationError[] = [];
    const suggestions: string[] = [];

    // SVG validation
    const svgValidation = await this.validateSvgContent(symbol.svgContent);
    errors.push(...svgValidation.errors);
    warnings.push(...svgValidation.warnings);

    // Connection points validation
    const connectionValidation = this.validateConnectionPoints(symbol.connectionPoints);
    errors.push(...connectionValidation.errors);
    warnings.push(...connectionValidation.warnings);

    // Metadata validation
    const metadataValidation = this.validateMetadata(symbol.metadata);
    errors.push(...metadataValidation.errors);
    warnings.push(...metadataValidation.warnings);

    // Properties validation
    const propertiesValidation = this.validateProperties(symbol.properties);
    errors.push(...propertiesValidation.errors);
    warnings.push(...propertiesValidation.warnings);

    // Standard compliance validation
    if (symbol.metadata.standard !== 'CUSTOM') {
      const complianceValidation = await this.validateStandardCompliance(symbol);
      errors.push(...complianceValidation.errors);
      warnings.push(...complianceValidation.warnings);
    }

    // Calculate validation score
    const score = Math.max(0, 100 - errors.length * 10 - warnings.length * 5);

    // Generate suggestions
    if (symbol.connectionPoints.length === 0) {
      suggestions.push('Consider adding connection points for better usability');
    }
    if (!symbol.metadata.keywords.length) {
      suggestions.push('Add keywords to improve symbol searchability');
    }
    if (!symbol.description) {
      suggestions.push('Add a description to help users understand the symbol purpose');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      suggestions,
      score
    };
  }

  /**
   * Create symbol relationship
   */
  createSymbolRelationship(relationship: Omit<SymbolRelationship, 'id'>): string {
    const rel: SymbolRelationship = {
      id: this.generateRelationshipId(),
      ...relationship
    };

    const relationships = this.symbolRelationships.get(relationship.sourceSymbolId) || [];
    relationships.push(rel);
    this.symbolRelationships.set(relationship.sourceSymbolId, relationships);

    return rel.id;
  }

  /**
   * Get symbol relationships
   */
  getSymbolRelationships(symbolId: string, type?: SymbolRelationship['type']): SymbolRelationship[] {
    const relationships = this.symbolRelationships.get(symbolId) || [];
    return type ? relationships.filter(r => r.type === type) : relationships;
  }

  /**
   * Get symbol inheritance chain
   */
  getSymbolInheritanceChain(symbolId: string): string[] {
    const chain: string[] = [symbolId];
    const relationships = this.getSymbolRelationships(symbolId, 'inherits');
    
    for (const rel of relationships) {
      const parentChain = this.getSymbolInheritanceChain(rel.targetSymbolId);
      chain.push(...parentChain);
    }

    return chain;
  }

  /**
   * Find symbols by criteria
   */
  findSymbols(criteria: {
    name?: string;
    category?: string;
    standard?: string;
    tags?: string[];
    status?: SymbolStatus;
    hasConnectionPoints?: boolean;
    createdAfter?: number;
    createdBefore?: number;
  }): SymbolVersion[] {
    const results: SymbolVersion[] = [];

    for (const [symbolId, versions] of this.symbolVersions) {
      const latestVersion = versions[versions.length - 1];
      
      // Apply filters
      if (criteria.name && !latestVersion.name.toLowerCase().includes(criteria.name.toLowerCase())) {
        continue;
      }
      
      if (criteria.category && latestVersion.metadata.category !== criteria.category) {
        continue;
      }
      
      if (criteria.standard && latestVersion.metadata.standard !== criteria.standard) {
        continue;
      }
      
      if (criteria.status && latestVersion.status !== criteria.status) {
        continue;
      }
      
      if (criteria.tags && !criteria.tags.every(tag => latestVersion.tags.includes(tag))) {
        continue;
      }
      
      if (criteria.hasConnectionPoints !== undefined) {
        const hasCP = latestVersion.connectionPoints.length > 0;
        if (criteria.hasConnectionPoints !== hasCP) continue;
      }
      
      if (criteria.createdAfter && latestVersion.createdAt < criteria.createdAfter) {
        continue;
      }
      
      if (criteria.createdBefore && latestVersion.createdAt > criteria.createdBefore) {
        continue;
      }

      results.push(latestVersion);
    }

    return results.sort((a, b) => b.createdAt - a.createdAt);
  }

  /**
   * Export symbol data
   */
  exportSymbol(symbolId: string, version?: string): {
    symbol: SymbolVersion;
    relationships: SymbolRelationship[];
    variants: SymbolVariant[];
  } {
    const symbol = this.getSymbolVersion(symbolId, version);
    if (!symbol) throw new Error(`Symbol ${symbolId} not found`);

    const relationships = this.getSymbolRelationships(symbolId);
    const variants = symbol.properties.variants;

    return { symbol, relationships, variants };
  }

  /**
   * Import symbol data
   */
  async importSymbol(data: {
    symbol: SymbolVersion;
    relationships?: SymbolRelationship[];
    variants?: SymbolVariant[];
  }): Promise<string> {
    const { symbol, relationships = [], variants = [] } = data;
    
    // Validate imported symbol
    const validation = await this.validateSymbol(symbol);
    if (!validation.valid) {
      throw new Error(`Imported symbol validation failed: ${validation.errors.map(e => e.message).join(', ')}`);
    }

    // Create new version
    const versionId = await this.createSymbolVersion(symbol.symbolId, {
      ...symbol,
      createdBy: 'import',
      changeLog: 'Imported symbol'
    });

    // Import relationships
    for (const rel of relationships) {
      this.createSymbolRelationship({
        ...rel,
        sourceSymbolId: symbol.symbolId
      });
    }

    // Add variants
    const updatedSymbol = this.getSymbolVersion(symbol.symbolId);
    if (updatedSymbol && variants.length > 0) {
      updatedSymbol.properties.variants.push(...variants);
      await this.updateSymbolVersion(symbol.symbolId, versionId, { 
        properties: updatedSymbol.properties 
      });
    }

    return versionId;
  }

  /**
   * Private helper methods
   */

  private generateVersionId(): string {
    return `version_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateVariantId(): string {
    return `variant_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateRelationshipId(): string {
    return `relationship_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private compareVersions(v1: string, v2: string): number {
    const parts1 = v1.split('.').map(Number);
    const parts2 = v2.split('.').map(Number);
    
    for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
      const part1 = parts1[i] || 0;
      const part2 = parts2[i] || 0;
      
      if (part1 < part2) return -1;
      if (part1 > part2) return 1;
    }
    
    return 0;
  }

  private getSymbolVersionById(symbolId: string, versionId: string): SymbolVersion | null {
    const versions = this.symbolVersions.get(symbolId);
    return versions?.find(v => v.id === versionId) || null;
  }

  private async generateSvgFromTemplate(
    template: SymbolTemplate, 
    parameters: Record<string, any>
  ): Promise<string> {
    let svg = template.svgTemplate;
    
    // Replace parameter placeholders
    for (const param of template.parameters) {
      const value = parameters[param.id] ?? param.defaultValue;
      const placeholder = `{{${param.id}}}`;
      svg = svg.replace(new RegExp(placeholder, 'g'), String(value));
    }
    
    return svg;
  }

  private calculateSvgDimensions(svgContent: string): SymbolMetadata['dimensions'] {
    // Parse SVG to extract dimensions
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgContent, 'image/svg+xml');
    const svgElement = doc.querySelector('svg');
    
    if (svgElement) {
      const width = parseFloat(svgElement.getAttribute('width') || '100');
      const height = parseFloat(svgElement.getAttribute('height') || '100');
      
      return {
        width,
        height,
        aspectRatio: width / height
      };
    }
    
    return { width: 100, height: 100, aspectRatio: 1 };
  }

  private async validateSvgContent(svgContent: string): Promise<{
    errors: SymbolValidationError[];
    warnings: SymbolValidationError[];
  }> {
    const errors: SymbolValidationError[] = [];
    const warnings: SymbolValidationError[] = [];

    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(svgContent, 'image/svg+xml');
      const parserErrors = doc.querySelector('parsererror');
      
      if (parserErrors) {
        errors.push({
          code: 'SVG_PARSE_ERROR',
          message: 'Invalid SVG content',
          severity: 'error',
          fix: 'Check SVG syntax and structure'
        });
      }

      const svgElement = doc.querySelector('svg');
      if (!svgElement) {
        errors.push({
          code: 'NO_SVG_ELEMENT',
          message: 'No SVG root element found',
          severity: 'error'
        });
      } else {
        // Check for required attributes
        if (!svgElement.getAttribute('viewBox') && !svgElement.getAttribute('width')) {
          warnings.push({
            code: 'MISSING_DIMENSIONS',
            message: 'SVG missing viewBox or width/height attributes',
            severity: 'warning',
            fix: 'Add viewBox attribute for better scaling'
          });
        }

        // Check for accessibility
        if (!svgElement.querySelector('title') && !svgElement.querySelector('desc')) {
          warnings.push({
            code: 'MISSING_ACCESSIBILITY',
            message: 'SVG missing title or description for accessibility',
            severity: 'warning',
            fix: 'Add <title> and <desc> elements'
          });
        }
      }
    } catch (error) {
      errors.push({
        code: 'SVG_VALIDATION_ERROR',
        message: `SVG validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        severity: 'error'
      });
    }

    return { errors, warnings };
  }

  private validateConnectionPoints(connectionPoints: ConnectionPointDef[]): {
    errors: SymbolValidationError[];
    warnings: SymbolValidationError[];
  } {
    const errors: SymbolValidationError[] = [];
    const warnings: SymbolValidationError[] = [];

    // Check for duplicate IDs
    const ids = connectionPoints.map(cp => cp.id);
    const duplicateIds = ids.filter((id, index) => ids.indexOf(id) !== index);
    if (duplicateIds.length > 0) {
      errors.push({
        code: 'DUPLICATE_CONNECTION_POINT_IDS',
        message: `Duplicate connection point IDs: ${duplicateIds.join(', ')}`,
        severity: 'error'
      });
    }

    // Validate each connection point
    connectionPoints.forEach((cp, index) => {
      if (!cp.name) {
        warnings.push({
          code: 'MISSING_CONNECTION_POINT_NAME',
          message: `Connection point at index ${index} missing name`,
          severity: 'warning'
        });
      }

      if (cp.position.x < 0 || cp.position.y < 0) {
        warnings.push({
          code: 'NEGATIVE_CONNECTION_POINT_POSITION',
          message: `Connection point ${cp.id} has negative position`,
          severity: 'warning'
        });
      }

      if (cp.connectionTypes.length === 0) {
        warnings.push({
          code: 'NO_CONNECTION_TYPES',
          message: `Connection point ${cp.id} has no connection types defined`,
          severity: 'warning'
        });
      }
    });

    return { errors, warnings };
  }

  private validateMetadata(metadata: SymbolMetadata): {
    errors: SymbolValidationError[];
    warnings: SymbolValidationError[];
  } {
    const errors: SymbolValidationError[] = [];
    const warnings: SymbolValidationError[] = [];

    if (!metadata.category) {
      errors.push({
        code: 'MISSING_CATEGORY',
        message: 'Symbol category is required',
        severity: 'error'
      });
    }

    if (metadata.keywords.length === 0) {
      warnings.push({
        code: 'NO_KEYWORDS',
        message: 'Symbol has no keywords for search optimization',
        severity: 'warning',
        fix: 'Add relevant keywords to improve discoverability'
      });
    }

    if (metadata.dimensions.aspectRatio < 0.1 || metadata.dimensions.aspectRatio > 10) {
      warnings.push({
        code: 'EXTREME_ASPECT_RATIO',
        message: 'Symbol has extreme aspect ratio that may cause display issues',
        severity: 'warning'
      });
    }

    return { errors, warnings };
  }

  private validateProperties(properties: SymbolProperties): {
    errors: SymbolValidationError[];
    warnings: SymbolValidationError[];
  } {
    const errors: SymbolValidationError[] = [];
    const warnings: SymbolValidationError[] = [];

    // Validate parameters
    properties.parameters.forEach((param, index) => {
      if (!param.name) {
        errors.push({
          code: 'MISSING_PARAMETER_NAME',
          message: `Parameter at index ${index} missing name`,
          severity: 'error'
        });
      }

      if (param.type === 'enum' && (!param.options || param.options.length === 0)) {
        errors.push({
          code: 'ENUM_PARAMETER_NO_OPTIONS',
          message: `Enum parameter ${param.name} has no options defined`,
          severity: 'error'
        });
      }

      if (param.type === 'number' && param.min !== undefined && param.max !== undefined) {
        if (param.min >= param.max) {
          errors.push({
            code: 'INVALID_PARAMETER_RANGE',
            message: `Parameter ${param.name} has invalid range (min >= max)`,
            severity: 'error'
          });
        }
      }
    });

    return { errors, warnings };
  }

  private async validateStandardCompliance(symbol: SymbolVersion): Promise<{
    errors: SymbolValidationError[];
    warnings: SymbolValidationError[];
  }> {
    const errors: SymbolValidationError[] = [];
    const warnings: SymbolValidationError[] = [];

    // Standard-specific validation rules would go here
    // This is a simplified implementation
    switch (symbol.metadata.standard) {
      case 'ISO':
        // ISO 14617 compliance checks
        break;
      case 'PIP':
        // PIP standard compliance checks
        break;
      case 'ANSI':
        // ANSI standard compliance checks
        break;
    }

    return { errors, warnings };
  }

  private initializeValidationRules(): void {
    // Initialize custom validation rules
    this.validationRules.set('svg-structure', this.validateSvgStructure.bind(this));
    this.validationRules.set('connection-points', this.validateConnectionPointStructure.bind(this));
  }

  private validateSvgStructure(svgContent: string): boolean {
    // Custom SVG structure validation
    return svgContent.includes('<svg') && svgContent.includes('</svg>');
  }

  private validateConnectionPointStructure(connectionPoints: ConnectionPointDef[]): boolean {
    // Custom connection point validation
    return connectionPoints.every(cp => cp.id && cp.position);
  }

  private loadSymbolTemplates(): void {
    // Load built-in symbol templates
    this.symbolTemplates.set('basic-pump', {
      id: 'basic-pump',
      name: 'Basic Pump',
      description: 'A basic centrifugal pump template',
      category: 'pumps',
      svgTemplate: `<svg viewBox="0 0 100 100" width="100" height="100">
        <circle cx="50" cy="50" r="{{radius}}" fill="{{fillColor}}" stroke="{{strokeColor}}" stroke-width="2"/>
        <path d="M30 50 L70 50 M50 30 L50 70" stroke="{{strokeColor}}" stroke-width="2"/>
      </svg>`,
      parameters: [
        {
          id: 'radius',
          name: 'Radius',
          type: 'number',
          defaultValue: 30,
          min: 10,
          max: 50,
          required: true,
          description: 'Pump housing radius',
          affects: ['geometry']
        },
        {
          id: 'fillColor',
          name: 'Fill Color',
          type: 'color',
          defaultValue: '#ffffff',
          required: false,
          description: 'Pump housing fill color',
          affects: ['appearance']
        },
        {
          id: 'strokeColor',
          name: 'Stroke Color',
          type: 'color',
          defaultValue: '#000000',
          required: false,
          description: 'Pump outline color',
          affects: ['appearance']
        }
      ],
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
        },
        {
          id: 'outlet',
          name: 'Outlet',
          position: { x: 90, y: 50 },
          direction: 'east',
          type: 'output',
          connectionTypes: ['process'],
          required: true,
          multiple: false,
          constraints: []
        }
      ],
      previewImage: 'data:image/svg+xml;base64,PHN2ZyB2aWV3Qm94PSIwIDAgMTAwIDEwMCI...'
    });

    // Add more templates as needed
  }

  private async updateUsageMetadata(symbolId: string): Promise<void> {
    const versions = this.symbolVersions.get(symbolId);
    if (!versions) return;

    const latestVersion = versions[versions.length - 1];
    latestVersion.metadata.usage.lastUsed = Date.now();
    latestVersion.metadata.usage.frequency += 1;
  }
}

export const symbolVersionManager = SymbolVersionManager.getInstance();