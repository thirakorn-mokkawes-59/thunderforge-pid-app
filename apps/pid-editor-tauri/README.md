# P&ID Editor Application

A modern Process and Instrumentation Diagram (P&ID) editor built with SvelteKit and Svelte Flow.

## Features

- Drag and drop P&ID symbols (ISO and PIP standards)
- Click-based connections between symbols at T-shape connection points
- Seamless edge connections with symbols
- Zoom up to 500%
- Step-style routing for professional P&ID diagrams
- Automatic handle detection from SVG symbols

## Tech Stack

- SvelteKit with TypeScript
- Svelte Flow (@xyflow/svelte) for diagram management
- Lucide icons for UI
- Tailwind CSS for styling

## Development

```bash
npm install
npm run dev
```

## Symbol Organization

The project includes P&ID symbols organized by:
- **ISO Standard**: Equipment, Fittings, Instruments, Pipes/Signal Lines, Valves
- **PIP Standard**: Equipment, Fittings, Instruments, Pipes/Signal Lines, Valves

Each symbol SVG includes red T-shapes marking connection points that are automatically detected by the application.
