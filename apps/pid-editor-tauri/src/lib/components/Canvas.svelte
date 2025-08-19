<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import * as d3 from 'd3';
  import { diagram } from '$lib/stores/diagram';
  import type { DiagramElement, Connection } from '$lib/types/diagram';
  import { RoutingAlgorithm } from '$lib/types/diagram';
  import type { SimpleConnectionPoint } from '$lib/utils/simpleConnectionParser';
  
  let container: HTMLDivElement;
  let svg: d3.Selection<SVGSVGElement, unknown, null, undefined>;
  let g: d3.Selection<SVGGElement, unknown, null, undefined>;
  let gridLayer: d3.Selection<SVGGElement, unknown, null, undefined>;
  let symbolLayer: d3.Selection<SVGGElement, unknown, null, undefined>;
  let connectionLayer: d3.Selection<SVGGElement, unknown, null, undefined>;
  let selectionLayer: d3.Selection<SVGGElement, unknown, null, undefined>;
  
  let currentTransform = d3.zoomIdentity;
  
  // Connection drawing state
  let connectionMode = false;
  let isDrawingConnection = false;
  let currentConnection: { from: SimpleConnectionPoint | null; to: SimpleConnectionPoint | null; fromElementId?: string } = { from: null, to: null };
  let previewLine: d3.Selection<SVGLineElement, unknown, null, undefined> | null = null;
  
  onMount(() => {
    console.log('Canvas mounted, initializing...');
    initCanvas();
    setupZoomBehavior();
    setupDragBehavior();
    setupDropZone();
    
    // Listen for connection mode toggle
    window.addEventListener('toggle-connection-mode', handleConnectionModeToggle as EventListener);
    
    // Subscribe to diagram changes
    const unsubscribe = diagram.subscribe(state => {
      console.log('Diagram state changed, elements:', state.elements.length, 'connections:', state.connections.length);
      updateElements(state.elements);
      updateConnections(state.connections);
      updateGrid(state.showGrid);
    });
    
    return () => {
      unsubscribe();
      window.removeEventListener('toggle-connection-mode', handleConnectionModeToggle as EventListener);
    };
  });
  
  function handleConnectionModeToggle(event: CustomEvent) {
    connectionMode = event.detail?.enabled ?? !connectionMode;
    console.log('Canvas: Connection mode toggled to:', connectionMode);
    
    // Add visual indicator
    if (container) {
      container.style.cursor = connectionMode ? 'crosshair' : 'default';
    }
    
    // Update all T-shapes in existing symbols
    symbolLayer.selectAll('.symbol').each(function() {
      const symbolGroup = d3.select(this);
      
      // Find T-shapes within the nested SVG
      symbolGroup.selectAll('.symbol-content svg')
        .selectAll('[stroke="#ff0000"], [stroke="rgb(255,0,0)"], [stroke="red"], .connection-t-shape')
        .classed('connection-t-shape', true)
        .style('display', connectionMode ? 'block' : 'none')
        .style('stroke', connectionMode ? '#1e3a8a' : '#ff0000')
        .style('stroke-width', connectionMode ? 1.5 : 0.5)
        .style('cursor', connectionMode ? 'pointer' : 'default')
        .on('mouseover', function() {
          if (connectionMode) {
            d3.select(this).style('stroke', '#3b82f6').style('stroke-width', 2);
          }
        })
        .on('mouseout', function() {
          if (connectionMode) {
            d3.select(this).style('stroke', '#1e3a8a').style('stroke-width', 1.5);
          }
        });
    });
    
    if (!connectionMode) {
      // Clear any connection state when leaving connection mode
      cleanupConnection();
    } else {
      console.log('Canvas: Entered connection mode - T-shapes are now clickable');
    }
  }
  
  function initCanvas() {
    if (!container) {
      console.error('Container not found!');
      return;
    }
    const width = container.clientWidth;
    const height = container.clientHeight;
    console.log('Canvas dimensions:', width, height);
    
    svg = d3.select(container)
      .append('svg')
      .attr('width', width)
      .attr('height', height)
      .attr('class', 'diagram-canvas');
    
    // Create main group for transformations
    g = svg.append('g');
    
    // Create layers in order (back to front)
    gridLayer = g.append('g').attr('class', 'grid-layer');
    connectionLayer = g.append('g').attr('class', 'connection-layer');
    symbolLayer = g.append('g').attr('class', 'symbol-layer');
    selectionLayer = g.append('g').attr('class', 'selection-layer');
    
    // Draw initial grid
    drawGrid();
    
    // Add background click handler
    svg.on('click', function(event) {
      // Click on background - clear selections
      if (connectionMode) {
        cleanupConnection();
      } else {
        diagram.clearSelection();
      }
    });
  }
  
  function drawGrid() {
    const gridSize = 20;
    const width = container.clientWidth;
    const height = container.clientHeight;
    
    // Clear existing grid
    gridLayer.selectAll('*').remove();
    
    // Add grid pattern
    const defs = svg.append('defs');
    
    defs.append('pattern')
      .attr('id', 'grid')
      .attr('width', gridSize)
      .attr('height', gridSize)
      .attr('patternUnits', 'userSpaceOnUse')
      .append('path')
      .attr('d', `M ${gridSize} 0 L 0 0 0 ${gridSize}`)
      .attr('fill', 'none')
      .attr('stroke', '#e5e7eb')
      .attr('stroke-width', 0.5);
    
    gridLayer.append('rect')
      .attr('width', width * 10)
      .attr('height', height * 10)
      .attr('x', -width * 5)
      .attr('y', -height * 5)
      .attr('fill', 'url(#grid)');
  }
  
  function updateGrid(show: boolean) {
    gridLayer.style('display', show ? 'block' : 'none');
  }
  
  function setupZoomBehavior() {
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 10])
      .on('zoom', (event) => {
        currentTransform = event.transform;
        g.attr('transform', currentTransform.toString());
        diagram.setZoom(currentTransform.k);
        diagram.setPan({ x: currentTransform.x, y: currentTransform.y });
      });
    
    svg.call(zoom);
    
    // Add zoom controls
    d3.select(container)
      .append('div')
      .attr('class', 'zoom-controls')
      .html(`
        <button id="zoom-in">+</button>
        <button id="zoom-out">-</button>
        <button id="zoom-reset">Reset</button>
      `);
    
    d3.select('#zoom-in').on('click', () => {
      svg.transition().call(zoom.scaleBy, 1.2);
    });
    
    d3.select('#zoom-out').on('click', () => {
      svg.transition().call(zoom.scaleBy, 0.8);
    });
    
    d3.select('#zoom-reset').on('click', () => {
      svg.transition().call(zoom.transform, d3.zoomIdentity);
    });
  }
  
  function setupDragBehavior() {
    const drag = d3.drag<SVGGElement, DiagramElement>()
      .on('start', function(event, d) {
        d3.select(this).raise().classed('dragging', true);
        diagram.selectElement(d.id, event.sourceEvent.shiftKey);
      })
      .on('drag', function(event, d) {
        const x = event.x;
        const y = event.y;
        
        // Snap to grid if enabled
        const snappedX = $diagram.snapToGrid ? Math.round(x / 20) * 20 : x;
        const snappedY = $diagram.snapToGrid ? Math.round(y / 20) * 20 : y;
        
        // Store the old position before updating
        const oldX = d.x;
        const oldY = d.y;
        
        d3.select(this)
          .attr('transform', `translate(${snappedX}, ${snappedY})`);
        
        // Update connections BEFORE updating the element in store
        // Pass the old position so we can calculate correct offsets
        updateConnectionsForElement(d.id, oldX, oldY, snappedX, snappedY);
        
        // Now update the element in the store
        diagram.updateElement(d.id, { x: snappedX, y: snappedY });
      })
      .on('end', function() {
        d3.select(this).classed('dragging', false);
      });
    
    return drag;
  }
  
  function updateConnectionsForElement(elementId: string, oldX: number, oldY: number, newX: number, newY: number) {
    console.log(`Updating connections for element ${elementId} from (${oldX}, ${oldY}) to (${newX}, ${newY})`);
    
    // Get all connections for this element
    const connections = $diagram.connections.filter(
      conn => conn.from.elementId === elementId || conn.to.elementId === elementId
    );
    
    console.log(`Found ${connections.length} connections for element ${elementId}`);
    
    connections.forEach(conn => {
      const updatedConn = { ...conn };
      let needsUpdate = false;
      
      // If this element is the 'from' endpoint
      if (conn.from.elementId === elementId) {
        // Calculate the offset of the connection point from the OLD element center
        const offsetX = conn.from.x - oldX;
        const offsetY = conn.from.y - oldY;
        
        // Apply the same offset to the new position
        updatedConn.from = {
          ...conn.from,
          x: newX + offsetX,
          y: newY + offsetY
        };
        needsUpdate = true;
        
        console.log(`Updated 'from' point: (${conn.from.x}, ${conn.from.y}) -> (${updatedConn.from.x}, ${updatedConn.from.y})`);
        console.log(`  Offset was: (${offsetX}, ${offsetY})`);
      }
      
      // If this element is the 'to' endpoint
      if (conn.to.elementId === elementId) {
        // Calculate the offset of the connection point from the OLD element center
        const offsetX = conn.to.x - oldX;
        const offsetY = conn.to.y - oldY;
        
        // Apply the same offset to the new position
        updatedConn.to = {
          ...conn.to,
          x: newX + offsetX,
          y: newY + offsetY
        };
        needsUpdate = true;
        
        console.log(`Updated 'to' point: (${conn.to.x}, ${conn.to.y}) -> (${updatedConn.to.x}, ${updatedConn.to.y})`);
        console.log(`  Offset was: (${offsetX}, ${offsetY})`);
      }
      
      // Update the path if needed
      if (needsUpdate) {
        updatedConn.path = `M ${updatedConn.from.x} ${updatedConn.from.y} L ${updatedConn.to.x} ${updatedConn.to.y}`;
        
        // Update in the store - this will trigger a re-render
        diagram.updateConnection(conn.id, updatedConn);
        
        console.log(`Updated connection ${conn.id} path: ${updatedConn.path}`);
      }
    });
  }
  
  function setupDropZone() {
    container.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer!.dropEffect = 'copy';
    });
    
    container.addEventListener('drop', (e) => {
      e.preventDefault();
      
      const symbolData = e.dataTransfer!.getData('application/json');
      console.log('Drop event received, data:', symbolData);
      if (symbolData) {
        const symbol = JSON.parse(symbolData);
        console.log('Parsed symbol:', symbol);
        const rect = container.getBoundingClientRect();
        
        // Convert screen coordinates to SVG coordinates
        const point = svg.node()!.createSVGPoint();
        point.x = e.clientX - rect.left;
        point.y = e.clientY - rect.top;
        
        const svgPoint = point.matrixTransform(
          g.node()!.getCTM()!.inverse()
        );
        
        // Snap to grid if enabled
        const x = $diagram.snapToGrid ? Math.round(svgPoint.x / 20) * 20 : svgPoint.x;
        const y = $diagram.snapToGrid ? Math.round(svgPoint.y / 20) * 20 : svgPoint.y;
        
        // Add element to diagram
        const element: DiagramElement = {
          id: `element_${Date.now()}`,
          symbolId: symbol.symbolId || symbol.id,
          symbolPath: symbol.symbolPath || symbol.svgPath || symbol.path,
          name: symbol.name,
          x,
          y,
          width: 60,
          height: 60,
          rotation: 0
        };
        
        diagram.addElement(element);
      }
    });
  }
  
  async function loadSVGContent(url: string): Promise<string> {
    try {
      const response = await fetch(url);
      const text = await response.text();
      console.log('Loaded SVG from', url, 'length:', text.length);
      
      // Return the original SVG content - we'll handle display separately
      return text;
    } catch (error) {
      console.error('Failed to load SVG:', url, error);
      return '';
    }
  }
  
  function updateElements(elements: DiagramElement[]) {
    console.log('UpdateElements called with:', elements);
    // Data join
    const symbols = symbolLayer.selectAll<SVGGElement, DiagramElement>('.symbol')
      .data(elements, d => d.id);
    
    // Remove old elements
    symbols.exit().remove();
    
    // Add new elements
    const symbolsEnter = symbols.enter()
      .append('g')
      .attr('class', 'symbol')
      .attr('id', d => d.id);
    
    // Add a group for the SVG content
    const svgGroup = symbolsEnter.append('g')
      .attr('class', 'symbol-content');
    
    // Load SVG content inline so we can manipulate the T-shapes
    symbolsEnter.each(function(d) {
      console.log('Adding SVG for element:', d.id, 'from path:', d.symbolPath);
      const symbolElement = d3.select(this);
      const svgGroup = symbolElement.select('.symbol-content');
      
      loadSVGContent(d.symbolPath).then(svgContent => {
        if (svgContent) {
          // Parse the SVG content
          const parser = new DOMParser();
          const doc = parser.parseFromString(svgContent, 'image/svg+xml');
          const svgEl = doc.documentElement;
          
          // Get the viewBox
          const viewBox = svgEl.getAttribute('viewBox');
          
          // Create a new SVG element with proper dimensions
          const newSvg = svgGroup.append('svg')
            .attr('width', d.width)
            .attr('height', d.height)
            .attr('x', -d.width / 2)
            .attr('y', -d.height / 2);
          
          if (viewBox) {
            newSvg.attr('viewBox', viewBox);
          }
          
          // Copy all children from the parsed SVG
          Array.from(svgEl.children).forEach(child => {
            newSvg.node()!.appendChild(child.cloneNode(true));
          });
          
          // Setup T-shapes - find all red strokes
          newSvg.selectAll('[stroke="#ff0000"], [stroke="rgb(255,0,0)"], [stroke="red"]')
            .classed('connection-t-shape', true)
            .style('display', connectionMode ? 'block' : 'none')
            .style('stroke', connectionMode ? '#1e3a8a' : '#ff0000')
            .style('stroke-width', connectionMode ? 1.5 : 0.5)
            .style('cursor', connectionMode ? 'pointer' : 'default')
            .on('click', function(event) {
              event.stopPropagation();
              event.preventDefault();
              if (connectionMode) {
                handleTShapeClick(event, d.id, this);
              }
            })
            .on('mouseover', function() {
              if (connectionMode) {
                d3.select(this).style('stroke', '#3b82f6').style('stroke-width', 2);
              }
            })
            .on('mouseout', function() {
              if (connectionMode) {
                d3.select(this).style('stroke', '#1e3a8a').style('stroke-width', 1.5);
              }
            });
        } else {
          // Fallback to image if SVG loading fails
          svgGroup.append('image')
            .attr('href', d.symbolPath)
            .attr('width', d.width)
            .attr('height', d.height)
            .attr('x', -d.width / 2)
            .attr('y', -d.height / 2);
        }
      }).catch(err => {
        console.error('Failed to load SVG:', d.symbolPath, err);
        // Fallback to image
        svgGroup.append('image')
          .attr('href', d.symbolPath)
          .attr('width', d.width)
          .attr('height', d.height)
          .attr('x', -d.width / 2)
          .attr('y', -d.height / 2);
      });
    });
    
    // Add selection indicator
    symbolsEnter.append('rect')
      .attr('class', 'selection-indicator')
      .attr('width', d => d.width + 4)
      .attr('height', d => d.height + 4)
      .attr('x', d => -d.width / 2 - 2)
      .attr('y', d => -d.height / 2 - 2)
      .attr('fill', 'none')
      .attr('stroke', '#3b82f6')
      .attr('stroke-width', 2)
      .attr('stroke-dasharray', '5,5')
      .style('display', 'none');
    
    // Update all elements (new and existing)
    const symbolsUpdate = symbolsEnter.merge(symbols);
    
    symbolsUpdate
      .attr('transform', d => `translate(${d.x}, ${d.y}) rotate(${d.rotation || 0})`)
      .call(setupDragBehavior() as any);
    
    // Handle selection
    symbolsUpdate.select('.selection-indicator')
      .style('display', d => $diagram.selectedIds.has(d.id) ? 'block' : 'none');
    
    // Click handler for selection
    symbolsUpdate
      .on('click', async function(event, d) {
        event.stopPropagation();
        console.log('Symbol clicked:', d.id, 'Connection mode:', connectionMode);
        
        if (!connectionMode) {
          // Normal selection mode
          diagram.selectElement(d.id, event.shiftKey);
        }
        // In connection mode, clicks are handled by T-shapes
      });
  }
  
  // Handle T-shape click for connections
  function handleTShapeClick(event: MouseEvent, elementId: string, tShapeElement: any) {
    console.log('=== T-shape clicked ===');
    console.log('Element ID:', elementId);
    
    // Get the element data
    const element = $diagram.elements.find(el => el.id === elementId);
    if (!element) {
      console.error('Element not found:', elementId);
      return;
    }
    
    // Method 1: Get the T-shape's actual position by checking its transform
    const transform = tShapeElement.getAttribute('transform');
    console.log('T-shape transform:', transform);
    
    // Get parent group transforms if any
    let parentG = tShapeElement.parentElement;
    while (parentG && parentG.tagName === 'g') {
      const parentTransform = parentG.getAttribute('transform');
      if (parentTransform) {
        console.log('Parent g transform:', parentTransform);
      }
      parentG = parentG.parentElement;
    }
    
    // Get the CTM (Current Transformation Matrix) which accounts for all transforms
    const ctm = tShapeElement.getCTM();
    console.log('T-shape CTM:', ctm);
    
    // Get the bounding box
    const bbox = tShapeElement.getBBox();
    console.log('T-shape bbox:', bbox);
    
    // Calculate the center of the T-shape in its local coordinates
    const localCenterX = bbox.x + bbox.width / 2;
    const localCenterY = bbox.y + bbox.height / 2;
    
    // Create an SVG point for the T-shape center
    const pt = svg.node()!.createSVGPoint();
    pt.x = localCenterX;
    pt.y = localCenterY;
    
    // Transform to screen coordinates using the T-shape's CTM
    const screenPt = pt.matrixTransform(ctm);
    console.log('T-shape in screen coords:', screenPt);
    
    // Now convert screen coordinates to our canvas coordinate system
    const canvasPt = screenPt.matrixTransform(g.node()!.getCTM()!.inverse());
    
    const connectionPoint: SimpleConnectionPoint = {
      x: canvasPt.x,
      y: canvasPt.y,
      color: '#1e3a8a'
    };
    
    console.log('Element position:', element.x, element.y);
    console.log('Final connection point:', connectionPoint);
    console.log('Offset from element center:', {
      x: connectionPoint.x - element.x,
      y: connectionPoint.y - element.y
    });
    
    if (!isDrawingConnection) {
      console.log('>>> Starting new connection');
      startConnection(connectionPoint, elementId);
    } else {
      console.log('>>> Completing connection');
      completeConnection(connectionPoint, elementId);
    }
  }
  
  
  function startConnection(fromPoint: SimpleConnectionPoint, fromElementId: string) {
    isDrawingConnection = true;
    currentConnection.from = fromPoint;
    currentConnection.fromElementId = fromElementId;
    
    // Create preview line
    previewLine = connectionLayer
      .append('line')
      .attr('class', 'preview-line')
      .attr('x1', fromPoint.x)
      .attr('y1', fromPoint.y)
      .attr('x2', fromPoint.x)
      .attr('y2', fromPoint.y)
      .attr('stroke', '#3b82f6')
      .attr('stroke-width', 2)
      .attr('stroke-dasharray', '5,5');
    
    // Add mouse move listener for preview
    svg.on('mousemove.connection', updateConnectionPreview);
    
    // Add click handler to cancel on background click (with a small delay to avoid immediate cancellation)
    setTimeout(() => {
      svg.on('click.connection', function(event) {
        // Only cancel if clicking on the background (not on elements or T-shapes)
        if (event.target === this || event.target.tagName === 'rect') {
          cancelConnection();
        }
      });
    }, 100);
    
    console.log('Started connection from element:', fromElementId);
  }
  
  function updateConnectionPreview(event: MouseEvent) {
    if (previewLine && currentConnection.from) {
      const point = svg.node()!.createSVGPoint();
      const rect = container.getBoundingClientRect();
      point.x = event.clientX - rect.left;
      point.y = event.clientY - rect.top;
      const svgPoint = point.matrixTransform(g.node()!.getCTM()!.inverse());
      
      previewLine
        .attr('x2', svgPoint.x)
        .attr('y2', svgPoint.y);
    }
  }
  
  function completeConnection(toPoint: SimpleConnectionPoint, toElementId: string) {
    console.log('=== completeConnection called ===');
    console.log('Current connection from:', currentConnection.from);
    console.log('Current connection fromElementId:', currentConnection.fromElementId);
    console.log('To point:', toPoint);
    console.log('To element ID:', toElementId);
    
    if (!currentConnection.from || !currentConnection.fromElementId) {
      console.error('Missing connection start data!');
      return;
    }
    
    // Don't allow self-connections
    if (currentConnection.fromElementId === toElementId) {
      console.log('Cannot connect element to itself');
      cleanupConnection();
      return;
    }
    
    // Create connection object
    const connection: Connection = {
      id: `connection_${Date.now()}`,
      from: {
        elementId: currentConnection.fromElementId,
        pointIndex: 0,
        type: 'bidirectional',
        x: currentConnection.from.x,
        y: currentConnection.from.y
      },
      to: {
        elementId: toElementId,
        pointIndex: 0,
        type: 'bidirectional',
        x: toPoint.x,
        y: toPoint.y
      },
      path: `M ${currentConnection.from.x} ${currentConnection.from.y} L ${toPoint.x} ${toPoint.y}`,
      style: {
        strokeWidth: 2,
        strokeColor: '#000000'
      },
      routing: RoutingAlgorithm.Direct
    };
    
    console.log('Creating connection:', connection);
    
    // Add to diagram
    diagram.addConnection(connection);
    
    console.log('Connection added to diagram successfully');
    
    // Cleanup
    cleanupConnection();
    console.log('Cleanup completed');
  }
  
  function cancelConnection() {
    cleanupConnection();
  }
  
  function cleanupConnection() {
    isDrawingConnection = false;
    currentConnection = { from: null, to: null };
    
    if (previewLine) {
      previewLine.remove();
      previewLine = null;
    }
    
    svg.on('mousemove.connection', null);
    svg.on('click.connection', null);
  }
  
  function updateConnections(connections: Connection[]) {
    const connectionSelection = connectionLayer
      .selectAll<SVGPathElement, Connection>('.connection')
      .data(connections, d => d.id);
    
    // Remove old connections
    connectionSelection.exit().remove();
    
    // Add new connections
    connectionSelection
      .enter()
      .append('path')
      .attr('class', 'connection')
      .attr('fill', 'none')
      .attr('stroke', d => d.style.strokeColor)
      .attr('stroke-width', d => d.style.strokeWidth)
      .attr('stroke-dasharray', d => d.style.strokeDasharray || 'none')
      .merge(connectionSelection)
      .attr('d', d => d.path);
  }

  // Handle window resize
  function handleResize() {
    if (svg) {
      const width = container.clientWidth;
      const height = container.clientHeight;
      svg.attr('width', width).attr('height', height);
    }
  }
  
  onDestroy(() => {
    // Cleanup
    if (svg) {
      svg.remove();
    }
  });
</script>

<div bind:this={container} class="canvas-container">
  <!-- SVG canvas will be inserted here -->
</div>

<style>
  .canvas-container {
    width: 100%;
    height: 100%;
    position: relative;
    background: white;
    overflow: hidden;
  }
  
  :global(.diagram-canvas) {
    background: #fafafa;
  }
  
  :global(.symbol) {
    cursor: move;
  }
  
  :global(.symbol.dragging) {
    opacity: 0.5;
  }
  
  :global(.zoom-controls) {
    position: absolute;
    top: 10px;
    right: 10px;
    display: flex;
    flex-direction: column;
    gap: 5px;
    z-index: 100;
  }
  
  :global(.zoom-controls button) {
    width: 40px;
    height: 40px;
    background: white;
    border: 1px solid #e5e7eb;
    border-radius: 4px;
    cursor: pointer;
    font-size: 18px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  
  :global(.zoom-controls button:hover) {
    background: #f3f4f6;
  }
  
  :global(.connection-point) {
    transition: r 0.2s ease;
  }
  
  :global(.connection) {
    pointer-events: stroke;
    cursor: pointer;
  }
  
  :global(.connection:hover) {
    stroke-width: 3 !important;
  }
  
  :global(.preview-line) {
    pointer-events: none;
  }
</style>