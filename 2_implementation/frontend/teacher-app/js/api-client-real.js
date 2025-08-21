/**
 * 真實 API 客戶端 - 連接後端服務
 * 處理認證、API 調用和錯誤處理
 */

class RealAPIClient {
    constructor() {
        // API 基礎 URL - 使用 nginx 代理路徑
        this.baseURLs = {
            // 通過 nginx 代理（推薦）
            nginx: {
                auth: 'http://localhost/api/v1/auth',
                teacher: 'http://localhost/api/v1/teacher', // 需要添加 nginx 配置
                learning: 'http://localhost/api/v1/learning',
                questionBank: 'http://localhost/api/v1/questions'
            },
            // 直接連接後端服務（備用方案）
            direct: {
                auth: 'http://localhost:8001/api/v1',
                teacher: 'http://localhost:8007/api/v1',
                learning: 'http://localhost:8003/api/v1',
                questionBank: 'http://localhost:8002/api/v1'
            }
        };
        
        // 連接模式：'nginx' 或 'direct'
        this.connectionMode = 'nginx';
        
        // 認證狀態
        this.isAuthenticated = false;
        this.accessToken = null;
        this.refreshToken = null;
        this.userProfile = null;
        
        // 初始化
        this.init();
    }

    init() {
        console.log('🔗 初始化真實 API 客戶端...');
        
        // 從 localStorage 恢復認證狀態
        this.restoreAuthState();
        
        // 設置請求攔截器
        this.setupInterceptors();
        
        // 測試連接模式
        this.testConnectionMode();
    }

    // 測試連接模式
    async testConnectionMode() {
        try {
            // 首先測試 nginx 代理
            const nginxResponse = await fetch('http://localhost/api/v1/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    email: 'teacher@example.com',
                    password: 'password123'
                })
            });
            
            if (nginxResponse.ok) {
                this.connectionMode = 'nginx';
                console.log('✅ 使用 nginx 代理模式');
                return;
            }
        } catch (error) {
            console.log('⚠️ nginx 代理不可用，切換到直接連接模式');
        }
        
        // 如果 nginx 不可用，切換到直接連接
        this.connectionMode = 'direct';
        console.log('🔗 使用直接連接模式');
    }

    // 獲取當前連接的基礎 URL
    getBaseURL(service) {
        return this.baseURLs[this.connectionMode][service];
    }

    // 認證相關方法
    async login(email, password) {
        try {
            console.log('🔐 嘗試登入...', { email, mode: this.connectionMode });
            
            // 根據連接模式選擇 URL
            const loginURL = `${this.getBaseURL('auth')}/auth/login`;
            console.log('🔗 登入 URL:', loginURL);
            
            const response = await fetch(loginURL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email, password })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || `登入失敗: ${response.status}`);
            }

            const data = await response.json();
            
            // 保存認證信息
            this.accessToken = data.access_token;
            this.refreshToken = data.refresh_token;
            this.userProfile = data.user || { email, name: email.split('@')[0] }; // 如果沒有 user 字段，創建一個默認的
            this.isAuthenticated = true;
            
            // 保存到 localStorage
            this.saveAuthState();
            
            console.log('✅ 登入成功', { user: this.userProfile.name });
            return { success: true, user: this.userProfile };
            
        } catch (error) {
            console.error('❌ 登入失敗:', error);
            
            // 提供更詳細的錯誤信息
            if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
                throw new Error(`網絡連接失敗 (${this.connectionMode} 模式)，請檢查：1) 後端服務是否運行 2) CORS 配置 3) 網絡連接`);
            }
            
            throw error;
        }
    }

    async logout() {
        try {
            if (this.refreshToken) {
                await fetch(`${this.baseURLs.nginx.auth}/api/v1/auth/logout`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${this.accessToken}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ refresh_token: this.refreshToken })
                });
            }
        } catch (error) {
            console.error('登出時發生錯誤:', error);
        } finally {
            // 清除認證狀態
            this.clearAuthState();
        }
    }

    async refreshAccessToken() {
        try {
            if (!this.refreshToken) {
                throw new Error('沒有可用的 refresh token');
            }

            const response = await fetch(`${this.baseURLs.nginx.auth}/api/v1/auth/refresh`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ refresh_token: this.refreshToken })
            });

            if (!response.ok) {
                throw new Error('Token 刷新失敗');
            }

            const data = await response.json();
            this.accessToken = data.access_token;
            this.saveAuthState();
            
            console.log('✅ Access token 已刷新');
            return true;
            
        } catch (error) {
            console.error('❌ Token 刷新失敗:', error);
            this.clearAuthState();
            return false;
        }
    }

    // 教師管理 API
    async getTeacherClasses() {
        try {
            console.log('📚 獲取教師班級列表...');
            
            const response = await this.authenticatedRequest(
                `${this.baseURLs.nginx.teacher}/classes`
            );

            if (!response.ok) {
                throw new Error(`獲取班級列表失敗: ${response.status}`);
            }

            const classes = await response.json();
            console.log('✅ 獲取到班級列表:', classes.length, '個班級');
            return classes;
            
        } catch (error) {
            console.error('❌ 獲取班級列表失敗:', error);
            throw error;
        }
    }

    async getClassOverview(classId) {
        try {
            console.log('📊 獲取班級概覽...', { classId });
            
            const response = await this.authenticatedRequest(
                `${this.baseURLs.nginx.teacher}/classes/${classId}/overview`
            );

            if (!response.ok) {
                throw new Error(`獲取班級概覽失敗: ${response.status}`);
            }

            const overview = await response.json();
            console.log('✅ 獲取到班級概覽:', overview);
            return overview;
            
        } catch (error) {
            console.error('❌ 獲取班級概覽失敗:', error);
            throw error;
        }
    }

    async getClassStudentsAnalysis(classId, page = 1, size = 20) {
        try {
            console.log('👥 獲取班級學生分析...', { classId, page, size });
            
            const response = await this.authenticatedRequest(
                `${this.baseURLs.nginx.teacher}/classes/${classId}/students/analysis?page=${page}&size=${size}`
            );

            if (!response.ok) {
                throw new Error(`獲取學生分析失敗: ${response.status}`);
            }

            const data = await response.json();
            console.log('✅ 獲取到學生分析數據:', data);
            return data;
            
        } catch (error) {
            console.error('❌ 獲取學生分析失敗:', error);
            throw error;
        }
    }

    async getStudentProfile(studentId) {
        try {
            console.log('👤 獲取學生檔案...', { studentId });
            
            const response = await this.authenticatedRequest(
                `${this.baseURLs.nginx.teacher}/students/${studentId}/profile`
            );

            if (!response.ok) {
                throw new Error(`獲取學生檔案失敗: ${response.status}`);
            }

            const profile = await response.json();
            console.log('✅ 獲取到學生檔案:', profile);
            return profile;
            
        } catch (error) {
            console.error('❌ 獲取學生檔案失敗:', error);
            throw error;
        }
    }

    async getStudentLearningRecords(studentId) {
        try {
            console.log('📝 獲取學生學習記錄...', { studentId });
            
            const response = await this.authenticatedRequest(
                `${this.baseURLs.nginx.teacher}/students/${studentId}/learning-records`
            );

            if (!response.ok) {
                throw new Error(`獲取學習記錄失敗: ${response.status}`);
            }

            const records = await response.json();
            console.log('✅ 獲取到學習記錄:', records);
            return records;
            
        } catch (error) {
            console.error('❌ 獲取學習記錄失敗:', error);
            throw error;
        }
    }

    // 通用認證請求方法
    async authenticatedRequest(url, options = {}) {
        if (!this.isAuthenticated || !this.accessToken) {
            throw new Error('用戶未認證');
        }

        const requestOptions = {
            ...options,
            headers: {
                'Authorization': `Bearer ${this.accessToken}`,
                'Content-Type': 'application/json',
                ...options.headers
            }
        };

        try {
            const response = await fetch(url, requestOptions);
            
            // 如果 token 過期，嘗試刷新
            if (response.status === 401) {
                console.log('🔄 Token 過期，嘗試刷新...');
                const refreshed = await this.refreshAccessToken();
                
                if (refreshed) {
                    // 重新發送請求
                    requestOptions.headers.Authorization = `Bearer ${this.accessToken}`;
                    return await fetch(url, requestOptions);
                } else {
                    throw new Error('認證失敗，請重新登入');
                }
            }
            
            return response;
            
        } catch (error) {
            console.error('認證請求失敗:', error);
            throw error;
        }
    }

    // 認證狀態管理
    saveAuthState() {
        const authState = {
            accessToken: this.accessToken,
            refreshToken: this.refreshToken,
            userProfile: this.userProfile,
            isAuthenticated: this.isAuthenticated
        };
        localStorage.setItem('inulearning_auth', JSON.stringify(authState));
    }

    restoreAuthState() {
        try {
            const authState = localStorage.getItem('inulearning_auth');
            if (authState) {
                const parsed = JSON.parse(authState);
                this.accessToken = parsed.accessToken;
                this.refreshToken = parsed.refreshToken;
                this.userProfile = parsed.userProfile;
                this.isAuthenticated = parsed.isAuthenticated;
                
                if (this.isAuthenticated) {
                    console.log('🔑 從 localStorage 恢復認證狀態');
                }
            }
        } catch (error) {
            console.error('恢復認證狀態失敗:', error);
            this.clearAuthState();
        }
    }

    clearAuthState() {
        this.accessToken = null;
        this.refreshToken = null;
        this.userProfile = null;
        this.isAuthenticated = false;
        localStorage.removeItem('inulearning_auth');
        console.log('🗑️ 認證狀態已清除');
    }

    // 設置請求攔截器
    setupInterceptors() {
        // 這裡可以添加全局的請求/響應攔截器
        console.log('🔧 API 攔截器已設置');
    }

    // 獲取認證狀態
    getAuthStatus() {
        return {
            isAuthenticated: this.isAuthenticated,
            userProfile: this.userProfile,
            hasValidToken: !!this.accessToken
        };
    }

    // 檢查服務健康狀態
    async checkServiceHealth() {
        const healthChecks = {};
        
        try {
            // 檢查認證服務
            const authResponse = await fetch(`${this.baseURLs.nginx.auth}/health`);
            healthChecks.auth = authResponse.ok ? 'healthy' : 'unhealthy';
            
            // 檢查教師管理服務
            const teacherResponse = await fetch(`${this.baseURLs.nginx.teacher}/health`);
            healthChecks.teacher = teacherResponse.ok ? 'healthy' : 'unhealthy';
            
            // 檢查學習服務
            const learningResponse = await fetch(`${this.baseURLs.nginx.learning}/health`);
            healthChecks.learning = learningResponse.ok ? 'healthy' : 'unhealthy';
            
        } catch (error) {
            console.error('服務健康檢查失敗:', error);
        }
        
        return healthChecks;
    }
}

// 創建全局實例
window.realAPIClient = new RealAPIClient();

// 導出類
if (typeof module !== 'undefined' && module.exports) {
    module.exports = RealAPIClient;
}
