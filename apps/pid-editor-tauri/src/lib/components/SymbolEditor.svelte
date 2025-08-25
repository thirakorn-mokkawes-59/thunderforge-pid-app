<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import { symbolVersionManager, type SymbolVersion, type SymbolParameter, type ConnectionPointDef, type SymbolTemplate, type SymbolValidationResult } from '../services/SymbolVersionManager';
  import { fade, slide } from 'svelte/transition';

  export let isOpen = false;
  export let mode: 'create' | 'edit' | 'template' = 'create';
  export let symbolId: string | null = null;
  export let versionId: string | null = null;
  export let templateId: string | null = null;

  const dispatch = createEventDispatcher<{
    close: void;
    saved: { symbolId: string; versionId: string };
    created: { symbolId: string; versionId: string };
  }>();

  // Editor state
  let activeTab: 'general' | 'svg' | 'connections' | 'parameters' | 'preview' = 'general';
  let isLoading = false;
  let isSaving = false;
  let validationResult: SymbolValidationResult | null = null;

  // Symbol data
  let symbolData: Partial<SymbolVersion> = {
    symbolId: '',
    version: '1.0.0',
    name: '',
    description: '',
    svgContent: '',
    metadata: {
      standard: 'CUSTOM',
      category: '',
      subcategory: '',
      keywords: [],
      dimensions: { width: 100, height: 100, aspectRatio: 1 },
      complexity: 'moderate',
      usage: { frequency: 0, lastUsed: 0, contexts: [] }
    },
    properties: {
      scalable: true,
      rotatable: true,
      flippable: true,
      configurable: false,
      parameters: [],
      variants: [],
      constraints: []
    },
    connectionPoints: [],
    createdBy: 'current-user',
    changeLog: '',
    tags: []
  };

  // Templates
  let availableTemplates: SymbolTemplate[] = [];
  let selectedTemplate: SymbolTemplate | null = null;

  // Connection point editor
  let editingConnectionPoint: ConnectionPointDef | null = null;
  let connectionPointForm = {
    id: '',
    name: '',
    position: { x: 50, y: 50 },
    direction: 'east' as const,
    type: 'bidirectional' as const,
    connectionTypes: ['process'],
    required: true,
    multiple: false,
    constraints: []
  };

  // Parameter editor
  let editingParameter: SymbolParameter | null = null;
  let parameterForm = {
    id: '',
    name: '',
    type: 'string' as const,
    defaultValue: '',
    options: [] as any[],
    min: undefined as number | undefined,
    max: undefined as number | undefined,
    required: false,
    description: '',
    affects: ['geometry'] as ('geometry' | 'appearance' | 'behavior')[]
  };

  // SVG editor
  let svgEditor: HTMLTextAreaElement;
  let svgPreview: HTMLDivElement;

  // Categories and standards
  const categories = [
    'vessels', 'pumps', 'compressors', 'heat-exchangers', 'valves', 
    'instruments', 'piping', 'electrical', 'safety', 'utilities', 'custom'
  ];

  const standards = ['ISO', 'PIP', 'ANSI', 'CUSTOM'];
  const connectionDirections = ['north', 'south', 'east', 'west', 'any'];
  const connectionTypes = ['input', 'output', 'bidirectional'];
  const parameterTypes = ['string', 'number', 'boolean', 'color', 'enum'];

  onMount(async () => {
    await loadData();
  });

  async function loadData() {
    isLoading = true;
    try {
      // Load templates if in template mode
      if (mode === 'template') {
        // TODO: Load available templates from symbolVersionManager
        availableTemplates = [];
      }

      // Load existing symbol if editing
      if (mode === 'edit' && symbolId && versionId) {
        const existingSymbol = symbolVersionManager.getSymbolVersion(symbolId, undefined);
        if (existingSymbol) {
          symbolData = { ...existingSymbol };
        }
      }

      // Load template data if using template
      if (templateId) {
        selectedTemplate = null; // TODO: Load template from symbolVersionManager
      }

    } catch (error) {
      console.error('Failed to load symbol data:', error);
    } finally {
      isLoading = false;
    }
  }

  async function saveSymbol() {
    if (isSaving) return;

    isSaving = true;
    try {
      // Validate symbol first
      const tempSymbol = symbolData as SymbolVersion;
      validationResult = await symbolVersionManager.validateSymbol(tempSymbol);

      if (!validationResult.valid) {
        // Show validation errors but allow saving drafts
        const hasErrors = validationResult.errors.length > 0;
        if (hasErrors && !confirm('Symbol has validation errors. Save as draft anyway?')) {
          return;
        }
      }

      let resultSymbolId: string;
      let resultVersionId: string;

      if (mode === 'create') {
        // Create new symbol
        resultSymbolId = symbolData.symbolId!;
        resultVersionId = await symbolVersionManager.createSymbolVersion(resultSymbolId, {
          ...symbolData,
          changeLog: symbolData.changeLog || 'Initial version'
        } as Omit<SymbolVersion, 'id' | 'createdAt' | 'status'>);
        
        dispatch('created', { symbolId: resultSymbolId, versionId: resultVersionId });
      } else {
        // Update existing symbol
        resultSymbolId = symbolId!;
        await symbolVersionManager.updateSymbolVersion(symbolId!, versionId!, symbolData);
        resultVersionId = versionId!;
        
        dispatch('saved', { symbolId: resultSymbolId, versionId: resultVersionId });
      }

      close();
    } catch (error) {
      console.error('Failed to save symbol:', error);
      alert(`Failed to save symbol: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      isSaving = false;
    }
  }

  async function validateSymbol() {
    try {
      const tempSymbol = symbolData as SymbolVersion;
      validationResult = await symbolVersionManager.validateSymbol(tempSymbol);
    } catch (error) {
      console.error('Validation failed:', error);
    }
  }

  function close() {
    isOpen = false;
    dispatch('close');
  }

  // Connection point management
  function addConnectionPoint() {
    editingConnectionPoint = null;
    connectionPointForm = {
      id: `cp_${Date.now()}`,
      name: '',
      position: { x: 50, y: 50 },
      direction: 'east',
      type: 'bidirectional',
      connectionTypes: ['process'],
      required: true,
      multiple: false,
      constraints: []
    };
  }

  function editConnectionPoint(cp: ConnectionPointDef) {
    editingConnectionPoint = cp;
    connectionPointForm = { ...cp };
  }

  function saveConnectionPoint() {
    if (!symbolData.connectionPoints) symbolData.connectionPoints = [];

    if (editingConnectionPoint) {
      const index = symbolData.connectionPoints.indexOf(editingConnectionPoint);
      symbolData.connectionPoints[index] = { ...connectionPointForm };
    } else {
      symbolData.connectionPoints.push({ ...connectionPointForm });
    }

    symbolData.connectionPoints = [...symbolData.connectionPoints];
    editingConnectionPoint = null;
  }

  function deleteConnectionPoint(cp: ConnectionPointDef) {
    if (confirm('Delete this connection point?')) {
      symbolData.connectionPoints = symbolData.connectionPoints?.filter(p => p !== cp) || [];
    }
  }

  // Parameter management
  function addParameter() {
    editingParameter = null;
    parameterForm = {
      id: `param_${Date.now()}`,
      name: '',
      type: 'string',
      defaultValue: '',
      options: [],
      min: undefined,
      max: undefined,
      required: false,
      description: '',
      affects: ['geometry']
    };
  }

  function editParameter(param: SymbolParameter) {
    editingParameter = param;
    parameterForm = { ...param };
  }

  function saveParameter() {
    if (!symbolData.properties?.parameters) {
      if (!symbolData.properties) symbolData.properties = {
        scalable: true,
        rotatable: true,
        flippable: true,
        configurable: false,
        parameters: [],
        variants: [],
        constraints: []
      };
      symbolData.properties.parameters = [];
    }

    if (editingParameter) {
      const index = symbolData.properties.parameters.indexOf(editingParameter);
      symbolData.properties.parameters[index] = { ...parameterForm };
    } else {
      symbolData.properties.parameters.push({ ...parameterForm });
    }

    symbolData.properties.parameters = [...symbolData.properties.parameters];
    symbolData.properties.configurable = symbolData.properties.parameters.length > 0;
    editingParameter = null;
  }

  function deleteParameter(param: SymbolParameter) {
    if (confirm('Delete this parameter?')) {
      if (symbolData.properties?.parameters) {
        symbolData.properties.parameters = symbolData.properties.parameters.filter(p => p !== param);
        symbolData.properties.configurable = symbolData.properties.parameters.length > 0;
      }
    }
  }

  // SVG preview update
  function updateSvgPreview() {
    if (svgPreview && symbolData.svgContent) {
      svgPreview.innerHTML = symbolData.svgContent;
    }
  }

  // Template selection
  function selectTemplate(template: SymbolTemplate) {
    selectedTemplate = template;
    symbolData.svgContent = template.svgTemplate;
    symbolData.metadata!.category = template.category;
    symbolData.properties!.parameters = [...template.parameters];
    symbolData.connectionPoints = [...template.connectionPoints];
    updateSvgPreview();
  }

  // Keyword management
  function addKeyword(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      const target = event.target as HTMLInputElement;
      const keyword = target.value.trim();
      if (keyword && !symbolData.metadata!.keywords.includes(keyword)) {
        symbolData.metadata!.keywords = [...symbolData.metadata!.keywords, keyword];
        target.value = '';
      }
    }
  }

  function removeKeyword(keyword: string) {
    symbolData.metadata!.keywords = symbolData.metadata!.keywords.filter(k => k !== keyword);
  }

  // Tag management
  function addTag(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      const target = event.target as HTMLInputElement;
      const tag = target.value.trim();
      if (tag && !symbolData.tags!.includes(tag)) {
        symbolData.tags = [...(symbolData.tags || []), tag];
        target.value = '';
      }
    }
  }

  function removeTag(tag: string) {
    symbolData.tags = symbolData.tags?.filter(t => t !== tag) || [];
  }

  // Reactive updates
  $: if (symbolData.svgContent) {
    updateSvgPreview();
  }

  $: canSave = symbolData.name && symbolData.svgContent && symbolData.symbolId;
</script>

{#if isOpen}
  <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" transition:fade={{ duration: 200 }}>
    <div class="bg-white rounded-lg shadow-xl w-full max-w-6xl h-5/6 flex flex-col">
      <!-- Header -->
      <div class="p-6 border-b border-gray-200 flex items-center justify-between">
        <div>
          <h2 class="text-xl font-semibold text-gray-900">
            {#if mode === 'create'}Create New Symbol{:else if mode === 'edit'}Edit Symbol{:else}Create from Template{/if}
          </h2>
          {#if symbolData.name}
            <p class="text-sm text-gray-600 mt-1">{symbolData.name}</p>
          {/if}
        </div>
        <div class="flex items-center space-x-3">
          <button
            class="px-3 py-1 text-sm border border-gray-300 text-gray-700 rounded hover:bg-gray-50"
            on:click={validateSymbol}
          >
            Validate
          </button>
          <button
            class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
            disabled={!canSave || isSaving}
            on:click={saveSymbol}
          >
            {#if isSaving}
              <span class="flex items-center">
                <div class="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Saving...
              </span>
            {:else}
              Save Symbol
            {/if}
          </button>
          <button
            class="text-gray-400 hover:text-gray-600 text-xl"
            on:click={close}
          >
            ×
          </button>
        </div>
      </div>

      <div class="flex-1 flex overflow-hidden">
        <!-- Sidebar - Tabs -->
        <div class="w-64 border-r border-gray-200 bg-gray-50">
          <nav class="p-4 space-y-1">
            {#each [
              { id: 'general', label: 'General', icon: '📋' },
              { id: 'svg', label: 'SVG Content', icon: '🎨' },
              { id: 'connections', label: 'Connection Points', icon: '🔗' },
              { id: 'parameters', label: 'Parameters', icon: '⚙️' },
              { id: 'preview', label: 'Preview', icon: '👁️' }
            ] as tab}
              <button
                class="w-full text-left px-3 py-2 text-sm rounded transition-colors flex items-center space-x-2"
                class:bg-blue-50={activeTab === tab.id}
                class:text-blue-600={activeTab === tab.id}
                class:text-gray-700={activeTab !== tab.id}
                class:hover:bg-gray-100={activeTab !== tab.id}
                on:click={() => activeTab = tab.id}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            {/each}
          </nav>

          <!-- Validation Results -->
          {#if validationResult}
            <div class="p-4 border-t border-gray-200">
              <h4 class="text-sm font-medium text-gray-900 mb-2">Validation Results</h4>
              <div class="space-y-2">
                <div class="flex items-center justify-between text-xs">
                  <span>Score:</span>
                  <span class={`font-medium ${validationResult.score >= 80 ? 'text-green-600' : validationResult.score >= 60 ? 'text-yellow-600' : 'text-red-600'}`}>
                    {validationResult.score}/100
                  </span>
                </div>
                {#if validationResult.errors.length > 0}
                  <div class="text-xs text-red-600">
                    {validationResult.errors.length} error{validationResult.errors.length > 1 ? 's' : ''}
                  </div>
                {/if}
                {#if validationResult.warnings.length > 0}
                  <div class="text-xs text-yellow-600">
                    {validationResult.warnings.length} warning{validationResult.warnings.length > 1 ? 's' : ''}
                  </div>
                {/if}
              </div>
            </div>
          {/if}
        </div>

        <!-- Main Content -->
        <div class="flex-1 flex flex-col overflow-hidden">
          {#if isLoading}
            <div class="flex-1 flex items-center justify-center">
              <div class="text-center">
                <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
                <p class="text-gray-600">Loading symbol data...</p>
              </div>
            </div>
          {:else}
            <!-- Tab Content -->
            <div class="flex-1 overflow-auto p-6">
              <!-- General Tab -->
              {#if activeTab === 'general'}
                <div class="space-y-6" transition:slide={{ duration: 200 }}>
                  <div class="grid grid-cols-2 gap-6">
                    <div>
                      <label class="block text-sm font-medium text-gray-700 mb-2">Symbol ID</label>
                      <input
                        type="text"
                        bind:value={symbolData.symbolId}
                        placeholder="unique-symbol-id"
                        class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        required
                      />
                    </div>

                    <div>
                      <label class="block text-sm font-medium text-gray-700 mb-2">Version</label>
                      <input
                        type="text"
                        bind:value={symbolData.version}
                        placeholder="1.0.0"
                        class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        required
                      />
                    </div>

                    <div>
                      <label class="block text-sm font-medium text-gray-700 mb-2">Name</label>
                      <input
                        type="text"
                        bind:value={symbolData.name}
                        placeholder="Symbol Name"
                        class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        required
                      />
                    </div>

                    <div>
                      <label class="block text-sm font-medium text-gray-700 mb-2">Category</label>
                      <select
                        bind:value={symbolData.metadata.category}
                        class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        required
                      >
                        <option value="">Select category</option>
                        {#each categories as category}
                          <option value={category}>{category}</option>
                        {/each}
                      </select>
                    </div>

                    <div>
                      <label class="block text-sm font-medium text-gray-700 mb-2">Standard</label>
                      <select
                        bind:value={symbolData.metadata.standard}
                        class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        {#each standards as standard}
                          <option value={standard}>{standard}</option>
                        {/each}
                      </select>
                    </div>

                    <div>
                      <label class="block text-sm font-medium text-gray-700 mb-2">Subcategory</label>
                      <input
                        type="text"
                        bind:value={symbolData.metadata.subcategory}
                        placeholder="Optional subcategory"
                        class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">Description</label>
                    <textarea
                      bind:value={symbolData.description}
                      placeholder="Symbol description..."
                      rows="3"
                      class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    ></textarea>
                  </div>

                  <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">Keywords</label>
                    <div class="flex flex-wrap gap-2 mb-2">
                      {#each symbolData.metadata.keywords as keyword}
                        <span class="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded flex items-center">
                          {keyword}
                          <button class="ml-1 text-blue-600 hover:text-blue-800" on:click={() => removeKeyword(keyword)}>×</button>
                        </span>
                      {/each}
                    </div>
                    <input
                      type="text"
                      placeholder="Add keyword and press Enter"
                      class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      on:keydown={addKeyword}
                    />
                  </div>

                  <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">Tags</label>
                    <div class="flex flex-wrap gap-2 mb-2">
                      {#each symbolData.tags || [] as tag}
                        <span class="px-2 py-1 bg-green-100 text-green-800 text-xs rounded flex items-center">
                          {tag}
                          <button class="ml-1 text-green-600 hover:text-green-800" on:click={() => removeTag(tag)}>×</button>
                        </span>
                      {/each}
                    </div>
                    <input
                      type="text"
                      placeholder="Add tag and press Enter"
                      class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      on:keydown={addTag}
                    />
                  </div>

                  <div class="grid grid-cols-3 gap-4">
                    <label class="flex items-center">
                      <input
                        type="checkbox"
                        bind:checked={symbolData.properties.scalable}
                        class="mr-2"
                      />
                      <span class="text-sm text-gray-700">Scalable</span>
                    </label>
                    <label class="flex items-center">
                      <input
                        type="checkbox"
                        bind:checked={symbolData.properties.rotatable}
                        class="mr-2"
                      />
                      <span class="text-sm text-gray-700">Rotatable</span>
                    </label>
                    <label class="flex items-center">
                      <input
                        type="checkbox"
                        bind:checked={symbolData.properties.flippable}
                        class="mr-2"
                      />
                      <span class="text-sm text-gray-700">Flippable</span>
                    </label>
                  </div>

                  <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">Change Log</label>
                    <textarea
                      bind:value={symbolData.changeLog}
                      placeholder="Describe the changes made..."
                      rows="2"
                      class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    ></textarea>
                  </div>
                </div>

              <!-- SVG Content Tab -->
              {:else if activeTab === 'svg'}
                <div class="h-full flex flex-col space-y-4" transition:slide={{ duration: 200 }}>
                  <div class="flex items-center justify-between">
                    <h3 class="text-lg font-medium">SVG Content</h3>
                    <div class="space-x-2">
                      <button
                        class="px-3 py-1 text-sm border border-gray-300 text-gray-700 rounded hover:bg-gray-50"
                        on:click={updateSvgPreview}
                      >
                        Update Preview
                      </button>
                    </div>
                  </div>
                  
                  <div class="flex-1 grid grid-cols-2 gap-4 min-h-0">
                    <div class="flex flex-col">
                      <label class="block text-sm font-medium text-gray-700 mb-2">SVG Code</label>
                      <textarea
                        bind:this={svgEditor}
                        bind:value={symbolData.svgContent}
                        placeholder="<svg>...</svg>"
                        class="flex-1 px-3 py-2 border border-gray-300 rounded-md font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                        spellcheck="false"
                      ></textarea>
                    </div>
                    
                    <div class="flex flex-col">
                      <label class="block text-sm font-medium text-gray-700 mb-2">Preview</label>
                      <div
                        bind:this={svgPreview}
                        class="flex-1 border border-gray-300 rounded-md p-4 bg-gray-50 flex items-center justify-center overflow-auto"
                      >
                        <!-- SVG preview will be inserted here -->
                      </div>
                    </div>
                  </div>
                </div>

              <!-- Connection Points Tab -->
              {:else if activeTab === 'connections'}
                <div class="space-y-6" transition:slide={{ duration: 200 }}>
                  <div class="flex items-center justify-between">
                    <h3 class="text-lg font-medium">Connection Points</h3>
                    <button
                      class="px-3 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                      on:click={addConnectionPoint}
                    >
                      Add Connection Point
                    </button>
                  </div>

                  <!-- Connection Points List -->
                  {#if symbolData.connectionPoints && symbolData.connectionPoints.length > 0}
                    <div class="space-y-3">
                      {#each symbolData.connectionPoints as cp}
                        <div class="border border-gray-200 rounded-lg p-4">
                          <div class="flex items-center justify-between">
                            <div>
                              <h4 class="font-medium">{cp.name || cp.id}</h4>
                              <p class="text-sm text-gray-600">
                                {cp.type} • {cp.direction} • ({cp.position.x}, {cp.position.y})
                              </p>
                            </div>
                            <div class="space-x-2">
                              <button
                                class="px-2 py-1 text-sm border border-gray-300 text-gray-700 rounded hover:bg-gray-50"
                                on:click={() => editConnectionPoint(cp)}
                              >
                                Edit
                              </button>
                              <button
                                class="px-2 py-1 text-sm bg-red-500 text-white rounded hover:bg-red-600"
                                on:click={() => deleteConnectionPoint(cp)}
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                        </div>
                      {/each}
                    </div>
                  {:else}
                    <div class="text-center py-8 text-gray-500">
                      No connection points defined
                    </div>
                  {/if}

                  <!-- Connection Point Form -->
                  {#if editingConnectionPoint !== null || connectionPointForm.id}
                    <div class="border-t border-gray-200 pt-6">
                      <h4 class="font-medium mb-4">
                        {editingConnectionPoint ? 'Edit' : 'Add'} Connection Point
                      </h4>
                      
                      <div class="grid grid-cols-2 gap-4">
                        <div>
                          <label class="block text-sm font-medium text-gray-700 mb-1">ID</label>
                          <input
                            type="text"
                            bind:value={connectionPointForm.id}
                            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            required
                          />
                        </div>

                        <div>
                          <label class="block text-sm font-medium text-gray-700 mb-1">Name</label>
                          <input
                            type="text"
                            bind:value={connectionPointForm.name}
                            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            required
                          />
                        </div>

                        <div>
                          <label class="block text-sm font-medium text-gray-700 mb-1">X Position</label>
                          <input
                            type="number"
                            bind:value={connectionPointForm.position.x}
                            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            required
                          />
                        </div>

                        <div>
                          <label class="block text-sm font-medium text-gray-700 mb-1">Y Position</label>
                          <input
                            type="number"
                            bind:value={connectionPointForm.position.y}
                            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            required
                          />
                        </div>

                        <div>
                          <label class="block text-sm font-medium text-gray-700 mb-1">Direction</label>
                          <select
                            bind:value={connectionPointForm.direction}
                            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            {#each connectionDirections as direction}
                              <option value={direction}>{direction}</option>
                            {/each}
                          </select>
                        </div>

                        <div>
                          <label class="block text-sm font-medium text-gray-700 mb-1">Type</label>
                          <select
                            bind:value={connectionPointForm.type}
                            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            {#each connectionTypes as type}
                              <option value={type}>{type}</option>
                            {/each}
                          </select>
                        </div>
                      </div>

                      <div class="flex justify-end space-x-2 mt-4">
                        <button
                          class="px-3 py-2 border border-gray-300 text-gray-700 rounded hover:bg-gray-50"
                          on:click={() => { editingConnectionPoint = null; connectionPointForm.id = ''; }}
                        >
                          Cancel
                        </button>
                        <button
                          class="px-3 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                          on:click={saveConnectionPoint}
                        >
                          {editingConnectionPoint ? 'Update' : 'Add'} Connection Point
                        </button>
                      </div>
                    </div>
                  {/if}
                </div>

              <!-- Parameters Tab -->
              {:else if activeTab === 'parameters'}
                <div class="space-y-6" transition:slide={{ duration: 200 }}>
                  <div class="flex items-center justify-between">
                    <h3 class="text-lg font-medium">Parameters</h3>
                    <button
                      class="px-3 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                      on:click={addParameter}
                    >
                      Add Parameter
                    </button>
                  </div>

                  <!-- Parameters List -->
                  {#if symbolData.properties?.parameters && symbolData.properties.parameters.length > 0}
                    <div class="space-y-3">
                      {#each symbolData.properties.parameters as param}
                        <div class="border border-gray-200 rounded-lg p-4">
                          <div class="flex items-center justify-between">
                            <div>
                              <h4 class="font-medium">{param.name}</h4>
                              <p class="text-sm text-gray-600">
                                {param.type} • Default: {param.defaultValue}
                                {#if param.required}<span class="text-red-500">*</span>{/if}
                              </p>
                            </div>
                            <div class="space-x-2">
                              <button
                                class="px-2 py-1 text-sm border border-gray-300 text-gray-700 rounded hover:bg-gray-50"
                                on:click={() => editParameter(param)}
                              >
                                Edit
                              </button>
                              <button
                                class="px-2 py-1 text-sm bg-red-500 text-white rounded hover:bg-red-600"
                                on:click={() => deleteParameter(param)}
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                        </div>
                      {/each}
                    </div>
                  {:else}
                    <div class="text-center py-8 text-gray-500">
                      No parameters defined
                    </div>
                  {/if}

                  <!-- Parameter Form -->
                  {#if editingParameter !== null || parameterForm.id}
                    <div class="border-t border-gray-200 pt-6">
                      <h4 class="font-medium mb-4">
                        {editingParameter ? 'Edit' : 'Add'} Parameter
                      </h4>
                      
                      <div class="grid grid-cols-2 gap-4">
                        <div>
                          <label class="block text-sm font-medium text-gray-700 mb-1">ID</label>
                          <input
                            type="text"
                            bind:value={parameterForm.id}
                            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            required
                          />
                        </div>

                        <div>
                          <label class="block text-sm font-medium text-gray-700 mb-1">Name</label>
                          <input
                            type="text"
                            bind:value={parameterForm.name}
                            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            required
                          />
                        </div>

                        <div>
                          <label class="block text-sm font-medium text-gray-700 mb-1">Type</label>
                          <select
                            bind:value={parameterForm.type}
                            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            {#each parameterTypes as type}
                              <option value={type}>{type}</option>
                            {/each}
                          </select>
                        </div>

                        <div>
                          <label class="block text-sm font-medium text-gray-700 mb-1">Default Value</label>
                          <input
                            type={parameterForm.type === 'number' ? 'number' : 'text'}
                            bind:value={parameterForm.defaultValue}
                            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                      </div>

                      <div class="mt-4">
                        <label class="block text-sm font-medium text-gray-700 mb-1">Description</label>
                        <textarea
                          bind:value={parameterForm.description}
                          rows="2"
                          class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        ></textarea>
                      </div>

                      <div class="flex items-center mt-4">
                        <label class="flex items-center">
                          <input
                            type="checkbox"
                            bind:checked={parameterForm.required}
                            class="mr-2"
                          />
                          <span class="text-sm text-gray-700">Required</span>
                        </label>
                      </div>

                      <div class="flex justify-end space-x-2 mt-4">
                        <button
                          class="px-3 py-2 border border-gray-300 text-gray-700 rounded hover:bg-gray-50"
                          on:click={() => { editingParameter = null; parameterForm.id = ''; }}
                        >
                          Cancel
                        </button>
                        <button
                          class="px-3 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                          on:click={saveParameter}
                        >
                          {editingParameter ? 'Update' : 'Add'} Parameter
                        </button>
                      </div>
                    </div>
                  {/if}
                </div>

              <!-- Preview Tab -->
              {:else if activeTab === 'preview'}
                <div class="h-full flex flex-col space-y-4" transition:slide={{ duration: 200 }}>
                  <div class="flex items-center justify-between">
                    <h3 class="text-lg font-medium">Symbol Preview</h3>
                    <div class="flex items-center space-x-4">
                      {#if validationResult}
                        <div class="text-sm">
                          Score: <span class={`font-medium ${validationResult.score >= 80 ? 'text-green-600' : validationResult.score >= 60 ? 'text-yellow-600' : 'text-red-600'}`}>
                            {validationResult.score}/100
                          </span>
                        </div>
                      {/if}
                    </div>
                  </div>
                  
                  <div class="flex-1 grid grid-cols-3 gap-6 min-h-0">
                    <!-- Symbol Preview -->
                    <div class="col-span-2">
                      <div class="h-full border border-gray-300 rounded-lg bg-gray-50 flex items-center justify-center p-8">
                        {#if symbolData.svgContent}
                          {@html symbolData.svgContent}
                        {:else}
                          <div class="text-gray-500">No SVG content to preview</div>
                        {/if}
                      </div>
                    </div>

                    <!-- Symbol Info -->
                    <div class="space-y-4">
                      <div class="bg-gray-50 p-4 rounded-lg">
                        <h4 class="font-medium mb-2">Symbol Information</h4>
                        <div class="text-sm space-y-1">
                          <div><strong>Name:</strong> {symbolData.name || 'Unnamed'}</div>
                          <div><strong>Category:</strong> {symbolData.metadata?.category || 'None'}</div>
                          <div><strong>Standard:</strong> {symbolData.metadata?.standard || 'CUSTOM'}</div>
                          <div><strong>Version:</strong> {symbolData.version || '1.0.0'}</div>
                        </div>
                      </div>

                      <div class="bg-gray-50 p-4 rounded-lg">
                        <h4 class="font-medium mb-2">Connection Points</h4>
                        <div class="text-sm">
                          {symbolData.connectionPoints?.length || 0} points
                        </div>
                        {#if symbolData.connectionPoints && symbolData.connectionPoints.length > 0}
                          <ul class="text-xs mt-2 space-y-1">
                            {#each symbolData.connectionPoints as cp}
                              <li>• {cp.name} ({cp.type})</li>
                            {/each}
                          </ul>
                        {/if}
                      </div>

                      <div class="bg-gray-50 p-4 rounded-lg">
                        <h4 class="font-medium mb-2">Parameters</h4>
                        <div class="text-sm">
                          {symbolData.properties?.parameters?.length || 0} parameters
                        </div>
                        {#if symbolData.properties?.parameters && symbolData.properties.parameters.length > 0}
                          <ul class="text-xs mt-2 space-y-1">
                            {#each symbolData.properties.parameters as param}
                              <li>• {param.name} ({param.type})</li>
                            {/each}
                          </ul>
                        {/if}
                      </div>

                      <!-- Validation Issues -->
                      {#if validationResult && (validationResult.errors.length > 0 || validationResult.warnings.length > 0)}
                        <div class="bg-yellow-50 border border-yellow-200 p-4 rounded-lg">
                          <h4 class="font-medium text-yellow-800 mb-2">Validation Issues</h4>
                          <div class="text-sm space-y-2">
                            {#each validationResult.errors as error}
                              <div class="text-red-600">❌ {error.message}</div>
                            {/each}
                            {#each validationResult.warnings as warning}
                              <div class="text-yellow-600">⚠️ {warning.message}</div>
                            {/each}
                          </div>
                        </div>
                      {/if}
                    </div>
                  </div>
                </div>
              {/if}
            </div>
          {/if}
        </div>
      </div>
    </div>
  </div>
{/if}