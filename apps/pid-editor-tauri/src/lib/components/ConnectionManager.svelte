<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { connectionRouter, type ConnectionPoint, type Point } from '../services/ConnectionRouter';
  import { connectionValidator, type ConnectionData, type ValidationResult } from '../services/ConnectionValidator';
  
  export let nodes: any[] = [];
  export let connections: any[] = [];
  export let selectedConnection: string | null = null;
  export let isConnecting = false;
  export let connectionPreview: { source: Point; target: Point } | null = null;

  // Connection creation state
  let sourceConnectionPoint: ConnectionPoint | null = null;
  let dragTarget: Point | null = null;
  let previewPath: Point[] = [];
  
  // Validation results
  let validationResults: Map<string, ValidationResult> = new Map();
  let showValidationPanel = false;

  // Connection properties dialog
  let showPropertiesDialog = false;
  let editingConnection: ConnectionData | null = null;

  interface ConnectionStyle {
    stroke: string;
    strokeWidth: number;
    strokeDasharray?: string;
    opacity: number;
  }

  // Subscribe to router and validator updates
  onMount(() => {
    // Register all nodes as obstacles and connection points
    updateObstaclesAndConnectionPoints();
    
    // Set up event listeners
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  });

  onDestroy(() => {
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  });

  // Reactive updates
  $: {
    updateObstaclesAndConnectionPoints();
    validateAllConnections();
  }

  $: if (connectionPreview && isConnecting) {
    updatePreviewPath();
  }

  function updateObstaclesAndConnectionPoints() {
    connectionRouter.clear();
    
    // Register nodes as obstacles
    nodes.forEach(node => {
      connectionRouter.registerObstacle({
        id: node.id,
        bounds: {
          x: node.position.x,
          y: node.position.y,
          width: node.measured?.width || 100,
          height: node.measured?.height || 50
        },
        type: 'node'
      });

      // Register connection points
      if (node.data.connectionPoints) {
        node.data.connectionPoints.forEach((point: any) => {
          connectionRouter.registerConnectionPoint({
            id: `${node.id}-${point.id}`,
            position: {
              x: node.position.x + point.x,
              y: node.position.y + point.y
            },
            direction: point.direction,
            type: point.type,
            occupied: point.occupied || false,
            nodeId: node.id
          });
        });
      }
    });

    // Register existing connections as obstacles
    connections.forEach(connection => {
      if (connection.path && connection.path.length > 1) {
        // Create simplified bounding box for connection path
        const bounds = calculatePathBounds(connection.path);
        connectionRouter.registerObstacle({
          id: `connection-${connection.id}`,
          bounds,
          type: 'connection'
        });
      }
    });
  }

  function calculatePathBounds(path: Point[]): { x: number; y: number; width: number; height: number } {
    const xs = path.map(p => p.x);
    const ys = path.map(p => p.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    
    return {
      x: minX - 5,
      y: minY - 5,
      width: maxX - minX + 10,
      height: maxY - minY + 10
    };
  }

  function validateAllConnections() {
    const connectionData = connections.map(conn => convertToConnectionData(conn));
    const results = connectionValidator.validateConnections(connectionData);
    validationResults = results.results;
  }

  function convertToConnectionData(connection: any): ConnectionData {
    const sourceNode = nodes.find(n => n.id === connection.source);
    const targetNode = nodes.find(n => n.id === connection.target);
    
    return {
      id: connection.id,
      source: {
        nodeId: connection.source,
        nodeType: sourceNode?.type || 'unknown',
        connectionPoint: sourceNode?.data.connectionPoints?.find((p: any) => p.id === connection.sourceHandle) || {
          id: connection.sourceHandle,
          position: { x: 0, y: 0 },
          direction: 'east',
          type: 'output',
          occupied: true,
          nodeId: connection.source
        },
        properties: sourceNode?.data || {}
      },
      target: {
        nodeId: connection.target,
        nodeType: targetNode?.type || 'unknown',
        connectionPoint: targetNode?.data.connectionPoints?.find((p: any) => p.id === connection.targetHandle) || {
          id: connection.targetHandle,
          position: { x: 0, y: 0 },
          direction: 'west',
          type: 'input',
          occupied: true,
          nodeId: connection.target
        },
        properties: targetNode?.data || {}
      },
      connectionType: {
        name: connection.type || 'process',
        allowedSources: [],
        allowedTargets: [],
        requiredProperties: [],
        restrictions: {}
      },
      properties: connection.data || {
        lineType: 'process'
      },
      path: connection.path
    };
  }

  function startConnection(nodeId: string, connectionPointId: string, event: MouseEvent) {
    if (isConnecting) return;

    const connectionPoints = connectionRouter.getConnectionPoints();
    sourceConnectionPoint = connectionPoints.find(cp => 
      cp.nodeId === nodeId && cp.id.endsWith(connectionPointId)
    ) || null;

    if (sourceConnectionPoint && !sourceConnectionPoint.occupied) {
      isConnecting = true;
      dragTarget = { x: event.clientX, y: event.clientY };
      updatePreviewPath();
    }
  }

  function handleMouseMove(event: MouseEvent) {
    if (!isConnecting || !sourceConnectionPoint) return;

    dragTarget = { x: event.clientX, y: event.clientY };
    updatePreviewPath();
  }

  function handleMouseUp(event: MouseEvent) {
    if (!isConnecting || !sourceConnectionPoint || !dragTarget) return;

    // Find target connection point under cursor
    const targetElement = document.elementFromPoint(event.clientX, event.clientY);
    const targetConnectionPointId = targetElement?.getAttribute('data-connection-point-id');
    const targetNodeId = targetElement?.getAttribute('data-node-id');

    if (targetConnectionPointId && targetNodeId) {
      const connectionPoints = connectionRouter.getConnectionPoints();
      const targetConnectionPoint = connectionPoints.find(cp => 
        cp.nodeId === targetNodeId && cp.id.endsWith(targetConnectionPointId)
      );

      if (targetConnectionPoint && !targetConnectionPoint.occupied) {
        createConnection(sourceConnectionPoint, targetConnectionPoint);
      }
    }

    // Reset connection state
    isConnecting = false;
    sourceConnectionPoint = null;
    dragTarget = null;
    previewPath = [];
    connectionPreview = null;
  }

  function updatePreviewPath() {
    if (!sourceConnectionPoint || !dragTarget) return;

    const result = connectionRouter.routeConnection(
      sourceConnectionPoint.position,
      dragTarget,
      { avoidObstacles: true, preferStraightLines: true }
    );

    previewPath = result.path;
    connectionPreview = {
      source: sourceConnectionPoint.position,
      target: dragTarget
    };
  }

  function createConnection(source: ConnectionPoint, target: ConnectionPoint) {
    // Route the connection
    const routingResult = connectionRouter.routeConnectionPoints(source, target);

    if (!routingResult.valid) {
      console.warn('Failed to route connection:', routingResult.obstacles);
      return;
    }

    // Create connection data
    const connectionData: ConnectionData = {
      id: `connection-${Date.now()}`,
      source: {
        nodeId: source.nodeId,
        nodeType: nodes.find(n => n.id === source.nodeId)?.type || 'unknown',
        connectionPoint: source,
        properties: {}
      },
      target: {
        nodeId: target.nodeId,
        nodeType: nodes.find(n => n.id === target.nodeId)?.type || 'unknown',
        connectionPoint: target,
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
      },
      path: routingResult.path
    };

    // Validate the connection
    const validationResult = connectionValidator.validateConnection(connectionData);

    if (!validationResult.valid) {
      const errors = validationResult.issues.filter(i => i.severity === 'error');
      if (errors.length > 0) {
        alert(`Cannot create connection: ${errors[0].message}`);
        return;
      }
    }

    // Add to connections array
    connections = [...connections, {
      id: connectionData.id,
      source: source.nodeId,
      target: target.nodeId,
      sourceHandle: source.id.split('-').pop(),
      targetHandle: target.id.split('-').pop(),
      type: 'default',
      data: connectionData.properties,
      path: routingResult.path
    }];

    // Mark connection points as occupied
    source.occupied = true;
    target.occupied = true;

    // Store validation result
    validationResults.set(connectionData.id, validationResult);
  }

  function deleteConnection(connectionId: string) {
    const connection = connections.find(c => c.id === connectionId);
    if (!connection) return;

    // Free up connection points
    const connectionPoints = connectionRouter.getConnectionPoints();
    const sourcePoint = connectionPoints.find(cp => 
      cp.nodeId === connection.source && cp.id.endsWith(connection.sourceHandle)
    );
    const targetPoint = connectionPoints.find(cp => 
      cp.nodeId === connection.target && cp.id.endsWith(connection.targetHandle)
    );

    if (sourcePoint) sourcePoint.occupied = false;
    if (targetPoint) targetPoint.occupied = false;

    // Remove from connections
    connections = connections.filter(c => c.id !== connectionId);
    
    // Remove validation result
    validationResults.delete(connectionId);
  }

  function editConnectionProperties(connectionId: string) {
    const connection = connections.find(c => c.id === connectionId);
    if (!connection) return;

    editingConnection = convertToConnectionData(connection);
    showPropertiesDialog = true;
  }

  function saveConnectionProperties() {
    if (!editingConnection) return;

    // Update connection data
    const connectionIndex = connections.findIndex(c => c.id === editingConnection.id);
    if (connectionIndex >= 0) {
      connections[connectionIndex].data = editingConnection.properties;
      connections = [...connections];
    }

    // Re-validate
    const validationResult = connectionValidator.validateConnection(editingConnection);
    validationResults.set(editingConnection.id, validationResult);

    showPropertiesDialog = false;
    editingConnection = null;
  }

  function getConnectionStyle(connectionId: string): ConnectionStyle {
    const validation = validationResults.get(connectionId);
    
    if (!validation) {
      return { stroke: '#666', strokeWidth: 2, opacity: 1 };
    }

    const hasErrors = validation.issues.some(i => i.severity === 'error');
    const hasWarnings = validation.issues.some(i => i.severity === 'warning');

    if (hasErrors) {
      return { 
        stroke: '#ef4444', 
        strokeWidth: 2, 
        strokeDasharray: '5,5',
        opacity: 0.8 
      };
    }

    if (hasWarnings) {
      return { 
        stroke: '#f59e0b', 
        strokeWidth: 2, 
        opacity: 0.9 
      };
    }

    // Color based on score
    const score = validation.score;
    if (score >= 90) {
      return { stroke: '#10b981', strokeWidth: 2, opacity: 1 };
    } else if (score >= 70) {
      return { stroke: '#3b82f6', strokeWidth: 2, opacity: 1 };
    } else {
      return { stroke: '#6b7280', strokeWidth: 2, opacity: 0.8 };
    }
  }

  function formatPath(path: Point[]): string {
    if (path.length < 2) return '';
    
    return `M ${path[0].x} ${path[0].y} ` + 
           path.slice(1).map(p => `L ${p.x} ${p.y}`).join(' ');
  }
</script>

<!-- Connection SVG Layer -->
<svg class="absolute inset-0 pointer-events-none" style="z-index: 1;">
  <defs>
    <marker id="arrowhead" markerWidth="10" markerHeight="7" 
            refX="9" refY="3.5" orient="auto">
      <polygon points="0 0, 10 3.5, 0 7" fill="#666" />
    </marker>
  </defs>

  <!-- Existing connections -->
  {#each connections as connection (connection.id)}
    {#if connection.path}
      {@const style = getConnectionStyle(connection.id)}
      <path
        d={formatPath(connection.path)}
        stroke={style.stroke}
        stroke-width={style.strokeWidth}
        stroke-dasharray={style.strokeDasharray}
        opacity={style.opacity}
        fill="none"
        marker-end="url(#arrowhead)"
        class="cursor-pointer"
        class:selected={selectedConnection === connection.id}
        on:click={() => selectedConnection = connection.id}
        on:dblclick={() => editConnectionProperties(connection.id)}
      />
    {/if}
  {/each}

  <!-- Preview connection -->
  {#if isConnecting && previewPath.length > 0}
    <path
      d={formatPath(previewPath)}
      stroke="#3b82f6"
      stroke-width="2"
      stroke-dasharray="3,3"
      opacity="0.6"
      fill="none"
      class="pointer-events-none"
    />
  {/if}
</svg>

<!-- Connection Points -->
{#each nodes as node}
  {#if node.data.connectionPoints}
    {#each node.data.connectionPoints as point}
      <div
        class="absolute w-3 h-3 border-2 border-blue-500 bg-white rounded-full cursor-pointer transition-colors hover:bg-blue-100"
        class:occupied={point.occupied}
        class:bg-green-100={!point.occupied}
        class:border-green-500={!point.occupied}
        style="left: {node.position.x + point.x - 6}px; top: {node.position.y + point.y - 6}px; z-index: 10;"
        data-connection-point-id={point.id}
        data-node-id={node.id}
        on:mousedown={(e) => startConnection(node.id, point.id, e)}
      />
    {/each}
  {/if}
{/each}

<!-- Validation Panel -->
{#if showValidationPanel}
  <div class="fixed top-4 right-4 w-80 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
    <div class="p-4 border-b border-gray-200">
      <div class="flex items-center justify-between">
        <h3 class="font-semibold">Connection Validation</h3>
        <button
          class="text-gray-500 hover:text-gray-700"
          on:click={() => showValidationPanel = false}
        >
          ×
        </button>
      </div>
    </div>
    
    <div class="p-4 max-h-96 overflow-y-auto">
      {#each Array.from(validationResults.entries()) as [connectionId, result]}
        {@const connection = connections.find(c => c.id === connectionId)}
        {#if connection}
          <div class="mb-4 p-3 border border-gray-200 rounded">
            <div class="flex items-center justify-between mb-2">
              <span class="text-sm font-medium">Connection {connectionId.slice(-6)}</span>
              <span class="text-xs px-2 py-1 rounded"
                    class:bg-green-100={result.valid}
                    class:text-green-800={result.valid}
                    class:bg-red-100={!result.valid}
                    class:text-red-800={!result.valid}>
                Score: {result.score}/100
              </span>
            </div>
            
            {#if result.issues.length > 0}
              <div class="space-y-1">
                {#each result.issues as issue}
                  <div class="text-xs p-2 rounded"
                       class:bg-red-50={issue.severity === 'error'}
                       class:text-red-700={issue.severity === 'error'}
                       class:bg-yellow-50={issue.severity === 'warning'}
                       class:text-yellow-700={issue.severity === 'warning'}
                       class:bg-blue-50={issue.severity === 'info'}
                       class:text-blue-700={issue.severity === 'info'}>
                    {issue.message}
                  </div>
                {/each}
              </div>
            {/if}
            
            {#if result.suggestions.length > 0}
              <div class="mt-2">
                <div class="text-xs font-medium text-gray-600 mb-1">Suggestions:</div>
                {#each result.suggestions as suggestion}
                  <div class="text-xs text-gray-600">• {suggestion}</div>
                {/each}
              </div>
            {/if}
          </div>
        {/if}
      {/each}
    </div>
  </div>
{/if}

<!-- Connection Properties Dialog -->
{#if showPropertiesDialog && editingConnection}
  <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
    <div class="bg-white rounded-lg shadow-lg w-96 max-h-[90vh] overflow-y-auto">
      <div class="p-4 border-b border-gray-200">
        <h3 class="font-semibold">Connection Properties</h3>
      </div>
      
      <div class="p-4 space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Line Type</label>
          <select
            bind:value={editingConnection.properties.lineType}
            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="process">Process</option>
            <option value="instrument">Instrument</option>
            <option value="electrical">Electrical</option>
            <option value="pneumatic">Pneumatic</option>
            <option value="hydraulic">Hydraulic</option>
          </select>
        </div>

        {#if editingConnection.properties.lineType === 'process'}
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Medium</label>
            <input
              type="text"
              bind:value={editingConnection.properties.medium}
              placeholder="e.g., Water, Steam, Oil"
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Diameter (inches)</label>
            <input
              type="number"
              bind:value={editingConnection.properties.diameter}
              step="0.5"
              min="0.5"
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Material</label>
            <select
              bind:value={editingConnection.properties.material}
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select material</option>
              <option value="carbon-steel">Carbon Steel</option>
              <option value="stainless-steel">Stainless Steel</option>
              <option value="pvc">PVC</option>
              <option value="copper">Copper</option>
            </select>
          </div>

          <div class="flex items-center">
            <input
              type="checkbox"
              bind:checked={editingConnection.properties.insulated}
              class="mr-2"
            />
            <label class="text-sm text-gray-700">Insulated</label>
          </div>

          <div class="flex items-center">
            <input
              type="checkbox"
              bind:checked={editingConnection.properties.traced}
              class="mr-2"
            />
            <label class="text-sm text-gray-700">Heat Traced</label>
          </div>
        {/if}
      </div>
      
      <div class="p-4 border-t border-gray-200 flex justify-end space-x-2">
        <button
          class="px-4 py-2 text-gray-600 border border-gray-300 rounded hover:bg-gray-50"
          on:click={() => showPropertiesDialog = false}
        >
          Cancel
        </button>
        <button
          class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          on:click={saveConnectionProperties}
        >
          Save
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- Controls -->
<div class="fixed bottom-4 left-4 flex space-x-2 z-40">
  <button
    class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 flex items-center space-x-2"
    on:click={() => showValidationPanel = !showValidationPanel}
  >
    <span>Validation</span>
    {#if Array.from(validationResults.values()).some(r => !r.valid)}
      <span class="bg-red-500 text-white text-xs px-2 py-1 rounded-full">
        {Array.from(validationResults.values()).filter(r => !r.valid).length}
      </span>
    {/if}
  </button>

  {#if selectedConnection}
    <button
      class="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
      on:click={() => {
        deleteConnection(selectedConnection);
        selectedConnection = null;
      }}
    >
      Delete Connection
    </button>

    <button
      class="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
      on:click={() => editConnectionProperties(selectedConnection)}
    >
      Edit Properties
    </button>
  {/if}
</div>

<style>
  .selected {
    stroke-width: 3;
    filter: drop-shadow(0 0 4px rgba(59, 130, 246, 0.5));
  }

  .occupied {
    background-color: #fee2e2;
    border-color: #dc2626;
  }
</style>