/**
 * Symbol Library Manager
 * Enhanced symbol library with lazy loading, search optimization, and caching
 */

import { writable, derived, get } from 'svelte/store';
import { symbolCache, type SymbolCacheData } from './SymbolCache';
import { TJunctionDetector } from './TJunctionDetector';
import { SVGParser } from '$lib/utils/svgParser';

export interface SymbolMetadata {
  id: string;
  name: string;
  category: SymbolCategory;
  subcategory?: string;
  description: string;
  tags: string[];
  keywords: string[];
  filePath: string;
  previewUrl?: string;
  dimensions: { width: number; height: number };
  connectionPoints: number;
  complexity: 'simple' | 'medium' | 'complex';
  usageCount: number;
  lastUsed: number;
  version: string;
  author?: string;
  license?: string;
}

export interface SymbolCategory {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  order: number;
  subcategories: Array<{
    id: string;
    name: string;
    description: string;
    count: number;
  }>;
}

export interface SearchFilters {
  category?: string;
  subcategory?: string;
  tags?: string[];
  complexity?: SymbolMetadata['complexity'];
  connectionPoints?: { min?: number; max?: number };
  recentlyUsed?: boolean;
  favorites?: boolean;
}

export interface SearchResult {
  symbols: SymbolMetadata[];
  totalCount: number;
  facets: {
    categories: Array<{ id: string; name: string; count: number }>;
    tags: Array<{ tag: string; count: number }>;
    complexity: Array<{ level: SymbolMetadata['complexity']; count: number }>;
  };
  searchTime: number;
  suggestions: string[];
}

interface LibraryState {
  symbols: Map<string, SymbolMetadata>;
  categories: Map<string, SymbolCategory>;
  searchIndex: Map<string, Set<string>>; // term -> symbol IDs
  loadingStates: Map<string, 'idle' | 'loading' | 'loaded' | 'error'>;
  favorites: Set<string>;
  recentlyUsed: Array<{ symbolId: string; timestamp: number }>;
}

/**
 * Symbol Library Manager Class
 */
export class SymbolLibraryManager {
  private static instance: SymbolLibraryManager;

  // Stores
  private state = writable<LibraryState>({
    symbols: new Map(),
    categories: new Map(),
    searchIndex: new Map(),
    loadingStates: new Map(),
    favorites: new Set(),
    recentlyUsed: []
  });

  // Derived stores
  readonly symbols = derived(this.state, state => Array.from(state.symbols.values()));
  readonly categories = derived(this.state, state => 
    Array.from(state.categories.values()).sort((a, b) => a.order - b.order)
  );
  readonly favorites = derived(this.state, state => 
    Array.from(state.favorites).map(id => state.symbols.get(id)).filter(Boolean)
  );
  readonly recentlyUsed = derived(this.state, state =>
    state.recentlyUsed
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 20)
      .map(item => state.symbols.get(item.symbolId))
      .filter(Boolean)
  );

  // Configuration
  private config = {
    maxRecentlyUsed: 50,
    preloadBatchSize: 10,
    searchDebounceMs: 300,
    enableFuzzySearch: true,
    cachePreviewImages: true,
    lazyLoadThreshold: 100 // pixels from viewport
  };

  // Search state
  private searchWorker?: Worker;
  private searchDebounceTimer?: number;

  private constructor() {
    this.initialize();
  }

  static getInstance(): SymbolLibraryManager {
    if (!SymbolLibraryManager.instance) {
      SymbolLibraryManager.instance = new SymbolLibraryManager();
    }
    return SymbolLibraryManager.instance;
  }

  /**
   * Initialize the library manager
   */
  private async initialize(): Promise<void> {
    await this.loadCategories();
    await this.loadSymbolMetadata();
    this.loadUserPreferences();
    this.buildSearchIndex();
    this.setupSearchWorker();
  }

  /**
   * Load symbol categories
   */
  private async loadCategories(): Promise<void> {
    const categories: SymbolCategory[] = [
      {
        id: 'equipment',
        name: 'Equipment',
        description: 'Process equipment symbols',
        icon: '⚗️',
        color: '#3b82f6',
        order: 1,
        subcategories: [
          { id: 'vessels', name: 'Vessels & Tanks', description: 'Storage and process vessels', count: 0 },
          { id: 'heat-exchangers', name: 'Heat Exchangers', description: 'Heat transfer equipment', count: 0 },
          { id: 'pumps', name: 'Pumps', description: 'Fluid moving equipment', count: 0 },
          { id: 'compressors', name: 'Compressors', description: 'Gas compression equipment', count: 0 },
          { id: 'columns', name: 'Columns & Towers', description: 'Separation equipment', count: 0 },
          { id: 'reactors', name: 'Reactors', description: 'Chemical reaction equipment', count: 0 }
        ]
      },
      {
        id: 'instruments',
        name: 'Instruments',
        description: 'Measurement and control instruments',
        icon: '📊',
        color: '#10b981',
        order: 2,
        subcategories: [
          { id: 'sensors', name: 'Sensors', description: 'Measurement devices', count: 0 },
          { id: 'controllers', name: 'Controllers', description: 'Control devices', count: 0 },
          { id: 'indicators', name: 'Indicators', description: 'Display devices', count: 0 },
          { id: 'analyzers', name: 'Analyzers', description: 'Analysis equipment', count: 0 }
        ]
      },
      {
        id: 'valves',
        name: 'Valves',
        description: 'Flow control valves',
        icon: '🔧',
        color: '#f59e0b',
        order: 3,
        subcategories: [
          { id: 'gate-valves', name: 'Gate Valves', description: 'On/off valves', count: 0 },
          { id: 'control-valves', name: 'Control Valves', description: 'Modulating valves', count: 0 },
          { id: 'check-valves', name: 'Check Valves', description: 'One-way valves', count: 0 },
          { id: 'safety-valves', name: 'Safety Valves', description: 'Pressure relief valves', count: 0 }
        ]
      },
      {
        id: 'fittings',
        name: 'Fittings',
        description: 'Pipe fittings and connections',
        icon: '🔗',
        color: '#8b5cf6',
        order: 4,
        subcategories: [
          { id: 'tees', name: 'Tees & Junctions', description: 'Pipe junctions', count: 0 },
          { id: 'reducers', name: 'Reducers', description: 'Size transitions', count: 0 },
          { id: 'flanges', name: 'Flanges', description: 'Removable connections', count: 0 }
        ]
      },
      {
        id: 'piping',
        name: 'Piping & Lines',
        description: 'Pipes and signal lines',
        icon: '📏',
        color: '#ef4444',
        order: 5,
        subcategories: [
          { id: 'process-lines', name: 'Process Lines', description: 'Main process piping', count: 0 },
          { id: 'utility-lines', name: 'Utility Lines', description: 'Utility connections', count: 0 },
          { id: 'signal-lines', name: 'Signal Lines', description: 'Control signals', count: 0 }
        ]
      }
    ];

    this.state.update(state => {
      categories.forEach(category => {
        state.categories.set(category.id, category);
      });
      return state;
    });
  }

  /**
   * Load symbol metadata from various sources
   */
  private async loadSymbolMetadata(): Promise<void> {
    try {
      // In a real implementation, this would load from:
      // 1. Static JSON files
      // 2. API endpoints
      // 3. Local filesystem (for Tauri)
      // 4. User-added symbols

      const symbols = await this.generateSampleSymbols();
      
      this.state.update(state => {
        symbols.forEach(symbol => {
          state.symbols.set(symbol.id, symbol);
          state.loadingStates.set(symbol.id, 'idle');
        });
        
        // Update category counts
        state.categories.forEach(category => {
          category.subcategories.forEach(subcategory => {
            subcategory.count = symbols.filter(s => 
              s.category.id === category.id && s.subcategory === subcategory.id
            ).length;
          });
        });
        
        return state;
      });
    } catch (error) {
      console.error('Failed to load symbol metadata:', error);
    }
  }

  /**
   * Generate sample symbol metadata (placeholder for real implementation)
   */
  private async generateSampleSymbols(): Promise<SymbolMetadata[]> {
    const symbols: SymbolMetadata[] = [];
    const categories = get(this.categories);

    // Generate equipment symbols
    const equipmentCategory = categories.find(c => c.id === 'equipment')!;
    const equipmentSymbols = [
      'vessel-dished-head', 'vessel-flat-head', 'vessel-cone-head',
      'heat-exchanger-shell-tube', 'heat-exchanger-plate',
      'pump-centrifugal', 'pump-positive-displacement',
      'compressor-centrifugal', 'compressor-reciprocating',
      'column-distillation', 'column-packed',
      'reactor-stirred', 'reactor-fixed-bed'
    ];

    equipmentSymbols.forEach((symbolKey, index) => {
      const parts = symbolKey.split('-');
      const subcategory = `${parts[0]}s`;
      
      symbols.push({
        id: `eq_${symbolKey}`,
        name: symbolKey.split('-').map(p => 
          p.charAt(0).toUpperCase() + p.slice(1)
        ).join(' '),
        category: equipmentCategory,
        subcategory,
        description: `Standard ${symbolKey.replace(/-/g, ' ')} symbol`,
        tags: [parts[0], ...parts.slice(1)],
        keywords: parts.concat(['equipment', 'process']),
        filePath: `/symbols/equipment/${symbolKey}.svg`,
        dimensions: { width: 64, height: 64 },
        connectionPoints: this.estimateConnectionPoints(symbolKey),
        complexity: this.estimateComplexity(symbolKey),
        usageCount: Math.floor(Math.random() * 100),
        lastUsed: Date.now() - Math.floor(Math.random() * 30 * 24 * 60 * 60 * 1000),
        version: '1.0.0'
      });
    });

    // Generate valve symbols
    const valvesCategory = categories.find(c => c.id === 'valves')!;
    const valveSymbols = [
      'gate-valve', 'globe-valve', 'ball-valve', 'butterfly-valve',
      'control-valve-linear', 'control-valve-rotary',
      'check-valve-swing', 'check-valve-piston',
      'safety-valve', 'relief-valve'
    ];

    valveSymbols.forEach((symbolKey, index) => {
      const parts = symbolKey.split('-');
      const subcategory = parts.includes('control') ? 'control-valves' : 
                         parts.includes('check') ? 'check-valves' :
                         parts.includes('safety') || parts.includes('relief') ? 'safety-valves' : 'gate-valves';
      
      symbols.push({
        id: `vl_${symbolKey}`,
        name: symbolKey.split('-').map(p => 
          p.charAt(0).toUpperCase() + p.slice(1)
        ).join(' '),
        category: valvesCategory,
        subcategory,
        description: `Standard ${symbolKey.replace(/-/g, ' ')} symbol`,
        tags: [parts[0], parts[1] || 'valve'].filter(Boolean),
        keywords: parts.concat(['valve', 'flow', 'control']),
        filePath: `/symbols/valves/${symbolKey}.svg`,
        dimensions: { width: 32, height: 32 },
        connectionPoints: 2,
        complexity: 'simple',
        usageCount: Math.floor(Math.random() * 50),
        lastUsed: Date.now() - Math.floor(Math.random() * 30 * 24 * 60 * 60 * 1000),
        version: '1.0.0'
      });
    });

    return symbols;
  }

  /**
   * Estimate connection points for a symbol
   */
  private estimateConnectionPoints(symbolKey: string): number {
    if (symbolKey.includes('vessel') || symbolKey.includes('tank')) return 4;
    if (symbolKey.includes('heat-exchanger')) return 4;
    if (symbolKey.includes('pump') || symbolKey.includes('compressor')) return 2;
    if (symbolKey.includes('column') || symbolKey.includes('tower')) return 6;
    if (symbolKey.includes('reactor')) return 4;
    return 2;
  }

  /**
   * Estimate complexity for a symbol
   */
  private estimateComplexity(symbolKey: string): SymbolMetadata['complexity'] {
    if (symbolKey.includes('column') || symbolKey.includes('reactor')) return 'complex';
    if (symbolKey.includes('heat-exchanger') || symbolKey.includes('vessel')) return 'medium';
    return 'simple';
  }

  /**
   * Build search index for fast text search
   */
  private buildSearchIndex(): void {
    this.state.update(state => {
      state.searchIndex.clear();
      
      state.symbols.forEach(symbol => {
        // Index all searchable terms
        const terms = [
          ...symbol.keywords,
          ...symbol.tags,
          symbol.name.toLowerCase(),
          symbol.description.toLowerCase(),
          symbol.category.name.toLowerCase(),
          symbol.subcategory?.toLowerCase() || ''
        ];

        // Include variations and partial matches
        terms.forEach(term => {
          if (!term) return;
          
          const words = term.split(/\s+/).filter(Boolean);
          
          // Index full term and individual words
          [term, ...words].forEach(searchTerm => {
            const normalizedTerm = searchTerm.toLowerCase().trim();
            if (normalizedTerm.length < 2) return;
            
            if (!state.searchIndex.has(normalizedTerm)) {
              state.searchIndex.set(normalizedTerm, new Set());
            }
            state.searchIndex.get(normalizedTerm)!.add(symbol.id);
            
            // Index prefixes for autocomplete
            for (let i = 2; i <= normalizedTerm.length; i++) {
              const prefix = normalizedTerm.substring(0, i);
              if (!state.searchIndex.has(prefix)) {
                state.searchIndex.set(prefix, new Set());
              }
              state.searchIndex.get(prefix)!.add(symbol.id);
            }
          });
        });
      });

      return state;
    });
  }

  /**
   * Setup web worker for advanced search operations
   */
  private setupSearchWorker(): void {
    if (typeof Worker === 'undefined') return;

    try {
      // In a real implementation, this would load a separate worker file
      const workerCode = `
        self.onmessage = function(e) {
          const { type, data } = e.data;
          
          if (type === 'fuzzy-search') {
            // Implement fuzzy search algorithm
            const results = performFuzzySearch(data.query, data.symbols);
            self.postMessage({ type: 'search-results', results });
          }
        };
        
        function performFuzzySearch(query, symbols) {
          // Simple fuzzy search implementation
          return symbols.filter(symbol => {
            const score = calculateFuzzyScore(query, symbol);
            return score > 0.3;
          }).sort((a, b) => b.score - a.score);
        }
        
        function calculateFuzzyScore(query, symbol) {
          // Simplified fuzzy scoring
          const text = (symbol.name + ' ' + symbol.description).toLowerCase();
          const queryLower = query.toLowerCase();
          
          if (text.includes(queryLower)) return 1.0;
          
          // Calculate character overlap
          let matches = 0;
          for (const char of queryLower) {
            if (text.includes(char)) matches++;
          }
          
          return matches / queryLower.length;
        }
      `;

      const blob = new Blob([workerCode], { type: 'application/javascript' });
      this.searchWorker = new Worker(URL.createObjectURL(blob));
    } catch (error) {
      console.warn('Failed to setup search worker:', error);
    }
  }

  /**
   * Load user preferences from localStorage
   */
  private loadUserPreferences(): void {
    try {
      const favorites = JSON.parse(localStorage.getItem('symbol-favorites') || '[]');
      const recentlyUsed = JSON.parse(localStorage.getItem('symbol-recently-used') || '[]');
      
      this.state.update(state => {
        state.favorites = new Set(favorites);
        state.recentlyUsed = recentlyUsed;
        return state;
      });
    } catch (error) {
      console.warn('Failed to load user preferences:', error);
    }
  }

  /**
   * Save user preferences to localStorage
   */
  private saveUserPreferences(): void {
    try {
      const state = get(this.state);
      localStorage.setItem('symbol-favorites', JSON.stringify(Array.from(state.favorites)));
      localStorage.setItem('symbol-recently-used', JSON.stringify(state.recentlyUsed));
    } catch (error) {
      console.warn('Failed to save user preferences:', error);
    }
  }

  /**
   * Public API Methods
   */

  /**
   * Search symbols with filters and pagination
   */
  async search(
    query: string = '',
    filters: SearchFilters = {},
    options: { limit?: number; offset?: number } = {}
  ): Promise<SearchResult> {
    const startTime = performance.now();
    const state = get(this.state);
    const { limit = 50, offset = 0 } = options;

    let candidateIds: Set<string>;

    if (query.trim()) {
      // Text search using index
      candidateIds = this.performTextSearch(query, state);
    } else {
      // No query - use all symbols
      candidateIds = new Set(state.symbols.keys());
    }

    // Apply filters
    const filteredSymbols = Array.from(candidateIds)
      .map(id => state.symbols.get(id)!)
      .filter(symbol => this.applyFilters(symbol, filters))
      .sort(this.getSortComparator(query));

    // Pagination
    const totalCount = filteredSymbols.length;
    const paginatedSymbols = filteredSymbols.slice(offset, offset + limit);

    // Generate facets
    const facets = this.generateFacets(filteredSymbols);

    // Generate suggestions
    const suggestions = this.generateSuggestions(query, state);

    const searchTime = performance.now() - startTime;

    return {
      symbols: paginatedSymbols,
      totalCount,
      facets,
      searchTime,
      suggestions
    };
  }

  /**
   * Perform text search using the search index
   */
  private performTextSearch(query: string, state: LibraryState): Set<string> {
    const normalizedQuery = query.toLowerCase().trim();
    const words = normalizedQuery.split(/\s+/).filter(Boolean);
    
    if (words.length === 0) return new Set(state.symbols.keys());

    // Find symbols matching any word
    const matchingSets = words.map(word => {
      return state.searchIndex.get(word) || new Set();
    });

    // Combine results (union for OR search, intersection for AND search)
    const combinedResults = new Set<string>();
    
    // Use OR logic for multiple words
    matchingSets.forEach(wordMatches => {
      wordMatches.forEach(symbolId => combinedResults.add(symbolId));
    });

    return combinedResults;
  }

  /**
   * Apply filters to a symbol
   */
  private applyFilters(symbol: SymbolMetadata, filters: SearchFilters): boolean {
    if (filters.category && symbol.category.id !== filters.category) return false;
    if (filters.subcategory && symbol.subcategory !== filters.subcategory) return false;
    
    if (filters.tags && filters.tags.length > 0) {
      const hasMatchingTag = filters.tags.some(tag => 
        symbol.tags.some(symbolTag => symbolTag.toLowerCase().includes(tag.toLowerCase()))
      );
      if (!hasMatchingTag) return false;
    }
    
    if (filters.complexity && symbol.complexity !== filters.complexity) return false;
    
    if (filters.connectionPoints) {
      const { min, max } = filters.connectionPoints;
      if (min !== undefined && symbol.connectionPoints < min) return false;
      if (max !== undefined && symbol.connectionPoints > max) return false;
    }
    
    if (filters.recentlyUsed) {
      const state = get(this.state);
      const wasRecentlyUsed = state.recentlyUsed.some(item => item.symbolId === symbol.id);
      if (!wasRecentlyUsed) return false;
    }
    
    if (filters.favorites) {
      const state = get(this.state);
      if (!state.favorites.has(symbol.id)) return false;
    }

    return true;
  }

  /**
   * Get sort comparator based on query relevance
   */
  private getSortComparator(query: string) {
    if (!query.trim()) {
      // Default sort by usage count and name
      return (a: SymbolMetadata, b: SymbolMetadata) => {
        if (a.usageCount !== b.usageCount) {
          return b.usageCount - a.usageCount;
        }
        return a.name.localeCompare(b.name);
      };
    }

    // Sort by relevance score
    const queryLower = query.toLowerCase();
    return (a: SymbolMetadata, b: SymbolMetadata) => {
      const scoreA = this.calculateRelevanceScore(a, queryLower);
      const scoreB = this.calculateRelevanceScore(b, queryLower);
      
      if (scoreA !== scoreB) return scoreB - scoreA;
      
      // Tiebreaker: usage count
      if (a.usageCount !== b.usageCount) {
        return b.usageCount - a.usageCount;
      }
      
      return a.name.localeCompare(b.name);
    };
  }

  /**
   * Calculate relevance score for search ranking
   */
  private calculateRelevanceScore(symbol: SymbolMetadata, query: string): number {
    let score = 0;
    
    // Exact name match
    if (symbol.name.toLowerCase() === query) score += 100;
    
    // Name contains query
    if (symbol.name.toLowerCase().includes(query)) score += 50;
    
    // Name starts with query
    if (symbol.name.toLowerCase().startsWith(query)) score += 30;
    
    // Tag match
    symbol.tags.forEach(tag => {
      if (tag.toLowerCase() === query) score += 40;
      if (tag.toLowerCase().includes(query)) score += 20;
    });
    
    // Keyword match
    symbol.keywords.forEach(keyword => {
      if (keyword.toLowerCase() === query) score += 30;
      if (keyword.toLowerCase().includes(query)) score += 15;
    });
    
    // Description match
    if (symbol.description.toLowerCase().includes(query)) score += 10;
    
    // Usage boost
    score += Math.min(symbol.usageCount * 0.1, 10);
    
    return score;
  }

  /**
   * Generate search facets
   */
  private generateFacets(symbols: SymbolMetadata[]): SearchResult['facets'] {
    const categoryCount = new Map<string, number>();
    const tagCount = new Map<string, number>();
    const complexityCount = new Map<SymbolMetadata['complexity'], number>();

    symbols.forEach(symbol => {
      // Count categories
      const categoryKey = `${symbol.category.id}:${symbol.category.name}`;
      categoryCount.set(categoryKey, (categoryCount.get(categoryKey) || 0) + 1);
      
      // Count tags
      symbol.tags.forEach(tag => {
        tagCount.set(tag, (tagCount.get(tag) || 0) + 1);
      });
      
      // Count complexity
      complexityCount.set(symbol.complexity, (complexityCount.get(symbol.complexity) || 0) + 1);
    });

    return {
      categories: Array.from(categoryCount.entries())
        .map(([key, count]) => {
          const [id, name] = key.split(':');
          return { id, name, count };
        })
        .sort((a, b) => b.count - a.count),
      
      tags: Array.from(tagCount.entries())
        .map(([tag, count]) => ({ tag, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 20), // Top 20 tags
      
      complexity: Array.from(complexityCount.entries())
        .map(([level, count]) => ({ level, count }))
        .sort((a, b) => b.count - a.count)
    };
  }

  /**
   * Generate search suggestions
   */
  private generateSuggestions(query: string, state: LibraryState): string[] {
    if (!query.trim()) return [];

    const suggestions = new Set<string>();
    const queryLower = query.toLowerCase();

    // Find terms that start with the query
    state.searchIndex.forEach((symbolIds, term) => {
      if (term.startsWith(queryLower) && term !== queryLower) {
        suggestions.add(term);
      }
    });

    // Add popular symbol names that partially match
    state.symbols.forEach(symbol => {
      if (symbol.usageCount > 10 && 
          symbol.name.toLowerCase().includes(queryLower) &&
          symbol.name.toLowerCase() !== queryLower) {
        suggestions.add(symbol.name.toLowerCase());
      }
    });

    return Array.from(suggestions)
      .sort((a, b) => a.length - b.length) // Shorter suggestions first
      .slice(0, 8); // Max 8 suggestions
  }

  /**
   * Load symbol data (SVG and metadata)
   */
  async loadSymbol(symbolId: string): Promise<SymbolCacheData | null> {
    const state = get(this.state);
    const symbol = state.symbols.get(symbolId);
    
    if (!symbol) return null;

    // Check cache first
    const cachedData = symbolCache.getSymbolData(symbol.filePath);
    if (cachedData) {
      this.markAsUsed(symbolId);
      return cachedData;
    }

    // Update loading state
    this.state.update(s => {
      s.loadingStates.set(symbolId, 'loading');
      return s;
    });

    try {
      // Load SVG and process
      const svgResult = await SVGParser.loadSvg(symbol.filePath, {
        targetWidth: symbol.dimensions.width,
        targetHeight: symbol.dimensions.height,
        strokeWidth: 1,
        strokeLinecap: 'butt'
      });

      // Detect connection points
      const symbolKey = this.getSymbolKey(symbol.filePath);
      const connectionPoints = symbolKey ? 
        TJunctionDetector.getInstance().detectTJunctionsForSymbol(
          symbolKey, 
          symbol.dimensions.width, 
          symbol.dimensions.height
        ) : [];

      const symbolData: SymbolCacheData = {
        ...svgResult,
        connectionPoints,
        symbolKey
      };

      // Cache the data
      symbolCache.setSymbolData(symbol.filePath, symbolData);

      // Update loading state
      this.state.update(s => {
        s.loadingStates.set(symbolId, 'loaded');
        return s;
      });

      this.markAsUsed(symbolId);
      return symbolData;

    } catch (error) {
      console.error(`Failed to load symbol ${symbolId}:`, error);
      
      this.state.update(s => {
        s.loadingStates.set(symbolId, 'error');
        return s;
      });
      
      return null;
    }
  }

  /**
   * Extract symbol key from file path for T-junction detection
   */
  private getSymbolKey(filePath: string): string | null {
    const matches = filePath.match(/\/([^/]+)\.svg$/);
    return matches ? matches[1] : null;
  }

  /**
   * Mark symbol as recently used
   */
  private markAsUsed(symbolId: string): void {
    this.state.update(state => {
      const symbol = state.symbols.get(symbolId);
      if (symbol) {
        // Update usage count
        symbol.usageCount++;
        symbol.lastUsed = Date.now();
        
        // Add to recently used (remove if already exists)
        state.recentlyUsed = state.recentlyUsed.filter(item => item.symbolId !== symbolId);
        state.recentlyUsed.unshift({ symbolId, timestamp: Date.now() });
        
        // Trim recently used list
        if (state.recentlyUsed.length > this.config.maxRecentlyUsed) {
          state.recentlyUsed = state.recentlyUsed.slice(0, this.config.maxRecentlyUsed);
        }
      }
      return state;
    });
    
    this.saveUserPreferences();
  }

  /**
   * Toggle symbol favorite status
   */
  toggleFavorite(symbolId: string): void {
    this.state.update(state => {
      if (state.favorites.has(symbolId)) {
        state.favorites.delete(symbolId);
      } else {
        state.favorites.add(symbolId);
      }
      return state;
    });
    
    this.saveUserPreferences();
  }

  /**
   * Get symbol loading state
   */
  getLoadingState(symbolId: string): 'idle' | 'loading' | 'loaded' | 'error' {
    const state = get(this.state);
    return state.loadingStates.get(symbolId) || 'idle';
  }

  /**
   * Preload symbols that are likely to be used soon
   */
  async preloadSymbols(symbolIds: string[]): Promise<void> {
    const batches = [];
    for (let i = 0; i < symbolIds.length; i += this.config.preloadBatchSize) {
      batches.push(symbolIds.slice(i, i + this.config.preloadBatchSize));
    }

    for (const batch of batches) {
      const promises = batch.map(id => this.loadSymbol(id));
      await Promise.allSettled(promises);
      
      // Small delay between batches to avoid overwhelming the system
      await new Promise(resolve => setTimeout(resolve, 50));
    }
  }

  /**
   * Get symbol suggestions based on usage patterns
   */
  getSymbolSuggestions(currentSymbolId?: string, limit: number = 10): SymbolMetadata[] {
    const state = get(this.state);
    const symbols = Array.from(state.symbols.values());
    
    // Simple recommendation based on:
    // 1. Category similarity
    // 2. Usage frequency
    // 3. Recently used symbols
    
    if (currentSymbolId) {
      const currentSymbol = state.symbols.get(currentSymbolId);
      if (currentSymbol) {
        // Find symbols in same category
        const relatedSymbols = symbols
          .filter(s => s.id !== currentSymbolId && s.category.id === currentSymbol.category.id)
          .sort((a, b) => b.usageCount - a.usageCount);
        
        return relatedSymbols.slice(0, limit);
      }
    }
    
    // Default: most used symbols
    return symbols
      .sort((a, b) => b.usageCount - a.usageCount)
      .slice(0, limit);
  }

  /**
   * Export library data
   */
  exportLibrary(): string {
    const state = get(this.state);
    return JSON.stringify({
      symbols: Array.from(state.symbols.entries()),
      categories: Array.from(state.categories.entries()),
      favorites: Array.from(state.favorites),
      recentlyUsed: state.recentlyUsed,
      exportTimestamp: Date.now()
    }, null, 2);
  }

  /**
   * Import library data
   */
  async importLibrary(jsonData: string): Promise<void> {
    try {
      const data = JSON.parse(jsonData);
      
      this.state.update(state => {
        // Merge symbols
        data.symbols.forEach(([id, symbol]: [string, SymbolMetadata]) => {
          state.symbols.set(id, symbol);
        });
        
        // Merge categories
        data.categories.forEach(([id, category]: [string, SymbolCategory]) => {
          state.categories.set(id, category);
        });
        
        // Merge favorites
        if (data.favorites) {
          data.favorites.forEach((id: string) => state.favorites.add(id));
        }
        
        // Merge recently used
        if (data.recentlyUsed) {
          state.recentlyUsed = [...data.recentlyUsed, ...state.recentlyUsed];
          state.recentlyUsed = state.recentlyUsed
            .filter((item, index, arr) => arr.findIndex(i => i.symbolId === item.symbolId) === index)
            .slice(0, this.config.maxRecentlyUsed);
        }
        
        return state;
      });
      
      // Rebuild search index
      this.buildSearchIndex();
      this.saveUserPreferences();
      
    } catch (error) {
      throw new Error(`Failed to import library: ${error}`);
    }
  }

  /**
   * Clear all data
   */
  clearLibrary(): void {
    this.state.update(state => {
      state.symbols.clear();
      state.categories.clear();
      state.searchIndex.clear();
      state.loadingStates.clear();
      state.favorites.clear();
      state.recentlyUsed = [];
      return state;
    });
    
    localStorage.removeItem('symbol-favorites');
    localStorage.removeItem('symbol-recently-used');
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    if (this.searchWorker) {
      this.searchWorker.terminate();
      this.searchWorker = undefined;
    }
    
    if (this.searchDebounceTimer) {
      clearTimeout(this.searchDebounceTimer);
    }
  }
}

// Global symbol library manager instance
export const symbolLibraryManager = SymbolLibraryManager.getInstance();