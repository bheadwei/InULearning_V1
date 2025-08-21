// API 健康檢查腳本
class APIHealthChecker {
    constructor() {
        this.endpoints = [
            { name: '認證服務', url: '/api/v1/auth/health', port: null },
            { name: '題庫服務', url: '/api/v1/questions/health', port: null },
            { name: '學習服務', url: '/api/v1/learning/health', port: null },
            { name: 'AI分析服務', url: '/api/v1/ai/health', port: null }
        ];
        this.results = {};
    }

    async checkAllServices() {
        console.log('🔍 開始檢查所有API服務...');

        const results = await Promise.allSettled(
            this.endpoints.map(endpoint => this.checkService(endpoint))
        );

        let healthyCount = 0;
        let totalCount = this.endpoints.length;

        results.forEach((result, index) => {
            const endpoint = this.endpoints[index];
            if (result.status === 'fulfilled' && result.value.healthy) {
                healthyCount++;
                console.log(`✅ ${endpoint.name}: 正常運行`);
            } else {
                console.log(`❌ ${endpoint.name}: 無法連接`);
            }
        });

        const healthStatus = {
            healthy: healthyCount,
            total: totalCount,
            percentage: Math.round((healthyCount / totalCount) * 100)
        };

        console.log(`📊 API健康狀況: ${healthyCount}/${totalCount} (${healthStatus.percentage}%)`);

        this.updateHealthDisplay(healthStatus);
        return healthStatus;
    }

    async checkService(endpoint) {
        try {
            const response = await fetch(endpoint.url, {
                method: 'GET',
                timeout: 5000,
                headers: {
                    'Accept': 'application/json'
                }
            });

            if (response.ok) {
                const data = await response.json().catch(() => ({}));
                return {
                    healthy: true,
                    url: endpoint.url,
                    status: response.status,
                    data: data
                };
            } else {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

        } catch (error) {
            return {
                healthy: false,
                error: error.message,
                endpoint: endpoint.name
            };
        }
    }

    updateHealthDisplay(healthStatus) {
        const statusElement = document.getElementById('apiStatus');
        const statusText = document.getElementById('statusText');

        if (!statusElement || !statusText) return;

        statusElement.style.display = 'block';

        if (healthStatus.percentage === 100) {
            statusElement.className = 'api-status connected';
            statusText.textContent = `所有服務正常運行 (${healthStatus.healthy}/${healthStatus.total})`;
        } else if (healthStatus.percentage >= 50) {
            statusElement.className = 'api-status warning';
            statusText.textContent = `部分服務可用 (${healthStatus.healthy}/${healthStatus.total}) - 使用混合模式`;
        } else {
            statusElement.className = 'api-status error';
            statusText.textContent = `多數服務離線 (${healthStatus.healthy}/${healthStatus.total}) - 使用模擬資料`;
        }
    }

    // 定期檢查API狀態
    startPeriodicCheck(intervalMinutes = 5) {
        this.checkAllServices(); // 立即檢查一次

        setInterval(() => {
            this.checkAllServices();
        }, intervalMinutes * 60 * 1000);

        console.log(`⏰ 已啟動定期API檢查，間隔: ${intervalMinutes}分鐘`);
    }

    // 測試特定API端點
    async testEndpoint(url, method = 'GET', data = null) {
        try {
            const options = {
                method: method,
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                }
            };

            if (data && method !== 'GET') {
                options.body = JSON.stringify(data);
            }

            const response = await fetch(url, options);
            const responseData = await response.json().catch(() => null);

            return {
                success: response.ok,
                status: response.status,
                statusText: response.statusText,
                data: responseData,
                url: url
            };
        } catch (error) {
            return {
                success: false,
                error: error.message,
                url: url
            };
        }
    }

    // 生成API狀態報告
    generateStatusReport() {
        const report = {
            timestamp: new Date().toISOString(),
            services: this.endpoints.map(endpoint => ({
                name: endpoint.name,
                url: endpoint.url,
                port: endpoint.port,
                status: this.results[endpoint.name] || 'unknown'
            })),
            summary: {
                total: this.endpoints.length,
                healthy: Object.values(this.results).filter(r => r.healthy).length
            }
        };

        console.log('📋 API狀態報告:', report);
        return report;
    }
}

// 全域API檢查器實例
window.apiHealthChecker = new APIHealthChecker();

// 頁面載入時自動檢查
document.addEventListener('DOMContentLoaded', () => {
    // 延遲1秒後開始檢查，讓頁面先載入完成
    setTimeout(() => {
        window.apiHealthChecker.startPeriodicCheck(3); // 每3分鐘檢查一次
    }, 1000);
});

// 提供給其他腳本使用的便利函數
window.checkAPIHealth = () => window.apiHealthChecker.checkAllServices();
window.testAPI = (url, method, data) => window.apiHealthChecker.testEndpoint(url, method, data);