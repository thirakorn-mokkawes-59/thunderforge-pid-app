# Svelte Flow Integration for P&ID Editor

## Overview
Successfully integrated Svelte Flow (xyflow) to replace the custom D3.js implementation for the P&ID editor. This provides better connection management, automatic handle positioning, and built-in zoom/pan controls.

## Key Implementation Details

### 1. Package Installation
```bash
npm install @xyflow/svelte
```

### 2. Custom P&ID Symbol Node Component
Created `PIDSymbolNode.svelte` that:
- Loads SVG symbols dynamically
- Automatically detects red T-shapes (connection points)
- Places handles at exact T-shape positions
- Groups nearby duplicate T-shapes (within 5 pixels)
- Removes red T-shapes from display

### 3. T-Shape Detection Algorithm
The algorithm successfully identifies connection points by:

1. **Finding Red Elements**: Searches for elements with `stroke="#ff0000"`, `stroke="rgb(255,0,0)"`, or `stroke="red"`

2. **Transform Parsing**: 
   - Extracts translate values from transforms
   - Handles rotation transforms (rotation center often indicates connection point)
   - Accumulates parent transforms up the DOM tree

3. **Path Analysis**:
   - For path elements, calculates midpoint of lines
   - Uses rotation center when available (more accurate)
   - Falls back to line midpoint for simple paths

4. **Grouping Duplicates**:
   - Groups points within 5 pixels of each other
   - Averages positions for more accuracy
   - Eliminates duplicate handles at same connection point

5. **Scaling**:
   - Scales from SVG viewBox coordinates to actual node display size
   - Maintains accurate positioning regardless of symbol size

### 4. Handle Configuration
- Single handle per connection point (bidirectional)
- Blue color scheme (#1e3a8a default, #3b82f6 on hover)
- 8px size (10px on hover)
- Proper z-index for visibility

### 5. Canvas Component
`CanvasFlow.svelte` provides:
- Drag and drop support for symbols
- Automatic node/edge synchronization with diagram store
- Built-in controls (zoom, pan, minimap)
- Background grid

## Connection Point Calculation Formula

```javascript
// For each red element:
1. Parse transform: translate(x, y) and rotate(angle, cx, cy)
2. Position = translate + rotation_center (if rotation exists)
3. Add parent transforms recursively
4. Scale: final_position = position * (node_size / viewBox_size)
5. Group nearby points within threshold
```

## Working Features
✅ Drag and drop symbols from library
✅ Automatic T-shape detection and handle placement
✅ Connection creation by dragging between handles
✅ Connections follow symbols when moved
✅ Zoom/pan controls
✅ Grid background
✅ Selection and multi-selection

## Important Notes
- T-shapes in SVGs must have red stroke (#ff0000) to be detected
- Each T-shape typically consists of 2 path elements that get grouped
- Handles are positioned at the exact T-shape locations
- Rotation transforms in SVG often indicate the precise connection point

## File Structure
```
src/lib/components/
├── CanvasFlow.svelte       # Main canvas using Svelte Flow
├── PIDSymbolNode.svelte    # Custom node component for P&ID symbols
└── Canvas.svelte           # (Old D3 implementation - deprecated)
```

This implementation successfully solves the connection point positioning issues that were problematic in the D3 version.