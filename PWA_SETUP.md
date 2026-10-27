# PWA (Progressive Web App) Setup Guide for GuidanceConnect

## What is PWA?

A Progressive Web App (PWA) is a web application that works like a native app on mobile and desktop devices. Users can:

- **Install** the app directly from the browser (like an app store)
- **Work offline** using service worker caching
- **Get push notifications** (future enhancement)
- **Access device features** like camera, contacts (future enhancement)

## What We've Added

### 1. **Service Worker** (`public/service-worker.js`)
   - Caches app shell for offline support
   - Network-first strategy: tries to load from internet, falls back to cache
   - Automatically updates when new versions are deployed

### 2. **PWA Install Script** (`public/pwa-install.js`)
   - Registers service worker
   - Detects browser's install capability
   - Provides `window.PWA` API for programmatic control
   - Handles update notifications

### 3. **Offline Page** (`public/offline.html`)
   - Beautiful fallback page when user is offline
   - Shows helpful tips and retry button

### 4. **Enhanced Manifest** (`public/manifest.json`)
   - Already configured with app name, icons, colors
   - Includes app shortcuts for quick access

### 5. **PWA Install Banner** (`views/partials/pwa-install-banner.xian`)
   - Attractive prompt encouraging users to install
   - One-click install button
   - Dismissible with cookie storage

## How to Use

### Step 1: Add Banner to Your Main Layouts

Add this line to your main layout files (before closing `</body>`):

```xian
{{> pwa-install-banner}}
```

Add to these files:
- `views/student/dashboard.xian`
- `views/student/apply.xian`
- `views/guidance/dashboard.xian`
- `views/cashier/dashboard.xian`
- Any other main pages

### Step 2: Test Locally

```bash
npm run dev
```

Open `http://localhost:3000` in your browser.

**Desktop (Chrome/Edge):**
1. Open DevTools (F12)
2. Go to Application → Manifest
3. Look for install button or check "Display as standalone"

**Mobile (Android Chrome):**
1. Look for install prompt at bottom of screen
2. Tap "Install" to add to home screen

### Step 3: Deploy to Vercel

Your PWA is already ready for Vercel. Just push your code:

```bash
git add .
git commit -m "Add PWA support for installable app"
git push origin main
```

## Using the PWA API

You can control PWA features programmatically:

```javascript
// Check if app is installed
if (window.PWA.isInstalled()) {
  console.log('App is running as standalone PWA');
}

// Check if install is available
if (window.PWA.isInstallable()) {
  console.log('Install button is available');
}

// Trigger install programmatically
window.PWA.install();

// Get PWA status
const status = window.PWA.getStatus();
console.log(status);
// {
//   installed: true/false,
//   installable: true/false,
//   promptHidden: true/false,
//   online: true/false,
//   userAgent: "..."
// }
```

## Installation on Different Platforms

### Android (Chrome)
1. Open app in Chrome
2. Tap ⋮ (three dots) menu
3. Select "Install app" or look for install banner
4. App appears on home screen

### iOS (Safari)
1. Open app in Safari
2. Tap Share button
3. Select "Add to Home Screen"
4. Name and tap "Add"

### Desktop (Windows/Mac)
**Chrome/Edge:**
1. Click install icon in address bar (or ⋮ menu)
2. Select "Install GuidanceConnect"
3. App opens in window without browser UI

**macOS Safari:**
1. File → Add to Dock
2. App available from dock

## What Works Offline

After user visits these pages, they're cached for offline access:

- Dashboard pages
- Student profile
- Announcements
- Any images/CSS/JS loaded

**Not cached (requires internet):**
- Form submissions
- Real-time updates
- API calls to Firestore

When offline, the service worker shows the `offline.html` page for uncached requests.

## Next Steps (Optional)

### 1. Push Notifications
Add real-time notifications to installed app:

```javascript
// Request permission
Notification.requestPermission();

// Send notification
new Notification('New Message', {
  body: 'You have a new appointment request',
  icon: '/uploads/minsulogo.png'
});
```

### 2. Background Sync
Sync data when connection is restored:

```javascript
// Register sync task
await registration.sync.register('sync-submissions');
```

### 3. Share API
Allow sharing app content:

```javascript
if (navigator.share) {
  navigator.share({
    title: 'GuidanceConnect',
    text: 'Check out this app',
    url: window.location.href
  });
}
```

## Browser Support

| Feature | Chrome | Firefox | Safari | Edge |
|---------|--------|---------|--------|------|
| PWA Install | ✅ | ✅ | ⚠️* | ✅ |
| Service Worker | ✅ | ✅ | ✅ | ✅ |
| Offline Mode | ✅ | ✅ | ✅ | ✅ |
| Manifest | ✅ | ✅ | ⚠️* | ✅ |

*iOS Safari requires manual "Add to Home Screen"

## Troubleshooting

### Install button not showing
1. Check browser console for errors
2. Verify HTTPS (required for production)
3. Make sure manifest.json is valid: `http://localhost:3000/manifest.json`
4. Service worker must be active: DevTools → Application → Service Workers

### Offline page not showing
1. Verify service worker is active
2. Check that service-worker.js is registered correctly
3. Try accessing a page, then go offline

### Cache not updating
1. Service worker caches persist
2. Ctrl+Shift+Delete to clear browser data
3. Or increment `CACHE_NAME` in service-worker.js

## Files Added/Modified

### New Files
```
public/
  ├── service-worker.js          (offline support)
  ├── pwa-install.js             (install detection)
  └── offline.html               (offline fallback)

views/
  └── partials/
      └── pwa-install-banner.xian (install prompt)
```

### Modified Files
```
views/
  └── partials/
      └── head.xian             (added PWA meta tags)
```

## Testing Checklist

- [ ] Install banner appears on desktop (Chrome/Edge)
- [ ] Install banner appears on mobile (Android Chrome)
- [ ] App can be installed
- [ ] App icon appears on home screen/taskbar
- [ ] App opens in standalone window (no browser UI)
- [ ] App works offline (try going offline in DevTools)
- [ ] Refreshing page shows latest content online
- [ ] Update notification appears when new version deployed
- [ ] Works on Vercel production URL

## Support & Resources

- [Web.dev PWA Guide](https://web.dev/pwa/)
- [MDN Service Workers](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)
- [Manifest Specification](https://www.w3.org/TR/appmanifest/)
- [Can I Use - PWA Support](https://caniuse.com/pwa)

---

**Questions?** Check the browser console (F12) for any errors or warnings related to PWA setup.
