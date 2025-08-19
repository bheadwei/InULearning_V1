/**
 * 家長應用主要模組
 * 處理全域事件、導航管理和頁面初始化
 */
class ParentApp {
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
        if (path.includes('children.html')) return 'children';
        if (path.includes('progress.html')) return 'progress';
        if (path.includes('reports.html')) return 'reports';
        if (path.includes('communication.html')) return 'communication';
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
        // 檢查認證狀態（除了登入頁面）
        if (this.currentPage !== 'login') {
            if (typeof parentAuth !== 'undefined') {
                parentAuth.checkAuthStatus();
            }
        }
        
        // 根據當前頁面初始化相應模組
        switch (this.currentPage) {
            case 'dashboard':
                // 儀表板已在 dashboard.js 中初始化
                break;
            case 'children':
                if (typeof ChildrenManager !== 'undefined') {
                    new ChildrenManager();
                }
                break;
            case 'progress':
                if (typeof ProgressManager !== 'undefined') {
                    new ProgressManager();
                }
                break;
            case 'reports':
                if (typeof ReportsManager !== 'undefined') {
                    new ReportsManager();
                }
                break;
            case 'communication':
                if (typeof CommunicationManager !== 'undefined') {
                    new CommunicationManager();
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
        const navLinks = document.querySelectorAll('nav a');
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
        const navLinks = document.querySelectorAll('nav a');
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
            document.querySelectorAll('nav a').forEach(navLink => {
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
        if (typeof parentDashboard !== 'undefined') {
            parentDashboard.refresh();
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
        // Ctrl/Cmd + P: 查看進度
        if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
            e.preventDefault();
            this.openProgress();
        }

        // Ctrl/Cmd + R: 查看報告
        if ((e.ctrlKey || e.metaKey) && e.key === 'r') {
            e.preventDefault();
            window.location.href = 'pages/reports.html';
        }

        // Ctrl/Cmd + C: 聯絡老師
        if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
            e.preventDefault();
            window.location.href = 'pages/communication.html';
        }
    }

    /**
     * 開啟進度頁面
     */
    openProgress() {
        window.location.href = 'pages/progress.html';
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

// 初始化家長應用
const parentApp = new ParentApp();

// 全域函數，供其他模組使用
window.parentApp = parentApp; 