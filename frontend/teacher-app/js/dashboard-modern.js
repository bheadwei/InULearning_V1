// 現代化教師儀表板 JavaScript
class ModernTeacherDashboard {
    constructor() {
        this.data = {
            teacher: {
                name: '',
                displayName: '',
                subject: '',
                classes: []
            },
            stats: {
                totalClasses: 0,
                totalStudents: 0,
                activeSessions: 0,
                avgScore: 0
            },
            highlights: {
                todayClasses: [],
                pendingAssignments: 0,
                attentionNeeded: 0
            },
            recentActivity: []
        };

        this.previousStats = null;
        this.trends = {
            totalClasses: '+0',
            totalStudents: '+0',
            activeSessions: '+0',
            avgScore: '+0%'
        };

        this.init();
    }

    async init() {
        // 檢查認證狀態
        if (typeof authManager !== 'undefined') {
            await authManager.checkAuthStatus();
        }
        
        this.showLoading();
        this.hydrateTeacherFromLocal();
        await this.loadDashboardData();
        this.setupEventListeners();
        this.renderDashboard();
        this.startAutoRefresh();
        this.hideLoading();
        this.addAnimations();
    }

    async loadDashboardData() {
        try {
            const prev = { ...this.data.stats };

            // 並行抓取：教師聚合儀表板 + 關係服務（以關係服務為準以保證數值正確）
            const [dashboard, rels] = await Promise.all([
                apiClient.get('/teacher/dashboard').catch(() => null),
                apiClient.get('/relationships/teacher-class').catch(() => [])
            ]);

            // 標準化班級列表（以關係服務為準）
            const relClasses = Array.isArray(rels)
                ? rels.map(r => ({ id: r.class_id, name: r.class_name || `班級 ${r.class_id}`, subject: r.subject || '' }))
                : [];

            // 逐班級抓學生數，得到準確總學生數
            const classWithCounts = await Promise.all(relClasses.map(c => (
                apiClient.get(`/relationships/classes/${c.id}/students`)
                    .then(arr => ({ id: c.id, name: c.name, students: Array.isArray(arr) ? arr.length : ((arr && typeof arr.count === 'number') ? arr.count : 0) }))
                    .catch(() => ({ id: c.id, name: c.name, students: 0 }))
            )));

            // 儀表板額外數據（若有）
            const activeClasses = (dashboard && dashboard.overall_stats && dashboard.overall_stats.active_classes) || 0;
            const avgAccuracy = (dashboard && dashboard.overall_stats && dashboard.overall_stats.average_accuracy) || 0;

            // 以關係服務聚合為準，覆蓋總班級與總學生數
            this.data.stats = {
                totalClasses: relClasses.length,
                totalStudents: classWithCounts.reduce((sum, r) => sum + (r.students || 0), 0),
                activeSessions: activeClasses || 0,
                avgScore: Math.round((typeof avgAccuracy === 'number' ? avgAccuracy : 0) * 10) / 10
            };

            this.data.teacher.classes = classWithCounts.map(r => ({
                id: r.id,
                name: r.name,
                students: r.students,
                avgScore: 0,
                activeStudents: 0,
                lastActivity: ''
            }));

            // 最近活動（如有，僅裝飾性，不影響統計數值）
            if (dashboard && Array.isArray(dashboard.recent_activities)) {
                this.data.recentActivity = dashboard.recent_activities.map((a) => ({
                    type: a.type || 'system',
                    icon: 'fas fa-bell',
                    title: a.title || a.message || '活動',
                    description: a.description || '',
                    time: a.time || a.timestamp || ''
                }));
            }

            this.computeTrends(prev, this.data.stats);

        } catch (error) {
            console.error('載入儀表板資料失敗（聚合+關係服務）:', error);
            // 後備方案
            await this.loadDashboardDataFallback();
            this.showNotification('已使用後備資料來源', 'info');
        }
    }

    async loadDashboardDataFallback() {
        try {
            // 教師的班級列表（關係服務）
            const rels = await apiClient.get('/relationships/teacher-class');
            const classes = Array.isArray(rels) ? rels.map(r => ({
                id: r.class_id,
                name: r.class_name || `班級 ${r.class_id}`,
                subject: r.subject || '',
            })) : [];

            // 逐班級抓學生數
            const results = await Promise.all(classes.map(c => (
                apiClient.get(`/relationships/classes/${c.id}/students`).then(arr => ({ id: c.id, name: c.name, students: Array.isArray(arr) ? arr.length : 0 }))
                    .catch(() => ({ id: c.id, name: c.name, students: 0 }))
            )));

            // 更新 UI 結構
            const prev = { ...this.data.stats };
            this.data.stats.totalClasses = classes.length;
            this.data.stats.totalStudents = results.reduce((sum, r) => sum + (r.students || 0), 0);
            this.data.stats.activeSessions = 0;
            this.data.stats.avgScore = 0;

            this.data.teacher.classes = results.map(r => ({
                id: r.id,
                name: r.name,
                students: r.students,
                avgScore: 0,
                activeStudents: 0,
                lastActivity: ''
            }));

            this.computeTrends(prev, this.data.stats);
        } catch (e) {
            console.error('後備資料來源載入失敗:', e);
        }
    }

    computeTrends(prev, current) {
        if (!prev || typeof prev !== 'object') {
            this.trends = { totalClasses: '+0', totalStudents: '+0', activeSessions: '+0', avgScore: '+0%' };
            this.previousStats = { ...current };
            return;
        }
        const delta = (a, b) => (typeof a === 'number' && typeof b === 'number') ? (b - a) : 0;
        const dc = delta(prev.totalClasses, current.totalClasses);
        const ds = delta(prev.totalStudents, current.totalStudents);
        const da = delta(prev.activeSessions, current.activeSessions);
        const dscore = Math.round((delta(prev.avgScore, current.avgScore)) * 10) / 10;
        this.trends = {
            totalClasses: `${dc >= 0 ? '+' : ''}${dc}`,
            totalStudents: `${ds >= 0 ? '+' : ''}${ds}`,
            activeSessions: `${da >= 0 ? '+' : ''}${da}`,
            avgScore: `${dscore >= 0 ? '+' : ''}${dscore}%`
        };
        this.previousStats = { ...current };
    }

    hydrateTeacherFromLocal() {
        try {
            const userStr = localStorage.getItem('user_info');
            if (userStr) {
                const user = JSON.parse(userStr);
                const display = user.name || user.email || '';
                this.data.teacher.name = display;
                this.data.teacher.displayName = display;
            }
        } catch (_) {}
    }

    loadMockData() {
        // 已停用模擬資料：保持真實數據為唯一來源
        return;
    }

    setupEventListeners() {
        // 用戶下拉選單
        const userToggle = document.querySelector('.user-dropdown-toggle');
        const userMenu = document.querySelector('.user-dropdown-menu');

        if (userToggle && userMenu) {
            userToggle.addEventListener('click', (e) => {
                e.stopPropagation();
                userMenu.classList.toggle('show');
            });

            document.addEventListener('click', () => {
                userMenu.classList.remove('show');
            });
        }

        // 登出功能
        const logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.handleLogout();
            });
        }

        // 重新整理按鈕
        const refreshBtn = document.querySelector('.refresh-btn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => {
                this.refreshDashboard();
            });
        }
    }

    renderDashboard() {
        this.updateTeacherInfo();
        this.updateStats();
        this.updateHighlights();
        this.renderClasses();
        this.renderRecentActivity();
        this.updateCurrentDate();
    }

    updateTeacherInfo() {
        const teacherNameElements = document.querySelectorAll('#teacher-name, #teacher-display-name');
        teacherNameElements.forEach(element => {
            if (element) {
                element.textContent = this.data.teacher.displayName;
            }
        });
    }

    updateStats() {
        const stats = this.data.stats;

        this.updateStatElement('total-classes', stats.totalClasses, this.trends.totalClasses);
        this.updateStatElement('total-students', stats.totalStudents, this.trends.totalStudents);
        this.updateStatElement('active-sessions', stats.activeSessions || 0, this.trends.activeSessions);
        this.updateStatElement('avg-score', `${stats.avgScore || 0}%`, this.trends.avgScore);
    }

    updateStatElement(id, value, trend) {
        const element = document.getElementById(id);
        const trendElement = document.getElementById(id.replace('total-', '').replace('avg-', '') + '-trend');

        if (element) {
            this.animateNumber(element, value);
        }

        if (trendElement && typeof trend !== 'undefined') {
            const isNegative = (typeof trend === 'string') && trend.trim().startsWith('-');
            const icon = isNegative ? 'fa-arrow-down' : 'fa-arrow-up';
            const color = isNegative ? '#EF4444' : '#10B981';
            trendElement.style.color = color;
            trendElement.innerHTML = `<i class="fas ${icon}"></i> ${trend}`;
        }
    }

    animateNumber(element, targetValue) {
        const isPercentage = typeof targetValue === 'string' && targetValue.includes('%');
        const numericValue = parseFloat(targetValue);
        const startValue = 0;
        const duration = 1500;
        const startTime = performance.now();

        const animate = (currentTime) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);

            // 使用緩動函數
            const easeOutQuart = 1 - Math.pow(1 - progress, 4);
            const currentValue = startValue + (numericValue - startValue) * easeOutQuart;

            if (isPercentage) {
                element.textContent = `${Math.round(currentValue * 10) / 10}%`;
            } else {
                element.textContent = Math.round(currentValue);
            }

            if (progress < 1) {
                requestAnimationFrame(animate);
            }
        };

        requestAnimationFrame(animate);
    }

    updateHighlights() {
        const highlights = this.data.highlights;

        // 今日課程
        const todayClassesElement = document.getElementById('today-classes');
        if (todayClassesElement) {
            if (highlights.todayClasses.length > 0) {
                const classesText = highlights.todayClasses
                    .map(c => `${c.time} ${c.class}`)
                    .join(', ');
                todayClassesElement.textContent = classesText;
            } else {
                todayClassesElement.textContent = '今日無課程安排';
            }
        }

        // 待批改作業
        const pendingElement = document.getElementById('pending-assignments');
        if (pendingElement) {
            pendingElement.textContent = `${highlights.pendingAssignments} 份作業待批改`;
        }

        // 需要關注
        const attentionElement = document.getElementById('attention-needed');
        if (attentionElement) {
            attentionElement.textContent = `${highlights.attentionNeeded} 位學生需要關注`;
        }
    }

    renderClasses() {
        const classesGrid = document.getElementById('classes-grid');
        if (!classesGrid) return;

        if (this.data.teacher.classes.length === 0) {
            classesGrid.innerHTML = `
                <div style="grid-column: 1 / -1; text-align: center; padding: 2rem; color: rgba(255, 255, 255, 0.7);">
                    <i class="fas fa-users" style="font-size: 3rem; margin-bottom: 1rem; opacity: 0.5;"></i>
                    <p>尚未有班級資料</p>
                </div>
            `;
            return;
        }

        classesGrid.innerHTML = this.data.teacher.classes.map(classData => `
            <div class="class-card fade-in-up" onclick="location.href='pages/students-enhanced.html'">
                <h4>${classData.name}</h4>
                <p>${classData.students} 位學生</p>
                <p>平均分數: ${classData.avgScore}%</p>
                <p>活躍學生: ${classData.activeStudents}/${classData.students}</p>
                <p style="font-size: 0.8rem; margin-top: 0.5rem;">最後活動: ${classData.lastActivity}</p>
            </div>
        `).join('');
    }

    renderRecentActivity() {
        const activityList = document.getElementById('activity-list');
        if (!activityList) return;

        if (this.data.recentActivity.length === 0) {
            activityList.innerHTML = `
                <div style="text-align: center; padding: 2rem; color: rgba(255, 255, 255, 0.7);">
                    <i class="fas fa-clock" style="font-size: 3rem; margin-bottom: 1rem; opacity: 0.5;"></i>
                    <p>暫無最近活動</p>
                </div>
            `;
            return;
        }

        activityList.innerHTML = this.data.recentActivity.map(activity => `
            <div class="activity-item fade-in-up">
                <div class="activity-icon">
                    <i class="${activity.icon}"></i>
                </div>
                <div class="activity-content">
                    <h5>${activity.title}</h5>
                    <p>${activity.description}</p>
                </div>
                <div class="activity-time">${activity.time}</div>
            </div>
        `).join('');
    }

    updateCurrentDate() {
        const dateElement = document.getElementById('current-date');
        if (dateElement) {
            const now = new Date();
            const options = {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                weekday: 'long'
            };
            dateElement.textContent = now.toLocaleDateString('zh-TW', options);
        }
    }

    addAnimations() {
        // 為元素添加淡入動畫
        const elements = document.querySelectorAll('.stat-card, .highlight-card, .action-card');
        elements.forEach((element, index) => {
            element.style.animationDelay = `${index * 0.1}s`;
            element.classList.add('fade-in-up');
        });
    }

    showLoading() {
        const loadingOverlay = document.getElementById('loading-overlay');
        if (loadingOverlay) {
            loadingOverlay.style.display = 'flex';
        }
    }

    hideLoading() {
        const loadingOverlay = document.getElementById('loading-overlay');
        if (loadingOverlay) {
            setTimeout(() => {
                loadingOverlay.style.display = 'none';
            }, 500);
        }
    }

    async refreshDashboard() {
        this.showLoading();
        await this.loadDashboardData();
        this.renderDashboard();
        this.hideLoading();

        // 顯示刷新成功提示
        this.showNotification('儀表板已更新', 'success');
    }

    showNotification(message, type = 'info') {
        // 創建通知元素
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: var(--glass-bg);
            backdrop-filter: blur(20px);
            border: 1px solid var(--glass-border);
            border-radius: 12px;
            padding: 1rem 1.5rem;
            color: white;
            box-shadow: var(--shadow-soft);
            z-index: 10000;
            transform: translateX(100%);
            transition: var(--transition);
        `;
        notification.textContent = message;

        document.body.appendChild(notification);

        // 顯示動畫
        setTimeout(() => {
            notification.style.transform = 'translateX(0)';
        }, 100);

        // 自動隱藏
        setTimeout(() => {
            notification.style.transform = 'translateX(100%)';
            setTimeout(() => {
                document.body.removeChild(notification);
            }, 300);
        }, 3000);
    }

    handleLogout() {
        if (confirm('確定要登出嗎？')) {
            // 清除本地存儲
            localStorage.removeItem('teacher_token');
            sessionStorage.clear();

            // 重定向到登入頁面
            window.location.href = '../shared/auth/login.html';
        }
    }

    startAutoRefresh() {
        // 每5分鐘自動刷新一次數據
        setInterval(() => {
            this.loadDashboardData().then(() => {
                this.renderDashboard();
            });
        }, 5 * 60 * 1000);
    }
}

// 全域函數
function refreshDashboard() {
    if (window.modernDashboard) {
        window.modernDashboard.refreshDashboard();
    }
}

// 初始化
document.addEventListener('DOMContentLoaded', () => {
    window.modernDashboard = new ModernTeacherDashboard();
});