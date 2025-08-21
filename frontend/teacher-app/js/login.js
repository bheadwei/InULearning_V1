/**
 * 教師登入頁面邏輯
 * 處理登入表單提交、驗證和快速登入功能
 */
class TeacherLogin {
    constructor() {
        this.form = document.getElementById('login-form');
        this.emailInput = document.getElementById('email');
        this.passwordInput = document.getElementById('password');
        this.passwordToggle = document.getElementById('password-toggle');
        this.loginBtn = document.getElementById('login-btn');
        this.quickLoginBtns = document.querySelectorAll('.quick-login-btn');
        
        this.init();
    }

    init() {
        this.bindEvents();
        this.setupPasswordToggle();
        this.setupQuickLogin();
        this.checkRememberedCredentials();
    }

    /**
     * 綁定事件
     */
    bindEvents() {
        // 表單提交
        this.form.addEventListener('submit', this.handleLogin.bind(this));
        
        // 輸入驗證
        this.emailInput.addEventListener('blur', this.validateEmail.bind(this));
        this.passwordInput.addEventListener('blur', this.validatePassword.bind(this));
        
        // 忘記密碼
        const forgotPasswordLink = document.getElementById('forgot-password');
        if (forgotPasswordLink) {
            forgotPasswordLink.addEventListener('click', this.handleForgotPassword.bind(this));
        }
        
        // 註冊連結
        const registerLink = document.getElementById('register-link');
        if (registerLink) {
            registerLink.addEventListener('click', this.handleRegisterLink.bind(this));
        }
    }

    /**
     * 設定密碼顯示切換
     */
    setupPasswordToggle() {
        this.passwordToggle.addEventListener('click', () => {
            const type = this.passwordInput.type === 'password' ? 'text' : 'password';
            this.passwordInput.type = type;
            
            const icon = this.passwordToggle.querySelector('i');
            icon.className = type === 'password' ? 'fas fa-eye' : 'fas fa-eye-slash';
        });
    }

    /**
     * 設定快速登入
     */
    setupQuickLogin() {
        this.quickLoginBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const email = btn.dataset.email;
                const password = btn.dataset.password;
                
                this.emailInput.value = email;
                this.passwordInput.value = password;
                
                // 自動提交表單
                this.handleLogin(new Event('submit'));
            });
        });
    }

    /**
     * 檢查記住的憑證
     */
    checkRememberedCredentials() {
        const rememberedEmail = localStorage.getItem('teacher_remembered_email');
        if (rememberedEmail) {
            this.emailInput.value = rememberedEmail;
            document.getElementById('remember-me').checked = true;
        }
    }

    /**
     * 處理登入
     */
    async handleLogin(e) {
        e.preventDefault();
        
        // 清除之前的錯誤
        this.clearErrors();
        
        // 驗證表單
        if (!this.validateForm()) {
            return;
        }
        
        const email = this.emailInput.value.trim();
        const password = this.passwordInput.value;
        const rememberMe = document.getElementById('remember-me').checked;
        
        // 顯示載入狀態
        this.setLoadingState(true);
        
        try {
            // 調用認證管理器的登入方法
            const result = await teacherAuth.login(email, password);
            
            if (result.success) {
                // 記住用戶名（如果選擇了記住我）
                if (rememberMe) {
                    localStorage.setItem('teacher_remembered_email', email);
                } else {
                    localStorage.removeItem('teacher_remembered_email');
                }
                
                // 顯示成功訊息
                showAlert('登入成功，正在跳轉...', 'success');
                
                // 延遲跳轉，讓用戶看到成功訊息
                setTimeout(() => {
                    window.location.href = '../index.html';
                }, 1000);
                
            } else {
                // 顯示錯誤訊息
                this.showError('password', result.message);
                showAlert(result.message, 'error');
            }
            
        } catch (error) {
            console.error('登入錯誤:', error);
            this.showError('password', '登入失敗，請檢查網路連線');
            showAlert('登入失敗，請檢查網路連線', 'error');
        } finally {
            this.setLoadingState(false);
        }
    }

    /**
     * 驗證表單
     */
    validateForm() {
        let isValid = true;
        
        // 驗證郵箱
        if (!this.validateEmail()) {
            isValid = false;
        }
        
        // 驗證密碼
        if (!this.validatePassword()) {
            isValid = false;
        }
        
        return isValid;
    }

    /**
     * 驗證郵箱
     */
    validateEmail() {
        const email = this.emailInput.value.trim();
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        
        if (!email) {
            this.showError('email', '請輸入電子郵件');
            return false;
        }
        
        if (!emailRegex.test(email)) {
            this.showError('email', '請輸入有效的電子郵件格式');
            return false;
        }
        
        this.clearError('email');
        return true;
    }

    /**
     * 驗證密碼
     */
    validatePassword() {
        const password = this.passwordInput.value;
        
        if (!password) {
            this.showError('password', '請輸入密碼');
            return false;
        }
        
        if (password.length < 6) {
            this.showError('password', '密碼至少需要 6 個字符');
            return false;
        }
        
        this.clearError('password');
        return true;
    }

    /**
     * 顯示錯誤訊息
     */
    showError(field, message) {
        const errorElement = document.getElementById(`${field}-error`);
        if (errorElement) {
            errorElement.textContent = message;
            errorElement.style.display = 'block';
        }
        
        // 添加錯誤樣式到輸入框
        const inputElement = document.getElementById(field);
        if (inputElement) {
            inputElement.classList.add('error');
        }
    }

    /**
     * 清除錯誤訊息
     */
    clearError(field) {
        const errorElement = document.getElementById(`${field}-error`);
        if (errorElement) {
            errorElement.textContent = '';
            errorElement.style.display = 'none';
        }
        
        // 移除錯誤樣式
        const inputElement = document.getElementById(field);
        if (inputElement) {
            inputElement.classList.remove('error');
        }
    }

    /**
     * 清除所有錯誤
     */
    clearErrors() {
        this.clearError('email');
        this.clearError('password');
    }

    /**
     * 設定載入狀態
     */
    setLoadingState(loading) {
        const btnText = this.loginBtn.querySelector('.btn-text');
        const btnLoading = this.loginBtn.querySelector('.btn-loading');
        
        if (loading) {
            btnText.classList.add('hide');
            btnLoading.classList.add('show');
            this.loginBtn.disabled = true;
        } else {
            btnText.classList.remove('hide');
            btnLoading.classList.remove('show');
            this.loginBtn.disabled = false;
        }
    }

    /**
     * 處理忘記密碼
     */
    handleForgotPassword(e) {
        e.preventDefault();
        
        const email = this.emailInput.value.trim();
        if (!email) {
            showAlert('請先輸入您的電子郵件', 'warning');
            this.emailInput.focus();
            return;
        }
        
        // 這裡可以實作忘記密碼功能
        showAlert('密碼重設功能正在開發中，請聯絡管理員', 'info');
    }

    /**
     * 處理註冊連結
     */
    handleRegisterLink(e) {
        e.preventDefault();
        
        // 顯示聯絡資訊
        showAlert('請聯絡系統管理員申請教師帳號', 'info');
    }

    /**
     * 重置表單
     */
    resetForm() {
        this.form.reset();
        this.clearErrors();
        this.setLoadingState(false);
    }
}

// 初始化教師登入
document.addEventListener('DOMContentLoaded', function() {
    new TeacherLogin();
}); 