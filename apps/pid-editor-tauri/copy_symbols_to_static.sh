#!/bin/bash

# Copy all extracted SVG files from build/symbols to static/symbols

echo "Copying symbol files to static directory..."

# ISO symbols
for category in "Equipments" "Valves" "Instruments" "Fittings" "Pipes-And-Signal-Lines"; do
    src="build/symbols/ISO/PID-ISO-${category}-Symbols/svg"
    dst="static/symbols/ISO/PID-ISO-${category}-Symbols/svg"
    
    if [ -d "$src" ]; then
        echo "  Copying ISO ${category}..."
        mkdir -p "$dst"
        cp -r "$src"/* "$dst/" 2>/dev/null || true
    fi
done

# PIP symbols
for category in "Equipments" "Valves" "Instruments" "Fittings" "Pipes-And-Signal-Lines"; do
    src="build/symbols/PIP/PID-PIP-${category}-Symbols/svg"
    dst="static/symbols/PIP/PID-PIP-${category}-Symbols/svg"
    
    if [ -d "$src" ]; then
        echo "  Copying PIP ${category}..."
        mkdir -p "$dst"
        cp -r "$src"/* "$dst/" 2>/dev/null || true
    fi
done

echo "✅ Done copying symbol files"

# Count files
echo ""
echo "Symbol counts:"
for dir in static/symbols/ISO/*/svg static/symbols/PIP/*/svg; do
    if [ -d "$dir" ]; then
        count=$(ls -1 "$dir"/*.svg 2>/dev/null | wc -l)
        echo "  $dir: $count files"
    fi
done