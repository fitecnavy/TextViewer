// Capacitor imports - only load if available
let Capacitor, Filesystem, Dialog, Share;

if (window.Capacitor) {
    import('@capacitor/core').then(module => { Capacitor = module.Capacitor; });
    import('@capacitor/filesystem').then(module => { 
        Filesystem = module.Filesystem;
        Directory = module.Directory;
        Encoding = module.Encoding;
    });
    import('@capacitor/dialog').then(module => { Dialog = module.Dialog; });
    import('@capacitor/share').then(module => { Share = module.Share; });
}

class TextViewer {
    constructor() {
        this.currentFile = null;
        this.currentContent = '';
        this.searchResults = [];
        this.currentSearchIndex = -1;
        this.isCapacitor = window.Capacitor && Capacitor.isNativePlatform();
        this.isElectron = window.navigator.userAgent.includes('Electron');
        
        // Library management
        this.library = [];
        this.selectedBook = null;
        this.currentView = 'library'; // 'library' or 'viewer'
        
        this.initializeElements();
        this.bindEvents();
        this.registerServiceWorker();
        this.loadLibrary();
        
        // Make instance globally available for Electron
        window.textViewer = this;
    }

    initializeElements() {
        this.elements = {
            toggleSidebarBtn: document.getElementById('toggleSidebarBtn'),
            searchBtn: document.getElementById('searchBtn'),
            searchContainer: document.getElementById('searchContainer'),
            searchInput: document.getElementById('searchInput'),
            prevSearchBtn: document.getElementById('prevSearchBtn'),
            nextSearchBtn: document.getElementById('nextSearchBtn'),
            searchInfo: document.getElementById('searchInfo'),
            closeSearchBtn: document.getElementById('closeSearchBtn'),
            sidebar: document.getElementById('sidebar'),
            textContent: document.getElementById('textContent'),
            fileInfoContent: document.getElementById('fileInfoContent'),
            statusLeft: document.getElementById('statusLeft'),
            statusRight: document.getElementById('statusRight'),
            fileSize: document.getElementById('fileSize'),
            encoding: document.getElementById('encoding'),
            lineCount: document.getElementById('lineCount'),
            loadingOverlay: document.getElementById('loadingOverlay'),
            // Library elements
            libraryView: document.getElementById('libraryView'),
            booksGrid: document.getElementById('booksGrid'),
            addBookBtn: document.getElementById('addBookBtn'),
            totalBooks: document.getElementById('totalBooks'),
            totalSize: document.getElementById('totalSize'),
            textViewer: document.getElementById('textViewer'),
            backToLibraryBtn: document.getElementById('backToLibraryBtn'),
            currentBookTitle: document.getElementById('currentBookTitle')
        };
    }

    bindEvents() {
        this.elements.addBookBtn.addEventListener('click', () => this.addBook());
        this.elements.toggleSidebarBtn.addEventListener('click', () => this.toggleSidebar());
        this.elements.searchBtn.addEventListener('click', () => this.toggleSearch());
        this.elements.closeSearchBtn.addEventListener('click', () => this.closeSearch());
        this.elements.searchInput.addEventListener('input', () => this.performSearch());
        this.elements.searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.shiftKey ? this.previousSearch() : this.nextSearch();
            }
        });
        this.elements.prevSearchBtn.addEventListener('click', () => this.previousSearch());
        this.elements.nextSearchBtn.addEventListener('click', () => this.nextSearch());
        this.elements.backToLibraryBtn.addEventListener('click', () => this.showLibrary());

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey || e.metaKey) {
                switch (e.key) {
                    case 'o':
                        e.preventDefault();
                        this.addBook();
                        break;
                    case 'f':
                        e.preventDefault();
                        if (this.currentView === 'viewer') this.toggleSearch();
                        break;
                    case 'Escape':
                        e.preventDefault();
                        if (this.currentView === 'viewer') this.showLibrary();
                        break;
                }
            }
            if (e.key === 'Escape') {
                if (this.currentView === 'viewer') {
                    this.closeSearch();
                } else {
                    this.showLibrary();
                }
            }
        });
    }

    async registerServiceWorker() {
        if ('serviceWorker' in navigator && !this.isCapacitor) {
            try {
                const registration = await navigator.serviceWorker.register('./sw.js');
                console.log('Service Worker registered successfully:', registration);
            } catch (error) {
                console.log('Service Worker registration failed:', error);
            }
        }
    }


    async addBook() {
        try {
            if (this.isElectron) {
                await this.addBookElectron();
            } else if (this.isCapacitor) {
                await this.addBookCapacitor();
            } else {
                await this.addBookWeb();
            }
        } catch (error) {
            console.error('Error adding book:', error);
            this.showError('책을 추가할 수 없습니다: ' + error.message);
        }
    }

    async addBookElectron() {
        try {
            // Call Electron main process to open file dialog
            const result = await window.electronAPI?.showOpenDialog();
            if (result && !result.canceled && result.filePaths.length > 0) {
                const fileData = await window.electronAPI?.readFile(result.filePaths[0]);
                if (fileData) {
                    this.addBookFromElectronData(fileData.filePath, fileData.content);
                }
            }
        } catch (error) {
            console.error('Error adding book in Electron:', error);
            this.showError('책을 추가할 수 없습니다: ' + error.message);
        }
    }

    // Electron에서 파일을 로드하는 메서드
    addBookFromElectronData(filePath, content) {
        const fileName = filePath.split('\\').pop().split('/').pop();
        
        const book = {
            id: Date.now() + Math.random(),
            name: fileName,
            size: content.length,
            type: 'text/plain',
            lastModified: Date.now(),
            content: content,
            filePath: filePath,
            addedDate: new Date().toISOString()
        };

        this.addBookToLibrary(book);
    }

    async addBookCapacitor() {
        try {
            const result = await Dialog.confirm({
                title: '책 추가',
                message: '텍스트 파일을 서재에 추가하시겠습니까?'
            });

            if (result.value) {
                // Capacitor의 파일 시스템 접근은 제한적이므로
                // 실제 구현에서는 파일 피커 플러그인이 필요합니다
                this.showInfo('Capacitor 환경에서는 파일 선택 플러그인이 필요합니다.');
            }
        } catch (error) {
            console.error('Capacitor book add error:', error);
            this.showError('책을 추가할 수 없습니다.');
        }
    }

    async addBookWeb() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.txt,.log,.md,.js,.html,.css,.json,.xml,text/*';
        input.multiple = true;
        
        input.onchange = (e) => {
            const files = Array.from(e.target.files);
            files.forEach(file => {
                this.addBookFromFile(file);
            });
        };
        
        input.click();
    }

    async addBookFromFile(file) {
        this.showLoading(true);
        
        try {
            const content = await this.readFileContent(file);
            
            const book = {
                id: Date.now() + Math.random(),
                name: file.name,
                size: file.size,
                type: file.type,
                lastModified: file.lastModified,
                content: content,
                addedDate: new Date().toISOString()
            };

            this.addBookToLibrary(book);
            
        } catch (error) {
            console.error('Error reading file:', error);
            this.showError('파일을 읽을 수 없습니다: ' + error.message);
        } finally {
            this.showLoading(false);
        }
    }

    addBookToLibrary(book) {
        // Check if book already exists
        const existingIndex = this.library.findIndex(b => 
            b.name === book.name && b.size === book.size
        );
        
        if (existingIndex !== -1) {
            // Update existing book
            this.library[existingIndex] = book;
            this.showInfo(`"${book.name}" 책이 업데이트되었습니다.`);
        } else {
            // Add new book
            this.library.push(book);
            this.showInfo(`"${book.name}" 책이 서재에 추가되었습니다.`);
        }
        
        this.saveLibrary();
        this.renderLibrary();
        this.updateLibraryStats();
    }

    loadLibrary() {
        try {
            const saved = localStorage.getItem('textviewer-library');
            if (saved) {
                this.library = JSON.parse(saved);
            }
        } catch (error) {
            console.error('Error loading library:', error);
            this.library = [];
        }
        
        this.renderLibrary();
        this.updateLibraryStats();
    }

    saveLibrary() {
        try {
            localStorage.setItem('textviewer-library', JSON.stringify(this.library));
        } catch (error) {
            console.error('Error saving library:', error);
            this.showError('서재 저장에 실패했습니다.');
        }
    }

    renderLibrary() {
        const colors = ['variant-blue', 'variant-green', 'variant-purple', 'variant-red', 'variant-indigo', 'variant-pink'];
        
        this.elements.booksGrid.innerHTML = this.library.map((book, index) => {
            const colorClass = colors[index % colors.length];
            const addedDate = new Date(book.addedDate).toLocaleDateString('ko-KR');
            
            return `
                <div class="book-item group" data-book-id="${book.id}">
                    <div class="book-cover ${colorClass}">
                        <div class="book-spine"></div>
                        <div class="book-content">
                            <div class="book-title">${book.name}</div>
                            <div class="book-meta">
                                <div>${this.formatFileSize(book.size)}</div>
                                <div>${addedDate}</div>
                            </div>
                        </div>
                        <div class="book-actions">
                            <button class="book-delete" data-book-id="${book.id}" title="삭제">×</button>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        // Bind events to book items
        this.bindBookEvents();
    }

    bindBookEvents() {
        // Book click events
        this.elements.booksGrid.querySelectorAll('.book-item').forEach(item => {
            item.addEventListener('click', (e) => {
                if (e.target.classList.contains('book-delete')) {
                    return; // Let delete handler handle this
                }
                
                const bookId = parseFloat(item.dataset.bookId);
                this.openBook(bookId);
            });
        });

        // Delete button events
        this.elements.booksGrid.querySelectorAll('.book-delete').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const bookId = parseFloat(btn.dataset.bookId);
                this.deleteBook(bookId);
            });
        });
    }

    updateLibraryStats() {
        const totalSize = this.library.reduce((sum, book) => sum + book.size, 0);
        this.elements.totalBooks.innerHTML = `총 <span class="font-semibold">${this.library.length}</span>권`;
        this.elements.totalSize.textContent = this.formatFileSize(totalSize);
    }

    openBook(bookId) {
        const book = this.library.find(b => b.id === bookId);
        if (!book) {
            this.showError('책을 찾을 수 없습니다.');
            return;
        }

        this.selectedBook = book;
        this.currentFile = {
            name: book.name,
            size: book.size,
            type: book.type,
            lastModified: book.lastModified
        };
        this.currentContent = book.content;
        
        this.showViewer();
        this.displayFile(book.content);
    }

    deleteBook(bookId) {
        const book = this.library.find(b => b.id === bookId);
        if (!book) return;

        if (confirm(`"${book.name}" 책을 서재에서 삭제하시겠습니까?`)) {
            this.library = this.library.filter(b => b.id !== bookId);
            this.saveLibrary();
            this.renderLibrary();
            this.updateLibraryStats();
            this.showInfo(`"${book.name}" 책이 서재에서 삭제되었습니다.`);
        }
    }

    showLibrary() {
        this.currentView = 'library';
        this.elements.libraryView.classList.remove('hidden');
        this.elements.textViewer.classList.add('hidden');
        this.elements.sidebar.classList.remove('active');
        this.closeSearch();
        
        // Update button states
        this.elements.addBookBtn.innerHTML = '📖 책 추가하기';
        this.elements.searchBtn.disabled = true;
        this.elements.backToLibraryBtn.classList.add('hidden');
        this.elements.statusLeft.textContent = '서재';
        
        // Update file info
        this.elements.fileInfoContent.innerHTML = `
            <div class="text-center text-gray-500 py-8">
                책을 선택해주세요
            </div>
        `;
    }

    showViewer() {
        this.currentView = 'viewer';
        this.elements.libraryView.classList.add('hidden');
        this.elements.textViewer.classList.remove('hidden');
        
        // Update button states
        this.elements.addBookBtn.innerHTML = '📖 책 추가하기';
        this.elements.searchBtn.disabled = false;
        this.elements.backToLibraryBtn.classList.remove('hidden');
        
        if (this.selectedBook) {
            this.elements.currentBookTitle.textContent = this.selectedBook.name;
        }
    }

    async readFileContent(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = (e) => {
                const content = e.target.result;
                resolve(content);
            };
            
            reader.onerror = () => {
                reject(new Error('파일 읽기 실패'));
            };
            
            // UTF-8로 읽기 시도
            reader.readAsText(file, 'UTF-8');
        });
    }

    displayFile(content) {
        this.currentContent = content;
        
        // 텍스트 내용 표시
        this.elements.textContent.innerHTML = '';
        this.elements.textContent.classList.remove('loading');
        
        const pre = document.createElement('pre');
        pre.textContent = content;
        pre.className = 'whitespace-pre-wrap font-mono text-sm leading-relaxed p-6';
        this.elements.textContent.appendChild(pre);

        // 파일 정보 업데이트
        this.updateFileInfo();
        this.updateStatusBar();
        
        // 버튼 상태 업데이트
        this.elements.clearBtn.disabled = false;
        this.elements.searchBtn.disabled = false;

        const displayName = this.selectedBook ? this.selectedBook.name : this.currentFile.name;
        this.elements.statusLeft.textContent = `읽는 중: ${displayName}`;
    }

    updateFileInfo() {
        if (!this.currentFile) return;

        const lines = this.currentContent.split('\n').length;
        const chars = this.currentContent.length;
        const sizeStr = this.formatFileSize(this.currentFile.size);
        const modifiedDate = new Date(this.currentFile.lastModified).toLocaleString('ko-KR');

        let addedInfo = '';
        if (this.selectedBook && this.selectedBook.addedDate) {
            const addedDate = new Date(this.selectedBook.addedDate).toLocaleString('ko-KR');
            addedInfo = `
                <div class="file-info-item">
                    <span class="file-info-label">서재 추가일:</span>
                    <span class="file-info-value">${addedDate}</span>
                </div>
            `;
        }

        this.elements.fileInfoContent.innerHTML = `
            <div class="file-info-item">
                <span class="file-info-label">파일명:</span>
                <span class="file-info-value">${this.currentFile.name}</span>
            </div>
            <div class="file-info-item">
                <span class="file-info-label">크기:</span>
                <span class="file-info-value">${sizeStr}</span>
            </div>
            <div class="file-info-item">
                <span class="file-info-label">줄 수:</span>
                <span class="file-info-value">${lines.toLocaleString()}</span>
            </div>
            <div class="file-info-item">
                <span class="file-info-label">문자 수:</span>
                <span class="file-info-value">${chars.toLocaleString()}</span>
            </div>
            <div class="file-info-item">
                <span class="file-info-label">수정일:</span>
                <span class="file-info-value">${modifiedDate}</span>
            </div>
            ${addedInfo}
            ${this.selectedBook ? `
                <div class="mt-4 p-3 bg-orange-50 rounded-lg">
                    <div class="text-sm text-orange-700 font-medium mb-2">📚 서재의 책</div>
                    <button class="btn btn-secondary text-xs" onclick="textViewer.deleteBook(${this.selectedBook.id})">
                        서재에서 삭제
                    </button>
                </div>
            ` : ''}
            <div class="mt-4">
                <label class="file-info-label block mb-2">인코딩:</label>
                <select class="encoding-selector">
                    <option value="UTF-8" selected>UTF-8</option>
                    <option value="EUC-KR">EUC-KR</option>
                    <option value="ISO-8859-1">ISO-8859-1</option>
                </select>
            </div>
        `;
    }

    updateStatusBar() {
        if (!this.currentFile) return;

        const lines = this.currentContent.split('\n').length;
        this.elements.fileSize.textContent = this.formatFileSize(this.currentFile.size);
        this.elements.encoding.textContent = 'UTF-8';
        this.elements.lineCount.textContent = `${lines.toLocaleString()} 줄`;
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    clearContent() {
        if (this.currentView === 'viewer') {
            // Return to library view
            this.showLibrary();
        }
    }

    toggleSidebar() {
        this.elements.sidebar.classList.toggle('active');
    }

    toggleSearch() {
        if (this.elements.searchContainer.classList.contains('active')) {
            this.closeSearch();
        } else {
            this.openSearch();
        }
    }

    openSearch() {
        this.elements.searchContainer.classList.add('active');
        this.elements.searchInput.focus();
    }

    closeSearch() {
        this.elements.searchContainer.classList.remove('active');
        this.clearSearchHighlights();
        this.elements.searchInput.value = '';
        this.searchResults = [];
        this.currentSearchIndex = -1;
        this.updateSearchInfo();
    }

    performSearch() {
        const query = this.elements.searchInput.value;
        if (!query || !this.currentContent) {
            this.clearSearchHighlights();
            this.searchResults = [];
            this.currentSearchIndex = -1;
            this.updateSearchInfo();
            return;
        }

        this.searchResults = this.findInText(query);
        this.currentSearchIndex = this.searchResults.length > 0 ? 0 : -1;
        this.highlightSearchResults();
        this.updateSearchInfo();
        
        if (this.searchResults.length > 0) {
            this.scrollToCurrentResult();
        }
    }

    findInText(query) {
        const results = [];
        const regex = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
        let match;

        while ((match = regex.exec(this.currentContent)) !== null) {
            results.push({
                index: match.index,
                length: match[0].length,
                text: match[0]
            });
        }

        return results;
    }

    highlightSearchResults() {
        if (!this.searchResults.length) return;

        const pre = this.elements.textContent.querySelector('pre');
        if (!pre) return;

        let content = this.currentContent;
        let offset = 0;

        // 뒤에서부터 하이라이트를 적용하여 인덱스 오차 방지
        for (let i = this.searchResults.length - 1; i >= 0; i--) {
            const result = this.searchResults[i];
            const isCurrentResult = i === this.currentSearchIndex;
            const highlightClass = isCurrentResult ? 'highlight current' : 'highlight';
            
            const before = content.substring(0, result.index);
            const highlighted = `<span class="${highlightClass}">${result.text}</span>`;
            const after = content.substring(result.index + result.length);
            
            content = before + highlighted + after;
        }

        pre.innerHTML = content;
    }

    clearSearchHighlights() {
        const pre = this.elements.textContent.querySelector('pre');
        if (pre) {
            pre.textContent = this.currentContent;
        }
    }

    nextSearch() {
        if (this.searchResults.length === 0) return;
        
        this.currentSearchIndex = (this.currentSearchIndex + 1) % this.searchResults.length;
        this.highlightSearchResults();
        this.updateSearchInfo();
        this.scrollToCurrentResult();
    }

    previousSearch() {
        if (this.searchResults.length === 0) return;
        
        this.currentSearchIndex = this.currentSearchIndex <= 0 
            ? this.searchResults.length - 1 
            : this.currentSearchIndex - 1;
        this.highlightSearchResults();
        this.updateSearchInfo();
        this.scrollToCurrentResult();
    }

    updateSearchInfo() {
        if (this.searchResults.length === 0) {
            this.elements.searchInfo.textContent = '';
            this.elements.prevSearchBtn.disabled = true;
            this.elements.nextSearchBtn.disabled = true;
        } else {
            this.elements.searchInfo.textContent = 
                `${this.currentSearchIndex + 1} / ${this.searchResults.length}`;
            this.elements.prevSearchBtn.disabled = false;
            this.elements.nextSearchBtn.disabled = false;
        }
    }

    scrollToCurrentResult() {
        const currentHighlight = this.elements.textContent.querySelector('.highlight.current');
        if (currentHighlight) {
            currentHighlight.scrollIntoView({ 
                behavior: 'smooth', 
                block: 'center' 
            });
        }
    }

    showLoading(show) {
        this.elements.loadingOverlay.classList.toggle('hidden', !show);
    }

    showError(message) {
        if (this.isCapacitor) {
            Dialog.alert({
                title: '오류',
                message: message
            });
        } else {
            alert(message);
        }
    }

    showInfo(message) {
        if (this.isCapacitor) {
            Dialog.alert({
                title: '정보',
                message: message
            });
        } else {
            alert(message);
        }
    }
}

// 앱 초기화
document.addEventListener('DOMContentLoaded', () => {
    new TextViewer();
});