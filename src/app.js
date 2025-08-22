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
        
        this.initializeElements();
        this.bindEvents();
        this.registerServiceWorker();
        this.setupDragAndDrop();
        
        // Make instance globally available for Electron
        window.textViewer = this;
    }

    initializeElements() {
        this.elements = {
            openFileBtn: document.getElementById('openFileBtn'),
            clearBtn: document.getElementById('clearBtn'),
            toggleSidebarBtn: document.getElementById('toggleSidebarBtn'),
            searchBtn: document.getElementById('searchBtn'),
            settingsBtn: document.getElementById('settingsBtn'),
            searchContainer: document.getElementById('searchContainer'),
            searchInput: document.getElementById('searchInput'),
            prevSearchBtn: document.getElementById('prevSearchBtn'),
            nextSearchBtn: document.getElementById('nextSearchBtn'),
            searchInfo: document.getElementById('searchInfo'),
            closeSearchBtn: document.getElementById('closeSearchBtn'),
            sidebar: document.getElementById('sidebar'),
            textContent: document.getElementById('textContent'),
            dropZone: document.getElementById('dropZone'),
            fileInfoContent: document.getElementById('fileInfoContent'),
            statusLeft: document.getElementById('statusLeft'),
            statusRight: document.getElementById('statusRight'),
            fileSize: document.getElementById('fileSize'),
            encoding: document.getElementById('encoding'),
            lineCount: document.getElementById('lineCount'),
            loadingOverlay: document.getElementById('loadingOverlay')
        };
    }

    bindEvents() {
        this.elements.openFileBtn.addEventListener('click', () => this.openFile());
        this.elements.clearBtn.addEventListener('click', () => this.clearContent());
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

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey || e.metaKey) {
                switch (e.key) {
                    case 'o':
                        e.preventDefault();
                        this.openFile();
                        break;
                    case 'f':
                        e.preventDefault();
                        this.toggleSearch();
                        break;
                    case 'w':
                        e.preventDefault();
                        this.clearContent();
                        break;
                }
            }
            if (e.key === 'Escape') {
                this.closeSearch();
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

    setupDragAndDrop() {
        const dropZone = this.elements.dropZone;
        
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            dropZone.addEventListener(eventName, this.preventDefaults, false);
            document.body.addEventListener(eventName, this.preventDefaults, false);
        });

        ['dragenter', 'dragover'].forEach(eventName => {
            dropZone.addEventListener(eventName, () => {
                dropZone.classList.add('dragover');
            }, false);
        });

        ['dragleave', 'drop'].forEach(eventName => {
            dropZone.addEventListener(eventName, () => {
                dropZone.classList.remove('dragover');
            }, false);
        });

        dropZone.addEventListener('drop', (e) => {
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                this.handleFileSelection(files[0]);
            }
        }, false);
    }

    preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    async openFile() {
        try {
            if (this.isElectron) {
                await this.openFileElectron();
            } else if (this.isCapacitor) {
                await this.openFileCapacitor();
            } else {
                await this.openFileWeb();
            }
        } catch (error) {
            console.error('Error opening file:', error);
            this.showError('파일을 열 수 없습니다: ' + error.message);
        }
    }

    async openFileElectron() {
        try {
            // Call Electron main process to open file dialog
            const result = await window.electronAPI?.showOpenDialog();
            if (result && !result.canceled && result.filePaths.length > 0) {
                const fileData = await window.electronAPI?.readFile(result.filePaths[0]);
                if (fileData) {
                    this.loadFileFromElectron(fileData.filePath, fileData.content);
                }
            }
        } catch (error) {
            console.error('Error opening file in Electron:', error);
            this.showError('파일을 열 수 없습니다: ' + error.message);
        }
    }

    // Electron에서 파일을 로드하는 메서드
    loadFileFromElectron(filePath, content) {
        const fileName = filePath.split('\\').pop().split('/').pop();
        const stats = { size: content.length };
        
        this.currentFile = {
            name: fileName,
            size: stats.size,
            type: 'text/plain',
            lastModified: Date.now()
        };

        this.displayFile(content);
    }

    async openFileCapacitor() {
        try {
            const result = await Dialog.confirm({
                title: '파일 선택',
                message: '텍스트 파일을 선택하시겠습니까?'
            });

            if (result.value) {
                // Capacitor의 파일 시스템 접근은 제한적이므로
                // 실제 구현에서는 파일 피커 플러그인이 필요합니다
                this.showInfo('Capacitor 환경에서는 파일 선택 플러그인이 필요합니다.');
            }
        } catch (error) {
            console.error('Capacitor file open error:', error);
            this.showError('파일을 열 수 없습니다.');
        }
    }

    async openFileWeb() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.txt,.log,.md,.js,.html,.css,.json,.xml,text/*';
        
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (file) {
                this.handleFileSelection(file);
            }
        };
        
        input.click();
    }

    async handleFileSelection(file) {
        this.showLoading(true);
        
        try {
            this.currentFile = {
                name: file.name,
                size: file.size,
                type: file.type,
                lastModified: file.lastModified
            };

            const content = await this.readFileContent(file);
            this.displayFile(content);
            
        } catch (error) {
            console.error('Error reading file:', error);
            this.showError('파일을 읽을 수 없습니다: ' + error.message);
        } finally {
            this.showLoading(false);
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

        this.elements.statusLeft.textContent = `파일 로드 완료: ${this.currentFile.name}`;
    }

    updateFileInfo() {
        if (!this.currentFile) return;

        const lines = this.currentContent.split('\n').length;
        const chars = this.currentContent.length;
        const sizeStr = this.formatFileSize(this.currentFile.size);
        const modifiedDate = new Date(this.currentFile.lastModified).toLocaleString('ko-KR');

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
        this.currentFile = null;
        this.currentContent = '';
        this.searchResults = [];
        this.currentSearchIndex = -1;

        this.elements.textContent.innerHTML = `
            <div id="dropZone" class="drop-zone">
                <div class="text-center">
                    <div class="text-4xl mb-4">📄</div>
                    <div class="text-lg font-medium mb-2">텍스트 파일을 열어주세요</div>
                    <div class="text-sm text-gray-500">
                        파일을 드래그하거나 "파일 열기" 버튼을 클릭하세요
                    </div>
                </div>
            </div>
        `;
        this.elements.textContent.classList.add('loading');

        this.elements.fileInfoContent.innerHTML = `
            <div class="text-center text-gray-500 py-8">
                파일을 열어주세요
            </div>
        `;

        this.elements.clearBtn.disabled = true;
        this.elements.searchBtn.disabled = true;
        this.elements.statusLeft.textContent = '준비됨';
        this.elements.fileSize.textContent = '';
        this.elements.encoding.textContent = '';
        this.elements.lineCount.textContent = '';

        this.closeSearch();
        this.setupDragAndDrop();
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