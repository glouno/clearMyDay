# Favicon Setup Guide

## Current Status
✅ Code updated to use `/favicon.png`
⏳ Need to save the image file

## Steps to Complete:

### 1. Save the Favicon Image
Save your uploaded logo image to:
```
public/favicon.png
```

### 2. (Optional) Create Optimized Sizes
For best results across all devices, you can create multiple sizes:

**Using ImageMagick (if installed):**
```bash
# Install ImageMagick (Mac):
brew install imagemagick

# Generate sizes from your image:
cd public
convert favicon.png -resize 16x16 favicon-16x16.png
convert favicon.png -resize 32x32 favicon-32x32.png
convert favicon.png -resize 180x180 apple-touch-icon.png
convert favicon.png -resize 192x192 android-chrome-192x192.png
```

**Using Online Tools:**
- https://realfavicongenerator.net/ (comprehensive)
- https://favicon.io/ (simple)

### 3. Test
After saving the image:
```bash
npm run build
npm start
```

Then check:
- Browser tab icon
- Bookmarks
- iOS "Add to Home Screen"
- Android "Add to Home Screen"

## What Works Without Multiple Sizes:
✅ Modern browsers will auto-scale the single PNG
✅ Chrome, Firefox, Safari, Edge all support PNG favicons
✅ Works on desktop and mobile

## Why Multiple Sizes Are Better:
- Crisper display at small sizes (16x16)
- Better performance (no scaling needed)
- Optimal for PWA/home screen icons

## Current Configuration:
```typescript
icons: {
  icon: [
    { url: '/favicon.png', sizes: 'any' },
  ],
  apple: [
    { url: '/favicon.png', sizes: '180x180', type: 'image/png' },
  ],
}
```

This tells browsers:
- Use `/favicon.png` for all standard favicons
- Use the same image for Apple touch icons (iOS)
- Browsers will scale as needed
