/**
 * AI 分析 API 函數
 * 整合 ai-analysis-service 的 API 呼叫
 */

// AI 分析 API 客戶端
class AIAnalysisAPI {
    constructor() {
        // 經由 API Gateway (nginx，對外 http://localhost/api) 做反向代理
        // 避免在 8080 靜態前端容器上以相對路徑呼叫造成 502
        this.baseURL = (window?.Utils?.config?.API_BASE_URL) || 'http://localhost/api/v1';
        this.aiBase = `${this.baseURL}/ai`;
    }

    // 獲取認證頭
    getAuthHeaders() {
        const token = localStorage.getItem('auth_token');
        return {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        };
    }

    // 單題 AI 弱點分析
    async analyzeQuestionWeakness(question, studentAnswer, temperature = 1.0, maxOutputTokens = 512) {
        try {
            const response = await fetch(`${this.baseURL}/weakness-analysis/question-analysis`, {
                method: 'POST',
                headers: this.getAuthHeaders(),
                body: JSON.stringify({
                    question: question,
                    student_answer: studentAnswer,
                    temperature: temperature,
                    max_output_tokens: maxOutputTokens
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            return result;
        } catch (error) {
            console.error('AI 弱點分析失敗:', error);
            return {
                success: false,
                error: error.message,
                data: {
                    "學生學習狀況評估": "AI 分析暫時無法使用，請稍後再試。"
                }
            };
        }
    }

    // 單題學習建議
    async getQuestionGuidance(question, studentAnswer, temperature = 1.0, maxOutputTokens = 512) {
        try {
            const response = await fetch(`${this.baseURL}/learning-recommendation/question-guidance`, {
                method: 'POST',
                headers: this.getAuthHeaders(),
                body: JSON.stringify({
                    question: question,
                    student_answer: studentAnswer,
                    temperature: temperature,
                    max_output_tokens: maxOutputTokens
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            return result;
        } catch (error) {
            console.error('學習建議生成失敗:', error);
            return {
                success: false,
                error: error.message,
                data: {
                    "題目詳解與教學建議": "學習建議暫時無法生成，請稍後再試。"
                }
            };
        }
    }

    // 獲取學習分析報告
    async getLearningAnalysis(userId, options = {}) {
        try {
            const response = await fetch(`${this.baseURL}/weakness-analysis/analyze`, {
                method: 'POST',
                headers: this.getAuthHeaders(),
                body: JSON.stringify({
                    user_id: userId,
                    ...options
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            return result;
        } catch (error) {
            console.error('學習分析失敗:', error);
            return {
                success: false,
                message: "AI分析功能暫時無法使用，請稍後再試！",
                status: "error",
                error: error.message
            };
        }
    }

    // 獲取學習建議
    async getLearningRecommendations(userId, subject = null) {
        try {
            const response = await fetch(`${this.baseURL}/learning-recommendation/generate`, {
                method: 'POST',
                headers: this.getAuthHeaders(),
                body: JSON.stringify({
                    user_id: userId,
                    subject: subject
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            return result;
        } catch (error) {
            console.error('學習建議獲取失敗:', error);
            return {
                success: false,
                message: "AI學習建議功能暫時無法使用，請稍後再試！",
                status: "error",
                error: error.message
            };
        }
    }

    // 獲取錯題分析
    async getErrorAnalysis(userId, timeRange = 30) {
        try {
            const response = await fetch(`${this.baseURL}/weakness-analysis/user/${userId}/history?limit=${timeRange}`, {
                method: 'GET',
                headers: this.getAuthHeaders()
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            return result;
        } catch (error) {
            console.error('錯題分析失敗:', error);
            return {
                success: false,
                message: "AI錯題分析功能暫時無法使用，請稍後再試！",
                status: "error",
                error: error.message
            };
        }
    }

    // 獲取學習進度預測
    async getLearningProgress(userId, targetGoals = []) {
        try {
            const response = await fetch(`${this.baseURL}/trend-analysis/progress/${userId}`, {
                method: 'POST',
                headers: this.getAuthHeaders(),
                body: JSON.stringify({
                    target_goals: targetGoals
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            return result;
        } catch (error) {
            console.error('學習進度預測失敗:', error);
            return {
                success: false,
                message: "AI學習進度預測功能暫時無法使用，請稍後再試！",
                status: "error",
                error: error.message
            };
        }
    }

    // ================= 新增：基於 exercise_record 的非同步任務 API =================

    // 觸發 AI 分析任務（以 exercise_record_id 為來源）
    async triggerAnalysisByRecord(exerciseRecordId) {
        try {
            const response = await fetch(`${this.aiBase}/analysis`, {
                method: 'POST',
                headers: this.getAuthHeaders(),
                body: JSON.stringify({ exercise_record_id: exerciseRecordId })
            });

            if (!response.ok) {
                const txt = await response.text();
                throw new Error(`HTTP ${response.status}: ${txt}`);
            }

            const result = await response.json();
            return {
                success: true,
                task_id: result.task_id,
                message: result.message
            };
        } catch (error) {
            console.error('觸發 AI 分析任務失敗:', error);
            return { success: false, error: error.message };
        }
    }

    // 查詢任務狀態
    async getAnalysisStatus(taskId) {
        try {
            const response = await fetch(`${this.aiBase}/analysis/${taskId}`, {
                method: 'GET',
                headers: this.getAuthHeaders()
            });

            if (!response.ok) {
                const txt = await response.text();
                throw new Error(`HTTP ${response.status}: ${txt}`);
            }

            const result = await response.json();
            return { success: true, ...result };
        } catch (error) {
            console.error('查詢 AI 任務狀態失敗:', error);
            return { success: false, error: error.message };
        }
    }

    // 依據 exercise_record_id 查詢最新結果
    async getLatestAnalysisByRecord(exerciseRecordId) {
        try {
            const response = await fetch(`${this.aiBase}/analysis/by-record/${exerciseRecordId}`, {
                method: 'GET',
                headers: this.getAuthHeaders()
            });

            if (!response.ok) {
                const txt = await response.text();
                throw new Error(`HTTP ${response.status}: ${txt}`);
            }

            const result = await response.json();
            return { success: true, ...result };
        } catch (error) {
            console.error('查詢最新 AI 分析結果失敗:', error);
            return { success: false, error: error.message };
        }
    }

    // ================= 新增：單一端點一次生成並持久化 =================

    async generateCombinedAnalysis(question, studentAnswer, exerciseRecordId, temperature = 1.0, maxOutputTokens = 512) {
        try {
            const response = await fetch(`${this.aiBase}/analysis/generate`, {
                method: 'POST',
                headers: this.getAuthHeaders(),
                body: JSON.stringify({
                    question: question,
                    student_answer: studentAnswer,
                    temperature: temperature,
                    max_output_tokens: maxOutputTokens,
                    exercise_record_id: exerciseRecordId
                })
            });

            if (!response.ok) {
                const txt = await response.text();
                throw new Error(`HTTP ${response.status}: ${txt}`);
            }

            const result = await response.json();
            return { success: true, ...result };
        } catch (error) {
            console.error('整合端點生成失敗:', error);
            return { success: false, error: error.message };
        }
    }

    // 顯示開發中提示
    showUnderDevelopmentModal(feature = "AI分析") {
        const modal = document.createElement('div');
        modal.className = 'fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50';
        modal.id = 'aiAnalysisModal';

        modal.innerHTML = `
            <div class="relative top-20 mx-auto p-5 border w-11/12 md:w-1/2 shadow-lg rounded-md bg-white">
                <div class="mt-3 text-center">
                    <div class="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-blue-100 mb-4">
                        <svg class="h-6 w-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                        </svg>
                    </div>
                    <h3 class="text-lg leading-6 font-medium text-gray-900 mb-2">${feature}功能開發中</h3>
                    <div class="mt-2 px-7 py-3">
                        <p class="text-sm text-gray-500 mb-4">
                            我們正在努力開發這個功能，將為您提供更智能的學習體驗！
                        </p>
                        <div class="text-left">
                            <h4 class="font-semibold text-gray-700 mb-2">即將推出的功能：</h4>
                            <ul class="text-sm text-gray-600 space-y-1">
                                <li>• 個性化學習分析</li>
                                <li>• 智能學習建議</li>
                                <li>• 學習弱點識別</li>
                                <li>• 學習效率優化</li>
                                <li>• 知識點掌握度評估</li>
                            </ul>
                        </div>
                        <div class="mt-4 p-3 bg-blue-50 rounded-lg">
                            <p class="text-sm text-blue-700">
                                <strong>預計上線時間：</strong> 2024年第二季
                            </p>
                        </div>
                    </div>
                    <div class="items-center px-4 py-3">
                        <button id="closeAIModal" class="px-4 py-2 bg-blue-500 text-white text-base font-medium rounded-md w-full shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-300">
                            我知道了
                        </button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // 綁定關閉事件
        const closeBtn = document.getElementById('closeAIModal');
        const closeModal = () => {
            document.body.removeChild(modal);
        };

        closeBtn.addEventListener('click', closeModal);
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeModal();
            }
        });
    }
}

// 創建全局實例
window.aiAnalysisAPI = new AIAnalysisAPI(); 