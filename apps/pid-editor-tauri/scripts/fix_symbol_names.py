#!/usr/bin/env python3

import re

# Read the allSymbols.ts file
with open('/home/thirakorn/astar-projects/hazop-ai/apps/pid-editor-tauri/src/lib/data/allSymbols.ts', 'r') as f:
    content = f.read()

# Function to clean up names
def clean_name(name):
    # Remove "Pid Iso Pipes Signal XXX " prefix
    name = re.sub(r'^Pid Iso Pipes Signal \d{3} ', '', name)
    # Remove "Pid Iso " prefix from other categories
    name = re.sub(r'^Pid Iso \w+ \d{3} ', '', name)
    # Title case the result
    words = name.split()
    return ' '.join(word.capitalize() for word in words)

# Process each line
lines = content.split('\n')
new_lines = []

for line in lines:
    # Check if this is a pipes/signals symbol line
    if "name: 'Pid Iso Pipes Signal" in line:
        # Extract the name
        match = re.search(r"name: '([^']+)'", line)
        if match:
            old_name = match.group(1)
            new_name = clean_name(old_name)
            line = line.replace(f"name: '{old_name}'", f"name: '{new_name}'")
    
    new_lines.append(line)

# Write back the modified content
with open('/home/thirakorn/astar-projects/hazop-ai/apps/pid-editor-tauri/src/lib/data/allSymbols.ts', 'w') as f:
    f.write('\n'.join(new_lines))

print("Fixed symbol names in allSymbols.ts")