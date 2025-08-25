/**
 * Cache busting utilities to ensure fresh code is loaded
 */

// Generate a unique session ID that changes on each reload
export const SESSION_ID = Date.now().toString(36) + Math.random().toString(36).substr(2);

// Clear any stale module cache
export function clearModuleCache() {
  if (typeof window !== 'undefined') {
    // Clear sessionStorage which might contain stale state
    try {
      sessionStorage.clear();
    } catch (e) {
      console.warn('Could not clear sessionStorage:', e);
    }
    
    // Force clear any service workers in development
    if ('serviceWorker' in navigator && window.location.hostname === 'localhost') {
      navigator.serviceWorker.getRegistrations().then(registrations => {
        registrations.forEach(registration => {
          registration.unregister();
          console.log('Unregistered service worker:', registration);
        });
      });
    }
    
    // Add cache-busting meta tag
    const meta = document.createElement('meta');
    meta.httpEquiv = 'Cache-Control';
    meta.content = 'no-cache, no-store, must-revalidate';
    document.head.appendChild(meta);
  }
}

// Force hard reload with cache bypass
export function forceHardReload() {
  if (typeof window !== 'undefined') {
    // Clear all caches and force reload
    if ('caches' in window) {
      caches.keys().then(names => {
        names.forEach(name => {
          caches.delete(name);
        });
      });
    }
    
    // Use location.reload with forceGet parameter
    window.location.reload();
  }
}