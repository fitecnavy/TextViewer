/**
 * Cross-platform Text Viewer Application
 * Supports Electron (Windows) and Capacitor (Android) platforms
 */

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

/**
 * Main TextViewer class for managing text file viewing and library
 */
class TextViewer {
    /**
     * Initialize TextViewer application
     */
    constructor() {
        // Current file state
        this.currentFile = null;
        this.currentContent = '';
        
        // Search functionality
        this.searchResults = [];
        this.currentSearchIndex = -1;
        
        // Platform detection
        this.isCapacitor = window.Capacitor && Capacitor.isNativePlatform();
        this.isElectron = window.navigator.userAgent.includes('Electron');
        
        // Library management
        this.library = [];
        this.selectedBook = null;
        this.currentView = 'library'; // 'library' or 'viewer'
        
        // View mode management
        this.viewMode = 'scroll'; // 'scroll' or 'page'
        this.lastScrollPosition = 0; // 스크롤 모드에서의 마지막 위치
        this.lastPagePosition = 1; // 페이지 모드에서의 마지막 페이지
        this.lastScrollTargetLine = 0; // 페이지 모드에서 스크롤 모드로 전환 시 목표 라인
        
        // Virtual scrolling for large files
        this.virtualScrolling = {
            enabled: false,
            chunkSize: 1000, // lines per chunk
            visibleChunks: 3, // chunks to keep in DOM
            currentChunk: 0,
            totalChunks: 0,
            chunks: [],
            container: null,
            viewport: null
        };
        
        // Paging system
        this.paging = {
            enabled: false,
            currentPage: 1,
            totalPages: 0,
            linesPerPage: 30,
            pages: [],
            turnInstance: null
        };
        
        // Theme system
        this.themes = {
            current: 'default',
            customThemes: [],
            defaultThemes: this.getDefaultThemes()
        };
        
        // Mode system
        this.modes = {
            theme: 'light', // 'light' or 'dark'
            reading: false,  // reading mode (minimal UI)
            fullscreen: false // fullscreen mode
        };
        
        this.initializeElements();
        this.bindEvents();
        this.registerServiceWorker();
        this.loadLibrary();
        this.loadThemes();
        this.loadSavedModes();
        
        // Make instance globally available for Electron
        window.textViewer = this;
    }

    /**
     * Initialize DOM element references
     */
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
            scrollContent: document.getElementById('scrollContent'),
            pageContent: document.getElementById('pageContent'),
            pageBook: document.getElementById('pageBook'),
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
            currentBookTitle: document.getElementById('currentBookTitle'),
            // View mode elements
            viewModeControls: document.getElementById('viewModeControls'),
            scrollModeBtn: document.getElementById('scrollModeBtn'),
            pageModeBtn: document.getElementById('pageModeBtn'),
            pageControls: document.getElementById('pageControls'),
            prevPageBtn: document.getElementById('prevPageBtn'),
            nextPageBtn: document.getElementById('nextPageBtn'),
            pageInfo: document.getElementById('pageInfo'),
            // Theme elements
            themeTab: document.getElementById('themeTab'),
            themeTabContent: document.getElementById('themeTabContent'),
            fileInfoTab: document.getElementById('fileInfoTab'),
            fileInfoTabContent: document.getElementById('fileInfoTabContent'),
            // Mode control elements
            modeControls: document.getElementById('modeControls'),
            themeToggleBtn: document.getElementById('themeToggleBtn'),
            readingModeBtn: document.getElementById('readingModeBtn'),
            fullscreenBtn: document.getElementById('fullscreenBtn')
        };
    }

    /**
     * Bind event listeners to UI elements
     */
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
        
        // View mode events
        this.elements.scrollModeBtn.addEventListener('click', () => this.setViewMode('scroll'));
        this.elements.pageModeBtn.addEventListener('click', () => this.setViewMode('page'));
        
        // Page navigation events
        this.elements.prevPageBtn.addEventListener('click', () => this.previousPage());
        this.elements.nextPageBtn.addEventListener('click', () => this.nextPage());
        
        // Theme tab events
        if (this.elements.themeTab) {
            this.elements.themeTab.addEventListener('click', () => this.showThemeTab());
        }
        if (this.elements.fileInfoTab) {
            this.elements.fileInfoTab.addEventListener('click', () => this.showFileInfoTab());
        }
        
        // Mode control events
        this.elements.themeToggleBtn.addEventListener('click', () => this.toggleDarkMode());
        this.elements.readingModeBtn.addEventListener('click', () => this.toggleReadingMode());
        this.elements.fullscreenBtn.addEventListener('click', () => this.toggleFullscreen());

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
                    case 'p':
                        e.preventDefault();
                        if (this.currentView === 'viewer') this.setViewMode('page');
                        break;
                    case 's':
                        e.preventDefault();
                        if (this.currentView === 'viewer') this.setViewMode('scroll');
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
            
            // 페이지 네비게이션 키보드 단축키
            if (this.currentView === 'viewer' && this.viewMode === 'page') {
                if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
                    e.preventDefault();
                    this.previousPage();
                } else if (e.key === 'ArrowRight' || e.key === 'PageDown') {
                    e.preventDefault();
                    this.nextPage();
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


    /**
     * Add a new book to the library based on platform
     */
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
            this.showError('책을 추가할 수 없습니다.', error);
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
            this.showError('Electron에서 책을 추가할 수 없습니다.', error);
        }
    }

    // Electron에서 파일을 로드하는 메서드
    addBookFromElectronData(filePath, content, encoding = 'UTF-8') {
        const fileName = filePath.split('\\').pop().split('/').pop();
        
        const book = {
            id: Date.now() + Math.random(),
            name: fileName,
            size: content.length,
            type: 'text/plain',
            lastModified: Date.now(),
            content: content,
            encoding: encoding,
            detectedEncoding: encoding, // 원래 감지된 인코딩 저장
            filePath: filePath,
            addedDate: new Date().toISOString()
        };

        this.addBookToLibrary(book);
    }

    async addBookCapacitor() {
        // Capacitor에서도 웹 방식의 파일 선택 사용
        await this.addBookWeb();
    }

    async addBookWeb() {
        try {
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
        } catch (error) {
            this.showError('파일 선택 중 오류가 발생했습니다.', error);
        }
    }

    async addBookFromFile(file) {
        this.showLoading(true);
        
        try {
            const result = await this.readFileContent(file);
            
            const book = {
                id: Date.now() + Math.random(),
                name: file.name,
                size: file.size,
                type: file.type,
                lastModified: file.lastModified,
                content: result.content,
                encoding: result.encoding,
                detectedEncoding: result.encoding, // 원래 감지된 인코딩 저장
                originalFile: file, // 인코딩 변경을 위해 원본 파일 참조 저장
                addedDate: new Date().toISOString()
            };

            this.addBookToLibrary(book);
            
        } catch (error) {
            this.showError('파일을 읽을 수 없습니다.', error);
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
            // 서재 로딩 실패는 사용자에게 알리지 않음 (빈 서재로 시작)
        }
        
        this.renderLibrary();
        this.updateLibraryStats();
    }

    saveLibrary() {
        try {
            // 원본 파일 참조를 제외하고 저장 (File 객체는 직렬화할 수 없음)
            const libraryToSave = this.library.map(book => {
                const { originalFile, ...bookWithoutFile } = book;
                return bookWithoutFile;
            });
            localStorage.setItem('textviewer-library', JSON.stringify(libraryToSave));
        } catch (error) {
            this.showError('서재 저장에 실패했습니다.', error);
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

    updateUIState() {
        this.elements.addBookBtn.innerHTML = '📖 책 추가하기';
    }

    showLibrary() {
        this.currentView = 'library';
        this.elements.libraryView.classList.remove('hidden');
        this.elements.textViewer.classList.add('hidden');
        this.elements.sidebar.classList.remove('active');
        this.closeSearch();
        
        // 페이지 모드 완전 정리
        this.cleanupPageMode();
        
        // 스크롤 모드도 정리
        this.elements.scrollContent.innerHTML = '';
        this.virtualScrolling.enabled = false;
        
        this.updateUIState();
        this.elements.searchBtn.disabled = true;
        this.elements.backToLibraryBtn.classList.add('hidden');
        this.elements.viewModeControls.classList.add('hidden');
        this.elements.statusLeft.textContent = '서재';
        
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
        
        this.updateUIState();
        this.elements.searchBtn.disabled = false;
        this.elements.backToLibraryBtn.classList.remove('hidden');
        this.elements.viewModeControls.classList.remove('hidden');
        
        if (this.selectedBook) {
            this.elements.currentBookTitle.textContent = this.selectedBook.name;
        }
    }
    
    setViewMode(mode) {
        console.log('[페이지모드] 뷰 모드 변경 요청:', this.viewMode, '->', mode);
        if (this.viewMode === mode) return;
        
        const oldMode = this.viewMode;
        
        // 현재 위치 정보를 실시간으로 계산하여 저장 (더 정확한 위치 동기화)
        if (oldMode === 'scroll') {
            // 스크롤 모드에서는 현재 보이는 라인을 기준으로 저장
            const currentVisibleLine = this.getCurrentVisibleLineFromScroll();
            this.lastPagePosition = this.getPageFromLine(currentVisibleLine);
            console.log(`[페이지모드] 스크롤 모드 -> 페이지 모드: 현재 라인 ${currentVisibleLine}, 목표 페이지 ${this.lastPagePosition}`);
        } else if (oldMode === 'page') {
            // 페이지 모드에서는 현재 페이지의 첫 번째 라인을 기준으로 저장
            const firstLine = this.getFirstLineFromCurrentPage();
            this.lastScrollTargetLine = firstLine;
            console.log(`[페이지모드] 페이지 모드 -> 스크롤 모드: 현재 페이지 ${this.paging.currentPage}, 목표 라인 ${firstLine}`);
        }
        
        // 뷰 모드 변경
        this.viewMode = mode;
        
        // 버튼 상태 업데이트
        this.elements.scrollModeBtn.classList.toggle('active', mode === 'scroll');
        this.elements.pageModeBtn.classList.toggle('active', mode === 'page');
        
        // 뷰 렌더링
        if (this.currentContent) {
            // 이전 모드 정리 후 새 모드 렌더링
            if (oldMode === 'page') {
                this.cleanupPageMode();
            }
            
            this.renderCurrentView();
            
            // 저장된 위치로 이동 (페이지 모드는 더 긴 지연시간 필요)
            const delay = mode === 'page' ? 300 : 150;
            setTimeout(() => {
                if (mode === 'scroll') {
                    this.restoreScrollPositionFromLine();
                } else if (mode === 'page') {
                    this.restorePagePosition();
                }
            }, delay);
        }
    }
    
    /**
     * 페이지 모드 정리 함수
     */
    cleanupPageMode() {
        console.log('[페이지모드] cleanupPageMode 시작');
        if (this.paging.turnInstance) {
            try {
                console.log('[페이지모드] Turn.js 인스턴스 정리 중');
                // Turn.js 이벤트 리스너 제거
                $(this.elements.pageBook).off('.turn');
                
                // Turn.js 인스턴스 제거
                if ($(this.elements.pageBook).turn('is')) {
                    $(this.elements.pageBook).turn('destroy');
                }
                
                this.paging.turnInstance = null;
                console.log('[페이지모드] Turn.js 인스턴스 정리 완료');
            } catch (error) {
                console.warn('[페이지모드] Turn.js cleanup error:', error);
                this.paging.turnInstance = null;
            }
        }
        
        // 페이지 컨테이너 완전 초기화
        console.log('[페이지모드] 페이지 컨테이너 초기화');
        this.elements.pageBook.innerHTML = '';
        this.elements.pageBook.className = 'page-book';
        
        // 페이징 상태 초기화
        this.paging.pages = [];
        console.log('[페이지모드] cleanupPageMode 완료');
    }

    setupPageMode() {
        console.log('[페이지모드] setupPageMode 시작');
        // 기존 인스턴스 완전 정리
        this.cleanupPageMode();
        
        // jQuery 및 Turn.js 라이브러리 확인
        console.log('[페이지모드] 라이브러리 확인 - jQuery:', typeof $, 'Turn.js:', typeof $.fn?.turn);
        if (typeof $ === 'undefined' || typeof $.fn?.turn === 'undefined') {
            console.error('[페이지모드] jQuery 또는 Turn.js 라이브러리를 찾을 수 없습니다.');
            // 대체 방법: 간단한 페이지 네비게이션 사용
            this.setupSimplePageMode();
            return;
        }
        
        // 플랫폼에 따른 페이지 설정
        const isWindows = this.isElectron;
        console.log('[페이지모드] 플랫폼 설정 - isWindows:', isWindows, 'isElectron:', this.isElectron);
        
        // 페이지 생성
        console.log('[페이지모드] 페이지 생성 시작');
        this.createPages(isWindows);
        
        // DOM 업데이트 완료 후 Turn.js 초기화
        setTimeout(() => {
            try {
                const $pageBook = $(this.elements.pageBook);
                
                // 컨테이너 크기 계산
                const containerWidth = this.elements.pageContent.offsetWidth;
                const containerHeight = this.elements.pageContent.offsetHeight;
                const pageWidth = Math.min(containerWidth * (isWindows ? 0.9 : 0.8), 800);
                const pageHeight = Math.min(containerHeight * 0.85, 600);
                
                console.log('[페이지모드] Turn.js 초기화 시작:', { 
                    pageWidth, 
                    pageHeight, 
                    isWindows, 
                    totalPages: this.paging.totalPages, 
                    pageBookElement: this.elements.pageBook,
                    pageBookChildren: this.elements.pageBook.children.length,
                    jqueryExists: typeof $ !== 'undefined',
                    turnExists: typeof $.fn.turn !== 'undefined'
                });
                
                // Turn.js 초기화
                $pageBook.turn({
                    width: pageWidth,
                    height: pageHeight,
                    autoCenter: true,
                    display: isWindows ? 'double' : 'single',
                    acceleration: true,
                    gradients: true,
                    elevation: 50,
                    page: isWindows ? 2 : 1, // Windows에서는 커버 다음 페이지부터 시작
                    when: {
                        turning: (event, page, view) => {
                            console.log('페이지 전환 중:', page);
                            this.paging.currentPage = page;
                            this.updatePageInfo();
                        },
                        turned: (event, page, view) => {
                            console.log('페이지 전환 완료:', page);
                            this.paging.currentPage = page;
                            this.updatePageInfo();
                        }
                    }
                });
                
                this.paging.turnInstance = $pageBook;
                this.paging.currentPage = isWindows ? 2 : 1;
                this.updatePageInfo();
                
                console.log('[페이지모드] Turn.js 초기화 완료 - 현재페이지:', this.paging.currentPage, '총페이지:', this.paging.totalPages);
                
                // 컨테이너 중앙 정렬
                this.elements.pageContent.style.display = 'flex';
                this.elements.pageContent.style.alignItems = 'center';
                this.elements.pageContent.style.justifyContent = 'center';
                
            } catch (error) {
                console.error('[페이지모드] Turn.js initialization error:', error);
                this.showError('페이지 모드 초기화에 실패했습니다: ' + error.message);
            }
        }, 100);
    }
    
    createPages(isWindows) {
        console.log('[페이지모드] createPages 시작 - isWindows:', isWindows);
        // 기존 페이지 제거
        this.elements.pageBook.innerHTML = '';
        
        console.log('[페이지모드] 페이지 생성 시작:', this.paging.pages.length, '페이지');
        
        this.paging.pages.forEach((pageData, index) => {
            const pageDiv = document.createElement('div');
            pageDiv.className = 'page-item';
            
            if (pageData.isCover) {
                // 커버 페이지
                pageDiv.innerHTML = `
                    <div class="cover-page">
                        <div class="text-center">
                            <h1 class="text-2xl font-bold text-gray-800 mb-4">${this.selectedBook ? this.selectedBook.name : '제목 없음'}</h1>
                            <p class="text-gray-600">Text Viewer</p>
                            <div class="mt-4 text-sm text-gray-500">
                                총 ${this.paging.totalPages}페이지
                            </div>
                        </div>
                    </div>
                `;
            } else {
                // 내용 페이지
                const contentDiv = document.createElement('div');
                contentDiv.className = 'page-text';
                contentDiv.textContent = pageData.lines.join('\n');
                
                // 페이지 번호 추가
                const pageNumber = document.createElement('div');
                pageNumber.className = 'page-number';
                pageNumber.textContent = pageData.pageNumber;
                
                pageDiv.appendChild(contentDiv);
                pageDiv.appendChild(pageNumber);
            }
            
            // 페이지 ID 설정 (Turn.js에서 필요)
            pageDiv.id = `page-${index}`;
            
            this.elements.pageBook.appendChild(pageDiv);
            console.log(`[페이지모드] 페이지 ${index + 1} 생성 완료 - isCover: ${pageData.isCover}, lines: ${pageData.lines.length}`);
        });
        
        console.log('[페이지모드] createPages 완료 - 총 생성된 페이지:', this.elements.pageBook.children.length);
        
        console.log('페이지 생성 완료, DOM 요소 수:', this.elements.pageBook.children.length);
    }
    
    previousPage() {
        if (this.paging.turnInstance && this.paging.currentPage > 1) {
            this.paging.turnInstance.turn('previous');
        }
    }
    
    nextPage() {
        if (this.paging.turnInstance && this.paging.currentPage < this.paging.totalPages) {
            this.paging.turnInstance.turn('next');
        }
    }
    
    updatePageInfo() {
        // Windows 더블 페이지 모드에서는 커버를 제외한 실제 페이지 번호 표시
        let displayPage = this.paging.currentPage;
        let displayTotal = this.paging.totalPages;
        
        if (this.isElectron && this.paging.currentPage > 1) {
            displayPage = this.paging.currentPage - 1; // 커버 페이지 제외
        }
        
        this.elements.pageInfo.textContent = `${displayPage} / ${displayTotal}`;
    }
    
    // 위치 동기화 메서드들
    saveScrollPosition() {
        if (this.virtualScrolling.enabled && this.virtualScrolling.container) {
            this.lastScrollPosition = this.virtualScrolling.container.scrollTop;
        } else {
            const scrollElement = this.elements.scrollContent;
            this.lastScrollPosition = scrollElement.scrollTop;
        }
    }
    
    savePagePosition() {
        this.lastPagePosition = this.paging.currentPage;
    }
    
    /**
     * 스크롤 위치에서 현재 보이는 라인 번호 계산
     */
    getCurrentVisibleLineFromScroll() {
        const lines = this.currentContent.split('\n');
        let currentLine = 0;
        
        if (this.virtualScrolling.enabled && this.virtualScrolling.container) {
            // 가상 스크롤링의 경우
            const scrollTop = this.virtualScrolling.container.scrollTop;
            const estimatedLineHeight = 20; // 대략적인 줄 높이
            currentLine = Math.floor(scrollTop / estimatedLineHeight);
        } else {
            // 일반 스크롤의 경우
            const scrollElement = this.elements.scrollContent;
            const scrollTop = scrollElement.scrollTop;
            const scrollHeight = scrollElement.scrollHeight;
            const clientHeight = scrollElement.clientHeight;
            
            if (scrollHeight > clientHeight) {
                const scrollRatio = scrollTop / (scrollHeight - clientHeight);
                currentLine = Math.floor(scrollRatio * lines.length);
            }
        }
        
        return Math.max(0, Math.min(currentLine, lines.length - 1));
    }
    
    /**
     * 페이지에서 첫 번째 라인 번호 계산
     */
    getFirstLineFromCurrentPage() {
        if (!this.paging.currentPage || this.paging.currentPage <= 0) {
            return 0;
        }
        
        let pageIndex = this.paging.currentPage - 1;
        
        // Windows 더블 페이지 모드에서는 커버 페이지 제외
        if (this.isElectron && this.paging.currentPage > 1) {
            pageIndex = this.paging.currentPage - 2; // 커버 페이지 제외
        }
        
        if (pageIndex < 0) {
            return 0;
        }
        
        return pageIndex * this.paging.linesPerPage;
    }
    
    /**
     * 라인 번호에서 해당하는 페이지 번호 계산
     */
    getPageFromLine(lineNumber) {
        const pageIndex = Math.floor(lineNumber / this.paging.linesPerPage);
        
        // Windows 더블 페이지 모드에서는 커버 페이지 고려
        if (this.isElectron) {
            return pageIndex + 2; // 커버 페이지 포함
        }
        
        return pageIndex + 1;
    }
    
    restoreScrollPosition() {
        // 기존 저장된 스크롤 위치로 복원 (파일 열기 등에서 사용)
        if (this.virtualScrolling.enabled && this.virtualScrolling.container) {
            this.virtualScrolling.container.scrollTop = this.lastScrollPosition;
        } else {
            const scrollElement = this.elements.scrollContent;
            scrollElement.scrollTop = this.lastScrollPosition;
        }
    }
    
    restoreScrollPositionFromLine() {
        // 페이지 모드에서 스크롤 모드로 전환 시: 지정된 라인이 뷰포트 상단에 오도록 스크롤
        const targetLine = this.lastScrollTargetLine || 0;
        const lines = this.currentContent.split('\n');
        
        console.log(`스크롤 위치 복원: 목표 라인 ${targetLine}`);
        
        if (this.virtualScrolling.enabled && this.virtualScrolling.container) {
            // 가상 스크롤링이 활성된 경우
            const estimatedLineHeight = 20;
            const targetScrollTop = targetLine * estimatedLineHeight;
            this.virtualScrolling.container.scrollTop = targetScrollTop;
            console.log(`가상 스크롤: scrollTop = ${targetScrollTop}`);
        } else {
            // 일반 스크롤의 경우
            const scrollElement = this.elements.scrollContent;
            const pre = scrollElement.querySelector('pre');
            if (pre && targetLine < lines.length) {
                // 해당 라인까지의 문자 수 계산
                const targetCharIndex = targetLine > 0 ? lines.slice(0, targetLine).join('\n').length : 0;
                const content = pre.textContent || pre.innerText;
                
                if (content.length > 0) {
                    // 대략적인 스크롤 위치 계산
                    const totalHeight = scrollElement.scrollHeight;
                    const clientHeight = scrollElement.clientHeight;
                    const scrollableHeight = totalHeight - clientHeight;
                    
                    if (scrollableHeight > 0) {
                        const scrollRatio = targetCharIndex / content.length;
                        const targetScrollTop = scrollableHeight * scrollRatio;
                        scrollElement.scrollTop = targetScrollTop;
                        console.log(`일반 스크롤: scrollTop = ${targetScrollTop}, ratio = ${scrollRatio}`);
                    }
                }
            }
        }
    }
    
    restorePagePosition() {
        // 스크롤 모드에서 페이지 모드로 전환 시: 저장된 목표 페이지로 이동
        const targetPage = this.lastPagePosition || 1;
        
        // 페이지 범위 검사
        const validTargetPage = Math.min(Math.max(1, targetPage), this.paging.totalPages);
        
        // Windows 더블 페이지 모드에서 커버 페이지 고려
        let finalTargetPage = validTargetPage;
        if (this.isElectron) {
            finalTargetPage = validTargetPage === 1 ? 2 : validTargetPage;
        }
        
        console.log(`페이지 위치 복원: 목표 페이지 ${targetPage} -> 최종 페이지 ${finalTargetPage}`);
        
        // 페이지로 이동
        if (this.paging.turnInstance) {
            setTimeout(() => {
                try {
                    if (finalTargetPage !== this.paging.currentPage) {
                        this.paging.turnInstance.turn('page', finalTargetPage);
                    }
                    this.paging.currentPage = finalTargetPage;
                    this.updatePageInfo();
                    console.log(`페이지 이동 완료: ${finalTargetPage}`);
                } catch (error) {
                    console.warn('페이지 이동 오류:', error);
                }
            }, 100);
        }
    }

    /**
     * 파일 인코딩 감지
     */
    async detectFileEncoding(file) {
        return new Promise((resolve) => {
            const reader = new FileReader();
            
            reader.onload = (e) => {
                const buffer = new Uint8Array(e.target.result);
                const encoding = this.detectEncodingFromBuffer(buffer);
                resolve(encoding);
            };
            
            reader.onerror = () => {
                // 오류 발생 시 기본값 반환
                resolve('UTF-8');
            };
            
            // 첫 1KB만 읽어서 인코딩 감지
            const sampleSize = Math.min(file.size, 1024);
            const blob = file.slice(0, sampleSize);
            reader.readAsArrayBuffer(blob);
        });
    }
    
    /**
     * 바이트 버퍼에서 인코딩 감지
     */
    detectEncodingFromBuffer(buffer) {
        console.log('[인코딩 감지] 버퍼 크기:', buffer.length, '바이트');
        
        // BOM 체크
        if (buffer.length >= 3) {
            // UTF-8 BOM
            if (buffer[0] === 0xEF && buffer[1] === 0xBB && buffer[2] === 0xBF) {
                console.log('[인코딩 감지] UTF-8 BOM 발견');
                return 'UTF-8';
            }
            // UTF-16 BE BOM
            if (buffer[0] === 0xFE && buffer[1] === 0xFF) {
                console.log('[인코딩 감지] UTF-16BE BOM 발견');
                return 'UTF-16BE';
            }
            // UTF-16 LE BOM
            if (buffer[0] === 0xFF && buffer[1] === 0xFE) {
                console.log('[인코딩 감지] UTF-16LE BOM 발견');
                return 'UTF-16LE';
            }
        }
        
        // 한글 특성 기반 EUC-KR vs UTF-8 감지
        let eucKrScore = 0;
        let utf8Score = 0;
        let invalidUtf8Sequences = 0;
        let validUtf8Sequences = 0;
        
        for (let i = 0; i < buffer.length; i++) {
            const byte1 = buffer[i];
            
            // EUC-KR 한글 범위 체크
            if (i < buffer.length - 1) {
                const byte2 = buffer[i + 1];
                // EUC-KR 완성형 한글 (0xB0A1 ~ 0xC8FE)
                if (byte1 >= 0xB0 && byte1 <= 0xC8 && byte2 >= 0xA1 && byte2 <= 0xFE) {
                    eucKrScore += 2;
                }
                // EUC-KR 확장 영역
                if (byte1 >= 0xA1 && byte1 <= 0xAC && byte2 >= 0xA1 && byte2 <= 0xFE) {
                    eucKrScore += 1;
                }
            }
            
            // UTF-8 유효성 검증
            if (byte1 >= 0xC0) {
                let bytesToCheck = 0;
                let validSequence = true;
                
                // UTF-8 시작 바이트 분석
                if ((byte1 & 0xE0) === 0xC0) bytesToCheck = 1; // 2바이트 문자
                else if ((byte1 & 0xF0) === 0xE0) bytesToCheck = 2; // 3바이트 문자
                else if ((byte1 & 0xF8) === 0xF0) bytesToCheck = 3; // 4바이트 문자
                else validSequence = false;
                
                // 연속 바이트 검증
                for (let j = 1; j <= bytesToCheck && i + j < buffer.length; j++) {
                    const nextByte = buffer[i + j];
                    if ((nextByte & 0xC0) !== 0x80) {
                        validSequence = false;
                        break;
                    }
                }
                
                if (validSequence && i + bytesToCheck < buffer.length) {
                    // 한글 UTF-8 범위 체크 (U+AC00-U+D7AF)
                    if (bytesToCheck === 2 && (byte1 & 0xF0) === 0xE0) {
                        const byte2 = buffer[i + 1];
                        const byte3 = buffer[i + 2];
                        const codepoint = ((byte1 & 0x0F) << 12) | ((byte2 & 0x3F) << 6) | (byte3 & 0x3F);
                        if (codepoint >= 0xAC00 && codepoint <= 0xD7AF) {
                            utf8Score += 3; // 한글 UTF-8
                        } else if (codepoint >= 0x0080) {
                            utf8Score += 1; // 기타 UTF-8
                        }
                    }
                    validUtf8Sequences++;
                    i += bytesToCheck; // 검증된 바이트들 건너뛰기
                } else {
                    invalidUtf8Sequences++;
                }
            }
        }
        
        // ASCII 비율 계산
        let asciiCount = 0;
        let highBitCount = 0;
        
        for (let i = 0; i < buffer.length; i++) {
            if (buffer[i] <= 0x7F) {
                asciiCount++;
            } else {
                highBitCount++;
            }
        }
        
        const asciiRatio = asciiCount / buffer.length;
        
        console.log('[인코딩 감지] 통계:', {
            eucKrScore,
            utf8Score,
            validUtf8Sequences,
            invalidUtf8Sequences,
            asciiRatio: asciiRatio.toFixed(3),
            highBitCount
        });
        
        // 모든 문자가 ASCII인 경우
        if (highBitCount === 0) {
            console.log('[인코딩 감지] 순수 ASCII 파일 -> UTF-8');
            return 'UTF-8';
        }
        
        // UTF-8 유효성이 높고 한글이 감지된 경우
        if (validUtf8Sequences > 0 && invalidUtf8Sequences === 0 && utf8Score > 0) {
            console.log('[인코딩 감지] 유효한 UTF-8 시퀀스 감지 -> UTF-8');
            return 'UTF-8';
        }
        
        // EUC-KR 점수가 높은 경우
        if (eucKrScore > utf8Score && eucKrScore > 0) {
            console.log('[인코딩 감지] EUC-KR 패턴 감지 -> EUC-KR');
            return 'EUC-KR';
        }
        
        // UTF-8 점수가 있는 경우
        if (utf8Score > 0) {
            console.log('[인코딩 감지] UTF-8 패턴 감지 -> UTF-8');
            return 'UTF-8';
        }
        
        // 고비트 문자가 있지만 명확하지 않은 경우, 한국어 파일일 가능성 고려
        if (highBitCount > 0) {
            console.log('[인코딩 감지] 명확하지 않은 고비트 문자, EUC-KR 추정 -> EUC-KR');
            return 'EUC-KR';
        }
        
        // 기본값
        console.log('[인코딩 감지] 기본값 사용 -> UTF-8');
        return 'UTF-8';
    }

    async readFileContent(file) {
        // 대용량 파일의 경우 스트리밍 방식 사용
        if (file.size > 50 * 1024 * 1024) { // 50MB 이상
            const result = await this.readFileInChunks(file);
            return {
                content: result,
                encoding: 'UTF-8' // 대용량 파일은 기본 UTF-8로 처리
            };
        }
        
        // 파일 인코딩 감지
        const detectedEncoding = await this.detectFileEncoding(file);
        
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = (e) => {
                const content = e.target.result;
                // 인코딩 정보도 함께 반환
                resolve({
                    content: content,
                    encoding: detectedEncoding
                });
            };
            
            reader.onerror = () => {
                reject(new Error('파일 읽기 실패'));
            };
            
            // 감지된 인코딩으로 읽기
            reader.readAsText(file, detectedEncoding);
        });
    }
    
    async readFileInChunks(file) {
        const chunkSize = 1024 * 1024; // 1MB 단위로 읽기
        let offset = 0;
        let content = '';
        
        while (offset < file.size) {
            const chunk = file.slice(offset, offset + chunkSize);
            const chunkContent = await this.readChunk(chunk);
            content += chunkContent;
            offset += chunkSize;
            
            // UI 블로킹 방지
            if (offset % (chunkSize * 10) === 0) {
                await new Promise(resolve => setTimeout(resolve, 10));
            }
        }
        
        return content;
    }
    
    readChunk(chunk) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = () => reject(new Error('청크 읽기 실패'));
            reader.readAsText(chunk, 'UTF-8');
        });
    }

    displayFile(content) {
        this.currentContent = content;
        
        // 컨텐트 초기화
        this.elements.scrollContent.innerHTML = '';
        this.elements.scrollContent.classList.remove('loading');
        
        // 라인 분할
        const lines = content.split('\n');
        
        // 페이징 데이터 준비
        this.preparePagingData(lines);
        
        // 현재 뷰 모드에 따라 표시
        this.renderCurrentView();
        
        // 테마 적용
        this.updateContentTheme();

        // 파일 정보 업데이트
        this.updateFileInfo();
        this.updateStatusBar();
        
        // 버튼 상태 업데이트
        this.elements.searchBtn.disabled = false;

        const displayName = this.selectedBook ? this.selectedBook.name : this.currentFile.name;
        this.elements.statusLeft.textContent = `읽는 중: ${displayName}`;
    }
    
    preparePagingData(lines) {
        console.log('[페이지모드] preparePagingData 시작 - 총 라인수:', lines.length);
        // 페이지별로 라인 분할
        this.paging.pages = [];
        this.paging.totalPages = Math.ceil(lines.length / this.paging.linesPerPage);
        
        console.log('페이징 데이터 준비:', { 
            totalLines: lines.length, 
            linesPerPage: this.paging.linesPerPage, 
            totalPages: this.paging.totalPages,
            isElectron: this.isElectron 
        });
        
        // Windows 더블 페이지 모드를 위해 커버 페이지 추가
        if (this.isElectron) {
            // 커버 페이지 (페이지 0)
            this.paging.pages.push({
                pageNumber: 0,
                lines: [],
                isCover: true
            });
        }
        
        for (let i = 0; i < this.paging.totalPages; i++) {
            const start = i * this.paging.linesPerPage;
            const end = Math.min(start + this.paging.linesPerPage, lines.length);
            const pageLines = lines.slice(start, end);
            
            this.paging.pages.push({
                pageNumber: i + 1,
                lines: pageLines,
                isCover: false
            });
            
            console.log(`페이지 ${i + 1} 준비: ${pageLines.length}줄 (${start}-${end})`);
        }
        
        // 실제 총 페이지 수 업데이트 (커버 페이지 포함)
        this.paging.totalPages = this.paging.pages.length;
        this.paging.currentPage = this.isElectron ? 2 : 1; // Windows에서는 커버 다음 페이지부터 시작
        
        console.log('페이징 데이터 준비 완료:', this.paging.pages.length, '페이지');
    }
    
    renderCurrentView() {
        if (this.viewMode === 'scroll') {
            this.renderScrollView();
        } else {
            this.renderPageView();
        }
    }
    
    renderScrollView() {
        // 페이지 모드에서 전환할 때 Turn.js 인스턴스 정리
        this.cleanupPageMode();
        
        // 스크롤 컨테이너 초기화
        this.elements.scrollContent.innerHTML = '';
        this.virtualScrolling.enabled = false;
        
        const lines = this.currentContent.split('\n');
        const isLargeFile = this.currentContent.length > 100000 || lines.length > 1000;
        
        if (isLargeFile) {
            this.enableVirtualScrolling(lines);
        } else {
            this.displayFullContent(this.currentContent);
        }
        
        // UI 상태 업데이트
        this.elements.scrollContent.classList.remove('hidden');
        this.elements.pageContent.classList.add('hidden');
        this.elements.pageControls.classList.add('hidden');
    }
    
    renderPageView() {
        console.log('[페이지모드] renderPageView 시작');
        this.setupPageMode();
        
        // UI 상태 업데이트
        console.log('[페이지모드] UI 상태 업데이트');
        this.elements.scrollContent.classList.add('hidden');
        this.elements.pageContent.classList.remove('hidden');
        this.elements.pageControls.classList.remove('hidden');
        
        console.log('[페이지모드] 페이지 정보 업데이트');
        this.updatePageInfo();
        console.log('[페이지모드] renderPageView 완료');
    }
    
    displayFullContent(content) {
        // 스크롤 컨테이너가 이미 초기화되어 있지만 확인차 정리
        if (this.elements.scrollContent.children.length > 0) {
            this.elements.scrollContent.innerHTML = '';
        }
        
        const pre = document.createElement('pre');
        pre.textContent = content;
        pre.className = 'whitespace-pre-wrap font-mono text-sm leading-relaxed p-6';
        this.elements.scrollContent.appendChild(pre);
    }
    
    enableVirtualScrolling(lines) {
        this.virtualScrolling.enabled = true;
        this.virtualScrolling.totalChunks = Math.ceil(lines.length / this.virtualScrolling.chunkSize);
        this.virtualScrolling.chunks = [];
        
        // 라인을 청크로 분할
        for (let i = 0; i < this.virtualScrolling.totalChunks; i++) {
            const start = i * this.virtualScrolling.chunkSize;
            const end = Math.min(start + this.virtualScrolling.chunkSize, lines.length);
            this.virtualScrolling.chunks.push({
                index: i,
                lines: lines.slice(start, end),
                element: null,
                rendered: false
            });
        }
        
        this.setupVirtualScrollContainer();
        this.renderVisibleChunks();
    }
    
    setupVirtualScrollContainer() {
        // 가상 스크롤 컨테이너 생성
        const container = document.createElement('div');
        container.className = 'virtual-scroll-container relative overflow-auto h-full';
        
        // 전체 높이를 나타내는 스페이서
        const spacer = document.createElement('div');
        const estimatedLineHeight = 20; // 대략적인 줄 높이
        const totalLines = this.virtualScrolling.chunks.reduce((sum, chunk) => sum + chunk.lines.length, 0);
        spacer.style.height = `${totalLines * estimatedLineHeight}px`;
        spacer.className = 'virtual-scroll-spacer';
        
        // 뷰포트
        const viewport = document.createElement('div');
        viewport.className = 'virtual-scroll-viewport absolute top-0 left-0 w-full';
        
        container.appendChild(spacer);
        container.appendChild(viewport);
        this.elements.scrollContent.appendChild(container);
        
        this.virtualScrolling.container = container;
        this.virtualScrolling.viewport = viewport;
        
        // 스크롤 이벤트 리스너
        container.addEventListener('scroll', () => this.handleVirtualScroll());
    }
    
    handleVirtualScroll() {
        if (!this.virtualScrolling.enabled) return;
        
        const container = this.virtualScrolling.container;
        const scrollTop = container.scrollTop;
        const containerHeight = container.clientHeight;
        const estimatedLineHeight = 20;
        
        // 현재 보이는 청크 계산
        const startLine = Math.floor(scrollTop / estimatedLineHeight);
        const endLine = Math.ceil((scrollTop + containerHeight) / estimatedLineHeight);
        
        const startChunk = Math.floor(startLine / this.virtualScrolling.chunkSize);
        const endChunk = Math.min(
            Math.ceil(endLine / this.virtualScrolling.chunkSize),
            this.virtualScrolling.totalChunks - 1
        );
        
        this.renderChunkRange(startChunk, endChunk);
    }
    
    renderChunkRange(startChunk, endChunk) {
        // 현재 렌더링된 청크들 중 범위 밖의 것들 제거
        this.virtualScrolling.chunks.forEach(chunk => {
            if (chunk.rendered && (chunk.index < startChunk || chunk.index > endChunk)) {
                if (chunk.element) {
                    chunk.element.remove();
                    chunk.element = null;
                    chunk.rendered = false;
                }
            }
        });
        
        // 새로운 범위의 청크들 렌더링
        for (let i = startChunk; i <= endChunk; i++) {
            this.renderChunk(i);
        }
    }
    
    renderChunk(chunkIndex) {
        if (chunkIndex < 0 || chunkIndex >= this.virtualScrolling.chunks.length) return;
        
        const chunk = this.virtualScrolling.chunks[chunkIndex];
        if (chunk.rendered) return;
        
        const chunkElement = document.createElement('pre');
        chunkElement.textContent = chunk.lines.join('\n');
        chunkElement.className = 'whitespace-pre-wrap font-mono text-sm leading-relaxed chunk-content';
        
        // 청크의 위치 계산
        const estimatedLineHeight = 20;
        const startLine = chunkIndex * this.virtualScrolling.chunkSize;
        const topOffset = startLine * estimatedLineHeight;
        
        chunkElement.style.position = 'absolute';
        chunkElement.style.top = `${topOffset}px`;
        chunkElement.style.left = '0';
        chunkElement.style.right = '0';
        chunkElement.style.padding = '24px';
        
        this.virtualScrolling.viewport.appendChild(chunkElement);
        
        chunk.element = chunkElement;
        chunk.rendered = true;
    }
    
    renderVisibleChunks() {
        // 초기에 첫 번째 청크들 렌더링
        const initialChunks = Math.min(this.virtualScrolling.visibleChunks, this.virtualScrolling.totalChunks);
        for (let i = 0; i < initialChunks; i++) {
            this.renderChunk(i);
        }
    }

    updateFileInfo() {
        if (!this.currentFile) return;

        const lines = this.currentContent.split('\n').length;
        const chars = this.currentContent.length;
        const sizeStr = this.formatFileSize(this.currentFile.size);
        const modifiedDate = new Date(this.currentFile.lastModified).toLocaleString('ko-KR');
        const currentEncoding = this.selectedBook?.encoding || this.currentFile.encoding || 'UTF-8';

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
            <div class="file-info-item">
                <span class="file-info-label">인코딩:</span>
                <span class="file-info-value">
                    <span class="encoding-badge ${currentEncoding === 'UTF-8' ? 'encoding-utf8' : currentEncoding === 'EUC-KR' ? 'encoding-euckr' : ''}" 
                          title="현재 파일 인코딩: ${currentEncoding}">
                        ${currentEncoding}
                    </span>
                    <span class="text-xs text-gray-500 ml-2">
                        ${this.selectedBook?.detectedEncoding && this.selectedBook.detectedEncoding !== currentEncoding 
                            ? `(원본: ${this.selectedBook.detectedEncoding})` 
                            : '(자동 감지됨)'}
                    </span>
                </span>
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
                <label class="file-info-label block mb-2">인코딩 변경:</label>
                <select class="encoding-selector" onchange="textViewer.changeEncoding(this.value)">
                    <option value="UTF-8" ${currentEncoding === 'UTF-8' ? 'selected' : ''}>UTF-8 (유니코드)</option>
                    <option value="EUC-KR" ${currentEncoding === 'EUC-KR' ? 'selected' : ''}>EUC-KR (한국어 완성형)</option>
                    <option value="CP949" ${currentEncoding === 'CP949' ? 'selected' : ''}>CP949 (한국어 확장완성형)</option>
                    <option value="ISO-8859-1" ${currentEncoding === 'ISO-8859-1' ? 'selected' : ''}>ISO-8859-1 (Latin-1)</option>
                    <option value="UTF-16LE" ${currentEncoding === 'UTF-16LE' ? 'selected' : ''}>UTF-16LE</option>
                    <option value="UTF-16BE" ${currentEncoding === 'UTF-16BE' ? 'selected' : ''}>UTF-16BE</option>
                </select>
                <div class="text-xs text-gray-500 mt-2">
                    💡 텍스트가 깨져 보이면 다른 인코딩을 시도해보세요
                    <br>
                    📋 EUC-KR: 구형 한국어 파일 | UTF-8: 최신 유니코드 표준
                </div>
            </div>
        `;
    }

    updateStatusBar() {
        if (!this.currentFile) return;

        const lines = this.currentContent.split('\n').length;
        const currentEncoding = this.selectedBook?.encoding || this.currentFile.encoding || 'UTF-8';
        this.elements.fileSize.textContent = this.formatFileSize(this.currentFile.size);
        this.elements.encoding.textContent = `${currentEncoding}`;
        this.elements.encoding.title = `파일 인코딩: ${currentEncoding}`;
        this.elements.lineCount.textContent = `${lines.toLocaleString()} 줄`;
        
        // 인코딩에 따른 스타일링
        this.elements.encoding.className = 'encoding-badge';
        if (currentEncoding === 'EUC-KR') {
            this.elements.encoding.classList.add('encoding-euckr');
        } else if (currentEncoding === 'UTF-8') {
            this.elements.encoding.classList.add('encoding-utf8');
        }
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

        // 가상 스크롤링이 활성된 경우 최적화된 검색
        if (this.virtualScrolling.enabled) {
            this.performVirtualSearch(query);
        } else {
            this.searchResults = this.findInText(query);
            this.currentSearchIndex = this.searchResults.length > 0 ? 0 : -1;
            this.highlightSearchResults();
        }
        
        this.updateSearchInfo();
        
        if (this.searchResults.length > 0) {
            this.scrollToCurrentResult();
        }
    }
    
    performVirtualSearch(query) {
        this.searchResults = [];
        let globalIndex = 0;
        
        // 각 청크에서 검색
        this.virtualScrolling.chunks.forEach(chunk => {
            const chunkText = chunk.lines.join('\n');
            const chunkResults = this.findInText(query, chunkText, globalIndex);
            this.searchResults.push(...chunkResults);
            globalIndex += chunkText.length + 1; // +1 for newline
        });
        
        this.currentSearchIndex = this.searchResults.length > 0 ? 0 : -1;
    }

    findInText(query, content = null, offset = 0) {
        const searchContent = content || this.currentContent;
        const results = [];
        const regex = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
        let match;

        while ((match = regex.exec(searchContent)) !== null) {
            results.push({
                index: match.index + offset,
                length: match[0].length,
                text: match[0],
                chunkIndex: content ? this.getChunkIndexForPosition(match.index + offset) : null
            });
        }

        return results;
    }
    
    getChunkIndexForPosition(position) {
        if (!this.virtualScrolling.enabled) return null;
        
        let currentPos = 0;
        for (let i = 0; i < this.virtualScrolling.chunks.length; i++) {
            const chunkText = this.virtualScrolling.chunks[i].lines.join('\n');
            if (position >= currentPos && position < currentPos + chunkText.length) {
                return i;
            }
            currentPos += chunkText.length + 1; // +1 for newline
        }
        return null;
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
        if (this.virtualScrolling.enabled) {
            this.scrollToVirtualResult();
        } else {
            const currentHighlight = this.elements.textContent.querySelector('.highlight.current');
            if (currentHighlight) {
                currentHighlight.scrollIntoView({ 
                    behavior: 'smooth', 
                    block: 'center' 
                });
            }
        }
    }
    
    scrollToVirtualResult() {
        if (this.currentSearchIndex < 0 || this.currentSearchIndex >= this.searchResults.length) return;
        
        const result = this.searchResults[this.currentSearchIndex];
        const chunkIndex = result.chunkIndex;
        
        if (chunkIndex !== null) {
            // 해당 청크가 렌더링되어 있지 않으면 렌더링
            if (!this.virtualScrolling.chunks[chunkIndex].rendered) {
                this.renderChunk(chunkIndex);
            }
            
            // 청크로 스크롤
            const estimatedLineHeight = 20;
            const targetLine = Math.floor(result.index / 50); // 대략적인 계산
            const scrollTop = targetLine * estimatedLineHeight;
            
            this.virtualScrolling.container.scrollTop = scrollTop;
        }
    }

    showLoading(show) {
        this.elements.loadingOverlay.classList.toggle('hidden', !show);
    }

    /**
     * Display error message with consistent handling across platforms
     * @param {string} message - Error message to display
     * @param {Error} [error] - Optional error object for logging
     */
    showError(message, error = null) {
        if (error) {
            console.error('Application Error:', error);
        }
        
        if (this.isCapacitor && Dialog) {
            Dialog.alert({
                title: '오류',
                message: message
            });
        } else {
            alert(message);
        }
    }

    /**
     * Display information message with consistent handling across platforms
     * @param {string} message - Information message to display
     */
    showInfo(message) {
        if (this.isCapacitor && Dialog) {
            Dialog.alert({
                title: '정보',
                message: message
            });
        } else {
            alert(message);
        }
    }
    
    // ========== 테마 시스템 메서드들 ==========
    
    getDefaultThemes() {
        return {
            'default': {
                name: '기본',
                fontFamily: 'D2Coding, "Noto Sans Mono CJK KR", Consolas, "Liberation Mono", monospace',
                fontSize: '14px',
                fontWeight: '400',
                letterSpacing: '0px',
                fontStretch: 'normal',
                lineHeight: '1.6',
                backgroundColor: '#ffffff',
                textColor: '#374151',
                selectionColor: '#3b82f6',
                highlightColor: '#fbbf24'
            },
            'dark': {
                name: '다크',
                fontFamily: 'D2Coding, "Noto Sans Mono CJK KR", Consolas, "Liberation Mono", monospace',
                fontSize: '14px',
                fontWeight: '400',
                letterSpacing: '0px',
                fontStretch: 'normal',
                lineHeight: '1.6',
                backgroundColor: '#1f2937',
                textColor: '#f9fafb',
                selectionColor: '#3b82f6',
                highlightColor: '#f59e0b'
            },
            'sepia': {
                name: '세피아',
                fontFamily: 'D2Coding, "Noto Sans Mono CJK KR", Consolas, "Liberation Mono", monospace',
                fontSize: '14px',
                fontWeight: '400',
                letterSpacing: '0px',
                fontStretch: 'normal',
                lineHeight: '1.6',
                backgroundColor: '#f7f3e9',
                textColor: '#5d4e37',
                selectionColor: '#8b7355',
                highlightColor: '#d2b48c'
            },
            'high-contrast': {
                name: '고대비',
                fontFamily: 'D2Coding, "Noto Sans Mono CJK KR", Consolas, "Liberation Mono", monospace',
                fontSize: '16px',
                fontWeight: '500',
                letterSpacing: '1px',
                fontStretch: 'normal',
                lineHeight: '1.8',
                backgroundColor: '#000000',
                textColor: '#ffffff',
                selectionColor: '#ffff00',
                highlightColor: '#00ff00'
            }
        };
    }
    
    loadThemes() {
        try {
            const savedThemes = localStorage.getItem('textviewer-custom-themes');
            if (savedThemes) {
                this.themes.customThemes = JSON.parse(savedThemes);
            }
            
            const currentTheme = localStorage.getItem('textviewer-current-theme');
            if (currentTheme) {
                this.themes.current = currentTheme;
                this.applyTheme(currentTheme);
            }
        } catch (error) {
            console.error('Error loading themes:', error);
        }
    }
    
    saveThemes() {
        try {
            localStorage.setItem('textviewer-custom-themes', JSON.stringify(this.themes.customThemes));
            localStorage.setItem('textviewer-current-theme', this.themes.current);
        } catch (error) {
            console.error('Error saving themes:', error);
        }
    }
    
    applyTheme(themeId) {
        const theme = this.getTheme(themeId);
        if (!theme) return;
        
        this.themes.current = themeId;
        
        // CSS 변수로 테마 적용
        const root = document.documentElement;
        root.style.setProperty('--theme-font-family', theme.fontFamily);
        root.style.setProperty('--theme-font-size', theme.fontSize);
        root.style.setProperty('--theme-font-weight', theme.fontWeight);
        root.style.setProperty('--theme-letter-spacing', theme.letterSpacing);
        root.style.setProperty('--theme-font-stretch', theme.fontStretch);
        root.style.setProperty('--theme-line-height', theme.lineHeight);
        root.style.setProperty('--theme-bg-color', theme.backgroundColor);
        root.style.setProperty('--theme-text-color', theme.textColor);
        root.style.setProperty('--theme-selection-color', theme.selectionColor);
        root.style.setProperty('--theme-highlight-color', theme.highlightColor);
        
        // 콘텐츠 영역에 테마 클래스 적용
        this.updateContentTheme();
        
        this.saveThemes();
    }
    
    updateContentTheme() {
        // 스크롤 콘텐츠에 테마 적용
        const scrollContent = this.elements.scrollContent;
        const pageContent = this.elements.pageContent;
        
        [scrollContent, pageContent].forEach(container => {
            if (container) {
                container.style.backgroundColor = 'var(--theme-bg-color)';
                container.style.color = 'var(--theme-text-color)';
                
                // 내부 텍스트 요소들에도 적용
                const textElements = container.querySelectorAll('pre, .page-text');
                textElements.forEach(element => {
                    element.style.fontFamily = 'var(--theme-font-family)';
                    element.style.fontSize = 'var(--theme-font-size)';
                    element.style.fontWeight = 'var(--theme-font-weight)';
                    element.style.letterSpacing = 'var(--theme-letter-spacing)';
                    element.style.fontStretch = 'var(--theme-font-stretch)';
                    element.style.lineHeight = 'var(--theme-line-height)';
                    element.style.backgroundColor = 'var(--theme-bg-color)';
                    element.style.color = 'var(--theme-text-color)';
                });
            }
        });
    }
    
    getTheme(themeId) {
        if (this.themes.defaultThemes[themeId]) {
            return this.themes.defaultThemes[themeId];
        }
        
        const customTheme = this.themes.customThemes.find(theme => theme.id === themeId);
        return customTheme || this.themes.defaultThemes['default'];
    }
    
    createCustomTheme(name, themeData) {
        const id = 'custom_' + Date.now();
        const customTheme = {
            id: id,
            name: name,
            ...themeData
        };
        
        this.themes.customThemes.push(customTheme);
        this.saveThemes();
        return id;
    }
    
    updateCustomTheme(themeId, themeData) {
        const index = this.themes.customThemes.findIndex(theme => theme.id === themeId);
        if (index !== -1) {
            this.themes.customThemes[index] = { ...this.themes.customThemes[index], ...themeData };
            this.saveThemes();
            return true;
        }
        return false;
    }
    
    deleteCustomTheme(themeId) {
        const index = this.themes.customThemes.findIndex(theme => theme.id === themeId);
        if (index !== -1) {
            this.themes.customThemes.splice(index, 1);
            if (this.themes.current === themeId) {
                this.applyTheme('default');
            }
            this.saveThemes();
            return true;
        }
        return false;
    }
    
    showThemeTab() {
        if (this.elements.themeTab && this.elements.fileInfoTab) {
            this.elements.themeTab.classList.add('active');
            this.elements.fileInfoTab.classList.remove('active');
            this.elements.themeTabContent.classList.remove('hidden');
            this.elements.fileInfoTabContent.classList.add('hidden');
            
            this.renderThemeSettings();
        }
    }
    
    showFileInfoTab() {
        if (this.elements.themeTab && this.elements.fileInfoTab) {
            this.elements.fileInfoTab.classList.add('active');
            this.elements.themeTab.classList.remove('active');
            this.elements.fileInfoTabContent.classList.remove('hidden');
            this.elements.themeTabContent.classList.add('hidden');
        }
    }
    
    renderThemeSettings() {
        if (!this.elements.themeTabContent) return;
        
        const allThemes = {
            ...this.themes.defaultThemes,
            ...this.themes.customThemes.reduce((acc, theme) => {
                acc[theme.id] = theme;
                return acc;
            }, {})
        };
        
        this.elements.themeTabContent.innerHTML = `
            <div class="theme-settings">
                <div class="mb-4">
                    <h3 class="text-lg font-semibold mb-3">테마 선택</h3>
                    <div class="theme-list space-y-2">
                        ${Object.entries(allThemes).map(([id, theme]) => `
                            <div class="theme-item flex items-center justify-between p-2 rounded hover:bg-gray-50 ${
                                this.themes.current === id ? 'bg-blue-50 border border-blue-200' : ''
                            }">
                                <label class="flex items-center cursor-pointer flex-1">
                                    <input type="radio" name="theme" value="${id}" ${
                                        this.themes.current === id ? 'checked' : ''
                                    } class="mr-2">
                                    <span class="font-medium">${theme.name}</span>
                                </label>
                                ${theme.id && theme.id.startsWith('custom_') ? `
                                    <div class="flex space-x-2">
                                        <button class="edit-theme-btn text-blue-500 hover:text-blue-700 text-sm" data-theme-id="${id}">
                                            편집
                                        </button>
                                        <button class="delete-theme-btn text-red-500 hover:text-red-700 text-sm" data-theme-id="${id}">
                                            삭제
                                        </button>
                                    </div>
                                ` : ''}
                            </div>
                        `).join('')}
                    </div>
                </div>
                
                <div class="mb-4">
                    <button class="btn btn-primary w-full create-theme-btn">
                        + 새 테마 만들기
                    </button>
                </div>
                
                <div class="theme-preview-container hidden" id="themePreview">
                    <h3 class="text-lg font-semibold mb-3">테마 편집</h3>
                    <div id="themeEditor"></div>
                </div>
            </div>
        `;
        
        this.bindThemeEvents();
    }
    
    bindThemeEvents() {
        // 테마 선택 이벤트
        const themeRadios = this.elements.themeTabContent.querySelectorAll('input[name="theme"]');
        themeRadios.forEach(radio => {
            radio.addEventListener('change', (e) => {
                if (e.target.checked) {
                    this.applyTheme(e.target.value);
                    this.renderThemeSettings(); // UI 업데이트
                }
            });
        });
        
        // 새 테마 만들기 버튼
        const createBtn = this.elements.themeTabContent.querySelector('.create-theme-btn');
        if (createBtn) {
            createBtn.addEventListener('click', () => this.showThemeEditor());
        }
        
        // 편집 버튼들
        const editBtns = this.elements.themeTabContent.querySelectorAll('.edit-theme-btn');
        editBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const themeId = btn.dataset.themeId;
                this.showThemeEditor(themeId);
            });
        });
        
        // 삭제 버튼들
        const deleteBtns = this.elements.themeTabContent.querySelectorAll('.delete-theme-btn');
        deleteBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const themeId = btn.dataset.themeId;
                if (confirm('이 테마를 삭제하시겠습니까?')) {
                    this.deleteCustomTheme(themeId);
                    this.renderThemeSettings();
                }
            });
        });
    }
    
    showThemeEditor(themeId = null) {
        const isEdit = themeId !== null;
        const theme = isEdit ? this.getTheme(themeId) : this.themes.defaultThemes['default'];
        
        const previewContainer = document.getElementById('themePreview');
        if (!previewContainer) return;
        
        previewContainer.classList.remove('hidden');
        
        // 사용 가능한 폰트 목록 가져오기
        const availableFonts = this.getAvailableFonts();
        
        const editor = document.getElementById('themeEditor');
        editor.innerHTML = `
            <form id="themeForm" class="space-y-4">
                <div class="grid grid-cols-1 gap-4">
                    <div>
                        <label class="block text-sm font-medium mb-1">테마 이름</label>
                        <input type="text" id="themeName" class="w-full p-2 border rounded" 
                               value="${isEdit ? theme.name : '새 테마'}" required>
                    </div>
                    
                    <div>
                        <label class="block text-sm font-medium mb-1">폰트 패밀리</label>
                        <select id="fontFamily" class="w-full p-2 border rounded">
                            ${availableFonts.map(font => `
                                <option value="${font.value}" ${theme.fontFamily === font.value ? 'selected' : ''}>
                                    ${font.label}
                                </option>
                            `).join('')}
                        </select>
                    </div>
                    
                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <label class="block text-sm font-medium mb-1">폰트 크기</label>
                            <input type="text" id="fontSize" class="w-full p-2 border rounded" 
                                   value="${theme.fontSize}" placeholder="예: 14px">
                        </div>
                        <div>
                            <label class="block text-sm font-medium mb-1">폰트 굵기</label>
                            <select id="fontWeight" class="w-full p-2 border rounded">
                                <option value="300" ${theme.fontWeight === '300' ? 'selected' : ''}>가늘게</option>
                                <option value="400" ${theme.fontWeight === '400' ? 'selected' : ''}>보통</option>
                                <option value="500" ${theme.fontWeight === '500' ? 'selected' : ''}>중간</option>
                                <option value="600" ${theme.fontWeight === '600' ? 'selected' : ''}>굵게</option>
                                <option value="700" ${theme.fontWeight === '700' ? 'selected' : ''}>매우 굵게</option>
                            </select>
                        </div>
                    </div>
                    
                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <label class="block text-sm font-medium mb-1">자간</label>
                            <input type="text" id="letterSpacing" class="w-full p-2 border rounded" 
                                   value="${theme.letterSpacing}" placeholder="예: 0px, 1px">
                        </div>
                        <div>
                            <label class="block text-sm font-medium mb-1">줄간격</label>
                            <input type="text" id="lineHeight" class="w-full p-2 border rounded" 
                                   value="${theme.lineHeight}" placeholder="예: 1.6, 1.8">
                        </div>
                    </div>
                    
                    <div>
                        <label class="block text-sm font-medium mb-1">배경색</label>
                        <div class="flex space-x-2">
                            <input type="color" id="backgroundColor" class="w-12 h-10 border rounded" 
                                   value="${theme.backgroundColor}">
                            <input type="text" id="backgroundColorText" class="flex-1 p-2 border rounded" 
                                   value="${theme.backgroundColor}">
                        </div>
                    </div>
                    
                    <div>
                        <label class="block text-sm font-medium mb-1">글자색</label>
                        <div class="flex space-x-2">
                            <input type="color" id="textColor" class="w-12 h-10 border rounded" 
                                   value="${theme.textColor}">
                            <input type="text" id="textColorText" class="flex-1 p-2 border rounded" 
                                   value="${theme.textColor}">
                        </div>
                    </div>
                    
                    <div>
                        <label class="block text-sm font-medium mb-1">선택 영역 색상</label>
                        <div class="flex space-x-2">
                            <input type="color" id="selectionColor" class="w-12 h-10 border rounded" 
                                   value="${theme.selectionColor}">
                            <input type="text" id="selectionColorText" class="flex-1 p-2 border rounded" 
                                   value="${theme.selectionColor}">
                        </div>
                    </div>
                    
                    <div>
                        <label class="block text-sm font-medium mb-1">하이라이트 색상</label>
                        <div class="flex space-x-2">
                            <input type="color" id="highlightColor" class="w-12 h-10 border rounded" 
                                   value="${theme.highlightColor}">
                            <input type="text" id="highlightColorText" class="flex-1 p-2 border rounded" 
                                   value="${theme.highlightColor}">
                        </div>
                    </div>
                </div>
                
                <div class="mt-6 p-4 border rounded bg-gray-50">
                    <h4 class="text-sm font-medium mb-2">미리보기</h4>
                    <div id="themePreviewContent" class="p-3 border rounded" style="
                        font-family: ${theme.fontFamily};
                        font-size: ${theme.fontSize};
                        font-weight: ${theme.fontWeight};
                        letter-spacing: ${theme.letterSpacing};
                        line-height: ${theme.lineHeight};
                        background-color: ${theme.backgroundColor};
                        color: ${theme.textColor};
                    ">
                        이것은 텍스트 미리보기입니다.<br>
                        This is a text preview.<br>
                        한글과 영문이 함께 표시됩니다.
                    </div>
                </div>
                
                <div class="flex space-x-2 pt-4">
                    <button type="submit" class="btn btn-primary flex-1">
                        ${isEdit ? '테마 업데이트' : '테마 생성'}
                    </button>
                    <button type="button" class="btn btn-secondary flex-1 cancel-theme-btn">
                        취소
                    </button>
                </div>
            </form>
        `;
        
        this.bindThemeEditorEvents(themeId);
    }
    
    bindThemeEditorEvents(themeId = null) {
        const form = document.getElementById('themeForm');
        const previewContent = document.getElementById('themePreviewContent');
        const cancelBtn = document.querySelector('.cancel-theme-btn');
        
        // 색상 입력 동기화
        ['backgroundColor', 'textColor', 'selectionColor', 'highlightColor'].forEach(colorId => {
            const colorInput = document.getElementById(colorId);
            const textInput = document.getElementById(colorId + 'Text');
            
            colorInput.addEventListener('input', () => {
                textInput.value = colorInput.value;
                this.updateThemePreview();
            });
            
            textInput.addEventListener('input', () => {
                if (/^#[0-9A-F]{6}$/i.test(textInput.value)) {
                    colorInput.value = textInput.value;
                }
                this.updateThemePreview();
            });
        });
        
        // 실시간 미리보기 업데이트
        const inputs = form.querySelectorAll('input, select');
        inputs.forEach(input => {
            input.addEventListener('input', () => this.updateThemePreview());
        });
        
        // 폼 제출
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveThemeFromForm(themeId);
        });
        
        // 취소 버튼
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => {
                document.getElementById('themePreview').classList.add('hidden');
            });
        }
    }
    
    updateThemePreview() {
        const previewContent = document.getElementById('themePreviewContent');
        if (!previewContent) return;
        
        const form = document.getElementById('themeForm');
        const formData = new FormData(form);
        
        const fontFamily = document.getElementById('fontFamily').value;
        const fontSize = document.getElementById('fontSize').value;
        const fontWeight = document.getElementById('fontWeight').value;
        const letterSpacing = document.getElementById('letterSpacing').value;
        const lineHeight = document.getElementById('lineHeight').value;
        const backgroundColor = document.getElementById('backgroundColorText').value;
        const textColor = document.getElementById('textColorText').value;
        
        previewContent.style.fontFamily = fontFamily;
        previewContent.style.fontSize = fontSize;
        previewContent.style.fontWeight = fontWeight;
        previewContent.style.letterSpacing = letterSpacing;
        previewContent.style.lineHeight = lineHeight;
        previewContent.style.backgroundColor = backgroundColor;
        previewContent.style.color = textColor;
    }
    
    saveThemeFromForm(themeId = null) {
        const form = document.getElementById('themeForm');
        
        const themeData = {
            name: document.getElementById('themeName').value,
            fontFamily: document.getElementById('fontFamily').value,
            fontSize: document.getElementById('fontSize').value,
            fontWeight: document.getElementById('fontWeight').value,
            letterSpacing: document.getElementById('letterSpacing').value,
            fontStretch: 'normal',
            lineHeight: document.getElementById('lineHeight').value,
            backgroundColor: document.getElementById('backgroundColorText').value,
            textColor: document.getElementById('textColorText').value,
            selectionColor: document.getElementById('selectionColorText').value,
            highlightColor: document.getElementById('highlightColorText').value
        };
        
        let resultThemeId;
        if (themeId && themeId.startsWith('custom_')) {
            // 기존 커스텀 테마 업데이트
            this.updateCustomTheme(themeId, themeData);
            resultThemeId = themeId;
        } else {
            // 새 커스텀 테마 생성
            resultThemeId = this.createCustomTheme(themeData.name, themeData);
        }
        
        // 생성/업데이트된 테마 적용
        this.applyTheme(resultThemeId);
        
        // UI 업데이트
        document.getElementById('themePreview').classList.add('hidden');
        this.renderThemeSettings();
        
        this.showInfo(themeId ? '테마가 업데이트되었습니다.' : '새 테마가 생성되었습니다.');
    }
    
    getAvailableFonts() {
        const systemFonts = [
            { label: 'D2Coding (기본)', value: 'D2Coding, "Noto Sans Mono CJK KR", Consolas, "Liberation Mono", monospace' },
            { label: 'Consolas', value: 'Consolas, "Liberation Mono", monospace' },
            { label: 'Monaco', value: 'Monaco, "Lucida Console", monospace' },
            { label: 'Courier New', value: '"Courier New", Courier, monospace' },
            { label: 'Lucida Console', value: '"Lucida Console", monospace' },
            { label: 'Source Code Pro', value: '"Source Code Pro", monospace' },
            { label: 'Fira Code', value: '"Fira Code", monospace' },
            { label: 'JetBrains Mono', value: '"JetBrains Mono", monospace' },
            { label: 'Noto Sans Mono', value: '"Noto Sans Mono", monospace' },
            { label: 'Ubuntu Mono', value: '"Ubuntu Mono", monospace' },
            { label: 'Roboto Mono', value: '"Roboto Mono", monospace' },
            { label: 'SF Mono', value: '"SF Mono", monospace' },
            { label: 'Menlo', value: 'Menlo, Monaco, "Lucida Console", monospace' },
            { label: 'Inconsolata', value: 'Inconsolata, monospace' },
            { label: '맑은 고딕', value: '"Malgun Gothic", "맑은 고딕", sans-serif' },
            { label: '굴림', value: 'Gulim, "굴림", sans-serif' },
            { label: '돋움', value: 'Dotum, "돋움", sans-serif' },
            { label: '바탕', value: 'Batang, "바탕", serif' },
            { label: '궁서', value: 'Gungsuh, "궁서", serif' },
            { label: 'Arial', value: 'Arial, sans-serif' },
            { label: 'Times New Roman', value: '"Times New Roman", Times, serif' },
            { label: 'Helvetica', value: 'Helvetica, Arial, sans-serif' },
            { label: 'Georgia', value: 'Georgia, serif' },
            { label: 'Verdana', value: 'Verdana, sans-serif' }
        ];
        
        // 사용자 정의 폰트 추가 (사용 가능한 경우)
        const customFonts = this.detectAvailableFonts();
        
        return [...systemFonts, ...customFonts];
    }
    
    detectAvailableFonts() {
        const customFonts = [];
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        
        const testString = 'mmmmmmmmmmlli';
        const testSize = '72px';
        const baseWidth = context.measureText(testString).width;
        
        const fontsToTest = [
            'Cascadia Code',
            'Cascadia Mono',
            'Victor Mono',
            'Hack',
            'Droid Sans Mono',
            'DejaVu Sans Mono',
            'Liberation Mono',
            'Anonymous Pro',
            'PT Mono',
            'Space Mono',
            'IBM Plex Mono',
            'Operator Mono',
            'Dank Mono',
            'Input Mono',
            'Iosevka'
        ];
        
        fontsToTest.forEach(fontName => {
            context.font = `${testSize} "${fontName}", monospace`;
            const width = context.measureText(testString).width;
            
            if (width !== baseWidth) {
                customFonts.push({
                    label: fontName,
                    value: `"${fontName}", monospace`
                });
            }
        });
        
        return customFonts;
    }
    
    /**
     * 인코딩 변경 기능
     */
    async changeEncoding(newEncoding) {
        if (!this.selectedBook) return;
        
        try {
            this.showLoading(true);
            
            // 현재 책의 원본 파일이 있는 경우 다시 읽기
            if (this.selectedBook.filePath && window.electronAPI) {
                // Electron 환경에서 파일 다시 읽기
                const fileData = await window.electronAPI.readFileWithEncoding(this.selectedBook.filePath, newEncoding);
                if (fileData) {
                    this.selectedBook.content = fileData.content;
                    this.selectedBook.encoding = newEncoding;
                    this.currentContent = fileData.content;
                    
                    // 서재에 저장
                    this.saveLibrary();
                    
                    // 화면 업데이트
                    this.displayFile(this.currentContent);
                    this.showInfo(`인코딩이 ${newEncoding}으로 변경되었습니다.`);
                }
            } else {
                // 웹 환경이거나 원본 파일이 없는 경우 - 메모리의 바이너리 데이터로 재변환 시도
                if (this.selectedBook.originalFile) {
                    const reader = new FileReader();
                    reader.onload = (e) => {
                        const content = e.target.result;
                        this.selectedBook.content = content;
                        this.selectedBook.encoding = newEncoding;
                        this.currentContent = content;
                        
                        // 서재에 저장
                        this.saveLibrary();
                        
                        // 화면 업데이트
                        this.displayFile(this.currentContent);
                        this.showInfo(`인코딩이 ${newEncoding}으로 변경되었습니다.`);
                    };
                    reader.readAsText(this.selectedBook.originalFile, newEncoding);
                } else {
                    // 원본 파일이 없는 경우 - 현재 텍스트를 새 인코딩으로 가정하고 업데이트
                    this.selectedBook.encoding = newEncoding;
                    
                    // 서재에 저장
                    this.saveLibrary();
                    
                    // 화면 업데이트 (인코딩 정보만 변경)
                    this.updateFileInfo();
                    this.updateStatusBar();
                    this.showInfo(`인코딩 정보가 ${newEncoding}으로 변경되었습니다. (내용은 변경되지 않음)`);
                }
            }
            
        } catch (error) {
            this.showError('인코딩 변경 중 오류가 발생했습니다.', error);
        } finally {
            this.showLoading(false);
        }
    }

    // ===============================
    // 간단한 페이지 모드 구현
    // ===============================

    setupSimplePageMode() {
        console.log('[페이지모드] 간단한 페이지 모드 설정');
        this.createSimplePages();
        this.updatePageInfo();
        this.showCurrentSimplePage();
    }

    createSimplePages() {
        // 기존 페이지 제거
        this.elements.pageBook.innerHTML = '';
        
        // 페이지별로 내용을 분할하여 DOM 요소 생성
        this.paging.pages.forEach((pageData, index) => {
            const pageDiv = document.createElement('div');
            pageDiv.className = 'simple-page';
            pageDiv.style.display = index === 0 ? 'block' : 'none';
            
            if (pageData.isCover) {
                // 커버 페이지
                pageDiv.innerHTML = `
                    <div class="cover-page text-center p-8">
                        <h1 class="text-2xl font-bold text-gray-800 mb-4">${this.selectedBook ? this.selectedBook.name : '제목 없음'}</h1>
                        <p class="text-gray-600">Text Viewer</p>
                        <div class="mt-4 text-sm text-gray-500">
                            총 ${this.paging.totalPages}페이지
                        </div>
                    </div>
                `;
            } else {
                // 내용 페이지
                const contentDiv = document.createElement('div');
                contentDiv.className = 'page-text font-mono text-sm leading-relaxed p-6 whitespace-pre-wrap';
                contentDiv.textContent = pageData.lines.join('\n');
                pageDiv.appendChild(contentDiv);
                
                // 페이지 번호 추가
                const pageNumber = document.createElement('div');
                pageNumber.className = 'page-number text-center text-sm text-gray-500 mt-4';
                pageNumber.textContent = `${pageData.pageNumber}`;
                pageDiv.appendChild(pageNumber);
            }
            
            this.elements.pageBook.appendChild(pageDiv);
        });
        
        this.paging.currentPage = 1;
    }

    showCurrentSimplePage() {
        const pages = this.elements.pageBook.children;
        for (let i = 0; i < pages.length; i++) {
            pages[i].style.display = i === (this.paging.currentPage - 1) ? 'block' : 'none';
        }
    }

    previousPage() {
        if (this.paging.currentPage > 1) {
            this.paging.currentPage--;
            this.showCurrentSimplePage();
            this.updatePageInfo();
        }
    }

    nextPage() {
        if (this.paging.currentPage < this.paging.totalPages) {
            this.paging.currentPage++;
            this.showCurrentSimplePage();
            this.updatePageInfo();
        }
    }

    // ===============================
    // 모드 변경 기능들
    // ===============================

    toggleDarkMode() {
        this.modes.theme = this.modes.theme === 'light' ? 'dark' : 'light';
        this.applyThemeMode();
        this.updateThemeButton();
        
        // 로컬 스토리지에 저장
        localStorage.setItem('textViewer_theme', this.modes.theme);
    }

    applyThemeMode() {
        const body = document.body;
        const isDark = this.modes.theme === 'dark';
        
        if (isDark) {
            body.classList.add('dark-mode');
        } else {
            body.classList.remove('dark-mode');
        }
    }

    updateThemeButton() {
        const button = this.elements.themeToggleBtn;
        button.textContent = this.modes.theme === 'light' ? '🌙' : '☀️';
        button.title = this.modes.theme === 'light' ? '다크 모드' : '라이트 모드';
    }

    toggleReadingMode() {
        this.modes.reading = !this.modes.reading;
        this.applyReadingMode();
        this.updateReadingModeButton();
        
        // 로컬 스토리지에 저장
        localStorage.setItem('textViewer_readingMode', this.modes.reading);
    }

    applyReadingMode() {
        const body = document.body;
        const isReading = this.modes.reading;
        
        if (isReading) {
            body.classList.add('reading-mode');
            // 사이드바 숨기기
            this.elements.sidebar.classList.add('hidden');
            // 툴바 최소화
            document.querySelector('.toolbar').classList.add('minimal');
        } else {
            body.classList.remove('reading-mode');
            document.querySelector('.toolbar').classList.remove('minimal');
        }
    }

    updateReadingModeButton() {
        const button = this.elements.readingModeBtn;
        button.textContent = this.modes.reading ? '📖' : '📚';
        button.title = this.modes.reading ? '읽기 모드 해제' : '읽기 모드';
        button.classList.toggle('active', this.modes.reading);
    }

    toggleFullscreen() {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().then(() => {
                this.modes.fullscreen = true;
                this.updateFullscreenButton();
            });
        } else {
            document.exitFullscreen().then(() => {
                this.modes.fullscreen = false;
                this.updateFullscreenButton();
            });
        }
    }

    updateFullscreenButton() {
        const button = this.elements.fullscreenBtn;
        button.textContent = this.modes.fullscreen ? '🗗' : '⛶';
        button.title = this.modes.fullscreen ? '전체화면 해제' : '전체화면';
        button.classList.toggle('active', this.modes.fullscreen);
    }

    // 초기화 시 저장된 모드 설정 복원
    loadSavedModes() {
        // 테마 모드 복원
        const savedTheme = localStorage.getItem('textViewer_theme');
        if (savedTheme) {
            this.modes.theme = savedTheme;
            this.applyThemeMode();
            this.updateThemeButton();
        }
        
        // 읽기 모드 복원
        const savedReadingMode = localStorage.getItem('textViewer_readingMode');
        if (savedReadingMode === 'true') {
            this.modes.reading = true;
            this.applyReadingMode();
            this.updateReadingModeButton();
        }
    }
}

// 앱 초기화
document.addEventListener('DOMContentLoaded', () => {
    new TextViewer();
});