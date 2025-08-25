#!/usr/bin/env python3
"""
ISO Equipment Symbol Extractor
Extracts P&ID equipment symbols from JSON to individual SVG files with proper names
Optionally converts SVG files to PNG format
"""

import json
import os
import re
import shutil
import argparse
from pathlib import Path
import subprocess
import sys


class ISOEquipmentExtractor:
    def __init__(self, json_file='pid-iso-equipment.json', svg_file='pid-iso-equipment.svg'):
        self.json_file = json_file
        self.svg_file = svg_file
        self.output_dir = 'svg'
        self.symbol_data = {}
        self.symbol_names = {}
        
    def clean_svg_content(self, svg_content):
        """Clean and fix SVG content to be valid"""
        # Remove non-standard v: attributes (v:unit, v:flip, etc.)
        svg_content = re.sub(r'\s+v:\w+="[^"]*"', '', svg_content)
        
        # Fix HTML entities in attributes
        svg_content = svg_content.replace('&quot;', '"')
        
        # Add xmlns attribute if missing
        if 'xmlns=' not in svg_content:
            svg_content = svg_content.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"', 1)
        
        # Add xlink namespace if there are xlink:href attributes
        if 'xlink:href' in svg_content and 'xmlns:xlink' not in svg_content:
            svg_content = svg_content.replace('<svg', '<svg xmlns:xlink="http://www.w3.org/1999/xlink"', 1)
        
        # Fix shapes: add stroke color and appropriate fill for P&ID symbols
        lines = svg_content.split('>')
        fixed_lines = []
        for line in lines:
            # Handle paths, rects, circles, ellipses, polygons, polylines
            shape_tags = ['<path', '<rect', '<circle', '<ellipse', '<polygon', '<polyline']
            is_shape = any(tag in line for tag in shape_tags)
            
            if is_shape:
                # Add stroke color if missing but has stroke-width
                if 'stroke-width=' in line and 'stroke=' not in line:
                    line = line.replace('stroke-width=', 'stroke="#000000" stroke-width=')
                
                # For P&ID symbols: determine appropriate fill
                if 'fill=' not in line and ('stroke=' in line or 'stroke-width=' in line):
                    # Equipment bodies (ellipses, circles, large rects) should be white-filled
                    # to hide construction lines behind them
                    if '<ellipse' in line or '<circle' in line:
                        # Ellipses and circles are typically vessel/tank bodies - fill white
                        line = line.replace('<ellipse', '<ellipse fill="white"')
                        line = line.replace('<circle', '<circle fill="white"')
                    elif '<rect' in line:
                        # Check if it's a large rect (main body) - look for size
                        height_match = re.search(r'height="([0-9.]+)"', line)
                        width_match = re.search(r'width="([0-9.]+)"', line)
                        if height_match and width_match:
                            height = float(height_match.group(1))
                            width = float(width_match.group(1))
                            # Large rectangles (>10 units) are equipment bodies
                            if height > 10 or width > 10:
                                line = line.replace('<rect', '<rect fill="white"')
                            else:
                                line = line.replace('<rect', '<rect fill="none"')
                        else:
                            line = line.replace('<rect', '<rect fill="none"')
                    else:
                        # Paths and other shapes default to no fill (just outlines)
                        for tag in shape_tags:
                            if tag in line:
                                line = line.replace(tag, f'{tag} fill="none"')
                                break
            
            fixed_lines.append(line)
        svg_content = '>'.join(fixed_lines)
        
        # Add XML declaration if missing
        if not svg_content.startswith('<?xml'):
            svg_content = '<?xml version="1.0" encoding="UTF-8"?>\n' + svg_content
        
        return svg_content
    
    def load_json_data(self):
        """Load symbol data from JSON file"""
        print(f"Loading JSON data from {self.json_file}...")
        try:
            with open(self.json_file, 'r') as f:
                self.symbol_data = json.load(f)
            print(f"✅ Loaded {len(self.symbol_data)} symbols")
            return True
        except Exception as e:
            print(f"❌ Error loading JSON: {e}")
            return False
    
    def extract_symbol_names(self):
        """Extract symbol names from the original SVG file"""
        print(f"\nExtracting symbol names from {self.svg_file}...")
        try:
            with open(self.svg_file, 'r') as f:
                content = f.read()
            
            # Split by viewBox to find individual symbols
            symbols = re.split(r'<svg viewBox', content)[1:]  # Skip the first part
            
            # Extract titles for each symbol section
            for i, symbol in enumerate(symbols):
                # Find the first title in this symbol section
                title_match = re.search(r'<title>([^<]+)</title>', symbol)
                if title_match:
                    title = title_match.group(1)
                    # Skip the main document title
                    if 'P&ID ISO Equipment' not in title:
                        self.symbol_names[str(i)] = title
            
            print(f"✅ Extracted {len(self.symbol_names)} symbol names")
            return True
        except Exception as e:
            print(f"⚠️  Warning: Could not extract names from SVG: {e}")
            print("   Symbols will be numbered only")
            return False
    
    def clean_filename(self, name):
        """Clean symbol name for use as filename"""
        # Remove special characters and convert to lowercase with underscores
        name = re.sub(r'[^\w\s-]', '', name)
        name = re.sub(r'[-\s]+', '_', name)
        return name.lower()
    
    def extract_symbols(self, use_names=True):
        """Extract symbols from JSON to individual SVG files"""
        # Create output directory
        os.makedirs(self.output_dir, exist_ok=True)
        
        print(f"\nExtracting symbols to {self.output_dir}/...")
        
        extracted_count = 0
        for key, svg_content in self.symbol_data.items():
            idx = int(key)
            
            # Clean and fix SVG content
            clean_svg = self.clean_svg_content(svg_content)
            
            # Create filename
            if use_names and key in self.symbol_names:
                clean_name = self.clean_filename(self.symbol_names[key])
                filename = f"pid_iso_equipment_{idx:03d}_{clean_name}.svg"
            else:
                filename = f"pid_iso_equipment_{idx:03d}.svg"
            
            filepath = os.path.join(self.output_dir, filename)
            
            # Write to file
            with open(filepath, 'w') as f:
                f.write(clean_svg)
            
            if use_names and key in self.symbol_names:
                print(f"  {idx:03d}: {filename} ({self.symbol_names[key]})")
            else:
                print(f"  {idx:03d}: {filename}")
            
            extracted_count += 1
        
        print(f"\n✅ Successfully extracted {extracted_count} symbols")
        return extracted_count
    
    def create_reference_csv(self):
        """Create a CSV reference file for easy lookup"""
        csv_path = 'symbol_reference.csv'
        print(f"\nCreating reference file: {csv_path}")
        
        with open(csv_path, 'w') as f:
            f.write("Index,Filename,Description,Category\n")
            for key in sorted(self.symbol_data.keys(), key=lambda x: int(x)):
                idx = int(key)
                
                if key in self.symbol_names:
                    name = self.symbol_names[key]
                    clean_name = self.clean_filename(name)
                    filename = f"pid_iso_equipment_{idx:03d}_{clean_name}.svg"
                    
                    # Extract category from name
                    category = name.split(' - ')[0] if ' - ' in name else 'Other'
                else:
                    name = f"Symbol {idx}"
                    filename = f"pid_iso_equipment_{idx:03d}.svg"
                    category = 'Unknown'
                
                f.write(f"{idx},{filename},{name},{category}\n")
        
        print(f"✅ Created {csv_path}")
    
    def check_conversion_tool(self):
        """Check if conversion tool is available"""
        try:
            # Try to import cairosvg
            import cairosvg
            return 'cairosvg'
        except ImportError:
            # Check if rsvg-convert is available
            try:
                result = subprocess.run(['which', 'rsvg-convert'], 
                                      capture_output=True, text=True)
                if result.returncode == 0:
                    return 'rsvg-convert'
            except:
                pass
            
            # Check if inkscape is available
            try:
                result = subprocess.run(['which', 'inkscape'], 
                                      capture_output=True, text=True)
                if result.returncode == 0:
                    return 'inkscape'
            except:
                pass
        
        return None
    
    def convert_svg_to_png(self, svg_path, png_path, size=256, tool=None):
        """Convert a single SVG file to PNG"""
        try:
            if tool == 'cairosvg':
                import cairosvg
                cairosvg.svg2png(url=svg_path, write_to=png_path, 
                               output_width=size, output_height=size)
                return True
            
            elif tool == 'rsvg-convert':
                subprocess.run([
                    'rsvg-convert', svg_path, '-o', png_path,
                    '-w', str(size), '-h', str(size)
                ], check=True)
                return True
            
            elif tool == 'inkscape':
                subprocess.run([
                    'inkscape', svg_path, '--export-filename', png_path,
                    '--export-width', str(size), '--export-height', str(size)
                ], check=True, capture_output=True)
                return True
                
        except Exception as e:
            print(f"  ⚠️  Error converting {svg_path}: {e}")
            return False
        
        return False
    
    def convert_to_png(self, png_size=256):
        """Convert all SVG files to PNG format"""
        # Check for conversion tool
        tool = self.check_conversion_tool()
        
        if not tool:
            print("\n⚠️  No SVG to PNG conversion tool found!")
            print("   Please install one of the following:")
            print("   • pip install cairosvg (recommended)")
            print("   • brew install librsvg (for rsvg-convert on macOS)")
            print("   • brew install inkscape (for Inkscape on macOS)")
            return 0
        
        print(f"\n🎨 Converting SVG to PNG using {tool}...")
        print(f"   Size: {png_size}x{png_size} pixels")
        
        # Create PNG directory
        png_dir = 'png'
        os.makedirs(png_dir, exist_ok=True)
        
        # Get list of SVG files
        svg_files = sorted([f for f in os.listdir(self.output_dir) if f.endswith('.svg')])
        
        if not svg_files:
            print("   No SVG files found to convert")
            return 0
        
        converted_count = 0
        for svg_file in svg_files:
            svg_path = os.path.join(self.output_dir, svg_file)
            png_file = svg_file.replace('.svg', '.png')
            png_path = os.path.join(png_dir, png_file)
            
            # Convert
            if self.convert_svg_to_png(svg_path, png_path, png_size, tool):
                converted_count += 1
                if converted_count % 10 == 0:
                    print(f"   Converted {converted_count}/{len(svg_files)} files...")
        
        print(f"\n✅ Successfully converted {converted_count} PNG files to {png_dir}/")
        return converted_count
    
    def analyze_symbols(self):
        """Analyze and report on the extracted symbols"""
        print("\n" + "=" * 70)
        print("SYMBOL ANALYSIS REPORT")
        print("=" * 70)
        
        # Count categories
        categories = {}
        for name in self.symbol_names.values():
            category = name.split(' - ')[0] if ' - ' in name else 'Other'
            categories[category] = categories.get(category, 0) + 1
        
        print("\nSymbol Categories:")
        for category, count in sorted(categories.items()):
            print(f"  {category:30s}: {count:3d} symbols")
        
        # Analyze red markers (connection points)
        red_marker_count = 0
        for svg_content in self.symbol_data.values():
            if 'stroke="#ff0000"' in svg_content:
                red_marker_count += 1
        
        print(f"\nConnection Points:")
        print(f"  {red_marker_count} symbols have red connection markers")
        print(f"  These indicate where pipes/instruments can connect")
        
        print("\n" + "=" * 70)
    
    def run(self, extract_names=True, create_csv=True, analyze=True, 
            convert_png=False, png_size=256):
        """Run the complete extraction process"""
        print("=" * 70)
        print("ISO EQUIPMENT SYMBOL EXTRACTOR")
        print("=" * 70)
        
        # Load JSON data
        if not self.load_json_data():
            return False
        
        # Try to extract names from SVG
        has_names = False
        if extract_names:
            has_names = self.extract_symbol_names()
        
        # Extract symbols
        count = self.extract_symbols(use_names=has_names)
        
        # Create reference CSV
        if create_csv and has_names:
            self.create_reference_csv()
        
        # Analyze symbols
        if analyze and has_names:
            self.analyze_symbols()
        
        # Convert to PNG if requested
        png_count = 0
        if convert_png:
            png_count = self.convert_to_png(png_size)
        
        print("\n✨ Extraction complete!")
        print(f"   {count} SVG files in {self.output_dir}/")
        if png_count > 0:
            print(f"   {png_count} PNG files in png/")
        if create_csv and has_names:
            print(f"   Reference CSV: symbol_reference.csv")
        
        return True


def main():
    """Main function with command-line interface"""
    parser = argparse.ArgumentParser(
        description='Extract ISO P&ID equipment symbols from JSON to SVG/PNG files'
    )
    parser.add_argument(
        '--json', 
        default='pid-iso-equipment.json',
        help='Input JSON file (default: pid-iso-equipment.json)'
    )
    parser.add_argument(
        '--svg', 
        default='pid-iso-equipment.svg',
        help='Original SVG file for names (default: pid-iso-equipment.svg)'
    )
    parser.add_argument(
        '--output', 
        default='svg',
        help='Output directory (default: svg)'
    )
    parser.add_argument(
        '--no-names', 
        action='store_true',
        help='Skip extracting symbol names'
    )
    parser.add_argument(
        '--no-csv', 
        action='store_true',
        help='Skip creating reference CSV'
    )
    parser.add_argument(
        '--no-analyze', 
        action='store_true',
        help='Skip analysis report'
    )
    parser.add_argument(
        '--png', 
        action='store_true',
        help='Convert SVG files to PNG format'
    )
    parser.add_argument(
        '--png-size', 
        type=int,
        default=256,
        help='PNG size in pixels (default: 256)'
    )
    
    args = parser.parse_args()
    
    # Create extractor
    extractor = ISOEquipmentExtractor(args.json, args.svg)
    extractor.output_dir = args.output
    
    # Run extraction
    success = extractor.run(
        extract_names=not args.no_names,
        create_csv=not args.no_csv,
        analyze=not args.no_analyze,
        convert_png=args.png,
        png_size=args.png_size
    )
    
    return 0 if success else 1


if __name__ == "__main__":
    exit(main())