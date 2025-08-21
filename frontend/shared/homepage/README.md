# InU Learning 共用首頁

## 概述

這是 InU Learning 系統的共用首頁，提供統一的入口點和平台介紹。首頁採用淺藍色主題，展現 "因你而學，學習只為你" 的品牌理念。

## 設計特色

### 🎨 視覺設計
- **淺藍色主題**: 使用 `#EFF6FF` 和 `#F8FAFC` 的漸層背景
- **現代化 UI**: 採用 Material Design 風格
- **響應式設計**: 支援桌面、平板和手機設備
- **流暢動畫**: 包含滾動效果和懸停動畫

### 📱 響應式佈局
- **桌面版**: 完整功能展示
- **平板版**: 適配中等螢幕
- **手機版**: 優化觸控體驗

## 頁面結構

### 1. 導航欄 (Navigation Bar)
- **Logo**: InU Learning 品牌標識
- **導航連結**: 特色功能、應用入口、關於我們
- **認證按鈕**: 登入和註冊功能

### 2. 英雄區塊 (Hero Section)
- **主標題**: "InU Learning"
- **副標題**: "因你而學，學習只為你"
- **行動按鈕**: 立即登入、了解更多
- **動畫效果**: Logo 脈動和背景浮動

### 3. 特色功能區塊 (Features Section)
展示平台的六大核心特色：
- **AI 智能學習**: 個人化學習路徑
- **學習分析**: 詳細數據分析
- **多角色支援**: 四種用戶角色
- **安全可靠**: 隱私保護
- **跨平台支援**: 多設備相容
- **持續進步**: 系統優化

### 4. 應用入口區塊 (Apps Section)
提供四個主要應用的快速入口：
- **學生練功專區** (8080): AI 驅動學習
- **管理員控制台** (8081): 系統管理
- **家長關懷中心** (8082): 學習監控
- **教師工作台** (8083): 教學管理

### 5. 頁腳 (Footer)
- **品牌資訊**: InU Learning 介紹
- **快速連結**: 重要頁面連結
- **技術支援**: 幫助資源
- **聯絡資訊**: 聯絡方式

## 技術實現

### 前端技術
- **HTML5**: 語義化標籤結構
- **CSS3**: 現代化樣式和動畫
- **JavaScript ES6+**: 互動功能
- **Material Icons**: Google 圖標庫
- **Noto Sans TC**: 中文字體

### 核心功能
1. **平滑滾動**: 頁面內導航
2. **滾動效果**: 導航欄透明度變化
3. **動畫觀察**: 元素進入視窗時的動畫
4. **響應式設計**: 適配不同螢幕尺寸

### 色彩方案
```css
:root {
    --primary-blue: #3B82F6;    /* 主要藍色 */
    --light-blue: #EFF6FF;      /* 淺藍色 */
    --lighter-blue: #F8FAFC;    /* 更淺藍色 */
    --accent-blue: #1E40AF;     /* 強調藍色 */
    --text-dark: #1F2937;       /* 深色文字 */
    --text-light: #6B7280;      /* 淺色文字 */
}
```

## 檔案結構

```
frontend/shared/homepage/
├── index.html          # 主要首頁
└── README.md          # 說明文檔
```

## 使用方式

### 1. 直接訪問
```
http://localhost:80/
```

### 2. 通過 nginx 代理
```
http://localhost/homepage/
```

### 3. 本地開發
```bash
# 在首頁目錄中啟動本地服務器
cd 2_implementation/frontend/shared/homepage
python3 -m http.server 8000
# 然後訪問 http://localhost:8000
```

## 整合配置

### Docker 配置
需要在 `docker-compose.yml` 中添加首頁的映射：

```yaml
nginx:
  volumes:
    - ./2_implementation/frontend/shared/homepage/index.html:/usr/share/nginx/html/index.html
```

### Nginx 配置
確保 nginx 配置正確路由到首頁：

```nginx
location / {
    try_files $uri $uri/ /index.html;
}
```

## 自定義選項

### 修改品牌資訊
在 `index.html` 中修改以下內容：
- Logo 圖片 URL
- 品牌名稱和標語
- 聯絡資訊

### 調整色彩主題
修改 CSS 變數來調整色彩：
```css
:root {
    --primary-blue: #your-color;
    --light-blue: #your-light-color;
}
```

### 新增功能區塊
在 `features-grid` 中添加新的 `feature-card` 元素。

## 性能優化

### 圖片優化
- 使用 WebP 格式
- 實施懶加載
- 壓縮圖片大小

### CSS 優化
- 使用 CSS 變數
- 最小化重複樣式
- 實施關鍵 CSS

### JavaScript 優化
- 使用 Intersection Observer API
- 防抖動滾動事件
- 最小化 DOM 操作

## 瀏覽器支援

- **Chrome**: 90+
- **Firefox**: 88+
- **Safari**: 14+
- **Edge**: 90+

## 無障礙設計

- **ARIA 標籤**: 為互動元素添加標籤
- **鍵盤導航**: 支援鍵盤操作
- **色彩對比**: 符合 WCAG 標準
- **螢幕閱讀器**: 語義化標籤

## 更新日誌

- **v1.0.0** - 初始版本，基本首頁功能
- **v1.1.0** - 新增動畫效果和響應式設計
- **v1.2.0** - 優化性能和無障礙設計

## 聯絡資訊

如有問題或建議，請聯繫開發團隊。 