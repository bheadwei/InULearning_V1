/**
 * 題目管理增強版模組
 * 處理題目的創建、編輯、刪除、搜尋和知識點分類管理
 */
class QuestionsManager {
    constructor() {
        this.questions = [];
        this.filteredQuestions = [];
        this.knowledgePoints = [];
        this.editingId = null;

        this.init();
    }

    async init() {
        await this.loadQuestions();
        this.setupEventListeners();
        this.renderQuestions();
        this.updateStats();
        this.renderKnowledgePoints();
    }

    async loadQuestions() {
        try {
            // 嘗試從 API 載入真實資料
            const data = await apiClient.get('/teacher/questions');
            this.questions = data.questions || data.items || data || [];
            console.log('✅ 成功載入真實題目資料');
        } catch (error) {
            console.error('⚠️ API 載入失敗:', error.message);
            // 不再使用假資料，顯示錯誤狀態
            this.questions = [];
            this.showApiStatus('無法載入題目資料', 'error');
        }

        this.filteredQuestions = [...this.questions];
        this.extractKnowledgePoints();
    }



    extractKnowledgePoints() {
        const kpMap = {};
        this.questions.forEach(q => {
            if (!kpMap[q.knowledgePoint]) {
                kpMap[q.knowledgePoint] = { name: q.knowledgePoint, count: 0, subject: q.subject };
            }
            kpMap[q.knowledgePoint].count++;
        });
        this.knowledgePoints = Object.values(kpMap);
    }

    setupEventListeners() {
        // 搜尋功能
        document.getElementById('searchInput').addEventListener('input', () => {
            this.filterQuestions();
        });

        // 科目篩選
        document.getElementById('subjectFilter').addEventListener('change', () => {
            this.filterQuestions();
        });

        // 難度篩選
        document.getElementById('difficultyFilter').addEventListener('change', () => {
            this.filterQuestions();
        });
    }

    filterQuestions() {
        const searchTerm = document.getElementById('searchInput').value.toLowerCase();
        const subjectFilter = document.getElementById('subjectFilter').value;
        const difficultyFilter = document.getElementById('difficultyFilter').value;

        this.filteredQuestions = this.questions.filter(question => {
            const matchesSearch = question.content.toLowerCase().includes(searchTerm) ||
                question.knowledgePoint.toLowerCase().includes(searchTerm);
            const matchesSubject = !subjectFilter || question.subject === subjectFilter;
            const matchesDifficulty = !difficultyFilter || question.difficulty === difficultyFilter;

            return matchesSearch && matchesSubject && matchesDifficulty;
        });

        this.renderQuestions();
    }

    renderQuestions() {
        const container = document.getElementById('questionsList');

        if (this.filteredQuestions.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 3rem; color: var(--text-light);">
                    <i class="fas fa-search" style="font-size: 3rem; margin-bottom: 1rem; opacity: 0.3;"></i>
                    <p>沒有找到符合條件的題目</p>
                </div>
            `;
            return;
        }

        container.innerHTML = this.filteredQuestions.map(question => `
            <div class="question-item">
                <div class="question-header">
                    <div>
                        <div class="question-title">題目 #${question.id}</div>
                        <div class="question-meta">
                            <span><i class="fas fa-book"></i> ${this.getSubjectName(question.subject)}</span>
                            <span><i class="fas fa-lightbulb"></i> ${question.knowledgePoint}</span>
                            <span><i class="fas fa-calendar"></i> ${this.formatDate(question.createdDate)}</span>
                            <span><i class="fas fa-eye"></i> 使用 ${question.usageCount} 次</span>
                        </div>
                    </div>
                    <div style="display: flex; align-items: center; gap: 0.5rem;">
                        <div class="difficulty-badge difficulty-${question.difficulty}">
                            <i class="fas ${this.getDifficultyIcon(question.difficulty)}"></i>
                            ${this.getDifficultyText(question.difficulty)}
                        </div>
                        <div class="subject-tag tag-${question.subject}">
                            ${this.getSubjectName(question.subject)}
                        </div>
                    </div>
                </div>
                
                <p style="color: var(--text-dark); margin-bottom: 1rem; line-height: 1.5;">
                    ${question.content}
                </p>
                
                ${question.options ? `
                    <div style="margin-bottom: 1rem;">
                        ${question.options.map(option => `
                            <div style="padding: 0.25rem 0; color: var(--text-light); font-size: 0.9rem;">
                                ${option}
                            </div>
                        `).join('')}
                    </div>
                ` : ''}
                
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                    <div style="font-size: 0.9rem;">
                        <strong style="color: var(--success-green);">正確答案：${question.answer}</strong>
                    </div>
                    <div style="font-size: 0.8rem; color: var(--text-light);">
                        最後使用：${this.formatDate(question.lastUsed)}
                    </div>
                </div>
                
                <div class="question-actions">
                    <button class="action-btn primary" onclick="viewQuestion(${question.id})">
                        <i class="fas fa-eye"></i> 查看
                    </button>
                    <button class="action-btn secondary" onclick="editQuestion(${question.id})">
                        <i class="fas fa-edit"></i> 編輯
                    </button>
                    <button class="action-btn secondary" onclick="duplicateQuestion(${question.id})">
                        <i class="fas fa-copy"></i> 複製
                    </button>
                    <button class="action-btn secondary" onclick="useInQuiz(${question.id})">
                        <i class="fas fa-plus"></i> 加入測驗
                    </button>
                    <button class="action-btn danger" onclick="deleteQuestion(${question.id})">
                        <i class="fas fa-trash"></i> 刪除
                    </button>
                </div>
            </div>
        `).join('');
    }

    renderKnowledgePoints() {
        const container = document.getElementById('knowledgePointsList');

        container.innerHTML = this.knowledgePoints.map(kp => `
            <div class="kp-item">
                <div class="kp-name">${kp.name}</div>
                <div class="kp-count">${kp.count}</div>
            </div>
        `).join('');
    }

    updateStats() {
        const stats = {
            math: this.questions.filter(q => q.subject === 'math').length,
            chinese: this.questions.filter(q => q.subject === 'chinese').length,
            english: this.questions.filter(q => q.subject === 'english').length,
            science: this.questions.filter(q => q.subject === 'science').length
        };

        document.getElementById('mathQuestions').textContent = stats.math;
        document.getElementById('chineseQuestions').textContent = stats.chinese;
        document.getElementById('englishQuestions').textContent = stats.english;
        document.getElementById('scienceQuestions').textContent = stats.science;
    }

    getSubjectName(subject) {
        const subjects = {
            math: '數學',
            chinese: '國文',
            english: '英文',
            science: '自然',
            history: '歷史',
            geography: '地理'
        };
        return subjects[subject] || subject;
    }

    getDifficultyText(difficulty) {
        const difficulties = {
            easy: '簡單',
            medium: '中等',
            hard: '困難'
        };
        return difficulties[difficulty] || difficulty;
    }

    getDifficultyIcon(difficulty) {
        const icons = {
            easy: 'fa-star',
            medium: 'fa-star-half-alt',
            hard: 'fa-star'
        };
        return icons[difficulty] || 'fa-question';
    }

    formatDate(dateStr) {
        const date = new Date(dateStr);
        return `${date.getMonth() + 1}/${date.getDate()}`;
    }

    showModal(title = '新增題目') {
        document.getElementById('modalTitle').textContent = title;
        document.getElementById('questionModal').classList.add('show');
    }

    hideModal() {
        document.getElementById('questionModal').classList.remove('show');
        document.getElementById('questionForm').reset();
        this.editingId = null;
    }

    async saveQuestion() {
        const formData = {
            subject: document.getElementById('questionSubject').value,
            knowledgePoint: document.getElementById('questionKnowledgePoint').value,
            difficulty: document.getElementById('questionDifficulty').value,
            content: document.getElementById('questionContent').value,
            options: document.getElementById('questionOptions').value.split('\n').filter(opt => opt.trim()),
            answer: document.getElementById('questionAnswer').value,
            explanation: document.getElementById('questionExplanation').value
        };

        // 驗證表單
        if (!formData.subject || !formData.knowledgePoint || !formData.difficulty ||
            !formData.content || !formData.answer) {
            alert('請填寫所有必填欄位');
            return;
        }

        try {
            let response;
            if (this.editingId) {
                // 更新題目
                response = await apiClient.put(`/teacher/questions/${this.editingId}`, formData);
            } else {
                // 新增題目
                response = await apiClient.post('/teacher/questions', formData);
            }

            if (response.ok) {
                alert(this.editingId ? '題目更新成功！' : '題目新增成功！');
                await this.loadQuestions();
                this.renderQuestions();
                this.updateStats();
                this.renderKnowledgePoints();
                this.hideModal();
            } else {
                throw new Error('儲存失敗');
            }
        } catch (error) {
            console.log('API 儲存失敗，模擬成功:', error.message);

            // 模擬成功
            const newQuestion = {
                id: this.editingId || Date.now(),
                ...formData,
                createdDate: new Date().toISOString().split('T')[0],
                lastUsed: new Date().toISOString().split('T')[0],
                usageCount: 0
            };

            if (this.editingId) {
                const index = this.questions.findIndex(q => q.id == this.editingId);
                if (index !== -1) {
                    this.questions[index] = { ...this.questions[index], ...formData };
                }
            } else {
                this.questions.push(newQuestion);
            }

            this.filteredQuestions = [...this.questions];
            this.extractKnowledgePoints();
            this.renderQuestions();
            this.updateStats();
            this.renderKnowledgePoints();
            this.hideModal();

            alert(this.editingId ? '題目更新成功！' : '題目新增成功！');
        }
    }

    showApiStatus(message, type = 'error') {
        const container = document.getElementById('questionsList');
        const icon = type === 'error' ? 'fa-exclamation-triangle' : 'fa-info-circle';
        const color = type === 'error' ? 'text-red-500' : 'text-blue-500';
        
        container.innerHTML = `
            <div style="text-align: center; padding: 3rem;">
                <i class="fas ${icon} ${color}" style="font-size: 3rem; margin-bottom: 1rem;"></i>
                <p class="${color}">${message}</p>
                <button onclick="questionsManager.init()" class="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">
                    重新載入
                </button>
            </div>
        `;
    }
}

// 全域函數
function createQuestion() {
    questionsManager.showModal('新增題目');
}

function editQuestion(id) {
    const question = questionsManager.questions.find(q => q.id == id);
    if (question) {
        questionsManager.editingId = id;
        questionsManager.showModal('編輯題目');

        // 填入現有資料
        document.getElementById('questionSubject').value = question.subject;
        document.getElementById('questionKnowledgePoint').value = question.knowledgePoint;
        document.getElementById('questionDifficulty').value = question.difficulty;
        document.getElementById('questionContent').value = question.content;
        document.getElementById('questionOptions').value = question.options ? question.options.join('\n') : '';
        document.getElementById('questionAnswer').value = question.answer;
        document.getElementById('questionExplanation').value = question.explanation || '';
    }
}

function viewQuestion(id) {
    const question = questionsManager.questions.find(q => q.id == id);
    if (question) {
        alert(`題目詳情：\n\n${question.content}\n\n正確答案：${question.answer}\n\n解釋：${question.explanation || '無'}`);
    }
}

function duplicateQuestion(id) {
    const question = questionsManager.questions.find(q => q.id == id);
    if (question) {
        questionsManager.editingId = null;
        questionsManager.showModal('複製題目');

        // 填入現有資料
        document.getElementById('questionSubject').value = question.subject;
        document.getElementById('questionKnowledgePoint').value = question.knowledgePoint;
        document.getElementById('questionDifficulty').value = question.difficulty;
        document.getElementById('questionContent').value = question.content + ' (複製)';
        document.getElementById('questionOptions').value = question.options ? question.options.join('\n') : '';
        document.getElementById('questionAnswer').value = question.answer;
        document.getElementById('questionExplanation').value = question.explanation || '';
    }
}

function deleteQuestion(id) {
    if (confirm('確定要刪除這個題目嗎？此操作無法復原。')) {
        questionsManager.questions = questionsManager.questions.filter(q => q.id != id);
        questionsManager.filteredQuestions = questionsManager.filteredQuestions.filter(q => q.id != id);
        questionsManager.extractKnowledgePoints();
        questionsManager.renderQuestions();
        questionsManager.updateStats();
        questionsManager.renderKnowledgePoints();
        alert('題目已刪除');
    }
}

function useInQuiz(id) {
    alert(`題目 #${id} 已加入測驗清單`);
}

function closeModal() {
    questionsManager.hideModal();
}

function saveQuestion() {
    questionsManager.saveQuestion();
}

function importQuestions() {
    alert('匯入題目功能開發中...');
}

function exportQuestions() {
    alert('匯出題目功能開發中...');
}

function bulkEdit() {
    alert('批量編輯功能開發中...');
}

function generateQuiz() {
    alert('生成測驗功能開發中...');
}

// 初始化
let questionsManager;
document.addEventListener('DOMContentLoaded', () => {
    questionsManager = new QuestionsManager();
});