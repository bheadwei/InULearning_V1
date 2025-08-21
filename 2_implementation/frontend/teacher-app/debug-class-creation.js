// 班級創建功能調試腳本
console.log('🔍 開始調試班級創建功能...');

// 檢查必要的元素是否存在
function checkElements() {
    console.log('📋 檢查必要元素...');
    
    const createClassBtn = document.getElementById('createClassBtn');
    const classModal = document.getElementById('classModal');
    const className = document.getElementById('className');
    const classSubject = document.getElementById('classSubject');
    const classDescription = document.getElementById('classDescription');
    
    console.log('createClassBtn:', createClassBtn);
    console.log('classModal:', classModal);
    console.log('className:', className);
    console.log('classSubject:', classSubject);
    console.log('classDescription:', classDescription);
    
    return { createClassBtn, classModal, className, classSubject, classDescription };
}

// 檢查事件綁定
function checkEventBindings() {
    console.log('🔗 檢查事件綁定...');
    
    const createClassBtn = document.getElementById('createClassBtn');
    if (createClassBtn) {
        // 檢查是否有事件監聽器
        const events = getEventListeners(createClassBtn);
        console.log('createClassBtn 事件監聽器:', events);
        
        // 手動綁定事件進行測試
        createClassBtn.addEventListener('click', (e) => {
            console.log('✅ 新增班級按鈕被點擊！');
            console.log('事件對象:', e);
            
            // 檢查 createClass 函數是否存在
            if (typeof createClass === 'function') {
                console.log('✅ createClass 函數存在，調用中...');
                createClass();
            } else {
                console.error('❌ createClass 函數不存在！');
                console.log('全局函數:', Object.keys(window).filter(key => typeof window[key] === 'function'));
            }
        });
        
        console.log('✅ 手動綁定事件完成');
    } else {
        console.error('❌ 找不到新增班級按鈕');
    }
}

// 檢查函數定義
function checkFunctions() {
    console.log('🔧 檢查函數定義...');
    
    const functions = [
        'createClass',
        'saveClass',
        'openModal',
        'closeModal',
        'resetForm',
        'switchTab'
    ];
    
    functions.forEach(funcName => {
        if (typeof window[funcName] === 'function') {
            console.log(`✅ ${funcName} 函數存在`);
        } else {
            console.error(`❌ ${funcName} 函數不存在`);
        }
    });
}

// 檢查 API 客戶端
function checkApiClient() {
    console.log('🌐 檢查 API 客戶端...');
    
    if (typeof apiClient !== 'undefined') {
        console.log('✅ apiClient 存在');
        console.log('apiClient 方法:', Object.getOwnPropertyNames(apiClient));
        console.log('baseUrl:', apiClient.baseUrl);
    } else {
        console.error('❌ apiClient 不存在');
    }
}

// 檢查認證狀態
function checkAuthStatus() {
    console.log('🔐 檢查認證狀態...');
    
    const token = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
    if (token) {
        console.log('✅ 找到認證 token');
        console.log('Token 長度:', token.length);
        console.log('Token 前20字符:', token.substring(0, 20));
        
        try {
            const userInfo = parseJWT(token);
            console.log('用戶信息:', userInfo);
        } catch (error) {
            console.error('Token 解析失敗:', error);
        }
    } else {
        console.error('❌ 沒有找到認證 token');
    }
}

// JWT 解析函數
function parseJWT(token) {
    try {
        const parts = token.split('.');
        if (parts.length !== 3) {
            throw new Error('Invalid JWT format');
        }
        const payload = parts[1];
        const decoded = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
        return JSON.parse(decoded);
    } catch (error) {
        console.error('JWT 解析錯誤:', error);
        throw error;
    }
}

// 測試班級創建 API
async function testCreateClassAPI() {
    console.log('🧪 測試班級創建 API...');
    
    const token = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
    if (!token) {
        console.error('❌ 沒有認證 token，無法測試 API');
        return;
    }
    
    try {
        const response = await fetch('http://localhost/api/v1/relationships/teacher-class/create-class', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                class_name: '調試測試班級',
                subject: '數學'
            })
        });
        
        const data = await response.json();
        console.log('API 回應狀態:', response.status);
        console.log('API 回應數據:', data);
        
        if (response.ok) {
            console.log('✅ API 測試成功');
        } else {
            console.error('❌ API 測試失敗');
        }
    } catch (error) {
        console.error('❌ API 測試錯誤:', error);
    }
}

// 主調試函數
function runDebug() {
    console.log('🚀 開始運行調試...');
    
    // 等待 DOM 完全載入
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            setTimeout(runDebug, 100);
        });
        return;
    }
    
    checkElements();
    checkEventBindings();
    checkFunctions();
    checkApiClient();
    checkAuthStatus();
    
    // 延遲執行 API 測試
    setTimeout(testCreateClassAPI, 1000);
    
    console.log('✅ 調試完成');
}

// 自動運行調試
runDebug();

// 導出調試函數供手動調用
window.debugClassCreation = {
    checkElements,
    checkEventBindings,
    checkFunctions,
    checkApiClient,
    checkAuthStatus,
    testCreateClassAPI,
    runDebug
};
