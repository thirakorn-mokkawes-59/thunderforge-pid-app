<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { errorHandler, type ErrorInfo, type ErrorReport } from '../services/ErrorHandler';

  export let isOpen = false;
  export let autoRefresh = true;
  export let refreshInterval = 5000; // 5 seconds

  let errorReport: ErrorReport | null = null;
  let selectedError: ErrorInfo | null = null;
  let activeTab: 'overview' | 'errors' | 'trends' = 'overview';
  let filterCategory: string = 'all';
  let filterSeverity: string = 'all';
  let filterResolved: string = 'all';
  let refreshTimer: number | null = null;

  $: filteredErrors = errorReport?.errors.filter(error => {
    if (filterCategory !== 'all' && error.category !== filterCategory) return false;
    if (filterSeverity !== 'all' && error.severity !== filterSeverity) return false;
    if (filterResolved === 'resolved' && !error.resolved) return false;
    if (filterResolved === 'unresolved' && error.resolved) return false;
    return true;
  }) || [];

  onMount(() => {
    loadErrorReport();
    
    if (autoRefresh) {
      startAutoRefresh();
    }

    // Listen for new errors
    const handleNewError = () => {
      loadErrorReport();
    };

    const handleErrorResolved = () => {
      loadErrorReport();
    };

    window.addEventListener('error-reported', handleNewError);
    window.addEventListener('error-resolved', handleErrorResolved);

    return () => {
      stopAutoRefresh();
      window.removeEventListener('error-reported', handleNewError);
      window.removeEventListener('error-resolved', handleErrorResolved);
    };
  });

  onDestroy(() => {
    stopAutoRefresh();
  });

  function loadErrorReport() {
    errorReport = errorHandler.getErrorReport();
  }

  function startAutoRefresh() {
    if (refreshTimer) clearInterval(refreshTimer);
    refreshTimer = window.setInterval(loadErrorReport, refreshInterval);
  }

  function stopAutoRefresh() {
    if (refreshTimer) {
      clearInterval(refreshTimer);
      refreshTimer = null;
    }
  }

  function toggleAutoRefresh() {
    autoRefresh = !autoRefresh;
    if (autoRefresh) {
      startAutoRefresh();
    } else {
      stopAutoRefresh();
    }
  }

  function resolveError(errorId: string) {
    errorHandler.resolveError(errorId, 'Manually resolved by user');
    loadErrorReport();
    if (selectedError && selectedError.id === errorId) {
      selectedError = null;
    }
  }

  function clearAllErrors() {
    if (confirm('Are you sure you want to clear all errors? This action cannot be undone.')) {
      errorHandler.clearErrors();
      loadErrorReport();
      selectedError = null;
    }
  }

  function exportErrorData() {
    const data = errorHandler.exportErrorData();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `error-report-${Date.now()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  function getSeverityColor(severity: string): string {
    switch (severity) {
      case 'critical': return 'bg-red-100 text-red-800 border-red-200';
      case 'high': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      default: return 'bg-blue-100 text-blue-800 border-blue-200';
    }
  }

  function getCategoryIcon(category: string): string {
    switch (category) {
      case 'system': return '⚙️';
      case 'network': return '🌐';
      case 'validation': return '✅';
      case 'user': return '👤';
      case 'performance': return '⚡';
      case 'security': return '🔒';
      case 'data': return '💾';
      case 'ui': return '🎨';
      default: return '❓';
    }
  }

  function formatTimestamp(timestamp: number): string {
    const date = new Date(timestamp);
    return date.toLocaleString();
  }

  function getRelativeTime(timestamp: number): string {
    const now = Date.now();
    const diff = now - timestamp;
    
    if (diff < 60000) return 'just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return `${Math.floor(diff / 86400000)}d ago`;
  }

  function close() {
    isOpen = false;
    selectedError = null;
  }
</script>

{#if isOpen}
  <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
    <div class="bg-white rounded-lg shadow-xl w-full max-w-6xl h-5/6 flex flex-col">
      <!-- Header -->
      <div class="p-6 border-b border-gray-200 flex items-center justify-between">
        <div class="flex items-center space-x-4">
          <h2 class="text-xl font-semibold text-gray-900">Error Dashboard</h2>
          <div class="flex items-center space-x-2">
            <button
              class="text-sm px-3 py-1 rounded border transition-colors"
              class:bg-blue-500={autoRefresh}
              class:text-white={autoRefresh}
              class:border-blue-500={autoRefresh}
              class:border-gray-300={!autoRefresh}
              class:text-gray-700={!autoRefresh}
              on:click={toggleAutoRefresh}
            >
              {autoRefresh ? '🔄 Auto' : '⏸️ Manual'}
            </button>
            <button
              class="text-sm px-3 py-1 border border-gray-300 text-gray-700 rounded hover:bg-gray-50"
              on:click={loadErrorReport}
            >
              Refresh
            </button>
          </div>
        </div>
        <button
          class="text-gray-400 hover:text-gray-600 text-xl"
          on:click={close}
        >
          ×
        </button>
      </div>

      <!-- Content -->
      <div class="flex-1 flex overflow-hidden">
        <!-- Sidebar -->
        <div class="w-1/4 border-r border-gray-200 flex flex-col">
          <!-- Tabs -->
          <div class="border-b border-gray-200">
            <nav class="flex">
              {#each [
                { id: 'overview', label: 'Overview' },
                { id: 'errors', label: 'Errors' },
                { id: 'trends', label: 'Trends' }
              ] as tab}
                <button
                  class="flex-1 py-3 px-4 text-sm font-medium transition-colors"
                  class:bg-blue-50={activeTab === tab.id}
                  class:text-blue-600={activeTab === tab.id}
                  class:text-gray-600={activeTab !== tab.id}
                  class:hover:text-gray-800={activeTab !== tab.id}
                  on:click={() => activeTab = tab.id}
                >
                  {tab.label}
                </button>
              {/each}
            </nav>
          </div>

          <!-- Overview Tab -->
          {#if activeTab === 'overview'}
            <div class="p-4 space-y-4">
              {#if errorReport}
                <!-- Summary Cards -->
                <div class="space-y-3">
                  <div class="bg-gray-50 p-3 rounded-lg">
                    <div class="text-2xl font-bold text-gray-900">{errorReport.summary.total}</div>
                    <div class="text-sm text-gray-600">Total Errors</div>
                  </div>

                  <div class="bg-red-50 p-3 rounded-lg">
                    <div class="text-2xl font-bold text-red-600">{errorReport.summary.unresolved}</div>
                    <div class="text-sm text-red-600">Unresolved</div>
                  </div>

                  <div class="bg-green-50 p-3 rounded-lg">
                    <div class="text-2xl font-bold text-green-600">{errorReport.summary.resolved}</div>
                    <div class="text-sm text-green-600">Resolved</div>
                  </div>
                </div>

                <!-- By Category -->
                <div>
                  <h4 class="font-medium text-gray-900 mb-2">By Category</h4>
                  <div class="space-y-1">
                    {#each Object.entries(errorReport.summary.byCategory) as [category, count]}
                      {#if count > 0}
                        <div class="flex items-center justify-between text-sm">
                          <span class="flex items-center">
                            <span class="mr-1">{getCategoryIcon(category)}</span>
                            {category}
                          </span>
                          <span class="font-medium">{count}</span>
                        </div>
                      {/if}
                    {/each}
                  </div>
                </div>

                <!-- By Severity -->
                <div>
                  <h4 class="font-medium text-gray-900 mb-2">By Severity</h4>
                  <div class="space-y-1">
                    {#each Object.entries(errorReport.summary.bySeverity) as [severity, count]}
                      {#if count > 0}
                        <div class="flex items-center justify-between text-sm">
                          <span class={`px-2 py-1 rounded text-xs font-medium ${getSeverityColor(severity)}`}>
                            {severity}
                          </span>
                          <span class="font-medium">{count}</span>
                        </div>
                      {/if}
                    {/each}
                  </div>
                </div>
              {:else}
                <div class="text-center py-8 text-gray-500">
                  Loading error report...
                </div>
              {/if}
            </div>

          <!-- Errors Tab -->
          {:else if activeTab === 'errors'}
            <div class="flex flex-col h-full">
              <!-- Filters -->
              <div class="p-4 border-b border-gray-200 space-y-3">
                <div>
                  <label class="block text-xs font-medium text-gray-700 mb-1">Category</label>
                  <select bind:value={filterCategory} class="w-full text-sm border border-gray-300 rounded px-2 py-1">
                    <option value="all">All Categories</option>
                    <option value="system">System</option>
                    <option value="network">Network</option>
                    <option value="validation">Validation</option>
                    <option value="user">User</option>
                    <option value="performance">Performance</option>
                    <option value="security">Security</option>
                    <option value="data">Data</option>
                    <option value="ui">UI</option>
                  </select>
                </div>

                <div>
                  <label class="block text-xs font-medium text-gray-700 mb-1">Severity</label>
                  <select bind:value={filterSeverity} class="w-full text-sm border border-gray-300 rounded px-2 py-1">
                    <option value="all">All Severities</option>
                    <option value="critical">Critical</option>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                </div>

                <div>
                  <label class="block text-xs font-medium text-gray-700 mb-1">Status</label>
                  <select bind:value={filterResolved} class="w-full text-sm border border-gray-300 rounded px-2 py-1">
                    <option value="all">All</option>
                    <option value="unresolved">Unresolved</option>
                    <option value="resolved">Resolved</option>
                  </select>
                </div>
              </div>

              <!-- Error List -->
              <div class="flex-1 overflow-y-auto">
                {#if filteredErrors.length > 0}
                  <div class="divide-y divide-gray-200">
                    {#each filteredErrors as error}
                      <button
                        class="w-full p-3 text-left hover:bg-gray-50 transition-colors"
                        class:bg-blue-50={selectedError?.id === error.id}
                        on:click={() => selectedError = error}
                      >
                        <div class="flex items-start justify-between">
                          <div class="flex-1 min-w-0">
                            <div class="flex items-center space-x-2 mb-1">
                              <span class={`px-2 py-1 rounded text-xs font-medium ${getSeverityColor(error.severity)}`}>
                                {error.severity}
                              </span>
                              <span class="text-xs text-gray-500">
                                {getCategoryIcon(error.category)} {error.category}
                              </span>
                              {#if error.resolved}
                                <span class="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">✓</span>
                              {/if}
                            </div>
                            <p class="text-sm font-medium text-gray-900 truncate">
                              {error.message}
                            </p>
                            <p class="text-xs text-gray-500 mt-1">
                              {error.context.component || 'Unknown'} • {getRelativeTime(error.timestamp)}
                            </p>
                          </div>
                        </div>
                      </button>
                    {/each}
                  </div>
                {:else}
                  <div class="p-4 text-center text-gray-500">
                    No errors match the current filters
                  </div>
                {/if}
              </div>
            </div>

          <!-- Trends Tab -->
          {:else if activeTab === 'trends'}
            <div class="p-4">
              {#if errorReport}
                <div class="space-y-4">
                  <div>
                    <h4 class="font-medium text-gray-900 mb-2">Error Trends</h4>
                    <div class="space-y-2">
                      <div class="flex justify-between items-center">
                        <span class="text-sm text-gray-600">Last Hour</span>
                        <span class="font-medium">{errorReport.trends.lastHour}</span>
                      </div>
                      <div class="flex justify-between items-center">
                        <span class="text-sm text-gray-600">Last Day</span>
                        <span class="font-medium">{errorReport.trends.lastDay}</span>
                      </div>
                      <div class="flex justify-between items-center">
                        <span class="text-sm text-gray-600">Last Week</span>
                        <span class="font-medium">{errorReport.trends.lastWeek}</span>
                      </div>
                    </div>
                  </div>
                </div>
              {:else}
                <div class="text-center py-8 text-gray-500">
                  Loading trends...
                </div>
              {/if}
            </div>
          {/if}
        </div>

        <!-- Main Content -->
        <div class="flex-1 flex flex-col overflow-hidden">
          {#if selectedError}
            <!-- Error Details -->
            <div class="p-6 border-b border-gray-200">
              <div class="flex items-center justify-between mb-4">
                <h3 class="text-lg font-semibold text-gray-900">Error Details</h3>
                <div class="flex space-x-2">
                  {#if !selectedError.resolved}
                    <button
                      class="px-3 py-1 bg-green-500 text-white text-sm rounded hover:bg-green-600"
                      on:click={() => resolveError(selectedError.id)}
                    >
                      Mark Resolved
                    </button>
                  {/if}
                </div>
              </div>

              <div class="space-y-4">
                <div class="flex items-center space-x-4">
                  <span class={`px-3 py-1 rounded text-sm font-medium ${getSeverityColor(selectedError.severity)}`}>
                    {selectedError.severity.toUpperCase()}
                  </span>
                  <span class="text-sm text-gray-600">
                    {getCategoryIcon(selectedError.category)} {selectedError.category}
                  </span>
                  <span class="text-sm text-gray-500">
                    ID: {selectedError.id}
                  </span>
                  {#if selectedError.resolved}
                    <span class="bg-green-100 text-green-800 px-2 py-1 rounded text-sm">Resolved</span>
                  {/if}
                </div>

                <div>
                  <h4 class="font-medium text-gray-900 mb-2">Message</h4>
                  <p class="text-sm text-gray-700 bg-gray-50 p-3 rounded">{selectedError.message}</p>
                </div>

                <div class="grid grid-cols-2 gap-4">
                  <div>
                    <h4 class="font-medium text-gray-900 mb-2">Component</h4>
                    <p class="text-sm text-gray-700">{selectedError.context.component || 'Unknown'}</p>
                  </div>
                  <div>
                    <h4 class="font-medium text-gray-900 mb-2">Action</h4>
                    <p class="text-sm text-gray-700">{selectedError.context.action || 'Unknown'}</p>
                  </div>
                  <div>
                    <h4 class="font-medium text-gray-900 mb-2">Timestamp</h4>
                    <p class="text-sm text-gray-700">{formatTimestamp(selectedError.timestamp)}</p>
                  </div>
                  <div>
                    <h4 class="font-medium text-gray-900 mb-2">Retry Count</h4>
                    <p class="text-sm text-gray-700">{selectedError.retryCount}</p>
                  </div>
                </div>

                {#if selectedError.stack}
                  <div>
                    <h4 class="font-medium text-gray-900 mb-2">Stack Trace</h4>
                    <div class="bg-gray-900 text-green-400 text-xs font-mono p-3 rounded overflow-auto max-h-64">
                      <pre>{selectedError.stack}</pre>
                    </div>
                  </div>
                {/if}

                {#if selectedError.context.breadcrumbs && selectedError.context.breadcrumbs.length > 0}
                  <div>
                    <h4 class="font-medium text-gray-900 mb-2">Recent Activity</h4>
                    <div class="space-y-2 max-h-40 overflow-y-auto">
                      {#each selectedError.context.breadcrumbs as breadcrumb}
                        <div class="flex items-center space-x-3 text-xs">
                          <span class="text-gray-400 w-16">{new Date(breadcrumb.timestamp).toLocaleTimeString()}</span>
                          <span class={`px-2 py-1 rounded font-medium ${
                            breadcrumb.level === 'error' ? 'bg-red-100 text-red-800' :
                            breadcrumb.level === 'warning' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-blue-100 text-blue-800'
                          }`}>
                            {breadcrumb.category}
                          </span>
                          <span class="flex-1 text-gray-700">{breadcrumb.message}</span>
                        </div>
                      {/each}
                    </div>
                  </div>
                {/if}
              </div>
            </div>
          {:else}
            <!-- Default view when no error is selected -->
            <div class="flex-1 flex items-center justify-center text-gray-500">
              <div class="text-center">
                <div class="text-6xl mb-4">📊</div>
                <h3 class="text-lg font-medium mb-2">Error Monitoring Dashboard</h3>
                <p class="text-sm">Select an error from the sidebar to view details</p>
              </div>
            </div>
          {/if}

          <!-- Footer Actions -->
          <div class="border-t border-gray-200 p-4 flex justify-between items-center">
            <div class="text-sm text-gray-500">
              {#if errorReport}
                {errorReport.summary.total} total errors • {errorReport.summary.unresolved} unresolved
              {/if}
            </div>
            <div class="flex space-x-2">
              <button
                class="px-4 py-2 bg-blue-500 text-white text-sm rounded hover:bg-blue-600"
                on:click={exportErrorData}
              >
                Export Data
              </button>
              <button
                class="px-4 py-2 bg-red-500 text-white text-sm rounded hover:bg-red-600"
                on:click={clearAllErrors}
              >
                Clear All
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
{/if}