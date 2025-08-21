#!/usr/bin/env python3
"""
快速驗證資料載入結果
"""

import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from minio import Minio

async def quick_check():
    # MongoDB連接
    client = AsyncIOMotorClient('mongodb://aipe-tester:aipe-tester@localhost:27017/inulearning?authSource=admin')
    db = client.inulearning
    
    try:
        # 檢查題目數量
        count = await db.questions.count_documents({})
        print(f"📊 MongoDB中的題目數量: {count}")
        
        if count > 0:
            # 隨機取一個題目看看
            sample = await db.questions.find_one()
            print(f"📝 範例題目: {sample['question'][:100]}...")
            if sample.get('image_filename'):
                print(f"🖼️  有圖片: {sample['image_filename']}")
    except Exception as e:
        print(f"❌ MongoDB錯誤: {e}")
    finally:
        client.close()
    
    # MinIO連接
    try:
        minio_client = Minio(
            'localhost:9000',
            access_key='inulearning_admin',
            secret_key='inulearning_password',
            secure=False
        )
        
        # 檢查圖片數量
        objects = list(minio_client.list_objects('question-bank'))
        image_count = len([obj for obj in objects if obj.object_name.endswith('.jpg')])
        print(f"🖼️  MinIO中的圖片數量: {image_count}")
        
    except Exception as e:
        print(f"❌ MinIO錯誤: {e}")

if __name__ == "__main__":
    asyncio.run(quick_check())