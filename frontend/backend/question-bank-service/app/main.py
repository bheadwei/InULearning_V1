from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from app.config import settings
from app.database import db_manager
from app.api import questions, chapters, knowledge_points, images


@asynccontextmanager
async def lifespan(app: FastAPI):
    """應用程式生命週期管理"""
    # 啟動時連接資料庫
    await db_manager.connect()
    print("🚀 Question Bank Service 啟動成功")
    
    yield
    
    # 關閉時斷開資料庫連接
    await db_manager.disconnect()
    print("✅ Question Bank Service 關閉完成")


# 創建 FastAPI 應用程式
app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description="InULearning 題庫管理服務",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan
)

# 配置 CORS
# 註解掉 CORS 中間件，由 Nginx 統一處理 CORS
# app.add_middleware(
#     CORSMiddleware,
#     allow_origins=settings.cors_origins,
#     allow_credentials=True,
#     allow_methods=["*"],
#     allow_headers=["*"],
# )

# 包含 API 路由
app.include_router(questions.router, prefix=settings.api_prefix)
app.include_router(chapters.router, prefix=settings.api_prefix)
app.include_router(knowledge_points.router, prefix=settings.api_prefix)
app.include_router(images.router, prefix=settings.api_prefix)


@app.get("/")
async def root():
    """根端點"""
    return {
        "message": "InULearning Question Bank Service",
        "version": settings.app_version,
        "status": "running"
    }


@app.get("/health")
async def health_check():
    """健康檢查端點"""
    try:
        # 檢查資料庫連接
        db_status = await db_manager.check_connection()
        return {
            "status": "healthy" if db_status else "unhealthy",
            "service": "question-bank-service",
            "version": settings.app_version,
            "database": "connected" if db_status else "disconnected",
            "timestamp": "2024-12-19T10:00:00Z"
        }
    except Exception as e:
        return {
            "status": "unhealthy",
            "service": "question-bank-service",
            "version": settings.app_version,
            "database": "disconnected",
            "error": str(e),
            "timestamp": "2024-12-19T10:00:00Z"
        } 