from fastapi import APIRouter, HTTPException, status
from fastapi.responses import StreamingResponse
from app.database import DatabaseManager, get_database
from app.config import settings
from minio import Minio
from minio.error import S3Error
import io
from typing import Optional

router = APIRouter(prefix="/images", tags=["images"])

def get_minio_client():
    """獲取MinIO客戶端"""
    return Minio(
        settings.minio_endpoint,
        access_key=settings.minio_access_key,
        secret_key=settings.minio_secret_key,
        secure=False
    )


@router.get("/health")
async def minio_health():
    """檢查MinIO連接健康狀態"""
    try:
        minio_client = get_minio_client()
        
        # 嘗試列出 buckets
        buckets = list(minio_client.list_buckets())
        bucket_names = [bucket.name for bucket in buckets]
        
        # 檢查指定的 bucket 是否存在
        bucket_exists = minio_client.bucket_exists(settings.minio_bucket_name)
        
        return {
            "status": "healthy",
            "endpoint": settings.minio_endpoint,
            "bucket_name": settings.minio_bucket_name,
            "bucket_exists": bucket_exists,
            "available_buckets": bucket_names
        }
        
    except Exception as e:
        return {
            "status": "unhealthy",
            "error": str(e),
            "endpoint": settings.minio_endpoint,
            "bucket_name": settings.minio_bucket_name
        }


@router.get("/check/{image_filename}")
async def check_image_exists(image_filename: str):
    """檢查圖片是否存在"""
    try:
        minio_client = get_minio_client()
        
        # 確保圖片路徑包含 images/ 前綴
        if not image_filename.startswith("images/"):
            object_path = f"images/{image_filename}"
        else:
            object_path = image_filename
        
        try:
            minio_client.stat_object(settings.minio_bucket_name, object_path)
            return {"exists": True, "filename": image_filename}
        except S3Error as e:
            if e.code == 'NoSuchKey':
                return {"exists": False, "filename": image_filename}
            raise
            
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"檢查圖片失敗: {str(e)}"
        )


@router.get("/{image_filename}")
async def get_image(image_filename: str):
    """獲取圖片"""
    try:
        minio_client = get_minio_client()
        
        # 確保圖片路徑包含 images/ 前綴
        if not image_filename.startswith("images/"):
            object_path = f"images/{image_filename}"
        else:
            object_path = image_filename
        
        # 檢查圖片是否存在
        try:
            minio_client.stat_object(settings.minio_bucket_name, object_path)
        except S3Error as e:
            if e.code == 'NoSuchKey':
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"圖片不存在: {image_filename}"
                )
            raise
        
        # 獲取圖片數據
        response = minio_client.get_object(settings.minio_bucket_name, object_path)
        image_data = response.read()
        
        # 返回圖片流
        return StreamingResponse(
            io.BytesIO(image_data),
            media_type="image/jpeg",
            headers={"Content-Disposition": f"inline; filename={image_filename}"}
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"獲取圖片失敗: {str(e)}"
        )


@router.get("/check/{image_filename}")
async def check_image_exists(image_filename: str):
    """檢查圖片是否存在"""
    try:
        minio_client = get_minio_client()
        
        # 確保圖片路徑包含 images/ 前綴
        if not image_filename.startswith("images/"):
            object_path = f"images/{image_filename}"
        else:
            object_path = image_filename
        
        try:
            minio_client.stat_object(settings.minio_bucket_name, object_path)
            return {"exists": True, "filename": image_filename}
        except S3Error as e:
            if e.code == 'NoSuchKey':
                return {"exists": False, "filename": image_filename}
            raise
            
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"檢查圖片失敗: {str(e)}"
        )