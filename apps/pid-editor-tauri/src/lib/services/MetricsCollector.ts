/**
 * Metrics Collector Service
 * Collects application usage metrics and analytics
 */

export interface UserAction {
  id: string;
  type: 'click' | 'drag' | 'zoom' | 'pan' | 'select' | 'edit' | 'save' | 'load';
  target: string;
  timestamp: number;
  metadata?: Record<string, any>;
  duration?: number;
  coordinates?: { x: number; y: number };
}

export interface SessionMetrics {
  sessionId: string;
  startTime: number;
  endTime?: number;
  duration: number;
  pageViews: number;
  userActions: UserAction[];
  elementsCreated: number;
  elementsModified: number;
  elementsDeleted: number;
  saveOperations: number;
  loadOperations: number;
  errorCount: number;
  performanceIssues: number;
}

export interface FeatureUsage {
  featureName: string;
  usageCount: number;
  totalTime: number;
  averageTime: number;
  lastUsed: number;
  errorRate: number;
}

export interface UsagePattern {
  pattern: string;
  frequency: number;
  avgDuration: number;
  commonSequences: string[];
}

interface MetricsConfig {
  enabled: boolean;
  trackUserActions: boolean;
  trackPerformance: boolean;
  trackErrors: boolean;
  trackFeatureUsage: boolean;
  anonymize: boolean;
  bufferSize: number;
  flushInterval: number;
  enableHeatmaps: boolean;
}

/**
 * Metrics Collector Class
 */
export class MetricsCollector {
  private static instance: MetricsCollector;
  
  private currentSession: SessionMetrics;
  private actionBuffer: UserAction[] = [];
  private featureUsage: Map<string, FeatureUsage> = new Map();
  private usagePatterns: Map<string, UsagePattern> = new Map();
  private heatmapData: Map<string, { x: number; y: number; count: number }> = new Map();
  
  private config: MetricsConfig = {
    enabled: true,
    trackUserActions: true,
    trackPerformance: true,
    trackErrors: true,
    trackFeatureUsage: true,
    anonymize: true,
    bufferSize: 100,
    flushInterval: 30000, // 30 seconds
    enableHeatmaps: true
  };

  private flushTimer?: number;
  private eventListeners: Array<() => void> = [];

  private constructor() {
    this.currentSession = this.createNewSession();
    this.initialize();
  }

  static getInstance(): MetricsCollector {
    if (!MetricsCollector.instance) {
      MetricsCollector.instance = new MetricsCollector();
    }
    return MetricsCollector.instance;
  }

  /**
   * Initialize metrics collection
   */
  private initialize(): void {
    if (typeof window === 'undefined') return;

    this.setupEventListeners();
    this.startFlushTimer();
    this.loadPersistedData();
  }

  /**
   * Create new session
   */
  private createNewSession(): SessionMetrics {
    return {
      sessionId: this.generateSessionId(),
      startTime: Date.now(),
      duration: 0,
      pageViews: 1,
      userActions: [],
      elementsCreated: 0,
      elementsModified: 0,
      elementsDeleted: 0,
      saveOperations: 0,
      loadOperations: 0,
      errorCount: 0,
      performanceIssues: 0
    };
  }

  /**
   * Generate unique session ID
   */
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Setup event listeners
   */
  private setupEventListeners(): void {
    if (!this.config.enabled) return;

    // Track clicks
    const clickHandler = (event: MouseEvent) => {
      if (this.config.trackUserActions) {
        const target = event.target as HTMLElement;
        this.trackUserAction('click', this.getElementSelector(target), {
          coordinates: { x: event.clientX, y: event.clientY },
          button: event.button,
          ctrlKey: event.ctrlKey,
          shiftKey: event.shiftKey
        });

        // Update heatmap
        if (this.config.enableHeatmaps) {
          this.updateHeatmap(event.clientX, event.clientY);
        }
      }
    };

    // Track keyboard events
    const keyHandler = (event: KeyboardEvent) => {
      if (this.config.trackUserActions && event.target) {
        const target = event.target as HTMLElement;
        this.trackUserAction('edit', this.getElementSelector(target), {
          key: event.key,
          ctrlKey: event.ctrlKey,
          shiftKey: event.shiftKey,
          altKey: event.altKey
        });
      }
    };

    // Track errors
    const errorHandler = (event: ErrorEvent) => {
      if (this.config.trackErrors) {
        this.trackError(event.error || event.message, {
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno
        });
      }
    };

    // Track unhandled promise rejections
    const promiseErrorHandler = (event: PromiseRejectionEvent) => {
      if (this.config.trackErrors) {
        this.trackError(event.reason, { type: 'unhandled-promise-rejection' });
      }
    };

    // Track page visibility changes
    const visibilityHandler = () => {
      if (document.hidden) {
        this.pauseSession();
      } else {
        this.resumeSession();
      }
    };

    // Add event listeners
    document.addEventListener('click', clickHandler);
    document.addEventListener('keydown', keyHandler);
    window.addEventListener('error', errorHandler);
    window.addEventListener('unhandledrejection', promiseErrorHandler);
    document.addEventListener('visibilitychange', visibilityHandler);

    // Store cleanup functions
    this.eventListeners = [
      () => document.removeEventListener('click', clickHandler),
      () => document.removeEventListener('keydown', keyHandler),
      () => window.removeEventListener('error', errorHandler),
      () => window.removeEventListener('unhandledrejection', promiseErrorHandler),
      () => document.removeEventListener('visibilitychange', visibilityHandler)
    ];
  }

  /**
   * Get CSS selector for element
   */
  private getElementSelector(element: HTMLElement): string {
    if (!element) return 'unknown';

    let selector = element.tagName.toLowerCase();
    
    if (element.id) {
      selector += `#${element.id}`;
    }
    
    if (element.className && typeof element.className === 'string') {
      const classes = element.className.split(' ').filter(c => c.trim());
      if (classes.length > 0) {
        selector += `.${classes.slice(0, 3).join('.')}`;
      }
    }

    // Anonymize if needed
    if (this.config.anonymize) {
      selector = selector.replace(/\d+/g, 'X');
    }

    return selector;
  }

  /**
   * Track user action
   */
  trackUserAction(
    type: UserAction['type'],
    target: string,
    metadata?: Record<string, any>,
    duration?: number
  ): void {
    if (!this.config.enabled || !this.config.trackUserActions) return;

    const action: UserAction = {
      id: `action_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      target,
      timestamp: Date.now(),
      metadata,
      duration
    };

    this.actionBuffer.push(action);
    this.currentSession.userActions.push(action);

    // Update feature usage
    this.updateFeatureUsage(type, target, duration || 0);

    // Check buffer size
    if (this.actionBuffer.length >= this.config.bufferSize) {
      this.flushMetrics();
    }

    // Update usage patterns
    this.updateUsagePatterns(action);
  }

  /**
   * Update feature usage statistics
   */
  private updateFeatureUsage(type: string, target: string, duration: number): void {
    const featureName = `${type}:${target}`;
    const existing = this.featureUsage.get(featureName);

    if (existing) {
      existing.usageCount++;
      existing.totalTime += duration;
      existing.averageTime = existing.totalTime / existing.usageCount;
      existing.lastUsed = Date.now();
    } else {
      this.featureUsage.set(featureName, {
        featureName,
        usageCount: 1,
        totalTime: duration,
        averageTime: duration,
        lastUsed: Date.now(),
        errorRate: 0
      });
    }
  }

  /**
   * Update usage patterns
   */
  private updateUsagePatterns(action: UserAction): void {
    // Simple pattern detection - could be enhanced with ML
    const recentActions = this.currentSession.userActions.slice(-5);
    const sequence = recentActions.map(a => `${a.type}:${a.target}`).join(' -> ');
    
    const existing = this.usagePatterns.get(sequence);
    if (existing) {
      existing.frequency++;
      existing.avgDuration = (existing.avgDuration + (action.duration || 0)) / 2;
    } else {
      this.usagePatterns.set(sequence, {
        pattern: sequence,
        frequency: 1,
        avgDuration: action.duration || 0,
        commonSequences: []
      });
    }
  }

  /**
   * Update heatmap data
   */
  private updateHeatmap(x: number, y: number): void {
    // Grid-based heatmap (20x20 pixel cells)
    const gridSize = 20;
    const gridX = Math.floor(x / gridSize);
    const gridY = Math.floor(y / gridSize);
    const key = `${gridX},${gridY}`;

    const existing = this.heatmapData.get(key);
    if (existing) {
      existing.count++;
    } else {
      this.heatmapData.set(key, {
        x: gridX * gridSize,
        y: gridY * gridSize,
        count: 1
      });
    }
  }

  /**
   * Track error
   */
  trackError(error: any, metadata?: Record<string, any>): void {
    if (!this.config.enabled || !this.config.trackErrors) return;

    this.currentSession.errorCount++;

    const errorAction: UserAction = {
      id: `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: 'edit', // Using edit as error type isn't in the union
      target: 'error',
      timestamp: Date.now(),
      metadata: {
        error: this.config.anonymize ? 'Error occurred' : String(error),
        stack: this.config.anonymize ? undefined : error?.stack,
        ...metadata
      }
    };

    this.actionBuffer.push(errorAction);
    this.currentSession.userActions.push(errorAction);

    // Update error rate for affected features
    if (metadata?.featureName) {
      const feature = this.featureUsage.get(metadata.featureName);
      if (feature) {
        feature.errorRate = feature.errorRate * 0.9 + 0.1; // Exponential moving average
      }
    }
  }

  /**
   * Track element operations
   */
  trackElementCreated(): void {
    this.currentSession.elementsCreated++;
    this.trackUserAction('edit', 'element-create');
  }

  trackElementModified(): void {
    this.currentSession.elementsModified++;
    this.trackUserAction('edit', 'element-modify');
  }

  trackElementDeleted(): void {
    this.currentSession.elementsDeleted++;
    this.trackUserAction('edit', 'element-delete');
  }

  /**
   * Track save/load operations
   */
  trackSaveOperation(success: boolean, metadata?: Record<string, any>): void {
    this.currentSession.saveOperations++;
    this.trackUserAction('save', 'document', { 
      success,
      ...metadata 
    });
  }

  trackLoadOperation(success: boolean, metadata?: Record<string, any>): void {
    this.currentSession.loadOperations++;
    this.trackUserAction('load', 'document', { 
      success,
      ...metadata 
    });
  }

  /**
   * Track performance issues
   */
  trackPerformanceIssue(type: string, value: number, threshold: number): void {
    if (!this.config.trackPerformance) return;

    this.currentSession.performanceIssues++;
    this.trackUserAction('edit', 'performance-issue', {
      type,
      value,
      threshold,
      severity: value > threshold * 2 ? 'critical' : 'warning'
    });
  }

  /**
   * Start flush timer
   */
  private startFlushTimer(): void {
    this.flushTimer = window.setInterval(() => {
      this.flushMetrics();
    }, this.config.flushInterval);
  }

  /**
   * Flush metrics to storage
   */
  private flushMetrics(): void {
    if (this.actionBuffer.length === 0) return;

    // Update session duration
    this.currentSession.duration = Date.now() - this.currentSession.startTime;

    // Store in localStorage (in production, this would go to analytics service)
    const data = {
      session: this.currentSession,
      actions: [...this.actionBuffer],
      featureUsage: Array.from(this.featureUsage.entries()),
      patterns: Array.from(this.usagePatterns.entries()),
      heatmap: Array.from(this.heatmapData.entries()),
      timestamp: Date.now()
    };

    try {
      const key = `metrics_${Date.now()}`;
      localStorage.setItem(key, JSON.stringify(data));
      
      // Keep only last 10 metric snapshots
      const keys = Object.keys(localStorage).filter(k => k.startsWith('metrics_'));
      if (keys.length > 10) {
        keys.sort().slice(0, keys.length - 10).forEach(k => {
          localStorage.removeItem(k);
        });
      }
    } catch (error) {
      console.warn('Failed to store metrics:', error);
    }

    // Clear buffer
    this.actionBuffer = [];
  }

  /**
   * Load persisted data
   */
  private loadPersistedData(): void {
    try {
      const keys = Object.keys(localStorage).filter(k => k.startsWith('metrics_'));
      const latestKey = keys.sort().pop();
      
      if (latestKey) {
        const data = JSON.parse(localStorage.getItem(latestKey) || '{}');
        
        // Restore feature usage
        if (data.featureUsage) {
          this.featureUsage = new Map(data.featureUsage);
        }
        
        // Restore usage patterns
        if (data.patterns) {
          this.usagePatterns = new Map(data.patterns);
        }
      }
    } catch (error) {
      console.warn('Failed to load persisted metrics:', error);
    }
  }

  /**
   * Pause session (when page is hidden)
   */
  private pauseSession(): void {
    this.flushMetrics();
  }

  /**
   * Resume session (when page becomes visible)
   */
  private resumeSession(): void {
    this.currentSession.pageViews++;
  }

  /**
   * Public API Methods
   */

  /**
   * Get current session metrics
   */
  getCurrentSession(): SessionMetrics {
    this.currentSession.duration = Date.now() - this.currentSession.startTime;
    return { ...this.currentSession };
  }

  /**
   * Get feature usage statistics
   */
  getFeatureUsage(): FeatureUsage[] {
    return Array.from(this.featureUsage.values());
  }

  /**
   * Get usage patterns
   */
  getUsagePatterns(): UsagePattern[] {
    return Array.from(this.usagePatterns.values())
      .sort((a, b) => b.frequency - a.frequency);
  }

  /**
   * Get heatmap data
   */
  getHeatmapData(): Array<{ x: number; y: number; count: number }> {
    return Array.from(this.heatmapData.values());
  }

  /**
   * Generate analytics report
   */
  generateReport(): {
    session: SessionMetrics;
    topFeatures: FeatureUsage[];
    commonPatterns: UsagePattern[];
    insights: string[];
  } {
    const session = this.getCurrentSession();
    const features = this.getFeatureUsage();
    const patterns = this.getUsagePatterns();

    // Generate insights
    const insights: string[] = [];
    
    // Most used feature
    const topFeature = features.sort((a, b) => b.usageCount - a.usageCount)[0];
    if (topFeature) {
      insights.push(`Most used feature: ${topFeature.featureName} (${topFeature.usageCount} uses)`);
    }

    // Error rate analysis
    const highErrorFeatures = features.filter(f => f.errorRate > 0.1);
    if (highErrorFeatures.length > 0) {
      insights.push(`${highErrorFeatures.length} features have high error rates`);
    }

    // Session productivity
    const actionsPerMinute = session.userActions.length / (session.duration / 60000);
    if (actionsPerMinute > 10) {
      insights.push('High activity session - user is very engaged');
    } else if (actionsPerMinute < 2) {
      insights.push('Low activity session - user may need guidance');
    }

    return {
      session,
      topFeatures: features.slice(0, 10),
      commonPatterns: patterns.slice(0, 5),
      insights
    };
  }

  /**
   * Update configuration
   */
  updateConfig(updates: Partial<MetricsConfig>): void {
    Object.assign(this.config, updates);
    
    if (!this.config.enabled) {
      this.stop();
    }
  }

  /**
   * Get configuration
   */
  getConfig(): MetricsConfig {
    return { ...this.config };
  }

  /**
   * Export all metrics data
   */
  exportData(): string {
    return JSON.stringify({
      config: this.config,
      currentSession: this.getCurrentSession(),
      featureUsage: Array.from(this.featureUsage.entries()),
      usagePatterns: Array.from(this.usagePatterns.entries()),
      heatmapData: Array.from(this.heatmapData.entries()),
      exportTimestamp: Date.now()
    }, null, 2);
  }

  /**
   * Clear all data
   */
  clearData(): void {
    this.currentSession = this.createNewSession();
    this.actionBuffer = [];
    this.featureUsage.clear();
    this.usagePatterns.clear();
    this.heatmapData.clear();
    
    // Clear localStorage
    const keys = Object.keys(localStorage).filter(k => k.startsWith('metrics_'));
    keys.forEach(key => localStorage.removeItem(key));
  }

  /**
   * Stop metrics collection
   */
  stop(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = undefined;
    }

    this.eventListeners.forEach(cleanup => cleanup());
    this.eventListeners = [];

    this.flushMetrics();
  }

  /**
   * Cleanup on page unload
   */
  destroy(): void {
    this.stop();
  }
}

// Global metrics collector instance
export const metricsCollector = MetricsCollector.getInstance();

// Initialize on page load
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    metricsCollector.destroy();
  });
}