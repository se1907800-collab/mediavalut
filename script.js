// Media Vault Pro - Firebase Cloud Edition
class MediaVaultCloud {
    constructor() {
        this.currentFolder = 'root';
        this.selectedItems = [];
        this.folderStructure = {};
        this.mediaData = {};
        this.selectionMode = false;
        this.dragging = false;
        this.currentVideo = null;
        this.longPressTimer = null;
        this.syncing = false;
        this.isOnline = navigator.onLine;
        
        // Firebase instance
        this.db = null;
        this.userId = null;
        this.unsubscribe = null;
        
        // Initialize Firebase
        this.initializeFirebase();
        
        // Only initialize if we're logged in
        const isLoggedIn = localStorage.getItem('mv_isLoggedIn') === 'true';
        if (isLoggedIn && document.getElementById('gallery-section').style.display !== 'none') {
            this.initializeApp();
        }
    }

    async initializeFirebase() {
        try {
            // Initialize Firebase with config from index.html
            firebase.initializeApp(firebaseConfig);
            
            // Initialize Firestore
            this.db = firebase.firestore();
            
            // Listen for auth state changes
            firebase.auth().onAuthStateChanged(async (user) => {
                if (user) {
                    this.userId = user.uid;
                    this.updateSyncStatus('connected', 'Connected to Firebase');
                    console.log('Firebase user:', user.uid);
                    
                    // Load data if logged in
                    const isLoggedIn = localStorage.getItem('mv_isLoggedIn') === 'true';
                    if (isLoggedIn && !window.mediaVaultInitialized) {
                        await this.loadDataFromFirebase();
                        this.startRealtimeUpdates();
                        if (window.mediaVaultInitialized) {
                            this.buildFolderUI(this.currentFolder);
                        }
                    }
                } else {
                    // Sign in anonymously
                    await this.signInAnonymously();
                }
            });
            
        } catch (error) {
            console.error('Firebase initialization error:', error);
            this.updateSyncStatus('error', 'Firebase connection failed');
        }
    }

    async signInAnonymously() {
        try {
            const result = await firebase.auth().signInAnonymously();
            this.userId = result.user.uid;
            this.updateSyncStatus('connected', 'Connected anonymously');
        } catch (error) {
            console.error('Anonymous sign-in failed:', error);
            this.updateSyncStatus('error', 'Sign-in failed');
        }
    }

    async initializeApp() {
        // Wait for Firebase to be ready
        if (!this.userId) {
            setTimeout(() => this.initializeApp(), 500);
            return;
        }
        
        await this.loadDataFromFirebase();
        this.startRealtimeUpdates();
        this.setupEventListeners();
        this.setupSelectionSystem();
        this.setupDragAndDrop();
        this.setupMobileGestures();
        this.buildFolderUI('root');
        this.setupNetworkListener();
    }

    // FIREBASE DATA MANAGEMENT
    async loadDataFromFirebase() {
        try {
            if (!this.userId || !this.db) {
                console.log('Firebase not ready yet');
                return;
            }
            
            this.updateSyncStatus('syncing', 'Loading data...');
            
            const docRef = this.db.collection('mediaVault').doc(this.userId);
            const doc = await docRef.get();
            
            if (doc.exists) {
                const data = doc.data();
                this.folderStructure = data.folderStructure || this.getDefaultFolderStructure();
                this.mediaData = data.mediaData || this.getDefaultMediaData();
                this.updateSyncStatus('synced', 'Data loaded from cloud');
                console.log('Data loaded from Firebase');
            } else {
                // First time user - create default structure
                this.folderStructure = this.getDefaultFolderStructure();
                this.mediaData = this.getDefaultMediaData();
                await this.saveDataToFirebase();
                this.updateSyncStatus('synced', 'New vault created');
                console.log('Created new vault in Firebase');
            }
            
        } catch (error) {
            console.error('Error loading from Firebase:', error);
            this.updateSyncStatus('error', 'Failed to load data');
            // Fallback to local storage backup
            this.loadFromLocalBackup();
        }
    }

    async saveDataToFirebase() {
        if (!this.userId || !this.db) {
            console.log('Firebase not ready, saving to local backup');
            this.saveToLocalBackup();
            return false;
        }
        
        try {
            this.syncing = true;
            this.updateSyncStatus('syncing', 'Saving changes...');
            
            const data = {
                folderStructure: this.folderStructure,
                mediaData: this.mediaData,
                lastUpdated: new Date().toISOString(),
                userId: this.userId,
                version: '1.0'
            };
            
            const docRef = this.db.collection('mediaVault').doc(this.userId);
            await docRef.set(data, { merge: true });
            
            // Also save to local backup
            this.saveToLocalBackup();
            
            this.syncing = false;
            this.updateSyncStatus('synced', 'Changes saved to cloud');
            console.log('Data saved to Firebase');
            return true;
            
        } catch (error) {
            console.error('Error saving to Firebase:', error);
            this.syncing = false;
            this.updateSyncStatus('error', 'Failed to save changes');
            
            // Save to local backup as fallback
            this.saveToLocalBackup();
            return false;
        }
    }

    startRealtimeUpdates() {
        if (!this.userId || !this.db) return;
        
        try {
            const docRef = this.db.collection('mediaVault').doc(this.userId);
            
            this.unsubscribe = docRef.onSnapshot((doc) => {
                if (doc.exists) {
                    const data = doc.data();
                    const remoteTimestamp = data.lastUpdated || '';
                    const localTimestamp = this.getLocalTimestamp();
                    
                    // Don't update if we just saved (to avoid feedback loop)
                    if (remoteTimestamp !== localTimestamp && !this.syncing) {
                        console.log('Receiving update from another device');
                        this.folderStructure = data.folderStructure || this.getDefaultFolderStructure();
                        this.mediaData = data.mediaData || this.getDefaultMediaData();
                        this.buildFolderUI(this.currentFolder);
                        this.updateSyncStatus('synced', 'Synced with other devices');
                        this.showMessage('Changes updated from another device!');
                    }
                }
            }, (error) => {
                console.error('Realtime update error:', error);
                this.updateSyncStatus('error', 'Realtime sync interrupted');
            });
            
        } catch (error) {
            console.error('Failed to start realtime updates:', error);
        }
    }

    // LOCAL BACKUP (fallback when offline)
    saveToLocalBackup() {
        const data = {
            folderStructure: this.folderStructure,
            mediaData: this.mediaData,
            lastUpdated: new Date().toISOString()
        };
        localStorage.setItem('mv_local_backup', JSON.stringify(data));
    }

    loadFromLocalBackup() {
        const backup = localStorage.getItem('mv_local_backup');
        if (backup) {
            try {
                const data = JSON.parse(backup);
                this.folderStructure = data.folderStructure || this.getDefaultFolderStructure();
                this.mediaData = data.mediaData || this.getDefaultMediaData();
                this.updateSyncStatus('offline', 'Using local backup (offline)');
                console.log('Loaded from local backup');
            } catch (error) {
                console.error('Error loading from backup:', error);
            }
        }
    }

    getLocalTimestamp() {
        const backup = localStorage.getItem('mv_local_backup');
        if (backup) {
            try {
                const data = JSON.parse(backup);
                return data.lastUpdated || '';
            } catch (error) {
                return '';
            }
        }
        return '';
    }

    // SYNC STATUS MANAGEMENT
    updateSyncStatus(status, message) {
        const syncBar = document.getElementById('sync-status-bar');
        const syncIcon = document.getElementById('sync-icon');
        const syncText = document.getElementById('sync-text');
        
        if (!syncBar) return;
        
        syncBar.className = 'sync-status-bar ' + status;
        
        const icons = {
            syncing: '🔄',
            synced: '✓',
            error: '⚠️',
            offline: '📴',
            connected: '☁️'
        };
        
        syncIcon.textContent = icons[status] || '☁️';
        syncText.textContent = message;
    }

    setupNetworkListener() {
        window.addEventListener('online', () => {
            this.isOnline = true;
            this.updateSyncStatus('syncing', 'Reconnecting...');
            setTimeout(() => {
                this.saveDataToFirebase();
            }, 1000);
        });
        
        window.addEventListener('offline', () => {
            this.isOnline = false;
            this.updateSyncStatus('offline', 'Offline - changes saved locally');
        });
    }

    // DATA MANAGEMENT
    getDefaultFolderStructure() {
        return {
            'root': { 
                name: 'Home', 
                children: [], 
                parent: null 
            }
        };
    }

    getDefaultMediaData() {
        return {};
    }

    // UTILITY METHODS
    sanitizeId(name) {
        return name.toLowerCase().replace(/[^a-z0-9]/g, '-');
    }

    capitalizeFirst(string) {
        return string.charAt(0).toUpperCase() + string.slice(1);
    }

    extractFileId(url) {
        const patterns = [
            /\/file\/d\/([^\/]+)/,
            /id=([^&]+)/,
            /\/d\/([^\/]+)/,
            /\/view\?usp=sharing/
        ];
        
        // If it's already just an ID (no URL structure)
        if (url.length === 33 && !url.includes('/') && !url.includes('=')) {
            return url;
        }
        
        for (const pattern of patterns) {
            const match = url.match(pattern);
            if (match && match[1]) {
                return match[1];
            }
        }
        
        // Try to extract from Google Drive share URL
        if (url.includes('drive.google.com')) {
            try {
                const tempUrl = new URL(url);
                const id = tempUrl.searchParams.get('id');
                if (id) return id;
            } catch (e) {
                // Invalid URL
            }
        }
        
        return null;
    }

    showMessage(text, type = 'success') {
        const message = document.createElement('div');
        message.className = `status-message`;
        message.style.background = type === 'error' ? 'var(--danger)' : 
                                 type === 'warning' ? 'var(--warning)' : 'var(--success)';
        message.textContent = text;
        document.body.appendChild(message);
        
        setTimeout(() => {
            if (message.parentNode) {
                message.parentNode.removeChild(message);
            }
        }, 3000);
    }

    // SELECTION SYSTEM
    setupSelectionSystem() {
        document.addEventListener('mousedown', (e) => this.handleMouseDown(e));
        document.addEventListener('mouseup', () => this.handleMouseUp());
        document.addEventListener('mousemove', () => this.handleMouseMove());
        
        document.addEventListener('touchstart', (e) => this.handleTouchStart(e));
        document.addEventListener('touchend', () => this.handleTouchEnd());
        document.addEventListener('touchmove', () => this.handleTouchMove());
        
        document.addEventListener('click', (e) => this.handleClick(e));
    }

    handleMouseDown(e) {
        const item = e.target.closest('.folder-item, .media-item');
        if (item && !this.selectionMode) {
            this.longPressTimer = setTimeout(() => {
                this.enterSelectionMode(item);
            }, 500);
        }
    }

    handleMouseUp() {
        this.clearLongPressTimer();
    }

    handleMouseMove() {
        this.clearLongPressTimer();
    }

    handleTouchStart(e) {
        const item = e.target.closest('.folder-item, .media-item');
        if (item && !this.selectionMode) {
            this.longPressTimer = setTimeout(() => {
                this.enterSelectionMode(item);
            }, 500);
        }
    }

    handleTouchEnd() {
        this.clearLongPressTimer();
    }

    handleTouchMove() {
        this.clearLongPressTimer();
    }

    handleClick(e) {
        if (this.selectionMode) {
            const item = e.target.closest('.folder-item, .media-item');
            if (item && !e.target.closest('.folder-option-btn')) {
                this.toggleItemSelection(item);
                e.preventDefault();
                e.stopPropagation();
            }
        }
    }

    clearLongPressTimer() {
        if (this.longPressTimer) {
            clearTimeout(this.longPressTimer);
            this.longPressTimer = null;
        }
    }

    enterSelectionMode(initialItem) {
        this.selectionMode = true;
        document.body.classList.add('selection-mode');
        this.toggleItemSelection(initialItem);
        
        // Hide mobile FAB when in selection mode
        const fab = document.getElementById('mobile-fab');
        if (fab) fab.style.display = 'none';
    }

    toggleItemSelection(item) {
        const itemId = item.getAttribute('data-media-id') || item.getAttribute('data-folder-id');
        const itemType = item.getAttribute('data-type');
        const folderId = item.getAttribute('data-folder-id') || this.currentFolder;

        if (item.classList.contains('selected')) {
            item.classList.remove('selected');
            this.selectedItems = this.selectedItems.filter(selected => selected.id !== itemId);
        } else {
            item.classList.add('selected');
            this.selectedItems.push({
                id: itemId,
                type: itemType,
                folderId: folderId
            });
        }

        this.updateSelectionToolbar();
    }

    updateSelectionToolbar() {
        const toolbar = document.getElementById('org-toolbar');
        if (!toolbar) return;
        
        if (this.selectedItems.length > 0) {
            toolbar.style.display = 'flex';
        } else {
            toolbar.style.display = 'none';
            this.selectionMode = false;
            document.body.classList.remove('selection-mode');
            
            // Show mobile FAB again
            const fab = document.getElementById('mobile-fab');
            if (fab) fab.style.display = 'block';
        }
    }

    cancelSelection() {
        this.selectedItems = [];
        this.selectionMode = false;
        document.querySelectorAll('.selected').forEach(item => {
            item.classList.remove('selected');
        });
        document.getElementById('org-toolbar').style.display = 'none';
        document.body.classList.remove('selection-mode');
        
        // Show mobile FAB
        const fab = document.getElementById('mobile-fab');
        if (fab) fab.style.display = 'block';
    }

    // DRAG & DROP
    setupDragAndDrop() {
        document.addEventListener('dragstart', (e) => {
            const item = e.target.closest('.folder-item, .media-item');
            if (item && this.selectedItems.length > 0) {
                this.dragging = true;
                e.dataTransfer.effectAllowed = 'move';
            }
        });

        document.addEventListener('dragover', (e) => {
            if (this.dragging) {
                e.preventDefault();
                const dropTarget = e.target.closest('.folder-item, .breadcrumb-item');
                
                document.querySelectorAll('.drop-zone').forEach(zone => {
                    zone.classList.remove('drop-zone', 'active');
                });
                
                if (dropTarget) {
                    dropTarget.classList.add('drop-zone', 'active');
                }
            }
        });

        document.addEventListener('drop', (e) => {
            e.preventDefault();
            if (!this.dragging) return;
            
            const dropTarget = e.target.closest('.folder-item, .breadcrumb-item');
            let targetFolderId = null;
            
            if (dropTarget) {
                if (dropTarget.classList.contains('folder-item')) {
                    targetFolderId = dropTarget.getAttribute('data-folder-id');
                } else if (dropTarget.classList.contains('breadcrumb-item')) {
                    targetFolderId = dropTarget.getAttribute('data-folder');
                }
                
                if (targetFolderId && targetFolderId !== this.currentFolder) {
                    this.moveSelectedItemsToFolder(targetFolderId);
                }
            }
            
            this.cleanupDrag();
        });

        document.addEventListener('dragend', () => {
            this.cleanupDrag();
        });
    }

    cleanupDrag() {
        document.querySelectorAll('.drop-zone').forEach(zone => {
            zone.classList.remove('drop-zone', 'active');
        });
        this.dragging = false;
    }

    async moveSelectedItemsToFolder(targetFolderId) {
        if (!targetFolderId || this.selectedItems.length === 0) return;

        this.selectedItems.forEach(item => {
            if (item.type === 'media') {
                const sourceFolder = item.folderId;
                const mediaArray = this.mediaData[sourceFolder] || [];
                const mediaIndex = mediaArray.findIndex(m => m.id === item.id);
                
                if (mediaIndex > -1) {
                    const [mediaItem] = mediaArray.splice(mediaIndex, 1);
                    if (!this.mediaData[targetFolderId]) {
                        this.mediaData[targetFolderId] = [];
                    }
                    this.mediaData[targetFolderId].push(mediaItem);
                }
            } else if (item.type === 'folder') {
                const folder = this.folderStructure[item.id];
                if (folder && folder.parent !== targetFolderId) {
                    const currentParent = this.folderStructure[folder.parent];
                    if (currentParent && currentParent.children) {
                        currentParent.children = currentParent.children.filter(id => id !== item.id);
                    }
                    
                    folder.parent = targetFolderId;
                    if (!this.folderStructure[targetFolderId].children) {
                        this.folderStructure[targetFolderId].children = [];
                    }
                    this.folderStructure[targetFolderId].children.push(item.id);
                }
            }
        });

        await this.saveDataToFirebase();
        this.buildFolderUI(this.currentFolder);
        this.cancelSelection();
        this.showMessage(`Moved ${this.selectedItems.length} items successfully!`);
    }

    // MOBILE GESTURES
    setupMobileGestures() {
        if (window.innerWidth <= 768) {
            this.setupMobileNavigation();
            this.setupMobileFAB();
        }
    }

    setupMobileNavigation() {
        const backBtn = document.getElementById('back-btn');
        if (backBtn) {
            backBtn.addEventListener('click', () => {
                const current = this.folderStructure[this.currentFolder];
                if (current && current.parent) {
                    this.navigateToFolder(current.parent);
                }
            });
        }
    }

    setupMobileFAB() {
        const fab = document.getElementById('mobile-fab');
        const fabMain = fab.querySelector('.fab-main');
        const fabMenu = fab.querySelector('.fab-menu');
        
        fabMain.addEventListener('click', () => {
            fabMain.classList.toggle('active');
            fabMenu.style.display = fabMenu.style.display === 'flex' ? 'none' : 'flex';
        });
        
        fabMenu.addEventListener('click', (e) => {
            const button = e.target.closest('button');
            if (button) {
                const action = button.getAttribute('data-action');
                fabMain.classList.remove('active');
                fabMenu.style.display = 'none';
                
                if (action === 'create-folder') {
                    this.showCreateFolderModal();
                } else if (action === 'add-link') {
                    this.showAddMediaModal();
                } else if (action === 'select-mode') {
                    // Just enable selection mode
                    this.selectionMode = true;
                    document.body.classList.add('selection-mode');
                    fab.style.display = 'none';
                }
            }
        });
        
        // Close FAB menu when clicking outside
        document.addEventListener('click', (e) => {
            if (!fab.contains(e.target)) {
                fabMain.classList.remove('active');
                fabMenu.style.display = 'none';
            }
        });
    }

    // VIDEO PLAYER
    playVideo(media) {
        const videoPlayer = document.getElementById('video-player');
        const videoTitle = document.getElementById('video-player-title');
        
        const videoUrl = `https://drive.google.com/file/d/${media.id}/preview`;
        
        videoPlayer.src = videoUrl;
        videoTitle.textContent = media.title || 'Video Player';
        
        document.getElementById('video-player-modal').classList.add('active');
        this.currentVideo = media;
    }

    hideVideoPlayer() {
        const videoPlayer = document.getElementById('video-player');
        videoPlayer.src = '';
        document.getElementById('video-player-modal').classList.remove('active');
        this.currentVideo = null;
    }

    // UI BUILDING
    buildFolderUI(folderId) {
        if (!this.folderStructure[folderId]) {
            folderId = 'root';
        }
        
        this.currentFolder = folderId;
        const folder = this.folderStructure[folderId];
        const contentDiv = document.getElementById('current-folder-content');
        
        this.updateBreadcrumb(folderId);
        contentDiv.innerHTML = this.createFolderUI(folder, folderId);
        this.setupFolderEventListeners();
    }

    createFolderUI(folder, folderId) {
        return `
            <div class="folder-header">
                <h2>${folder.name}</h2>
                <div class="header-actions">
                    <button class="add-btn" id="add-btn">+</button>
                    <div class="add-menu" id="add-menu">
                        <button data-action="create-folder">
                            <span>📁</span>
                            Create Folder
                        </button>
                        <button data-action="add-link">
                            <span>➕</span>
                            Add Media
                        </button>
                    </div>
                </div>
            </div>
            
            <div class="folders-grid" id="folders-container">
                ${this.createFoldersGrid(folder)}
            </div>
            
            <div class="media-grid" id="media-container">
                ${this.createMediaGrid(folderId)}
            </div>
        `;
    }

    createFoldersGrid(folder) {
        if (!folder.children || folder.children.length === 0) {
            return `
                <div class="empty-state">
                    <div class="empty-state-icon">📁</div>
                    <p>No folders yet</p>
                    <p class="empty-state-hint">Tap the + button to create your first folder</p>
                </div>
            `;
        }

        return folder.children.map(childId => {
            const childFolder = this.folderStructure[childId];
            if (!childFolder) return '';
            
            const isCsvFolder = childFolder.source === 'csv';
            
            return `
                <div class="folder-item" data-folder-id="${childId}" data-type="folder" draggable="true">
                    <div class="folder-icon">📁</div>
                    <div class="folder-name">${childFolder.name}</div>
                    ${isCsvFolder ? '<div class="csv-folder-badge">CSV</div>' : ''}
                    <div class="folder-options">
                        <button class="folder-option-btn" data-action="rename">✏️</button>
                        <button class="folder-option-btn" data-action="delete">🗑️</button>
                    </div>
                </div>
            `;
        }).join('');
    }

    createMediaGrid(folderId) {
        const mediaItems = this.mediaData[folderId] || [];
        
        if (mediaItems.length === 0) {
            return `
                <div class="empty-state">
                    <div class="empty-state-icon">🖼️</div>
                    <p>No media yet</p>
                    <p class="empty-state-hint">Add media using the + button</p>
                </div>
            `;
        }

        return mediaItems.map(item => `
            <div class="media-item" data-media-id="${item.id}" data-folder-id="${folderId}" data-type="media" draggable="true">
                <img src="https://drive.google.com/thumbnail?id=${item.id}&sz=w400" 
                     alt="${item.title}" 
                     class="media-thumb ${item.type === 'video' ? 'video-thumb' : ''}"
                     loading="lazy"
                     onerror="this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjMzMwMzNmIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxOCIgZmlsbD0iIzk5YTFjNCIgZG9taW5hbnQtYmFzZWxpbmU9Im1pZGRsZSIgdGV4dC1hbmNob3I9Im1pZGRsZSI+TWVkaWEgTm90IEZvdW5kPC90ZXh0Pjwvc3ZnPg=='">
                <div class="media-title">${item.title || 'Untitled'}</div>
                ${item.type === 'video' ? '<div class="video-badge">VIDEO</div>' : ''}
            </div>
        `).join('');
    }

    updateBreadcrumb(folderId) {
        const breadcrumbItems = document.getElementById('breadcrumb-items');
        const backBtn = document.getElementById('back-btn');
        const path = this.getFolderPath(folderId);
        
        if (window.innerWidth <= 768) {
            // Mobile: show back button and current folder only
            backBtn.style.display = folderId === 'root' ? 'none' : 'flex';
            breadcrumbItems.innerHTML = `
                <div class="breadcrumb-item active" data-folder="${folderId}">
                    <span>${folderId === 'root' ? '🏠' : '📁'}</span>
                    ${this.folderStructure[folderId].name}
                </div>
            `;
        } else {
            // Desktop: show full breadcrumb
            backBtn.style.display = 'none';
            breadcrumbItems.innerHTML = path.map((item, index) => `
                <div class="breadcrumb-item ${index === path.length - 1 ? 'active' : ''}" 
                     data-folder="${item.id}">
                    <span>${index === 0 ? '🏠' : '📁'}</span>
                    ${item.name}
                </div>
            `).join('');
        }
    }

    getFolderPath(folderId) {
        const path = [];
        let current = folderId;
        
        while (current && this.folderStructure[current]) {
            path.unshift({
                id: current,
                name: this.folderStructure[current].name
            });
            current = this.folderStructure[current].parent;
        }
        
        return path;
    }

    // EVENT LISTENERS
    setupEventListeners() {
        // Logout
        document.getElementById('logout-btn').addEventListener('click', () => this.logout());
        
        // Refresh
        document.getElementById('refresh-btn').addEventListener('click', () => this.refreshFromCloud());
        
        // Settings
        document.getElementById('settings-btn').addEventListener('click', () => this.showSettingsModal());

        // Breadcrumb navigation
        document.getElementById('breadcrumb-items').addEventListener('click', (e) => {
            const breadcrumbItem = e.target.closest('.breadcrumb-item');
            if (breadcrumbItem) {
                const folderId = breadcrumbItem.getAttribute('data-folder');
                this.navigateToFolder(folderId);
            }
        });

        // Modal events
        this.setupModalEvents();
        
        // Organization toolbar
        this.setupToolbarEvents();
        
        // Mobile tabs
        this.setupMobileTabs();

        // Click outside to close menus
        document.addEventListener('click', (e) => {
            const addMenu = document.getElementById('add-menu');
            if (addMenu && !e.target.closest('#add-btn') && !e.target.closest('#add-menu')) {
                addMenu.style.display = 'none';
            }
            
            if (e.target.classList.contains('modal')) {
                this.hideAllModals();
            }
        });
    }

    setupFolderEventListeners() {
        // Add button
        const addBtn = document.getElementById('add-btn');
        const addMenu = document.getElementById('add-menu');
        
        if (addBtn && addMenu) {
            addBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                addMenu.style.display = addMenu.style.display === 'block' ? 'none' : 'block';
            });

            addMenu.addEventListener('click', (e) => {
                const button = e.target.closest('button');
                if (button) {
                    const action = button.getAttribute('data-action');
                    if (action === 'create-folder') {
                        this.showCreateFolderModal();
                    } else if (action === 'add-link') {
                        this.showAddMediaModal();
                    }
                    addMenu.style.display = 'none';
                }
            });
        }

        // Folder navigation (only when not in selection mode)
        document.getElementById('folders-container')?.addEventListener('click', (e) => {
            if (this.selectionMode) return;
            
            const folderItem = e.target.closest('.folder-item');
            if (folderItem && !e.target.closest('.folder-option-btn')) {
                const folderId = folderItem.getAttribute('data-folder-id');
                this.navigateToFolder(folderId);
            }
        });

        // Folder options
        document.getElementById('folders-container')?.addEventListener('click', (e) => {
            const optionBtn = e.target.closest('.folder-option-btn');
            if (optionBtn) {
                const folderItem = optionBtn.closest('.folder-item');
                const action = optionBtn.getAttribute('data-action');
                
                // Enter selection mode and select this folder
                if (!this.selectionMode) {
                    this.enterSelectionMode(folderItem);
                } else {
                    this.toggleItemSelection(folderItem);
                }
                
                if (action === 'rename') {
                    this.showRenameModal();
                } else if (action === 'delete') {
                    this.deleteSelectedItems();
                }
            }
        });

        // Media click events
        document.getElementById('media-container')?.addEventListener('click', (e) => {
            if (this.selectionMode) return;
            
            const mediaItem = e.target.closest('.media-item');
            if (mediaItem) {
                const mediaId = mediaItem.getAttribute('data-media-id');
                const folderId = mediaItem.getAttribute('data-folder-id');
                const media = this.mediaData[folderId]?.find(m => m.id === mediaId);
                
                if (media && media.type === 'video') {
                    this.playVideo(media);
                }
            }
        });
    }

    setupModalEvents() {
        // Add Media Modal
        document.getElementById('cancel-add-media').addEventListener('click', () => this.hideAddMediaModal());
        document.getElementById('cancel-add-media-btn').addEventListener('click', () => this.hideAddMediaModal());
        document.getElementById('confirm-add-media').addEventListener('click', () => this.addMedia());

        // Create Folder Modal
        document.getElementById('cancel-create-folder').addEventListener('click', () => this.hideCreateFolderModal());
        document.getElementById('cancel-create-folder-btn').addEventListener('click', () => this.hideCreateFolderModal());
        document.getElementById('confirm-create-folder').addEventListener('click', () => this.createFolder());

        // Move To Modal
        document.getElementById('cancel-move').addEventListener('click', () => this.hideMoveToModal());
        document.getElementById('cancel-move-btn').addEventListener('click', () => this.hideMoveToModal());
        document.getElementById('confirm-move').addEventListener('click', () => this.moveSelectedItems());

        // Rename Modal
        document.getElementById('cancel-rename').addEventListener('click', () => this.hideRenameModal());
        document.getElementById('cancel-rename-btn').addEventListener('click', () => this.hideRenameModal());
        document.getElementById('confirm-rename').addEventListener('click', () => this.renameSelectedItem());

        // Video Player Modal
        document.getElementById('close-video-player').addEventListener('click', () => this.hideVideoPlayer());

        // Settings Modal
        document.getElementById('cancel-settings').addEventListener('click', () => this.hideSettingsModal());
        document.getElementById('cancel-settings-btn').addEventListener('click', () => this.hideSettingsModal());
        document.getElementById('confirm-settings').addEventListener('click', () => this.hideSettingsModal());
    }

    setupToolbarEvents() {
        document.getElementById('move-to-btn').addEventListener('click', () => this.showMoveToModal());
        document.getElementById('delete-btn').addEventListener('click', () => this.deleteSelectedItems());
        document.getElementById('rename-btn').addEventListener('click', () => this.showRenameModal());
        document.getElementById('cancel-org-btn').addEventListener('click', () => this.cancelSelection());
    }

    setupMobileTabs() {
        const tabs = document.querySelectorAll('.mobile-tab');
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const tabName = tab.getAttribute('data-tab');
                
                // Update active tab
                tabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                
                // Show corresponding content
                document.querySelectorAll('.tab-content').forEach(content => {
                    content.classList.remove('active');
                });
                document.getElementById(`${tabName}-tab`).classList.add('active');
            });
        });
    }

    // NAVIGATION
    navigateToFolder(folderId) {
        this.buildFolderUI(folderId);
    }

    // MODAL MANAGEMENT
    showCreateFolderModal() {
        document.getElementById('create-folder-modal').classList.add('active');
        document.getElementById('folder-name').focus();
    }

    hideCreateFolderModal() {
        document.getElementById('create-folder-modal').classList.remove('active');
        document.getElementById('folder-name').value = '';
    }

    showAddMediaModal() {
        // Reset to single tab by default
        document.querySelectorAll('.mobile-tab').forEach(tab => tab.classList.remove('active'));
        document.querySelector('.mobile-tab[data-tab="single"]').classList.add('active');
        
        document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
        document.getElementById('single-tab').classList.add('active');
        
        document.getElementById('add-media-modal').classList.add('active');
        document.getElementById('media-link').focus();
    }

    hideAddMediaModal() {
        document.getElementById('add-media-modal').classList.remove('active');
        document.getElementById('media-link').value = '';
        document.getElementById('media-title').value = '';
        document.getElementById('batch-links').value = '';
        document.getElementById('batch-title').value = '';
    }

    showMoveToModal() {
        const select = document.getElementById('target-folder');
        select.innerHTML = '<option value="">Select target folder</option>';
        
        Object.keys(this.folderStructure).forEach(folderId => {
            if (folderId !== this.currentFolder && 
                !this.selectedItems.some(item => item.id === folderId) &&
                folderId !== 'root') {
                const option = document.createElement('option');
                option.value = folderId;
                option.textContent = this.folderStructure[folderId].name;
                select.appendChild(option);
            }
        });
        
        document.getElementById('move-to-modal').classList.add('active');
    }

    hideMoveToModal() {
        document.getElementById('move-to-modal').classList.remove('active');
    }

    showRenameModal() {
        if (this.selectedItems.length !== 1) {
            alert('Please select exactly one item to rename');
            return;
        }
        
        const item = this.selectedItems[0];
        const input = document.getElementById('rename-name');
        
        if (item.type === 'folder') {
            input.value = this.folderStructure[item.id].name;
        } else {
            const media = this.mediaData[item.folderId]?.find(m => m.id === item.id);
            input.value = media ? media.title : '';
        }
        
        document.getElementById('rename-modal').classList.add('active');
        input.focus();
    }

    hideRenameModal() {
        document.getElementById('rename-modal').classList.remove('active');
        document.getElementById('rename-name').value = '';
    }

    showSettingsModal() {
        // Update Firebase status in settings
        const statusEl = document.querySelector('#firebase-status .status-text');
        const iconEl = document.querySelector('#firebase-status .status-icon');
        
        if (this.userId) {
            statusEl.textContent = 'Connected to Firebase';
            iconEl.textContent = '✓';
        } else {
            statusEl.textContent = 'Not connected to Firebase';
            iconEl.textContent = '⚠️';
        }
        
        document.getElementById('settings-modal').classList.add('active');
    }

    hideSettingsModal() {
        document.getElementById('settings-modal').classList.remove('active');
    }

    hideAllModals() {
        document.querySelectorAll('.modal').forEach(modal => {
            modal.classList.remove('active');
        });
    }

    // ACTIONS (ALL AUTO-SAVE TO FIREBASE)
    async createFolder() {
        const name = document.getElementById('folder-name').value.trim();
        if (!name) {
            alert('Please enter a folder name');
            return;
        }
        
        const folderId = 'folder-' + Date.now();
        this.folderStructure[folderId] = {
            name: name,
            parent: this.currentFolder,
            children: []
        };
        
        if (!this.folderStructure[this.currentFolder].children) {
            this.folderStructure[this.currentFolder].children = [];
        }
        this.folderStructure[this.currentFolder].children.push(folderId);
        
        this.mediaData[folderId] = [];
        await this.saveDataToFirebase();
        this.buildFolderUI(this.currentFolder);
        this.hideCreateFolderModal();
    }

    async addMedia() {
        const activeTab = document.querySelector('.mobile-tab.active').getAttribute('data-tab');
        
        if (activeTab === 'single') {
            await this.addSingleMedia();
        } else {
            await this.addBatchMedia();
        }
    }

    async addSingleMedia() {
        const link = document.getElementById('media-link').value.trim();
        const type = document.getElementById('media-type').value;
        const title = document.getElementById('media-title').value.trim();
        
        if (!link) {
            alert('Please enter a Google Drive link');
            return;
        }
        
        const fileId = this.extractFileId(link);
        if (!fileId) {
            alert('Invalid Google Drive link. Please make sure it\'s a shared link.');
            return;
        }
        
        const mediaItem = {
            id: fileId,
            type: type,
            title: title || `Media ${new Date().toLocaleDateString()}`,
            added: new Date().toISOString()
        };
        
        if (!this.mediaData[this.currentFolder]) {
            this.mediaData[this.currentFolder] = [];
        }
        
        this.mediaData[this.currentFolder].push(mediaItem);
        await this.saveDataToFirebase();
        this.buildFolderUI(this.currentFolder);
        this.hideAddMediaModal();
    }

    async addBatchMedia() {
        const linksText = document.getElementById('batch-links').value.trim();
        const prefix = document.getElementById('batch-title').value.trim();
        const type = document.getElementById('batch-type').value;
        
        if (!linksText) {
            alert('Please paste some Google Drive links');
            return;
        }
        
        const links = linksText.split('\n').map(link => link.trim()).filter(link => link);
        if (links.length > 10) {
            alert('Please add maximum 10 links at once');
            return;
        }
        
        let addedCount = 0;
        
        for (let i = 0; i < links.length; i++) {
            const link = links[i];
            const fileId = this.extractFileId(link);
            
            if (fileId) {
                const mediaItem = {
                    id: fileId,
                    type: type,
                    title: prefix ? `${prefix} ${i + 1}` : `Media ${i + 1}`,
                    added: new Date().toISOString()
                };
                
                if (!this.mediaData[this.currentFolder]) {
                    this.mediaData[this.currentFolder] = [];
                }
                
                this.mediaData[this.currentFolder].push(mediaItem);
                addedCount++;
            }
        }
        
        if (addedCount > 0) {
            await this.saveDataToFirebase();
            this.buildFolderUI(this.currentFolder);
            this.hideAddMediaModal();
            this.showMessage(`Added ${addedCount} media items!`);
        } else {
            alert('No valid Google Drive links found');
        }
    }

    async moveSelectedItems() {
        const targetFolderId = document.getElementById('target-folder').value;
        if (!targetFolderId) {
            alert('Please select a target folder');
            return;
        }
        
        await this.moveSelectedItemsToFolder(targetFolderId);
        this.hideMoveToModal();
    }

    async renameSelectedItem() {
        const newName = document.getElementById('rename-name').value.trim();
        if (!newName) {
            alert('Please enter a new name');
            return;
        }
        
        const item = this.selectedItems[0];
        if (item.type === 'folder') {
            this.folderStructure[item.id].name = newName;
        } else {
            const media = this.mediaData[item.folderId]?.find(m => m.id === item.id);
            if (media) media.title = newName;
        }
        
        await this.saveDataToFirebase();
        this.buildFolderUI(this.currentFolder);
        this.hideRenameModal();
        this.cancelSelection();
    }

    async deleteSelectedItems() {
        if (this.selectedItems.length === 0) return;
        
        if (!confirm(`Are you sure you want to delete ${this.selectedItems.length} item(s)?`)) {
            return;
        }
        
        this.selectedItems.forEach(item => {
            if (item.type === 'media') {
                this.mediaData[item.folderId] = this.mediaData[item.folderId].filter(m => m.id !== item.id);
            } else {
                this.deleteFolder(item.id);
            }
        });
        
        await this.saveDataToFirebase();
        this.buildFolderUI(this.currentFolder);
        this.cancelSelection();
    }

    deleteFolder(folderId) {
        const folder = this.folderStructure[folderId];
        if (!folder) return;
        
        // Remove from parent's children
        if (folder.parent && this.folderStructure[folder.parent]) {
            this.folderStructure[folder.parent].children = this.folderStructure[folder.parent].children.filter(id => id !== folderId);
        }
        
        // Recursively delete children
        if (folder.children) {
            folder.children.forEach(childId => this.deleteFolder(childId));
        }
        
        // Delete the folder itself
        delete this.folderStructure[folderId];
        delete this.mediaData[folderId];
    }

    async refreshFromCloud() {
        this.showMessage('Refreshing from cloud...');
        await this.loadDataFromFirebase();
        this.buildFolderUI(this.currentFolder);
        this.showMessage('Data refreshed!');
    }

    // LOGIN SYSTEM
    checkLoginStatus() {
        const isLoggedIn = localStorage.getItem('mv_isLoggedIn') === 'true';
        
        if (isLoggedIn) {
            document.getElementById('login-section').style.display = 'none';
            document.getElementById('gallery-section').style.display = 'block';
            if (!window.mediaVaultInitialized) {
                window.mediaVaultInitialized = true;
                this.initializeApp();
            }
        } else {
            document.getElementById('login-section').style.display = 'flex';
            document.getElementById('gallery-section').style.display = 'none';
        }
    }

    checkAccess() {
        const input = document.getElementById('access-code').value;
        const errorMsg = document.getElementById('error-msg');
        
        if (input === '1') {
            localStorage.setItem('mv_isLoggedIn', 'true');
            document.getElementById('login-section').style.display = 'none';
            document.getElementById('gallery-section').style.display = 'block';
            errorMsg.textContent = '';
            
            if (!window.mediaVaultInitialized) {
                window.mediaVaultInitialized = true;
                this.initializeApp();
            }
        } else {
            errorMsg.textContent = 'Incorrect access code! Try "1"';
            document.getElementById('access-code').focus();
        }
    }

    logout() {
        // Unsubscribe from realtime updates
        if (this.unsubscribe) {
            this.unsubscribe();
        }
        
        localStorage.removeItem('mv_isLoggedIn');
        window.mediaVaultInitialized = false;
        document.getElementById('login-section').style.display = 'flex';
        document.getElementById('gallery-section').style.display = 'none';
        document.getElementById('access-code').value = '';
        this.selectedItems = [];
        this.selectionMode = false;
        
        // Sign out from Firebase
        firebase.auth().signOut();
    }
}

// AUTO-LOGIN AND INITIALIZATION
document.addEventListener('DOMContentLoaded', function() {
    // Check login status immediately
    const isLoggedIn = localStorage.getItem('mv_isLoggedIn') === 'true';
    
    // Update cloud status
    const cloudStatus = document.getElementById('cloud-status');
    
    if (isLoggedIn) {
        document.getElementById('login-section').style.display = 'none';
        document.getElementById('gallery-section').style.display = 'block';
        window.mediaVault = new MediaVaultCloud();
        window.mediaVaultInitialized = true;
        
        // Check cloud connection
        setTimeout(async () => {
            cloudStatus.innerHTML = '<span style="color: var(--success)">✓</span> Connected to Firebase';
        }, 1000);
    } else {
        document.getElementById('login-section').style.display = 'flex';
        document.getElementById('gallery-section').style.display = 'none';
        
        localStorage.removeItem('mv_isLoggedIn');
        window.mediaVaultInitialized = false;
        
        // Set up login handler
        document.getElementById('login-btn').addEventListener('click', function() {
            const code = document.getElementById('access-code').value;
            const errorMsg = document.getElementById('error-msg');
            
            if (code === '1') {
                localStorage.setItem('mv_isLoggedIn', 'true');
                document.getElementById('login-section').style.display = 'none';
                document.getElementById('gallery-section').style.display = 'block';
                errorMsg.textContent = '';
                
                window.mediaVault = new MediaVaultCloud();
                window.mediaVaultInitialized = true;
                
                // Update cloud status
                setTimeout(async () => {
                    cloudStatus.innerHTML = '<span style="color: var(--success)">✓</span> Connected to Firebase';
                }, 1000);
            } else {
                errorMsg.textContent = 'Incorrect code! Try "1"';
                document.getElementById('access-code').focus();
            }
        });
        
        // Enter key for login
        document.getElementById('access-code').addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                document.getElementById('login-btn').click();
            }
        });
        
        // Focus on input
        document.getElementById('access-code').focus();
        
        // Check for Firebase connection
        setTimeout(() => {
            cloudStatus.innerHTML = '<span style="color: var(--gray)">☁️</span> Firebase ready for login';
        }, 500);
    }
});
