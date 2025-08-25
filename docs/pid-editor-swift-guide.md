# P&ID Editor - Swift/Xcode Development Guide

## Project Overview
Building a native macOS/iOS P&ID (Piping and Instrumentation Diagram) editor using Swift and Xcode, leveraging the 460 extracted symbols (ISO and PIP standards).

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
- **Xcode**: Version 14.0 or later
- **macOS**: Ventura 13.0 or later
- **Swift**: 5.9 or later
- **CocoaPods** or **Swift Package Manager**: For dependencies

### Initial Project Setup
```bash
# Create project directory
mkdir -p ~/GitHub/hazop-ai/apps/pid-editor-swift
cd ~/GitHub/hazop-ai/apps/pid-editor-swift

# Create Xcode project via command line (optional)
# Or create via Xcode: File > New > Project > macOS > App
```

### Project Structure
```
pid-editor-swift/
├── PIDEditor.xcodeproj
├── PIDEditor/
│   ├── App/
│   │   ├── PIDEditorApp.swift
│   │   └── Info.plist
│   ├── Models/
│   │   ├── Symbol.swift
│   │   ├── Diagram.swift
│   │   ├── Connection.swift
│   │   └── DiagramElement.swift
│   ├── Views/
│   │   ├── MainWindow.swift
│   │   ├── CanvasView.swift
│   │   ├── SymbolLibrary.swift
│   │   └── PropertyInspector.swift
│   ├── Canvas/
│   │   ├── DiagramScene.swift
│   │   ├── SymbolNode.swift
│   │   ├── ConnectionLayer.swift
│   │   └── GridLayer.swift
│   ├── Symbols/
│   │   ├── SymbolLoader.swift
│   │   ├── SVGParser.swift
│   │   └── SymbolCache.swift
│   ├── Utils/
│   │   ├── GeometryHelpers.swift
│   │   ├── FileManager+Extensions.swift
│   │   └── ColorTheme.swift
│   └── Resources/
│       └── Assets.xcassets
```

## Architecture Overview

### Core Components

#### 1. **SpriteKit-Based Canvas**
```swift
// DiagramScene.swift
import SpriteKit

class DiagramScene: SKScene {
    var gridLayer: GridLayer!
    var symbolLayer: SKNode!
    var connectionLayer: ConnectionLayer!
    var selectionLayer: SKNode!
    
    override func didMove(to view: SKView) {
        setupLayers()
        setupGestureRecognizers()
    }
}
```

#### 2. **Symbol Management**
```swift
// Symbol.swift
struct Symbol: Codable, Identifiable {
    let id: UUID
    let name: String
    let category: SymbolCategory
    let standard: Standard // ISO or PIP
    let svgPath: String
    let connectionPoints: [CGPoint]
    
    enum Standard: String, Codable {
        case iso = "ISO"
        case pip = "PIP"
    }
    
    enum SymbolCategory: String, Codable {
        case equipment = "Equipment"
        case valves = "Valves"
        case instruments = "Instruments"
        case fittings = "Fittings"
        case pipesAndSignals = "Pipes & Signal Lines"
    }
}
```

#### 3. **Connection System**
```swift
// Connection.swift
class Connection: NSObject {
    var startPoint: ConnectionPoint
    var endPoint: ConnectionPoint
    var pathStyle: PathStyle
    var routingAlgorithm: RoutingAlgorithm = .orthogonal
    
    enum PathStyle {
        case solid
        case dashed
        case dotted
    }
    
    enum RoutingAlgorithm {
        case orthogonal
        case direct
        case curved
    }
}
```

## Step-by-Step Implementation

### Phase 1: Basic Setup (Week 1)
1. Create Xcode project with SwiftUI + SpriteKit
2. Set up folder structure
3. Import SVGKit via Swift Package Manager
4. Create basic window with canvas

### Phase 2: Symbol Loading (Week 2)
```swift
// SymbolLoader.swift
import SVGKit

class SymbolLoader {
    static let shared = SymbolLoader()
    private var symbolCache: [String: SKTexture] = [:]
    
    func loadSymbol(from path: String) -> SKTexture? {
        // Check cache first
        if let cached = symbolCache[path] {
            return cached
        }
        
        // Load SVG
        guard let svgImage = SVGKImage(contentsOfFile: path) else {
            return nil
        }
        
        // Convert to texture
        let texture = SKTexture(image: svgImage.nsImage)
        symbolCache[path] = texture
        
        return texture
    }
    
    func loadAllSymbols() {
        // Load from /assests/Symbols/PID-Symbols/
        let symbolsPath = "../../assests/Symbols/PID-Symbols/"
        // Iterate through ISO and PIP folders
    }
}
```

### Phase 3: Canvas Implementation (Week 3-4)
```swift
// CanvasView.swift
import SwiftUI
import SpriteKit

struct CanvasView: View {
    @StateObject private var scene = DiagramScene()
    
    var body: some View {
        SpriteView(scene: scene)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .onDrop(of: [.text], isTargeted: nil) { providers in
                // Handle symbol drop
                return true
            }
    }
}
```

### Phase 4: Symbol Library (Week 5)
```swift
// SymbolLibrary.swift
struct SymbolLibrary: View {
    @State private var selectedCategory: Symbol.SymbolCategory = .equipment
    @State private var selectedStandard: Symbol.Standard = .iso
    @State private var searchText = ""
    
    var body: some View {
        VStack {
            // Search bar
            TextField("Search symbols...", text: $searchText)
            
            // Category selector
            Picker("Category", selection: $selectedCategory) {
                ForEach(Symbol.SymbolCategory.allCases) { category in
                    Text(category.rawValue).tag(category)
                }
            }
            
            // Symbol grid
            ScrollView {
                LazyVGrid(columns: [GridItem(.adaptive(minimum: 60))]) {
                    ForEach(filteredSymbols) { symbol in
                        SymbolThumbnail(symbol: symbol)
                            .draggable(symbol.id.uuidString)
                    }
                }
            }
        }
    }
}
```

### Phase 5: Connection System (Week 6-7)
```swift
// ConnectionLayer.swift
class ConnectionLayer: SKNode {
    var connections: [Connection] = []
    
    func addConnection(from: SymbolNode, to: SymbolNode) {
        let connection = Connection(
            start: from.nearestConnectionPoint,
            end: to.nearestConnectionPoint
        )
        
        let path = calculateOrthogonalPath(from: connection.startPoint, 
                                          to: connection.endPoint)
        
        let shapeNode = SKShapeNode(path: path)
        shapeNode.strokeColor = .black
        shapeNode.lineWidth = 2.0
        
        addChild(shapeNode)
        connections.append(connection)
    }
    
    private func calculateOrthogonalPath(from: CGPoint, to: CGPoint) -> CGPath {
        // A* pathfinding or orthogonal routing algorithm
        let path = CGMutablePath()
        path.move(to: from)
        
        // Calculate intermediate points for orthogonal routing
        let midX = (from.x + to.x) / 2
        path.addLine(to: CGPoint(x: midX, y: from.y))
        path.addLine(to: CGPoint(x: midX, y: to.y))
        path.addLine(to: to)
        
        return path
    }
}
```

### Phase 6: Property Inspector (Week 8)
```swift
// PropertyInspector.swift
struct PropertyInspector: View {
    @Binding var selectedElement: DiagramElement?
    
    var body: some View {
        VStack(alignment: .leading) {
            Text("Properties")
                .font(.headline)
            
            if let element = selectedElement {
                Form {
                    TextField("Name", text: $element.name)
                    TextField("Tag", text: $element.tag)
                    
                    if element is SymbolNode {
                        Slider(value: $element.rotation, in: 0...360)
                        Picker("Size", selection: $element.size) {
                            Text("Small").tag(Size.small)
                            Text("Medium").tag(Size.medium)
                            Text("Large").tag(Size.large)
                        }
                    }
                }
            } else {
                Text("No selection")
                    .foregroundColor(.secondary)
            }
        }
        .frame(width: 250)
    }
}
```

## Key Technologies

### 1. **SpriteKit for Canvas**
- Hardware-accelerated 2D rendering
- Built-in physics for snapping
- Efficient scene graph management

### 2. **SVGKit for Symbol Loading**
```bash
# Add to Package.swift or via Xcode
dependencies: [
    .package(url: "https://github.com/SVGKit/SVGKit.git", from: "3.0.0")
]
```

### 3. **CoreData for Persistence**
```swift
// Diagram.xcdatamodeld
// Entity: Diagram
// - id: UUID
// - name: String
// - created: Date
// - modified: Date
// - elements: Data (JSON)
// - thumbnail: Data (PNG)
```

### 4. **Combine for State Management**
```swift
class DiagramViewModel: ObservableObject {
    @Published var currentDiagram: Diagram?
    @Published var selectedElements: Set<DiagramElement> = []
    @Published var zoomLevel: CGFloat = 1.0
    @Published var isModified: Bool = false
}
```

## Performance Optimization

### 1. **Symbol Caching**
```swift
class SymbolCache {
    private let cache = NSCache<NSString, SKTexture>()
    
    func texture(for symbol: Symbol) -> SKTexture {
        let key = NSString(string: symbol.svgPath)
        
        if let cached = cache.object(forKey: key) {
            return cached
        }
        
        let texture = loadTexture(from: symbol.svgPath)
        cache.setObject(texture, forKey: key)
        return texture
    }
}
```

### 2. **Viewport Culling**
```swift
extension DiagramScene {
    func cullInvisibleNodes() {
        guard let view = self.view else { return }
        let visibleRect = view.bounds
        
        enumerateChildNodes(withName: "symbol") { node, _ in
            node.isHidden = !visibleRect.intersects(node.frame)
        }
    }
}
```

### 3. **Level of Detail (LOD)**
```swift
func updateLOD(for zoomLevel: CGFloat) {
    if zoomLevel < 0.5 {
        // Show simplified symbols
        useSimplifiedSymbols = true
    } else {
        // Show full detail
        useSimplifiedSymbols = false
    }
}
```

## Testing Strategy

### Unit Tests
```swift
// SymbolLoaderTests.swift
class SymbolLoaderTests: XCTestCase {
    func testSymbolLoading() {
        let loader = SymbolLoader()
        let symbol = loader.loadSymbol(from: "test_path")
        XCTAssertNotNil(symbol)
    }
    
    func testConnectionRouting() {
        let start = CGPoint(x: 0, y: 0)
        let end = CGPoint(x: 100, y: 100)
        let path = ConnectionRouter.orthogonalPath(from: start, to: end)
        XCTAssertNotNil(path)
    }
}
```

### UI Tests
```swift
// PIDEditorUITests.swift
class PIDEditorUITests: XCTestCase {
    func testDragAndDropSymbol() {
        let app = XCUIApplication()
        app.launch()
        
        // Drag symbol from library to canvas
        let symbolLibrary = app.windows["SymbolLibrary"]
        let canvas = app.windows["Canvas"]
        
        symbolLibrary.images["valve_symbol"].drag(to: canvas)
        
        XCTAssertEqual(canvas.images.count, 1)
    }
}
```

## Deployment

### App Store Preparation
1. **Code Signing**
   - Developer ID Application certificate
   - Provisioning profiles

2. **App Sandboxing**
   ```xml
   <!-- Entitlements.plist -->
   <key>com.apple.security.files.user-selected.read-write</key>
   <true/>
   ```

3. **Notarization**
   ```bash
   xcrun altool --notarize-app \
     --primary-bundle-id "com.yourcompany.pideditor" \
     --username "developer@email.com" \
     --password "@keychain:AC_PASSWORD" \
     --file PIDEditor.app.zip
   ```

### Direct Distribution
```bash
# Create DMG
create-dmg \
  --volname "PID Editor" \
  --window-pos 200 120 \
  --window-size 600 400 \
  --icon-size 100 \
  --icon "PIDEditor.app" 200 190 \
  --app-drop-link 400 190 \
  "PIDEditor.dmg" \
  "build/"
```

## Common Issues & Solutions

### Issue 1: SVG Loading Performance
**Solution**: Pre-render SVGs to textures at build time

### Issue 2: Memory Usage with Large Diagrams
**Solution**: Implement node pooling and recycling

### Issue 3: Connection Routing Overlap
**Solution**: Implement collision detection for paths

## Resources

- [SpriteKit Documentation](https://developer.apple.com/documentation/spritekit)
- [SVGKit GitHub](https://github.com/SVGKit/SVGKit)
- [SwiftUI Tutorials](https://developer.apple.com/tutorials/swiftui)
- [Core Data Programming Guide](https://developer.apple.com/library/archive/documentation/Cocoa/Conceptual/CoreData/)

## Next Steps

1. Start with Phase 1 - Basic Setup
2. Test symbol loading with your extracted SVGs
3. Implement basic drag-and-drop
4. Add connection system
5. Iterate based on user feedback

---

*Last Updated: December 2024*
*Version: 1.0*