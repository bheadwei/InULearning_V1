console.log('StudentsAnalysisManager loading...');

class StudentsAnalysisManager {
    constructor() {
        console.log('StudentsAnalysisManager constructor called');
        this.currentClassId = null;
        this.currentPage = 1;
        this.pageSize = 20;
        this.totalPages = 0;
        this.totalCount = 0;
        this.students = [];
        this.filteredStudents = [];
        this.charts = {};
        this.sortOrder = 'asc';
        this.sortBy = 'name';
        this.searchTerm = '';
        this.currentView = 'overview'; // overview, list, detail
        this.currentStudentId = null;
        this.isInitialized = false;
        this.init();
    }

    async init() {
        if (this.isInitialized) {
            console.log('StudentsAnalysisManager already initialized');
            return;
        }
        
        try {
            console.log('Initializing StudentsAnalysisManager...');
            
            // 先檢查認證狀態
            await this.checkAuth();
            
            this.setupEventListeners();
            await this.loadClasses();
            
            this.isInitialized = true;
            console.log('StudentsAnalysisManager initialization complete');
        } catch (error) {
            console.error('Initialization failed:', error);
            this.showError('Initialization failed, please check network connection');
        }
    }

    setupEventListeners() {
        console.log('Setting up event listeners...');
        
        // Class selector change event
        const classSelector = document.getElementById('classSelector');
        if (classSelector) {
            classSelector.addEventListener('change', (e) => {
                console.log('Class selected:', e.target.value);
                this.currentClassId = e.target.value;
                this.currentPage = 1;
                if (this.currentClassId) {
                    this.showClassOverview();
                    this.loadClassOverview(this.currentClassId);
                    this.loadStudents(this.currentClassId);
                } else {
                    this.showNoDataState();
                    // 隱藏快速統計區
                    const quickStats = document.getElementById('quickStats');
                    if (quickStats) quickStats.classList.add('hidden');
                }
            });
        }

        // Refresh button
        const refreshBtn = document.getElementById('refreshBtn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => {
                console.log('Refresh button clicked');
                if (this.currentClassId) {
                    this.loadClassOverview(this.currentClassId);
                    this.loadStudents(this.currentClassId);
                }
            });
        }

        // Search input
        const searchInput = document.getElementById('studentSearchInput');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.searchTerm = e.target.value;
                this.filterAndDisplayStudents();
            });
        }

        // Sort controls
        const sortBy = document.getElementById('sortBy');
        if (sortBy) {
            sortBy.addEventListener('change', (e) => {
                this.sortBy = e.target.value;
                this.filterAndDisplayStudents();
            });
        }

        const sortOrder = document.getElementById('sortOrder');
        if (sortOrder) {
            sortOrder.addEventListener('click', () => {
                this.sortOrder = this.sortOrder === 'asc' ? 'desc' : 'asc';
                sortOrder.querySelector('.material-icons').textContent = 
                    this.sortOrder === 'asc' ? 'arrow_upward' : 'arrow_downward';
                this.filterAndDisplayStudents();
            });
        }

        // Pagination
        const prevPage = document.getElementById('prevPage');
        if (prevPage) {
            prevPage.addEventListener('click', () => {
                if (this.currentPage > 1) {
                    this.currentPage--;
                    this.filterAndDisplayStudents();
                }
            });
        }

        const nextPage = document.getElementById('nextPage');
        if (nextPage) {
            nextPage.addEventListener('click', () => {
                if (this.currentPage < this.totalPages) {
                    this.currentPage++;
                    this.filterAndDisplayStudents();
                }
            });
        }

        // Retry button
        const retryBtn = document.getElementById('retryBtn');
        if (retryBtn) {
            retryBtn.addEventListener('click', () => {
                if (this.currentClassId) {
                    this.loadClassOverview(this.currentClassId);
                    this.loadStudents(this.currentClassId);
                }
            });
        }

        // View toggle button
        const viewToggleBtn = document.getElementById('viewToggleBtn');
        if (viewToggleBtn) {
            viewToggleBtn.addEventListener('click', () => {
                this.toggleStudentView();
            });
        }

        // Back to list button
        const backToListBtn = document.getElementById('backToListBtn');
        if (backToListBtn) {
            backToListBtn.addEventListener('click', () => {
                this.showStudentList();
            });
        }
    }

    async checkAuth() {
        try {
            console.log('🔐 檢查認證狀態...');
            
            // 檢查是否有認證管理器
            if (typeof teacherAuth === 'undefined') {
                throw new Error('認證管理器未找到');
            }
            
            // 檢查登入狀態
            if (!teacherAuth.isLoggedIn()) {
                throw new Error('用戶未登入');
            }
            
            // 獲取當前用戶
            const user = teacherAuth.getCurrentUser();
            if (!user) {
                throw new Error('無法獲取用戶資訊');
            }
            
            console.log('✅ 認證檢查通過，用戶:', user);
            this.updatePageUserInfo(user);
            this.showUserInfo();
            
            // 設置 API 認證
            await this.setupAPIAuthentication();
            
        } catch (error) {
            console.error('❌ 認證檢查失敗:', error);
            this.showAuthButtons();
            throw error;
        }
    }

    async setupAPIAuthentication() {
        try {
            console.log('🔗 設置 API 認證...');
            
            // 獲取認證 token
            const token = teacherAuth.getToken();
            if (!token) {
                throw new Error('無法獲取認證 token');
            }
            
            console.log('✅ 獲取到認證 token');
            
            // 設置全域認證狀態
            if (typeof window.realAPIClient === 'undefined') {
                window.realAPIClient = {
                    isAuthenticated: true,
                    token: token,
                    getTeacherClasses: async () => {
                        console.log('🔗 調用真實 API: 獲取教師班級列表');
                        try {
                            const response = await apiClient.get('/teacher/classes');
                            console.log('班級列表 API 回應:', response);
                            return response.data || response || [];
                        } catch (error) {
                            console.error('獲取班級列表失敗:', error);
                            throw error;
                        }
                    },
                    getClassOverview: async (classId) => {
                        console.log('🔗 調用真實 API: 獲取班級概覽');
                        try {
                            const response = await apiClient.get(`/teacher/classes/${classId}/overview`);
                            console.log('班級概覽 API 回應:', response);
                            return response.data || response || {};
                        } catch (error) {
                            console.error('獲取班級概覽失敗:', error);
                            throw error;
                        }
                    },
                    getStudents: async (classId) => {
                        console.log('🔗 調用真實 API: 獲取學生列表');
                        try {
                            const response = await apiClient.get(`/teacher/classes/${classId}/students/analysis`);
                            console.log('學生列表 API 回應:', response);
                            return response.data || response || [];
                        } catch (error) {
                            console.error('獲取學生列表失敗:', error);
                            throw error;
                        }
                    }
                };
                console.log('✅ 真實 API 客戶端已創建並認證');
            } else {
                window.realAPIClient.isAuthenticated = true;
                window.realAPIClient.token = token;
                console.log('✅ 現有 API 客戶端已更新認證狀態');
            }
            
        } catch (error) {
            console.error('❌ 設置 API 認證狀態失敗:', error);
            throw error;
        }
    }

    /**
     * 更新頁面用戶資訊
     */
    updatePageUserInfo(user) {
        const userName = document.getElementById('userName');
        if (userName) {
            userName.textContent = user.name || user.email || '王老師';
        }
        
        // 更新頁面標題
        const pageTitle = document.querySelector('title');
        if (pageTitle) {
            pageTitle.textContent = `學生分析 - ${user.name || user.email} - InULearning`;
        }
    }

    showUserInfo() {
        const userInfo = document.getElementById('userInfo');
        const authButtons = document.getElementById('authButtons');
        if (userInfo && authButtons) {
            userInfo.classList.remove('hidden');
            authButtons.classList.add('hidden');
        }
    }

    showAuthButtons() {
        const userInfo = document.getElementById('userInfo');
        const authButtons = document.getElementById('authButtons');
        if (userInfo && authButtons) {
            userInfo.classList.add('hidden');
            authButtons.classList.remove('hidden');
        }
    }

    async loadClasses() {
        try {
            console.log('🔄 開始載入班級列表...');
            
            // 檢查是否有真實的 API 客戶端
            if (window.realAPIClient && window.realAPIClient.isAuthenticated) {
                console.log('🔗 使用真實 API 獲取班級列表...');
                const classes = await window.realAPIClient.getTeacherClasses();
                console.log('✅ 獲取到班級數據:', classes);
                this.populateClassSelector(classes);
            } else {
                throw new Error('API 客戶端未認證或不存在');
            }
        } catch (error) {
            console.error('❌ 載入班級失敗:', error);
            this.showError('載入班級列表失敗，請檢查網路連線');
        }
    }

    populateClassSelector(classes) {
        console.log('🔄 開始填充班級選擇器...');
        console.log('接收到的班級數據:', classes);
        
        const selector = document.getElementById('classSelector');
        if (!selector) {
            console.error('❌ 找不到班級選擇器元素');
            return;
        }
        
        console.log('✅ 找到班級選擇器元素');
        
        // 清空現有選項
        selector.innerHTML = '<option value="">請選擇班級...</option>';
        
        if (!Array.isArray(classes) || classes.length === 0) {
            console.log('⚠️ 班級數據為空或格式不正確');
            selector.innerHTML = '<option value="">暫無班級數據</option>';
            return;
        }
        
        classes.forEach((cls, index) => {
            console.log(`處理班級 ${index + 1}:`, cls);
            
            const option = document.createElement('option');
            option.value = cls.id || cls.class_id || index + 1;
            option.textContent = cls.name || cls.class_name || `班級 ${index + 1}`;
            
            if (cls.subject) {
                option.textContent += ` (${cls.subject})`;
            }
            
            selector.appendChild(option);
            console.log(`✅ 添加班級選項: ${option.textContent}`);
        });
        
        console.log('✅ 班級選擇器填充完成，共', classes.length, '個班級');
        
        // Auto-select the first class if available
        if (classes.length > 0) {
            const firstClass = classes[0];
            const firstClassId = firstClass.id || firstClass.class_id || 1;
            selector.value = firstClassId;
            this.currentClassId = firstClassId;
            console.log('✅ 自動選擇第一個班級:', firstClass.name || firstClass.class_name, 'ID:', firstClassId);
            
            // Trigger change event to load class data
            const event = new Event('change', { bubbles: true });
            selector.dispatchEvent(event);
        }
    }

    async loadClassOverview(classId) {
        try {
            this.showLoading();
            console.log('Loading class overview for class:', classId);
            
            // 檢查是否有真實的 API 客戶端
            if (window.realAPIClient && window.realAPIClient.isAuthenticated) {
                console.log('🔗 使用真實 API 獲取班級概覽...');
                const data = await window.realAPIClient.getClassOverview(classId);
                this.displayClassOverview(data);
            } else {
                throw new Error('API 客戶端未認證或不存在');
            }
        } catch (error) {
            console.error('Failed to load class overview:', error);
            this.showError('載入班級概覽數據失敗');
        } finally {
            this.hideLoading();
        }
    }

    displayClassOverview(data) {
        console.log('Displaying class overview:', data);
        
        // Update statistics cards
        const totalStudents = document.getElementById('totalStudents');
        const averageAccuracy = document.getElementById('averageAccuracy');
        const averageSpeed = document.getElementById('averageSpeed');
        const totalSessions = document.getElementById('totalSessions');

        if (totalStudents) totalStudents.textContent = data.total_students || 0;
        if (averageAccuracy) averageAccuracy.textContent = `${(data.average_accuracy || 0).toFixed(1)}%`;
        if (averageSpeed) averageSpeed.textContent = `${(data.average_speed || 0).toFixed(1)} 秒/題`;
        if (totalSessions) totalSessions.textContent = data.total_sessions || 0;

        // Show content
        this.showContent();
    }

    async loadStudents(classId) {
        try {
            this.showLoading();
            console.log('Loading students for class:', classId);
            
            // 檢查是否有真實的 API 客戶端
            if (window.realAPIClient && window.realAPIClient.isAuthenticated) {
                console.log('🔗 使用真實 API 獲取學生列表...');
                const response = await window.realAPIClient.getStudents(classId);
                console.log('✅ 獲取到學生數據:', response);
                
                // 安全的數據處理，確保 students 是數組
                let studentsData = [];
                
                if (response && Array.isArray(response)) {
                    // 直接是數組
                    studentsData = response;
                } else if (response && response.data && Array.isArray(response.data)) {
                    // 包裝在 data 字段中
                    studentsData = response.data;
                } else if (response && response.students && Array.isArray(response.students)) {
                    // 包裝在 students 字段中
                    studentsData = response.students;
                } else if (response && typeof response === 'object') {
                    // 如果是對象，嘗試找到數組字段
                    const possibleArrayFields = ['students', 'data', 'items', 'list'];
                    for (const field of possibleArrayFields) {
                        if (response[field] && Array.isArray(response[field])) {
                            studentsData = response[field];
                            break;
                        }
                    }
                }
                
                // 確保 studentsData 是數組
                if (!Array.isArray(studentsData)) {
                    console.warn('⚠️ API 返回的數據不是數組格式，強制轉換為空數組');
                    console.warn('原始數據:', response);
                    studentsData = [];
                }
                
                this.students = studentsData;
                this.totalCount = this.students.length;
                this.totalPages = Math.ceil(this.totalCount / this.pageSize);
                this.currentPage = 1;
                
                console.log('📊 學生數據處理完成:');
                console.log('- 學生數量:', this.students.length);
                console.log('- 學生數據:', this.students);
                console.log('- 數據類型:', typeof this.students);
                console.log('- 是否為數組:', Array.isArray(this.students));
                
            } else {
                throw new Error('API 客戶端未認證或不存在');
            }
            
            // 顯示學生列表
            this.showStudentList();
            
            // 過濾和顯示學生
            this.filterAndDisplayStudents();
            
            // 更新統計信息
            this.updateStatistics();
            
            // 更新分頁
            this.updatePagination();
            
            // 創建圖表
            this.updateCharts();
            
        } catch (error) {
            console.error('❌ 載入學生數據失敗:', error);
            this.showError('載入學生數據失敗');
        } finally {
            this.hideLoading();
        }
    }

    filterAndDisplayStudents() {
        console.log('🔄 開始過濾和顯示學生數據...');
        console.log('原始學生數據:', this.students);
        console.log('搜索關鍵字:', this.searchTerm);
        console.log('學生數據類型:', typeof this.students);
        console.log('是否為數組:', Array.isArray(this.students));
        
        // 額外的安全檢查，確保 this.students 是數組
        if (!Array.isArray(this.students)) {
            console.error('❌ this.students 不是數組，無法進行過濾操作');
            console.error('this.students 的值:', this.students);
            console.error('this.students 的類型:', typeof this.students);
            
            // 強制轉換為空數組
            this.students = [];
            this.filteredStudents = [];
            this.showError('學生數據格式錯誤，請重新載入');
            return;
        }
        
        // 安全的搜索過濾，檢查字段是否存在
        this.filteredStudents = this.students.filter(student => {
            // 檢查學生對象是否有效
            if (!student || typeof student !== 'object') {
                console.warn('⚠️ 無效的學生數據:', student);
                return false;
            }
            
            // 檢查學生姓名字段，支持多種可能的字段名
            const studentName = student.student_name || student.name || student.studentName || student.full_name || '未知學生';
            
            // 如果沒有搜索關鍵字，顯示所有學生
            if (!this.searchTerm || this.searchTerm.trim() === '') {
                return true;
            }
            
            // 安全的字符串搜索
            try {
                return studentName.toString().toLowerCase().includes(this.searchTerm.toLowerCase());
            } catch (error) {
                console.warn('⚠️ 搜索過濾失敗:', error, '學生數據:', student);
                return false;
            }
        });
        
        // 排序
        this.sortStudents();
        
        // 分頁
        this.applyPagination();
        
        console.log('✅ 過濾後的學生數據:', this.filteredStudents);
        this.displayStudents();
    }

    sortStudents() {
        if (!this.sortBy || !Array.isArray(this.filteredStudents)) return;
        
        this.filteredStudents.sort((a, b) => {
            let aValue, bValue;
            
            switch (this.sortBy) {
                case 'name':
                    aValue = (a.student_name || a.name || '').toLowerCase();
                    bValue = (b.student_name || b.name || '').toLowerCase();
                    break;
                case 'accuracy':
                    aValue = parseFloat(a.accuracy_rate || a.accuracy || 0);
                    bValue = parseFloat(b.accuracy_rate || b.accuracy || 0);
                    break;
                case 'speed':
                    aValue = parseFloat(a.average_speed || a.speed || 0);
                    bValue = parseFloat(b.average_speed || b.speed || 0);
                    break;
                case 'sessions':
                    aValue = parseInt(a.total_sessions || a.sessions || 0);
                    bValue = parseInt(b.total_sessions || b.sessions || 0);
                    break;
                default:
                    return 0;
            }
            
            if (this.sortOrder === 'asc') {
                return aValue > bValue ? 1 : -1;
            } else {
                return aValue < bValue ? 1 : -1;
            }
        });
    }

    applyPagination() {
        if (!Array.isArray(this.filteredStudents)) return;
        
        const startIndex = (this.currentPage - 1) * this.pageSize;
        const endIndex = startIndex + this.pageSize;
        
        this.filteredStudents = this.filteredStudents.slice(startIndex, endIndex);
        
        // 更新分頁顯示
        this.updatePaginationDisplay(startIndex, endIndex);
    }

    updatePaginationDisplay(startIndex, endIndex) {
        const startIndexEl = document.getElementById('startIndex');
        const endIndexEl = document.getElementById('endIndex');
        const totalCountEl = document.getElementById('totalCount');
        const prevPageBtn = document.getElementById('prevPage');
        const nextPageBtn = document.getElementById('nextPage');
        
        if (startIndexEl) startIndexEl.textContent = startIndex + 1;
        if (endIndexEl) endIndexEl.textContent = Math.min(endIndex, this.totalCount);
        if (totalCountEl) totalCountEl.textContent = this.totalCount;
        
        if (prevPageBtn) prevPageBtn.disabled = this.currentPage <= 1;
        if (nextPageBtn) nextPageBtn.disabled = this.currentPage >= this.totalPages;
        
        // 更新頁碼
        this.updatePageNumbers();
    }

    updatePageNumbers() {
        const pageNumbersEl = document.getElementById('pageNumbers');
        if (!pageNumbersEl) return;
        
        if (typeof this.totalPages !== 'number' || typeof this.currentPage !== 'number') {
            console.warn('⚠️ 分頁參數無效，跳過頁碼更新');
            return;
        }
        
        pageNumbersEl.innerHTML = '';
        
        const maxVisiblePages = 5;
        let startPage = Math.max(1, this.currentPage - Math.floor(maxVisiblePages / 2));
        let endPage = Math.min(this.totalPages, startPage + maxVisiblePages - 1);
        
        if (endPage - startPage + 1 < maxVisiblePages) {
            startPage = Math.max(1, endPage - maxVisiblePages + 1);
        }
        
        for (let i = startPage; i <= endPage; i++) {
            const pageBtn = document.createElement('button');
            pageBtn.className = `px-3 py-2 border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                i === this.currentPage ? 'bg-blue-600 text-white border-blue-600' : 'text-gray-700'
            }`;
            pageBtn.textContent = i;
            pageBtn.addEventListener('click', () => {
                this.currentPage = i;
                this.filterAndDisplayStudents();
            });
            pageNumbersEl.appendChild(pageBtn);
        }
    }

    displayStudents() {
        console.log('🔄 開始顯示學生數據...');
        
        // 同時更新網格視圖和列表視圖
        this.displayStudentGrid();
        this.displayStudentList();
        
        console.log('✅ 學生數據顯示完成');
    }

    displayStudentGrid() {
        console.log('🔄 開始顯示學生網格視圖...');
        const grid = document.getElementById('studentGridView');
        if (!grid) {
            console.error('❌ 找不到學生網格元素 (studentGridView)');
            return;
        }
        
        console.log('✅ 找到學生網格元素');
        console.log('過濾後的學生數量:', this.filteredStudents ? this.filteredStudents.length : 'undefined');
        
        // 安全檢查
        if (!Array.isArray(this.filteredStudents)) {
            console.error('❌ this.filteredStudents 不是數組，無法顯示學生');
            this.showGridError(grid, '數據格式錯誤，請重新載入', 'error');
            return;
        }
        
        // 清空現有內容
        grid.innerHTML = '';

        if (this.filteredStudents.length === 0) {
            console.log('⚠️ 沒有學生數據可顯示');
            this.showGridError(grid, '沒有找到符合條件的學生', 'search_off');
            return;
        }

        console.log('🎯 開始創建學生卡片...');
        this.filteredStudents.forEach((student, index) => {
            console.log(`創建學生卡片 ${index + 1}:`, student);
            try {
                const card = this.createStudentCard(student);
                grid.appendChild(card);
                console.log(`✅ 學生卡片 ${index + 1} 創建成功`);
            } catch (error) {
                console.error(`❌ 創建學生卡片 ${index + 1} 失敗:`, error);
            }
        });
        
        console.log('✅ 學生網格視圖顯示完成');
    }

    showGridError(grid, message, icon) {
        grid.innerHTML = `
            <div class="col-span-full text-center py-12 text-gray-500">
                <span class="material-icons text-4xl text-gray-300 mb-2">${icon}</span>
                <p>${message}</p>
            </div>
        `;
    }

    displayStudentList() {
        console.log('🔄 開始顯示學生列表視圖...');
        const tableBody = document.getElementById('studentTableBody');
        if (!tableBody) {
            console.error('❌ 找不到學生表格元素 (studentTableBody)');
            return;
        }
        
        // 安全檢查
        if (!Array.isArray(this.filteredStudents)) {
            console.error('❌ this.filteredStudents 不是數組，無法顯示學生');
            tableBody.innerHTML = `
                <tr>
                    <td colspan="6" class="px-6 py-4 text-center text-gray-500">
                        <span class="material-icons text-2xl text-gray-300 mb-2">error</span>
                        <p>數據格式錯誤，請重新載入</p>
                </td>
                </tr>
            `;
            return;
        }
        
        // 清空現有內容
        tableBody.innerHTML = '';

        if (this.filteredStudents.length === 0) {
            console.log('⚠️ 沒有學生數據可顯示');
            tableBody.innerHTML = `
                <tr>
                    <td colspan="6" class="px-6 py-4 text-center text-gray-500">
                        <span class="material-icons text-2xl text-gray-300 mb-2">search_off</span>
                        <p>沒有找到符合條件的學生</p>
                    </td>
                </tr>
            `;
            return;
        }

        console.log('🎯 開始創建學生表格行...');
        this.filteredStudents.forEach((student, index) => {
            console.log(`創建學生表格行 ${index + 1}:`, student);
            try {
                const row = this.createStudentTableRow(student);
                tableBody.appendChild(row);
                console.log(`✅ 學生表格行 ${index + 1} 創建成功`);
            } catch (error) {
                console.error(`❌ 創建學生表格行 ${index + 1} 失敗:`, error);
            }
        });
        
        console.log('✅ 學生列表視圖顯示完成');
    }

    createStudentCard(student) {
        console.log('🔄 創建學生卡片:', student);
        
        // 使用模組化的數據提取方法，參考學生端的風格
        const studentData = this.extractStudentData(student);
        
        const card = document.createElement('div');
        card.className = 'bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow cursor-pointer card-hover';
        card.addEventListener('click', () => this.openStudentDetail(studentData.id));

        // 計算進度條顏色和狀態
        const { accuracyColor, speedColor, statusBadge } = this.calculateStudentStatus(studentData);

        card.innerHTML = `
            <div class="flex items-center justify-between mb-4">
                <div class="flex items-center space-x-3">
                    <div class="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                        <span class="material-icons text-blue-600">person</span>
                    </div>
                    <div>
                        <h3 class="font-semibold text-gray-800">${studentData.name}</h3>
                        <p class="text-sm text-gray-500">${studentData.className}</p>
                    </div>
                </div>
                <div class="text-right">
                    ${statusBadge}
                </div>
            </div>
            
            <div class="space-y-3">
                <div>
                    <div class="flex justify-between text-sm mb-1">
                        <span class="text-gray-600">正確率</span>
                        <span class="font-medium">${studentData.accuracyRate.toFixed(1)}%</span>
                    </div>
                    <div class="w-full bg-gray-200 rounded-full h-2">
                        <div class="h-2 rounded-full ${accuracyColor}" style="width: ${Math.min(studentData.accuracyRate, 100)}%"></div>
                    </div>
                </div>

                <div>
                    <div class="flex justify-between text-sm mb-1">
                        <span class="text-gray-600">答題速度</span>
                        <span class="font-medium">${studentData.averageSpeed.toFixed(1)} 秒/題</span>
                    </div>
                    <div class="w-full bg-gray-200 rounded-full h-2">
                        <div class="h-2 rounded-full ${speedColor}" style="width: ${Math.min(studentData.averageSpeed / 60 * 100, 100)}%"></div>
                    </div>
                </div>

                <div class="grid grid-cols-2 gap-4 pt-2">
                    <div class="text-center">
                        <div class="text-lg font-semibold text-blue-600">${studentData.totalSessions}</div>
                        <div class="text-xs text-gray-500">學習會話</div>
                    </div>
                    <div class="text-center">
                        <div class="text-lg font-semibold text-green-600">${studentData.totalQuestions}</div>
                        <div class="text-xs text-gray-500">練習題數</div>
                    </div>
                </div>
            </div>
        `;

        return card;
    }

    extractStudentData(student) {
        // 安全的數據提取，參考學生端的風格
        return {
            id: student.student_id || student.id || student.user_id || 'unknown',
            name: student.student_name || student.name || student.studentName || student.full_name || '未知學生',
            className: student.class_name || student.className || student.class || '未知班級',
            accuracyRate: student.accuracy_rate || student.accuracy || student.accuracyRate || 0,
            averageSpeed: student.average_speed || student.speed || student.answerSpeed || 0,
            totalSessions: student.total_sessions || student.sessions || student.learningSessions || 0,
            totalQuestions: student.total_questions || student.questions || student.answeredQuestions || 0,
            lastActive: student.last_active ? new Date(student.last_active).toLocaleDateString() : '未知'
        };
    }

    calculateStudentStatus(studentData) {
        // 計算正確率顏色
        let accuracyColor;
        if (studentData.accuracyRate >= 80) {
            accuracyColor = 'bg-green-500';
        } else if (studentData.accuracyRate >= 60) {
            accuracyColor = 'bg-yellow-500';
        } else {
            accuracyColor = 'bg-red-500';
        }

        // 計算答題速度顏色
        let speedColor;
        if (studentData.averageSpeed <= 30) {
            speedColor = 'bg-green-500';
        } else if (studentData.averageSpeed <= 60) {
            speedColor = 'bg-yellow-500';
        } else {
            speedColor = 'bg-red-500';
        }

        // 計算狀態徽章
        let statusBadge;
        if (studentData.totalSessions >= 10) {
            statusBadge = '<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">活躍</span>';
        } else if (studentData.totalSessions >= 5) {
            statusBadge = '<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">一般</span>';
        } else {
            statusBadge = '<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">待加強</span>';
        }

        return { accuracyColor, speedColor, statusBadge };
    }

    createStudentTableRow(student) {
        console.log('🔄 創建學生表格行:', student);
        
        // 使用模組化的數據提取方法
        const studentData = this.extractStudentData(student);
        
        const row = document.createElement('tr');
        row.className = 'hover:bg-gray-50';
        
        // 計算進度條顏色
        const { accuracyColor } = this.calculateStudentStatus(studentData);
        
        row.innerHTML = `
            <td class="px-6 py-4 whitespace-nowrap">
                <div class="flex items-center">
                    <div class="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                        <span class="material-icons text-blue-600 text-sm">person</span>
                    </div>
                    <div class="ml-4">
                        <div class="text-sm font-medium text-gray-900">${studentData.name}</div>
                        <div class="text-sm text-gray-500">${studentData.className}</div>
                    </div>
                </div>
            </td>
            <td class="px-6 py-4 whitespace-nowrap">
                <div class="flex items-center">
                    <div class="w-16 bg-gray-200 rounded-full h-2 mr-2">
                        <div class="h-2 rounded-full ${accuracyColor}" style="width: ${Math.min(studentData.accuracyRate, 100)}%"></div>
                    </div>
                    <span class="text-sm text-gray-900">${studentData.accuracyRate.toFixed(1)}%</span>
                </div>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                ${studentData.averageSpeed.toFixed(1)} 秒/題
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                ${studentData.totalSessions}
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                ${studentData.lastActive}
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                <button onclick="window.studentsManager.showStudentDetail('${studentData.id}')" 
                        class="text-blue-600 hover:text-blue-900">
                    查看詳情
                </button>
            </td>
        `;
        
        return row;
    }

    openStudentDetail(studentId) {
        console.log('Opening student detail for ID:', studentId);
        this.showStudentDetail(studentId);
    }

    updateStatistics() {
        if (!Array.isArray(this.students) || this.students.length === 0) return;
        
        // 計算統計數據
        const totalStudents = this.students.length;
        const avgAccuracy = this.students.reduce((sum, s) => sum + (s.accuracy_rate || s.accuracy || 0), 0) / totalStudents;
        const avgSpeed = this.students.reduce((sum, s) => sum + (s.average_speed || s.speed || 0), 0) / totalStudents;
        const totalSessions = this.students.reduce((sum, s) => sum + (s.total_sessions || s.sessions || 0), 0);
        
        // 更新班級概覽統計
        const totalStudentsEl = document.getElementById('totalStudents');
        const averageAccuracyEl = document.getElementById('averageAccuracy');
        const averageSpeedEl = document.getElementById('averageSpeed');
        const totalSessionsEl = document.getElementById('totalSessions');
        
        if (totalStudentsEl) totalStudentsEl.textContent = totalStudents;
        if (averageAccuracyEl) averageAccuracyEl.textContent = `${avgAccuracy.toFixed(1)}%`;
        if (averageSpeedEl) averageSpeedEl.textContent = `${avgSpeed.toFixed(1)} 秒/題`;
        if (totalSessionsEl) totalSessionsEl.textContent = totalSessions;
        
        // 更新快速統計
        this.updateQuickStats();
        
        // 更新側邊分析區
        this.updateSidebarAnalysis();
    }

    updateQuickStats() {
        if (!Array.isArray(this.students) || this.students.length === 0) return;
        
        // 計算快速統計數據
        const totalStudents = this.students.length;
        const avgProgress = this.students.reduce((sum, s) => sum + (s.accuracy_rate || s.accuracy || 0), 0) / totalStudents;
        const excellentStudents = this.students.filter(s => (s.accuracy_rate || s.accuracy || 0) >= 80).length;
        const needAttention = this.students.filter(s => (s.accuracy_rate || s.accuracy || 0) < 60).length;
        
        // 更新快速統計顯示
        const quickTotalStudents = document.getElementById('quickTotalStudents');
        const quickAvgProgress = document.getElementById('quickAvgProgress');
        const quickExcellentStudents = document.getElementById('quickExcellentStudents');
        const quickNeedAttention = document.getElementById('quickNeedAttention');
        
        if (quickTotalStudents) quickTotalStudents.textContent = totalStudents;
        if (quickAvgProgress) quickAvgProgress.textContent = `${avgProgress.toFixed(1)}%`;
        if (quickExcellentStudents) quickExcellentStudents.textContent = excellentStudents;
        if (quickNeedAttention) quickNeedAttention.textContent = needAttention;
        
        // 顯示快速統計區
        const quickStats = document.getElementById('quickStats');
        if (quickStats) quickStats.classList.remove('hidden');
    }

    updateSidebarAnalysis() {
        if (!Array.isArray(this.students) || this.students.length === 0) return;
        
        // 更新學生表現排名
        this.updateStudentRanking();
        
        // 更新學習建議
        this.updateLearningSuggestions();
        
        // 更新最近活動
        this.updateRecentActivities();
    }

    updateCharts() {
        if (!Array.isArray(this.students) || this.students.length === 0) return;
        
        this.createClassTrendChart();
        this.createSubjectDistributionChart();
        this.updateClassWeaknessAnalysis();
    }

    createAccuracyChart() {
        const ctx = document.getElementById('accuracyChart');
        if (!ctx) return;
        
        // 安全檢查
        if (!Array.isArray(this.students) || this.students.length === 0) {
            console.warn('⚠️ 無法創建正確率圖表：學生數據不是數組或為空');
            return;
        }
        
        // 銷毀舊圖表
        if (this.charts.accuracyChart) {
            this.charts.accuracyChart.destroy();
        }
        
        const data = {
            labels: this.students.map(s => s.student_name || s.name || '未知'),
            datasets: [{
                label: '正確率 (%)',
                data: this.students.map(s => s.accuracy_rate || s.accuracy || 0),
                backgroundColor: 'rgba(59, 130, 246, 0.8)',
                borderColor: 'rgba(59, 130, 246, 1)',
                borderWidth: 2
            }]
        };
        
        this.charts.accuracyChart = new Chart(ctx, {
            type: 'bar',
            data: data,
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 100
                    }
                }
            }
        });
    }

    createSpeedChart() {
        const ctx = document.getElementById('speedChart');
        if (!ctx) return;
        
        // 安全檢查
        if (!Array.isArray(this.students) || this.students.length === 0) {
            console.warn('⚠️ 無法創建答題速度圖表：學生數據不是數組或為空');
            return;
        }
        
        if (this.charts.speedChart) {
            this.charts.speedChart.destroy();
        }
        
        const data = {
            labels: this.students.map(s => s.student_name || s.name || '未知'),
            datasets: [{
                label: '答題速度 (秒)',
                data: this.students.map(s => s.average_speed || s.speed || 0),
                backgroundColor: 'rgba(16, 185, 129, 0.8)',
                borderColor: 'rgba(16, 185, 129, 1)',
                borderWidth: 2
            }]
        };
        
        this.charts.speedChart = new Chart(ctx, {
            type: 'bar',
            data: data,
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true
                    }
                }
            }
        });
    }

    createSessionsChart() {
        const ctx = document.getElementById('sessionsChart');
        if (!ctx) return;
        
        // 安全檢查
        if (!Array.isArray(this.students) || this.students.length === 0) {
            console.warn('⚠️ 無法創建學習會話圖表：學生數據不是數組或為空');
            return;
        }
        
        if (this.charts.sessionsChart) {
            this.charts.sessionsChart.destroy();
        }
        
        const data = {
            labels: this.students.map(s => s.student_name || s.name || '未知'),
            datasets: [{
                label: '學習會話數',
                data: this.students.map(s => s.total_sessions || s.sessions || 0),
                backgroundColor: 'rgba(245, 158, 11, 0.8)',
                borderColor: 'rgba(245, 158, 11, 1)',
                borderWidth: 2
            }]
        };
        
        this.charts.sessionsChart = new Chart(ctx, {
            type: 'line',
            data: data,
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true
                    }
                }
            }
        });
    }

    createClassTrendChart() {
        const ctx = document.getElementById('classTrendChart');
        if (!ctx) return;
        
        // 安全檢查
        if (!Array.isArray(this.students) || this.students.length === 0) {
            console.warn('⚠️ 無法創建班級趨勢圖表：學生數據不是數組或為空');
            return;
        }
        
        if (this.charts.classTrendChart) {
            this.charts.classTrendChart.destroy();
        }
        
        // 這裡可以根據實際數據創建趨勢圖
        // 暫時使用模擬數據
        const data = {
            labels: ['第1週', '第2週', '第3週', '第4週'],
            datasets: [{
                label: '平均正確率 (%)',
                data: [78, 82, 79, 85],
                borderColor: 'rgba(59, 130, 246, 1)',
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                tension: 0.4
            }, {
                label: '平均答題速度 (秒)',
                data: [45, 42, 40, 38],
                borderColor: 'rgba(16, 185, 129, 1)',
                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                tension: 0.4
            }]
        };
        
        this.charts.classTrendChart = new Chart(ctx, {
            type: 'line',
            data: data,
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'top'
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true
                    }
                }
            }
        });
    }

    createSubjectDistributionChart() {
        const ctx = document.getElementById('subjectDistributionChart');
        if (!ctx) return;
        
        // 安全檢查
        if (!Array.isArray(this.students) || this.students.length === 0) {
            console.warn('⚠️ 無法創建科目分布圖表：學生數據不是數組或為空');
            return;
        }
        
        if (this.charts.subjectDistributionChart) {
            this.charts.subjectDistributionChart.destroy();
        }
        
        // 這裡可以根據實際數據創建科目分布圖
        // 暫時使用模擬數據
        const data = {
            labels: ['數學', '語文', '英語', '科學', '社會'],
            datasets: [{
                label: '平均正確率 (%)',
                data: [82, 78, 75, 80, 85],
                backgroundColor: [
                    'rgba(59, 130, 246, 0.8)',
                    'rgba(16, 185, 129, 0.8)',
                    'rgba(245, 158, 11, 0.8)',
                    'rgba(139, 92, 246, 0.8)',
                    'rgba(239, 68, 68, 0.8)'
                ]
            }]
        };
        
        this.charts.subjectDistributionChart = new Chart(ctx, {
            type: 'bar',
            data: data,
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 100
                    }
                }
            }
        });
    }

    updateClassWeaknessAnalysis() {
        const container = document.getElementById('classWeaknessAnalysis');
        if (!container) return;
        
        if (!Array.isArray(this.students) || this.students.length === 0) {
            container.innerHTML = '<div class="text-gray-500 text-center py-8">暫無數據</div>';
            return;
        }
        
        // 找出需要關注的學生
        const lowAccuracyStudents = this.students.filter(s => (s.accuracy_rate || s.accuracy || 0) < 70);
        const slowStudents = this.students.filter(s => (s.average_speed || s.speed || 0) > 60);
        const inactiveStudents = this.students.filter(s => (s.total_sessions || s.sessions || 0) < 3);
        
        let html = '';
        
        if (lowAccuracyStudents.length > 0) {
            html += '<div class="mb-6 p-4 bg-red-50 rounded-lg border border-red-200">';
            html += '<h4 class="font-medium text-red-800 mb-3 flex items-center"><span class="material-icons mr-2">warning</span>正確率偏低的學生</h4>';
            lowAccuracyStudents.forEach(s => {
                html += `<div class="text-sm text-red-700 mb-2 flex items-center justify-between">`;
                html += `<span>• ${s.student_name || s.name}</span>`;
                html += `<span class="font-medium">${(s.accuracy_rate || s.accuracy || 0).toFixed(1)}%</span>`;
                html += `</div>`;
            });
            html += '</div>';
        }
        
        if (slowStudents.length > 0) {
            html += '<div class="mb-6 p-4 bg-orange-50 rounded-lg border border-orange-200">';
            html += '<h4 class="font-medium text-orange-800 mb-3 flex items-center"><span class="material-icons mr-2">timer</span>答題速度偏慢的學生</h4>';
            slowStudents.forEach(s => {
                html += `<div class="text-sm text-orange-700 mb-2 flex items-center justify-between">`;
                html += `<span>• ${s.student_name || s.name}</span>`;
                html += `<span class="font-medium">${(s.average_speed || s.speed || 0).toFixed(1)}秒/題</span>`;
                html += `</div>`;
            });
            html += '</div>';
        }
        
        if (inactiveStudents.length > 0) {
            html += '<div class="mb-6 p-4 bg-yellow-50 rounded-lg border border-yellow-200">';
            html += '<h4 class="font-medium text-yellow-800 mb-3 flex items-center"><span class="material-icons mr-2">person_off</span>學習活動較少的學生</h4>';
            inactiveStudents.forEach(s => {
                html += `<div class="text-sm text-yellow-700 mb-2 flex items-center justify-between">`;
                html += `<span>• ${s.student_name || s.name}</span>`;
                html += `<span class="font-medium">${s.total_sessions || s.sessions || 0} 會話</span>`;
                html += `</div>`;
            });
            html += '</div>';
        }
        
        if (html === '') {
            html = '<div class="text-green-600 text-center py-8 bg-green-50 p-6 rounded-lg border border-green-200">';
            html += '<span class="material-icons text-4xl text-green-500 mb-2">celebration</span>';
            html += '<p class="font-medium">🎉 所有學生表現良好！</p>';
            html += '<p class="text-sm text-green-600 mt-1">班級整體學習狀況優異</p>';
            html += '</div>';
        }
        
        container.innerHTML = html;
    }

    updateStudentRanking() {
        const container = document.getElementById('studentRanking');
        if (!container) return;
        
        if (!Array.isArray(this.students) || this.students.length === 0) {
            container.innerHTML = '<div class="text-gray-500 text-center py-4">暫無數據</div>';
            return;
        }
        
        // 按正確率排序，取前5名
        const topStudents = [...this.students]
            .sort((a, b) => (b.accuracy_rate || b.accuracy || 0) - (a.accuracy_rate || a.accuracy || 0))
            .slice(0, 5);
        
        let html = '';
        topStudents.forEach((student, index) => {
            const studentName = student.student_name || student.name || '未知學生';
            const accuracy = student.accuracy_rate || student.accuracy || 0;
            const rankIcon = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}`;
            
            html += `
                <div class="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div class="flex items-center space-x-3">
                        <div class="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-sm font-bold">
                            ${rankIcon}
                        </div>
                        <div>
                            <div class="font-medium text-gray-800">${studentName}</div>
                            <div class="text-sm text-gray-500">正確率: ${accuracy.toFixed(1)}%</div>
                        </div>
                    </div>
                </div>
            `;
        });
        
        container.innerHTML = html;
    }

    updateLearningSuggestions() {
        const container = document.getElementById('learningSuggestions');
        if (!container) return;
        
        if (!Array.isArray(this.students) || this.students.length === 0) {
            container.innerHTML = '<div class="text-gray-500 text-center py-4">暫無數據</div>';
            return;
        }
        
        // 分析班級狀況並生成建議
        const suggestions = this.generateLearningSuggestions();
        
        let html = '';
        suggestions.forEach((suggestion, index) => {
            html += `
                <div class="p-3 bg-blue-50 rounded-lg border border-blue-200">
                    <div class="flex items-start space-x-2">
                        <span class="material-icons text-blue-600 text-sm mt-0.5">💡</span>
                        <div class="text-sm text-blue-800">${suggestion}</div>
                    </div>
                </div>
            `;
        });
        
        container.innerHTML = html;
    }

    generateLearningSuggestions() {
        const suggestions = [];
        
        // 計算班級整體狀況
        const totalStudents = this.students.length;
        const avgAccuracy = this.students.reduce((sum, s) => sum + (s.accuracy_rate || s.accuracy || 0), 0) / totalStudents;
        const lowAccuracyCount = this.students.filter(s => (s.accuracy_rate || s.accuracy || 0) < 60).length;
        const inactiveCount = this.students.filter(s => (s.total_sessions || s.sessions || 0) < 3).length;
        
        // 根據數據生成建議
        if (avgAccuracy < 70) {
            suggestions.push('班級整體正確率偏低，建議加強基礎知識鞏固');
        }
        
        if (lowAccuracyCount > totalStudents * 0.3) {
            suggestions.push(`${lowAccuracyCount}名學生需要額外輔導，建議分組教學`);
        }
        
        if (inactiveCount > totalStudents * 0.2) {
            suggestions.push(`${inactiveCount}名學生學習活動較少，建議增加互動練習`);
        }
        
        if (suggestions.length === 0) {
            suggestions.push('班級學習狀況良好，建議保持現有教學節奏');
        }
        
        return suggestions.slice(0, 3); // 最多顯示3個建議
    }

    updateRecentActivities() {
        const container = document.getElementById('recentActivities');
        if (!container) return;
        
        if (!Array.isArray(this.students) || this.students.length === 0) {
            container.innerHTML = '<div class="text-gray-500 text-center py-4">暫無數據</div>';
            return;
        }
        
        // 按最近活動排序
        const sortedStudents = [...this.students].sort((a, b) => {
            const aTime = new Date(a.last_active || 0).getTime();
            const bTime = new Date(b.last_active || 0).getTime();
            return bTime - aTime;
        });
        
        const recentStudents = sortedStudents.slice(0, 5);
        
        let html = '';
        recentStudents.forEach((student, index) => {
            const studentName = student.student_name || student.name || '未知學生';
            const lastActive = student.last_active ? new Date(student.last_active).toLocaleDateString() : '未知';
            const sessions = student.total_sessions || student.sessions || 0;
            const accuracy = student.accuracy_rate || student.accuracy || 0;
            
            html += `
                <div class="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div class="flex items-center space-x-3">
                        <div class="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                            <span class="material-icons text-blue-600 text-sm">person</span>
                        </div>
                        <div>
                            <div class="font-medium text-gray-800">${studentName}</div>
                            <div class="text-sm text-gray-500">${lastActive} • ${accuracy.toFixed(1)}%</div>
                        </div>
                    </div>
                    <div class="text-right">
                        <div class="text-sm font-medium text-gray-800">${sessions} 會話</div>
                    </div>
                </div>
            `;
        });
        
        container.innerHTML = html;
    }

    updatePagination() {
        if (typeof this.totalCount !== 'number' || typeof this.pageSize !== 'number') {
            console.warn('⚠️ 分頁參數無效，跳過分頁更新');
            return;
        }
        
        this.totalPages = Math.ceil(this.totalCount / this.pageSize);
        this.currentPage = Math.min(this.currentPage, this.totalPages);
        
        if (this.totalPages <= 1) {
            const pagination = document.getElementById('pagination');
            if (pagination) {
                pagination.classList.add('hidden');
            }
        } else {
            const pagination = document.getElementById('pagination');
            if (pagination) {
                pagination.classList.remove('hidden');
            }
        }
    }

    switchView(view) {
        console.log('🔄 切換視圖:', view);
        this.currentView = view;
        
        const classOverviewContent = document.getElementById('classOverviewContent');
        const studentListContent = document.getElementById('studentListContent');
        
        if (view === 'overview') {
            if (classOverviewContent) classOverviewContent.classList.remove('hidden');
            if (studentListContent) studentListContent.classList.add('hidden');
        } else if (view === 'list') {
            if (classOverviewContent) classOverviewContent.classList.add('hidden');
            if (studentListContent) studentListContent.classList.remove('hidden');
        }
        
        console.log('✅ 視圖切換完成');
    }

    showClassOverview() {
        console.log('🔄 顯示班級概覽...');
        this.currentView = 'overview';
        
        const classOverviewSection = document.getElementById('classOverviewSection');
        const studentListSection = document.getElementById('studentListSection');
        const studentDetailSection = document.getElementById('studentDetailSection');
        
        if (classOverviewSection) classOverviewSection.classList.remove('hidden');
        if (studentListSection) studentListSection.classList.add('hidden');
        if (studentDetailSection) studentDetailSection.classList.add('hidden');
        
        console.log('✅ 班級概覽已顯示');
    }

    showStudentList() {
        console.log('🔄 顯示學生列表...');
        this.currentView = 'list';
        
        const classOverviewSection = document.getElementById('classOverviewSection');
        const studentListSection = document.getElementById('studentListSection');
        const studentDetailSection = document.getElementById('studentDetailSection');
        
        if (classOverviewSection) classOverviewSection.classList.add('hidden');
        if (studentListSection) studentListSection.classList.remove('hidden');
        if (studentDetailSection) studentDetailSection.classList.add('hidden');
        
        console.log('✅ 學生列表已顯示');
    }

    showStudentDetail(studentId) {
        console.log('🔄 顯示學生詳情:', studentId);
        this.currentView = 'detail';
        this.currentStudentId = studentId;
        
        const classOverviewSection = document.getElementById('classOverviewSection');
        const studentListSection = document.getElementById('studentListSection');
        const studentDetailSection = document.getElementById('studentDetailSection');
        
        if (classOverviewSection) classOverviewSection.classList.add('hidden');
        if (studentListSection) studentListSection.classList.add('hidden');
        if (studentDetailSection) studentDetailSection.classList.remove('hidden');
        
        this.loadStudentDetail(studentId);
        console.log('✅ 學生詳情已顯示');
    }

    toggleStudentView() {
        const studentGridView = document.getElementById('studentGridView');
        const studentListView = document.getElementById('studentListView');
        const viewToggleBtn = document.getElementById('viewToggleBtn');
        
        if (studentGridView && studentListView && viewToggleBtn) {
            if (studentGridView.classList.contains('hidden')) {
                // 切換到網格視圖
                studentGridView.classList.remove('hidden');
                studentListView.classList.add('hidden');
                viewToggleBtn.innerHTML = '<span class="material-icons mr-2">view_list</span>切換視圖';
            } else {
                // 切換到列表視圖
                studentGridView.classList.add('hidden');
                studentListView.classList.remove('hidden');
                viewToggleBtn.innerHTML = '<span class="material-icons mr-2">grid_view</span>切換視圖';
            }
        }
    }

    showContent() {
        const classOverviewContent = document.getElementById('classOverviewContent');
        if (classOverviewContent) {
            classOverviewContent.classList.remove('hidden');
        }
    }

    showNoDataState() {
        const noDataState = document.getElementById('noDataState');
        const classOverviewSection = document.getElementById('classOverviewSection');
        const studentListSection = document.getElementById('studentListSection');
        const studentDetailSection = document.getElementById('studentDetailSection');
        
        if (noDataState) noDataState.classList.remove('hidden');
        if (classOverviewSection) classOverviewSection.classList.add('hidden');
        if (studentListSection) studentListSection.classList.add('hidden');
        if (studentDetailSection) studentDetailSection.classList.add('hidden');
    }

    showLoading() {
        const loadingIndicator = document.getElementById('loadingIndicator');
        if (loadingIndicator) {
            loadingIndicator.classList.remove('hidden');
        }
    }

    hideLoading() {
        const loadingIndicator = document.getElementById('loadingIndicator');
        if (loadingIndicator) {
            loadingIndicator.classList.add('hidden');
        }
    }

    async loadStudentDetail(studentId) {
        try {
            this.showLoading();
            console.log('Loading student detail for ID:', studentId);
            
            // 檢查是否有真實的 API 客戶端
            if (window.realAPIClient && window.realAPIClient.isAuthenticated) {
                console.log('🔗 使用真實 API 獲取學生詳情...');
                const response = await fetch(`/api/v1/teacher/students/${studentId}/profile`, {
                    headers: {
                        'Authorization': `Bearer ${window.realAPIClient.token}`
                    }
                });
                
                if (response.ok) {
                    const studentData = await response.json();
                    console.log('✅ 獲取到學生詳情:', studentData);
                    this.displayStudentDetail(studentData);
                } else {
                    throw new Error(`API 錯誤: ${response.status}`);
                }
            } else {
                throw new Error('API 客戶端未認證或不存在');
            }
        } catch (error) {
            console.error('❌ 載入學生詳情失敗:', error);
            this.showError('載入學生詳情失敗');
        } finally {
            this.hideLoading();
        }
    }

    displayStudentDetail(studentData) {
        console.log('Displaying student detail:', studentData);
        
        // 更新學生基本資訊
        const studentName = document.getElementById('studentDetailName');
        const studentClass = document.getElementById('studentDetailClass');
        
        if (studentName) studentName.textContent = studentData.student_name || studentData.name || '未知學生';
        if (studentClass) studentClass.textContent = studentData.class_name || '未知班級';
        
        // 更新學習指標
        const studentAccuracy = document.getElementById('studentAccuracy');
        const studentSpeed = document.getElementById('studentSpeed');
        const studentSessions = document.getElementById('studentSessions');
        const studentQuestions = document.getElementById('studentQuestions');
        
        if (studentAccuracy) studentAccuracy.textContent = `${(studentData.accuracy_rate || 0).toFixed(1)}%`;
        if (studentSpeed) studentSpeed.textContent = `${(studentData.average_speed || 0).toFixed(1)}`;
        if (studentSessions) studentSessions.textContent = studentData.total_sessions || 0;
        if (studentQuestions) studentQuestions.textContent = studentData.total_questions || 0;
        
        // 創建學生圖表
        this.createStudentCharts(studentData);
        
        // 載入學習記錄
        this.loadStudentLearningRecords(studentData.student_id);
    }

    async loadStudentLearningRecords(studentId) {
        try {
            const response = await fetch(`/api/v1/teacher/students/${studentId}/learning-records`, {
                headers: {
                    'Authorization': `Bearer ${window.realAPIClient.token}`
                }
            });
            
            if (response.ok) {
                const records = await response.json();
                this.displayLearningRecords(records);
            } else {
                console.warn('無法載入學習記錄');
                this.displayLearningRecords([]);
            }
        } catch (error) {
            console.error('載入學習記錄失敗:', error);
            this.displayLearningRecords([]);
        }
    }

    displayLearningRecords(records) {
        const container = document.getElementById('learningRecords');
        if (!container) return;
        
        if (!Array.isArray(records) || records.length === 0) {
            container.innerHTML = `
                <div class="text-gray-500 text-center py-8">
                    <span class="material-icons text-4xl text-gray-300 mb-2">schedule</span>
                    <p>暫無學習記錄</p>
                </div>
            `;
            return;
        }
        
        let html = '';
        records.slice(0, 10).forEach(record => {
            const startTime = new Date(record.start_time).toLocaleDateString();
            const accuracy = record.accuracy_rate || 0;
            const timeSpent = Math.floor((record.time_spent || 0) / 60); // 轉換為分鐘
            
            html += `
                <div class="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div class="flex items-center space-x-4">
                        <div class="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                            <span class="material-icons text-blue-600 text-sm">school</span>
                        </div>
                        <div>
                            <div class="font-medium text-gray-800">${record.session_name || '學習會話'}</div>
                            <div class="text-sm text-gray-500">${record.subject || '未知科目'} - ${record.chapter || '未知章節'}</div>
                        </div>
                    </div>
                    <div class="text-right">
                        <div class="text-sm font-medium text-gray-800">${accuracy.toFixed(1)}% 正確</div>
                        <div class="text-sm text-gray-500">${timeSpent} 分鐘</div>
                        <div class="text-xs text-gray-400">${startTime}</div>
                    </div>
                </div>
            `;
        });
        
        container.innerHTML = html;
    }

    createStudentCharts(studentData) {
        // 創建個人學習趨勢圖
        this.createStudentTrendChart(studentData);
        
        // 創建知識點掌握度圖
        this.createKnowledgePointChart(studentData);
    }

    createStudentTrendChart(studentData) {
        const ctx = document.getElementById('studentTrendChart');
        if (!ctx) return;
        
        if (this.charts.studentTrendChart) {
            this.charts.studentTrendChart.destroy();
        }
        
        // 這裡可以根據實際數據創建趨勢圖
        // 暫時使用模擬數據
        const data = {
            labels: ['第1週', '第2週', '第3週', '第4週'],
            datasets: [{
                label: '正確率 (%)',
                data: [75, 82, 78, 85],
                borderColor: 'rgba(59, 130, 246, 1)',
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                tension: 0.4
            }]
        };
        
        this.charts.studentTrendChart = new Chart(ctx, {
            type: 'line',
            data: data,
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 100
                    }
                }
            }
        });
    }

    createKnowledgePointChart(studentData) {
        const ctx = document.getElementById('knowledgePointChart');
        if (!ctx) return;
        
        if (this.charts.knowledgePointChart) {
            this.charts.knowledgePointChart.destroy();
        }
        
        // 這裡可以根據實際數據創建知識點圖
        // 暫時使用模擬數據
        const data = {
            labels: ['基礎運算', '代數', '幾何', '統計', '概率'],
            datasets: [{
                label: '掌握度 (%)',
                data: [85, 72, 68, 90, 75],
                backgroundColor: [
                    'rgba(59, 130, 246, 0.8)',
                    'rgba(16, 185, 129, 0.8)',
                    'rgba(245, 158, 11, 0.8)',
                    'rgba(139, 92, 246, 0.8)',
                    'rgba(239, 68, 68, 0.8)'
                ]
            }]
        };
        
        this.charts.knowledgePointChart = new Chart(ctx, {
            type: 'radar',
            data: data,
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    r: {
                        beginAtZero: true,
                        max: 100
                    }
                }
            }
        });
    }

    showError(message) {
        const errorState = document.getElementById('errorState');
        const errorMessage = document.getElementById('errorMessage');
        
        if (errorState) errorState.classList.remove('hidden');
        if (errorMessage) errorMessage.textContent = message;
        
        // 隱藏其他內容
        const classOverviewSection = document.getElementById('classOverviewSection');
        const studentListSection = document.getElementById('studentListSection');
        const studentDetailSection = document.getElementById('studentDetailSection');
        const noDataState = document.getElementById('noDataState');
        
        if (classOverviewSection) classOverviewSection.classList.add('hidden');
        if (studentListSection) studentListSection.classList.add('hidden');
        if (studentDetailSection) studentDetailSection.classList.add('hidden');
        if (noDataState) noDataState.classList.add('hidden');
    }
}

// 導出類別
if (typeof module !== 'undefined' && module.exports) {
    module.exports = StudentsAnalysisManager;
}

