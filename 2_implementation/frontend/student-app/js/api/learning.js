/**
 * 學習 API 函數
 * 整合 learning-service 的 API 呼叫
 */

// 學習相關 API 客戶端
class LearningAPI {
    constructor() {
        this.baseURL = '/api/v1/learning';
        this.questionBankURL = '/api/v1/questions';
        // 開發環境直接調用服務
        this.directQuestionBankURL = 'http://localhost:8002/api/v1/questions';
    }

    // 取得科目雷達圖資料（analytics）
    async getSubjectRadar({ window = '30d' } = {}) {
        try {
            const params = new URLSearchParams();
            if (window) params.append('window', window);
            const response = await fetch(`${this.baseURL}/analytics/subjects/radar?${params.toString()}`, {
                method: 'GET',
                headers: this.getAuthHeaders()
            });
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return await response.json();
        } catch (error) {
            console.error('獲取雷達圖資料失敗:', error);
            return { window, metrics: [], subjects: [] };
        }
    }

    // 取得科目趨勢資料（analytics）
    async getSubjectTrend({ metric = 'accuracy', window = '30d', limit = 100, subject = null } = {}) {
        try {
            const params = new URLSearchParams();
            if (metric) params.append('metric', metric);
            if (window) params.append('window', window);
            if (limit) params.append('limit', limit);
            if (subject) params.append('subject', subject);
            const response = await fetch(`${this.baseURL}/analytics/subjects/trend?${params.toString()}`, {
                method: 'GET',
                headers: this.getAuthHeaders()
            });
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return await response.json();
        } catch (error) {
            console.error('獲取趨勢圖資料失敗:', error);
            return { window, metric, series: [] };
        }
    }

    // 獲取認證頭
    getAuthHeaders() {
        const token = localStorage.getItem('auth_token');
        return {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        };
    }

    // 檢查題庫數量
    async checkQuestionBank(conditions) {
        try {
            // 構建查詢參數
            const params = new URLSearchParams();
            if (conditions.grade) params.append('grade', conditions.grade);
            if (conditions.edition) params.append('edition', conditions.edition);
            if (conditions.subject) params.append('subject', conditions.subject);
            if (conditions.chapter) params.append('chapter', conditions.chapter);

            // 先嘗試代理 URL，失敗則使用直接 URL
            let response;
            try {
                response = await fetch(`${this.questionBankURL}/check?${params}`, {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json'
                    }
                });
            } catch (proxyError) {
                console.log('代理調用失敗，嘗試直接調用:', proxyError);
                response = await fetch(`${this.directQuestionBankURL}/check?${params}`, {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json'
                    }
                });
            }

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            return result;
        } catch (error) {
            console.error('檢查題庫失敗:', error);
            return {
                success: false,
                error: error.message,
                data: { count: 0, available: false }
            };
        }
    }

    // 根據條件獲取題目
    async getQuestionsByConditions(conditions) {
        try {
            // 構建查詢參數
            const params = new URLSearchParams();
            if (conditions.grade) params.append('grade', conditions.grade);
            if (conditions.edition) params.append('edition', conditions.edition);
            if (conditions.subject) params.append('subject', conditions.subject);
            if (conditions.chapter) params.append('chapter', conditions.chapter);
            if (conditions.questionCount) params.append('questionCount', conditions.questionCount);

            // 先嘗試代理 URL，失敗則使用直接 URL
            let response;
            try {
                response = await fetch(`${this.questionBankURL}/by-conditions?${params}`, {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json'
                    }
                });
            } catch (proxyError) {
                console.log('代理調用失敗，嘗試直接調用:', proxyError);
                response = await fetch(`${this.directQuestionBankURL}/by-conditions?${params}`, {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json'
                    }
                });
            }

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            return result;
        } catch (error) {
            console.error('獲取題目失敗:', error);
            return {
                success: false,
                error: error.message,
                data: []
            };
        }
    }

    // 獲取隨機題目
    async getRandomQuestions(count = 5, filters = {}) {
        try {
            const params = new URLSearchParams({
                count: count,
                ...filters
            });

            const response = await fetch(`${this.questionBankURL}/random?${params}`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const questions = await response.json();
            return {
                success: true,
                data: questions
            };
        } catch (error) {
            console.error('獲取題目失敗:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // 搜索題目
    async searchQuestions(filters = {}, page = 1, limit = 10) {
        try {
            const params = new URLSearchParams({
                page: page,
                limit: limit,
                ...filters
            });

            const response = await fetch(`${this.questionBankURL}/search?${params}`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            return {
                success: true,
                data: result
            };
        } catch (error) {
            console.error('搜索題目失敗:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // 創建學習會話
    async createLearningSession(sessionData) {
        try {
            const response = await fetch(`${this.baseURL}/sessions`, {
                method: 'POST',
                headers: this.getAuthHeaders(),
                body: JSON.stringify(sessionData)
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const session = await response.json();
            return {
                success: true,
                data: session
            };
        } catch (error) {
            console.error('創建學習會話失敗:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // 提交答案並獲取批改結果
    async submitAnswers(sessionId, answers) {
        try {
            const response = await fetch(`${this.baseURL}/exercises/submit`, {
                method: 'POST',
                headers: this.getAuthHeaders(),
                body: JSON.stringify({
                    session_id: sessionId,
                    answers: answers
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            return {
                success: true,
                data: result
            };
        } catch (error) {
            console.error('提交答案失敗:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // 提交完整的練習結果（包含PostgreSQL記錄）
    async submitExerciseResult(resultData) {
        try {
            // 使用正確的API端點路徑
            const response = await fetch('/api/v1/learning/exercises/complete', {
                method: 'POST',
                headers: this.getAuthHeaders(),
                body: JSON.stringify(resultData)
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
            }

            const result = await response.json();
            return {
                success: true,
                data: result
            };
        } catch (error) {
            console.error('提交練習結果失敗:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // 獲取最近的學習記錄
    async getRecentLearningRecords(limit = 5) {
        try {
            const response = await fetch(`${this.baseURL}/recent?limit=${limit}`, {
                headers: this.getAuthHeaders()
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            return {
                success: true,
                data: result
            };
        } catch (error) {
            console.error('獲取最近學習記錄失敗:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // 獲取學習記錄
    async getLearningRecords(filters = {}) {
        try {
            // 處理分頁參數
            const page = filters.page || 1;
            const page_size = filters.page_size || filters.limit || 20;

            // 構建查詢參數
            const params = new URLSearchParams();

            // 分頁參數
            params.append('page', page);
            params.append('page_size', page_size);

            // 篩選參數
            if (filters.subject) params.append('subject', filters.subject);
            if (filters.grade) params.append('grade', filters.grade);
            if (filters.publisher) params.append('publisher', filters.publisher);
            if (filters.start_date) params.append('start_date', filters.start_date);
            if (filters.end_date) params.append('end_date', filters.end_date);

            const response = await fetch(`${this.baseURL}/records?${params}`, {
                headers: this.getAuthHeaders()
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            return {
                success: true,
                data: result
            };
        } catch (error) {
            console.error('獲取學習記錄失敗:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // 獲取會話詳細資訊
    async getSessionDetail(sessionId) {
        try {
            const response = await fetch(`${this.baseURL}/records/${sessionId}`, {
                headers: this.getAuthHeaders()
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            return {
                success: true,
                data: result
            };
        } catch (error) {
            console.error('獲取會話詳情失敗:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // 獲取學習統計
    async getLearningStatistics() {
        try {
            const response = await fetch(`${this.baseURL}/statistics`, {
                headers: this.getAuthHeaders()
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const statistics = await response.json();
            return {
                success: true,
                data: statistics
            };
        } catch (error) {
            console.error('獲取學習統計失敗:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // 取得使用者已作答過的題目 ID（可帶科目/年級/出版社/章節過濾）
    async getDoneQuestionIds(filters = {}) {
        try {
            const params = new URLSearchParams();
            if (filters.subject) params.append('subject', filters.subject);
            if (filters.grade) params.append('grade', filters.grade);
            if (filters.publisher || filters.edition) params.append('publisher', filters.publisher || filters.edition);
            if (filters.chapter) params.append('chapter', filters.chapter);
            if (filters.since_days) params.append('since_days', filters.since_days);

            const response = await fetch(`${this.baseURL}/records/done-questions?${params.toString()}`, {
                headers: this.getAuthHeaders()
            });
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const result = await response.json();
            return result;
        } catch (error) {
            console.error('取得已作答題目ID失敗:', error);
            return { success: false, data: { question_ids: [], count: 0 }, error: error.message };
        }
    }

    // 可用題數彙總：total/done/unseen
    async getAvailabilitySummary(filters = {}) {
        try {
            const params = new URLSearchParams();
            if (filters.grade) params.append('grade', filters.grade);
            if (filters.subject) params.append('subject', filters.subject);
            if (filters.publisher || filters.edition) params.append('publisher', filters.publisher || filters.edition);
            if (filters.chapter) params.append('chapter', filters.chapter);

            const response = await fetch(`${this.baseURL}/availability/summary?${params.toString()}`, {
                headers: this.getAuthHeaders()
            });
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return await response.json();
        } catch (error) {
            console.error('取得題庫彙總失敗:', error);
            return { success: false, data: { total: 0, done: 0, unseen: 0 }, error: error.message };
        }
    }

    // 服務端過濾：依條件出題並排除指定題目ID
    async getQuestionsByConditionsExcluding(payload = {}) {
        try {
            const body = {
                grade: payload.grade,
                subject: payload.subject,
                publisher: payload.publisher || payload.edition,
                chapter: payload.chapter,
                questionCount: payload.questionCount || payload.question_count,
                excludeIds: payload.excludeIds || payload.exclude_ids || []
            };

            const response = await fetch(`${this.baseURL}/questions/by-conditions-excluding`, {
                method: 'POST',
                headers: this.getAuthHeaders(),
                body: JSON.stringify(body)
            });
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const result = await response.json();
            return result;
        } catch (error) {
            console.error('服務端過濾抓題失敗:', error);
            return { success: false, data: [], error: error.message };
        }
    }
}

// 創建全局實例
window.learningAPI = new LearningAPI(); 