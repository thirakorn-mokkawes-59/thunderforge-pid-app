<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { performanceMonitor, type PerformanceMetrics, type PerformanceAlert } from '$lib/services/PerformanceMonitor';
  import { metricsCollector, type SessionMetrics } from '$lib/services/MetricsCollector';

  // Props
  export let visible: boolean = false;
  export let position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' = 'top-right';
  export let compact: boolean = false;

  // State
  let currentMetrics: PerformanceMetrics = {
    fps: 0,
    memoryUsage: 0,
    renderTime: 0,
    elementCount: 0,
    cacheHitRate: 0,
    cpuUsage: 0
  };
  
  let alerts: PerformanceAlert[] = [];
  let sessionMetrics: SessionMetrics | null = null;
  let updateInterval: number;
  let showDetailedView = false;
  let selectedTab: 'performance' | 'usage' | 'alerts' = 'performance';

  // Performance history for charts
  let performanceHistory: Array<{ timestamp: number; metrics: PerformanceMetrics }> = [];
  const maxHistoryPoints = 60; // 1 minute of data

  onMount(() => {
    // Update metrics every second
    updateInterval = setInterval(updateMetrics, 1000);
    
    // Listen for performance alerts
    window.addEventListener('performance-alert', handlePerformanceAlert);
    
    // Initial update
    updateMetrics();
  });

  onDestroy(() => {
    if (updateInterval) {
      clearInterval(updateInterval);
    }
    window.removeEventListener('performance-alert', handlePerformanceAlert);
  });

  function updateMetrics() {
    currentMetrics = performanceMonitor.getCurrentMetrics();
    alerts = performanceMonitor.getAlerts();
    sessionMetrics = metricsCollector.getCurrentSession();
    
    // Add to history
    performanceHistory.push({
      timestamp: Date.now(),
      metrics: { ...currentMetrics }
    });
    
    // Trim history
    if (performanceHistory.length > maxHistoryPoints) {
      performanceHistory = performanceHistory.slice(-maxHistoryPoints);
    }
  }

  function handlePerformanceAlert(event: CustomEvent<PerformanceAlert>) {
    alerts = performanceMonitor.getAlerts();
  }

  function getMetricColor(metric: keyof PerformanceMetrics, value: number): string {
    const thresholds = {
      fps: { warning: 30, critical: 15, invert: true },
      memoryUsage: { warning: 100, critical: 200, invert: false },
      renderTime: { warning: 16, critical: 33, invert: false },
      elementCount: { warning: 1000, critical: 5000, invert: false },
      cacheHitRate: { warning: 0.7, critical: 0.5, invert: true },
      cpuUsage: { warning: 70, critical: 90, invert: false }
    };

    const threshold = thresholds[metric];
    if (!threshold) return 'text-gray-600';

    if (threshold.invert) {
      // Lower values are worse
      if (value <= threshold.critical) return 'text-red-500';
      if (value <= threshold.warning) return 'text-yellow-500';
      return 'text-green-500';
    } else {
      // Higher values are worse
      if (value >= threshold.critical) return 'text-red-500';
      if (value >= threshold.warning) return 'text-yellow-500';
      return 'text-green-500';
    }
  }

  function formatMetricValue(metric: keyof PerformanceMetrics, value: number): string {
    switch (metric) {
      case 'fps':
        return `${Math.round(value)} fps`;
      case 'memoryUsage':
        return `${Math.round(value)} MB`;
      case 'renderTime':
        return `${value.toFixed(1)} ms`;
      case 'elementCount':
        return value.toString();
      case 'cacheHitRate':
        return `${(value * 100).toFixed(1)}%`;
      case 'cpuUsage':
        return `${Math.round(value)}%`;
      default:
        return value.toString();
    }
  }

  function getMetricName(metric: keyof PerformanceMetrics): string {
    const names = {
      fps: 'Frame Rate',
      memoryUsage: 'Memory',
      renderTime: 'Render Time',
      elementCount: 'DOM Elements',
      cacheHitRate: 'Cache Hit Rate',
      cpuUsage: 'CPU Usage'
    };
    return names[metric];
  }

  function getAlertIcon(type: 'warning' | 'critical'): string {
    return type === 'critical' ? '⚠️' : '⚡';
  }

  function dismissAlert(alertId: string) {
    alerts = alerts.filter(alert => alert.id !== alertId);
  }

  function exportPerformanceData() {
    const data = performanceMonitor.exportData();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `performance-data-${new Date().toISOString()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function exportUsageData() {
    const data = metricsCollector.exportData();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `usage-data-${new Date().toISOString()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function clearData() {
    performanceMonitor.clearData();
    metricsCollector.clearData();
    performanceHistory = [];
    updateMetrics();
  }

  $: positionClass = position;
  $: sizeClass = compact ? 'compact' : 'full';
</script>

{#if visible}
  <div 
    class="performance-dashboard {positionClass} {sizeClass}"
    class:detailed={showDetailedView}
  >
    <!-- Header -->
    <div class="dashboard-header">
      <div class="dashboard-title">
        <span class="title-icon">📊</span>
        <span>Performance Monitor</span>
      </div>
      
      <div class="dashboard-controls">
        <button 
          class="control-button"
          class:active={showDetailedView}
          on:click={() => showDetailedView = !showDetailedView}
          title="Toggle detailed view"
        >
          {showDetailedView ? '📋' : '📈'}
        </button>
        
        <button 
          class="control-button close-button"
          on:click={() => visible = false}
          title="Close dashboard"
        >
          ✕
        </button>
      </div>
    </div>

    <!-- Compact View -->
    {#if !showDetailedView}
      <div class="metrics-compact">
        <div class="metric-item">
          <span class="metric-label">FPS</span>
          <span class="metric-value {getMetricColor('fps', currentMetrics.fps)}">
            {Math.round(currentMetrics.fps)}
          </span>
        </div>
        
        <div class="metric-item">
          <span class="metric-label">Memory</span>
          <span class="metric-value {getMetricColor('memoryUsage', currentMetrics.memoryUsage)}">
            {Math.round(currentMetrics.memoryUsage)}MB
          </span>
        </div>
        
        <div class="metric-item">
          <span class="metric-label">CPU</span>
          <span class="metric-value {getMetricColor('cpuUsage', currentMetrics.cpuUsage)}">
            {Math.round(currentMetrics.cpuUsage)}%
          </span>
        </div>

        {#if alerts.length > 0}
          <div class="alert-indicator" title="{alerts.length} performance alerts">
            ⚠️ {alerts.length}
          </div>
        {/if}
      </div>
    {/if}

    <!-- Detailed View -->
    {#if showDetailedView}
      <div class="dashboard-tabs">
        <button 
          class="tab-button"
          class:active={selectedTab === 'performance'}
          on:click={() => selectedTab = 'performance'}
        >
          Performance
        </button>
        
        <button 
          class="tab-button"
          class:active={selectedTab === 'usage'}
          on:click={() => selectedTab = 'usage'}
        >
          Usage
        </button>
        
        <button 
          class="tab-button"
          class:active={selectedTab === 'alerts'}
          on:click={() => selectedTab = 'alerts'}
        >
          Alerts {#if alerts.length > 0}({alerts.length}){/if}
        </button>
      </div>

      <div class="dashboard-content">
        <!-- Performance Tab -->
        {#if selectedTab === 'performance'}
          <div class="metrics-detailed">
            {#each Object.entries(currentMetrics) as [metric, value]}
              <div class="metric-card">
                <div class="metric-header">
                  <span class="metric-name">{getMetricName(metric)}</span>
                  <span class="metric-value {getMetricColor(metric, value)}">
                    {formatMetricValue(metric, value)}
                  </span>
                </div>
                
                <!-- Mini chart -->
                <div class="metric-chart">
                  {#each performanceHistory.slice(-20) as point, i}
                    <div 
                      class="chart-bar"
                      style="height: {(point.metrics[metric] / (metric === 'fps' ? 60 : metric === 'memoryUsage' ? 200 : 100)) * 100}%"
                    ></div>
                  {/each}
                </div>
              </div>
            {/each}
          </div>
        {/if}

        <!-- Usage Tab -->
        {#if selectedTab === 'usage' && sessionMetrics}
          <div class="usage-stats">
            <div class="stat-grid">
              <div class="stat-item">
                <span class="stat-label">Session Duration</span>
                <span class="stat-value">
                  {Math.round(sessionMetrics.duration / 1000 / 60)} min
                </span>
              </div>
              
              <div class="stat-item">
                <span class="stat-label">User Actions</span>
                <span class="stat-value">{sessionMetrics.userActions.length}</span>
              </div>
              
              <div class="stat-item">
                <span class="stat-label">Elements Created</span>
                <span class="stat-value">{sessionMetrics.elementsCreated}</span>
              </div>
              
              <div class="stat-item">
                <span class="stat-label">Elements Modified</span>
                <span class="stat-value">{sessionMetrics.elementsModified}</span>
              </div>
              
              <div class="stat-item">
                <span class="stat-label">Save Operations</span>
                <span class="stat-value">{sessionMetrics.saveOperations}</span>
              </div>
              
              <div class="stat-item">
                <span class="stat-label">Errors</span>
                <span class="stat-value text-red-500">{sessionMetrics.errorCount}</span>
              </div>
            </div>
          </div>
        {/if}

        <!-- Alerts Tab -->
        {#if selectedTab === 'alerts'}
          <div class="alerts-list">
            {#if alerts.length === 0}
              <div class="no-alerts">
                <span class="no-alerts-icon">✅</span>
                <span class="no-alerts-text">No performance alerts</span>
              </div>
            {:else}
              {#each alerts as alert (alert.id)}
                <div class="alert-item {alert.type}">
                  <div class="alert-icon">
                    {getAlertIcon(alert.type)}
                  </div>
                  
                  <div class="alert-content">
                    <div class="alert-message">{alert.message}</div>
                    <div class="alert-time">
                      {new Date(alert.timestamp).toLocaleTimeString()}
                    </div>
                  </div>
                  
                  <button 
                    class="alert-dismiss"
                    on:click={() => dismissAlert(alert.id)}
                    title="Dismiss alert"
                  >
                    ✕
                  </button>
                </div>
              {/each}
            {/if}
          </div>
        {/if}
      </div>

      <!-- Footer Actions -->
      <div class="dashboard-footer">
        <button class="footer-button" on:click={exportPerformanceData}>
          Export Performance
        </button>
        
        <button class="footer-button" on:click={exportUsageData}>
          Export Usage
        </button>
        
        <button class="footer-button danger" on:click={clearData}>
          Clear Data
        </button>
      </div>
    {/if}
  </div>
{/if}

<style>
  .performance-dashboard {
    position: fixed;
    z-index: 9999;
    background: rgba(255, 255, 255, 0.95);
    backdrop-filter: blur(10px);
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
    font-size: 12px;
    user-select: none;
  }

  .performance-dashboard.top-left {
    top: 20px;
    left: 20px;
  }

  .performance-dashboard.top-right {
    top: 20px;
    right: 20px;
  }

  .performance-dashboard.bottom-left {
    bottom: 20px;
    left: 20px;
  }

  .performance-dashboard.bottom-right {
    bottom: 20px;
    right: 20px;
  }

  .performance-dashboard.compact {
    min-width: 200px;
  }

  .performance-dashboard.full {
    min-width: 350px;
  }

  .performance-dashboard.detailed {
    min-width: 400px;
    max-height: 500px;
  }

  .dashboard-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 12px;
    border-bottom: 1px solid #e5e7eb;
    background: rgba(249, 250, 251, 0.8);
  }

  .dashboard-title {
    display: flex;
    align-items: center;
    gap: 6px;
    font-weight: 600;
    color: #374151;
  }

  .dashboard-controls {
    display: flex;
    gap: 4px;
  }

  .control-button {
    background: none;
    border: none;
    padding: 4px 8px;
    border-radius: 4px;
    cursor: pointer;
    font-size: 11px;
    color: #6b7280;
    transition: all 0.15s ease;
  }

  .control-button:hover {
    background: rgba(107, 114, 128, 0.1);
    color: #374151;
  }

  .control-button.active {
    background: #3b82f6;
    color: white;
  }

  .close-button:hover {
    background: #fee2e2;
    color: #dc2626;
  }

  .metrics-compact {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    padding: 12px;
  }

  .metric-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    min-width: 50px;
  }

  .metric-label {
    font-size: 10px;
    color: #6b7280;
    margin-bottom: 2px;
  }

  .metric-value {
    font-weight: 600;
    font-size: 13px;
  }

  .alert-indicator {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 4px 8px;
    background: #fef3c7;
    border-radius: 4px;
    color: #92400e;
    font-weight: 500;
    font-size: 11px;
  }

  .dashboard-tabs {
    display: flex;
    border-bottom: 1px solid #e5e7eb;
  }

  .tab-button {
    flex: 1;
    padding: 8px 16px;
    background: none;
    border: none;
    cursor: pointer;
    font-size: 12px;
    color: #6b7280;
    transition: all 0.15s ease;
  }

  .tab-button:hover {
    background: rgba(107, 114, 128, 0.05);
    color: #374151;
  }

  .tab-button.active {
    background: white;
    color: #3b82f6;
    font-weight: 500;
    border-bottom: 2px solid #3b82f6;
  }

  .dashboard-content {
    padding: 12px;
    max-height: 300px;
    overflow-y: auto;
  }

  .metrics-detailed {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: 12px;
  }

  .metric-card {
    padding: 10px;
    background: #f9fafb;
    border-radius: 6px;
    border: 1px solid #e5e7eb;
  }

  .metric-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
  }

  .metric-name {
    font-size: 11px;
    color: #6b7280;
  }

  .metric-chart {
    display: flex;
    align-items: end;
    height: 30px;
    gap: 1px;
  }

  .chart-bar {
    flex: 1;
    background: #3b82f6;
    min-height: 2px;
    border-radius: 1px;
    opacity: 0.7;
  }

  .usage-stats {
    padding: 8px 0;
  }

  .stat-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 12px;
  }

  .stat-item {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .stat-label {
    font-size: 11px;
    color: #6b7280;
  }

  .stat-value {
    font-weight: 600;
    color: #374151;
  }

  .alerts-list {
    max-height: 200px;
    overflow-y: auto;
  }

  .no-alerts {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    padding: 20px;
    color: #6b7280;
  }

  .no-alerts-icon {
    font-size: 24px;
  }

  .alert-item {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    padding: 10px;
    margin-bottom: 8px;
    border-radius: 6px;
    border-left: 4px solid transparent;
  }

  .alert-item.warning {
    background: #fef3c7;
    border-left-color: #f59e0b;
  }

  .alert-item.critical {
    background: #fee2e2;
    border-left-color: #dc2626;
  }

  .alert-icon {
    font-size: 14px;
    margin-top: 2px;
  }

  .alert-content {
    flex: 1;
  }

  .alert-message {
    font-size: 12px;
    font-weight: 500;
    color: #374151;
    margin-bottom: 2px;
  }

  .alert-time {
    font-size: 10px;
    color: #6b7280;
  }

  .alert-dismiss {
    background: none;
    border: none;
    cursor: pointer;
    color: #6b7280;
    padding: 2px 4px;
    border-radius: 3px;
    font-size: 12px;
    line-height: 1;
  }

  .alert-dismiss:hover {
    background: rgba(107, 114, 128, 0.2);
  }

  .dashboard-footer {
    display: flex;
    gap: 8px;
    padding: 8px 12px;
    border-top: 1px solid #e5e7eb;
    background: rgba(249, 250, 251, 0.8);
  }

  .footer-button {
    flex: 1;
    padding: 6px 12px;
    background: white;
    border: 1px solid #d1d5db;
    border-radius: 4px;
    cursor: pointer;
    font-size: 11px;
    font-weight: 500;
    color: #374151;
    transition: all 0.15s ease;
  }

  .footer-button:hover {
    background: #f9fafb;
    border-color: #9ca3af;
  }

  .footer-button.danger {
    color: #dc2626;
    border-color: #fca5a5;
  }

  .footer-button.danger:hover {
    background: #fef2f2;
    border-color: #f87171;
  }

  /* Color utilities */
  .text-green-500 { color: #10b981; }
  .text-yellow-500 { color: #f59e0b; }
  .text-red-500 { color: #ef4444; }
  .text-gray-600 { color: #4b5563; }
</style>