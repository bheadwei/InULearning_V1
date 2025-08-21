/**
 * 家長應用主要模組
 * 處理全域事件、導航管理和頁面初始化
 */
class ParentApp {
    constructor() {
        this.init();
    }

    init() {
        // 頁面載入時統一執行
        document.addEventListener('DOMContentLoaded', () => {
            this.handlePageLoad();
        });
    }

    handlePageLoad() {
        // 檢查認證狀態
        if (!parentAuth.isLoggedIn()) {
            // 如果未登入且不在登入/註冊頁面，跳轉
            if (!window.location.pathname.includes('login.html') && !window.location.pathname.includes('register.html')) {
                window.location.href = '/login.html';
            }
            return; // 未登入，不執行後續數據加載
        }

        // 根據目前頁面路徑決定加載哪個數據
        const currentPage = window.location.pathname;

        if (currentPage.endsWith('/') || currentPage.endsWith('index.html')) {
            this.loadDashboard();
        }
        // 可以在此處為其他頁面添加特定的數據加載邏輯
        // else if (currentPage.endsWith('progress.html')) {
        //    // ...
        // }
    }

    async loadDashboard() {
        const loadingOverlay = document.getElementById('loading-overlay');
        try {
            if (loadingOverlay) loadingOverlay.classList.add('show');

            const response = await apiClient.get('/api/v1/parent/dashboard');
            const dashboardData = response.data || response;

            // 使用 parentDashboard 實例來渲染
            parentDashboard.render(dashboardData);

        } catch (error) {
            console.error('載入儀表板數據失敗:', error);
            this.showNotification('載入儀表板數據失敗，請稍後重試', 'error');
        } finally {
            if (loadingOverlay) loadingOverlay.classList.remove('show');
        }
    }

    showNotification(message, type = 'info') {
        // 簡易的通知實現
        alert(`[${type.toUpperCase()}] ${message}`);
    }
}

// 初始化應用
const parentApp = new ParentApp();
window.parentApp = parentApp; 