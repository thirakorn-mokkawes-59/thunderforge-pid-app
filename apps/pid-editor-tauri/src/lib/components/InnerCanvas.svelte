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
  import PIDSymbolNode from './PIDSymbolNode.svelte';
  import { diagram } from '$lib/stores/diagram';
  import { clipboard } from '$lib/stores/clipboard';

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

  // Track which nodes have been initialized (to distinguish from new nodes)
  // Using $: to make it reactive but stable
  let initializedNodeIds = new Set<string>();

  // Connection mode state
  let connectionMode = false;
  
  // Subscribe to grid changes - the $ prefix makes it reactive to store changes
  $: showGrid = $diagram.showGrid;
  
  // Convert diagram elements to nodes - ONLY use diagram positions for truly new nodes
  // Force reactivity on zIndex changes by including it in the reactive dependencies
  $: if (!updatingNodes && !creatingConnection) {
    // Extract zIndex values to ensure reactivity
    const zIndexValues = $diagram.elements.map(e => e.zIndex || 0);
    
    // Create a map of current node positions to preserve them
    const currentPositions = new Map();
    nodes.forEach(node => {
      currentPositions.set(node.id, node.position);
      // Mark this node as initialized
      initializedNodeIds.add(node.id);
    });
    
    // Sort elements by zIndex to ensure proper layering
    const sortedElements = [...$diagram.elements].sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));
    
    // Force re-render by creating new array
    nodes = [...sortedElements.map(element => {
        // Check if this node has been initialized before
        const isInitialized = initializedNodeIds.has(element.id);
        const existingPosition = currentPositions.get(element.id);
        
        let position;
        if (isInitialized && existingPosition) {
          // This node has been initialized, always use its current position
          position = existingPosition;
        } else {
          // This is a truly new node, calculate position from diagram coordinates
          position = {
            x: element.x - element.width / 2,
            y: element.y - element.height / 2
          };
          // Mark as initialized
          initializedNodeIds.add(element.id);
        }
        
        return {
          id: element.id,
          type: 'pidSymbol',
          position,
          data: {
            symbolPath: element.symbolPath,
            name: element.name,
            tag: element.tag,
            tagPosition: element.tagPosition,
            tagStyle: element.tagStyle,
            showTag: element.showTag,
            width: element.width,
            height: element.height,
            rotation: element.rotation || 0,
            color: element.color,
            opacity: element.opacity,
            strokeWidth: element.strokeWidth || 0.5,
            strokeLinecap: element.strokeLinecap || 'butt',
            labelFontSize: element.labelFontSize || 10,
            labelFontWeight: element.labelFontWeight || 'normal',
            labelFontStyle: element.labelFontStyle || 'normal',
            labelFontColor: element.labelFontColor || '#666666',
            labelBgColor: element.labelBgColor || 'rgba(255, 255, 255, 0.9)',
            labelOffsetX: element.labelOffsetX || 0,
            labelOffsetY: element.labelOffsetY || 0,
            tagFontSize: element.tagFontSize || 10,
            tagFontWeight: element.tagFontWeight || 'normal',
            tagFontStyle: element.tagFontStyle || 'normal',
            tagFontColor: element.tagFontColor || '#666666',
            tagBgColor: element.tagBgColor || 'rgba(255, 255, 255, 0.9)',
            tagOffsetX: element.tagOffsetX || 0,
            tagOffsetY: element.tagOffsetY || 0,
            flipX: element.flipX,
            flipY: element.flipY,
            locked: element.locked,
            showLabel: element.showLabel !== false
          },
          draggable: !nodesLocked && !element.locked,
          selectable: !nodesLocked,
          connectable: !nodesLocked,
          internals: {
            z: element.zIndex || 0
          }
        };
      })];
    
  }

  // Convert diagram connections to edges
  $: edges = $diagram.connections.map(conn => ({
    id: conn.id,
    source: conn.from.elementId,
    target: conn.to.elementId,
    sourceHandle: `handle-${conn.from.pointIndex || 0}`,
    targetHandle: `handle-${conn.to.pointIndex || 0}`,
    type: 'step', // Back to step for better P&ID appearance
    animated: false,
    style: `stroke: ${conn.style.strokeColor}; stroke-width: 0.37px;`,
    markerEnd: {
      type: MarkerType.Arrow,
      width: 8,
      height: 8,
      color: conn.style.strokeColor
    },
    interactionWidth: 0,
    // Negative offset to completely eliminate gaps
    data: { 
      offsetStart: -5,  // Extend 5px into source symbol
      offsetEnd: -5     // Extend 5px into target symbol
    }
  }));

  // Snap position to grid if enabled
  function snapToGrid(position: { x: number; y: number }) {
    if (!$diagram.snapToGrid) return position;
    
    const gridSize = $diagram.gridSize || 30; // Use grid size, default to 30
    return {
      x: Math.round(position.x / gridSize) * gridSize,
      y: Math.round(position.y / gridSize) * gridSize
    };
  }

  // Handle node drag
  function handleNodeDragStop(event: CustomEvent) {
    const node = event.detail.node;    
    // Apply snap to grid if enabled
    const snappedPosition = snapToGrid(node.position);    
    updatingNodes = true;
    
    nodes = nodes.map(n => 
      n.id === node.id 
        ? { ...n, position: snappedPosition }
        : n
    );
    
    const newX = snappedPosition.x + node.data.width / 2;
    const newY = snappedPosition.y + node.data.height / 2;    
    diagram.updateElement(node.id, {
      x: newX,
      y: newY
    });
    
    setTimeout(() => {
      updatingNodes = false;    }, 100);  }

  // Validate connections
  function isValidConnection(connection: any) {
    // Prevent self-connections
    if (connection.source === connection.target) {
      return false;
    }
    return true;
  }
  
  // Handle new connections
  const handleConnect: OnConnect = (connection) => {    
    if (!connection.source || !connection.target) return;
    
    // Prevent self-connections (double-check)
    if (connection.source === connection.target) {
      console.log('Self-connections are not allowed');
      return;
    }
    
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
    // Prevent dropping new nodes when canvas is locked
    if (nodesLocked) {      return;
    }    
    const symbolData = event.dataTransfer?.getData('application/json');    
    if (!symbolData) {
      return;
    }
    
    try {
      const symbol = JSON.parse(symbolData);      
      // Get the position relative to the canvas
      const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
      let dropPosition = {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top
      };
      
      // If flow instance is available, use it to convert to flow coordinates
      if (flowInstance && flowInstance.screenToFlowPosition) {
        dropPosition = flowInstance.screenToFlowPosition({
          x: event.clientX,
          y: event.clientY
        });      } else {      }
      
      // Apply snap to grid if enabled
      const snappedDropPosition = {
        x: dropPosition.x,
        y: dropPosition.y
      };
      
      if ($diagram.snapToGrid) {
        const gridSize = $diagram.gridSize || 30;
        // Snap the center position
        snappedDropPosition.x = Math.round(dropPosition.x / gridSize) * gridSize;
        snappedDropPosition.y = Math.round(dropPosition.y / gridSize) * gridSize;      }
      
      // Center the element at the drop position
      const element = {
        id: `element_${Date.now()}`,
        symbolId: symbol.symbolId || symbol.id,
        symbolPath: symbol.symbolPath || symbol.svgPath || symbol.path,
        name: symbol.name,
        x: snappedDropPosition.x,
        y: snappedDropPosition.y,
        width: 60,
        height: 60,
        rotation: 0,
        showLabel: true
      };      
      // Add element to diagram
      diagram.addElement(element);    } catch (error) {
      // Silently handle parse errors
    }
  }

  function handleDragOver(event: DragEvent) {
    event.preventDefault();
    if (event.dataTransfer) {
      // Allow drop only when canvas is not locked
      event.dataTransfer.dropEffect = nodesLocked ? 'none' : 'copy';
    }  }

  // Handle node selection
  function handleNodeClick(event: any) {
    // Prevent selection when canvas is locked
    if (nodesLocked) {      return;
    }    if (event && event.node) {
      const nodeId = event.node.id;      if (nodeId) {
        diagram.selectElement(nodeId);
      }
    }
  }
  
  // Handle clicking on empty canvas to deselect
  function handlePaneClick(event: any) {
    // Only deselect if not locked and not dragging/connecting
    if (!nodesLocked && !creatingConnection) {
      diagram.deselectAll();
    }
  }

  // Handle connection mode toggle
  function handleConnectionModeToggle(event: CustomEvent<{ enabled: boolean }>) {
    connectionMode = event.detail.enabled;
  }

  // Track last export trigger time to prevent duplicates
  let lastExportTrigger = 0;
  
  // Handle keyboard shortcuts
  function handleKeyDown(event: KeyboardEvent) {
    // Check if we're typing in an input field
    const target = event.target as HTMLElement;
    const isInputField = target.tagName === 'INPUT' || 
                        target.tagName === 'TEXTAREA' || 
                        target.contentEditable === 'true';
    
    // Delete selected node(s) - but not when typing in input fields
    if ((event.key === 'Delete' || event.key === 'Backspace') && !isInputField) {
      const selectedIds = Array.from($diagram.selectedIds);
      if (selectedIds.length > 0) {
        event.preventDefault();
        selectedIds.forEach(id => {          diagram.removeElement(id);
        });
      }
    }
    
    // Undo (Ctrl+Z)
    if ((event.ctrlKey || event.metaKey) && event.key === 'z' && !event.shiftKey) {
      event.preventDefault();      if (diagram.undo()) {      } else {      }
    }
    
    // Redo (Ctrl+Y or Ctrl+Shift+Z)
    if ((event.ctrlKey || event.metaKey) && (event.key === 'y' || (event.key === 'z' && event.shiftKey))) {
      event.preventDefault();      if (diagram.redo()) {      } else {      }
    }
    
    // Export (Ctrl+S)
    if ((event.ctrlKey || event.metaKey) && event.key === 's') {
      event.preventDefault();
      event.stopPropagation();
      
      // Debounce to prevent multiple triggers
      const now = Date.now();
      if (now - lastExportTrigger > 100) {
        lastExportTrigger = now;        const exportEvent = new CustomEvent('open-export-import');
        window.dispatchEvent(exportEvent);
      }
    }
    
    // Rotate selected node(s) (R key) - but not when typing in input fields
    if ((event.key === 'r' || event.key === 'R') && !isInputField) {
      const selectedIds = Array.from($diagram.selectedIds);
      if (selectedIds.length > 0) {
        event.preventDefault();
        selectedIds.forEach(id => {
          const element = $diagram.elements.find(el => el.id === id);
          if (element) {
            const currentRotation = element.rotation || 0;
            const newRotation = (currentRotation + 90) % 360;            diagram.updateElement(id, { rotation: newRotation });
          }
        });
      }
    }
    
    // Copy selected node(s) (Ctrl+C)
    if ((event.ctrlKey || event.metaKey) && event.key === 'c') {
      const selectedIds = Array.from($diagram.selectedIds);
      if (selectedIds.length > 0) {
        event.preventDefault();
        const elementsToCopy = $diagram.elements.filter(el => selectedIds.includes(el.id));
        clipboard.copy(elementsToCopy);      }
    }
    
    // Paste copied node(s) (Ctrl+V)
    if ((event.ctrlKey || event.metaKey) && event.key === 'v') {
      event.preventDefault();
      const copiedElements = clipboard.getCopiedElements();
      
      if (copiedElements.length > 0) {        
        // Clear current selection
        diagram.deselectAll();
        
        // Paste each element with an offset
        const offset = 20; // Pixels to offset pasted elements
        copiedElements.forEach((element, index) => {
          const newElement = {
            ...element,
            id: `element_${Date.now()}_${index}`,
            x: element.x + offset,
            y: element.y + offset,
            name: element.name // Will get unique name from diagram.addElement
          };
          
          diagram.addElement(newElement);
          // Select the newly pasted element
          diagram.selectElement(newElement.id, true);
        });      }
    }
  }

  // Handle right-click context menu
  let contextMenu: { x: number; y: number; nodeId?: string; isCanvas?: boolean } | null = null;
  
  function handleNodeRightClick(event: any) {    // Prevent default browser context menu
    if (event.event) {
      event.event.preventDefault();
      event.event.stopPropagation();
    }
    
    // Prevent context menu when canvas is locked
    if (nodesLocked) {      return;
    }
    
    if (event && event.node) {
      const nodeId = event.node.id;      
      // Show context menu
      contextMenu = {
        x: event.event.clientX,
        y: event.event.clientY,
        nodeId: nodeId
      };
      
      // Select the node
      diagram.selectElement(nodeId);
    }
  }
  
  function closeContextMenu() {
    contextMenu = null;
  }
  
  function handleCanvasRightClick(event: MouseEvent) {
    // Prevent default browser context menu
    event.preventDefault();
    event.stopPropagation();
    
    // Don't show menu if canvas is locked
    if (nodesLocked) {      return;
    }
    
    // Only show if we have something to paste
    const hasCopiedElements = clipboard.getCopiedElements().length > 0;
    if (!hasCopiedElements) {      return;
    }
    
    // Show canvas context menu
    contextMenu = {
      x: event.clientX,
      y: event.clientY,
      isCanvas: true
    };
  }
  
  function pasteFromMenu() {
    if (!contextMenu || !contextMenu.isCanvas) return;
    
    const copiedElements = clipboard.getCopiedElements();
    
    if (copiedElements.length > 0) {      
      // Get the position where user right-clicked (convert to flow coordinates)
      let pastePosition = { x: contextMenu.x, y: contextMenu.y };
      
      if (flowInstance && flowInstance.screenToFlowPosition) {
        pastePosition = flowInstance.screenToFlowPosition({
          x: contextMenu.x,
          y: contextMenu.y
        });
      }
      
      // Clear current selection
      diagram.deselectAll();
      
      // Calculate offset from first element's original position
      const firstElement = copiedElements[0];
      const offsetX = pastePosition.x - firstElement.x;
      const offsetY = pastePosition.y - firstElement.y;
      
      // Paste each element at the new position
      copiedElements.forEach((element, index) => {
        const newElement = {
          ...element,
          id: `element_${Date.now()}_${index}`,
          x: element.x + offsetX,
          y: element.y + offsetY,
          name: element.name
        };
        
        diagram.addElement(newElement);
        diagram.selectElement(newElement.id, true);
      });    }
    
    closeContextMenu();
  }
  
  function deleteNodeFromMenu() {
    if (contextMenu) {      diagram.removeElement(contextMenu.nodeId);
      closeContextMenu();
    }
  }
  
  function rotateNodeFromMenu() {
    if (contextMenu) {
      const element = $diagram.elements.find(el => el.id === contextMenu.nodeId);
      if (element) {
        const currentRotation = element.rotation || 0;
        const newRotation = (currentRotation + 90) % 360;        diagram.updateElement(contextMenu.nodeId, { rotation: newRotation });
      }
      closeContextMenu();
    }
  }
  
  function copyNodeFromMenu() {
    if (contextMenu) {
      const element = $diagram.elements.find(el => el.id === contextMenu.nodeId);
      if (element) {
        clipboard.copy([element]);      }
      closeContextMenu();
    }
  }
  
  function duplicateNodeFromMenu() {
    if (contextMenu) {
      const element = $diagram.elements.find(el => el.id === contextMenu.nodeId);
      if (element) {
        const newElement = {
          ...element,
          id: `element_${Date.now()}`,
          x: element.x + 20,
          y: element.y + 20,
          name: element.name // Will get unique name from diagram.addElement
        };
        
        diagram.addElement(newElement);
        diagram.selectElement(newElement.id);      }
      closeContextMenu();
    }
  }

  let flowInstance: any = null;
  let nodesLocked = false;
  
  function handleZoomChange(event: CustomEvent<{ type: 'in' | 'out' }>) {    
    if (!flowInstance) {
      return;
    }
    
    if (event.detail.type === 'in') {      flowInstance.zoomIn();
    } else {      flowInstance.zoomOut();
    }
  }
  
  function handleFitView() {
    if (!flowInstance) return;
    flowInstance.fitView();
  }
  
  function handleToggleLock(event: CustomEvent<{ locked: boolean }>) {
    nodesLocked = event.detail.locked;    
    // Clear any existing selection when locking
    if (nodesLocked) {
      diagram.deselectAll();
    }
  }

  // Store the flow instance when it's ready
  function onInit() {
    const flow = useSvelteFlow();
    flowInstance = flow;
    // Fit view on initial load after a short delay to ensure nodes are rendered
    setTimeout(() => {
      if (flowInstance && nodes.length > 0) {
        flowInstance.fitView({ padding: 0.1 });
      }
    }, 100);
  }
  
  // Handle position updates from property panel
  function handleNodePositionUpdate(event: CustomEvent) {
    const { nodeId, x, y } = event.detail;    
    // Calculate the node position (top-left corner) from center position
    const node = nodes.find(n => n.id === nodeId);
    if (node) {
      const newPosition = {
        x: x - node.data.width / 2,
        y: y - node.data.height / 2
      };
      
      // Update the node position
      updatingNodes = true;
      nodes = nodes.map(n => 
        n.id === nodeId 
          ? { ...n, position: newPosition }
          : n
      );
      
      setTimeout(() => {
        updatingNodes = false;
      }, 100);
    }
  }
  
  // Handle size updates from property panel
  function handleNodeSizeUpdate(event: CustomEvent) {
    const { nodeId, width, height } = event.detail;    
    // Find the current node
    const currentNode = nodes.find(n => n.id === nodeId);    
    // Update the node data with new size
    updatingNodes = true;
    nodes = nodes.map(n => {
      if (n.id === nodeId) {
        const updated = { 
          ...n, 
          data: { 
            ...n.data, 
            width, 
            height 
          }
        };        return updated;
      }
      return n;
    });    
    setTimeout(() => {
      updatingNodes = false;
    }, 100);
  }
  
  onMount(() => {
    window.addEventListener('toggle-connection-mode', handleConnectionModeToggle as EventListener);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('zoom-change', handleZoomChange as EventListener);
    window.addEventListener('fit-view', handleFitView);
    window.addEventListener('toggle-lock', handleToggleLock as EventListener);
    window.addEventListener('update-node-position', handleNodePositionUpdate as EventListener);
    window.addEventListener('update-node-size', handleNodeSizeUpdate as EventListener);
    
    // Close context menu on click outside
    window.addEventListener('click', closeContextMenu);
    
    return () => {
      window.removeEventListener('toggle-connection-mode', handleConnectionModeToggle as EventListener);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('zoom-change', handleZoomChange as EventListener);
      window.removeEventListener('fit-view', handleFitView);
      window.removeEventListener('toggle-lock', handleToggleLock as EventListener);
      window.removeEventListener('update-node-position', handleNodePositionUpdate as EventListener);
      window.removeEventListener('update-node-size', handleNodeSizeUpdate as EventListener);
      window.removeEventListener('click', closeContextMenu);
    };
  });
</script>

<div 
  class="flow-container" 
  on:drop={handleDrop} 
  on:dragover={handleDragOver} 
  on:dragenter|preventDefault
  on:contextmenu={handleCanvasRightClick}
>
  <SvelteFlow
    {nodes}
    {edges}
    {nodeTypes}
    oninit={onInit}
    onconnect={handleConnect}
    {isValidConnection}
    onconnectstart={(event, params) => {      creatingConnection = true;
    }}
    onconnectend={(event) => {      setTimeout(() => {
        creatingConnection = false;
      }, 100);
    }}
    onnodedrag={(event) => {      const node = event?.nodes?.[0] || event;
      if (node && node.id) {        nodes = nodes.map(n => 
          n.id === node.id 
            ? { ...n, position: node.position }
            : n
        );
      }
    }}
    onnodedragstop={(event) => {      const node = event?.nodes?.[0] || event;
      if (node && node.id) {
        handleNodeDragStop({ detail: { node } });
      }
    }}
    onnodeclick={handleNodeClick}
    onnodecontextmenu={handleNodeRightClick}
    onpaneclick={handlePaneClick}
    connectOnClick={false}
    connectionMode="loose"
    connectionLineType="step"
    connectionLineStyle="stroke: #000000; stroke-width: 0.37px;"
    fitView={false}
    preventScrolling={false}
    nodesDraggable={!creatingConnection && !nodesLocked}
    nodesConnectable={!nodesLocked}
    elementsSelectable={!nodesLocked}
    connectionRadius={0}
    minZoom={0.1}
    maxZoom={5}
    zoomOnScroll={true}
    zoomOnPinch={true}
    zoomOnDoubleClick={false}
    panOnScroll={false}
    panOnDrag={true}
    proOptions={{ hideAttribution: true }}
    deleteKeyCode={null}
    selectionKeyCode={null}
    multiSelectionKeyCode={null}
    disableKeyboardA11y={true}
    nodeOrigin={[0.5, 0.5]}
    nodesFocusable={false}
    edgesFocusable={false}
    attributionPosition="bottom-right"
  >
    {#if $diagram.showGrid}
      <Background 
        variant={BackgroundVariant.Lines} 
        gap={30} 
        color="#e5e7eb"
      />
    {/if}
  </SvelteFlow>
</div>

<!-- Context Menu -->
{#if contextMenu}
  <div 
    class="context-menu" 
    style="left: {contextMenu.x}px; top: {contextMenu.y}px;"
    on:click|stopPropagation
  >
    {#if contextMenu.isCanvas}
      <!-- Canvas context menu - just paste option -->
      <button 
        class="context-menu-item"
        on:click={pasteFromMenu}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
          <line x1="9" y1="13" x2="19" y2="13"></line>
          <line x1="9" y1="17" x2="19" y2="17"></line>
        </svg>
        Paste
      </button>
    {:else}
      <!-- Node context menu - all node options -->
      <button 
        class="context-menu-item"
        on:click={copyNodeFromMenu}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
        </svg>
        Copy
      </button>
      <button 
        class="context-menu-item"
        on:click={duplicateNodeFromMenu}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
        </svg>
        Duplicate
      </button>
      <button 
        class="context-menu-item"
        on:click={rotateNodeFromMenu}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 2v6h-6"></path>
          <path d="M3 12a9 9 0 0 1 15-6.7L21 8"></path>
          <path d="M3 22v-6h6"></path>
          <path d="M21 12a9 9 0 0 1-15 6.7L3 16"></path>
        </svg>
        Rotate 90°
      </button>
      <div class="context-menu-separator"></div>
      <button 
        class="context-menu-item context-menu-item-danger"
        on:click={deleteNodeFromMenu}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="3 6 5 6 21 6"></polyline>
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
        </svg>
        Delete
      </button>
    {/if}
  </div>
{/if}

<style>
  .flow-container {
    width: 100%;
    height: 100%;
    background: #f8f9fa;
  }
  
  /* Hide only the A11y description divs */
  :global(.a11y-hidden) {
    display: none !important;
  }
  
  /* Override the node wrapper to hide any descriptions */
  :global(.svelte-flow__node) {
    font-size: inherit !important;
  }
  
  :global(.svelte-flow__node::before),
  :global(.svelte-flow__node::after) {
    content: '' !important;
    display: none !important;
  }
  
  /* Hide description that appears on focus */
  :global(.svelte-flow__node:focus::before),
  :global(.svelte-flow__node:focus::after),
  :global(.svelte-flow__node:focus-visible::before),
  :global(.svelte-flow__node:focus-visible::after) {
    display: none !important;
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
  
  /* Remove ALL selection and hover effects */
  :global(.svelte-flow__node.selected),
  :global(.svelte-flow__node.selected:hover),
  :global(.svelte-flow__node:hover),
  :global(.svelte-flow__node.dragging),
  :global(.svelte-flow__node.dragging:hover),
  :global(.svelte-flow__node.selected.dragging) {
    box-shadow: none !important;
    outline: none !important;
    border: none !important;
  }
  
  :global(.svelte-flow__node:focus) {
    outline: none !important;
    box-shadow: none !important;
  }
  
  :global(.svelte-flow__node:focus-visible) {
    outline: none !important;
    box-shadow: none !important;
  }
  
  /* Remove any transition effects that might cause flashing */
  :global(.svelte-flow__node) {
    transition: none !important;
  }

  /* Style the control buttons icons */
  :global(.svelte-flow__controls-button svg) {
    fill: #1f2937 !important;
  }
  
  :global(.svelte-flow__controls-button) {
    color: #1f2937 !important;
  }
  
  /* Context Menu Styles */
  .context-menu {
    position: fixed;
    background: white;
    border: 1px solid #e5e7eb;
    border-radius: 6px;
    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
    padding: 4px;
    z-index: 10000;
    min-width: 150px;
  }
  
  .context-menu-item {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 8px 12px;
    background: transparent;
    border: none;
    border-radius: 4px;
    font-size: 14px;
    color: #374151;
    cursor: pointer;
    transition: background-color 0.2s;
    text-align: left;
  }
  
  .context-menu-item:hover {
    background-color: #f3f4f6;
  }
  
  .context-menu-item svg {
    flex-shrink: 0;
  }
  
  .context-menu-separator {
    height: 1px;
    background: #e5e7eb;
    margin: 4px 0;
  }
  
  .context-menu-item-danger:hover {
    background-color: #fee2e2;
    color: #dc2626;
  }
</style>