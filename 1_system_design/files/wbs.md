---

# InULearning 個人化學習平台 - 專案工作分解結構 (WBS) 與執行查核清單

---

**專案名稱:** `InULearning 個人化學習平台`  
**專案編號:** `AIPE01-InU-01`  
**專案經理:** `[待指派]`  
**開發週期:** `40 週 (約 200 工作天)`  
**建立日期:** `2024-12-20`  
**版本:** `v1.0`

---

## 📋 專案概覽與目標

### 🎯 專案目標
- [ ] **主要目標 1:** `建立精準的學習診斷系統，透過 AI 自動分析學生弱點`
  - [ ] Phase 1: 完成核心系統架構與基礎服務建設
  - [ ] Phase 2: 開發學生端核心學習循環功能 (出題、作答、批改、分析)
- [ ] **主要目標 2:** `提供個人化學習治療方案，提升學習效率與興趣`
  - [ ] Phase 2: 實現 AI 弱點分析與個人化題目、詳解推薦
  - [ ] Phase 3: 開發學習趨勢追蹤與進度視覺化功能
- [ ] **主要目標 3:** `優化親子溝通模式，將家長從監督者轉化為支持者`
  - [ ] Phase 3: 建立家長儀表板與 AI 溝通建議功能

### 📊 成功指標 (KPIs)
- [ ] **指標 A:** `學生在弱點科目的學習成效提升 ≥ 20%`
- [ ] **指標 B:** `家長對孩子學習狀況了解度提升 ≥ 30%`
- [ ] **指標 C:** `親子溝通滿意度評分 ≥ 4.0/5.0`
- [ ] **指標 D:** `核心 API 平均響應時間 (P95) < 500ms`
- [ ] **指標 E:** `系統可用性 ≥ 99.9%`

---

## 🗓️ 專案時程與里程碑

| 階段 | 期間 | 里程碑 | 完成標準 | 狀態 |
|:---:|:---:|:---|:---|:---:|
| **Phase 1** | Week 1-4 | 規劃與核心基礎建設 | ✅ 架構設計定版 + 開發環境就緒 + CI/CD 基礎管線建立 | ⏳ **待開始** |
| **Phase 2** | Week 5-24 | MVP 核心功能開發 | ✅ 學生端核心學習循環功能開發完成與單元/整合測試通過 | ⏳ **待開始** |
| **Phase 3** | Week 25-40 | 全端整合、進階功能與部署 | ✅ 全角色功能整合 + E2E 測試通過 + 產品正式上線 | ⏳ **待開始** |

---

## 🏗️ 工作分解結構 (WBS) 與執行查核清單

### **Phase 1: 規劃與核心基礎建設 (Week 1-4)**

#### **1.1 專案初始化與環境設置**

**負責人:** `DevOps / Tech Lead`  
**預計工時:** `40 小時`

##### ✅ 基礎設施配置
- [ ] **[P0]** 根據 `07_project_structure.md` 建立 `docker-compose.dev.yml`
  - [ ] PostgreSQL 服務配置
  - [ ] MongoDB 服務配置
  - [ ] Redis 服務配置
  - [ ] MinIO 對象儲存服務配置
  - [ ] RabbitMQ 訊息佇列服務配置
  - [ ] Milvus 向量資料庫服務配置
- [ ] **[P0]** 驗證所有基礎服務容器可正常啟動與通信

##### ✅ 專案結構與開發環境
- [ ] **[P0]** 建立 `07_project_structure.md` 中定義的完整專案目錄結構
- [ ] **[P0]** 配置根目錄 `.env.example`，包含所有服務的環境變數
- [ ] **[P1]** 為各微服務建立 `requirements.txt` 與 `Dockerfile`
- [ ] **[P1]** 配置程式碼風格與靜態分析工具 (Black, Ruff, mypy)
- [ ] **[P1]** 建立基礎 CI/CD Pipeline (e.g., GitHub Actions)，包含自動化測試與 Docker 映像檔建置

**📋 查核標準:**
- [ ] 開發環境可透過 `docker-compose up -d` 一鍵啟動
- [ ] 新成員可根據 `docs/development/getting_started.md` 在 2 小時內完成環境配置
- [ ] 每次程式碼提交皆能觸發 CI 流程

---

#### **1.2 系統架構與 API 設計定版**

**負責人:** `Architect / Tech Lead`  
**預計工時:** `40 小時`

##### ✅ 架構與資料庫設計
- [ ] **[P0]** 最終審查並定版系統架構文件 (`02_system_architecture_document.md`)
- [ ] **[P0]** 根據 `03_system_design_document.md` 完成 PostgreSQL Schema 設計與 ER 圖
- [ ] **[P0]** 建立資料庫遷移腳本 (`database/migrations/postgresql/`)
- [ ] **[P1]** 建立 MongoDB 集合 (Collection) 設計與驗證腳本
- [ ] **[P1]** 準備核心種子資料 (`database/seeds/`)

##### ✅ API 契約定義
- [ ] **[P0]** 根據 `04_api_design.md` 完成 OpenAPI v3.x 規格文件 (`docs/api/openapi.yaml`)
- [ ] **[P1]** 在 `backend/shared/schemas/` 中建立所有共用的 Pydantic 資料模型
- [ ] **[P1]** 建立 Postman Collection 用於 API 手動測試

**📋 查核標準:**
- [ ] 所有設計文件通過團隊最終審查
- [ ] API 規範定義清晰，可供前後端團隊依此獨立開發
- [ ] 資料庫遷移腳本可成功在空白資料庫上執行

---

### **Phase 2: MVP 核心功能開發 (Week 5-24)**

#### **2.1 後端 - 認證與用戶服務 (`auth-service`)**

**負責人:** `Backend Developer`  
**預計工時:** `80 小時`

- [ ] **[P0]** 實現 `POST /auth/register` (三種角色註冊)
- [ ] **[P0]** 實現 `POST /auth/login` (JWT Token 生成)
- [ ] **[P0]** 實現 `GET /users/profile` 與 `PATCH /users/profile`
- [ ] **[P1]** 實現 `POST /auth/refresh` 與 `DELETE /auth/logout` (Token 刷新與黑名單機制)
- [ ] **[P1]** 整合 PostgreSQL 資料庫，完成 User 相關資料表操作
- [ ] **[P0]** 撰寫用戶認證與檔案管理的單元測試與整合測試

**📋 查核標準:**
- [ ] 功能符合 `04_api_design.md` 規範
- [ ] 單元測試覆蓋率 > 80%

---

#### **2.2 後端 - 題庫管理服務 (`question-bank-service`)**

**負責人:** `Backend Developer`  
**預計工時:** `100 小時`

- [ ] **[P0]** 實現題目 CRUD 的內部 API (供管理後台使用)
- [ ] **[P0]** 實現 `POST /files/upload` API，整合 MinIO 進行檔案上傳
- [ ] **[P1]** 實現 `GET /files/{file_id}` 與 `DELETE /files/{file_id}`
- [ ] **[P0]** 整合 MongoDB，完成 Question 集合的查詢與操作
- [ ] **[P1]** 設計並實現高效的題目查詢邏輯 (依年級、科目、知識點)
- [ ] **[P0]** 撰寫題庫與檔案管理的單元測試與整合測試

**📋 查核標準:**
- [ ] 功能符合 `04_api_design.md` 規範
- [ ] 可成功上傳多媒體檔案至 MinIO 並取得存取 URL
- [ ] 題目查詢 API 效能達標

---

#### **2.3 後端 - 核心學習服務 (`learning-service`)**

**負責人:** `Backend Lead / Senior Developer`  
**預計工時:** `160 小時`

- [ ] **[P0]** 實現 `POST /learning/exercises` (創建個人化練習)
  - [ ] 整合 `question-bank-service` 獲取題目
- [ ] **[P0]** 實現 `POST /learning/sessions/{session_id}/submit` (提交答案與批改)
  - [ ] 實現自動批改與分數計算邏輯
  - [ ] 實現詳解提供邏輯 (不論對錯)
- [ ] **[P0]** 整合 `ai-analysis-service` 獲取弱點分析與推薦
- [ ] **[P1]** 實現 `GET /learning/sessions` 與 `GET /learning/sessions/{session_id}`
- [ ] **[P1]** 實現 `GET /learning/recommendations`
- [ ] **[P0]** 整合 PostgreSQL，完成 `learning_sessions`、`learning_records` 等資料表操作
- [ ] **[P0]** 撰寫核心學習流程的單元測試與整合測試

**📋 查核標準:**
- [ ] 功能符合 `03_system_design_document.md` 與 `04_api_design.md` 詳細設計
- [ ] 成功完成一次完整的「出題 -> 提交 -> 批改 -> 分析 -> 推薦」流程
- [ ] 測試覆蓋率 > 85%

---

#### **2.4 後端 - AI 分析服務 (`ai-analysis-service`)**

**負責人:** `AI/ML Engineer`  
**預計工時:** `160 小時`

- [ ] **[P0]** 實現弱點分析 API (`/learning/sessions/{session_id}/submit` 的一部分)
  - [ ] 整合 Google Gemini API
  - [ ] 建立 `AnalystAgent` (CrewAI) 執行弱點分析任務
- [ ] **[P0]** 實現學習建議 API (`/learning/recommendations`)
  - [ ] 建立 `TutorAgent` 與 `RecommenderAgent` (CrewAI) 生成建議與推薦題目
- [ ] **[P1]** 建立 RAG 系統基礎
  - [ ] 整合 Milvus 向量資料庫
  - [ ] 開發題目向量化流程
- [ ] **[P1]** 開發學習趨勢分析 API (`GET /learning/users/{user_id}/trends`)
- [ ] **[P0]** 撰寫 AI Agent 與外部 API 整合的測試

**📋 查核標準:**
- [ ] AI 服務能根據學生答題記錄，生成結構化的弱點分析 JSON
- [ ] AI 服務能生成針對性的學習建議與相似題目推薦
- [ ] API 回應時間符合效能要求

---

#### **2.5 前端 - 學生應用 (`student-app`)**

**負責人:** `Frontend Developer`  
**預計工時:** `200 小時`

- [ ] **[P0]** 開發使用者認證頁面 (註冊、登入) 並整合 `auth-service` API
- [ ] **[P0]** 開發學生儀表板頁面，顯示學習摘要與推薦
- [ ] **[P0]** 開發練習頁面 (`exercise.html`)
  - [ ] 整合 `learning-service` API 獲取題目
  - [ ] 實現答題介面、計時器、提交功能
- [ ] **[P0]** 開發結果頁面 (`results.html`)
  - [ ] 視覺化呈現成績、答題對錯
  - [ ] 顯示每題的詳解與 AI 弱點分析
- [ ] **[P1]** 開發學習歷程頁面，顯示歷史練習記錄
- [ ] **[P1]** 實現響應式設計 (RWD)，適配桌面與行動裝置
- [ ] **[P0]** 撰寫前端關鍵組件與 API 整合的測試

**📋 查核標準:**
- [ ] UI 實現與設計稿一致
- [ ] 前後端數據交互流暢，無阻塞
- [ ] 使用者操作流程符合預期

---

### **Phase 3: 全端整合、進階功能與部署 (Week 25-40)**

#### **3.1 進階業務功能開發**

**負責人:** `Full-stack Team`  
**預計工時:** `240 小時`

- [ ] **[P1]** 開發後端 `parent-dashboard-service`
  - [ ] 實現 `GET /parent/children` 與 `GET /parent/children/{student_id}/dashboard`
- [ ] **[P1]** 開發前端 `parent-app`，視覺化呈現學生學習報告與 AI 溝通建議
- [ ] **[P2]** 開發後端 `teacher-management-service`
  - [ ] 實現 `GET /teacher/classes` 與 `GET /teacher/classes/{class_id}/analytics`
- [ ] **[P2]** 開發前端 `teacher-app`，呈現班級學習分析報告
- [ ] **[P2]** 開發後端 `notification-service`，整合 RabbitMQ 實現非同步通知

**📋 查核標準:**
- [ ] 家長與教師角色能成功登入並查看對應的數據儀表板
- [ ] 跨服務 API 調用正常，數據一致

---

#### **3.2 系統整合與端到端 (E2E) 測試**

**負責人:** `QA Lead / DevOps`  
**預計工時:** `120 小時`

- [ ] **[P0]** 設計並撰寫涵蓋所有核心用戶故事的 E2E 測試案例
- [ ] **[P0]** 使用自動化測試框架 (e.g., Playwright, Cypress) 執行 E2E 測試
- [ ] **[P1]** 進行手動探索性測試，找出邊界案例與 UI/UX 問題
- [ ] **[P1]** 根據 `02_system_architecture_document.md` 的 NFRs 進行效能基準測試與壓力測試

**📋 查核標準:**
- [ ] 所有 P0 等級的 E2E 測試案例 100% 通過
- [ ] 系統在高併發場景下，API 響應時間與錯誤率符合 KPI 要求
- [ ] 發現的嚴重等級 (Critical/Blocker) Bug 數量為 0

---

#### **3.3 Production Readiness 與部署**

**負責人:** `DevOps / Tech Lead`  
**預計工時:** `120 小時`

- [ ] **[P0]** 撰寫並驗證生產環境部署腳本 (`docker-compose.prod.yml` 或 Kubernetes 配置)
- [ ] **[P0]** 完成 CI/CD Pipeline 的部署階段配置 (藍綠部署或滾動更新)
- [ ] **[P1]** 部署並配置監控系統 (e.g., Prometheus, Grafana) 與告警規則
- [ ] **[P1]** 實施資料庫備份與災難恢復演練
- [ ] **[P1]** 完成並審核所有交付文檔 (部署指南、維運手冊、API 最終版文檔)

**📋 查核標準:**
- [ ] CI/CD Pipeline 可成功自動化部署至預備 (Staging) 環境
- [ ] 監控儀表板能正確顯示所有核心服務的健康狀態與性能指標
- [ ] 部署與回滾流程經過驗證，可在 15 分鐘內完成

---

## 🚨 風險管控與應對策略

### **高風險項目 (Critical Risks)**

#### **風險 1: AI 模型準確度與回應品質不穩定**
- **風險等級:** `🔴 高風險`
- **影響程度:** `核心功能體驗不佳，無法達成專案目標`
- **檢查點:** `2.4 AI 分析服務`
- **應對措施:**
  - [ ] **[主要]** 建立 Ragas 評估框架，持續監控 AI 回應品質
  - [ ] **[次要]** 設計備用規則引擎，在 AI 服務失敗時提供基礎分析
  - [ ] **[持續]** 收集用戶反饋，持續優化 Prompt Engineering 與模型微調

#### **風險 2: 第三方服務依賴風險 (Google Gemini API)**
- **風險等級:** `🟡 中風險`
- **影響程度:** `API 變更或不穩定可能導致服務中斷`
- **檢查點:** `2.4 AI 分析服務`
- **應對措施:**
  - [ ] **[主要]** 建立 API 抽象層，降低對特定模型的耦合度
  - [ ] **[次要]** 設計服務降級與熔斷機制 (Circuit Breaker)
  - [ ] **[持續]** 監控 API 延遲與錯誤率，設置告警

#### **風險 3: 系統效能瓶頸，尤其在 AI 與資料庫密集操作**
- **風險等級:** `🟡 中風險`
- **影響程度:** `用戶體驗差，無法滿足高併發需求`
- **檢查點:** `3.2 E2E 測試`
- **應對措施:**
  - [ ] **[主要]** 在 Phase 2 結束前進行初步效能測試，提早發現瓶頸
  - [ ] **[次要]** 採用非同步任務處理 (Celery) 執行耗時的 AI 分析
  - [ ] **[持續]** 優化資料庫查詢，善用索引與快取 (Redis)

---

## 📊 質量門檻 (Quality Gates)

### **Phase 1 質量門檻**
- [ ] **基礎設施:** 所有服務容器在開發環境中穩定運行
- [ ] **API 契約:** OpenAPI 規格 100% 定義完成並通過審查
- [ ] **CI 流程:** 基礎 CI 流程（代碼檢查、單元測試）建置成功率 > 95%

### **Phase 2 質量門檻**
- [ ] **代碼覆蓋率 (單元測試):** 核心服務 ≥ `80%`
- [ ] **API 回應時間 (本地/開發):** P95 ≤ `300ms` (不含外部 AI 延遲)
- [ ] **整合測試通過率:** 核心服務間整合測試 100% 通過
- [ ] **嚴重等級 (Critical/Blocker) Bug 數量:** 0

### **Phase 3 質量門檻**
- [ ] **E2E 測試通過率:** 關鍵用戶場景 100% 通過
- [ ] **效能壓力測試:** 在 1000 併發用戶下，P95 延遲 < 500ms，錯誤率 < 0.1%
- [ ] **系統可用性 (Uptime):** 預備環境連續運行 72 小時無重大故障
- [ ] **交付文檔完整性與準確性:** 100%