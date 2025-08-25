import { describe, it, expect, beforeEach } from 'vitest';
import { ConnectionValidator, type ConnectionData, type ValidationRule } from '../ConnectionValidator';

describe('ConnectionValidator', () => {
  let validator: ConnectionValidator;

  beforeEach(() => {
    validator = ConnectionValidator.getInstance();
  });

  describe('Node Type Compatibility', () => {
    it('should allow compatible node types', () => {
      const compatibility = validator.areNodesCompatible('pump', 'vessel');
      
      expect(compatibility.compatible).toBe(true);
      expect(compatibility.restrictions).toHaveLength(0);
    });

    it('should reject incompatible node types', () => {
      const compatibility = validator.areNodesCompatible('pump', 'pump');
      
      expect(compatibility.compatible).toBe(false);
      expect(compatibility.restrictions.length).toBeGreaterThan(0);
    });

    it('should provide warnings for questionable connections', () => {
      const compatibility = validator.areNodesCompatible('vessel', 'vessel');
      
      expect(compatibility.compatible).toBe(true);
      expect(compatibility.warnings.length).toBeGreaterThan(0);
    });
  });

  describe('Connection Validation', () => {
    const createTestConnection = (overrides: Partial<ConnectionData> = {}): ConnectionData => ({
      id: 'test-connection',
      source: {
        nodeId: 'source-node',
        nodeType: 'pump',
        connectionPoint: {
          id: 'source-point',
          position: { x: 100, y: 50 },
          direction: 'east',
          type: 'output',
          occupied: false,
          nodeId: 'source-node'
        },
        properties: {}
      },
      target: {
        nodeId: 'target-node',
        nodeType: 'vessel',
        connectionPoint: {
          id: 'target-point',
          position: { x: 200, y: 50 },
          direction: 'west',
          type: 'input',
          occupied: false,
          nodeId: 'target-node'
        },
        properties: {}
      },
      connectionType: {
        name: 'process',
        allowedSources: ['pump'],
        allowedTargets: ['vessel'],
        requiredProperties: ['medium', 'diameter'],
        restrictions: {}
      },
      properties: {
        lineType: 'process',
        medium: 'water',
        diameter: 4
      },
      ...overrides
    });

    it('should validate a valid connection', () => {
      const connection = createTestConnection();
      const result = validator.validateConnection(connection);

      expect(result.valid).toBe(true);
      expect(result.score).toBeGreaterThan(80);
    });

    it('should reject self-connections', () => {
      const connection = createTestConnection({
        target: {
          nodeId: 'source-node', // Same as source
          nodeType: 'vessel',
          connectionPoint: {
            id: 'target-point',
            position: { x: 200, y: 50 },
            direction: 'west',
            type: 'input',
            occupied: false,
            nodeId: 'source-node'
          },
          properties: {}
        }
      });

      const result = validator.validateConnection(connection);

      expect(result.valid).toBe(false);
      expect(result.issues).toHaveLength(1);
      expect(result.issues[0].ruleId).toBe('no-self-connection');
    });

    it('should detect missing required properties', () => {
      const connection = createTestConnection({
        properties: {
          lineType: 'process'
          // Missing medium and diameter
        }
      });

      const result = validator.validateConnection(connection);

      expect(result.issues.some(issue => 
        issue.message.includes('Missing required property')
      )).toBe(true);
    });

    it('should provide suggestions for non-optimal connections', () => {
      const connection = createTestConnection({
        source: {
          nodeId: 'source-node',
          nodeType: 'pump',
          connectionPoint: {
            id: 'source-point',
            position: { x: 100, y: 50 },
            direction: 'north', // Not optimal direction
            type: 'output',
            occupied: false,
            nodeId: 'source-node'
          },
          properties: {}
        },
        target: {
          nodeId: 'target-node',
          nodeType: 'vessel',
          connectionPoint: {
            id: 'target-point',
            position: { x: 200, y: 50 },
            direction: 'east', // Not optimal direction
            type: 'input',
            occupied: false,
            nodeId: 'target-node'
          },
          properties: {}
        }
      });

      const result = validator.validateConnection(connection);

      expect(result.suggestions.length).toBeGreaterThan(0);
      expect(result.score).toBeLessThan(100);
    });
  });

  describe('Multiple Connection Validation', () => {
    it('should validate multiple connections', () => {
      const connections: ConnectionData[] = [
        {
          id: 'connection-1',
          source: {
            nodeId: 'pump1',
            nodeType: 'pump',
            connectionPoint: {
              id: 'pump1-out',
              position: { x: 100, y: 50 },
              direction: 'east',
              type: 'output',
              occupied: false,
              nodeId: 'pump1'
            },
            properties: {}
          },
          target: {
            nodeId: 'vessel1',
            nodeType: 'vessel',
            connectionPoint: {
              id: 'vessel1-in',
              position: { x: 200, y: 50 },
              direction: 'west',
              type: 'input',
              occupied: false,
              nodeId: 'vessel1'
            },
            properties: {}
          },
          connectionType: {
            name: 'process',
            allowedSources: [],
            allowedTargets: [],
            requiredProperties: [],
            restrictions: {}
          },
          properties: {
            lineType: 'process',
            medium: 'water',
            diameter: 4
          }
        },
        {
          id: 'connection-2',
          source: {
            nodeId: 'pump2',
            nodeType: 'pump',
            connectionPoint: {
              id: 'pump2-out',
              position: { x: 100, y: 150 },
              direction: 'east',
              type: 'output',
              occupied: false,
              nodeId: 'pump2'
            },
            properties: {}
          },
          target: {
            nodeId: 'pump2', // Self-connection (invalid)
            nodeType: 'pump',
            connectionPoint: {
              id: 'pump2-in',
              position: { x: 80, y: 150 },
              direction: 'west',
              type: 'input',
              occupied: false,
              nodeId: 'pump2'
            },
            properties: {}
          },
          connectionType: {
            name: 'process',
            allowedSources: [],
            allowedTargets: [],
            requiredProperties: [],
            restrictions: {}
          },
          properties: {
            lineType: 'process'
          }
        }
      ];

      const results = validator.validateConnections(connections);

      expect(results.summary.total).toBe(2);
      expect(results.summary.valid).toBe(1);
      expect(results.summary.errors).toBeGreaterThan(0);
      expect(results.overallValid).toBe(false);
    });
  });

  describe('Property Suggestions', () => {
    it('should suggest appropriate properties for process connections', () => {
      const suggestions = validator.getSuggestedProperties('pump', 'vessel', 'process');

      expect(suggestions.lineType).toBe('process');
      expect(suggestions.diameter).toBeDefined();
      expect(suggestions.material).toBeDefined();
    });

    it('should suggest appropriate properties for instrument connections', () => {
      const suggestions = validator.getSuggestedProperties('sensor', 'controller', 'instrument');

      expect(suggestions.lineType).toBe('instrument');
      expect(suggestions.diameter).toBe(6);
    });

    it('should suggest appropriate properties for electrical connections', () => {
      const suggestions = validator.getSuggestedProperties('power-supply', 'motor', 'electrical');

      expect(suggestions.lineType).toBe('electrical');
    });

    it('should suggest appropriate properties for pneumatic connections', () => {
      const suggestions = validator.getSuggestedProperties('compressor', 'actuator', 'pneumatic');

      expect(suggestions.lineType).toBe('pneumatic');
      expect(suggestions.pressure).toBe(100);
    });
  });

  describe('Custom Rules', () => {
    it('should allow adding custom validation rules', () => {
      const customRule: ValidationRule = {
        id: 'custom-rule',
        name: 'Custom Rule',
        description: 'Test custom rule',
        severity: 'warning',
        category: 'custom',
        validate: (connection) => ({
          valid: connection.properties.diameter !== 10,
          issues: connection.properties.diameter === 10 ? [{
            ruleId: 'custom-rule',
            severity: 'warning',
            category: 'custom',
            message: 'Diameter of 10 is not recommended',
            affectedElements: [connection.id],
            suggestedFixes: ['Use a different diameter']
          }] : [],
          suggestions: [],
          score: connection.properties.diameter === 10 ? 50 : 100
        })
      };

      validator.addRule(customRule);
      
      const rules = validator.getRules();
      expect(rules.some(rule => rule.id === 'custom-rule')).toBe(true);

      // Test the custom rule
      const connection: ConnectionData = {
        id: 'test-connection',
        source: {
          nodeId: 'source',
          nodeType: 'pump',
          connectionPoint: {
            id: 'source-point',
            position: { x: 0, y: 0 },
            direction: 'east',
            type: 'output',
            occupied: false,
            nodeId: 'source'
          },
          properties: {}
        },
        target: {
          nodeId: 'target',
          nodeType: 'vessel',
          connectionPoint: {
            id: 'target-point',
            position: { x: 100, y: 0 },
            direction: 'west',
            type: 'input',
            occupied: false,
            nodeId: 'target'
          },
          properties: {}
        },
        connectionType: {
          name: 'process',
          allowedSources: [],
          allowedTargets: [],
          requiredProperties: [],
          restrictions: {}
        },
        properties: {
          lineType: 'process',
          diameter: 10 // Should trigger custom rule
        }
      };

      const result = validator.validateConnection(connection);
      
      expect(result.issues.some(issue => issue.ruleId === 'custom-rule')).toBe(true);
    });

    it('should allow removing validation rules', () => {
      const initialRuleCount = validator.getRules().length;
      
      validator.removeRule('no-self-connection');
      
      const remainingRules = validator.getRules();
      expect(remainingRules.length).toBe(initialRuleCount - 1);
      expect(remainingRules.some(rule => rule.id === 'no-self-connection')).toBe(false);
    });
  });
});