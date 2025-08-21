/**
 * 教師儀表板模組 - 增強版
 * 顯示課程統計、學生進度、最近活動等資訊
 */
class TeacherDashboard {
    constructor() {
        this.statsData = {};
        this.recentActivities = [];
        this.classes = [];
        this.apiConnected = false;
        this.init();
    }

    init() {
        this.setupCurrentDate();
        this.loadDashboardData();
        this.setupAutoRefresh();
        this.bindEvents();
    }

    /**
     * 載入儀表板資料
     */
    async loadDashboardData() {
        try {
            showLoading();

            // 並行載入各種資料
            const [statsResponse, activitiesResponse, upcomingResponse] = await Promise.all([
                this.loadStats(),
                this.loadRecentActivities(),
                this.loadUpcomingTasks()
            ]);

            if (statsResponse.success) {
                this.statsData = statsResponse.data;
                this.renderStats();
            }

            if (activitiesResponse.success) {
                this.recentActivities = activitiesResponse.data;
                this.renderRecentActivities();
            }

            if (upcomingResponse.success) {
                this.renderUpcomingTasks(upcomingResponse.data);
            }

        } catch (error) {
            console.error('載入儀表板資料失敗:', error);
            showAlert('載入儀表板資料失敗', 'error');
        } finally {
            hideLoading();
        }
    }

    /**
     * 載入統計資料
     */
    async loadStats() {
        return await apiClient.get('/teacher/dashboard/stats');
    }

    /**
     * 載入最近活動
     */
    async loadRecentActivities() {
        return await apiClient.get('/teacher/dashboard/activities');
    }

    /**
     * 載入即將到來的任務
     */
    async loadUpcomingTasks() {
        return await apiClient.get('/teacher/dashboard/upcoming');
    }

    /**
     * 渲染統計資料
     */
    renderStats() {
        const statsContainer = document.getElementById('stats-grid');
        if (!statsContainer || !this.statsData) return;

        const stats = [
            {
                title: '總課程數',
                value: this.statsData.totalCourses || 0,
                icon: 'fas fa-book',
                color: 'primary',
                change: this.statsData.courseChange || 0
            },
            {
                title: '活躍學生',
                value: this.statsData.activeStudents || 0,
                icon: 'fas fa-users',
                color: 'success',
                change: this.statsData.studentChange || 0
            },
            {
                title: '待批改作業',
                value: this.statsData.pendingAssignments || 0,
                icon: 'fas fa-clipboard-check',
                color: 'warning',
                change: this.statsData.assignmentChange || 0
            },
            {
                title: '平均完成率',
                value: `${this.statsData.avgCompletionRate || 0}%`,
                icon: 'fas fa-chart-line',
                color: 'info',
                change: this.statsData.completionChange || 0
            }
        ];

        statsContainer.innerHTML = stats.map(stat => `
            <div class="stat-card">
                <div class="stat-icon ${stat.color}">
                    <i class="${stat.icon}"></i>
                </div>
                <div class="stat-content">
                    <h3 class="stat-value">${stat.value}</h3>
                    <p class="stat-title">${stat.title}</p>
                    ${stat.change !== 0 ? `
                        <span class="stat-change ${stat.change > 0 ? 'positive' : 'negative'}">
                            <i class="fas fa-arrow-${stat.change > 0 ? 'up' : 'down'}"></i>
                            ${Math.abs(stat.change)}%
                        </span>
                    ` : ''}
                </div>
            </div>
        `).join('');
    }

    /**
     * 渲染最近活動
     */
    renderRecentActivities() {
        const activitiesContainer = document.getElementById('recent-activities');
        if (!activitiesContainer || !this.recentActivities.length) return;

        activitiesContainer.innerHTML = this.recentActivities.map(activity => `
            <div class="activity-item">
                <div class="activity-icon ${this.getActivityIconClass(activity.type)}">
                    <i class="${this.getActivityIcon(activity.type)}"></i>
                </div>
                <div class="activity-content">
                    <p class="activity-text">${activity.description}</p>
                    <span class="activity-time">${formatTimeAgo(activity.timestamp)}</span>
                </div>
            </div>
        `).join('');
    }

    /**
     * 渲染即將到來的任務
     */
    renderUpcomingTasks(tasks) {
        const tasksContainer = document.getElementById('upcoming-tasks');
        if (!tasksContainer || !tasks.length) return;

        tasksContainer.innerHTML = tasks.map(task => `
            <div class="task-item">
                <div class="task-priority ${task.priority}"></div>
                <div class="task-content">
                    <h4 class="task-title">${task.title}</h4>
                    <p class="task-description">${task.description}</p>
                    <div class="task-meta">
                        <span class="task-deadline">
                            <i class="fas fa-clock"></i>
                            ${formatDate(task.deadline)}
                        </span>
                        <span class="task-course">
                            <i class="fas fa-book"></i>
                            ${task.courseName}
                        </span>
                    </div>
                </div>
                <div class="task-actions">
                    <button class="btn btn-sm btn-primary" onclick="teacherDashboard.viewTask('${task.id}')">
                        查看
                    </button>
                </div>
            </div>
        `).join('');
    }

    /**
     * 獲取活動圖標
     */
    getActivityIcon(type) {
        const icons = {
            'assignment_submitted': 'fas fa-file-alt',
            'assignment_graded': 'fas fa-check-circle',
            'student_joined': 'fas fa-user-plus',
            'course_created': 'fas fa-plus-circle',
            'announcement': 'fas fa-bullhorn',
            'quiz_completed': 'fas fa-question-circle'
        };
        return icons[type] || 'fas fa-info-circle';
    }

    /**
     * 獲取活動圖標樣式類別
     */
    getActivityIconClass(type) {
        const classes = {
            'assignment_submitted': 'info',
            'assignment_graded': 'success',
            'student_joined': 'primary',
            'course_created': 'warning',
            'announcement': 'secondary',
            'quiz_completed': 'danger'
        };
        return classes[type] || 'secondary';
    }

    /**
     * 設定自動重新整理
     */
    setupAutoRefresh() {
        // 每 5 分鐘重新整理一次資料
        setInterval(() => {
            this.loadDashboardData();
        }, 5 * 60 * 1000);
    }

    /**
     * 綁定事件
     */
    bindEvents() {
        // 快速操作按鈕
        const quickActions = document.querySelectorAll('.quick-action');
        quickActions.forEach(action => {
            action.addEventListener('click', (e) => {
                const actionType = e.currentTarget.dataset.action;
                this.handleQuickAction(actionType);
            });
        });
    }

    /**
     * 處理快速操作
     */
    handleQuickAction(actionType) {
        switch (actionType) {
            case 'create-course':
                window.location.href = 'pages/courses.html?action=create';
                break;
            case 'grade-assignments':
                window.location.href = 'pages/assignments.html?filter=pending';
                break;
            case 'view-students':
                window.location.href = 'pages/students-enhanced.html';
                break;
            case 'create-announcement':
                window.location.href = 'pages/announcements.html?action=create';
                break;
        }
    }

    /**
     * 查看任務詳情
     */
    viewTask(taskId) {
        // 根據任務類型導向相應頁面
        window.location.href = `pages/tasks.html?id=${taskId}`;
    }

    /**
     * 重新整理儀表板
     */
    refresh() {
        this.loadDashboardData();
    }
}

// 初始化教師儀表板
const teacherDashboard = new TeacherDashboard(); 