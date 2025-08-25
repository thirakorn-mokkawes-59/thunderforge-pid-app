/**
 * Color Constants and Palettes
 * Centralized color definitions for the PID editor
 */

// Preset colors - commonly used colors
export const PRESET_COLORS = [
  '#000000', '#FFFFFF', '#FF0000', '#00FF00', '#0000FF', '#FFFF00',
  '#FF00FF', '#00FFFF', '#FFA500', '#800080', '#FFC0CB', '#A52A2A'
] as const;

// Full color palette - organized by hue, dark to light in rows
export const COLOR_PALETTE = [
  // Row 1: Dark shades
  '#000000', '#7F1D1D', '#7C2D12', '#713F12', '#14532D', '#134E4A', '#1E3A8A', '#312E81', '#581C87', '#831843',
  
  // Row 2: Medium-dark shades
  '#374151', '#991B1B', '#9A3412', '#A16207', '#166534', '#115E59', '#1E40AF', '#3730A3', '#6B21A8', '#9F1239',
  
  // Row 3: Medium shades
  '#6B7280', '#DC2626', '#EA580C', '#EAB308', '#16A34A', '#0D9488', '#2563EB', '#4F46E5', '#9333EA', '#E11D48',
  
  // Row 4: Medium-light shades
  '#9CA3AF', '#EF4444', '#F97316', '#FACC15', '#22C55E', '#14B8A6', '#3B82F6', '#6366F1', '#A855F7', '#F43F5E',
  
  // Row 5: Light shades
  '#D1D5DB', '#F87171', '#FB923C', '#FDE047', '#4ADE80', '#2DD4BF', '#60A5FA', '#818CF8', '#C084FC', '#FB7185',
  
  // Row 6: Pale shades
  '#F3F4F6', '#FCA5A5', '#FDBA74', '#FEF08A', '#86EFAC', '#5EEAD4', '#93C5FD', '#A5B4FC', '#D8B4FE', '#FDA4AF'
] as const;

// Semantic colors for UI states
export const SEMANTIC_COLORS = {
  primary: '#3B82F6',
  secondary: '#6B7280',
  success: '#10B981',
  warning: '#F59E0B',
  error: '#EF4444',
  info: '#06B6D4'
} as const;

// Default colors for different element types
export const DEFAULT_COLORS = {
  symbol: '#000000',
  edge: '#000000',
  background: '#FFFFFF',
  grid: '#E5E7EB',
  selection: '#3B82F6',
  handle: '#3B82F6'
} as const;

// Color utility functions
export function isValidHexColor(color: string): boolean {
  return /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(color);
}

export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
}

export function rgbToHex(r: number, g: number, b: number): string {
  return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

export function getContrastColor(hex: string): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return '#000000';

  const brightness = (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000;
  return brightness > 128 ? '#000000' : '#ffffff';
}

export function adjustBrightness(hex: string, amount: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;

  const adjust = (channel: number) => {
    const adjusted = channel + amount;
    return Math.max(0, Math.min(255, adjusted));
  };

  return rgbToHex(adjust(rgb.r), adjust(rgb.g), adjust(rgb.b));
}

// Recent colors management
const RECENT_COLORS_KEY = 'pid-editor-recent-colors';
const MAX_RECENT_COLORS = 12;

export function getRecentColors(): string[] {
  if (typeof window === 'undefined') return [];
  
  try {
    const stored = localStorage.getItem(RECENT_COLORS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

export function addRecentColor(color: string): void {
  if (typeof window === 'undefined' || !isValidHexColor(color)) return;
  
  const recent = getRecentColors();
  const filtered = recent.filter(c => c !== color);
  const updated = [color, ...filtered].slice(0, MAX_RECENT_COLORS);
  
  try {
    localStorage.setItem(RECENT_COLORS_KEY, JSON.stringify(updated));
  } catch (error) {
    console.warn('Failed to save recent colors:', error);
  }
}

export function clearRecentColors(): void {
  if (typeof window === 'undefined') return;
  
  try {
    localStorage.removeItem(RECENT_COLORS_KEY);
  } catch (error) {
    console.warn('Failed to clear recent colors:', error);
  }
}