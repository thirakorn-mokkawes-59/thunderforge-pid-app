/**
 * Performance Monitor Service
 * Tracks application performance metrics and provides insights
 */

export interface PerformanceMetrics {
  fps: number;
  memoryUsage: number;
  renderTime: number;
  elementCount: number;
  cacheHitRate: number;
  cpuUsage: number;
}

export interface PerformanceEntry {
  timestamp: number;
  metrics: PerformanceMetrics;
  pageURL: string;
  userAgent: string;
}

export interface PerformanceAlert {
  id: string;
  type: 'warning' | 'critical';
  metric: keyof PerformanceMetrics;
  value: number;
  threshold: number;
  timestamp: number;
  message: string;
}

interface PerformanceThresholds {
  fps: { warning: number; critical: number };
  memoryUsage: { warning: number; critical: number };
  renderTime: { warning: number; critical: number };
  elementCount: { warning: number; critical: number };
  cacheHitRate: { warning: number; critical: number };
  cpuUsage: { warning: number; critical: number };
}

interface MonitoringOptions {
  enabled: boolean;
  sampleInterval: number;
  maxHistorySize: number;
  enableAlerts: boolean;
  enableReporting: boolean;
  thresholds: PerformanceThresholds;
}

/**
 * Performance Monitor Class
 */
export class PerformanceMonitor {
  private static instance: PerformanceMonitor;
  
  private metrics: PerformanceMetrics;
  private history: PerformanceEntry[] = [];
  private alerts: PerformanceAlert[] = [];
  private observers: PerformanceObserver[] = [];
  
  private frameCount = 0;
  private frameStart = 0;
  private lastFrameTime = 0;
  private renderStartTime = 0;
  
  private sampleTimer?: number;
  private animationFrame?: number;

  private readonly options: MonitoringOptions = {
    enabled: true,
    sampleInterval: 1000, // 1 second
    maxHistorySize: 300, // 5 minutes of samples
    enableAlerts: true,
    enableReporting: false,
    thresholds: {
      fps: { warning: 30, critical: 15 },
      memoryUsage: { warning: 100, critical: 200 }, // MB
      renderTime: { warning: 16, critical: 33 }, // ms
      elementCount: { warning: 1000, critical: 5000 },
      cacheHitRate: { warning: 0.7, critical: 0.5 },
      cpuUsage: { warning: 70, critical: 90 } // percentage
    }
  };

  private constructor() {
    this.metrics = {
      fps: 60,
      memoryUsage: 0,
      renderTime: 0,
      elementCount: 0,
      cacheHitRate: 1,
      cpuUsage: 0
    };

    this.initialize();
  }

  static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }

  /**
   * Initialize performance monitoring
   */
  private initialize(): void {
    if (typeof window === 'undefined') return;

    this.startFPSMonitoring();
    this.startMemoryMonitoring();
    this.startPerformanceObserver();
    this.startSampling();
  }

  /**
   * FPS Monitoring
   */
  private startFPSMonitoring(): void {
    this.frameStart = performance.now();
    this.lastFrameTime = this.frameStart;

    const measureFrame = (currentTime: number) => {
      this.frameCount++;
      const deltaTime = currentTime - this.lastFrameTime;
      
      if (deltaTime >= 1000) {
        this.metrics.fps = Math.round((this.frameCount * 1000) / deltaTime);
        this.frameCount = 0;
        this.lastFrameTime = currentTime;
      }

      this.animationFrame = requestAnimationFrame(measureFrame);
    };

    this.animationFrame = requestAnimationFrame(measureFrame);
  }

  /**
   * Memory Usage Monitoring
   */
  private startMemoryMonitoring(): void {
    if ('memory' in performance) {
      const memoryInfo = (performance as any).memory;
      this.metrics.memoryUsage = Math.round(memoryInfo.usedJSHeapSize / 1024 / 1024);
    }
  }

  /**
   * Performance Observer for paint metrics
   */
  private startPerformanceObserver(): void {
    try {
      // Measure render/paint timing
      const paintObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.entryType === 'paint' && entry.name === 'first-contentful-paint') {
            this.metrics.renderTime = entry.startTime;
          }
        }
      });

      paintObserver.observe({ entryTypes: ['paint'] });
      this.observers.push(paintObserver);

      // Measure navigation timing
      const navigationObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.entryType === 'navigation') {
            const navEntry = entry as PerformanceNavigationTiming;
            this.metrics.renderTime = navEntry.loadEventEnd - navEntry.navigationStart;
          }
        }
      });

      navigationObserver.observe({ entryTypes: ['navigation'] });
      this.observers.push(navigationObserver);

    } catch (error) {
      console.warn('PerformanceObserver not supported:', error);
    }
  }

  /**
   * Start periodic sampling
   */
  private startSampling(): void {
    this.sampleTimer = window.setInterval(() => {
      if (this.options.enabled) {
        this.collectMetrics();
        this.checkThresholds();
      }
    }, this.options.sampleInterval);
  }

  /**
   * Collect current performance metrics
   */
  private collectMetrics(): void {
    // Update memory usage
    if ('memory' in performance) {
      const memoryInfo = (performance as any).memory;
      this.metrics.memoryUsage = Math.round(memoryInfo.usedJSHeapSize / 1024 / 1024);
    }

    // Update element count (DOM nodes)
    this.metrics.elementCount = document.querySelectorAll('*').length;

    // CPU usage estimation (based on task timing)
    this.updateCPUUsage();

    // Store in history
    const entry: PerformanceEntry = {
      timestamp: Date.now(),
      metrics: { ...this.metrics },
      pageURL: window.location.href,
      userAgent: navigator.userAgent
    };

    this.history.push(entry);

    // Trim history if needed
    if (this.history.length > this.options.maxHistorySize) {
      this.history = this.history.slice(-this.options.maxHistorySize);
    }
  }

  /**
   * Estimate CPU usage based on task timing
   */
  private updateCPUUsage(): void {
    const start = performance.now();
    
    // Simulate CPU-intensive task
    let result = 0;
    for (let i = 0; i < 10000; i++) {
      result += Math.random();
    }
    
    const elapsed = performance.now() - start;
    // Normalize to percentage (assuming baseline of 0.1ms for the task)
    this.metrics.cpuUsage = Math.min(100, Math.round((elapsed / 0.1) * 10));
  }

  /**
   * Check performance thresholds and generate alerts
   */
  private checkThresholds(): void {
    if (!this.options.enableAlerts) return;

    Object.entries(this.metrics).forEach(([metric, value]) => {
      const thresholds = this.options.thresholds[metric as keyof PerformanceMetrics];
      if (!thresholds) return;

      let alertType: 'warning' | 'critical' | null = null;
      let threshold = 0;

      if (metric === 'cacheHitRate' || metric === 'fps') {
        // Lower values are worse for these metrics
        if (value <= thresholds.critical) {
          alertType = 'critical';
          threshold = thresholds.critical;
        } else if (value <= thresholds.warning) {
          alertType = 'warning';
          threshold = thresholds.warning;
        }
      } else {
        // Higher values are worse for these metrics
        if (value >= thresholds.critical) {
          alertType = 'critical';
          threshold = thresholds.critical;
        } else if (value >= thresholds.warning) {
          alertType = 'warning';
          threshold = thresholds.warning;
        }
      }

      if (alertType) {
        this.generateAlert(metric as keyof PerformanceMetrics, alertType, value, threshold);
      }
    });
  }

  /**
   * Generate performance alert
   */
  private generateAlert(
    metric: keyof PerformanceMetrics,
    type: 'warning' | 'critical',
    value: number,
    threshold: number
  ): void {
    const alertId = `${metric}-${type}-${Date.now()}`;
    
    // Don't generate duplicate alerts for the same metric within 30 seconds
    const recentAlert = this.alerts.find(alert => 
      alert.metric === metric && 
      alert.type === type && 
      Date.now() - alert.timestamp < 30000
    );

    if (recentAlert) return;

    const alert: PerformanceAlert = {
      id: alertId,
      type,
      metric,
      value,
      threshold,
      timestamp: Date.now(),
      message: this.generateAlertMessage(metric, type, value, threshold)
    };

    this.alerts.push(alert);

    // Trim old alerts
    this.alerts = this.alerts.filter(a => Date.now() - a.timestamp < 300000); // Keep 5 minutes

    // Emit alert event
    this.emitAlert(alert);
  }

  /**
   * Generate alert message
   */
  private generateAlertMessage(
    metric: keyof PerformanceMetrics,
    type: 'warning' | 'critical',
    value: number,
    threshold: number
  ): string {
    const metricNames = {
      fps: 'Frame Rate',
      memoryUsage: 'Memory Usage',
      renderTime: 'Render Time',
      elementCount: 'DOM Elements',
      cacheHitRate: 'Cache Hit Rate',
      cpuUsage: 'CPU Usage'
    };

    const units = {
      fps: 'fps',
      memoryUsage: 'MB',
      renderTime: 'ms',
      elementCount: 'elements',
      cacheHitRate: '%',
      cpuUsage: '%'
    };

    const displayValue = metric === 'cacheHitRate' ? (value * 100).toFixed(1) : value;
    const displayThreshold = metric === 'cacheHitRate' ? (threshold * 100).toFixed(1) : threshold;

    return `${type.toUpperCase()}: ${metricNames[metric]} is ${displayValue}${units[metric]} ` +
           `(threshold: ${displayThreshold}${units[metric]})`;
  }

  /**
   * Emit alert to listeners
   */
  private emitAlert(alert: PerformanceAlert): void {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('performance-alert', { detail: alert }));
    }
    
    console.warn(`Performance Alert: ${alert.message}`);
  }

  /**
   * Public API Methods
   */

  /**
   * Get current performance metrics
   */
  getCurrentMetrics(): PerformanceMetrics {
    return { ...this.metrics };
  }

  /**
   * Get performance history
   */
  getHistory(limit?: number): PerformanceEntry[] {
    return limit ? this.history.slice(-limit) : [...this.history];
  }

  /**
   * Get current alerts
   */
  getAlerts(): PerformanceAlert[] {
    return [...this.alerts];
  }

  /**
   * Update cache hit rate
   */
  updateCacheHitRate(hitRate: number): void {
    this.metrics.cacheHitRate = Math.max(0, Math.min(1, hitRate));
  }

  /**
   * Mark render start
   */
  markRenderStart(): void {
    this.renderStartTime = performance.now();
  }

  /**
   * Mark render end
   */
  markRenderEnd(): void {
    if (this.renderStartTime > 0) {
      this.metrics.renderTime = performance.now() - this.renderStartTime;
      this.renderStartTime = 0;
    }
  }

  /**
   * Update configuration
   */
  updateConfig(updates: Partial<MonitoringOptions>): void {
    Object.assign(this.options, updates);
    
    if (!this.options.enabled) {
      this.stop();
    } else if (!this.sampleTimer) {
      this.startSampling();
    }
  }

  /**
   * Get configuration
   */
  getConfig(): MonitoringOptions {
    return { ...this.options };
  }

  /**
   * Get performance report
   */
  getPerformanceReport(): {
    summary: PerformanceMetrics;
    averages: PerformanceMetrics;
    trends: { [key: string]: 'improving' | 'stable' | 'degrading' };
    alerts: PerformanceAlert[];
  } {
    const recent = this.history.slice(-60); // Last minute
    const summary = this.getCurrentMetrics();

    // Calculate averages
    const averages = recent.reduce(
      (acc, entry) => {
        Object.keys(acc).forEach(key => {
          acc[key as keyof PerformanceMetrics] += entry.metrics[key as keyof PerformanceMetrics];
        });
        return acc;
      },
      { ...this.metrics }
    );

    Object.keys(averages).forEach(key => {
      averages[key as keyof PerformanceMetrics] = 
        averages[key as keyof PerformanceMetrics] / (recent.length || 1);
    });

    // Calculate trends
    const trends: { [key: string]: 'improving' | 'stable' | 'degrading' } = {};
    Object.keys(this.metrics).forEach(metric => {
      const recentValues = recent.map(entry => 
        entry.metrics[metric as keyof PerformanceMetrics]
      );
      
      if (recentValues.length < 10) {
        trends[metric] = 'stable';
        return;
      }

      const firstHalf = recentValues.slice(0, Math.floor(recentValues.length / 2));
      const secondHalf = recentValues.slice(Math.floor(recentValues.length / 2));
      
      const firstAvg = firstHalf.reduce((sum, val) => sum + val, 0) / firstHalf.length;
      const secondAvg = secondHalf.reduce((sum, val) => sum + val, 0) / secondHalf.length;
      
      const change = (secondAvg - firstAvg) / firstAvg;
      const changeThreshold = 0.1; // 10%

      if (metric === 'fps' || metric === 'cacheHitRate') {
        // Higher is better
        if (change > changeThreshold) trends[metric] = 'improving';
        else if (change < -changeThreshold) trends[metric] = 'degrading';
        else trends[metric] = 'stable';
      } else {
        // Lower is better
        if (change < -changeThreshold) trends[metric] = 'improving';
        else if (change > changeThreshold) trends[metric] = 'degrading';
        else trends[metric] = 'stable';
      }
    });

    return {
      summary,
      averages,
      trends,
      alerts: this.getAlerts()
    };
  }

  /**
   * Export performance data
   */
  exportData(): string {
    return JSON.stringify({
      config: this.options,
      history: this.history,
      alerts: this.alerts,
      exportTimestamp: Date.now()
    }, null, 2);
  }

  /**
   * Clear all data
   */
  clearData(): void {
    this.history = [];
    this.alerts = [];
  }

  /**
   * Stop monitoring
   */
  stop(): void {
    if (this.sampleTimer) {
      clearInterval(this.sampleTimer);
      this.sampleTimer = undefined;
    }

    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = undefined;
    }

    this.observers.forEach(observer => observer.disconnect());
    this.observers = [];
  }

  /**
   * Cleanup on page unload
   */
  destroy(): void {
    this.stop();
    this.clearData();
  }
}

// Global performance monitor instance
export const performanceMonitor = PerformanceMonitor.getInstance();

// Initialize on page load
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    performanceMonitor.destroy();
  });

  // Listen for visibility changes to pause monitoring when hidden
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      performanceMonitor.updateConfig({ enabled: false });
    } else {
      performanceMonitor.updateConfig({ enabled: true });
    }
  });
}