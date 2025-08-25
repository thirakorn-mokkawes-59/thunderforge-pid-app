<script lang="ts">
  import { Handle, Position } from '@xyflow/svelte';
  import { onMount, onDestroy } from 'svelte';
  import type { NodeProps } from '@xyflow/svelte';
  import { diagram } from '$lib/stores/diagram';
  import { UI_CONSTANTS } from '$lib/constants/ui';
  import { writable } from 'svelte/store';
  import { handleVisibility } from '$lib/stores/handleVisibility';
  import { HANDLE_CONFIG, generateHandleId } from '$lib/config/handleConfig';
  
  type $$Props = NodeProps;
  
  export let id: $$Props['id'];
  export let data: $$Props['data'];
  export let selected: $$Props['selected'] = false;
  export let dragging: $$Props['dragging'] = false;
  
  // Debug mode to visualize handle areas (set to true during development)
  const DEBUG_HANDLES = false;
  
  // Use our store to determine if selected
  $: isSelected = $diagram.selectedIds.has(id);
  
  // Track if we're currently in a connection process
  let isConnecting = false;
  let connectingNodeId: string | null = null;
  
  // Listen for connection events to determine handle behavior
  function handleConnectionStart(event: CustomEvent) {
    isConnecting = true;
    connectingNodeId = event.detail?.nodeId || null;
  }
  
  function handleConnectionEnd() {
    isConnecting = false;
    connectingNodeId = null;
  }
  
  onMount(() => {
    console.log(`[PIDSymbolNode ${id}] onMount - Initial state:`, {
      id,
      width: data.width,
      height: data.height,
      name: data.name,
      labelOffset: { x: data.labelOffsetX, y: data.labelOffsetY },
      tagOffset: { x: data.tagOffsetX, y: data.tagOffsetY }
    });
    
    window.addEventListener('connection-start', handleConnectionStart as EventListener);
    window.addEventListener('connection-end', handleConnectionEnd as EventListener);
  });
  
  
  // Apply visual properties
  $: nodeColor = data.color || '#000000';
  $: nodeOpacity = data.opacity || 1;
  $: nodeStrokeWidth = data.strokeWidth || UI_CONSTANTS.STROKE.DEFAULT_WIDTH;
  $: nodeStrokeLinecap = data.strokeLinecap || UI_CONSTANTS.STROKE.DEFAULT_LINECAP;
  $: transformStyle = `
    rotate(${data.rotation || 0}deg)
    ${data.flipX ? 'scaleX(-1)' : ''}
    ${data.flipY ? 'scaleY(-1)' : ''}
  `;
  
  let svgContent = '';
  let connectionPoints: Array<{x: number, y: number, id: string}> = [];
  let isLoading = true;
  let renderCount = 0;
  let initialDetectionComplete = false;
  
  // Track renders and position changes
  $: {
    renderCount++;
    if (renderCount <= 5 || renderCount % 10 === 0) {
      console.log(`[PIDSymbolNode ${id}] Render #${renderCount}:`, {
        dataPosition: { x: data.x, y: data.y },
        size: { width: data.width, height: data.height },
        handles: connectionPoints.length,
        labelOffset: { x: data.labelOffsetX || 0, y: data.labelOffsetY || 0 }
      });
    }
  }
  
  // Track active timeouts and animation frames for cleanup
  let activeTimeouts: Set<number> = new Set();
  let activeAnimationFrames: Set<number> = new Set();
  let abortController: AbortController | null = null;

  // T-junction detection utility functions
  interface TJunctionConfig {
    top?: { h: string; v: string };
    right?: { h: string; v: string };
    bottom?: { h: string; v: string };
    left?: { h: string; v: string };
    additionalJunctions?: Array<{
      position: string;
      h: string;
      v: string;
      x?: number;
      y?: number;
    }>;
  }

  const TJUNCTION_CONFIGS: Record<string, TJunctionConfig & { mainGroupOffset?: { x: number; y: number } }> = {
    'tank_floating_roof': {
      top: { h: 'translate(24 2) rotate(180 2 0)', v: 'translate(26 0) rotate(180 0 1)' },
      right: { h: 'translate(48 14) rotate(270 2 0)', v: 'translate(51 13) rotate(270 0 1)' },
      bottom: { h: 'translate(24 28)', v: 'translate(26 28)' },
      left: { h: 'translate(0 14) rotate(90 2 0)', v: 'translate(1 13) rotate(90 0 1)' },
      mainGroupOffset: { x: 6.5, y: 18.5 }
    },
    'vessel_general': {
      top: { h: 'translate(11 2) rotate(180 2 0)', v: 'translate(13 0) rotate(180 0 1)' },
      right: { h: 'translate(22 11) rotate(270 2 0)', v: 'translate(25 10) rotate(270 0 1)' },
      bottom: { h: 'translate(11 22)', v: 'translate(13 22)' },
      left: { h: 'translate(0 11) rotate(90 2 0)', v: 'translate(1 10) rotate(90 0 1)' },
      mainGroupOffset: { x: 19.5, y: 8.5 }
    },
    'heat_exchanger_general_1': {
      top: { h: 'translate(20 2) rotate(180)', v: 'translate(22 0) rotate(180)' },
      right: { h: 'translate(40.304 10) rotate(270)', v: 'translate(42.702 9.202) rotate(270)' },
      bottom: { h: 'translate(20 42)', v: 'translate(22 42)' },
      left: { h: 'translate(0 22) rotate(90)', v: 'translate(1 21) rotate(90)' },
      mainGroupOffset: { x: 10.5, y: 10.5 },
      additionalJunctions: [{
        position: 'right2',
        h: 'translate(40.304 34) rotate(270)',
        v: 'translate(42.702 33.202) rotate(270)',
        x: 40.304,
        y: 34
      }]
    },
    'vessel_full_tube_coil': {
      top: { h: 'translate(11 2) rotate(180 2 0)', v: 'translate(13 0) rotate(180 0 1)' },
      right: { h: 'translate(22 11) rotate(270 2 0)', v: 'translate(25 10) rotate(270 0 1)' },
      bottom: { h: 'translate(11 22)', v: 'translate(13 22)' },
      left: { h: 'translate(0 11) rotate(90 2 0)', v: 'translate(1 10) rotate(90 0 1)' },
      mainGroupOffset: { x: 19.5, y: 8.5 },
      additionalJunctions: [
        { position: 'right2', h: 'translate(22 17) rotate(270 2 0)', v: 'translate(25 16) rotate(270 0 1)', x: 22, y: 17 },
        { position: 'left2', h: 'translate(0 17) rotate(90 2 0)', v: 'translate(1 16) rotate(90 0 1)', x: 0, y: 17 }
      ]
    },
    'vessel_semi_tube_coil': {
      top: { h: 'translate(11 2) rotate(180 2 0)', v: 'translate(13 0) rotate(180 0 1)' },
      right: { h: 'translate(22 11) rotate(270 2 0)', v: 'translate(25 10) rotate(270 0 1)' },
      bottom: { h: 'translate(11 22)', v: 'translate(13 22)' },
      left: { h: 'translate(0 11) rotate(90 2 0)', v: 'translate(1 10) rotate(90 0 1)' },
      mainGroupOffset: { x: 19.5, y: 8.5 },
      additionalJunctions: [
        { position: 'right2', h: 'translate(22 17) rotate(270 2 0)', v: 'translate(25 16) rotate(270 0 1)', x: 22, y: 17 }
      ]
    }
  };

  function detectTJunctionsForSymbol(symbolKey: string, redElements: NodeListOf<Element>) {
    const config = TJUNCTION_CONFIGS[symbolKey];
    if (!config) return { tJunctions: {}, additionalJunctions: [] };

    const tJunctions = { top: { h: null, v: null }, right: { h: null, v: null }, bottom: { h: null, v: null }, left: { h: null, v: null } };
    const additionalJunctions = [];

    Array.from(redElements).forEach((el) => {
      if (el.tagName.toLowerCase() === 'path') {
        const parentGroup = el.parentElement;
        if (parentGroup) {
          const transform = parentGroup.getAttribute('transform') || '';

          // Check main T-junctions
          Object.entries(config).forEach(([position, patterns]) => {
            if (position === 'additionalJunctions') return;
            
            if (patterns.h && transform.includes(patterns.h)) {
              tJunctions[position].h = { transform, element: el };
            }
            if (patterns.v && transform.includes(patterns.v)) {
              tJunctions[position].v = { transform, element: el };
            }
          });

          // Check additional junctions
          if (config.additionalJunctions) {
            config.additionalJunctions.forEach(junction => {
              if (transform.includes(junction.h)) {
                const existingJunction = additionalJunctions.find(j => j.position === junction.position);
                if (!existingJunction) {
                  additionalJunctions.push({
                    position: junction.position,
                    h: { transform, element: el },
                    x: junction.x,
                    y: junction.y
                  });
                } else {
                  existingJunction.h = { transform, element: el };
                }
              }
              if (transform.includes(junction.v)) {
                const existingJunction = additionalJunctions.find(j => j.position === junction.position);
                if (existingJunction) {
                  existingJunction.v = { transform, element: el };
                }
              }
            });
          }
        }
      }
    });

    return { tJunctions, additionalJunctions };
  }

  function getSymbolKeyFromPath(symbolPath: string): string | null {
    if (!symbolPath) return null;
    
    const symbolKeys = [
      'tank_floating_roof',
      'vessel_general',
      'heat_exchanger_general_1',
      'vessel_full_tube_coil', 
      'vessel_semi_tube_coil'
    ];

    for (const key of symbolKeys) {
      if (symbolPath.includes(key)) {
        return key;
      }
    }
    
    return null;
  }
  
  // Load SVG and parse connection points - only on path change
  $: if (data.symbolPath && !svgContent) {
    loadSvg(data.symbolPath);
  } else if (!data.symbolPath && !initialDetectionComplete) {
    // No symbol path - mark detection as complete with no points
    initialDetectionComplete = true;
    connectionPoints = [];
  }
  
  // Debug label and tag positioning on data change
  $: if (id && (data.showLabel !== false || data.tag)) {
    console.log(`[PIDSymbolNode ${id}] Label/Tag render:`, {
      timestamp: Date.now(),
      label: data.showLabel !== false ? {
        visible: true,
        text: data.name,
        offsetX: data.labelOffsetX || 0,
        offsetY: data.labelOffsetY || 0
      } : { visible: false },
      tag: data.tag ? {
        visible: true,
        text: data.tag,
        position: data.tagPosition || 'below',
        offsetX: data.tagOffsetX || 0,
        offsetY: data.tagOffsetY || 0
      } : { visible: false }
    });
  }
  
  // Update stroke width and linecap when they change
  $: if (svgContent && (nodeStrokeWidth !== undefined || nodeStrokeLinecap !== undefined)) {
    // Use a small delay to ensure DOM is ready
    const timeoutId = setTimeout(() => {
      updateStrokePropertiesDirectly(nodeStrokeWidth, nodeStrokeLinecap);
      activeTimeouts.delete(timeoutId);
    }, 0);
    activeTimeouts.add(timeoutId);
  }
  
  async function loadSvg(symbolPath: string) {
    if (symbolPath) {
      // Cancel any pending fetch
      if (abortController) {
        abortController.abort();
      }
      abortController = new AbortController();
      
      try {
        const response = await fetch(data.symbolPath, { signal: abortController.signal });
        const text = await response.text();
        
        // Parse SVG
        const parser = new DOMParser();
        const doc = parser.parseFromString(text, 'image/svg+xml');
        const svg = doc.documentElement;
        
        // Get viewBox
        const viewBox = svg.getAttribute('viewBox') || '0 0 64 64';
        const [vbX, vbY, vbWidth, vbHeight] = viewBox.split(' ').map(Number);
        
        // Calculate scale
        const scaleX = data.width / vbWidth;
        const scaleY = data.height / vbHeight;
        
        // Find connection indicator elements (red for equipment/valves, gray for pipes/signals)
        const redElements = svg.querySelectorAll('[stroke="#ff0000"], [stroke="rgb(255,0,0)"], [stroke="red"], [stroke="#646464"], [stroke="rgb(100,100,100)"]');
        
        console.log(`Found ${redElements.length} red elements in SVG:`, id);
        
        // Improved approach: find T-shape groups and calculate connection edge
        const tShapeGroups = new Map();
        
        // Detect symbol type based on path or name
        const isTankFloatingRoof = data.symbolPath?.includes('tank_floating_roof');
        const isVesselGeneral = data.symbolPath?.includes('vessel_general') && !data.symbolPath?.includes('vessel_general_column');
        const isVesselGeneralColumn = data.symbolPath?.includes('vessel_general_column');
        const isVesselConicalHead = data.symbolPath?.includes('vessel_conical_head');
        const isVesselDishedHead = data.symbolPath?.includes('vessel_dished_head');
        const isVesselTrays = data.symbolPath?.includes('vessel_trays');
        const isVesselSpherical = data.symbolPath?.includes('vessel_spherical');
        const isVesselFixedBed = data.symbolPath?.includes('vessel_fixed_bed');
        const isVesselFluidizedBed = data.symbolPath?.includes('vessel_fluidized_bed');
        const isVesselFullTubeCoil = data.symbolPath?.includes('vessel_full_tube_coil');
        const isVesselSemiTubeCoil = data.symbolPath?.includes('vessel_semi_tube_coil');
        const isVesselJacketed = data.symbolPath?.includes('vessel_jacketed');
        const isStorageContainer = data.symbolPath?.includes('storage_container');
        const isStorageBag = data.symbolPath?.includes('storage_bag');
        const isStorageBarrelDrum = data.symbolPath?.includes('storage_barrel_drum');
        const isStorageGasCylinder = data.symbolPath?.includes('storage_gas_cylinder');
        const isFurnaceIndustrial = data.symbolPath?.includes('furnace_industrial');
        const isTankGeneralBasin = data.symbolPath?.includes('tank_general_basin');
        const isPump = data.symbolPath?.includes('pump');
        const isCompressor = data.symbolPath?.includes('compressor');
        const isBlower = data.symbolPath?.includes('blower');
        const isValve = data.symbolPath?.includes('valves');
        const isInstrument = data.symbolPath?.includes('instruments');
        const isHeatExchanger = data.symbolPath?.includes('heat_exchanger');
        const isHeatExchangerGeneral1 = data.symbolPath?.includes('heat_exchanger_general_1');
        
        // Use refactored T-junction detection
        const symbolKey = getSymbolKeyFromPath(data.symbolPath);
        const { tJunctions, additionalJunctions } = symbolKey 
          ? detectTJunctionsForSymbol(symbolKey, redElements)
          : { tJunctions: {top: { h: null, v: null }, right: { h: null, v: null }, bottom: { h: null, v: null }, left: { h: null, v: null }}, additionalJunctions: [] };

        console.log(`[PIDSymbolNode ${id}] Using refactored detection for symbol: ${symbolKey || 'unknown'}`);
        
        // Fallback to manual detection for symbols not in config
        if (!symbolKey) {
          // Keep existing manual detection logic for unconfigured symbols
        }
        
        // First pass: find all horizontal and vertical lines for each T-junction
        Array.from(redElements).forEach((el, index) => {
          if (el.tagName.toLowerCase() === 'path') {
            const d = el.getAttribute('d') || '';
            const parentGroup = el.parentElement;
            
            if (parentGroup) {
              const transform = parentGroup.getAttribute('transform') || '';
              
              if (isTankFloatingRoof) {
                // Tank Floating Roof specific patterns
                // TOP T-junction
                if (transform.includes('translate(24 2)') && transform.includes('rotate(180 2 0)')) {
                  tJunctions.top.h = { transform, element: el };
                }
                if (transform.includes('translate(26 0)') && transform.includes('rotate(180 0 1)')) {
                  tJunctions.top.v = { transform, element: el };
                }
                
                // LEFT T-junction
                if (transform.includes('translate(0 14)') && transform.includes('rotate(90 2 0)')) {
                  tJunctions.left.h = { transform, element: el };
                }
                if (transform.includes('translate(1 13)') && transform.includes('rotate(90 0 1)')) {
                  tJunctions.left.v = { transform, element: el };
                }
                
                // RIGHT T-junction
                if (transform.includes('translate(48 14)') && transform.includes('rotate(270 2 0)')) {
                  tJunctions.right.h = { transform, element: el };
                }
                if (transform.includes('translate(51 13)') && transform.includes('rotate(270 0 1)')) {
                  tJunctions.right.v = { transform, element: el };
                }
                
                // BOTTOM T-junction
                if (transform.includes('translate(24 28)') && !transform.includes('rotate')) {
                  tJunctions.bottom.h = { transform, element: el };
                }
                if (transform.includes('translate(26 28)') && !transform.includes('rotate')) {
                  tJunctions.bottom.v = { transform, element: el };
                }
                
              } else if (isVesselGeneral) {
                // Vessel General specific patterns
                // TOP T-junction
                if (transform.includes('translate(11 2)') && transform.includes('rotate(180 2 0)')) {
                  tJunctions.top.h = { transform, element: el };
                }
                if (transform.includes('translate(13 0)') && transform.includes('rotate(180 0 1)')) {
                  tJunctions.top.v = { transform, element: el };
                }
                
                // LEFT T-junction
                if (transform.includes('translate(0 24)') && transform.includes('rotate(90 2 0)')) {
                  tJunctions.left.h = { transform, element: el };
                }
                if (transform.includes('translate(1 23)') && transform.includes('rotate(90 0 1)')) {
                  tJunctions.left.v = { transform, element: el };
                }
                
                // RIGHT T-junction
                if (transform.includes('translate(22 24)') && transform.includes('rotate(270 2 0)')) {
                  tJunctions.right.h = { transform, element: el };
                }
                if (transform.includes('translate(25 23)') && transform.includes('rotate(270 0 1)')) {
                  tJunctions.right.v = { transform, element: el };
                }
                
                // BOTTOM T-junction
                if (transform.includes('translate(11 46)') && !transform.includes('rotate')) {
                  tJunctions.bottom.h = { transform, element: el };
                }
                if (transform.includes('translate(13 46)') && !transform.includes('rotate')) {
                  tJunctions.bottom.v = { transform, element: el };
                }
                
              } else if (isVesselGeneralColumn) {
                // Vessel General Column specific patterns
                // TOP T-junction
                if (transform.includes('translate(10 1.957)') && transform.includes('rotate(180')) {
                  tJunctions.top.h = { transform, element: el };
                }
                if (transform.includes('translate(12 0)') && transform.includes('rotate(180')) {
                  tJunctions.top.v = { transform, element: el };
                }
                
                // RIGHT T-junction
                if (transform.includes('translate(20.043 23)') && transform.includes('rotate(270')) {
                  tJunctions.right.h = { transform, element: el };
                }
                if (transform.includes('translate(23 22)') && transform.includes('rotate(270')) {
                  tJunctions.right.v = { transform, element: el };
                }
                
                // BOTTOM T-junction
                if (transform.includes('translate(10 44.043)') && !transform.includes('rotate')) {
                  tJunctions.bottom.h = { transform, element: el };
                }
                if (transform.includes('translate(12 44.043)') && !transform.includes('rotate')) {
                  tJunctions.bottom.v = { transform, element: el };
                }
                
                // LEFT T-junction
                if (transform.includes('translate(0.043 23)') && transform.includes('rotate(90')) {
                  tJunctions.left.h = { transform, element: el };
                }
                if (transform.includes('translate(1 22)') && transform.includes('rotate(90')) {
                  tJunctions.left.v = { transform, element: el };
                }
                
              } else if (isVesselConicalHead) {
                // Vessel Conical Head specific patterns
                // TOP T-junction
                if (transform.includes('translate(11 2)') && transform.includes('rotate(180')) {
                  tJunctions.top.h = { transform, element: el };
                }
                if (transform.includes('translate(13 0)') && transform.includes('rotate(180')) {
                  tJunctions.top.v = { transform, element: el };
                }
                
                // RIGHT T-junction
                if (transform.includes('translate(21 26)') && transform.includes('rotate(270')) {
                  tJunctions.right.h = { transform, element: el };
                }
                if (transform.includes('translate(24 25)') && transform.includes('rotate(270')) {
                  tJunctions.right.v = { transform, element: el };
                }
                
                // BOTTOM T-junction
                if (transform.includes('translate(11 50)') && !transform.includes('rotate')) {
                  tJunctions.bottom.h = { transform, element: el };
                }
                if (transform.includes('translate(13 50)') && !transform.includes('rotate')) {
                  tJunctions.bottom.v = { transform, element: el };
                }
                
                // LEFT T-junction
                if (transform.includes('translate(0 26)') && transform.includes('rotate(90')) {
                  tJunctions.left.h = { transform, element: el };
                }
                if (transform.includes('translate(1 25)') && transform.includes('rotate(90')) {
                  tJunctions.left.v = { transform, element: el };
                }
                
              } else if (isVesselDishedHead) {
                // Vessel Dished Head specific patterns
                // TOP T-junction
                if (transform.includes('translate(12 2)') && transform.includes('rotate(180')) {
                  tJunctions.top.h = { transform, element: el };
                }
                if (transform.includes('translate(14 0)') && transform.includes('rotate(180')) {
                  tJunctions.top.v = { transform, element: el };
                }
                
                // RIGHT T-junction
                if (transform.includes('translate(24 21)') && transform.includes('rotate(270')) {
                  tJunctions.right.h = { transform, element: el };
                }
                if (transform.includes('translate(27 20)') && transform.includes('rotate(270')) {
                  tJunctions.right.v = { transform, element: el };
                }
                
                // BOTTOM T-junction
                if (transform.includes('translate(12 39)') && !transform.includes('rotate')) {
                  tJunctions.bottom.h = { transform, element: el };
                }
                if (transform.includes('translate(14 39)') && !transform.includes('rotate')) {
                  tJunctions.bottom.v = { transform, element: el };
                }
                
                // LEFT T-junction
                if (transform.includes('translate(0 21)') && transform.includes('rotate(90')) {
                  tJunctions.left.h = { transform, element: el };
                }
                if (transform.includes('translate(1 20)') && transform.includes('rotate(90')) {
                  tJunctions.left.v = { transform, element: el };
                }
                
              } else if (isVesselTrays || isVesselFixedBed || isVesselFluidizedBed) {
                // Vessel Trays, Fixed Bed, and Fluidized Bed have same patterns (rectangular vessels)
                // TOP T-junction
                if (transform.includes('translate(11 2)') && transform.includes('rotate(180')) {
                  tJunctions.top.h = { transform, element: el };
                }
                if (transform.includes('translate(13 0)') && transform.includes('rotate(180')) {
                  tJunctions.top.v = { transform, element: el };
                }
                
                // RIGHT T-junction
                if (transform.includes('translate(22 24)') && transform.includes('rotate(270')) {
                  tJunctions.right.h = { transform, element: el };
                }
                if (transform.includes('translate(25 23)') && transform.includes('rotate(270')) {
                  tJunctions.right.v = { transform, element: el };
                }
                
                // BOTTOM T-junction
                if (transform.includes('translate(11 46)') && !transform.includes('rotate')) {
                  tJunctions.bottom.h = { transform, element: el };
                }
                if (transform.includes('translate(13 46)') && !transform.includes('rotate')) {
                  tJunctions.bottom.v = { transform, element: el };
                }
                
                // LEFT T-junction
                if (transform.includes('translate(0 24)') && transform.includes('rotate(90')) {
                  tJunctions.left.h = { transform, element: el };
                }
                if (transform.includes('translate(1 23)') && transform.includes('rotate(90')) {
                  tJunctions.left.v = { transform, element: el };
                }
                
              } else if (isVesselSpherical) {
                // Vessel Spherical specific patterns
                // TOP T-junction
                if (transform.includes('translate(20 2.038)') && transform.includes('rotate(180')) {
                  tJunctions.top.h = { transform, element: el };
                }
                if (transform.includes('translate(22 0)') && transform.includes('rotate(180')) {
                  tJunctions.top.v = { transform, element: el };
                }
                
                // RIGHT T-junction
                if (transform.includes('translate(39.962 22.93)') && transform.includes('rotate(270')) {
                  tJunctions.right.h = { transform, element: el };
                }
                if (transform.includes('translate(43 21.93)') && transform.includes('rotate(270')) {
                  tJunctions.right.v = { transform, element: el };
                }
                
                // BOTTOM T-junction
                if (transform.includes('translate(20 43.822)') && !transform.includes('rotate')) {
                  tJunctions.bottom.h = { transform, element: el };
                }
                if (transform.includes('translate(22 43.822)') && !transform.includes('rotate')) {
                  tJunctions.bottom.v = { transform, element: el };
                }
                
                // LEFT T-junction
                if (transform.includes('translate(-0.038 22.93)') && transform.includes('rotate(90')) {
                  tJunctions.left.h = { transform, element: el };
                }
                if (transform.includes('translate(1 21.93)') && transform.includes('rotate(90')) {
                  tJunctions.left.v = { transform, element: el };
                }
                
              } else if (isVesselFullTubeCoil) {
                // Vessel Full Tube Coil - has 6 T-junctions total
                // Store all 6 junctions directly without using additionalJunctions
                
                // Vessel Full Tube Coil - has 2 T-junctions on each side
                // TOP T-junction
                if (transform.includes('translate(20.023 2)') && transform.includes('rotate(180')) {
                  tJunctions.top.h = { transform, element: el };
                }
                if (transform.includes('translate(22 0)') && transform.includes('rotate(180')) {
                  tJunctions.top.v = { transform, element: el };
                }
                
                // BOTTOM T-junction
                if (transform.includes('translate(20.023 46)') && !transform.includes('rotate')) {
                  tJunctions.bottom.h = { transform, element: el };
                }
                if (transform.includes('translate(22 46)') && !transform.includes('rotate')) {
                  tJunctions.bottom.v = { transform, element: el };
                }
                
                // RIGHT - First junction (upper at Y=9)
                // Handle multiple T-junctions on sides
                // RIGHT - First junction (upper)
                if (transform.includes('translate(40.023 9)') && transform.includes('rotate(270')) {
                  tJunctions.right.h = { transform, element: el };
                }
                if (transform.includes('translate(43.011 8.011)') && transform.includes('rotate(270')) {
                  tJunctions.right.v = { transform, element: el };
                }
                
                // LEFT - First junction (upper at Y=17)
                // RIGHT - Second junction (lower)
                if (transform.includes('translate(40.023 31)') && transform.includes('rotate(270')) {
                  if (!additionalJunctions) additionalJunctions = [];
                  additionalJunctions.push({
                    position: 'right2',
                    h: { transform, element: el },
                    x: 40.023,
                    y: 31
                  });
                }
                if (transform.includes('translate(43.011 30.011)') && transform.includes('rotate(270')) {
                  if (additionalJunctions && additionalJunctions.length > 0) {
                    const lastJunction = additionalJunctions[additionalJunctions.length - 1];
                    if (lastJunction.position === 'right2') {
                      lastJunction.v = { transform, element: el };
                    }
                  }
                }
                
                // LEFT - First junction (upper)
                if (transform.includes('translate(-0.023 17)') && transform.includes('rotate(90')) {
                  tJunctions.left.h = { transform, element: el };
                }
                if (transform.includes('translate(0.989 16.011)') && transform.includes('rotate(90')) {
                  tJunctions.left.v = { transform, element: el };
                }
                
                // Store second junctions in a special tJunctions2 object for stable processing
                if (!tJunctions.right2) tJunctions.right2 = { h: null, v: null };
                if (!tJunctions.left2) tJunctions.left2 = { h: null, v: null };
                
                // RIGHT - Second junction (lower at Y=31)
                if (transform.includes('translate(40.023 31)') && transform.includes('rotate(270')) {
                  tJunctions.right2.h = { transform, element: el };
                }
                if (transform.includes('translate(43.011 30.011)') && transform.includes('rotate(270')) {
                  tJunctions.right2.v = { transform, element: el };
                }
                
                // LEFT - Second junction (lower at Y=40)
                if (transform.includes('translate(-0.023 40)') && transform.includes('rotate(90')) {
                  tJunctions.left2.h = { transform, element: el };
                }
                if (transform.includes('translate(0.989 39.011)') && transform.includes('rotate(90')) {
                  tJunctions.left2.v = { transform, element: el };
                }
                
                // LEFT - Second junction (lower) - duplicate check
                if (transform.includes('translate(-0.023 40)') && transform.includes('rotate(90')) {
                  if (!additionalJunctions) additionalJunctions = [];
                  additionalJunctions.push({
                    position: 'left2',
                    h: { transform, element: el },
                    x: -0.023,
                    y: 40
                  });
                }
                if (transform.includes('translate(0.989 39.011)') && transform.includes('rotate(90')) {
                  if (additionalJunctions && additionalJunctions.length > 0) {
                    const lastJunction = additionalJunctions[additionalJunctions.length - 1];
                    if (lastJunction.position === 'left2') {
                      lastJunction.v = { transform, element: el };
                    }
                  }
                }
                
              } else if (isVesselSemiTubeCoil) {
                // Vessel Semi Tube Coil - similar to full tube coil, has 2 T-junctions on each side
                // TOP T-junction
                if (transform.includes('translate(16 1.979)') && transform.includes('rotate(180')) {
                  tJunctions.top.h = { transform, element: el };
                }
                if (transform.includes('translate(18 0)') && transform.includes('rotate(180')) {
                  tJunctions.top.v = { transform, element: el };
                }
                
                // BOTTOM T-junction
                if (transform.includes('translate(16 46.021)') && !transform.includes('rotate')) {
                  tJunctions.bottom.h = { transform, element: el };
                }
                if (transform.includes('translate(18 46.021)') && !transform.includes('rotate')) {
                  tJunctions.bottom.v = { transform, element: el };
                }
                
                // Handle multiple T-junctions on sides (following full tube coil pattern)
                // RIGHT - First junction (upper)
                if (transform.includes('translate(32 9)') && transform.includes('rotate(270')) {
                  tJunctions.right.h = { transform, element: el };
                }
                if (transform.includes('translate(35 8)') && transform.includes('rotate(270')) {
                  tJunctions.right.v = { transform, element: el };
                }
                // RIGHT - Second junction (lower)
                if (transform.includes('translate(32 31)') && transform.includes('rotate(270')) {
                  if (!additionalJunctions) additionalJunctions = [];
                  additionalJunctions.push({
                    position: 'right2',
                    h: { transform, element: el },
                    x: 32,
                    y: 31
                  });
                }
                if (transform.includes('translate(35 30)') && transform.includes('rotate(270')) {
                  if (additionalJunctions && additionalJunctions.length > 0) {
                    const lastJunction = additionalJunctions[additionalJunctions.length - 1];
                    if (lastJunction.position === 'right2') {
                      lastJunction.v = { transform, element: el };
                    }
                  }
                }
                
                // LEFT - First junction (upper)
                if (transform.includes('translate(0 17)') && transform.includes('rotate(90')) {
                  tJunctions.left.h = { transform, element: el };
                }
                if (transform.includes('translate(1 16)') && transform.includes('rotate(90')) {
                  tJunctions.left.v = { transform, element: el };
                }
                // LEFT - Second junction (lower)
                if (transform.includes('translate(0 39)') && transform.includes('rotate(90')) {
                  if (!additionalJunctions) additionalJunctions = [];
                  additionalJunctions.push({
                    position: 'left2',
                    h: { transform, element: el },
                    x: 0,
                    y: 39
                  });
                }
                if (transform.includes('translate(1 38)') && transform.includes('rotate(90')) {
                  if (additionalJunctions && additionalJunctions.length > 0) {
                    const lastJunction = additionalJunctions[additionalJunctions.length - 1];
                    if (lastJunction.position === 'left2') {
                      lastJunction.v = { transform, element: el };
                    }
                  }
                }
                
              } else if (isVesselJacketed) {
                // Vessel Jacketed - has a jacket around the vessel with 4 T-junctions
                // TOP T-junction
                if (transform.includes('translate(12 2)') && transform.includes('rotate(180')) {
                  tJunctions.top.h = { transform, element: el };
                }
                if (transform.includes('translate(14 0)') && transform.includes('rotate(180')) {
                  tJunctions.top.v = { transform, element: el };
                }
                
                // BOTTOM T-junction
                if (transform.includes('translate(12 44)') && !transform.includes('rotate')) {
                  tJunctions.bottom.h = { transform, element: el };
                }
                if (transform.includes('translate(14 44)') && !transform.includes('rotate')) {
                  tJunctions.bottom.v = { transform, element: el };
                }
                
                // RIGHT T-junction
                if (transform.includes('translate(24 23)') && transform.includes('rotate(270')) {
                  tJunctions.right.h = { transform, element: el };
                }
                if (transform.includes('translate(27 22)') && transform.includes('rotate(270')) {
                  tJunctions.right.v = { transform, element: el };
                }
                
                // LEFT T-junction
                if (transform.includes('translate(0 23)') && transform.includes('rotate(90')) {
                  tJunctions.left.h = { transform, element: el };
                }
                if (transform.includes('translate(1 22)') && transform.includes('rotate(90')) {
                  tJunctions.left.v = { transform, element: el };
                }
                
              } else if (isStorageContainer) {
                // Storage Container specific patterns (rectangular)
                // TOP T-junction
                if (transform.includes('translate(22 2)') && transform.includes('rotate(180')) {
                  tJunctions.top.h = { transform, element: el };
                }
                if (transform.includes('translate(24 0)') && transform.includes('rotate(180')) {
                  tJunctions.top.v = { transform, element: el };
                }
                
                // RIGHT T-junction
                if (transform.includes('translate(44 11)') && transform.includes('rotate(270')) {
                  tJunctions.right.h = { transform, element: el };
                }
                if (transform.includes('translate(47 10)') && transform.includes('rotate(270')) {
                  tJunctions.right.v = { transform, element: el };
                }
                
                // BOTTOM T-junction
                if (transform.includes('translate(22 22)') && !transform.includes('rotate')) {
                  tJunctions.bottom.h = { transform, element: el };
                }
                if (transform.includes('translate(24 22)') && !transform.includes('rotate')) {
                  tJunctions.bottom.v = { transform, element: el };
                }
                
                // LEFT T-junction
                if (transform.includes('translate(0 11)') && transform.includes('rotate(90')) {
                  tJunctions.left.h = { transform, element: el };
                }
                if (transform.includes('translate(1 10)') && transform.includes('rotate(90')) {
                  tJunctions.left.v = { transform, element: el };
                }
                
              } else if (isStorageBag) {
                // Storage Bag specific patterns
                // TOP T-junction
                if (transform.includes('translate(10 2)') && transform.includes('rotate(180')) {
                  tJunctions.top.h = { transform, element: el };
                }
                if (transform.includes('translate(12 0)') && transform.includes('rotate(180')) {
                  tJunctions.top.v = { transform, element: el };
                }
                
                // BOTTOM T-junction
                if (transform.includes('translate(10 36)') && !transform.includes('rotate')) {
                  tJunctions.bottom.h = { transform, element: el };
                }
                if (transform.includes('translate(12 36)') && !transform.includes('rotate')) {
                  tJunctions.bottom.v = { transform, element: el };
                }
                
                // RIGHT T-junction
                if (transform.includes('translate(20 19)') && transform.includes('rotate(270')) {
                  tJunctions.right.h = { transform, element: el };
                }
                if (transform.includes('translate(23 18)') && transform.includes('rotate(270')) {
                  tJunctions.right.v = { transform, element: el };
                }
                
                // LEFT T-junction
                if (transform.includes('translate(0 19)') && transform.includes('rotate(90')) {
                  tJunctions.left.h = { transform, element: el };
                }
                if (transform.includes('translate(1 18)') && transform.includes('rotate(90')) {
                  tJunctions.left.v = { transform, element: el };
                }
                
              } else if (isStorageBarrelDrum) {
                // Storage Barrel/Drum specific patterns
                // TOP T-junction
                if (transform.includes('translate(10 2)') && transform.includes('rotate(180')) {
                  tJunctions.top.h = { transform, element: el };
                }
                if (transform.includes('translate(12 0)') && transform.includes('rotate(180')) {
                  tJunctions.top.v = { transform, element: el };
                }
                
                // RIGHT T-junction
                if (transform.includes('translate(18 18)') && transform.includes('rotate(270')) {
                  tJunctions.right.h = { transform, element: el };
                }
                if (transform.includes('translate(21 17)') && transform.includes('rotate(270')) {
                  tJunctions.right.v = { transform, element: el };
                }
                
                // BOTTOM T-junction
                if (transform.includes('translate(10 35)') && !transform.includes('rotate')) {
                  tJunctions.bottom.h = { transform, element: el };
                }
                if (transform.includes('translate(12 35)') && !transform.includes('rotate')) {
                  tJunctions.bottom.v = { transform, element: el };
                }
                
                // LEFT T-junction
                if (transform.includes('translate(1 18)') && transform.includes('rotate(90')) {
                  tJunctions.left.h = { transform, element: el };
                }
                if (transform.includes('translate(2 17)') && transform.includes('rotate(90')) {
                  tJunctions.left.v = { transform, element: el };
                }
                
              } else if (isStorageGasCylinder) {
                // Storage Gas Cylinder specific patterns
                // TOP T-junction
                if (transform.includes('translate(6 2)') && transform.includes('rotate(180')) {
                  tJunctions.top.h = { transform, element: el };
                }
                if (transform.includes('translate(8 0)') && transform.includes('rotate(180')) {
                  tJunctions.top.v = { transform, element: el };
                }
                
                // BOTTOM T-junction
                if (transform.includes('translate(6 35)') && !transform.includes('rotate')) {
                  tJunctions.bottom.h = { transform, element: el };
                }
                if (transform.includes('translate(8 35)') && !transform.includes('rotate')) {
                  tJunctions.bottom.v = { transform, element: el };
                }
                
                // RIGHT T-junction
                if (transform.includes('translate(12 19)') && transform.includes('rotate(270')) {
                  tJunctions.right.h = { transform, element: el };
                }
                if (transform.includes('translate(15 18)') && transform.includes('rotate(270')) {
                  tJunctions.right.v = { transform, element: el };
                }
                
                // LEFT T-junction
                if (transform.includes('translate(0 19)') && transform.includes('rotate(90')) {
                  tJunctions.left.h = { transform, element: el };
                }
                if (transform.includes('translate(1 18)') && transform.includes('rotate(90')) {
                  tJunctions.left.v = { transform, element: el };
                }
                
              } else if (isFurnaceIndustrial) {
                // Furnace Industrial specific patterns
                // TOP T-junction
                if (transform.includes('translate(12 2)') && transform.includes('rotate(180')) {
                  tJunctions.top.h = { transform, element: el };
                }
                if (transform.includes('translate(14 0)') && transform.includes('rotate(180')) {
                  tJunctions.top.v = { transform, element: el };
                }
                
                // BOTTOM T-junction
                if (transform.includes('translate(12 42)') && !transform.includes('rotate')) {
                  tJunctions.bottom.h = { transform, element: el };
                }
                if (transform.includes('translate(14 42)') && !transform.includes('rotate')) {
                  tJunctions.bottom.v = { transform, element: el };
                }
                
                // RIGHT T-junction
                if (transform.includes('translate(24 22)') && transform.includes('rotate(270')) {
                  tJunctions.right.h = { transform, element: el };
                }
                if (transform.includes('translate(27 21)') && transform.includes('rotate(270')) {
                  tJunctions.right.v = { transform, element: el };
                }
                
                // LEFT T-junction
                if (transform.includes('translate(0 22)') && transform.includes('rotate(90')) {
                  tJunctions.left.h = { transform, element: el };
                }
                if (transform.includes('translate(1 21)') && transform.includes('rotate(90')) {
                  tJunctions.left.v = { transform, element: el };
                }
                
              } else if (isTankGeneralBasin) {
                // Tank General Basin specific patterns
                // TOP T-junction
                if (transform.includes('translate(23 2)') && transform.includes('rotate(180 2 0)')) {
                  tJunctions.top.h = { transform, element: el };
                }
                if (transform.includes('translate(25 0)') && transform.includes('rotate(180 0 1)')) {
                  tJunctions.top.v = { transform, element: el };
                }
                
                // LEFT T-junction  
                if (transform.includes('translate(1 19)') && transform.includes('rotate(90 2 0)')) {
                  tJunctions.left.h = { transform, element: el };
                }
                if (transform.includes('translate(2 18)') && transform.includes('rotate(90 0 1)')) {
                  tJunctions.left.v = { transform, element: el };
                }
                
                // RIGHT T-junction
                if (transform.includes('translate(45 19)') && transform.includes('rotate(270 2 0)')) {
                  tJunctions.right.h = { transform, element: el };
                }
                if (transform.includes('translate(48 18)') && transform.includes('rotate(270 0 1)')) {
                  tJunctions.right.v = { transform, element: el };
                }
                
                // BOTTOM T-junction
                if (transform.includes('translate(23 36)') && !transform.includes('rotate')) {
                  tJunctions.bottom.h = { transform, element: el };
                }
                if (transform.includes('translate(25 36)') && !transform.includes('rotate')) {
                  tJunctions.bottom.v = { transform, element: el };
                }
                
              } else if (isPump || isCompressor || isBlower) {
                // Pump, Compressor and Blower specific patterns (circular symbols)
                // TOP T-junction
                if (transform.includes('translate(20 2)') && transform.includes('rotate(180')) {
                  tJunctions.top.h = { transform, element: el };
                }
                if (transform.includes('translate(22 0)') && transform.includes('rotate(180')) {
                  tJunctions.top.v = { transform, element: el };
                }
                
                // RIGHT T-junction
                if (transform.includes('translate(40 22)') && transform.includes('rotate(270')) {
                  tJunctions.right.h = { transform, element: el };
                }
                if (transform.includes('translate(43 21)') && transform.includes('rotate(270')) {
                  tJunctions.right.v = { transform, element: el };
                }
                
                // BOTTOM T-junction
                if (transform.includes('translate(20 42)') && !transform.includes('rotate')) {
                  tJunctions.bottom.h = { transform, element: el };
                }
                if (transform.includes('translate(22 42)') && !transform.includes('rotate')) {
                  tJunctions.bottom.v = { transform, element: el };
                }
                
                // LEFT T-junction
                if (transform.includes('translate(0 22)') && transform.includes('rotate(90')) {
                  tJunctions.left.h = { transform, element: el };
                }
                if (transform.includes('translate(1 21)') && transform.includes('rotate(90')) {
                  tJunctions.left.v = { transform, element: el };
                }
                
              } else if (isHeatExchangerGeneral1) {
                // Heat Exchanger General 1 - has 2 T-junctions on right side
                // TOP T-junction
                if (transform.includes('translate(20 2)') && transform.includes('rotate(180')) {
                  tJunctions.top.h = { transform, element: el };
                }
                if (transform.includes('translate(22 0)') && transform.includes('rotate(180')) {
                  tJunctions.top.v = { transform, element: el };
                }
                
                // BOTTOM T-junction
                if (transform.includes('translate(20 42)') && !transform.includes('rotate')) {
                  tJunctions.bottom.h = { transform, element: el };
                }
                if (transform.includes('translate(22 42)') && !transform.includes('rotate')) {
                  tJunctions.bottom.v = { transform, element: el };
                }
                
                // LEFT T-junction
                if (transform.includes('translate(0 22)') && transform.includes('rotate(90')) {
                  tJunctions.left.h = { transform, element: el };
                }
                if (transform.includes('translate(1 21)') && transform.includes('rotate(90')) {
                  tJunctions.left.v = { transform, element: el };
                }
                
                // RIGHT - First junction (upper)
                if (transform.includes('translate(40.304 10)') && transform.includes('rotate(270')) {
                  tJunctions.right.h = { transform, element: el };
                  console.log(`[Heat Exchanger General1] Found upper right H junction at Y=10`);
                }
                if (transform.includes('translate(42.702 9.202)') && transform.includes('rotate(270')) {
                  tJunctions.right.v = { transform, element: el };
                  console.log(`[Heat Exchanger General1] Found upper right V junction`);
                }
                // RIGHT - Second junction (lower)
                if (transform.includes('translate(40.304 34)') && transform.includes('rotate(270')) {
                  if (!additionalJunctions) additionalJunctions = [];
                  additionalJunctions.push({
                    position: 'right2',
                    h: { transform, element: el },
                    x: 40.304,
                    y: 34
                  });
                  console.log(`[Heat Exchanger General1] Found lower right H junction at Y=34`);
                }
                if (transform.includes('translate(42.702 33.202)') && transform.includes('rotate(270')) {
                  if (additionalJunctions && additionalJunctions.length > 0) {
                    const lastJunction = additionalJunctions[additionalJunctions.length - 1];
                    if (lastJunction.position === 'right2') {
                      lastJunction.v = { transform, element: el };
                    }
                  }
                }
                
              } else if (isValve) {
                // Valve specific patterns
                // Valves typically have left and right T-junctions only
                // RIGHT T-junction
                if ((transform.includes('translate(52.5 2.5)') || transform.includes('translate(22.5 2.5)')) && !transform.includes('rotate')) {
                  tJunctions.right.v = { transform, element: el };
                }
                if ((transform.includes('translate(52.5 5)') || transform.includes('translate(22.5 5)')) && !transform.includes('rotate')) {
                  tJunctions.right.h = { transform, element: el };
                }
                
                // LEFT T-junction
                if (transform.includes('translate(2.5 2.5)') && transform.includes('rotate(180')) {
                  tJunctions.left.v = { transform, element: el };
                }
                if (transform.includes('translate(0 5)') && transform.includes('rotate(180')) {
                  tJunctions.left.h = { transform, element: el };
                }
                
                // Some valves have additional center T-junctions
                if (transform.includes('translate(27.5 2.5)') && !transform.includes('rotate')) {
                  // Center-top junction
                  tJunctions.top.v = { transform, element: el };
                }
                if (transform.includes('translate(27.5 5)') && !transform.includes('rotate')) {
                  tJunctions.top.h = { transform, element: el };
                }
                
              } else if (isInstrument) {
                // Instrument specific patterns (circular symbols like pumps)
                // Similar to pump but with different offsets
                // TOP T-junction
                if (transform.includes('translate(20 2.5)') || transform.includes('translate(22.5 0)')) {
                  if (transform.includes('rotate(180') || !transform.includes('rotate')) {
                    const isH = transform.includes('translate(20');
                    if (isH) tJunctions.top.h = { transform, element: el };
                    else tJunctions.top.v = { transform, element: el };
                  }
                }
                
                // RIGHT T-junction
                if (transform.includes('translate(40 22.5)') || transform.includes('translate(43.75 21.25)')) {
                  if (transform.includes('rotate(90') || transform.includes('rotate(270')) {
                    const isH = transform.includes('translate(40');
                    if (isH) tJunctions.right.h = { transform, element: el };
                    else tJunctions.right.v = { transform, element: el };
                  }
                }
                
                // BOTTOM T-junction
                if (transform.includes('translate(20 42.5)') || transform.includes('translate(22.5 42.5)')) {
                  const isH = transform.includes('translate(20');
                  if (isH) tJunctions.bottom.h = { transform, element: el };
                  else tJunctions.bottom.v = { transform, element: el };
                }
                
                // LEFT T-junction
                if (transform.includes('translate(0 22.5)') || transform.includes('translate(1.25 21.25)')) {
                  if (transform.includes('rotate(270') || transform.includes('rotate(90')) {
                    const isH = transform.includes('translate(0 22');
                    if (isH) tJunctions.left.h = { transform, element: el };
                    else tJunctions.left.v = { transform, element: el };
                  }
                }
              }
            }
          }
        });
        
        // Calculate intersection points for each T-junction
        const junctionPoints = [];
        // Different main group offsets for different symbols
        let mainGroupOffsetX = 0;
        let mainGroupOffsetY = 0;
        
        // Use config-based offsets if available, otherwise fallback to manual
        const config = symbolKey ? TJUNCTION_CONFIGS[symbolKey] : null;
        if (config && config.mainGroupOffset) {
          mainGroupOffsetX = config.mainGroupOffset.x;
          mainGroupOffsetY = config.mainGroupOffset.y;
          console.log(`[PIDSymbolNode ${id}] Using config offset: ${mainGroupOffsetX}, ${mainGroupOffsetY}`);
        } else if (isTankFloatingRoof) {
          mainGroupOffsetX = 6.5;
          mainGroupOffsetY = 18.5;
        } else if (isVesselGeneral) {
          mainGroupOffsetX = 19.5;
          mainGroupOffsetY = 8.5;
        } else if (isVesselGeneralColumn) {
          mainGroupOffsetX = 21.5;
          mainGroupOffsetY = 8.5;
        } else if (isVesselConicalHead) {
          mainGroupOffsetX = 19.5;
          mainGroupOffsetY = 4.5;
        } else if (isVesselDishedHead) {
          mainGroupOffsetX = 18.5;
          mainGroupOffsetY = 11.5;
        } else if (isVesselTrays || isVesselFixedBed || isVesselFluidizedBed) {
          mainGroupOffsetX = 19.5;
          mainGroupOffsetY = 8.5;
        } else if (isVesselSpherical) {
          mainGroupOffsetX = 10.5;
          mainGroupOffsetY = 8.5;
        } else if (isVesselFullTubeCoil) {
          mainGroupOffsetX = 10.5;
          mainGroupOffsetY = 8.5;
        } else if (isVesselSemiTubeCoil) {
          mainGroupOffsetX = 14.5;  // Different offset for semi tube coil
          mainGroupOffsetY = 8.5;
        } else if (isVesselJacketed) {
          mainGroupOffsetX = 18.5;  // Different offset for jacketed
          mainGroupOffsetY = 9.5;
        } else if (isStorageContainer) {
          mainGroupOffsetX = 8.5;
          mainGroupOffsetY = 21.5;
        } else if (isStorageBag) {
          mainGroupOffsetX = 20.5;
          mainGroupOffsetY = 13.5;  // Different Y offset for bag
        } else if (isStorageBarrelDrum) {
          mainGroupOffsetX = 20.5;
          mainGroupOffsetY = 14.5;
        } else if (isStorageGasCylinder) {
          mainGroupOffsetX = 24.5;
          mainGroupOffsetY = 13.5;
        } else if (isFurnaceIndustrial) {
          mainGroupOffsetX = 18.5;
          mainGroupOffsetY = 10.5;
        } else if (isTankGeneralBasin) {
          mainGroupOffsetX = 7.5;
          mainGroupOffsetY = 13.5;
        } else if (isPump || isCompressor || isBlower) {
          mainGroupOffsetX = 10.5;
          mainGroupOffsetY = 10.5;
        } else if (isValve) {
          mainGroupOffsetX = 10;
          mainGroupOffsetY = 27.5;
        } else if (isInstrument) {
          mainGroupOffsetX = 10;
          mainGroupOffsetY = 10;
        } else if (isHeatExchangerGeneral1) {
          mainGroupOffsetX = 10.5;
          mainGroupOffsetY = 10.5;
        } else if (isHeatExchanger) {
          mainGroupOffsetX = 5;
          mainGroupOffsetY = 5;
        }
        
        // Process each T-junction in the correct order (top, right, bottom, left)
        // For vessel full tube coil, also process right2 and left2
        const orderedPositions = isVesselFullTubeCoil 
          ? ['top', 'right', 'bottom', 'left', 'right2', 'left2']
          : ['top', 'right', 'bottom', 'left'];
        
        orderedPositions.forEach(position => {
          const junction = tJunctions[position];
          if (junction && junction.h && junction.v) {
        const orderedPositions = ['top', 'right', 'bottom', 'left'];
        orderedPositions.forEach(position => {
          const junction = tJunctions[position];
          if (junction.h && junction.v) {
            console.log(`Processing ${position} T-junction`);
            
            // Extract coordinates
            const hMatch = junction.h.transform.match(/translate\(([-\d.]+)[\s,]+([-\d.]+)\)/);
            const vMatch = junction.v.transform.match(/translate\(([-\d.]+)[\s,]+([-\d.]+)\)/);
            
            if (hMatch && vMatch) {
              const hX = parseFloat(hMatch[1]);
              const hY = parseFloat(hMatch[2]);
              const vX = parseFloat(vMatch[1]);
              const vY = parseFloat(vMatch[2]);
              
              // Calculate intersection based on position and symbol type
              let intersectionX, intersectionY;
              
              if (isTankFloatingRoof) {
                if (position === 'top') {
                  intersectionX = vX; // Use vertical line X (26)
                  intersectionY = hY; // Use horizontal line Y (2)
                } else if (position === 'left') {
                  intersectionX = hX + 1; // Center of left T (0 + 1 = 1)
                  intersectionY = hY; // Use horizontal line Y (14)
                } else if (position === 'right') {
                  intersectionX = hX + 1.5; // Center of right T (48 + 1.5 = 49.5)
                  intersectionY = hY; // Use horizontal line Y (14)
                } else if (position === 'bottom') {
                  intersectionX = vX; // Use vertical line X (26)
                  intersectionY = hY; // Use horizontal line Y (28)
                }
              } else if (isVesselGeneral) {
                if (position === 'top') {
                  intersectionX = vX; // Use vertical line X (13)
                  intersectionY = hY; // Use horizontal line Y (2)
                } else if (position === 'left') {
                  intersectionX = hX + 1; // Center of left T (0 + 1 = 1)
                  intersectionY = hY; // Use horizontal line Y (24)
                } else if (position === 'right') {
                  intersectionX = hX + 1.5; // Center of right T (22 + 1.5 = 23.5)
                  intersectionY = hY; // Use horizontal line Y (24)
                } else if (position === 'bottom') {
                  intersectionX = vX; // Use vertical line X (13)
                  intersectionY = hY; // Use horizontal line Y (46)
                }
              } else if (isVesselGeneralColumn) {
                if (position === 'top') {
                  intersectionX = vX; // Use vertical line X (12)
                  intersectionY = hY; // Use horizontal line Y (1.957)
                } else if (position === 'left') {
                  intersectionX = hX + 1; // Center of left T (0.043 + 1 = 1.043)
                  intersectionY = hY; // Use horizontal line Y (23)
                } else if (position === 'right') {
                  intersectionX = hX + 1.5; // Center of right T (20.043 + 1.5 = 21.543)
                  intersectionY = hY; // Use horizontal line Y (23)
                } else if (position === 'bottom') {
                  intersectionX = vX; // Use vertical line X (12)
                  intersectionY = hY; // Use horizontal line Y (44.043)
                }
              } else if (isVesselConicalHead) {
                if (position === 'top') {
                  intersectionX = vX; // Use vertical line X (13)
                  intersectionY = hY; // Use horizontal line Y (2)
                } else if (position === 'left') {
                  intersectionX = hX + 2; // Center of left T (0 + 2 = 2)
                  intersectionY = hY; // Use horizontal line Y (26)
                } else if (position === 'right') {
                  intersectionX = hX + 1.5; // Center of right T (21 + 1.5 = 22.5)
                  intersectionY = hY; // Use horizontal line Y (26)
                } else if (position === 'bottom') {
                  intersectionX = vX; // Use vertical line X (13)
                  intersectionY = hY; // Use horizontal line Y (50)
                }
              } else if (isVesselDishedHead) {
                if (position === 'top') {
                  intersectionX = vX; // Use vertical line X (14)
                  intersectionY = hY; // Use horizontal line Y (2)
                } else if (position === 'left') {
                  intersectionX = hX + 2; // Center of left T (0 + 2 = 2)
                  intersectionY = hY; // Use horizontal line Y (21)
                } else if (position === 'right') {
                  intersectionX = hX + 1.5; // Center of right T (24 + 1.5 = 25.5)
                  intersectionY = hY; // Use horizontal line Y (21)
                } else if (position === 'bottom') {
                  intersectionX = vX; // Use vertical line X (14)
                  intersectionY = hY; // Use horizontal line Y (39)
                }
              } else if (isVesselTrays || isVesselFixedBed || isVesselFluidizedBed) {
                // Rectangular vessels with same dimensions
                if (position === 'top') {
                  intersectionX = vX; // Use vertical line X (13)
                  intersectionY = hY; // Use horizontal line Y (2)
                } else if (position === 'left') {
                  intersectionX = hX + 2; // Center of left T (0 + 2 = 2)
                  intersectionY = hY; // Use horizontal line Y (24)
                } else if (position === 'right') {
                  intersectionX = hX + 1.5; // Center of right T (22 + 1.5 = 23.5)
                  intersectionY = hY; // Use horizontal line Y (24)
                } else if (position === 'bottom') {
                  intersectionX = vX; // Use vertical line X (13)
                  intersectionY = hY; // Use horizontal line Y (46)
                }
              } else if (isVesselSpherical) {
                if (position === 'top') {
                  intersectionX = vX; // Use vertical line X (22)
                  intersectionY = hY; // Use horizontal line Y (2.038)
                } else if (position === 'left') {
                  intersectionX = hX + 1; // Center of left T
                  intersectionY = hY; // Use horizontal line Y (22.93)
                } else if (position === 'right') {
                  intersectionX = hX + 1.5; // Center of right T
                  intersectionY = hY; // Use horizontal line Y (22.93)
                } else if (position === 'bottom') {
                  intersectionX = vX; // Use vertical line X (22)
                  intersectionY = hY; // Use horizontal line Y (43.822)
                }
              } else if (isVesselFullTubeCoil || isVesselSemiTubeCoil || isVesselJacketed) {
                if (position === 'top') {
                  intersectionX = vX; // Use vertical line X (22)
                  intersectionY = hY; // Use horizontal line Y (2)
                } else if (position === 'left') {
                  // For left, use the first junction at Y=17
                  intersectionX = hX + 0.5; // Adjusted center of left T (-0.023 + 0.5)
                  intersectionY = hY; // Use horizontal line Y (17)
                } else if (position === 'right') {
                  // For right, use the first junction at Y=9
                  intersectionX = hX + 1.5; // Center of right T (40.023 + 1.5)
                  intersectionY = hY; // Use horizontal line Y (9)
                } else if (position === 'bottom') {
                  intersectionX = vX; // Use vertical line X (22)
                  intersectionY = hY; // Use horizontal line Y (46)
                } else if (position === 'left2') {
                  // Second left junction at Y=40
                  intersectionX = hX + 0.5; // Adjusted center of left T (-0.023 + 0.5)
                  intersectionY = hY; // Use horizontal line Y (40)
                } else if (position === 'right2') {
                  // Second right junction at Y=31
                  intersectionX = hX + 1.5; // Center of right T (40.023 + 1.5)
                  intersectionY = hY; // Use horizontal line Y (31)
                }
              } else if (isVesselSemiTubeCoil || isVesselJacketed) {
                if (position === 'top') {
                  intersectionX = vX; // Use vertical line X
                  intersectionY = hY; // Use horizontal line Y
                } else if (position === 'left') {
                  intersectionX = hX + 1; // Center of left T
                  intersectionY = hY; // Use horizontal line Y
                } else if (position === 'right') {
                  intersectionX = hX + 1.5; // Center of right T
                  intersectionY = hY; // Use horizontal line Y
                } else if (position === 'bottom') {
                  intersectionX = vX; // Use vertical line X
                  intersectionY = hY; // Use horizontal line Y
                  intersectionX = hX + 1; // Center of left T (use first junction)
                  intersectionY = hY; // Use horizontal line Y (17 or 40)
                } else if (position === 'right') {
                  intersectionX = hX + 1.5; // Center of right T (use first junction)
                  intersectionY = hY; // Use horizontal line Y (9 or 31)
                } else if (position === 'bottom') {
                  intersectionX = vX; // Use vertical line X (22)
                  intersectionY = hY; // Use horizontal line Y (46)
                }
              } else if (isVesselJacketed) {
                if (position === 'top') {
                  intersectionX = vX; // Use vertical line X (14)
                  intersectionY = hY; // Use horizontal line Y (2)
                } else if (position === 'left') {
                  intersectionX = hX + 2; // Center of left T at x=0
                  intersectionY = hY; // Use horizontal line Y (23)
                } else if (position === 'right') {
                  intersectionX = hX + 2; // Center of right T at x=24
                  intersectionY = hY; // Use horizontal line Y (23)
                } else if (position === 'bottom') {
                  intersectionX = vX; // Use vertical line X (14)
                  intersectionY = hY; // Use horizontal line Y (44)
                }
              } else if (isVesselSemiTubeCoil) {
                if (position === 'top') {
                  intersectionX = vX; // Use vertical line X (18)
                  intersectionY = hY; // Use horizontal line Y (1.979)
                } else if (position === 'left') {
                  intersectionX = hX + 2; // Center of left T at x=0, add 2 for center
                  intersectionY = hY; // Use horizontal line Y (17 or 39)
                } else if (position === 'right') {
                  intersectionX = hX + 2; // Center of right T at x=32, add 2 for center
                  intersectionY = hY; // Use horizontal line Y (9 or 31)
                } else if (position === 'bottom') {
                  intersectionX = vX; // Use vertical line X (18)
                  intersectionY = hY; // Use horizontal line Y (46.021)
                }
              } else if (isStorageContainer) {
                if (position === 'top') {
                  intersectionX = vX; // Use vertical line X (24)
                  intersectionY = hY; // Use horizontal line Y (2)
                } else if (position === 'left') {
                  intersectionX = hX + 2; // Center of left T
                  intersectionY = hY; // Use horizontal line Y (11)
                } else if (position === 'right') {
                  intersectionX = hX + 1.5; // Center of right T
                  intersectionY = hY; // Use horizontal line Y (11)
                } else if (position === 'bottom') {
                  intersectionX = vX; // Use vertical line X (24)
                  intersectionY = hY; // Use horizontal line Y (22)
                }
              } else if (isStorageBag) {
                if (position === 'top') {
                  intersectionX = vX; // Use vertical line X (12)
                  intersectionY = hY; // Use horizontal line Y (2)
                } else if (position === 'left') {
                  intersectionX = hX + 1; // Center of left T at x=0
                  intersectionY = hY; // Use horizontal line Y (19)
                } else if (position === 'right') {
                  intersectionX = hX + 1.5; // Center of right T at x=20
                  intersectionY = hY; // Use horizontal line Y (19)
                } else if (position === 'bottom') {
                  intersectionX = vX; // Use vertical line X (12)
                  intersectionY = hY; // Use horizontal line Y (36)
                }
              } else if (isStorageBarrelDrum) {
                if (position === 'top') {
                  intersectionX = vX; // Use vertical line X (12)
                  intersectionY = hY; // Use horizontal line Y (2)
                } else if (position === 'left') {
                  intersectionX = hX + 1.5; // Center of left T
                  intersectionY = hY; // Use horizontal line Y (18)
                } else if (position === 'right') {
                  intersectionX = hX + 1.5; // Center of right T
                  intersectionY = hY; // Use horizontal line Y (18)
                } else if (position === 'bottom') {
                  intersectionX = vX; // Use vertical line X (12)
                  intersectionY = hY; // Use horizontal line Y (35)
                }
              } else if (isStorageGasCylinder) {
                if (position === 'top') {
                  intersectionX = vX; // Use vertical line X (8)
                  intersectionY = hY; // Use horizontal line Y (2)
                } else if (position === 'left') {
                  intersectionX = hX + 1; // Center of left T at x=0
                  intersectionY = hY; // Use horizontal line Y (19)
                } else if (position === 'right') {
                  intersectionX = hX + 1.5; // Center of right T at x=12
                  intersectionY = hY; // Use horizontal line Y (19)
                } else if (position === 'bottom') {
                  intersectionX = vX; // Use vertical line X (8)
                  intersectionY = hY; // Use horizontal line Y (35)
                }
              } else if (isFurnaceIndustrial) {
                if (position === 'top') {
                  intersectionX = vX; // Use vertical line X (14)
                  intersectionY = hY; // Use horizontal line Y (2)
                } else if (position === 'left') {
                  intersectionX = hX + 2; // Center of left T at x=0
                  intersectionY = hY; // Use horizontal line Y (22)
                } else if (position === 'right') {
                  intersectionX = hX + 1.5; // Center of right T at x=24
                  intersectionY = hY; // Use horizontal line Y (22)
                } else if (position === 'bottom') {
                  intersectionX = vX; // Use vertical line X (14)
                  intersectionY = hY; // Use horizontal line Y (42)
                }
              } else if (isTankGeneralBasin) {
                if (position === 'top') {
                  intersectionX = vX; // Use vertical line X (25)
                  intersectionY = hY; // Use horizontal line Y (2)
                } else if (position === 'left') {
                  intersectionX = hX + 1; // Center of left T (1 + 1 = 2)
                  intersectionY = hY; // Use horizontal line Y (19)
                } else if (position === 'right') {
                  intersectionX = hX + 1.5; // Center of right T (45 + 1.5 = 46.5)
                  intersectionY = hY; // Use horizontal line Y (19)
                } else if (position === 'bottom') {
                  intersectionX = vX; // Use vertical line X (25)
                  intersectionY = hY; // Use horizontal line Y (36)
                }
              } else if (isPump || isCompressor || isBlower) {
                if (position === 'top') {
                  intersectionX = vX; // Use vertical line X (22)
                  intersectionY = hY; // Use horizontal line Y (2)
                } else if (position === 'left') {
                  intersectionX = hX + 2; // Center of left T (0 + 2 = 2)
                  intersectionY = hY; // Use horizontal line Y (22)
                } else if (position === 'right') {
                  intersectionX = hX + 2; // Center of right T (40 + 2 = 42)
                  intersectionY = hY; // Use horizontal line Y (22)
                } else if (position === 'bottom') {
                  intersectionX = vX; // Use vertical line X (22)
                  intersectionY = hY; // Use horizontal line Y (42)
                }
              } else if (isValve) {
                // Valves have variable positions based on type
                if (position === 'left') {
                  intersectionX = hX + 1.25; // Center of left T
                  intersectionY = hY; // Use horizontal line Y (5)
                } else if (position === 'right') {
                  // Check if it's a right-side or center junction
                  if (hX > 40) {
                    intersectionX = hX + 1.25; // Right side valve junction
                  } else {
                    intersectionX = hX; // Center junction for 3-way valves
                  }
                  intersectionY = hY; // Use horizontal line Y (5)
                } else if (position === 'top' || position === 'bottom') {
                  // Some valves have vertical connections
                  intersectionX = vX; // Use vertical line X
                  intersectionY = hY; // Use horizontal line Y
                }
              } else if (isInstrument) {
                if (position === 'top') {
                  intersectionX = vX; // Use vertical line X (22.5)
                  intersectionY = hY; // Use horizontal line Y (2.5)
                } else if (position === 'left') {
                  intersectionX = hX + 1.25; // Center of left T
                  intersectionY = hY; // Use horizontal line Y (22.5)
                } else if (position === 'right') {
                  intersectionX = hX + 2.5; // Center of right T
                  intersectionY = hY; // Use horizontal line Y (22.5)
                } else if (position === 'bottom') {
                  intersectionX = vX; // Use vertical line X (22.5)
                  intersectionY = hY; // Use horizontal line Y (42.5)
                }
              } else if (isHeatExchangerGeneral1) {
                if (position === 'top') {
                  intersectionX = vX; // Use vertical line X (22)
                  intersectionY = hY; // Use horizontal line Y (2)
                } else if (position === 'left') {
                  intersectionX = hX + 2; // Center of left T at x=0
                  intersectionY = hY; // Use horizontal line Y (22)
                } else if (position === 'right') {
                  intersectionX = hX + 1.6; // Center of right T at x=40.304
                  intersectionY = hY; // Use horizontal line Y (10)
                } else if (position === 'bottom') {
                  intersectionX = vX; // Use vertical line X (22)
                  intersectionY = hY; // Use horizontal line Y (42)
                }
              } else if (isHeatExchanger) {
                // Heat exchangers have variable sizes, use relative positioning
                if (position === 'top') {
                  intersectionX = vX;
                  intersectionY = hY;
                } else if (position === 'left') {
                  intersectionX = hX + 1;
                  intersectionY = hY;
                } else if (position === 'right') {
                  intersectionX = hX + 1;
                  intersectionY = hY;
                } else if (position === 'bottom') {
                  intersectionX = vX;
                  intersectionY = hY;
                }
              }
              
              // Apply main group offset
              const absoluteX = mainGroupOffsetX + intersectionX;
              const absoluteY = mainGroupOffsetY + intersectionY;
              
              // Scale to actual symbol size
              let scaledX = absoluteX * scaleX;
              let scaledY = absoluteY * scaleY;
              
              // Add 0.7px adjustment to move handles slightly right
              // This compensates for the slight left shift from T-junction calculations
              if (position === 'left' || position === 'right') {
                scaledX += 0.7;
              }
              
              // Determine Position enum value and handle ID using configuration
              let positionEnum = Position.Top; // Default to Top
              let handleId;
              
              if (position === 'top') {
                positionEnum = Position.Top;
                handleId = generateHandleId(HANDLE_CONFIG.idFormat.standardPositions.top);
              } else if (position === 'right') {
                positionEnum = Position.Right;
                handleId = generateHandleId(HANDLE_CONFIG.idFormat.standardPositions.right);
              } else if (position === 'bottom') {
                positionEnum = Position.Bottom;
                handleId = generateHandleId(HANDLE_CONFIG.idFormat.standardPositions.bottom);
              } else if (position === 'left') {
                positionEnum = Position.Left;
                handleId = generateHandleId(HANDLE_CONFIG.idFormat.standardPositions.left);
              } else if (position === 'right2') {
                // Second right handler for vessel full tube coil
                positionEnum = Position.Right;
                handleId = generateHandleId('right2');
              } else if (position === 'left2') {
                // Second left handler for vessel full tube coil
                positionEnum = Position.Left;
                handleId = generateHandleId('left2');
              }
              
              // Only add if we have a valid position
              if (positionEnum !== undefined && handleId !== undefined) {
                junctionPoints.push({
                  x: scaledX,
                  y: scaledY,
                  id: handleId,
                  position: positionEnum
                });
              }
              }
              
              junctionPoints.push({
                x: scaledX,
                y: scaledY,
                id: `handle-${handleIndex}`,
                position: positionEnum
              });
              
              console.log(`[PIDSymbolNode ${id}] ${position} handle at:`, {
                position,
                scaledX: scaledX.toFixed(2),
                scaledY: scaledY.toFixed(2),
                adjustment: position === 'left' || position === 'right' ? '+0.7px' : 'none',
                finalX: scaledX.toFixed(2)
              });
            }
          }
        });
        
        // Note: Additional junctions are now handled directly in the main loop for vessel full tube coil
        // This ensures consistent and stable handler behavior like tank general basin
        // Process additional junctions for vessels with multiple connection points
        if (additionalJunctions && additionalJunctions.length > 0) {
          additionalJunctions.forEach(addJunction => {
            if (addJunction.h && addJunction.v) {
              const hTransform = addJunction.h.transform;
              const vTransform = addJunction.v.transform;
              
              // Parse transforms to get coordinates
              const hMatch = hTransform.match(/translate\(([^)]+)\)/);
              const vMatch = vTransform.match(/translate\(([^)]+)\)/);
              
              if (hMatch && vMatch) {
                // Use stored x,y values if available (for accurate positioning)
                const [parsedHX, parsedHY] = hMatch[1].split(/[\s,]+/).map(parseFloat);
                const [vX, vY] = vMatch[1].split(/[\s,]+/).map(parseFloat);
                const hX = addJunction.x || parsedHX;
                const hY = addJunction.y || parsedHY;
                
                let intersectionX, intersectionY;
                
                if (addJunction.position === 'right2') {
                  if (isHeatExchangerGeneral1) {
                    // Heat exchanger general1 has specific right junction positions
                    console.log(`[Heat Exchanger General1] right2 junction - hX: ${hX}, hY: ${hY}, stored Y: ${addJunction.y}`);
                    intersectionX = hX + 1.6; // Center of lower right T at x=40.304
                    intersectionY = hY; // Use horizontal line Y (34)
                  } else {
                    intersectionX = hX + 1.5; // Center of right T
                    intersectionY = hY; // Use horizontal line Y (31)
                  }
                } else if (addJunction.position === 'left2') {
                  intersectionX = hX + 1; // Center of left T
                  intersectionY = hY; // Use horizontal line Y (40)
                }
                
                // Apply main group offset
                const absoluteX = mainGroupOffsetX + intersectionX;
                const absoluteY = mainGroupOffsetY + intersectionY;
                
                // Scale to actual symbol size
                const scaledX = absoluteX * scaleX;
                const scaledY = absoluteY * scaleY;
                
                const handleId = `handle-${junctionPoints.length}`;
                junctionPoints.push({
                  x: scaledX,
                  y: scaledY,
                  id: handleId,
                  position: addJunction.position.includes('right') ? Position.Right : Position.Left,
                  edgeDistance: 4
                });
                
                console.log(`[PIDSymbolNode ${id}] Additional ${addJunction.position} handle at:`, {
                  handleId,
                  scaledX: scaledX.toFixed(2),
                  scaledY: scaledY.toFixed(2),
                  position: addJunction.position
                });
              }
            }
          });
        }
        
        // Use all detected T-junction points
        if (junctionPoints.length > 0) {
          connectionPoints = junctionPoints;
          console.log(`Using ${junctionPoints.length} T-junctions for ${id}`, junctionPoints.map(p => ({
            id: p.id,
            x: p.x.toFixed(2),
            y: p.y.toFixed(2),
            position: p.position
          })));
          
          // For vessel full tube coil with 6 handles, trigger node internals update
          // This ensures React Flow properly registers all handles
          if (isVesselFullTubeCoil && junctionPoints.length === 6) {
            const timeoutId = setTimeout(() => {
              // Dispatch custom event to trigger node internals update
              window.dispatchEvent(new CustomEvent('update-node-internals', {
                detail: { nodeId: id }
              }));
              activeTimeouts.delete(timeoutId);
            }, 100);
            activeTimeouts.add(timeoutId);
          }
        } else {
          console.log('No T-junctions found, using fallback');
          connectionPoints = []; // Will trigger fallback handles
        }
        
        // Mark initial detection as complete
        initialDetectionComplete = true;
        // Skip the complex logic for now - we're testing simple approach
        
        // Debug logging to understand connection points (disabled for performance)
        // console.log(`Node ${id} connection points:`, connectionPoints.length, connectionPoints);
        // console.log(`Node dimensions: ${data.width}x${data.height}`);
        
        // Hide red elements initially instead of removing them
        redElements.forEach(el => {
          el.setAttribute('class', 'connection-indicator');
          el.setAttribute('opacity', '0');
        });
        
        // Remove pipe labels (T and PIPE text) for cleaner display
        const blueTextElements = svg.querySelectorAll('[fill="#004c99"], [fill="rgb(0,76,153)"]');
        blueTextElements.forEach(el => {
          // Check if it's a text path or contains text content
          if (el.tagName.toLowerCase() === 'path' && el.parentElement) {
            const parentTransform = el.parentElement.getAttribute('transform') || '';
            // These are typically text paths in pipe symbols
            if (parentTransform.includes('translate')) {
              el.parentElement.remove();
            }
          }
        });
        
        // Process fill attributes to prevent flash and apply stroke-width
        const allElements = svg.querySelectorAll('*');
        allElements.forEach(el => {
          const fill = el.getAttribute('fill');
          // Preserve white fills explicitly
          if (fill === 'white') {
            el.style.fill = 'white';
          } else if (fill === 'none' || !fill) {
            el.style.fill = 'none';
          }
          
          // Apply stroke width and linecap to elements with stroke (except connection indicators)
          if (!el.classList.contains('connection-indicator')) {
            const hasStroke = el.getAttribute('stroke');
            if (hasStroke && hasStroke !== 'none') {
              el.setAttribute('stroke-width', nodeStrokeWidth.toString());
              el.style.strokeWidth = nodeStrokeWidth + 'px';
              el.setAttribute('stroke-linecap', nodeStrokeLinecap);
              el.style.strokeLinecap = nodeStrokeLinecap;
            }
          }
        });
        
        // Set the SVG content with processed fills
        svgContent = new XMLSerializer().serializeToString(svg);
        isLoading = false;
        
        // Apply current stroke properties after SVG is rendered
        const timeoutId = setTimeout(() => {
          updateStrokePropertiesDirectly(nodeStrokeWidth, nodeStrokeLinecap);
          activeTimeouts.delete(timeoutId);
        }, 10);
        activeTimeouts.add(timeoutId);
      } catch (error) {
        // Only log if not aborted
        if (error.name !== 'AbortError') {
          console.error('Failed to load SVG:', error);
        }
        isLoading = false;
        // Mark detection as complete even on error
        if (!initialDetectionComplete) {
          initialDetectionComplete = true;
          connectionPoints = [];
        }
      }
    }
  }
  
  // Update stroke properties without reloading entire SVG
  function updateStrokePropertiesDirectly(strokeWidth: number, strokeLinecap: string) {
    // Wait for next tick to ensure DOM is ready
    const frameId = requestAnimationFrame(() => {
      const container = document.querySelector(`[data-node-id="${id}"] .symbol-content`);
      if (container) {
        const svgElement = container.querySelector('svg');
        if (svgElement) {
          // Get all stroke elements, not just specific types
          const allElements = svgElement.querySelectorAll('*');
          allElements.forEach(el => {
            // Skip connection indicators 
            if (!el.classList.contains('connection-indicator')) {
              const hasStroke = el.getAttribute('stroke');
              // Apply to any element with a stroke that's not a connection indicator
              if (hasStroke && hasStroke !== 'none') {
                // Skip red connection indicators
                if (hasStroke === '#ff0000' || hasStroke === '#646464' || 
                    hasStroke === 'red' || hasStroke === 'rgb(255,0,0)' ||
                    hasStroke === 'rgb(100,100,100)') {
                  return;
                }
                // Force update with important to override any CSS
                (el as SVGElement).style.setProperty('stroke-width', strokeWidth + 'px', 'important');
                el.setAttribute('stroke-width', strokeWidth.toString());
                (el as SVGElement).style.setProperty('stroke-linecap', strokeLinecap, 'important');
                el.setAttribute('stroke-linecap', strokeLinecap);
              }
            }
          });
        }
      }
      activeAnimationFrames.delete(frameId);
    });
    activeAnimationFrames.add(frameId);
  }
  
  // Get handle rotation based on position
  function getHandleRotation(point: {x: number, y: number}): number {
    const position = getHandlePosition(point);
    switch(position) {
      case Position.Right: return 180;
      case Position.Top: return 90;
      case Position.Bottom: return -90;
      case Position.Left:
      default: return 0;
    }
  }
  
  // Calculate handle position as percentage - centered on T-shape
  function getHandleStyle(point: {x: number, y: number}) {
    // Position handle exactly at T-shape center
    // Ensure we're at the exact calculated position
    const left = `${(point.x / data.width) * 100}%`;
    const top = `${(point.y / data.height) * 100}%`;
    return `left: ${left}; top: ${top};`;
  }
  
  // Determine handle position type based on location
  function getHandlePosition(point: {x: number, y: number}): Position {
    const centerX = data.width / 2;
    const centerY = data.height / 2;
    
    const dx = Math.abs(point.x - centerX);
    const dy = Math.abs(point.y - centerY);
    
    if (dx > dy) {
      return point.x > centerX ? Position.Right : Position.Left;
    } else {
      return point.y > centerY ? Position.Bottom : Position.Top;
    }
  }
  
  // Get tag transform based on position and offsets
  function getTagTransform(position: string, offsetX: number, offsetY: number): string {
    const baseOffsetX = offsetX || 0;
    const baseOffsetY = offsetY || 0;
    
    switch (position) {
      case 'below':
        return `translateX(calc(-50% + ${baseOffsetX}px)) translateY(${baseOffsetY}px)`;
      case 'above':
        return `translateX(calc(-50% + ${baseOffsetX}px)) translateY(${baseOffsetY}px)`;
      case 'left':
        return `translateX(calc(-100% + ${baseOffsetX}px)) translateY(calc(-50% + ${baseOffsetY}px))`;
      case 'right':
        return `translateX(calc(100% + ${baseOffsetX}px)) translateY(calc(-50% + ${baseOffsetY}px))`;
      default:
        return `translateX(calc(-50% + ${baseOffsetX}px)) translateY(${baseOffsetY}px)`;
    }
  }
  
  // Determine if handles should be connectable based on connection state
  $: isThisNodeConnecting = connectingNodeId === id;
  $: isOtherNodeConnecting = isConnecting && connectingNodeId !== id && connectingNodeId !== null;
  
  // When this node starts connecting, it acts as source (only source handles enabled)
  // When another node is connecting, this node can be target (only target handles enabled)
  // When no connection is happening, both handles are enabled
  $: sourceHandlesEnabled = !isConnecting || isThisNodeConnecting;
  $: targetHandlesEnabled = !isConnecting || isOtherNodeConnecting;
  
  // Debug mode for visualizing handle areas (toggle via console: window.debugHandles())
  let debugHandles = false;
  if (typeof window !== 'undefined') {
    (window as any).debugPIDHandles = () => {
      debugHandles = !debugHandles;
      // Toggle debug visualization in CSS
      document.body.classList.toggle('debug-pid-handles', debugHandles);
      console.log('PID Handle debug mode:', debugHandles ? 'ON' : 'OFF');
      return debugHandles;
    };
  }
  
  // Cleanup on component destroy
  onDestroy(() => {
    // Remove event listeners
    window.removeEventListener('connection-start', handleConnectionStart as EventListener);
    window.removeEventListener('connection-end', handleConnectionEnd as EventListener);
    
    // Clear all active timeouts
    activeTimeouts.forEach(id => clearTimeout(id));
    activeTimeouts.clear();
    
    // Cancel all active animation frames
    activeAnimationFrames.forEach(id => cancelAnimationFrame(id));
    activeAnimationFrames.clear();
    
    // Abort any pending fetch
    if (abortController) {
      abortController.abort();
      abortController = null;
    }
    
    // Clear SVG content to free memory
    svgContent = '';
    connectionPoints = [];
  });
</script>

<div 
  class="pid-symbol-node"
  class:selected={isSelected}
  class:dragging
  class:locked={data.locked}
  data-node-id={id}
  style="width: {data.width}px; height: {data.height}px; transform: {transformStyle}; opacity: {nodeOpacity}; background: {isLoading ? 'white' : 'transparent'};"
>
  {#if svgContent}
    <!-- Display the SVG symbol with color and stroke width -->
    <div class="symbol-content" style="color: {nodeColor}; --stroke-width: {nodeStrokeWidth}px;">
      {@html svgContent}
    </div>
  {:else if !isLoading}
    <!-- Fallback to image if SVG parsing fails -->
    <img src={data.symbolPath} alt={data.name} style="filter: brightness(0) saturate(100%) {nodeColor !== '#000000' ? `drop-shadow(0 0 0 ${nodeColor})` : ''};" />
  {/if}
  
  <!-- Always render 4 fixed handles at standard positions (top, right, bottom, left) -->
  <!-- Each position has BOTH source and target handles for bidirectional connections -->
  <!-- Handles are dynamically enabled based on connection state -->
  
  <!-- Store T-intersection depths for each handle direction -->
  <div style="display:none" 
       data-t-depth-top="{connectionPoints.find(p => p.y < data.height * 0.4)?.edgeDistance || 12}"
       data-t-depth-right="{connectionPoints.find(p => p.x > data.width * 0.6)?.edgeDistance || 12}"
       data-t-depth-bottom="{connectionPoints.find(p => p.y > data.height * 0.6)?.edgeDistance || 12}"
       data-t-depth-left="{connectionPoints.find(p => p.x < data.width * 0.4)?.edgeDistance || 12}"
       data-node-id="{id}"
       id="t-depths-{id}">
  </div>
  
  <!-- Dynamic handles positioned at actual T-junction points -->
  {#if $handleVisibility && initialDetectionComplete}
    {#each connectionPoints as point, index}
      <!-- Use position from point if available, otherwise calculate it -->
      {@const handlePosition = point.position || getHandlePosition(point)}
      {@const debugInfo = `Handle ${point.id}: pos=${handlePosition}, x=${(point.x / data.width * 100).toFixed(1)}%, y=${(point.y / data.height * 100).toFixed(1)}%`}
      
      <!-- Single bidirectional handle at T-junction -->
      <!-- Configuration ensures stable behavior - DO NOT change type or add suffixes to ID -->
      <Handle
        type={HANDLE_CONFIG.type}
        position={handlePosition}
        id={point.id}
        style="left: {(point.x / data.width) * 100}%; top: {(point.y / data.height) * 100}%; transform: translate(-50%, -50%);"
        class="connection-handle"
        isConnectable={HANDLE_CONFIG.isConnectable}
        data-debug={debugInfo}
      />
    {/each}
  {/if}
  
  <!-- Fallback handles if no T-junctions detected -->
  {#if initialDetectionComplete && connectionPoints.length === 0 && $handleVisibility}
    <!-- Top Handle -->
    <Handle
      type={HANDLE_CONFIG.type}
      position={Position.Top}
      id={generateHandleId(HANDLE_CONFIG.idFormat.standardPositions.top)}
      style="left: 50%; top: 0%;"
      isConnectable={HANDLE_CONFIG.isConnectable}
    />
    
    <!-- Right Handle -->
    <Handle
      type={HANDLE_CONFIG.type}
      position={Position.Right}
      id={generateHandleId(HANDLE_CONFIG.idFormat.standardPositions.right)}
      style="left: 100%; top: 50%;"
      isConnectable={HANDLE_CONFIG.isConnectable}
    />
    
    <!-- Bottom Handle -->
    <Handle
      type={HANDLE_CONFIG.type}
      position={Position.Bottom}
      id={generateHandleId(HANDLE_CONFIG.idFormat.standardPositions.bottom)}
      style="left: 50%; top: 100%;"
      isConnectable={HANDLE_CONFIG.isConnectable}
    />
    
    <!-- Left Handle -->
    <Handle
      type={HANDLE_CONFIG.type}
      position={Position.Left}
      id={generateHandleId(HANDLE_CONFIG.idFormat.standardPositions.left)}
      style="left: 0%; top: 50%;"
      isConnectable={HANDLE_CONFIG.isConnectable}
    />
  {/if}
  
  <!-- Label and Tag -->
  {#if data.showLabel !== false}
    <div class="symbol-label" style="
      font-size: {data.labelFontSize || 10}px;
      font-weight: {data.labelFontWeight || 'normal'};
      font-style: {data.labelFontStyle || 'normal'};
      color: {data.labelFontColor || '#666666'};
      background: {data.labelBgColor === 'transparent' ? 'transparent' : (data.labelBgColor || 'rgba(255, 255, 255, 0.9)')};
      padding: 2px 4px;
      transform: translateX(calc(-50% + {data.labelOffsetX || 0}px)) translateY({data.labelOffsetY || 0}px);
    ">{data.name}</div>
  {/if}
  
  {#if data.tag && data.showTag !== false}
    <div class="symbol-tag tag-position-{data.tagPosition || 'below'} {data.showLabel === false && (data.tagPosition === 'below' || !data.tagPosition) ? 'no-label' : ''}" style="
      font-size: {data.tagFontSize || 10}px;
      font-weight: {data.tagFontWeight || 'normal'};
      font-style: {data.tagFontStyle || 'normal'};
      color: {data.tagFontColor || '#666666'};
      background: {data.tagBgColor === 'transparent' ? 'transparent' : (data.tagBgColor || 'rgba(255, 255, 255, 0.9)')};
      padding: 2px 4px;
      transform: {getTagTransform(data.tagPosition || 'below', data.tagOffsetX, data.tagOffsetY)};
    ">
      {data.tag}
    </div>
  {/if}
</div>

<style>
  .pid-symbol-node {
    position: relative;
    background: transparent;
    border: none;
    padding: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    overflow: visible;
  }
  
  .symbol-content {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  
  .symbol-content :global(svg) {
    width: 100%;
    height: 100%;
  }
  
  /* Apply color to SVG strokes only, preserve fills */
  .symbol-content :global(svg path),
  .symbol-content :global(svg line),
  .symbol-content :global(svg rect),
  .symbol-content :global(svg circle),
  .symbol-content :global(svg ellipse),
  .symbol-content :global(svg polygon),
  .symbol-content :global(svg polyline) {
    stroke: currentColor !important;
  }
  
  /* Don't apply stroke width to connection indicators */
  .symbol-content :global(svg .connection-indicator) {
    stroke-width: 0.5px !important;
  }
  
  /* Preserve white fills for vessels and equipment */
  .symbol-content :global(svg [fill="white"]) {
    fill: white !important;
  }
  
  /* For elements with no fill or fill="none", keep them transparent */
  .symbol-content :global(svg *:not([fill])),
  .symbol-content :global(svg [fill="none"]) {
    fill: none !important;
  }
  
  /* For non-white, non-none fills, use currentColor */
  .symbol-content :global(svg [fill]:not([fill="none"]):not([fill="white"])) {
    fill: currentColor !important;
  }
  
  /* Stable blue glow effect for selected nodes */
  .pid-symbol-node.selected {
    outline: 2px solid rgba(59, 130, 246, 0.5);
    outline-offset: 3px;
    background: radial-gradient(circle at center, rgba(59, 130, 246, 0.05), transparent 70%);
    border-radius: 4px;
  }
  
  .pid-symbol-node.dragging {
    opacity: 0.5;
    cursor: grabbing !important;
  }
  
  /* Locked element styling */
  .pid-symbol-node.locked {
    cursor: not-allowed !important;
  }
  
  .pid-symbol-node.locked::after {
    content: '🔒';
    position: absolute;
    top: -8px;
    right: -8px;
    font-size: 10px;
    background: white;
    border-radius: 50%;
    padding: 2px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
    z-index: 1000;
  }
  
  .symbol-content {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
  }
  
  .symbol-content :global(svg) {
    width: 100% !important;
    height: 100% !important;
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;
  }
  
  .symbol-label {
    position: absolute;
    bottom: -20px;
    left: 50%;
    white-space: nowrap;
    border-radius: 2px;
  }
  
  /* Tag styles - simple only */
  .symbol-tag {
    position: absolute;
    white-space: nowrap;
    border-radius: 2px;
  }
  
  /* Tag positions */
  .symbol-tag.tag-position-below {
    bottom: -38px;
    left: 50%;
  }
  
  /* When label is hidden and tag is below, move tag closer to node */
  .symbol-tag.tag-position-below.no-label {
    bottom: -20px;
  }
  
  .symbol-tag.tag-position-above {
    top: -22px;
    left: 50%;
  }
  
  /* When label is hidden and tag is above, it stays the same */
  .symbol-tag.tag-position-above.no-label {
    top: -22px;
  }
  
  .symbol-tag.tag-position-left {
    left: -10px;
    top: 50%;
  }
  
  .symbol-tag.tag-position-right {
    right: -10px;
    top: 50%;
  }
  
  /* Connection handles - visible square handles */
  :global(.connection-handle) {
    /* Visible handle for connection */
    width: 10px !important;
    height: 10px !important;
    background: #ff0000 !important;
    border: 1px solid #ffffff !important;
    border-radius: 2px !important;
    width: 8px !important;
    height: 8px !important;
    background: #ff0000 !important;
    border: none !important;
    border-radius: 0% !important;
    overflow: visible !important;
    cursor: crosshair;
    pointer-events: all;
    z-index: 100 !important;
    transition: all 0.2s ease;
  }
  
  /* Create larger stable hit area using ::before pseudo-element */
  :global(.connection-handle::before) {
    content: '';
    position: absolute;
    width: 28px;
    height: 28px;
  }
  
  /* Create larger hit area using ::before pseudo-element */
  :global(.connection-handle::before) {
    content: '';
    position: absolute;
    width: 20px;
    height: 20px;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    background: transparent;
    pointer-events: all;
    cursor: crosshair;
    /* Debug: uncomment to see hit areas */
    /* background: rgba(0, 255, 0, 0.1); */
  }
  
  /* Show a subtle circle on hover for visual feedback */
  :global(.connection-handle:hover) {
    background: #ff4444 !important;
    transform: scale(1.2);
    box-shadow: 0 0 8px rgba(255, 68, 68, 0.6);
  }
  
  }
  
  /* Show a subtle circle on hover for visual feedback */
  :global(.connection-handle:hover::before) {
    opacity: 0.4 !important;
    background: radial-gradient(circle, rgba(59, 130, 246, 0.6) 0%, rgba(59, 130, 246, 0.2) 50%, transparent 70%) !important;
    animation: pulse-handle 1.5s ease-in-out infinite;
  }
  
  @keyframes pulse-handle {
    0% {
      transform: translate(-50%, -50%) scale(1);
    }
    50% {
      transform: translate(-50%, -50%) scale(1.1);
    }
    100% {
      transform: translate(-50%, -50%) scale(1);
    }
  }
  
  /* During connection dragging, make handles more visible */
  :global(.connecting .connection-handle) {
    opacity: 0.2 !important;
    background: radial-gradient(circle, rgba(59, 130, 246, 0.3) 0%, transparent 70%) !important;
  }
  
  /* Ensure proper layering and interaction priority */
  :global(.connection-handle-source) {
    position: absolute;
    z-index: 101 !important; /* Source handles on top */
  }
  
  :global(.connection-handle-target) {
    position: absolute;
    z-index: 100 !important; /* Target handles below source */
  }
  
  /* When connecting, prioritize target handles */
  :global(.connecting .connection-handle-target) {
    z-index: 102 !important;
  }
  
  :global(.connecting .connection-handle-source) {
    z-index: 99 !important;
  }
  
  /* Make valid connection targets more prominent during dragging */
  :global(.valid-connection-target .connection-handle) {
    opacity: 0.5 !important;
    background: radial-gradient(circle, rgba(34, 197, 94, 0.5) 0%, transparent 70%) !important;
    width: 24px !important;
    height: 24px !important;
  }
  
  /* Debug mode - visualize handle areas when enabled */
  :global(body.debug-pid-handles .connection-handle::before) {
    background: rgba(0, 255, 0, 0.2) !important;
    border: 1px dashed #00ff00 !important;
  }
  
  :global(body.debug-pid-handles .connection-handle) {
    opacity: 1 !important;
    box-shadow: 0 0 0 1px #ff00ff !important;
  }
  
  :global(body.debug-pid-handles .connection-handle-source) {
    background: rgba(255, 0, 0, 0.5) !important;
  }
  
  :global(body.debug-pid-handles .connection-handle-target) {
    background: rgba(0, 0, 255, 0.5) !important;
  }
  
  /* Debug mode - visualize handle areas */
  :global(.debug-handle) {
    opacity: 0.3 !important;
    background: rgba(255, 0, 0, 0.2) !important;
    border: 1px dashed red !important;
  }
  
  /* Debug T-shape center marker */
  .debug-t-center {
    position: absolute;
    width: 4px;
    height: 4px;
    background: lime;
    border: 1px solid darkgreen;
    transform: translate(-50%, -50%);
    z-index: 10000;
    pointer-events: none;
  }
  
  /* Show the actual red T-shapes from SVG on hover */
  .symbol-content :global(.connection-indicator) {
    /* Removed transition to prevent drag stuttering */
  }
  
  /* Show red T-shapes in blue when hovering over the node */
  .pid-symbol-node:hover .symbol-content :global(.connection-indicator) {
    opacity: 1 !important;
    stroke: #3b82f6 !important;
  }
  
  /* Show red T-shapes in red when hovering near them */
  .pid-symbol-node:hover .symbol-content :global(.connection-indicator:hover) {
    opacity: 1 !important;
    stroke: #ff0000 !important;
  }
  
  /* Override edge path to connect flush with symbols */
  :global(.svelte-flow__edge-path) {
    stroke-linecap: butt !important;
    /* Ensure edges connect properly without gaps */
  }
  
  /* Remove any edge offset */
  :global(.svelte-flow__edge) {
    /* Ensure edges reach all the way to connection points */
  }
  
  img {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }
</style>