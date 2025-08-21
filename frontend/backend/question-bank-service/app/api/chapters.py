from fastapi import APIRouter, Depends, HTTPException, status, Query
from typing import List
from app.database import DatabaseManager, get_database
from app.schemas import ChapterCreate, ChapterResponse, Message
from app.crud import ChapterCRUD

router = APIRouter(prefix="/chapters", tags=["chapters"])


@router.post("/", response_model=ChapterResponse, status_code=status.HTTP_201_CREATED)
async def create_chapter(
    chapter: ChapterCreate,
    db: DatabaseManager = Depends(get_database)
):
    """創建新章節"""
    try:
        chapter_id = await ChapterCRUD.create_chapter(db, chapter)
        # 這裡需要實現 get_chapter_by_id 方法，暫時返回創建的數據
        return {
            "id": chapter_id,
            **chapter.dict(),
            "created_at": "2024-12-19T10:00:00Z",
            "updated_at": "2024-12-19T10:00:00Z"
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"創建章節失敗: {str(e)}"
        )


@router.get("/", response_model=List[ChapterResponse])
async def get_chapters_by_subject_grade(
    subject: str = Query(..., description="科目"),
    grade: str = Query(..., description="年級"),
    publisher: str = Query(..., description="出版社"),
    db: DatabaseManager = Depends(get_database)
):
    """根據科目年級獲取章節列表"""
    try:
        chapters = await ChapterCRUD.get_chapters_by_subject_grade(db, subject, grade, publisher)
        return chapters
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"獲取章節列表失敗: {str(e)}"
        )


@router.get("/all/", response_model=List[ChapterResponse])
async def get_all_chapters(
    db: DatabaseManager = Depends(get_database)
):
    """獲取所有章節列表"""
    try:
        chapters = await ChapterCRUD.get_all_chapters(db)
        return chapters
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"獲取章節列表失敗: {str(e)}"
        ) 