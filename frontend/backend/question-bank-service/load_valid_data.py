#!/usr/bin/env python3
"""
載入有效JSON檔案到MongoDB和MinIO
只載入已確認格式正確的39個檔案
"""

import os
import json
import sys
import hashlib
import uuid
from pathlib import Path
from typing import Dict, List, Any, Optional
from motor.motor_asyncio import AsyncIOMotorClient
from pymongo import MongoClient
import asyncio
import aiofiles
from minio import Minio
from minio.error import S3Error
import logging
from datetime import datetime

# 設定日誌
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# 添加專案根目錄到 Python 路徑
project_root = Path(__file__).parent.parent.parent.parent
sys.path.insert(0, str(project_root))

from app.config import settings

# 有效的JSON檔案清單（39個檔案）
VALID_FILES = [
    "全題庫/國文/康軒_國文.json",
    "全題庫/國文/翰林_國文.json",
    "全題庫/英文/南一_英文.json",
    "全題庫/英文/翰林_英文.json",
    "全題庫/數學/康軒_數學.json",
    "全題庫/數學/翰林_數學.json",
    "全題庫/自然/康軒_自然.json",
    "全題庫/自然/翰林_自然.json",
    "全題庫/地理/康軒_地理.json",
    "全題庫/地理/翰林_地理.json",
    "全題庫/歷史/南一_歷史.json",
    "全題庫/歷史/康軒_歷史.json",
    "全題庫/歷史/翰林_歷史.json",
    "全題庫/公民/南一_公民.json",
    "全題庫/公民/康軒_公民.json",
    "全題庫/公民/翰林_公民.json",
    "全題庫/生成題目/公民/南一_公民.json",
    "全題庫/生成題目/歷史/南一_歷史.json",
    "全題庫/生成題目/地理/南一_地理.json",
    "全題庫/生成題目/自然/南一_自然.json",
    "全題庫/生成題目/數學/南一_數學.json",
    "全題庫/生成題目/數學/康軒_數學.json",
    "全題庫/生成題目/數學/翰林_數學.json",
    "全題庫/生成題目/自然/南一_自然.json",
    "全題庫/生成題目/自然/康軒_自然.json",
    "全題庫/生成題目/自然/翰林_自然.json",
    "全題庫/生成題目/地理/南一_地理.json",
    "全題庫/生成題目/地理/康軒_地理.json",
    
]


class ValidDataLoader:
    """有效資料載入器"""
    
    def __init__(self):
        self.mongodb_client = None
        self.db = None
        self.minio_client = None
        self.question_count = 0
        self.image_count = 0
        self.seeds_path = Path(__file__).parent.parent.parent / "database" / "seeds"
        
    async def initialize(self):
        """初始化連接"""
        # 連接 MongoDB
        self.mongodb_client = AsyncIOMotorClient(settings.mongodb_url)
        self.db = self.mongodb_client[settings.mongodb_database]
        
        # 測試 MongoDB 連接
        try:
            await self.mongodb_client.admin.command('ping')
            logger.info("✅ MongoDB 連接成功")
        except Exception as e:
            logger.error(f"❌ MongoDB 連接失敗: {e}")
            raise
        
        # 連接 MinIO
        self.minio_client = Minio(
            settings.minio_endpoint,
            access_key=settings.minio_access_key,
            secret_key=settings.minio_secret_key,
            secure=False
        )
        
        # 測試 MinIO 連接並創建 bucket
        try:
            if not self.minio_client.bucket_exists(settings.minio_bucket_name):
                self.minio_client.make_bucket(settings.minio_bucket_name)
                logger.info(f"✅ 創建 MinIO bucket: {settings.minio_bucket_name}")
            else:
                logger.info(f"✅ MinIO bucket 已存在: {settings.minio_bucket_name}")
        except Exception as e:
            logger.error(f"❌ MinIO 連接失敗: {e}")
            raise

    async def upload_all_images(self):
        """上傳所有圖片到 MinIO"""
        images_dir = self.seeds_path / "images"
        if not images_dir.exists():
            logger.warning(f"圖片目錄不存在: {images_dir}")
            return

        logger.info(f"開始上傳圖片從: {images_dir}")
        
        for image_file in images_dir.glob("*.jpg"):
            try:
                await self.upload_image(image_file)
                self.image_count += 1
                if self.image_count % 100 == 0:
                    logger.info(f"已上傳 {self.image_count} 張圖片...")
            except Exception as e:
                logger.error(f"上傳圖片失敗 {image_file.name}: {e}")

        logger.info(f"✅ 圖片上傳完成，共上傳 {self.image_count} 張圖片")

    async def upload_image(self, image_path: Path):
        """上傳單張圖片到 MinIO"""
        try:
            async with aiofiles.open(image_path, 'rb') as f:
                data = await f.read()
                
            self.minio_client.put_object(
                bucket_name=settings.minio_bucket_name,
                object_name=image_path.name,
                data=data,
                length=len(data),
                content_type='image/jpeg'
            )
        except Exception as e:
            logger.error(f"上傳圖片失敗 {image_path.name}: {e}")
            raise

    async def load_valid_files(self):
        """載入有效的JSON檔案"""
        logger.info(f"開始載入 {len(VALID_FILES)} 個有效檔案...")
        
        for file_path in VALID_FILES:
            full_path = self.seeds_path / file_path
            if full_path.exists():
                try:
                    await self.process_json_file(full_path)
                    logger.info(f"✅ 成功載入: {file_path}")
                except Exception as e:
                    logger.error(f"❌ 載入失敗 {file_path}: {e}")
            else:
                logger.warning(f"⚠️  檔案不存在: {full_path}")

        logger.info(f"✅ 資料載入完成，共載入 {self.question_count} 道題目")

    async def process_json_file(self, file_path: Path):
        """處理單個JSON檔案"""
        try:
            async with aiofiles.open(file_path, 'r', encoding='utf-8') as f:
                content = await f.read()
                data = json.loads(content)
                
            if not isinstance(data, list):
                logger.error(f"檔案格式錯誤，不是陣列格式: {file_path}")
                return
                
            batch_size = 100
            batch = []
            
            for item in data:
                try:
                    # 驗證題目
                    if not self.validate_question_item(item):
                        continue
                        
                    # 標準化格式
                    standardized_item = self.standardize_question_format(item)
                    batch.append(standardized_item)
                    
                    if len(batch) >= batch_size:
                        await self.insert_batch(batch)
                        batch = []
                        
                except Exception as e:
                    logger.error(f"處理題目失敗: {e}")
                    continue
            
            # 插入剩餘的題目
            if batch:
                await self.insert_batch(batch)
                
        except json.JSONDecodeError as e:
            logger.error(f"JSON解析錯誤 {file_path}: {e}")
            raise
        except Exception as e:
            logger.error(f"處理檔案失敗 {file_path}: {e}")
            raise

    def validate_question_item(self, item: Dict[str, Any]) -> bool:
        """驗證題目資料格式"""
        # 檢查必要欄位
        required_fields = ['question', 'options', 'answer']
        for field in required_fields:
            if field not in item:
                return False
        
        # 檢查選項格式
        options = item['options']
        if isinstance(options, dict):
            if len(options) < 2:
                return False
        elif isinstance(options, list):
            if len(options) < 2:
                return False
        else:
            return False
            
        return True

    def standardize_question_format(self, item: Dict[str, Any]) -> Dict[str, Any]:
        """標準化題目格式"""
        # 生成唯一ID
        question_id = str(uuid.uuid4())
        
        # 提取圖片檔名
        image_filename = self.extract_image_filename(item.get('question', ''), item)
        
        standardized = {
            '_id': question_id,
            'question_id': question_id,
            'question': item['question'],
            'options': item['options'],
            'answer': item['answer'],
            'grade': item.get('grade', ''),
            'subject': item.get('subject', ''),
            'publisher': item.get('publisher', ''),
            'chapter': item.get('chapter', ''),
            'topic': item.get('topic', ''),
            'knowledge_point': item.get('knowledge_point', []),
            'difficulty': item.get('difficulty', 'normal'),
            'explanation': item.get('explanation', ''),
            'scope': item.get('scope', ''),
            'semester': item.get('semester', ''),
            'image_filename': image_filename,
            'image_url': f"http://localhost:9000/{settings.minio_bucket_name}/{image_filename}" if image_filename else None,
            'created_at': datetime.utcnow(),
            'updated_at': datetime.utcnow()
        }
        
        return standardized

    def extract_image_filename(self, question_text: str, item: Dict[str, Any]) -> Optional[str]:
        """從題目內容或image_path欄位中提取圖片檔名"""
        # 優先檢查 image_path 欄位
        if 'image_path' in item:
            image_path = item['image_path']

            # 處理不同的 image_path 格式
            if isinstance(image_path, str) and image_path:
                # 如果是字串格式: "images/abc123.jpg"
                filename = image_path.split('/')[-1]  # 取得檔名部分
                if filename.endswith('.jpg'):
                    return filename
            elif isinstance(image_path, list) and len(image_path) > 0:
                # 如果是陣列格式: ["images/abc123.jpg"]
                for path in image_path:
                    if isinstance(path, str) and path:
                        filename = path.split('/')[-1]
                        if filename.endswith('.jpg'):
                            return filename

        # 如果 image_path 沒有，則從題目內容中尋找
        import re

        # 尋找 SHA256 格式的檔名
        pattern = r'([a-f0-9]{64}\.jpg)'
        match = re.search(pattern, question_text)

        if match:
            return match.group(1)

        return None

    async def insert_batch(self, batch: List[Dict[str, Any]]):
        """批次插入題目到資料庫"""
        try:
            collection = self.db.questions
            result = await collection.insert_many(batch)
            self.question_count += len(result.inserted_ids)
            
            if self.question_count % 1000 == 0:
                logger.info(f"已載入 {self.question_count} 道題目...")
                
        except Exception as e:
            logger.error(f"批次插入失敗: {e}")
            raise

    async def cleanup(self):
        """清理連接"""
        if self.mongodb_client:
            self.mongodb_client.close()
            logger.info("MongoDB 連接已關閉")


async def main():
    """主程式"""
    loader = ValidDataLoader()
    
    try:
        # 初始化連接
        await loader.initialize()
        
        # 清空現有資料
        logger.info("清空現有資料...")
        await loader.db.questions.delete_many({})
        
        # 上傳圖片
        logger.info("開始上傳圖片...")
        await loader.upload_all_images()
        
        # 載入題目資料
        logger.info("開始載入題目資料...")
        await loader.load_valid_files()
        
        logger.info("🎉 資料載入完成！")
        logger.info(f"📊 統計資訊:")
        logger.info(f"   - 題目數量: {loader.question_count}")
        logger.info(f"   - 圖片數量: {loader.image_count}")
        
    except Exception as e:
        logger.error(f"載入過程發生錯誤: {e}")
        raise
    finally:
        await loader.cleanup()


if __name__ == "__main__":
    # 設定環境變數
    os.environ.setdefault('MONGODB_URL', 'mongodb://aipe-tester:aipe-tester@localhost:27017/inulearning?authSource=admin')
    os.environ.setdefault('MINIO_ENDPOINT', 'localhost:9000')
    os.environ.setdefault('MINIO_ACCESS_KEY', 'inulearning_admin')
    os.environ.setdefault('MINIO_SECRET_KEY', 'inulearning_password')
    
    asyncio.run(main())