/**
 * 家長應用認證管理模組
 * 處理 JWT token 管理、登入登出功能
 */
class ParentAuthManager {
    constructor() {
        this.tokenKey = 'auth_token';  // 統一使用相同的key
        this.userKey = 'user_info';    // 統一使用相同的key
        this.init();
    }

    init() {
        // 處理從統一登入頁面傳來的認證資訊
        this.handleAuthFromURL();

        // 檢查是否已登入
        if (this.isLoggedIn()) {
            this.updateUI();
        } else {
            // 如果未登入且不在登入頁面，重定向到統一登入頁面
            if (!window.location.pathname.includes('login.html')) {
                window.location.href = 'http://localhost/login.html';
            }
        }
    }

    /**
     * 處理URL參數中的認證資訊
     */
    handleAuthFromURL() {
        const urlParams = new URLSearchParams(window.location.search);
        const token = urlParams.get('token');
        const userInfo = urlParams.get('userInfo');

        if (token && userInfo) {
            console.log('從URL接收到認證資訊');

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
     * 家長登入
     * @param {string} email - 家長郵箱
     * @param {string} password - 密碼
     * @returns {Promise<Object>} 登入結果
     */
    async login(email, password) {
        try {
            showLoading();

            const response = await apiClient.post('/auth/parent/login', {
                email: email,
                password: password
            });

            if (response.success) {
                // 儲存 token 和用戶資訊
                this.setToken(response.data.token);
                this.setUser(response.data.user);

                // 更新 UI
                this.updateUI();

                // 重定向到儀表板
                window.location.href = 'index.html';

                return { success: true, message: '登入成功' };
            } else {
                return { success: false, message: response.message || '登入失敗' };
            }
        } catch (error) {
            console.error('登入錯誤:', error);
            return { success: false, message: '登入失敗，請檢查網路連線' };
        } finally {
            hideLoading();
        }
    }

    /**
     * 家長登出
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
     * 更新 UI 顯示當前用戶資訊
     */
    updateUI() {
        const user = this.getCurrentUser();
        const userInfo = document.getElementById('userInfo');
        const authButtons = document.getElementById('authButtons');
        const userName = document.getElementById('userName');
        const logoutBtn = document.getElementById('logoutBtn');

        if (user && this.isLoggedIn()) {
            // 顯示用戶資訊，隱藏登入按鈕
            if (userInfo) userInfo.classList.remove('hidden');
            if (userName) userName.textContent = user.email || user.name || '家長';
            if (authButtons) authButtons.classList.add('hidden');
            if (logoutBtn) logoutBtn.classList.remove('hidden');

            // 更新頁面其他用戶資訊顯示
            const parentNameElement = document.getElementById('parent-name');
            if (parentNameElement) {
                parentNameElement.textContent = user.name || user.email;
            }

            const parentGreetingElement = document.getElementById('parent-greeting');
            if (parentGreetingElement) {
                parentGreetingElement.textContent = user.name || user.email;
            }

            // 更新用戶頭像或顯示名稱
            const userAvatarElement = document.getElementById('parent-avatar');
            if (userAvatarElement) {
                if (user.avatar) {
                    userAvatarElement.src = user.avatar;
                } else {
                    userAvatarElement.textContent = (user.name || user.email).charAt(0).toUpperCase();
                }
            }
        } else {
            // 隱藏用戶資訊，顯示登入按鈕
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
const parentAuth = new ParentAuthManager();

// 全域登出事件處理（與頁面一致使用 #logoutBtn）
document.addEventListener('DOMContentLoaded', function () {
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', function (e) {
            e.preventDefault();
            parentAuth.logout();
        });
    }
});