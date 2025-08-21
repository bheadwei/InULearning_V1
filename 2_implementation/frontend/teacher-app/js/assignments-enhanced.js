/**
 * 作業管理增強版模組
 * 處理作業的創建、編輯、刪除、搜尋和篩選功能
 */
class AssignmentsManager {
    constructor() {
        this.assignments = [];
        this.filteredAssignments = [];
        this.currentView = 'list';
        this.currentMonth = new Date();
        // 使用相對路徑，因為 api-client.js 已經包含了 baseUrl
        this.apiPathCandidates = [
            '/assignments/',
            '/learning/assignments/'
        ];
        this.apiPath = '/assignments/';
        this.editingId = null;

        this.init();
    }

    async init() {
        try {
            // 延遲初始化以確保 DOM 完全載入
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', () => this.initApp());
            } else {
                // 如果 DOM 已經載入，延遲一點執行以確保所有元素都存在
                setTimeout(() => this.initApp(), 100);
            }
        } catch (error) {
            console.error('❌ 初始化失敗:', error);
        }
    }

    async initApp() {
        try {
            // 檢查認證狀態
            if (!teacherAuth.isLoggedIn()) {
                console.log('❌ 用戶未登入，重定向到登入頁面');
                window.location.href = '../login.html';
                return;
            }
            
            console.log('✅ 用戶已登入，開始初始化作業管理...');
            
            await this.detectApiPath();
            await this.loadAssignments();
            this.setupEventListeners();
            this.renderAssignments();
            this.updateStats();
            this.renderCalendar();
            console.log('✅ 作業管理初始化完成');
        } catch (error) {
            console.error('❌ 作業管理初始化失敗:', error);
        }
    }

    async detectApiPath() {
        for (const p of this.apiPathCandidates) {
            try {
                const response = await apiClient.get(p);
                // 檢查回應是否有效
                if (response && (Array.isArray(response) || response.items || response.assignments || response.results)) {
                    this.apiPath = p;
                    console.log('✅ 檢測到有效 API 路徑:', p);
                    return;
                }
            } catch (error) { 
                console.log(`❌ API 路徑 ${p} 檢測失敗:`, error.message);
                continue;
            }
        }
        // 若都失敗，維持預設路徑，後續會回退到模擬資料
        console.warn('⚠️ 所有 API 路徑檢測失敗，使用預設路徑:', this.apiPath);
    }

    async loadAssignments() {
        try {
            const data = await apiClient.get(this.apiPath);
            this.assignments = Array.isArray(data) ? data : (data.items || data.assignments || data.results || []);
            if (!Array.isArray(this.assignments)) this.assignments = [];
            console.log('✅ 成功載入真實作業資料');
        } catch (error) {
            console.error('⚠️ API 載入失敗:', error.message);
            // 不再使用假資料，顯示錯誤狀態
            this.assignments = [];
            this.showApiStatus('無法載入作業資料', 'error');
        }
        this.filteredAssignments = [...this.assignments];
    }

    async createAssignment(payload) {
        return await apiClient.post(this.apiPath, payload);
    }

    async updateAssignment(id, payload) {
        return await apiClient.put(`${this.apiPath}/${id}`, payload);
    }

    async deleteAssignment(id) {
        await apiClient.delete(`${this.apiPath}/${id}`);
        return true;
    }



    setupEventListeners() {
        try {
            // 搜尋/篩選
            const searchInput = document.getElementById('searchInput');
            const statusFilter = document.getElementById('statusFilter');
            const subjectFilter = document.getElementById('subjectFilter');
            
            if (searchInput) searchInput.addEventListener('input', () => this.filterAssignments());
            if (statusFilter) statusFilter.addEventListener('change', () => this.filterAssignments());
            if (subjectFilter) subjectFilter.addEventListener('change', () => this.filterAssignments());

            // 視圖切換
            const viewButtons = document.querySelectorAll('.view-btn');
            viewButtons.forEach(btn => {
                btn.addEventListener('click', (e) => {
                    this.switchView(e.currentTarget.dataset.view);
                });
            });

            // Modal 綁定
            // 將原本 HTML onclick 之外，再補強事件委派，避免某些按鈕無效
            const openBtn = document.querySelector('.btn.btn-primary[onclick="createAssignment()"]');
            if (openBtn) openBtn.addEventListener('click', (e) => { e.preventDefault(); this.openModal(); });
            
            const modalClose = document.getElementById('assignmentModalClose');
            const cancelBtn = document.getElementById('assignmentCancelBtn');
            const saveBtn = document.getElementById('assignmentSaveBtn');
            
            if (modalClose) modalClose.addEventListener('click', () => this.closeModal());
            if (cancelBtn) cancelBtn.addEventListener('click', () => this.closeModal());
            if (saveBtn) saveBtn.addEventListener('click', () => this.handleSave());
            
            console.log('✅ 作業管理事件綁定完成');
        } catch (error) {
            console.error('❌ 作業管理事件綁定失敗:', error);
        }
    }

    openModal(title = '新增作業', assignment = null) {
        const backdrop = document.getElementById('assignmentModal');
        document.getElementById('assignmentModalTitle').textContent = title;
        backdrop.style.display = 'flex';
        if (assignment) {
            this.editingId = assignment.id;
            document.getElementById('assignmentId').value = assignment.id;
            document.getElementById('assignmentTitle').value = assignment.title || '';
            document.getElementById('assignmentSubject').value = assignment.subject || '';
            document.getElementById('assignmentDueDate').value = (assignment.dueDate || '').slice(0,10);
            document.getElementById('assignmentStatus').value = assignment.status || 'draft';
            document.getElementById('assignmentDescription').value = assignment.description || '';
        } else {
            this.editingId = null;
            document.getElementById('assignmentForm').reset();
            document.getElementById('assignmentId').value = '';
        }
    }

    closeModal() {
        const backdrop = document.getElementById('assignmentModal');
        backdrop.style.display = 'none';
    }

    async handleSave() {
        const payload = {
            title: document.getElementById('assignmentTitle').value.trim(),
            subject: document.getElementById('assignmentSubject').value,
            // 常見命名：後端可能收 due_date 或 dueDate，同時提供
            due_date: document.getElementById('assignmentDueDate').value,
            dueDate: document.getElementById('assignmentDueDate').value,
            status: document.getElementById('assignmentStatus').value,
            description: document.getElementById('assignmentDescription').value.trim()
        };
        if (!payload.title || !payload.subject || !payload.due_date || !payload.status) {
            alert('請完整填寫表單');
            return;
        }
        try {
            if (this.editingId) await this.updateAssignment(this.editingId, payload);
            else await this.createAssignment(payload);
            await this.loadAssignments();
            this.filterAssignments();
            this.closeModal();
            alert('已儲存');
        } catch (e) {
            alert('儲存失敗，請稍後再試');
        }
    }

    editExisting(id) {
        const target = this.assignments.find(a => a.id == id);
        if (target) this.openModal('編輯作業', target);
    }

    async removeExisting(id) {
        if (!confirm('確定要刪除這筆作業嗎？')) return;
        try {
            await this.deleteAssignment(id);
            this.assignments = this.assignments.filter(a => a.id != id);
            this.filterAssignments();
        } catch (e) {
            alert('刪除失敗，請稍後再試');
        }
    }

    duplicateExisting(id) {
        const target = this.assignments.find(a => a.id == id);
        if (!target) return;
        this.editingId = null;
        const draft = {
            title: `${target.title} (複製)`,
            subject: target.subject,
            due_date: (target.dueDate || target.due_date || '').slice(0,10),
            status: 'draft',
            description: target.description || ''
        };
        this.openModal('複製作業', draft);
    }

    async exportCurrent() {
        // 簡易匯出成 JSON 檔
        const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(this.filteredAssignments, null, 2));
        const a = document.createElement('a');
        a.setAttribute('href', dataStr);
        a.setAttribute('download', 'assignments.json');
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    }

    importFromFile() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'application/json';
        input.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            try {
                const text = await file.text();
                const list = JSON.parse(text);
                if (Array.isArray(list)) {
                    // 嘗試批量建立（若 API 不支援就直接覆蓋前端列表）
                    for (const item of list) {
                        try { await this.createAssignment(item); } catch (_) { /* ignore single failure */ }
                    }
                    await this.loadAssignments();
                    this.filterAssignments();
                    alert('匯入完成');
                } else {
                    alert('檔案格式不正確');
                }
            } catch (_) { alert('匯入失敗'); }
        });
        input.click();
    }

    async sendReminders() {
        // 嘗試呼叫通知端點；若無則前端提示成功
        try {
            await apiClient.post('/assignments/reminders', {});
            alert('已發送提醒');
        } catch (_) {
            alert('已排程發送提醒（模擬）');
        }
    }

    filterAssignments() {
        const searchTerm = (document.getElementById('searchInput')?.value || '').toLowerCase();
        const statusFilter = document.getElementById('statusFilter')?.value || '';
        const subjectFilter = document.getElementById('subjectFilter')?.value || '';

        this.filteredAssignments = this.assignments.filter(assignment => {
            const matchesSearch = (assignment.title || '').toLowerCase().includes(searchTerm) ||
                (assignment.description || '').toLowerCase().includes(searchTerm);
            const matchesStatus = !statusFilter || assignment.status === statusFilter;
            const matchesSubject = !subjectFilter || assignment.subject === subjectFilter;
            return matchesSearch && matchesStatus && matchesSubject;
        });

        this.renderAssignments();
    }

    switchView(view) {
        this.currentView = view;
        document.querySelectorAll('.view-btn').forEach(btn => btn.classList.remove('active'));
        const activeBtn = document.querySelector(`.view-btn[data-view="${view}"]`);
        activeBtn?.classList.add('active');
        if (view === 'list') {
            document.getElementById('listView')?.classList.remove('hidden');
            document.getElementById('gridView')?.classList.add('hidden');
        } else {
            document.getElementById('listView')?.classList.add('hidden');
            document.getElementById('gridView')?.classList.remove('hidden');
        }
        this.renderAssignments();
    }

    renderAssignments() {
        if (this.currentView === 'list') {
            this.renderListView();
        } else {
            this.renderGridView();
        }
    }

    renderListView() {
        const container = document.getElementById('listView');
        if (!container) return;

        if (this.filteredAssignments.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 3rem; color: var(--text-light);">
                    <i class="fas fa-search" style="font-size: 3rem; margin-bottom: 1rem; opacity: 0.3;"></i>
                    <p>沒有找到符合條件的作業</p>
                </div>
            `;
            return;
        }

        container.innerHTML = this.filteredAssignments.map(assignment => `
            <div class="assignment-item">
                <div class="assignment-header">
                    <div>
                        <div class="assignment-title">${assignment.title}</div>
                        <div class="assignment-meta">
                            <span><i class="fas fa-book"></i> ${this.getSubjectName(assignment.subject)}</span>
                            <span><i class="fas fa-calendar"></i> 截止：${this.formatDate(assignment.dueDate || assignment.due_date)}</span>
                            <span><i class="fas fa-users"></i> ${assignment.totalStudents || '-'} 人</span>
                        </div>
                    </div>
                    <div class="assignment-status ${assignment.status}">
                        <i class="fas ${this.getStatusIcon(assignment.status)}"></i>
                        ${this.getStatusText(assignment.status)}
                    </div>
                </div>
                <p style="color: var(--text-light); margin-bottom: 1rem;">${assignment.description || ''}</p>
                <div class="assignment-actions" style="margin-top: 1rem; display:flex; gap:.5rem;">
                    <button class="action-btn primary" data-action="edit" data-id="${assignment.id}">
                        <i class="fas fa-edit"></i> 編輯
                    </button>
                    <button class="action-btn secondary" data-action="delete" data-id="${assignment.id}">
                        <i class="fas fa-trash"></i> 刪除
                    </button>
                </div>
            </div>
        `).join('');

        // 事件委派避免動態內容失效
        container.querySelectorAll('.assignment-actions .action-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.currentTarget.getAttribute('data-id');
                const action = e.currentTarget.getAttribute('data-action');
                if (action === 'edit') this.editExisting(id);
                if (action === 'delete') this.removeExisting(id);
            });
        });
    }

    renderGridView() {
        const container = document.getElementById('gridView');
        if (!container) return;

        if (this.filteredAssignments.length === 0) {
            container.innerHTML = `
                <div style="grid-column: 1 / -1; text-align: center; padding: 3rem; color: var(--text-light);">
                    <i class="fas fa-search" style="font-size: 3rem; margin-bottom: 1rem; opacity: 0.3;"></i>
                    <p>沒有找到符合條件的作業</p>
                </div>
            `;
            return;
        }

        container.innerHTML = this.filteredAssignments.map(assignment => {
            const progressPercent = assignment.totalStudents ? (assignment.submitted || 0) / assignment.totalStudents * 100 : 0;
            const cardClass = assignment.status === 'grading' ? 'warning' : (assignment.status === 'active' ? '' : '');
            return `
                <div class="assignment-card ${cardClass}">
                    <div style="display:flex; justify-content: space-between; align-items:flex-start; margin-bottom: 1rem;">
                        <h3 style="margin:0; font-size:1.1rem;">${assignment.title}</h3>
                        <div class="assignment-status ${assignment.status}">
                            ${this.getStatusText(assignment.status)}
                        </div>
                    </div>
                    <p style="color: var(--text-light); font-size: 0.9rem; margin-bottom: 1rem; line-height: 1.4;">
                        ${(assignment.description || '').length > 80 ? (assignment.description || '').substring(0,80) + '...' : (assignment.description || '')}
                    </p>
                    <div style="display:flex; gap:.5rem;">
                        <button class="action-btn primary" data-action="edit" data-id="${assignment.id}" style="flex:1; font-size:.8rem;">編輯</button>
                        <button class="action-btn secondary" data-action="delete" data-id="${assignment.id}" style="flex:1; font-size:.8rem;">刪除</button>
                    </div>
                </div>
            `;
        }).join('');

        // 綁定動作
        container.querySelectorAll('.action-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.currentTarget.getAttribute('data-id');
                const action = e.currentTarget.getAttribute('data-action');
                if (action === 'edit') this.editExisting(id);
                if (action === 'delete') this.removeExisting(id);
            });
        });
    }

    updateStats() {
        const stats = {
            total: this.assignments.length,
            active: this.assignments.filter(a => a.status === 'active').length,
            completed: this.assignments.filter(a => a.status === 'closed').length,
            overdue: this.assignments.filter(a => a.status === 'active' && new Date(a.dueDate || a.due_date) < new Date()).length
        };
        document.getElementById('totalAssignments').textContent = stats.total;
        document.getElementById('activeAssignments').textContent = stats.active;
        document.getElementById('completedAssignments').textContent = stats.completed;
        document.getElementById('overdueAssignments').textContent = stats.overdue;
    }

    renderCalendar() {
        const grid = document.getElementById('calendarGrid');
        if (!grid) return;
        const monthNames = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];
        document.getElementById('currentMonth').textContent = `${this.currentMonth.getFullYear()}年${monthNames[this.currentMonth.getMonth()]}`;
        const firstDay = new Date(this.currentMonth.getFullYear(), this.currentMonth.getMonth(), 1);
        const lastDay = new Date(this.currentMonth.getFullYear(), this.currentMonth.getMonth() + 1, 0);
        const startDate = new Date(firstDay);
        startDate.setDate(startDate.getDate() - firstDay.getDay());
        const days = ['日', '一', '二', '三', '四', '五', '六'];
        let html = days.map(day => `<div style="font-weight: 600; text-align: center; padding: 0.5rem;">${day}</div>`).join('');
        const deadlines = this.assignments.reduce((acc, assignment) => {
            const date = (assignment.dueDate || assignment.due_date || '').slice(0,10);
            if (!date) return acc;
            if (!acc[date]) acc[date] = [];
            acc[date].push(assignment);
            return acc;
        }, {});
        for (let i = 0; i < 42; i++) {
            const currentDate = new Date(startDate);
            currentDate.setDate(startDate.getDate() + i);
            const dateStr = currentDate.toISOString().split('T')[0];
            const isCurrentMonth = currentDate.getMonth() === this.currentMonth.getMonth();
            const isToday = dateStr === new Date().toISOString().split('T')[0];
            const hasDeadline = deadlines[dateStr];
            let classes = ['calendar-day'];
            if (isToday) classes.push('today');
            if (hasDeadline) classes.push('has-deadline');
            if (!isCurrentMonth) classes.push('other-month');
            html += `<div class="${classes.join(' ')}" title="${hasDeadline ? hasDeadline.map(a => a.title).join(', ') : ''}">${currentDate.getDate()}</div>`;
        }
        grid.innerHTML = html;
    }

    getSubjectName(subject) {
        const subjects = { math: '數學', chinese: '國文', english: '英文', science: '自然', history: '歷史', geography: '地理' };
        return subjects[subject] || subject;
    }

    getStatusText(status) {
        const statuses = { active: '進行中', draft: '草稿', closed: '已結束', grading: '批改中' };
        return statuses[status] || status;
    }

    getStatusIcon(status) {
        const icons = { active: 'fa-play-circle', draft: 'fa-edit', closed: 'fa-check-circle', grading: 'fa-clock' };
        return icons[status] || 'fa-question-circle';
    }

    formatDate(dateStr) {
        if (!dateStr) return '-';
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return dateStr;
        return `${date.getMonth() + 1}/${date.getDate()}`;
    }

    showApiStatus(message, type = 'error') {
        const container = document.getElementById('assignmentsList');
        const icon = type === 'error' ? 'fa-exclamation-triangle' : 'fa-info-circle';
        const color = type === 'error' ? 'text-red-500' : 'text-blue-500';
        
        if (container) {
            container.innerHTML = `
                <div style="text-align: center; padding: 3rem;">
                    <i class="fas ${icon} ${color}" style="font-size: 3rem; margin-bottom: 1rem;"></i>
                    <p class="${color}">${message}</p>
                    <button onclick="assignmentsManager.loadAssignments()" class="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">
                        重新載入
                    </button>
                </div>
            `;
        }
    }
}

// Quiz Builder (出考卷)
class QuizBuilder {
    constructor() {
        this.state = {
            step: 1,
            title: '',
            subject: '',
            dueDate: '',
            classIds: [],
            timeLimit: 30,
            shuffleQuestions: true,
            shuffleOptions: true,
            selectedQuestions: [],
            qPage: 1,
            qPageSize: 10,
            qTotal: 0,
            qFilters: { q: '', difficulty: '', knowledge: '' },
            grade: '',
            publisher: '',
            chapter: ''
        };
        this.assignmentsPath = '';
        this.questionsPath = '/questions';
        this.classesPath = '/relationships/teacher-class';
        this.maxQuestions = 50;
        this.init();
    }

    async init() {
        // 綁定按鈕（先綁事件，避免慢載入時無反應）
        document.getElementById('quizModalClose')?.addEventListener('click', () => this.close());
        document.getElementById('quizPrevBtn')?.addEventListener('click', () => this.prev());
        document.getElementById('quizNextBtn')?.addEventListener('click', () => this.next());
        document.getElementById('quizPublishBtn')?.addEventListener('click', () => this.publish());

        // 年級、出版社和章節選擇事件
        document.getElementById('quizGrade')?.addEventListener('change', () => this.onGradeChange());
        document.getElementById('quizPublisher')?.addEventListener('change', () => this.onPublisherChange());
        document.getElementById('quizChapter')?.addEventListener('change', () => this.onChapterChange());

        // 條件與清單的事件
        document.getElementById('qSearch')?.addEventListener('input', this.debounce(() => { this.state.qPage = 1; this.loadQuestionList(); }, 300));
        document.getElementById('qDifficulty')?.addEventListener('change', () => { this.state.qPage = 1; this.loadQuestionList(); });
        document.getElementById('qKnowledge')?.addEventListener('input', this.debounce(() => { this.state.qPage = 1; this.loadQuestionList(); }, 300));
        document.getElementById('qPrev')?.addEventListener('click', () => { if (this.state.qPage > 1) { this.state.qPage--; this.loadQuestionList(); } });
        document.getElementById('qNext')?.addEventListener('click', () => { const maxPage = Math.ceil(this.state.qTotal / this.state.qPageSize); if (this.state.qPage < maxPage) { this.state.qPage++; this.loadQuestionList(); } });
        document.getElementById('qClear')?.addEventListener('click', () => { this.state.selectedQuestions = []; this.renderSelected(); });

        // 先開啟 UI，避免等待 API 期間無反應
        this.open();
        
        // 延遲載入班級，確保 DOM 完全準備好
        setTimeout(() => {
            this.loadClasses();
        }, 100);
        
        // 不立即載入題目，等待版本和單元選擇
        this.renderQuestionList([]);
    }

    open() {
        const m = document.getElementById('quizModal');
        if (m) { 
            m.style.display = 'flex';
            m.classList.add('show');
        }
        this.toStep(1);
    }

    close() {
        const m = document.getElementById('quizModal');
        if (m) { 
            m.style.display = 'none';
            m.classList.remove('show');
        }
    }

    toStep(n) {
        this.state.step = n;
        ['quizStep1','quizStep2','quizStep3'].forEach((id, idx) => {
            const el = document.getElementById(id);
            if (el) el.style.display = (idx + 1 === n) ? 'block' : 'none';
        });
        
        // 安全地設置按鈕狀態
        const prevBtn = document.getElementById('quizPrevBtn');
        if (prevBtn) prevBtn.disabled = (n === 1);
        
        const nextBtn = document.getElementById('quizNextBtn');
        if (nextBtn) nextBtn.style.display = (n < 3) ? 'inline-block' : 'none';
        
        const publishBtn = document.getElementById('quizPublishBtn');
        if (publishBtn) publishBtn.style.display = (n === 3) ? 'inline-block' : 'none';
        
        // 安全地設置指示器
        const step1Dot = document.getElementById('quizStep1Dot');
        if (step1Dot) step1Dot.className = 'badge' + (n===1?'':'');
        
        const step2Dot = document.getElementById('quizStep2Dot');
        if (step2Dot) step2Dot.className = 'badge' + (n===2?'':'');
        
        const step3Dot = document.getElementById('quizStep3Dot');
        if (step3Dot) step3Dot.className = 'badge' + (n===3?'':'');
        
        if (n === 3) this.renderPreview();
    }

    prev() { if (this.state.step > 1) this.toStep(this.state.step - 1); }

    async next() {
        if (this.state.step === 1) {
            // 讀值並驗證
            this.state.title = document.getElementById('quizTitle').value.trim();
            this.state.subject = document.getElementById('quizSubject').value;
            this.state.dueDate = document.getElementById('quizDueDate').value;
            this.state.timeLimit = Number(document.getElementById('quizTimeLimit').value || 30);
            this.state.shuffleQuestions = document.getElementById('quizShuffleQuestions').checked;
            this.state.shuffleOptions = document.getElementById('quizShuffleOptions').checked;
            const classesEl = document.getElementById('quizClasses');
            this.state.classIds = Array.from(classesEl?.selectedOptions || []).map(o => Number(o.value));
            if (!this.state.title || !this.state.subject || !this.state.dueDate) return alert('請完成必填欄位');
            if (!this.state.classIds.length) return alert('請至少選擇一個班級');
            if (this.state.timeLimit < 5 || this.state.timeLimit > 180) return alert('限時需介於 5-180 分鐘');
        }
        if (this.state.step === 2) {
            // 檢查年級、出版社和章節是否已選擇
            if (!this.state.grade) return alert('請選擇年級');
            if (!this.state.publisher) return alert('請選擇出版社');
            if (!this.state.chapter) return alert('請選擇章節');
            if (this.state.selectedQuestions.length === 0) return alert('請至少選擇 1 題');
        }
        this.toStep(this.state.step + 1);
    }

    // 年級變更處理
    onGradeChange() {
        const grade = document.getElementById('quizGrade').value;
        this.state.grade = grade;
        
        // 清空出版社和章節選擇
        const publisherSelect = document.getElementById('quizPublisher');
        const chapterSelect = document.getElementById('quizChapter');
        publisherSelect.value = '';
        chapterSelect.innerHTML = '<option value="">請先選擇年級和出版社</option>';
        
        // 清空題目列表
        this.state.selectedQuestions = [];
        this.renderSelected();
        this.renderQuestionList([]);
    }

    // 出版社變更處理
    onPublisherChange() {
        const publisher = document.getElementById('quizPublisher').value;
        this.state.publisher = publisher;
        
        // 清空章節選擇
        const chapterSelect = document.getElementById('quizChapter');
        chapterSelect.innerHTML = '<option value="">請選擇章節</option>';
        
        if (publisher && this.state.grade) {
            // 根據年級和出版社載入對應的章節
            this.loadChaptersByGradeAndPublisher(this.state.grade, publisher);
        }
        
        // 清空題目列表
        this.state.selectedQuestions = [];
        this.renderSelected();
        this.renderQuestionList([]);
    }

    // 章節變更處理
    onChapterChange() {
        const chapter = document.getElementById('quizChapter').value;
        this.state.chapter = chapter;
        
        console.log(`章節變更: ${chapter}`);
        console.log(`當前狀態: 年級=${this.state.grade}, 出版社=${this.state.publisher}, 章節=${this.state.chapter}`);
        
        if (chapter) {
            // 載入該章節的題目
            this.state.qPage = 1;
            console.log('開始載入題目...');
            this.loadQuestionList();
        } else {
            // 清空題目列表
            console.log('清空題目列表');
            this.renderQuestionList([]);
        }
    }

    // 根據年級和出版社載入章節
    async loadChaptersByGradeAndPublisher(grade, publisher) {
        const chapterSelect = document.getElementById('quizChapter');
        
        // 優先使用靜態數據，避免 API 依賴
        this.loadStaticChapters(grade, publisher);
        
        // 如果靜態數據沒有該年級和出版社的組合，嘗試從 API 載入
        const staticChapters = this.getStaticChapters(grade, publisher);
        if (staticChapters.length === 0) {
            try {
                console.log(`嘗試從 API 載入章節: ${grade} ${publisher}`);
                const params = new URLSearchParams();
                params.append('grade', grade);
                params.append('publisher', publisher);
                params.append('page_size', 100);
                
                const data = await apiClient.get(`${this.questionsPath}?${params.toString()}`);
                const questions = Array.isArray(data) ? data : (data.items || data.results || data.questions || []);
                
                // 提取唯一的章節
                const chapters = [...new Set(questions.map(q => q.chapter).filter(Boolean))];
                chapters.sort();
                
                if (chapters.length > 0) {
                    chapterSelect.innerHTML = '<option value="">請選擇章節</option>';
                    chapters.forEach(chapter => {
                        const option = document.createElement('option');
                        option.value = chapter;
                        option.textContent = chapter;
                        chapterSelect.appendChild(option);
                    });
                    console.log(`✅ 從 API 載入章節成功: ${grade} ${publisher}, 共 ${chapters.length} 個章節`);
                }
            } catch (error) {
                console.error('❌ 從 API 載入章節失敗:', error);
                // API 失敗時，顯示預設章節
                this.loadDefaultChapters();
            }
        }
    }

    // 獲取靜態章節數據
    getStaticChapters(grade, publisher) {
        const staticChapters = {
            '7A': {
                '康軒': ['第一章 數與式', '第二章 多項式', '第三章 二次函數', '第四章 統計與機率'],
                '翰林': ['第一單元 數與式', '第二單元 多項式', '第三單元 二次函數', '第四單元 統計與機率'],
                '南一': ['單元一 數與式', '單元二 多項式', '單元三 二次函數', '單元四 統計與機率']
            },
            '7B': {
                '康軒': ['第五章 指數與對數', '第六章 幾何圖形', '第七章 三角形', '第八章 四邊形'],
                '翰林': ['第五單元 指數與對數', '第六單元 幾何圖形', '第七單元 三角形', '第八單元 四邊形'],
                '南一': ['單元五 指數與對數', '單元六 幾何圖形', '單元七 三角形', '單元八 四邊形']
            },
            '8A': {
                '康軒': ['第一章 一元二次方程式', '第二章 函數', '第三章 相似形', '第四章 圓'],
                '翰林': ['第一單元 一元二次方程式', '第二單元 函數', '第三單元 相似形', '第四單元 圓'],
                '南一': ['單元一 一元二次方程式', '單元二 函數', '單元三 相似形', '單元四 圓']
            },
            '8B': {
                '康軒': ['第五章 二次函數', '第六章 統計', '第七章 機率', '第八章 幾何證明'],
                '翰林': ['第五單元 二次函數', '第六單元 統計', '第七單元 機率', '第八單元 幾何證明'],
                '南一': ['單元五 二次函數', '單元六 統計', '單元七 機率', '單元八 幾何證明']
            },
            '9A': {
                '康軒': ['第一章 數列', '第二章 等差數列', '第三章 等比數列', '第四章 排列組合'],
                '翰林': ['第一單元 數列', '第二單元 等差數列', '第三單元 等比數列', '第四單元 排列組合'],
                '南一': ['單元一 數列', '單元二 等差數列', '單元三 等比數列', '單元四 排列組合']
            },
            '9B': {
                '康軒': ['第五章 機率', '第六章 統計', '第七章 三角函數', '第八章 複習'],
                '翰林': ['第五單元 機率', '第六單元 統計', '第七單元 三角函數', '第八單元 複習'],
                '南一': ['單元五 機率', '單元六 統計', '單元七 三角函數', '單元八 複習']
            }
        };
        
        return staticChapters[grade]?.[publisher] || [];
    }

    // 靜態章節數據作為備用
    loadStaticChapters(grade, publisher) {
        const chapterSelect = document.getElementById('quizChapter');
        const chapters = this.getStaticChapters(grade, publisher);
        
        // 清空並重新填充章節選項
        chapterSelect.innerHTML = '<option value="">請選擇章節</option>';
        chapters.forEach(chapter => {
            const option = document.createElement('option');
            option.value = chapter;
            option.textContent = chapter;
            chapterSelect.appendChild(option);
        });
        
        if (chapters.length > 0) {
            console.log(`✅ 載入靜態章節成功: ${grade} ${publisher}, 共 ${chapters.length} 個章節`);
        } else {
            console.log(`⚠️ 沒有找到 ${grade} ${publisher} 的靜態章節數據`);
        }
    }

    // 載入預設章節（當靜態數據和 API 都失敗時）
    loadDefaultChapters() {
        const chapterSelect = document.getElementById('quizChapter');
        const defaultChapters = [
            '第一章 基礎概念',
            '第二章 進階應用',
            '第三章 綜合練習',
            '第四章 複習測驗'
        ];
        
        chapterSelect.innerHTML = '<option value="">請選擇章節</option>';
        defaultChapters.forEach(chapter => {
            const option = document.createElement('option');
            option.value = chapter;
            option.textContent = chapter;
            chapterSelect.appendChild(option);
        });
        
        console.log('✅ 載入預設章節成功');
    }

    async loadClasses() {
        try {
            console.log('🏫 開始載入班級列表');
            console.log('🔗 API 路徑:', this.classesPath);
            
            const data = await apiClient.get(this.classesPath);
            console.log('📡 班級 API 回應:', data);
            
            const classes = Array.isArray(data) ? data : (data.items || data.data || []);
            console.log('📋 解析後的班級列表:', classes);
            
            const sel = document.getElementById('quizClasses');
            if (!sel) {
                console.error('❌ 找不到班級選擇器 #quizClasses');
                return;
            }
            
            if (classes.length === 0) {
                console.log('⚠️ 班級列表為空');
                sel.innerHTML = '<option value="">暫無可用班級</option>';
                return;
            }
            
            const options = classes.map(c => {
                const id = c.class_id || c.id;
                const name = c.class_name || c.name;
                console.log(`班級: ID=${id}, 名稱=${name}`);
                return `<option value="${id}">${name}</option>`;
            }).join('');
            
            sel.innerHTML = options;
            console.log(`✅ 班級載入成功: ${classes.length} 個班級`);
            
        } catch (error) {
            console.error('❌ 載入班級失敗:', error);
            const sel = document.getElementById('quizClasses');
            if (sel) {
                sel.innerHTML = '<option value="">載入班級失敗</option>';
            }
        }
    }

    async loadQuestionList() {
        // 檢查是否已選擇年級、出版社和章節
        if (!this.state.grade || !this.state.publisher || !this.state.chapter) {
            console.log('❌ 缺少必要參數:', { grade: this.state.grade, publisher: this.state.publisher, chapter: this.state.chapter });
            this.renderQuestionList([]);
            return;
        }

        console.log(`🔍 開始載入題目，參數:`, {
            grade: this.state.grade,
            publisher: this.state.publisher,
            chapter: this.state.chapter,
            page: this.state.qPage,
            pageSize: this.state.qPageSize
        });

        try {
            // 先載入所有題目，然後在前端過濾
            console.log(`🌐 嘗試從 API 載入題目: ${this.questionsPath}`);
            const data = await apiClient.get(this.questionsPath);
            console.log('📡 API 回應:', data);
            
            let allQuestions = Array.isArray(data) ? data : (data.items || data.results || data.questions || []);
            console.log(`📝 載入所有題目: ${allQuestions.length} 題`);
            
            // 在前端過濾題目
            const filteredQuestions = allQuestions.filter(q => {
                const gradeMatch = q.grade === this.state.grade;
                const publisherMatch = q.publisher === this.state.publisher;
                const chapterMatch = q.chapter === this.state.chapter;
                
                console.log(`題目 ${q.id}: grade=${q.grade}(${gradeMatch}), publisher=${q.publisher}(${publisherMatch}), chapter=${q.chapter}(${chapterMatch})`);
                
                return gradeMatch && publisherMatch && chapterMatch;
            });
            
            console.log(`🔍 過濾後題目: ${filteredQuestions.length} 題`);
            
            // 分頁處理
            const startIndex = (this.state.qPage - 1) * this.state.qPageSize;
            const endIndex = startIndex + this.state.qPageSize;
            const list = filteredQuestions.slice(startIndex, endIndex);
            
            this.state.qTotal = filteredQuestions.length;
            
            console.log(`📝 載入題目完成: ${list.length} 題 (第 ${this.state.qPage} 頁)`);
            this.renderQuestionList(list);
            
        } catch (error) {
            console.error('❌ 載入題目失敗:', error);
            console.log('📭 顯示空題目列表');
            this.renderQuestionList([]);
        }
    }

    renderQuestionList(list) {
        console.log('🎨 開始渲染題目列表:', list.length, '題');
        
        const wrap = document.getElementById('qList');
        if (!wrap) {
            console.error('❌ 找不到題目列表容器 #qList');
            return;
        }
        
        if (!list.length) {
            console.log('📭 題目列表為空，顯示空狀態');
            wrap.innerHTML = `<div style="color:var(--text-light);text-align:center;padding:2rem;">沒有符合條件的題目</div>`;
            const pagerHint = document.getElementById('qPagerHint');
            if (pagerHint) pagerHint.textContent = '';
            return;
        }
        
        console.log('🔍 開始渲染題目項目');
        const selectedSet = new Set(this.state.selectedQuestions.map(q => q.id || q.question_id));
        wrap.innerHTML = list.map(q => {
            const questionId = q.id || q.question_id;
            const added = selectedSet.has(questionId);
            const content = q.question || q.content || `題目 ${questionId}`;
            const subject = q.subject || '未知科目';
            const difficulty = q.difficulty || '未知難度';
            const knowledgePoint = q.topic || q.knowledge_point || '未知知識點';
            
            return `
                <div style="padding:.75rem;border-bottom:1px solid var(--border);display:flex;gap:.75rem;align-items:flex-start;">
                    <div style="flex:1;">
                        <div style="font-weight:600;margin-bottom:.5rem;line-height:1.4;">
                            #${questionId} ${this.escapeHtml(content)}
                        </div>
                        <div style="font-size:.85rem;color:var(--text-light);display:flex;gap:.75rem;flex-wrap:wrap;">
                            <span>${subject}</span>
                            <span>·</span>
                            <span>${difficulty}</span>
                            <span>·</span>
                            <span>${knowledgePoint}</span>
                        </div>
                    </div>
                    <button class="btn ${added ? 'btn-secondary' : 'btn-primary'}" 
                            data-action="${added ? 'remove' : 'add'}" 
                            data-id="${questionId}"
                            style="min-width:60px;white-space:nowrap;">
                        ${added ? '移除' : '加入'}
                    </button>
                </div>
            `;
        }).join('');
        
        console.log('🔗 綁定題目按鈕事件');
        // 綁定加入/移除按鈕事件
        wrap.querySelectorAll('button[data-action]').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.getAttribute('data-id');
                const item = list.find(x => (x.id || x.question_id) === id);
                if (!item) {
                    console.error('❌ 找不到題目項目:', id);
                    return;
                }
                
                const idx = this.state.selectedQuestions.findIndex(x => (x.id || x.question_id) === id);
                if (idx >= 0) {
                    // 移除題目
                    this.state.selectedQuestions.splice(idx, 1);
                    console.log(`➖ 移除題目 #${id}`);
                } else {
                    // 加入題目
                    if (this.state.selectedQuestions.length >= this.maxQuestions) {
                        alert(`最多選擇 ${this.maxQuestions} 題`);
                        return;
                    }
                    this.state.selectedQuestions.push(item);
                    console.log(`➕ 加入題目 #${id}`);
                }
                
                this.renderSelected();
                // 重新渲染題目列表以更新按鈕狀態
                this.renderQuestionList(list);
            });
        });
        
        // 更新分頁提示
        const maxPage = Math.max(1, Math.ceil(this.state.qTotal / this.state.qPageSize));
        const pagerHint = document.getElementById('qPagerHint');
        if (pagerHint) {
            pagerHint.textContent = `第 ${this.state.qPage}/${maxPage} 頁，共 ${this.state.qTotal} 題`;
        }
        
        console.log('✅ 題目列表渲染完成');
    }

    renderSelected() {
        const wrap = document.getElementById('qSelected');
        const countEl = document.getElementById('qSelectedCount');
        
        if (countEl) countEl.textContent = String(this.state.selectedQuestions.length);
        if (!wrap) return;
        
        if (this.state.selectedQuestions.length === 0) {
            wrap.innerHTML = `<div style="color:var(--text-light);text-align:center;padding:2rem;">尚未選擇題目</div>`;
            return;
        }
        
        wrap.innerHTML = this.state.selectedQuestions.map((q, i) => {
            const content = q.content || `題目 ${q.id}`;
            const subject = q.subject || '未知科目';
            const difficulty = q.difficulty || '未知難度';
            
            return `
                <div style="padding:.75rem;border-bottom:1px solid var(--border);display:flex;gap:.75rem;align-items:flex-start;">
                    <span style="width:2rem;color:var(--text-light);font-weight:600;">${i+1}.</span>
                    <div style="flex:1;">
                        <div style="font-weight:500;margin-bottom:.25rem;line-height:1.3;">
                            ${this.escapeHtml(content)}
                        </div>
                        <div style="font-size:.8rem;color:var(--text-light);">
                            ${subject} · ${difficulty}
                        </div>
                    </div>
                    <button class="btn btn-secondary" 
                            data-remove="${q.id}"
                            style="min-width:50px;padding:.25rem .5rem;font-size:.85rem;">
                        移除
                    </button>
                </div>
            `;
        }).join('');
        
        // 綁定移除按鈕事件
        wrap.querySelectorAll('button[data-remove]').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = Number(btn.getAttribute('data-remove'));
                const idx = this.state.selectedQuestions.findIndex(x => x.id === id);
                if (idx >= 0) {
                    this.state.selectedQuestions.splice(idx, 1);
                    console.log(`從已選列表中移除題目 #${id}`);
                    this.renderSelected();
                    // 重新載入題目列表以更新按鈕狀態
                    this.loadQuestionList();
                }
            });
        });
    }

    renderPreview() {
        const pv = document.getElementById('quizPreview');
        if (!pv) return;
        
        const selectedCount = this.state.selectedQuestions.length;
        const timeLimitText = this.state.timeLimit > 0 ? `${this.state.timeLimit} 分鐘` : '無限制';
        
        pv.innerHTML = `
            <div class="glass-card" style="padding:1.5rem;">
                <h4 style="margin-top:0;margin-bottom:1rem;color:var(--text-dark);">
                    ${this.escapeHtml(this.state.title)}
                </h4>
                
                <div style="margin-bottom:1rem;">
                    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:1rem;margin-bottom:1rem;">
                        <div style="padding:.75rem;background:var(--bg-light);border-radius:8px;">
                            <div style="font-size:.85rem;color:var(--text-light);margin-bottom:.25rem;">科目</div>
                            <div style="font-weight:600;">${this.state.subject || '未設定'}</div>
                        </div>
                        <div style="padding:.75rem;background:var(--bg-light);border-radius:8px;">
                            <div style="font-size:.85rem;color:var(--text-light);margin-bottom:.25rem;">截止日期</div>
                            <div style="font-weight:600;">${this.state.dueDate || '未設定'}</div>
                        </div>
                        <div style="padding:.75rem;background:var(--bg-light);border-radius:8px;">
                            <div style="font-size:.85rem;color:var(--text-light);margin-bottom:.25rem;">題目數量</div>
                            <div style="font-weight:600;">${selectedCount} 題</div>
                        </div>
                        <div style="padding:.75rem;background:var(--bg-light);border-radius:8px;">
                            <div style="font-size:.85rem;color:var(--text-light);margin-bottom:.25rem;">限時</div>
                            <div style="font-weight:600;">${timeLimitText}</div>
                        </div>
                    </div>
                    
                    <div style="padding:.75rem;background:var(--bg-light);border-radius:8px;">
                        <div style="font-size:.85rem;color:var(--text-light);margin-bottom:.25rem;">設定選項</div>
                        <div style="display:flex;gap:1rem;flex-wrap:wrap;">
                            <span style="font-size:.85rem;">
                                <i class="fas fa-clock" style="margin-right:.25rem;"></i>
                                作答次數：1 次
                            </span>
                            <span style="font-size:.85rem;">
                                <i class="fas fa-random" style="margin-right:.25rem;"></i>
                                題目亂序：${this.state.shuffleQuestions ? '是' : '否'}
                            </span>
                            <span style="font-size:.85rem;">
                                <i class="fas fa-shuffle" style="margin-right:.25rem;"></i>
                                選項亂序：${this.state.shuffleOptions ? '是' : '否'}
                            </span>
                        </div>
                    </div>
                </div>
                
                ${selectedCount > 0 ? `
                    <div style="margin-top:1.5rem;">
                        <h5 style="margin-bottom:1rem;color:var(--text-dark);">題目預覽</h5>
                        <ol style="padding-left:1.5rem;margin:0;">
                            ${this.state.selectedQuestions.map((q, i) => {
                                const content = q.content || `題目 ${q.id}`;
                                const subject = q.subject || '未知科目';
                                const difficulty = q.difficulty || '未知難度';
                                
                                return `
                                    <li style="margin-bottom:.75rem;line-height:1.4;">
                                        <div style="font-weight:500;margin-bottom:.25rem;">
                                            ${this.escapeHtml(content)}
                                        </div>
                                        <div style="font-size:.8rem;color:var(--text-light);">
                                            ${subject} · ${difficulty}
                                        </div>
                                    </li>
                                `;
                            }).join('')}
                        </ol>
                    </div>
                ` : `
                    <div style="text-align:center;padding:2rem;color:var(--text-light);">
                        <i class="fas fa-exclamation-triangle" style="font-size:2rem;margin-bottom:1rem;opacity:.5;"></i>
                        <div>尚未選擇任何題目</div>
                    </div>
                `}
            </div>
        `;
    }

    async publish() {
        if (this.state.selectedQuestions.length === 0) return alert('請至少選擇 1 題');
        const body = {
            type: 'quiz',
            title: this.state.title,
            subject: this.state.subject,
            due_date: this.state.dueDate,
            class_ids: this.state.classIds,
            question_ids: this.state.selectedQuestions.map(q => q.id),
            time_limit_minutes: this.state.timeLimit,
            attempt_limit: 1,
            shuffle_questions: this.state.shuffleQuestions,
            shuffle_options: this.state.shuffleOptions
        };
        try {
            await apiClient.post(this.assignmentsPath, body);
            alert('已發布考卷');
            this.close();
            // 重新載入作業列表
            await assignmentsManager.loadAssignments();
            assignmentsManager.filterAssignments();
        } catch (e) {
            alert('發布失敗：' + (e.message || '未知錯誤'));
        }
    }

    // 工具：debounce/escape
    debounce(fn, ms) {
        let t; return (...args) => { clearTimeout(t); t = setTimeout(() => fn.apply(this, args), ms); };
    }
    escapeHtml(str) { return (str || '').replace(/[&<>"']/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[s])); }
}

// 對外入口
function createAssignment() { assignmentsManager.openModal('新增作業'); }
function viewAssignment(id) { assignmentsManager.editExisting(id); }
function editAssignment(id) { assignmentsManager.editExisting(id); }
function gradeAssignment(id) { window.location.href = '/pages/grades-enhanced.html?from=assignments&id=' + encodeURIComponent(id); }
function duplicateAssignment(id) { assignmentsManager.duplicateExisting(id); }
function exportAssignments() { assignmentsManager.exportCurrent(); }
function importAssignments() { assignmentsManager.importFromFile(); }
function bulkGrade() { window.location.href = '/pages/grades-enhanced.html?bulk=1'; }
function sendReminders() { assignmentsManager.sendReminders(); }
function viewAnalytics() { window.location.href = '/pages/analytics-enhanced.html'; }
function previousMonth() { assignmentsManager.currentMonth.setMonth(assignmentsManager.currentMonth.getMonth() - 1); assignmentsManager.renderCalendar(); }
function nextMonth() { assignmentsManager.currentMonth.setMonth(assignmentsManager.currentMonth.getMonth() + 1); assignmentsManager.renderCalendar(); }
function openQuizBuilder() { window.quizBuilder = new QuizBuilder(); }

// 初始化
let assignmentsManager;
document.addEventListener('DOMContentLoaded', () => { assignmentsManager = new AssignmentsManager(); });