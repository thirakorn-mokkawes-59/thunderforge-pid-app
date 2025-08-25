#!/usr/bin/env python3
"""
PIP Pipes and Signal Lines Symbol Extractor
Extracts P&ID PIP (Process Industry Practices) pipes and signal lines symbols from JSON to individual SVG files with proper names
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


class PIPPipesAndSignalLinesExtractor:
    def __init__(self, json_file='pid-pip-pipes-and-signal-lines.json', svg_file='pid-pip-pipes-and-signal-lines.svg'):
        self.json_file = json_file
        self.svg_file = svg_file
        self.output_dir = 'svg'
        self.symbol_data = {}
        self.symbol_names = {}
        
        # Define PIP pipes and signal lines symbol names based on Process Industry Practices standards
        self.predefined_names = {
            "0": "Process Line - Primary",
            "1": "Process Line - Secondary",
            "2": "Process Line - Traced",
            "3": "Process Line - Jacketed",
            "4": "Process Line - Insulated",
            "5": "Process Line - Underground",
            "6": "Utility Line - Steam",
            "7": "Utility Line - Condensate",
            "8": "Utility Line - Cooling Water",
            "9": "Utility Line - Chilled Water",
            "10": "Utility Line - Compressed Air",
            "11": "Utility Line - Instrument Air",
            "12": "Utility Line - Nitrogen",
            "13": "Utility Line - Natural Gas",
            "14": "Utility Line - Fuel Gas",
            "15": "Utility Line - Fuel Oil",
            "16": "Hydraulic Line",
            "17": "Pneumatic Line",
            "18": "Capillary Line",
            "19": "Electric Signal",
            "20": "Pneumatic Signal",
            "21": "Hydraulic Signal",
            "22": "Electronic Signal",
            "23": "Fiber Optic Signal",
            "24": "Software Link",
            "25": "Mechanical Link",
            "26": "Flow Direction - Forward",
            "27": "Flow Direction - Bidirectional",
            "28": "Line Crossing - No Connection",
            "29": "Line Connection - Tee",
            "30": "Line Connection - Junction",
            "31": "Process Connector - In",
            "32": "Process Connector - Out",
            "33": "Page Connector - To",
            "34": "Page Connector - From",
            "35": "Equipment Nozzle",
            "36": "Vortex Breaker",
            "37": "Siphon Breaker",
            "38": "Vacuum Breaker",
            "39": "Slope Indicator",
            "40": "Pipe Support",
            "41": "Pipe Guide",
            "42": "Pipe Anchor",
            "43": "Expansion Loop",
            "44": "Flexible Hose",
            "45": "Sample Point",
            "46": "Sample Cooler",
            "47": "Drain Point",
            "48": "Vent Point",
            "49": "Test Point",
            "50": "Chemical Injection Point",
            "51": "Utility Station",
            "52": "Hose Connection",
            "53": "Quick Disconnect",
            "54": "Breakaway Coupling",
            "55": "Swivel Joint",
            "56": "Rotary Joint",
            "57": "Line Blind"
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
                # Add stroke color if missing but has stroke-width
                if 'stroke-width=' in line and 'stroke=' not in line:
                    # Check if it's a special color already
                    if 'stroke="#ff0000"' not in line and 'stroke="#' not in line:
                        line = line.replace('stroke-width=', 'stroke="#000000" stroke-width=')
                
                # For PIP pipes and signal lines: most elements should have no fill
                if 'fill=' not in line and ('stroke=' in line or 'stroke-width=' in line):
                    # Check if it's a red marker (connection point)
                    if 'stroke="#ff0000"' in line:
                        # Red markers should have no fill
                        for tag in shape_tags:
                            if tag in line:
                                line = line.replace(tag, f'{tag} fill="none"')
                                break
                    else:
                        # Regular line elements
                        if '<circle' in line:
                            # Small circles might be connection points or markers
                            # Check if it's likely a filled marker based on context
                            if 'r="1"' in line or 'r="2"' in line or 'r="3"' in line:
                                # Small circles are often filled markers
                                line = line.replace('<circle', '<circle fill="#000000"')
                            else:
                                # Larger circles might be part of symbols
                                line = line.replace('<circle', '<circle fill="white"')
                        elif '<polygon' in line:
                            # Polygons in signal lines (like arrows) are usually filled
                            line = line.replace('<polygon', '<polygon fill="#000000"')
                        elif '<path' in line:
                            # Check for closed paths that might be arrowheads or markers
                            if 'Z' in line or 'z' in line:
                                # Closed paths might be filled shapes
                                if 'M' in line and ('L' in line or 'l' in line):
                                    # Likely an arrow or marker - fill it
                                    line = line.replace('<path', '<path fill="#000000"')
                                else:
                                    line = line.replace('<path', '<path fill="none"')
                            else:
                                # Open paths are just lines
                                line = line.replace('<path', '<path fill="none"')
                        elif '<line' in line or '<polyline' in line:
                            # Lines and polylines have no fill
                            line = line.replace('<line', '<line fill="none"')
                            line = line.replace('<polyline', '<polyline fill="none"')
                        elif '<rect' in line:
                            # Rectangles might be backgrounds or markers
                            line = line.replace('<rect', '<rect fill="white"')
                        elif '<ellipse' in line:
                            # Ellipses are rare in line symbols
                            line = line.replace('<ellipse', '<ellipse fill="white"')
                        else:
                            # Default to no fill for other elements
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
                    if str(i) not in self.symbol_names and i < len(self.symbol_data):
                        # Clean up the title for PIP symbols
                        if 'Line' in title or 'Signal' in title or 'line' in title.lower():
                            self.symbol_names[str(i)] = title
            
            # Ensure all symbols have names
            for i in range(len(self.symbol_data)):
                if str(i) not in self.symbol_names:
                    self.symbol_names[str(i)] = f"PIP Line/Signal {i+1}"
            
            print(f"✅ Set up {len(self.symbol_names)} symbol names")
            return True
        except Exception as e:
            print(f"⚠️  Warning: Could not extract names from SVG: {e}")
            print(f"   Using predefined names")
            # Fill in any missing names
            for i in range(len(self.symbol_data)):
                if str(i) not in self.symbol_names:
                    self.symbol_names[str(i)] = f"PIP Line/Signal {i+1}"
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
                filename = f"pid_pip_pipes_signal_lines_{idx:03d}_{clean_name}.svg"
            else:
                filename = f"pid_pip_pipes_signal_lines_{idx:03d}.svg"
            
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
        csv_path = 'pip_pipes_signal_lines_reference.csv'
        print(f"\nCreating reference file: {csv_path}")
        
        with open(csv_path, 'w') as f:
            f.write("Index,Filename,Description,Category\n")
            for key in sorted(self.symbol_data.keys(), key=lambda x: int(x)):
                idx = int(key)
                
                if key in self.symbol_names:
                    name = self.symbol_names[key]
                    clean_name = self.clean_filename(name)
                    filename = f"pid_pip_pipes_signal_lines_{idx:03d}_{clean_name}.svg"
                    
                    # Extract category from name
                    if ' - ' in name:
                        category = name.split(' - ')[0]
                    elif 'Process Line' in name:
                        category = 'Process Lines'
                    elif 'Utility Line' in name:
                        category = 'Utility Lines'
                    elif 'Signal' in name:
                        category = 'Signals'
                    elif 'Flow Direction' in name:
                        category = 'Flow Direction'
                    elif 'Connector' in name:
                        category = 'Connectors'
                    elif 'Connection' in name or 'Junction' in name:
                        category = 'Connections'
                    elif 'Point' in name:
                        category = 'Connection Points'
                    elif 'Support' in name or 'Guide' in name or 'Anchor' in name:
                        category = 'Pipe Supports'
                    elif 'Joint' in name or 'Coupling' in name:
                        category = 'Joints/Couplings'
                    else:
                        category = name.split()[0] if name else 'Other'
                else:
                    name = f"PIP Line/Signal {idx}"
                    filename = f"pid_pip_pipes_signal_lines_{idx:03d}.svg"
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
        print("PIP PIPES AND SIGNAL LINES SYMBOL ANALYSIS REPORT")
        print("=" * 70)
        
        # Count categories
        categories = {}
        for name in self.symbol_names.values():
            if ' - ' in name:
                category = name.split(' - ')[0]
            elif 'Process Line' in name:
                category = 'Process Lines'
            elif 'Utility Line' in name:
                category = 'Utility Lines'
            elif 'Signal' in name:
                category = 'Signals'
            elif 'Flow Direction' in name:
                category = 'Flow Directions'
            elif 'Connector' in name:
                category = 'Connectors'
            elif 'Connection' in name or 'Junction' in name:
                category = 'Connections'
            elif 'Point' in name:
                category = 'Connection Points'
            elif 'Support' in name or 'Guide' in name or 'Anchor' in name:
                category = 'Pipe Supports'
            elif 'Joint' in name or 'Coupling' in name:
                category = 'Joints/Couplings'
            elif 'Breaker' in name:
                category = 'Breakers'
            else:
                category = 'Other Elements'
            categories[category] = categories.get(category, 0) + 1
        
        print("\nLine and Signal Categories:")
        for category, count in sorted(categories.items()):
            print(f"  {category:30s}: {count:3d} symbols")
        
        print("\nPIP Line and Signal Types:")
        print("  • Process Lines (primary, secondary, traced, jacketed, insulated)")
        print("  • Utility Lines (steam, water, air, gases, fuel)")
        print("  • Signal Types (electric, pneumatic, hydraulic, electronic, fiber optic)")
        print("  • Flow Directions and Indicators")
        print("  • Line Connections and Crossings")
        print("  • Connectors (process, page, equipment)")
        print("  • Support Elements (anchors, guides, supports)")
        print("  • Special Points (sample, drain, vent, test, injection)")
        print("  • Joints and Couplings (swivel, rotary, flexible)")
        print("  • Safety Elements (breakers, blinds)")
        
        # Count line styles
        dashed_count = 0
        dotted_count = 0
        for svg_content in self.symbol_data.values():
            if 'stroke-dasharray' in svg_content:
                if ',' in svg_content:
                    # Check dash pattern
                    dashed_count += 1
                else:
                    dotted_count += 1
        
        print(f"\nLine Styles:")
        print(f"  Solid lines: {len(self.symbol_data) - dashed_count - dotted_count} symbols")
        print(f"  Dashed lines: {dashed_count} symbols")
        print(f"  Special patterns: {dotted_count} symbols")
        
        # Count red markers (connection points)
        red_marker_count = 0
        for svg_content in self.symbol_data.values():
            if 'stroke="#ff0000"' in svg_content:
                red_marker_count += 1
        
        print(f"\nConnection Points:")
        print(f"  {red_marker_count} symbols have red connection markers")
        
        print("\n" + "=" * 70)
    
    def run(self, extract_names=True, create_csv=True, analyze=True, 
            convert_png=False, png_size=256):
        """Run the complete extraction process"""
        print("=" * 70)
        print("PIP PIPES AND SIGNAL LINES SYMBOL EXTRACTOR")
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
            print(f"   Reference CSV: pip_pipes_signal_lines_reference.csv")
        
        return True


def main():
    """Main function with command-line interface"""
    parser = argparse.ArgumentParser(
        description='Extract PIP P&ID pipes and signal lines symbols from JSON to SVG/PNG files'
    )
    parser.add_argument(
        '--json', 
        default='pid-pip-pipes-and-signal-lines.json',
        help='Input JSON file (default: pid-pip-pipes-and-signal-lines.json)'
    )
    parser.add_argument(
        '--svg', 
        default='pid-pip-pipes-and-signal-lines.svg',
        help='Original SVG file for names (default: pid-pip-pipes-and-signal-lines.svg)'
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
    extractor = PIPPipesAndSignalLinesExtractor(args.json, args.svg)
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