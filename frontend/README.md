# 教師端前端整合包

這個資料夾包含了 InULearning 專案中所有與教師端相關的前端檔案、後端 API 和相關文件。

## 資料夾結構

```
frontend/
├── teacher-app/           # 教師端主要應用程式
│   ├── pages/            # 教師端頁面
│   ├── js/               # JavaScript 檔案
│   ├── css/              # 樣式表檔案
│   ├── assets/           # 靜態資源
│   ├── shared/           # 教師端專用共用元件
│   └── index.html        # 主要入口頁面
├── backend/               # 後端服務
│   ├── teacher-management-service/    # 教師管理服務
│   └── question-bank-service/         # 題庫服務
├── shared/                # 共用元件和資源
│   ├── auth/             # 認證相關
│   ├── js/               # 共用 JavaScript
│   ├── homepage/         # 首頁元件
│   ├── image/            # 圖片處理
│   ├── components/       # 共用元件
│   └── css/              # 共用樣式
├── docs/                  # API 文件
├── config/                # 配置檔案
├── nginx/                 # Nginx 配置
├── rebuild_teacher_frontend.sh    # 重建腳本 (Linux)
├── rebuild_teacher_frontend.bat   # 重建腳本 (Windows)
└── FRONTEND_UPDATE_GUIDE.md       # 更新指南
```

## 主要功能

### 教師端應用程式 (teacher-app/)
- 班級管理
- 學生管理
- 題庫管理
- 測驗管理
- 成績分析
- 個人資料管理

### 後端服務 (backend/)
- **教師管理服務**: 處理教師相關的業務邏輯
- **題庫服務**: 管理題目、章節、知識點等

### 共用元件 (shared/)
- 認證系統
- 導航元件
- 通用 UI 元件
- 樣式和腳本

## 技術架構

- **前端**: HTML5, CSS3, JavaScript (ES6+)
- **後端**: Python (FastAPI)
- **資料庫**: PostgreSQL
- **容器化**: Docker
- **反向代理**: Nginx

## 使用方式

1. 將整個 `frontend` 資料夾複製到目標專案
2. 根據需要調整配置檔案
3. 執行 `rebuild_teacher_frontend.sh` (Linux) 或 `rebuild_teacher_frontend.bat` (Windows)
4. 啟動相關的後端服務

## 注意事項

- 確保目標環境已安裝必要的依賴
- 檢查資料庫連接配置
- 調整 Nginx 配置以符合目標環境
- 更新 API 端點配置

## 版本資訊

- 來源專案: InULearning_V1
- 建立日期: $(date)
- 包含的服務: 教師管理、題庫管理
