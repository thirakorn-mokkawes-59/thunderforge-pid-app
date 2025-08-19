# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a HAZOP-AI project focused on processing and managing Process and Instrumentation Diagram (P&ID) symbols. The codebase contains symbol libraries for both ISO and PIP standards, with utilities for extracting and converting these symbols from JSON data to individual SVG files.

## Key Commands

### Symbol Extraction
```bash
# Extract ISO symbols to individual SVG files
cd assests/Symbols/PID-Symbols/ISO
python extract_iso_symbols.py

# Extract ISO symbols with descriptive names from source SVG titles
python extract_iso_symbols_with_names.py
```

## Architecture and Structure

### Symbol Organization
The project organizes P&ID symbols in a hierarchical structure:
- **ISO Standard**: Located in `assests/Symbols/PID-Symbols/ISO/`
- **PIP Standard**: Located in `assests/Symbols/PID-Symbols/PIP/`

Each standard contains five symbol categories:
1. **Equipment** - Process equipment symbols (tanks, vessels, pumps, etc.)
2. **Fittings** - Pipe fittings and connections
3. **Instruments** - Measurement and control instruments
4. **Pipes and Signal Lines** - Flow lines and signal connections
5. **Valves** - Various valve types

### Data Format
Each category contains:
- **JSON file** (`pid-{standard}-{category}.json`): Key-value pairs where keys are numeric indices and values are SVG content strings
- **SVG file** (`pid-{standard}-{category}.svg`): Original combined SVG containing all symbols with titles
- **Output directories**: `svg/` and `png/` for extracted individual symbols

### Symbol Processing Pipeline
The extraction scripts (`extract_iso_symbols.py` and `extract_iso_symbols_with_names.py`) perform:
1. **JSON Loading**: Read symbol data from JSON files
2. **SVG Cleaning**: Fix stroke attributes, add proper XML declarations, remove non-standard attributes
3. **Name Extraction**: Parse original SVG files to extract symbol titles (in `_with_names` variant)
4. **File Generation**: Create individual SVG files with standardized naming convention

### File Naming Convention
Extracted symbols follow the pattern:
- Basic: `pid_{standard}_{category}_{index:03d}.svg`
- With names: `pid_{standard}_{category}_{index:03d}_{clean_name}.svg`

Where `clean_name` is derived from the symbol's title in the original SVG.

## Important Implementation Details

- Symbol SVGs are cleaned to ensure standard compliance (proper XML declarations, xmlns attributes)
- Stroke attributes are normalized (width: 0.5, color: #000000)
- The `_with_names` variant preserves original symbol titles as XML comments in the output files
- Both ISO and PIP standards use identical extraction logic but operate on different source data