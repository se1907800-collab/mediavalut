# Media Vault Pro - Firebase Cloud Edition

A mobile-first media management system that uses Firebase for real-time sync across all your devices.

## ✨ Features

- ✅ **Real-time Sync**: Changes instantly appear on all your devices
- ✅ **Mobile-First Design**: Optimized for touch with mobile gestures
- ✅ **Google Drive Integration**: Organize your Drive videos and images
- ✅ **No Login Required**: Anonymous Firebase authentication
- ✅ **Batch Import**: Add multiple Google Drive links at once
- ✅ **Drag & Drop**: Easy media organization
- ✅ **Video Player**: Built-in Google Drive video player
- ✅ **Offline Support**: Works even without internet (syncs when back online)

## 🚀 Setup Instructions

### 1. Deploy to Web Server
1. Upload all 4 files to any web hosting (GitHub Pages, Netlify, Vercel, etc.)
2. That's it! The app is ready to use.

### 2. Using the App
1. Open the app in your browser
2. Enter access code: `1`
3. Start adding Google Drive links
4. Create folders and organize your media
5. Changes sync instantly to all your devices

### 3. Adding Media
- **Single Media**: Paste one Google Drive link
- **Batch Import**: Paste multiple links (one per line)
- **Supported formats**: Google Drive video and image links

## 📱 Mobile Features

- **Long-press**: Enter selection mode
- **Swipe left**: Go back to previous folder
- **Floating Action Button**: Quick access to common actions
- **Touch-optimized**: Larger buttons and touch targets
- **Selection checkboxes**: Visual feedback for selected items

## 🔄 Sync Status

- **✓ Connected**: Successfully connected to Firebase
- **🔄 Syncing**: Currently saving/loading data
- **⚠️ Error**: Connection issue (app works offline)
- **📴 Offline**: No internet (changes saved locally)

## 🛠️ Firebase Setup (Already Done!)

Firebase is already configured with:
- Anonymous authentication
- Firestore database
- Real-time sync
- Your specific project settings

## 💡 Tips

1. **Organize first**: Create folders before adding media
2. **Use batch import**: For adding multiple videos at once
3. **Long-press**: To select multiple items
4. **Check sync status**: Top bar shows connection status
5. **Works offline**: Add/remove items even without internet

## 🆘 Troubleshooting

**Q: Changes not syncing?**
A: Check your internet connection and sync status icon

**Q: Can't add Google Drive links?**
A: Make sure the link is shared as "Anyone with the link can view"

**Q: App looks small on mobile?**
A: Rotate to landscape for larger thumbnails

## 📞 Support

The app uses Firebase for storage. All your data is securely stored in Google's Firebase servers and syncs across all your devices automatically.
