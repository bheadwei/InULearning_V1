# 安全與隱私設計審查 (Security and Privacy Design Review) - InULearning 平台 v1.1

---

**審查對象 (Review Target):** `InULearning v1.1 / 後端微服務與 AI 分析`

**審查日期 (Review Date):** `2025-08-21`

**審查人員 (Reviewers):** `AIPE01_group2（架構/後端/AI）`

**相關文檔 (Related Documents):**
*   SA 文檔: `02_system_architecture_document.md`
*   SD 文檔: `03_system_design_document.md`
*   API 設計規範: `04_api_design.md`

---

## A. 核心安全原則 (Core Security Principles)

*   `[x]` **最小權限 (Least Privilege):** 系統組件與用戶以 RBAC/Scopes 控制最小權限。
    *   說明: 角色與權限範圍定義於 API；資料庫/IAM 細化策略待落地。
*   `[ ]` **縱深防禦 (Defense in Depth):** 多層控制規劃中（WAF/DDoS/網段隔離）。
*   `[ ]` **預設安全 (Secure by Default):** 生產需強制 HTTPS、嚴格 CORS、最小端口暴露。
*   `[ ]` **攻擊面最小化 (Minimize Attack Surface):** 僅暴露必要服務；容器/反代規則需完善。
*   `[ ]` **職責分離 (Separation of Duties):** 建立變更審批與敏感操作雙人覆核。

## B. 數據生命週期安全與隱私 (Data Lifecycle Security & Privacy)

### B.1 數據分類與收集 (Data Classification & Collection)
*   `[x]` **數據分類 (Data Classification):** PII、教育記錄、內容資產已分類。
*   `[x]` **數據最小化 (Data Minimization):** 僅收集學習必要資訊；不涉信用卡等高風險數據。
*   `[ ]` **用戶同意/告知 (User Consent/Notification):** 補齊隱私權政策與未成年同意流程。

### B.2 數據傳輸 (Data in Transit)
*   `[ ]` **傳輸加密 (Encryption in Transit):** 生產強制 TLS 1.2+（本地開發為 HTTP）。
*   `[ ]` **內部傳輸加密 (Internal Encryption):** mTLS/內部 TLS 待導入。
*   `[ ]` **證書管理 (Certificate Management):** ACME 自動簽發/輪換與密鑰輪替流程待建。

### B.3 數據儲存 (Data at Rest)
*   `[ ]` **儲存加密 (Encryption at Rest):** PostgreSQL/MongoDB/MinIO 靜態與欄位級加密待落地。
*   `[ ]` **金鑰管理 (Key Management):** 由環境變數遷移至 Vault/KMS；制定輪換策略。
*   `[ ]` **數據備份安全:** 實施加密備份與最小權限存取策略。

### B.4 數據使用與處理 (Data Usage & Processing)
*   `[ ]` **日誌記錄中的敏感資訊:** 統一遮罩/脫敏策略待實作；trace_id/request_id 已規劃。
*   `[x]` **第三方共享:** 僅呼叫 Gemini API；不傳個資（持續稽核）。

### B.5 數據保留與銷毀 (Data Retention & Disposal)
*   `[ ]` **保留策略 (Retention Policy):** 定義 PII/教育記錄保留與導出機制。
*   `[ ]` **安全銷毀 (Secure Disposal):** 制定刪除/去識別與 MinIO 物件生命周期策略。

## C. 應用程式安全 (Application Security)

### C.1 身份驗證 (Authentication)
*   `[ ]` **密碼策略:** 複雜度/MFA 待落地。
*   `[ ]` **憑證儲存:** 採用 bcrypt（需在認證服務確認與稽核）。
*   `[x]` **會話管理 (Session Management):** JWT（Access/Refresh）與 Token 生命週期已定義。
*   `[ ]` **暴力破解防護:** 速率限制與鎖定需於反代/閘道層實作。

### C.2 授權與訪問控制 (Authorization & Access Control)
*   `[x]` **物件級別授權 (Object-Level Authorization):** 學生/家長/教師按關聯與班級邊界限制。
*   `[x]` **功能級別授權 (Function-Level Authorization):** 端點以角色/範圍檢查。

### C.3 輸入驗證與輸出編碼 (Input Validation & Output Encoding)
*   `[x]` **防止注入攻擊:** SQLAlchemy 參數化 + Pydantic 嚴格驗證。
*   `[x]` **防止跨站腳本 (XSS):** API 僅輸出 JSON；前端需配置 CSP/輸出編碼（跨專案處理）。
*   `[ ]` **防止跨站請求偽造 (CSRF):** 主要採 JWT Bearer；如改用 Cookie，需新增 CSRF/SameSite。

### C.4 API 安全 (API Security)
*   `[x]` **API 認證/授權:** 端點設計皆有角色/範圍驗證。
*   `[ ]` **速率限制:** 政策既定；需於 Nginx/API Gateway 落地。
*   `[x]` **參數校驗:** FastAPI + Pydantic 全覆蓋。
*   `[x]` **避免數據過度暴露:** 嚴格 Schema 與欄位白名單。

### C.5 依賴庫安全 (Dependency Security)
*   `[ ]` **漏洞掃描:** 在 CI 中導入 `pip-audit`/Snyk/Dependabot。
*   `[ ]` **更新策略:** 設定高危依賴升級 SLA（例：7 天內）。

## D. 基礎設施與運維安全 (Infrastructure & Operations Security)

### D.1 網路安全 (Network Security)
*   `[ ]` **防火牆/安全組:** 生產網段與安全組策略最小開放。
*   `[ ]` **DDoS 防護:** 規劃 Cloudflare/雲端 DDoS 防護。

### D.2 機密管理 (Secrets Management)
*   `[ ]` **安全儲存:** 從環境變數遷移至 Docker Secrets/Vault/Secrets Manager；禁止硬編碼/入庫。
*   `[ ]` **權限與輪換:** 建立最小權限與自動輪換（含 JWT 私鑰）。

### D.3 Docker/容器安全 (Container Security)
*   `[ ]` **最小化基礎鏡像:** 採用 slim/alpine 並審核來源。
*   `[ ]` **非 Root 用戶運行:** Dockerfile 設定非 root 與檔案許可權。
*   `[ ]` **鏡像掃描:** CI/CD 加入鏡像掃描與阻擋規則。

### D.4 日誌與監控 (Logging & Monitoring)
*   `[ ]` **安全事件日誌:** 記錄登入失敗、權限變更、敏感資料存取等事件。
*   `[ ]` **安全告警:** 設定 4xx/5xx、登入失敗暴增等告警規則。

## E. 合規性 (Compliance)
*   `[ ]` **法規識別:** GDPR/本地個資法；教育資料相關規範。
*   `[ ]` **合規性措施:** 隱私權政策、資料主體請求（導出/刪除）與稽核落地。

## F. 審查結論與行動項 (Review Conclusion & Action Items)

*   **主要風險 (Key Risks Identified):**
    *   `缺乏生產級傳輸/靜態加密與機密管理`（高）
    *   `速率限制/WAF/DDoS 未落地`（中-高）
    *   `容器安全與鏡像掃描缺失`（中）
    *   `隱私權/未成年同意與資料保留策略未定義`（高）
*   **行動項 (Action Items):**

| # | 行動項描述 | 負責人 | 預計完成日期 | 狀態 |
|:-:| :--- | :--- | :--- | :--- |
| 1 | 生產入口/內部通訊全面 TLS（含 ACME 自動簽發/輪換） | DevOps | `TBD` | `待辦` |
| 2 | 服務間 mTLS 與 API Gateway 速率限制/熔斷 | DevOps/Backend | `TBD` | `待辦` |
| 3 | Secrets 管理（Docker Secrets/Vault），禁用硬編碼與 Git 存放 | DevOps | `TBD` | `待辦` |
| 4 | PII 欄位級加密與備份加密；金鑰輪換策略 | Backend/DevOps | `TBD` | `待辦` |
| 5 | 容器安全：非 root、最小化鏡像、CI 鏡像掃描 Gate | DevOps | `TBD` | `待辦` |
| 6 | 安全事件日誌與告警：登入失敗/權限變更/4xx5xx 異常 | Backend/DevOps | `TBD` | `待辦` |
| 7 | 隱私/合規：未成年同意、資料保留/刪除政策與流程 | PM/Legal/Backend | `TBD` | `待辦` |

*   **整體評估 (Overall Assessment):** MVP 架構具備 JWT/RBAC/輸入驗證等基本安全機制；在完成加密、Secrets、網路與容器安全、合規策略等關鍵行動項前，不建議公開生產上線。

---
**簽署 (Sign-off):**

*   **安全審查團隊代表:** _______________
*   **專案/功能負責人:** _______________ 