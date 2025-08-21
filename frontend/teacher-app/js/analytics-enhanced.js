// 學習分析增強版 JavaScript
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
            const response = await fetch('/api/analytics');
            if (response.ok) {
                this.data = await response.json();
                console.log('✅ 成功載入真實分析資料');
            } else {
                throw new Error('API 回應錯誤');
            }
        } catch (error) {
            console.log('⚠️ API 載入失敗，使用模擬資料:', error.message);
            this.data = this.getMockAnalyticsData();
        }
    }

    getMockAnalyticsData() {
        return {
            overview: {
                engagementRate: 87,
                avgPerformance: 82.5,
                completionRate: 94,
                attentionStudents: 3
            },
            trends: {
                week: {
                    labels: ['週一', '週二', '週三', '週四', '週五', '週六', '週日'],
                    performance: [78, 82, 85, 83, 87, 89, 86],
                    engagement: [85, 88, 90, 87, 92, 94, 91],
                    completion: [92, 94, 96, 93, 97, 95, 94]
                },
                month: {
                    labels: ['第1週', '第2週', '第3週', '第4週'],
                    performance: [80, 83, 85, 87],
                    engagement: [88, 90, 92, 94],
                    completion: [93, 95, 94, 96]
                }
            },
            knowledgePoints: [
                { name: '二次函數', score: 85, mastery: 85 },
                { name: '三角函數', score: 78, mastery: 78 },
                { name: '分數運算', score: 92, mastery: 92 },
                { name: '幾何證明', score: 73, mastery: 73 },
                { name: '代數運算', score: 88, mastery: 88 },
                { name: '統計圖表', score: 81, mastery: 81 }
            ],
            studentRanking: [
                { name: '李小華', class: '三年一班', score: 94.5, improvement: 5.2 },
                { name: '林小雅', class: '三年一班', score: 92.8, improvement: 3.1 },
                { name: '蔡小慧', class: '三年一班', score: 90.2, improvement: 4.8 },
                { name: '陳小強', class: '三年一班', score: 88.7, improvement: 2.3 },
                { name: '吳小玲', class: '三年一班', score: 87.3, improvement: 3.7 },
                { name: '王小明', class: '三年一班', score: 85.9, improvement: 1.9 },
                { name: '劉小安', class: '三年一班', score: 82.4, improvement: -1.2 },
                { name: '張小美', class: '三年一班', score: 79.6, improvement: -2.8 }
            ],
            insights: [
                {
                    type: 'success',
                    title: '整體表現優秀',
                    description: '班級平均分數較上週提升2.3分，學生學習積極性明顯提高。'
                },
                {
                    type: 'warning',
                    title: '幾何證明需加強',
                    description: '73%的學生在幾何證明題目上表現不佳，建議增加相關練習。'
                },
                {
                    type: 'info',
                    title: '學習時間分布均勻',
                    description: '學生在各時段的學習參與度較為平均，沒有明顯的低谷期。'
                },
                {
                    type: 'danger',
                    title: '3名學生需要關注',
                    description: '周小傑、張小美、劉小安三位學生近期表現下滑，需要額外輔導。'
                }
            ],
            subjects: {
                labels: ['數學', '國文', '英文', '自然'],
                data: [82, 78, 85, 80]
            },
            timeDistribution: {
                labels: ['08:00-10:00', '10:00-12:00', '14:00-16:00', '16:00-18:00', '19:00-21:00'],
                data: [15, 25, 30, 20, 10]
            }
        };
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