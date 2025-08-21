## 簡報講稿：InULearning 個人化學習平台（v1.0 → v1.1）

> 本講稿依據專案文件與實作現況彙整，對應文件：`00_project_summary.md`、`01_adr_template.md`、`02_system_architecture_document.md`、`03_system_design_document.md`、`04_api_design.md`、`05_security_privacy_review_checklist_template.md`、`06_production_readiness_review_template.md`、`07_project_structure.md`、`08_file_dependencies.md`、`09_class_relationships_template.md`。

---

## 目錄
- 專案動機（Why）
- 專案目標（What）
- 前端設計（Frontend）
- 後端設計（Backend）
- 資料庫設計（Data Layer）

---

## 1. 專案動機（Why）

### 1.1 痛點與市場缺口
- 學生：傳統教學難以因材施教，挫折時缺少即時支援，興趣下滑（參見 `00_project_summary.md` 1.2）。
- 家長：資訊不對稱，難以理解真實學習狀態，溝通焦慮升高。
- 老師：班級人數多、差異大，難以精準診斷與個別化輔導。
- 市場：缺少能自動分析弱點、生成視覺化報告、提供個人化練習並同時支援學生/家長/老師的整合平台。

### 1.2 解法概念
- 以 AI 驅動的學習診斷與個人化推薦：
  - 將「精準診斷 → 個人化治療 → 數據化追蹤」形成閉環。
  - 讓家長/老師透過儀表板即時獲得可行洞察與建議（`02_system_architecture_document.md`）。

### 1.3 技術選型核心理由（高層）
- 架構：微服務 + 事件驅動，便於團隊分工與獨立擴展（`02_system_architecture_document.md` 4.1）。
- 後端：Python + FastAPI（高性能、型別支援、OpenAPI 自動化）。
- AI：Google Gemini（多模態、穩定 API）、短期以 Redis + RQ 實作非同步任務（`01_adr_template.md`）。
- 數據：PostgreSQL（結構化學習歷程）、MongoDB（題庫文檔靈活）、MinIO（多媒體）、Redis（快取）。
- 前端：原生 HTML/CSS/JS + Bootstrap/Tailwind（MVP 成本低、快速迭代）。

### 1.4 主要實作難題與解法（宏觀）
- 長耗時 AI 任務阻塞：以 Redis + RQ 佇列化，API 採「觸發 + 查詢」模式（`01_adr_template.md`、`04_api_design.md` 6.7）。
- 題庫檢索多維條件且需高速：MongoDB 文檔模型 + 索引策略，題目熱點快取 Redis。
- 多角色與權限：JWT + RBAC/Scopes，端點按角色/範圍檢查（`04_api_design.md` 3.2）。
- 觀測性與安全：先行 JSON 結構化日誌與基礎速率限制規劃，逐步導入 TLS、Secrets 管理、監控告警（`05_security_privacy_review_checklist_template.md`、`06_production_readiness_review_template.md`）。

---

## 2. 專案目標（What）

### 2.1 產品目標與 KPI（`00_project_summary.md` 1.5）
- 精準診斷：AI 自動分析弱點；相似題推薦相關度 > 80%。
- 學習提效：弱科成效提升 ≥ 20%。
- 親子互動：滿意度 ≥ 4.0/5.0，理解度提升 ≥ 30%。
- 留存：用戶留存率 ≥ 70%。

### 2.2 MVP 範圍（里程碑）
- 第一階段：會員系統、智慧出題、自動批改、相似題、學習歷程（已完成）。
- 第二階段：AI 智慧化升級、家長/班級儀表板與整合（進行中）。

### 2.3 成功的工程定義（工程 SLO/NFR）
- 延遲：P95 < 500ms（核心 API）；AI 任務 P95 完成 < 5 分鐘（非同步）。
- 可用性：99.9%。
- 可維護性：測試覆蓋率 > 80%，清晰分層與界面（`03_system_design_document.md`）。

---

## 3. 前端設計（Frontend）

### 3.1 技術選型與理由
- HTML5/CSS3/JavaScript（ES6+）：MVP 工期短，團隊熟悉；避免過度工程（`02_system_architecture_document.md` 5.1）。
- UI：Bootstrap 5 或 Tailwind CSS，快速響應式開發。
- 架構風格：前後端分離，以輕量路由與模組化 JS 管理頁面與狀態。

### 3.2 資料流與狀態管理邏輯
- 單頁/多頁混合：
  - `pages/exercise.html`：出題/答題與計時。
  - `pages/results.html`：詳解、弱點與推薦呈現。
  - `pages/dashboard.html`：趨勢、進度、弱項視覺化。
- 狀態：
  - 使用 LocalStorage 保存短期 UI 狀態（如題目進度、計時），JWT 存於 Memory（避免 XSS 外洩）。
  - API 模組 `js/api/*` 封裝後端呼叫，統一加上 `Authorization: Bearer <JWT>` 與錯誤處理（`07_project_structure.md`）。

### 3.3 API 呼叫與錯誤處理（前端視角）
- 設計邏輯：
  - 統一 `fetchJson(url, {method, body})`，處理 Content-Type、錯誤碼與重試策略。
  - 429/5xx → 指數退避；401 → 導向登入；403 → 顯示權限提示。
- 非同步 AI 任務：
  - 提交答案後，若需要深度分析，觸發 `/ai/analysis` 或等待 `/learning/sessions/{id}/submit` 內嵌分析完成。
  - 顯示「分析中」進度條，背景輪詢 `/ai/analysis/{task_id}`。

### 3.4 可用性與可及性
- 可用性：骨架屏 + 漸進式載入；斷線提示與重試。
- 可及性（A11y）：語義化標記、對比度、鍵盤可達、ARIA 標籤。

### 3.5 遇到的前端難題與解法
- CORS 與跨域 Cookie：改以 Bearer Token + API Gateway 控制 CORS；嚴控 Allowed Origins。
- 大量清單渲染（成績/趨勢）：虛擬列表或分頁 API（`04_api_design.md` 2.7）。
- 圖表展示：以輕量圖表庫，將後端已聚合數據直接渲染，避免前端重計算。

---

## 4. 後端設計（Backend）

### 4.1 架構與服務邊界
- API Gateway（Nginx）統一入口。
- 微服務：認證、題庫、學習、AI 分析、家長儀表板（`02_system_architecture_document.md` 4.2）。
- 非同步：AI 分析內部以 Redis + RQ 佇列（`01_adr_template.md`）。

### 4.2 技術選型與理由
- FastAPI：高性能、型別註解友好、自帶 OpenAPI；易於單元測試。
- Redis + RQ：MVP 期快速落地非同步，重用現有 Redis，部署/維運簡單（ADR 決策）。
- Nginx：反向代理、路由、基本速率限制與 TLS 終結（生產規劃）。

### 4.3 核心程式設計邏輯（以學習流程為例）
- 主要組件（`03_system_design_document.md` 3.1）：
  - `LearningController`：HTTP 端點；授權/驗證 → 調用服務層。
  - `LearningService`：協調 `ExerciseGenerator`、`GradingCoordinator`、`LearningTracker`、`AIIntegrator`。
  - `ExerciseGenerator`：查題庫、平衡題型、難度校準。
  - `GradingCoordinator`：批改答案、產生詳解（正錯皆有）。
  - `LearningTracker`：記錄學習歷程與統計；更新使用者檔案。
  - `AIIntegrator`：弱點分析與推薦（可同步/非同步）。

#### 流程（答案提交與回饋）
1) 驗證會話 → 2) 自動批改（正確性/分數/回饋） → 3) 生成詳解（全部題目）
→ 4) 觸發/整合 AI 弱點分析 → 5) 更新學習歷程與用戶檔案 → 6) 回傳結果。

### 4.4 API 設計邏輯（`04_api_design.md`）
- 風格：RESTful、資源導向、`/api/v1` 版控、JSON 一致回應結構。
- 授權：JWT Bearer + RBAC/Scopes；物件級/功能級權限檢查（學生/家長/教師）。
- 可靠性：冪等端點設計（提交）、標準錯誤碼、重試/熔斷/降級策略預留。
- 代表性端點：
  - `POST /learning/exercises`：創建個人化練習。
  - `POST /learning/sessions/{id}/submit`：提交答案，回傳分數、逐題詳解、弱點分析（重點：即使答對也有詳解）。
  - `GET /learning/users/{user_id}/trends`：學習趨勢。
  - `POST /ai/analysis` + `GET /ai/analysis/{task_id}`：非同步任務觸發與查詢（避免阻塞）。

### 4.5 非同步任務的挑戰與解法
- 難題：LLM 推理不可預期、任務峰谷大；同步阻塞體驗差。
- 解法：
  - 以 RQ 進行任務序列化與重試，Redis 快取最新任務結果（TTL）。
  - 提供健康檢查與佇列監控端點，前端輪詢/批量查詢（`/ai/analysis/status/batch`）。
  - 若超時/失敗，降級為規則推薦或延遲返回。

### 4.6 安全與上線準備（摘錄）
- 安全（`05_security_privacy_review_checklist_template.md`）：強制 TLS（生產）、Secrets 管理（Vault/Secrets Manager）、PII 欄位級加密、速率限制與 WAF。
- 生產準備（`06_production_readiness_review_template.md`）：
  - 黃金四指標監控與 SLO 儀表板；
  - 負載/壓力測試；
  - 回滾機制/演練與 Runbook；
  - 容器安全：非 root、鏡像掃描 Gate。

---

## 5. 資料庫設計（Data Layer）

### 5.1 多存儲選型與理由
- PostgreSQL：結構化學習歷程與分析統計、關聯查詢強；事務一致性（`03_system_design_document.md` 3.3）。
- MongoDB：題庫文檔，結構彈性、易擴展知識點/多媒體欄位；配合索引與分頁。
- MinIO：題目圖片/音檔/詳解圖片等多媒體；S3 相容、可本地部署。
- Redis：會話、熱點快取、AI 任務狀態/結果。

### 5.2 主要資料表（PostgreSQL）
- `learning_sessions`：會話主檔，含年級/科目/版本、狀態、分數與時間。
- `learning_records`：逐題紀錄，含知識點、對錯、用時、分數。
- `user_learning_profiles`：用戶學習檔案，強弱項、等級、平均正確率。
- `weakness_analysis_history`：弱點分析歷史（AI 輸出持久化）。
- `learning_progress_snapshots`：趨勢/快照（家長/教師視圖支撐）。
- 關鍵索引：合成索引 + GIN（知識點/概念），滿足高頻查詢（參見 `03_system_design_document.md` 索引列表）。

### 5.3 題庫（MongoDB）
- 文檔結構：`Question` 含 `grade/subject/publisher/chapter/topic/knowledge_point/difficulty/options/answer` 等。
- 檢索：條件查詢 + 排序 + 分頁；避免 N+1，以批次載入。

### 5.4 資料一致性與性能策略
- 一致性：
  - 提交答案 → 先寫入 `learning_records`，AI 結果回填 `weakness_analysis_history`；以 `session_id` 關聯。
  - Redis 快取任務結果，TTL 過期後以 DB 為準。
- 性能：
  - 讀寫分離（規劃）、連線池、慢查詢監控。
  - 熱門題目/趨勢快取；統計類查詢預聚合。

### 5.5 常見資料問題與解方
- 題目版本/章節演進：在 MongoDB 中保留 `publisher/version` 欄位並設計索引；報表端按版本維度聚合。
- PII 與隱私：PostgreSQL 欄位級加密（規劃）；備份加密與最小權限存取；導出/刪除流程（`05_security_privacy_review_checklist_template.md`）。

---

## 補充：API 設計原則速記（便於簡報現場闡述）
- 路徑：資源複數、語義清晰（如 `/learning/sessions`）。
- 版控：`/api/v1`；非相容變更升版（`04_api_design.md` 9.x）。
- 權限：JWT + Scopes；物件級授權（學生僅能查自身，家長僅查關聯）。
- 錯誤：標準錯誤格式與錯誤碼字典；開發者訊息與 help_url（便於前端/運維）。
- 非同步：`202 Accepted` + `task_id`，後續 `GET` 查狀態。
- 可觀測性：`request_id/trace_id`、結構化日誌、性能指標。

---

## 簡報建議話術（逐頁要點）
- 動機：先講三方痛點，再亮出我們的閉環方案（診斷→治療→追蹤）。
- 目標：用 KPI 說話，帶出學習提效與家長關係改善。
- 前端：強調 MVP 輕量、可用性/A11y、API 封裝與錯誤處理策略。
- 後端：微服務邊界清晰、Redis+RQ 非同步、冪等與錯誤碼體系。
- 資料庫：Postgres×Mongo×MinIO×Redis 各司其職，索引與快取保性能。
- 風險與上線：安全/監控/容量/回滾的 No-Go 準則，展現工程自律。

---

## 參考與對應
- 架構與設計：`02_system_architecture_document.md`、`03_system_design_document.md`、`07_project_structure.md`
- API：`04_api_design.md`
- 安全與上線：`05_security_privacy_review_checklist_template.md`、`06_production_readiness_review_template.md`
- 決策：`01_adr_template.md`
- 概覽：`00_project_summary.md`
