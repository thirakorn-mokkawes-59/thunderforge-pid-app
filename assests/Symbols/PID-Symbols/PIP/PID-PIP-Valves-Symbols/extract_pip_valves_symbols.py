#!/usr/bin/env python3
"""
PIP Valves Symbol Extractor
Extracts P&ID PIP (Process Industry Practices) valves symbols from JSON to individual SVG files with proper names
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


class PIPValvesExtractor:
    def __init__(self, json_file='pid-pip-valves.json', svg_file='pid-pip-valves.svg'):
        self.json_file = json_file
        self.svg_file = svg_file
        self.output_dir = 'svg'
        self.symbol_data = {}
        self.symbol_names = {}
        
        # Define PIP valves symbol names based on Process Industry Practices standards
        self.predefined_names = {
            "0": "Gate Valve - General",
            "1": "Gate Valve - Wedge",
            "2": "Gate Valve - Double Disc",
            "3": "Gate Valve - Knife",
            "4": "Globe Valve - General",
            "5": "Globe Valve - Angle",
            "6": "Globe Valve - Y-Type",
            "7": "Globe Valve - Three Way",
            "8": "Ball Valve - General",
            "9": "Ball Valve - Three Way",
            "10": "Ball Valve - Four Way",
            "11": "Ball Valve - Trunnion",
            "12": "Butterfly Valve - General",
            "13": "Butterfly Valve - Wafer",
            "14": "Butterfly Valve - Lug",
            "15": "Butterfly Valve - High Performance",
            "16": "Plug Valve - General",
            "17": "Plug Valve - Three Way",
            "18": "Plug Valve - Four Way",
            "19": "Diaphragm Valve - Weir",
            "20": "Diaphragm Valve - Straight",
            "21": "Pinch Valve",
            "22": "Needle Valve",
            "23": "Check Valve - General",
            "24": "Check Valve - Swing",
            "25": "Check Valve - Lift",
            "26": "Check Valve - Ball",
            "27": "Check Valve - Wafer",
            "28": "Check Valve - Stop",
            "29": "Safety Valve - Spring Loaded",
            "30": "Safety Valve - Pilot Operated",
            "31": "Relief Valve - Pressure",
            "32": "Relief Valve - Vacuum",
            "33": "Relief Valve - Pressure/Vacuum",
            "34": "Control Valve - General",
            "35": "Control Valve - Globe Type",
            "36": "Control Valve - Angle Type",
            "37": "Control Valve - Butterfly Type",
            "38": "Control Valve - Ball Type",
            "39": "Control Valve - Three Way",
            "40": "Pressure Reducing Valve",
            "41": "Back Pressure Valve",
            "42": "Float Valve",
            "43": "Foot Valve",
            "44": "Angle Valve"
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
                
                # For PIP valves: determine appropriate fill
                if 'fill=' not in line and ('stroke=' in line or 'stroke-width=' in line):
                    # Check if it's a red marker (connection point)
                    if 'stroke="#ff0000"' in line:
                        # Red markers should have no fill
                        for tag in shape_tags:
                            if tag in line:
                                line = line.replace(tag, f'{tag} fill="none"')
                                break
                    else:
                        # Regular valve elements
                        if '<path' in line:
                            # Check for closed paths (valve bodies)
                            if 'Z' in line or 'z' in line:
                                # Closed paths for valve bodies typically need white fill
                                line = line.replace('<path', '<path fill="white"')
                            else:
                                # Open paths are just lines
                                line = line.replace('<path', '<path fill="none"')
                        elif '<polygon' in line:
                            # Polygons are usually valve bodies or triangular elements
                            # Triangles in valves are typically filled
                            line = line.replace('<polygon', '<polygon fill="white"')
                        elif '<circle' in line:
                            # Circles in valves can be actuators or ports
                            line = line.replace('<circle', '<circle fill="white"')
                        elif '<ellipse' in line:
                            # Ellipses in valves typically need white fill
                            line = line.replace('<ellipse', '<ellipse fill="white"')
                        elif '<rect' in line:
                            # Rectangles are usually valve bodies
                            line = line.replace('<rect', '<rect fill="white"')
                        elif '<line' in line or '<polyline' in line:
                            # Lines have no fill
                            line = line.replace('<line', '<line fill="none"')
                            line = line.replace('<polyline', '<polyline fill="none"')
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
                        if 'Valve' in title or 'valve' in title.lower():
                            self.symbol_names[str(i)] = title
            
            # Ensure all symbols have names
            for i in range(len(self.symbol_data)):
                if str(i) not in self.symbol_names:
                    self.symbol_names[str(i)] = f"PIP Valve {i+1}"
            
            print(f"✅ Set up {len(self.symbol_names)} symbol names")
            return True
        except Exception as e:
            print(f"⚠️  Warning: Could not extract names from SVG: {e}")
            print(f"   Using predefined names")
            # Fill in any missing names
            for i in range(len(self.symbol_data)):
                if str(i) not in self.symbol_names:
                    self.symbol_names[str(i)] = f"PIP Valve {i+1}"
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
                filename = f"pid_pip_valves_{idx:03d}_{clean_name}.svg"
            else:
                filename = f"pid_pip_valves_{idx:03d}.svg"
            
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
        csv_path = 'pip_valves_reference.csv'
        print(f"\nCreating reference file: {csv_path}")
        
        with open(csv_path, 'w') as f:
            f.write("Index,Filename,Description,Category\n")
            for key in sorted(self.symbol_data.keys(), key=lambda x: int(x)):
                idx = int(key)
                
                if key in self.symbol_names:
                    name = self.symbol_names[key]
                    clean_name = self.clean_filename(name)
                    filename = f"pid_pip_valves_{idx:03d}_{clean_name}.svg"
                    
                    # Extract category from name
                    if ' - ' in name:
                        category = name.split(' - ')[0].replace(' Valve', '')
                    elif 'Gate' in name:
                        category = 'Gate Valves'
                    elif 'Globe' in name:
                        category = 'Globe Valves'
                    elif 'Ball' in name:
                        category = 'Ball Valves'
                    elif 'Butterfly' in name:
                        category = 'Butterfly Valves'
                    elif 'Plug' in name:
                        category = 'Plug Valves'
                    elif 'Check' in name:
                        category = 'Check Valves'
                    elif 'Safety' in name:
                        category = 'Safety Valves'
                    elif 'Relief' in name:
                        category = 'Relief Valves'
                    elif 'Control' in name:
                        category = 'Control Valves'
                    elif 'Diaphragm' in name:
                        category = 'Diaphragm Valves'
                    else:
                        category = 'Specialty Valves'
                else:
                    name = f"PIP Valve {idx}"
                    filename = f"pid_pip_valves_{idx:03d}.svg"
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
        print("PIP VALVES SYMBOL ANALYSIS REPORT")
        print("=" * 70)
        
        # Count categories
        categories = {}
        for name in self.symbol_names.values():
            if ' - ' in name:
                category = name.split(' - ')[0].replace(' Valve', '') + ' Valves'
            elif 'Gate' in name:
                category = 'Gate Valves'
            elif 'Globe' in name:
                category = 'Globe Valves'
            elif 'Ball' in name:
                category = 'Ball Valves'
            elif 'Butterfly' in name:
                category = 'Butterfly Valves'
            elif 'Plug' in name:
                category = 'Plug Valves'
            elif 'Check' in name:
                category = 'Check Valves'
            elif 'Safety' in name:
                category = 'Safety Valves'
            elif 'Relief' in name:
                category = 'Relief Valves'
            elif 'Control' in name:
                category = 'Control Valves'
            elif 'Diaphragm' in name:
                category = 'Diaphragm Valves'
            elif 'Needle' in name:
                category = 'Needle Valves'
            elif 'Pinch' in name:
                category = 'Pinch Valves'
            else:
                category = 'Specialty Valves'
            categories[category] = categories.get(category, 0) + 1
        
        print("\nValve Categories:")
        for category, count in sorted(categories.items()):
            print(f"  {category:30s}: {count:3d} symbols")
        
        print("\nPIP Valve Types:")
        print("  • Gate Valves (general, wedge, double disc, knife)")
        print("  • Globe Valves (general, angle, Y-type, three way)")
        print("  • Ball Valves (general, three way, four way, trunnion)")
        print("  • Butterfly Valves (general, wafer, lug, high performance)")
        print("  • Plug Valves (general, three way, four way)")
        print("  • Check Valves (swing, lift, ball, wafer, stop)")
        print("  • Safety/Relief Valves (spring loaded, pilot operated)")
        print("  • Control Valves (globe, angle, butterfly, ball types)")
        print("  • Diaphragm Valves (weir, straight)")
        print("  • Specialty Valves (needle, pinch, float, foot, angle)")
        
        # Count valve actuation indicators
        actuator_count = 0
        manual_count = 0
        for svg_content in self.symbol_data.values():
            # Check for actuator indicators (circles or squares on top)
            if '<circle' in svg_content or '<rect' in svg_content:
                if 'cy=' in svg_content:
                    actuator_count += 1
        
        # Count red markers (connection points)
        red_marker_count = 0
        for svg_content in self.symbol_data.values():
            if 'stroke="#ff0000"' in svg_content:
                red_marker_count += 1
        
        print(f"\nConnection Points:")
        print(f"  {red_marker_count} symbols have red connection markers")
        print(f"  These indicate pipe connection points")
        
        print("\nValve Operation:")
        print("  • Manual operation (handwheel, lever)")
        print("  • Actuated operation (pneumatic, electric, hydraulic)")
        print("  • Spring loaded (safety/relief valves)")
        print("  • Pilot operated (pressure control)")
        
        print("\n" + "=" * 70)
    
    def run(self, extract_names=True, create_csv=True, analyze=True, 
            convert_png=False, png_size=256):
        """Run the complete extraction process"""
        print("=" * 70)
        print("PIP VALVES SYMBOL EXTRACTOR")
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
            print(f"   Reference CSV: pip_valves_reference.csv")
        
        return True


def main():
    """Main function with command-line interface"""
    parser = argparse.ArgumentParser(
        description='Extract PIP P&ID valves symbols from JSON to SVG/PNG files'
    )
    parser.add_argument(
        '--json', 
        default='pid-pip-valves.json',
        help='Input JSON file (default: pid-pip-valves.json)'
    )
    parser.add_argument(
        '--svg', 
        default='pid-pip-valves.svg',
        help='Original SVG file for names (default: pid-pip-valves.svg)'
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
    extractor = PIPValvesExtractor(args.json, args.svg)
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