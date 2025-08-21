#!/bin/bash

# 題庫資料載入執行腳本
# 此腳本會在Docker環境中執行資料載入

set -e  # 遇到錯誤立即退出

echo "🚀 開始執行題庫資料載入..."

# 檢查必要的環境變數
if [ -z "$MONGODB_URL" ]; then
    echo "⚠️ 使用預設 MongoDB 連接設定"
    export MONGODB_URL="mongodb://aipe-tester:aipe-tester@mongodb:27017/inulearning?authSource=admin"
fi

if [ -z "$MINIO_ENDPOINT" ]; then
    echo "⚠️ 使用預設 MinIO 連接設定"
    export MINIO_ENDPOINT="minio:9000"
    export MINIO_ACCESS_KEY="inulearning_admin"
    export MINIO_SECRET_KEY="inulearning_password"
fi

# 等待服務啟動
echo "⏳ 等待 MongoDB 和 MinIO 服務啟動..."
sleep 10

# 檢查 Python 環境
echo "🐍 檢查 Python 環境..."
python --version
pip list | grep -E "(pymongo|motor|minio|aiofiles)"

# 執行測試
echo "🧪 執行連接測試..."
python test_data_loading.py

if [ $? -eq 0 ]; then
    echo "✅ 連接測試成功，開始載入完整資料..."
    
    # 執行完整資料載入
    python load_rawdata.py
    
    if [ $? -eq 0 ]; then
        echo "🎉 資料載入完成！"
        
        # 顯示統計資訊
        echo "📊 資料統計："
        python -c "
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from app.config import settings

async def show_stats():
    client = AsyncIOMotorClient(settings.mongodb_url)
    db = client[settings.mongodb_database]
    
    total = await db.questions.count_documents({})
    print(f'  總題目數量: {total}')
    
    # 按科目統計
    pipeline = [
        {'$group': {'_id': '$subject', 'count': {'$sum': 1}}},
        {'$sort': {'count': -1}}
    ]
    subjects = await db.questions.aggregate(pipeline).to_list(None)
    
    print('  各科目題目數量:')
    for subject in subjects:
        print(f'    {subject[\"_id\"]}: {subject[\"count\"]} 題')
    
    client.close()

asyncio.run(show_stats())
"
    else
        echo "❌ 資料載入失敗"
        exit 1
    fi
else
    echo "❌ 連接測試失敗，請檢查服務狀態"
    exit 1
fi

echo "✅ 所有操作完成！"