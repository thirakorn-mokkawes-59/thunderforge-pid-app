/**
 * Connection Validator Service
 * Validates connections based on PID engineering rules and constraints
 */

import type { ConnectionPoint } from './ConnectionRouter';

export interface ValidationRule {
  id: string;
  name: string;
  description: string;
  severity: 'error' | 'warning' | 'info';
  category: 'structural' | 'semantic' | 'engineering' | 'performance';
  validate: (connection: ConnectionData) => ValidationResult;
}

export interface ConnectionData {
  id: string;
  source: {
    nodeId: string;
    nodeType: string;
    connectionPoint: ConnectionPoint;
    properties: Record<string, any>;
  };
  target: {
    nodeId: string;
    nodeType: string;
    connectionPoint: ConnectionPoint;
    properties: Record<string, any>;
  };
  connectionType: ConnectionType;
  properties: ConnectionProperties;
  path?: { x: number; y: number }[];
}

export interface ConnectionProperties {
  lineType: 'process' | 'instrument' | 'electrical' | 'pneumatic' | 'hydraulic';
  medium?: string;
  pressure?: number;
  temperature?: number;
  flowRate?: number;
  diameter?: number;
  material?: string;
  insulated?: boolean;
  traced?: boolean;
}

export interface ConnectionType {
  name: string;
  allowedSources: string[];
  allowedTargets: string[];
  requiredProperties: string[];
  restrictions: {
    maxConnections?: number;
    minConnections?: number;
    mutuallyExclusive?: string[];
  };
}

export interface ValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
  suggestions: string[];
  score: number; // 0-100, higher is better
}

export interface ValidationIssue {
  ruleId: string;
  severity: 'error' | 'warning' | 'info';
  category: string;
  message: string;
  affectedElements: string[];
  suggestedFixes: string[];
}

export interface CompatibilityMatrix {
  [sourceType: string]: {
    [targetType: string]: {
      allowed: boolean;
      restrictions?: string[];
      warnings?: string[];
    };
  };
}

export class ConnectionValidator {
  private static instance: ConnectionValidator;
  
  private rules: Map<string, ValidationRule> = new Map();
  private connectionTypes: Map<string, ConnectionType> = new Map();
  private compatibilityMatrix: CompatibilityMatrix = {};

  static getInstance(): ConnectionValidator {
    if (!ConnectionValidator.instance) {
      ConnectionValidator.instance = new ConnectionValidator();
    }
    return ConnectionValidator.instance;
  }

  constructor() {
    this.initializeDefaultRules();
    this.initializeConnectionTypes();
    this.initializeCompatibilityMatrix();
  }

  /**
   * Validate a connection
   */
  validateConnection(connection: ConnectionData): ValidationResult {
    const issues: ValidationIssue[] = [];
    const suggestions: string[] = [];
    let score = 100;

    // Run all applicable rules
    for (const rule of this.rules.values()) {
      const result = rule.validate(connection);
      
      // Always collect suggestions, regardless of validity
      suggestions.push(...result.suggestions);
      
      if (!result.valid) {
        issues.push(...result.issues);
        
        // Deduct score based on severity
        const deduction = this.getScoreDeduction(rule.severity);
        score -= deduction * result.issues.length;
      } else if (result.score < 100) {
        // Deduct score for valid but non-optimal connections
        score -= (100 - result.score) / 10;
      }
    }

    score = Math.max(0, score);

    return {
      valid: issues.filter(issue => issue.severity === 'error').length === 0,
      issues,
      suggestions: [...new Set(suggestions)], // Remove duplicates
      score
    };
  }

  /**
   * Validate multiple connections
   */
  validateConnections(connections: ConnectionData[]): {
    results: Map<string, ValidationResult>;
    overallValid: boolean;
    summary: {
      total: number;
      valid: number;
      warnings: number;
      errors: number;
      avgScore: number;
    };
  } {
    const results = new Map<string, ValidationResult>();
    let totalScore = 0;
    let validCount = 0;
    let warningCount = 0;
    let errorCount = 0;

    for (const connection of connections) {
      const result = this.validateConnection(connection);
      results.set(connection.id, result);
      
      totalScore += result.score;
      if (result.valid) validCount++;
      
      warningCount += result.issues.filter(i => i.severity === 'warning').length;
      errorCount += result.issues.filter(i => i.severity === 'error').length;
    }

    return {
      results,
      overallValid: errorCount === 0,
      summary: {
        total: connections.length,
        valid: validCount,
        warnings: warningCount,
        errors: errorCount,
        avgScore: connections.length > 0 ? totalScore / connections.length : 0
      }
    };
  }

  /**
   * Check if two node types are compatible
   */
  areNodesCompatible(sourceType: string, targetType: string): {
    compatible: boolean;
    restrictions: string[];
    warnings: string[];
  } {
    const compatibility = this.compatibilityMatrix[sourceType]?.[targetType];
    
    if (!compatibility) {
      return {
        compatible: false,
        restrictions: [`No compatibility rule defined for ${sourceType} -> ${targetType}`],
        warnings: []
      };
    }

    return {
      compatible: compatibility.allowed,
      restrictions: compatibility.restrictions || [],
      warnings: compatibility.warnings || []
    };
  }

  /**
   * Get suggested connection properties for a connection
   */
  getSuggestedProperties(
    sourceType: string, 
    targetType: string, 
    connectionType: string
  ): Partial<ConnectionProperties> {
    const suggestions: Partial<ConnectionProperties> = {};

    // Default suggestions based on common PID practices
    switch (connectionType) {
      case 'process':
        suggestions.lineType = 'process';
        suggestions.diameter = this.suggestPipeDiameter(sourceType, targetType);
        suggestions.material = this.suggestMaterial(sourceType, targetType);
        break;
        
      case 'instrument':
        suggestions.lineType = 'instrument';
        suggestions.diameter = 6; // Typical instrument line diameter
        break;
        
      case 'electrical':
        suggestions.lineType = 'electrical';
        break;
        
      case 'pneumatic':
        suggestions.lineType = 'pneumatic';
        suggestions.pressure = 100; // Typical pneumatic pressure (psi)
        break;
    }

    return suggestions;
  }

  /**
   * Add or update a validation rule
   */
  addRule(rule: ValidationRule): void {
    this.rules.set(rule.id, rule);
  }

  /**
   * Remove a validation rule
   */
  removeRule(ruleId: string): void {
    this.rules.delete(ruleId);
  }

  /**
   * Get all rules
   */
  getRules(): ValidationRule[] {
    return Array.from(this.rules.values());
  }

  /**
   * Private helper methods
   */

  private getScoreDeduction(severity: 'error' | 'warning' | 'info'): number {
    switch (severity) {
      case 'error': return 25;
      case 'warning': return 10;
      case 'info': return 2;
    }
  }

  private suggestPipeDiameter(sourceType: string, targetType: string): number {
    // Simple diameter suggestions based on equipment types
    if (sourceType.includes('pump') || targetType.includes('pump')) return 4;
    if (sourceType.includes('vessel') || targetType.includes('vessel')) return 6;
    if (sourceType.includes('tank') || targetType.includes('tank')) return 8;
    return 2; // Default small process line
  }

  private suggestMaterial(sourceType: string, targetType: string): string {
    // Simple material suggestions
    return 'carbon-steel'; // Default material
  }

  /**
   * Initialize default validation rules
   */
  private initializeDefaultRules(): void {
    // Structural Rules
    this.addRule({
      id: 'no-self-connection',
      name: 'No Self Connection',
      description: 'A component cannot connect to itself',
      severity: 'error',
      category: 'structural',
      validate: (connection) => {
        const valid = connection.source.nodeId !== connection.target.nodeId;
        return {
          valid,
          issues: valid ? [] : [{
            ruleId: 'no-self-connection',
            severity: 'error',
            category: 'structural',
            message: 'Component cannot connect to itself',
            affectedElements: [connection.source.nodeId],
            suggestedFixes: ['Select a different target component']
          }],
          suggestions: [],
          score: valid ? 100 : 0
        };
      }
    });

    // Connection point direction validation
    this.addRule({
      id: 'connection-direction-mismatch',
      name: 'Connection Direction Validation',
      description: 'Connection points should have compatible directions',
      severity: 'warning',
      category: 'structural',
      validate: (connection) => {
        const source = connection.source.connectionPoint;
        const target = connection.target.connectionPoint;
        
        // Check if directions are opposing (good practice)
        const opposingDirections = {
          north: 'south',
          south: 'north',
          east: 'west',
          west: 'east'
        };

        const isOptimal = opposingDirections[source.direction] === target.direction;
        
        return {
          valid: true, // Always valid, but may have suggestions
          issues: [],
          suggestions: isOptimal ? [] : [
            'Consider using connection points with opposing directions for optimal routing'
          ],
          score: isOptimal ? 100 : 85
        };
      }
    });

    // Compatibility rule
    this.addRule({
      id: 'node-type-compatibility',
      name: 'Node Type Compatibility',
      description: 'Source and target nodes must be compatible',
      severity: 'error',
      category: 'engineering',
      validate: (connection) => {
        const compatibility = this.areNodesCompatible(
          connection.source.nodeType,
          connection.target.nodeType
        );

        return {
          valid: compatibility.compatible,
          issues: compatibility.compatible ? [] : [{
            ruleId: 'node-type-compatibility',
            severity: 'error',
            category: 'engineering',
            message: `Incompatible connection: ${connection.source.nodeType} -> ${connection.target.nodeType}`,
            affectedElements: [connection.source.nodeId, connection.target.nodeId],
            suggestedFixes: compatibility.restrictions
          }],
          suggestions: compatibility.warnings,
          score: compatibility.compatible ? 100 : 0
        };
      }
    });

    // Process flow direction
    this.addRule({
      id: 'process-flow-direction',
      name: 'Process Flow Direction',
      description: 'Process flows should follow logical direction',
      severity: 'info',
      category: 'engineering',
      validate: (connection) => {
        if (connection.properties.lineType !== 'process') {
          return { valid: true, issues: [], suggestions: [], score: 100 };
        }

        // Check if connection flows in logical direction
        const flowSources = ['pump', 'vessel', 'tank'];
        const flowTargets = ['vessel', 'tank', 'heat-exchanger'];
        
        const sourceIsFlowSource = flowSources.some(type => 
          connection.source.nodeType.includes(type)
        );
        const targetIsFlowTarget = flowTargets.some(type => 
          connection.target.nodeType.includes(type)
        );

        const logicalFlow = sourceIsFlowSource && targetIsFlowTarget;

        return {
          valid: true,
          issues: [],
          suggestions: logicalFlow ? [] : [
            'Verify process flow direction matches intended design'
          ],
          score: logicalFlow ? 100 : 90
        };
      }
    });

    // Required properties validation
    this.addRule({
      id: 'required-properties',
      name: 'Required Properties',
      description: 'Connection must have all required properties',
      severity: 'warning',
      category: 'semantic',
      validate: (connection) => {
        const connectionType = this.connectionTypes.get(connection.connectionType.name);
        
        if (!connectionType) {
          return { valid: true, issues: [], suggestions: [], score: 100 };
        }

        const missingProperties = connectionType.requiredProperties.filter(
          prop => !(prop in connection.properties)
        );

        return {
          valid: missingProperties.length === 0,
          issues: missingProperties.map(prop => ({
            ruleId: 'required-properties',
            severity: 'warning' as const,
            category: 'semantic',
            message: `Missing required property: ${prop}`,
            affectedElements: [connection.id],
            suggestedFixes: [`Add ${prop} property to the connection`]
          })),
          suggestions: [],
          score: missingProperties.length === 0 ? 100 : Math.max(60, 100 - missingProperties.length * 10)
        };
      }
    });
  }

  /**
   * Initialize connection types
   */
  private initializeConnectionTypes(): void {
    this.connectionTypes.set('process', {
      name: 'process',
      allowedSources: ['pump', 'vessel', 'tank', 'heat-exchanger', 'valve'],
      allowedTargets: ['vessel', 'tank', 'heat-exchanger', 'valve'],
      requiredProperties: ['medium', 'diameter'],
      restrictions: {
        maxConnections: 100
      }
    });

    this.connectionTypes.set('instrument', {
      name: 'instrument',
      allowedSources: ['sensor', 'transmitter', 'indicator'],
      allowedTargets: ['controller', 'indicator', 'recorder'],
      requiredProperties: ['signalType'],
      restrictions: {
        maxConnections: 10
      }
    });

    this.connectionTypes.set('electrical', {
      name: 'electrical',
      allowedSources: ['power-supply', 'junction-box'],
      allowedTargets: ['motor', 'heater', 'light'],
      requiredProperties: ['voltage'],
      restrictions: {
        maxConnections: 50
      }
    });
  }

  /**
   * Initialize compatibility matrix
   */
  private initializeCompatibilityMatrix(): void {
    // Process equipment compatibility
    this.compatibilityMatrix = {
      pump: {
        vessel: { allowed: true },
        tank: { allowed: true },
        'heat-exchanger': { allowed: true },
        valve: { allowed: true },
        pump: { 
          allowed: false, 
          restrictions: ['Pumps should not connect directly to other pumps'] 
        }
      },
      vessel: {
        pump: { allowed: true },
        vessel: { 
          allowed: true, 
          warnings: ['Ensure proper flow design between vessels'] 
        },
        tank: { allowed: true },
        'heat-exchanger': { allowed: true },
        valve: { allowed: true }
      },
      tank: {
        pump: { allowed: true },
        vessel: { allowed: true },
        tank: { 
          allowed: true, 
          warnings: ['Verify tank-to-tank transfer requirements'] 
        },
        valve: { allowed: true }
      },
      valve: {
        pump: { allowed: true },
        vessel: { allowed: true },
        tank: { allowed: true },
        'heat-exchanger': { allowed: true },
        valve: { 
          allowed: true, 
          warnings: ['Consider valve series arrangement necessity'] 
        }
      },
      'heat-exchanger': {
        pump: { allowed: true },
        vessel: { allowed: true },
        tank: { allowed: true },
        valve: { allowed: true },
        'heat-exchanger': { 
          allowed: true, 
          warnings: ['Verify heat exchanger series configuration'] 
        }
      },
      // Instrument connections
      sensor: {
        controller: { allowed: true },
        indicator: { allowed: true },
        recorder: { allowed: true },
        transmitter: { allowed: true }
      },
      transmitter: {
        controller: { allowed: true },
        indicator: { allowed: true },
        recorder: { allowed: true }
      },
      controller: {
        valve: { allowed: true },
        motor: { allowed: true },
        heater: { allowed: true },
        indicator: { allowed: true }
      }
    };
  }
}

export const connectionValidator = ConnectionValidator.getInstance();