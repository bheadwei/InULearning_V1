/**
 * 學習分析增強版模組
 * 處理學習數據分析、圖表展示、趨勢追蹤和洞察建議
 */
class AnalyticsManager {
    constructor() {
        this.charts = {};
        this.currentPeriod = 'week';
        this.currentMetric = 'performance';

        this.init();
    }

    async init() {
        await this.loadAnalyticsData();
        this.setupEventListeners();
        this.initCharts();
        this.renderKnowledgePoints();
        this.renderStudentRanking();
        this.renderInsights();
    }

    async loadAnalyticsData() {
        try {
            // 嘗試從 API 載入真實資料
            this.data = await apiClient.get('/teacher/analytics');
            console.log('✅ 成功載入真實分析資料');
        } catch (error) {
            console.error('⚠️ API 載入失敗:', error.message);
            // 不再使用假資料，顯示錯誤狀態
            this.data = this.getDefaultEmptyData();
            this.showApiStatus('無法載入分析資料', 'error');
        }
    }



    setupEventListeners() {
        // 時間篩選
        document.querySelectorAll('.time-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.time-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.currentPeriod = e.target.dataset.period;
                this.updateTrendChart();
            });
        });

        // 趨勢圖表控制
        document.querySelectorAll('[data-metric]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.target.parentElement.querySelectorAll('.control-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.currentMetric = e.target.dataset.metric;
                this.updateTrendChart();
            });
        });

        // 學生排名控制
        document.querySelectorAll('[data-sort]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.target.parentElement.querySelectorAll('.control-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.renderStudentRanking(e.target.dataset.sort);
            });
        });
    }

    initCharts() {
        this.initTrendChart();
        this.initSubjectChart();
        this.initTimeChart();
    }

    initTrendChart() {
        const ctx = document.getElementById('trendChart').getContext('2d');

        this.charts.trend = new Chart(ctx, {
            type: 'line',
            data: {
                labels: this.data.trends.week.labels,
                datasets: [{
                    label: '表現分數',
                    data: this.data.trends.week.performance,
                    borderColor: '#3B82F6',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    tension: 0.4,
                    fill: true,
                    pointRadius: 4,
                    pointHoverRadius: 6
                }]
            },
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

    initSubjectChart() {
        const ctx = document.getElementById('subjectChart').getContext('2d');

        this.charts.subject = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: this.data.subjects.labels,
                datasets: [{
                    data: this.data.subjects.data,
                    backgroundColor: [
                        '#3B82F6',
                        '#EF4444',
                        '#10B981',
                        '#F59E0B'
                    ],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            padding: 20,
                            usePointStyle: true
                        }
                    }
                }
            }
        });
    }

    initTimeChart() {
        const ctx = document.getElementById('timeChart').getContext('2d');

        this.charts.time = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: this.data.timeDistribution.labels,
                datasets: [{
                    label: '學習時間 (%)',
                    data: this.data.timeDistribution.data,
                    backgroundColor: '#3B82F6',
                    borderRadius: 4
                }]
            },
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
                        max: 40,
                        grid: {
                            color: '#F3F4F6'
                        }
                    },
                    x: {
                        grid: {
                            display: false
                        }
                    }
                }
            }
        });
    }

    updateTrendChart() {
        const trendData = this.data.trends[this.currentPeriod] || this.data.trends.week;
        const metricData = trendData[this.currentMetric] || trendData.performance;

        this.charts.trend.data.labels = trendData.labels;
        this.charts.trend.data.datasets[0].data = metricData;
        this.charts.trend.data.datasets[0].label = this.getMetricLabel(this.currentMetric);
        this.charts.trend.update();
    }

    getMetricLabel(metric) {
        const labels = {
            performance: '表現分數',
            engagement: '參與度 (%)',
            completion: '完成率 (%)'
        };
        return labels[metric] || '表現分數';
    }

    renderKnowledgePoints() {
        const container = document.getElementById('knowledgePointsGrid');

        container.innerHTML = this.data.knowledgePoints.map(kp => `
            <div class="kp-item">
                <div class="kp-name">${kp.name}</div>
                <div class="kp-score ${this.getScoreClass(kp.score)}">${kp.score}</div>
                <div class="kp-progress">
                    <div class="kp-progress-fill ${this.getScoreClass(kp.score)}" style="width: ${kp.mastery}%; background: ${this.getScoreColor(kp.score)};"></div>
                </div>
            </div>
        `).join('');
    }

    renderStudentRanking(sortBy = 'overall') {
        const container = document.getElementById('studentRanking');
        let students = [...this.data.studentRanking];

        if (sortBy === 'improvement') {
            students.sort((a, b) => b.improvement - a.improvement);
        } else {
            students.sort((a, b) => b.score - a.score);
        }

        container.innerHTML = students.map((student, index) => `
            <div class="ranking-item">
                <div class="ranking-position ${index < 3 ? 'top3' : ''} ${index === 0 ? 'top1' : ''}">
                    ${index + 1}
                </div>
                <div class="ranking-student">
                    <div class="ranking-name">${student.name}</div>
                    <div class="ranking-class">${student.class}</div>
                </div>
                <div class="ranking-score">
                    ${sortBy === 'improvement' ?
                `${student.improvement > 0 ? '+' : ''}${student.improvement.toFixed(1)}` :
                student.score.toFixed(1)
            }
                </div>
            </div>
        `).join('');
    }

    renderInsights() {
        const container = document.getElementById('insightsList');

        container.innerHTML = this.data.insights.map(insight => `
            <li class="insight-item">
                <div class="insight-icon ${insight.type}">
                    <i class="fas ${this.getInsightIcon(insight.type)}"></i>
                </div>
                <div class="insight-content">
                    <div class="insight-title">${insight.title}</div>
                    <div class="insight-description">${insight.description}</div>
                </div>
            </li>
        `).join('');
    }

    getScoreClass(score) {
        if (score >= 90) return 'excellent';
        if (score >= 80) return 'good';
        if (score >= 70) return 'average';
        return 'poor';
    }

    getScoreColor(score) {
        if (score >= 90) return '#10B981';
        if (score >= 80) return '#3B82F6';
        if (score >= 70) return '#F59E0B';
        return '#EF4444';
    }

    getInsightIcon(type) {
        const icons = {
            success: 'fa-check-circle',
            warning: 'fa-exclamation-triangle',
            info: 'fa-info-circle',
            danger: 'fa-times-circle'
        };
        return icons[type] || 'fa-info-circle';
    }

    getDefaultEmptyData() {
        return {
            overview: {
                engagementRate: 0,
                avgPerformance: 0,
                completionRate: 0,
                attentionStudents: 0
            },
            trends: {
                week: {
                    labels: [],
                    performance: [],
                    engagement: [],
                    completion: []
                },
                month: {
                    labels: [],
                    performance: [],
                    engagement: [],
                    completion: []
                }
            },
            knowledgePoints: [],
            studentRanking: [],
            insights: [],
            subjects: {
                labels: [],
                data: []
            },
            timeDistribution: {
                labels: [],
                data: []
            }
        };
    }

    showApiStatus(message, type = 'error') {
        // 更新概覽數據顯示錯誤狀態
        document.getElementById('engagementRate').textContent = '--';
        document.getElementById('avgPerformance').textContent = '--';
        document.getElementById('completionRate').textContent = '--';
        document.getElementById('attentionStudents').textContent = '--';
        
        // 顯示錯誤訊息
        const insightsList = document.getElementById('insightsList');
        if (insightsList) {
            insightsList.innerHTML = `
                <li class="insight-item">
                    <div class="insight-icon ${type}">
                        <i class="fas fa-exclamation-triangle"></i>
                    </div>
                    <div class="insight-content">
                        <div class="insight-title">API 連接錯誤</div>
                        <div class="insight-description">${message}</div>
                        <button onclick="analyticsManager.init()" class="mt-2 px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600">
                            重新載入
                        </button>
                    </div>
                </li>
            `;
        }
    }

    async generateInsights() {
        // 模擬 AI 生成洞察
        const loadingInsight = {
            type: 'info',
            title: '正在分析數據...',
            description: 'AI 正在分析學生學習數據，請稍候...'
        };

        this.data.insights.unshift(loadingInsight);
        this.renderInsights();

        // 模擬 API 調用延遲
        setTimeout(() => {
            this.data.insights.shift(); // 移除載入中的洞察

            // 添加新的 AI 洞察
            const newInsights = [
                {
                    type: 'success',
                    title: 'AI 建議：個性化學習路徑',
                    description: '基於學習數據分析，建議為表現優異的學生提供進階挑戰題目。'
                },
                {
                    type: 'warning',
                    title: 'AI 預警：學習疲勞跡象',
                    description: '檢測到部分學生在下午時段參與度下降，建議調整教學節奏。'
                }
            ];

            this.data.insights = [...newInsights, ...this.data.insights];
            this.renderInsights();
        }, 2000);
    }
}

// 全域函數
function exportAnalytics() {
    alert('匯出分析報告功能開發中...');
}

function generateInsights() {
    analyticsManager.generateInsights();
}

// 初始化
let analyticsManager;
document.addEventListener('DOMContentLoaded', () => {
    analyticsManager = new AnalyticsManager();
});