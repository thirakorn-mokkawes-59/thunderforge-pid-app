/**
 * Collaboration Service
 * 
 * Provides real-time collaborative editing capabilities for PID diagrams,
 * including operation transformation, conflict resolution, user awareness,
 * and synchronization across multiple clients.
 */

export interface CollaborativeUser {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  color: string; // Cursor and selection color
  lastSeen: number;
  isActive: boolean;
  cursor?: {
    x: number;
    y: number;
    elementId?: string;
  };
  selection?: {
    elementIds: string[];
    type: 'node' | 'connection' | 'mixed';
  };
}

export interface CollaborativeOperation {
  id: string;
  type: 'create' | 'update' | 'delete' | 'move' | 'connect' | 'disconnect';
  elementType: 'node' | 'connection' | 'property';
  elementId: string;
  userId: string;
  timestamp: number;
  data: any;
  metadata?: {
    parentId?: string;
    previousValue?: any;
    bounds?: { x: number; y: number; width: number; height: number };
  };
}

export interface TransformedOperation extends CollaborativeOperation {
  transformedBy: string[];
  priority: number;
  dependencies: string[];
}

export interface CollaborativeState {
  version: number;
  operations: CollaborativeOperation[];
  lastSyncTimestamp: number;
  pendingOperations: CollaborativeOperation[];
  acknowledgedOperations: string[];
  conflicts: ConflictResolution[];
}

export interface ConflictResolution {
  id: string;
  operationIds: string[];
  type: 'concurrent_edit' | 'move_conflict' | 'delete_conflict' | 'property_conflict';
  resolution: 'merge' | 'last_writer_wins' | 'manual' | 'rejected';
  resolvedBy?: string;
  resolvedAt?: number;
  data?: any;
}

export interface SyncMessage {
  type: 'operation' | 'state_sync' | 'user_update' | 'cursor_update' | 'presence' | 'conflict';
  data: any;
  timestamp: number;
  userId: string;
  sessionId: string;
}

export interface CollaborationSession {
  id: string;
  diagramId: string;
  name: string;
  createdBy: string;
  createdAt: number;
  users: CollaborativeUser[];
  permissions: {
    [userId: string]: {
      canEdit: boolean;
      canComment: boolean;
      canInvite: boolean;
      role: 'owner' | 'editor' | 'viewer' | 'reviewer';
    };
  };
  settings: {
    allowAnonymous: boolean;
    requireApproval: boolean;
    maxUsers: number;
    lockTimeout: number; // minutes
  };
}

export class CollaborationService {
  private static instance: CollaborationService;
  private currentSession: CollaborationSession | null = null;
  private currentUser: CollaborativeUser | null = null;
  private state: CollaborativeState;
  private websocket: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectTimeout: number | null = null;
  private heartbeatInterval: number | null = null;
  
  // Operation transformation
  private operationQueue: CollaborativeOperation[] = [];
  private acknowledgementCallbacks: Map<string, () => void> = new Map();
  
  // Event listeners
  private eventListeners: Map<string, ((data: any) => void)[]> = new Map();

  private constructor() {
    this.state = {
      version: 0,
      operations: [],
      lastSyncTimestamp: 0,
      pendingOperations: [],
      acknowledgedOperations: [],
      conflicts: []
    };
  }

  static getInstance(): CollaborationService {
    if (!CollaborationService.instance) {
      CollaborationService.instance = new CollaborationService();
    }
    return CollaborationService.instance;
  }

  /**
   * Create or join a collaboration session
   */
  async joinSession(
    sessionId: string,
    diagramId: string,
    user: Omit<CollaborativeUser, 'id' | 'isActive' | 'lastSeen'>
  ): Promise<CollaborationSession> {
    try {
      this.currentUser = {
        id: this.generateUserId(),
        isActive: true,
        lastSeen: Date.now(),
        ...user
      };

      // In a real implementation, this would connect to a collaboration server
      // For now, we'll simulate a session
      this.currentSession = {
        id: sessionId,
        diagramId,
        name: `Collaboration Session - ${diagramId}`,
        createdBy: this.currentUser.id,
        createdAt: Date.now(),
        users: [this.currentUser],
        permissions: {
          [this.currentUser.id]: {
            canEdit: true,
            canComment: true,
            canInvite: true,
            role: 'owner'
          }
        },
        settings: {
          allowAnonymous: false,
          requireApproval: false,
          maxUsers: 10,
          lockTimeout: 30
        }
      };

      await this.connectToCollaborationServer(sessionId);
      this.startHeartbeat();
      
      this.emit('session_joined', this.currentSession);
      return this.currentSession;

    } catch (error) {
      console.error('Failed to join collaboration session:', error);
      throw new Error('Failed to join collaboration session');
    }
  }

  /**
   * Leave the current collaboration session
   */
  async leaveSession(): Promise<void> {
    if (!this.currentSession || !this.currentUser) return;

    try {
      // Notify server of leaving
      await this.sendMessage({
        type: 'user_update',
        data: {
          action: 'leave',
          userId: this.currentUser.id
        },
        timestamp: Date.now(),
        userId: this.currentUser.id,
        sessionId: this.currentSession.id
      });

      this.cleanup();
      this.emit('session_left', { sessionId: this.currentSession.id });

    } catch (error) {
      console.error('Error leaving session:', error);
      this.cleanup();
    }
  }

  /**
   * Apply an operation locally and broadcast to other users
   */
  async applyOperation(operation: Omit<CollaborativeOperation, 'id' | 'userId' | 'timestamp'>): Promise<void> {
    if (!this.currentSession || !this.currentUser) {
      throw new Error('No active collaboration session');
    }

    const fullOperation: CollaborativeOperation = {
      id: this.generateOperationId(),
      userId: this.currentUser.id,
      timestamp: Date.now(),
      ...operation
    };

    // Add to pending operations
    this.state.pendingOperations.push(fullOperation);
    this.operationQueue.push(fullOperation);

    // Apply locally first (optimistic updates)
    this.emit('operation_applied', fullOperation);

    // Send to server
    try {
      await this.sendMessage({
        type: 'operation',
        data: fullOperation,
        timestamp: Date.now(),
        userId: this.currentUser.id,
        sessionId: this.currentSession.id
      });
    } catch (error) {
      console.error('Failed to send operation:', error);
      // Handle offline mode or retry logic here
    }
  }

  /**
   * Update user cursor position
   */
  async updateCursor(cursor: { x: number; y: number; elementId?: string }): Promise<void> {
    if (!this.currentSession || !this.currentUser) return;

    this.currentUser.cursor = cursor;
    this.currentUser.lastSeen = Date.now();

    await this.sendMessage({
      type: 'cursor_update',
      data: {
        userId: this.currentUser.id,
        cursor
      },
      timestamp: Date.now(),
      userId: this.currentUser.id,
      sessionId: this.currentSession.id
    });

    this.emit('cursor_updated', { userId: this.currentUser.id, cursor });
  }

  /**
   * Update user selection
   */
  async updateSelection(selection: { elementIds: string[]; type: 'node' | 'connection' | 'mixed' }): Promise<void> {
    if (!this.currentSession || !this.currentUser) return;

    this.currentUser.selection = selection;
    this.currentUser.lastSeen = Date.now();

    await this.sendMessage({
      type: 'presence',
      data: {
        userId: this.currentUser.id,
        selection,
        action: 'select'
      },
      timestamp: Date.now(),
      userId: this.currentUser.id,
      sessionId: this.currentSession.id
    });

    this.emit('selection_updated', { userId: this.currentUser.id, selection });
  }

  /**
   * Transform operations to resolve conflicts
   */
  private transformOperation(
    operation: CollaborativeOperation,
    againstOperations: CollaborativeOperation[]
  ): TransformedOperation {
    let transformed: TransformedOperation = {
      ...operation,
      transformedBy: [],
      priority: this.calculateOperationPriority(operation),
      dependencies: []
    };

    for (const otherOp of againstOperations) {
      if (this.operationsConflict(operation, otherOp)) {
        transformed = this.resolveConflict(transformed, otherOp);
        transformed.transformedBy.push(otherOp.id);
      }
    }

    return transformed;
  }

  /**
   * Check if two operations conflict
   */
  private operationsConflict(op1: CollaborativeOperation, op2: CollaborativeOperation): boolean {
    // Same element modifications
    if (op1.elementId === op2.elementId && op1.timestamp !== op2.timestamp) {
      return true;
    }

    // Move operations with overlapping bounds
    if (op1.type === 'move' && op2.type === 'move') {
      const bounds1 = op1.metadata?.bounds;
      const bounds2 = op2.metadata?.bounds;
      if (bounds1 && bounds2) {
        return this.boundsOverlap(bounds1, bounds2);
      }
    }

    // Delete vs modify conflicts
    if ((op1.type === 'delete' && op2.type === 'update') || 
        (op1.type === 'update' && op2.type === 'delete')) {
      return op1.elementId === op2.elementId;
    }

    return false;
  }

  /**
   * Resolve conflict between two operations
   */
  private resolveConflict(
    operation: TransformedOperation,
    conflictingOperation: CollaborativeOperation
  ): TransformedOperation {
    // Priority-based resolution
    const opPriority = this.calculateOperationPriority(operation);
    const conflictPriority = this.calculateOperationPriority(conflictingOperation);

    if (opPriority > conflictPriority) {
      // Current operation has higher priority, keep it
      return operation;
    } else if (opPriority < conflictPriority) {
      // Conflicting operation has higher priority, reject current
      return {
        ...operation,
        type: 'delete', // Transform to no-op
        data: null
      };
    } else {
      // Same priority, use timestamp (last writer wins)
      if (operation.timestamp > conflictingOperation.timestamp) {
        return operation;
      } else {
        // Merge operations if possible
        return this.mergeOperations(operation, conflictingOperation);
      }
    }
  }

  /**
   * Merge compatible operations
   */
  private mergeOperations(
    op1: TransformedOperation,
    op2: CollaborativeOperation
  ): TransformedOperation {
    if (op1.elementId !== op2.elementId || op1.type !== op2.type) {
      return op1; // Can't merge different elements or types
    }

    switch (op1.type) {
      case 'update':
        // Merge property updates
        const mergedData = {
          ...op1.data,
          ...op2.data
        };
        return {
          ...op1,
          data: mergedData,
          timestamp: Math.max(op1.timestamp, op2.timestamp)
        };

      case 'move':
        // Use the most recent position
        return op1.timestamp > op2.timestamp ? op1 : {
          ...op1,
          data: op2.data,
          timestamp: op2.timestamp
        };

      default:
        return op1;
    }
  }

  /**
   * Calculate operation priority
   */
  private calculateOperationPriority(operation: CollaborativeOperation): number {
    const typesPriority = {
      'delete': 100,
      'create': 90,
      'connect': 80,
      'disconnect': 70,
      'update': 60,
      'move': 50
    };

    return typesPriority[operation.type] || 0;
  }

  /**
   * Check if bounds overlap
   */
  private boundsOverlap(
    bounds1: { x: number; y: number; width: number; height: number },
    bounds2: { x: number; y: number; width: number; height: number }
  ): boolean {
    return !(
      bounds1.x + bounds1.width < bounds2.x ||
      bounds2.x + bounds2.width < bounds1.x ||
      bounds1.y + bounds1.height < bounds2.y ||
      bounds2.y + bounds2.height < bounds1.y
    );
  }

  /**
   * Connect to collaboration server (WebSocket)
   */
  private async connectToCollaborationServer(sessionId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        // In a real implementation, this would connect to an actual server
        // For demo purposes, we'll simulate the connection
        setTimeout(() => {
          this.websocket = {} as WebSocket; // Mock WebSocket
          this.setupMessageHandlers();
          resolve();
        }, 100);
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Setup WebSocket message handlers
   */
  private setupMessageHandlers(): void {
    // In a real implementation, this would set up actual WebSocket event handlers
    // For demo purposes, we'll simulate some basic functionality
  }

  /**
   * Send message to collaboration server
   */
  private async sendMessage(message: SyncMessage): Promise<void> {
    if (!this.websocket) {
      throw new Error('No connection to collaboration server');
    }

    // In a real implementation, this would send the message via WebSocket
    // For demo purposes, we'll simulate the sending
    console.log('Sending collaboration message:', message);
  }

  /**
   * Handle incoming messages from server
   */
  private handleIncomingMessage(message: SyncMessage): void {
    switch (message.type) {
      case 'operation':
        this.handleRemoteOperation(message.data);
        break;
      case 'cursor_update':
        this.handleCursorUpdate(message.data);
        break;
      case 'presence':
        this.handlePresenceUpdate(message.data);
        break;
      case 'user_update':
        this.handleUserUpdate(message.data);
        break;
      case 'conflict':
        this.handleConflictResolution(message.data);
        break;
      case 'state_sync':
        this.handleStateSync(message.data);
        break;
    }
  }

  /**
   * Handle remote operations from other users
   */
  private handleRemoteOperation(operation: CollaborativeOperation): void {
    if (!this.currentSession || !this.currentUser) return;

    // Transform operation against pending local operations
    const transformed = this.transformOperation(operation, this.state.pendingOperations);

    // Add to operations history
    this.state.operations.push(transformed);
    this.state.version++;

    // Apply the transformed operation
    this.emit('remote_operation_applied', transformed);

    // Check for conflicts
    if (transformed.transformedBy.length > 0) {
      this.handleOperationConflict(transformed);
    }
  }

  /**
   * Handle cursor updates from other users
   */
  private handleCursorUpdate(data: { userId: string; cursor: any }): void {
    if (!this.currentSession) return;

    const user = this.currentSession.users.find(u => u.id === data.userId);
    if (user) {
      user.cursor = data.cursor;
      user.lastSeen = Date.now();
      this.emit('user_cursor_updated', { userId: data.userId, cursor: data.cursor });
    }
  }

  /**
   * Handle presence updates (selection, etc.)
   */
  private handlePresenceUpdate(data: { userId: string; selection?: any; action: string }): void {
    if (!this.currentSession) return;

    const user = this.currentSession.users.find(u => u.id === data.userId);
    if (user) {
      if (data.selection) {
        user.selection = data.selection;
      }
      user.lastSeen = Date.now();
      this.emit('user_presence_updated', data);
    }
  }

  /**
   * Handle user join/leave updates
   */
  private handleUserUpdate(data: { action: string; user?: CollaborativeUser; userId?: string }): void {
    if (!this.currentSession) return;

    switch (data.action) {
      case 'join':
        if (data.user) {
          this.currentSession.users.push(data.user);
          this.emit('user_joined', data.user);
        }
        break;
      case 'leave':
        if (data.userId) {
          this.currentSession.users = this.currentSession.users.filter(u => u.id !== data.userId);
          this.emit('user_left', { userId: data.userId });
        }
        break;
    }
  }

  /**
   * Handle operation conflicts
   */
  private handleOperationConflict(operation: TransformedOperation): void {
    const conflict: ConflictResolution = {
      id: this.generateConflictId(),
      operationIds: [operation.id, ...operation.transformedBy],
      type: this.determineConflictType(operation),
      resolution: 'merge', // Default resolution strategy
      data: { operation, transformations: operation.transformedBy }
    };

    this.state.conflicts.push(conflict);
    this.emit('conflict_detected', conflict);
  }

  /**
   * Determine conflict type
   */
  private determineConflictType(operation: TransformedOperation): ConflictResolution['type'] {
    if (operation.type === 'move') return 'move_conflict';
    if (operation.type === 'delete') return 'delete_conflict';
    if (operation.type === 'update') return 'property_conflict';
    return 'concurrent_edit';
  }

  /**
   * Handle state synchronization
   */
  private handleStateSync(data: { state: CollaborativeState }): void {
    this.state = data.state;
    this.emit('state_synchronized', data.state);
  }

  /**
   * Handle conflict resolution
   */
  private handleConflictResolution(data: ConflictResolution): void {
    const conflictIndex = this.state.conflicts.findIndex(c => c.id === data.id);
    if (conflictIndex !== -1) {
      this.state.conflicts[conflictIndex] = data;
      this.emit('conflict_resolved', data);
    }
  }

  /**
   * Start heartbeat to maintain connection
   */
  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      if (this.currentSession && this.currentUser) {
        this.sendMessage({
          type: 'presence',
          data: { userId: this.currentUser.id, action: 'heartbeat' },
          timestamp: Date.now(),
          userId: this.currentUser.id,
          sessionId: this.currentSession.id
        }).catch(() => {
          // Handle connection issues
          this.handleConnectionLoss();
        });
      }
    }, 30000); // 30 second heartbeat
  }

  /**
   * Handle connection loss and attempt reconnection
   */
  private handleConnectionLoss(): void {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = Math.pow(2, this.reconnectAttempts) * 1000; // Exponential backoff
      
      this.reconnectTimeout = setTimeout(async () => {
        if (this.currentSession) {
          try {
            await this.connectToCollaborationServer(this.currentSession.id);
            this.reconnectAttempts = 0;
            this.emit('connection_restored', {});
          } catch (error) {
            this.handleConnectionLoss(); // Try again
          }
        }
      }, delay);
    } else {
      this.emit('connection_failed', { attempts: this.reconnectAttempts });
    }
  }

  /**
   * Cleanup resources
   */
  private cleanup(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.websocket) {
      this.websocket = null;
    }

    this.currentSession = null;
    this.currentUser = null;
    this.reconnectAttempts = 0;
    this.operationQueue = [];
    this.acknowledgementCallbacks.clear();
  }

  /**
   * Event system for collaboration events
   */
  on(event: string, callback: (data: any) => void): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)!.push(callback);
  }

  off(event: string, callback: (data: any) => void): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      const index = listeners.indexOf(callback);
      if (index !== -1) {
        listeners.splice(index, 1);
      }
    }
  }

  private emit(event: string, data: any): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(callback => callback(data));
    }
  }

  /**
   * Utility methods for ID generation
   */
  private generateUserId(): string {
    return `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateOperationId(): string {
    return `op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateConflictId(): string {
    return `conflict_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get current session information
   */
  getCurrentSession(): CollaborationSession | null {
    return this.currentSession;
  }

  /**
   * Get current user information
   */
  getCurrentUser(): CollaborativeUser | null {
    return this.currentUser;
  }

  /**
   * Get current collaboration state
   */
  getCollaborationState(): CollaborativeState {
    return { ...this.state };
  }

  /**
   * Get active users in session
   */
  getActiveUsers(): CollaborativeUser[] {
    if (!this.currentSession) return [];
    
    const now = Date.now();
    return this.currentSession.users.filter(user => 
      user.isActive && (now - user.lastSeen) < 300000 // Active within 5 minutes
    );
  }

  /**
   * Export collaboration history
   */
  exportCollaborationHistory(): string {
    return JSON.stringify({
      session: this.currentSession,
      state: this.state,
      exportedAt: new Date().toISOString(),
      exportedBy: this.currentUser?.id
    }, null, 2);
  }
}