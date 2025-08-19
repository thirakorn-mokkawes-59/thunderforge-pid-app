# Icon Libraries Integration Guide

## Overview
This document outlines the integration and usage of icon libraries for the P&ID Editor application. We're using **Tabler Icons** and **Lucide Icons** to replace emoji icons with professional, scalable vector icons.

## Icon Libraries

### 1. Lucide Icons
- **Website**: https://lucide.dev/
- **GitHub**: https://github.com/lucide-icons/lucide
- **Icons Count**: 1000+ icons
- **License**: ISC License
- **Svelte Package**: `lucide-svelte`

#### Installation
```bash
npm install lucide-svelte
```

#### Usage in Svelte
```svelte
<script>
  import { Save, FolderOpen, Image, FileText, RotateCcw } from 'lucide-svelte';
</script>

<Save size={20} strokeWidth={2} />
<FolderOpen size={20} strokeWidth={2} />
```

#### Recommended Icons for Toolbar
- Save: `Save` icon
- Load/Open: `FolderOpen` icon
- Export PNG: `Image` icon
- Export SVG: `FileText` or `FileCode` icon
- Restore: `RotateCcw` or `History` icon
- Settings: `Settings` icon
- Zoom In: `ZoomIn` icon
- Zoom Out: `ZoomOut` icon
- Grid: `Grid3x3` icon
- Undo: `Undo2` icon
- Redo: `Redo2` icon

### 2. Tabler Icons
- **Website**: https://tabler-icons.io/
- **GitHub**: https://github.com/tabler/tabler-icons
- **Icons Count**: 3000+ icons
- **License**: MIT License
- **Svelte Package**: `@tabler/icons-svelte`

#### Installation
```bash
npm install @tabler/icons-svelte
```

#### Usage in Svelte
```svelte
<script>
  import { IconDeviceFloppy, IconFolder, IconPhoto, IconFileVector, IconRefresh } from '@tabler/icons-svelte';
</script>

<IconDeviceFloppy size={20} stroke={2} />
<IconFolder size={20} stroke={2} />
```

#### Recommended Icons for Toolbar
- Save: `IconDeviceFloppy` icon
- Load/Open: `IconFolder` or `IconFolderOpen` icon
- Export PNG: `IconPhoto` icon
- Export SVG: `IconFileVector` icon
- Restore: `IconRefresh` or `IconRestore` icon
- Settings: `IconSettings` icon
- Zoom In: `IconZoomIn` icon
- Zoom Out: `IconZoomOut` icon
- Grid: `IconGrid` icon
- Undo: `IconArrowBackUp` icon
- Redo: `IconArrowForwardUp` icon

## Implementation Plan

### Phase 1: Setup and Installation
1. Install both icon libraries
   ```bash
   npm install lucide-svelte @tabler/icons-svelte
   ```

### Phase 2: Replace Emoji Icons
Replace emojis in the following components:

#### FileOperations.svelte
Current emoji usage:
- 💾 Save → `Save` (Lucide) or `IconDeviceFloppy` (Tabler)
- 📁 Load → `FolderOpen` (Lucide) or `IconFolderOpen` (Tabler)
- 🖼️ PNG → `Image` (Lucide) or `IconPhoto` (Tabler)
- 📐 SVG → `FileCode` (Lucide) or `IconFileVector` (Tabler)
- 🔄 Restore → `RotateCcw` (Lucide) or `IconRefresh` (Tabler)

#### Other Toolbar Components
Identify and replace any other emoji usage in:
- Toolbar.svelte
- Canvas.svelte (if any tool icons)
- PropertyPanel.svelte (if any action icons)

### Phase 3: Styling and Consistency

#### Icon Component Wrapper
Create a reusable icon wrapper component for consistent styling:

```svelte
<!-- lib/components/Icon.svelte -->
<script lang="ts">
  export let size = 20;
  export let strokeWidth = 2;
  export let color = 'currentColor';
  export let class = '';
</script>

<span class="icon {class}" style="color: {color}">
  <slot {size} {strokeWidth} />
</span>

<style>
  .icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    vertical-align: middle;
  }
</style>
```

#### Consistent Icon Properties
- **Size**: 20px for toolbar, 16px for inline
- **Stroke Width**: 2 for regular, 1.5 for smaller icons
- **Color**: Use CSS variables for theming
  - Primary actions: `var(--primary-color)`
  - Secondary actions: `var(--secondary-color)`
  - Destructive actions: `var(--danger-color)`

## Best Practices

### 1. Icon Selection
- Choose icons that clearly represent their function
- Maintain consistency across the application
- Prefer outline icons for toolbar actions
- Use filled icons sparingly for emphasis

### 2. Accessibility
- Always include `aria-label` or `title` attributes
- Ensure sufficient color contrast
- Consider adding text labels for important actions

### 3. Performance
- Import only the icons you need (tree-shaking)
- Consider creating an icon index file for commonly used icons
- Lazy load icon sets if using many icons

### 4. Icon Index Pattern
Create a centralized icon export:

```typescript
// lib/icons/index.ts
export { Save, FolderOpen, Image, FileCode, RotateCcw } from 'lucide-svelte';
// OR
export { 
  IconDeviceFloppy as Save,
  IconFolderOpen as Open,
  IconPhoto as ExportImage,
  IconFileVector as ExportSvg,
  IconRefresh as Restore
} from '@tabler/icons-svelte';
```

## Decision Matrix

| Feature | Lucide | Tabler |
|---------|--------|--------|
| Icon Count | 1000+ | 3000+ |
| Bundle Size | Smaller | Larger |
| Style Consistency | Excellent | Excellent |
| Industrial/Technical Icons | Good | Better |
| Community | Growing | Large |
| Updates | Frequent | Frequent |

## Recommendation

For the P&ID Editor, we recommend:
1. **Primary**: Use **Lucide Icons** for common UI actions (save, load, zoom, etc.)
2. **Secondary**: Use **Tabler Icons** for specialized technical/industrial icons if needed
3. Start with Lucide and add Tabler only when specific icons are needed

## Migration Checklist

- [ ] Install icon libraries
- [ ] Create Icon wrapper component
- [ ] Replace emojis in FileOperations.svelte
- [ ] Replace emojis in Toolbar.svelte
- [ ] Update any other emoji usage
- [ ] Add proper aria-labels for accessibility
- [ ] Test icon rendering across browsers
- [ ] Document icon usage in component documentation
- [ ] Create icon showcase/reference page (optional)

## Resources

- [Lucide Icons Documentation](https://lucide.dev/guide/)
- [Tabler Icons Documentation](https://tabler-icons.io/)
- [SVG Icon Best Practices](https://css-tricks.com/pretty-good-svg-icon-system/)
- [Accessible Icon Buttons](https://www.sarasoueidan.com/blog/accessible-icon-buttons/)