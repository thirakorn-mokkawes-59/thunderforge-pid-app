# ThunderForge P&ID Editor

A modern, web-based Process and Instrumentation Diagram (P&ID) editor built with SvelteKit and Tauri. Create, edit, and export professional P&ID diagrams with an intuitive drag-and-drop interface.

## Features

### 🎨 Comprehensive Symbol Library
- **ISO Standard Symbols**: Complete set of ISO 14617 compliant P&ID symbols
- **PIP Standard Symbols**: Process Industry Practices (PIP) standard symbols
- **Categories**: Equipment, Valves, Instruments, Fittings, and Pipes/Signal Lines
- **500+ Symbols**: Extensive library covering all common P&ID elements

### 🖼️ Interactive Canvas
- **Drag & Drop**: Intuitive symbol placement from the library
- **SvelteFlow Integration**: Powered by @xyflow/svelte for smooth interactions
- **Grid Snapping**: Align elements perfectly with configurable grid
- **Zoom Controls**: Zoom in/out and fit-to-view functionality
- **Layer Management**: Bring to front, send to back, and layer ordering
- **Canvas Lock**: Lock the canvas to prevent accidental modifications

### 🎛️ Property Panel
- **Element Properties**: Customize name, description, and tags
- **Position Control**: Precise X/Y positioning with arrow controls
- **Size Adjustment**: Width and height controls for each element
- **Rotation**: 360-degree rotation control
- **Style Options**: Stroke width, color, and opacity adjustments
- **Layer Control**: Z-index management with visual layer buttons

### 💾 File Operations
- **Export Formats**: 
  - JSON (complete diagram data)
  - SVG (vector graphics)
  - PNG (raster images)
- **Import/Export**: Save and load complete diagrams
- **Auto-save**: Automatic browser-based backup every 30 seconds
- **Named Diagrams**: Double-click to edit diagram name

### 🎯 User Interface
- **Dark Theme**: Professional dark-themed interface
- **Collapsible Panels**: Hide/show symbol library and property panel
- **Status Bar**: Quick access to grid, snap, zoom, and lock controls
- **Toolbar**: File operations and user account placeholders
- **Context Menus**: Right-click for copy/paste operations
- **Keyboard Shortcuts**: Undo/redo support

## Tech Stack

- **Frontend Framework**: SvelteKit
- **Desktop Framework**: Tauri (optional, for desktop deployment)
- **Flow Library**: @xyflow/svelte
- **Icons**: Lucide Svelte
- **Language**: TypeScript
- **Styling**: CSS with CSS Variables

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- Rust (for Tauri desktop app, optional)

### Installation

1. Clone the repository:
```bash
git clone https://github.com/thirakorn-mokkawes-59/thunderforge-pid-app.git
cd thunderforge-pid-app
```

2. Navigate to the application directory:
```bash
cd apps/pid-editor-tauri
```

3. Install dependencies:
```bash
npm install
```

### Development

Run the development server:
```bash
npm run dev
```

The application will be available at `http://localhost:5173`

### Building

#### Web Application
```bash
npm run build
```

The built files will be in the `build` directory.

#### Desktop Application (Tauri)
```bash
npm run tauri build
```

## Project Structure

```
thunderforge-pid-app/
├── apps/
│   └── pid-editor-tauri/       # Main application
│       ├── src/
│       │   ├── lib/
│       │   │   ├── components/  # Svelte components
│       │   │   ├── stores/      # Svelte stores
│       │   │   ├── types/       # TypeScript types
│       │   │   └── utils/       # Utility functions
│       │   └── routes/          # SvelteKit routes
│       ├── static/              # Static assets
│       └── src-tauri/           # Tauri backend (optional)
├── assests/
│   └── Symbols/                 # P&ID symbol libraries
│       └── PID-Symbols/
│           ├── ISO/             # ISO standard symbols
│           └── PIP/             # PIP standard symbols
└── docs/                        # Documentation
```

## Usage

### Adding Symbols to Canvas
1. Browse symbols in the left panel
2. Search or filter by category
3. Drag and drop symbols onto the canvas

### Editing Elements
1. Click on an element to select it
2. Use the property panel on the right to modify:
   - Name and description
   - Position and size
   - Rotation and style
   - Layer order

### Exporting Diagrams
1. Click "Export/Import" in the toolbar
2. Choose your format:
   - JSON for complete diagram data
   - SVG for scalable vector graphics
   - PNG for images
3. Files are named using your diagram name

### Keyboard Shortcuts
- **Delete**: Remove selected element
- **Ctrl+C**: Copy selected element
- **Ctrl+V**: Paste element
- **Ctrl+Z**: Undo
- **Ctrl+Y**: Redo

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is proprietary software. All rights reserved.

## Acknowledgments

- Built with [SvelteKit](https://kit.svelte.dev/)
- Flow diagrams powered by [@xyflow/svelte](https://svelteflow.dev/)
- Desktop app framework by [Tauri](https://tauri.app/)
- Icons from [Lucide](https://lucide.dev/)

## Contact

For questions or support, please open an issue on GitHub.

---

**ThunderForge P&ID Editor** - Professional P&ID diagram creation made simple