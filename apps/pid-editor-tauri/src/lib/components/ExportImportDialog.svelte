<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { exportImportManager, type ExportOptions, type ExportFormat } from '../services/ExportImportManager';
  
  export let isOpen = false;
  export let mode: 'export' | 'import' = 'export';
  export let elements: any[] = [];
  export let connections: any[] = [];

  const dispatch = createEventDispatcher<{
    close: void;
    exported: { result: any };
    imported: { data: any };
  }>();

  // Export state
  let exportFormat: ExportFormat = 'json';
  let exportScope: 'visible' | 'selected' | 'all' = 'all';
  let includeMetadata = true;
  let includePerformanceData = false;
  let compressionLevel: 'none' | 'low' | 'medium' | 'high' = 'none';
  
  // Image export options
  let imageScale = 1;
  let imageBackgroundColor = 'white';
  let imageQuality = 90;
  let imageDpi = 300;
  
  // PDF export options
  let pdfPageSize: 'A4' | 'A3' | 'A2' | 'A1' | 'A0' | 'letter' | 'legal' | 'tabloid' = 'A4';
  let pdfOrientation: 'portrait' | 'landscape' = 'landscape';
  let pdfIncludeTitle = true;
  let pdfIncludeLegend = true;
  let pdfIncludeTimestamp = true;

  // Import state
  let selectedFile: File | null = null;
  let dragOver = false;

  // Progress and status
  let isProcessing = false;
  let progressMessage = '';
  let errorMessage = '';
  let successMessage = '';

  $: supportedExportFormats = exportImportManager.getSupportedExportFormats();
  $: supportedImportFormats = exportImportManager.getSupportedImportFormats();
  $: selectedFormat = supportedExportFormats.find(f => f.format === exportFormat);
  $: showImageOptions = exportFormat === 'png' || exportFormat === 'jpeg';
  $: showPdfOptions = exportFormat === 'pdf';

  function close() {
    isOpen = false;
    resetState();
    dispatch('close');
  }

  function resetState() {
    selectedFile = null;
    dragOver = false;
    isProcessing = false;
    progressMessage = '';
    errorMessage = '';
    successMessage = '';
  }

  async function handleExport() {
    if (isProcessing) return;

    try {
      isProcessing = true;
      errorMessage = '';
      successMessage = '';
      progressMessage = 'Preparing export...';

      const options: ExportOptions = {
        format: exportFormat,
        includeMetadata,
        includePerformanceData,
        compressionLevel,
        exportScope,
        imageOptions: showImageOptions ? {
          scale: imageScale,
          backgroundColor: imageBackgroundColor,
          quality: imageQuality,
          dpi: imageDpi
        } : undefined,
        pdfOptions: showPdfOptions ? {
          pageSize: pdfPageSize,
          orientation: pdfOrientation,
          margin: { top: 20, right: 20, bottom: 20, left: 20 },
          includeTitle: pdfIncludeTitle,
          includeLegend: pdfIncludeLegend,
          includeTimestamp: pdfIncludeTimestamp
        } : undefined
      };

      progressMessage = `Exporting as ${exportFormat.toUpperCase()}...`;
      
      const result = await exportImportManager.exportDiagram(
        elements.map(el => ({
          id: el.id,
          type: el.type || 'unknown',
          position: el.position,
          data: el.data || {},
          style: {},
          layer: 'default',
          locked: false,
          visible: true
        })),
        connections.map(conn => ({
          id: conn.id,
          source: conn.source,
          target: conn.target,
          sourceHandle: conn.sourceHandle,
          targetHandle: conn.targetHandle,
          type: conn.type || 'default',
          data: conn.data || {},
          path: conn.path,
          style: {},
          layer: 'default'
        })),
        options
      );

      if (result.success && result.data) {
        progressMessage = 'Download starting...';
        
        // Trigger download
        const url = URL.createObjectURL(result.data);
        const link = document.createElement('a');
        link.href = url;
        link.download = result.filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        successMessage = `Successfully exported as ${result.filename}`;
        dispatch('exported', { result });
        
        setTimeout(() => {
          close();
        }, 2000);
      } else {
        errorMessage = result.errors.join(', ') || 'Export failed';
      }
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : 'Export failed';
    } finally {
      isProcessing = false;
      progressMessage = '';
    }
  }

  async function handleImport() {
    if (!selectedFile || isProcessing) return;

    try {
      isProcessing = true;
      errorMessage = '';
      successMessage = '';
      progressMessage = 'Reading file...';

      const result = await exportImportManager.importDiagram(selectedFile);

      if (result.success && result.data) {
        successMessage = `Successfully imported ${result.metadata.elementsCount} elements and ${result.metadata.connectionsCount} connections`;
        
        if (result.warnings.length > 0) {
          console.warn('Import warnings:', result.warnings);
        }

        dispatch('imported', { data: result.data });
        
        setTimeout(() => {
          close();
        }, 2000);
      } else {
        errorMessage = result.errors.join(', ') || 'Import failed';
      }
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : 'Import failed';
    } finally {
      isProcessing = false;
      progressMessage = '';
    }
  }

  function handleFileSelect(event: Event) {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];
    if (file) {
      selectedFile = file;
    }
  }

  function handleFileDrop(event: DragEvent) {
    event.preventDefault();
    dragOver = false;
    
    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      selectedFile = files[0];
    }
  }

  function handleDragOver(event: DragEvent) {
    event.preventDefault();
    dragOver = true;
  }

  function handleDragLeave() {
    dragOver = false;
  }

  function formatFileSize(bytes: number): string {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }
</script>

{#if isOpen}
  <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
    <div class="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
      <!-- Header -->
      <div class="p-6 border-b border-gray-200">
        <div class="flex items-center justify-between">
          <div class="flex items-center space-x-4">
            <h2 class="text-xl font-semibold text-gray-900">
              {mode === 'export' ? 'Export Diagram' : 'Import Diagram'}
            </h2>
            <div class="flex bg-gray-100 rounded-lg p-1">
              <button
                class="px-3 py-1 rounded text-sm font-medium transition-colors"
                class:bg-blue-500={mode === 'export'}
                class:text-white={mode === 'export'}
                class:text-gray-600={mode !== 'export'}
                on:click={() => mode = 'export'}
              >
                Export
              </button>
              <button
                class="px-3 py-1 rounded text-sm font-medium transition-colors"
                class:bg-blue-500={mode === 'import'}
                class:text-white={mode === 'import'}
                class:text-gray-600={mode !== 'import'}
                on:click={() => mode = 'import'}
              >
                Import
              </button>
            </div>
          </div>
          <button
            class="text-gray-400 hover:text-gray-600 transition-colors"
            on:click={close}
            disabled={isProcessing}
          >
            ✕
          </button>
        </div>
      </div>

      <!-- Content -->
      <div class="p-6">
        {#if mode === 'export'}
          <!-- Export Mode -->
          <div class="space-y-6">
            <!-- Format Selection -->
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-3">
                Export Format
              </label>
              <div class="grid grid-cols-2 gap-3">
                {#each supportedExportFormats as format}
                  <label class="flex items-start space-x-3 p-3 border rounded-lg cursor-pointer transition-colors hover:bg-gray-50"
                         class:border-blue-500={exportFormat === format.format}
                         class:bg-blue-50={exportFormat === format.format}>
                    <input
                      type="radio"
                      bind:group={exportFormat}
                      value={format.format}
                      class="mt-1"
                    />
                    <div class="flex-1">
                      <div class="text-sm font-medium text-gray-900">
                        {format.name} ({format.extension})
                      </div>
                      <div class="text-xs text-gray-500 mt-1">
                        {format.description}
                      </div>
                    </div>
                  </label>
                {/each}
              </div>
            </div>

            <!-- Export Scope -->
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">
                Export Scope
              </label>
              <select
                bind:value={exportScope}
                class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Elements</option>
                <option value="visible">Visible Elements Only</option>
                <option value="selected">Selected Elements Only</option>
              </select>
            </div>

            <!-- General Options -->
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-3">
                Options
              </label>
              <div class="space-y-2">
                <label class="flex items-center">
                  <input
                    type="checkbox"
                    bind:checked={includeMetadata}
                    class="mr-2"
                  />
                  <span class="text-sm text-gray-700">Include metadata</span>
                </label>
                <label class="flex items-center">
                  <input
                    type="checkbox"
                    bind:checked={includePerformanceData}
                    class="mr-2"
                  />
                  <span class="text-sm text-gray-700">Include performance data</span>
                </label>
              </div>
            </div>

            <!-- Compression -->
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">
                Compression
              </label>
              <select
                bind:value={compressionLevel}
                class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="none">None</option>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>

            <!-- Image Options -->
            {#if showImageOptions}
              <div class="border-t pt-6">
                <h3 class="text-sm font-medium text-gray-700 mb-4">Image Options</h3>
                <div class="grid grid-cols-2 gap-4">
                  <div>
                    <label class="block text-sm text-gray-600 mb-1">Scale</label>
                    <input
                      type="number"
                      bind:value={imageScale}
                      min="0.1"
                      max="5"
                      step="0.1"
                      class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label class="block text-sm text-gray-600 mb-1">Quality (%)</label>
                    <input
                      type="number"
                      bind:value={imageQuality}
                      min="1"
                      max="100"
                      class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label class="block text-sm text-gray-600 mb-1">Background</label>
                    <select
                      bind:value={imageBackgroundColor}
                      class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="white">White</option>
                      <option value="transparent">Transparent</option>
                      <option value="black">Black</option>
                      <option value="#f0f0f0">Light Gray</option>
                    </select>
                  </div>
                  <div>
                    <label class="block text-sm text-gray-600 mb-1">DPI</label>
                    <select
                      bind:value={imageDpi}
                      class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="72">72 (Screen)</option>
                      <option value="150">150 (Draft Print)</option>
                      <option value="300">300 (High Quality)</option>
                      <option value="600">600 (Professional)</option>
                    </select>
                  </div>
                </div>
              </div>
            {/if}

            <!-- PDF Options -->
            {#if showPdfOptions}
              <div class="border-t pt-6">
                <h3 class="text-sm font-medium text-gray-700 mb-4">PDF Options</h3>
                <div class="grid grid-cols-2 gap-4">
                  <div>
                    <label class="block text-sm text-gray-600 mb-1">Page Size</label>
                    <select
                      bind:value={pdfPageSize}
                      class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="A4">A4</option>
                      <option value="A3">A3</option>
                      <option value="A2">A2</option>
                      <option value="A1">A1</option>
                      <option value="A0">A0</option>
                      <option value="letter">Letter</option>
                      <option value="legal">Legal</option>
                      <option value="tabloid">Tabloid</option>
                    </select>
                  </div>
                  <div>
                    <label class="block text-sm text-gray-600 mb-1">Orientation</label>
                    <select
                      bind:value={pdfOrientation}
                      class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="landscape">Landscape</option>
                      <option value="portrait">Portrait</option>
                    </select>
                  </div>
                </div>
                <div class="mt-4 space-y-2">
                  <label class="flex items-center">
                    <input
                      type="checkbox"
                      bind:checked={pdfIncludeTitle}
                      class="mr-2"
                    />
                    <span class="text-sm text-gray-700">Include title</span>
                  </label>
                  <label class="flex items-center">
                    <input
                      type="checkbox"
                      bind:checked={pdfIncludeLegend}
                      class="mr-2"
                    />
                    <span class="text-sm text-gray-700">Include legend</span>
                  </label>
                  <label class="flex items-center">
                    <input
                      type="checkbox"
                      bind:checked={pdfIncludeTimestamp}
                      class="mr-2"
                    />
                    <span class="text-sm text-gray-700">Include timestamp</span>
                  </label>
                </div>
              </div>
            {/if}
          </div>

        {:else}
          <!-- Import Mode -->
          <div class="space-y-6">
            <!-- Supported Formats Info -->
            <div>
              <h3 class="text-sm font-medium text-gray-700 mb-3">Supported Import Formats</h3>
              <div class="grid grid-cols-2 gap-3">
                {#each supportedImportFormats as format}
                  <div class="p-3 bg-gray-50 rounded-lg">
                    <div class="text-sm font-medium text-gray-900">{format.name}</div>
                    <div class="text-xs text-gray-500 mt-1">
                      {format.extensions.join(', ')}
                    </div>
                  </div>
                {/each}
              </div>
            </div>

            <!-- File Upload Area -->
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-3">
                Select File
              </label>
              
              <!-- Drag & Drop Area -->
              <div
                class="border-2 border-dashed rounded-lg p-8 text-center transition-colors"
                class:border-blue-500={dragOver}
                class:bg-blue-50={dragOver}
                class:border-gray-300={!dragOver}
                on:drop={handleFileDrop}
                on:dragover={handleDragOver}
                on:dragleave={handleDragLeave}
              >
                {#if selectedFile}
                  <div class="space-y-2">
                    <div class="text-sm font-medium text-gray-900">{selectedFile.name}</div>
                    <div class="text-xs text-gray-500">
                      {formatFileSize(selectedFile.size)} • {selectedFile.type || 'Unknown type'}
                    </div>
                    <button
                      class="text-sm text-blue-600 hover:text-blue-700"
                      on:click={() => selectedFile = null}
                    >
                      Remove file
                    </button>
                  </div>
                {:else}
                  <div class="space-y-3">
                    <div class="text-gray-400 text-4xl">📁</div>
                    <div>
                      <div class="text-sm text-gray-600">
                        Drag and drop your file here, or
                      </div>
                      <label class="text-sm text-blue-600 hover:text-blue-700 cursor-pointer font-medium">
                        browse to select
                        <input
                          type="file"
                          class="hidden"
                          accept=".json,.svg,.dxf,.vsdx,.vsd,.drawio,.xml"
                          on:change={handleFileSelect}
                        />
                      </label>
                    </div>
                  </div>
                {/if}
              </div>
            </div>
          </div>
        {/if}

        <!-- Progress/Status Messages -->
        {#if progressMessage}
          <div class="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div class="flex items-center">
              <div class="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-3"></div>
              <span class="text-sm text-blue-800">{progressMessage}</span>
            </div>
          </div>
        {/if}

        {#if errorMessage}
          <div class="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div class="text-sm text-red-800">{errorMessage}</div>
          </div>
        {/if}

        {#if successMessage}
          <div class="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
            <div class="text-sm text-green-800">{successMessage}</div>
          </div>
        {/if}
      </div>

      <!-- Footer -->
      <div class="p-6 border-t border-gray-200 flex justify-end space-x-3">
        <button
          class="px-4 py-2 text-gray-600 border border-gray-300 rounded hover:bg-gray-50 transition-colors"
          on:click={close}
          disabled={isProcessing}
        >
          Cancel
        </button>
        
        {#if mode === 'export'}
          <button
            class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            on:click={handleExport}
            disabled={isProcessing}
          >
            {#if isProcessing}
              <span class="flex items-center">
                <div class="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Exporting...
              </span>
            {:else}
              Export {selectedFormat?.name || ''}
            {/if}
          </button>
        {:else}
          <button
            class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            on:click={handleImport}
            disabled={!selectedFile || isProcessing}
          >
            {#if isProcessing}
              <span class="flex items-center">
                <div class="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Importing...
              </span>
            {:else}
              Import File
            {/if}
          </button>
        {/if}
      </div>
    </div>
  </div>
{/if}