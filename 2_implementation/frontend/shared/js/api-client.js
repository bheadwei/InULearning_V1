/**
 * 共用 API 客戶端 (Shared API Client) - InULearning 個人化學習平台
 * 
 * 提供統一的 API 呼叫介面，包括：
 * - HTTP 請求封裝
 * - 認證 Token 管理
 * - 錯誤處理
 * - 請求/回應攔截器
 * - 快取機制
 */

// ===== API 客戶端類別 =====
class ApiClient {
    constructor(baseURL = '') { // 預設為空，讓請求使用相對路徑
        this.baseURL = baseURL;
        this.defaultHeaders = {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        };
        
        // 請求攔截器
        this.requestInterceptors = [];
        
        // 回應攔截器
        this.responseInterceptors = [];
        
        // 快取
        this.cache = new Map();
        
        // 重試配置
        this.retryConfig = {
            maxRetries: 3,
            retryDelay: 1000,
            retryStatusCodes: [408, 429, 500, 502, 503, 504]
        };
    }
    
    /**
     * 設定認證 Token
     * @param {string} token - JWT Token
     */
    setAuthToken(token) {
        if (token) {
            this.defaultHeaders['Authorization'] = `Bearer ${token}`;
            try { localStorage.setItem('auth_token', token); } catch (e) {}
            if (typeof Utils !== 'undefined' && typeof Utils.setStorageItem === 'function') {
                try { Utils.setStorageItem('auth_token', token); } catch (e) {}
            }
        } else {
            delete this.defaultHeaders['Authorization'];
            try { localStorage.removeItem('auth_token'); } catch (e) {}
            if (typeof Utils !== 'undefined' && typeof Utils.removeStorageItem === 'function') {
                try { Utils.removeStorageItem('auth_token'); } catch (e) {}
            }
        }
    }
    
    /**
     * 取得認證 Token
     * @returns {string|null} JWT Token
     */
    getAuthToken() {
        try {
            const raw = localStorage.getItem('auth_token');
            if (raw) return raw;
        } catch (e) {}
        if (typeof Utils !== 'undefined' && typeof Utils.getStorageItem === 'function') {
            return Utils.getStorageItem('auth_token');
        }
        return null;
    }
    
    /**
     * 清除認證 Token
     */
    clearAuthToken() {
        try { localStorage.removeItem('auth_token'); } catch (e) {}
        if (typeof Utils !== 'undefined' && typeof Utils.removeStorageItem === 'function') {
            try { Utils.removeStorageItem('auth_token'); } catch (e) {}
        }
        delete this.defaultHeaders['Authorization'];
    }
    
    /**
     * 添加請求攔截器
     * @param {Function} interceptor - 攔截器函數
     */
    addRequestInterceptor(interceptor) {
        this.requestInterceptors.push(interceptor);
    }
    
    /**
     * 添加回應攔截器
     * @param {Function} interceptor - 攔截器函數
     */
    addResponseInterceptor(interceptor) {
        this.responseInterceptors.push(interceptor);
    }
    
    /**
     * 執行請求攔截器
     * @param {Object} config - 請求配置
     * @returns {Object} 處理後的配置
     */
    async executeRequestInterceptors(config) {
        let processedConfig = { ...config };
        
        for (const interceptor of this.requestInterceptors) {
            try {
                processedConfig = await interceptor(processedConfig);
            } catch (error) {
                console.error('請求攔截器錯誤:', error);
            }
        }
        
        return processedConfig;
    }
    
    /**
     * 執行回應攔截器
     * @param {Response} response - 回應物件
     * @returns {Response} 處理後的回應
     */
    async executeResponseInterceptors(response) {
        let processedResponse = response;
        
        for (const interceptor of this.responseInterceptors) {
            try {
                processedResponse = await interceptor(processedResponse);
            } catch (error) {
                console.error('回應攔截器錯誤:', error);
            }
        }
        
        return processedResponse;
    }
    
    /**
     * 建立快取鍵
     * @param {string} url - 請求 URL
     * @param {Object} params - 請求參數
     * @returns {string} 快取鍵
     */
    createCacheKey(url, params = {}) {
        const sortedParams = Object.keys(params)
            .sort()
            .map(key => `${key}=${params[key]}`)
            .join('&');
        
        return `${url}?${sortedParams}`;
    }
    
    /**
     * 設定快取
     * @param {string} key - 快取鍵
     * @param {any} data - 快取資料
     * @param {number} ttl - 存活時間 (秒)
     */
    setCache(key, data, ttl = 300) {
        this.cache.set(key, {
            data,
            timestamp: Date.now(),
            ttl: ttl * 1000
        });
    }
    
    /**
     * 取得快取
     * @param {string} key - 快取鍵
     * @returns {any|null} 快取資料或 null
     */
    getCache(key) {
        const cached = this.cache.get(key);
        
        if (!cached) return null;
        
        // 檢查是否過期
        if (Date.now() - cached.timestamp > cached.ttl) {
            this.cache.delete(key);
            return null;
        }
        
        return cached.data;
    }
    
    /**
     * 清除快取
     * @param {string} pattern - 快取鍵模式 (可選)
     */
    clearCache(pattern = null) {
        if (pattern) {
            for (const key of this.cache.keys()) {
                if (key.includes(pattern)) {
                    this.cache.delete(key);
                }
            }
        } else {
            this.cache.clear();
        }
    }
    
    /**
     * 執行 HTTP 請求
     * @param {string} method - HTTP 方法
     * @param {string} endpoint - API 端點
     * @param {Object} options - 請求選項
     * @returns {Promise<Object>} 回應資料
     */
    async request(method, endpoint, options = {}) {
        const {
            params = {},
            data = null,
            headers = {},
            cache = false,
            cacheTTL = 300,
            retry = true,
            timeout = 30000
        } = options;
        
        // 建立完整 URL
        const url = new URL(this.baseURL + endpoint, window.location.origin);
        
        // 添加查詢參數
        Object.entries(params).forEach(([key, value]) => {
            if (value !== null && value !== undefined) {
                url.searchParams.append(key, value);
            }
        });
        
        // 檢查快取 (僅 GET 請求)
        if (cache && method === 'GET') {
            const cacheKey = this.createCacheKey(url.pathname + url.search, params);
            const cachedData = this.getCache(cacheKey);
            
            if (cachedData) {
                return cachedData;
            }
        }
        
        // 準備請求配置
        const config = {
            method: method.toUpperCase(),
            headers: {
                ...this.defaultHeaders,
                ...headers
            },
            timeout
        };
        
        // 添加請求體 (非 GET 請求)
        if (data && method !== 'GET') {
            config.body = JSON.stringify(data);
        }
        
        // 執行請求攔截器
        const processedConfig = await this.executeRequestInterceptors(config);
        
        // 執行請求
        let response;
        let retryCount = 0;
        
        while (true) {
            try {
                response = await this.executeFetch(url.toString(), processedConfig);
                break;
            } catch (error) {
                retryCount++;
                
                if (!retry || retryCount >= this.retryConfig.maxRetries) {
                    throw error;
                }
                
                // 檢查是否應該重試
                if (error.status && !this.retryConfig.retryStatusCodes.includes(error.status)) {
                    throw error;
                }
                
                // 等待後重試
                await Utils.delay(this.retryConfig.retryDelay * retryCount);
            }
        }
        
        // 執行回應攔截器
        response = await this.executeResponseInterceptors(response);
        
        // 處理回應
        const responseData = await this.handleResponse(response);
        
        // 設定快取 (僅 GET 請求且成功)
        if (cache && method === 'GET' && response.ok) {
            const cacheKey = this.createCacheKey(url.pathname + url.search, params);
            this.setCache(cacheKey, responseData, cacheTTL);
        }
        
        return responseData;
    }
    
    /**
     * 執行 fetch 請求
     * @param {string} url - 請求 URL
     * @param {Object} config - 請求配置
     * @returns {Promise<Response>} fetch 回應
     */
    async executeFetch(url, config) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), config.timeout);
        
        try {
            const response = await fetch(url, {
                ...config,
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            return response;
        } catch (error) {
            clearTimeout(timeoutId);
            
            if (error.name === 'AbortError') {
                throw new Error('請求超時');
            }
            
            throw error;
        }
    }
    
    /**
     * 處理回應
     * @param {Response} response - fetch 回應
     * @returns {Promise<Object>} 處理後的資料
     */
    async handleResponse(response) {
        // 檢查回應狀態
        if (!response.ok) {
            const error = new Error(`HTTP ${response.status}: ${response.statusText}`);
            error.status = response.status;
            error.response = response;
            
            // 嘗試解析錯誤訊息
            try {
                const errorData = await response.json();
                error.userMessage = errorData.message || errorData.detail || error.message;
            } catch (e) {
                error.userMessage = error.message;
            }
            
            throw error;
        }
        
        // 檢查內容類型
        const contentType = response.headers.get('content-type');
        
        if (contentType && contentType.includes('application/json')) {
            return await response.json();
        }
        
        if (contentType && contentType.includes('text/')) {
            return await response.text();
        }
        
        return await response.blob();
    }
    
    // ===== 便捷方法 =====
    
    /**
     * GET 請求
     * @param {string} endpoint - API 端點
     * @param {Object} options - 請求選項
     * @returns {Promise<Object>} 回應資料
     */
    async get(endpoint, options = {}) {
        return this.request('GET', endpoint, options);
    }
    
    /**
     * POST 請求
     * @param {string} endpoint - API 端點
     * @param {Object} data - 請求資料
     * @param {Object} options - 請求選項
     * @returns {Promise<Object>} 回應資料
     */
    async post(endpoint, data = null, options = {}) {
        return this.request('POST', endpoint, { ...options, data });
    }
    
    /**
     * PUT 請求
     * @param {string} endpoint - API 端點
     * @param {Object} data - 請求資料
     * @param {Object} options - 請求選項
     * @returns {Promise<Object>} 回應資料
     */
    async put(endpoint, data = null, options = {}) {
        return this.request('PUT', endpoint, { ...options, data });
    }
    
    /**
     * PATCH 請求
     * @param {string} endpoint - API 端點
     * @param {Object} data - 請求資料
     * @param {Object} options - 請求選項
     * @returns {Promise<Object>} 回應資料
     */
    async patch(endpoint, data = null, options = {}) {
        return this.request('PATCH', endpoint, { ...options, data });
    }
    
    /**
     * DELETE 請求
     * @param {string} endpoint - API 端點
     * @param {Object} options - 請求選項
     * @returns {Promise<Object>} 回應資料
     */
    async delete(endpoint, options = {}) {
        return this.request('DELETE', endpoint, options);
    }
    
    /**
     * 檔案上傳
     * @param {string} endpoint - API 端點
     * @param {FormData} formData - 表單資料
     * @param {Object} options - 請求選項
     * @returns {Promise<Object>} 回應資料
     */
    async upload(endpoint, formData, options = {}) {
        const config = {
            method: 'POST',
            headers: {
                'Accept': 'application/json'
            },
            body: formData,
            timeout: options.timeout || 60000
        };
        
        // 移除 Content-Type，讓瀏覽器自動設定
        delete config.headers['Content-Type'];
        
        const response = await this.executeFetch(new URL(endpoint, this.baseURL).toString(), config);
        return this.handleResponse(response);
    }
    
    /**
     * 檔案下載
     * @param {string} endpoint - API 端點
     * @param {Object} options - 請求選項
     * @returns {Promise<Blob>} 檔案 blob
     */
    async download(endpoint, options = {}) {
        const config = {
            method: 'GET',
            headers: {
                'Accept': '*/*'
            },
            timeout: options.timeout || 60000
        };
        
        const response = await this.executeFetch(new URL(endpoint, this.baseURL).toString(), config);
        
        if (!response.ok) {
            throw new Error(`下載失敗: ${response.status} ${response.statusText}`);
        }
        
        return await response.blob();
    }
}

// ===== 建立全域 API 客戶端實例 =====
const apiClient = new ApiClient();

// ===== 預設攔截器設定 =====

// 請求攔截器：自動添加認證 Token
apiClient.addRequestInterceptor(async (config) => {
    const token = apiClient.getAuthToken();
    if (token) {
        config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
});

// 回應攔截器：處理認證錯誤
apiClient.addResponseInterceptor(async (response) => {
    if (response.status === 401) {
        // Token 過期，清除本地儲存並重新導向到登入頁面
        try {
            localStorage.removeItem('auth_token');
            localStorage.removeItem('user_info');
        } catch (e) {}
        if (typeof Utils !== 'undefined') {
            try { typeof Utils.removeStorageItem === 'function' && Utils.removeStorageItem('auth_token'); } catch (e) {}
            try { typeof Utils.removeStorageItem === 'function' && Utils.removeStorageItem('user_info'); } catch (e) {}
            try { typeof Utils.clearStorage === 'function' && Utils.clearStorage(); } catch (e) {}
        }
        delete apiClient.defaultHeaders['Authorization'];
        
        // 檢查當前頁面是否為登入頁面
        if (!window.location.href.includes('/login.html')) {
            window.location.href = 'http://localhost/login.html';
        }
    }
    return response;
});

// ===== 匯出 API 客戶端 =====
window.ApiClient = ApiClient;
window.apiClient = apiClient; 