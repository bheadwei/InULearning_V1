/**
 * 教師儀表板模組 - 增強版
 * 顯示課程統計、學生進度、最近活動等資訊
 */

// 全域變數
let dashboardData = {
    stats: {},
    classes: [],
    activities: [],
    highlights: {}
};

let apiConnected = false;

/**
 * 初始化儀表板
 */
document.addEventListener('DOMContentLoaded', async function () {
    setupCurrentDate();
    await loadDashboardData();
});

/**
 * 設定當前日期
 */
function setupCurrentDate() {
    const currentDateEl = document.getElementById('current-date');
    if (currentDateEl) {
        const now = new Date();
        const options = {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            weekday: 'long'
        };
        currentDateEl.textContent = now.toLocaleDateString('zh-TW', options);
    }
}

/**
 * 載入儀表板資料
 */
async function loadDashboardData() {
    showApiStatus('載入儀表板資料...');

    try {
        // 測試 API 連接
        await testApiConnection();

        // 載入各種資料
        await Promise.all([
            loadStats(),
            loadClasses(),
            loadRecentActivities(),
            loadTodayHighlights()
        ]);

        showApiStatus('資料載入完成', 'connected');

    } catch (error) {
        console.error('API 連接失敗:', error);
        apiConnected = false;
        // 不再使用假資料，顯示錯誤狀態
        dashboardData.stats = { totalClasses: 0, totalStudents: 0, activeSessions: 0, avgScore: 0 };
        dashboardData.classes = [];
        dashboardData.activities = [];
        renderStats();
        renderClasses();
        renderRecentActivities();
        showApiStatus('API 無法連接，無法載入資料', 'error');
    }
}

/**
 * 測試 API 連接
 */
async function testApiConnection() {
    try {
        await apiClient.get('/learning/health');
        apiConnected = true;
        console.log('✅ API 連接成功');
    } catch (error) {
        apiConnected = false;
        throw error;
    }
}

/**
 * 載入統計資料
 */
async function loadStats() {
    try {
        if (!apiConnected) throw new Error('API 未連接');

        // 嘗試從學習記錄獲取統計
        const response = await apiClient.get('/learning/records');

        if (response && response.sessions) {
            processStatsFromSessions(response.sessions);
        } else {
            throw new Error('無統計資料');
        }

    } catch (error) {
        console.error('載入統計資料失敗:', error.message);
        // 不再使用假資料，顯示錯誤狀態
        dashboardData.stats = {
            totalClasses: 0,
            totalStudents: 0,
            activeSessions: 0,
            avgScore: 0
        };
        renderStats();
    }
}

/**
 * 從會話資料處理統計
 */
function processStatsFromSessions(sessions) {
    const uniqueStudents = new Set();
    const uniqueClasses = new Set();
    let totalScore = 0;
    let scoreCount = 0;

    sessions.forEach(session => {
        if (session.user_id) uniqueStudents.add(session.user_id);
        if (session.class) uniqueClasses.add(session.class);
        if (session.score !== undefined && session.score !== null) {
            totalScore += session.score;
            scoreCount++;
        }
    });

    dashboardData.stats = {
        totalClasses: uniqueClasses.size,
        totalStudents: uniqueStudents.size,
        activeSessions: sessions.length,
        avgScore: scoreCount > 0 ? Math.round(totalScore / scoreCount) : 0
    };

    renderStats();
}



/**
 * 載入班級資料
 */
async function loadClasses() {
    try {
        if (!apiConnected) throw new Error('API 未連接');

        // 嘗試載入班級資料
                    const response = await apiClient.get('/relationships/teacher-class');

        if (response && (response.data || response.items || response.length > 0)) {
            dashboardData.classes = response.data || response.items || response || [];
        } else {
            throw new Error('無班級資料');
        }

    } catch (error) {
        console.error('載入班級資料失敗:', error.message);
        // 不再使用假資料，顯示錯誤狀態
        dashboardData.classes = [];
        renderClasses();
    }

    renderClasses();
}



/**
 * 載入最近活動
 */
async function loadRecentActivities() {
    try {
        if (!apiConnected) throw new Error('API 未連接');

        const response = await apiClient.get('/learning/recent');

        if (response && response.sessions) {
            processActivitiesFromSessions(response.sessions);
        } else {
            throw new Error('無活動資料');
        }

    } catch (error) {
        console.error('載入活動資料失敗:', error.message);
        // 不再使用假資料，顯示錯誤狀態
        dashboardData.activities = [];
        renderRecentActivities();
    }

    renderRecentActivities();
}

/**
 * 從會話資料處理活動
 */
function processActivitiesFromSessions(sessions) {
    dashboardData.activities = sessions.slice(0, 5).map(session => ({
        type: 'quiz_completed',
        description: `${session.user_name || '學生'} 完成了 ${session.subject || '練習'}`,
        timestamp: session.created_at || new Date().toISOString(),
        user: session.user_name || '學生'
    }));
}



/**
 * 載入今日重點
 */
async function loadTodayHighlights() {
    try {
        // 嘗試從 API 載入真實資料
        const response = await apiClient.get('/teacher/highlights');
        if (response && response.data) {
            dashboardData.highlights = response.data;
        } else {
            // 如果沒有資料，顯示預設值
            dashboardData.highlights = {
                todayClasses: '0 堂課程',
                pendingAssignments: '0 份作業',
                attentionNeeded: '0 位學生'
            };
        }
    } catch (error) {
        console.error('載入今日重點失敗:', error.message);
        // 顯示預設值
        dashboardData.highlights = {
            todayClasses: '0 堂課程',
            pendingAssignments: '0 份作業',
            attentionNeeded: '0 位學生'
        };
    }

    renderTodayHighlights();
}



/**
 * 渲染統計資料
 */
function renderStats() {
    const stats = dashboardData.stats;

    document.getElementById('total-classes').textContent = stats.totalClasses || 0;
    document.getElementById('total-students').textContent = stats.totalStudents || 0;
    document.getElementById('active-sessions').textContent = stats.activeSessions || 0;
    document.getElementById('avg-score').textContent = `${stats.avgScore || 0}%`;

    // 更新趨勢指示器
    updateTrendIndicators();
}

/**
 * 更新趨勢指示器
 */
function updateTrendIndicators() {
    // 趨勢數據應該從 API 獲取，暫時顯示靜態數據
    const trends = {
        'classes-trend': 0,
        'students-trend': 0,
        'sessions-trend': 0,
        'score-trend': 0
    };

    Object.entries(trends).forEach(([id, value]) => {
        const element = document.getElementById(id);
        if (element) {
            element.innerHTML = `<i class="fas fa-minus"></i> 0`;
        }
    });
}

/**
 * 渲染班級概覽
 */
function renderClasses() {
    const classesGrid = document.getElementById('classes-grid');
    if (!classesGrid) return;

    if (dashboardData.classes.length === 0) {
        classesGrid.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-users"></i>
                <h3>尚未建立班級</h3>
                <p>點擊「班級管理」開始建立您的第一個班級</p>
            </div>
        `;
        return;
    }

    classesGrid.innerHTML = dashboardData.classes.slice(0, 6).map(cls => `
        <div class="class-card" onclick="location.href='pages/students-enhanced.html?classId=${cls.id}&class=${encodeURIComponent(cls.class_name || cls.name)}'">
            <div class="class-header">
                <h3>${cls.class_name || cls.name}</h3>
                <div class="class-badge">${cls.student_count || 0} 人</div>
            </div>
            <div class="class-stats">
                <div class="class-stat">
                    <span class="stat-label">平均分數</span>
                    <span class="stat-value">${cls.avg_score || 0}</span>
                </div>
                <div class="class-stat">
                    <span class="stat-label">最後活動</span>
                    <span class="stat-value">${cls.last_activity || '今天'}</span>
                </div>
            </div>
            <div class="class-actions">
                <button class="btn-sm" onclick="event.stopPropagation(); viewClassDetails('${cls.id}')">
                    <i class="fas fa-eye"></i> 查看
                </button>
                <button class="btn-sm" onclick="event.stopPropagation(); manageClass('${cls.id}')">
                    <i class="fas fa-cog"></i> 管理
                </button>
            </div>
        </div>
    `).join('');
}

/**
 * 渲染今日重點
 */
function renderTodayHighlights() {
    const highlights = dashboardData.highlights;

    document.getElementById('today-classes').textContent = highlights.todayClasses || '載入中...';
    document.getElementById('pending-assignments').textContent = highlights.pendingAssignments || '載入中...';
    document.getElementById('attention-needed').textContent = highlights.attentionNeeded || '載入中...';
}

/**
 * 渲染最近活動
 */
function renderRecentActivities() {
    const activitiesList = document.getElementById('activity-list');
    if (!activitiesList) return;

    if (dashboardData.activities.length === 0) {
        activitiesList.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-history"></i>
                <h3>暫無最近活動</h3>
                <p>學生開始學習後，活動記錄會顯示在這裡</p>
            </div>
        `;
        return;
    }

    activitiesList.innerHTML = dashboardData.activities.map(activity => `
        <div class="activity-item">
            <div class="activity-icon ${getActivityIconClass(activity.type)}">
                <i class="${getActivityIcon(activity.type)}"></i>
            </div>
            <div class="activity-content">
                <p class="activity-text">${activity.description}</p>
                <span class="activity-time">${formatTimeAgo(activity.timestamp)}</span>
            </div>
        </div>
    `).join('');
}

/**
 * 獲取活動圖標
 */
function getActivityIcon(type) {
    const icons = {
        'assignment_submitted': 'fas fa-file-alt',
        'assignment_graded': 'fas fa-check-circle',
        'student_joined': 'fas fa-user-plus',
        'course_created': 'fas fa-plus-circle',
        'quiz_completed': 'fas fa-question-circle'
    };
    return icons[type] || 'fas fa-info-circle';
}

/**
 * 獲取活動圖標樣式
 */
function getActivityIconClass(type) {
    const classes = {
        'assignment_submitted': 'info',
        'assignment_graded': 'success',
        'student_joined': 'primary',
        'course_created': 'warning',
        'quiz_completed': 'secondary'
    };
    return classes[type] || 'secondary';
}

/**
 * 格式化時間
 */
function formatTimeAgo(timestamp) {
    const now = new Date();
    const time = new Date(timestamp);
    const diffInMinutes = Math.floor((now - time) / (1000 * 60));

    if (diffInMinutes < 1) return '剛剛';
    if (diffInMinutes < 60) return `${diffInMinutes} 分鐘前`;

    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours} 小時前`;

    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) return `${diffInDays} 天前`;

    return time.toLocaleDateString('zh-TW');
}

/**
 * 生成最後活動時間
 */
function generateLastActivity() {
    const activities = ['今天', '昨天', '2 天前', '3 天前', '1 週前'];
    return activities[Math.floor(Math.random() * activities.length)];
}

/**
 * 顯示 API 狀態
 */
function showApiStatus(message, type = 'warning') {
    const statusEl = document.getElementById('apiStatus');
    const textEl = document.getElementById('statusText');

    if (statusEl && textEl) {
        statusEl.style.display = 'block';
        statusEl.className = `api-status ${type}`;
        textEl.textContent = message;

        // 3秒後隱藏狀態訊息（除非是錯誤狀態）
        if (type !== 'error') {
            setTimeout(() => {
                statusEl.style.display = 'none';
            }, 3000);
        }
    }
}

/**
 * 重新整理儀表板
 */
function refreshDashboard() {
    loadDashboardData();
}

/**
 * 查看班級詳情
 */
function viewClassDetails(classId) {
    const cls = dashboardData.classes.find(c => c.id == classId);
    if (cls) {
        location.href = `pages/students-enhanced.html?classId=${classId}&class=${encodeURIComponent(cls.class_name || cls.name)}`;
    }
}

/**
 * 管理班級
 */
function manageClass(classId) {
    location.href = `pages/classes.html?classId=${classId}`;
}