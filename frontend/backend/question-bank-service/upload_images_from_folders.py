#!/usr/bin/env python3
"""
從各個資料夾的images目錄上傳圖片到MinIO
"""

import os
import sys
import asyncio
import aiofiles
from pathlib import Path
from minio import Minio
from minio.error import S3Error
import logging

# 設定日誌
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# 添加專案根目錄到 Python 路徑
project_root = Path(__file__).parent.parent.parent.parent
sys.path.insert(0, str(project_root))

from app.config import settings


class ImageUploader:
    """圖片上傳器"""
    
    def __init__(self):
        self.minio_client = None
        self.uploaded_count = 0
        self.skipped_count = 0
        self.error_count = 0
        self.seeds_path = Path(__file__).parent.parent.parent / "database" / "seeds" / "全題庫"
        
    def initialize(self):
        """初始化MinIO連接"""
        self.minio_client = Minio(
            settings.minio_endpoint,
            access_key=settings.minio_access_key,
            secret_key=settings.minio_secret_key,
            secure=False
        )
        
        # 確保bucket存在
        try:
            if not self.minio_client.bucket_exists(settings.minio_bucket_name):
                self.minio_client.make_bucket(settings.minio_bucket_name)
                logger.info(f"✅ 創建 MinIO bucket: {settings.minio_bucket_name}")
            else:
                logger.info(f"✅ MinIO bucket 已存在: {settings.minio_bucket_name}")
        except Exception as e:
            logger.error(f"❌ MinIO 初始化失敗: {e}")
            raise

    async def upload_all_images(self):
        """上傳所有images目錄中的圖片"""
        logger.info(f"開始掃描圖片目錄: {self.seeds_path}")
        
        # 查找所有images目錄
        image_dirs = []
        for root, dirs, files in os.walk(self.seeds_path):
            if 'images' in dirs:
                image_dir = Path(root) / 'images'
                image_dirs.append(image_dir)
        
        logger.info(f"找到 {len(image_dirs)} 個images目錄")
        
        for image_dir in image_dirs:
            logger.info(f"處理目錄: {image_dir}")
            await self.upload_from_directory(image_dir)
        
        logger.info(f"🎉 圖片上傳完成！")
        logger.info(f"   - 上傳成功: {self.uploaded_count} 張")
        logger.info(f"   - 跳過重複: {self.skipped_count} 張")
        logger.info(f"   - 上傳失敗: {self.error_count} 張")

    async def upload_from_directory(self, image_dir: Path):
        """從指定目錄上傳圖片"""
        if not image_dir.exists():
            logger.warning(f"目錄不存在: {image_dir}")
            return
        
        # 支援多種圖片格式
        image_files = []
        for pattern in ["*.jpg", "*.jpeg", "*.png"]:
            image_files.extend(list(image_dir.glob(pattern)))
        
        if not image_files:
            logger.info(f"目錄中沒有圖片檔案: {image_dir}")
            return
        
        logger.info(f"找到 {len(image_files)} 個圖片檔案")
        
        for image_file in image_files:
            try:
                await self.upload_image(image_file)
            except Exception as e:
                logger.error(f"上傳圖片失敗 {image_file.name}: {e}")
                self.error_count += 1

    async def upload_image(self, image_path: Path):
        """上傳單張圖片"""
        filename = image_path.name
        
        # 檢查圖片是否已存在
        try:
            self.minio_client.stat_object(settings.minio_bucket_name, filename)
            logger.debug(f"圖片已存在，跳過: {filename}")
            self.skipped_count += 1
            return
        except S3Error as e:
            if e.code != 'NoSuchKey':
                raise
        
        # 上傳圖片
        try:
            # 根據檔案副檔名設定content_type
            content_type = 'image/jpeg'
            if filename.lower().endswith('.png'):
                content_type = 'image/png'
            elif filename.lower().endswith(('.jpg', '.jpeg')):
                content_type = 'image/jpeg'
            
            # 使用同步方式讀取檔案並上傳
            with open(image_path, 'rb') as f:
                file_data = f.read()
                
            from io import BytesIO
            data_stream = BytesIO(file_data)
            
            self.minio_client.put_object(
                bucket_name=settings.minio_bucket_name,
                object_name=filename,
                data=data_stream,
                length=len(file_data),
                content_type=content_type
            )
            
            logger.debug(f"上傳成功: {filename}")
            self.uploaded_count += 1
            
            if self.uploaded_count % 100 == 0:
                logger.info(f"已上傳 {self.uploaded_count} 張圖片...")
                
        except Exception as e:
            logger.error(f"上傳圖片失敗 {filename}: {e}")
            self.error_count += 1
            raise


async def main():
    """主程式"""
    uploader = ImageUploader()
    
    try:
        # 設定環境變數（使用正確的MinIO憑證）
        os.environ.setdefault('MONGODB_URL', 'mongodb://aipe-tester:aipe-tester@localhost:27017/inulearning?authSource=admin')
        os.environ.setdefault('MINIO_ENDPOINT', 'localhost:9000')
        os.environ.setdefault('MINIO_ACCESS_KEY', 'aipe-tester')
        os.environ.setdefault('MINIO_SECRET_KEY', 'aipe-tester')
        
        # 初始化連接
        uploader.initialize()
        
        # 上傳圖片
        await uploader.upload_all_images()
        
    except Exception as e:
        logger.error(f"上傳過程發生錯誤: {e}")
        raise


if __name__ == "__main__":
    asyncio.run(main())