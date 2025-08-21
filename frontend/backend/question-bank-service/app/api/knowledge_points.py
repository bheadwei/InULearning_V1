from fastapi import APIRouter, Depends, HTTPException, status, Query
from typing import List
from app.database import DatabaseManager, get_database
from app.schemas import KnowledgePointCreate, KnowledgePointResponse, Message
from app.crud import KnowledgePointCRUD

router = APIRouter(prefix="/knowledge-points", tags=["knowledge-points"])


@router.post("/", response_model=KnowledgePointResponse, status_code=status.HTTP_201_CREATED)
async def create_knowledge_point(
    knowledge_point: KnowledgePointCreate,
    db: DatabaseManager = Depends(get_database)
):
    """創建新知識點"""
    try:
        knowledge_point_id = await KnowledgePointCRUD.create_knowledge_point(db, knowledge_point)
        # 這裡需要實現 get_knowledge_point_by_id 方法，暫時返回創建的數據
        return {
            "id": knowledge_point_id,
            **knowledge_point.dict(),
            "created_at": "2024-12-19T10:00:00Z",
            "updated_at": "2024-12-19T10:00:00Z"
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"創建知識點失敗: {str(e)}"
        )


@router.get("/", response_model=List[KnowledgePointResponse])
async def get_knowledge_points_by_subject_grade(
    subject: str = Query(..., description="科目"),
    grade: str = Query(..., description="年級"),
    db: DatabaseManager = Depends(get_database)
):
    """根據科目年級獲取知識點列表"""
    try:
        knowledge_points = await KnowledgePointCRUD.get_knowledge_points_by_subject_grade(db, subject, grade)
        return knowledge_points
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"獲取知識點列表失敗: {str(e)}"
        ) 