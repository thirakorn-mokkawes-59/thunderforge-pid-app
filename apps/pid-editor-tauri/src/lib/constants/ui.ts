// UI Constants for PID Editor
export const UI_CONSTANTS = {
  // Default dimensions
  SYMBOL: {
    DEFAULT_WIDTH: 60,
    DEFAULT_HEIGHT: 60,
    MIN_SIZE: 20,
    MAX_SIZE: 200,
    GRID_ITEM_SIZE: 85,
    IMAGE_SIZE: 50
  },
  
  // Grid settings
  GRID: {
    DEFAULT_SIZE: 30,
    MIN_SIZE: 10,
    MAX_SIZE: 100,
    LINE_COLOR: '#e5e7eb'
  },
  
  // Animation durations (ms)
  ANIMATION: {
    FADE: 200,
    SLIDE: 200,
    TRANSITION: 300,
    DEBOUNCE_DELAY: 150
  },
  
  // Positioning
  POSITION: {
    DUPLICATE_OFFSET: 20,
    PASTE_OFFSET: 20,
    CONNECTION_HANDLE_OFFSET: 3
  },
  
  // Typography defaults
  FONT: {
    DEFAULT_SIZE: 10,
    MIN_SIZE: 8,
    MAX_SIZE: 24,
    DEFAULT_WEIGHT: 'normal',
    DEFAULT_STYLE: 'normal',
    DEFAULT_COLOR: '#666666',
    LABEL_BG_COLOR: 'rgba(255, 255, 255, 0.9)'
  },
  
  // Stroke settings
  STROKE: {
    DEFAULT_WIDTH: 0.5,
    MIN_WIDTH: 0.1,
    MAX_WIDTH: 5,
    DEFAULT_LINECAP: 'butt' as const,
    DEFAULT_COLOR: '#000000',
    CONNECTION_WIDTH: 0.37
  },
  
  // Colors
  COLORS: {
    PRESET: [
      '#000000', '#FFFFFF', '#FF0000', '#00FF00', 
      '#0000FF', '#FFFF00', '#FF00FF', '#00FFFF',
      '#FFA500', '#800080', '#FFC0CB', '#A52A2A'
    ],
    SELECTION_OUTLINE: 'rgba(59, 130, 246, 0.5)',
    CONNECTION_INDICATOR: '#3b82f6',
    CONNECTION_INDICATOR_HOVER: '#ff0000',
    BACKGROUND: '#f8f9fa',
    BORDER: '#e5e7eb'
  },
  
  // Z-index layers
  Z_INDEX: {
    NODES: 1,
    EDGES: 1000,
    CONTEXT_MENU: 10000,
    MODAL: 20000
  },
  
  // Panel dimensions
  PANELS: {
    SYMBOL_LIBRARY_WIDTH: 320,
    PROPERTY_PANEL_WIDTH: 320,
    TOOLBAR_HEIGHT: 48,
    STATUS_BAR_HEIGHT: 32
  },
  
  // Limits
  LIMITS: {
    MAX_RECENT_COLORS: 6,
    ELEMENT_ID_DISPLAY_LENGTH: 8,
    MAX_UNDO_HISTORY: 50,
    AUTOSAVE_INTERVAL: 30000 // 30 seconds
  }
} as const;

export type UIConstants = typeof UI_CONSTANTS;