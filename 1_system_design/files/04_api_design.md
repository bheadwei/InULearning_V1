# API 設計規範 (API Design Specification) - InULearning 個人化學習平台

---

**文件版本 (Document Version):** `v1.3.0`

**最後更新 (Last Updated):** `2025-08-21`

**主要作者/設計師 (Lead Author/Designer):** `AIPE01_group2`

**審核者 (Reviewers):** `AIPE01_group2 團隊成員、技術架構師`

**狀態 (Status):** `已實現 (Implemented)`

**相關 SD 文檔:** `03_system_design_document.md`

**OpenAPI/Swagger 定義文件:**
*   **認證服務:** [http://localhost:8001/docs](http://localhost:8001/docs)
*   **題庫服務:** [http://localhost:8002/docs](http://localhost:8002/docs)
*   **學習服務:** [http://localhost:8003/docs](http://localhost:8003/docs)
*   **AI 分析服務:** [http://localhost:8004/docs](http://localhost:8004/docs)
*   **家長儀表板服務:** [http://localhost:8005/docs](http://localhost:8005/docs)

---

## 目錄 (Table of Contents)

1.  [引言 (Introduction)](#1-引言-introduction)
2.  [通用設計約定 (General Design Conventions)](#2-通用設計約定-general-design-conventions)
3.  [認證與授權 (Authentication and Authorization)](#3-認證與授權-authentication-and-authorization)
4.  [錯誤處理 (Error Handling)](#4-錯誤處理-error-handling)
5.  [速率限制與配額 (Rate Limiting and Quotas)](#5-速率限制與配額-rate-limiting-and-quotas)
6.  [API 端點詳述 (API Endpoint Definitions)](#6-api-端點詳述-api-endpoint-definitions)
7.  [資料模型/Schema 定義 (Data Models / Schema Definitions)](#7-資料模型schema-定義-data-models--schema-definitions)
8.  [安全性考量 (Security Considerations)](#8-安全性考量-security-considerations)
9.  [向後兼容性與棄用策略 (Backward Compatibility and Deprecation Policy)](#9-向後兼容性與棄用策略-backward-compatibility-and-deprecation-policy)
10. [附錄 (Appendices)](#10-附錄-appendices)

---

## 1. 引言 (Introduction)

### 1.1 目的 (Purpose)
為 InULearning 個人化學習平台的前端應用、第三方整合服務和未來的開發者提供一個統一、明確的 RESTful API 接口契約，支援學生學習、家長監控、教師管理三大核心業務場景。

### 1.2 目標讀者 (Target Audience)
- 前端開發團隊（學生端、家長端、教師端、管理後台）
- 移動應用開發者
- 第三方整合服務開發者
- API 後端實現團隊
- 測試工程師
- 技術文檔撰寫者

### 1.3 API 風格與原則 (API Style and Principles)
- **RESTful Architecture:** 遵循 REST 成熟度模型 Level 2，使用 HTTP 動詞表達操作語義
- **前後端分離設計:** 採用完全前後端分離的架構，API 優先設計，確保前端可以獨立開發和部署
- **核心設計原則:**
  - 資源導向設計，使用名詞複數形式的 URI
  - 無狀態通信，每個請求包含完整的上下文信息
  - 冪等性操作，確保重複請求的安全性
  - 統一介面，保持 API 的一致性和可預測性
  - 安全優先，所有端點強制使用 HTTPS
  - JSON 數據交換，API 回應結構保持一致性和可預測性
  - 跨域支持，配置適當的 CORS 政策支持前端應用

---

## 2. 通用設計約定 (General Design Conventions)

### 2.1 基本 URL (Base URL)
- **生產環境 (Production):** `https://api.inulearning.com` (規劃中)
- **預備環境 (Staging):** `https://staging-api.inulearning.com` (規劃中)
- **開發環境 (Development):**
    - **統一入口 (API Gateway):** `http://localhost`
    - **各微服務直接訪問:**
        - **認證服務:** `http://localhost:8001`
        - **題庫服務:** `http://localhost:8002`
        - **學習服務:** `http://localhost:8003`
        - **AI 分析服務:** `http://localhost:8004`
        - **家長儀表板服務:** `http://localhost:8005`

### 2.2 版本控制 (Versioning)
- **策略:** URL 路徑版本控制。所有 API 路徑均以 `/api/v1` 作為前綴。
- **當前版本:** `v1`
- **版本相容性:** 每個主版本至少維護 12 個月，提前 6 個月通知棄用計劃

### 2.3 請求格式 (Request Formats)
- **主要格式:** `application/json` (UTF-8 編碼)
- **其他支持格式:** `multipart/form-data` (檔案上傳專用)
- **Content-Type Header:** 請求體存在時必須包含適當的 `Content-Type`

### 2.4 回應格式 (Response Formats)
- **主要格式:** `application/json` (UTF-8 編碼)
- **統一回應結構:**
    ```json
    // 成功回應
    {
      "data": { /* 實際數據對象或列表 */ },
      "meta": { 
        "timestamp": "2024-12-19T10:30:00Z",
        "version": "v1",
        "pagination": { /* 分頁信息(適用時) */ }
      }
    }
    ```

### 2.5 日期與時間格式 (Date and Time Formats)
- **標準格式:** ISO 8601 格式 `YYYY-MM-DDTHH:mm:ss.sssZ` (UTC 時間)
- **時區處理:** 所有 API 交換的時間數據統一使用 UTC，前端負責本地化顯示

### 2.6 命名約定 (Naming Conventions)
- **資源路徑:** 小寫，多詞使用連字符連接，名詞複數形式 (例如: `/learning-sessions`, `/user-profiles`)
- **查詢參數:** snake_case (例如: `page_size`, `sort_by`, `grade_level`)
- **JSON 欄位:** snake_case (例如: `user_id`, `created_at`, `knowledge_points`)
- **自定義 Headers:** `X-InULearning-` 前綴 (例如: `X-InULearning-Request-ID`)

### 2.7 分頁 (Pagination)
- **策略:** 基於偏移量/限制 (Offset/Limit) 的分頁
- **查詢參數:**
  - `page`: 頁碼，從 1 開始 (預設: 1)
  - `page_size`: 每頁項目數 (預設: 20，最大: 100)
- **回應中的分頁信息:**
    ```json
    "meta": {
      "pagination": {
        "total_items": 120,
        "total_pages": 6,
        "current_page": 1,
        "page_size": 20,
        "has_next": true,
        "has_prev": false,
        "next_url": "/api/v1/learning-sessions?page=2&page_size=20",
        "prev_url": null
      }
    }
    ```

### 2.8 排序 (Sorting)
- **查詢參數:** `sort_by`
- **格式:** `field_name` (升序) 或 `-field_name` (降序)
- **多欄位排序:** `sort_by=created_at,-score` (逗號分隔)
- **可排序欄位:** `created_at`, `updated_at`, `score`, `difficulty`, `grade`

### 2.9 過濾 (Filtering)
- **策略:** 直接使用欄位名作為查詢參數
- **基本過濾:** `/learning-sessions?grade=8A&subject=數學&status=completed`
- **範圍過濾:** 
  - `score_gte`: 分數大於等於
  - `score_lte`: 分數小於等於
  - `created_after`: 創建時間晚於
  - `created_before`: 創建時間早於
- **可過濾欄位:** `grade`, `subject`, `publisher`, `difficulty`, `status`, `score`

### 2.10 部分回應與欄位選擇 (Partial Responses and Field Selection)
- **查詢參數:** `fields`
- **格式:** `fields=id,name,score,created_at` (逗號分隔的欄位列表)
- **目的:** 減少網路傳輸，提升行動端效能

---

## 3. 認證與授權 (Authentication and Authorization)

### 3.1 認證機制 (Authentication Mechanism)
- **主要方式:** JWT (JSON Web Token) Bearer Token
- **Header 格式:** `Authorization: Bearer <access_token>`
- **Token 獲取:** 通過 `/auth/login` 端點獲取
- **Token 有效期:** Access Token 2 小時，Refresh Token 30 天
- **刷新機制:** 使用 Refresh Token 通過 `/auth/refresh` 端點獲取新的 Access Token

### 3.2 授權模型/範圍 (Authorization Model/Scopes)
- **基於角色的訪問控制 (RBAC):**
  - `student`: 學生角色 - 可存取個人學習相關 API
  - `parent`: 家長角色 - 可存取孩子學習狀況相關 API
  - `teacher`: 教師角色 - 可存取班級管理相關 API
  - `admin`: 管理員角色 - 可存取所有管理功能 API

- **權限範圍:**
  - `learning:read`: 讀取學習數據
  - `learning:write`: 創建/更新學習記錄
  - `profile:read`: 讀取用戶檔案
  - `profile:write`: 更新用戶檔案
  - `reports:read`: 讀取報表數據
  - `admin:manage`: 管理員操作權限

---

## 4. 錯誤處理 (Error Handling)

### 4.1 標準錯誤回應格式 (Standard Error Response Format)
```json
{
  "error": {
    "code": "LEARNING_001",
    "message": "請求的參數無效",
    "developer_message": "grade 參數必須是 7A, 7B, 8A, 8B, 9A, 9B 之一",
    "target": "grade",
    "details": [
      {
        "code": "INVALID_ENUM_VALUE",
        "target": "grade",
        "message": "grade 必須是支援的年級值"
      }
    ],
    "help_url": "https://docs.inulearning.com/api/errors#LEARNING_001",
    "request_id": "req_123456789"
  }
}
```

### 4.2 通用 HTTP 狀態碼使用 (Common HTTP Status Codes)
- **2xx - 成功:**
  - `200 OK`: 標準成功回應
  - `201 Created`: 資源創建成功，包含 `Location` header
  - `204 No Content`: 操作成功但無內容返回

- **4xx - 客戶端錯誤:**
  - `400 Bad Request`: 請求格式錯誤或參數無效
  - `401 Unauthorized`: 未提供有效認證憑證
  - `403 Forbidden`: 已認證但無權限執行操作
  - `404 Not Found`: 請求的資源不存在
  - `409 Conflict`: 資源衝突，如重複創建
  - `422 Unprocessable Entity`: 請求格式正確但業務邏輯驗證失敗
  - `429 Too Many Requests`: 超出速率限制

- **5xx - 伺服器錯誤:**
  - `500 Internal Server Error`: 內部伺服器錯誤
  - `502 Bad Gateway`: 上游服務錯誤
  - `503 Service Unavailable`: 服務暫時不可用

### 4.3 業務錯誤碼定義
| 錯誤碼 | HTTP 狀態 | 描述 |
| :--- | :--- | :--- |
| `AUTH_001` | 401 | 無效的認證令牌 |
| `AUTH_002` | 403 | 權限不足 |
| `LEARNING_001` | 400 | 無效的年級參數 |
| `LEARNING_002` | 400 | 無效的科目參數 |
| `LEARNING_003` | 400 | 無效的版本參數 |
| `LEARNING_004` | 404 | 學習會話不存在 |
| `LEARNING_005` | 409 | 會話已結束無法提交 |
| `LEARNING_006` | 500 | MongoDB 題庫連接失敗 |
| `LEARNING_007` | 500 | AI 服務不可用 |
| `LEARNING_008` | 400 | 不支援的年級或科目組合 |
| `LEARNING_009` | 404 | 指定條件下無可用題目 |
| `LEARNING_010` | 404 | 弱點分析記錄不存在 |
| `LEARNING_011` | 400 | 學習趨勢查詢參數無效 |
| `LEARNING_012` | 403 | 無權限存取其他用戶的學習趨勢 |

---

## 5. 速率限制與配額 (Rate Limiting and Quotas)

### 5.1 限制策略
- **基於用戶角色的差異化限制:**
  - `student`: 每分鐘 120 次請求，每小時 3000 次
  - `parent`: 每分鐘 60 次請求，每小時 1500 次  
  - `teacher`: 每分鐘 180 次請求，每小時 5000 次
  - `admin`: 每分鐘 300 次請求，每小時 10000 次

### 5.2 相關 Headers
- `X-RateLimit-Limit`: 當前時間窗口的請求限制
- `X-RateLimit-Remaining`: 剩餘可用請求數
- `X-RateLimit-Reset`: 限制重置的 Unix 時間戳
- `Retry-After`: (429 錯誤時) 建議重試等待秒數

### 5.3 超出限制處理
- **HTTP 狀態:** 429 Too Many Requests
- **回應體:** 標準錯誤格式，包含重試建議
- **白名單機制:** 關鍵業務流程可申請白名單豁免

---

## 6. API 端點詳述 (API Endpoint Definitions)

### 6.1 資源：用戶認證 (Authentication)

#### 6.1.1 `POST /auth/register`
- **描述:** 用戶註冊（支援學生、家長、教師三種角色）
- **認證/授權:** 無需認證
- **請求體:**
    ```json
    {
      "username": "string (required, 3-50 chars)",
      "email": "string (required, email format)",
      "password": "string (required, min 8 chars)",
      "role": "string (required, enum: student/parent/teacher)",
      "profile": {
        "real_name": "string (required)",
        "grade": "string (student only, enum: 7A/7B/8A/8B/9A/9B)",
        "school": "string (optional)"
      }
    }
    ```
- **成功回應 (201 Created):**
    ```json
    {
      "data": {
        "user_id": "uuid",
        "username": "string",
        "email": "string",
        "role": "string",
        "created_at": "datetime"
      }
    }
    ```
- **錯誤回應:** 400 (驗證失敗), 409 (用戶名或郵箱已存在)

#### 6.1.2 `POST /auth/login`
- **描述:** 用戶登入
- **認證/授權:** 無需認證
- **請求體:**
    ```json
    {
      "username": "string (required)",
      "password": "string (required)"
    }
    ```
- **成功回應 (200 OK):**
    ```json
    {
      "data": {
        "access_token": "string (JWT)",
        "refresh_token": "string",
        "token_type": "Bearer",
        "expires_in": 7200,
        "user": {
          "user_id": "uuid",
          "username": "string", 
          "role": "string"
        }
      }
    }
    ```
- **錯誤回應:** 401 (認證失敗)

#### 6.1.3 `POST /auth/refresh`
- **描述:** 刷新存取令牌
- **認證/授權:** 需要有效的 Refresh Token
- **請求體:**
    ```json
    {
      "refresh_token": "string (required)"
    }
    ```
- **成功回應 (200 OK):** 同登入回應格式
- **錯誤回應:** 401 (無效的 Refresh Token)

#### 6.1.4 `DELETE /auth/logout`
- **描述:** 用戶登出（使令牌失效）
- **認證/授權:** 需要有效的 Access Token
- **成功回應 (204 No Content):** 無內容
- **錯誤回應:** 401 (未認證)

### 6.2 資源：學習管理 (Learning Management)

#### 6.2.1 `POST /learning/exercises`
- **描述:** 創建個人化練習會話
- **認證/授權:** `learning:write` 權限
- **請求體:**
    ```json
    {
      "grade": "string (required, enum: 7A/7B/8A/8B/9A/9B)",
      "subject": "string (required, enum: 國文/英文/數學/自然/地理/歷史/公民)",
      "publisher": "string (required, enum: 南一/翰林/康軒)",
      "chapter": "string (optional)",
      "question_count": "integer (optional, default: 10, max: 50)",
      "difficulty": "string (optional, enum: easy/normal/hard)",
      "knowledge_points": "array of strings (optional)"
    }
    ```
- **成功回應 (201 Created):**
    ```json
    {
      "data": {
        "session_id": "uuid",
        "questions": [
          {
            "question_id": "string",
            "grade": "string",
            "subject": "string", 
            "publisher": "string",
            "chapter": "string",
            "topic": "string",
            "knowledge_point": ["string"],
            "difficulty": "string",
            "question": "string",
            "options": {
              "A": "string",
              "B": "string", 
              "C": "string",
              "D": "string"
            }
          }
        ],
        "estimated_time": "integer (minutes)",
        "created_at": "datetime"
      }
    }
    ```
- **錯誤回應:** 400 (參數錯誤), 404 (無可用題目), 500 (題庫服務錯誤)

#### 6.2.2 `POST /learning/sessions/{session_id}/submit`
- **描述:** 提交練習答案並獲得批改結果
- **重要特性:** 
  - **詳解提供:** 不管學生答對或答錯，系統都會提供完整的題目詳解 (`explanation`)
  - **弱點分析保留:** 系統會分析學習表現並提供弱點分析 (`weakness_analysis`)，包含弱點概念、需加強知識點及個人化推薦
  - **差異化反饋:** 答對時著重於解題步驟確認，答錯時重點說明正確解法和常見錯誤
  - **學習導向:** 詳解內容以幫助學生理解概念為主，而非僅提供答案
- **認證/授權:** `learning:write` 權限
- **路徑參數:** `session_id` (UUID)
- **請求體:**
    ```json
    {
      "answers": [
        {
          "question_id": "string",
          "user_answer": "string (A/B/C/D)",
          "time_spent": "integer (seconds)"
        }
      ]
    }
    ```
- **成功回應 (200 OK):**
    ```json
    {
      "data": {
        "session_id": "uuid",
        "overall_score": "decimal",
        "results": [
          {
            "question_id": "string",
            "correct": "boolean",
            "score": "decimal",
            "feedback": "string",
            "explanation": "string (完整題目詳解，不分對錯都提供)"
          }
        ],
        "weakness_analysis": {
          "weak_concepts": ["string"],
          "knowledge_points_to_strengthen": ["string"],
          "recommendations": [
            {
              "type": "string (similar_question/concept_review/practice_set)",
              "question_ids": ["string"],
              "topics": ["string"],
              "difficulty": "string",
              "reason": "string"
            }
          ]
        }
      }
    }
    ```
- **錯誤回應:** 404 (會話不存在), 409 (會話已結束), 500 (AI 服務錯誤)

#### 6.2.3 `GET /learning/sessions`
- **描述:** 獲取學習會話列表
- **認證/授權:** `learning:read` 權限
- **查詢參數:**
  - `page`, `page_size` (分頁)
  - `sort_by` (排序)
  - `grade`, `subject`, `status` (過濾)
  - `created_after`, `created_before` (時間範圍)
- **成功回應 (200 OK):**
    ```json
    {
      "data": [
        {
          "session_id": "uuid",
          "grade": "string",
          "subject": "string",
          "publisher": "string", 
          "chapter": "string",
          "question_count": "integer",
          "status": "string",
          "overall_score": "decimal",
          "start_time": "datetime",
          "end_time": "datetime"
        }
      ],
      "meta": {
        "pagination": { /* 分頁信息 */ }
      }
    }
    ```

#### 6.2.4 `GET /learning/sessions/{session_id}`
- **描述:** 獲取學習會話詳情
- **認證/授權:** `learning:read` 權限
- **路徑參數:** `session_id` (UUID)
- **成功回應 (200 OK):** 包含完整會話信息和答題記錄
- **錯誤回應:** 404 (會話不存在), 403 (無權限存取)

#### 6.2.5 `GET /learning/recommendations`
- **描述:** 獲取個人化學習建議
- **認證/授權:** `learning:read` 權限
- **查詢參數:**
  - `subject` (科目過濾)
  - `limit` (建議數量限制)
- **成功回應 (200 OK):**
    ```json
    {
      "data": {
        "recommendations": [
          {
            "type": "weak_knowledge_point",
            "title": "string",
            "description": "string",
            "priority": "string (high/medium/low)",
            "suggested_actions": ["string"]
          }
        ],
        "generated_at": "datetime"
      }
    }
    ```

### 6.7 資源：AI 分析 (AI Analysis)

> 非同步任務透過 Redis+RQ 在 AI 服務內部排程；提供觸發、查詢與批量端點。

#### 6.7.1 `POST /ai/analysis`
- **描述:** 觸發以 `exercise_record_id` 為單位的 AI 分析任務（弱點分析與學習建議）
- **認證/授權:** `learning:write` 或相應業務權限
- **請求體:**
    ```json
    {
      "exercise_record_id": "uuid",
      "temperature": 1.0,
      "max_output_tokens": 512
    }
    ```
- **成功回應 (202 Accepted):**
    ```json
    { "data": { "task_id": "uuid", "message": "queued" } }
    ```

#### 6.7.2 `GET /ai/analysis/{task_id}`
- **描述:** 查詢任務狀態與結果（若任務完成）
- **認證/授權:** `learning:read`
- **成功回應 (200 OK):**
    ```json
    {
      "data": {
        "status": "succeeded|processing|failed|not_found",
        "result": {
          "學生學習狀況評估": "string",
          "題目詳解與教學建議": "string"
        }
      }
    }
    ```

#### 6.7.3 `POST /ai/analysis/generate`
- **描述:** 單請求生成弱點分析與教學建議（可選帶 `exercise_record_id` 以覆用/持久化）
- **認證/授權:** `learning:write`
- **請求體（簡化）:**
    ```json
    {
      "question": { "grade": "7A", "subject": "數學", "question": "...", "options": {"A": "..."}, "answer": "C" },
      "student_answer": "B",
      "exercise_record_id": "uuid"
    }
    ```
- **成功回應 (200 OK):** 與 6.7.2 中 `result` 結構相同

#### 6.7.4 `POST /ai/analysis/status/batch`
- **描述:** 批量查詢多個 `exercise_record_id` 的最新分析狀態
- **認證/授權:** `learning:read`
- **請求體:** `{ "exercise_record_ids": ["uuid"], "include_data": false, "max_records": 100 }`
- **成功回應 (200 OK):** `{ "data": { "items": [ { "exercise_record_id": "uuid", "status": "succeeded", "has_both": true } ] } }`

#### 6.7.5 `GET /ai/analysis/session/{session_id}/status`
- **描述:** 聚合回傳整個學習會話的分析進度統計
- **認證/授權:** `learning:read`
- **成功回應 (200 OK):** `{ "data": { "total": 20, "succeeded": 12, "processing": 6, "failed": 2, "missing_fields": 0, "latest_updated_at": "..." } }`

#### 6.2.6 `GET /learning/users/{user_id}/trends`
- **描述:** 獲取學生學習趨勢分析和進步記錄
- **認證/授權:** `learning:read` 權限，且用戶只能存取自己的趨勢數據或家長存取孩子的數據
- **路徑參數:** `user_id` (UUID)
- **查詢參數:**
  - `subject` (科目，必填)
  - `period_days` (分析期間天數，預設30天)
  - `include_snapshots` (是否包含快照數據，預設false)
- **成功回應 (200 OK):**
    ```json
    {
      "data": {
        "user_id": "uuid",
        "subject": "string",
        "period_start": "datetime",
        "period_end": "datetime",
        "score_trend": [
          {
            "date": "string (YYYY-MM-DD)",
            "score": "decimal",
            "session_count": "integer"
          }
        ],
        "accuracy_trend": [
          {
            "date": "string (YYYY-MM-DD)",
            "accuracy": "decimal",
            "total_questions": "integer"
          }
        ],
        "concept_mastery_progress": {
          "concept_name": "decimal (0-1 掌握程度)"
        },
        "improvement_areas": ["string"],
        "persistent_weaknesses": ["string"],
        "learning_velocity_trend": "decimal",
        "weakness_analysis_history": [
          {
            "date": "datetime",
            "weak_concepts": ["string"],
            "knowledge_points_to_strengthen": ["string"],
            "overall_score": "decimal",
            "accuracy_rate": "decimal"
          }
        ]
      }
    }
    ```
- **錯誤回應:** 403 (無權限存取), 404 (用戶不存在)

#### 6.2.7 `GET /learning/users/{user_id}/weakness-history`
- **描述:** 獲取學生弱點分析歷史記錄
- **認證/授權:** `learning:read` 權限
- **路徑參數:** `user_id` (UUID)
- **查詢參數:**
  - `subject` (科目過濾)
  - `limit` (記錄數量限制，預設10，最大50)
  - `from_date` (起始日期)
  - `to_date` (結束日期)
- **成功回應 (200 OK):**
    ```json
    {
      "data": [
        {
          "id": "uuid",
          "session_id": "uuid",
          "grade": "string",
          "subject": "string",
          "publisher": "string",
          "weak_concepts": ["string"],
          "knowledge_points_to_strengthen": ["string"],
          "overall_score": "decimal",
          "accuracy_rate": "decimal",
          "recommendations": [
            {
              "type": "string",
              "question_ids": ["string"],
              "topics": ["string"],
              "difficulty": "string",
              "reason": "string"
            }
          ],
          "created_at": "datetime"
        }
      ],
      "meta": {
        "pagination": { /* 分頁信息 */ }
      }
    }
    ```

### 6.3 資源：家長儀表板 (Parent Dashboard)

#### 6.3.1 `GET /parent/children`
- **描述:** 獲取關聯的學生列表
- **認證/授權:** `parent` 角色
- **成功回應 (200 OK):**
    ```json
    {
      "data": [
        {
          "student_id": "uuid",
          "name": "string",
          "grade": "string",
          "school": "string",
          "relationship": "string",
          "created_at": "datetime"
        }
      ]
    }
    ```

#### 6.3.2 `GET /parent/summary/stats`
- **描述:** 彙總家長儀表板統計（可選指定 `child_id`）
- **認證/授權:** `parent` 角色；需攜帶有效 Access Token
- **查詢參數:**
  - `child_id` (optional, UUID)
- **成功回應 (200 OK):**
    ```json
    {
      "data": {
        "children": [
          { "id": 1, "name": "string", "grade": 7, "class_name": "string" }
        ],
        "today_activity": {
          "sessions": 3,
          "questions_answered": 45,
          "avg_accuracy": 0.78
        },
        "weakness_highlights": ["移項運算", "應用問題"],
        "recommendations": [
          { "type": "concept_review", "topics": ["移項法則"], "priority": "high" }
        ]
      }
    }
    ```

### 6.4 資源：檔案管理 (File Management) - 規劃中

#### 6.4.1 `POST /files/upload`
- **描述:** 上傳題目相關的多媒體檔案至MinIO對象儲存
- **認證/授權:** `admin` 角色或 `file:write` 權限
- **請求格式:** `multipart/form-data`
- **請求體:**
    ```
    file: File (required, 支援格式: jpg, png, gif, mp3, wav, mp4)
    file_type: string (required, enum: question_image/option_image/explanation_image/question_audio)
    question_id: string (optional, 關聯的題目ID)
    ```
- **成功回應 (201 Created):**
    ```json
    {
      "data": {
        "file_id": "uuid",
        "file_url": "string (MinIO檔案訪問URL)",
        "file_name": "string",
        "file_size": "integer (bytes)",
        "file_type": "string",
        "content_type": "string",
        "uploaded_at": "datetime"
      }
    }
    ```
- **錯誤回應:** 400 (檔案格式不支援), 413 (檔案過大), 500 (儲存失敗)

#### 6.4.2 `GET /files/{file_id}`
- **描述:** 獲取檔案資訊
- **認證/授權:** `file:read` 權限
- **路徑參數:** `file_id` (UUID)
- **成功回應 (200 OK):**
    ```json
    {
      "data": {
        "file_id": "uuid",
        "file_url": "string",
        "file_name": "string",
        "file_size": "integer",
        "file_type": "string",
        "content_type": "string",
        "uploaded_at": "datetime"
      }
    }
    ```

#### 6.4.3 `DELETE /files/{file_id}`
- **描述:** 刪除檔案（從MinIO和資料庫）
- **認證/授權:** `admin` 角色或 `file:delete` 權限
- **路徑參數:** `file_id` (UUID)
- **成功回應 (204 No Content):** 無內容
- **錯誤回應:** 404 (檔案不存在), 403 (無權限)

### 6.5 資源：教師管理 (Teacher Management) - 規劃中

#### 6.5.1 `GET /teacher/classes`
- **描述:** 獲取教師管理的班級列表
- **認證/授權:** `teacher` 角色
- **成功回應 (200 OK):**
    ```json
    {
      "data": [
        {
          "class_id": "uuid",
          "name": "string",
          "grade": "string", 
          "subject": "string",
          "student_count": "integer",
          "created_at": "datetime"
        }
      ]
    }
    ```

#### 6.5.2 `GET /teacher/classes/{class_id}/analytics`
- **描述:** 獲取班級學習分析報告
- **認證/授權:** `teacher` 角色，且管理該班級
- **路徑參數:** `class_id` (UUID)
- **查詢參數:**
  - `period` (時間範圍)
  - `chapter` (章節過濾)
- **成功回應 (200 OK):**
    ```json
    {
      "data": {
        "class_overview": {
          "total_students": "integer",
          "active_students": "integer",
          "average_progress": "decimal",
          "common_difficulties": ["string"]
        },
        "student_performance": [
          {
            "student_id": "uuid",
            "name": "string",
            "overall_score": "decimal",
            "participation_rate": "decimal",
            "weakness_areas": ["string"]
          }
        ],
        "chapter_analysis": [
          {
            "chapter": "string",
            "class_average": "decimal",
            "difficulty_rating": "string",
            "completion_rate": "decimal"
          }
        ]
      }
    }
    ```

### 6.6 資源：用戶檔案 (User Profiles)

#### 6.6.1 `GET /users/profile`
- **描述:** 獲取當前用戶檔案
- **認證/授權:** `profile:read` 權限
- **成功回應 (200 OK):**
    ```json
    {
      "data": {
        "user_id": "uuid",
        "username": "string",
        "email": "string",
        "role": "string",
        "profile": {
          "real_name": "string",
          "grade": "string (if student)",
          "school": "string",
          "preferences": {
            "preferred_difficulty": "string",
            "study_reminders": "boolean",
            "email_notifications": "boolean"
          }
        },
        "created_at": "datetime",
        "last_login": "datetime"
      }
    }
    ```

#### 6.6.2 `PATCH /users/profile`
- **描述:** 更新用戶檔案
- **認證/授權:** `profile:write` 權限
- **請求體:**
    ```json
    {
      "profile": {
        "real_name": "string (optional)",
        "school": "string (optional)",
        "preferences": {
          "preferred_difficulty": "string (optional)",
          "study_reminders": "boolean (optional)",
          "email_notifications": "boolean (optional)"
        }
      }
    }
    ```
- **成功回應 (200 OK):** 更新後的用戶檔案
- **錯誤回應:** 400 (驗證失敗), 403 (無權限)

---

## 7. 資料模型/Schema 定義 (Data Models / Schema Definitions)

### 7.1 用戶相關 Schema

#### 7.1.1 `UserSchema`
```python
class UserSchema(BaseModel):
    user_id: UUID
    username: str
    email: EmailStr
    role: UserRole  # Enum: student, parent, teacher, admin
    profile: UserProfile
    created_at: datetime
    updated_at: datetime
    last_login: Optional[datetime] = None
    is_active: bool = True

class UserProfile(BaseModel):
    real_name: str
    grade: Optional[GradeEnum] = None  # Only for students
    school: Optional[str] = None
    preferences: UserPreferences

class UserPreferences(BaseModel):
    preferred_difficulty: Optional[DifficultyEnum] = None
    study_reminders: bool = True
    email_notifications: bool = True
    theme: str = "light"
```

#### 7.1.2 `UserCreateSchema`
```python
class UserCreateSchema(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    email: EmailStr
    password: str = Field(..., min_length=8)
    role: UserRole
    profile: UserProfileCreate

class UserProfileCreate(BaseModel):
    real_name: str = Field(..., min_length=1, max_length=100)
    grade: Optional[GradeEnum] = None
    school: Optional[str] = Field(None, max_length=200)
```

### 7.2 學習相關 Schema

#### 7.2.1 `ExerciseSessionSchema`
```python
class ExerciseSessionSchema(BaseModel):
    session_id: UUID
    user_id: UUID
    grade: GradeEnum
    subject: SubjectEnum
    publisher: PublisherEnum
    chapter: Optional[str] = None
    difficulty: Optional[DifficultyEnum] = None
    question_count: int
    status: SessionStatus  # Enum: active, completed, abandoned
    overall_score: Optional[Decimal] = None
    start_time: datetime
    end_time: Optional[datetime] = None
    time_spent: Optional[int] = None  # seconds
    created_at: datetime
    updated_at: datetime
```

#### 7.2.2 `QuestionSchema`
```python
class QuestionSchema(BaseModel):
    question_id: str
    grade: str
    subject: str
    publisher: str
    chapter: str
    topic: str
    knowledge_point: List[str]
    difficulty: str
    question: str
    question_image_url: Optional[str] = None  # 題目圖片URL (存儲在MinIO)
    question_audio_url: Optional[str] = None  # 題目音檔URL (存儲在MinIO)
    options: Dict[str, str]  # {"A": "選項A", "B": "選項B", ...}
    option_images: Optional[Dict[str, str]] = None  # 選項圖片URLs {"A": "image_url", ...}
    answer: str  # 正確答案選項 (A/B/C/D)
    explanation: Optional[str] = None
    explanation_image_url: Optional[str] = None  # 解題圖片URL (存儲在MinIO)
```

#### 7.2.3 `LearningRecordSchema`
```python
class LearningRecordSchema(BaseModel):
    record_id: UUID
    session_id: UUID
    question_id: str
    grade: str
    subject: str
    publisher: str
    chapter: str
    topic: Optional[str] = None
    knowledge_points: List[str]
    difficulty: str
    user_answer: Optional[str] = None
    correct_answer: str
    is_correct: Optional[bool] = None
    score: Optional[Decimal] = None
    time_spent: Optional[int] = None  # seconds
    created_at: datetime

class QuestionResultSchema(BaseModel):
    question_id: str
    correct: bool
    score: Decimal
    feedback: str
    explanation: str = Field(..., description="題目詳解說明，不管答對或答錯都提供完整解題步驟和概念說明")

class SubmissionResultSchema(BaseModel):
    session_id: UUID
    overall_score: Decimal
    results: List[QuestionResultSchema]
    weakness_analysis: Optional[WeaknessAnalysisSchema] = Field(None, description="弱點分析結果，包含學習建議和推薦")
```

### 7.3 分析與報告 Schema

#### 7.3.1 `WeaknessAnalysisSchema`
```python
class WeaknessAnalysisSchema(BaseModel):
    weak_concepts: List[str]
    knowledge_points_to_strengthen: List[str]
    recommendations: List[RecommendationItem]
    confidence_score: Decimal = Field(..., ge=0, le=1)
    generated_at: datetime

class RecommendationItem(BaseModel):
    type: str  # similar_question, concept_review, practice_set
    question_ids: Optional[List[str]] = None
    topics: Optional[List[str]] = None
    difficulty: Optional[str] = None
    reason: str
    priority: str  # high, medium, low

class WeaknessAnalysisRecordSchema(BaseModel):
    id: UUID
    session_id: UUID
    user_id: UUID
    grade: str
    subject: str
    publisher: str
    weak_concepts: List[str]
    knowledge_points_to_strengthen: List[str]
    overall_score: Decimal
    accuracy_rate: Decimal
    improvement_suggestions: Optional[Dict[str, Any]] = None
    trend_analysis: Optional[Dict[str, Any]] = None
    recommendations: List[RecommendationItem]
    analysis_version: str = "v1.0"
    created_at: datetime

class ProgressSnapshotSchema(BaseModel):
    id: UUID
    user_id: UUID
    grade: str
    subject: str
    publisher: str
    snapshot_date: date
    total_sessions: int
    total_questions: int
    average_score: Optional[Decimal] = None
    accuracy_trend: Optional[Decimal] = None
    mastered_concepts: Optional[List[str]] = None
    struggling_concepts: Optional[List[str]] = None
    difficulty_distribution: Optional[Dict[str, Any]] = None
    learning_velocity: Optional[Decimal] = None
    created_at: datetime

class LearningTrendsSchema(BaseModel):
    user_id: UUID
    subject: str
    period_start: datetime
    period_end: datetime
    score_trend: List[Dict[str, Any]] = Field(..., description="分數趨勢資料點")
    accuracy_trend: List[Dict[str, Any]] = Field(..., description="準確率趨勢資料點")
    concept_mastery_progress: Dict[str, Decimal] = Field(..., description="各概念掌握進度")
    improvement_areas: List[str] = Field(..., description="有改善的弱點領域")
    persistent_weaknesses: List[str] = Field(..., description="持續的弱點領域")
    learning_velocity_trend: Optional[Decimal] = Field(None, description="學習速度趨勢")
    weakness_analysis_history: Optional[List[Dict[str, Any]]] = None
```

#### 7.3.2 `LearningProgressSchema`
```python
class LearningProgressSchema(BaseModel):
    user_id: UUID
    subject: str
    total_sessions: int
    total_questions_answered: int
    total_time_spent: int  # minutes
    average_accuracy: Decimal
    current_level: int
    strength_areas: List[str]
    weakness_areas: List[str]
    last_practice_date: Optional[date] = None
    trend: str  # improving, stable, declining
    updated_at: datetime
```

### 7.4 通用 Schema

#### 7.4.1 `PaginationSchema`
```python
class PaginationMeta(BaseModel):
    total_items: int
    total_pages: int
    current_page: int
    page_size: int
    has_next: bool
    has_prev: bool
    next_url: Optional[str] = None
    prev_url: Optional[str] = None

class PaginatedResponse(BaseModel, Generic[T]):
    data: List[T]
    meta: ResponseMeta

class ResponseMeta(BaseModel):
    timestamp: datetime
    version: str = "v1"
    pagination: Optional[PaginationMeta] = None
```

#### 7.4.2 `FileSchema`
```python
class FileSchema(BaseModel):
    file_id: UUID
    file_name: str
    file_url: str  # MinIO 檔案訪問 URL
    file_size: int  # bytes
    file_type: str  # question_image, option_image, explanation_image, question_audio
    content_type: str  # MIME type
    question_id: Optional[str] = None  # 關聯的題目ID
    uploaded_by: UUID  # 上傳者ID
    uploaded_at: datetime
    created_at: datetime
    updated_at: datetime

class FileUploadSchema(BaseModel):
    file_type: str = Field(..., regex="^(question_image|option_image|explanation_image|question_audio)$")
    question_id: Optional[str] = None
    description: Optional[str] = None
```

#### 7.4.3 `ErrorSchema`
```python
class ErrorDetail(BaseModel):
    code: str
    target: Optional[str] = None
    message: str

class ErrorResponse(BaseModel):
    error: ErrorInfo

class ErrorInfo(BaseModel):
    code: str
    message: str
    developer_message: Optional[str] = None
    target: Optional[str] = None
    details: Optional[List[ErrorDetail]] = None
    help_url: Optional[str] = None
    request_id: Optional[str] = None
```

### 7.5 枚舉定義 (Enums)

```python
class UserRole(str, Enum):
    STUDENT = "student"
    PARENT = "parent"
    TEACHER = "teacher"
    ADMIN = "admin"

class GradeEnum(str, Enum):
    GRADE_7A = "7A"
    GRADE_7B = "7B"
    GRADE_8A = "8A"
    GRADE_8B = "8B"
    GRADE_9A = "9A"
    GRADE_9B = "9B"

class SubjectEnum(str, Enum):
    CHINESE = "國文"
    ENGLISH = "英文"
    MATH = "數學"
    SCIENCE = "自然"
    GEOGRAPHY = "地理"
    HISTORY = "歷史"
    CIVICS = "公民"

class PublisherEnum(str, Enum):
    NANI = "南一"
    HANLIN = "翰林"
    KANGXUAN = "康軒"

class DifficultyEnum(str, Enum):
    EASY = "easy"
    NORMAL = "normal"
    HARD = "hard"

class SessionStatus(str, Enum):
    ACTIVE = "active"
    COMPLETED = "completed"
    ABANDONED = "abandoned"
```

---

## 8. 安全性考量 (Security Considerations)

### 8.1 輸入驗證 (Input Validation)
- **嚴格參數驗證:** 所有輸入參數使用 Pydantic 模型進行類型和範圍驗證
- **SQL 注入防護:** 使用 SQLAlchemy ORM，避免原始 SQL 拼接
- **XSS 防護:** API 回應均為 JSON 格式，前端負責適當的 HTML 編碼
- **檔案上傳安全:** 限制檔案類型、大小，使用病毒掃描

### 8.2 認證與授權安全
- **JWT Token 安全:**
  - 使用 RS256 非對稱加密演算法
  - Token 包含過期時間和發行者信息
  - 實施 Token 黑名單機制處理登出
- **密碼安全:**
  - 使用 bcrypt 進行密碼雜湊
  - 實施密碼複雜度要求
  - 防暴力破解機制（登入嘗試次數限制）

### 8.3 資料保護
- **敏感資料處理:**
  - 學生個人資料加密存儲
  - API 回應中不包含敏感資料（如密碼雜湊）
  - 實施資料訪問審計日誌
- **HTTPS 強制:** 生產環境強制使用 HTTPS，實施 HSTS
- **CORS 政策:** 配置適當的跨域資源共享政策

### 8.4 API 安全
- **請求驗證:**
  - 實施請求簽名驗證（針對高敏感操作）
  - 請求 ID 追蹤，防重複提交
  - 適當的 HTTP Headers 安全配置
- **業務邏輯安全:**
  - 學生只能存取自己的學習資料
  - 家長只能存取已關聯學生的資料
  - 教師只能存取管理班級的資料

### 8.5 合規性
- **個資保護:** 符合個人資料保護法規要求
- **教育資料保護:** 遵循教育相關資料處理規範
- **審計日誌:** 記錄所有敏感操作和資料存取

---

## 9. 向後兼容性與棄用策略 (Backward Compatibility and Deprecation Policy)

### 9.1 向後兼容性承諾
- **相容變更 (允許):**
  - 新增 API 端點
  - 新增可選的請求參數
  - 新增回應欄位
  - 放寬驗證限制
- **非相容變更 (需新版本):**
  - 刪除或重新命名端點
  - 刪除或重新命名欄位
  - 修改欄位資料型別
  - 增加必要參數
  - 收緊驗證規則

### 9.2 API 版本管理
- **版本生命週期:** 每個主版本維護期至少 12 個月
- **棄用通知期:** 提前 6 個月發布棄用通知
- **遷移支持:** 提供詳細的遷移指南和工具
- **並行支持:** 新舊版本並行運行 6 個月過渡期

### 9.3 棄用流程
1. **棄用公告:** 在 API 文檔、開發者門戶發布公告
2. **Response Header 標示:** `X-API-Deprecation-Warning` header
3. **監控使用量:** 追蹤舊版本 API 使用情況
4. **遷移協助:** 提供技術支援協助用戶遷移
5. **正式下線:** 過渡期結束後正式停止服務

---

## 10. 附錄 (Appendices)

### 10.1 請求/回應範例 (Request/Response Examples)

#### 10.1.1 創建練習會話範例
**請求:**
```bash
curl -X POST "https://api.inulearning.com/v1/learning/exercises" \
  -H "Authorization: Bearer eyJhbGciOiJSUzI1NiIs..." \
  -H "Content-Type: application/json" \
  -d '{
    "grade": "8A",
    "subject": "數學",
    "publisher": "南一",
    "chapter": "1-1 一元一次方程式",
    "question_count": 5,
    "difficulty": "normal"
  }'
```

**成功回應 (201 Created):**
```json
{
  "data": {
    "session_id": "550e8400-e29b-41d4-a716-446655440000",
    "questions": [
      {
        "question_id": "q_math_8a_001",
        "grade": "8A",
        "subject": "數學",
        "publisher": "南一",
        "chapter": "1-1 一元一次方程式",
        "topic": "一元一次方程式",
        "knowledge_point": ["方程式求解"],
        "difficulty": "normal",
        "question": "解下列方程式：2x + 5 = 13",
        "options": {
          "A": "x = 4",
          "B": "x = 6",
          "C": "x = 8",
          "D": "x = 10"
        }
      }
    ],
    "estimated_time": 15,
    "created_at": "2024-12-19T10:30:00Z"
  },
  "meta": {
    "timestamp": "2024-12-19T10:30:00Z",
    "version": "v1"
  }
}
```

#### 10.1.2 提交答案範例
**請求:**
```bash
curl -X POST "https://api.inulearning.com/v1/learning/sessions/550e8400-e29b-41d4-a716-446655440000/submit" \
  -H "Authorization: Bearer eyJhbGciOiJSUzI1NiIs..." \
  -H "Content-Type: application/json" \
  -d '{
    "answers": [
      {
        "question_id": "q_math_8a_001",
        "user_answer": "A",
        "time_spent": 120
      },
      {
        "question_id": "q_math_8a_002",
        "user_answer": "B",
        "time_spent": 150
      }
    ]
  }'
```

**成功回應 (200 OK):**
```json
{
  "data": {
    "session_id": "550e8400-e29b-41d4-a716-446655440000",
    "overall_score": 75.0,
    "results": [
      {
        "question_id": "q_math_8a_001",
        "correct": true,
        "score": 10.0,
        "feedback": "答案正確！解題步驟清楚。",
        "explanation": "解一元一次方程式 2x + 5 = 13，首先將 5 移到等式右邊得到 2x = 13 - 5 = 8，再將兩邊同除以 2 得到 x = 4，因此正確答案是選項 A。"
      },
      {
        "question_id": "q_math_8a_002",
        "correct": false,
        "score": 0.0,
        "feedback": "答案錯誤，請重新檢視解題步驟。",
        "explanation": "解方程式 3x - 7 = 8，正確做法是先將 -7 移到等式右邊得到 3x = 8 + 7 = 15，再將兩邊同除以 3 得到 x = 5，正確答案應該是選項 C，而不是選項 B。常見錯誤是在移項時符號處理不當。"
      }
    ],
    "weakness_analysis": {
      "weak_concepts": ["移項運算", "符號處理"],
      "knowledge_points_to_strengthen": ["一元一次方程式", "代數運算", "移項法則"],
      "recommendations": [
        {
          "type": "similar_question",
          "question_ids": ["q_math_8a_101", "q_math_8a_102"],
          "difficulty": "easy",
          "reason": "建議從基礎移項運算加強練習"
        },
        {
          "type": "concept_review",
          "topics": ["移項法則", "符號變換"],
          "difficulty": "normal",
          "reason": "需要加強移項時的符號處理"
        }
      ]
    }
  },
  "meta": {
    "timestamp": "2024-12-19T10:32:00Z",
    "version": "v1"
  }
}
```

#### 10.1.3 學習趨勢分析範例
**請求:**
```bash
curl -X GET "https://api.inulearning.com/v1/learning/users/user_123/trends?subject=數學&period_days=30" \
  -H "Authorization: Bearer eyJhbGciOiJSUzI1NiIs..."
```

**成功回應 (200 OK):**
```json
{
  "data": {
    "user_id": "user_123",
    "subject": "數學",
    "period_start": "2024-11-19T00:00:00Z",
    "period_end": "2024-12-19T23:59:59Z",
    "score_trend": [
      {"date": "2024-12-01", "score": 65.5, "session_count": 3},
      {"date": "2024-12-08", "score": 72.3, "session_count": 4},
      {"date": "2024-12-15", "score": 78.9, "session_count": 2}
    ],
    "accuracy_trend": [
      {"date": "2024-12-01", "accuracy": 0.68, "total_questions": 30},
      {"date": "2024-12-08", "accuracy": 0.74, "total_questions": 40},
      {"date": "2024-12-15", "accuracy": 0.81, "total_questions": 20}
    ],
    "concept_mastery_progress": {
      "一元一次方程式": 0.85,
      "移項運算": 0.62,
      "分數方程式": 0.71,
      "應用問題": 0.58
    },
    "improvement_areas": ["移項運算", "基礎運算"],
    "persistent_weaknesses": ["應用問題", "文字題理解"],
    "learning_velocity_trend": 1.23,
    "weakness_analysis_history": [
      {
        "date": "2024-12-15T14:30:00Z",
        "weak_concepts": ["應用問題", "文字題理解"],
        "knowledge_points_to_strengthen": ["一元一次方程式", "代數運算"],
        "overall_score": 78.9,
        "accuracy_rate": 81.0
      }
    ]
  },
  "meta": {
    "timestamp": "2024-12-19T10:35:00Z",
    "version": "v1"
  }
}
```

#### 10.1.4 錯誤回應範例
**請求:** (無效的年級參數)
```bash
curl -X POST "https://api.inulearning.com/v1/learning/exercises" \
  -H "Authorization: Bearer eyJhbGciOiJSUzI1NiIs..." \
  -H "Content-Type: application/json" \
  -d '{
    "grade": "10A",
    "subject": "數學",
    "publisher": "南一"
  }'
```

**錯誤回應 (400 Bad Request):**
```json
{
  "error": {
    "code": "LEARNING_001",
    "message": "請求的參數無效",
    "developer_message": "grade 參數必須是 7A, 7B, 8A, 8B, 9A, 9B 之一",
    "target": "grade",
    "details": [
      {
        "code": "INVALID_ENUM_VALUE",
        "target": "grade",
        "message": "grade 必須是支援的年級值：7A, 7B, 8A, 8B, 9A, 9B"
      }
    ],
    "help_url": "https://docs.inulearning.com/api/errors#LEARNING_001",
    "request_id": "req_20241219_103000_001"
  }
}
```

### 10.2 開發工具與資源

#### 10.2.1 SDK 與客戶端庫
- **JavaScript/TypeScript SDK:** `@inulearning/api-client`
- **Python SDK:** `inulearning-api-python`
- **Postman Collection:** 提供完整的 API 測試集合

#### 10.2.2 開發者門戶
- **API 文檔:** https://docs.inulearning.com/api
- **互動式 API 探索:** https://api.inulearning.com/docs (Swagger UI)
- **開發者社群:** https://community.inulearning.com

#### 10.2.3 測試環境
- **Sandbox API:** https://sandbox-api.inulearning.com/v1
- **測試數據:** 提供標準化的測試用戶和題庫數據
- **Mock 服務:** 本地開發用的 Mock API 服務

---

**文件審核記錄 (Review History):**

| 日期 | 審核人 | 版本 | 變更摘要/主要反饋 |
| :--------- | :--------- | :--- | :---------------------------------------------- |
| 2024-12-19 | AIPE01_group2 | v1.0 | 初稿完成，基於系統設計和架構文檔整合建立 |
| 2024-12-19 | AIPE01_group2 | v1.1 | 同步系統設計文檔v0.3版本，新增詳解功能、學習趨勢分析API、強化前後端分離設計理念 |
| 2024-07-26 | AIPE01_group2 | v1.2.0 | 將文件狀態更新為「已實現」，反映 v1.0 核心功能，更新 API 文件連結、基礎 URL 並標示規劃中功能。 |