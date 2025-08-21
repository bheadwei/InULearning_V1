/**
 * 共用工具函數 (Shared Utility Functions) - InULearning 個人化學習平台
 * 
 * 提供跨應用程式的共用工具函數，包括：
 * - DOM 操作工具
 * - 日期時間處理
 * - 資料驗證
 * - 本地儲存管理
 * - 錯誤處理
 * - 效能優化工具
 */

// ===== 全域變數 =====
const APP_CONFIG = {
    API_BASE_URL: '/api/v1',
    STORAGE_PREFIX: 'inulearning_',
    DATE_FORMAT: 'YYYY-MM-DD',
    TIME_FORMAT: 'HH:mm:ss',
    DATETIME_FORMAT: 'YYYY-MM-DD HH:mm:ss'
};

// ===== DOM 操作工具 =====

/**
 * 安全的 DOM 元素選擇器
 * @param {string} selector - CSS 選擇器
 * @param {Element} parent - 父元素 (可選)
 * @returns {Element|null} 找到的元素或 null
 */
function $(selector, parent = document) {
    try {
        return parent.querySelector(selector);
    } catch (error) {
        console.error('DOM 選擇器錯誤:', error);
        return null;
    }
}

/**
 * 安全的 DOM 元素集合選擇器
 * @param {string} selector - CSS 選擇器
 * @param {Element} parent - 父元素 (可選)
 * @returns {NodeList|Array} 找到的元素集合
 */
function $$(selector, parent = document) {
    try {
        return parent.querySelectorAll(selector);
    } catch (error) {
        console.error('DOM 集合選擇器錯誤:', error);
        return [];
    }
}

/**
 * 建立 DOM 元素
 * @param {string} tagName - 標籤名稱
 * @param {Object} attributes - 屬性物件
 * @param {string} textContent - 文字內容 (可選)
 * @returns {Element} 建立的元素
 */
function createElement(tagName, attributes = {}, textContent = '') {
    const element = document.createElement(tagName);

    // 設定屬性
    Object.entries(attributes).forEach(([key, value]) => {
        if (key === 'className') {
            element.className = value;
        } else if (key === 'textContent') {
            element.textContent = value;
        } else {
            element.setAttribute(key, value);
        }
    });

    // 設定文字內容
    if (textContent) {
        element.textContent = textContent;
    }

    return element;
}

/**
 * 移除元素的所有子元素
 * @param {Element} element - 目標元素
 */
function clearElement(element) {
    if (element) {
        element.innerHTML = '';
    }
}

/**
 * 顯示/隱藏元素
 * @param {Element} element - 目標元素
 * @param {boolean} show - 是否顯示
 */
function toggleElement(element, show) {
    if (element) {
        element.style.display = show ? '' : 'none';
    }
}

// ===== 日期時間處理 =====

/**
 * 格式化日期
 * @param {Date|string} date - 日期物件或字串
 * @param {string} format - 格式字串
 * @returns {string} 格式化後的日期字串
 */
function formatDate(date, format = APP_CONFIG.DATE_FORMAT) {
    if (!date) return '';

    const d = new Date(date);
    if (isNaN(d.getTime())) return '';

    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const seconds = String(d.getSeconds()).padStart(2, '0');

    return format
        .replace('YYYY', year)
        .replace('MM', month)
        .replace('DD', day)
        .replace('HH', hours)
        .replace('mm', minutes)
        .replace('ss', seconds);
}

/**
 * 取得相對時間描述
 * @param {Date|string} date - 日期物件或字串
 * @returns {string} 相對時間描述
 */
function getRelativeTime(date) {
    if (!date) return '';

    const now = new Date();
    const target = new Date(date);
    const diffMs = now - target;
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMinutes < 1) return '剛剛';
    if (diffMinutes < 60) return `${diffMinutes} 分鐘前`;
    if (diffHours < 24) return `${diffHours} 小時前`;
    if (diffDays < 7) return `${diffDays} 天前`;

    return formatDate(target, 'MM-DD');
}

/**
 * 檢查日期是否為今天
 * @param {Date|string} date - 日期物件或字串
 * @returns {boolean} 是否為今天
 */
function isToday(date) {
    if (!date) return false;

    const today = new Date();
    const target = new Date(date);

    return today.toDateString() === target.toDateString();
}

// ===== 資料驗證 =====

/**
 * 驗證電子郵件格式
 * @param {string} email - 電子郵件
 * @returns {boolean} 是否有效
 */
function isValidEmail(email) {
    if (!email) return false;

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

/**
 * 驗證密碼強度
 * @param {string} password - 密碼
 * @returns {Object} 驗證結果
 */
function validatePassword(password) {
    if (!password) {
        return { isValid: false, message: '密碼不能為空' };
    }

    const minLength = 8;
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumbers = /\d/.test(password);
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);

    const errors = [];

    if (password.length < minLength) {
        errors.push(`密碼至少需要 ${minLength} 個字元`);
    }
    if (!hasUpperCase) {
        errors.push('密碼需要包含大寫字母');
    }
    if (!hasLowerCase) {
        errors.push('密碼需要包含小寫字母');
    }
    if (!hasNumbers) {
        errors.push('密碼需要包含數字');
    }
    if (!hasSpecialChar) {
        errors.push('密碼需要包含特殊字元');
    }

    return {
        isValid: errors.length === 0,
        message: errors.length > 0 ? errors.join(', ') : '密碼強度良好',
        strength: Math.max(0, 5 - errors.length)
    };
}

/**
 * 驗證手機號碼格式
 * @param {string} phone - 手機號碼
 * @returns {boolean} 是否有效
 */
function isValidPhone(phone) {
    if (!phone) return false;

    // 台灣手機號碼格式
    const phoneRegex = /^09\d{8}$/;
    return phoneRegex.test(phone.replace(/\s/g, ''));
}

/**
 * 驗證身份證字號
 * @param {string} id - 身份證字號
 * @returns {boolean} 是否有效
 */
function isValidTaiwanID(id) {
    if (!id) return false;

    // 台灣身份證字號格式
    const idRegex = /^[A-Z][12]\d{8}$/;
    if (!idRegex.test(id)) return false;

    // 檢查碼驗證
    const letters = 'ABCDEFGHJKLMNPQRSTUVXYWZIO';
    const letterValues = {};
    for (let i = 0; i < letters.length; i++) {
        letterValues[letters[i]] = i + 10;
    }

    const firstLetter = id.charAt(0);
    const firstValue = Math.floor(letterValues[firstLetter] / 10) + (letterValues[firstLetter] % 10) * 9;

    let sum = firstValue;
    for (let i = 1; i < 9; i++) {
        sum += parseInt(id.charAt(i)) * (9 - i);
    }
    sum += parseInt(id.charAt(9));

    return sum % 10 === 0;
}

// ===== 本地儲存管理 =====

/**
 * 設定本地儲存項目
 * @param {string} key - 鍵名
 * @param {any} value - 值
 * @param {number} ttl - 存活時間 (秒，可選)
 */
function setStorageItem(key, value, ttl = null) {
    try {
        const fullKey = APP_CONFIG.STORAGE_PREFIX + key;
        const item = {
            value: value,
            timestamp: Date.now()
        };

        if (ttl) {
            item.expires = Date.now() + (ttl * 1000);
        }

        localStorage.setItem(fullKey, JSON.stringify(item));
    } catch (error) {
        console.error('設定本地儲存失敗:', error);
    }
}

/**
 * 取得本地儲存項目
 * @param {string} key - 鍵名
 * @param {any} defaultValue - 預設值
 * @returns {any} 儲存的值或預設值
 */
function getStorageItem(key, defaultValue = null) {
    try {
        const fullKey = APP_CONFIG.STORAGE_PREFIX + key;
        const item = localStorage.getItem(fullKey);

        if (!item) return defaultValue;

        const parsed = JSON.parse(item);

        // 檢查是否過期
        if (parsed.expires && Date.now() > parsed.expires) {
            localStorage.removeItem(fullKey);
            return defaultValue;
        }

        return parsed.value;
    } catch (error) {
        console.error('取得本地儲存失敗:', error);
        return defaultValue;
    }
}

/**
 * 移除本地儲存項目
 * @param {string} key - 鍵名
 */
function removeStorageItem(key) {
    try {
        const fullKey = APP_CONFIG.STORAGE_PREFIX + key;
        localStorage.removeItem(fullKey);
    } catch (error) {
        console.error('移除本地儲存失敗:', error);
    }
}

/**
 * 清除所有本地儲存
 */
function clearStorage() {
    try {
        const keys = Object.keys(localStorage);
        keys.forEach(key => {
            if (key.startsWith(APP_CONFIG.STORAGE_PREFIX)) {
                localStorage.removeItem(key);
            }
        });
    } catch (error) {
        console.error('清除本地儲存失敗:', error);
    }
}

// ===== 錯誤處理 =====

/**
 * 統一的錯誤處理函數
 * @param {Error} error - 錯誤物件
 * @param {string} context - 錯誤上下文
 */
function handleError(error, context = '') {
    console.error(`錯誤 [${context}]:`, error);

    // 記錄錯誤到伺服器 (可選)
    // logErrorToServer(error, context);

    // 顯示使用者友善的錯誤訊息
    showErrorMessage(getErrorMessage(error));
}

/**
 * 取得使用者友善的錯誤訊息
 * @param {Error} error - 錯誤物件
 * @returns {string} 錯誤訊息
 */
function getErrorMessage(error) {
    if (!error) return '發生未知錯誤';

    // 網路錯誤
    if (error.name === 'NetworkError' || error.message.includes('fetch')) {
        return '網路連線失敗，請檢查網路設定';
    }

    // 超時錯誤
    if (error.name === 'TimeoutError' || error.message.includes('timeout')) {
        return '請求超時，請稍後再試';
    }

    // 認證錯誤
    if (error.status === 401) {
        return '登入已過期，請重新登入';
    }

    // 權限錯誤
    if (error.status === 403) {
        return '沒有權限執行此操作';
    }

    // 伺服器錯誤
    if (error.status >= 500) {
        return '伺服器發生錯誤，請稍後再試';
    }

    // 自定義錯誤訊息
    if (error.userMessage) {
        return error.userMessage;
    }

    return error.message || '發生未知錯誤';
}

/**
 * 顯示錯誤訊息
 * @param {string} message - 錯誤訊息
 * @param {string} type - 訊息類型 (error, warning, info)
 */
function showErrorMessage(message, type = 'error') {
    // 建立錯誤訊息元素
    const alertDiv = createElement('div', {
        className: `alert alert-${type === 'error' ? 'danger' : type}`,
        role: 'alert'
    }, message);

    // 插入到頁面頂部
    const container = $('.container') || document.body;
    container.insertBefore(alertDiv, container.firstChild);

    // 自動移除
    setTimeout(() => {
        if (alertDiv.parentNode) {
            alertDiv.parentNode.removeChild(alertDiv);
        }
    }, 5000);
}

// ===== 效能優化工具 =====

/**
 * 防抖函數
 * @param {Function} func - 要防抖的函數
 * @param {number} wait - 等待時間 (毫秒)
 * @returns {Function} 防抖後的函數
 */
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * 節流函數
 * @param {Function} func - 要節流的函數
 * @param {number} limit - 限制時間 (毫秒)
 * @returns {Function} 節流後的函數
 */
function throttle(func, limit) {
    let inThrottle;
    return function executedFunction(...args) {
        if (!inThrottle) {
            func.apply(this, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

/**
 * 延遲執行函數
 * @param {number} ms - 延遲時間 (毫秒)
 * @returns {Promise} Promise 物件
 */
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// ===== 字串處理 =====

/**
 * 截斷字串
 * @param {string} str - 原始字串
 * @param {number} length - 最大長度
 * @param {string} suffix - 後綴
 * @returns {string} 截斷後的字串
 */
function truncateString(str, length, suffix = '...') {
    if (!str || str.length <= length) return str;
    return str.substring(0, length) + suffix;
}

/**
 * 格式化數字
 * @param {number} num - 數字
 * @param {number} decimals - 小數位數
 * @returns {string} 格式化後的數字
 */
function formatNumber(num, decimals = 0) {
    if (isNaN(num)) return '0';
    return Number(num).toLocaleString('zh-TW', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
    });
}

/**
 * 格式化檔案大小
 * @param {number} bytes - 位元組數
 * @returns {string} 格式化後的檔案大小
 */
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// ===== 陣列和物件處理 =====

/**
 * 深層複製物件
 * @param {any} obj - 要複製的物件
 * @returns {any} 複製後的物件
 */
function deepClone(obj) {
    if (obj === null || typeof obj !== 'object') return obj;
    if (obj instanceof Date) return new Date(obj.getTime());
    if (obj instanceof Array) return obj.map(item => deepClone(item));
    if (typeof obj === 'object') {
        const clonedObj = {};
        for (const key in obj) {
            if (obj.hasOwnProperty(key)) {
                clonedObj[key] = deepClone(obj[key]);
            }
        }
        return clonedObj;
    }
}

/**
 * 陣列去重
 * @param {Array} array - 原始陣列
 * @param {string} key - 物件鍵名 (可選)
 * @returns {Array} 去重後的陣列
 */
function uniqueArray(array, key = null) {
    if (!Array.isArray(array)) return [];

    if (key) {
        const seen = new Set();
        return array.filter(item => {
            const value = item[key];
            if (seen.has(value)) {
                return false;
            }
            seen.add(value);
            return true;
        });
    }

    return [...new Set(array)];
}

/**
 * 陣列分組
 * @param {Array} array - 原始陣列
 * @param {string|Function} key - 分組鍵或函數
 * @returns {Object} 分組後的物件
 */
function groupArray(array, key) {
    if (!Array.isArray(array)) return {};

    return array.reduce((groups, item) => {
        const groupKey = typeof key === 'function' ? key(item) : item[key];
        if (!groups[groupKey]) {
            groups[groupKey] = [];
        }
        groups[groupKey].push(item);
        return groups;
    }, {});
}

// ===== 匯出工具函數 =====
window.Utils = {
    // DOM 操作
    $,
    $$,
    createElement,
    clearElement,
    toggleElement,

    // 日期時間
    formatDate,
    getRelativeTime,
    isToday,

    // 資料驗證
    isValidEmail,
    validatePassword,
    isValidPhone,
    isValidTaiwanID,

    // 本地儲存
    setStorageItem,
    getStorageItem,
    removeStorageItem,
    clearStorage,

    // 錯誤處理
    handleError,
    getErrorMessage,
    showErrorMessage,

    // 效能優化
    debounce,
    throttle,
    delay,

    // 字串處理
    truncateString,
    formatNumber,
    formatFileSize,

    // 陣列和物件處理
    deepClone,
    uniqueArray,
    groupArray,

    // 配置
    config: APP_CONFIG
}; 