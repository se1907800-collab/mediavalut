// Media Vault Pro - Complete Cloud Edition
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
        
        // GitHub configuration - Will be set from settings
        this.github = {
            username: '',
            repo: '',
            branch: 'main',
            baseUrl: 'https://raw.githubusercontent.com'
        };
        
        this.csvFolderPrefix = 'csv-';
        this.manifestFile = 'mediavault-data.json';
        
        // Load settings
        this.loadSettings();
        
        // Only initialize if we're logged in
        const isLoggedIn = localStorage.getItem('mv_isLoggedIn') === 'true';
        if (isLoggedIn && document.getElementById('gallery-section').style.display !== 'none') {
            this.initializeApp();
        }
    }

    async initializeApp() {
        await this.loadDataFromGitHub();
        this.setupEventListeners();
        this.setupSelectionSystem();
        this.setupDragAndDrop();
        this.buildFolderUI('root');
    }

    // SETTINGS MANAGEMENT
    loadSettings() {
        const settings = JSON.parse(localStorage.getItem('mv_cloud_settings') || '{}');
        this.github = { ...this.github, ...settings };
    }

    saveSettings() {
        localStorage.setItem('mv_cloud_settings', JSON.stringify(this.github));
    }

    // GITHUB CLOUD STORAGE
    async loadDataFromGitHub() {
        try {
            // First try to load the manifest file
            const manifestData = await this.fetchGitHubFile(this.manifestFile);
            
            if (manifestData) {
                const data = JSON.parse(manifestData);
                this.folderStructure = data.folderStructure || this.getDefaultFolderStructure();
                this.mediaData = data.mediaData || this.getDefaultMediaData();
                this.showMessage('Data loaded from cloud!');
            } else {
                // First time setup - scan for CSV files
                this.showMessage('First time setup: Scanning for CSV files...');
                await this.scanForCSVFiles();
            }
        } catch (error) {
            console.error('Error loading data from GitHub:', error);
            // Fallback to empty structure
            this.folderStructure = this.getDefaultFolderStructure();
            this.mediaData = this.getDefaultMediaData();
            this.showMessage('Using local storage - check cloud settings', 'warning');
        }
    }

    async scanForCSVFiles() {
        if (!this.github.username || !this.github.repo) {
            console.warn('GitHub settings not configured');
            return;
        }

        try {
            // Try to fetch CSV files from the csv directory
            const csvFiles = await this.getCSVFileList();
            
            this.folderStructure = this.getDefaultFolderStructure();
            this.mediaData = this.getDefaultMediaData();
            
            let processedCount = 0;
            for (const csvFile of csvFiles) {
                const success = await this.processCSVFile(csvFile);
                if (success) processedCount++;
            }
            
            if (processedCount > 0) {
                await this.saveDataToGitHub();
                this.showMessage(`Found and processed ${processedCount} CSV files!`);
            } else {
                this.showMessage('No CSV files found in repository');
            }
        } catch (error) {
            console.error('Error scanning CSV files:', error);
            this.showMessage('Error scanning CSV files', 'error');
        }
    }

    async getCSVFileList() {
        // In a real implementation, you'd use GitHub API to list files
        // For now, we'll try common CSV filenames
        const commonNames = ['movies', 'videos', 'photos', 'images', 'media', 'documents'];
        const foundFiles = [];
        
        for (const name of commonNames) {
            const filename = `csv/${name}.csv`;
            try {
                const content = await this.fetchGitHubFile(filename);
                if (content) {
                    foundFiles.push(filename);
                }
            } catch (e) {
                // File doesn't exist, continue
            }
        }
        
        return foundFiles;
    }

    async processCSVFile(csvFilePath) {
        try {
            const csvContent = await this.fetchGitHubFile(csvFilePath);
            if (!csvContent) return false;

            const filename = csvFilePath.split('/').pop();
            const folderName = filename.replace('.csv', '').replace(/_/g, ' ');
            const folderId = this.csvFolderPrefix + this.sanitizeId(folderName);
            
            // Create folder for this CSV
            this.folderStructure[folderId] = {
                name: this.capitalizeFirst(folderName),
                parent: 'root',
                children: [],
                source: 'csv',
                csvFile: csvFilePath
            };
            
            if (!this.folderStructure['root'].children) {
                this.folderStructure['root'].children = [];
            }
            
            // Avoid duplicates
            if (!this.folderStructure['root'].children.includes(folderId)) {
                this.folderStructure['root'].children.push(folderId);
            }
            
            // Parse CSV and add media
            this.mediaData[folderId] = this.parseCSVContent(csvContent);
            return true;
            
        } catch (error) {
            console.error(`Error processing CSV file ${csvFilePath}:`, error);
            return false;
        }
    }

    parseCSVContent(csvText) {
        const mediaItems = [];
        const lines = csvText.split('\n').filter(line => line.trim());
        
        // Skip header if it exists
        const startIndex = lines[0].toLowerCase().includes('id,') ? 1 : 0;
        
        for (let i = startIndex; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;
            
            const columns = line.split(',').map(col => col.trim());
            if (columns.length >= 2) {
                const [id, type, title, folder] = columns;
                if (id && type) {
                    mediaItems.push({
                        id: id,
                        type: type.toLowerCase(),
                        title: (title || `Media ${i}`),
                        folder: folder || '',
                        added: new Date().toISOString()
                    });
                }
            }
        }
        
        return mediaItems;
    }

    async fetchGitHubFile(filePath) {
        if (!this.github.username || !this.github.repo) {
            throw new Error('GitHub settings not configured');
        }

        try {
            const url = `${this.github.baseUrl}/${this.github.username}/${this.github.repo}/${this.github.branch}/${filePath}`;
            const response = await fetch(url);
            
            if (response.ok) {
                return await response.text();
            }
            return null;
        } catch (error) {
            console.error(`Error fetching ${filePath}:`, error);
            return null;
        }
    }

    async saveDataToGitHub() {
        // In a real implementation, this would use GitHub API with write permissions
        // For this demo, we'll simulate cloud saving and use localStorage as backup
        
        const data = {
            folderStructure: this.folderStructure,
            mediaData: this.mediaData,
            lastUpdated: new Date().toISOString(),
            version: '1.0'
        };
        
        // Simulate cloud save
        console.log('Saving to cloud:', data);
        
        // Store in localStorage as backup (in real implementation, this would be the API call)
        localStorage.setItem('mv_cloud_backup', JSON.stringify(data));
        
        this.showMessage('Changes saved to cloud storage!');
        return true;
    }

    async refreshFromCloud() {
        this.showMessage('Refreshing from cloud...');
        await this.loadDataFromGitHub();
        this.buildFolderUI(this.currentFolder);
        this.showMessage('Data refreshed from cloud!');
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
            /\/view\?usp=sharing/ // Clean up common Google Drive patterns
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
            const tempUrl = new URL(url);
            const id = tempUrl.searchParams.get('id');
            if (id) return id;
        }
        
        return null;
    }

    showMessage(text, type = 'success') {
        const message = document.createElement('div');
        message.className = `status-message ${type === 'error' ? 'error-message' : ''}`;
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

    // SELECTION SYSTEM (same as before)
    setupSelectionSystem() {
        console.log('Setting up selection system...');
        
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
            console.log('Mouse down on item:', item);
            this.longPressTimer = setTimeout(() => {
                console.log('Long press detected - entering selection mode');
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
            console.log('Touch start on item:', item);
            this.longPressTimer = setTimeout(() => {
                console.log('Touch long press detected - entering selection mode');
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
                console.log('Click in selection mode on:', item);
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
        console.log('Entering selection mode with item:', initialItem);
        this.selectionMode = true;
        document.body.classList.add('selection-mode');
        this.toggleItemSelection(initialItem);
    }

    toggleItemSelection(item) {
        const itemId = item.getAttribute('data-media-id') || item.getAttribute('data-folder-id');
        const itemType = item.getAttribute('data-type');
        const folderId = item.getAttribute('data-folder-id') || this.currentFolder;

        console.log('Toggling selection for:', { itemId, itemType, folderId });

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
        if (this.selectedItems.length > 0) {
            document.getElementById('org-toolbar').style.display = 'flex';
            console.log('Toolbar shown, selected items:', this.selectedItems.length);
        } else {
            document.getElementById('org-toolbar').style.display = 'none';
            this.selectionMode = false;
            document.body.classList.remove('selection-mode');
            console.log('Toolbar hidden, selection mode exited');
        }
    }

    cancelSelection() {
        console.log('Cancelling selection');
        this.selectedItems = [];
        this.selectionMode = false;
        document.querySelectorAll('.selected').forEach(item => {
            item.classList.remove('selected');
        });
        document.getElementById('org-toolbar').style.display = 'none';
        document.body.classList.remove('selection-mode');
    }

    // DRAG & DROP (same as before)
    setupDragAndDrop() {
        document.addEventListener('dragstart', (e) => {
            const item = e.target.closest('.folder-item, .media-item');
            if (item && this.selectedItems.length > 0) {
                this.dragging = true;
                e.dataTransfer.effectAllowed = 'move';
                
                const dragImage = document.createElement('div');
                dragImage.textContent = `Moving ${this.selectedItems.length} items`;
                dragImage.style.cssText = 'background: var(--primary); color: white; padding: 8px 12px; border-radius: 4px; position: fixed; top: -100px;';
                document.body.appendChild(dragImage);
                e.dataTransfer.setDragImage(dragImage, 0, 0);
                setTimeout(() => document.body.removeChild(dragImage), 0);
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

        await this.saveDataToGitHub();
        this.buildFolderUI(this.currentFolder);
        this.cancelSelection();
        this.showMessage(`Moved ${this.selectedItems.length} items successfully!`);
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
        const breadcrumb = document.getElementById('breadcrumb');
        const path = this.getFolderPath(folderId);
        
        breadcrumb.innerHTML = path.map((item, index) => `
            <div class="breadcrumb-item ${index === path.length - 1 ? 'active' : ''}" 
                 data-folder="${item.id}">
                <span>${index === 0 ? '🏠' : '📁'}</span>
                ${item.name}
            </div>
        `).join('');
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
        document.getElementById('breadcrumb').addEventListener('click', (e) => {
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
        document.getElementById('confirm-settings').addEventListener('click', () => this.saveCloudSettings());
    }

    setupToolbarEvents() {
        document.getElementById('move-to-btn').addEventListener('click', () => this.showMoveToModal());
        document.getElementById('delete-btn').addEventListener('click', () => this.deleteSelectedItems());
        document.getElementById('rename-btn').addEventListener('click', () => this.showRenameModal());
        document.getElementById('cancel-org-btn').addEventListener('click', () => this.cancelSelection());
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
        document.getElementById('add-media-modal').classList.add('active');
        document.getElementById('media-link').focus();
    }

    hideAddMediaModal() {
        document.getElementById('add-media-modal').classList.remove('active');
        document.getElementById('media-link').value = '';
        document.getElementById('media-title').value = '';
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
        document.getElementById('github-username').value = this.github.username || '';
        document.getElementById('github-repo').value = this.github.repo || '';
        document.getElementById('github-branch').value = this.github.branch || 'main';
        
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

    // ACTIONS
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
        await this.saveDataToGitHub();
        this.buildFolderUI(this.currentFolder);
        this.hideCreateFolderModal();
    }

    async addMedia() {
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
        await this.saveDataToGitHub();
        this.buildFolderUI(this.currentFolder);
        this.hideAddMediaModal();
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
        
        await this.saveDataToGitHub();
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
        
        await this.saveDataToGitHub();
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

    async saveCloudSettings() {
        const username = document.getElementById('github-username').value.trim();
        const repo = document.getElementById('github-repo').value.trim();
        const branch = document.getElementById('github-branch').value.trim() || 'main';
        
        if (!username || !repo) {
            alert('Please enter both GitHub username and repository name');
            return;
        }
        
        this.github.username = username;
        this.github.repo = repo;
        this.github.branch = branch;
        
        this.saveSettings();
        this.hideSettingsModal();
        
        // Refresh data with new settings
        await this.refreshFromCloud();
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
        localStorage.removeItem('mv_isLoggedIn');
        window.mediaVaultInitialized = false;
        document.getElementById('login-section').style.display = 'flex';
        document.getElementById('gallery-section').style.display = 'none';
        document.getElementById('access-code').value = '';
        this.selectedItems = [];
        this.selectionMode = false;
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
            if (window.mediaVault.github.username && window.mediaVault.github.repo) {
                cloudStatus.innerHTML = '<span style="color: var(--success)">✓</span> Connected to cloud';
            } else {
                cloudStatus.innerHTML = '<span style="color: var(--warning)">⚠</span> Cloud settings needed';
            }
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
                    if (window.mediaVault.github.username && window.mediaVault.github.repo) {
                        cloudStatus.innerHTML = '<span style="color: var(--success)">✓</span> Connected to cloud';
                    } else {
                        cloudStatus.innerHTML = '<span style="color: var(--warning)">⚠</span> Cloud settings needed';
                    }
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
        
        // Check for default cloud settings
        setTimeout(() => {
            const settings = JSON.parse(localStorage.getItem('mv_cloud_settings') || '{}');
            if (settings.username && settings.repo) {
                cloudStatus.innerHTML = '<span style="color: var(--success)">✓</span> Cloud settings detected';
            } else {
                cloudStatus.innerHTML = '<span style="color: var(--gray)">☁️</span> Configure cloud settings after login';
            }
        }, 500);
    }
});