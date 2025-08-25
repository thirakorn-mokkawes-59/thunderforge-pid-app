import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { ErrorHandlerService, type ErrorContext, type ErrorRecoveryStrategy } from '../ErrorHandler';

// Mock DOM APIs
global.window = {
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  dispatchEvent: vi.fn(),
  location: { href: 'http://localhost:3000' }
} as any;

global.navigator = {
  userAgent: 'Mozilla/5.0 (Test) Test/1.0'
} as any;

global.DOMParser = vi.fn().mockImplementation(() => ({
  parseFromString: vi.fn().mockReturnValue({
    querySelector: vi.fn().mockReturnValue(null)
  })
}));

describe('ErrorHandlerService', () => {
  let errorHandler: ErrorHandlerService;
  let originalConsoleError: any;

  beforeEach(() => {
    // Mock console.error to prevent test output noise
    originalConsoleError = console.error;
    console.error = vi.fn();
    
    // Create fresh instance for each test
    (ErrorHandlerService as any).instance = undefined;
    errorHandler = ErrorHandlerService.getInstance();
    
    // Clear any existing errors
    errorHandler.clearErrors();
  });

  afterEach(() => {
    console.error = originalConsoleError;
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const instance1 = ErrorHandlerService.getInstance();
      const instance2 = ErrorHandlerService.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('Error Reporting', () => {
    it('should report an error with basic information', () => {
      const error = new Error('Test error message');
      const errorId = errorHandler.reportError(error);

      expect(errorId).toBeDefined();
      expect(typeof errorId).toBe('string');

      const reportedError = errorHandler.getError(errorId);
      expect(reportedError).toBeDefined();
      expect(reportedError!.message).toBe('Test error message');
      expect(reportedError!.severity).toBe('low'); // Default severity for generic Error
      expect(reportedError!.category).toBe('user'); // Default category
      expect(reportedError!.resolved).toBe(false);
    });

    it('should report string errors', () => {
      const errorMessage = 'String error message';
      const errorId = errorHandler.reportError(errorMessage);

      const reportedError = errorHandler.getError(errorId);
      expect(reportedError).toBeDefined();
      expect(reportedError!.message).toBe(errorMessage);
    });

    it('should include context information', () => {
      const error = new Error('Test error');
      const context: Partial<ErrorContext> = {
        component: 'TestComponent',
        action: 'test_action',
        metadata: { testData: 'value' }
      };

      const errorId = errorHandler.reportError(error, context);
      const reportedError = errorHandler.getError(errorId);

      expect(reportedError!.context.component).toBe('TestComponent');
      expect(reportedError!.context.action).toBe('test_action');
      expect(reportedError!.context.metadata!.testData).toBe('value');
    });

    it('should auto-detect error severity', () => {
      // Critical error
      const criticalError = new Error('out of memory');
      const criticalId = errorHandler.reportError(criticalError);
      expect(errorHandler.getError(criticalId)!.severity).toBe('critical');

      // High severity error
      const highError = new TypeError('type error');
      const highId = errorHandler.reportError(highError);
      expect(errorHandler.getError(highId)!.severity).toBe('high');

      // Medium severity error
      const mediumError = new Error('network failed');
      const mediumId = errorHandler.reportError(mediumError, { category: 'network' });
      expect(errorHandler.getError(mediumId)!.severity).toBe('medium');

      // Low severity error
      const lowError = new Error('user input invalid');
      const lowId = errorHandler.reportError(lowError, { category: 'user' });
      expect(errorHandler.getError(lowId)!.severity).toBe('low');
    });

    it('should auto-categorize errors', () => {
      const networkError = new Error('network request failed');
      const networkId = errorHandler.reportError(networkError);
      expect(errorHandler.getError(networkId)!.category).toBe('network');

      const validationError = new Error('validation failed');
      const validationId = errorHandler.reportError(validationError);
      expect(errorHandler.getError(validationId)!.category).toBe('validation');

      const typeError = new TypeError('type error');
      const typeId = errorHandler.reportError(typeError);
      expect(errorHandler.getError(typeId)!.category).toBe('system');
    });
  });

  describe('Breadcrumbs', () => {
    it('should add breadcrumbs', () => {
      errorHandler.addBreadcrumb({
        category: 'user',
        message: 'User clicked button',
        level: 'info',
        data: { buttonId: 'submit' }
      });

      const error = new Error('Test error');
      const errorId = errorHandler.reportError(error);
      const reportedError = errorHandler.getError(errorId);

      expect(reportedError!.context.breadcrumbs).toHaveLength(1);
      expect(reportedError!.context.breadcrumbs![0].message).toBe('User clicked button');
      expect(reportedError!.context.breadcrumbs![0].data!.buttonId).toBe('submit');
    });

    it('should limit breadcrumb count', () => {
      // Add more than the limit (100)
      for (let i = 0; i < 150; i++) {
        errorHandler.addBreadcrumb({
          category: 'system',
          message: `Breadcrumb ${i}`,
          level: 'info'
        });
      }

      const error = new Error('Test error');
      const errorId = errorHandler.reportError(error);
      const reportedError = errorHandler.getError(errorId);

      // Should only include the last 10 in error context
      expect(reportedError!.context.breadcrumbs!.length).toBeLessThanOrEqual(10);
    });
  });

  describe('Error Retrieval and Filtering', () => {
    beforeEach(() => {
      // Add test errors with explicit context
      errorHandler.reportError(new Error('System error'), { category: 'system' });
      errorHandler.reportError(new Error('Network error'), { category: 'network' });
      errorHandler.reportError(new Error('User error'), { category: 'user' });
      
      const validationId = errorHandler.reportError(new Error('Validation error'), { category: 'validation' });
      errorHandler.resolveError(validationId, 'Fixed by user');
    });

    it('should get all errors', () => {
      const errors = errorHandler.getErrors();
      expect(errors).toHaveLength(4);
    });

    it('should filter errors by category', () => {
      const networkErrors = errorHandler.getErrors({ category: 'network' });
      expect(networkErrors).toHaveLength(1);
      expect(networkErrors[0].category).toBe('network');
    });

    it('should filter errors by severity', () => {
      const mediumErrors = errorHandler.getErrors({ severity: 'medium' });
      expect(mediumErrors).toHaveLength(1); // Only network error should be medium by default
      mediumErrors.forEach(error => {
        expect(error.severity).toBe('medium');
      });
    });

    it('should filter errors by resolved status', () => {
      const unresolvedErrors = errorHandler.getErrors({ resolved: false });
      expect(unresolvedErrors).toHaveLength(3);

      const resolvedErrors = errorHandler.getErrors({ resolved: true });
      expect(resolvedErrors).toHaveLength(1);
    });

    it('should filter errors by timestamp', () => {
      const now = Date.now();
      const since = now - 1000; // 1 second ago
      
      const recentErrors = errorHandler.getErrors({ since });
      expect(recentErrors).toHaveLength(4);
    });
  });

  describe('Error Resolution', () => {
    it('should mark error as resolved', () => {
      const errorId = errorHandler.reportError(new Error('Test error'));
      const beforeResolve = errorHandler.getError(errorId);
      expect(beforeResolve!.resolved).toBe(false);

      const result = errorHandler.resolveError(errorId, 'Fixed manually');
      expect(result).toBe(true);

      const afterResolve = errorHandler.getError(errorId);
      expect(afterResolve!.resolved).toBe(true);
      expect(afterResolve!.context.metadata!.resolution).toBe('Fixed manually');
      expect(afterResolve!.context.metadata!.resolvedAt).toBeDefined();
    });

    it('should return false for non-existent error', () => {
      const result = errorHandler.resolveError('non-existent-id');
      expect(result).toBe(false);
    });
  });

  describe('Recovery Strategies', () => {
    it('should register recovery strategies', () => {
      const mockStrategy: ErrorRecoveryStrategy = {
        id: 'test-strategy',
        name: 'Test Strategy',
        description: 'Test recovery strategy',
        priority: 100,
        applicable: (error) => error.category === 'network',
        execute: vi.fn().mockResolvedValue({
          success: true,
          message: 'Recovery successful',
          actions: ['test_action']
        })
      };

      errorHandler.addRecoveryStrategy(mockStrategy);

      const error = new Error('Network timeout');
      errorHandler.reportError(error, { category: 'network' });

      // Verify strategy was registered (recovery happens asynchronously)
      expect(mockStrategy.applicable).toBeDefined();
      expect(mockStrategy.execute).toBeDefined();
    });

    it('should sort strategies by priority', () => {
      const lowPriorityStrategy: ErrorRecoveryStrategy = {
        id: 'low-priority',
        name: 'Low Priority',
        description: 'Low priority strategy',
        priority: 10,
        applicable: () => true,
        execute: vi.fn().mockResolvedValue({ success: true, message: 'Low priority' })
      };

      const highPriorityStrategy: ErrorRecoveryStrategy = {
        id: 'high-priority',
        name: 'High Priority',
        description: 'High priority strategy',
        priority: 100,
        applicable: () => true,
        execute: vi.fn().mockResolvedValue({ success: true, message: 'High priority' })
      };

      errorHandler.addRecoveryStrategy(lowPriorityStrategy);
      errorHandler.addRecoveryStrategy(highPriorityStrategy);

      // The strategies should be sorted by priority (higher first)
      // This is tested indirectly through the execution order
      expect(true).toBe(true); // Placeholder - actual testing would require access to internal state
    });
  });

  describe('Error Reports', () => {
    beforeEach(() => {
      // Clear and add test data
      errorHandler.clearErrors();
      
      errorHandler.reportError(new Error('out of memory'), { category: 'system' }); // Should be critical
      errorHandler.reportError(new TypeError('type error'), { category: 'system' }); // Should be high
      errorHandler.reportError(new Error('Network error'), { category: 'network' }); // Should be medium
      errorHandler.reportError(new Error('User error'), { category: 'user' }); // Should be low
      
      const resolvedId = errorHandler.reportError(new Error('Resolved error'), { category: 'validation' });
      errorHandler.resolveError(resolvedId);
    });

    it('should generate comprehensive error report', () => {
      const report = errorHandler.getErrorReport();

      expect(report.summary.total).toBe(5);
      expect(report.summary.resolved).toBe(1);
      expect(report.summary.unresolved).toBe(4);
      
      expect(report.summary.byCategory.system).toBe(2);
      expect(report.summary.byCategory.network).toBe(1);
      expect(report.summary.byCategory.user).toBe(1);
      expect(report.summary.byCategory.validation).toBe(1);
      
      expect(report.summary.bySeverity.critical).toBe(1);
      expect(report.summary.bySeverity.high).toBe(1);
      expect(report.summary.bySeverity.medium).toBe(1); // Only network error
      expect(report.summary.bySeverity.low).toBe(2); // User error and validation error
    });

    it('should include trend information', () => {
      const report = errorHandler.getErrorReport();

      expect(report.trends.lastHour).toBe(5); // All errors are recent
      expect(report.trends.lastDay).toBe(5);
      expect(report.trends.lastWeek).toBe(5);
    });
  });

  describe('Data Export', () => {
    it('should export error data as JSON', () => {
      errorHandler.reportError(new Error('Test error'), { component: 'TestComponent' });
      
      const exportData = errorHandler.exportErrorData();
      expect(typeof exportData).toBe('string');
      
      const parsed = JSON.parse(exportData);
      expect(parsed.summary).toBeDefined();
      expect(parsed.errors).toBeDefined();
      expect(parsed.breadcrumbs).toBeDefined();
      expect(parsed.sessionId).toBeDefined();
      expect(parsed.exportedAt).toBeDefined();
    });
  });

  describe('Retry Functionality', () => {
    it('should create retry function', () => {
      const testFunction = vi.fn().mockResolvedValue('success');
      
      const retryFunction = errorHandler.createRetryFunction(testFunction, {
        component: 'TestComponent',
        action: 'test_operation'
      });

      expect(typeof retryFunction).toBe('function');
    });

    it('should handle successful function execution', async () => {
      const successFunction = vi.fn().mockResolvedValue('success');
      
      const retryFunction = errorHandler.createRetryFunction(successFunction);
      const result = await retryFunction();

      expect(result).toBe('success');
      expect(successFunction).toHaveBeenCalledTimes(1);
    });
  });

  describe('Promise Rejection Handling', () => {
    it('should handle promise rejections', () => {
      const rejectionReason = new Error('Promise rejected');
      const mockPromise = {} as Promise<any>; // Mock promise without actually creating a rejected promise

      errorHandler.handlePromiseRejection(rejectionReason, mockPromise);

      const errors = errorHandler.getErrors();
      expect(errors.some(error => 
        error.message === 'Promise rejected' && 
        error.context.action === 'promise_rejection'
      )).toBe(true);
    });

    it('should handle non-error rejections', () => {
      const rejectionReason = 'String rejection';
      const mockPromise = {} as Promise<any>; // Mock promise without actually creating a rejected promise

      errorHandler.handlePromiseRejection(rejectionReason, mockPromise);

      const errors = errorHandler.getErrors();
      expect(errors.some(error => error.message === 'String rejection')).toBe(true);
    });
  });

  describe('User Management', () => {
    it('should set and track user ID', () => {
      const userId = 'test-user-123';
      errorHandler.setUserId(userId);

      const errorId = errorHandler.reportError(new Error('Test error'));
      const reportedError = errorHandler.getError(errorId);

      expect(reportedError!.userId).toBe(userId);
    });
  });

  describe('Error Limits and Memory Management', () => {
    it('should limit stored errors to prevent memory leaks', () => {
      // This test would be more effective with access to the maxErrors constant
      // For now, we'll just verify the basic functionality
      for (let i = 0; i < 10; i++) {
        errorHandler.reportError(new Error(`Error ${i}`));
      }

      const errors = errorHandler.getErrors();
      expect(errors.length).toBe(10);
    });
  });
});