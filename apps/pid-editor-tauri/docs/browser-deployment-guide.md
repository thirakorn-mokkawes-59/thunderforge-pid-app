# Browser-Only Deployment Guide for P&ID Editor

## Quick Deployment Options

### 1. **Vercel** (Recommended - Easiest)
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy (from project root)
vercel

# Follow prompts, get instant URL like:
# https://your-app.vercel.app
```

### 2. **Netlify**
```bash
# Build the app
npm run build

# Drag the 'dist' folder to netlify.com
# Get instant URL like:
# https://your-app.netlify.app
```

### 3. **GitHub Pages** (Free with GitHub)
```bash
# Add to package.json scripts:
"deploy": "npm run build && npx gh-pages -d dist"

# Deploy
npm run deploy

# Access at:
# https://[username].github.io/[repo-name]
```

### 4. **Local Network** (For team/office use)
```bash
# Build and serve locally
npm run build
npx serve dist -p 3000

# Team accesses via:
# http://[your-ip]:3000
```

### 5. **Docker** (For enterprise deployment)
```dockerfile
FROM node:18-alpine as builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
EXPOSE 80
```

## Making it a Progressive Web App (PWA)

Add to `vite.config.ts`:
```typescript
import { VitePWA } from 'vite-plugin-pwa'

export default {
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'P&ID Editor',
        short_name: 'PID Editor',
        theme_color: '#ffffff',
        icons: [
          {
            src: '/icon-192.png',
            sizes: '192x192',
            type: 'image/png'
          }
        ]
      }
    })
  ]
}
```

## File Handling in Browser

### Save Diagram
```javascript
function saveToFile() {
  const data = JSON.stringify(diagramData);
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'diagram.pid.json';
  a.click();
}
```

### Load Diagram
```javascript
function loadFromFile() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.onchange = (e) => {
    const file = e.target.files[0];
    const reader = new FileReader();
    reader.onload = (event) => {
      const data = JSON.parse(event.target.result);
      loadDiagram(data);
    };
    reader.readAsText(file);
  };
  input.click();
}
```

## Offline Support

Add service worker for offline functionality:
```javascript
// sw.js
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open('v1').then((cache) => {
      return cache.addAll([
        '/',
        '/index.html',
        '/assets/index.js',
        '/assets/index.css',
        // Add all symbol SVGs
      ]);
    })
  );
});
```

## Recommended Approach

For your use case (P&ID editor for team use):

1. **Deploy as web app** on Vercel/Netlify
2. **Make it a PWA** for offline use
3. **Add cloud storage** (optional) for diagram sharing
4. Users can "install" it from browser for app-like experience
5. No installation barriers for your team

This gives you 90% of desktop app benefits with 10% of the complexity!