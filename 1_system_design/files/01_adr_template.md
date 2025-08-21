# ADR-001: 採用 Redis + RQ 作為 AI 分析任務佇列（取代短期內導入 RabbitMQ + Celery）

---

**狀態 (Status):** `已接受 (Accepted)`

**決策者 (Deciders):** `AIPE01_group2`

**日期 (Date):** `2025-08-21`

**技術顧問 (Consulted - 選填):** `後端團隊、AI 團隊`

**受影響團隊 (Informed - 選填):** `前端團隊、DevOps/維運、QA`

---

## 1. 背景與問題陳述 (Context and Problem Statement)

*   **上下文 (Context):** 專案採用微服務 + Nginx API Gateway 架構，核心服務包含認證、題庫、學習、AI 分析與家長儀表板。`docker-compose.yml` 已提供 `Redis`、`PostgreSQL`、`MongoDB`、`MinIO` 等服務。AI 分析服務需支援非同步任務（弱點分析、詳解建議）與批量處理/佇列化。
*   **問題陳述 (Problem Statement):** 需要在 MVP 時程內，提供穩定的 AI 任務排程與查詢機制，使學習服務與前端呼叫 AI 功能時不被長任務阻塞，並可查詢任務狀態/結果，同時盡量降低基礎設施與維運複雜度。
*   **驅動因素/約束條件 (Drivers / Constraints):**
    *   MVP 時程緊（優先交付可用功能）
    *   既有架構已導入 `Redis`，可重用現有組件
    *   環境以 Docker Compose 為主，期望最少化新元件（降低學習成本與運維負擔）
    *   後續仍規劃導入 `RabbitMQ`/`Celery`（中長期事件流與任務編排）

## 2. 考量的選項 (Considered Options)

### 選項一：Redis + RQ（採用）
*   **描述：** 使用 `Redis` 作為任務佇列與快取，`RQ` 作為工作序列化與處理框架；AI 分析服務提供觸發/狀態查詢/批量端點，並以 Redis 快取任務結果以便快速查詢。
*   **優點 (Pros)：**
    *   與現有 `Redis` 無縫整合，部署維運簡單
    *   開發成本低、上手快，能快速支援 MVP
    *   以快取加速任務狀態/結果查詢，降低 DB 壓力
*   **缺點 (Cons)：**
    *   與 `Celery` 相比，生態/功能較輕量
    *   任務路由/重試/可觀測能力需額外補強
*   **成本/複雜度評估:** 低

### 選項二：RabbitMQ + Celery（規劃中）
*   **描述：** 導入 `RabbitMQ` 為訊息佇列、`Celery` 作為任務框架，提供更成熟的分散式任務處理能力。
*   **優點 (Pros)：**
    *   成熟的生態，豐富的任務路由/重試/結果後端支持
    *   更適合大規模、多類型任務的調度
*   **缺點 (Cons)：**
    *   引入新基礎設施（RabbitMQ），運維成本上升
    *   學習與整合成本較高，不利於 MVP 交付時程
*   **成本/複雜度評估:** 中-高

### 選項三：無佇列，純同步/輪詢（不採用）
*   **描述：** 不引入任務佇列，學習服務直接同步呼叫 AI 分析，或以輪詢 DB/快取的方式查詢長任務進度。
*   **優點 (Pros)：**
    *   架構最簡單、零額外運維
*   **缺點 (Cons)：**
    *   長任務阻塞請求，影響使用者體驗
    *   難以做彈性伸縮與批量處理
*   **成本/複雜度評估:** 低（但風險高）

---

## 3. 決策 (Decision Outcome)

**最終選擇的方案：** 選項一：採用 Redis + RQ 作為 AI 分析任務佇列與快取。

**選擇理由 (Rationale):**
*   可重用現有 `Redis`，以最小變更實現非同步化與任務查詢
*   能在 MVP 期間快速落地，降低開發與維運風險
*   與專案現況一致（`docker-compose.yml` 已包含 AI worker、Redis 環境變數）
*   後續若規模與需求提升，可逐步演進至 `RabbitMQ + Celery`

---

## 4. 決策的後果與影響 (Consequences)

*   **正面影響 / 預期收益：**
    *   學習服務/前端呼叫 AI 端點不被長任務阻塞，提升體感
    *   透過 Redis 快取任務狀態與結果，顯著降低查詢延遲
    *   降低基礎設施複雜度與學習成本，縮短交付周期
*   **負面影響 / 引入的風險：**
    *   RQ 功能相對輕量，進階任務路由/監控需自行補強
    *   可靠性（例如任務持久性、重試策略）需要以程式碼補齊
*   **對其他組件/團隊的影響：**
    *   前端與學習服務需改用「觸發 + 查詢狀態」的交互模式
    *   DevOps 需監控 Redis、AI worker 進程與健康度
*   **未來可能需要重新評估的觸發條件：**
    *   AI 任務量級顯著成長、需要更複雜的路由與優先級策略
    *   多隊列、多租戶隔離、跨區域容災等需求提升

## 5. (選填) 執行計畫概要 (Implementation Plan Outline)

1. 環境變數與 Compose：確認 `REDIS_URL`、AI 服務內 `AI_USE_RQ=1`、佇列名稱與超時設定
2. 啟動 AI Worker：以 `ai-analysis-worker` 容器常駐執行 RQ worker
3. API 端點：維護 `/api/v1/ai/analysis` 觸發、`/api/v1/ai/analysis/{task_id}` 查詢、批量查詢端點
4. 快取策略：任務最新 ID 與任務結果寫入 Redis，設置合理 TTL；回填 DB 與快取一致性策略
5. 監控：新增 worker 心跳/佇列健康檢查端點（已提供 `/api/v1/ai/queue/health`）
6. 壓測與觀測：驗證佇列等待、吞吐與錯誤重試表現，調整 `AI_RATE_LIMIT_RPS`、重試退避

## 6. (選填) 相關參考 (References)

*   `1_system_design/files/00_project_summary.md`
*   `1_system_design/files/02_system_architecture_document.md`
*   `1_system_design/files/03_system_design_document.md`
*   `docker-compose.yml`
*   `2_implementation/backend/ai-analysis-service/src/services/start_ai_service.py`

---
**ADR 審核記錄 (Review History):**

| 日期       | 審核人       | 角色         | 備註/主要問題 |
| :--------- | :----------- | :----------- | :------------ |
| 2025-08-21 | AIPE01_group2 | 架構/技術負責 | 同意採用 Redis+RQ；後續視規模擴張再評估 RabbitMQ+Celery |