/**
 * 教師端主要 JavaScript 檔案
 * 處理首頁功能與全域事件
 */

class TeacherMainApp {
    constructor() {
        this.init();
    }

    /**
     * 初始化應用
     */
    init() {
        // 處理從統一登入頁面傳來的認證資訊
        this.handleAuthFromURL();
        
        this.bindEvents();
        // 延遲載入儀表板資料，確保認證狀態已初始化
        setTimeout(() => {
            this.loadDashboardData();
        }, 100);
    }

    /**
     * 處理URL參數中的認證資訊
     */
    handleAuthFromURL() {
        const urlParams = new URLSearchParams(window.location.search);
        const token = urlParams.get('token');
        const userInfo = urlParams.get('userInfo');

        if (token && userInfo) {
            console.log('從URL接收到認證資訊');
            
            try {
                // 解析 userInfo JSON
                const userInfoObj = JSON.parse(decodeURIComponent(userInfo));
                console.log('解析的用戶資訊:', userInfoObj);
                
                // 儲存到localStorage - 儲存解析後的用戶對象
                localStorage.setItem('auth_token', token);
                localStorage.setItem('user_info', JSON.stringify(userInfoObj));
                
                // 清除URL參數 - 使用更安全的方式
                if (window.history && window.history.replaceState) {
                    const newURL = window.location.origin + window.location.pathname;
                    window.history.replaceState({}, document.title, newURL);
                    console.log('URL參數已清除');
                }
                
                // 延遲更新認證狀態，確保DOM已準備好
                setTimeout(() => {
                    if (typeof teacherAuth !== 'undefined') {
                        teacherAuth.updateUI();
                    }
                }, 100);
                
            } catch (error) {
                console.error('處理認證資訊時發生錯誤:', error);
            }
        }
    }

    /**
     * 綁定事件
     */
    bindEvents() {
        // 搜尋功能
        const searchInput = document.querySelector('input[name="q"]');
        if (searchInput) {
            searchInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.handleSearch(e.target.value);
                }
            });
        }

        // 功能卡片點擊
        const functionCards = document.querySelectorAll('.cursor-pointer');
        functionCards.forEach(card => {
            card.addEventListener('click', (e) => {
                this.handleFunctionCardClick(card);
            });
        });
    }

    /**
     * 處理搜尋
     */
    handleSearch(query) {
        if (!query.trim()) return;
        
        // 儲存搜尋查詢到 localStorage
        localStorage.setItem('searchQuery', query);
        
        // 導向搜尋結果頁面
        alert(`搜尋: ${query}`);
    }

    /**
     * 處理功能卡片點擊
     */
    handleFunctionCardClick(card) {
        const title = card.querySelector('h3')?.textContent;
        
        switch (title) {
            case '建立新作業':
                window.location.href = 'pages/assignments-enhanced.html';
                break;
            case '查看學習報告':
                window.location.href = 'pages/analytics-enhanced.html';
                break;
            case '管理題庫':
                window.location.href = 'pages/questions-enhanced.html';
                break;
            case '學生管理':
                window.location.href = 'pages/students-enhanced.html';
                break;
            case '批改作業':
                window.location.href = 'pages/grades-enhanced.html';
                break;
            case '系統設定':
                window.location.href = 'pages/profile.html';
                break;
            default:
                console.log('未知的卡片:', title);
        }
    }

    /**
     * 載入儀表板資料
     */
    async loadDashboardData() {
        if (typeof teacherAuth !== 'undefined' && !teacherAuth.isLoggedIn()) {
            return;
        }

        try {
            // 這裡可以載入教師相關的統計資料
            console.log('載入教師儀表板資料');
        } catch (error) {
            console.error('載入儀表板資料錯誤:', error);
        }
    }
}

// 初始化主應用
document.addEventListener('DOMContentLoaded', function() {
    new TeacherMainApp();
}); 