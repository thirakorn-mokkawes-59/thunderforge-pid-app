/**
 * Comprehensive TypeScript interfaces for all component props
 */

import type { NodeProps } from '@xyflow/svelte';

// Base interfaces for common properties
export interface BaseStyleProps {
  color?: string;
  opacity?: number;
  strokeWidth?: number;
  strokeLinecap?: 'butt' | 'round' | 'square';
}

export interface TransformProps {
  rotation?: number;
  flipX?: boolean;
  flipY?: boolean;
}

export interface LabelProps {
  showLabel?: boolean;
  labelFontSize?: number;
  labelFontWeight?: 'normal' | 'bold' | '100' | '200' | '300' | '400' | '500' | '600' | '700' | '800' | '900';
  labelFontStyle?: 'normal' | 'italic' | 'oblique';
  labelFontColor?: string;
  labelBgColor?: string;
  labelOffsetX?: number;
  labelOffsetY?: number;
}

export interface TagProps {
  tag?: string;
  showTag?: boolean;
  tagPosition?: 'above' | 'below' | 'left' | 'right';
  tagFontSize?: number;
  tagFontWeight?: 'normal' | 'bold' | '100' | '200' | '300' | '400' | '500' | '600' | '700' | '800' | '900';
  tagFontStyle?: 'normal' | 'italic' | 'oblique';
  tagFontColor?: string;
  tagBgColor?: string;
  tagOffsetX?: number;
  tagOffsetY?: number;
}

// PID Symbol Node specific interfaces
export interface PIDSymbolData extends BaseStyleProps, TransformProps, LabelProps, TagProps {
  symbolPath: string;
  name: string;
  width: number;
  height: number;
  x: number;
  y: number;
}

export interface PIDSymbolNodeProps extends NodeProps {
  id: string;
  data: PIDSymbolData;
  selected?: boolean;
  dragging?: boolean;
}

// Property Panel interfaces
export interface ColorPickerProps {
  value: string;
  onChange: (color: string) => void;
  onClose?: () => void;
  presetColors?: string[];
  recentColors?: string[];
  label?: string;
}

export interface PropertySectionProps {
  title: string;
  expanded?: boolean;
  onToggle?: (expanded: boolean) => void;
  children?: any;
}

export interface NumericInputProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  label?: string;
}

export interface SelectInputProps {
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  label?: string;
}

// Symbol Library interfaces
export interface SymbolItem {
  id: string;
  name: string;
  path: string;
  category: string;
  standard: 'ISO' | 'PIP';
  keywords?: string[];
  previewPath?: string;
}

export interface SymbolLibraryProps {
  selectedStandard?: 'all' | 'ISO' | 'PIP';
  searchTerm?: string;
  selectedCategory?: string;
  onSymbolSelect?: (symbol: SymbolItem) => void;
  onDragStart?: (event: DragEvent, symbol: SymbolItem) => void;
}

export interface SymbolCategoryProps {
  category: string;
  symbols: SymbolItem[];
  expanded?: boolean;
  onToggle?: (expanded: boolean) => void;
}

// Canvas and Flow interfaces
export interface CanvasSettings {
  gridSize: number;
  snapToGrid: boolean;
  showGrid: boolean;
  backgroundColor?: string;
  gridColor?: string;
}

export interface ViewportState {
  zoom: number;
  pan: { x: number; y: number };
}

export interface ConnectionSettings {
  strokeWidth: number;
  strokeColor: string;
  markerSize: number;
  cornerRadius: number;
}

// Toolbar interfaces
export interface ToolbarButtonProps {
  icon?: any;
  label?: string;
  tooltip?: string;
  active?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
}

export interface ToolbarSectionProps {
  title?: string;
  children?: any;
  separator?: boolean;
}

// Modal interfaces
export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  size?: 'small' | 'medium' | 'large' | 'fullscreen';
  children?: any;
}

export interface ExportImportModalProps extends ModalProps {
  mode: 'export' | 'import';
  onExport?: (format: string, options: any) => void;
  onImport?: (data: any) => void;
}

// Status and notification interfaces
export interface StatusBarProps {
  zoom?: number;
  elementCount?: number;
  selectedCount?: number;
  connectionCount?: number;
  showFPS?: boolean;
}

export interface NotificationProps {
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  duration?: number;
  onClose?: () => void;
}

// Edge and connection interfaces
export interface EdgeData {
  strokeWidth?: number;
  strokeColor?: string;
  strokeStyle?: 'solid' | 'dashed' | 'dotted';
  markerStart?: string;
  markerEnd?: string;
  label?: string;
  animated?: boolean;
}

export interface CustomEdgeProps {
  id: string;
  source: string;
  target: string;
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
  sourcePosition?: string;
  targetPosition?: string;
  data?: EdgeData;
  selected?: boolean;
}

// File operations interfaces
export interface FileOperationsProps {
  onNew?: () => void;
  onOpen?: (file: File) => void;
  onSave?: () => void;
  onSaveAs?: () => void;
  onExport?: () => void;
  onImport?: () => void;
}

export interface FileMetadata {
  name: string;
  version: string;
  createdAt: Date;
  modifiedAt: Date;
  author?: string;
  description?: string;
}

// Keyboard and interaction interfaces
export interface KeyboardShortcut {
  key: string;
  ctrlKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
  action: string;
}

export interface DragData {
  type: 'symbol' | 'element';
  data: any;
  ghostImageUrl?: string;
}

// Performance and optimization interfaces
export interface PerformanceMetrics {
  fps: number;
  renderTime: number;
  nodeCount: number;
  edgeCount: number;
  memoryUsage?: number;
}

export interface CacheOptions {
  maxSize: number;
  ttl: number; // time to live in milliseconds
  cleanupInterval: number;
}

// Error handling interfaces
export interface ErrorBoundaryProps {
  fallback?: (error: Error, errorInfo: any) => any;
  onError?: (error: Error, errorInfo: any) => void;
  children?: any;
}

export interface ValidationError {
  field: string;
  message: string;
  code?: string;
}

// Theme and styling interfaces
export interface Theme {
  colors: {
    primary: string;
    secondary: string;
    background: string;
    surface: string;
    text: string;
    textSecondary: string;
    border: string;
    error: string;
    warning: string;
    success: string;
    info: string;
  };
  fonts: {
    primary: string;
    secondary: string;
    mono: string;
  };
  spacing: {
    xs: number;
    sm: number;
    md: number;
    lg: number;
    xl: number;
  };
  borderRadius: {
    sm: number;
    md: number;
    lg: number;
  };
}