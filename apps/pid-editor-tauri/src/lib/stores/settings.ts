/**
 * Settings Store
 * Manages application settings and user preferences
 */

import { writable, derived } from 'svelte/store';
import { browser } from '$app/environment';
import { DEFAULT_COLORS } from '$lib/constants/colors';

interface AppearanceSettings {
  theme: 'light' | 'dark' | 'auto';
  primaryColor: string;
  backgroundColor: string;
  gridColor: string;
  selectionColor: string;
  handleColor: string;
}

interface DiagramSettings {
  name: string;
  autoSave: boolean;
  autoSaveInterval: number; // in seconds
  showHandles: boolean;
  showConnectionIndicators: boolean;
  enableSnapping: boolean;
  snapTolerance: number;
  defaultStrokeWidth: number;
  defaultStrokeLinecap: 'butt' | 'round' | 'square';
}

interface UISettings {
  showGrid: boolean;
  showRulers: boolean;
  showStatusBar: boolean;
  showPropertyPanel: boolean;
  showSymbolLibrary: boolean;
  symbolLibraryWidth: number;
  propertyPanelWidth: number;
  compactUI: boolean;
  showTooltips: boolean;
}

interface PerformanceSettings {
  maxUndoLevels: number;
  renderOptimization: boolean;
  lazyLoading: boolean;
  cacheSize: number; // in MB
  enableMetrics: boolean;
}

interface AccessibilitySettings {
  highContrast: boolean;
  reducedMotion: boolean;
  announceChanges: boolean;
  keyboardNavigation: boolean;
  focusIndicators: boolean;
}

interface ExportSettings {
  defaultFormat: 'svg' | 'png' | 'pdf' | 'json';
  exportQuality: 'low' | 'medium' | 'high';
  includeMetadata: boolean;
  embedFonts: boolean;
  backgroundColor: string;
}

export interface Settings {
  appearance: AppearanceSettings;
  diagram: DiagramSettings;
  ui: UISettings;
  performance: PerformanceSettings;
  accessibility: AccessibilitySettings;
  export: ExportSettings;
  version: string;
  lastModified: Date;
}

const DEFAULT_SETTINGS: Settings = {
  appearance: {
    theme: 'light',
    primaryColor: DEFAULT_COLORS.primary,
    backgroundColor: DEFAULT_COLORS.background,
    gridColor: DEFAULT_COLORS.grid,
    selectionColor: DEFAULT_COLORS.selection,
    handleColor: DEFAULT_COLORS.handle
  },
  diagram: {
    name: 'Untitled Diagram',
    autoSave: true,
    autoSaveInterval: 30,
    showHandles: true,
    showConnectionIndicators: false,
    enableSnapping: true,
    snapTolerance: 10,
    defaultStrokeWidth: 1,
    defaultStrokeLinecap: 'butt'
  },
  ui: {
    showGrid: true,
    showRulers: false,
    showStatusBar: true,
    showPropertyPanel: true,
    showSymbolLibrary: true,
    symbolLibraryWidth: 300,
    propertyPanelWidth: 320,
    compactUI: false,
    showTooltips: true
  },
  performance: {
    maxUndoLevels: 50,
    renderOptimization: true,
    lazyLoading: true,
    cacheSize: 100,
    enableMetrics: false
  },
  accessibility: {
    highContrast: false,
    reducedMotion: false,
    announceChanges: true,
    keyboardNavigation: true,
    focusIndicators: true
  },
  export: {
    defaultFormat: 'svg',
    exportQuality: 'high',
    includeMetadata: true,
    embedFonts: true,
    backgroundColor: '#ffffff'
  },
  version: '1.0.0',
  lastModified: new Date()
};

function createSettingsStore() {
  const { subscribe, set, update } = writable<Settings>(DEFAULT_SETTINGS);

  // Derived stores for easy access to specific setting groups
  const appearance = derived({ subscribe }, state => state.appearance);
  const diagram = derived({ subscribe }, state => state.diagram);
  const ui = derived({ subscribe }, state => state.ui);
  const performance = derived({ subscribe }, state => state.performance);
  const accessibility = derived({ subscribe }, state => state.accessibility);
  const exportSettings = derived({ subscribe }, state => state.export);

  // Load settings from localStorage
  function loadSettings() {
    if (!browser) return;

    try {
      const stored = localStorage.getItem('pid-editor-settings');
      if (stored) {
        const parsed = JSON.parse(stored);
        // Merge with defaults to handle new settings
        const merged = mergeSettings(DEFAULT_SETTINGS, parsed);
        set(merged);
      }
    } catch (error) {
      console.warn('Failed to load settings:', error);
      set(DEFAULT_SETTINGS);
    }
  }

  // Save settings to localStorage
  function saveSettings(settings: Settings) {
    if (!browser) return;

    try {
      const toSave = {
        ...settings,
        lastModified: new Date()
      };
      localStorage.setItem('pid-editor-settings', JSON.stringify(toSave));
    } catch (error) {
      console.warn('Failed to save settings:', error);
    }
  }

  // Deep merge settings with defaults
  function mergeSettings(defaults: Settings, stored: any): Settings {
    const merged = { ...defaults };

    Object.keys(defaults).forEach(key => {
      if (stored[key] && typeof stored[key] === 'object' && !Array.isArray(stored[key])) {
        merged[key] = { ...defaults[key], ...stored[key] };
      } else if (stored[key] !== undefined) {
        merged[key] = stored[key];
      }
    });

    return merged;
  }

  // Load settings on initialization
  loadSettings();

  return {
    subscribe,
    appearance,
    diagram,
    ui,
    performance,
    accessibility,
    exportSettings,

    // Setting Update Methods
    updateAppearance(updates: Partial<AppearanceSettings>) {
      update(state => {
        const newState = {
          ...state,
          appearance: { ...state.appearance, ...updates }
        };
        saveSettings(newState);
        return newState;
      });
    },

    updateDiagram(updates: Partial<DiagramSettings>) {
      update(state => {
        const newState = {
          ...state,
          diagram: { ...state.diagram, ...updates }
        };
        saveSettings(newState);
        return newState;
      });
    },

    updateUI(updates: Partial<UISettings>) {
      update(state => {
        const newState = {
          ...state,
          ui: { ...state.ui, ...updates }
        };
        saveSettings(newState);
        return newState;
      });
    },

    updatePerformance(updates: Partial<PerformanceSettings>) {
      update(state => {
        const newState = {
          ...state,
          performance: { ...state.performance, ...updates }
        };
        saveSettings(newState);
        return newState;
      });
    },

    updateAccessibility(updates: Partial<AccessibilitySettings>) {
      update(state => {
        const newState = {
          ...state,
          accessibility: { ...state.accessibility, ...updates }
        };
        saveSettings(newState);
        return newState;
      });
    },

    updateExport(updates: Partial<ExportSettings>) {
      update(state => {
        const newState = {
          ...state,
          export: { ...state.export, ...updates }
        };
        saveSettings(newState);
        return newState;
      });
    },

    // Bulk operations
    updateSettings(updates: Partial<Settings>) {
      update(state => {
        const newState = { ...state, ...updates };
        saveSettings(newState);
        return newState;
      });
    },

    resetToDefaults() {
      const resetSettings = {
        ...DEFAULT_SETTINGS,
        lastModified: new Date()
      };
      set(resetSettings);
      saveSettings(resetSettings);
    },

    resetSection(section: keyof Settings) {
      if (section === 'version' || section === 'lastModified') return;
      
      update(state => {
        const newState = {
          ...state,
          [section]: DEFAULT_SETTINGS[section],
          lastModified: new Date()
        };
        saveSettings(newState);
        return newState;
      });
    },

    // Import/Export
    exportSettings(): string {
      return JSON.stringify(subscribe, null, 2);
    },

    importSettings(settingsJson: string): boolean {
      try {
        const imported = JSON.parse(settingsJson);
        const merged = mergeSettings(DEFAULT_SETTINGS, imported);
        set(merged);
        saveSettings(merged);
        return true;
      } catch (error) {
        console.error('Failed to import settings:', error);
        return false;
      }
    },

    // Theme utilities
    isDarkMode(): boolean {
      const state = get({ subscribe });
      if (state.appearance.theme === 'auto') {
        return browser && window.matchMedia('(prefers-color-scheme: dark)').matches;
      }
      return state.appearance.theme === 'dark';
    },

    getThemeColors() {
      const state = get({ subscribe });
      const isDark = this.isDarkMode();
      
      return {
        ...state.appearance,
        // Adjust colors for dark mode
        backgroundColor: isDark ? '#1f2937' : state.appearance.backgroundColor,
        gridColor: isDark ? '#374151' : state.appearance.gridColor,
      };
    },

    // Validation
    validateSettings(settings: any): { valid: boolean; errors: string[] } {
      const errors: string[] = [];

      // Validate appearance settings
      if (settings.appearance) {
        if (!['light', 'dark', 'auto'].includes(settings.appearance.theme)) {
          errors.push('Invalid theme setting');
        }
      }

      // Validate performance settings
      if (settings.performance) {
        if (settings.performance.maxUndoLevels && 
            (settings.performance.maxUndoLevels < 1 || settings.performance.maxUndoLevels > 1000)) {
          errors.push('Max undo levels must be between 1 and 1000');
        }
        if (settings.performance.cacheSize && 
            (settings.performance.cacheSize < 10 || settings.performance.cacheSize > 1000)) {
          errors.push('Cache size must be between 10 and 1000 MB');
        }
      }

      // Validate UI settings
      if (settings.ui) {
        if (settings.ui.symbolLibraryWidth && 
            (settings.ui.symbolLibraryWidth < 200 || settings.ui.symbolLibraryWidth > 600)) {
          errors.push('Symbol library width must be between 200 and 600 pixels');
        }
        if (settings.ui.propertyPanelWidth && 
            (settings.ui.propertyPanelWidth < 250 || settings.ui.propertyPanelWidth > 800)) {
          errors.push('Property panel width must be between 250 and 800 pixels');
        }
      }

      return {
        valid: errors.length === 0,
        errors
      };
    },

    // Keyboard shortcuts management
    getKeyboardShortcuts() {
      return {
        'Ctrl+Z': 'Undo',
        'Ctrl+Y': 'Redo',
        'Ctrl+C': 'Copy',
        'Ctrl+V': 'Paste',
        'Ctrl+X': 'Cut',
        'Ctrl+A': 'Select All',
        'Delete': 'Delete Selected',
        'Ctrl+D': 'Duplicate',
        'Ctrl+G': 'Group',
        'Ctrl+Shift+G': 'Ungroup',
        'Space': 'Pan Mode',
        'Ctrl+0': 'Zoom to Fit',
        'Ctrl+1': 'Actual Size',
        'Ctrl++': 'Zoom In',
        'Ctrl+-': 'Zoom Out',
        'H': 'Toggle Handles',
        'G': 'Toggle Grid',
        'R': 'Toggle Rulers'
      };
    }
  };
}

export const settings = createSettingsStore();