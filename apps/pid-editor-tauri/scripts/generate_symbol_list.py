#!/usr/bin/env python3
import os
import json
import re
from pathlib import Path

def extract_name_from_filename(filename):
    """Extract human-readable name from filename like 'pid_iso_equipment_000_tank_general_basin.svg'"""
    # Remove extension
    name = filename.replace('.svg', '')
    # Remove prefix pattern (pid_iso_category_nnn_)
    match = re.match(r'pid_(iso|pip)_[a-z_]+_\d{3}_(.+)', name)
    if match:
        # Convert underscores to spaces and title case
        raw_name = match.group(2)
        return raw_name.replace('_', ' ').title()
    else:
        # Fallback for files without descriptive names
        return name.split('_')[-1].title()

def generate_symbol_data():
    """Generate JavaScript array of all symbols"""
    base_path = Path("/Users/thirakorn/GitHub/hazop-ai/assests/Symbols/PID-Symbols")
    symbols = []
    
    # Category mappings
    category_map = {
        'equipment': 'equipment',
        'equipments': 'equipment',
        'valves': 'valves',
        'instruments': 'instruments',
        'fittings': 'fittings',
        'pipes-and-signal-lines': 'pipes',
        'pipes_and_signal_lines': 'pipes'
    }
    
    # Process each standard
    for standard in ['ISO', 'PIP']:
        standard_path = base_path / standard
        
        # Process each category folder
        for category_folder in standard_path.glob('PID-*-Symbols'):
            svg_folder = category_folder / 'svg'
            if not svg_folder.exists():
                continue
                
            # Extract category from folder name
            folder_name = category_folder.name.lower()
            category = None
            for key in category_map:
                if key in folder_name:
                    category = category_map[key]
                    break
            
            if not category:
                continue
            
            # Process each SVG file
            for svg_file in sorted(svg_folder.glob('*.svg')):
                filename = svg_file.name
                symbol_id = f"{standard.lower()}_{category}_{len(symbols)}"
                name = extract_name_from_filename(filename)
                
                # Create relative path for web access
                relative_path = f"/symbols/{standard}/{category_folder.name}/svg/{filename}"
                
                symbols.append({
                    'id': symbol_id,
                    'name': name,
                    'category': category,
                    'standard': standard,
                    'path': relative_path
                })
    
    return symbols

def write_typescript_file(symbols):
    """Write TypeScript file with all symbol definitions"""
    output = """// Auto-generated symbol definitions
// Generated from actual symbol files in assests/Symbols/PID-Symbols

export const allSymbols = [
"""
    
    for symbol in symbols:
        output += f"  {{ id: '{symbol['id']}', name: '{symbol['name']}', category: '{symbol['category']}', standard: '{symbol['standard']}', path: '{symbol['path']}' }},\n"
    
    output += "];\n"
    
    output += f"\n// Total symbols: {len(symbols)}\n"
    output += f"// ISO symbols: {len([s for s in symbols if s['standard'] == 'ISO'])}\n"
    output += f"// PIP symbols: {len([s for s in symbols if s['standard'] == 'PIP'])}\n"
    
    return output

def main():
    print("Generating symbol list from actual files...")
    symbols = generate_symbol_data()
    
    # Write TypeScript file
    ts_content = write_typescript_file(symbols)
    output_path = Path("/Users/thirakorn/GitHub/hazop-ai/apps/pid-editor-tauri/src/lib/data/allSymbols.ts")
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(ts_content)
    
    print(f"Generated {len(symbols)} symbols")
    print(f"ISO: {len([s for s in symbols if s['standard'] == 'ISO'])} symbols")
    print(f"PIP: {len([s for s in symbols if s['standard'] == 'PIP'])} symbols")
    print(f"Output written to: {output_path}")
    
    # Print category breakdown
    categories = {}
    for symbol in symbols:
        key = f"{symbol['standard']} - {symbol['category']}"
        categories[key] = categories.get(key, 0) + 1
    
    print("\nBreakdown by category:")
    for cat, count in sorted(categories.items()):
        print(f"  {cat}: {count}")

if __name__ == "__main__":
    main()