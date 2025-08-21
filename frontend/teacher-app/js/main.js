/**
 * 教師應用主要模組
 * 處理全域事件、導航管理和頁面初始化
 */
class TeacherApp {
    constructor() {
        this.currentPage = this.getCurrentPage();
        this.init();
    }

    init() {
        this.setupGlobalEvents();
        this.initializePage();
        this.setupNavigation();
    }

    /**
     * 獲取當前頁面
     */
    getCurrentPage() {
        const path = window.location.pathname;
        if (path.includes('login.html')) return 'login';
        if (path.includes('courses.html')) return 'courses';
        if (path.includes('students.html') || path.includes('students-enhanced.html')) return 'students';
        if (path.includes('assignments.html')) return 'assignments';
        if (path.includes('announcements.html')) return 'announcements';
        if (path.includes('profile.html')) return 'profile';
        return 'dashboard';
    }

    /**
     * 設定全域事件
     */
    setupGlobalEvents() {
        // 全域錯誤處理
        window.addEventListener('error', this.handleGlobalError.bind(this));
        
        // 網路狀態監聽
        window.addEventListener('online', this.handleOnline.bind(this));
        window.addEventListener('offline', this.handleOffline.bind(this));

        // 鍵盤快捷鍵
        document.addEventListener('keydown', this.handleKeyboardShortcuts.bind(this));

        // 視窗大小變化
        window.addEventListener('resize', this.handleResize.bind(this));
    }

    /**
     * 初始化頁面
     */
    initializePage() {
        // 根據當前頁面初始化相應模組
        switch (this.currentPage) {
            case 'dashboard':
                // 儀表板已在 dashboard.js 中初始化
                break;
            case 'courses':
                if (typeof CoursesManager !== 'undefined') {
                    new CoursesManager();
                }
                break;
            case 'students':
                if (typeof StudentsManager !== 'undefined') {
                    new StudentsManager();
                }
                break;
            case 'assignments':
                if (typeof AssignmentsManager !== 'undefined') {
                    new AssignmentsManager();
                }
                break;
            case 'announcements':
                if (typeof AnnouncementsManager !== 'undefined') {
                    new AnnouncementsManager();
                }
                break;
            case 'profile':
                if (typeof ProfileManager !== 'undefined') {
                    new ProfileManager();
                }
                break;
        }
    }

    /**
     * 設定導航
     */
    setupNavigation() {
        // 更新當前頁面的導航狀態
        this.updateNavigationState();
        
        // 導航點擊事件
        const navLinks = document.querySelectorAll('.nav-link');
        navLinks.forEach(link => {
            link.addEventListener('click', this.handleNavigation.bind(this));
        });

        // 移動端選單切換
        const mobileMenuToggle = document.getElementById('mobile-menu-toggle');
        if (mobileMenuToggle) {
            mobileMenuToggle.addEventListener('click', this.toggleMobileMenu.bind(this));
        }
    }

    /**
     * 更新導航狀態
     */
    updateNavigationState() {
        const navLinks = document.querySelectorAll('.nav-link');
        navLinks.forEach(link => {
            link.classList.remove('active');
            if (link.getAttribute('href') && 
                window.location.pathname.includes(link.getAttribute('href'))) {
                link.classList.add('active');
            }
        });
    }

    /**
     * 處理導航點擊
     */
    handleNavigation(e) {
        const link = e.currentTarget;
        const href = link.getAttribute('href');
        
        if (href && !href.startsWith('#')) {
            // 移除所有活動狀態
            document.querySelectorAll('.nav-link').forEach(navLink => {
                navLink.classList.remove('active');
            });
            
            // 添加當前活動狀態
            link.classList.add('active');
        }
    }

    /**
     * 切換移動端選單
     */
    toggleMobileMenu() {
        const navbarMenu = document.querySelector('.navbar-menu');
        if (navbarMenu) {
            navbarMenu.classList.toggle('active');
        }
    }

    /**
     * 處理全域錯誤
     */
    handleGlobalError(error) {
        console.error('全域錯誤:', error);
        
        // 顯示用戶友好的錯誤訊息
        if (error.message && !error.message.includes('Script error')) {
            showAlert('發生錯誤，請重新整理頁面', 'error');
        }
    }

    /**
     * 處理網路連線
     */
    handleOnline() {
        showAlert('網路連線已恢復', 'success');
        // 重新載入當前頁面資料
        if (typeof teacherDashboard !== 'undefined') {
            teacherDashboard.refresh();
        }
    }

    /**
     * 處理網路斷線
     */
    handleOffline() {
        showAlert('網路連線已中斷', 'warning');
    }

    /**
     * 處理鍵盤快捷鍵
     */
    handleKeyboardShortcuts(e) {
        // Ctrl/Cmd + K: 搜尋
        if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
            e.preventDefault();
            this.openSearch();
        }
        
        // Ctrl/Cmd + N: 新增課程
        if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
            e.preventDefault();
            window.location.href = 'pages/courses.html?action=create';
        }
        
        // Ctrl/Cmd + G: 前往作業頁面
        if ((e.ctrlKey || e.metaKey) && e.key === 'g') {
            e.preventDefault();
            window.location.href = 'pages/assignments.html';
        }
    }

    /**
     * 開啟搜尋
     */
    openSearch() {
        // 實作全域搜尋功能
        const searchInput = document.getElementById('global-search');
        if (searchInput) {
            searchInput.focus();
        } else {
            // 如果沒有全域搜尋輸入框，創建一個
            this.createGlobalSearch();
        }
    }

    /**
     * 創建全域搜尋
     */
    createGlobalSearch() {
        const searchModal = document.createElement('div');
        searchModal.className = 'modal fade';
        searchModal.id = 'global-search-modal';
        searchModal.innerHTML = `
            <div class="modal-dialog modal-lg">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">全域搜尋</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <input type="text" class="form-control" id="global-search-input" 
                               placeholder="搜尋課程、學生、作業...">
                        <div id="search-results" class="mt-3"></div>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(searchModal);
        
        // 顯示模態框
        const modal = new bootstrap.Modal(searchModal);
        modal.show();
        
        // 聚焦到搜尋輸入框
        setTimeout(() => {
            document.getElementById('global-search-input').focus();
        }, 100);
    }

    /**
     * 處理視窗大小變化
     */
    handleResize() {
        // 在移動端隱藏選單
        if (window.innerWidth > 768) {
            const navbarMenu = document.querySelector('.navbar-menu');
            if (navbarMenu) {
                navbarMenu.classList.remove('active');
            }
        }
    }

    /**
     * 顯示通知
     */
    showNotification(message, type = 'info') {
        // 創建通知元素
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <div class="notification-content">
                <i class="fas fa-${this.getNotificationIcon(type)}"></i>
                <span>${message}</span>
                <button class="notification-close">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;
        
        // 添加到頁面
        document.body.appendChild(notification);
        
        // 自動移除
        setTimeout(() => {
            notification.remove();
        }, 5000);
        
        // 手動關閉
        notification.querySelector('.notification-close').addEventListener('click', () => {
            notification.remove();
        });
    }

    /**
     * 獲取通知圖標
     */
    getNotificationIcon(type) {
        const icons = {
            'success': 'check-circle',
            'error': 'exclamation-circle',
            'warning': 'exclamation-triangle',
            'info': 'info-circle'
        };
        return icons[type] || 'info-circle';
    }

    /**
     * 重新整理當前頁面
     */
    refresh() {
        window.location.reload();
    }

    /**
     * 前往指定頁面
     */
    navigateTo(page, params = {}) {
        let url = `pages/${page}.html`;
        
        if (Object.keys(params).length > 0) {
            const queryString = new URLSearchParams(params).toString();
            url += `?${queryString}`;
        }
        
        window.location.href = url;
    }
}

// 初始化教師應用
const teacherApp = new TeacherApp();

// 全域函數，供其他模組使用
window.teacherApp = teacherApp; 