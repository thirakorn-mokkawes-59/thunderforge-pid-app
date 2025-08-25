<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { errorHandler, type ErrorInfo } from '../services/ErrorHandler';

  export let componentName = 'Unknown Component';
  export let fallbackComponent: any = null;
  export let showDetails = false;
  export let allowRetry = true;
  export let maxRetries = 3;
  export let onError: ((error: ErrorInfo) => void) | null = null;

  let hasError = false;
  let currentError: ErrorInfo | null = null;
  let retryCount = 0;
  let isRetrying = false;

  // Store the original component for recovery
  let componentContainer: HTMLElement;
  let errorReportExpanded = false;

  onMount(() => {
    // Listen for component-specific errors
    const handleError = (event: Event) => {
      if (event instanceof ErrorEvent || event.type === 'error') {
        const error = (event as any).error || new Error((event as any).message || 'Unknown error');
        captureError(error, 'component_error');
      }
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const error = event.reason instanceof Error ? event.reason : new Error(String(event.reason));
      captureError(error, 'promise_rejection');
    };

    // Add error listeners to the component container
    if (componentContainer) {
      componentContainer.addEventListener('error', handleError, true);
    }

    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    // Listen for component reload events
    const handleComponentReload = (event: CustomEvent) => {
      if (event.detail.component === componentName) {
        handleRetry();
      }
    };

    window.addEventListener('component-reload', handleComponentReload as EventListener);

    return () => {
      if (componentContainer) {
        componentContainer.removeEventListener('error', handleError, true);
      }
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
      window.removeEventListener('component-reload', handleComponentReload as EventListener);
    };
  });

  function captureError(error: Error, action = 'unknown') {
    if (hasError) return; // Prevent error loops

    hasError = true;
    
    const errorId = errorHandler.reportError(error, {
      component: componentName,
      action,
      metadata: {
        retryCount,
        userAgent: navigator.userAgent,
        timestamp: Date.now()
      }
    });

    currentError = errorHandler.getError(errorId) || null;

    // Call custom error handler if provided
    if (onError && currentError) {
      try {
        onError(currentError);
      } catch (handlerError) {
        console.error('Error in custom error handler:', handlerError);
      }
    }

    // Add breadcrumb for component error
    errorHandler.addBreadcrumb({
      category: 'error',
      message: `Component ${componentName} encountered an error`,
      level: 'error',
      data: { component: componentName, error: error.message }
    });
  }

  function handleRetry() {
    if (retryCount >= maxRetries) {
      return;
    }

    isRetrying = true;
    retryCount++;

    errorHandler.addBreadcrumb({
      category: 'user',
      message: `Retrying component ${componentName} (attempt ${retryCount})`,
      level: 'info',
      data: { component: componentName, retryCount }
    });

    // Reset error state after a brief delay
    setTimeout(() => {
      hasError = false;
      currentError = null;
      isRetrying = false;
    }, 500);
  }

  function resolveError() {
    if (currentError) {
      errorHandler.resolveError(currentError.id, 'User dismissed error');
      hasError = false;
      currentError = null;
      retryCount = 0;
    }
  }

  function reportErrorToSupport() {
    if (currentError) {
      const errorData = errorHandler.exportErrorData();
      
      // In a real application, this would send to your error reporting service
      console.log('Error report for support:', errorData);
      
      // Create a download link for the error report
      const blob = new Blob([errorData], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `error-report-${Date.now()}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }
  }

  function getErrorSeverityColor(severity: string): string {
    switch (severity) {
      case 'critical': return 'text-red-600 bg-red-50 border-red-200';
      case 'high': return 'text-orange-600 bg-orange-50 border-orange-200';
      case 'medium': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      default: return 'text-blue-600 bg-blue-50 border-blue-200';
    }
  }

  function formatTimestamp(timestamp: number): string {
    return new Date(timestamp).toLocaleString();
  }

  // Reactive statement to handle automatic retry for certain error types
  $: if (currentError && currentError.recoverable && retryCount === 0) {
    // Automatically retry recoverable errors once
    setTimeout(() => {
      if (hasError && allowRetry) {
        handleRetry();
      }
    }, 2000);
  }
</script>

<div bind:this={componentContainer} class="error-boundary">
  {#if hasError && currentError}
    <!-- Error UI -->
    <div class="min-h-32 flex items-center justify-center p-4">
      <div class="max-w-2xl w-full">
        <!-- Error Card -->
        <div class="bg-white border border-gray-200 rounded-lg shadow-lg">
          <!-- Header -->
          <div class={`p-4 border-b border-gray-200 ${getErrorSeverityColor(currentError.severity)}`}>
            <div class="flex items-center justify-between">
              <div class="flex items-center space-x-3">
                <div class="text-2xl">
                  {#if currentError.severity === 'critical'}
                    🚨
                  {:else if currentError.severity === 'high'}
                    ⚠️
                  {:else if currentError.severity === 'medium'}
                    ⚡
                  {:else}
                    ℹ️
                  {/if}
                </div>
                <div>
                  <h3 class="font-semibold">Something went wrong in {componentName}</h3>
                  <p class="text-sm opacity-75">
                    {currentError.severity.charAt(0).toUpperCase() + currentError.severity.slice(1)} severity error
                    at {formatTimestamp(currentError.timestamp)}
                  </p>
                </div>
              </div>
              <div class="flex items-center space-x-2">
                <span class="text-xs px-2 py-1 rounded-full bg-white bg-opacity-50">
                  ID: {currentError.id.slice(-8)}
                </span>
              </div>
            </div>
          </div>

          <!-- Error Message -->
          <div class="p-4 border-b border-gray-200">
            <p class="text-gray-800 mb-2">
              <strong>Error:</strong> {currentError.message}
            </p>
            {#if currentError.code}
              <p class="text-sm text-gray-600">
                <strong>Code:</strong> {currentError.code}
              </p>
            {/if}
          </div>

          <!-- Actions -->
          <div class="p-4 bg-gray-50 border-b border-gray-200">
            <div class="flex flex-wrap gap-2">
              {#if allowRetry && retryCount < maxRetries}
                <button
                  class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors disabled:opacity-50"
                  disabled={isRetrying}
                  on:click={handleRetry}
                >
                  {#if isRetrying}
                    <span class="flex items-center">
                      <div class="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Retrying...
                    </span>
                  {:else}
                    Try Again ({maxRetries - retryCount} left)
                  {/if}
                </button>
              {/if}

              <button
                class="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 transition-colors"
                on:click={resolveError}
              >
                Dismiss Error
              </button>

              <button
                class="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors"
                on:click={reportErrorToSupport}
              >
                Report to Support
              </button>

              {#if showDetails}
                <button
                  class="px-4 py-2 border border-gray-300 text-gray-700 rounded hover:bg-gray-50 transition-colors"
                  on:click={() => errorReportExpanded = !errorReportExpanded}
                >
                  {errorReportExpanded ? 'Hide' : 'Show'} Details
                </button>
              {/if}
            </div>
          </div>

          <!-- Error Details (Expandable) -->
          {#if showDetails && errorReportExpanded}
            <div class="p-4 bg-gray-900 text-green-400 font-mono text-sm overflow-auto max-h-80">
              <div class="mb-4">
                <strong class="text-green-300">Stack Trace:</strong>
                <pre class="mt-2 text-xs whitespace-pre-wrap">{currentError.stack || 'No stack trace available'}</pre>
              </div>

              <div class="mb-4">
                <strong class="text-green-300">Context:</strong>
                <pre class="mt-2 text-xs">{JSON.stringify(currentError.context, null, 2)}</pre>
              </div>

              {#if currentError.context.breadcrumbs && currentError.context.breadcrumbs.length > 0}
                <div class="mb-4">
                  <strong class="text-green-300">Recent Actions:</strong>
                  <div class="mt-2 space-y-1">
                    {#each currentError.context.breadcrumbs.slice(-5) as breadcrumb}
                      <div class="text-xs">
                        <span class="text-gray-400">{formatTimestamp(breadcrumb.timestamp)}</span>
                        <span class={`ml-2 px-1 rounded ${breadcrumb.level === 'error' ? 'bg-red-800' : breadcrumb.level === 'warning' ? 'bg-yellow-800' : 'bg-blue-800'}`}>
                          {breadcrumb.category}
                        </span>
                        <span class="ml-2">{breadcrumb.message}</span>
                      </div>
                    {/each}
                  </div>
                </div>
              {/if}
            </div>
          {/if}

          <!-- Recovery Information -->
          {#if currentError.recoverable}
            <div class="p-4 bg-blue-50 border-t border-blue-200">
              <p class="text-sm text-blue-800">
                <strong>Good news!</strong> This error is recoverable. 
                {#if retryCount === 0}
                  We'll automatically retry in a moment.
                {:else}
                  You can try again or dismiss this error to continue.
                {/if}
              </p>
            </div>
          {/if}
        </div>

        <!-- Alternative fallback component -->
        {#if fallbackComponent}
          <div class="mt-4 p-4 bg-gray-100 border border-gray-200 rounded-lg">
            <h4 class="font-medium text-gray-800 mb-2">Alternative View</h4>
            <svelte:component this={fallbackComponent} />
          </div>
        {/if}
      </div>
    </div>
  {:else}
    <!-- Normal component rendering -->
    <slot />
  {/if}
</div>

<style>
  .error-boundary {
    display: contents;
  }
</style>