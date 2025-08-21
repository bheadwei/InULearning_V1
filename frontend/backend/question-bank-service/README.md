# InULearning Question Bank Service

InULearning 個人化學習平台的題庫管理服務，負責管理題目、章節和知識點資料。

## 功能特色

- **題目管理**: 支援多種題型（選擇題、填空題、簡答題、申論題）
- **章節管理**: 管理各版本各科目各章節的結構
- **知識點管理**: 管理學習知識點和概念
- **搜尋功能**: 支援多條件搜尋和隨機出題
- **批量匯入**: 支援大量題目資料的批量匯入
- **媒體支援**: 支援題目相關的圖片、音訊等媒體檔案

## 技術架構

- **框架**: FastAPI
- **資料庫**: MongoDB (主要資料庫)
- **快取**: Redis
- **檔案儲存**: MinIO
- **容器化**: Docker

## 快速開始

### 環境需求

- Python 3.11+
- MongoDB 4.4+
- Redis 6.0+
- MinIO (可選)

### 安裝依賴

```bash
pip install -r requirements.txt
```

### 環境變數設定

複製 `env.example` 為 `.env` 並設定相關環境變數：

```bash
cp env.example .env
```

### 啟動服務

```bash
# 開發模式
uvicorn app.main:app --reload --host 0.0.0.0 --port 8002

# 生產模式
uvicorn app.main:app --host 0.0.0.0 --port 8002
```

### Docker 啟動

```bash
# 建構映像檔
docker build -t inulearning-question-bank .

# 執行容器
docker run -p 8002:8000 inulearning-question-bank
```

## API 文檔

啟動服務後，可透過以下端點查看 API 文檔：

- Swagger UI: http://localhost:8002/docs
- ReDoc: http://localhost:8002/redoc

## 主要 API 端點

### 題目管理

- `POST /api/v1/questions/` - 創建題目
- `GET /api/v1/questions/{question_id}` - 獲取題目
- `PUT /api/v1/questions/{question_id}` - 更新題目
- `DELETE /api/v1/questions/{question_id}` - 刪除題目
- `GET /api/v1/questions/` - 搜尋題目
- `GET /api/v1/questions/random/` - 隨機獲取題目
- `GET /api/v1/questions/criteria/` - 根據條件獲取題目
- `POST /api/v1/questions/bulk-import/` - 批量匯入題目

### 章節管理

- `POST /api/v1/chapters/` - 創建章節
- `GET /api/v1/chapters/` - 獲取章節列表

### 知識點管理

- `POST /api/v1/knowledge-points/` - 創建知識點
- `GET /api/v1/knowledge-points/` - 獲取知識點列表

## 資料模型

### 題目模型

```python
{
    "grade": "7A",                    # 年級
    "subject": "數學",                # 科目
    "publisher": "南一",              # 出版社
    "chapter": "1-1 一元一次方程式",   # 章節
    "topic": "一元一次方程式",         # 主題
    "knowledge_point": ["方程式求解"], # 知識點
    "difficulty": "normal",           # 難度
    "question": "解下列方程式：2x + 5 = 13", # 題目內容
    "question_type": "multiple_choice", # 題型
    "options": {                      # 選項
        "A": "x = 4",
        "B": "x = 6",
        "C": "x = 8",
        "D": "x = 10"
    },
    "answer": "A",                    # 正確答案
    "explanation": "解題說明...",     # 解析
    "media_urls": [],                 # 媒體檔案URL
    "tags": [],                       # 標籤
    "estimated_time": 120,            # 預估作答時間(秒)
    "points": 10                      # 題目分數
}
```

### 章節模型

```python
{
    "publisher": "南一",              # 出版社
    "subject": "數學",                # 科目
    "grade": "7A",                    # 年級
    "chapter_name": "一元一次方程式",  # 章節名稱
    "chapter_number": "1-1",          # 章節編號
    "topics": ["方程式求解", "應用問題"], # 主題列表
    "knowledge_points": ["方程式求解"]  # 知識點列表
}
```

### 知識點模型

```python
{
    "subject": "數學",                # 科目
    "grade": "7A",                    # 年級
    "name": "方程式求解",             # 知識點名稱
    "description": "解一元一次方程式的方法", # 描述
    "parent_knowledge_point": None,   # 父知識點
    "difficulty_level": "normal",     # 難度等級
    "tags": ["代數", "方程式"]        # 標籤
}
```

## 測試

### 基本測試

```bash
python test_basic.py
```

### 單元測試

```bash
pytest tests/
```

### 整合測試

```bash
pytest tests/ -v
```

## 開發指南

### 專案結構

```
question-bank-service/
├── app/
│   ├── __init__.py
│   ├── main.py              # FastAPI 應用程式入口
│   ├── config.py            # 配置管理
│   ├── database.py          # 資料庫連接
│   ├── schemas.py           # Pydantic 模型
│   ├── crud.py              # CRUD 操作
│   └── api/
│       ├── __init__.py
│       ├── questions.py     # 題目 API
│       ├── chapters.py      # 章節 API
│       └── knowledge_points.py # 知識點 API
├── tests/
│   ├── __init__.py
│   └── test_question_bank.py
├── requirements.txt
├── Dockerfile
├── test_basic.py
└── README.md
```

### 新增功能

1. 在 `app/schemas.py` 中定義資料模型
2. 在 `app/crud.py` 中實作 CRUD 操作
3. 在 `app/api/` 中新增 API 路由
4. 在 `tests/` 中新增測試案例

### 程式碼風格

- 使用 Black 進行程式碼格式化
- 使用 isort 進行 import 排序
- 遵循 PEP 8 程式碼風格指南

## 部署

### Docker Compose

```yaml
version: '3.8'
services:
  question-bank-service:
    build: .
    ports:
      - "8002:8000"
    environment:
      - MONGODB_URL=mongodb://mongodb:27017
      - REDIS_URL=redis://redis:6379
    depends_on:
      - mongodb
      - redis
```

### Kubernetes

參考 `k8s/` 目錄下的 Kubernetes 部署檔案。

## 監控與日誌

- 健康檢查端點: `GET /health`
- 應用程式日誌: 使用 Python logging 模組
- 效能監控: 整合 Prometheus 和 Grafana

## 貢獻指南

1. Fork 專案
2. 建立功能分支
3. 提交變更
4. 發起 Pull Request

## 授權

本專案採用 MIT 授權條款。 