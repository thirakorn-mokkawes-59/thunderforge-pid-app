/**
 * Error Handler Service
 * Provides comprehensive error handling, logging, and recovery mechanisms
 */

export interface ErrorInfo {
  id: string;
  message: string;
  stack?: string;
  code?: string;
  severity: ErrorSeverity;
  category: ErrorCategory;
  timestamp: number;
  userId?: string;
  sessionId?: string;
  context: ErrorContext;
  recoverable: boolean;
  retryCount: number;
  resolved: boolean;
}

export interface ErrorContext {
  component?: string;
  action?: string;
  userId?: string;
  sessionId?: string;
  url?: string;
  userAgent?: string;
  metadata?: Record<string, any>;
  breadcrumbs?: Breadcrumb[];
}

export interface Breadcrumb {
  timestamp: number;
  category: 'navigation' | 'user' | 'system' | 'error';
  message: string;
  level: 'info' | 'warning' | 'error';
  data?: Record<string, any>;
}

export interface ErrorRecoveryStrategy {
  id: string;
  name: string;
  description: string;
  applicable: (error: ErrorInfo) => boolean;
  execute: (error: ErrorInfo) => Promise<RecoveryResult>;
  priority: number;
}

export interface RecoveryResult {
  success: boolean;
  message: string;
  actions?: string[];
  preventRetry?: boolean;
}

export interface ErrorReport {
  errors: ErrorInfo[];
  summary: {
    total: number;
    byCategory: Record<ErrorCategory, number>;
    bySeverity: Record<ErrorSeverity, number>;
    resolved: number;
    unresolved: number;
  };
  trends: {
    lastHour: number;
    lastDay: number;
    lastWeek: number;
  };
}

export type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical';
export type ErrorCategory = 
  | 'system' 
  | 'network' 
  | 'validation' 
  | 'user' 
  | 'performance' 
  | 'security' 
  | 'data' 
  | 'ui';

export type ErrorHandler = (error: Error, context?: ErrorContext) => void;

export class ErrorHandlerService {
  private static instance: ErrorHandlerService;
  
  private errors: Map<string, ErrorInfo> = new Map();
  private errorHandlers: Map<string, ErrorHandler> = new Map();
  private recoveryStrategies: ErrorRecoveryStrategy[] = [];
  private breadcrumbs: Breadcrumb[] = [];
  private sessionId: string;
  private userId?: string;

  private readonly maxErrors = 1000;
  private readonly maxBreadcrumbs = 100;
  private readonly maxRetries = 3;

  static getInstance(): ErrorHandlerService {
    if (!ErrorHandlerService.instance) {
      ErrorHandlerService.instance = new ErrorHandlerService();
    }
    return ErrorHandlerService.instance;
  }

  constructor() {
    this.sessionId = this.generateSessionId();
    this.setupGlobalErrorHandlers();
    this.initializeRecoveryStrategies();
  }

  /**
   * Report an error
   */
  reportError(
    error: Error | string,
    context: Partial<ErrorContext> = {}
  ): string {
    const errorInfo = this.createErrorInfo(error, context);
    
    // Store the error
    this.errors.set(errorInfo.id, errorInfo);
    
    // Trim old errors if needed
    this.trimErrors();
    
    // Add breadcrumb
    this.addBreadcrumb({
      timestamp: Date.now(),
      category: 'error',
      message: errorInfo.message,
      level: this.severityToBreadcrumbLevel(errorInfo.severity),
      data: { errorId: errorInfo.id, category: errorInfo.category }
    });

    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error('Error reported:', errorInfo);
    }

    // Emit error event
    this.emitErrorEvent(errorInfo);

    // Attempt recovery if applicable
    if (errorInfo.recoverable && errorInfo.retryCount < this.maxRetries) {
      this.attemptRecovery(errorInfo);
    }

    return errorInfo.id;
  }

  /**
   * Handle promise rejections
   */
  handlePromiseRejection(reason: any, promise: Promise<any>): void {
    const error = reason instanceof Error ? reason : new Error(String(reason));
    this.reportError(error, {
      category: 'system',
      action: 'promise_rejection',
      metadata: { promise: promise.toString() }
    });
  }

  /**
   * Add breadcrumb for debugging
   */
  addBreadcrumb(breadcrumb: Omit<Breadcrumb, 'timestamp'>): void {
    const fullBreadcrumb: Breadcrumb = {
      timestamp: Date.now(),
      ...breadcrumb
    };
    
    this.breadcrumbs.push(fullBreadcrumb);
    
    // Trim old breadcrumbs
    if (this.breadcrumbs.length > this.maxBreadcrumbs) {
      this.breadcrumbs = this.breadcrumbs.slice(-this.maxBreadcrumbs);
    }
  }

  /**
   * Register error handler for specific error types
   */
  registerErrorHandler(id: string, handler: ErrorHandler): void {
    this.errorHandlers.set(id, handler);
  }

  /**
   * Unregister error handler
   */
  unregisterErrorHandler(id: string): void {
    this.errorHandlers.delete(id);
  }

  /**
   * Add recovery strategy
   */
  addRecoveryStrategy(strategy: ErrorRecoveryStrategy): void {
    this.recoveryStrategies.push(strategy);
    this.recoveryStrategies.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Get error by ID
   */
  getError(id: string): ErrorInfo | undefined {
    return this.errors.get(id);
  }

  /**
   * Get all errors
   */
  getErrors(filters?: {
    category?: ErrorCategory;
    severity?: ErrorSeverity;
    resolved?: boolean;
    since?: number;
  }): ErrorInfo[] {
    let errors = Array.from(this.errors.values());

    if (filters) {
      if (filters.category) {
        errors = errors.filter(e => e.category === filters.category);
      }
      if (filters.severity) {
        errors = errors.filter(e => e.severity === filters.severity);
      }
      if (filters.resolved !== undefined) {
        errors = errors.filter(e => e.resolved === filters.resolved);
      }
      if (filters.since) {
        errors = errors.filter(e => e.timestamp >= filters.since);
      }
    }

    return errors.sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * Mark error as resolved
   */
  resolveError(errorId: string, resolution?: string): boolean {
    const error = this.errors.get(errorId);
    if (!error) return false;

    error.resolved = true;
    error.context.metadata = {
      ...error.context.metadata,
      resolution,
      resolvedAt: Date.now()
    };

    this.emitErrorResolvedEvent(error);
    return true;
  }

  /**
   * Clear all errors
   */
  clearErrors(): void {
    this.errors.clear();
  }

  /**
   * Get error report
   */
  getErrorReport(): ErrorReport {
    const errors = Array.from(this.errors.values());
    const now = Date.now();
    const oneHour = 60 * 60 * 1000;
    const oneDay = 24 * oneHour;
    const oneWeek = 7 * oneDay;

    return {
      errors,
      summary: {
        total: errors.length,
        byCategory: this.groupByCategory(errors),
        bySeverity: this.groupBySeverity(errors),
        resolved: errors.filter(e => e.resolved).length,
        unresolved: errors.filter(e => !e.resolved).length
      },
      trends: {
        lastHour: errors.filter(e => e.timestamp >= now - oneHour).length,
        lastDay: errors.filter(e => e.timestamp >= now - oneDay).length,
        lastWeek: errors.filter(e => e.timestamp >= now - oneWeek).length
      }
    };
  }

  /**
   * Export error data for external reporting
   */
  exportErrorData(): string {
    const report = this.getErrorReport();
    return JSON.stringify({
      ...report,
      breadcrumbs: this.breadcrumbs.slice(-50), // Last 50 breadcrumbs
      sessionId: this.sessionId,
      userId: this.userId,
      exportedAt: Date.now()
    }, null, 2);
  }

  /**
   * Set user ID for error tracking
   */
  setUserId(userId: string): void {
    this.userId = userId;
  }

  /**
   * Create retry function for error recovery
   */
  createRetryFunction<T>(
    fn: () => Promise<T>,
    context: Partial<ErrorContext> = {}
  ): () => Promise<T> {
    return async () => {
      let lastError: Error | null = null;
      
      for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
        try {
          return await fn();
        } catch (error) {
          lastError = error instanceof Error ? error : new Error(String(error));
          
          if (attempt < this.maxRetries) {
            this.addBreadcrumb({
              category: 'system',
              message: `Retry attempt ${attempt} failed`,
              level: 'warning',
              data: { attempt, error: lastError.message, ...context }
            });
            
            // Exponential backoff
            await this.delay(Math.pow(2, attempt) * 1000);
          }
        }
      }
      
      // All retries failed, report the error
      this.reportError(lastError!, {
        ...context,
        action: 'retry_exhausted',
        metadata: { attempts: this.maxRetries }
      });
      
      throw lastError;
    };
  }

  /**
   * Private helper methods
   */

  private setupGlobalErrorHandlers(): void {
    if (typeof window !== 'undefined') {
      // Handle uncaught errors
      window.addEventListener('error', (event) => {
        this.reportError(event.error || new Error(event.message), {
          category: 'system',
          action: 'uncaught_error',
          url: event.filename,
          metadata: {
            lineno: event.lineno,
            colno: event.colno
          }
        });
      });

      // Handle unhandled promise rejections
      window.addEventListener('unhandledrejection', (event) => {
        this.handlePromiseRejection(event.reason, event.promise);
        event.preventDefault(); // Prevent console error
      });
    }
  }

  private initializeRecoveryStrategies(): void {
    // Network error recovery
    this.addRecoveryStrategy({
      id: 'network-retry',
      name: 'Network Retry',
      description: 'Retry network requests after a delay',
      priority: 100,
      applicable: (error) => error.category === 'network',
      execute: async (error) => {
        await this.delay(2000);
        return {
          success: true,
          message: 'Network request will be retried',
          actions: ['retry_network_request']
        };
      }
    });

    // UI component recovery
    this.addRecoveryStrategy({
      id: 'ui-reload',
      name: 'UI Component Reload',
      description: 'Reload UI component state',
      priority: 80,
      applicable: (error) => error.category === 'ui' && error.severity !== 'critical',
      execute: async (error) => {
        // Emit component reload event
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('component-reload', {
            detail: { component: error.context.component }
          }));
        }
        
        return {
          success: true,
          message: 'Component state has been reset',
          actions: ['reload_component']
        };
      }
    });

    // Data validation recovery
    this.addRecoveryStrategy({
      id: 'validation-reset',
      name: 'Validation Reset',
      description: 'Reset form validation state',
      priority: 60,
      applicable: (error) => error.category === 'validation',
      execute: async (error) => {
        return {
          success: true,
          message: 'Validation state has been reset',
          actions: ['reset_validation']
        };
      }
    });
  }

  private createErrorInfo(
    error: Error | string,
    context: Partial<ErrorContext>
  ): ErrorInfo {
    const timestamp = Date.now();
    const errorObj = error instanceof Error ? error : new Error(error);
    
    return {
      id: this.generateErrorId(),
      message: errorObj.message,
      stack: errorObj.stack,
      code: (errorObj as any).code,
      severity: this.determineSeverity(errorObj, context),
      category: context.category || this.categorizeError(errorObj),
      timestamp,
      userId: this.userId,
      sessionId: this.sessionId,
      context: {
        url: typeof window !== 'undefined' ? window.location.href : undefined,
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
        breadcrumbs: [...this.breadcrumbs.slice(-10)], // Last 10 breadcrumbs
        ...context
      },
      recoverable: this.isRecoverable(errorObj, context),
      retryCount: 0,
      resolved: false
    };
  }

  private generateErrorId(): string {
    return `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private determineSeverity(error: Error, context: Partial<ErrorContext>): ErrorSeverity {
    // Check for critical errors
    if (error.message.includes('out of memory') || 
        error.message.includes('maximum call stack') ||
        context.category === 'security') {
      return 'critical';
    }

    // Check for high severity errors
    if (error.name === 'TypeError' || 
        error.name === 'ReferenceError' ||
        context.category === 'system') {
      return 'high';
    }

    // Check for medium severity errors
    if (context.category === 'network' || 
        context.category === 'data' ||
        context.category === 'performance') {
      return 'medium';
    }

    // Default to low severity
    return 'low';
  }

  private categorizeError(error: Error): ErrorCategory {
    const message = error.message.toLowerCase();
    const name = error.name.toLowerCase();

    if (message.includes('network') || message.includes('fetch')) {
      return 'network';
    }

    if (message.includes('validation') || message.includes('invalid')) {
      return 'validation';
    }

    if (name.includes('typeerror') || name.includes('referenceerror')) {
      return 'system';
    }

    if (message.includes('performance') || message.includes('slow')) {
      return 'performance';
    }

    if (message.includes('unauthorized') || message.includes('forbidden')) {
      return 'security';
    }

    return 'user';
  }

  private isRecoverable(error: Error, context: Partial<ErrorContext>): boolean {
    // Critical errors are generally not recoverable
    if (this.determineSeverity(error, context) === 'critical') {
      return false;
    }

    // Network and validation errors are often recoverable
    const category = context.category || this.categorizeError(error);
    return ['network', 'validation', 'ui', 'data'].includes(category);
  }

  private async attemptRecovery(error: ErrorInfo): Promise<void> {
    const applicableStrategies = this.recoveryStrategies.filter(strategy =>
      strategy.applicable(error)
    );

    for (const strategy of applicableStrategies) {
      try {
        const result = await strategy.execute(error);
        
        if (result.success) {
          error.context.metadata = {
            ...error.context.metadata,
            recoveryStrategy: strategy.id,
            recoveryResult: result,
            recoveredAt: Date.now()
          };

          this.addBreadcrumb({
            category: 'system',
            message: `Error recovered using ${strategy.name}`,
            level: 'info',
            data: { errorId: error.id, strategy: strategy.id }
          });

          if (!result.preventRetry) {
            error.retryCount++;
          }

          break;
        }
      } catch (recoveryError) {
        this.reportError(recoveryError instanceof Error ? recoveryError : new Error(String(recoveryError)), {
          category: 'system',
          action: 'recovery_failed',
          metadata: { originalErrorId: error.id, strategy: strategy.id }
        });
      }
    }
  }

  private severityToBreadcrumbLevel(severity: ErrorSeverity): Breadcrumb['level'] {
    switch (severity) {
      case 'critical':
      case 'high':
        return 'error';
      case 'medium':
        return 'warning';
      default:
        return 'info';
    }
  }

  private trimErrors(): void {
    if (this.errors.size > this.maxErrors) {
      const oldestErrors = Array.from(this.errors.values())
        .sort((a, b) => a.timestamp - b.timestamp)
        .slice(0, this.errors.size - this.maxErrors);

      oldestErrors.forEach(error => {
        this.errors.delete(error.id);
      });
    }
  }

  private emitErrorEvent(error: ErrorInfo): void {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('error-reported', { detail: error }));
    }
  }

  private emitErrorResolvedEvent(error: ErrorInfo): void {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('error-resolved', { detail: error }));
    }
  }

  private groupByCategory(errors: ErrorInfo[]): Record<ErrorCategory, number> {
    const groups: Record<ErrorCategory, number> = {
      system: 0, network: 0, validation: 0, user: 0,
      performance: 0, security: 0, data: 0, ui: 0
    };

    errors.forEach(error => {
      groups[error.category]++;
    });

    return groups;
  }

  private groupBySeverity(errors: ErrorInfo[]): Record<ErrorSeverity, number> {
    const groups: Record<ErrorSeverity, number> = {
      low: 0, medium: 0, high: 0, critical: 0
    };

    errors.forEach(error => {
      groups[error.severity]++;
    });

    return groups;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Global error handler instance
export const errorHandler = ErrorHandlerService.getInstance();

// Convenience functions
export const reportError = (error: Error | string, context?: Partial<ErrorContext>) => 
  errorHandler.reportError(error, context);

export const addBreadcrumb = (breadcrumb: Omit<Breadcrumb, 'timestamp'>) => 
  errorHandler.addBreadcrumb(breadcrumb);

export const withErrorHandling = <T>(
  fn: () => Promise<T>,
  context?: Partial<ErrorContext>
) => errorHandler.createRetryFunction(fn, context);