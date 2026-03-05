# 🔧 Fix PWA Icon 404 Error

## Issue
```
Error while trying to use the following icon from the Manifest: 
http://localhost:3000/icons/icon-144x144.png (Download error or resource isn't a valid image)
```

## Root Cause
Browser/Service Worker cached the old manifest that referenced `/icons/icon-144x144.png`.  
The actual icon is at `/icon-144x144.svg` (no `/icons/` folder).

## ✅ Quick Fix (Choose One)

### Option 1: Hard Refresh (Recommended)
1. Press **Ctrl + Shift + R** (Windows) or **Cmd + Shift + R** (Mac)
2. This reloads the page and clears service worker cache

### Option 2: Clear Service Worker (If hard refresh doesn't work)
1. Open **DevTools** (F12)
2. Go to **Application** tab
3. Click **Service Workers** in left sidebar
4. Find "SCL Service Worker" or "sw.js"
5. Click **Unregister**
6. Reload the page (F5)
7. The new service worker (v2) will register

### Option 3: Clear All PWA Data (Nuclear option)
1. Open **DevTools** (F12)
2. Go to **Application** tab
3. Click **Clear storage** in left sidebar
4. Check all boxes
5. Click **Clear site data**
6. Reload the page

### Option 4: Incognito/Private Window
- Open the app in a new incognito/private window
- No cache = no icon error

## ✅ Verify Fix

After clearing cache, check:
1. **No 404 errors** in DevTools Console
2. **Service Worker version**: Should show "scl-pwa-v2" (not v1)
3. **Manifest loads correctly**: Application → Manifest shows `/icon-144x144.svg`

## 📝 What Was Fixed

1. **Service Worker** (`public/sw.js`):
   - Updated cache name: `scl-pwa-v1` → `scl-pwa-v2`
   - Fixed notification icons: `/icons/icon-192x192.png` → `/icon-144x144.svg`
   - Added icon to cache list

2. **Manifest** (`public/manifest.json`):
   - Already correct: `"src": "/icon-144x144.svg"`

## 🎨 Icon Files Available

Current files in `/public`:
- ✅ `icon-144x144.svg` - Main PWA icon (SVG, scalable)
- ❌ `/icons/icon-144x144.png` - Does NOT exist (this was causing the error)

## 🔮 Optional: Add PNG Icons

If you want PNG icons for better compatibility:

1. Create `/public/icons/` folder
2. Generate PNG icons from your logo:
   - `icon-72x72.png`
   - `icon-96x96.png`
   - `icon-128x128.png`
   - `icon-144x144.png`
   - `icon-152x152.png`
   - `icon-192x192.png`
   - `icon-384x384.png`
   - `icon-512x512.png`

3. Update `manifest.json`:
```json
"icons": [
  {
    "src": "/icon-144x144.svg",
    "sizes": "144x144",
    "type": "image/svg+xml",
    "purpose": "any maskable"
  },
  {
    "src": "/icons/icon-192x192.png",
    "sizes": "192x192",
    "type": "image/png"
  },
  {
    "src": "/icons/icon-512x512.png",
    "sizes": "512x512",
    "type": "image/png"
  }
]
```

Use tools like:
- [Favicon.io](https://favicon.io) - Auto-generate all sizes
- [PWA Builder](https://www.pwabuilder.com) - PWA icon generator
- [RealFaviconGenerator](https://realfavicongenerator.net)

---

The icon error is cosmetic and doesn't affect functionality. The attendance permission error is the critical issue - see `DEPLOY_FIRESTORE_RULES.md`.
