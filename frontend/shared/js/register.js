/**
 * InU Learning 註冊頁面 JavaScript
 * 依賴: utils.js, api-client.js
 * 
 * 功能：
 * - 三角色註冊（學生、家長、教師）
 * - 表單驗證和提交
 * - 密碼強度檢查
 * - API 整合
 * - 錯誤處理和成功跳轉
 */

class UnifiedRegister {
    constructor() {
        this.selectedRole = 'student';
        this.allowedRoles = ['student', 'parent', 'teacher'];
        this.passwordStrength = 0;
        this.isSubmitting = false;

        // 安全設定
        this.maxInputLength = {
            firstName: 50,
            lastName: 50,
            email: 255,
            username: 100,
            password: 128,
            phone: 20
        };

        this.initializeElements();
        this.bindEvents();
        this.initSecurity();

        console.log('🚀 InU Learning 註冊系統已初始化');
    }

    initializeElements() {
        // 表單元素
        this.registerForm = Utils.$('#registerForm');
        this.firstNameInput = Utils.$('#firstName');
        this.lastNameInput = Utils.$('#lastName');
        this.emailInput = Utils.$('#email');
        this.usernameInput = Utils.$('#username');
        this.passwordInput = Utils.$('#password');
        this.confirmPasswordInput = Utils.$('#confirmPassword');
        this.phoneInput = Utils.$('#phone');
        this.agreeTermsInput = Utils.$('#agreeTerms');

        // 按鈕和狀態元素
        this.registerBtn = Utils.$('#registerBtn');
        this.registerText = Utils.$('#registerText');
        this.loadingSpinner = Utils.$('#loadingSpinner');
        this.roleButtons = Utils.$$('.role-btn');

        // 密碼強度相關
        this.passwordStrengthBar = Utils.$('#passwordStrength');
        this.passwordHint = Utils.$('#passwordHint');

        // 訊息元素
        this.errorMessage = Utils.$('#errorMessage');
        this.successMessage = Utils.$('#successMessage');

        if (!this.registerForm) {
            console.error('❌ 註冊表單元素未找到');
            return;
        }

        console.log('✅ DOM 元素初始化完成');
    }

    bindEvents() {
        if (!this.registerForm) return;

        // 表單提交
        this.registerForm.addEventListener('submit', (e) => this.handleRegister(e));

        // 身份選擇
        this.roleButtons.forEach(btn => {
            btn.addEventListener('click', () => this.selectRole(btn.dataset.role));
        });

        // 密碼強度檢查
        if (this.passwordInput) {
            this.passwordInput.addEventListener('input', () => this.checkPasswordStrength());
        }

        // 確認密碼檢查
        if (this.confirmPasswordInput) {
            this.confirmPasswordInput.addEventListener('input', () => this.checkPasswordMatch());
        }

        // 電子郵件格式檢查
        if (this.emailInput) {
            this.emailInput.addEventListener('blur', () => this.validateEmail());
        }

        // 用戶名格式檢查
        if (this.usernameInput) {
            this.usernameInput.addEventListener('blur', () => this.validateUsername());
        }

        // 電話號碼格式檢查
        if (this.phoneInput) {
            this.phoneInput.addEventListener('blur', () => this.validatePhone());
        }

        console.log('✅ 事件綁定完成');
    }

    initSecurity() {
        // 設定輸入長度限制
        if (this.firstNameInput) {
            this.firstNameInput.maxLength = this.maxInputLength.firstName;
        }
        if (this.lastNameInput) {
            this.lastNameInput.maxLength = this.maxInputLength.lastName;
        }
        if (this.emailInput) {
            this.emailInput.maxLength = this.maxInputLength.email;
        }
        if (this.usernameInput) {
            this.usernameInput.maxLength = this.maxInputLength.username;
        }
        if (this.passwordInput) {
            this.passwordInput.maxLength = this.maxInputLength.password;
        }
        if (this.phoneInput) {
            this.phoneInput.maxLength = this.maxInputLength.phone;
        }

        // 禁用自動完成敏感欄位
        if (this.passwordInput) {
            this.passwordInput.setAttribute('autocomplete', 'new-password');
        }
        if (this.confirmPasswordInput) {
            this.confirmPasswordInput.setAttribute('autocomplete', 'new-password');
        }

        // 防止密碼欄位複製
        if (this.passwordInput) {
            this.passwordInput.addEventListener('copy', (e) => {
                e.preventDefault();
                console.log('🔒 密碼欄位不允許複製');
            });
        }

        console.log('🔒 安全設定已初始化');
    }

    selectRole(role) {
        // 嚴格的角色驗證
        if (!role || typeof role !== 'string') {
            console.error('❌ 無效的角色參數:', role);
            this.showError('系統錯誤：無效的角色參數');
            return;
        }

        // 檢查角色是否在白名單中
        if (!this.allowedRoles.includes(role)) {
            console.error('❌ 無效的角色選擇:', role);
            this.showError('無效的角色選擇，僅允許學生、家長、教師註冊');

            // 記錄安全事件
            this.logSecurityEvent('invalid_role_selection', { role, allowedRoles: this.allowedRoles });
            return;
        }

        this.selectedRole = role;

        // 更新按鈕樣式
        this.roleButtons.forEach(btn => {
            btn.classList.remove('active');
            // 移除所有顏色類別
            btn.classList.remove('bg-blue-50', 'border-blue-200', 'bg-green-50', 'border-green-200', 'bg-purple-50', 'border-purple-200');

            if (btn.dataset.role === role) {
                btn.classList.add('active');
                // 添加視覺回饋動畫
                btn.style.transform = 'scale(1.05)';
                setTimeout(() => {
                    btn.style.transform = '';
                }, 150);
            }
        });

        // 顯示角色選擇成功提示
        this.hideMessages(); // 清除之前的錯誤訊息
        console.log('✅ 選擇身份:', role);
    }

    /**
     * 記錄安全事件
     */
    logSecurityEvent(eventType, details = {}) {
        const securityLog = {
            timestamp: new Date().toISOString(),
            eventType,
            details,
            userAgent: navigator.userAgent,
            url: window.location.href
        };

        console.warn('🔒 安全事件記錄:', securityLog);

        // 可以在這裡添加發送到安全監控系統的邏輯
        // 例如：發送到後端安全 API
    }

    /**
     * 清理和驗證輸入資料
     */
    sanitizeInput(input, type = 'text') {
        if (!input || typeof input !== 'string') return '';

        let sanitized = input.trim();

        switch (type) {
            case 'name':
                // 移除特殊字符，只保留字母、數字、中文、空格、連字符
                sanitized = sanitized.replace(/[^\w\s\u4e00-\u9fa5-]/g, '');
                break;
            case 'username':
                // 用戶名只允許字母、數字、下底線
                sanitized = sanitized.replace(/[^\w]/g, '');
                break;
            case 'email':
                // 電子郵件只允許基本字符
                sanitized = sanitized.replace(/[^\w@.-]/g, '');
                break;
            case 'phone':
                // 電話號碼只允許數字和連字符
                sanitized = sanitized.replace(/[^\d-]/g, '');
                break;
            default:
                // 一般文字移除危險字符
                sanitized = sanitized.replace(/[<>\"'&]/g, '');
        }

        return sanitized;
    }

    checkPasswordStrength() {
        const password = this.passwordInput.value;
        const result = Utils.validatePassword(password);

        this.passwordStrength = result.strength;

        // 更新密碼強度條
        this.updatePasswordStrengthBar(result.strength);

        // 更新提示訊息
        if (this.passwordHint) {
            this.passwordHint.textContent = result.message;
            this.passwordHint.className = `mt-1 text-xs ${result.isValid ? 'text-green-600' : 'text-red-600'}`;
        }

        return result.isValid;
    }

    updatePasswordStrengthBar(strength) {
        if (!this.passwordStrengthBar) return;

        // 清除現有樣式
        this.passwordStrengthBar.className = 'password-strength';

        // 添加對應強度樣式
        const strengthClasses = {
            0: '',
            1: 'strength-weak',
            2: 'strength-fair',
            3: 'strength-good',
            4: 'strength-strong',
            5: 'strength-strong'
        };

        const strengthClass = strengthClasses[strength] || '';
        if (strengthClass) {
            this.passwordStrengthBar.classList.add(strengthClass);
        }
    }

    checkPasswordMatch() {
        const password = this.passwordInput.value;
        const confirmPassword = this.confirmPasswordInput.value;

        if (confirmPassword && password !== confirmPassword) {
            this.confirmPasswordInput.setCustomValidity('密碼不一致');
            this.confirmPasswordInput.classList.add('border-red-500');
            this.confirmPasswordInput.classList.remove('border-green-500');
            return false;
        } else if (confirmPassword && password === confirmPassword && password) {
            this.confirmPasswordInput.setCustomValidity('');
            this.confirmPasswordInput.classList.remove('border-red-500');
            this.confirmPasswordInput.classList.add('border-green-500');
            return true;
        } else {
            this.confirmPasswordInput.setCustomValidity('');
            this.confirmPasswordInput.classList.remove('border-red-500', 'border-green-500');
            return true;
        }
    }

    validateEmail() {
        const email = this.emailInput.value.trim();
        const isValid = Utils.isValidEmail(email);

        if (email && !isValid) {
            this.emailInput.setCustomValidity('請輸入有效的電子郵件格式');
            this.emailInput.classList.add('border-red-500');
            this.emailInput.classList.remove('border-green-500');
            return false;
        } else if (email && isValid) {
            this.emailInput.setCustomValidity('');
            this.emailInput.classList.remove('border-red-500');
            this.emailInput.classList.add('border-green-500');
            return true;
        } else {
            this.emailInput.setCustomValidity('');
            this.emailInput.classList.remove('border-red-500', 'border-green-500');
            return true;
        }
    }

    validateUsername() {
        const username = this.usernameInput.value.trim();

        if (username && username.length < 3) {
            this.usernameInput.setCustomValidity('用戶名至少需要3個字元');
            this.usernameInput.classList.add('border-red-500');
            this.usernameInput.classList.remove('border-green-500');
            return false;
        } else if (username && username.length >= 3) {
            this.usernameInput.setCustomValidity('');
            this.usernameInput.classList.remove('border-red-500');
            this.usernameInput.classList.add('border-green-500');
            return true;
        } else {
            this.usernameInput.setCustomValidity('');
            this.usernameInput.classList.remove('border-red-500', 'border-green-500');
            return true;
        }
    }

    validatePhone() {
        const phone = this.phoneInput.value.trim();

        // 電話號碼是選填的
        if (!phone) {
            this.phoneInput.setCustomValidity('');
            this.phoneInput.classList.remove('border-red-500', 'border-green-500');
            return true;
        }

        const isValid = Utils.isValidPhone(phone);
        if (!isValid) {
            this.phoneInput.setCustomValidity('請輸入有效的台灣手機號碼格式 (09xxxxxxxx)');
            this.phoneInput.classList.add('border-red-500');
            this.phoneInput.classList.remove('border-green-500');
            return false;
        } else {
            this.phoneInput.setCustomValidity('');
            this.phoneInput.classList.remove('border-red-500');
            this.phoneInput.classList.add('border-green-500');
            return true;
        }
    }

    validateForm() {
        // 先進行資料清理
        this.sanitizeFormData();

        const validations = [
            this.validateEmail(),
            this.validateUsername(),
            this.checkPasswordStrength(),
            this.checkPasswordMatch(),
            this.validatePhone()
        ];

        // 檢查必填欄位
        const requiredFields = [
            { field: this.firstNameInput, name: '名字', type: 'name' },
            { field: this.lastNameInput, name: '姓氏', type: 'name' },
            { field: this.emailInput, name: '電子郵件', type: 'email' },
            { field: this.usernameInput, name: '用戶名', type: 'username' },
            { field: this.passwordInput, name: '密碼', type: 'password' },
            { field: this.confirmPasswordInput, name: '確認密碼', type: 'password' }
        ];

        for (const { field, name, type } of requiredFields) {
            const value = field.value.trim();
            if (!value) {
                this.showError(`請輸入${name}`);
                field.focus();
                return false;
            }

            // 檢查長度限制
            const maxLength = this.maxInputLength[type] || this.maxInputLength[field.id] || 255;
            if (value.length > maxLength) {
                this.showError(`${name}長度不能超過 ${maxLength} 個字元`);
                field.focus();
                return false;
            }
        }

        // 檢查角色安全性
        if (!this.allowedRoles.includes(this.selectedRole)) {
            this.showError('無效的角色選擇');
            this.logSecurityEvent('invalid_role_in_validation', { selectedRole: this.selectedRole });
            return false;
        }

        // 檢查服務條款
        if (!this.agreeTermsInput.checked) {
            this.showError('請同意服務條款和隱私政策');
            return false;
        }

        // 檢查所有驗證結果
        return validations.every(valid => valid);
    }

    /**
     * 清理表單資料
     */
    sanitizeFormData() {
        if (this.firstNameInput) {
            this.firstNameInput.value = this.sanitizeInput(this.firstNameInput.value, 'name');
        }
        if (this.lastNameInput) {
            this.lastNameInput.value = this.sanitizeInput(this.lastNameInput.value, 'name');
        }
        if (this.emailInput) {
            this.emailInput.value = this.sanitizeInput(this.emailInput.value, 'email');
        }
        if (this.usernameInput) {
            this.usernameInput.value = this.sanitizeInput(this.usernameInput.value, 'username');
        }
        if (this.phoneInput) {
            this.phoneInput.value = this.sanitizeInput(this.phoneInput.value, 'phone');
        }
    }

    async handleRegister(e) {
        e.preventDefault();

        // 防止重複提交
        if (this.isSubmitting) {
            console.log('⚠️ 註冊正在進行中，請勿重複提交');
            return;
        }

        console.log('🔄 開始註冊流程...');

        // 表單驗證
        if (!this.validateForm()) {
            console.log('❌ 表單驗證失敗');
            return;
        }

        // 收集和清理表單資料
        const formData = this.collectSecureFormData();

        // 最終安全檢查
        if (!this.finalSecurityCheck(formData)) {
            this.logSecurityEvent('final_security_check_failed', formData);
            return;
        }

        console.log('📝 註冊資料:', { ...formData, password: '***' });

        try {
            this.isSubmitting = true;
            this.setLoading(true);
            this.hideMessages();

            // 調用註冊 API
            const response = await fetch('/auth/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(formData)
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || errorData.message || '註冊失敗');
            }

            const result = await response.json();

            console.log('✅ 註冊成功:', result);

            this.showSuccess(`註冊成功！歡迎加入 InU Learning，${formData.first_name}！正在跳轉...`);

            // 延遲跳轉到對應的前端應用
            setTimeout(() => {
                this.redirectByRole(this.selectedRole);
            }, 2000);

        } catch (error) {
            console.error('❌ 註冊錯誤:', error);

            // 處理特定的錯誤類型
            let errorMessage = Utils.getErrorMessage(error);

            // 處理常見的註冊錯誤
            if (error.userMessage || error.message) {
                const message = error.userMessage || error.message;
                if (message.includes('email') && message.includes('exists')) {
                    errorMessage = '此電子郵件已被註冊，請使用其他郵件地址或前往登入';
                } else if (message.includes('username') && message.includes('exists')) {
                    errorMessage = '此用戶名已被使用，請選擇其他用戶名';
                } else if (message.includes('管理員')) {
                    errorMessage = '系統管理員帳號無法通過此方式註冊，請聯繫系統管理員';
                } else if (message.includes('角色')) {
                    errorMessage = '無效的角色選擇，僅允許學生、家長、教師註冊';
                }
            }

            this.showError(errorMessage);

        } finally {
            this.isSubmitting = false;
            this.setLoading(false);
        }
    }

    /**
     * 安全地收集表單資料
     */
    collectSecureFormData() {
        return {
            email: this.sanitizeInput(this.emailInput.value, 'email').toLowerCase(),
            username: this.sanitizeInput(this.usernameInput.value, 'username').toLowerCase(),
            password: this.passwordInput.value, // 密碼不進行清理，保持原始
            role: this.selectedRole,
            first_name: this.sanitizeInput(this.firstNameInput.value, 'name'),
            last_name: this.sanitizeInput(this.lastNameInput.value, 'name'),
            phone: this.phoneInput.value.trim() ? this.sanitizeInput(this.phoneInput.value, 'phone') : null
        };
    }

    /**
     * 最終安全檢查
     */
    finalSecurityCheck(formData) {
        // 檢查所有必要欄位
        const requiredFields = ['email', 'username', 'password', 'role', 'first_name', 'last_name'];
        for (const field of requiredFields) {
            if (!formData[field] || (typeof formData[field] === 'string' && !formData[field].trim())) {
                this.showError(`資料不完整：缺少${field}`);
                return false;
            }
        }

        // 檢查角色安全性
        if (!this.allowedRoles.includes(formData.role)) {
            this.showError('無效的角色');
            return false;
        }

        // 檢查字符長度
        if (formData.email.length > this.maxInputLength.email ||
            formData.username.length > this.maxInputLength.username ||
            formData.password.length > this.maxInputLength.password ||
            formData.first_name.length > this.maxInputLength.firstName ||
            formData.last_name.length > this.maxInputLength.lastName) {
            this.showError('輸入資料超過長度限制');
            return false;
        }

        // 檢查基本格式
        if (!Utils.isValidEmail(formData.email)) {
            this.showError('電子郵件格式無效');
            return false;
        }

        if (formData.phone && !Utils.isValidPhone(formData.phone)) {
            this.showError('電話號碼格式無效');
            return false;
        }

        return true;
    }

    redirectByRole(role) {
        // 安全檢查角色
        if (!this.allowedRoles.includes(role)) {
            console.error('❌ 嘗試跳轉到無效角色:', role);
            this.logSecurityEvent('invalid_redirect_role', { role });
            this.showError('系統錯誤：無效的用戶角色');
            return;
        }

        const roleRedirectMap = {
            'student': 'http://localhost:8080',     // 學生前端
            'parent': 'http://localhost:8082',      // 家長前端  
            'teacher': 'http://localhost:8083'      // 教師前端
        };

        const targetURL = roleRedirectMap[role];

        if (targetURL) {
            console.log('🔄 跳轉到:', targetURL);

            // 安全地創建歡迎訊息
            const welcomeParams = new URLSearchParams();
            welcomeParams.set('welcome', 'true');
            welcomeParams.set('role', this.sanitizeInput(role, 'text'));

            // 安全地處理姓名
            const firstName = this.sanitizeInput(this.firstNameInput.value, 'name');
            const lastName = this.sanitizeInput(this.lastNameInput.value, 'name');
            welcomeParams.set('name', `${firstName} ${lastName}`);

            const redirectURL = `${targetURL}?${welcomeParams.toString()}`;

            // 驗證 URL 安全性
            if (this.isValidRedirectURL(redirectURL)) {
                window.location.href = redirectURL;
            } else {
                console.error('❌ 無效的重定向 URL:', redirectURL);
                this.logSecurityEvent('invalid_redirect_url', { redirectURL });
                this.showError('系統錯誤：重定向失敗');
            }
        } else {
            console.error('❌ 未知的用戶角色:', role);
            this.showError('系統錯誤：未知的用戶角色，請聯繫系統管理員');
        }
    }

    /**
     * 驗證重定向 URL 的安全性
     */
    isValidRedirectURL(url) {
        try {
            const urlObj = new URL(url);

            // 只允許本地主機重定向
            if (urlObj.hostname !== 'localhost') {
                return false;
            }

            // 只允許特定端口
            const allowedPorts = ['8080', '8082', '8083'];
            if (!allowedPorts.includes(urlObj.port)) {
                return false;
            }

            // 只允許 HTTP 協議（開發環境）
            if (urlObj.protocol !== 'http:') {
                return false;
            }

            return true;
        } catch (error) {
            console.error('URL 驗證錯誤:', error);
            return false;
        }
    }

    setLoading(loading) {
        if (!this.registerBtn) return;

        this.registerBtn.disabled = loading;

        if (loading) {
            this.registerText.classList.add('hidden');
            this.loadingSpinner.classList.remove('hidden');
            this.registerBtn.classList.add('opacity-75', 'cursor-not-allowed');

            // 禁用所有表單輸入
            const inputs = this.registerForm.querySelectorAll('input, button, select');
            inputs.forEach(input => {
                if (input !== this.registerBtn) {
                    input.disabled = true;
                }
            });
        } else {
            this.registerText.classList.remove('hidden');
            this.loadingSpinner.classList.add('hidden');
            this.registerBtn.classList.remove('opacity-75', 'cursor-not-allowed');

            // 重新啟用所有表單輸入
            const inputs = this.registerForm.querySelectorAll('input, button, select');
            inputs.forEach(input => {
                input.disabled = false;
            });
        }
    }

    showError(message) {
        this.hideMessages();

        if (this.errorMessage) {
            this.errorMessage.textContent = message;
            this.errorMessage.classList.remove('hidden');

            // 滾動到錯誤訊息
            this.errorMessage.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

            // 5秒後自動隱藏
            setTimeout(() => this.hideMessages(), 5000);
        }

        console.log('❌ 錯誤訊息:', message);
    }

    showSuccess(message) {
        this.hideMessages();

        if (this.successMessage) {
            this.successMessage.textContent = message;
            this.successMessage.classList.remove('hidden');

            // 滾動到成功訊息
            this.successMessage.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }

        console.log('✅ 成功訊息:', message);
    }

    hideMessages() {
        if (this.errorMessage) {
            this.errorMessage.classList.add('hidden');
        }
        if (this.successMessage) {
            this.successMessage.classList.add('hidden');
        }
    }
}

// 初始化註冊系統
document.addEventListener('DOMContentLoaded', () => {
    // 檢查依賴
    if (typeof Utils === 'undefined') {
        console.error('❌ Utils 工具函數未載入');
        return;
    }

    if (typeof apiClient === 'undefined') {
        console.error('❌ API 客戶端未載入');
        return;
    }

    console.log('🚀 正在初始化註冊系統...');

    try {
        new UnifiedRegister();
    } catch (error) {
        console.error('❌ 註冊系統初始化失敗:', error);

        // 顯示基本錯誤訊息
        const errorDiv = document.createElement('div');
        errorDiv.className = 'fixed top-4 right-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded';
        errorDiv.textContent = '註冊系統初始化失敗，請重新整理頁面';
        document.body.appendChild(errorDiv);

        setTimeout(() => {
            if (errorDiv.parentNode) {
                errorDiv.parentNode.removeChild(errorDiv);
            }
        }, 5000);
    }
});