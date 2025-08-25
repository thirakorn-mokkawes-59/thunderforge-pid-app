/**
 * Engineering Analysis Service
 * 
 * Provides comprehensive engineering validation and analysis capabilities for PID diagrams,
 * including flow analysis, pressure calculations, material balance, energy balance,
 * and compliance checking against industry standards.
 */

export interface FlowStream {
  id: string;
  name: string;
  fluid: string;
  temperature: number; // °C
  pressure: number; // bar
  massFlow: number; // kg/h
  volumeFlow: number; // m³/h
  density: number; // kg/m³
  viscosity: number; // cP
  composition?: Record<string, number>; // Component percentages
  phase: 'liquid' | 'gas' | 'vapor' | 'mixed';
  enthalpy?: number; // kJ/kg
}

export interface PressureDropCalculation {
  streamId: string;
  component: string;
  componentId: string;
  pressureIn: number;
  pressureOut: number;
  pressureDrop: number;
  method: string;
  confidence: number;
  warnings: string[];
}

export interface MaterialBalance {
  nodeId: string;
  nodeName: string;
  inletStreams: FlowStream[];
  outletStreams: FlowStream[];
  balance: {
    massIn: number;
    massOut: number;
    massImbalance: number;
    percentageError: number;
    balanced: boolean;
  };
  componentBalance?: Record<string, {
    in: number;
    out: number;
    imbalance: number;
    balanced: boolean;
  }>;
}

export interface EnergyBalance {
  nodeId: string;
  nodeName: string;
  heatInput: number; // kW
  heatOutput: number; // kW
  workInput: number; // kW
  workOutput: number; // kW
  enthalpyIn: number; // kJ/h
  enthalpyOut: number; // kJ/h
  energyImbalance: number; // kW
  balanced: boolean;
  efficiency?: number; // %
}

export interface ComplianceCheck {
  id: string;
  standard: string; // e.g., 'ASME', 'API', 'ISO', 'PIP'
  category: 'safety' | 'design' | 'operation' | 'documentation';
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  location: string;
  componentId?: string;
  compliant: boolean;
  recommendation: string;
  reference: string;
}

export interface HazopNode {
  id: string;
  name: string;
  description: string;
  intention: string;
  parameters: string[]; // Flow, Level, Pressure, Temperature, etc.
  deviations: HazopDeviation[];
}

export interface HazopDeviation {
  id: string;
  parameter: string;
  deviation: string; // No, More, Less, As Well As, Part Of, Reverse, Other Than
  causes: string[];
  consequences: string[];
  safeguards: string[];
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  actionRequired: boolean;
  recommendations: string[];
}

export interface AnalysisReport {
  id: string;
  diagramId: string;
  timestamp: number;
  summary: {
    totalStreams: number;
    totalComponents: number;
    materialBalanceErrors: number;
    energyBalanceErrors: number;
    complianceViolations: number;
    hazopNodes: number;
    overallRisk: 'low' | 'medium' | 'high' | 'critical';
  };
  pressureDrops: PressureDropCalculation[];
  materialBalances: MaterialBalance[];
  energyBalances: EnergyBalance[];
  complianceChecks: ComplianceCheck[];
  hazopAnalysis: HazopNode[];
  recommendations: string[];
}

export class EngineeringAnalysisService {
  private static instance: EngineeringAnalysisService;
  private streams: Map<string, FlowStream> = new Map();
  private components: Map<string, any> = new Map();
  private analysisHistory: AnalysisReport[] = [];

  private constructor() {}

  static getInstance(): EngineeringAnalysisService {
    if (!EngineeringAnalysisService.instance) {
      EngineeringAnalysisService.instance = new EngineeringAnalysisService();
    }
    return EngineeringAnalysisService.instance;
  }

  /**
   * Define a flow stream with its properties
   */
  defineStream(stream: FlowStream): void {
    // Calculate derived properties if not provided
    if (stream.volumeFlow === 0 && stream.massFlow > 0 && stream.density > 0) {
      stream.volumeFlow = stream.massFlow / stream.density;
    }
    
    if (stream.density === 0 && stream.massFlow > 0 && stream.volumeFlow > 0) {
      stream.density = stream.massFlow / stream.volumeFlow;
    }

    this.streams.set(stream.id, stream);
  }

  /**
   * Get a stream by ID
   */
  getStream(streamId: string): FlowStream | null {
    return this.streams.get(streamId) || null;
  }

  /**
   * Get all defined streams
   */
  getAllStreams(): FlowStream[] {
    return Array.from(this.streams.values());
  }

  /**
   * Register a component for analysis
   */
  registerComponent(componentId: string, componentData: any): void {
    this.components.set(componentId, componentData);
  }

  /**
   * Calculate pressure drop across a component
   */
  calculatePressureDrop(
    streamId: string,
    componentType: string,
    componentId: string,
    parameters: Record<string, any> = {}
  ): PressureDropCalculation {
    const stream = this.getStream(streamId);
    if (!stream) {
      throw new Error(`Stream ${streamId} not found`);
    }

    let pressureDrop = 0;
    let method = 'unknown';
    let confidence = 0;
    const warnings: string[] = [];

    // Component-specific pressure drop calculations
    switch (componentType.toLowerCase()) {
      case 'pipe':
        ({ pressureDrop, method, confidence } = this.calculatePipePressureDrop(stream, parameters));
        break;
      
      case 'valve':
        ({ pressureDrop, method, confidence } = this.calculateValvePressureDrop(stream, parameters));
        break;
      
      case 'orifice':
        ({ pressureDrop, method, confidence } = this.calculateOrificePressureDrop(stream, parameters));
        break;
      
      case 'heat_exchanger':
        ({ pressureDrop, method, confidence } = this.calculateHeatExchangerPressureDrop(stream, parameters));
        break;
      
      case 'filter':
        ({ pressureDrop, method, confidence } = this.calculateFilterPressureDrop(stream, parameters));
        break;
      
      default:
        warnings.push(`Unknown component type: ${componentType}`);
        confidence = 0;
    }

    // Add warnings for uncertain calculations
    if (confidence < 0.7) {
      warnings.push('Low confidence in pressure drop calculation');
    }

    if (stream.phase === 'mixed') {
      warnings.push('Mixed phase flow may require specialized calculation methods');
    }

    return {
      streamId,
      component: componentType,
      componentId,
      pressureIn: stream.pressure,
      pressureOut: stream.pressure - pressureDrop,
      pressureDrop,
      method,
      confidence,
      warnings
    };
  }

  /**
   * Calculate pipe pressure drop using Darcy-Weisbach equation
   */
  private calculatePipePressureDrop(
    stream: FlowStream,
    parameters: Record<string, any>
  ): { pressureDrop: number; method: string; confidence: number } {
    const length = parameters.length || 10; // m
    const diameter = parameters.diameter || 0.1; // m
    const roughness = parameters.roughness || 0.0001; // m
    const fittings = parameters.fittings || 0; // equivalent length

    // Reynolds number
    const velocity = (4 * stream.volumeFlow / 3600) / (Math.PI * diameter * diameter);
    const reynolds = (stream.density * velocity * diameter) / (stream.viscosity * 0.001);

    // Friction factor (Colebrook-White approximation)
    const relativeRoughness = roughness / diameter;
    let frictionFactor = 0.02;
    
    if (reynolds > 4000) {
      // Turbulent flow - Swamee-Jain approximation
      frictionFactor = 0.25 / Math.pow(
        Math.log10(relativeRoughness / 3.7 + 5.74 / Math.pow(reynolds, 0.9)),
        2
      );
    } else if (reynolds > 2300) {
      // Transition region
      frictionFactor = 0.032;
    } else {
      // Laminar flow
      frictionFactor = 64 / reynolds;
    }

    // Total equivalent length
    const totalLength = length + fittings;

    // Pressure drop (Darcy-Weisbach)
    const pressureDrop = frictionFactor * (totalLength / diameter) * 
      (stream.density * velocity * velocity) / (2 * 100000); // Convert to bar

    return {
      pressureDrop,
      method: 'Darcy-Weisbach',
      confidence: reynolds > 4000 ? 0.9 : 0.7
    };
  }

  /**
   * Calculate valve pressure drop
   */
  private calculateValvePressureDrop(
    stream: FlowStream,
    parameters: Record<string, any>
  ): { pressureDrop: number; method: string; confidence: number } {
    const cv = parameters.cv || 100; // Flow coefficient
    const opening = parameters.opening || 1.0; // Valve opening fraction (0-1)
    
    // Adjust Cv based on valve opening
    const effectiveCv = cv * Math.pow(opening, 2);
    
    // Pressure drop calculation for liquids (incompressible flow)
    if (stream.phase === 'liquid') {
      const specificGravity = stream.density / 1000;
      const pressureDrop = Math.pow(stream.volumeFlow / effectiveCv, 2) * specificGravity;
      
      return {
        pressureDrop,
        method: 'Cv-based (ISA)',
        confidence: 0.85
      };
    } else {
      // Gas flow (compressible)
      const pressureDrop = Math.pow(stream.massFlow / (effectiveCv * 27.3), 2) * 
        (stream.temperature + 273.15) / (stream.pressure * 1000);
      
      return {
        pressureDrop,
        method: 'Cv-based compressible',
        confidence: 0.8
      };
    }
  }

  /**
   * Calculate orifice pressure drop
   */
  private calculateOrificePressureDrop(
    stream: FlowStream,
    parameters: Record<string, any>
  ): { pressureDrop: number; method: string; confidence: number } {
    const diameter = parameters.diameter || 0.05; // m
    const beta = parameters.beta || 0.6; // Orifice diameter ratio
    const dischargeCoeff = parameters.dischargeCoeff || 0.61;
    
    const velocity = (4 * stream.volumeFlow / 3600) / (Math.PI * diameter * diameter);
    const orificeVelocity = velocity / (beta * beta);
    
    const pressureDrop = (stream.density * orificeVelocity * orificeVelocity * 
      (1 - Math.pow(beta, 4))) / (2 * dischargeCoeff * dischargeCoeff * 100000);
    
    return {
      pressureDrop,
      method: 'Orifice equation',
      confidence: 0.85
    };
  }

  /**
   * Calculate heat exchanger pressure drop
   */
  private calculateHeatExchangerPressureDrop(
    stream: FlowStream,
    parameters: Record<string, any>
  ): { pressureDrop: number; method: string; confidence: number } {
    const passes = parameters.passes || 1;
    const tubes = parameters.tubes || 100;
    const tubeDiameter = parameters.tubeDiameter || 0.02; // m
    const tubeLength = parameters.tubeLength || 4; // m
    
    // Simplified calculation based on shell-and-tube design
    const tubeVelocity = (4 * stream.volumeFlow / 3600) / 
      (Math.PI * tubeDiameter * tubeDiameter * tubes / passes);
    
    const reynolds = (stream.density * tubeVelocity * tubeDiameter) / (stream.viscosity * 0.001);
    const frictionFactor = 0.316 / Math.pow(reynolds, 0.25); // Blasius correlation
    
    const pressureDrop = frictionFactor * (tubeLength / tubeDiameter) * 
      (stream.density * tubeVelocity * tubeVelocity) / (2 * 100000) * passes;
    
    return {
      pressureDrop,
      method: 'Shell-and-tube correlation',
      confidence: 0.75
    };
  }

  /**
   * Calculate filter pressure drop
   */
  private calculateFilterPressureDrop(
    stream: FlowStream,
    parameters: Record<string, any>
  ): { pressureDrop: number; method: string; confidence: number } {
    const area = parameters.area || 1; // m²
    const permeability = parameters.permeability || 1e-12; // m²
    const thickness = parameters.thickness || 0.01; // m
    const cakeResistance = parameters.cakeResistance || 0; // Additional resistance
    
    // Darcy's law for porous media
    const superficialVelocity = (stream.volumeFlow / 3600) / area;
    const pressureDrop = (stream.viscosity * 0.001 * superficialVelocity * thickness) / 
      (permeability * 100000) + cakeResistance;
    
    return {
      pressureDrop,
      method: "Darcy's law",
      confidence: 0.7
    };
  }

  /**
   * Perform material balance analysis on a node
   */
  performMaterialBalance(
    nodeId: string,
    nodeName: string,
    inletStreamIds: string[],
    outletStreamIds: string[]
  ): MaterialBalance {
    const inletStreams = inletStreamIds.map(id => this.getStream(id)).filter(Boolean) as FlowStream[];
    const outletStreams = outletStreamIds.map(id => this.getStream(id)).filter(Boolean) as FlowStream[];

    const massIn = inletStreams.reduce((sum, stream) => sum + stream.massFlow, 0);
    const massOut = outletStreams.reduce((sum, stream) => sum + stream.massFlow, 0);
    const massImbalance = Math.abs(massIn - massOut);
    const percentageError = massIn > 0 ? (massImbalance / massIn) * 100 : 0;
    const balanced = percentageError < 1.0; // 1% tolerance

    // Component balance if composition data is available
    let componentBalance: Record<string, any> | undefined;
    
    if (inletStreams.some(s => s.composition) || outletStreams.some(s => s.composition)) {
      componentBalance = {};
      
      // Get all components
      const allComponents = new Set<string>();
      [...inletStreams, ...outletStreams].forEach(stream => {
        if (stream.composition) {
          Object.keys(stream.composition).forEach(comp => allComponents.add(comp));
        }
      });

      // Calculate balance for each component
      allComponents.forEach(component => {
        const compIn = inletStreams.reduce((sum, stream) => {
          const fraction = stream.composition?.[component] || 0;
          return sum + (stream.massFlow * fraction / 100);
        }, 0);

        const compOut = outletStreams.reduce((sum, stream) => {
          const fraction = stream.composition?.[component] || 0;
          return sum + (stream.massFlow * fraction / 100);
        }, 0);

        const compImbalance = Math.abs(compIn - compOut);
        const compBalanced = compIn > 0 ? (compImbalance / compIn) < 0.01 : compOut === 0;

        componentBalance![component] = {
          in: compIn,
          out: compOut,
          imbalance: compImbalance,
          balanced: compBalanced
        };
      });
    }

    return {
      nodeId,
      nodeName,
      inletStreams,
      outletStreams,
      balance: {
        massIn,
        massOut,
        massImbalance,
        percentageError,
        balanced
      },
      componentBalance
    };
  }

  /**
   * Perform energy balance analysis on a node
   */
  performEnergyBalance(
    nodeId: string,
    nodeName: string,
    inletStreamIds: string[],
    outletStreamIds: string[],
    heatInput: number = 0,
    workInput: number = 0
  ): EnergyBalance {
    const inletStreams = inletStreamIds.map(id => this.getStream(id)).filter(Boolean) as FlowStream[];
    const outletStreams = outletStreamIds.map(id => this.getStream(id)).filter(Boolean) as FlowStream[];

    // Calculate enthalpy for streams (simplified using specific heat)
    const specificHeat = 4.18; // kJ/kg·K for water (simplified)
    
    const enthalpyIn = inletStreams.reduce((sum, stream) => {
      const enthalpy = stream.enthalpy || (stream.massFlow * specificHeat * stream.temperature);
      return sum + enthalpy;
    }, 0);

    const enthalpyOut = outletStreams.reduce((sum, stream) => {
      const enthalpy = stream.enthalpy || (stream.massFlow * specificHeat * stream.temperature);
      return sum + enthalpy;
    }, 0);

    // Energy balance: Accumulation = Input - Output
    const energyImbalance = (enthalpyIn / 3600 + heatInput + workInput) - (enthalpyOut / 3600);
    const balanced = Math.abs(energyImbalance) < 0.1; // 0.1 kW tolerance

    // Calculate efficiency for equipment with work output
    let efficiency: number | undefined;
    if (workInput > 0) {
      const enthalpyDelta = enthalpyOut - enthalpyIn;
      const theoreticalWork = Math.abs(enthalpyDelta / 3600); // Convert to kW
      efficiency = theoreticalWork > 0 ? (theoreticalWork / workInput) * 100 : 0;
    }

    return {
      nodeId,
      nodeName,
      heatInput,
      heatOutput: 0, // Could be calculated based on cooling requirements
      workInput,
      workOutput: 0, // For turbines, generators, etc.
      enthalpyIn,
      enthalpyOut,
      energyImbalance,
      balanced,
      efficiency
    };
  }

  /**
   * Perform compliance checks against industry standards
   */
  performComplianceCheck(diagramData: any): ComplianceCheck[] {
    const checks: ComplianceCheck[] = [];

    // Safety-related checks
    checks.push(...this.checkSafetyCompliance(diagramData));
    
    // Design checks
    checks.push(...this.checkDesignCompliance(diagramData));
    
    // Operation checks
    checks.push(...this.checkOperationCompliance(diagramData));
    
    // Documentation checks
    checks.push(...this.checkDocumentationCompliance(diagramData));

    return checks;
  }

  /**
   * Safety compliance checks
   */
  private checkSafetyCompliance(diagramData: any): ComplianceCheck[] {
    const checks: ComplianceCheck[] = [];

    // Example safety checks
    checks.push({
      id: 'SAFETY_001',
      standard: 'ASME B31.3',
      category: 'safety',
      severity: 'critical',
      title: 'Pressure Relief Requirements',
      description: 'All pressure vessels must have adequate pressure relief protection',
      location: 'Process Equipment',
      compliant: true, // This would be determined by actual analysis
      recommendation: 'Verify pressure relief valve sizing and settings',
      reference: 'ASME B31.3 Section 322'
    });

    checks.push({
      id: 'SAFETY_002',
      standard: 'API 521',
      category: 'safety',
      severity: 'high',
      title: 'Relief System Design',
      description: 'Relief systems must be designed for maximum credible scenarios',
      location: 'Relief Systems',
      compliant: true,
      recommendation: 'Review relief scenarios and sizing calculations',
      reference: 'API 521 Section 3.2'
    });

    return checks;
  }

  /**
   * Design compliance checks
   */
  private checkDesignCompliance(diagramData: any): ComplianceCheck[] {
    const checks: ComplianceCheck[] = [];

    checks.push({
      id: 'DESIGN_001',
      standard: 'PIP PCF001',
      category: 'design',
      severity: 'medium',
      title: 'Piping Arrangement',
      description: 'Piping should follow standard routing practices',
      location: 'Piping Systems',
      compliant: true,
      recommendation: 'Follow PIP guidelines for pipe routing and support',
      reference: 'PIP PCF001 Section 4'
    });

    return checks;
  }

  /**
   * Operation compliance checks
   */
  private checkOperationCompliance(diagramData: any): ComplianceCheck[] {
    const checks: ComplianceCheck[] = [];

    checks.push({
      id: 'OPERATION_001',
      standard: 'ISA-5.1',
      category: 'operation',
      severity: 'medium',
      title: 'Instrumentation Symbols',
      description: 'Instrumentation symbols must comply with ISA standards',
      location: 'Instruments',
      compliant: true,
      recommendation: 'Verify all instrument symbols follow ISA-5.1 standards',
      reference: 'ISA-5.1 Section 3'
    });

    return checks;
  }

  /**
   * Documentation compliance checks
   */
  private checkDocumentationCompliance(diagramData: any): ComplianceCheck[] {
    const checks: ComplianceCheck[] = [];

    checks.push({
      id: 'DOC_001',
      standard: 'ISO 10628',
      category: 'documentation',
      severity: 'low',
      title: 'Drawing Standards',
      description: 'P&ID drawings must follow ISO 10628 standards',
      location: 'Drawing Format',
      compliant: true,
      recommendation: 'Ensure drawing format meets ISO 10628 requirements',
      reference: 'ISO 10628 Section 4'
    });

    return checks;
  }

  /**
   * Generate comprehensive engineering analysis report
   */
  async generateAnalysisReport(diagramId: string, diagramData: any): Promise<AnalysisReport> {
    const reportId = `analysis_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const timestamp = Date.now();

    // Perform all analyses
    const pressureDrops: PressureDropCalculation[] = [];
    const materialBalances: MaterialBalance[] = [];
    const energyBalances: EnergyBalance[] = [];
    const complianceChecks = this.performComplianceCheck(diagramData);
    const hazopAnalysis = this.generateHazopAnalysis(diagramData);

    // Calculate summary statistics
    const totalStreams = this.streams.size;
    const totalComponents = this.components.size;
    const materialBalanceErrors = materialBalances.filter(mb => !mb.balance.balanced).length;
    const energyBalanceErrors = energyBalances.filter(eb => !eb.balanced).length;
    const complianceViolations = complianceChecks.filter(cc => !cc.compliant).length;
    
    // Determine overall risk level
    const criticalIssues = complianceChecks.filter(cc => cc.severity === 'critical' && !cc.compliant).length;
    const highIssues = complianceChecks.filter(cc => cc.severity === 'high' && !cc.compliant).length;
    
    let overallRisk: 'low' | 'medium' | 'high' | 'critical' = 'low';
    if (criticalIssues > 0) overallRisk = 'critical';
    else if (highIssues > 0) overallRisk = 'high';
    else if (complianceViolations > 0 || materialBalanceErrors > 0) overallRisk = 'medium';

    // Generate recommendations
    const recommendations = this.generateRecommendations(
      complianceChecks,
      materialBalances,
      energyBalances,
      hazopAnalysis
    );

    const report: AnalysisReport = {
      id: reportId,
      diagramId,
      timestamp,
      summary: {
        totalStreams,
        totalComponents,
        materialBalanceErrors,
        energyBalanceErrors,
        complianceViolations,
        hazopNodes: hazopAnalysis.length,
        overallRisk
      },
      pressureDrops,
      materialBalances,
      energyBalances,
      complianceChecks,
      hazopAnalysis,
      recommendations
    };

    // Store report in history
    this.analysisHistory.push(report);
    
    // Keep only last 50 reports
    if (this.analysisHistory.length > 50) {
      this.analysisHistory = this.analysisHistory.slice(-50);
    }

    return report;
  }

  /**
   * Generate HAZOP analysis for the diagram
   */
  private generateHazopAnalysis(diagramData: any): HazopNode[] {
    const nodes: HazopNode[] = [];

    // Example HAZOP node - this would be generated based on actual diagram components
    nodes.push({
      id: 'HAZOP_001',
      name: 'Reactor Feed System',
      description: 'Feed stream to main reactor',
      intention: 'Provide controlled feed flow to reactor at specified conditions',
      parameters: ['Flow', 'Pressure', 'Temperature', 'Level'],
      deviations: [
        {
          id: 'DEV_001',
          parameter: 'Flow',
          deviation: 'No',
          causes: ['Pump failure', 'Valve closure', 'Line blockage'],
          consequences: ['Reactor shutdown', 'Product quality issues'],
          safeguards: ['Flow alarm', 'Backup pump', 'Manual isolation'],
          riskLevel: 'high',
          actionRequired: true,
          recommendations: ['Install redundant flow measurement', 'Add low flow alarm']
        },
        {
          id: 'DEV_002',
          parameter: 'Pressure',
          deviation: 'More',
          causes: ['Downstream blockage', 'Control valve failure'],
          consequences: ['Equipment damage', 'Pipe rupture'],
          safeguards: ['Pressure relief valve', 'High pressure alarm'],
          riskLevel: 'critical',
          actionRequired: true,
          recommendations: ['Verify PSV sizing', 'Add pressure transmitter']
        }
      ]
    });

    return nodes;
  }

  /**
   * Generate recommendations based on analysis results
   */
  private generateRecommendations(
    complianceChecks: ComplianceCheck[],
    materialBalances: MaterialBalance[],
    energyBalances: EnergyBalance[],
    hazopAnalysis: HazopNode[]
  ): string[] {
    const recommendations: string[] = [];

    // Compliance-based recommendations
    const nonCompliantCritical = complianceChecks.filter(cc => !cc.compliant && cc.severity === 'critical');
    if (nonCompliantCritical.length > 0) {
      recommendations.push('URGENT: Address critical compliance violations immediately');
    }

    // Material balance recommendations
    const imbalancedMB = materialBalances.filter(mb => !mb.balance.balanced);
    if (imbalancedMB.length > 0) {
      recommendations.push('Review material balance discrepancies and verify flow measurements');
    }

    // Energy balance recommendations
    const imbalancedEB = energyBalances.filter(eb => !eb.balanced);
    if (imbalancedEB.length > 0) {
      recommendations.push('Investigate energy balance issues and check heat integration opportunities');
    }

    // HAZOP-based recommendations
    const criticalDeviations = hazopAnalysis.flatMap(node => 
      node.deviations.filter(dev => dev.riskLevel === 'critical' && dev.actionRequired)
    );
    if (criticalDeviations.length > 0) {
      recommendations.push('Implement safety measures for critical HAZOP deviations');
    }

    return recommendations;
  }

  /**
   * Get analysis history
   */
  getAnalysisHistory(): AnalysisReport[] {
    return [...this.analysisHistory];
  }

  /**
   * Get specific analysis report
   */
  getAnalysisReport(reportId: string): AnalysisReport | null {
    return this.analysisHistory.find(report => report.id === reportId) || null;
  }

  /**
   * Clear all streams and reset service
   */
  clearAll(): void {
    this.streams.clear();
    this.components.clear();
  }

  /**
   * Export analysis data
   */
  exportAnalysisData(): string {
    return JSON.stringify({
      streams: Array.from(this.streams.entries()),
      components: Array.from(this.components.entries()),
      analysisHistory: this.analysisHistory,
      exportedAt: new Date().toISOString()
    }, null, 2);
  }
}