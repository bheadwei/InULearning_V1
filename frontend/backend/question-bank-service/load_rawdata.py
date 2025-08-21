#!/usr/bin/env python3
"""
題庫資料載入腳本
從 seeds/全題庫 目錄載入題目資料到 MongoDB 和 MinIO
支援圖片上傳和檔名對應
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


class DataLoader:
    """資料載入器類別"""
    
    def __init__(self):
        self.mongodb_client = None
        self.db = None
        self.minio_client = None
        self.question_count = 0
        self.image_count = 0
        self.image_lock = None
        self.question_lock = None
        
    async def initialize(self):
        """初始化連接"""
        # 初始化鎖
        self.image_lock = asyncio.Lock()
        self.question_lock = asyncio.Lock()
        # 連接 MongoDB
        self.mongodb_client = AsyncIOMotorClient(settings.mongodb_url)
        self.db = self.mongodb_client[settings.mongodb_database]
        
        # 連接 MinIO
        self.minio_client = Minio(
            settings.minio_endpoint,
            access_key=settings.minio_access_key,
            secret_key=settings.minio_secret_key,
            secure=settings.minio_secure
        )
        
        # 確保 MinIO bucket 存在
        try:
            if not self.minio_client.bucket_exists(settings.minio_bucket_name):
                self.minio_client.make_bucket(settings.minio_bucket_name)
                logger.info(f"✅ 創建 MinIO bucket: {settings.minio_bucket_name}")
            else:
                logger.info(f"✅ MinIO bucket 已存在: {settings.minio_bucket_name}")
        except S3Error as e:
            logger.error(f"❌ MinIO bucket 操作失敗: {e}")
            raise
        
        # 測試 MongoDB 連接
        try:
            await self.mongodb_client.admin.command('ping')
            logger.info("✅ MongoDB 連接成功")
        except Exception as e:
            logger.error(f"❌ MongoDB 連接失敗: {e}")
            raise
    
    async def load_all_data(self):
        """載入所有資料"""
        await self.initialize()
        
        # 若設定跳過（當資料已存在時）則直接返回
        skip_if_exists = os.getenv("QB_SKIP_IF_EXISTS", "false").lower() == "true"
        if skip_if_exists:
            try:
                existing = await self.db.questions.estimated_document_count()
            except Exception:
                existing = 0
            if existing and existing > 0:
                logger.info(f"⚠️ 檢測到現有題庫資料（{existing} 筆），依設定跳過載入")
                if self.mongodb_client:
                    self.mongodb_client.close()
                return
        
        # 清空現有資料（可選）
        do_clear = os.getenv("QB_CLEAR", "false").lower() == "true"
        if do_clear:
            await self.clear_existing_data()
        
        # 並行載入題目資料與圖片
        await asyncio.gather(
            self.load_questions_and_images()
        )
        
        # 關閉連接
        if self.mongodb_client:
            self.mongodb_client.close()
        
        logger.info(f"🎉 資料載入完成！共載入 {self.question_count} 道題目，{self.image_count} 張圖片")
    
    async def clear_existing_data(self):
        """清空現有資料"""
        try:
            # 清空 MongoDB 題目資料
            result = await self.db.questions.delete_many({})
            logger.info(f"✅ 已清空 MongoDB 題目資料: {result.deleted_count} 筆")
            
            # 清空 MinIO 圖片（可選）
            # 注意：這會刪除所有圖片，生產環境請謹慎使用
            try:
                objects = self.minio_client.list_objects(settings.minio_bucket_name, recursive=True)
                for obj in objects:
                    self.minio_client.remove_object(settings.minio_bucket_name, obj.object_name)
                logger.info("✅ 已清空 MinIO 圖片資料")
            except S3Error as e:
                logger.warning(f"⚠️ 清空 MinIO 資料時出現錯誤: {e}")
                
        except Exception as e:
            logger.error(f"❌ 清空資料失敗: {e}")
            raise
    
    async def load_questions_and_images(self):
        """載入題目資料和圖片（並行）"""
        # 取得 seeds 目錄路徑（可由環境變數覆寫）
        seeds_env = os.getenv("QB_SEEDS_PATH")
        if seeds_env:
            seeds_path = Path(seeds_env)
        else:
            seeds_path = Path(__file__).parent.parent.parent / "database" / "seeds" / "全題庫"
        
        if not seeds_path.exists():
            logger.error(f"❌ seeds 目錄不存在: {seeds_path}")
            return
        
        logger.info(f"📂 開始載入資料，路徑: {seeds_path}")

        # 週期性輸出進度，便於外部監控解析（每 2 秒一次）
        stop_event = asyncio.Event()
        progress_task = asyncio.create_task(self._periodic_progress(stop_event))

        try:
            await asyncio.gather(
                self.upload_all_images(seeds_path),
                self.load_all_questions(seeds_path)
            )
        finally:
            stop_event.set()
            await progress_task
    
    async def upload_all_images(self, seeds_path: Path):
        """上傳所有圖片到 MinIO（並行，具併發上限）"""
        logger.info("🖼️ 開始上傳圖片...")
        max_tasks = int(os.getenv("QB_MAX_IMAGE_TASKS", "8"))
        sem = asyncio.Semaphore(max_tasks)
        tasks: List[asyncio.Task] = []
        
        for images_dir in seeds_path.rglob("images"):
            if images_dir.is_dir():
                logger.info(f"📁 處理圖片目錄: {images_dir}")
                for image_file in images_dir.glob("*.jpg"):
                    tasks.append(asyncio.create_task(self._upload_image_with_lock(image_file, sem)))
        
        if tasks:
            await asyncio.gather(*tasks)
        
        logger.info(f"✅ 圖片上傳完成，共 {self.image_count} 張")

    async def _upload_image_with_lock(self, image_path: Path, sem: asyncio.Semaphore):
        async with sem:
            try:
                await self.upload_image(image_path)
                async with self.image_lock:
                    self.image_count += 1
                    if self.image_count % 50 == 0:
                        logger.info(f"📊 已上傳 {self.image_count} 張圖片...")
            except Exception as e:
                logger.error(f"❌ 上傳圖片失敗 {image_path.name}: {e}")
    
    async def upload_image(self, image_path: Path):
        """上傳單張圖片到 MinIO（thread pool 避免阻塞）"""
        try:
            object_name = f"images/{image_path.name}"
            await asyncio.to_thread(
                self.minio_client.fput_object,
                settings.minio_bucket_name,
                object_name,
                str(image_path),
                content_type="image/jpeg"
            )
            logger.debug(f"✅ 上傳圖片: {image_path.name}")
        except S3Error as e:
            logger.error(f"❌ MinIO 上傳失敗 {image_path.name}: {e}")
            raise
    
    async def load_all_questions(self, seeds_path: Path):
        """載入所有題目資料（並行，具併發上限）"""
        logger.info("📚 開始載入題目資料...")
        max_tasks = int(os.getenv("QB_MAX_QUESTION_TASKS", "32"))
        sem = asyncio.Semaphore(max_tasks)
        
        # 遍歷所有 JSON 檔案
        for json_file in seeds_path.rglob("*.json"):
            # 跳過非題目檔案
            if "images" in str(json_file) or json_file.name.startswith("."):
                continue
                
            try:
                logger.info(f"📖 載入檔案: {json_file.relative_to(seeds_path)}")
                
                async with aiofiles.open(json_file, 'r', encoding='utf-8') as f:
                    content = await f.read()
                    data = json.loads(content)
                
                # 處理題目資料
                tasks: List[asyncio.Task] = []
                if isinstance(data, list):
                    for item in data:
                        tasks.append(asyncio.create_task(self._process_question_item_with_lock(item, json_file, sem)))
                elif isinstance(data, dict):
                    tasks.append(asyncio.create_task(self._process_question_item_with_lock(data, json_file, sem)))

                if tasks:
                    # 每個檔案內等待完成，避免無限制堆積
                    await asyncio.gather(*tasks)
                    
            except Exception as e:
                logger.error(f"❌ 載入檔案失敗 {json_file.name}: {e}")
        
        logger.info(f"✅ 題目載入完成，共 {self.question_count} 道")

    async def _periodic_progress(self, stop_event: asyncio.Event):
        """週期性輸出目前圖片/題目進度，讓外部進度監控能即時更新"""
        try:
            while not stop_event.is_set():
                # 輕量讀取，不嚴格加鎖也可；為一致性仍加鎖
                async with self.image_lock:
                    img = self.image_count
                async with self.question_lock:
                    q = self.question_count
                # 關鍵字不可變動，供 start.sh 監控解析
                logger.info(f"📊 已上傳 {img} 張圖片...")
                logger.info(f"📊 已載入 {q} 道題目...")
                await asyncio.sleep(2)
        except asyncio.CancelledError:
            return

    async def _process_question_item_with_lock(self, item: Dict[str, Any], source_file: Path, sem: asyncio.Semaphore):
        async with sem:
            ok = await self.process_question_item(item, source_file)
            if ok:
                async with self.question_lock:
                    self.question_count += 1
                    if self.question_count % 100 == 0:
                        logger.info(f"📊 已載入 {self.question_count} 道題目...")
    
    async def process_question_item(self, item: Dict[str, Any], source_file: Path):
        """處理單個題目項目"""
        try:
            # 檢查必要欄位
            if not self.validate_question_item(item):
                return False
            
            # 標準化題目格式
            question_doc = await self.standardize_question_format(item, source_file)
            
            # 插入資料庫
            await self.db.questions.insert_one(question_doc)
            
            return True
            
        except Exception as e:
            logger.error(f"❌ 處理題目失敗: {e}")
            return False
    
    def validate_question_item(self, item: Dict[str, Any]) -> bool:
        """驗證題目項目是否有效"""
        # 檢查必要欄位
        required_fields = ['question', 'options', 'answer']
        for field in required_fields:
            if field not in item or not item[field]:
                logger.warning(f"⚠️ 題目缺少必要欄位: {field}")
                return False
        
        # 檢查選項格式
        options = item.get('options', {})
        if not isinstance(options, dict) or len(options) < 2:
            logger.warning("⚠️ 題目選項格式不正確")
            return False
        
        return True
    
    async def standardize_question_format(self, item: Dict[str, Any], source_file: Path) -> Dict[str, Any]:
        """標準化題目格式"""
        # 生成唯一 ID
        question_id = str(uuid.uuid4())
        
        # 檢查題目內容中是否包含圖片檔名
        question_text = item.get('question', '')
        image_filename = self.extract_image_filename(question_text, item)
        
        # 標準化文檔
        question_doc = {
            '_id': question_id,
            'question_id': question_id,
            'subject': item.get('subject', ''),
            'grade': item.get('grade', ''),
            'publisher': item.get('publisher', ''),
            'chapter': item.get('chapter', ''),
            'topic': item.get('topic', ''),
            'knowledge_points': item.get('knowledge_point', []),
            'question_type': '選擇題',  # 目前只處理選擇題
            'difficulty': self.convert_difficulty(item.get('difficulty', 'normal')),
            'content': question_text,
            'options': self.convert_options(item.get('options', {})),
            'correct_answer': item.get('answer', ''),
            'explanation': item.get('explanation', ''),
            'image_filename': image_filename,  # 圖片檔名
            'image_url': f"/api/v1/images/{image_filename}" if image_filename else None,  # 圖片 URL
            'source_file': str(source_file.name),
            'created_at': datetime.utcnow(),
            'updated_at': datetime.utcnow()
        }
        
        return question_doc
    
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
    
    def convert_difficulty(self, difficulty: str) -> str:
        """轉換難度等級"""
        difficulty_map = {
            'easy': 'easy',
            'normal': 'medium', 
            'hard': 'hard',
            '簡單': 'easy',
            '普通': 'medium',
            '困難': 'hard'
        }
        return difficulty_map.get(difficulty.lower(), 'medium')
    
    def convert_options(self, options: Dict[str, str]) -> List[Dict[str, str]]:
        """轉換選項格式"""
        option_list = []
        
        if isinstance(options, dict):
            for key, value in options.items():
                option_list.append({
                    'key': key.upper(),
                    'text': str(value).strip()
                })
        
        # 按照 A, B, C, D 順序排序
        option_list.sort(key=lambda x: x['key'])
        
        return option_list


async def load_rawdata():
    """主要載入函數"""
    loader = DataLoader()
    await loader.load_all_data()


if __name__ == "__main__":
    print("🚀 開始載入題庫資料...")
    asyncio.run(load_rawdata())
    print("✅ 資料載入完成！")