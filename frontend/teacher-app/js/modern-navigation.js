// 現代化導航組件
class ModernNavigation {
    constructor() {
        this.currentPage = this.getCurrentPage();
        this.init();
    }

    init() {
        this.createModernNavbar();
        this.setupEventListeners();
        this.updateActiveLink();
    }

    getCurrentPage() {
        const path = window.location.pathname;
        if (path.includes('students')) return 'students';
        if (path.includes('assignments')) return 'assignments';
        if (path.includes('questions')) return 'questions';
        if (path.includes('grades')) return 'grades';
        if (path.includes('analytics')) return 'analytics';
        if (path.includes('classes')) return 'classes';
        return 'dashboard';
    }

    createModernNavbar() {
        const navbar = document.querySelector('.navbar');
        if (!navbar) return;

        // 添加現代化樣式
        navbar.innerHTML = `
            <div class="navbar-container">
                <div class="navbar-brand">
                    <div class="brand-icon">
                        <i class="fas fa-graduation-cap"></i>
                    </div>
                    <div class="brand-text">
                        <span class="brand-title">InULearning</span>
                        <span class="brand-subtitle">教師台</span>
                    </div>
                </div>
                
                <div class="navbar-menu">
                    <a href="../index.html" class="nav-link" data-page="dashboard">
                        <div class="nav-icon">
                            <i class="fas fa-home"></i>
                        </div>
                        <span class="nav-text">首頁</span>
                        <div class="nav-indicator"></div>
                    </a>
                    <a href="students-enhanced.html" class="nav-link" data-page="students">
                        <div class="nav-icon">
                            <i class="fas fa-users"></i>
                        </div>
                        <span class="nav-text">學生管理</span>
                        <div class="nav-indicator"></div>
                    </a>
                    <a href="assignments-enhanced.html" class="nav-link" data-page="assignments">
                        <div class="nav-icon">
                            <i class="fas fa-tasks"></i>
                        </div>
                        <span class="nav-text">作業管理</span>
                        <div class="nav-indicator"></div>
                    </a>
                    <a href="questions-enhanced.html" class="nav-link" data-page="questions">
                        <div class="nav-icon">
                            <i class="fas fa-question-circle"></i>
                        </div>
                        <span class="nav-text">題目管理</span>
                        <div class="nav-indicator"></div>
                    </a>
                    <a href="grades-enhanced.html" class="nav-link" data-page="grades">
                        <div class="nav-icon">
                            <i class="fas fa-chart-bar"></i>
                        </div>
                        <span class="nav-text">成績管理</span>
                        <div class="nav-indicator"></div>
                    </a>
                    <a href="analytics-enhanced.html" class="nav-link" data-page="analytics">
                        <div class="nav-icon">
                            <i class="fas fa-analytics"></i>
                        </div>
                        <span class="nav-text">學習分析</span>
                        <div class="nav-indicator"></div>
                    </a>
                </div>

                <div class="navbar-user">
                    <div class="user-profile">
                        <div class="user-avatar">
                            <i class="fas fa-user"></i>
                        </div>
                        <div class="user-info">
                            <span class="user-name">王老師</span>
                            <span class="user-role">數學科教師</span>
                        </div>
                        <div class="user-dropdown-toggle">
                            <i class="fas fa-chevron-down"></i>
                        </div>
                    </div>
                    <div class="user-dropdown-menu">
                        <a href="profile.html" class="dropdown-item">
                            <i class="fas fa-user-edit"></i>
                            <span>個人資料</span>
                        </a>
                        <a href="settings.html" class="dropdown-item">
                            <i class="fas fa-cog"></i>
                            <span>系統設定</span>
                        </a>
                        <div class="dropdown-divider"></div>
                        <a href="#" class="dropdown-item" id="logout-btn">
                            <i class="fas fa-sign-out-alt"></i>
                            <span>登出</span>
                        </a>
                    </div>
                </div>

                <div class="mobile-menu-toggle">
                    <span></span>
                    <span></span>
                    <span></span>
                </div>
            </div>
        `;

        // 添加現代化CSS樣式
        this.addModernStyles();
    }

    addModernStyles() {
        const style = document.createElement('style');
        style.textContent = `
            /* 現代化導航樣式 */
            .navbar {
                background: var(--glass-bg);
                backdrop-filter: blur(20px);
                border-bottom: 1px solid var(--glass-border);
                position: sticky;
                top: 0;
                z-index: var(--z-sticky);
                padding: 0;
                box-shadow: var(--shadow-sm);
            }

            .navbar-container {
                max-width: 1400px;
                margin: 0 auto;
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 1rem 2rem;
                position: relative;
            }

            .navbar-brand {
                display: flex;
                align-items: center;
                gap: 1rem;
                text-decoration: none;
                color: white;
            }

            .brand-icon {
                width: 48px;
                height: 48px;
                background: var(--success-gradient);
                border-radius: var(--radius-xl);
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 1.5rem;
                color: white;
                box-shadow: var(--shadow-md);
            }

            .brand-text {
                display: flex;
                flex-direction: column;
            }

            .brand-title {
                font-size: 1.25rem;
                font-weight: var(--font-weight-bold);
                line-height: 1;
            }

            .brand-subtitle {
                font-size: 0.75rem;
                opacity: 0.8;
                font-weight: var(--font-weight-medium);
            }

            .navbar-menu {
                display: flex;
                gap: 0.5rem;
                align-items: center;
            }

            .nav-link {
                display: flex;
                align-items: center;
                gap: 0.75rem;
                padding: 0.75rem 1rem;
                border-radius: var(--radius-xl);
                text-decoration: none;
                color: rgba(255, 255, 255, 0.8);
                font-weight: var(--font-weight-medium);
                font-size: var(--font-size-sm);
                transition: var(--transition-smooth);
                position: relative;
                overflow: hidden;
            }

            .nav-link::before {
                content: '';
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(255, 255, 255, 0.1);
                transform: scaleX(0);
                transform-origin: left;
                transition: var(--transition-smooth);
                z-index: -1;
            }

            .nav-link:hover::before {
                transform: scaleX(1);
            }

            .nav-link:hover {
                color: white;
                transform: translateY(-2px);
            }

            .nav-link.active {
                background: rgba(255, 255, 255, 0.15);
                color: white;
                box-shadow: var(--shadow-sm);
            }

            .nav-link.active .nav-indicator {
                opacity: 1;
                transform: scaleX(1);
            }

            .nav-icon {
                width: 20px;
                height: 20px;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 1rem;
            }

            .nav-indicator {
                position: absolute;
                bottom: 0;
                left: 50%;
                transform: translateX(-50%) scaleX(0);
                width: 20px;
                height: 2px;
                background: var(--success-gradient);
                border-radius: var(--radius-full);
                opacity: 0;
                transition: var(--transition-smooth);
            }

            .navbar-user {
                position: relative;
            }

            .user-profile {
                display: flex;
                align-items: center;
                gap: 0.75rem;
                padding: 0.5rem 1rem;
                background: rgba(255, 255, 255, 0.1);
                border: 1px solid rgba(255, 255, 255, 0.2);
                border-radius: var(--radius-full);
                cursor: pointer;
                transition: var(--transition-smooth);
            }

            .user-profile:hover {
                background: rgba(255, 255, 255, 0.15);
                transform: translateY(-2px);
            }

            .user-avatar {
                width: 36px;
                height: 36px;
                background: var(--primary-gradient);
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                color: white;
                font-size: 0.875rem;
            }

            .user-info {
                display: flex;
                flex-direction: column;
                align-items: flex-start;
            }

            .user-name {
                font-size: var(--font-size-sm);
                font-weight: var(--font-weight-semibold);
                color: white;
                line-height: 1;
            }

            .user-role {
                font-size: var(--font-size-xs);
                color: rgba(255, 255, 255, 0.7);
                line-height: 1;
            }

            .user-dropdown-toggle {
                color: rgba(255, 255, 255, 0.7);
                transition: var(--transition-fast);
            }

            .user-dropdown-menu {
                position: absolute;
                top: calc(100% + 0.5rem);
                right: 0;
                min-width: 200px;
                background: var(--glass-bg);
                backdrop-filter: blur(20px);
                border: 1px solid var(--glass-border);
                border-radius: var(--radius-xl);
                box-shadow: var(--shadow-lg);
                padding: 0.5rem;
                opacity: 0;
                visibility: hidden;
                transform: translateY(-10px);
                transition: var(--transition-smooth);
                z-index: var(--z-dropdown);
            }

            .user-dropdown-menu.show {
                opacity: 1;
                visibility: visible;
                transform: translateY(0);
            }

            .dropdown-item {
                display: flex;
                align-items: center;
                gap: 0.75rem;
                padding: 0.75rem 1rem;
                border-radius: var(--radius-lg);
                text-decoration: none;
                color: rgba(255, 255, 255, 0.9);
                font-size: var(--font-size-sm);
                transition: var(--transition-fast);
            }

            .dropdown-item:hover {
                background: rgba(255, 255, 255, 0.1);
                color: white;
            }

            .dropdown-divider {
                height: 1px;
                background: rgba(255, 255, 255, 0.1);
                margin: 0.5rem 0;
            }

            .mobile-menu-toggle {
                display: none;
                flex-direction: column;
                gap: 4px;
                cursor: pointer;
                padding: 0.5rem;
            }

            .mobile-menu-toggle span {
                width: 24px;
                height: 2px;
                background: white;
                border-radius: 1px;
                transition: var(--transition-fast);
            }

            /* 響應式設計 */
            @media (max-width: 768px) {
                .navbar-container {
                    padding: 1rem;
                }

                .navbar-menu {
                    display: none;
                }

                .mobile-menu-toggle {
                    display: flex;
                }

                .user-info {
                    display: none;
                }

                .brand-text {
                    display: none;
                }
            }

            @media (max-width: 640px) {
                .navbar-container {
                    padding: 0.75rem 1rem;
                }

                .brand-icon {
                    width: 40px;
                    height: 40px;
                    font-size: 1.25rem;
                }
            }
        `;
        document.head.appendChild(style);
    }

    setupEventListeners() {
        // 用戶下拉選單
        const userProfile = document.querySelector('.user-profile');
        const userMenu = document.querySelector('.user-dropdown-menu');

        if (userProfile && userMenu) {
            userProfile.addEventListener('click', (e) => {
                e.stopPropagation();
                userMenu.classList.toggle('show');
            });

            document.addEventListener('click', () => {
                userMenu.classList.remove('show');
            });
        }

        // 登出功能
        const logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.handleLogout();
            });
        }

        // 移動端選單
        const mobileToggle = document.querySelector('.mobile-menu-toggle');
        const navbarMenu = document.querySelector('.navbar-menu');

        if (mobileToggle && navbarMenu) {
            mobileToggle.addEventListener('click', () => {
                navbarMenu.classList.toggle('show');
            });
        }
    }

    updateActiveLink() {
        const navLinks = document.querySelectorAll('.nav-link');
        navLinks.forEach(link => {
            link.classList.remove('active');
            if (link.dataset.page === this.currentPage) {
                link.classList.add('active');
            }
        });
    }

    handleLogout() {
        if (confirm('確定要登出嗎？')) {
            // 清除本地存儲
            localStorage.removeItem('teacher_token');
            sessionStorage.clear();

            // 重定向到登入頁面
            window.location.href = '../../shared/auth/login.html';
        }
    }
}

// 自動初始化
document.addEventListener('DOMContentLoaded', () => {
    new ModernNavigation();
});