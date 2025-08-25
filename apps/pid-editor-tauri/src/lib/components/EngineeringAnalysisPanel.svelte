<!--
  Engineering Analysis Panel Component
  
  Provides comprehensive engineering analysis capabilities including:
  - Stream property definition and management
  - Pressure drop calculations
  - Material and energy balance analysis
  - Compliance checking against industry standards
  - HAZOP analysis and risk assessment
  - Analysis report generation and export
-->

<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import { fade, slide } from 'svelte/transition';
  import { writable } from 'svelte/store';
  import { 
    EngineeringAnalysisService, 
    type FlowStream, 
    type AnalysisReport, 
    type ComplianceCheck,
    type MaterialBalance,
    type EnergyBalance,
    type HazopNode
  } from '$lib/services/EngineeringAnalysis';

  export let isOpen = false;
  export let diagramId = '';

  const dispatch = createEventDispatcher<{
    close: void;
    streamSelected: string;
    componentHighlight: string;
  }>();

  let analysisService = EngineeringAnalysisService.getInstance();
  let activeTab: 'streams' | 'analysis' | 'reports' | 'hazop' | 'compliance' = 'streams';
  let currentReport: AnalysisReport | null = null;
  let loading = false;

  // Stream management
  let streams = writable<FlowStream[]>([]);
  let selectedStreamId: string | null = null;
  let showStreamEditor = false;

  // New stream form
  let newStream: Partial<FlowStream> = {
    id: '',
    name: '',
    fluid: 'Water',
    temperature: 25,
    pressure: 1,
    massFlow: 0,
    volumeFlow: 0,
    density: 1000,
    viscosity: 1,
    phase: 'liquid'
  };

  // Analysis results
  let materialBalances: MaterialBalance[] = [];
  let energyBalances: EnergyBalance[] = [];
  let complianceChecks: ComplianceCheck[] = [];
  let hazopNodes: HazopNode[] = [];

  // Filter and search
  let streamSearch = '';
  let complianceFilter = 'all';
  let hazopRiskFilter = 'all';

  $: filteredStreams = $streams.filter(stream => 
    stream.name.toLowerCase().includes(streamSearch.toLowerCase()) ||
    stream.id.toLowerCase().includes(streamSearch.toLowerCase()) ||
    stream.fluid.toLowerCase().includes(streamSearch.toLowerCase())
  );

  $: filteredCompliance = complianceChecks.filter(check => {
    if (complianceFilter === 'all') return true;
    if (complianceFilter === 'non-compliant') return !check.compliant;
    return check.severity === complianceFilter;
  });

  $: filteredHazop = hazopNodes.filter(node => {
    if (hazopRiskFilter === 'all') return true;
    return node.deviations.some(dev => dev.riskLevel === hazopRiskFilter);
  });

  onMount(() => {
    loadStreams();
  });

  function loadStreams() {
    const allStreams = analysisService.getAllStreams();
    streams.set(allStreams);
  }

  function addStream() {
    if (!newStream.id || !newStream.name) {
      alert('Stream ID and name are required');
      return;
    }

    try {
      analysisService.defineStream(newStream as FlowStream);
      loadStreams();
      resetStreamForm();
      showStreamEditor = false;
    } catch (error) {
      console.error('Failed to add stream:', error);
      alert('Failed to add stream. Please check the input values.');
    }
  }

  function resetStreamForm() {
    newStream = {
      id: '',
      name: '',
      fluid: 'Water',
      temperature: 25,
      pressure: 1,
      massFlow: 0,
      volumeFlow: 0,
      density: 1000,
      viscosity: 1,
      phase: 'liquid'
    };
  }

  function editStream(stream: FlowStream) {
    newStream = { ...stream };
    selectedStreamId = stream.id;
    showStreamEditor = true;
  }

  function deleteStream(streamId: string) {
    if (confirm('Are you sure you want to delete this stream?')) {
      // Note: This would require implementing a deleteStream method in the service
      loadStreams();
    }
  }

  async function runAnalysis() {
    loading = true;
    try {
      // For demo purposes, we'll create some mock diagram data
      const mockDiagramData = {
        components: [],
        connections: [],
        streams: $streams
      };

      currentReport = await analysisService.generateAnalysisReport(diagramId, mockDiagramData);
      
      // Update local data with report results
      materialBalances = currentReport.materialBalances;
      energyBalances = currentReport.energyBalances;
      complianceChecks = currentReport.complianceChecks;
      hazopNodes = currentReport.hazopAnalysis;

      activeTab = 'reports';
    } catch (error) {
      console.error('Analysis failed:', error);
      alert('Analysis failed. Please check the console for details.');
    } finally {
      loading = false;
    }
  }

  function exportReport() {
    if (!currentReport) return;

    const dataStr = JSON.stringify(currentReport, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = `analysis_report_${new Date().toISOString().slice(0, 10)}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  }

  function getSeverityColor(severity: string): string {
    switch (severity) {
      case 'critical': return '#dc2626';
      case 'high': return '#ea580c';
      case 'medium': return '#d97706';
      case 'low': return '#65a30d';
      default: return '#6b7280';
    }
  }

  function getRiskColor(risk: string): string {
    switch (risk) {
      case 'critical': return '#dc2626';
      case 'high': return '#ea580c';
      case 'medium': return '#d97706';
      case 'low': return '#16a34a';
      default: return '#6b7280';
    }
  }

  function highlightComponent(componentId: string) {
    dispatch('componentHighlight', componentId);
  }
</script>

{#if isOpen}
  <div class="analysis-panel" transition:fade={{ duration: 200 }}>
    <div class="panel-header">
      <h2>Engineering Analysis</h2>
      <button class="close-button" on:click={() => dispatch('close')}>
        <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
        </svg>
      </button>
    </div>

    <div class="panel-content">
      <!-- Tab Navigation -->
      <div class="tab-navigation">
        <button 
          class="tab-button" 
          class:active={activeTab === 'streams'}
          on:click={() => activeTab = 'streams'}
        >
          Streams ({$streams.length})
        </button>
        <button 
          class="tab-button" 
          class:active={activeTab === 'analysis'}
          on:click={() => activeTab = 'analysis'}
        >
          Analysis
        </button>
        <button 
          class="tab-button" 
          class:active={activeTab === 'reports'}
          on:click={() => activeTab = 'reports'}
        >
          Reports
        </button>
        <button 
          class="tab-button" 
          class:active={activeTab === 'hazop'}
          on:click={() => activeTab = 'hazop'}
        >
          HAZOP
        </button>
        <button 
          class="tab-button" 
          class:active={activeTab === 'compliance'}
          on:click={() => activeTab = 'compliance'}
        >
          Compliance
        </button>
      </div>

      <!-- Streams Tab -->
      {#if activeTab === 'streams'}
        <div class="tab-content" transition:slide={{ duration: 200 }}>
          <div class="streams-header">
            <div class="search-controls">
              <input
                type="text"
                placeholder="Search streams..."
                bind:value={streamSearch}
                class="search-input"
              />
            </div>
            <button class="add-button" on:click={() => showStreamEditor = true}>
              Add Stream
            </button>
          </div>

          {#if showStreamEditor}
            <div class="stream-editor" transition:slide={{ duration: 200 }}>
              <h3>{selectedStreamId ? 'Edit Stream' : 'New Stream'}</h3>
              <div class="form-grid">
                <div class="form-group">
                  <label>Stream ID*</label>
                  <input type="text" bind:value={newStream.id} placeholder="S-001" />
                </div>
                <div class="form-group">
                  <label>Name*</label>
                  <input type="text" bind:value={newStream.name} placeholder="Reactor Feed" />
                </div>
                <div class="form-group">
                  <label>Fluid</label>
                  <select bind:value={newStream.fluid}>
                    <option value="Water">Water</option>
                    <option value="Steam">Steam</option>
                    <option value="Air">Air</option>
                    <option value="Nitrogen">Nitrogen</option>
                    <option value="Natural Gas">Natural Gas</option>
                    <option value="Oil">Oil</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div class="form-group">
                  <label>Phase</label>
                  <select bind:value={newStream.phase}>
                    <option value="liquid">Liquid</option>
                    <option value="gas">Gas</option>
                    <option value="vapor">Vapor</option>
                    <option value="mixed">Mixed</option>
                  </select>
                </div>
                <div class="form-group">
                  <label>Temperature (°C)</label>
                  <input type="number" bind:value={newStream.temperature} step="0.1" />
                </div>
                <div class="form-group">
                  <label>Pressure (bar)</label>
                  <input type="number" bind:value={newStream.pressure} step="0.1" min="0" />
                </div>
                <div class="form-group">
                  <label>Mass Flow (kg/h)</label>
                  <input type="number" bind:value={newStream.massFlow} step="0.1" min="0" />
                </div>
                <div class="form-group">
                  <label>Density (kg/m³)</label>
                  <input type="number" bind:value={newStream.density} step="0.1" min="0" />
                </div>
                <div class="form-group">
                  <label>Viscosity (cP)</label>
                  <input type="number" bind:value={newStream.viscosity} step="0.01" min="0" />
                </div>
              </div>
              <div class="form-actions">
                <button class="save-button" on:click={addStream}>
                  {selectedStreamId ? 'Update' : 'Add'} Stream
                </button>
                <button class="cancel-button" on:click={() => { showStreamEditor = false; resetStreamForm(); }}>
                  Cancel
                </button>
              </div>
            </div>
          {/if}

          <div class="streams-list">
            {#each filteredStreams as stream (stream.id)}
              <div class="stream-card" transition:fade={{ duration: 150 }}>
                <div class="stream-header">
                  <h4>{stream.name} ({stream.id})</h4>
                  <div class="stream-actions">
                    <button class="edit-button" on:click={() => editStream(stream)}>Edit</button>
                    <button class="delete-button" on:click={() => deleteStream(stream.id)}>Delete</button>
                  </div>
                </div>
                <div class="stream-properties">
                  <div class="property">
                    <span class="property-label">Fluid:</span>
                    <span class="property-value">{stream.fluid}</span>
                  </div>
                  <div class="property">
                    <span class="property-label">Phase:</span>
                    <span class="property-value phase-{stream.phase}">{stream.phase}</span>
                  </div>
                  <div class="property">
                    <span class="property-label">Temperature:</span>
                    <span class="property-value">{stream.temperature}°C</span>
                  </div>
                  <div class="property">
                    <span class="property-label">Pressure:</span>
                    <span class="property-value">{stream.pressure} bar</span>
                  </div>
                  <div class="property">
                    <span class="property-label">Mass Flow:</span>
                    <span class="property-value">{stream.massFlow} kg/h</span>
                  </div>
                </div>
              </div>
            {/each}
          </div>
        </div>
      {/if}

      <!-- Analysis Tab -->
      {#if activeTab === 'analysis'}
        <div class="tab-content" transition:slide={{ duration: 200 }}>
          <div class="analysis-controls">
            <button 
              class="run-analysis-button" 
              on:click={runAnalysis}
              disabled={loading || $streams.length === 0}
            >
              {#if loading}
                Running Analysis...
              {:else}
                Run Complete Analysis
              {/if}
            </button>
          </div>

          {#if loading}
            <div class="loading-indicator">
              <div class="loading-spinner"></div>
              <p>Performing engineering analysis...</p>
            </div>
          {/if}

          {#if currentReport}
            <div class="analysis-summary">
              <h3>Analysis Summary</h3>
              <div class="summary-grid">
                <div class="summary-item">
                  <span class="summary-label">Total Streams:</span>
                  <span class="summary-value">{currentReport.summary.totalStreams}</span>
                </div>
                <div class="summary-item">
                  <span class="summary-label">Components:</span>
                  <span class="summary-value">{currentReport.summary.totalComponents}</span>
                </div>
                <div class="summary-item">
                  <span class="summary-label">Balance Errors:</span>
                  <span class="summary-value error">{currentReport.summary.materialBalanceErrors}</span>
                </div>
                <div class="summary-item">
                  <span class="summary-label">Compliance Issues:</span>
                  <span class="summary-value error">{currentReport.summary.complianceViolations}</span>
                </div>
                <div class="summary-item">
                  <span class="summary-label">Overall Risk:</span>
                  <span class="summary-value risk risk-{currentReport.summary.overallRisk}">
                    {currentReport.summary.overallRisk.toUpperCase()}
                  </span>
                </div>
              </div>
            </div>
          {/if}
        </div>
      {/if}

      <!-- Reports Tab -->
      {#if activeTab === 'reports'}
        <div class="tab-content" transition:slide={{ duration: 200 }}>
          {#if currentReport}
            <div class="report-header">
              <h3>Analysis Report</h3>
              <button class="export-button" on:click={exportReport}>Export Report</button>
            </div>
            
            <div class="report-content">
              <div class="report-section">
                <h4>Recommendations</h4>
                {#each currentReport.recommendations as recommendation}
                  <div class="recommendation-item">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" class="recommendation-icon">
                      <path fill-rule="evenodd" d="M8 1.314C12.438-3.248 23.534 4.735 8 15-7.534 4.736 3.562-3.248 8 1.314z" />
                    </svg>
                    {recommendation}
                  </div>
                {/each}
              </div>

              {#if materialBalances.length > 0}
                <div class="report-section">
                  <h4>Material Balances</h4>
                  {#each materialBalances as balance}
                    <div class="balance-item">
                      <div class="balance-header">
                        <span class="balance-name">{balance.nodeName}</span>
                        <span class="balance-status" class:balanced={balance.balance.balanced}>
                          {balance.balance.balanced ? 'Balanced' : 'Imbalanced'}
                        </span>
                      </div>
                      {#if !balance.balance.balanced}
                        <div class="balance-details">
                          <span>Error: {balance.balance.percentageError.toFixed(2)}%</span>
                        </div>
                      {/if}
                    </div>
                  {/each}
                </div>
              {/if}
            </div>
          {:else}
            <div class="no-report">
              <p>No analysis report available. Run an analysis first.</p>
              <button class="run-analysis-link" on:click={() => activeTab = 'analysis'}>
                Go to Analysis
              </button>
            </div>
          {/if}
        </div>
      {/if}

      <!-- HAZOP Tab -->
      {#if activeTab === 'hazop'}
        <div class="tab-content" transition:slide={{ duration: 200 }}>
          <div class="hazop-controls">
            <select bind:value={hazopRiskFilter}>
              <option value="all">All Risk Levels</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>

          <div class="hazop-nodes">
            {#each filteredHazop as node (node.id)}
              <div class="hazop-node" transition:fade={{ duration: 150 }}>
                <div class="node-header">
                  <h4>{node.name}</h4>
                  <p class="node-description">{node.description}</p>
                </div>
                <div class="node-intention">
                  <strong>Intention:</strong> {node.intention}
                </div>
                <div class="deviations">
                  <h5>Deviations</h5>
                  {#each node.deviations as deviation}
                    <div class="deviation-item">
                      <div class="deviation-header">
                        <span class="deviation-param">{deviation.parameter}</span>
                        <span class="deviation-type">{deviation.deviation}</span>
                        <span 
                          class="risk-badge" 
                          style="background-color: {getRiskColor(deviation.riskLevel)}"
                        >
                          {deviation.riskLevel}
                        </span>
                      </div>
                      <div class="deviation-details">
                        <div class="detail-section">
                          <strong>Causes:</strong>
                          <ul>
                            {#each deviation.causes as cause}
                              <li>{cause}</li>
                            {/each}
                          </ul>
                        </div>
                        <div class="detail-section">
                          <strong>Consequences:</strong>
                          <ul>
                            {#each deviation.consequences as consequence}
                              <li>{consequence}</li>
                            {/each}
                          </ul>
                        </div>
                        {#if deviation.recommendations.length > 0}
                          <div class="detail-section">
                            <strong>Recommendations:</strong>
                            <ul>
                              {#each deviation.recommendations as rec}
                                <li>{rec}</li>
                              {/each}
                            </ul>
                          </div>
                        {/if}
                      </div>
                    </div>
                  {/each}
                </div>
              </div>
            {/each}
          </div>
        </div>
      {/if}

      <!-- Compliance Tab -->
      {#if activeTab === 'compliance'}
        <div class="tab-content" transition:slide={{ duration: 200 }}>
          <div class="compliance-controls">
            <select bind:value={complianceFilter}>
              <option value="all">All Checks</option>
              <option value="non-compliant">Non-Compliant Only</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>

          <div class="compliance-checks">
            {#each filteredCompliance as check (check.id)}
              <div 
                class="compliance-item" 
                class:non-compliant={!check.compliant}
                transition:fade={{ duration: 150 }}
              >
                <div class="compliance-header">
                  <div class="compliance-title">
                    <h4>{check.title}</h4>
                    <span class="standard-badge">{check.standard}</span>
                  </div>
                  <div class="compliance-status">
                    <span 
                      class="severity-badge" 
                      style="background-color: {getSeverityColor(check.severity)}"
                    >
                      {check.severity}
                    </span>
                    <span class="compliance-result" class:compliant={check.compliant}>
                      {check.compliant ? 'Compliant' : 'Non-Compliant'}
                    </span>
                  </div>
                </div>
                <p class="compliance-description">{check.description}</p>
                {#if !check.compliant}
                  <div class="compliance-recommendation">
                    <strong>Recommendation:</strong> {check.recommendation}
                  </div>
                {/if}
                <div class="compliance-reference">
                  <small>Reference: {check.reference}</small>
                </div>
              </div>
            {/each}
          </div>
        </div>
      {/if}
    </div>
  </div>
{/if}

<style>
  .analysis-panel {
    position: fixed;
    top: 0;
    right: 0;
    width: 600px;
    height: 100vh;
    background: white;
    border-left: 1px solid #e5e7eb;
    box-shadow: -4px 0 20px rgba(0, 0, 0, 0.1);
    z-index: 1000;
    display: flex;
    flex-direction: column;
  }

  .panel-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1rem 1.5rem;
    border-bottom: 1px solid #e5e7eb;
  }

  .panel-header h2 {
    margin: 0;
    font-size: 1.25rem;
    font-weight: 600;
  }

  .close-button {
    background: none;
    border: none;
    color: #6b7280;
    cursor: pointer;
    padding: 0.5rem;
    border-radius: 0.375rem;
    transition: all 0.2s;
  }

  .close-button:hover {
    background: #f3f4f6;
    color: #374151;
  }

  .panel-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .tab-navigation {
    display: flex;
    border-bottom: 1px solid #e5e7eb;
    background: #f9fafb;
  }

  .tab-button {
    flex: 1;
    padding: 0.75rem 1rem;
    background: none;
    border: none;
    color: #6b7280;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    border-bottom: 2px solid transparent;
    transition: all 0.2s;
  }

  .tab-button:hover {
    color: #374151;
    background: #f3f4f6;
  }

  .tab-button.active {
    color: #2563eb;
    border-bottom-color: #2563eb;
    background: white;
  }

  .tab-content {
    flex: 1;
    padding: 1rem;
    overflow-y: auto;
  }

  .streams-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
  }

  .search-input {
    width: 250px;
    padding: 0.5rem 0.75rem;
    border: 1px solid #d1d5db;
    border-radius: 0.375rem;
    font-size: 0.875rem;
  }

  .add-button {
    padding: 0.5rem 1rem;
    background: #2563eb;
    color: white;
    border: none;
    border-radius: 0.375rem;
    cursor: pointer;
    font-size: 0.875rem;
    font-weight: 500;
    transition: background 0.2s;
  }

  .add-button:hover {
    background: #1d4ed8;
  }

  .stream-editor {
    background: #f9fafb;
    border: 1px solid #e5e7eb;
    border-radius: 0.5rem;
    padding: 1rem;
    margin-bottom: 1rem;
  }

  .stream-editor h3 {
    margin: 0 0 1rem 0;
    font-size: 1.125rem;
    font-weight: 600;
  }

  .form-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 1rem;
  }

  .form-group {
    display: flex;
    flex-direction: column;
  }

  .form-group label {
    font-size: 0.875rem;
    font-weight: 500;
    margin-bottom: 0.25rem;
    color: #374151;
  }

  .form-group input,
  .form-group select {
    padding: 0.5rem;
    border: 1px solid #d1d5db;
    border-radius: 0.375rem;
    font-size: 0.875rem;
  }

  .form-actions {
    display: flex;
    gap: 0.5rem;
    margin-top: 1rem;
  }

  .save-button {
    padding: 0.5rem 1rem;
    background: #10b981;
    color: white;
    border: none;
    border-radius: 0.375rem;
    cursor: pointer;
    font-size: 0.875rem;
    font-weight: 500;
  }

  .cancel-button {
    padding: 0.5rem 1rem;
    background: #6b7280;
    color: white;
    border: none;
    border-radius: 0.375rem;
    cursor: pointer;
    font-size: 0.875rem;
    font-weight: 500;
  }

  .streams-list {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .stream-card {
    background: white;
    border: 1px solid #e5e7eb;
    border-radius: 0.5rem;
    padding: 1rem;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  }

  .stream-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.75rem;
  }

  .stream-header h4 {
    margin: 0;
    font-size: 1rem;
    font-weight: 600;
  }

  .stream-actions {
    display: flex;
    gap: 0.5rem;
  }

  .edit-button {
    padding: 0.25rem 0.5rem;
    background: #2563eb;
    color: white;
    border: none;
    border-radius: 0.25rem;
    cursor: pointer;
    font-size: 0.75rem;
  }

  .delete-button {
    padding: 0.25rem 0.5rem;
    background: #dc2626;
    color: white;
    border: none;
    border-radius: 0.25rem;
    cursor: pointer;
    font-size: 0.75rem;
  }

  .stream-properties {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 0.5rem;
  }

  .property {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.25rem 0;
    border-bottom: 1px solid #f3f4f6;
  }

  .property-label {
    font-size: 0.875rem;
    color: #6b7280;
    font-weight: 500;
  }

  .property-value {
    font-size: 0.875rem;
    color: #111827;
    font-weight: 600;
  }

  .phase-liquid { color: #2563eb; }
  .phase-gas { color: #dc2626; }
  .phase-vapor { color: #7c3aed; }
  .phase-mixed { color: #d97706; }

  .analysis-controls {
    margin-bottom: 1rem;
  }

  .run-analysis-button {
    padding: 0.75rem 1.5rem;
    background: #10b981;
    color: white;
    border: none;
    border-radius: 0.375rem;
    cursor: pointer;
    font-size: 1rem;
    font-weight: 600;
    transition: background 0.2s;
  }

  .run-analysis-button:hover:not(:disabled) {
    background: #059669;
  }

  .run-analysis-button:disabled {
    background: #d1d5db;
    cursor: not-allowed;
  }

  .loading-indicator {
    text-align: center;
    padding: 2rem;
  }

  .loading-spinner {
    width: 40px;
    height: 40px;
    border: 3px solid #e5e7eb;
    border-top: 3px solid #2563eb;
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin: 0 auto 1rem;
  }

  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }

  .analysis-summary {
    background: #f9fafb;
    border: 1px solid #e5e7eb;
    border-radius: 0.5rem;
    padding: 1rem;
    margin-top: 1rem;
  }

  .analysis-summary h3 {
    margin: 0 0 1rem 0;
    font-size: 1.125rem;
    font-weight: 600;
  }

  .summary-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 0.75rem;
  }

  .summary-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .summary-label {
    font-size: 0.875rem;
    color: #6b7280;
  }

  .summary-value {
    font-size: 0.875rem;
    font-weight: 600;
  }

  .summary-value.error {
    color: #dc2626;
  }

  .risk-low { color: #16a34a; }
  .risk-medium { color: #d97706; }
  .risk-high { color: #ea580c; }
  .risk-critical { color: #dc2626; }

  .report-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
  }

  .export-button {
    padding: 0.5rem 1rem;
    background: #2563eb;
    color: white;
    border: none;
    border-radius: 0.375rem;
    cursor: pointer;
    font-size: 0.875rem;
  }

  .report-content {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .report-section h4 {
    margin: 0 0 0.75rem 0;
    font-size: 1rem;
    font-weight: 600;
    color: #111827;
  }

  .recommendation-item {
    display: flex;
    align-items: flex-start;
    gap: 0.5rem;
    padding: 0.75rem;
    background: #fef3c7;
    border: 1px solid #f59e0b;
    border-radius: 0.375rem;
    margin-bottom: 0.5rem;
    font-size: 0.875rem;
  }

  .recommendation-icon {
    color: #d97706;
    flex-shrink: 0;
    margin-top: 0.125rem;
  }

  .balance-item {
    padding: 0.75rem;
    border: 1px solid #e5e7eb;
    border-radius: 0.375rem;
    margin-bottom: 0.5rem;
  }

  .balance-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.25rem;
  }

  .balance-name {
    font-weight: 600;
  }

  .balance-status {
    font-size: 0.75rem;
    padding: 0.25rem 0.5rem;
    border-radius: 0.25rem;
    color: white;
    background: #dc2626;
  }

  .balance-status.balanced {
    background: #16a34a;
  }

  .hazop-controls,
  .compliance-controls {
    margin-bottom: 1rem;
  }

  .hazop-controls select,
  .compliance-controls select {
    padding: 0.5rem;
    border: 1px solid #d1d5db;
    border-radius: 0.375rem;
    background: white;
  }

  .hazop-node {
    background: white;
    border: 1px solid #e5e7eb;
    border-radius: 0.5rem;
    padding: 1rem;
    margin-bottom: 1rem;
  }

  .node-header h4 {
    margin: 0 0 0.5rem 0;
    font-size: 1.125rem;
    font-weight: 600;
  }

  .node-description {
    color: #6b7280;
    margin: 0 0 0.75rem 0;
    font-size: 0.875rem;
  }

  .node-intention {
    background: #f0f9ff;
    border: 1px solid #0ea5e9;
    border-radius: 0.375rem;
    padding: 0.75rem;
    margin-bottom: 1rem;
    font-size: 0.875rem;
  }

  .deviations h5 {
    margin: 0 0 0.75rem 0;
    font-size: 1rem;
    font-weight: 600;
  }

  .deviation-item {
    background: #f9fafb;
    border: 1px solid #e5e7eb;
    border-radius: 0.375rem;
    padding: 0.75rem;
    margin-bottom: 0.75rem;
  }

  .deviation-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.75rem;
  }

  .deviation-param,
  .deviation-type {
    font-weight: 600;
    font-size: 0.875rem;
  }

  .risk-badge {
    font-size: 0.75rem;
    color: white;
    padding: 0.25rem 0.5rem;
    border-radius: 0.25rem;
    text-transform: uppercase;
    font-weight: 600;
  }

  .deviation-details {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .detail-section {
    font-size: 0.875rem;
  }

  .detail-section strong {
    color: #374151;
  }

  .detail-section ul {
    margin: 0.25rem 0 0 1rem;
    padding: 0;
  }

  .detail-section li {
    margin-bottom: 0.25rem;
    color: #6b7280;
  }

  .compliance-item {
    background: white;
    border: 1px solid #e5e7eb;
    border-radius: 0.5rem;
    padding: 1rem;
    margin-bottom: 1rem;
  }

  .compliance-item.non-compliant {
    border-color: #fca5a5;
    background: #fef2f2;
  }

  .compliance-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 0.75rem;
  }

  .compliance-title {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .compliance-title h4 {
    margin: 0;
    font-size: 1rem;
    font-weight: 600;
  }

  .standard-badge {
    font-size: 0.75rem;
    color: #6b7280;
    background: #f3f4f6;
    padding: 0.25rem 0.5rem;
    border-radius: 0.25rem;
  }

  .compliance-status {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 0.25rem;
  }

  .severity-badge {
    font-size: 0.75rem;
    color: white;
    padding: 0.25rem 0.5rem;
    border-radius: 0.25rem;
    text-transform: uppercase;
    font-weight: 600;
  }

  .compliance-result {
    font-size: 0.75rem;
    padding: 0.25rem 0.5rem;
    border-radius: 0.25rem;
    color: white;
    background: #dc2626;
  }

  .compliance-result.compliant {
    background: #16a34a;
  }

  .compliance-description {
    color: #6b7280;
    margin: 0 0 0.75rem 0;
    font-size: 0.875rem;
  }

  .compliance-recommendation {
    background: #fef3c7;
    border: 1px solid #f59e0b;
    border-radius: 0.375rem;
    padding: 0.75rem;
    margin-bottom: 0.5rem;
    font-size: 0.875rem;
  }

  .compliance-reference {
    color: #9ca3af;
    font-size: 0.75rem;
  }

  .no-report {
    text-align: center;
    padding: 2rem;
    color: #6b7280;
  }

  .run-analysis-link {
    padding: 0.5rem 1rem;
    background: #2563eb;
    color: white;
    border: none;
    border-radius: 0.375rem;
    cursor: pointer;
    margin-top: 1rem;
  }
</style>