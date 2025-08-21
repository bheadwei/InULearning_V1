/**
 * 考試結果頁面管理
 */
class ResultPage {
    constructor() {
        this.examResults = null;
        this.currentDetailIndex = 0;
        this.isHistoryMode = false; // 是否從歷程記錄進入
        this.sessionId = null; // 會話ID
    }

    /**
     * 初始化頁面
     */
    async init() {
        try {
            // 檢查是否從歷程記錄進入
            this.checkHistoryMode();

            // 載入考試結果（從 sessionStorage 或 API）
            await this.loadExamResults();

            // 檢查認證狀態
            this.checkAuthStatus();

            // 顯示結果
            this.displayResults();

            // 綁定事件
            this.bindEvents();

            // 只有新練習才需要保存到數據庫
            if (!this.isHistoryMode) {
                await this.saveResultsToDatabase();
            }

        } catch (error) {
            console.error('初始化結果頁面失敗:', error);
            this.showError('載入結果失敗，請重新進入');
        }
    }

    /**
     * 檢查是否從歷程記錄進入
     */
    checkHistoryMode() {
        const urlParams = new URLSearchParams(window.location.search);
        this.sessionId = urlParams.get('sessionId');
        this.isHistoryMode = !!this.sessionId;

        console.log('歷程模式:', this.isHistoryMode, '會話ID:', this.sessionId);
    }

    /**
     * 載入考試結果
     */
    async loadExamResults() {
        if (this.isHistoryMode && this.sessionId) {
            // 從歷程記錄進入，從 API 載入數據
            await this.loadHistoricalResults();
        } else {
            // 從練習頁面進入，從 sessionStorage 載入數據
            this.loadSessionStorageResults();
        }
    }

    /**
     * 從 API 載入歷史結果
     */
    async loadHistoricalResults() {
        try {
            console.log('從 API 載入歷史結果，會話ID:', this.sessionId);

            const result = await learningAPI.getSessionDetail(this.sessionId);

            if (!result.success || !result.data) {
                throw new Error(result.error || '載入歷史結果失敗');
            }

            const sessionDetail = result.data;
            const session = sessionDetail.session;
            const exerciseRecords = sessionDetail.exercise_records || [];

            // 轉換為 examResults 格式
            this.examResults = {
                score: Math.round(session.total_score || 0),
                accuracy: Math.round(session.accuracy_rate || 0),
                totalQuestions: session.question_count || 0,
                correctAnswers: session.correct_count || 0,
                wrongAnswers: (session.question_count || 0) - (session.correct_count || 0),
                timeSpent: session.time_spent || 0,
                submittedAt: session.end_time || session.start_time,
                sessionData: {
                    sessionId: session.session_id,
                    sessionName: session.session_name,
                    grade: session.grade,
                    publisher: session.publisher,
                    subject: session.subject,
                    chapter: session.chapter,
                    difficulty: session.difficulty,
                    knowledgePoints: session.knowledge_points || []
                },
                detailedResults: exerciseRecords.map(record => ({
                    id: record.id,
                    questionId: record.question_id,
                    questionContent: record.question_content,
                    answerChoices: record.answer_choices,
                    userAnswer: record.user_answer,
                    correctAnswer: record.correct_answer,
                    isCorrect: record.is_correct,
                    score: record.score,
                    explanation: record.explanation,
                    timeSpent: record.time_spent,
                    knowledgePoints: record.knowledge_points || [],
                    difficulty: record.difficulty,
                    questionTopic: record.question_topic
                })),
                questions: exerciseRecords.map(record => ({
                    id: record.question_id,
                    content: record.question_content,
                    choices: record.answer_choices,
                    correctAnswer: record.correct_answer,
                    explanation: record.explanation,
                    knowledgePoints: record.knowledge_points || [],
                    difficulty: record.difficulty,
                    topic: record.question_topic
                })),
                userAnswers: exerciseRecords.map(record => ({
                    questionId: record.question_id,
                    answer: record.user_answer,
                    isCorrect: record.is_correct,
                    timeSpent: record.time_spent
                }))
            };

            console.log('載入歷史結果:', this.examResults);

            // 更新會話ID顯示
            const sessionIdElement = document.getElementById('sessionId');
            if (sessionIdElement) {
                sessionIdElement.textContent = this.sessionId;
            }

        } catch (error) {
            console.error('載入歷史結果失敗:', error);
            throw error;
        }
    }

    /**
     * 從 sessionStorage 載入結果
     */
    loadSessionStorageResults() {
        const resultsData = sessionStorage.getItem('examResults');
        if (!resultsData) {
            console.warn('找不到考試結果數據，使用預設數據');
            // 創建預設的測試數據
            this.examResults = {
                score: 0,
                correctAnswers: 0,
                accuracy: 0,
                timeSpent: 0,
                detailedResults: [],
                sessionData: {
                    subject: '未知',
                    grade: '8A',
                    chapter: '未知',
                    publisher: '南一',
                    sessionName: '測試會話'
                }
            };
            return;
        }

        this.examResults = JSON.parse(resultsData);
        console.log('載入考試結果:', this.examResults);

        // 更新會話ID顯示
        const sessionIdElement = document.getElementById('sessionId');
        if (sessionIdElement) {
            sessionIdElement.textContent = `RESULT-${Date.now()}`;
        }
    }

    /**
     * 檢查認證狀態
     */
    checkAuthStatus() {
        // 檢查 authManager 是否存在
        if (typeof authManager === 'undefined') {
            console.warn('authManager 未定義，跳過認證檢查');
            return;
        }

        // 更新認證狀態 UI
        if (typeof authManager.updateAuthUI === 'function') {
            authManager.updateAuthUI();
        }
    }

    /**
     * 顯示考試結果
     */
    displayResults() {
        // 顯示總體分數
        this.displayOverallScore();

        // 創建題目導航
        this.createQuestionNavigation();

        // 顯示第一題詳解
        this.displayQuestionDetail(0);

        // 顯示時間統計
        this.displayTimeStats();

        // 初始 MathJax 渲染
        this.renderMath();

        // 初始化「錯題重練」按鈕狀態
        this.setupRetryWrongButton();
    }

    /**
     * 顯示總體分數
     */
    displayOverallScore() {
        const totalScoreElement = document.getElementById('totalScore');
        const correctCountElement = document.getElementById('correctCount');
        const accuracyRateElement = document.getElementById('accuracyRate');
        const timeSpentElement = document.getElementById('timeSpent');

        if (totalScoreElement) {
            totalScoreElement.textContent = this.examResults.score || 0;
        }

        if (correctCountElement) {
            correctCountElement.textContent = this.examResults.correctAnswers || 0;
        }

        if (accuracyRateElement) {
            const accuracy = this.examResults.accuracy || this.examResults.score || 0;
            accuracyRateElement.textContent = `${accuracy}%`;
        }

        if (timeSpentElement && this.examResults.timeSpent) {
            const minutes = Math.floor(this.examResults.timeSpent / 60);
            const seconds = this.examResults.timeSpent % 60;
            timeSpentElement.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
        }
    }

    /**
     * 創建題目導航
     */
    createQuestionNavigation() {
        const questionNav = document.getElementById('questionNav');
        if (!questionNav || !this.examResults.detailedResults) {
            return;
        }

        questionNav.innerHTML = '';

        this.examResults.detailedResults.forEach((result, index) => {
            const navButton = document.createElement('button');
            navButton.className = `w-10 h-10 rounded-full border-2 text-sm font-medium transition-colors flex-shrink-0 ${result.isCorrect
                ? 'bg-green-100 border-green-300 text-green-800 hover:bg-green-200'
                : 'bg-red-100 border-red-300 text-red-800 hover:bg-red-200'
                }`;
            navButton.textContent = index + 1;
            navButton.addEventListener('click', () => this.displayQuestionDetail(index));

            questionNav.appendChild(navButton);
        });

        // 初始化題目導航狀態
        this.updateQuestionNavigation();
    }

    /**
     * 顯示題目詳解
     */
    displayQuestionDetail(index) {
        if (!this.examResults.detailedResults || index < 0 || index >= this.examResults.detailedResults.length) {
            return;
        }

        this.currentDetailIndex = index;
        const result = this.examResults.detailedResults[index];

        // 更新題目內容
        const questionContent = document.getElementById('currentQuestionContent');
        if (questionContent) {
            let imageHtml = '';
            if (result.image_filename || result.image_url) {
                const imageUrl = result.image_url || `/api/v1/images/${result.image_filename}`;
                imageHtml = `
                    <div class="mb-4 text-center">
                        <img src="${imageUrl}" alt="題目圖片" class="max-w-full h-auto mx-auto rounded-lg shadow-md" 
                             onerror="this.style.display='none'; this.nextElementSibling.style.display='block';">
                        <p class="text-red-500 text-sm mt-2 hidden">圖片載入失敗</p>
                    </div>
                `;
            }

            questionContent.innerHTML = `
                <div class="flex items-center justify-between mb-4">
                    <h3 class="text-xl font-bold">第 ${index + 1} 題</h3>
                    <span class="px-3 py-1 rounded-full text-sm font-medium ${result.isCorrect
                    ? 'bg-green-100 text-green-800'
                    : 'bg-red-100 text-red-800'
                }">
                        ${result.isCorrect ? '✓ 正確' : '✗ 錯誤'}
                    </span>
                </div>
                ${imageHtml}
                <p class="text-lg text-gray-800">${result.questionContent || result.questionText || '題目內容載入中...'}</p>
            `;
        }

        // 更新選項
        const optionsContainer = document.getElementById('currentOptions');
        if (optionsContainer) {
            optionsContainer.innerHTML = '';

            // 處理選項數據 - 支持數組格式和對象格式
            let options = result.options || [];
            let answerChoices = result.answerChoices;

            // 如果沒有options但有answerChoices，轉換格式
            if ((!options || options.length === 0) && answerChoices) {
                if (Array.isArray(answerChoices)) {
                    options = answerChoices;
                } else if (typeof answerChoices === 'object') {
                    // 將對象格式轉為數組，確保順序為 A, B, C, D
                    options = ['A', 'B', 'C', 'D'].map(letter => answerChoices[letter]).filter(option => option !== undefined);
                }
            }

            if (options && options.length > 0) {
                options.forEach((option, optionIndex) => {
                    const optionElement = document.createElement('div');
                    let optionClass = 'flex items-center p-4 border rounded-lg mb-3';

                    // 處理答案比較 - 支持數字索引和字母索引
                    const correctAnswerIndex = this.getAnswerIndex(result.correctAnswer);
                    const userAnswerIndex = this.getAnswerIndex(result.userAnswer);

                    if (optionIndex === correctAnswerIndex) {
                        optionClass += ' bg-green-50 border-green-300';
                    } else if (optionIndex === userAnswerIndex && !result.isCorrect) {
                        optionClass += ' bg-red-50 border-red-300';
                    } else {
                        optionClass += ' bg-gray-50 border-gray-200';
                    }

                    optionElement.className = optionClass;

                    const optionLetter = String.fromCharCode(65 + optionIndex);
                    let statusIcon = '';

                    if (optionIndex === correctAnswerIndex) {
                        statusIcon = '<span class="ml-2 text-green-600 font-medium">(正確答案)</span>';
                    } else if (optionIndex === userAnswerIndex && !result.isCorrect) {
                        statusIcon = '<span class="ml-2 text-red-600 font-medium">(您的選擇)</span>';
                    }

                    optionElement.innerHTML = `
                        <span class="font-medium text-gray-700 mr-3">${optionLetter}.</span>
                        <span class="flex-1">${option}</span>
                        ${statusIcon}
                    `;

                    optionsContainer.appendChild(optionElement);
                });
            }
        }

        // 更新詳解
        const explanationElement = document.getElementById('explanation');
        if (explanationElement) {
            if (result.explanation && result.explanation !== '暫無解析') {
                explanationElement.innerHTML = `
                    <h4 class="text-lg font-semibold text-green-800 mb-2">詳解：</h4>
                    <p class="text-gray-700">${result.explanation}</p>
                `;
                explanationElement.classList.remove('hidden');
            } else {
                explanationElement.innerHTML = `
                    <h4 class="text-lg font-semibold text-green-800 mb-2">詳解：</h4>
                    <p class="text-gray-700">暫無詳細解析</p>
                `;
            }
        }

        // 呼叫 AI 分析（改為使用 DB 內的 exercise_record 觸發與輪詢）
        this.loadAIAnalysis(result);

        // 更新導航按鈕狀態
        this.updateNavigationButtons();

        // 更新題目導航高亮
        this.updateQuestionNavigation();

        // 觸發 MathJax 重新渲染
        this.renderMath();
    }

    /**
     * 更新導航按鈕狀態
     */
    updateNavigationButtons() {
        const prevBtn = document.getElementById('prevQuestionBtn');
        const nextBtn = document.getElementById('nextQuestionBtn');

        if (prevBtn) {
            prevBtn.disabled = this.currentDetailIndex === 0;
            prevBtn.classList.toggle('opacity-50', this.currentDetailIndex === 0);
        }

        if (nextBtn) {
            const isLast = this.currentDetailIndex === this.examResults.detailedResults.length - 1;
            nextBtn.disabled = isLast;
            nextBtn.classList.toggle('opacity-50', isLast);
        }
    }

    /**
     * 更新題目導航高亮
     */
    updateQuestionNavigation() {
        const questionNav = document.getElementById('questionNav');
        if (!questionNav) return;

        const navButtons = questionNav.querySelectorAll('button');
        navButtons.forEach((button, index) => {
            if (index === this.currentDetailIndex) {
                button.classList.add('ring-2', 'ring-blue-500');
            } else {
                button.classList.remove('ring-2', 'ring-blue-500');
            }
        });

        // 確保當前題目按鈕在可視範圍（當題數超過可視寬度時自動水平滾動）
        const activeButton = navButtons[this.currentDetailIndex];
        if (activeButton) {
            // 在 result.html 中，滾動容器是 questionNav 的父元素（question-nav-container 的 div）
            const container = questionNav.parentElement;

            if (container && container.classList.contains('question-nav-container')) {
                const needsScroll = container.scrollWidth > container.clientWidth;

                if (needsScroll) {
                    const containerLeft = container.scrollLeft;
                    const containerRight = containerLeft + container.clientWidth;
                    const btnLeft = activeButton.offsetLeft;
                    const btnRight = btnLeft + activeButton.offsetWidth;
                    const padding = 12; // 視覺餘量

                    // 僅在當前題目完全超出可視範圍時才滾動，且以最小位移讓其剛好可見，避免「亂跳」
                    if (btnRight + padding > containerRight) {
                        const delta = btnRight + padding - containerRight;
                        container.scrollTo({ left: containerLeft + delta, behavior: 'smooth' });
                    } else if (btnLeft - padding < containerLeft) {
                        const delta = containerLeft - (btnLeft - padding);
                        container.scrollTo({ left: Math.max(0, containerLeft - delta), behavior: 'smooth' });
                    }
                }
            }
        }
    }

    /**
     * 顯示時間統計
     */
    displayTimeStats() {
        // 時間統計已在 displayOverallScore 中處理
    }

    /**
     * 綁定事件
     */
    bindEvents() {
        // 上一題按鈕
        const prevBtn = document.getElementById('prevQuestionBtn');
        if (prevBtn) {
            prevBtn.addEventListener('click', () => {
                if (this.currentDetailIndex > 0) {
                    this.displayQuestionDetail(this.currentDetailIndex - 1);
                }
            });
        }

        // 下一題按鈕
        const nextBtn = document.getElementById('nextQuestionBtn');
        if (nextBtn) {
            nextBtn.addEventListener('click', () => {
                if (this.currentDetailIndex < this.examResults.detailedResults.length - 1) {
                    this.displayQuestionDetail(this.currentDetailIndex + 1);
                }
            });
        }

        // 登出按鈕
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => {
                if (typeof authManager !== 'undefined' && authManager.logout) {
                    authManager.logout();
                } else {
                    window.location.href = '../index.html';
                }
            });
        }

        // 錯題重練按鈕
        const retryBtn = document.getElementById('retryWrongBtn');
        if (retryBtn) {
            retryBtn.addEventListener('click', () => this.handleRetryWrong());
        }
    }

    /**
     * 設定「錯題重練」按鈕啟用/停用
     */
    setupRetryWrongButton() {
        const retryBtn = document.getElementById('retryWrongBtn');
        const meta = document.getElementById('retryMeta');
        if (!retryBtn || !this.examResults || !Array.isArray(this.examResults.detailedResults)) return;

        const wrongCount = this.examResults.detailedResults.filter(r => r && r.isCorrect === false).length;
        const estimatedMinutes = wrongCount * 2;

        if (wrongCount > 0) {
            retryBtn.disabled = false;
            retryBtn.title = `錯題數：${wrongCount}，預估時間：約 ${estimatedMinutes} 分鐘。點擊開始重練`;
            if (meta) {
                meta.textContent = `錯題數：${wrongCount} 題｜預估時間：約 ${estimatedMinutes} 分鐘`;
            }
        } else {
            retryBtn.disabled = true;
            retryBtn.title = '本次全對，無需重練';
            if (meta) {
                meta.textContent = '本次全對，無需重練';
            }
        }
    }

    /**
     * 錯題重練：用本次 session 的錯題建立新 session，並導向 exam.html
     */
    handleRetryWrong() {
        if (!this.examResults || !Array.isArray(this.examResults.detailedResults) || !Array.isArray(this.examResults.questions)) {
            this.showWarningMessage('找不到可重練的錯題');
            return;
        }

        // 取出錯題索引
        const wrongIndexes = this.examResults.detailedResults
            .map((r, i) => (r && r.isCorrect === false ? i : -1))
            .filter(i => i >= 0);

        if (wrongIndexes.length === 0) {
            this.showWarningMessage('本次全對，無需重練');
            return;
        }

        // 取出錯題題目並正規化為 exam.js 期望的結構（必須有 options）
        const wrongQuestions = wrongIndexes
            .map(i => this.examResults.questions[i])
            .filter(Boolean)
            .map(q => this.normalizeQuestionForExam(q));
        if (wrongQuestions.length === 0) {
            this.showWarningMessage('錯題資料異常，請稍後再試');
            return;
        }

        // 隨機化錯題順序
        const shuffled = this.shuffleArray(wrongQuestions).map((q, idx) => ({ ...q, order_index: idx }));

        // 準備新 session 資料
        const seed = Date.now();
        const src = this.examResults.sessionData || {};
        const newSession = {
            grade: src.grade,
            edition: src.edition,
            publisher: src.publisher || src.edition,
            subject: src.subject,
            chapter: src.chapter,
            question_count: shuffled.length,
            questions: shuffled,
            randomized: true,
            randomSeed: seed,
            isRetry: true,
            retrySourceSubmittedAt: this.examResults.submittedAt,
            retrySourceSessionId: src.sessionId || null
        };

        // 寫入並導向
        sessionStorage.setItem('examSession', JSON.stringify(newSession));
        window.location.href = 'exam.html';
    }

    // 將 result.html 內的題目資料正規化為 exam.js 可用的格式
    normalizeQuestionForExam(q) {
        const questionText = q.question || q.content || q.question_text || '';
        // 規整選項：優先使用 q.options（陣列或物件），否則從 q.choices 轉為陣列
        let optionsArray = [];
        if (Array.isArray(q.options)) {
            optionsArray = q.options;
        } else if (q.options && typeof q.options === 'object') {
            optionsArray = Object.values(q.options);
        } else if (Array.isArray(q.choices)) {
            optionsArray = q.choices;
        } else if (q.choices && typeof q.choices === 'object') {
            const order = ['A', 'B', 'C', 'D', 'E', 'F'];
            optionsArray = order.map(k => q.choices[k]).filter(v => v !== undefined);
        }
        const sourceAnswer = (q.answer !== undefined) ? q.answer
            : (q.correctAnswer !== undefined) ? q.correctAnswer
                : (q.correct_answer !== undefined) ? q.correct_answer
                    : null;

        const correctIndex = this.resolveCorrectIndex(sourceAnswer, optionsArray);

        return {
            id: q.id,
            question: questionText,
            options: optionsArray,
            // 兼容字段：提供多種命名，統一為索引
            answer: correctIndex,
            correctAnswer: correctIndex,
            correct_answer: correctIndex,
            correctAnswerIndex: correctIndex,
            explanation: q.explanation || '暫無解析',
            difficulty: q.difficulty,
            knowledgePoints: q.knowledgePoints || q.knowledge_points || [],
            topic: q.topic || q.questionTopic || q.subject,
            image_filename: q.image_filename,
            image_url: q.image_url
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
        // 嘗試用文字匹配
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

    /**
     * 顯示錯誤訊息
     */
    showError(message) {
        const errorElement = document.getElementById('errorMessage');
        if (errorElement) {
            errorElement.textContent = message;
            errorElement.classList.remove('hidden');
        } else {
            alert(message);
        }
    }

    /**
     * 載入 AI 分析
     */
    async loadAIAnalysis(result) {
        try {
            console.log('開始載入 AI 分析（非同步任務），題目資料:', result);

            // 顯示載入狀態
            this.showAILoadingState();

            if (!window.aiAnalysisAPI) {
                console.error('AI Analysis API 未載入');
                this.showAIErrorState();
                return;
            }

            // 取得 exercise_record_id
            const exerciseRecordId = result.id || result.record_id || null;
            if (!exerciseRecordId) {
                console.log('尚未取得 exercise_record_id，可能為未保存狀態，等待保存後再觸發 AI');
                this.showAILoadingState();
                return;
            }

            // 1) 優先查詢是否已有最新結果（快取優先）
            const latest = await window.aiAnalysisAPI.getLatestAnalysisByRecord(exerciseRecordId);
            if (latest.success && latest.status === 'succeeded' && latest.data) {
                console.log('找到既有 AI 分析結果，直接渲染');
                this.updateWeaknessAnalysis({ status: 'fulfilled', value: { success: true, data: latest.data } });
                this.updateLearningRecommendations({ status: 'fulfilled', value: { success: true, data: latest.data } });
                return;
            }

            // 2) 若未命中，使用單一整合端點一次生成並落地（帶題目與作答）
            const question = {
                grade: this.examResults?.sessionData?.grade,
                subject: this.examResults?.sessionData?.subject,
                publisher: this.examResults?.sessionData?.publisher,
                chapter: this.examResults?.sessionData?.chapter,
                topic: result.questionTopic,
                knowledge_point: result.knowledgePoints || [],
                difficulty: result.difficulty,
                question: result.questionContent,
                options: result.answerChoices || {},
                answer: result.correctAnswer,
                explanation: result.explanation
            };
            const studentAnswer = result.userAnswer;

            const generated = await window.aiAnalysisAPI.generateCombinedAnalysis(
                question,
                studentAnswer,
                exerciseRecordId,
                1.0,
                512
            );

            if (generated.success && generated.data) {
                // 直接渲染生成的內容
                this.updateWeaknessAnalysis({ status: 'fulfilled', value: { success: true, data: generated.data } });
                this.updateLearningRecommendations({ status: 'fulfilled', value: { success: true, data: generated.data } });
                return;
            }

            // 3) 若生成失敗，回退到非同步任務機制（保底）
            let taskId = latest && latest.latest_task_id && (latest.status === 'pending' || latest.status === 'processing')
                ? latest.latest_task_id
                : null;

            if (!taskId) {
                const trigger = await window.aiAnalysisAPI.triggerAnalysisByRecord(exerciseRecordId);
                if (!trigger.success || !trigger.task_id) {
                    throw new Error(trigger.error || '無法觸發 AI 任務');
                }
                taskId = trigger.task_id;
                console.log('AI 任務已觸發(保底方案)，taskId:', taskId);
            }

            // 輪詢任務狀態（保底）
            const pollIntervalMs = 2000;
            const maxWaitMs = 20000;
            const startTime = Date.now();
            while (Date.now() - startTime < maxWaitMs) {
                const status = await window.aiAnalysisAPI.getAnalysisStatus(taskId);
                if (status.success) {
                    if (status.status === 'succeeded' && status.data) {
                        this.updateWeaknessAnalysis({ status: 'fulfilled', value: { success: true, data: status.data } });
                        this.updateLearningRecommendations({ status: 'fulfilled', value: { success: true, data: status.data } });
                        return;
                    }
                    if (status.status === 'failed') {
                        throw new Error(status.message || 'AI 任務失敗');
                    }
                }
                await new Promise(r => setTimeout(r, pollIntervalMs));
            }

            console.warn('AI 任務輪詢逾時');
            this.showAIErrorState();

        } catch (error) {
            console.error('AI 分析載入失敗:', error);
            this.showAIErrorState();
        }
    }

    /**
     * 顯示 AI 載入狀態
     */
    showAILoadingState() {
        // 更新弱點分析載入狀態
        const weaknessContent = document.getElementById('weaknessContent');
        if (weaknessContent) {
            weaknessContent.innerHTML = `
                <div class="flex items-center justify-center p-4">
                    <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                    <span class="ml-3 text-gray-600">AI 正在分析您的作答情況...</span>
                </div>
            `;
        }

        // 更新學習建議載入狀態
        const recommendationsContent = document.getElementById('recommendationsContent');
        if (recommendationsContent) {
            recommendationsContent.innerHTML = `
                <div class="flex items-center justify-center p-4">
                    <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
                    <span class="ml-3 text-gray-600">AI 正在生成學習建議...</span>
                </div>
            `;
        }
    }

    /**
     * 修正：弱點分析渲染到 weaknessContent（原本誤用 recommendationsContent）
     */
    updateWeaknessAnalysis(weaknessResult) {
        const weaknessContent = document.getElementById('weaknessContent');
        if (!weaknessContent) return;

        if (weaknessResult.status === 'fulfilled' && weaknessResult.value.success) {
            const analysis = weaknessResult.value.data;
            weaknessContent.innerHTML = `
                <div class="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p class="text-gray-700 leading-relaxed">${analysis['題目詳解與教學建議'] || 'AI 分析暫時無法使用'}</p>
                </div>
            `;
            this.renderMath(weaknessContent);
        } else {
            const errorMessage = weaknessResult.status === 'rejected'
                ? weaknessResult.reason?.message || '分析失敗'
                : weaknessResult.value?.error || '分析失敗';

            weaknessContent.innerHTML = `
                <div class="bg-red-50 border border-red-200 rounded-lg p-4">
                    <p class="text-red-700">AI 弱點分析暫時無法使用：${errorMessage}</p>
                </div>
            `;
        }
    }

    /**
     * 修正：學習建議渲染到 recommendationsContent（原本誤用 weaknessContent）
     */
    updateLearningRecommendations(guidanceResult) {
        const recommendationsContent = document.getElementById('recommendationsContent');
        if (!recommendationsContent) return;

        if (guidanceResult.status === 'fulfilled' && guidanceResult.value.success) {
            const guidance = guidanceResult.value.data;
            recommendationsContent.innerHTML = `
                <div class="bg-purple-50 border border-purple-200 rounded-lg p-4">
                    <p class="text-gray-700 leading-relaxed">${guidance['學生學習狀況評估'] || '學習建議暫時無法生成'}</p>
                </div>
            `;
            this.renderMath(recommendationsContent);
        } else {
            const errorMessage = guidanceResult.status === 'rejected'
                ? guidanceResult.reason?.message || '建議生成失敗'
                : guidanceResult.value?.error || '建議生成失敗';

            recommendationsContent.innerHTML = `
                <div class="bg-red-50 border border-red-200 rounded-lg p-4">
                    <p class="text-red-700">學習建議暫時無法生成：${errorMessage}</p>
                </div>
            `;
        }
    }

    /**
     * 顯示 AI 錯誤狀態
     */
    showAIErrorState() {
        const weaknessContent = document.getElementById('weaknessContent');
        const recommendationsContent = document.getElementById('recommendationsContent');

        if (weaknessContent) {
            weaknessContent.innerHTML = `
                <div class="bg-red-50 border border-red-200 rounded-lg p-4">
                    <p class="text-red-700">AI 弱點分析暫時無法使用，請稍後再試。</p>
                </div>
            `;
        }

        if (recommendationsContent) {
            recommendationsContent.innerHTML = `
                <div class="bg-red-50 border border-red-200 rounded-lg p-4">
                    <p class="text-red-700">學習建議暫時無法生成，請稍後再試。</p>
                </div>
            `;
        }
    }

    /**
     * 觸發 MathJax 重新渲染數學公式
     */
    renderMath(targetElement) {
        if (window.MathJax && window.MathJax.typesetPromise) {
            const elements = targetElement ? [targetElement] : undefined;
            window.MathJax.typesetPromise(elements).then(() => {
                console.log('Result頁面 MathJax 渲染完成');
            }).catch((err) => {
                console.error('Result頁面 MathJax 渲染失敗:', err);
            });
        }
    }

    /**
     * 保存練習結果到數據庫
     */
    async saveResultsToDatabase() {
        try {
            // 檢查是否是從歷程記錄查看（已經保存過的記錄）
            if (this.examResults.sessionData && this.examResults.sessionData.sessionId) {
                console.log('這是已保存的歷程記錄，跳過重複保存');
                // 更新頁面顯示的會話ID
                const sessionIdElement = document.getElementById('sessionId');
                if (sessionIdElement) {
                    sessionIdElement.textContent = this.examResults.sessionData.sessionId.substring(0, 8).toUpperCase();
                }
                return;
            }

            // 檢查是否已經保存過（避免重複保存）
            const savedSessionId = sessionStorage.getItem('savedSessionId');
            const currentExamResults = sessionStorage.getItem('examResults');

            // 如果有保存標記且當前沒有新的練習結果，則跳過保存
            if (savedSessionId && !currentExamResults) {
                console.log('練習結果已保存，會話ID:', savedSessionId);
                return;
            }

            // 如果有新的練習結果，清除舊的保存標記
            if (currentExamResults) {
                console.log('發現新的練習結果，清除舊的保存標記');
                sessionStorage.removeItem('savedSessionId');
            }

            // 檢查用戶是否已登入
            const token = localStorage.getItem('auth_token');
            if (!token) {
                console.log('用戶未登入，跳過保存練習結果');
                this.showWarningMessage('需要登入才能保存練習記錄');
                return;
            }

            // 檢查是否有練習結果數據
            if (!this.examResults || !this.examResults.detailedResults) {
                console.log('沒有練習結果數據，跳過保存');
                this.showWarningMessage('沒有練習結果數據可保存');
                return;
            }

            // 如果沒有詳細結果，也跳過保存
            if (this.examResults.detailedResults.length === 0) {
                console.log('詳細結果為空，跳過保存');
                this.showWarningMessage('沒有詳細的練習結果可保存');
                return;
            }

            console.log('開始保存練習結果到數據庫...');

            // 轉換數據格式為後端API格式
            const requestData = this.convertToAPIFormat();

            // 調用API保存結果
            const result = await learningAPI.submitExerciseResult(requestData);

            if (result.success) {
                console.log('練習結果保存成功:', result.data);
                // 保存會話ID，避免重複保存
                sessionStorage.setItem('savedSessionId', result.data.session_id);

                // 清除 sessionStorage 中的練習結果，避免重複處理
                sessionStorage.removeItem('examResults');

                // 更新頁面顯示的會話ID
                const sessionIdElement = document.getElementById('sessionId');
                if (sessionIdElement) {
                    sessionIdElement.textContent = result.data.session_id.substring(0, 8).toUpperCase();
                }

                // 顯示保存成功提示
                this.showSuccessMessage('練習結果已保存');

                // 立即從資料庫重新取得帶有 exercise_record_id 的詳細資料，方便觸發 AI 分析
                await this.refreshResultsFromDB(result.data.session_id);
                // 重新渲染目前題目的 AI 區塊
                this.displayQuestionDetail(this.currentDetailIndex || 0);
            } else {
                throw new Error(result.error || '保存失敗');
            }

        } catch (error) {
            console.error('保存練習結果失敗:', error);

            // 根據錯誤類型決定是否顯示給用戶
            if (error.message.includes('401') || error.message.includes('Unauthorized')) {
                this.showWarningMessage('需要登入才能保存練習記錄');
            } else if (error.message.includes('403') || error.message.includes('Forbidden')) {
                this.showWarningMessage('沒有權限保存練習記錄');
            } else if (error.message.includes('500') || error.message.includes('Internal Server Error')) {
                this.showWarningMessage('服務器暫時無法保存記錄，但不影響查看結果');
            } else {
                // 網絡錯誤或其他錯誤，不影響用戶查看結果
                console.warn('保存練習結果時發生錯誤，但不影響結果查看:', error.message);
            }
        }
    }

    /**
     * 重新從資料庫取得結果（包含 exercise_record_id）
     */
    async refreshResultsFromDB(sessionId) {
        try {
            const res = await learningAPI.getSessionDetail(sessionId);
            if (!res.success || !res.data) return;

            const sessionDetail = res.data;
            const session = sessionDetail.session;
            const exerciseRecords = sessionDetail.exercise_records || [];

            this.sessionId = sessionId;
            this.isHistoryMode = true;

            this.examResults = {
                score: Math.round(session.total_score || 0),
                accuracy: Math.round(session.accuracy_rate || 0),
                totalQuestions: session.question_count || 0,
                correctAnswers: session.correct_count || 0,
                wrongAnswers: (session.question_count || 0) - (session.correct_count || 0),
                timeSpent: session.time_spent || 0,
                submittedAt: session.end_time || session.start_time,
                sessionData: {
                    sessionId: session.session_id,
                    sessionName: session.session_name,
                    grade: session.grade,
                    publisher: session.publisher,
                    subject: session.subject,
                    chapter: session.chapter,
                    difficulty: session.difficulty,
                    knowledgePoints: session.knowledge_points || []
                },
                detailedResults: exerciseRecords.map(record => ({
                    id: record.id,
                    questionId: record.question_id,
                    questionContent: record.question_content,
                    answerChoices: record.answer_choices,
                    userAnswer: record.user_answer,
                    correctAnswer: record.correct_answer,
                    isCorrect: record.is_correct,
                    score: record.score,
                    explanation: record.explanation,
                    timeSpent: record.time_spent,
                    knowledgePoints: record.knowledge_points || [],
                    difficulty: record.difficulty,
                    questionTopic: record.question_topic
                })),
                questions: exerciseRecords.map(record => ({
                    id: record.question_id,
                    content: record.question_content,
                    choices: record.answer_choices,
                    correctAnswer: record.correct_answer,
                    explanation: record.explanation,
                    knowledgePoints: record.knowledge_points || [],
                    difficulty: record.difficulty,
                    topic: record.question_topic
                })),
                userAnswers: exerciseRecords.map(record => ({
                    questionId: record.question_id,
                    answer: record.user_answer,
                    isCorrect: record.is_correct,
                    timeSpent: record.time_spent
                }))
            };

            // 更新會話ID顯示
            const sessionIdElement = document.getElementById('sessionId');
            if (sessionIdElement) {
                sessionIdElement.textContent = this.sessionId;
            }
        } catch (e) {
            console.warn('刷新資料庫結果失敗:', e);
        }
    }

    /**
     * 轉換數據格式為後端API格式
     */
    convertToAPIFormat() {
        const sessionData = this.examResults.sessionData || {};

        // 構建練習結果列表
        const exerciseResults = this.examResults.detailedResults.map((result, index) => {
            // 從題目數據中獲取更多信息
            const question = this.examResults.questions ? this.examResults.questions[index] : {};
            const userAnswer = this.examResults.userAnswers ? this.examResults.userAnswers[index] : {};

            return {
                question_id: result.questionId || question.id || `q_${index}`,
                subject: sessionData.subject || '未分類',
                grade: sessionData.grade || '8A',
                chapter: sessionData.chapter || result.chapter || question.chapter,
                publisher: sessionData.publisher || sessionData.edition || '南一',
                knowledge_points: result.knowledgePoints || question.knowledgePoints || [],
                question_content: result.questionContent || question.content || result.questionText || '',
                answer_choices: result.answerChoices || question.choices || this.convertOptionsToChoices(result.options),
                difficulty: result.difficulty || question.difficulty || sessionData.difficulty || 'normal',
                question_topic: result.questionTopic || question.topic || result.topic,
                user_answer: result.userAnswer !== undefined ? String(result.userAnswer) : (userAnswer.answer !== undefined ? String(userAnswer.answer) : ''),
                correct_answer: result.correctAnswer !== undefined ? String(result.correctAnswer) : (question.correctAnswer !== undefined ? String(question.correctAnswer) : ''),
                is_correct: result.isCorrect !== undefined ? result.isCorrect : (userAnswer.isCorrect !== undefined ? userAnswer.isCorrect : false),
                score: result.score !== undefined ? result.score : (result.isCorrect ? 100 : 0),
                explanation: result.explanation || question.explanation || '暫無解析',
                time_spent: result.timeSpent || userAnswer.timeSpent || null
            };
        });

        // 構建完整請求數據
        const requestData = {
            session_name: sessionData.sessionName || `${sessionData.subject || '練習'}測驗 - ${new Date().toLocaleDateString()}`,
            subject: sessionData.subject || '未分類',
            grade: sessionData.grade || '8A',
            chapter: sessionData.chapter,
            publisher: sessionData.publisher || sessionData.edition || '南一',
            difficulty: sessionData.difficulty || 'normal',
            knowledge_points: sessionData.knowledgePoints || [],
            exercise_results: exerciseResults,
            total_time_spent: this.examResults.timeSpent || 0,
            session_metadata: {
                source: 'web',
                device: 'desktop',
                original_session_data: sessionData,
                submitted_at: new Date().toISOString()
            }
        };

        console.log('轉換後的API請求數據:', requestData);
        return requestData;
    }

    /**
     * 轉換選項數組為選項對象
     */
    convertOptionsToChoices(options) {
        if (!options || !Array.isArray(options)) {
            return null;
        }

        const choices = {};
        options.forEach((option, index) => {
            const letter = String.fromCharCode(65 + index); // A, B, C, D
            choices[letter] = option;
        });

        return choices;
    }

    /**
     * 獲取答案索引 - 支持字母格式(A,B,C,D)和數字格式(0,1,2,3)
     */
    getAnswerIndex(answer) {
        if (answer === null || answer === undefined) {
            return -1;
        }

        const answerStr = String(answer).toUpperCase();

        // 如果是字母格式 (A, B, C, D)
        if (answerStr.match(/^[A-Z]$/)) {
            return answerStr.charCodeAt(0) - 65; // A=0, B=1, C=2, D=3
        }

        // 如果是數字格式
        const answerNum = parseInt(answerStr);
        if (!isNaN(answerNum)) {
            return answerNum;
        }

        return -1;
    }

    /**
     * 顯示成功訊息
     */
    showSuccessMessage(message) {
        this.showToast(message, 'success');
    }

    /**
     * 顯示警告訊息
     */
    showWarningMessage(message) {
        this.showToast(message, 'warning');
    }

    /**
     * 顯示通用提示訊息
     */
    showToast(message, type = 'info') {
        const colors = {
            'success': 'bg-green-500',
            'warning': 'bg-yellow-500',
            'error': 'bg-red-500',
            'info': 'bg-blue-500'
        };

        const toastElement = document.createElement('div');
        toastElement.className = `fixed top-4 right-4 ${colors[type]} text-white px-6 py-3 rounded-lg shadow-lg z-50 transform transition-all duration-300 translate-x-full`;
        toastElement.textContent = message;

        document.body.appendChild(toastElement);

        // 動畫顯示
        setTimeout(() => {
            toastElement.classList.remove('translate-x-full');
        }, 100);

        // 自動隱藏時間根據類型調整
        const hideDelay = type === 'warning' ? 5000 : 3000;
        setTimeout(() => {
            toastElement.classList.add('translate-x-full');
            setTimeout(() => {
                if (toastElement.parentNode) {
                    toastElement.parentNode.removeChild(toastElement);
                }
            }, 300);
        }, hideDelay);
    }
}

// 頁面載入時初始化
document.addEventListener('DOMContentLoaded', () => {
    const resultPage = new ResultPage();
    resultPage.init();
}); 