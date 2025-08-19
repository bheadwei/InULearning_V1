/**
 * 學習歷程頁面 JavaScript
 * 實現練習記錄查看功能
 */

class HistoryManager {
    constructor() {
        this.currentPage = 1;
        this.pageSize = 10;
        this.totalRecords = 0;
        this.filters = {
            subject: '',
            edition: '',
            dateRange: '30'
        };
        this.records = [];

        this.init();
    }

    init() {
        console.log('HistoryManager 初始化開始');
        console.log('learningAPI 狀態:', typeof learningAPI, learningAPI);

        this.bindEvents();
        this.loadLearningRecords(); // 直接載入分頁記錄（每頁 10 筆）
        this.loadStatistics();

        console.log('HistoryManager 初始化完成');
    }

    bindEvents() {
        // 篩選按鈕
        const applyFilterBtn = document.getElementById('applyFilter');
        if (applyFilterBtn) {
            applyFilterBtn.addEventListener('click', () => this.applyFilters());
        }

        // 分頁按鈕
        const prevPageBtn = document.getElementById('prevPage');
        const nextPageBtn = document.getElementById('nextPage');

        if (prevPageBtn) {
            prevPageBtn.addEventListener('click', () => this.previousPage());
        }
        if (nextPageBtn) {
            nextPageBtn.addEventListener('click', () => this.nextPage());
        }

        // 每頁顯示數量
        const pageSizeSelect = document.getElementById('pageSize');
        if (pageSizeSelect) {
            // 固定每頁顯示 10 筆並停用下拉選單
            this.pageSize = 10;
            pageSizeSelect.value = '10';
            pageSizeSelect.disabled = true;
            pageSizeSelect.classList.add('opacity-50', 'cursor-not-allowed');
        }

        // 登出按鈕
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => {
                if (typeof authManager !== 'undefined') {
                    authManager.logout();
                }
            });
        }
    }

    async loadRecentRecords() {
        try {
            this.showLoading();

            // 確保 learningAPI 已初始化
            if (typeof learningAPI === 'undefined' || !learningAPI) {
                throw new Error('learningAPI 未初始化');
            }

            const result = await learningAPI.getRecentLearningRecords(5);

            if (result.success && result.data) {
                this.records = result.data.sessions || [];
                this.totalRecords = result.data.total || 0;
                this.displayRecords();
                this.updatePagination();

                // 顯示「最近5筆記錄」標題
                this.showRecentRecordsHeader();
            } else {
                throw new Error(result.error || '載入最近學習記錄失敗');
            }
        } catch (error) {
            console.error('載入最近學習記錄失敗:', error);
            console.error('錯誤詳情:', error.stack);

            // 顯示更詳細的錯誤信息
            const errorMessage = error.message || '未知錯誤';
            this.showError(`載入最近學習記錄失敗: ${errorMessage}`);
            this.displayEmptyRecords();
        } finally {
            this.hideLoading();
        }
    }

    async loadLearningRecords() {
        try {
            this.showLoading();

            // 確保 learningAPI 已初始化
            if (typeof learningAPI === 'undefined' || !learningAPI) {
                throw new Error('learningAPI 未初始化');
            }

            const params = {
                page: this.currentPage,
                page_size: this.pageSize,
                ...this.getFilterParams()
            };

            const result = await learningAPI.getLearningRecords(params);

            if (result.success && result.data) {
                this.records = result.data.sessions || [];
                this.totalRecords = result.data.total || 0;
                this.displayRecords();
                this.updatePagination();

                // 隱藏「最近5筆記錄」標題
                this.hideRecentRecordsHeader();
            } else {
                throw new Error(result.error || '載入學習記錄失敗');
            }
        } catch (error) {
            console.error('載入學習記錄失敗:', error);
            this.showError('載入學習記錄失敗，請稍後再試');
            this.displayEmptyRecords();
        } finally {
            this.hideLoading();
        }
    }

    async loadStatistics() {
        try {
            // 確保 learningAPI 已初始化
            if (typeof learningAPI === 'undefined' || !learningAPI) {
                console.warn('learningAPI 未初始化，跳過統計載入');
                return;
            }

            const result = await learningAPI.getLearningStatistics();

            if (result.success && result.data) {
                this.displayStatistics(result.data);
            }
        } catch (error) {
            console.error('載入統計資料失敗:', error);
            // 顯示默認統計
            this.displayStatistics({
                total_sessions: 0,
                total_questions: 0,
                overall_accuracy: 0,
                total_time_spent: 0
            });
        }
    }

    getFilterParams() {
        const subjectFilter = document.getElementById('subjectFilter')?.value || '';
        const gradeFilter = document.getElementById('gradeFilter')?.value || '';
        const editionFilter = document.getElementById('editionFilter')?.value || '';
        const dateFilter = document.getElementById('dateFilter')?.value || '30';

        const params = {};

        if (subjectFilter) params.subject = subjectFilter;
        if (gradeFilter) params.grade = gradeFilter;
        if (editionFilter) params.publisher = editionFilter; // 更新為 publisher
        if (dateFilter && dateFilter !== 'all') {
            const days = parseInt(dateFilter);
            const endDate = new Date();
            const startDate = new Date();
            startDate.setDate(endDate.getDate() - days);

            params.start_date = startDate.toISOString();
            params.end_date = endDate.toISOString();
        }

        return params;
    }

    quickFilter(filterType, value) {
        if (filterType === 'subject') {
            const subjectFilter = document.getElementById('subjectFilter');
            if (subjectFilter) subjectFilter.value = value;
        } else if (filterType === 'dateRange') {
            const dateFilter = document.getElementById('dateFilter');
            if (dateFilter) dateFilter.value = value;
        }
        this.applyFilters();
    }

    clearFilters() {
        const subjectFilter = document.getElementById('subjectFilter');
        const gradeFilter = document.getElementById('gradeFilter');
        const editionFilter = document.getElementById('editionFilter');
        const dateFilter = document.getElementById('dateFilter');

        if (subjectFilter) subjectFilter.value = '';
        if (gradeFilter) gradeFilter.value = '';
        if (editionFilter) editionFilter.value = '';
        if (dateFilter) dateFilter.value = '30';

        this.applyFilters();
    }

    applyFilters() {
        this.currentPage = 1;
        this.loadLearningRecords();
        this.loadStatistics();
    }

    displayStatistics(stats) {
        const totalSessionsEl = document.getElementById('totalSessions');
        const totalQuestionsEl = document.getElementById('totalQuestions');
        const avgAccuracyEl = document.getElementById('avgAccuracy');
        const totalTimeEl = document.getElementById('totalTime');

        if (totalSessionsEl) {
            totalSessionsEl.textContent = stats.total_sessions || 0;
        }
        if (totalQuestionsEl) {
            totalQuestionsEl.textContent = stats.total_questions || 0;
        }
        if (avgAccuracyEl) {
            const accuracy = stats.overall_accuracy || 0;
            avgAccuracyEl.textContent = `${Math.round(accuracy)}%`;
        }
        if (totalTimeEl) {
            const timeSpent = stats.total_time_spent || 0;
            const hours = Math.round(timeSpent / 3600 * 10) / 10; // 秒轉小時，保留一位小數
            totalTimeEl.textContent = `${hours}h`;
        }
    }

    displayRecords() {
        const sessionsList = document.getElementById('sessionsList');
        if (!sessionsList) return;

        if (this.records.length === 0) {
            this.displayEmptyRecords();
            return;
        }

        sessionsList.innerHTML = this.records.map(record => {
            const startTime = new Date(record.start_time);

            // 計算用時
            let duration = '未記錄';
            if (record.time_spent) {
                const minutes = Math.floor(record.time_spent / 60);
                const seconds = record.time_spent % 60;
                duration = `${minutes}分${seconds}秒`;
            }

            // 計算正確率和分數
            let accuracy = '未完成';
            let scoreDisplay = '未完成';
            if (record.question_count > 0) {
                const correctCount = record.correct_count || 0;
                const accuracyPercent = Math.round(record.accuracy_rate || 0);
                accuracy = `${accuracyPercent}%`;
                scoreDisplay = `${correctCount}/${record.question_count}`;
            }

            // 構建標籤
            const tags = [];
            if (record.grade) {
                tags.push(`<span class="px-2 py-1 text-xs bg-blue-100 text-blue-600 rounded-full">${this.getGradeDisplayName(record.grade)}</span>`);
            }
            if (record.publisher) {
                tags.push(`<span class="px-2 py-1 text-xs bg-green-100 text-green-600 rounded-full">${record.publisher}</span>`);
            }
            if (record.chapter) {
                tags.push(`<span class="px-2 py-1 text-xs bg-purple-100 text-purple-600 rounded-full">${this.truncateText(record.chapter, 10)}</span>`);
            }
            if (record.difficulty) {
                const difficultyText = this.getDifficultyText(record.difficulty);
                const difficultyColor = this.getDifficultyColor(record.difficulty);
                tags.push(`<span class="px-2 py-1 text-xs ${difficultyColor} rounded-full">${difficultyText}</span>`);
            }

            // 知識點標籤
            const knowledgePointsDisplay = (record.knowledge_points || []).slice(0, 2).map(kp =>
                `<span class="px-2 py-1 text-xs bg-yellow-100 text-yellow-600 rounded-full">${this.truncateText(kp, 8)}</span>`
            ).join('');
            if (record.knowledge_points && record.knowledge_points.length > 2) {
                tags.push(`<span class="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded-full">+${record.knowledge_points.length - 2}</span>`);
            }

            const isFullMark = (record.correct_count || 0) >= (record.question_count || 0);
            return `
                <div class="px-6 py-4 hover:bg-gray-50 cursor-pointer" onclick="historyManager.viewRecordDetails('${record.session_id}')">
                    <div class="flex items-center justify-between">
                        <div class="flex-1">
                            <div class="flex items-center space-x-4">
                                <div class="flex-shrink-0">
                                    <div class="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                                        <span class="material-icons text-blue-600">quiz</span>
                                    </div>
                                </div>
                                <div class="flex-1">
                                    <div class="flex items-center space-x-2 mb-1">
                                        <h4 class="text-sm font-medium text-gray-900">
                                            ${record.session_name || `${record.subject || '未分類'} 練習測驗`}
                                        </h4>
                                        ${tags.join('')}
                                    </div>
                                    <div class="mt-1 flex items-center space-x-4 text-sm text-gray-500">
                                        <span class="flex items-center">
                                            <span class="material-icons text-sm mr-1">schedule</span>
                                            ${this.formatDate(startTime)}
                                        </span>
                                        <span class="flex items-center">
                                            <span class="material-icons text-sm mr-1">timer</span>
                                            ${duration}
                                        </span>
                                        <span class="flex items-center">
                                            <span class="material-icons text-sm mr-1">assignment</span>
                                            ${record.question_count || 0} 題
                                        </span>
                                    </div>
                                    ${knowledgePointsDisplay ? `<div class="mt-2 flex items-center space-x-1">${knowledgePointsDisplay}</div>` : ''}
                                </div>
                            </div>
                        </div>
                        <div class="flex items-center space-x-6">
                            <div class="text-right">
                                <div class="text-sm font-medium text-gray-900">${scoreDisplay}</div>
                                <div class="text-sm text-gray-500">正確題數</div>
                            </div>
                            <div class="text-right">
                                <div class="text-lg font-bold ${this.getAccuracyColor(accuracy)}">${accuracy}</div>
                                <div class="text-sm text-gray-500">正確率</div>
                            </div>
                            <div class="text-right">
                                <div class="text-sm font-medium text-gray-900">${Math.round(record.total_score || 0)}</div>
                                <div class="text-sm text-gray-500">總分</div>
                            </div>
                            <div class="flex items-center">
                                <button class="bg-red-600 text-white px-3 py-1.5 rounded-md text-sm font-medium hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                        ${isFullMark ? 'disabled' : ''}
                                        title="${isFullMark ? '本次全對，無需重練' : '根據本次錯題重新練習'}"
                                        onclick="event.stopPropagation(); historyManager.retryWrongFromHistory('${record.session_id}')">
                                    錯題重練
                                </button>
                            </div>
                            <div class="flex-shrink-0">
                                <span class="material-icons text-gray-400">chevron_right</span>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }

    async retryWrongFromHistory(sessionId) {
        try {
            const loadingToast = this.showToast('正在準備錯題重練...', 'info');

            // 需要登入
            const token = localStorage.getItem('auth_token');
            if (!token) {
                this.hideToast(loadingToast);
                this.showToast('需要登入才能重練錯題', 'warning');
                return;
            }

            // 取得會話詳細資料
            const detail = await learningAPI.getSessionDetail(sessionId);
            if (!detail.success || !detail.data) {
                this.hideToast(loadingToast);
                this.showToast('載入會話詳情失敗，無法重練', 'error');
                return;
            }

            const session = detail.data.session || {};
            const records = detail.data.exercise_records || [];
            const wrongRecords = records.filter(r => r && r.is_correct === false);

            if (wrongRecords.length === 0) {
                this.hideToast(loadingToast);
                this.showToast('本次全對，無需重練', 'success');
                return;
            }

            // 構建題目陣列
            const wrongQuestions = wrongRecords.map(r => this.normalizeRecordToQuestion(r));

            // 隨機化
            const shuffled = this.shuffleArray(wrongQuestions).map((q, idx) => ({ ...q, order_index: idx }));

            // 建立新的練習會話
            const newSession = {
                grade: session.grade,
                edition: session.publisher, // 與前端其他頁面對齊（edition=publisher）
                publisher: session.publisher,
                subject: session.subject,
                chapter: session.chapter,
                question_count: shuffled.length,
                questions: shuffled,
                randomized: true,
                randomSeed: Date.now(),
                isRetry: true,
                retrySourceSubmittedAt: session.end_time || session.start_time,
                retrySourceSessionId: session.session_id
            };

            sessionStorage.setItem('examSession', JSON.stringify(newSession));
            this.hideToast(loadingToast);
            window.location.href = 'exam.html';
        } catch (error) {
            console.error('錯題重練失敗:', error);
            this.showToast('建立錯題重練失敗，請稍後再試', 'error');
        }
    }

    normalizeRecordToQuestion(record) {
        // 將資料庫的 exercise_record 轉為 exam.js 期望的結構（確保 options 為陣列）
        let optionsArray = [];
        const ac = record.answer_choices;
        if (Array.isArray(ac)) {
            optionsArray = ac;
        } else if (ac && typeof ac === 'object') {
            const order = ['A', 'B', 'C', 'D', 'E', 'F'];
            optionsArray = order.map(k => ac[k]).filter(v => v !== undefined);
        }
        const correctIndex = this.resolveCorrectIndex(record.correct_answer, optionsArray);

        return {
            id: record.question_id,
            question: record.question_content,
            options: optionsArray,
            answer: correctIndex,
            correctAnswer: correctIndex,
            correct_answer: correctIndex,
            explanation: record.explanation,
            difficulty: record.difficulty,
            knowledgePoints: record.knowledge_points || [],
            topic: record.question_topic,
            image_filename: record.image_filename,
            image_url: record.image_url
        };
    }

    resolveCorrectIndex(sourceAnswer, optionsArray) {
        if (sourceAnswer === null || sourceAnswer === undefined) return 0;
        if (typeof sourceAnswer === 'number') return sourceAnswer;
        const str = String(sourceAnswer).trim();
        const upper = str.toUpperCase();
        const letterMap = { 'A': 0, 'B': 1, 'C': 2, 'D': 3, 'E': 4, 'F': 5 };
        if (letterMap.hasOwnProperty(upper)) return letterMap[upper];
        if (/^\d+$/.test(str)) return parseInt(str, 10);
        const idx = optionsArray.findIndex(opt => String(opt).trim() === str);
        return idx >= 0 ? idx : 0;
    }

    shuffleArray(array) {
        const result = array.slice();
        for (let i = result.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            const temp = result[i];
            result[i] = result[j];
            result[j] = temp;
        }
        return result;
    }

    displayEmptyRecords() {
        const sessionsList = document.getElementById('sessionsList');
        if (sessionsList) {
            sessionsList.innerHTML = `
                <div class="flex flex-col items-center justify-center py-12 text-gray-500">
                    <span class="material-icons text-6xl mb-4">history_edu</span>
                    <h3 class="text-lg font-medium mb-2">尚無練習記錄</h3>
                    <p class="text-sm">開始您的第一次練習吧！</p>
                    <a href="exercise.html" class="mt-4 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors">
                        開始練習
                    </a>
                </div>
            `;
        }
    }

    getGradeDisplayName(grade) {
        const gradeMap = {
            '7A': '七上',
            '7B': '七下',
            '8A': '八上',
            '8B': '八下',
            '9A': '九上',
            '9B': '九下'
        };
        return gradeMap[grade] || grade;
    }

    getDifficultyText(difficulty) {
        const difficultyMap = {
            'easy': '簡單',
            'normal': '普通',
            'hard': '困難'
        };
        return difficultyMap[difficulty] || difficulty;
    }

    getDifficultyColor(difficulty) {
        const colorMap = {
            'easy': 'bg-green-100 text-green-600',
            'normal': 'bg-yellow-100 text-yellow-600',
            'hard': 'bg-red-100 text-red-600'
        };
        return colorMap[difficulty] || 'bg-gray-100 text-gray-600';
    }

    getAccuracyColor(accuracy) {
        if (accuracy === '未完成') return 'text-gray-500';

        const percent = parseInt(accuracy);
        if (percent >= 80) return 'text-green-600';
        if (percent >= 60) return 'text-yellow-600';
        return 'text-red-600';
    }

    truncateText(text, maxLength) {
        if (!text) return '';
        if (text.length <= maxLength) return text;
        return text.substring(0, maxLength) + '...';
    }

    formatDate(date) {
        const now = new Date();
        const diffTime = Math.abs(now - date);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays === 1) {
            return '今天';
        } else if (diffDays === 2) {
            return '昨天';
        } else if (diffDays <= 7) {
            return `${diffDays - 1} 天前`;
        } else {
            return date.toLocaleDateString('zh-TW');
        }
    }

    async viewRecordDetails(sessionId) {
        try {
            // 直接跳轉到結果頁面並帶上 sessionId 參數
            // result.js 會自動從 API 載入歷史數據
            window.location.href = `result.html?sessionId=${sessionId}`;

        } catch (error) {
            console.error('查看記錄詳情失敗:', error);
            this.showToast('載入詳細資料失敗，請稍後再試', 'error');
        }
    }

    updatePagination() {
        const totalPages = Math.ceil(this.totalRecords / this.pageSize);

        // 更新分頁資訊
        const pageInfo = document.getElementById('pageInfo');
        if (pageInfo) {
            pageInfo.textContent = `第 ${this.currentPage} 頁，共 ${totalPages} 頁`;
        }

        // 更新按鈕狀態
        const prevBtn = document.getElementById('prevPage');
        const nextBtn = document.getElementById('nextPage');

        if (prevBtn) {
            prevBtn.disabled = this.currentPage <= 1;
            prevBtn.classList.toggle('opacity-50', this.currentPage <= 1);
        }

        if (nextBtn) {
            nextBtn.disabled = this.currentPage >= totalPages;
            nextBtn.classList.toggle('opacity-50', this.currentPage >= totalPages);
        }
    }

    previousPage() {
        if (this.currentPage > 1) {
            this.currentPage--;
            this.loadLearningRecords();
        }
    }

    nextPage() {
        const totalPages = Math.ceil(this.totalRecords / this.pageSize);
        if (this.currentPage < totalPages) {
            this.currentPage++;
            this.loadLearningRecords();
        }
    }

    showLoading() {
        const sessionsList = document.getElementById('sessionsList');
        if (sessionsList) {
            sessionsList.innerHTML = `
                <div class="flex items-center justify-center py-12 text-gray-500">
                    <span class="material-icons animate-spin mr-2">refresh</span>
                    載入中...
                </div>
            `;
        }
    }

    hideLoading() {
        // Loading 狀態由 displayRecords 或 displayEmptyRecords 覆蓋
    }

    showError(message) {
        console.error(message);
        const sessionsList = document.getElementById('sessionsList');
        if (sessionsList) {
            sessionsList.innerHTML = `
                <div class="flex flex-col items-center justify-center py-12 text-red-500">
                    <span class="material-icons text-6xl mb-4">error</span>
                    <p>${message}</p>
                    <button onclick="historyManager.loadLearningRecords()" class="mt-4 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors">
                        重新載入
                    </button>
                </div>
            `;
        }
    }

    showToast(message, type = 'info') {
        const toast = document.createElement('div');
        const colors = {
            'info': 'bg-blue-500',
            'success': 'bg-green-500',
            'error': 'bg-red-500',
            'warning': 'bg-yellow-500'
        };

        toast.className = `fixed top-4 right-4 ${colors[type]} text-white px-6 py-3 rounded-lg shadow-lg z-50 transform transition-all duration-300 translate-x-full`;
        toast.textContent = message;

        document.body.appendChild(toast);

        // 動畫顯示
        setTimeout(() => {
            toast.classList.remove('translate-x-full');
        }, 100);

        // 自動隱藏（除了載入中的提示）
        if (type !== 'info') {
            setTimeout(() => {
                this.hideToast(toast);
            }, 3000);
        }

        return toast;
    }

    hideToast(toast) {
        if (toast && toast.parentNode) {
            toast.classList.add('translate-x-full');
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
            }, 300);
        }
    }

    showRecentRecordsHeader() {
        // 在練習記錄列表上方添加「最近5筆記錄」標題
        const sessionsList = document.getElementById('sessionsList');
        if (sessionsList && sessionsList.parentNode) {
            let header = document.getElementById('recentRecordsHeader');
            if (!header) {
                header = document.createElement('div');
                header.id = 'recentRecordsHeader';
                header.className = 'px-6 py-3 bg-blue-50 border-b border-blue-200';
                header.innerHTML = `
                    <div class="flex items-center justify-between">
                        <h4 class="text-sm font-medium text-blue-800 flex items-center">
                            <span class="material-icons text-sm mr-2">history</span>
                            最近 5 筆練習記錄
                        </h4>
                        <button onclick="historyManager.loadLearningRecords()" class="text-sm text-blue-600 hover:text-blue-800">
                            查看更多
                        </button>
                    </div>
                `;
                sessionsList.parentNode.insertBefore(header, sessionsList);
            }
            header.style.display = 'block';
        }
    }

    hideRecentRecordsHeader() {
        const header = document.getElementById('recentRecordsHeader');
        if (header) {
            header.style.display = 'none';
        }
    }
}

// 頁面載入完成後初始化
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOMContentLoaded 事件觸發');

    // 等待一小段時間確保所有腳本都載入完成
    setTimeout(() => {
        console.log('開始初始化 HistoryManager');
        console.log('authManager 狀態:', typeof authManager, authManager);
        console.log('learningAPI 狀態:', typeof learningAPI, learningAPI);

        // 確保authManager已初始化
        if (typeof authManager !== 'undefined' && authManager) {
            console.log('authManager 已載入，更新 UI');
            try {
                authManager.updateAuthUI();
            } catch (error) {
                console.error('更新認證 UI 失敗:', error);
            }
        } else {
            console.error('authManager 未定義或為空');
        }

        // 創建 HistoryManager 實例
        try {
            window.historyManager = new HistoryManager();
            console.log('HistoryManager 創建成功');
        } catch (error) {
            console.error('HistoryManager 創建失敗:', error);
        }
    }, 100); // 等待 100ms
});