/**
 * 考試頁面 JavaScript
 * 實現自動批改系統功能
 */

class ExamPage {
    constructor() {
        this.sessionData = null;
        this.currentQuestionIndex = 0;
        this.questions = [];
        this.answers = [];
        this.timeRemaining = 0;
        this.timerInterval = null;
        this.startTime = null;

        // DOM 元素
        this.questionContent = document.getElementById('questionContent');
        this.optionsContainer = document.getElementById('optionsContainer');
        this.prevBtn = document.getElementById('prevBtn');
        this.nextBtn = document.getElementById('nextBtn');
        this.submitBtn = document.getElementById('submitBtn');
        this.timer = document.getElementById('timer');
        this.currentQuestion = document.getElementById('currentQuestion');
        this.totalQuestions = document.getElementById('totalQuestions');
        this.questionNav = document.getElementById('questionNav');

        this.init();
    }

    /**
     * 初始化
     */
    async init() {
        try {
            // 載入會話資料
            await this.loadSessionData();

            // 初始化UI
            this.initializeUI();

            // 載入第一題
            this.displayQuestion(0);

            // 開始計時
            this.startTimer();

        } catch (error) {
            console.error('初始化考試失敗:', error);
            this.showError('載入考試失敗，請重新開始');
        }
    }

    /**
     * 載入會話資料
     */
    async loadSessionData() {
        try {
            // 從 sessionStorage 載入會話資料
            const storedSession = sessionStorage.getItem('examSession');
            if (!storedSession) {
                throw new Error('找不到考試會話資料');
            }

            this.sessionData = JSON.parse(storedSession);
            console.log('載入會話資料:', this.sessionData);

            // 設置題目和答案陣列
            this.questions = this.sessionData.questions || [];
            this.answers = new Array(this.questions.length).fill(null);

            // 設置考試時間（每題2分鐘）
            this.timeRemaining = this.questions.length * 120; // 秒
            this.startTime = new Date();

            // 更新會話ID顯示
            const sessionIdElement = document.getElementById('sessionId');
            if (sessionIdElement) {
                sessionIdElement.textContent = `EXAM-${Date.now()}`;
            }

            // 顯示「錯題重練」徽章
            const retryBadge = document.getElementById('retryBadge');
            if (retryBadge) {
                if (this.sessionData && this.sessionData.isRetry) {
                    retryBadge.classList.remove('hidden');
                } else {
                    retryBadge.classList.add('hidden');
                }
            }

        } catch (error) {
            console.error('載入會話資料失敗:', error);
            throw error;
        }
    }

    /**
     * 初始化 UI
     */
    initializeUI() {
        // 綁定事件
        this.bindEvents();

        // 創建題目導航
        this.createQuestionNavigation();

        // 更新總題數顯示
        if (this.totalQuestions) {
            this.totalQuestions.textContent = this.questions.length;
        }
    }

    /**
     * 綁定事件
     */
    bindEvents() {
        if (this.prevBtn) {
            this.prevBtn.addEventListener('click', () => this.goToPrevQuestion());
        }

        if (this.nextBtn) {
            this.nextBtn.addEventListener('click', () => this.goToNextQuestion());
        }

        if (this.submitBtn) {
            this.submitBtn.addEventListener('click', () => this.showSubmitModal());
        }

        // 提交確認對話框事件
        const confirmSubmit = document.getElementById('confirmSubmit');
        const cancelSubmit = document.getElementById('cancelSubmit');

        if (confirmSubmit) {
            confirmSubmit.addEventListener('click', () => this.submitExam());
        }

        if (cancelSubmit) {
            cancelSubmit.addEventListener('click', () => this.hideSubmitModal());
        }

        // 防止頁面離開時資料遺失
        window.addEventListener('beforeunload', (e) => {
            if (this.hasUnsavedChanges()) {
                e.preventDefault();
                e.returnValue = '';
            }
        });
    }

    /**
     * 創建題目導航
     */
    createQuestionNavigation() {
        if (!this.questionNav) return;

        this.questionNav.innerHTML = '';

        this.questions.forEach((_, index) => {
            const navButton = document.createElement('button');
            navButton.className = 'w-8 h-8 rounded border-2 border-gray-300 text-sm font-medium hover:bg-gray-100 transition-colors';
            navButton.textContent = index + 1;
            navButton.setAttribute('data-index', String(index));
            navButton.addEventListener('click', () => this.goToQuestion(index));

            this.questionNav.appendChild(navButton);
        });
    }

    /**
     * 顯示題目
     */
    displayQuestion(index) {
        if (index < 0 || index >= this.questions.length) {
            return;
        }

        this.currentQuestionIndex = index;
        const question = this.questions[index];

        // 更新當前題目編號
        if (this.currentQuestion) {
            this.currentQuestion.textContent = index + 1;
        }

        // 更新題目內容
        if (this.questionContent) {
            let imageHtml = '';
            if (question.image_filename || question.image_url) {
                const imageUrl = question.image_url || `/api/v1/images/${question.image_filename}`;
                imageHtml = `
                    <div class="mb-4 text-center">
                        <img src="${imageUrl}" alt="題目圖片" class="max-w-full h-auto mx-auto rounded-lg shadow-md" 
                             onerror="this.style.display='none'; this.nextElementSibling.style.display='block';">
                        <p class="text-red-500 text-sm mt-2 hidden">圖片載入失敗</p>
                    </div>
                `;
            }

            this.questionContent.innerHTML = `
                ${imageHtml}
                <p class="text-lg text-gray-800">${question.question || question.content || question.question_text}</p>
            `;
        }

        // 顯示選項
        this.displayOptions(question, index);

        // 更新按鈕狀態
        this.updateNavigationButtons();

        // 更新題目導航狀態
        this.updateQuestionNavigation();

        // 更新提交按鈕狀態
        this.updateSubmitButton();

        // 觸發 MathJax 重新渲染
        this.renderMath();
    }

    /**
     * 顯示選項
     */
    displayOptions(question, questionIndex) {
        if (!this.optionsContainer) return;

        this.optionsContainer.innerHTML = '';

        // 處理選項格式
        let options = [];
        if (Array.isArray(question.options)) {
            options = question.options;
        } else if (typeof question.options === 'object' && question.options !== null) {
            options = Object.values(question.options);
        } else {
            console.error('Invalid options format:', question.options);
            return;
        }

        // 將物件型選項轉為純文字（支援 {text: '...'} 或 {A: '...'} 等結構）
        const normalizeOptionText = (opt) => {
            if (typeof opt === 'string') return opt;
            if (opt && typeof opt === 'object') {
                if (Object.prototype.hasOwnProperty.call(opt, 'text')) {
                    return String(opt.text);
                }
                const values = Object.values(opt);
                if (values.length > 0) {
                    return String(values[0]);
                }
            }
            return String(opt);
        };
        options = options.map(normalizeOptionText);

        const selectedAnswer = this.answers[questionIndex];

        options.forEach((option, optionIndex) => {
            const optionElement = document.createElement('div');
            optionElement.className = 'flex items-center p-4 border rounded-lg hover:bg-gray-50 cursor-pointer transition-colors';

            const isSelected = selectedAnswer === optionIndex;
            if (isSelected) {
                optionElement.classList.add('bg-blue-50', 'border-blue-300');
            }

            const optionLetter = String.fromCharCode(65 + optionIndex);

            optionElement.innerHTML = `
                <input type="radio" name="question_${questionIndex}" value="${optionIndex}" 
                       class="mr-3 text-blue-600 focus:ring-blue-500" ${isSelected ? 'checked' : ''}>
                <span class="font-medium text-gray-700 mr-2">${optionLetter}.</span>
                <span class="flex-1">${option}</span>
            `;

            // 點擊事件
            optionElement.addEventListener('click', () => {
                this.selectAnswer(questionIndex, optionIndex);
            });

            this.optionsContainer.appendChild(optionElement);
        });

        // 觸發 MathJax 重新渲染選項中的數學公式
        this.renderMath();
    }

    /**
     * 選擇答案
     */
    selectAnswer(questionIndex, optionIndex) {
        this.answers[questionIndex] = optionIndex;

        // 重新顯示選項以更新選中狀態
        this.displayOptions(this.questions[questionIndex], questionIndex);

        // 更新題目導航狀態
        this.updateQuestionNavigation();

        // 檢查是否可以顯示提交按鈕
        this.updateSubmitButton();
    }

    /**
     * 前一題
     */
    goToPrevQuestion() {
        if (this.currentQuestionIndex > 0) {
            this.displayQuestion(this.currentQuestionIndex - 1);
        }
    }

    /**
     * 下一題
     */
    goToNextQuestion() {
        if (this.currentQuestionIndex < this.questions.length - 1) {
            this.displayQuestion(this.currentQuestionIndex + 1);
        }
    }

    /**
     * 跳轉到指定題目
     */
    goToQuestion(index) {
        this.displayQuestion(index);
    }

    /**
     * 更新導航按鈕狀態
     */
    updateNavigationButtons() {
        if (this.prevBtn) {
            this.prevBtn.disabled = this.currentQuestionIndex === 0;
            this.prevBtn.classList.toggle('opacity-50', this.currentQuestionIndex === 0);
        }

        if (this.nextBtn) {
            this.nextBtn.disabled = this.currentQuestionIndex === this.questions.length - 1;
            this.nextBtn.classList.toggle('opacity-50', this.currentQuestionIndex === this.questions.length - 1);
        }
    }

    /**
     * 更新題目導航狀態
     */
    updateQuestionNavigation() {
        if (!this.questionNav) return;

        const navButtons = this.questionNav.querySelectorAll('button');
        navButtons.forEach((button, index) => {
            // 重置樣式
            button.className = 'w-8 h-8 rounded border-2 text-sm font-medium transition-colors';

            if (index === this.currentQuestionIndex) {
                // 當前題目
                button.classList.add('bg-blue-600', 'text-white', 'border-blue-600');
            } else if (this.answers[index] !== null) {
                // 已作答
                button.classList.add('bg-green-100', 'text-green-800', 'border-green-300');
            } else {
                // 未作答
                button.classList.add('border-gray-300', 'text-gray-600', 'hover:bg-gray-100');
            }
        });

        // 確保當前題目按鈕在可視範圍（當題數超過可視寬度，如第22題時自動水平滾動）
        const activeButton = navButtons[this.currentQuestionIndex];
        if (activeButton) {
            const container = this.questionNav.parentElement || this.questionNav;
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

    /**
     * 更新提交按鈕狀態
     */
    updateSubmitButton() {
        if (!this.submitBtn) return;

        const answeredCount = this.answers.filter(answer => answer !== null).length;
        const isLastQuestion = this.currentQuestionIndex === this.questions.length - 1;
        const hasAnsweredCurrentQuestion = this.answers[this.currentQuestionIndex] !== null;

        // 顯示提交按鈕的條件：
        // 1. 是最後一題且當前題目已作答
        // 2. 或者所有題目都已作答
        // 3. 或者是最後一題（不論是否作答，讓用戶可以提交）
        if ((isLastQuestion && hasAnsweredCurrentQuestion) ||
            answeredCount === this.questions.length ||
            isLastQuestion) {
            this.submitBtn.classList.remove('hidden');
        } else {
            this.submitBtn.classList.add('hidden');
        }
    }

    /**
     * 開始計時
     */
    startTimer() {
        this.updateTimeDisplay();

        this.timerInterval = setInterval(() => {
            this.timeRemaining--;
            this.updateTimeDisplay();

            if (this.timeRemaining <= 0) {
                this.timeUp();
            }
        }, 1000);
    }

    /**
     * 更新時間顯示
     */
    updateTimeDisplay() {
        if (!this.timer) return;

        const minutes = Math.floor(this.timeRemaining / 60);
        const seconds = this.timeRemaining % 60;

        const timeString = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        this.timer.textContent = timeString;

        // 時間不足時變紅
        if (this.timeRemaining < 300) { // 少於5分鐘
            this.timer.classList.add('text-red-600');
        }
    }

    /**
     * 時間到
     */
    timeUp() {
        clearInterval(this.timerInterval);
        alert('考試時間到！系統將自動提交您的答案。');
        this.submitExam();
    }

    /**
     * 顯示提交確認對話框
     */
    showSubmitModal() {
        const modal = document.getElementById('submitModal');
        if (modal) {
            modal.classList.remove('hidden');
        }
    }

    /**
     * 隱藏提交確認對話框
     */
    hideSubmitModal() {
        const modal = document.getElementById('submitModal');
        if (modal) {
            modal.classList.add('hidden');
        }
    }

    /**
     * 提交考試
     */
    async submitExam() {
        try {
            // 停止計時
            if (this.timerInterval) {
                clearInterval(this.timerInterval);
            }

            // 隱藏確認對話框
            this.hideSubmitModal();

            const endTime = new Date();
            const duration = Math.floor((endTime - this.startTime) / 1000);

            // 進行自動批改
            const results = this.gradeExam();

            // 準備提交到後端的資料
            const resultData = {
                session_data: {
                    grade: this.sessionData.grade,
                    edition: this.sessionData.edition,
                    publisher: this.sessionData.publisher || this.sessionData.edition,
                    subject: this.sessionData.subject,
                    chapter: this.sessionData.chapter,
                    question_count: this.questions.length
                },
                questions: this.questions,
                answers: this.answers,
                results: results,
                time_spent: duration,
                completed_at: endTime.toISOString()
            };

            // 提交到後端（包含PostgreSQL記錄）
            try {
                const submitResult = await learningAPI.submitExerciseResult(resultData);
                if (submitResult.success) {
                    console.log('練習結果已成功提交到後端');
                }
            } catch (error) {
                console.error('提交到後端失敗:', error);
                // 即使後端提交失敗，仍然繼續顯示結果
            }

            // 將結果存儲到 sessionStorage，供結果頁面使用
            sessionStorage.setItem('examResults', JSON.stringify({
                ...results,
                timeSpent: duration,
                submittedAt: endTime.toISOString(),
                sessionData: this.sessionData,
                questions: this.questions,
                userAnswers: this.answers
            }));

            // 跳轉到結果頁面
            window.location.href = 'result.html';

        } catch (error) {
            console.error('提交考試失敗:', error);
            this.showError('提交失敗，請稍後再試');
        }
    }

    /**
     * 自動批改考試
     */
    gradeExam() {
        let correctCount = 0;
        const detailedResults = [];

        this.questions.forEach((question, index) => {
            const userAnswer = this.answers[index];

            // 處理正確答案格式
            let correctAnswer = 0;
            const rawAnswer = (question.answer !== undefined)
                ? question.answer
                : (question.correct_answer !== undefined)
                    ? question.correct_answer
                    : (question.correctAnswer !== undefined)
                        ? question.correctAnswer
                        : 0;

            if (typeof rawAnswer === 'number') {
                correctAnswer = rawAnswer;
            } else if (typeof rawAnswer === 'string') {
                const upper = rawAnswer.toUpperCase().trim();
                const answerMap = { 'A': 0, 'B': 1, 'C': 2, 'D': 3 };
                if (answerMap.hasOwnProperty(upper)) {
                    correctAnswer = answerMap[upper];
                } else if (/^\d+$/.test(upper)) {
                    // 支援數字字串，例如 "0", "1" 等
                    correctAnswer = parseInt(upper, 10);
                } else {
                    correctAnswer = 0;
                }
            }

            const isCorrect = userAnswer === correctAnswer;

            if (isCorrect) {
                correctCount++;
            }

            // 處理選項格式
            let options = [];
            if (Array.isArray(question.options)) {
                options = question.options;
            } else if (typeof question.options === 'object' && question.options !== null) {
                options = Object.values(question.options);
            }
            const normalizeOptionText = (opt) => {
                if (typeof opt === 'string') return opt;
                if (opt && typeof opt === 'object') {
                    if (Object.prototype.hasOwnProperty.call(opt, 'text')) {
                        return String(opt.text);
                    }
                    const values = Object.values(opt);
                    if (values.length > 0) {
                        return String(values[0]);
                    }
                }
                return String(opt);
            };
            options = options.map(normalizeOptionText);

            detailedResults.push({
                questionId: question.id || index + 1,
                questionText: question.question || question.content || question.question_text,
                options: options,
                userAnswer: userAnswer,
                correctAnswer: correctAnswer,
                isCorrect: isCorrect,
                explanation: question.explanation || '暫無解析',
                userAnswerText: userAnswer !== null ? (options[userAnswer] || '未作答') : '未作答',
                correctAnswerText: options[correctAnswer] || '無'
            });
        });

        const accuracy = Math.round((correctCount / this.questions.length) * 100);
        const score = accuracy;

        return {
            score: score,
            accuracy: accuracy,
            totalQuestions: this.questions.length,
            correctAnswers: correctCount,
            wrongAnswers: this.questions.length - correctCount,
            detailedResults: detailedResults
        };
    }

    /**
     * 檢查是否有未儲存的變更
     */
    hasUnsavedChanges() {
        return this.answers.some(answer => answer !== null);
    }

    /**
     * 顯示錯誤訊息
     */
    showError(message) {
        alert(message); // 簡單實現，後續可改為更好的UI
    }

    /**
     * 觸發 MathJax 重新渲染數學公式
     */
    renderMath() {
        if (window.MathJax && window.MathJax.typesetPromise) {
            window.MathJax.typesetPromise().then(() => {
                console.log('MathJax 渲染完成');
            }).catch((err) => {
                console.error('MathJax 渲染失敗:', err);
            });
        }
    }
}

// 頁面載入完成後初始化
document.addEventListener('DOMContentLoaded', () => {
    new ExamPage();
}); 