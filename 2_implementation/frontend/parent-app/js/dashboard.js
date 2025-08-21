/**
 * 家長儀表板模組
 * 負責渲染儀表板的各個UI組件
 */
class ParentDashboard {
    constructor() {
        this.statsData = {};
        this.childrenData = [];
        this.activitiesData = [];
        this.notificationsData = [];
    }

    // 接收外部數據並渲染所有組件
    render(dashboardData) {
        if (!dashboardData) return;

        this.statsData = dashboardData.stats || {};
        this.childrenData = dashboardData.children || [];
        this.activitiesData = dashboardData.activities || [];
        this.notificationsData = dashboardData.notifications || [];

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

        if (totalChildrenEl) totalChildrenEl.textContent = this.childrenData.length || 0;
        if (totalCoursesEl) totalCoursesEl.textContent = 'N/A'; // 此數據待後端提供

        const studyMinutes = this.statsData.total_study_minutes || 0;
        if (studyTimeEl) studyTimeEl.textContent = `${(studyMinutes / 60).toFixed(1)}h`;

        if (achievementsEl) achievementsEl.textContent = 'N/A'; // 此數據待後端提供
    }

    // ... 保留所有其他的 render* 和輔助函式 (renderChildrenOverview, renderRecentActivities, etc.)
    // ... 確保移除舊的 init, load* 函式和事件綁定

    renderChildrenOverview() {
        const childrenContainer = document.getElementById('children-grid');
        if (!childrenContainer) return;

        if (this.childrenData.length === 0) {
            childrenContainer.innerHTML = '<p class="text-gray-500 col-span-full">尚未新增任何子女。</p>';
            return;
        }

        childrenContainer.innerHTML = `
            ${this.childrenData.map(child => `
                <div class="bg-white p-6 rounded-lg shadow-md hover:shadow-lg transition-shadow child-card" data-child-id="${child.id}" onclick="location.href='pages/progress.html?child_id=${child.id}'">
                    <div class="flex items-center mb-4">
                        <img src="${(child.avatar && child.avatar.startsWith('http')) ? child.avatar : 'https://via.placeholder.com/50x50'}" alt="${child.name}" class="w-12 h-12 rounded-full mr-3">
                        <div>
                            <h3 class="text-lg font-semibold text-gray-800">${child.name}</h3>
                            <p class="text-sm text-gray-500">${child.grade ? `${child.grade}年級` : '年級未設定'}</p>
                        </div>
                    </div>
                    <div class="w-full bg-gray-200 rounded-full h-2 mb-2">
                        <div class="bg-blue-600 h-2 rounded-full" style="width: ${child.overall_progress || 0}%"></div>
                    </div>
                    <div class="flex items-center justify-between text-sm text-gray-600">
                        <span>進度</span>
                        <span>${child.overall_progress || 0}%</span>
                    </div>
                </div>
            `).join('')}
        `;
    }

    renderRecentActivities() {
        const activitiesContainer = document.getElementById('recent-activities');
        if (!activitiesContainer) return;

        if (this.activitiesData.length === 0) {
            activitiesContainer.innerHTML = '<p class="text-gray-500">最近沒有任何活動。</p>';
            return;
        }

        activitiesContainer.innerHTML = `
            <div class="space-y-4">
                ${this.activitiesData.map(activity => {
            const timeSpent = activity.time_spent ? `${Math.floor(activity.time_spent / 60)}分${activity.time_spent % 60}秒` : '';
            return `
                        <div class="flex items-center p-3 rounded-lg hover:bg-gray-50">
                            <div class="flex-shrink-0 mr-3">
                                <div class="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                                    <span class="material-icons text-blue-600">${this.getActivityIcon(activity.subject || 'default')}</span>
                                </div>
                            </div>
                            <div class="flex-1 min-w-0">
                                <p class="text-sm font-semibold text-gray-800 truncate">${activity.session_name || '練習'}</p>
                                <p class="text-xs text-gray-500">${this.formatTime(activity.start_time)}</p>
                            </div>
                            <div class="text-sm text-gray-600 text-right">
                                <p>${timeSpent}</p>
                            </div>
                        </div>
                    `;
        }).join('')}
            </div>
        `;
    }

    renderNotifications() {
        const notificationsContainer = document.getElementById('notifications-list');
        if (!notificationsContainer) return;

        if (this.notificationsData.length === 0) {
            notificationsContainer.innerHTML = '<p class="text-gray-500">目前沒有任何通知。</p>';
            return;
        }

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

    getActivityIcon(subject) {
        const icons = {
            '國文': 'book',
            '數學': 'calculate',
            '英文': 'translate',
            '自然': 'science',
            'default': 'history'
        };
        return icons[subject] || icons['default'];
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
        if (!timestamp) return '';
        const date = new Date(timestamp);
        const now = new Date();
        const diff = now - date;

        if (diff < 60000) return '剛剛';
        if (diff < 3600000) return `${Math.floor(diff / 60000)}分鐘前`;
        if (diff < 86400000) return `${Math.floor(diff / 3600000)}小時前`;
        if (diff < 604800000) return `${Math.floor(diff / 86400000)}天前`;

        return date.toLocaleDateString('zh-TW');
    }
}

// 導出一個單例，以便在 main.js 中使用
const parentDashboard = new ParentDashboard(); 