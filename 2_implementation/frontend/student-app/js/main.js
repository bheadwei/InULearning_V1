/**
 * 主要 JavaScript 檔案
 * 處理首頁功能與全域事件
 */

class MainApp {
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

            // 儲存到localStorage
            localStorage.setItem('auth_token', token);
            localStorage.setItem('user_info', userInfo);
            if (window.Utils) {
                try { Utils.setStorageItem('auth_token', token); } catch (e) { }
                try { Utils.setStorageItem('user_info', userInfo); } catch (e) { }
            }

            // 清除URL參數
            const newURL = window.location.protocol + "//" + window.location.host + window.location.pathname;
            window.history.replaceState({}, document.title, newURL);

            // 更新認證狀態
            if (typeof authManager !== 'undefined') {
                authManager.updateAuthUI();
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

        // 快速功能卡片點擊
        const quickCards = document.querySelectorAll('.cursor-pointer');
        quickCards.forEach(card => {
            card.addEventListener('click', (e) => {
                const href = card.getAttribute('onclick');
                if (href) {
                    // 移除 onclick 屬性並手動處理
                    card.removeAttribute('onclick');
                    this.handleQuickCardClick(card);
                }
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

        // 導向搜尋結果頁面或練習頁面
        window.location.href = `pages/exercise.html?search=${encodeURIComponent(query)}`;
    }

    /**
     * 處理快速功能卡片點擊
     */
    handleQuickCardClick(card) {
        const title = card.querySelector('h3')?.textContent;

        switch (title) {
            case '客製化題庫練習':
                window.location.href = 'pages/exercise.html';
                break;
            case '弱點分析與筆記':
                window.location.href = 'pages/dashboard.html';
                break;
            case 'AI即時問答':
                // TODO: 實作 AI 問答功能
                alert('AI 問答功能即將推出！');
                break;
            case '線上大考模擬':
                // TODO: 實作大考模擬功能
                alert('大考模擬功能即將推出！');
                break;
            default:
                console.log('未知的卡片:', title);
        }
    }

    /**
     * 載入儀表板資料
     */
    async loadDashboardData() {
        if (!authManager.isLoggedIn()) {
            return;
        }

        try {
            // 載入學習統計
            await this.loadLearningStats();

            // 載入推薦練習
            await this.loadRecommendedExercises();

        } catch (error) {
            console.error('載入儀表板資料錯誤:', error);
        }
    }

    /**
     * 載入學習統計
     */
    async loadLearningStats() {
        try {
            // 與 dashboard 相同：同時抓 statistics 與 recent 做為後備
            const [statsResp, recentList] = await Promise.all([
                learningAPI.getLearningStatistics(),
                learningAPI.getRecentLearningRecords(5)
            ]);
            const stats = statsResp && statsResp.success ? statsResp.data : null;
            this.updateStatsDisplay(stats, recentList && recentList.data ? recentList.data : null);
        } catch (error) {
            console.error('載入學習統計錯誤:', error);
            // 顯示預設值
            this.updateStatsDisplay(null, null);
        }
    }

    /**
     * 更新統計顯示
     */
    updateStatsDisplay(stats, recentData) {
        const learningStats = document.getElementById('learningStats');
        if (!learningStats) return;

        learningStats.classList.remove('hidden');

        // 更新統計數值（與 dashboard/history 一致）
        const totalQuestionsEl = document.getElementById('totalQuestions');
        const avgAccuracyEl = document.getElementById('avgAccuracy');
        const totalTimeEl = document.getElementById('totalTime');

        let totalQuestions = 0;
        let accuracy = 0;
        let minutes = 0;

        if (stats) {
            totalQuestions = stats.total_questions || 0;
            accuracy = Math.round(stats.overall_accuracy || 0);
            minutes = Math.round((stats.total_time_spent || 0) / 60);
        } else if (recentData) {
            // 後備來源：由最近紀錄彙總
            const sessions = recentData.sessions || [];
            const correct = sessions.reduce((sum, s) => sum + (s.correct_count || 0), 0);
            totalQuestions = sessions.reduce((sum, s) => sum + (s.question_count || 0), 0);
            accuracy = totalQuestions > 0 ? Math.round((correct / totalQuestions) * 100) : 0;
            const timeSpent = sessions.reduce((sum, s) => sum + (s.time_spent || 0), 0);
            minutes = Math.round(timeSpent / 60);
        }

        if (totalQuestionsEl) totalQuestionsEl.textContent = totalQuestions;
        if (avgAccuracyEl) avgAccuracyEl.textContent = `${accuracy}%`;
        if (totalTimeEl) totalTimeEl.textContent = `${minutes} 分`;
    }

    /**
     * 載入推薦練習
     */
    async loadRecommendedExercises() {
        try {
            const recommendations = await aiAnalysisAPI.getPersonalizedQuestions(6);
            this.updateRecommendedExercises(recommendations);
        } catch (error) {
            console.error('載入推薦練習錯誤:', error);
            // 顯示預設推薦
            this.updateRecommendedExercises([]);
        }
    }

    /**
     * 更新推薦練習顯示
     */
    updateRecommendedExercises(recommendations) {
        const recommendedExercises = document.getElementById('recommendedExercises');
        if (!recommendedExercises) return;

        recommendedExercises.classList.remove('hidden');
        const container = recommendedExercises.querySelector('.grid');

        if (!container) return;

        // 清空現有內容
        container.innerHTML = '';

        if (recommendations.length === 0) {
            // 顯示預設推薦
            const defaultRecommendations = [
                {
                    title: '數學基礎練習',
                    subject: '數學',
                    difficulty: '中等',
                    question_count: 15,
                    estimated_time: '20分鐘'
                },
                {
                    title: '英文文法練習',
                    subject: '英文',
                    difficulty: '簡單',
                    question_count: 10,
                    estimated_time: '15分鐘'
                },
                {
                    title: '國文閱讀理解',
                    subject: '國文',
                    difficulty: '困難',
                    question_count: 12,
                    estimated_time: '25分鐘'
                }
            ];

            defaultRecommendations.forEach(rec => {
                container.appendChild(this.createRecommendationCard(rec));
            });
        } else {
            // 顯示實際推薦
            recommendations.forEach(rec => {
                container.appendChild(this.createRecommendationCard(rec));
            });
        }
    }

    /**
     * 創建推薦卡片
     */
    createRecommendationCard(recommendation) {
        const card = document.createElement('div');
        card.className = 'bg-white p-6 rounded-lg shadow-md hover:shadow-lg transition-shadow cursor-pointer card-hover';

        const difficultyColor = {
            '簡單': 'text-green-600',
            '中等': 'text-yellow-600',
            '困難': 'text-red-600'
        };

        card.innerHTML = `
            <div class="flex items-center justify-between mb-4">
                <h4 class="text-lg font-semibold text-gray-800">${recommendation.title}</h4>
                <span class="text-sm px-2 py-1 bg-blue-100 text-blue-600 rounded-full">${recommendation.subject}</span>
            </div>
            <div class="space-y-2 text-sm text-gray-600">
                <div class="flex justify-between">
                    <span>難度：</span>
                    <span class="${difficultyColor[recommendation.difficulty] || 'text-gray-600'}">${recommendation.difficulty}</span>
                </div>
                <div class="flex justify-between">
                    <span>題數：</span>
                    <span>${recommendation.question_count} 題</span>
                </div>
                <div class="flex justify-between">
                    <span>預估時間：</span>
                    <span>${recommendation.estimated_time}</span>
                </div>
            </div>
            <button class="w-full mt-4 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors">
                開始練習
            </button>
        `;

        // 綁定點擊事件
        card.addEventListener('click', () => {
            // 儲存推薦資訊到 localStorage
            localStorage.setItem('selectedRecommendation', JSON.stringify(recommendation));
            window.location.href = 'pages/exercise.html';
        });

        return card;
    }

    /**
     * 顯示載入動畫
     */
    showLoading(element) {
        if (element) {
            element.classList.add('loading');
        }
    }

    /**
     * 隱藏載入動畫
     */
    hideLoading(element) {
        if (element) {
            element.classList.remove('loading');
        }
    }

    /**
     * 顯示通知
     */
    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `fixed top-4 right-4 p-4 rounded-lg shadow-lg z-50 ${type === 'success' ? 'bg-green-500 text-white' :
            type === 'error' ? 'bg-red-500 text-white' :
                'bg-blue-500 text-white'
            }`;
        notification.textContent = message;

        document.body.appendChild(notification);

        // 3秒後自動移除
        setTimeout(() => {
            notification.remove();
        }, 3000);
    }
}

// 頁面載入完成後初始化應用
document.addEventListener('DOMContentLoaded', () => {
    // 檢查是否需要重新導向
    if (!authManager.isLoggedIn()) {
        // 如果未登入且不在登入或註冊頁面，顯示登入提示
        const currentPath = window.location.pathname;
        if (!currentPath.includes('login.html') && !currentPath.includes('register.html')) {
            // 可以選擇是否要自動導向到登入頁面
            // window.location.href = 'pages/login.html';
        }
    }

    // 初始化主應用
    window.mainApp = new MainApp();
});

// 全域錯誤處理
window.addEventListener('error', (event) => {
    console.error('全域錯誤:', event.error);
    // 可以在這裡添加錯誤報告功能
});

// 全域未處理的 Promise 拒絕處理
window.addEventListener('unhandledrejection', (event) => {
    console.error('未處理的 Promise 拒絕:', event.reason);
    // 可以在這裡添加錯誤報告功能
}); 