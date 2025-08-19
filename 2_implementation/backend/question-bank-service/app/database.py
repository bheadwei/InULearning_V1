from motor.motor_asyncio import AsyncIOMotorClient
from pymongo import MongoClient
from typing import Optional
import asyncio
import sys
import os
from app.config import settings

# 添加 shared 目錄到 Python 路徑
sys.path.append(os.path.join(os.path.dirname(__file__), '..', '..', 'shared'))

try:
    from database.mongodb import get_mongodb_client, get_mongodb_database
    # 使用 shared 的 MongoDB 配置
    client = get_mongodb_client()
    database = get_mongodb_database()
    print("✅ 成功導入 shared MongoDB 配置")
except ImportError as e:
    print(f"⚠️ 無法導入 shared MongoDB 配置，使用本地配置: {e}")
    client = None
    database = None


class DatabaseManager:
    """MongoDB 資料庫管理器"""
    
    def __init__(self):
        self.client: Optional[AsyncIOMotorClient] = None
        self.database = None
        self.questions_collection = None
        self.chapters_collection = None
        self.knowledge_points_collection = None
    
    async def connect(self):
        """連接到 MongoDB"""
        try:
            if client and database:
                # 使用 shared 配置
                self.client = client
                self.database = database
            else:
                # 使用本地配置
                self.client = AsyncIOMotorClient(settings.mongodb_url)
                self.database = self.client[settings.mongodb_database]
            
            self.questions_collection = self.database[settings.mongodb_questions_collection]
            self.chapters_collection = self.database[settings.mongodb_chapters_collection]
            self.knowledge_points_collection = self.database[settings.mongodb_knowledge_points_collection]
            
            # 建立常用查詢索引（效能優化）
            try:
                # 組合索引：grade + subject + publisher + chapter
                await self.questions_collection.create_index(
                    [("grade", 1), ("subject", 1), ("publisher", 1), ("chapter", 1)],
                    name="idx_questions_gspc"
                )
                # 單欄位索引（若未存在，確保查詢選擇性）
                await self.questions_collection.create_index([("grade", 1)], name="idx_questions_grade")
                await self.questions_collection.create_index([("subject", 1)], name="idx_questions_subject")
                await self.questions_collection.create_index([("publisher", 1)], name="idx_questions_publisher")
                await self.questions_collection.create_index([("chapter", 1)], name="idx_questions_chapter")
            except Exception as idx_err:
                print(f"⚠️ 建立 Mongo 索引失敗: {idx_err}")

            # 測試連接
            await self.client.admin.command('ping')
            print("✅ MongoDB 連接成功")
            
        except Exception as e:
            print(f"❌ MongoDB 連接失敗: {e}")
            raise
    
    async def disconnect(self):
        """斷開 MongoDB 連接"""
        if self.client:
            self.client.close()
            print("✅ MongoDB 連接已關閉")
    
    async def get_questions_collection(self):
        """獲取題目集合"""
        return self.questions_collection
    
    async def get_chapters_collection(self):
        """獲取章節集合"""
        return self.chapters_collection
    
    async def get_knowledge_points_collection(self):
        """獲取知識點集合"""
        return self.knowledge_points_collection
    
    async def check_connection(self) -> bool:
        """檢查資料庫連接狀態"""
        try:
            await self.client.admin.command('ping')
            return True
        except Exception as e:
            print(f"❌ MongoDB 連接檢查失敗: {e}")
            return False


# 創建全域資料庫管理器實例
db_manager = DatabaseManager()


async def get_database() -> DatabaseManager:
    """獲取資料庫管理器依賴"""
    return db_manager 