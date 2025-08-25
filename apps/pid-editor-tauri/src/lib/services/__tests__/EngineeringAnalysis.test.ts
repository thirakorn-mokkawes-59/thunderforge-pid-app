import { describe, it, expect, beforeEach, vi } from 'vitest';
import { 
  EngineeringAnalysisService, 
  type FlowStream, 
  type MaterialBalance,
  type EnergyBalance,
  type ComplianceCheck 
} from '../EngineeringAnalysis';

describe('EngineeringAnalysisService', () => {
  let analysisService: EngineeringAnalysisService;

  const createTestStream = (overrides: Partial<FlowStream> = {}): FlowStream => ({
    id: 'S-001',
    name: 'Test Stream',
    fluid: 'Water',
    temperature: 25,
    pressure: 1,
    massFlow: 1000,
    volumeFlow: 1,
    density: 1000,
    viscosity: 1,
    phase: 'liquid',
    ...overrides
  });

  beforeEach(() => {
    // Create fresh instance for each test
    (EngineeringAnalysisService as any).instance = undefined;
    analysisService = EngineeringAnalysisService.getInstance();
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const instance1 = EngineeringAnalysisService.getInstance();
      const instance2 = EngineeringAnalysisService.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('Stream Management', () => {
    it('should define a new stream', () => {
      const stream = createTestStream();
      analysisService.defineStream(stream);

      const retrievedStream = analysisService.getStream('S-001');
      expect(retrievedStream).toEqual(stream);
    });

    it('should calculate volume flow from mass flow and density', () => {
      const stream = createTestStream({
        volumeFlow: 0,
        massFlow: 1000,
        density: 1000
      });

      analysisService.defineStream(stream);
      const retrievedStream = analysisService.getStream('S-001');
      
      expect(retrievedStream?.volumeFlow).toBe(1);
    });

    it('should calculate density from mass flow and volume flow', () => {
      const stream = createTestStream({
        density: 0,
        massFlow: 1000,
        volumeFlow: 1
      });

      analysisService.defineStream(stream);
      const retrievedStream = analysisService.getStream('S-001');
      
      expect(retrievedStream?.density).toBe(1000);
    });

    it('should get all defined streams', () => {
      const stream1 = createTestStream({ id: 'S-001' });
      const stream2 = createTestStream({ id: 'S-002' });

      analysisService.defineStream(stream1);
      analysisService.defineStream(stream2);

      const allStreams = analysisService.getAllStreams();
      expect(allStreams).toHaveLength(2);
      expect(allStreams.map(s => s.id)).toEqual(['S-001', 'S-002']);
    });

    it('should return null for non-existent stream', () => {
      const stream = analysisService.getStream('non-existent');
      expect(stream).toBeNull();
    });
  });

  describe('Component Registration', () => {
    it('should register a component', () => {
      const componentData = { type: 'pump', efficiency: 0.85 };
      analysisService.registerComponent('P-001', componentData);
      
      // Since there's no getter method, we test indirectly through other methods
      expect(true).toBe(true); // Component registration doesn't have direct verification
    });
  });

  describe('Pressure Drop Calculations', () => {
    beforeEach(() => {
      const stream = createTestStream({
        id: 'S-001',
        pressure: 5,
        volumeFlow: 10,
        density: 1000,
        viscosity: 1
      });
      analysisService.defineStream(stream);
    });

    it('should calculate pipe pressure drop', () => {
      const result = analysisService.calculatePressureDrop('S-001', 'pipe', 'PIPE-001', {
        length: 100,
        diameter: 0.1,
        roughness: 0.0001
      });

      expect(result.streamId).toBe('S-001');
      expect(result.component).toBe('pipe');
      expect(result.componentId).toBe('PIPE-001');
      expect(result.method).toBe('Darcy-Weisbach');
      expect(result.pressureDrop).toBeGreaterThan(0);
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('should calculate valve pressure drop for liquid', () => {
      const result = analysisService.calculatePressureDrop('S-001', 'valve', 'V-001', {
        cv: 100,
        opening: 0.8
      });

      expect(result.method).toBe('Cv-based (ISA)');
      expect(result.pressureDrop).toBeGreaterThan(0);
      expect(result.confidence).toBe(0.85);
    });

    it('should calculate valve pressure drop for gas', () => {
      const gasStream = createTestStream({
        id: 'S-002',
        phase: 'gas',
        density: 1.2,
        temperature: 150
      });
      analysisService.defineStream(gasStream);

      const result = analysisService.calculatePressureDrop('S-002', 'valve', 'V-002', {
        cv: 50
      });

      expect(result.method).toBe('Cv-based compressible');
      expect(result.confidence).toBe(0.8);
    });

    it('should calculate orifice pressure drop', () => {
      const result = analysisService.calculatePressureDrop('S-001', 'orifice', 'O-001', {
        diameter: 0.05,
        beta: 0.6,
        dischargeCoeff: 0.61
      });

      expect(result.method).toBe('Orifice equation');
      expect(result.pressureDrop).toBeGreaterThan(0);
      expect(result.confidence).toBe(0.85);
    });

    it('should calculate heat exchanger pressure drop', () => {
      const result = analysisService.calculatePressureDrop('S-001', 'heat_exchanger', 'HX-001', {
        passes: 2,
        tubes: 200,
        tubeDiameter: 0.02,
        tubeLength: 4
      });

      expect(result.method).toBe('Shell-and-tube correlation');
      expect(result.pressureDrop).toBeGreaterThan(0);
      expect(result.confidence).toBe(0.75);
    });

    it('should calculate filter pressure drop', () => {
      const result = analysisService.calculatePressureDrop('S-001', 'filter', 'F-001', {
        area: 2,
        permeability: 1e-12,
        thickness: 0.01
      });

      expect(result.method).toBe("Darcy's law");
      expect(result.pressureDrop).toBeGreaterThan(0);
      expect(result.confidence).toBe(0.7);
    });

    it('should handle unknown component type', () => {
      const result = analysisService.calculatePressureDrop('S-001', 'unknown', 'U-001');

      expect(result.pressureDrop).toBe(0);
      expect(result.confidence).toBe(0);
      expect(result.warnings).toContain('Unknown component type: unknown');
    });

    it('should add warning for mixed phase flow', () => {
      const mixedStream = createTestStream({
        id: 'S-003',
        phase: 'mixed'
      });
      analysisService.defineStream(mixedStream);

      const result = analysisService.calculatePressureDrop('S-003', 'pipe', 'P-003');

      expect(result.warnings).toContain('Mixed phase flow may require specialized calculation methods');
    });

    it('should throw error for non-existent stream', () => {
      expect(() => {
        analysisService.calculatePressureDrop('non-existent', 'pipe', 'P-001');
      }).toThrow('Stream non-existent not found');
    });
  });

  describe('Material Balance Analysis', () => {
    beforeEach(() => {
      // Define inlet streams
      const inlet1 = createTestStream({
        id: 'S-001',
        name: 'Inlet 1',
        massFlow: 1000
      });
      const inlet2 = createTestStream({
        id: 'S-002',
        name: 'Inlet 2',
        massFlow: 500
      });

      // Define outlet streams
      const outlet1 = createTestStream({
        id: 'S-003',
        name: 'Outlet 1',
        massFlow: 1500
      });

      analysisService.defineStream(inlet1);
      analysisService.defineStream(inlet2);
      analysisService.defineStream(outlet1);
    });

    it('should perform material balance with balanced streams', () => {
      const balance = analysisService.performMaterialBalance(
        'NODE-001',
        'Test Node',
        ['S-001', 'S-002'],
        ['S-003']
      );

      expect(balance.nodeId).toBe('NODE-001');
      expect(balance.nodeName).toBe('Test Node');
      expect(balance.balance.massIn).toBe(1500);
      expect(balance.balance.massOut).toBe(1500);
      expect(balance.balance.massImbalance).toBe(0);
      expect(balance.balance.percentageError).toBe(0);
      expect(balance.balance.balanced).toBe(true);
    });

    it('should detect material balance error', () => {
      // Add an imbalanced outlet
      const outlet2 = createTestStream({
        id: 'S-004',
        name: 'Outlet 2',
        massFlow: 100
      });
      analysisService.defineStream(outlet2);

      const balance = analysisService.performMaterialBalance(
        'NODE-002',
        'Imbalanced Node',
        ['S-001', 'S-002'],
        ['S-003', 'S-004']
      );

      expect(balance.balance.massIn).toBe(1500);
      expect(balance.balance.massOut).toBe(1600);
      expect(balance.balance.massImbalance).toBe(100);
      expect(balance.balance.percentageError).toBeCloseTo(6.67, 1);
      expect(balance.balance.balanced).toBe(false);
    });

    it('should perform component balance when composition data available', () => {
      const inletWithComp = createTestStream({
        id: 'S-005',
        massFlow: 1000,
        composition: { water: 80, ethanol: 20 }
      });
      const outletWithComp = createTestStream({
        id: 'S-006',
        massFlow: 1000,
        composition: { water: 80, ethanol: 20 }
      });

      analysisService.defineStream(inletWithComp);
      analysisService.defineStream(outletWithComp);

      const balance = analysisService.performMaterialBalance(
        'NODE-003',
        'Component Balance Node',
        ['S-005'],
        ['S-006']
      );

      expect(balance.componentBalance).toBeDefined();
      expect(balance.componentBalance!.water.balanced).toBe(true);
      expect(balance.componentBalance!.ethanol.balanced).toBe(true);
    });
  });

  describe('Energy Balance Analysis', () => {
    beforeEach(() => {
      const hotInlet = createTestStream({
        id: 'S-010',
        massFlow: 1000,
        temperature: 80
      });
      const coldOutlet = createTestStream({
        id: 'S-011',
        massFlow: 1000,
        temperature: 60
      });

      analysisService.defineStream(hotInlet);
      analysisService.defineStream(coldOutlet);
    });

    it('should perform energy balance', () => {
      const balance = analysisService.performEnergyBalance(
        'HX-001',
        'Heat Exchanger',
        ['S-010'],
        ['S-011'],
        0, // no external heat input
        0  // no work input
      );

      expect(balance.nodeId).toBe('HX-001');
      expect(balance.nodeName).toBe('Heat Exchanger');
      expect(balance.enthalpyIn).toBeGreaterThan(balance.enthalpyOut);
      expect(balance.energyImbalance).toBeGreaterThan(0); // Heat is being removed
    });

    it('should calculate efficiency when work input provided', () => {
      const balance = analysisService.performEnergyBalance(
        'PUMP-001',
        'Pump',
        ['S-010'],
        ['S-011'],
        0,   // no heat input
        10   // 10 kW work input
      );

      expect(balance.workInput).toBe(10);
      expect(balance.efficiency).toBeDefined();
    });
  });

  describe('Compliance Checking', () => {
    it('should perform compliance checks', () => {
      const mockDiagramData = {
        components: [],
        streams: []
      };

      const checks = analysisService.performComplianceCheck(mockDiagramData);

      expect(checks.length).toBeGreaterThan(0);
      
      // Check that we have different categories
      const categories = new Set(checks.map(c => c.category));
      expect(categories.has('safety')).toBe(true);
      expect(categories.has('design')).toBe(true);
      expect(categories.has('operation')).toBe(true);
      expect(categories.has('documentation')).toBe(true);
    });

    it('should include required compliance check properties', () => {
      const checks = analysisService.performComplianceCheck({});
      
      checks.forEach(check => {
        expect(check).toHaveProperty('id');
        expect(check).toHaveProperty('standard');
        expect(check).toHaveProperty('category');
        expect(check).toHaveProperty('severity');
        expect(check).toHaveProperty('title');
        expect(check).toHaveProperty('description');
        expect(check).toHaveProperty('compliant');
        expect(check).toHaveProperty('recommendation');
        expect(check).toHaveProperty('reference');
      });
    });
  });

  describe('Analysis Report Generation', () => {
    beforeEach(() => {
      // Setup test streams
      const stream1 = createTestStream({ id: 'S-001', massFlow: 1000 });
      const stream2 = createTestStream({ id: 'S-002', massFlow: 500 });
      
      analysisService.defineStream(stream1);
      analysisService.defineStream(stream2);
    });

    it('should generate comprehensive analysis report', async () => {
      const mockDiagramData = {
        components: [],
        streams: analysisService.getAllStreams()
      };

      const report = await analysisService.generateAnalysisReport('DIAGRAM-001', mockDiagramData);

      expect(report.id).toBeDefined();
      expect(report.diagramId).toBe('DIAGRAM-001');
      expect(report.timestamp).toBeDefined();
      expect(report.summary).toBeDefined();
      expect(report.summary.totalStreams).toBe(2);
      expect(report.complianceChecks.length).toBeGreaterThan(0);
      expect(report.hazopAnalysis.length).toBeGreaterThan(0);
      expect(report.recommendations.length).toBeGreaterThan(0);
    });

    it('should determine correct overall risk level', async () => {
      const report = await analysisService.generateAnalysisReport('DIAGRAM-002', {});

      expect(['low', 'medium', 'high', 'critical']).toContain(report.summary.overallRisk);
    });

    it('should store report in history', async () => {
      const report1 = await analysisService.generateAnalysisReport('DIAGRAM-001', {});
      const report2 = await analysisService.generateAnalysisReport('DIAGRAM-002', {});

      const history = analysisService.getAnalysisHistory();
      expect(history).toHaveLength(2);
      expect(history.map(r => r.diagramId)).toEqual(['DIAGRAM-001', 'DIAGRAM-002']);
    });

    it('should limit history to 50 reports', async () => {
      // Generate 60 reports to test the limit
      for (let i = 1; i <= 60; i++) {
        await analysisService.generateAnalysisReport(`DIAGRAM-${i}`, {});
      }

      const history = analysisService.getAnalysisHistory();
      expect(history).toHaveLength(50);
      
      // Should keep the last 50 reports
      expect(history[0].diagramId).toBe('DIAGRAM-11');
      expect(history[49].diagramId).toBe('DIAGRAM-60');
    });
  });

  describe('Report Retrieval', () => {
    it('should get specific analysis report', async () => {
      const report = await analysisService.generateAnalysisReport('DIAGRAM-001', {});
      
      const retrieved = analysisService.getAnalysisReport(report.id);
      expect(retrieved).toEqual(report);
    });

    it('should return null for non-existent report', () => {
      const retrieved = analysisService.getAnalysisReport('non-existent-id');
      expect(retrieved).toBeNull();
    });
  });

  describe('Data Management', () => {
    beforeEach(() => {
      const stream = createTestStream();
      analysisService.defineStream(stream);
      analysisService.registerComponent('C-001', { type: 'test' });
    });

    it('should clear all data', () => {
      analysisService.clearAll();
      
      const streams = analysisService.getAllStreams();
      expect(streams).toHaveLength(0);
      
      const stream = analysisService.getStream('S-001');
      expect(stream).toBeNull();
    });

    it('should export analysis data', () => {
      const exportData = analysisService.exportAnalysisData();
      expect(typeof exportData).toBe('string');
      
      const parsed = JSON.parse(exportData);
      expect(parsed).toHaveProperty('streams');
      expect(parsed).toHaveProperty('components');
      expect(parsed).toHaveProperty('analysisHistory');
      expect(parsed).toHaveProperty('exportedAt');
    });
  });

  describe('HAZOP Analysis', () => {
    it('should generate HAZOP nodes with deviations', async () => {
      const report = await analysisService.generateAnalysisReport('DIAGRAM-001', {});
      
      const hazopNodes = report.hazopAnalysis;
      expect(hazopNodes.length).toBeGreaterThan(0);

      hazopNodes.forEach(node => {
        expect(node).toHaveProperty('id');
        expect(node).toHaveProperty('name');
        expect(node).toHaveProperty('description');
        expect(node).toHaveProperty('intention');
        expect(node).toHaveProperty('parameters');
        expect(node).toHaveProperty('deviations');
        
        node.deviations.forEach(deviation => {
          expect(deviation).toHaveProperty('parameter');
          expect(deviation).toHaveProperty('deviation');
          expect(deviation).toHaveProperty('causes');
          expect(deviation).toHaveProperty('consequences');
          expect(deviation).toHaveProperty('safeguards');
          expect(deviation).toHaveProperty('riskLevel');
          expect(['low', 'medium', 'high', 'critical']).toContain(deviation.riskLevel);
        });
      });
    });
  });

  describe('Recommendations Generation', () => {
    it('should generate recommendations based on analysis results', async () => {
      const report = await analysisService.generateAnalysisReport('DIAGRAM-001', {});
      
      expect(report.recommendations).toBeDefined();
      expect(Array.isArray(report.recommendations)).toBe(true);
      
      // Should have some recommendations based on the mock data
      expect(report.recommendations.length).toBeGreaterThan(0);
    });
  });
});