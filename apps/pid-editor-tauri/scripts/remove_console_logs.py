#!/usr/bin/env python3

import re

# Read the InnerCanvas.svelte file
with open('/home/thirakorn/astar-projects/hazop-ai/apps/pid-editor-tauri/src/lib/components/InnerCanvas.svelte', 'r') as f:
    content = f.read()

# Remove console.log statements (including multi-line ones)
# Pattern matches console.log followed by anything until semicolon or newline
content = re.sub(r'\s*console\.log\([^;]*\);?\n?', '', content)

# Clean up any double blank lines left behind
content = re.sub(r'\n\s*\n\s*\n', '\n\n', content)

# Write back the modified content
with open('/home/thirakorn/astar-projects/hazop-ai/apps/pid-editor-tauri/src/lib/components/InnerCanvas.svelte', 'w') as f:
    f.write(content)

print("Removed all console.log statements from InnerCanvas.svelte")