# 使用官方 Python 映像檔
FROM python:3.9-slim

# 設定工作目錄
WORKDIR /app

# 複製 requirements.txt 並安裝相依套件
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 複製應用程式碼
COPY . .

# 開放 8007 連接埠（避免與教師管理服務 8006 衝突）
EXPOSE 8007

# 執行應用程式（使用 8007）
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8007"]
