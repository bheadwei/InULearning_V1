from pydantic_settings import BaseSettings
from typing import List, Optional
import os


class Settings(BaseSettings):
    """應用程式配置設定"""
    
    # 基本設定
    app_name: str = "InULearning Question Bank Service"
    app_version: str = "1.0.0"
    debug: bool = False
    
    # MongoDB 設定 - 使用 Docker 環境變數
    mongodb_url: str = "mongodb://aipe-tester:aipe-tester@mongodb:27017/inulearning?authSource=admin"
    mongodb_database: str = "inulearning"
    mongodb_questions_collection: str = "questions"
    mongodb_chapters_collection: str = "chapters"
    mongodb_knowledge_points_collection: str = "knowledge_points"
    
    # MinIO 設定 - 使用 Docker 環境變數
    minio_endpoint: str = "minio:9000"
    minio_access_key: str = "aipe-tester"
    minio_secret_key: str = "aipe-tester"
    minio_bucket_name: str = "question-bank"
    minio_secure: bool = False
    
    # Redis 設定 - 使用 Docker 環境變數
    redis_url: str = "redis://redis:6379"
    redis_db: int = 1
    
    # API 設定
    api_prefix: str = "/api/v1"
    cors_origins: List[str] = ["http://localhost:3000", "http://localhost:8080", "http://localhost:8081", "http://localhost:8082", "http://localhost:8083"]
    
    # 認證設定
    auth_service_url: str = "http://auth-service:8000"
    
    # 分頁設定
    default_page_size: int = 20
    max_page_size: int = 100
    
    # 快取設定
    cache_ttl: int = 3600  # 1小時
    
    class Config:
        env_file = ".env"
        case_sensitive = False
    
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        # 處理 CORS_ORIGINS 環境變數
        cors_env = os.getenv('CORS_ORIGINS')
        if cors_env:
            self.cors_origins = [origin.strip() for origin in cors_env.split(',')]


# 創建全域設定實例
settings = Settings() 