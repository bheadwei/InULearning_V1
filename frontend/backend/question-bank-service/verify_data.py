#!/usr/bin/env python3
"""
資料驗證腳本
檢查載入的資料是否正確
"""

import asyncio
import sys
from pathlib import Path
from motor.motor_asyncio import AsyncIOMotorClient
from minio import Minio
import logging

# 添加專案根目錄到 Python 路徑
project_root = Path(__file__).parent.parent.parent.parent
sys.path.insert(0, str(project_root))

from app.config import settings

# 設定日誌
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


async def verify_mongodb_data():
    """驗證 MongoDB 資料"""
    logger.info("🔍 檢查 MongoDB 資料...")
    
    client = AsyncIOMotorClient(settings.mongodb_url)
    db = client[settings.mongodb_database]
    
    try:
        # 總題目數量
        total_questions = await db.questions.count_documents({})
        logger.info(f"📊 總題目數量: {total_questions}")
        
        if total_questions == 0:
            logger.warning("⚠️ 沒有找到任何題目資料")
            return False
        
        # 按科目統計
        pipeline = [
            {'$group': {'_id': '$subject', 'count': {'$sum': 1}}},
            {'$sort': {'count': -1}}
        ]
        subjects = await db.questions.aggregate(pipeline).to_list(None)
        
        logger.info("📚 各科目題目數量:")
        for subject in subjects:
            logger.info(f"  {subject['_id']}: {subject['count']} 題")
        
        # 按年級統計
        pipeline = [
            {'$group': {'_id': '$grade', 'count': {'$sum': 1}}},
            {'$sort': {'_id': 1}}
        ]
        grades = await db.questions.aggregate(pipeline).to_list(None)
        
        logger.info("🎓 各年級題目數量:")
        for grade in grades:
            logger.info(f"  {grade['_id']}: {grade['count']} 題")
        
        # 按出版社統計
        pipeline = [
            {'$group': {'_id': '$publisher', 'count': {'$sum': 1}}},
            {'$sort': {'count': -1}}
        ]
        publishers = await db.questions.aggregate(pipeline).to_list(None)
        
        logger.info("📖 各出版社題目數量:")
        for publisher in publishers:
            logger.info(f"  {publisher['_id']}: {publisher['count']} 題")
        
        # 檢查資料完整性
        logger.info("🔍 檢查資料完整性...")
        
        # 檢查必要欄位
        missing_content = await db.questions.count_documents({'content': {'$in': ['', None]}})
        missing_options = await db.questions.count_documents({'options': {'$size': 0}})
        missing_answer = await db.questions.count_documents({'correct_answer': {'$in': ['', None]}})
        
        if missing_content > 0:
            logger.warning(f"⚠️ {missing_content} 題缺少題目內容")
        if missing_options > 0:
            logger.warning(f"⚠️ {missing_options} 題缺少選項")
        if missing_answer > 0:
            logger.warning(f"⚠️ {missing_answer} 題缺少正確答案")
        
        # 檢查圖片題目
        image_questions = await db.questions.count_documents({'image_filename': {'$ne': None}})
        logger.info(f"🖼️ 包含圖片的題目: {image_questions} 題")
        
        # 範例題目
        sample_question = await db.questions.find_one({'subject': '數學'})
        if sample_question:
            logger.info("📝 數學範例題目:")
            logger.info(f"  內容: {sample_question['content'][:100]}...")
            logger.info(f"  選項數量: {len(sample_question['options'])}")
            logger.info(f"  正確答案: {sample_question['correct_answer']}")
        
        return True
        
    except Exception as e:
        logger.error(f"❌ MongoDB 資料檢查失敗: {e}")
        return False
    finally:
        client.close()


def verify_minio_data():
    """驗證 MinIO 資料"""
    logger.info("🔍 檢查 MinIO 資料...")
    
    try:
        client = Minio(
            settings.minio_endpoint,
            access_key=settings.minio_access_key,
            secret_key=settings.minio_secret_key,
            secure=settings.minio_secure
        )
        
        # 檢查 bucket 是否存在
        if not client.bucket_exists(settings.minio_bucket_name):
            logger.warning(f"⚠️ MinIO bucket '{settings.minio_bucket_name}' 不存在")
            return False
        
        # 統計圖片數量
        objects = list(client.list_objects(settings.minio_bucket_name, prefix="images/", recursive=True))
        image_count = len(objects)
        
        logger.info(f"🖼️ MinIO 中的圖片數量: {image_count}")
        
        if image_count > 0:
            # 顯示前幾個圖片檔名
            logger.info("📁 範例圖片檔案:")
            for i, obj in enumerate(objects[:5]):
                logger.info(f"  {obj.object_name}")
            
            if image_count > 5:
                logger.info(f"  ... 還有 {image_count - 5} 個檔案")
        
        return True
        
    except Exception as e:
        logger.error(f"❌ MinIO 資料檢查失敗: {e}")
        return False


async def main():
    """主要驗證函數"""
    logger.info("🚀 開始驗證載入的資料...")
    
    # 驗證 MongoDB
    mongodb_ok = await verify_mongodb_data()
    
    # 驗證 MinIO
    minio_ok = verify_minio_data()
    
    if mongodb_ok and minio_ok:
        logger.info("✅ 所有資料驗證通過！")
        return True
    else:
        logger.error("❌ 資料驗證失敗")
        return False


if __name__ == "__main__":
    success = asyncio.run(main())
    sys.exit(0 if success else 1)