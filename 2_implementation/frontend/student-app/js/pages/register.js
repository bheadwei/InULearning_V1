/**
 * 註冊頁面 JavaScript
 */

class RegisterPage {
    constructor() {
        this.form = document.getElementById('registerForm') || document.querySelector('form');
        this.roleSelect = document.getElementById('role');
        this.emailInput = document.getElementById('email');
        this.firstNameInput = document.getElementById('first_name');
        this.lastNameInput = document.getElementById('last_name');
        this.passwordInput = document.getElementById('password');
        this.confirmPasswordInput = document.getElementById('confirm-password');
        this.termsCheckbox = document.getElementById('terms');
        this.registerButton = document.querySelector('button[type="submit"]');
        
        this.init();
    }

    /**
     * 初始化
     */
    init() {
        this.bindEvents();
        this.checkIfAlreadyLoggedIn();
    }

    /**
     * 檢查是否已經登入
     */
    checkIfAlreadyLoggedIn() {
        if (authManager.isLoggedIn()) {
            // 已登入，重定向到主頁
            window.location.href = '/index.html';
        }
    }

    /**
     * 綁定事件
     */
    bindEvents() {
        if (this.form) {
            this.form.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleRegister();
            });
        }

        // 輸入驗證
        if (this.emailInput) {
            this.emailInput.addEventListener('blur', () => {
                this.validateEmail();
            });
            this.emailInput.addEventListener('input', () => {
                this.clearError();
            });
        }

        if (this.passwordInput) {
            this.passwordInput.addEventListener('blur', () => {
                this.validatePassword();
            });
            this.passwordInput.addEventListener('input', () => {
                this.clearError();
                if (this.confirmPasswordInput.value) {
                    this.validateConfirmPassword();
                }
            });
        }

        if (this.confirmPasswordInput) {
            this.confirmPasswordInput.addEventListener('blur', () => {
                this.validateConfirmPassword();
            });
            this.confirmPasswordInput.addEventListener('input', () => {
                this.clearError();
            });
        }

        // 登入連結
        const loginLinks = document.querySelectorAll('a[href*="login"]');
        loginLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                window.location.href = 'http://localhost/login.html';
            });
        });
    }

    /**
     * 驗證電子郵件
     */
    validateEmail() {
        const email = this.emailInput.value.trim();
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        
        if (!email) {
            this.showFieldError(this.emailInput, '請輸入電子郵件');
            return false;
        }
        
        if (!emailRegex.test(email)) {
            this.showFieldError(this.emailInput, '請輸入有效的電子郵件格式');
            return false;
        }
        
        this.clearFieldError(this.emailInput);
        return true;
    }

    /**
     * 驗證密碼
     */
    validatePassword() {
        const password = this.passwordInput.value;
        
        if (!password) {
            this.showFieldError(this.passwordInput, '請輸入密碼');
            return false;
        }
        
        if (password.length < 8) {
            this.showFieldError(this.passwordInput, '密碼至少需要8個字符');
            return false;
        }
        
        // 檢查密碼強度
        const hasUpperCase = /[A-Z]/.test(password);
        const hasLowerCase = /[a-z]/.test(password);
        const hasNumbers = /\d/.test(password);
        
        if (!hasUpperCase || !hasLowerCase || !hasNumbers) {
            this.showFieldError(this.passwordInput, '密碼需包含大小寫字母和數字');
            return false;
        }
        
        this.clearFieldError(this.passwordInput);
        return true;
    }

    /**
     * 驗證確認密碼
     */
    validateConfirmPassword() {
        const password = this.passwordInput.value;
        const confirmPassword = this.confirmPasswordInput.value;
        
        if (!confirmPassword) {
            this.showFieldError(this.confirmPasswordInput, '請確認密碼');
            return false;
        }
        
        if (password !== confirmPassword) {
            this.showFieldError(this.confirmPasswordInput, '密碼不一致');
            return false;
        }
        
        this.clearFieldError(this.confirmPasswordInput);
        return true;
    }

    /**
     * 驗證服務條款
     */
    validateTerms() {
        if (!this.termsCheckbox.checked) {
            this.showError('請同意服務條款');
            return false;
        }
        return true;
    }

    /**
     * 處理註冊
     */
    async handleRegister() {
        // 清除之前的錯誤
        this.clearError();
        
        // 驗證表單
        const isEmailValid = this.validateEmail();
        const isPasswordValid = this.validatePassword();
        const isConfirmPasswordValid = this.validateConfirmPassword();
        const isTermsValid = this.validateTerms();
        
        if (!isEmailValid || !isPasswordValid || !isConfirmPasswordValid || !isTermsValid) {
            return;
        }
        
        const userData = {
            email: this.emailInput.value.trim(),
            username: this.emailInput.value.trim().split('@')[0], // 使用郵箱前綴作為用戶名
            password: this.passwordInput.value,
            role: this.roleSelect.value,
            first_name: this.firstNameInput.value.trim(),
            last_name: this.lastNameInput.value.trim()
        };
        
        try {
            // 設置載入狀態
            this.setLoading(true);
            
            // 調用註冊 API
            const response = await authAPI.register(userData);
            
            // 顯示成功訊息
            this.showSuccess('註冊成功！請登入您的帳號');
            
            // 延遲跳轉到登入頁面
            setTimeout(() => {
                window.location.href = 'http://localhost/login.html';
            }, 2000);
            
        } catch (error) {
            console.error('註冊失敗:', error);
            let errorMessage = '註冊失敗，請稍後再試';
            
            if (error.message.includes('email')) {
                errorMessage = '該電子郵件已被註冊';
            } else if (error.message.includes('username')) {
                errorMessage = '該用戶名已被使用';
            } else {
                errorMessage = error.message || errorMessage;
            }
            
            this.showError(errorMessage);
        } finally {
            this.setLoading(false);
        }
    }

    /**
     * 設置載入狀態
     */
    setLoading(isLoading) {
        if (this.registerButton) {
            const buttonText = this.registerButton.querySelector('#registerButtonText');
            const spinner = this.registerButton.querySelector('#registerSpinner');
            
            if (isLoading) {
                this.registerButton.disabled = true;
                if (buttonText) buttonText.textContent = '註冊中...';
                if (spinner) spinner.classList.remove('hidden');
            } else {
                this.registerButton.disabled = false;
                if (buttonText) buttonText.textContent = '註冊';
                if (spinner) spinner.classList.add('hidden');
            }
        }
    }

    /**
     * 顯示錯誤訊息
     */
    showError(message) {
        // 移除舊的錯誤訊息
        this.clearError();
        
        // 創建錯誤訊息元素
        const errorDiv = document.createElement('div');
        errorDiv.id = 'registerError';
        errorDiv.className = 'mt-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded';
        errorDiv.textContent = message;
        
        // 插入到表單前面
        if (this.form) {
            this.form.insertBefore(errorDiv, this.form.firstChild);
        }
    }

    /**
     * 顯示成功訊息
     */
    showSuccess(message) {
        // 移除舊的錯誤訊息
        this.clearError();
        
        // 創建成功訊息元素
        const successDiv = document.createElement('div');
        successDiv.id = 'registerSuccess';
        successDiv.className = 'mt-4 p-3 bg-green-100 border border-green-400 text-green-700 rounded';
        successDiv.textContent = message;
        
        // 插入到表單前面
        if (this.form) {
            this.form.insertBefore(successDiv, this.form.firstChild);
        }
    }

    /**
     * 清除錯誤訊息
     */
    clearError() {
        const errorDiv = document.getElementById('registerError');
        const successDiv = document.getElementById('registerSuccess');
        
        if (errorDiv) {
            errorDiv.remove();
        }
        
        if (successDiv) {
            successDiv.remove();
        }
    }

    /**
     * 顯示欄位錯誤
     */
    showFieldError(inputElement, message) {
        this.clearFieldError(inputElement);
        
        const errorSpan = document.createElement('span');
        errorSpan.className = 'field-error text-red-500 text-sm mt-1 block';
        errorSpan.textContent = message;
        
        inputElement.classList.add('border-red-500');
        inputElement.parentNode.appendChild(errorSpan);
    }

    /**
     * 清除欄位錯誤
     */
    clearFieldError(inputElement) {
        inputElement.classList.remove('border-red-500');
        const errorSpan = inputElement.parentNode.querySelector('.field-error');
        if (errorSpan) {
            errorSpan.remove();
        }
    }
}

// 頁面載入完成後初始化
document.addEventListener('DOMContentLoaded', () => {
    new RegisterPage();
}); 