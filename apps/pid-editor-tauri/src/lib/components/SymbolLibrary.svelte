<script lang="ts">
  import { onMount, onDestroy, createEventDispatcher } from 'svelte';
  import { fade, slide } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';
  import { 
    symbolLibraryManager, 
    type SymbolMetadata, 
    type SymbolCategory, 
    type SearchFilters,
    type SearchResult
  } from '$lib/services/SymbolLibraryManager';
  import { symbolCache } from '$lib/services/SymbolCache';

  // Props
  export let isOpen: boolean = true;
  export let width: number = 320;
  export let showSearch: boolean = true;
  export let showCategories: boolean = true;
  export let showFavorites: boolean = true;
  export let enableDragAndDrop: boolean = true;
  export let compactMode: boolean = false;

  // Events
  const dispatch = createEventDispatcher<{
    symbolSelect: SymbolMetadata;
    symbolDragStart: { symbol: SymbolMetadata; event: DragEvent };
    categorySelect: string;
    close: void;
  }>();

  // State
  let searchQuery = '';
  let selectedCategory = '';
  let selectedFilters: SearchFilters = {};
  let searchResults: SearchResult | null = null;
  let loading = false;
  let searchInput: HTMLInputElement;
  let searchDebounceTimer: number;

  // UI State
  let activeTab: 'browse' | 'search' | 'favorites' | 'recent' = 'browse';
  let expandedCategories = new Set<string>();
  let showFilters = false;
  let virtualScrollContainer: HTMLElement;
  let visibleSymbols: SymbolMetadata[] = [];

  // Reactive subscriptions
  let categories: SymbolCategory[] = [];
  let favorites: SymbolMetadata[] = [];
  let recentlyUsed: SymbolMetadata[] = [];

  // Virtual scrolling
  const ITEM_HEIGHT = compactMode ? 60 : 80;
  const OVERSCAN = 5;
  let scrollTop = 0;
  let containerHeight = 400;

  onMount(async () => {
    // Subscribe to store updates
    const unsubCategories = symbolLibraryManager.categories.subscribe(value => {
      categories = value;
      // Expand first category by default
      if (value.length > 0 && expandedCategories.size === 0) {
        expandedCategories.add(value[0].id);
      }
    });

    const unsubFavorites = symbolLibraryManager.favorites.subscribe(value => {
      favorites = value;
    });

    const unsubRecent = symbolLibraryManager.recentlyUsed.subscribe(value => {
      recentlyUsed = value;
    });

    // Setup intersection observer for lazy loading
    setupLazyLoading();

    // Initial search
    await performSearch();

    return () => {
      unsubCategories();
      unsubFavorites();
      unsubRecent();
      if (searchDebounceTimer) clearTimeout(searchDebounceTimer);
    };
  });

  onDestroy(() => {
    if (searchDebounceTimer) clearTimeout(searchDebounceTimer);
  });

  /**
   * Setup intersection observer for lazy loading symbol previews
   */
  function setupLazyLoading() {
    if (typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const symbolId = entry.target.getAttribute('data-symbol-id');
            if (symbolId) {
              loadSymbolPreview(symbolId);
            }
          }
        });
      },
      {
        root: virtualScrollContainer,
        rootMargin: '50px',
        threshold: 0.1
      }
    );

    return () => observer.disconnect();
  }

  /**
   * Load symbol preview image
   */
  async function loadSymbolPreview(symbolId: string) {
    try {
      await symbolLibraryManager.loadSymbol(symbolId);
      // Force reactivity update
      visibleSymbols = [...visibleSymbols];
    } catch (error) {
      console.error('Failed to load symbol preview:', error);
    }
  }

  /**
   * Handle search input changes
   */
  function handleSearchInput() {
    if (searchDebounceTimer) clearTimeout(searchDebounceTimer);
    
    searchDebounceTimer = setTimeout(() => {
      performSearch();
    }, 300);
  }

  /**
   * Perform search with current query and filters
   */
  async function performSearch() {
    loading = true;
    
    try {
      const results = await symbolLibraryManager.search(
        searchQuery,
        selectedFilters,
        { limit: 100 }
      );
      
      searchResults = results;
      updateVisibleSymbols();
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      loading = false;
    }
  }

  /**
   * Update visible symbols based on current tab and search
   */
  function updateVisibleSymbols() {
    switch (activeTab) {
      case 'search':
        visibleSymbols = searchResults?.symbols || [];
        break;
      case 'favorites':
        visibleSymbols = favorites;
        break;
      case 'recent':
        visibleSymbols = recentlyUsed;
        break;
      case 'browse':
      default:
        if (selectedCategory) {
          visibleSymbols = searchResults?.symbols.filter(s => 
            s.category.id === selectedCategory
          ) || [];
        } else {
          visibleSymbols = searchResults?.symbols || [];
        }
        break;
    }

    // Apply virtual scrolling
    updateVirtualScroll();
  }

  /**
   * Update virtual scroll visible range
   */
  function updateVirtualScroll() {
    const startIndex = Math.max(0, Math.floor(scrollTop / ITEM_HEIGHT) - OVERSCAN);
    const endIndex = Math.min(
      visibleSymbols.length - 1,
      Math.ceil((scrollTop + containerHeight) / ITEM_HEIGHT) + OVERSCAN
    );

    // Only show symbols in visible range
    visibleSymbols = visibleSymbols.slice(startIndex, endIndex + 1);
  }

  /**
   * Handle tab change
   */
  function changeTab(tab: typeof activeTab) {
    activeTab = tab;
    updateVisibleSymbols();
  }

  /**
   * Handle category selection
   */
  function selectCategory(categoryId: string) {
    selectedCategory = selectedCategory === categoryId ? '' : categoryId;
    selectedFilters = { ...selectedFilters, category: selectedCategory || undefined };
    dispatch('categorySelect', selectedCategory);
    performSearch();
  }

  /**
   * Toggle category expansion
   */
  function toggleCategoryExpansion(categoryId: string) {
    if (expandedCategories.has(categoryId)) {
      expandedCategories.delete(categoryId);
    } else {
      expandedCategories.add(categoryId);
    }
    expandedCategories = new Set(expandedCategories); // Trigger reactivity
  }

  /**
   * Handle symbol selection
   */
  function selectSymbol(symbol: SymbolMetadata) {
    dispatch('symbolSelect', symbol);
  }

  /**
   * Handle symbol drag start
   */
  function handleDragStart(symbol: SymbolMetadata, event: DragEvent) {
    if (!enableDragAndDrop) return;

    event.dataTransfer!.setData('application/json', JSON.stringify({
      type: 'symbol',
      symbolId: symbol.id,
      symbol
    }));

    event.dataTransfer!.effectAllowed = 'copy';
    dispatch('symbolDragStart', { symbol, event });
  }

  /**
   * Toggle symbol favorite
   */
  function toggleFavorite(symbol: SymbolMetadata, event: Event) {
    event.stopPropagation();
    symbolLibraryManager.toggleFavorite(symbol.id);
  }

  /**
   * Handle filter change
   */
  function updateFilters(newFilters: Partial<SearchFilters>) {
    selectedFilters = { ...selectedFilters, ...newFilters };
    performSearch();
  }

  /**
   * Clear all filters
   */
  function clearFilters() {
    selectedFilters = {};
    selectedCategory = '';
    searchQuery = '';
    if (searchInput) searchInput.value = '';
    performSearch();
  }

  /**
   * Handle scroll for virtual scrolling
   */
  function handleScroll(event: Event) {
    const target = event.target as HTMLElement;
    scrollTop = target.scrollTop;
    updateVirtualScroll();
  }

  /**
   * Get symbol loading state
   */
  function getSymbolLoadingState(symbolId: string): 'idle' | 'loading' | 'loaded' | 'error' {
    return symbolLibraryManager.getLoadingState(symbolId);
  }

  /**
   * Get cached symbol preview
   */
  function getSymbolPreview(symbol: SymbolMetadata): string | null {
    return symbolCache.getPreview(symbol.filePath);
  }

  /**
   * Format symbol size
   */
  function formatSymbolSize(dimensions: { width: number; height: number }): string {
    return `${dimensions.width}×${dimensions.height}`;
  }

  /**
   * Get complexity badge color
   */
  function getComplexityColor(complexity: SymbolMetadata['complexity']): string {
    switch (complexity) {
      case 'simple': return 'bg-green-100 text-green-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'complex': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  }

  // Reactive statements
  $: if (isOpen && searchInput) {
    searchInput.focus();
  }

  $: containerStyle = `width: ${width}px;`;
</script>

<!-- Symbol Library Panel -->
{#if isOpen}
  <div class="symbol-library" style={containerStyle} transition:slide={{ duration: 300, easing: cubicOut }}>
    <!-- Header -->
    <div class="library-header">
      <div class="header-title">
        <span class="title-icon">📚</span>
        <span class="title-text">Symbol Library</span>
      </div>
      
      <div class="header-controls">
        <button 
          class="control-btn"
          class:active={showFilters}
          on:click={() => showFilters = !showFilters}
          title="Toggle filters"
        >
          🔧
        </button>
        
        <button 
          class="control-btn close-btn"
          on:click={() => dispatch('close')}
          title="Close library"
        >
          ✕
        </button>
      </div>
    </div>

    <!-- Search Bar -->
    {#if showSearch}
      <div class="search-section">
        <div class="search-input-container">
          <input
            bind:this={searchInput}
            bind:value={searchQuery}
            on:input={handleSearchInput}
            placeholder="Search symbols..."
            class="search-input"
            type="text"
          />
          <div class="search-icon">🔍</div>
        </div>

        {#if searchQuery && searchResults?.suggestions.length > 0}
          <div class="search-suggestions" transition:slide={{ duration: 200 }}>
            {#each searchResults.suggestions.slice(0, 4) as suggestion}
              <button 
                class="suggestion-item"
                on:click={() => {
                  searchQuery = suggestion;
                  performSearch();
                }}
              >
                {suggestion}
              </button>
            {/each}
          </div>
        {/if}
      </div>
    {/if}

    <!-- Tabs -->
    <div class="tab-bar">
      <button 
        class="tab-button"
        class:active={activeTab === 'browse'}
        on:click={() => changeTab('browse')}
      >
        Browse
      </button>
      
      <button 
        class="tab-button"
        class:active={activeTab === 'search'}
        on:click={() => changeTab('search')}
      >
        Search ({searchResults?.totalCount || 0})
      </button>
      
      {#if showFavorites}
        <button 
          class="tab-button"
          class:active={activeTab === 'favorites'}
          on:click={() => changeTab('favorites')}
        >
          ⭐ ({favorites.length})
        </button>
      {/if}
      
      <button 
        class="tab-button"
        class:active={activeTab === 'recent'}
        on:click={() => changeTab('recent')}
      >
        🕐 ({recentlyUsed.length})
      </button>
    </div>

    <!-- Content Area -->
    <div 
      class="content-area"
      class:loading
      bind:this={virtualScrollContainer}
      bind:clientHeight={containerHeight}
      on:scroll={handleScroll}
    >
      {#if loading}
        <div class="loading-spinner">
          <div class="spinner"></div>
          <span>Loading symbols...</span>
        </div>
      {/if}

      <!-- Browse Tab -->
      {#if activeTab === 'browse' && showCategories}
        <div class="categories-list">
          {#each categories as category}
            <div class="category-section">
              <button 
                class="category-header"
                class:expanded={expandedCategories.has(category.id)}
                class:selected={selectedCategory === category.id}
                on:click={() => toggleCategoryExpansion(category.id)}
              >
                <span class="category-icon" style="color: {category.color}">
                  {category.icon}
                </span>
                <span class="category-name">{category.name}</span>
                <span class="category-count">
                  {searchResults?.symbols.filter(s => s.category.id === category.id).length || 0}
                </span>
                <span class="expand-icon">
                  {expandedCategories.has(category.id) ? '▼' : '▶'}
                </span>
              </button>

              {#if expandedCategories.has(category.id)}
                <div class="subcategories" transition:slide={{ duration: 200 }}>
                  {#each category.subcategories as subcategory}
                    <button 
                      class="subcategory-item"
                      class:selected={selectedFilters.subcategory === subcategory.id}
                      on:click={() => {
                        updateFilters({ 
                          category: category.id,
                          subcategory: subcategory.id 
                        });
                        selectCategory(category.id);
                      }}
                    >
                      <span class="subcategory-name">{subcategory.name}</span>
                      <span class="subcategory-count">({subcategory.count})</span>
                    </button>
                  {/each}
                </div>
              {/if}
            </div>
          {/each}
        </div>
      {/if}

      <!-- Symbol Grid -->
      {#if activeTab !== 'browse' || selectedCategory}
        <div class="symbols-grid" class:compact={compactMode}>
          {#each visibleSymbols as symbol (symbol.id)}
            <div 
              class="symbol-item"
              class:loading={getSymbolLoadingState(symbol.id) === 'loading'}
              class:error={getSymbolLoadingState(symbol.id) === 'error'}
              draggable={enableDragAndDrop}
              data-symbol-id={symbol.id}
              on:click={() => selectSymbol(symbol)}
              on:dragstart={(e) => handleDragStart(symbol, e)}
              transition:fade={{ duration: 200 }}
            >
              <!-- Symbol Preview -->
              <div class="symbol-preview">
                {#if getSymbolLoadingState(symbol.id) === 'loaded' && getSymbolPreview(symbol)}
                  <img 
                    src={getSymbolPreview(symbol)}
                    alt={symbol.name}
                    class="symbol-image"
                  />
                {:else if getSymbolLoadingState(symbol.id) === 'loading'}
                  <div class="preview-placeholder loading-placeholder">
                    <div class="loading-dots"></div>
                  </div>
                {:else if getSymbolLoadingState(symbol.id) === 'error'}
                  <div class="preview-placeholder error-placeholder">
                    ❌
                  </div>
                {:else}
                  <div class="preview-placeholder">
                    {symbol.category.icon}
                  </div>
                {/if}

                <!-- Favorite Button -->
                <button 
                  class="favorite-btn"
                  class:favorited={favorites.some(f => f.id === symbol.id)}
                  on:click={(e) => toggleFavorite(symbol, e)}
                  title={favorites.some(f => f.id === symbol.id) ? 'Remove from favorites' : 'Add to favorites'}
                >
                  {favorites.some(f => f.id === symbol.id) ? '⭐' : '☆'}
                </button>
              </div>

              <!-- Symbol Info -->
              <div class="symbol-info">
                <div class="symbol-name" title={symbol.name}>
                  {symbol.name}
                </div>
                
                {#if !compactMode}
                  <div class="symbol-meta">
                    <span class="meta-item" title="Dimensions">
                      📐 {formatSymbolSize(symbol.dimensions)}
                    </span>
                    
                    <span class="meta-item" title="Connection points">
                      🔗 {symbol.connectionPoints}
                    </span>
                    
                    <span class="complexity-badge {getComplexityColor(symbol.complexity)}">
                      {symbol.complexity}
                    </span>
                  </div>

                  {#if symbol.tags.length > 0}
                    <div class="symbol-tags">
                      {#each symbol.tags.slice(0, 3) as tag}
                        <span class="tag">{tag}</span>
                      {/each}
                      {#if symbol.tags.length > 3}
                        <span class="tag more-tags">+{symbol.tags.length - 3}</span>
                      {/if}
                    </div>
                  {/if}
                {/if}
              </div>
            </div>
          {/each}

          {#if visibleSymbols.length === 0 && !loading}
            <div class="empty-state">
              <div class="empty-icon">📭</div>
              <div class="empty-message">
                {#if searchQuery}
                  No symbols found for "{searchQuery}"
                {:else}
                  No symbols available
                {/if}
              </div>
              {#if searchQuery}
                <button class="clear-search-btn" on:click={clearFilters}>
                  Clear search
                </button>
              {/if}
            </div>
          {/if}
        </div>
      {/if}
    </div>

    <!-- Search Results Info -->
    {#if searchResults && activeTab === 'search'}
      <div class="search-info">
        <span class="results-count">
          {searchResults.totalCount} results
        </span>
        <span class="search-time">
          ({searchResults.searchTime.toFixed(1)}ms)
        </span>
      </div>
    {/if}
  </div>
{/if}

<style>
  .symbol-library {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: white;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
    overflow: hidden;
  }

  .library-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 16px;
    border-bottom: 1px solid #e5e7eb;
    background: #f9fafb;
  }

  .header-title {
    display: flex;
    align-items: center;
    gap: 8px;
    font-weight: 600;
    color: #374151;
  }

  .title-icon {
    font-size: 16px;
  }

  .header-controls {
    display: flex;
    gap: 4px;
  }

  .control-btn {
    background: none;
    border: none;
    padding: 4px 8px;
    border-radius: 4px;
    cursor: pointer;
    font-size: 14px;
    color: #6b7280;
    transition: all 0.15s ease;
  }

  .control-btn:hover {
    background: rgba(107, 114, 128, 0.1);
    color: #374151;
  }

  .control-btn.active {
    background: #3b82f6;
    color: white;
  }

  .close-btn:hover {
    background: #fee2e2;
    color: #dc2626;
  }

  .search-section {
    padding: 12px 16px;
    border-bottom: 1px solid #e5e7eb;
  }

  .search-input-container {
    position: relative;
  }

  .search-input {
    width: 100%;
    padding: 8px 12px 8px 36px;
    border: 1px solid #d1d5db;
    border-radius: 6px;
    font-size: 14px;
    background: white;
    transition: border-color 0.15s ease;
  }

  .search-input:focus {
    outline: none;
    border-color: #3b82f6;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
  }

  .search-icon {
    position: absolute;
    left: 12px;
    top: 50%;
    transform: translateY(-50%);
    color: #6b7280;
    pointer-events: none;
  }

  .search-suggestions {
    margin-top: 8px;
    border: 1px solid #e5e7eb;
    border-radius: 6px;
    background: white;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
  }

  .suggestion-item {
    display: block;
    width: 100%;
    padding: 8px 12px;
    background: none;
    border: none;
    text-align: left;
    cursor: pointer;
    font-size: 13px;
    color: #374151;
    transition: background-color 0.15s ease;
  }

  .suggestion-item:hover {
    background: #f3f4f6;
  }

  .tab-bar {
    display: flex;
    border-bottom: 1px solid #e5e7eb;
    background: white;
  }

  .tab-button {
    flex: 1;
    padding: 10px 8px;
    background: none;
    border: none;
    cursor: pointer;
    font-size: 12px;
    color: #6b7280;
    font-weight: 500;
    transition: all 0.15s ease;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .tab-button:hover {
    background: #f3f4f6;
    color: #374151;
  }

  .tab-button.active {
    background: white;
    color: #3b82f6;
    border-bottom: 2px solid #3b82f6;
  }

  .content-area {
    flex: 1;
    overflow-y: auto;
    position: relative;
  }

  .content-area.loading {
    display: flex;
    justify-content: center;
    align-items: center;
  }

  .loading-spinner {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    padding: 40px;
    color: #6b7280;
  }

  .spinner {
    width: 24px;
    height: 24px;
    border: 3px solid #e5e7eb;
    border-top: 3px solid #3b82f6;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }

  .categories-list {
    padding: 8px;
  }

  .category-section {
    margin-bottom: 4px;
  }

  .category-header {
    display: flex;
    align-items: center;
    width: 100%;
    padding: 10px 12px;
    background: none;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-size: 13px;
    color: #374151;
    transition: all 0.15s ease;
  }

  .category-header:hover {
    background: #f3f4f6;
  }

  .category-header.selected {
    background: #eff6ff;
    color: #1d4ed8;
  }

  .category-icon {
    font-size: 16px;
    margin-right: 8px;
  }

  .category-name {
    flex: 1;
    text-align: left;
    font-weight: 500;
  }

  .category-count {
    font-size: 11px;
    color: #6b7280;
    margin-right: 8px;
  }

  .expand-icon {
    font-size: 10px;
    color: #9ca3af;
  }

  .subcategories {
    margin-left: 24px;
    margin-top: 4px;
  }

  .subcategory-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 100%;
    padding: 6px 12px;
    background: none;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 12px;
    color: #6b7280;
    transition: all 0.15s ease;
  }

  .subcategory-item:hover {
    background: #f3f4f6;
    color: #374151;
  }

  .subcategory-item.selected {
    background: #dbeafe;
    color: #1e40af;
  }

  .symbols-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
    gap: 8px;
    padding: 12px;
  }

  .symbols-grid.compact {
    grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
    gap: 4px;
  }

  .symbol-item {
    position: relative;
    background: white;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    padding: 8px;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .symbol-item:hover {
    border-color: #3b82f6;
    box-shadow: 0 2px 8px rgba(59, 130, 246, 0.1);
    transform: translateY(-1px);
  }

  .symbol-item.loading {
    opacity: 0.7;
  }

  .symbol-item.error {
    border-color: #ef4444;
  }

  .symbol-preview {
    position: relative;
    aspect-ratio: 1;
    margin-bottom: 8px;
    border-radius: 4px;
    overflow: hidden;
    background: #f9fafb;
  }

  .symbol-image {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }

  .preview-placeholder {
    display: flex;
    justify-content: center;
    align-items: center;
    width: 100%;
    height: 100%;
    font-size: 24px;
    color: #9ca3af;
  }

  .loading-placeholder {
    background: linear-gradient(90deg, #f3f4f6 25%, #e5e7eb 50%, #f3f4f6 75%);
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite;
  }

  .error-placeholder {
    background: #fef2f2;
    color: #dc2626;
  }

  @keyframes shimmer {
    0% { background-position: -200% 0; }
    100% { background-position: 200% 0; }
  }

  .loading-dots::after {
    content: '';
    display: inline-block;
    width: 12px;
    height: 12px;
    border: 2px solid #e5e7eb;
    border-top: 2px solid #3b82f6;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  .favorite-btn {
    position: absolute;
    top: 4px;
    right: 4px;
    background: rgba(255, 255, 255, 0.9);
    border: none;
    border-radius: 50%;
    width: 24px;
    height: 24px;
    cursor: pointer;
    font-size: 12px;
    transition: all 0.15s ease;
    opacity: 0;
  }

  .symbol-item:hover .favorite-btn,
  .favorite-btn.favorited {
    opacity: 1;
  }

  .favorite-btn:hover {
    background: white;
    transform: scale(1.1);
  }

  .symbol-info {
    text-align: center;
  }

  .symbol-name {
    font-size: 11px;
    font-weight: 500;
    color: #374151;
    margin-bottom: 4px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .symbol-meta {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 6px;
    margin-bottom: 4px;
    flex-wrap: wrap;
  }

  .meta-item {
    font-size: 9px;
    color: #6b7280;
    white-space: nowrap;
  }

  .complexity-badge {
    font-size: 8px;
    font-weight: 500;
    padding: 1px 4px;
    border-radius: 3px;
    text-transform: uppercase;
  }

  .bg-green-100 { background-color: #dcfce7; }
  .text-green-800 { color: #166534; }
  .bg-yellow-100 { background-color: #fef3c7; }
  .text-yellow-800 { color: #92400e; }
  .bg-red-100 { background-color: #fee2e2; }
  .text-red-800 { color: #991b1b; }
  .bg-gray-100 { background-color: #f3f4f6; }
  .text-gray-800 { color: #1f2937; }

  .symbol-tags {
    display: flex;
    justify-content: center;
    gap: 2px;
    flex-wrap: wrap;
  }

  .tag {
    font-size: 8px;
    background: #f3f4f6;
    color: #6b7280;
    padding: 1px 3px;
    border-radius: 2px;
    white-space: nowrap;
  }

  .more-tags {
    font-weight: 600;
    background: #e5e7eb;
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 60px 20px;
    text-align: center;
    color: #6b7280;
  }

  .empty-icon {
    font-size: 48px;
    margin-bottom: 16px;
    opacity: 0.5;
  }

  .empty-message {
    font-size: 14px;
    margin-bottom: 16px;
  }

  .clear-search-btn {
    background: #3b82f6;
    color: white;
    border: none;
    padding: 8px 16px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 12px;
    transition: background-color 0.15s ease;
  }

  .clear-search-btn:hover {
    background: #2563eb;
  }

  .search-info {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 16px;
    border-top: 1px solid #e5e7eb;
    background: #f9fafb;
    font-size: 11px;
    color: #6b7280;
  }
</style>