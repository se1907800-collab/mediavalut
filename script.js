// Media Vault Pro - Simple Working Version
class MediaVault {
    constructor() {
        this.currentFolder = 'root';
        this.selectedItems = [];
        this.folderStructure = {};
        this.mediaData = {};
        this.selectionMode = false;
        this.dragging = false;
        this.currentVideo = null;
        this.longPressTimer = null;

        // Only initialize if we're logged in
        const isLoggedIn = localStorage.getItem('mv_isLoggedIn') === 'true';
        if (isLoggedIn && document.getElementById('gallery-section').style.display !== 'none') {
            this.initializeApp();
        }
    }

    initializeApp() {
        this.loadData();
        this.setupEventListeners();
        this.setupSelectionSystem();
        this.setupDragAndDrop();
        this.buildFolderUI('root');
    }

    // Login System
    checkLoginStatus() {
        const isLoggedIn = localStorage.getItem('mv_isLoggedIn');
        
        if (isLoggedIn === 'true') {
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
        if (this.selectedItems.length > 0) {
            document.getElementById('org-toolbar').style.display = 'flex';
        } else {
            document.getElementById('org-toolbar').style.display = 'none';
            this.selectionMode = false;
            document.body.classList.remove('selection-mode');
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

    moveSelectedItemsToFolder(targetFolderId) {
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

        this.saveData();
        this.buildFolderUI(this.currentFolder);
        this.cancelSelection();
        this.showMessage(`Moved ${this.selectedItems.length} items successfully!`);
    }

    showMessage(text) {
        const message = document.createElement('div');
        message.className = 'status-message';
        message.textContent = text;
        document.body.appendChild(message);
        
        setTimeout(() => {
            if (message.parentNode) {
                message.parentNode.removeChild(message);
            }
        }, 3000);
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

    // Data Management
    loadData() {
        const savedFolderStructure = localStorage.getItem('mv_folderStructure');
        const savedMediaData = localStorage.getItem('mv_mediaData');
        
        this.folderStructure = savedFolderStructure ? JSON.parse(savedFolderStructure) : this.getDefaultFolderStructure();
        this.mediaData = savedMediaData ? JSON.parse(savedMediaData) : this.getDefaultMediaData();
    }

    getDefaultFolderStructure() {
        return {
            'root': { name: 'Home', children: [], parent: null }
        };
    }

    getDefaultMediaData() {
        return {};
    }

    saveData() {
        localStorage.setItem('mv_folderStructure', JSON.stringify(this.folderStructure));
        localStorage.setItem('mv_mediaData', JSON.stringify(this.mediaData));
    }

    // UI Building
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
            
            return `
                <div class="folder-item" data-folder-id="${childId}" data-type="folder" draggable="true">
                    <div class="folder-icon">📁</div>
                    <div class="folder-name">${childFolder.name}</div>
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
                     onerror="this.style.display='none'">
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

    // Event Listeners
    setupEventListeners() {
        // Logout
        document.getElementById('logout-btn').addEventListener('click', () => this.logout());

        // Refresh
        document.getElementById('refresh-btn').addEventListener('click', () => {
            this.buildFolderUI(this.currentFolder);
            this.showMessage('Refreshed!');
        });

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
    }

    setupToolbarEvents() {
        document.getElementById('move-to-btn').addEventListener('click', () => this.showMoveToModal());
        document.getElementById('delete-btn').addEventListener('click', () => this.deleteSelectedItems());
        document.getElementById('rename-btn').addEventListener('click', () => this.showRenameModal());
        document.getElementById('cancel-org-btn').addEventListener('click', () => this.cancelSelection());
    }

    // Navigation
    navigateToFolder(folderId) {
        this.buildFolderUI(folderId);
    }

    // Modal Management
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

    hideAllModals() {
        document.querySelectorAll('.modal').forEach(modal => {
            modal.classList.remove('active');
        });
    }

    // Actions
    createFolder() {
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
        this.saveData();
        this.buildFolderUI(this.currentFolder);
        this.hideCreateFolderModal();
    }

    addMedia() {
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
            title: title || `Media ${new Date().toLocaleDateString()}`
        };
        
        if (!this.mediaData[this.currentFolder]) {
            this.mediaData[this.currentFolder] = [];
        }
        
        this.mediaData[this.currentFolder].push(mediaItem);
        this.saveData();
        this.buildFolderUI(this.currentFolder);
        this.hideAddMediaModal();
    }

    extractFileId(url) {
        const patterns = [
            /\/file\/d\/([^\/]+)/,
            /id=([^&]+)/,
            /\/d\/([^\/]+)/
        ];
        
        for (const pattern of patterns) {
            const match = url.match(pattern);
            if (match && match[1]) {
                return match[1];
            }
        }
        
        return null;
    }

    moveSelectedItems() {
        const targetFolderId = document.getElementById('target-folder').value;
        if (!targetFolderId) {
            alert('Please select a target folder');
            return;
        }
        
        this.moveSelectedItemsToFolder(targetFolderId);
        this.hideMoveToModal();
    }

    renameSelectedItem() {
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
        
        this.saveData();
        this.buildFolderUI(this.currentFolder);
        this.hideRenameModal();
        this.cancelSelection();
    }

    deleteSelectedItems() {
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
        
        this.saveData();
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
}

// AUTO-LOGIN
document.addEventListener('DOMContentLoaded', function() {
    // Check login status immediately
    const isLoggedIn = localStorage.getItem('mv_isLoggedIn') === 'true';
    
    if (isLoggedIn) {
        document.getElementById('login-section').style.display = 'none';
        document.getElementById('gallery-section').style.display = 'block';
        window.mediaVault = new MediaVault();
        window.mediaVaultInitialized = true;
    } else {
        document.getElementById('login-section').style.display = 'flex';
        document.getElementById('gallery-section').style.display = 'none';
        
        // Clear any existing data that might cause auto-login
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
                
                window.mediaVault = new MediaVault();
                window.mediaVaultInitialized = true;
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
    }
});
