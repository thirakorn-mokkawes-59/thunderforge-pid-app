// Optimized symbol filtering with caching and debouncing
export class SymbolFilter {
  private cache = new Map<string, any[]>();
  private lastQuery = '';
  private lastCategory = '';
  private lastStandard = '';
  
  /**
   * Filter symbols with caching for performance
   */
  filterSymbols(
    symbols: any[],
    query: string,
    category: string,
    standard: string
  ): any[] {
    // Create cache key
    const cacheKey = `${query}-${category}-${standard}`;
    
    // Return cached result if available
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }
    
    // Optimize: if only query changed and it's more specific, filter previous results
    if (
      query.startsWith(this.lastQuery) && 
      category === this.lastCategory && 
      standard === this.lastStandard &&
      this.lastQuery !== ''
    ) {
      const prevKey = `${this.lastQuery}-${category}-${standard}`;
      const prevResults = this.cache.get(prevKey);
      if (prevResults) {
        const filtered = this.filterFromSubset(prevResults, query);
        this.cache.set(cacheKey, filtered);
        this.updateLastValues(query, category, standard);
        return filtered;
      }
    }
    
    // Full filter
    const filtered = symbols.filter(symbol => {
      const matchesSearch = !query || 
        symbol.name.toLowerCase().includes(query.toLowerCase());
      const matchesCategory = category === 'all' || 
        symbol.category === category;
      const matchesStandard = standard === 'all' || 
        symbol.standard === standard;
      
      return matchesSearch && matchesCategory && matchesStandard;
    });
    
    // Cache result
    this.cache.set(cacheKey, filtered);
    
    // Clean cache if too large
    if (this.cache.size > 50) {
      this.cleanCache();
    }
    
    this.updateLastValues(query, category, standard);
    return filtered;
  }
  
  /**
   * Filter from a subset for incremental search
   */
  private filterFromSubset(subset: any[], query: string): any[] {
    return subset.filter(symbol => 
      symbol.name.toLowerCase().includes(query.toLowerCase())
    );
  }
  
  /**
   * Update last search values
   */
  private updateLastValues(query: string, category: string, standard: string): void {
    this.lastQuery = query;
    this.lastCategory = category;
    this.lastStandard = standard;
  }
  
  /**
   * Clean old cache entries
   */
  private cleanCache(): void {
    // Keep only the 25 most recent entries
    const entries = Array.from(this.cache.entries());
    const toKeep = entries.slice(-25);
    this.cache.clear();
    toKeep.forEach(([key, value]) => this.cache.set(key, value));
  }
  
  /**
   * Clear all cache
   */
  clearCache(): void {
    this.cache.clear();
    this.lastQuery = '';
    this.lastCategory = '';
    this.lastStandard = '';
  }
}

// Singleton instance
export const symbolFilter = new SymbolFilter();