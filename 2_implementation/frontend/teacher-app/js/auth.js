/**
 * 教師應用認證管理模組
 * 處理 JWT token 管理、登入登出功能
 */
class TeacherAuthManager {
    constructor() {
        this.tokenKey = 'auth_token';  // 統一使用相同的key
        this.userKey = 'user_info';    // 統一使用相同的key
        this.init();
    }

    /**
     * 初始化認證管理器
     */
    init() {
        // 處理從統一登入頁面傳來的認證資訊
        this.handleAuthFromURL();
        
        // 強制檢查認證狀態
        this.checkExistingAuth();
    }

    /**
     * 處理URL參數中的認證資訊
     */
    handleAuthFromURL() {
        const urlParams = new URLSearchParams(window.location.search);
        const token = urlParams.get('token');
        const userInfo = urlParams.get('userInfo');

        if (token && userInfo) {
            console.log('🚀 從URL接收到認證資訊');
            
            // 儲存到localStorage
            localStorage.setItem(this.tokenKey, token);
            localStorage.setItem(this.userKey, userInfo);
            
            // 清除URL參數
            const newURL = window.location.protocol + "//" + window.location.host + window.location.pathname;
            window.history.replaceState({}, document.title, newURL);
            
            // 更新認證狀態
            this.updateUI();
        }
    }

    /**
     * 檢查已存在的認證狀態
     */
    checkExistingAuth() {
        console.log('🔍 檢查教師端認證狀態...');
        
        const token = localStorage.getItem(this.tokenKey);
        const userInfo = localStorage.getItem(this.userKey);
        
        console.log('Token 存在:', !!token);
        console.log('用戶資訊存在:', !!userInfo);
        
        if (token && userInfo) {
            try {
                const user = JSON.parse(userInfo);
                console.log('✅ 找到已存在的認證資訊:', user);
                
                // 檢查 token 是否過期
                if (!this.isTokenExpired(token)) {
                    console.log('✅ Token 有效，更新 UI');
                    this.updateUI();
                } else {
                    console.log('❌ Token 已過期，清除認證資訊');
                    this.clearAuth();
                }
            } catch (error) {
                console.error('❌ 解析用戶資訊失敗:', error);
                this.clearAuth();
            }
        } else {
            console.log('❌ 未找到認證資訊');
            this.updateUI(); // 更新為未登入狀態
        }
    }

    /**
     * 教師登入
     * @param {string} email - 教師郵箱
     * @param {string} password - 密碼
     * @returns {Promise<Object>} 登入結果
     */
    async login(email, password) {
        try {
            showLoading();
            
            // 檢查 apiClient 是否可用
            if (typeof apiClient === 'undefined' || !apiClient.post) {
                throw new Error('API 客戶端未初始化');
            }
            
            const response = await apiClient.post('/auth/login', { email, password });

            if (response.access_token) {
                // 儲存 token 和用戶資訊
                const token = response.access_token;
                const user = response.user || { email: email, name: email.split('@')[0] };
                
                this.setToken(token);
                this.setUser(user);
                
                console.log('✅ 登入成功，token 已保存:', token.substring(0, 20) + '...');
                
                // 更新 UI
                this.updateUI();
                
                // 重定向到班級管理頁面
                window.location.href = 'pages/classes-enhanced.html';
                
                return { success: true, message: '登入成功' };
            } else {
                return { success: false, message: response.detail || '登入失敗' };
            }
        } catch (error) {
            console.error('登入錯誤:', error);
            return { success: false, message: '登入失敗，請檢查網路連線' };
        } finally {
            hideLoading();
        }
    }

    /**
     * 教師登出
     */
    logout() {
        // 清除本地儲存的認證資訊
        localStorage.removeItem(this.tokenKey);
        localStorage.removeItem(this.userKey);
        
        // 重定向到統一登入頁面
        window.location.href = 'http://localhost/login.html';
    }

    /**
     * 檢查是否已登入
     * @returns {boolean}
     */
    isLoggedIn() {
        const token = this.getToken();
        return token && !this.isTokenExpired(token);
    }

    /**
     * 獲取當前用戶資訊
     * @returns {Object|null}
     */
    getCurrentUser() {
        const userStr = localStorage.getItem(this.userKey);
        return userStr ? JSON.parse(userStr) : null;
    }

    /**
     * 獲取 token
     * @returns {string|null}
     */
    getToken() {
        return localStorage.getItem(this.tokenKey);
    }

    /**
     * 設定 token
     * @param {string} token
     */
    setToken(token) {
        localStorage.setItem(this.tokenKey, token);
    }

    /**
     * 設定用戶資訊
     * @param {Object} user
     */
    setUser(user) {
        localStorage.setItem(this.userKey, JSON.stringify(user));
    }

    /**
     * 檢查 token 是否過期
     * @param {string} token
     * @returns {boolean}
     */
    isTokenExpired(token) {
        try {
            const payload = JSON.parse(atob(token.split('.')[1]));
            return payload.exp * 1000 < Date.now();
        } catch (error) {
            return true;
        }
    }

    /**
     * 檢查認證狀態
     */
    async checkAuthStatus() {
        const token = this.getToken();
        
        if (!token) {
            this.redirectToLogin();
            return;
        }
        
        try {
            // 檢查 token 是否過期
            if (this.isTokenExpired(token)) {
                console.log('Token 已過期，嘗試重新整理');
                const refreshed = await this.refreshToken();
                if (!refreshed) {
                    this.clearAuth();
                    this.redirectToLogin();
                    return;
                }
            }
            
            // 驗證 token 有效性
            const response = await apiClient.get('/auth/verify');
            
            if (response.success) {
                this.updateUI();
            } else {
                this.clearAuth();
                this.redirectToLogin();
            }
        } catch (error) {
            console.error('認證檢查失敗:', error);
            this.clearAuth();
            this.redirectToLogin();
        }
    }

    /**
     * 清除認證資訊
     */
    clearAuth() {
        localStorage.removeItem(this.tokenKey);
        localStorage.removeItem(this.userKey);
    }

    /**
     * 重定向到登入頁面
     */
    redirectToLogin() {
        window.location.href = 'http://localhost/login.html';
    }

    /**
     * 更新 UI 顯示當前用戶資訊
     */
    updateUI() {
        const user = this.getCurrentUser();
        const userInfo = document.getElementById('userInfo');
        const authButtons = document.getElementById('authButtons');
        const userName = document.getElementById('userName');
        const logoutBtn = document.getElementById('logoutBtn');

        if (this.isLoggedIn() && user) {
            // 已登入：顯示用戶資訊，隱藏登入按鈕
            if (userInfo) userInfo.classList.remove('hidden');
            if (userName) userName.textContent = user.name || user.email || '王老師';
            if (authButtons) authButtons.classList.add('hidden');
            if (logoutBtn) logoutBtn.classList.remove('hidden');

            // 更新其他用戶相關元素
            const teacherNameElement = document.getElementById('teacher-name');
            if (teacherNameElement) {
                teacherNameElement.textContent = user.name || user.email;
            }

            const userAvatarElement = document.getElementById('teacher-avatar');
            if (userAvatarElement) {
                if (user.avatar) {
                    userAvatarElement.src = user.avatar;
                } else {
                    userAvatarElement.textContent = (user.name || user.email).charAt(0).toUpperCase();
                }
            }
        } else {
            // 未登入：隱藏用戶資訊，顯示登入按鈕
            if (userInfo) userInfo.classList.add('hidden');
            if (authButtons) authButtons.classList.remove('hidden');
            if (logoutBtn) logoutBtn.classList.add('hidden');
        }
    }

    /**
     * 重新整理 token（如果需要）
     * @returns {Promise<boolean>}
     */
    async refreshToken() {
        try {
            const response = await apiClient.post('/auth/refresh', {}, {
                headers: {
                    'Authorization': `Bearer ${this.getToken()}`
                }
            });

            if (response.success) {
                this.setToken(response.data.token);
                return true;
            }
            return false;
        } catch (error) {
            console.error('Token 重新整理失敗:', error);
            return false;
        }
    }
}

// 初始化認證管理器
const teacherAuth = new TeacherAuthManager();

// 全域登出事件處理
document.addEventListener('DOMContentLoaded', function() {
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', function(e) {
            e.preventDefault();
            teacherAuth.logout();
        });
    }
}); 