/**
 * 家長應用程式 - 子女管理模組
 * 負責子女列表管理、詳細資訊顯示、學習進度監控
 */

class ChildrenManager {
    constructor() {
        this.children = [];
        this.currentChild = null;
        this.init();
    }

    async init() {
        await this.loadChildren();
        this.bindEvents();
        this.renderChildrenList();
    }

    async loadChildren() {
        try {
            const response = await apiClient.get('/learning/parents/children');
            this.children = response.data || response;
            console.log('子女資料載入成功:', this.children);
        } catch (error) {
            console.error('載入子女資料錯誤:', error);
            this.showError('載入子女資料失敗，請稍後再試');
        }
    }

    bindEvents() {
        // 子女列表點擊事件
        document.addEventListener('click', (e) => {
            if (e.target.closest('.child-card')) {
                const childId = e.target.closest('.child-card').dataset.childId;
                this.selectChild(childId);
            }

            if (e.target.closest('.view-details-btn')) {
                const childId = e.target.closest('.view-details-btn').dataset.childId;
                this.showChildDetails(childId);
            }

            if (e.target.closest('.view-progress-btn')) {
                const childId = e.target.closest('.view-progress-btn').dataset.childId;
                this.showChildProgress(childId);
            }
        });

        // 搜尋功能
        const searchInput = document.getElementById('children-search');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.filterChildren(e.target.value);
            });
        }
    }

    renderChildrenList() {
        const container = document.getElementById('childrenGrid');
        if (!container) return;

        if (this.children.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-child fa-3x text-muted mb-3"></i>
                    <h5>尚未添加子女</h5>
                    <p class="text-muted">請聯繫管理員添加子女資訊</p>
                </div>
            `;
            return;
        }

        const childrenHTML = this.children.map(child => `
            <div class="bg-white p-6 rounded-lg shadow-md hover:shadow-lg transition-shadow child-card" data-child-id="${child.id}">
                <div class="flex items-center mb-4">
                    <img src="${child.avatar || '/assets/images/default-avatar.png'}" alt="${child.name}" class="w-12 h-12 rounded-full mr-3">
                    <div>
                        <h3 class="text-lg font-semibold text-gray-800">${child.name}</h3>
                        <p class="text-sm text-gray-500">${child.grade}年級</p>
                    </div>
                </div>
                <div class="grid grid-cols-3 text-center mb-4">
                    <div>
                        <p class="text-xl font-bold text-gray-800">${child.total_exercises || 0}</p>
                        <p class="text-xs text-gray-500">練習題數</p>
                    </div>
                    <div>
                        <p class="text-xl font-bold text-gray-800">${child.accuracy_rate || 0}%</p>
                        <p class="text-xs text-gray-500">正確率</p>
                    </div>
                    <div>
                        <p class="text-xl font-bold text-gray-800">${child.study_days || 0}</p>
                        <p class="text-xs text-gray-500">學習天數</p>
                    </div>
                </div>
                <div class="w-full bg-gray-200 rounded-full h-2 mb-2">
                    <div class="bg-blue-600 h-2 rounded-full" style="width: ${child.overall_progress || 0}%"></div>
                </div>
                <p class="text-xs text-gray-500">整體進度: ${child.overall_progress || 0}%</p>
                <div class="mt-4 grid grid-cols-2 gap-2">
                    <button class="btn btn-outline view-details-btn" data-child-id="${child.id}">
                        <span class="material-icons mr-1">info</span> 詳細資訊
                    </button>
                    <button class="btn view-progress-btn" data-child-id="${child.id}">
                        <span class="material-icons mr-1">trending_up</span> 學習進度
                    </button>
                </div>
            </div>
        `).join('');

        container.innerHTML = childrenHTML;
    }

    async selectChild(childId) {
        this.currentChild = this.children.find(child => child.id === parseInt(childId));
        if (this.currentChild) {
            // 更新當前選中的子女
            document.querySelectorAll('.child-card').forEach(card => {
                card.classList.remove('selected');
            });
            document.querySelector(`[data-child-id="${childId}"]`).classList.add('selected');

            // 更新儀表板顯示
            this.updateDashboard();
        }
    }

    async showChildDetails(childId) {
        try {
            const response = await apiClient.get(`/learning/parents/children/${childId}`);
            const childDetails = response.data || response;
            this.renderChildDetails(childDetails);
        } catch (error) {
            console.error('載入子女詳細資訊錯誤:', error);
            this.showError('載入子女詳細資訊失敗');
        }
    }

    renderChildDetails(child) {
        const details = document.getElementById('childDetails');
        if (!details) return;

        const setText = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val ?? ''; };
        const setSrc = (id, val) => { const el = document.getElementById(id); if (el) el.src = val || '/assets/images/default-avatar.png'; };
        const toggle = (el, show) => { if (el) el.style.display = show ? '' : 'none'; };

        setText('childName', `${child.name} 的詳細資訊`);
        setText('childNameTitle', child.name);
        setText('childGrade', child.grade ? `${child.grade}` : '');
        setText('childClass', child.class_name || '');
        setText('childFullName', child.name || '');
        setText('childGradeInfo', child.grade ? `${child.grade}` : '');
        setText('childClassInfo', child.class_name || '');
        setText('childStudentId', child.student_id || '');
        setText('activeCourses', child.active_courses ?? 0);
        setText('completedAssignments', child.completed_assignments ?? 0);
        setText('averageScore', child.average_score != null ? `${child.average_score}` : '');
        setText('studyTime', child.total_study_hours != null ? `${child.total_study_hours} 小時` : '');

        setSrc('childAvatar', child.avatar);
        const statusEl = document.getElementById('childStatus');
        if (statusEl) {
            statusEl.className = 'status-indicator ' + (child.status || '');
        }

        toggle(details, true);

        const backBtn = document.getElementById('backToOverview');
        if (backBtn && !backBtn._bound) {
            backBtn.addEventListener('click', () => {
                toggle(details, false);
            });
            backBtn._bound = true;
        }
    }

    renderRecentActivities(activities) {
        if (activities.length === 0) {
            return '<p class="text-muted">尚無學習活動記錄</p>';
        }

        return activities.map(activity => `
            <div class="timeline-item">
                <div class="timeline-marker"></div>
                <div class="timeline-content">
                    <h6 class="mb-1">${activity.title}</h6>
                    <p class="mb-1">${activity.description}</p>
                    <small class="text-muted">${new Date(activity.created_at).toLocaleString()}</small>
                </div>
            </div>
        `).join('');
    }

    async showChildProgress(childId) {
        try {
            const response = await apiClient.get(`/learning/parents/children/${childId}/progress`);
            const progressData = response.data || response;
            this.renderChildProgress(progressData);
        } catch (error) {
            console.error('載入學習進度錯誤:', error);
            this.showError('載入學習進度失敗');
        }
    }

    renderChildProgress(progressData) {
        const modal = document.getElementById('childProgressModal');
        if (!modal) return;

        modal.querySelector('.modal-title').textContent = `${progressData.child_name} 的學習進度`;
        modal.querySelector('.modal-body').innerHTML = `
            <div class="row mb-4">
                <div class="col-md-3">
                    <div class="progress-card text-center">
                        <h4 class="text-primary">${progressData.overall_progress || 0}%</h4>
                        <small class="text-muted">整體進度</small>
                    </div>
                </div>
                <div class="col-md-3">
                    <div class="progress-card text-center">
                        <h4 class="text-success">${progressData.accuracy_rate || 0}%</h4>
                        <small class="text-muted">正確率</small>
                    </div>
                </div>
                <div class="col-md-3">
                    <div class="progress-card text-center">
                        <h4 class="text-info">${progressData.study_days || 0}</h4>
                        <small class="text-muted">學習天數</small>
                    </div>
                </div>
                <div class="col-md-3">
                    <div class="progress-card text-center">
                        <h4 class="text-warning">${progressData.streak_days || 0}</h4>
                        <small class="text-muted">連續學習</small>
                    </div>
                </div>
            </div>

            <div class="row">
                <div class="col-md-6">
                    <h6>科目進度</h6>
                    ${this.renderSubjectProgress(progressData.subjects || [])}
                </div>
                <div class="col-md-6">
                    <h6>學習趨勢</h6>
                    <canvas id="progressChart" width="400" height="200"></canvas>
                </div>
            </div>

            <div class="mt-4">
                <h6>學習弱點分析</h6>
                ${this.renderWeaknessAnalysis(progressData.weaknesses || [])}
            </div>
        `;

        // 顯示模態框
        const bootstrapModal = new bootstrap.Modal(modal);
        bootstrapModal.show();

        // 渲染圖表
        this.renderProgressChart(progressData.trend_data || []);
    }

    renderSubjectProgress(subjects) {
        if (subjects.length === 0) {
            return '<p class="text-muted">尚無科目進度資料</p>';
        }

        return subjects.map(subject => `
            <div class="subject-progress mb-3">
                <div class="d-flex justify-content-between mb-1">
                    <span>${subject.name}</span>
                    <span>${subject.progress}%</span>
                </div>
                <div class="progress" style="height: 8px;">
                    <div class="progress-bar" style="width: ${subject.progress}%"></div>
                </div>
            </div>
        `).join('');
    }

    renderWeaknessAnalysis(weaknesses) {
        if (weaknesses.length === 0) {
            return '<p class="text-muted">尚無弱點分析資料</p>';
        }

        return weaknesses.map(weakness => `
            <div class="weakness-item mb-3 p-3 border rounded">
                <h6 class="text-danger">${weakness.topic}</h6>
                <p class="mb-2">${weakness.description}</p>
                <div class="d-flex justify-content-between">
                    <small class="text-muted">錯誤率: ${weakness.error_rate}%</small>
                    <small class="text-muted">建議練習題數: ${weakness.recommended_exercises}</small>
                </div>
            </div>
        `).join('');
    }

    renderProgressChart(trendData) {
        // 頁面無圖表容器，暫不渲染
        return;
    }

    filterChildren(searchTerm) {
        const filteredChildren = this.children.filter(child =>
            child.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            child.grade.toString().includes(searchTerm)
        );

        this.renderFilteredChildren(filteredChildren);
    }

    renderFilteredChildren(filteredChildren) {
        const container = document.getElementById('childrenGrid');
        if (!container) return;

        if (filteredChildren.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-search fa-3x text-muted mb-3"></i>
                    <h5>未找到符合的子女</h5>
                    <p class="text-muted">請嘗試其他搜尋條件</p>
                </div>
            `;
            return;
        }

        // 使用相同的渲染邏輯
        const childrenHTML = filteredChildren.map(child => `
            <div class="bg-white p-6 rounded-lg shadow-md hover:shadow-lg transition-shadow child-card" data-child-id="${child.id}">
                <div class="flex items-center mb-4">
                    <img src="${child.avatar || '/assets/images/default-avatar.png'}" alt="${child.name}" class="w-12 h-12 rounded-full mr-3">
                    <div>
                        <h3 class="text-lg font-semibold text-gray-800">${child.name}</h3>
                        <p class="text-sm text-gray-500">${child.grade}年級</p>
                    </div>
                </div>
                <div class="grid grid-cols-3 text-center mb-4">
                    <div>
                        <p class="text-xl font-bold text-gray-800">${child.total_exercises || 0}</p>
                        <p class="text-xs text-gray-500">練習題數</p>
                    </div>
                    <div>
                        <p class="text-xl font-bold text-gray-800">${child.accuracy_rate || 0}%</p>
                        <p class="text-xs text-gray-500">正確率</p>
                    </div>
                    <div>
                        <p class="text-xl font-bold text-gray-800">${child.study_days || 0}</p>
                        <p class="text-xs text-gray-500">學習天數</p>
                    </div>
                </div>
                <div class="w-full bg-gray-200 rounded-full h-2 mb-2">
                    <div class="bg-blue-600 h-2 rounded-full" style="width: ${child.overall_progress || 0}%"></div>
                </div>
                <p class="text-xs text-gray-500">整體進度: ${child.overall_progress || 0}%</p>
                <div class="mt-4 grid grid-cols-2 gap-2">
                    <button class="btn btn-outline view-details-btn" data-child-id="${child.id}">
                        <span class="material-icons mr-1">info</span> 詳細資訊
                    </button>
                    <button class="btn view-progress-btn" data-child-id="${child.id}">
                        <span class="material-icons mr-1">trending_up</span> 學習進度
                    </button>
                </div>
            </div>
        `).join('');

        container.innerHTML = childrenHTML;
    }

    updateDashboard() {
        if (!this.currentChild) return;

        // 更新儀表板顯示當前選中的子女資訊
        const dashboard = document.getElementById('current-child-info');
        if (dashboard) {
            dashboard.innerHTML = `
                <div class="current-child-card">
                    <div class="d-flex align-items-center">
                        <img src="${this.currentChild.avatar || '/assets/images/default-avatar.png'}" 
                             alt="${this.currentChild.name}" class="rounded-circle me-3" style="width: 50px; height: 50px;">
                        <div>
                            <h6 class="mb-1">${this.currentChild.name}</h6>
                            <small class="text-muted">${this.currentChild.grade}年級</small>
                        </div>
                    </div>
                </div>
            `;
        }
    }

    showError(message) {
        // 顯示錯誤訊息
        const toast = document.createElement('div');
        toast.className = 'toast align-items-center text-white bg-danger border-0';
        toast.setAttribute('role', 'alert');
        toast.innerHTML = `
            <div class="d-flex">
                <div class="toast-body">
                    <i class="fas fa-exclamation-circle me-2"></i>
                    ${message}
                </div>
                <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
            </div>
        `;

        const toastContainer = document.getElementById('toast-container');
        if (toastContainer) {
            toastContainer.appendChild(toast);
            const bsToast = new bootstrap.Toast(toast);
            bsToast.show();
        }
    }
}

// 初始化子女管理模組
document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('childrenGrid')) {
        window.childrenManager = new ChildrenManager();
    }
}); 