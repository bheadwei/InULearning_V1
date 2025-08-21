/**
 * 成績管理增強版模組
 * 處理學生成績的顯示、分析、圖表化和趨勢追蹤
 */
class GradesManager {
    constructor() {
        this.grades = [];
        this.filteredGrades = [];
        this.chart = null;

        this.init();
    }

    async init() {
        await this.loadGrades();
        this.setupEventListeners();
        this.renderGrades();
        this.updateStats();
        this.initChart();
    }

    async loadGrades() {
        // 顯示加載狀態
        this.showLoadingState();
        
        try {
            // 嘗試從 API 載入真實資料
            const data = await apiClient.get('/teacher/grades');
            this.grades = data.grades || data.students || data || [];
            console.log('✅ 成功載入真實成績資料');
            
            // 如果成功但沒有數據，顯示空狀態
            if (this.grades.length === 0) {
                this.showEmptyState();
            }
        } catch (error) {
            console.error('⚠️ API 載入失敗:', error.message);
            // 不再使用假資料，顯示錯誤狀態
            this.grades = [];
            this.showApiStatus('無法載入成績資料', 'error');
        }

        this.filteredGrades = [...this.grades];
    }



    setupEventListeners() {
        // 搜尋功能
        document.getElementById('searchInput').addEventListener('input', () => {
            this.filterGrades();
        });

        // 科目篩選
        document.getElementById('subjectFilter').addEventListener('change', () => {
            this.filterGrades();
        });

        // 成績篩選
        document.getElementById('gradeFilter').addEventListener('change', () => {
            this.filterGrades();
        });

        // 圖表控制
        document.querySelectorAll('.chart-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.chart-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.updateChart(e.target.dataset.period);
            });
        });
    }

    filterGrades() {
        const searchTerm = document.getElementById('searchInput').value.toLowerCase();
        const subjectFilter = document.getElementById('subjectFilter').value;
        const gradeFilter = document.getElementById('gradeFilter').value;

        this.filteredGrades = this.grades.filter(student => {
            const matchesSearch = student.name.toLowerCase().includes(searchTerm) ||
                student.studentId.toLowerCase().includes(searchTerm);

            let matchesGrade = true;
            if (gradeFilter) {
                const avg = student.average;
                switch (gradeFilter) {
                    case 'excellent':
                        matchesGrade = avg >= 90;
                        break;
                    case 'good':
                        matchesGrade = avg >= 80 && avg < 90;
                        break;
                    case 'average':
                        matchesGrade = avg >= 70 && avg < 80;
                        break;
                    case 'poor':
                        matchesGrade = avg < 70;
                        break;
                }
            }

            return matchesSearch && matchesGrade;
        });

        this.renderGrades();
    }

    renderGrades() {
        const tbody = document.getElementById('gradesTableBody');

        if (this.filteredGrades.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="8" style="text-align: center; padding: 3rem; color: var(--text-light);">
                        <i class="fas fa-search" style="font-size: 3rem; margin-bottom: 1rem; opacity: 0.3;"></i>
                        <p>沒有找到符合條件的學生</p>
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = this.filteredGrades.map(student => `
            <tr>
                <td>
                    <div class="student-info">
                        <div class="student-avatar">
                            ${student.name.charAt(student.name.length - 1)}
                        </div>
                        <div class="student-details">
                            <h4>${student.name}</h4>
                            <p>${student.studentId} - ${student.class}</p>
                        </div>
                    </div>
                </td>
                <td class="grade-cell ${this.getGradeClass(student.grades.math)}">
                    ${student.grades.math}
                </td>
                <td class="grade-cell ${this.getGradeClass(student.grades.chinese)}">
                    ${student.grades.chinese}
                </td>
                <td class="grade-cell ${this.getGradeClass(student.grades.english)}">
                    ${student.grades.english}
                </td>
                <td class="grade-cell ${this.getGradeClass(student.grades.science)}">
                    ${student.grades.science}
                </td>
                <td class="grade-cell ${this.getGradeClass(student.average)}">
                    <strong>${student.average.toFixed(1)}</strong>
                </td>
                <td>
                    <div class="trend-indicator trend-${student.trend}">
                        <i class="fas ${this.getTrendIcon(student.trend)}"></i>
                        ${this.getTrendText(student.trend)}
                    </div>
                </td>
                <td>
                    <button class="action-btn primary" onclick="viewGradeDetail(${student.id})" style="padding: 0.25rem 0.5rem; font-size: 0.8rem;">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="action-btn secondary" onclick="editGrades(${student.id})" style="padding: 0.25rem 0.5rem; font-size: 0.8rem;">
                        <i class="fas fa-edit"></i>
                    </button>
                </td>
            </tr>
        `).join('');
    }

    updateStats() {
        const stats = {
            excellent: this.grades.filter(s => s.average >= 90).length,
            good: this.grades.filter(s => s.average >= 80 && s.average < 90).length,
            average: this.grades.filter(s => s.average >= 70 && s.average < 80).length,
            poor: this.grades.filter(s => s.average < 70).length
        };

        document.getElementById('excellentCount').textContent = stats.excellent;
        document.getElementById('goodCount').textContent = stats.good;
        document.getElementById('averageCount').textContent = stats.average;
        document.getElementById('poorCount').textContent = stats.poor;

        // 更新班級摘要
        const allAverages = this.grades.map(s => s.average);
        const classAverage = allAverages.reduce((sum, avg) => sum + avg, 0) / allAverages.length;
        const highestScore = Math.max(...allAverages);
        const lowestScore = Math.min(...allAverages);
        const passRate = (this.grades.filter(s => s.average >= 60).length / this.grades.length) * 100;

        document.getElementById('classAverage').textContent = classAverage.toFixed(1);
        document.getElementById('highestScore').textContent = highestScore.toFixed(1);
        document.getElementById('lowestScore').textContent = lowestScore.toFixed(1);
        document.getElementById('passRate').textContent = passRate.toFixed(1) + '%';
    }

    initChart() {
        const ctx = document.getElementById('gradesChart').getContext('2d');

        this.chart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: ['第1週', '第2週', '第3週', '第4週', '第5週', '第6週', '第7週', '第8週'],
                datasets: [{
                    label: '班級平均',
                    data: [78, 80, 82, 81, 83, 85, 84, 86],
                    borderColor: '#3B82F6',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    tension: 0.4,
                    fill: true
                }, {
                    label: '數學平均',
                    data: [75, 77, 79, 78, 80, 82, 81, 83],
                    borderColor: '#10B981',
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    tension: 0.4
                }, {
                    label: '國文平均',
                    data: [80, 82, 84, 83, 85, 87, 86, 88],
                    borderColor: '#F59E0B',
                    backgroundColor: 'rgba(245, 158, 11, 0.1)',
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'top',
                    },
                    title: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: false,
                        min: 60,
                        max: 100,
                        grid: {
                            color: '#F3F4F6'
                        }
                    },
                    x: {
                        grid: {
                            color: '#F3F4F6'
                        }
                    }
                },
                elements: {
                    point: {
                        radius: 4,
                        hoverRadius: 6
                    }
                }
            }
        });
    }

    updateChart(period) {
        let labels, data1, data2, data3;

        switch (period) {
            case 'week':
                labels = ['第1週', '第2週', '第3週', '第4週', '第5週', '第6週', '第7週', '第8週'];
                data1 = [78, 80, 82, 81, 83, 85, 84, 86];
                data2 = [75, 77, 79, 78, 80, 82, 81, 83];
                data3 = [80, 82, 84, 83, 85, 87, 86, 88];
                break;
            case 'month':
                labels = ['1月', '2月', '3月', '4月', '5月', '6月'];
                data1 = [76, 78, 81, 83, 85, 87];
                data2 = [74, 76, 79, 81, 83, 85];
                data3 = [78, 80, 83, 85, 87, 89];
                break;
            case 'semester':
                labels = ['第1次段考', '第2次段考', '第3次段考', '期末考'];
                data1 = [79, 82, 85, 87];
                data2 = [77, 80, 83, 85];
                data3 = [81, 84, 87, 89];
                break;
        }

        this.chart.data.labels = labels;
        this.chart.data.datasets[0].data = data1;
        this.chart.data.datasets[1].data = data2;
        this.chart.data.datasets[2].data = data3;
        this.chart.update();
    }

    getGradeClass(score) {
        if (score >= 90) return 'grade-excellent';
        if (score >= 80) return 'grade-good';
        if (score >= 70) return 'grade-average';
        return 'grade-poor';
    }

    getTrendIcon(trend) {
        const icons = {
            up: 'fa-arrow-up',
            down: 'fa-arrow-down',
            stable: 'fa-minus'
        };
        return icons[trend] || 'fa-minus';
    }

    getTrendText(trend) {
        const texts = {
            up: '上升',
            down: '下降',
            stable: '持平'
        };
        return texts[trend] || '持平';
    }

    showApiStatus(message, type = 'error') {
        const tbody = document.getElementById('gradesTableBody');
        const icon = type === 'error' ? 'fa-exclamation-triangle' : 'fa-info-circle';
        const color = type === 'error' ? 'text-red-500' : 'text-blue-500';
        
        tbody.innerHTML = `
            <tr>
                <td colspan="8" style="text-align: center; padding: 3rem;">
                    <i class="fas ${icon} ${color}" style="font-size: 3rem; margin-bottom: 1rem;"></i>
                    <p class="${color}">${message}</p>
                    <button onclick="gradesManager.init()" class="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">
                        重新載入
                    </button>
                </td>
            </tr>
        `;
    }

    showLoadingState() {
        const tbody = document.getElementById('gradesTableBody');
        tbody.innerHTML = `
            <tr>
                <td colspan="8" style="text-align: center; padding: 3rem;">
                    <div class="flex items-center justify-center space-x-3">
                        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                        <span class="text-gray-600 font-medium">載入成績資料中...</span>
                    </div>
                </td>
            </tr>
        `;
    }

    showEmptyState() {
        const tbody = document.getElementById('gradesTableBody');
        tbody.innerHTML = `
            <tr>
                <td colspan="8" style="text-align: center; padding: 3rem;">
                    <i class="fas fa-file-alt text-gray-400" style="font-size: 3rem; margin-bottom: 1rem;"></i>
                    <p class="text-gray-500 mb-4">暫無成績資料</p>
                    <button onclick="gradesManager.init()" class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">
                        重新載入
                    </button>
                </td>
            </tr>
        `;
    }
}

// 全域函數
function viewGradeDetail(studentId) {
    const student = gradesManager.grades.find(s => s.id === studentId);
    if (student) {
        alert(`${student.name} 詳細成績：\n\n數學：${student.grades.math}\n國文：${student.grades.chinese}\n英文：${student.grades.english}\n自然：${student.grades.science}\n\n平均：${student.average.toFixed(1)}`);
    }
}

function editGrades(studentId) {
    alert(`編輯學生 ID ${studentId} 的成績功能開發中...`);
}

function inputGrades() {
    alert('輸入成績功能開發中...');
}

function batchInput() {
    alert('批量輸入功能開發中...');
}

function exportGrades() {
    alert('匯出成績功能開發中...');
}

function generateReport() {
    alert('生成報告功能開發中...');
}

function sendNotifications() {
    alert('通知家長功能開發中...');
}

// 初始化
let gradesManager;
document.addEventListener('DOMContentLoaded', () => {
    gradesManager = new GradesManager();
});