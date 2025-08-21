const apiClient = {
    baseUrl: '/api/v1',  // 使用相對路徑，通過 Nginx 代理到後端服務
    timeout: 10000, // 10秒超時
    cache: new Map(), // 簡單緩存
    loadingIndicators: new Set(), // 追蹤加載狀態
    
    getToken() {
        return (
            localStorage.getItem('auth_token') ||
            sessionStorage.getItem('auth_token') ||
            localStorage.getItem('teacher_token') ||
            sessionStorage.getItem('teacher_token') ||
            ''
        );
    },

    // 顯示/隱藏加載指示器
    showLoading(key) {
        this.loadingIndicators.add(key);
        this.updateLoadingUI();
    },

    hideLoading(key) {
        this.loadingIndicators.delete(key);
        this.updateLoadingUI();
    },

    updateLoadingUI() {
        const hasLoading = this.loadingIndicators.size > 0;
        const indicator = document.getElementById('global-loading');
        if (indicator) {
            indicator.style.display = hasLoading ? 'block' : 'none';
        }
        
        // 也可以在頁面右上角顯示小型加載指示器
        const topIndicator = document.querySelector('.api-loading-indicator');
        if (topIndicator) {
            topIndicator.style.display = hasLoading ? 'inline-block' : 'none';
        }
    },

    // 創建帶超時的 fetch 請求
    fetchWithTimeout(url, options) {
        return new Promise((resolve, reject) => {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => {
                controller.abort();
                reject(new Error('請求超時'));
            }, this.timeout);

            fetch(url, { ...options, signal: controller.signal })
                .then(response => {
                    clearTimeout(timeoutId);
                    resolve(response);
                })
                .catch(error => {
                    clearTimeout(timeoutId);
                    if (error.name === 'AbortError') {
                        reject(new Error('請求超時'));
                    } else {
                        reject(error);
                    }
                });
        });
    },

    // 重試機制
    async requestWithRetry(path, options = {}, retries = 2) {
        for (let i = 0; i <= retries; i++) {
            try {
                return await this.request(path, options);
            } catch (error) {
                if (i === retries || error.message.includes('401')) {
                    throw error;
                }
                // 等待一段時間後重試
                await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
            }
        }
    },

    async request(path, options = {}) {
        const url = `${this.baseUrl}${path}`;
        const cacheKey = `${options.method || 'GET'}:${url}`;
        const loadingKey = `${Date.now()}-${Math.random()}`;
        
        // 對於 GET 請求檢查緩存
        if ((options.method || 'GET') === 'GET' && !options.noCache) {
            const cached = this.cache.get(cacheKey);
            if (cached && Date.now() - cached.timestamp < 60000) { // 1分鐘緩存
                console.log('📦 使用緩存:', url);
                return cached.data;
            }
        }

        const headers = Object.assign({ 
            'Content-Type': 'application/json', 
            'Accept': 'application/json' 
        }, options.headers || {});
        
        const token = this.getToken();
        if (token) headers['Authorization'] = `Bearer ${token}`;
        
        console.log('🌐 API 請求:', url);
        
        // 顯示加載指示器
        this.showLoading(loadingKey);
        
        try {
            // 強制設置必要的選項
            const fetchOptions = {
                method: options.method || 'GET',
                headers: headers,
                ...options
            };
            
            // 如果是 POST/PUT 且有 body，確保 body 被設置
            if ((options.method === 'POST' || options.method === 'PUT') && options.body) {
                fetchOptions.body = options.body;
            }
            
            const res = await this.fetchWithTimeout(url, fetchOptions);
            let data = {};
            
            try { 
                data = await res.json(); 
            } catch (e) {
                console.warn('無法解析 JSON 回應:', e);
            }
            
            if (!res.ok) {
                if (res.status === 401) {
                    localStorage.removeItem('auth_token');
                    sessionStorage.removeItem('auth_token');
                    localStorage.removeItem('teacher_token');
                    sessionStorage.removeItem('teacher_token');
                    this.showNotification('登入已過期，請重新登入', 'warning');
                }
                throw new Error(data.detail || data.message || `請求失敗 (${res.status})`);
            }
            
            // 緩存 GET 請求的結果
            if ((options.method || 'GET') === 'GET' && !options.noCache) {
                this.cache.set(cacheKey, {
                    data: data,
                    timestamp: Date.now()
                });
            }
            
            return data;
        } catch (error) {
            console.error('API 請求錯誤:', error);
            this.showNotification(`請求失敗: ${error.message}`, 'error');
            throw error;
        } finally {
            // 隱藏加載指示器
            this.hideLoading(loadingKey);
        }
    },

    // 顯示通知
    showNotification(message, type = 'info') {
        // 創建通知元素
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${type === 'error' ? '#fee' : type === 'warning' ? '#ffa500' : '#e3f2fd'};
            color: ${type === 'error' ? '#c62828' : type === 'warning' ? '#fff' : '#1976d2'};
            padding: 12px 16px;
            border-radius: 4px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.15);
            z-index: 10000;
            max-width: 300px;
            font-size: 14px;
            border-left: 4px solid ${type === 'error' ? '#c62828' : type === 'warning' ? '#ff9800' : '#1976d2'};
        `;
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        // 3秒後自動移除
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 3000);
    },

    // 清除緩存
    clearCache() {
        this.cache.clear();
        console.log('🧹 緩存已清除');
    },

    get(path, options = {}) { 
        return this.requestWithRetry(path, { method: 'GET', ...options }); 
    },
    post(path, body, options = {}) { 
        return this.requestWithRetry(path, { method: 'POST', body: JSON.stringify(body), ...options }); 
    },
    put(path, body, options = {}) { 
        return this.requestWithRetry(path, { method: 'PUT', body: JSON.stringify(body), ...options }); 
    },
    patch(path, body, options = {}) { 
        return this.requestWithRetry(path, { method: 'PATCH', body: JSON.stringify(body), ...options }); 
    },
    delete(path, options = {}) { 
        return this.requestWithRetry(path, { method: 'DELETE', ...options }); 
    },
};

window.apiClient = apiClient;

