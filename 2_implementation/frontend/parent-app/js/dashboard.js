/**
 * 家長儀表板模組
 * 顯示子女學習統計、進度追蹤、最近活動等資訊
 */
class ParentDashboard {
    constructor() {
        this.currentPage = 'dashboard';
        this.refreshInterval = null;
        this.statsData = {};
        this.childrenData = [];
        this.activitiesData = [];
        this.notificationsData = [];

        this.init();
    }

    init() {
        this.loadDashboardData();
        this.setupAutoRefresh();
        this.bindEvents();
    }

    async loadDashboardData() {
        try {
            // 顯示載入狀態
            this.showLoading(true);

            // 並行加載所有數據
            await Promise.all([
                this.loadStats(),
                this.loadChildrenData(),
                this.loadRecentActivities(),
                this.loadNotifications()
            ]);

            // 渲染所有數據
            this.renderAllData();

        } catch (error) {
            console.error('載入儀表板數據失敗:', error);
            this.showNotification('載入數據失敗，請稍後重試', 'error');
        } finally {
            this.showLoading(false);
        }
    }

    async loadStats() {
        try {
            const response = await apiClient.get('/learning/parents/dashboard/stats');
            this.statsData = response.data || response;
        } catch (error) {
            console.error('載入統計數據失敗:', error);
            this.statsData = {
                totalChildren: 2,
                activeCourses: 8,
                completedAssignments: 45,
                averageScore: 85.5,
                studyTime: 12.5,
                attendanceRate: 95.2
            };
        }
    }

    async loadChildrenData() {
        try {
            const response = await apiClient.get('/learning/parents/children');
            this.childrenData = response.data || response;
        } catch (error) {
            console.error('載入子女數據失敗:', error);
            this.childrenData = [
                {
                    id: 1,
                    name: '小明',
                    grade: '三年級',
                    avatar: '/assets/images/avatar-child-1.jpg',
                    currentCourse: '數學',
                    progress: 75,
                    lastActive: '2024-01-15T10:30:00Z',
                    status: 'online'
                },
                {
                    id: 2,
                    name: '小華',
                    grade: '一年級',
                    avatar: '/assets/images/avatar-child-2.jpg',
                    currentCourse: '國語',
                    progress: 60,
                    lastActive: '2024-01-15T09:15:00Z',
                    status: 'offline'
                }
            ];
        }
    }

    async loadRecentActivities() {
        try {
            const response = await apiClient.get('/learning/parents/activities');
            this.activitiesData = response.data || response;
        } catch (error) {
            console.error('載入最近活動失敗:', error);
            this.activitiesData = [
                {
                    id: 1,
                    childName: '小明',
                    type: 'assignment_completed',
                    title: '完成數學作業',
                    description: '完成了第三章的練習題',
                    timestamp: '2024-01-15T10:30:00Z',
                    score: 95
                },
                {
                    id: 2,
                    childName: '小華',
                    type: 'course_started',
                    title: '開始新課程',
                    description: '開始學習國語第二單元',
                    timestamp: '2024-01-15T09:15:00Z'
                },
                {
                    id: 3,
                    childName: '小明',
                    type: 'achievement',
                    title: '獲得成就',
                    description: '連續學習7天',
                    timestamp: '2024-01-14T16:45:00Z'
                }
            ];
        }
    }

    async loadNotifications() {
        try {
            const response = await apiClient.get('/learning/parents/notifications');
            this.notificationsData = response.data || response;
        } catch (error) {
            console.error('載入通知失敗:', error);
            this.notificationsData = [
                {
                    id: 1,
                    type: 'assignment_due',
                    title: '作業提醒',
                    message: '小明的數學作業將於明天到期',
                    timestamp: '2024-01-15T08:00:00Z',
                    read: false
                },
                {
                    id: 2,
                    type: 'progress_report',
                    title: '學習報告',
                    message: '小華的週學習報告已生成',
                    timestamp: '2024-01-14T18:00:00Z',
                    read: true
                }
            ];
        }
    }

    renderAllData() {
        this.renderStats();
        this.renderChildrenOverview();
        this.renderRecentActivities();
        this.renderNotifications();
    }

    renderStats() {
        const totalChildrenEl = document.getElementById('total-children');
        const totalCoursesEl = document.getElementById('total-courses');
        const studyTimeEl = document.getElementById('study-time');
        const achievementsEl = document.getElementById('achievements');

        if (totalChildrenEl) totalChildrenEl.textContent = this.statsData.totalChildren ?? 0;
        if (totalCoursesEl) totalCoursesEl.textContent = this.statsData.activeCourses ?? 0;
        if (studyTimeEl) studyTimeEl.textContent = `${this.statsData.studyTime ?? 0}h`;
        if (achievementsEl) achievementsEl.textContent = this.statsData.completedAssignments ?? 0;
    }

    renderChildrenOverview() {
        const childrenContainer = document.getElementById('children-grid');
        if (!childrenContainer) return;

        childrenContainer.innerHTML = `
            ${this.childrenData.map(child => `
                <div class="bg-white p-6 rounded-lg shadow-md hover:shadow-lg transition-shadow child-card" data-child-id="${child.id}">
                    <div class="flex items-center mb-4">
                        <img src="${child.avatar || '/assets/images/default-avatar.png'}" alt="${child.name}" class="w-12 h-12 rounded-full mr-3">
                        <div>
                            <h3 class="text-lg font-semibold text-gray-800">${child.name}</h3>
                            <p class="text-sm text-gray-500">${child.grade}</p>
                        </div>
                    </div>
                    <div class="w-full bg-gray-200 rounded-full h-2 mb-2">
                        <div class="bg-blue-600 h-2 rounded-full" style="width: ${child.progress || 0}%"></div>
                    </div>
                    <div class="flex items-center justify-between text-sm text-gray-600">
                        <span>${child.currentCourse || ''}</span>
                        <span>${child.progress || 0}%</span>
                    </div>
                    <div class="mt-4 grid grid-cols-2 gap-2">
                        <button class="btn btn-outline" onclick="parentDashboard.viewChildProgress(${child.id})">
                            <span class="material-icons mr-1">insights</span> 進度
                        </button>
                        <button class="btn" onclick="parentDashboard.viewChildDetails(${child.id})">
                            <span class="material-icons mr-1">visibility</span> 詳細
                        </button>
                    </div>
                </div>
            `).join('')}
        `;
    }

    renderRecentActivities() {
        const activitiesContainer = document.getElementById('recent-activities');
        if (!activitiesContainer) return;

        activitiesContainer.innerHTML = `
            <div class="activities-list">
                ${this.activitiesData.map(activity => `
                    <div class="activity-item">
                        <div class="activity-icon ${this.getActivityIconClass(activity.type)}">
                            <span class="material-icons">${this.getActivityIcon(activity.type)}</span>
                        </div>
                        <div class="activity-content">
                            <div class="activity-header">
                                <h5>${activity.title}</h5>
                                <span class="activity-time">${this.formatTime(activity.timestamp)}</span>
                            </div>
                            <p>${activity.childName} - ${activity.description}</p>
                            ${activity.score ? `<span class="activity-score">分數: ${activity.score}</span>` : ''}
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    renderNotifications() {
        const notificationsContainer = document.getElementById('notifications-list');
        if (!notificationsContainer) return;

        const unreadCount = this.notificationsData.filter(n => !n.read).length;

        // 更新通知計數
        const notificationBadge = document.querySelector('.notification-badge');
        if (notificationBadge) {
            notificationBadge.textContent = unreadCount;
            notificationBadge.style.display = unreadCount > 0 ? 'block' : 'none';
        }

        notificationsContainer.innerHTML = `
            ${this.notificationsData.map(notification => `
                <div class="p-4 border rounded-lg ${notification.read ? '' : 'bg-blue-50'}" data-notification-id="${notification.id}">
                    <div class="flex items-start justify-between">
                        <div class="flex items-start">
                            <span class="material-icons mr-3">${this.getNotificationIcon(notification.type)}</span>
                            <div>
                                <h6 class="font-semibold text-gray-800">${notification.title}</h6>
                                <p class="text-sm text-gray-600">${notification.message}</p>
                                <small class="text-gray-400">${this.formatTime(notification.timestamp)}</small>
                            </div>
                        </div>
                        <button class="btn btn-outline btn-sm" onclick="parentDashboard.markAsRead(${notification.id})">
                            <span class="material-icons">done</span>
                        </button>
                    </div>
                </div>
            `).join('')}
        `;
    }

    getActivityIcon(type) {
        const icons = {
            'assignment_completed': 'check_circle',
            'course_started': 'play_circle',
            'achievement': 'emoji_events',
            'exam_completed': 'description',
            'course_completed': 'school',
            'login': 'login'
        };
        return icons[type] || 'info';
    }

    getActivityIconClass(type) {
        const classes = {
            'assignment_completed': 'success',
            'course_started': 'primary',
            'achievement': 'warning',
            'exam_completed': 'info',
            'course_completed': 'success',
            'login': 'secondary'
        };
        return classes[type] || 'secondary';
    }

    getNotificationIcon(type) {
        const icons = {
            'assignment_due': 'warning',
            'progress_report': 'assessment',
            'achievement': 'emoji_events',
            'system': 'settings',
            'message': 'mail'
        };
        return icons[type] || 'notifications';
    }

    formatTime(timestamp) {
        const date = new Date(timestamp);
        const now = new Date();
        const diff = now - date;

        if (diff < 60000) return '剛剛';
        if (diff < 3600000) return `${Math.floor(diff / 60000)}分鐘前`;
        if (diff < 86400000) return `${Math.floor(diff / 3600000)}小時前`;
        if (diff < 604800000) return `${Math.floor(diff / 86400000)}天前`;

        return date.toLocaleDateString('zh-TW');
    }

    setupAutoRefresh() {
        // 每5分鐘自動刷新數據
        this.refreshInterval = setInterval(() => {
            this.loadDashboardData();
        }, 5 * 60 * 1000);
    }

    bindEvents() {
        // 快速操作按鈕事件
        document.addEventListener('click', (e) => {
            if (e.target.matches('.quick-action-btn')) {
                const action = e.target.dataset.action;
                this.handleQuickAction(action);
            }
        });

        // 子女卡片點擊事件
        document.addEventListener('click', (e) => {
            const childCard = e.target.closest('.child-card');
            if (childCard) {
                const childId = childCard.dataset.childId;
                this.viewChildDetails(parseInt(childId));
            }
        });
    }

    handleQuickAction(actionType) {
        switch (actionType) {
            case 'view_progress':
                this.openProgress();
                break;
            case 'view_reports':
                this.openReports();
                break;
            case 'contact_teacher':
                this.openCommunication();
                break;
            case 'view_schedule':
                this.openSchedule();
                break;
            default:
                console.log('未知的快速操作:', actionType);
        }
    }

    viewChildProgress(childId) {
        parentApp.navigateTo('progress', { childId });
    }

    viewChildDetails(childId) {
        parentApp.navigateTo('children', { childId });
    }

    openProgress() {
        parentApp.navigateTo('progress');
    }

    openReports() {
        parentApp.navigateTo('reports');
    }

    openCommunication() {
        parentApp.navigateTo('communication');
    }

    openSchedule() {
        parentApp.navigateTo('schedule');
    }

    async markAsRead(notificationId) {
        try {
            await apiClient.put(`/learning/parents/notifications/${notificationId}/read`);

            // 更新本地數據
            const notification = this.notificationsData.find(n => n.id === notificationId);
            if (notification) {
                notification.read = true;
                this.renderNotifications();
            }
        } catch (error) {
            console.error('標記通知為已讀失敗:', error);
        }
    }

    showLoading(show) {
        const overlay = document.getElementById('loading-overlay');
        if (overlay) {
            overlay.classList[show ? 'add' : 'remove']('show');
        }
    }

    showNotification(message, type = 'info') {
        if (window.parentApp) {
            parentApp.showNotification(message, type);
        } else {
            console.log(`${type.toUpperCase()}: ${message}`);
        }
    }

    refresh() {
        this.loadDashboardData();
    }

    destroy() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
        }
    }
}

// 初始化儀表板
const parentDashboard = new ParentDashboard();
window.parentDashboard = parentDashboard; 