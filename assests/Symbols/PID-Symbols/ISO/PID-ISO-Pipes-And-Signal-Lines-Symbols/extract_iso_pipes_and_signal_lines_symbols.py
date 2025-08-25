#!/usr/bin/env python3
"""
ISO Pipes and Signal Lines Symbol Extractor
Extracts P&ID pipes and signal lines symbols from JSON to individual SVG files with proper names
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


class ISOPipesAndSignalLinesExtractor:
    def __init__(self, json_file='pid-iso-pipes-and-signal-lines.json', svg_file='pid-iso-pipes-and-signal-lines.svg'):
        self.json_file = json_file
        self.svg_file = svg_file
        self.output_dir = 'svg'
        self.symbol_data = {}
        self.symbol_names = {}
        
        # Define pipes and signal lines symbol names based on common P&ID line types
        # These are organized by typical line types and signal representations
        self.predefined_names = {
            "0": "Process Line - Solid",
            "1": "Process Line - Heavy",
            "2": "Process Line - Medium",
            "3": "Process Line - Light",
            "4": "Utility Line - Air",
            "5": "Utility Line - Water",
            "6": "Utility Line - Steam",
            "7": "Utility Line - Gas",
            "8": "Electrical Signal - Basic",
            "9": "Electrical Signal - Power",
            "10": "Pneumatic Signal",
            "11": "Hydraulic Signal",
            "12": "Capillary Tube",
            "13": "Process Line - Insulated",
            "14": "Process Line - Traced",
            "15": "Process Line - Jacketed",
            "16": "Underground Line",
            "17": "Process Line - Future",
            "18": "Process Line - Existing",
            "19": "Software Link",
            "20": "Mechanical Link",
            "21": "Process Connection - Socket Weld",
            "22": "Process Connection - Screwed",
            "23": "Process Connection - Flanged",
            "24": "Process Connection - Soldered",
            "25": "Line Crossing - No Connection",
            "26": "Line Crossing - Connected",
            "27": "Flow Direction - Right",
            "28": "Flow Direction - Left",
            "29": "Flow Direction - Up",
            "30": "Flow Direction - Down",
            "31": "Flow Direction - Bidirectional",
            "32": "Signal Line - Dashed",
            "33": "Signal Line - Dotted",
            "34": "Signal Line - Chain",
            "35": "Signal Line - Double",
            "36": "Process Line - Primary",
            "37": "Process Line - Secondary",
            "38": "Process Line - Tertiary",
            "39": "Instrument Air Line",
            "40": "Nitrogen Line",
            "41": "Vacuum Line",
            "42": "Drain Line",
            "43": "Vent Line",
            "44": "Sample Line",
            "45": "Process Line - Hazardous",
            "46": "Process Line - Non-Hazardous",
            "47": "Cooling Water Supply",
            "48": "Cooling Water Return",
            "49": "Steam Supply",
            "50": "Steam Condensate",
            "51": "Fire Protection Line",
            "52": "Process Line - Sloped",
            "53": "Process Line - Vertical",
            "54": "Process Line - Horizontal",
            "55": "Signal Line - Binary",
            "56": "Signal Line - Analog",
            "57": "Signal Line - Digital"
        }
        
    def clean_svg_content(self, svg_content):
        """Clean and fix SVG content to be valid"""
        # Remove non-standard v: attributes (v:unit, v:flip, v:layer, etc.)
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
            shape_tags = ['<path', '<rect', '<circle', '<ellipse', '<polygon', '<polyline', '<line']
            is_shape = any(tag in line for tag in shape_tags)
            
            if is_shape:
                # For lines and signals, we typically don't want fills
                # Add stroke color if missing but has stroke-width
                if 'stroke-width=' in line and 'stroke=' not in line:
                    # Check if it's a special color already
                    if 'stroke="#ff0000"' not in line and 'stroke="#646464"' not in line:
                        line = line.replace('stroke-width=', 'stroke="#000000" stroke-width=')
                
                # For pipes and signal lines: determine appropriate fill
                if 'fill=' not in line and ('stroke=' in line or 'stroke-width=' in line):
                    # Lines typically have no fill
                    for tag in shape_tags:
                        if tag in line:
                            # Most line symbols should have no fill
                            line = line.replace(tag, f'{tag} fill="none"')
                            break
                
                # Special handling for markers and arrows
                if '<marker' in line or 'marker-' in line:
                    # Markers (arrowheads) might need fill
                    if 'fill=' not in line and '<polygon' in line:
                        line = line.replace('<polygon', '<polygon fill="#000000"')
                    elif 'fill=' not in line and '<path' in line and 'Z' in line:
                        # Closed paths in markers need fill
                        line = line.replace('<path', '<path fill="#000000"')
            
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
        """Extract symbol names from the original SVG file or use predefined names"""
        print(f"\nSetting up symbol names...")
        
        # Use predefined names
        self.symbol_names = self.predefined_names.copy()
        
        # Try to extract additional names from SVG if available
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
                    # Only update if we don't have a predefined name
                    if str(i) not in self.symbol_names:
                        self.symbol_names[str(i)] = title
            
            # Ensure all symbols have names
            for i in range(len(self.symbol_data)):
                if str(i) not in self.symbol_names:
                    # Generate generic name based on index
                    if i < 20:
                        self.symbol_names[str(i)] = f"Process Line - Type {i+1}"
                    elif i < 40:
                        self.symbol_names[str(i)] = f"Signal Line - Type {i-19}"
                    else:
                        self.symbol_names[str(i)] = f"Special Line - Type {i-39}"
            
            print(f"✅ Set up {len(self.symbol_names)} symbol names")
            return True
        except Exception as e:
            print(f"⚠️  Warning: Could not extract names from SVG: {e}")
            print(f"   Using {len(self.symbol_names)} predefined names")
            # Fill in remaining names
            for i in range(len(self.symbol_data)):
                if str(i) not in self.symbol_names:
                    self.symbol_names[str(i)] = f"Line Symbol {i}"
            return len(self.symbol_names) > 0
    
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
                filename = f"pid_iso_pipes_signal_{idx:03d}_{clean_name}.svg"
            else:
                filename = f"pid_iso_pipes_signal_{idx:03d}.svg"
            
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
        csv_path = 'pipes_signal_lines_reference.csv'
        print(f"\nCreating reference file: {csv_path}")
        
        with open(csv_path, 'w') as f:
            f.write("Index,Filename,Description,Category\n")
            for key in sorted(self.symbol_data.keys(), key=lambda x: int(x)):
                idx = int(key)
                
                if key in self.symbol_names:
                    name = self.symbol_names[key]
                    clean_name = self.clean_filename(name)
                    filename = f"pid_iso_pipes_signal_{idx:03d}_{clean_name}.svg"
                    
                    # Extract category from name
                    if ' - ' in name:
                        category = name.split(' - ')[0]
                    else:
                        category = name.split()[0] if name else 'Other'
                else:
                    name = f"Line Symbol {idx}"
                    filename = f"pid_iso_pipes_signal_{idx:03d}.svg"
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
        print("PIPES AND SIGNAL LINES SYMBOL ANALYSIS REPORT")
        print("=" * 70)
        
        # Count categories
        categories = {}
        for name in self.symbol_names.values():
            if ' - ' in name:
                category = name.split(' - ')[0]
            elif ' Line' in name:
                category = name.split(' Line')[0] + ' Line'
            else:
                category = name.split()[0] if name else 'Other'
            categories[category] = categories.get(category, 0) + 1
        
        print("\nSymbol Categories:")
        for category, count in sorted(categories.items()):
            print(f"  {category:30s}: {count:3d} symbols")
        
        print("\nLine Types:")
        print("  • Process Lines (solid, dashed, various weights)")
        print("  • Utility Lines (air, water, steam, gas)")
        print("  • Signal Lines (electrical, pneumatic, hydraulic)")
        print("  • Special Lines (insulated, traced, jacketed)")
        print("  • Flow Directions and Connections")
        
        # Count different line styles
        dash_count = 0
        for svg_content in self.symbol_data.values():
            if 'stroke-dasharray' in svg_content:
                dash_count += 1
        
        print(f"\nLine Styles:")
        print(f"  {dash_count} symbols use dashed/dotted patterns")
        print(f"  {len(self.symbol_data) - dash_count} symbols use solid lines")
        
        print("\n" + "=" * 70)
    
    def run(self, extract_names=True, create_csv=True, analyze=True, 
            convert_png=False, png_size=256):
        """Run the complete extraction process"""
        print("=" * 70)
        print("ISO PIPES AND SIGNAL LINES SYMBOL EXTRACTOR")
        print("=" * 70)
        
        # Load JSON data
        if not self.load_json_data():
            return False
        
        # Set up symbol names
        has_names = self.extract_symbol_names() if extract_names else False
        
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
            print(f"   Reference CSV: pipes_signal_lines_reference.csv")
        
        return True


def main():
    """Main function with command-line interface"""
    parser = argparse.ArgumentParser(
        description='Extract ISO P&ID pipes and signal lines symbols from JSON to SVG/PNG files'
    )
    parser.add_argument(
        '--json', 
        default='pid-iso-pipes-and-signal-lines.json',
        help='Input JSON file (default: pid-iso-pipes-and-signal-lines.json)'
    )
    parser.add_argument(
        '--svg', 
        default='pid-iso-pipes-and-signal-lines.svg',
        help='Original SVG file for names (default: pid-iso-pipes-and-signal-lines.svg)'
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
    extractor = ISOPipesAndSignalLinesExtractor(args.json, args.svg)
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