<script lang="ts">
  import { onMount } from 'svelte';
  import {
    SvelteFlow,
    Background,
    type Node,
    type Edge,
    type Connection,
    type NodeTypes,
    type OnConnect,
    BackgroundVariant,
    MarkerType,
    useSvelteFlow
  } from '@xyflow/svelte';
  import '@xyflow/svelte/dist/style.css';
  import PIDSymbolNode from './PIDSymbolNode.svelte';
  import { diagram } from '$lib/stores/diagram';

  // Get the flow utilities from the provider
  const { zoomIn, zoomOut, fitView, getZoom, setCenter } = useSvelteFlow();

  // Define custom node types
  const nodeTypes: NodeTypes = {
    pidSymbol: PIDSymbolNode
  };

  // Initialize arrays for nodes and edges
  let nodes: Node[] = [];
  let edges: Edge[] = [];

  // Track if we're updating nodes programmatically
  let updatingNodes = false;
  let creatingConnection = false;

  // Connection mode state
  let connectionMode = false;

  // Convert diagram elements to nodes
  $: if (!updatingNodes && !creatingConnection) {
    nodes = $diagram.elements.map(element => ({
      id: element.id,
      type: 'pidSymbol',
      position: { 
        x: element.x - element.width / 2,
        y: element.y - element.height / 2
      },
      data: {
        symbolPath: element.symbolPath,
        name: element.name,
        width: element.width,
        height: element.height,
        rotation: element.rotation || 0,
        showLabel: element.showLabel !== false
      }
    }));
  }

  // Convert diagram connections to edges
  $: edges = $diagram.connections.map(conn => ({
    id: conn.id,
    source: conn.from.elementId,
    target: conn.to.elementId,
    sourceHandle: `handle-${conn.from.pointIndex || 0}`,
    targetHandle: `handle-${conn.to.pointIndex || 0}`,
    type: 'step',
    animated: false,
    style: `stroke: ${conn.style.strokeColor}; stroke-width: 0.37px;`,
    markerEnd: {
      type: MarkerType.Arrow,
      width: 10,
      height: 10,
      color: conn.style.strokeColor
    },
    interactionWidth: 0,
    data: { offsetEnd: 5 }
  }));

  // Handle node drag
  function handleNodeDragStop(event: CustomEvent) {
    const node = event.detail.node;
    updatingNodes = true;
    
    nodes = nodes.map(n => 
      n.id === node.id 
        ? { ...n, position: node.position }
        : n
    );
    
    diagram.updateElement(node.id, {
      x: node.position.x + node.data.width / 2,
      y: node.position.y + node.data.height / 2
    });
    
    setTimeout(() => {
      updatingNodes = false;
    }, 100);
  }

  // Handle new connections
  const handleConnect: OnConnect = (connection) => {
    console.log('Connection attempt:', connection);
    if (!connection.source || !connection.target) return;
    
    creatingConnection = true;
    
    const sourceMatch = connection.sourceHandle?.match(/handle-(\d+)/);
    const targetMatch = connection.targetHandle?.match(/handle-(\d+)/);
    
    const newConnection = {
      id: `connection_${Date.now()}`,
      from: {
        elementId: connection.source,
        pointIndex: sourceMatch ? parseInt(sourceMatch[1]) : 0,
        type: 'bidirectional' as const,
        x: 0,
        y: 0
      },
      to: {
        elementId: connection.target,
        pointIndex: targetMatch ? parseInt(targetMatch[1]) : 0,
        type: 'bidirectional' as const,
        x: 0,
        y: 0
      },
      path: '',
      style: {
        strokeWidth: 2,
        strokeColor: '#000000'
      },
      routing: 'direct' as any
    };
    
    diagram.addConnection(newConnection);
    
    setTimeout(() => {
      creatingConnection = false;
    }, 100);
  };

  // Handle drop for new symbols
  function handleDrop(event: DragEvent) {
    event.preventDefault();
    
    const symbolData = event.dataTransfer?.getData('application/json');
    if (!symbolData) return;
    
    const symbol = JSON.parse(symbolData);
    
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    
    const element = {
      id: `element_${Date.now()}`,
      symbolId: symbol.symbolId || symbol.id,
      symbolPath: symbol.symbolPath || symbol.svgPath || symbol.path,
      name: symbol.name,
      x: x,
      y: y,
      width: 60,
      height: 60,
      rotation: 0,
      showLabel: true
    };
    
    diagram.addElement(element);
  }

  function handleDragOver(event: DragEvent) {
    event.preventDefault();
    event.dataTransfer!.dropEffect = 'copy';
  }

  // Handle node selection
  function handleNodeClick(event: any) {
    console.log('Node clicked event:', event);
    if (event && event.node) {
      const nodeId = event.node.id;
      console.log('Selecting node:', nodeId);
      if (nodeId) {
        diagram.selectElement(nodeId);
      }
    }
  }

  // Handle keyboard shortcuts for zoom using library methods
  function handleKeyDown(event: KeyboardEvent) {
    // Check if Ctrl (Windows/Linux) or Cmd (Mac) is pressed
    if (event.ctrlKey || event.metaKey) {
      const key = event.key.toLowerCase();
      const code = event.code;
      
      // Zoom in - using SvelteFlow's built-in method
      if (key === '+' || key === '=' || code === 'Equal' || code === 'NumpadAdd') {
        event.preventDefault();
        zoomIn({ duration: 200 });
        console.log('Zoomed in, new zoom:', getZoom());
        return;
      }
      
      // Zoom out - using SvelteFlow's built-in method
      if (key === '-' || key === '_' || code === 'Minus' || code === 'NumpadSubtract') {
        event.preventDefault();
        zoomOut({ duration: 200 });
        console.log('Zoomed out, new zoom:', getZoom());
        return;
      }
      
      // Fit to view
      if (key === '0' || code === 'Digit0' || code === 'Numpad0') {
        event.preventDefault();
        if (nodes.length > 0) {
          fitView({ padding: 0.2, duration: 300 });
        } else {
          // Reset to center with default zoom
          setCenter(0, 0, { zoom: 1, duration: 300 });
        }
        console.log('Fit to view');
        return;
      }
    }
  }

  // Handle connection mode toggle
  function handleConnectionModeToggle(event: CustomEvent<{ enabled: boolean }>) {
    connectionMode = event.detail.enabled;
  }

  onMount(() => {
    window.addEventListener('toggle-connection-mode', handleConnectionModeToggle as EventListener);
    window.addEventListener('keydown', handleKeyDown);
    
    return () => {
      window.removeEventListener('toggle-connection-mode', handleConnectionModeToggle as EventListener);
      window.removeEventListener('keydown', handleKeyDown);
    };
  });
</script>

<div class="flow-container" on:drop={handleDrop} on:dragover={handleDragOver}>
  <SvelteFlow
    {nodes}
    {edges}
    {nodeTypes}
    onconnect={handleConnect}
    onconnectstart={(event, params) => {
      console.log('Connection start:', params);
      creatingConnection = true;
    }}
    onconnectend={(event) => {
      console.log('Connection end');
      setTimeout(() => {
        creatingConnection = false;
      }, 100);
    }}
    on:nodedrag={(event) => {
      const node = event.detail.node;
      nodes = nodes.map(n => 
        n.id === node.id 
          ? { ...n, position: node.position }
          : n
      );
    }}
    on:nodedragstop={handleNodeDragStop}
    onnodeclick={handleNodeClick}
    connectOnClick={false}
    connectionMode="loose"
    connectionLineType="step"
    connectionLineStyle="stroke: #000000; stroke-width: 0.37px;"
    fitView={false}
    preventScrolling={false}
    nodesDraggable={!creatingConnection}
    nodesConnectable={true}
    elementsSelectable={true}
    connectionRadius={0}
    minZoom={0.1}
    maxZoom={5}
    zoomOnScroll={true}
    zoomOnPinch={true}
    zoomOnDoubleClick={false}
    panOnScroll={false}
    panOnDrag={true}
  >
    <Background variant={BackgroundVariant.Dots} gap={20} size={1} />
  </SvelteFlow>
</div>

<style>
  .flow-container {
    width: 100%;
    height: 100%;
    background: #f8f9fa;
  }
  
  :global(.svelte-flow) {
    background: #ffffff;
  }
  
  :global(.svelte-flow__edge-path) {
    stroke-width: 0.37;
  }
  
  :global(.svelte-flow__edges) {
    z-index: 1000 !important;
  }
  
  :global(.svelte-flow__edge) {
    z-index: 1000 !important;
  }
  
  :global(.svelte-flow__nodes) {
    z-index: 1 !important;
  }
  
  :global(.svelte-flow__node) {
    z-index: 1 !important;
    padding: 0 !important;
    overflow: visible !important;
  }
</style>