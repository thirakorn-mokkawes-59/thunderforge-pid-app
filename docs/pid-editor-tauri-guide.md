# P&ID Editor - Tauri/SvelteKit Development Guide

## Project Overview
Building a cross-platform P&ID (Piping and Instrumentation Diagram) editor using Tauri (Rust backend) and SvelteKit (frontend) with D3.js for diagram manipulation, utilizing the 460 extracted symbols (ISO and PIP standards).

## Table of Contents
1. [Setup & Prerequisites](#setup--prerequisites)
2. [Architecture Overview](#architecture-overview)
3. [Step-by-Step Implementation](#step-by-step-implementation)
4. [Key Technologies](#key-technologies)
5. [Code Examples](#code-examples)
6. [Performance Optimization](#performance-optimization)
7. [Testing Strategy](#testing-strategy)
8. [Deployment](#deployment)

## Setup & Prerequisites

### Required Tools
- **Node.js**: v18.0 or later
- **Rust**: 1.70 or later
- **pnpm**: (recommended) or npm/yarn
- **Tauri CLI**: Latest version
- **VS Code**: With Rust and Svelte extensions

### Initial Project Setup
```bash
# Create project directory
mkdir -p ~/GitHub/hazop-ai/apps/pid-editor-tauri
cd ~/GitHub/hazop-ai/apps/pid-editor-tauri

# Create Tauri + SvelteKit app
npm create tauri-app@latest . -- --template sveltekit-ts
# Or if you prefer manual setup:
pnpm create vite@latest . --template svelte-ts
pnpm add -D @tauri-apps/cli @tauri-apps/api

# Install dependencies
pnpm install

# Additional dependencies for P&ID editor
pnpm add d3 d3-drag d3-zoom d3-selection
pnpm add -D @types/d3
```

### Project Structure
```
pid-editor-tauri/
├── src-tauri/              # Rust backend
│   ├── src/
│   │   ├── main.rs         # Entry point
│   │   ├── commands.rs     # Tauri commands
│   │   ├── diagram.rs      # Diagram logic
│   │   ├── file_ops.rs     # File operations
│   │   └── symbol.rs       # Symbol management
│   ├── Cargo.toml
│   └── tauri.conf.json
├── src/                    # SvelteKit frontend
│   ├── lib/
│   │   ├── components/
│   │   │   ├── Canvas.svelte
│   │   │   ├── SymbolLibrary.svelte
│   │   │   ├── PropertyPanel.svelte
│   │   │   ├── Toolbar.svelte
│   │   │   └── ContextMenu.svelte
│   │   ├── stores/
│   │   │   ├── diagram.ts
│   │   │   ├── symbols.ts
│   │   │   └── selection.ts
│   │   ├── utils/
│   │   │   ├── d3-helpers.ts
│   │   │   ├── geometry.ts
│   │   │   └── routing.ts
│   │   └── types/
│   │       ├── diagram.ts
│   │       └── symbol.ts
│   ├── routes/
│   │   ├── +layout.svelte
│   │   └── +page.svelte
│   └── app.html
├── static/
│   └── symbols/            # Symlink to PID-Symbols
├── package.json
├── svelte.config.js
├── vite.config.ts
└── tsconfig.json
```

## Architecture Overview

### Frontend Architecture (SvelteKit + D3.js)

#### 1. **Canvas Component with D3.js**
```typescript
// lib/components/Canvas.svelte
<script lang="ts">
  import { onMount } from 'svelte';
  import * as d3 from 'd3';
  import { diagram } from '$lib/stores/diagram';
  
  let svg: SVGSVGElement;
  let g: d3.Selection<SVGGElement, unknown, null, undefined>;
  
  onMount(() => {
    const svgSelection = d3.select(svg);
    g = svgSelection.append('g');
    
    // Setup zoom behavior
    const zoom = d3.zoom()
      .scaleExtent([0.1, 10])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
      });
    
    svgSelection.call(zoom);
    
    // Setup drag behavior for symbols
    setupDragBehavior();
    
    // Setup connection drawing
    setupConnectionDrawing();
  });
</script>

<svg bind:this={svg} class="w-full h-full">
  <!-- Grid background -->
  <defs>
    <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
      <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#e5e7eb" stroke-width="1"/>
    </pattern>
  </defs>
  <rect width="100%" height="100%" fill="url(#grid)" />
</svg>
```

#### 2. **Symbol Management Store**
```typescript
// lib/stores/symbols.ts
import { writable, derived } from 'svelte/store';
import { invoke } from '@tauri-apps/api/tauri';

export interface Symbol {
  id: string;
  name: string;
  category: 'equipment' | 'valves' | 'instruments' | 'fittings' | 'pipes';
  standard: 'ISO' | 'PIP';
  svgPath: string;
  connectionPoints: Point[];
}

function createSymbolStore() {
  const { subscribe, set, update } = writable<Symbol[]>([]);
  
  return {
    subscribe,
    async loadSymbols() {
      try {
        const symbols = await invoke<Symbol[]>('get_symbols');
        set(symbols);
      } catch (error) {
        console.error('Failed to load symbols:', error);
      }
    },
    async searchSymbols(query: string) {
      const symbols = await invoke<Symbol[]>('search_symbols', { query });
      return symbols;
    }
  };
}

export const symbols = createSymbolStore();
```

#### 3. **Diagram State Management**
```typescript
// lib/stores/diagram.ts
import { writable } from 'svelte/store';
import type { DiagramElement, Connection } from '$lib/types/diagram';

interface DiagramState {
  elements: DiagramElement[];
  connections: Connection[];
  selectedIds: Set<string>;
  zoom: number;
  pan: { x: number; y: number };
}

function createDiagramStore() {
  const { subscribe, set, update } = writable<DiagramState>({
    elements: [],
    connections: [],
    selectedIds: new Set(),
    zoom: 1,
    pan: { x: 0, y: 0 }
  });
  
  return {
    subscribe,
    addElement(element: DiagramElement) {
      update(state => ({
        ...state,
        elements: [...state.elements, element]
      }));
    },
    addConnection(from: string, to: string) {
      update(state => ({
        ...state,
        connections: [...state.connections, {
          id: crypto.randomUUID(),
          from,
          to,
          path: calculatePath(from, to, state.elements)
        }]
      }));
    },
    updateElement(id: string, updates: Partial<DiagramElement>) {
      update(state => ({
        ...state,
        elements: state.elements.map(el => 
          el.id === id ? { ...el, ...updates } : el
        )
      }));
    }
  };
}

export const diagram = createDiagramStore();
```

### Backend Architecture (Tauri/Rust)

#### 1. **Main Entry Point**
```rust
// src-tauri/src/main.rs
#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

mod commands;
mod diagram;
mod file_ops;
mod symbol;

use commands::*;

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            get_symbols,
            search_symbols,
            save_diagram,
            load_diagram,
            export_diagram,
            validate_connections
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

#### 2. **Symbol Management**
```rust
// src-tauri/src/symbol.rs
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

#[derive(Debug, Serialize, Deserialize)]
pub struct Symbol {
    pub id: String,
    pub name: String,
    pub category: String,
    pub standard: String,
    pub svg_path: String,
    pub connection_points: Vec<Point>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Point {
    pub x: f64,
    pub y: f64,
}

pub fn load_symbols() -> Result<Vec<Symbol>, String> {
    let symbols_dir = PathBuf::from("../../assests/Symbols/PID-Symbols");
    let mut symbols = Vec::new();
    
    // Load ISO symbols
    load_standard_symbols(&symbols_dir.join("ISO"), "ISO", &mut symbols)?;
    
    // Load PIP symbols
    load_standard_symbols(&symbols_dir.join("PIP"), "PIP", &mut symbols)?;
    
    Ok(symbols)
}

fn parse_connection_points(svg_content: &str) -> Vec<Point> {
    // Parse red markers from SVG as connection points
    // Look for stroke="#ff0000" elements
    Vec::new() // Implement actual parsing
}
```

#### 3. **Tauri Commands**
```rust
// src-tauri/src/commands.rs
use crate::symbol::Symbol;
use crate::diagram::Diagram;

#[tauri::command]
pub async fn get_symbols() -> Result<Vec<Symbol>, String> {
    symbol::load_symbols()
}

#[tauri::command]
pub async fn search_symbols(query: String) -> Result<Vec<Symbol>, String> {
    let all_symbols = symbol::load_symbols()?;
    let filtered = all_symbols
        .into_iter()
        .filter(|s| s.name.to_lowercase().contains(&query.to_lowercase()))
        .collect();
    Ok(filtered)
}

#[tauri::command]
pub async fn save_diagram(diagram: Diagram, path: String) -> Result<(), String> {
    file_ops::save_diagram(&diagram, &path)
}

#[tauri::command]
pub async fn export_diagram(diagram: Diagram, format: String) -> Result<Vec<u8>, String> {
    match format.as_str() {
        "svg" => export::to_svg(&diagram),
        "png" => export::to_png(&diagram),
        "pdf" => export::to_pdf(&diagram),
        _ => Err("Unsupported format".to_string())
    }
}
```

## Step-by-Step Implementation

### Phase 1: Project Setup (Week 1)
```bash
# 1. Initialize project
pnpm create tauri-app@latest . --template sveltekit-ts

# 2. Install dependencies
pnpm add d3 d3-drag d3-zoom d3-selection d3-shape
pnpm add -D @types/d3 @tauri-apps/api

# 3. Create folder structure
mkdir -p src/lib/{components,stores,utils,types}
mkdir -p src-tauri/src/{commands,models}

# 4. Link symbols directory
ln -s ../../../assests/Symbols/PID-Symbols static/symbols
```

### Phase 2: Symbol Library (Week 2)
```svelte
<!-- lib/components/SymbolLibrary.svelte -->
<script lang="ts">
  import { symbols } from '$lib/stores/symbols';
  import { onMount } from 'svelte';
  
  let searchQuery = '';
  let selectedCategory = 'all';
  let selectedStandard = 'all';
  
  onMount(async () => {
    await symbols.loadSymbols();
  });
  
  $: filteredSymbols = $symbols.filter(symbol => {
    const matchesSearch = symbol.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || symbol.category === selectedCategory;
    const matchesStandard = selectedStandard === 'all' || symbol.standard === selectedStandard;
    return matchesSearch && matchesCategory && matchesStandard;
  });
  
  function handleDragStart(event: DragEvent, symbol: Symbol) {
    event.dataTransfer?.setData('application/json', JSON.stringify(symbol));
  }
</script>

<div class="symbol-library">
  <div class="filters">
    <input 
      type="text" 
      bind:value={searchQuery} 
      placeholder="Search symbols..."
    />
    
    <select bind:value={selectedCategory}>
      <option value="all">All Categories</option>
      <option value="equipment">Equipment</option>
      <option value="valves">Valves</option>
      <option value="instruments">Instruments</option>
      <option value="fittings">Fittings</option>
      <option value="pipes">Pipes & Signals</option>
    </select>
    
    <select bind:value={selectedStandard}>
      <option value="all">All Standards</option>
      <option value="ISO">ISO</option>
      <option value="PIP">PIP</option>
    </select>
  </div>
  
  <div class="symbol-grid">
    {#each filteredSymbols as symbol}
      <div 
        class="symbol-item"
        draggable="true"
        on:dragstart={(e) => handleDragStart(e, symbol)}
      >
        <img src={symbol.svgPath} alt={symbol.name} />
        <span>{symbol.name}</span>
      </div>
    {/each}
  </div>
</div>

<style>
  .symbol-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
    gap: 10px;
    padding: 10px;
  }
  
  .symbol-item {
    cursor: move;
    padding: 5px;
    border: 1px solid #e0e0e0;
    border-radius: 4px;
    text-align: center;
  }
  
  .symbol-item:hover {
    background-color: #f0f0f0;
  }
</style>
```

### Phase 3: Canvas with D3.js (Week 3-4)
```typescript
// lib/utils/d3-helpers.ts
import * as d3 from 'd3';
import type { DiagramElement, Connection } from '$lib/types/diagram';

export function createCanvas(container: HTMLElement) {
  const width = container.clientWidth;
  const height = container.clientHeight;
  
  const svg = d3.select(container)
    .append('svg')
    .attr('width', width)
    .attr('height', height);
  
  // Create layers
  const layers = {
    grid: svg.append('g').attr('class', 'grid-layer'),
    connections: svg.append('g').attr('class', 'connections-layer'),
    symbols: svg.append('g').attr('class', 'symbols-layer'),
    selection: svg.append('g').attr('class', 'selection-layer')
  };
  
  // Setup zoom
  const zoom = d3.zoom<SVGSVGElement, unknown>()
    .scaleExtent([0.1, 10])
    .on('zoom', (event) => {
      Object.values(layers).forEach(layer => {
        layer.attr('transform', event.transform.toString());
      });
    });
  
  svg.call(zoom);
  
  return { svg, layers, zoom };
}

export function addSymbolToCanvas(
  layer: d3.Selection<SVGGElement, unknown, null, undefined>,
  element: DiagramElement
) {
  const g = layer.append('g')
    .attr('class', 'symbol')
    .attr('id', element.id)
    .attr('transform', `translate(${element.x}, ${element.y})`);
  
  // Load and append SVG content
  d3.xml(element.symbolPath).then(data => {
    const importedNode = document.importNode(data.documentElement, true);
    g.node()?.appendChild(importedNode);
  });
  
  // Make draggable
  const drag = d3.drag<SVGGElement, unknown>()
    .on('start', dragStarted)
    .on('drag', dragged)
    .on('end', dragEnded);
  
  g.call(drag);
  
  return g;
}

function dragStarted(event: d3.D3DragEvent<SVGGElement, unknown, unknown>) {
  d3.select(this).raise().classed('dragging', true);
}

function dragged(event: d3.D3DragEvent<SVGGElement, unknown, unknown>) {
  d3.select(this)
    .attr('transform', `translate(${event.x}, ${event.y})`);
}

function dragEnded(event: d3.D3DragEvent<SVGGElement, unknown, unknown>) {
  d3.select(this).classed('dragging', false);
  // Update store with new position
}
```

### Phase 4: Connection System (Week 5-6)
```typescript
// lib/utils/routing.ts
import * as d3 from 'd3';

export interface PathPoint {
  x: number;
  y: number;
}

export function calculateOrthogonalPath(
  start: PathPoint,
  end: PathPoint,
  obstacles: PathPoint[] = []
): string {
  // Simple orthogonal routing
  const midX = (start.x + end.x) / 2;
  
  const pathData = d3.path();
  pathData.moveTo(start.x, start.y);
  
  if (Math.abs(end.x - start.x) > Math.abs(end.y - start.y)) {
    // Horizontal first
    pathData.lineTo(midX, start.y);
    pathData.lineTo(midX, end.y);
    pathData.lineTo(end.x, end.y);
  } else {
    // Vertical first
    const midY = (start.y + end.y) / 2;
    pathData.lineTo(start.x, midY);
    pathData.lineTo(end.x, midY);
    pathData.lineTo(end.x, end.y);
  }
  
  return pathData.toString();
}

export function drawConnection(
  layer: d3.Selection<SVGGElement, unknown, null, undefined>,
  connection: Connection,
  style: 'solid' | 'dashed' | 'dotted' = 'solid'
) {
  const path = layer.append('path')
    .attr('class', 'connection')
    .attr('id', connection.id)
    .attr('d', connection.path)
    .attr('fill', 'none')
    .attr('stroke', '#000')
    .attr('stroke-width', 2);
  
  if (style === 'dashed') {
    path.attr('stroke-dasharray', '5,5');
  } else if (style === 'dotted') {
    path.attr('stroke-dasharray', '2,2');
  }
  
  return path;
}

// A* pathfinding for complex routing
export class PathFinder {
  private grid: number[][];
  private width: number;
  private height: number;
  
  constructor(width: number, height: number, cellSize: number = 10) {
    this.width = Math.ceil(width / cellSize);
    this.height = Math.ceil(height / cellSize);
    this.grid = Array(this.height).fill(0).map(() => Array(this.width).fill(0));
  }
  
  findPath(start: PathPoint, end: PathPoint): PathPoint[] {
    // Implement A* algorithm
    return [];
  }
}
```

### Phase 5: Property Panel (Week 7)
```svelte
<!-- lib/components/PropertyPanel.svelte -->
<script lang="ts">
  import { diagram } from '$lib/stores/diagram';
  import type { DiagramElement } from '$lib/types/diagram';
  
  let selectedElement: DiagramElement | null = null;
  
  $: {
    const selectedId = Array.from($diagram.selectedIds)[0];
    selectedElement = $diagram.elements.find(el => el.id === selectedId) || null;
  }
  
  function updateProperty(property: string, value: any) {
    if (selectedElement) {
      diagram.updateElement(selectedElement.id, { [property]: value });
    }
  }
</script>

<div class="property-panel">
  <h3>Properties</h3>
  
  {#if selectedElement}
    <div class="property-group">
      <label>
        Name:
        <input 
          type="text" 
          value={selectedElement.name}
          on:change={(e) => updateProperty('name', e.target.value)}
        />
      </label>
      
      <label>
        Tag:
        <input 
          type="text" 
          value={selectedElement.tag}
          on:change={(e) => updateProperty('tag', e.target.value)}
        />
      </label>
      
      <label>
        X Position:
        <input 
          type="number" 
          value={selectedElement.x}
          on:change={(e) => updateProperty('x', parseFloat(e.target.value))}
        />
      </label>
      
      <label>
        Y Position:
        <input 
          type="number" 
          value={selectedElement.y}
          on:change={(e) => updateProperty('y', parseFloat(e.target.value))}
        />
      </label>
      
      <label>
        Rotation:
        <input 
          type="range" 
          min="0" 
          max="360"
          value={selectedElement.rotation || 0}
          on:input={(e) => updateProperty('rotation', parseFloat(e.target.value))}
        />
        <span>{selectedElement.rotation || 0}°</span>
      </label>
    </div>
  {:else}
    <p>No element selected</p>
  {/if}
</div>

<style>
  .property-panel {
    width: 250px;
    padding: 1rem;
    background: #f8f9fa;
    border-left: 1px solid #dee2e6;
  }
  
  .property-group {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  
  label {
    display: flex;
    flex-direction: column;
    font-size: 0.875rem;
  }
  
  input {
    margin-top: 0.25rem;
    padding: 0.25rem;
    border: 1px solid #ced4da;
    border-radius: 0.25rem;
  }
</style>
```

### Phase 6: File Operations (Week 8)
```rust
// src-tauri/src/file_ops.rs
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;

#[derive(Debug, Serialize, Deserialize)]
pub struct Diagram {
    pub id: String,
    pub name: String,
    pub elements: Vec<DiagramElement>,
    pub connections: Vec<Connection>,
    pub metadata: DiagramMetadata,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DiagramMetadata {
    pub created: String,
    pub modified: String,
    pub version: String,
    pub author: String,
}

pub fn save_diagram(diagram: &Diagram, path: &str) -> Result<(), String> {
    let json = serde_json::to_string_pretty(diagram)
        .map_err(|e| format!("Failed to serialize diagram: {}", e))?;
    
    fs::write(path, json)
        .map_err(|e| format!("Failed to write file: {}", e))?;
    
    Ok(())
}

pub fn load_diagram(path: &str) -> Result<Diagram, String> {
    let content = fs::read_to_string(path)
        .map_err(|e| format!("Failed to read file: {}", e))?;
    
    let diagram = serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse diagram: {}", e))?;
    
    Ok(diagram)
}

pub fn export_to_svg(diagram: &Diagram) -> Result<String, String> {
    let mut svg = String::from(r#"<?xml version="1.0" encoding="UTF-8"?>"#);
    svg.push_str(r#"<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000">"#);
    
    // Add elements
    for element in &diagram.elements {
        // Load symbol SVG and add to output
    }
    
    // Add connections
    for connection in &diagram.connections {
        svg.push_str(&format!(
            r#"<path d="{}" stroke="#000" fill="none" stroke-width="2"/>"#,
            connection.path
        ));
    }
    
    svg.push_str("</svg>");
    Ok(svg)
}
```

## Performance Optimization

### 1. **Virtual Scrolling for Symbol Library**
```svelte
<!-- Use svelte-virtual-list for large symbol libraries -->
<script>
  import VirtualList from 'svelte-virtual-list';
  
  let items = $symbols;
  let itemHeight = 100;
</script>

<VirtualList {items} {itemHeight} let:item>
  <SymbolItem symbol={item} />
</VirtualList>
```

### 2. **Canvas Viewport Culling**
```typescript
// Only render visible elements
function cullInvisibleElements(viewport: DOMRect, elements: DiagramElement[]) {
  return elements.filter(element => {
    const inViewport = 
      element.x + element.width >= viewport.left &&
      element.x <= viewport.right &&
      element.y + element.height >= viewport.top &&
      element.y <= viewport.bottom;
    
    return inViewport;
  });
}
```

### 3. **Debounced Updates**
```typescript
import { debounce } from 'lodash-es';

const debouncedSave = debounce(async (diagram) => {
  await invoke('auto_save', { diagram });
}, 1000);

// Use in stores
diagram.subscribe(state => {
  debouncedSave(state);
});
```

### 4. **Web Workers for Heavy Computation**
```typescript
// lib/workers/pathfinding.worker.ts
self.addEventListener('message', (event) => {
  const { start, end, obstacles } = event.data;
  
  // Perform pathfinding in worker
  const path = calculateComplexPath(start, end, obstacles);
  
  self.postMessage({ path });
});

// Usage in component
const worker = new Worker('/pathfinding.worker.js');
worker.postMessage({ start, end, obstacles });
worker.onmessage = (event) => {
  const { path } = event.data;
  // Update connection path
};
```

## Testing Strategy

### Frontend Tests (Vitest)
```typescript
// tests/Canvas.test.ts
import { render } from '@testing-library/svelte';
import Canvas from '$lib/components/Canvas.svelte';
import { describe, it, expect } from 'vitest';

describe('Canvas Component', () => {
  it('should render SVG element', () => {
    const { container } = render(Canvas);
    const svg = container.querySelector('svg');
    expect(svg).toBeTruthy();
  });
  
  it('should handle drop events', async () => {
    const { component } = render(Canvas);
    // Simulate drop event
    // Assert element added
  });
});
```

### Backend Tests (Rust)
```rust
// src-tauri/src/tests.rs
#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_save_diagram() {
        let diagram = Diagram {
            id: "test".to_string(),
            name: "Test Diagram".to_string(),
            elements: vec![],
            connections: vec![],
            metadata: DiagramMetadata::default(),
        };
        
        let result = save_diagram(&diagram, "test.json");
        assert!(result.is_ok());
    }
    
    #[test]
    fn test_path_calculation() {
        let start = Point { x: 0.0, y: 0.0 };
        let end = Point { x: 100.0, y: 100.0 };
        let path = calculate_orthogonal_path(start, end);
        assert!(!path.is_empty());
    }
}
```

### E2E Tests (Playwright)
```typescript
// tests/e2e/diagram.spec.ts
import { test, expect } from '@playwright/test';

test('create new diagram', async ({ page }) => {
  await page.goto('/');
  
  // Drag symbol to canvas
  const symbol = page.locator('.symbol-item').first();
  const canvas = page.locator('svg');
  
  await symbol.dragTo(canvas);
  
  // Verify element added
  const elements = await page.locator('.symbol').count();
  expect(elements).toBe(1);
});
```

## Deployment

### Building for Production
```bash
# Install dependencies
pnpm install

# Build for current platform
pnpm tauri build

# Build for specific platforms
pnpm tauri build --target x86_64-pc-windows-msvc
pnpm tauri build --target x86_64-apple-darwin
pnpm tauri build --target x86_64-unknown-linux-gnu
```

### Configuration (tauri.conf.json)
```json
{
  "build": {
    "beforeBuildCommand": "pnpm build",
    "beforeDevCommand": "pnpm dev",
    "devPath": "http://localhost:5173",
    "distDir": "../build"
  },
  "package": {
    "productName": "PID Editor",
    "version": "1.0.0"
  },
  "tauri": {
    "allowlist": {
      "all": false,
      "fs": {
        "all": true,
        "scope": ["$DOCUMENT", "$DOWNLOAD", "$RESOURCE"]
      },
      "dialog": {
        "all": true
      },
      "shell": {
        "open": true
      }
    },
    "bundle": {
      "active": true,
      "category": "DeveloperTool",
      "copyright": "",
      "deb": {
        "depends": []
      },
      "externalBin": [],
      "icon": [
        "icons/32x32.png",
        "icons/128x128.png",
        "icons/128x128@2x.png",
        "icons/icon.icns",
        "icons/icon.ico"
      ],
      "identifier": "com.hazopai.pideditor",
      "longDescription": "P&ID Diagram Editor",
      "macOS": {
        "entitlements": null,
        "exceptionDomain": "",
        "frameworks": [],
        "providerShortName": null,
        "signingIdentity": null
      },
      "resources": [],
      "shortDescription": "P&ID Editor",
      "targets": "all",
      "windows": {
        "certificateThumbprint": null,
        "digestAlgorithm": "sha256",
        "timestampUrl": ""
      }
    }
  }
}
```

### Auto-Update Setup
```rust
// src-tauri/src/updater.rs
use tauri::updater::builder::UpdateBuilder;

pub fn check_for_updates(app: &tauri::App) {
    let update = UpdateBuilder::new()
        .url("https://your-server.com/update.json")
        .build(app.handle())
        .unwrap();
    
    if update.should_update() {
        update.download_and_install().unwrap();
    }
}
```

## Common Issues & Solutions

### Issue 1: Large SVG Performance
**Solution**: Convert SVGs to optimized format on load
```typescript
// Optimize SVG before rendering
function optimizeSVG(svgString: string): string {
  // Remove unnecessary attributes
  // Simplify paths
  // Reduce precision
  return optimizedSVG;
}
```

### Issue 2: Memory Leaks with D3
**Solution**: Proper cleanup
```typescript
onDestroy(() => {
  // Remove event listeners
  svg.on('.zoom', null);
  
  // Clear selections
  svg.selectAll('*').remove();
});
```

### Issue 3: File Path Issues
**Solution**: Use Tauri's path API
```typescript
import { appDataDir, join } from '@tauri-apps/api/path';

const appData = await appDataDir();
const symbolsPath = await join(appData, 'symbols');
```

## Resources

- [Tauri Documentation](https://tauri.app/v1/guides/)
- [SvelteKit Documentation](https://kit.svelte.dev/docs)
- [D3.js Documentation](https://d3js.org/)
- [Rust Book](https://doc.rust-lang.org/book/)

## Next Steps

1. Set up basic Tauri + SvelteKit project
2. Implement symbol loading from filesystem
3. Create draggable canvas with D3
4. Add connection drawing
5. Implement save/load functionality
6. Add export features
7. Optimize performance
8. Package and distribute

---

*Last Updated: December 2024*
*Version: 1.0*