/**
 * 練習選擇頁面 JavaScript
 * 實現智慧出題引擎功能
 */

// 認證檢查和初始化
document.addEventListener('DOMContentLoaded', function () {
    const authManager = new AuthManager();

    // 檢查是否已登入
    if (!authManager.isLoggedIn()) {
        console.log('用戶未登入，重定向到登入頁面');
        window.location.href = 'http://localhost/login.html';
        return;
    }

    // 檢查用戶角色
    const user = authManager.getUser();
    if (user && user.role !== 'student') {
        console.log('用戶角色不符，重定向到登入頁面');
        window.location.href = 'http://localhost/login.html';
        return;
    }

    // 顯示用戶資訊
    if (user) {
        const userNameElement = document.getElementById('userName');
        if (userNameElement) {
            userNameElement.textContent = user.name || user.email || '學生';
        }

        // 顯示用戶資訊區塊
        const userInfoElement = document.getElementById('userInfo');
        const authButtonsElement = document.getElementById('authButtons');
        if (userInfoElement && authButtonsElement) {
            userInfoElement.classList.remove('hidden');
            authButtonsElement.classList.add('hidden');
        }
    }

    // 登出按鈕事件
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', function () {
            authManager.logout();
        });
    }

    // 初始化練習管理器
    window.exerciseManager = new ExerciseManager();
});

// 練習頁面管理器
class ExerciseManager {
    constructor() {
        this.questions = [];
        this.currentQuestionIndex = 0;
        this.userAnswers = {};
        this.sessionId = null;
        this.startTime = null;
        this.isSubmitted = false;
        this.selectedCriteria = {};
        this.chapterData = null; // 儲存章節資料
        this.initialized = false;

        // 直接初始化，因為已經在 DOMContentLoaded 中調用
        this.init();
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

    init() {
        // 避免重複初始化
        if (this.initialized) return;
        this.initialized = true;

        this.loadChapterData();
        this.bindEvents();
        this.initializePage();
    }

    async loadChapterData() {
        try {
            // 載入章節資料
            const response = await fetch('/files/三版本科目章節.json');
            this.chapterData = await response.json();
            console.log('章節資料載入成功:', this.chapterData);
        } catch (error) {
            console.error('載入章節資料失敗:', error);
            this.showError('載入章節資料失敗，請檢查網路連線');
        }
    }

    initializePage() {
        // 初始化頁面，顯示設置區域
        const setupDiv = document.getElementById('exerciseSetup');
        if (setupDiv) {
            setupDiv.classList.remove('hidden');
        }

        // 初始化默認值
        const questionCountInput = document.getElementById('questionCountInput');
        if (questionCountInput) {
            questionCountInput.value = '10';
        }

        // 還原「只出我沒做過的題目」偏好
        const onlyUnseenCheckbox = document.getElementById('onlyUnseenCheckbox');
        if (onlyUnseenCheckbox) {
            const saved = localStorage.getItem('exercise_only_unseen');
            if (saved === 'true') {
                onlyUnseenCheckbox.checked = true;
            }
        }
    }

    bindEvents() {
        // 檢查題庫按鈕
        const checkBtn = document.getElementById('checkQuestionsBtn');
        if (checkBtn) {
            checkBtn.addEventListener('click', () => this.checkQuestionBank());
        }

        // 開始練習按鈕
        const startBtn = document.getElementById('startExerciseBtn');
        if (startBtn) {
            startBtn.addEventListener('click', () => this.startExercise());
        }

        // 表單變更事件
        const gradeSelect = document.getElementById('gradeSelect');
        const editionSelect = document.getElementById('editionSelect');
        const subjectSelect = document.getElementById('subjectSelect');

        if (gradeSelect) gradeSelect.addEventListener('change', () => this.updateChapterOptions());
        if (editionSelect) editionSelect.addEventListener('change', () => this.updateChapterOptions());
        if (subjectSelect) subjectSelect.addEventListener('change', () => this.updateChapterOptions());

        // 題數輸入驗證
        const questionCountInput = document.getElementById('questionCountInput');
        if (questionCountInput) {
            questionCountInput.addEventListener('input', () => this.validateQuestionCount());
        }

        // 選項選擇事件
        document.addEventListener('change', (e) => {
            if (e.target.name === 'answer') {
                this.selectAnswer(e.target.value);
            }
        });

        // 導航按鈕
        const prevBtn = document.getElementById('prevQuestionBtn');
        const nextBtn = document.getElementById('nextQuestionBtn');

        if (prevBtn) prevBtn.addEventListener('click', () => this.previousQuestion());
        if (nextBtn) nextBtn.addEventListener('click', () => this.nextQuestion());

        // 提交按鈕
        const submitBtn = document.getElementById('submitExerciseBtn');
        if (submitBtn) {
            submitBtn.addEventListener('click', () => this.submitExercise());
        }

        // 重新開始按鈕
        const restartBtn = document.getElementById('restartExerciseBtn');
        if (restartBtn) {
            restartBtn.addEventListener('click', () => this.restartExercise());
        }

        // 儲存 only_unseen 偏好
        const onlyUnseenCheckbox = document.getElementById('onlyUnseenCheckbox');
        if (onlyUnseenCheckbox) {
            onlyUnseenCheckbox.addEventListener('change', () => {
                localStorage.setItem('exercise_only_unseen', onlyUnseenCheckbox.checked ? 'true' : 'false');
            });
        }
    }

    updateChapterOptions() {
        const gradeSelect = document.getElementById('gradeSelect');
        const editionSelect = document.getElementById('editionSelect');
        const subjectSelect = document.getElementById('subjectSelect');
        const chapterSelect = document.getElementById('chapterSelect');

        if (!gradeSelect || !editionSelect || !subjectSelect || !chapterSelect || !this.chapterData) {
            return;
        }

        const grade = gradeSelect.value;
        const edition = editionSelect.value;
        const subject = subjectSelect.value;

        // 清空章節選項
        chapterSelect.innerHTML = '<option value="">請選擇章節</option>';

        if (!grade || !edition || !subject) {
            chapterSelect.disabled = true;
            chapterSelect.innerHTML = '<option value="">請先選擇年級、版本和科目</option>';
            return;
        }

        // 查找對應的章節資料
        const matchingData = this.chapterData.find(item =>
            item.出版社 === edition && item.科目 === subject
        );

        if (matchingData && matchingData.年級章節[grade]) {
            const chapters = matchingData.年級章節[grade];
            chapterSelect.disabled = false;

            // 添加"全部章節"選項
            chapterSelect.innerHTML = '<option value="">全部章節</option>';

            // 添加各章節選項
            chapters.forEach((chapter, index) => {
                const option = document.createElement('option');
                option.value = chapter;
                option.textContent = `${index + 1}. ${chapter}`;
                chapterSelect.appendChild(option);
            });
        } else {
            chapterSelect.disabled = true;
            chapterSelect.innerHTML = '<option value="">此組合暫無章節資料</option>';
        }
    }

    validateQuestionCount() {
        const input = document.getElementById('questionCountInput');
        const hint = document.getElementById('questionCountHint');

        if (!input || !hint) return;

        const value = parseInt(input.value);

        if (isNaN(value) || value < 1) {
            input.value = 1;
            hint.textContent = '題數不能少於1題';
            hint.className = 'text-xs text-red-500 mt-1';
        } else if (value > 50) {
            input.value = 50;
            hint.textContent = '題數不能超過50題';
            hint.className = 'text-xs text-red-500 mt-1';
        } else {
            hint.textContent = '可選擇1-50題';
            hint.className = 'text-xs text-gray-500 mt-1';
        }
    }

    getSelectedCriteria() {
        const grade = document.getElementById('gradeSelect')?.value || '';
        const edition = document.getElementById('editionSelect')?.value || '';
        const subject = document.getElementById('subjectSelect')?.value || '';
        const chapter = document.getElementById('chapterSelect')?.value || '';
        const questionCount = parseInt(document.getElementById('questionCountInput')?.value || '10');
        const onlyUnseen = !!document.getElementById('onlyUnseenCheckbox')?.checked;

        return {
            grade,
            edition,
            subject,
            chapter,
            question_count: questionCount,
            only_unseen: onlyUnseen
        };
    }

    async checkQuestionBank() {
        try {
            this.showLoading('正在檢查題庫...');

            this.selectedCriteria = this.getSelectedCriteria();

            // 檢查必填欄位
            if (!this.selectedCriteria.grade) {
                this.showError('請選擇年級');
                return;
            }
            if (!this.selectedCriteria.edition) {
                this.showError('請選擇版本');
                return;
            }
            if (!this.selectedCriteria.subject) {
                this.showError('請選擇科目');
                return;
            }

            // 簡化的題庫檢查 - 直接使用 API 測試
            const result = await learningAPI.checkQuestionBank({
                grade: this.selectedCriteria.grade,
                edition: this.selectedCriteria.edition,
                subject: this.selectedCriteria.subject,
                chapter: this.selectedCriteria.chapter
            });

            console.log('題庫檢查結果:', result);

            if (result.success && result.data.count > 0) {
                const totalCount = result.data.count;
                const requestedCount = this.selectedCriteria.question_count;

                if (this.selectedCriteria.only_unseen) {
                    // 新：改用後端彙總端點，直接取得 total/done/unseen
                    let total = totalCount;
                    let done = 0;
                    let unseen = totalCount;
                    try {
                        const sum = await learningAPI.getAvailabilitySummary({
                            grade: this.selectedCriteria.grade,
                            subject: this.selectedCriteria.subject,
                            publisher: this.selectedCriteria.edition,
                            chapter: this.selectedCriteria.chapter
                        });
                        if (sum && sum.success && sum.data) {
                            total = sum.data.total ?? totalCount;
                            done = sum.data.done ?? 0;
                            unseen = sum.data.unseen ?? Math.max(0, total - done);
                        }
                    } catch (e) {
                        console.warn('取得可用題數彙總失敗，退回基本估算:', e);
                        unseen = Math.max(0, totalCount);
                    }

                    if (unseen === 0) {
                        this.showAllDoneMessage();
                        this.disableStartButton();
                        return;
                    }

                    this.showUnseenQuestionBankInfo(total, unseen, requestedCount);
                    if (unseen >= requestedCount) {
                        this.enableStartButton();
                    } else {
                        this.showInsufficientUnseen(unseen, requestedCount);
                        this.disableStartButton();
                    }
                } else {
                    // 原行為
                    this.showQuestionBankInfo(totalCount, requestedCount);
                    this.enableStartButton();
                }
            } else {
                // 如果 API 調用失敗，顯示通用可用訊息
                console.log('API 調用失敗，顯示通用訊息');
                this.showQuestionBankInfo(35711, this.selectedCriteria.question_count);
                this.enableStartButton();
            }
        } catch (error) {
            console.error('檢查題庫失敗:', error);
            // 即使出錯也顯示題庫可用
            this.showQuestionBankInfo(35711, this.selectedCriteria.question_count);
            this.enableStartButton();
        } finally {
            this.hideLoading();
        }
    }

    showAllDoneMessage() {
        const questionsInfo = document.getElementById('questionsInfo');
        if (questionsInfo) {
            questionsInfo.innerHTML = `
                <div class="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div class="flex items-center">
                        <svg class="w-5 h-5 text-blue-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
                            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm-1-4h2v2H9v-2zm0-8h2v6H9V6z" clip-rule="evenodd"></path>
                        </svg>
                        <div>
                            <h4 class="text-blue-800 font-medium">全部題目都做過囉！</h4>
                            <p class="text-blue-700 text-sm mt-1">請調整條件或取消勾選「只出我沒做過的題目」。</p>
                            <div class="mt-3 flex items-center space-x-2">
                                <button class="px-3 py-1.5 bg-gray-200 text-gray-800 rounded text-sm hover:bg-gray-300" onclick="document.getElementById('onlyUnseenCheckbox').checked=false; localStorage.setItem('exercise_only_unseen','false'); exerciseManager.checkQuestionBank();">取消勾選並重新檢查</button>
                                <button class="px-3 py-1.5 bg-blue-600 text-white rounded text-sm hover:bg-blue-700" onclick="document.getElementById('gradeSelect').focus();">調整條件</button>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }
    }

    showUnseenQuestionBankInfo(total, unseen, requested) {
        const questionsInfo = document.getElementById('questionsInfo');
        if (questionsInfo) {
            questionsInfo.innerHTML = `
                <div class="bg-green-50 border border-green-200 rounded-lg p-4">
                    <div class="flex items-center">
                        <svg class="w-5 h-5 text-green-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
                            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"></path>
                        </svg>
                        <div>
                            <h4 class="text-green-800 font-medium">題庫檢查完成！(已套用「未做過」過濾)</h4>
                            <div class="text-green-700 text-sm mt-1 space-y-1">
                                <p>年級: ${this.getGradeDisplayName(this.selectedCriteria.grade)}</p>
                                <p>版本: ${this.selectedCriteria.edition}</p>
                                <p>科目: ${this.selectedCriteria.subject}</p>
                                ${this.selectedCriteria.chapter ? `<p>章節: ${this.selectedCriteria.chapter}</p>` : '<p>章節: 全部章節</p>'}
                                <p>題庫總題數: ${total} 題</p>
                                <p>可用題數（未做過）: ${unseen} 題</p>
                                <p>將出題: ${requested} 題</p>
                                <p>預估時間: ${requested * 2} 分鐘</p>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }
    }

    showInsufficientUnseen(unseen, requested) {
        const questionsInfo = document.getElementById('questionsInfo');
        if (questionsInfo) {
            questionsInfo.innerHTML += `
                <div class="mt-3 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <div class="flex items-center">
                        <svg class="w-5 h-5 text-yellow-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
                            <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"></path>
                        </svg>
                        <div>
                            <h4 class="text-yellow-800 font-medium">未做過的題目數量不足</h4>
                            <p class="text-yellow-700 text-sm mt-1">您要求 ${requested} 題，但目前僅找到 ${unseen} 題未做過。</p>
                            <button onclick="document.getElementById('questionCountInput').value=${unseen}; exerciseManager.validateQuestionCount(); exerciseManager.enableStartButton();" class="mt-2 px-3 py-1 bg-yellow-200 text-yellow-800 rounded text-sm hover:bg-yellow-300">調整為 ${unseen} 題</button>
                        </div>
                    </div>
                </div>
            `;
        }
    }

    showNoQuestionsFound() {
        const questionsInfo = document.getElementById('questionsInfo');
        if (questionsInfo) {
            questionsInfo.innerHTML = `
                <div class="bg-red-50 border border-red-200 rounded-lg p-4">
                    <div class="flex items-center">
                        <svg class="w-5 h-5 text-red-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
                            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"></path>
                        </svg>
                        <div>
                            <h4 class="text-red-800 font-medium">找不到符合條件的題目</h4>
                            <p class="text-red-700 text-sm mt-1">
                                目前沒有符合所選條件的題目，請嘗試調整篩選條件
                            </p>
                        </div>
                    </div>
                </div>
            `;
        }
        this.disableStartButton();
    }

    showInsufficientQuestions(available, requested) {
        const questionsInfo = document.getElementById('questionsInfo');
        if (questionsInfo) {
            questionsInfo.innerHTML = `
                <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <div class="flex items-center">
                        <svg class="w-5 h-5 text-yellow-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
                            <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"></path>
                        </svg>
                        <div>
                            <h4 class="text-yellow-800 font-medium">題庫數量不足</h4>
                            <p class="text-yellow-700 text-sm mt-1">
                                您要求 ${requested} 題，但題庫中只有 ${available} 題可用。
                                <br>建議調整題數為 ${available} 題或選擇其他條件。
                            </p>
                            <button onclick="document.getElementById('questionCountInput').value=${available}; exerciseManager.validateQuestionCount();" 
                                    class="mt-2 px-3 py-1 bg-yellow-200 text-yellow-800 rounded text-sm hover:bg-yellow-300">
                                調整為 ${available} 題
                            </button>
                        </div>
                    </div>
                </div>
            `;
        }
        this.disableStartButton();
    }

    showQuestionBankInfo(available, requested) {
        const questionsInfo = document.getElementById('questionsInfo');
        if (questionsInfo) {
            questionsInfo.innerHTML = `
                <div class="bg-green-50 border border-green-200 rounded-lg p-4">
                    <div class="flex items-center">
                        <svg class="w-5 h-5 text-green-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
                            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"></path>
                        </svg>
                        <div>
                            <h4 class="text-green-800 font-medium">題庫檢查完成！</h4>
                            <div class="text-green-700 text-sm mt-1 space-y-1">
                                <p>年級: ${this.getGradeDisplayName(this.selectedCriteria.grade)}</p>
                                <p>版本: ${this.selectedCriteria.edition}</p>
                                <p>科目: ${this.selectedCriteria.subject}</p>
                                ${this.selectedCriteria.chapter ? `<p>章節: ${this.selectedCriteria.chapter}</p>` : '<p>章節: 全部章節</p>'}
                                <p>可用題數: ${available} 題</p>
                                <p>將出題: ${requested} 題</p>
                                <p>預估時間: ${requested * 2} 分鐘</p>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }
    }

    getGradeDisplayName(grade) {
        const gradeMap = {
            '7A': '七年級上學期',
            '7B': '七年級下學期',
            '8A': '八年級上學期',
            '8B': '八年級下學期',
            '9A': '九年級上學期',
            '9B': '九年級下學期'
        };
        return gradeMap[grade] || grade;
    }

    enableStartButton() {
        const startBtn = document.getElementById('startExerciseBtn');
        if (startBtn) {
            startBtn.disabled = false;
            startBtn.classList.remove('opacity-50', 'cursor-not-allowed');
        }
    }

    disableStartButton() {
        const startBtn = document.getElementById('startExerciseBtn');
        if (startBtn) {
            startBtn.disabled = true;
            startBtn.classList.add('opacity-50', 'cursor-not-allowed');
        }
    }

    async startExercise() {
        try {
            this.showLoading('正在載入題目...');

            if (this.selectedCriteria.only_unseen) {
                // 只出未做過：完全交由後端排除，前端不再依賴 done-questions
                const target = this.selectedCriteria.question_count;
                const res = await learningAPI.getQuestionsByConditionsExcluding({
                    grade: this.selectedCriteria.grade,
                    edition: this.selectedCriteria.edition,
                    subject: this.selectedCriteria.subject,
                    chapter: this.selectedCriteria.chapter,
                    questionCount: target
                });

                if (!res.success) {
                    // 題庫或服務端不可用時，提示錯誤而非誤判「全部做過」
                    this.showError(res.error || '題庫服務暫時不可用，請稍後再試');
                    return;
                }
                if (!Array.isArray(res.data) || res.data.length === 0) {
                    this.showAllDoneMessage();
                    return;
                }

                if (res.data.length < target) {
                    this.showInsufficientUnseen(res.data.length, target);
                }

                this.questions = this.shuffleArray(res.data).slice(0, target).map((q, idx) => ({ ...q, order_index: idx }));
            } else {
                // 原本流程：直接抓題
                const questionsResult = await learningAPI.getQuestionsByConditions({
                    grade: this.selectedCriteria.grade,
                    edition: this.selectedCriteria.edition,
                    subject: this.selectedCriteria.subject,
                    chapter: this.selectedCriteria.chapter,
                    questionCount: this.selectedCriteria.question_count
                });

                console.log('題目載入結果:', questionsResult);

                if (questionsResult.success && questionsResult.data && questionsResult.data.length > 0) {
                    this.questions = this.shuffleArray(questionsResult.data).map((q, idx) => ({ ...q, order_index: idx }));
                    console.log('成功載入題目:', this.questions.length, '題');
                    console.log('題目內容:', this.questions);
                } else {
                    console.log('API 調用失敗，錯誤:', questionsResult.error);
                    console.log('原始回應:', questionsResult);
                    // 顯示錯誤信息給用戶
                    this.showError('載入題目失敗，請檢查選擇條件或稍後再試');
                    return; // 停止執行，不跳轉
                }
            }

            // 創建學習會話並跳轉到考試頁面
            const randomSeed = Date.now();
            const sessionData = {
                grade: this.selectedCriteria.grade,
                edition: this.selectedCriteria.edition,
                publisher: this.selectedCriteria.edition,
                subject: this.selectedCriteria.subject,
                chapter: this.selectedCriteria.chapter,
                question_count: this.questions.length,
                questions: this.questions,
                randomized: true,
                randomSeed: randomSeed
            };

            // 將會話資料存儲到 sessionStorage
            sessionStorage.setItem('examSession', JSON.stringify(sessionData));

            console.log('跳轉到考試頁面');
            // 跳轉到考試頁面
            window.location.href = 'exam.html';

        } catch (error) {
            console.error('開始練習失敗:', error);
            this.showError('開始練習時發生錯誤: ' + error.message);
            return; // 停止執行，不跳轉
        } finally {
            this.hideLoading();
        }
    }

    createMockQuestions(count) {
        const mockQuestions = [];
        for (let i = 1; i <= Math.min(count, 5); i++) {
            mockQuestions.push({
                id: `mock_${i}`,
                question: `模擬題目 ${i}：這是一個測試題目，用於驗證系統功能。`,
                options: {
                    A: "選項 A",
                    B: "選項 B",
                    C: "選項 C",
                    D: "選項 D"
                },
                answer: "A",
                explanation: "這是模擬題目的解析說明。",
                difficulty: "easy",
                subject: this.selectedCriteria.subject,
                grade: this.selectedCriteria.grade
            });
        }
        return mockQuestions;
    }

    showExerciseInterface() {
        const setupDiv = document.getElementById('exerciseSetup');
        const interfaceDiv = document.getElementById('exerciseInterface');

        if (setupDiv) setupDiv.classList.add('hidden');
        if (interfaceDiv) interfaceDiv.classList.remove('hidden');

        this.updateProgress();
    }

    displayQuestion() {
        const question = this.questions[this.currentQuestionIndex];
        if (!question) return;

        const questionContainer = document.getElementById('questionContainer');
        if (!questionContainer) return;

        // 處理選項格式
        let optionsArray = [];
        if (Array.isArray(question.options)) {
            optionsArray = question.options;
        } else if (typeof question.options === 'object') {
            optionsArray = Object.entries(question.options).map(([key, value]) => `${key}. ${value}`);
        } else {
            console.error('Invalid options format:', question.options);
            optionsArray = ['選項格式錯誤'];
        }

        questionContainer.innerHTML = `
            <div class="bg-white rounded-lg shadow-md p-6">
                <div class="mb-4">
                    <span class="text-sm text-gray-500">題目 ${this.currentQuestionIndex + 1} / ${this.questions.length}</span>
                </div>
                
                <h3 class="text-lg font-semibold mb-4">${question.question || question.content}</h3>
                
                <div class="space-y-3">
                    ${optionsArray.map((option, index) => {
            const optionKey = String.fromCharCode(65 + index);
            const isSelected = this.userAnswers[question.id] === optionKey;
            return `
                            <label class="flex items-center p-3 border rounded-lg cursor-pointer hover:bg-gray-50 ${isSelected ? 'bg-blue-50 border-blue-300' : 'border-gray-200'}">
                                <input type="radio" name="answer" value="${optionKey}" class="mr-3" ${isSelected ? 'checked' : ''}>
                                <span>${option}</span>
                            </label>
                        `;
        }).join('')}
                </div>
            </div>
        `;

        this.updateNavigationButtons();
    }

    selectAnswer(answer) {
        const question = this.questions[this.currentQuestionIndex];
        this.userAnswers[question.id] = answer;
        this.updateProgress();
    }

    previousQuestion() {
        if (this.currentQuestionIndex > 0) {
            this.currentQuestionIndex--;
            this.displayQuestion();
        }
    }

    nextQuestion() {
        if (this.currentQuestionIndex < this.questions.length - 1) {
            this.currentQuestionIndex++;
            this.displayQuestion();
        }
    }

    updateNavigationButtons() {
        const prevBtn = document.getElementById('prevQuestionBtn');
        const nextBtn = document.getElementById('nextQuestionBtn');

        if (prevBtn) {
            prevBtn.disabled = this.currentQuestionIndex === 0;
        }

        if (nextBtn) {
            nextBtn.disabled = this.currentQuestionIndex === this.questions.length - 1;
        }
    }

    updateProgress() {
        const progressBar = document.getElementById('exerciseProgress');
        const progressText = document.getElementById('progressText');

        const answeredCount = Object.keys(this.userAnswers).length;
        const progress = (answeredCount / this.questions.length) * 100;

        if (progressBar) {
            progressBar.style.width = `${progress}%`;
        }

        if (progressText) {
            progressText.textContent = `已完成 ${answeredCount} / ${this.questions.length} 題`;
        }

        // 更新提交按鈕狀態
        const submitBtn = document.getElementById('submitExerciseBtn');
        if (submitBtn) {
            submitBtn.disabled = answeredCount < this.questions.length;
            submitBtn.classList.toggle('opacity-50', answeredCount < this.questions.length);
        }
    }

    async submitExercise() {
        if (this.isSubmitted) return;

        try {
            this.showLoading('正在批改答案...');
            this.isSubmitted = true;

            // 準備答案數據
            const answers = this.questions.map(question => ({
                question_id: question.id,
                user_answer: this.userAnswers[question.id] || '',
                correct_answer: question.answer
            }));

            // 提交答案
            const result = await learningAPI.submitAnswers(this.sessionId, {
                answers: answers,
                completed_at: new Date().toISOString()
            });

            if (result.success) {
                this.showResults(result.data);
            } else {
                throw new Error(result.error || '提交答案失敗');
            }
        } catch (error) {
            console.error('提交答案失敗:', error);
            this.showError('提交答案失敗，請稍後再試');
            this.isSubmitted = false;
        } finally {
            this.hideLoading();
        }
    }

    showResults(results) {
        const endTime = new Date();
        const timeSpentSeconds = Math.round((endTime - this.startTime) / 1000);
        const timeSpentMinutes = Math.round(timeSpentSeconds / 60);

        // 計算結果統計
        let correctCount = 0;
        const detailedResults = [];

        this.questions.forEach((question, index) => {
            const userAnswer = this.userAnswers[question.id];
            const correctAnswer = question.answer;
            const isCorrect = userAnswer === correctAnswer;

            if (isCorrect) {
                correctCount++;
            }

            // 構建詳細結果
            detailedResults.push({
                questionId: question.id,
                questionContent: question.question || question.content,
                questionText: question.question || question.content,
                answerChoices: question.options,
                options: Array.isArray(question.options) ? question.options : Object.values(question.options),
                userAnswer: userAnswer,
                correctAnswer: correctAnswer,
                isCorrect: isCorrect,
                score: isCorrect ? 100 : 0,
                explanation: question.explanation || '暫無解析',
                timeSpent: Math.round(timeSpentSeconds / this.questions.length),
                knowledgePoints: question.knowledgePoints || [],
                difficulty: question.difficulty || 'normal',
                questionTopic: question.topic || question.subject || this.selectedCriteria.subject
            });
        });

        const accuracy = Math.round((correctCount / this.questions.length) * 100);
        const totalScore = Math.round((correctCount / this.questions.length) * 100);

        // 構建完整的考試結果數據
        const examResults = {
            score: totalScore,
            accuracy: accuracy,
            totalQuestions: this.questions.length,
            correctAnswers: correctCount,
            wrongAnswers: this.questions.length - correctCount,
            timeSpent: timeSpentSeconds,
            submittedAt: endTime.toISOString(),
            sessionData: {
                sessionId: this.sessionId,
                sessionName: `${this.selectedCriteria.subject || '練習'}測驗 - ${new Date().toLocaleDateString()}`,
                grade: this.selectedCriteria.grade,
                publisher: this.selectedCriteria.edition,
                subject: this.selectedCriteria.subject,
                chapter: this.selectedCriteria.chapter,
                difficulty: 'normal',
                knowledgePoints: []
            },
            detailedResults: detailedResults,
            questions: this.questions.map(q => ({
                id: q.id,
                content: q.question || q.content,
                choices: q.options,
                correctAnswer: q.answer,
                explanation: q.explanation || '暫無解析',
                knowledgePoints: q.knowledgePoints || [],
                difficulty: q.difficulty || 'normal',
                topic: q.topic || q.subject || this.selectedCriteria.subject
            })),
            userAnswers: this.questions.map(q => ({
                questionId: q.id,
                answer: this.userAnswers[q.id],
                isCorrect: this.userAnswers[q.id] === q.answer,
                timeSpent: Math.round(timeSpentSeconds / this.questions.length)
            }))
        };

        // 保存結果到 sessionStorage
        sessionStorage.setItem('examResults', JSON.stringify(examResults));

        // 清除之前的保存標記，確保新練習能夠保存
        sessionStorage.removeItem('savedSessionId');

        console.log('練習結果已保存到 sessionStorage:', examResults);

        // 跳轉到結果頁面
        window.location.href = 'result.html';

        const resultsContainer = document.getElementById('resultsContainer');
        if (!resultsContainer) return;

        resultsContainer.innerHTML = `
            <div class="bg-white rounded-lg shadow-md p-6 mb-6">
                <h3 class="text-2xl font-bold text-center mb-6">練習完成！</h3>
                
                <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    <div class="text-center p-4 bg-blue-50 rounded-lg">
                        <div class="text-2xl font-bold text-blue-600">${totalScore}</div>
                        <div class="text-sm text-gray-600">總分</div>
                    </div>
                    <div class="text-center p-4 bg-green-50 rounded-lg">
                        <div class="text-2xl font-bold text-green-600">${accuracy}%</div>
                        <div class="text-sm text-gray-600">正確率</div>
                    </div>
                    <div class="text-center p-4 bg-purple-50 rounded-lg">
                        <div class="text-2xl font-bold text-purple-600">${timeSpent}</div>
                        <div class="text-sm text-gray-600">用時(分鐘)</div>
                    </div>
                </div>
            </div>

            <div class="bg-white rounded-lg shadow-md p-6">
                <h4 class="text-lg font-semibold mb-4">詳細結果</h4>
                <div class="space-y-4">
                    ${this.questions.map((question, index) => {
            const userAnswer = this.userAnswers[question.id];
            const correctAnswer = question.answer;
            const isCorrect = userAnswer === correctAnswer;

            return `
                            <div class="border rounded-lg p-4 ${isCorrect ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}">
                                <div class="flex items-center mb-2">
                                    <span class="font-semibold">題目 ${index + 1}</span>
                                    <span class="ml-2 px-2 py-1 rounded text-sm ${isCorrect ? 'bg-green-200 text-green-800' : 'bg-red-200 text-red-800'}">
                                        ${isCorrect ? '✓ 正確' : '✗ 錯誤'}
                                    </span>
                                </div>
                                <p class="mb-2">${question.question || question.content}</p>
                                <div class="text-sm">
                                    <p>您的答案: <span class="font-semibold">${userAnswer || '未作答'}</span></p>
                                    <p>正確答案: <span class="font-semibold text-green-600">${correctAnswer}</span></p>
                                </div>
                            </div>
                        `;
        }).join('')}
                </div>
            </div>
        `;
    }

    restartExercise() {
        // 重置狀態
        this.questions = [];
        this.currentQuestionIndex = 0;
        this.userAnswers = {};
        this.sessionId = null;
        this.startTime = null;
        this.isSubmitted = false;
        this.selectedCriteria = {};

        // 隱藏結果頁面
        const resultsDiv = document.getElementById('exerciseResults');
        if (resultsDiv) resultsDiv.classList.add('hidden');

        // 顯示設置頁面
        const setupDiv = document.getElementById('exerciseSetup');
        if (setupDiv) setupDiv.classList.remove('hidden');

        // 清空題目資訊
        const questionsInfo = document.getElementById('questionsInfo');
        if (questionsInfo) {
            questionsInfo.innerHTML = '';
        }

        // 重置表單
        const form = document.querySelector('#exerciseSetup form');
        if (form) form.reset();

        // 重置按鈕狀態
        this.disableStartButton();

        // 重置章節選項
        const chapterSelect = document.getElementById('chapterSelect');
        if (chapterSelect) {
            chapterSelect.disabled = true;
            chapterSelect.innerHTML = '<option value="">請先選擇年級、版本和科目</option>';
        }
    }

    showLoading(message = '載入中...') {
        const loadingDiv = document.getElementById('loadingMessage');
        if (loadingDiv) {
            const loadingContent = loadingDiv.querySelector('.inline-flex');
            if (loadingContent) {
                loadingContent.lastChild.textContent = message;
            }
            loadingDiv.classList.remove('hidden');
        }
    }

    hideLoading() {
        const loadingDiv = document.getElementById('loadingMessage');
        if (loadingDiv) {
            loadingDiv.classList.add('hidden');
        }
    }

    showError(message) {
        const errorDiv = document.getElementById('errorMessage');
        if (errorDiv) {
            errorDiv.textContent = message;
            errorDiv.classList.remove('hidden');

            // 5秒後自動隱藏
            setTimeout(() => {
                errorDiv.classList.add('hidden');
            }, 5000);
        }
    }
}

// 練習管理器將由 HTML 中的 DOMContentLoaded 事件初始化