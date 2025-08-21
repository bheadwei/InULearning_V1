from fastapi import APIRouter, Depends, HTTPException, status, Query
from typing import List, Optional, Dict, Any
from app.database import DatabaseManager, get_database
from app.schemas import (
    QuestionCreate, QuestionUpdate, QuestionResponse, QuestionSearchCriteria,
    PaginatedResponse, Message, BulkImportResult
)
from app.crud import QuestionCRUD
import json

router = APIRouter(prefix="/questions", tags=["questions"])


@router.get("/", response_model=PaginatedResponse)
async def list_questions(
    limit: int = Query(20, ge=1, le=100, description="每頁數量"),
    skip: int = Query(0, ge=0, description="跳過數量"),
    db: DatabaseManager = Depends(get_database)
):
    """獲取題目列表"""
    try:
        # 創建基本查詢條件
        criteria = QuestionSearchCriteria(skip=skip, limit=limit)
        
        # 執行查詢
        result = await QuestionCRUD.search_questions(db, criteria)
        
        total_questions = result["total"]
        questions = result["questions"]
        
        return PaginatedResponse(
            items=questions,
            total=total_questions,
            page=skip // limit + 1,
            page_size=limit,
            total_pages=(total_questions + limit - 1) // limit
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"獲取題目列表失敗: {str(e)}"
        )


@router.post("/", response_model=QuestionResponse, status_code=status.HTTP_201_CREATED)
async def create_question(
    question: QuestionCreate,
    db: DatabaseManager = Depends(get_database)
):
    """創建新題目"""
    try:
        question_id = await QuestionCRUD.create_question(db, question)
        created_question = await QuestionCRUD.get_question_by_id(db, question_id)
        return created_question
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"創建題目失敗: {str(e)}"
        )




@router.get("/check", response_model=Dict[str, Any])
async def check_question_bank(
    grade: str = Query(..., description="年級"),
    edition: str = Query(..., description="版本/出版社"),
    subject: str = Query(..., description="科目"),
    chapter: Optional[str] = Query(None, description="章節"),
    db: DatabaseManager = Depends(get_database)
):
    """檢查題庫是否有符合條件的題目"""
    try:
        # 構建查詢條件
        query = {
            "grade": grade,
            "publisher": edition,  # edition 對應 publisher
            "subject": subject
        }
        
        if chapter and chapter.strip():
            query["chapter"] = chapter
        
        # 查詢題目數量
        count = await db.questions_collection.count_documents(query)
        
        return {
            "success": True,
            "data": {
                "count": count,
                "available": count > 0
            }
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "data": {
                "count": 0,
                "available": False
            }
        }


@router.get("/by-conditions", response_model=Dict[str, Any])
async def get_questions_by_conditions(
    grade: str = Query(..., description="年級"),
    edition: str = Query(..., description="版本/出版社"),
    subject: str = Query(..., description="科目"),
    chapter: Optional[str] = Query(None, description="章節"),
    questionCount: int = Query(10, ge=1, le=50, description="題目數量"),
    db: DatabaseManager = Depends(get_database)
):
    """根據條件獲取題目"""
    try:
        # 構建查詢條件
        query = {
            "grade": grade,
            "publisher": edition,  # edition 對應 publisher
            "subject": subject
        }
        
        if chapter and chapter.strip():
            query["chapter"] = chapter
        
        # 查詢題目
        cursor = db.questions_collection.find(query).limit(questionCount)
        questions = await cursor.to_list(length=questionCount)
        
        # 轉換格式以符合前端需求
        formatted_questions = []
        for q in questions:
            # 處理選項格式 - 轉換為前端期望的格式
            options = q.get("options", [])
            if isinstance(options, list) and len(options) > 0:
                # 如果是 [{key: 'A', text: '...'}, ...] 格式，轉換為 ['...', '...', ...]
                if isinstance(options[0], dict) and 'text' in options[0]:
                    option_texts = [opt['text'] for opt in options]
                else:
                    option_texts = options
            else:
                option_texts = []
            
            formatted_q = {
                "id": str(q["_id"]),
                "question": q.get("content", q.get("question", "")),  # 支援 content 和 question 欄位
                "options": option_texts,
                "answer": q.get("correct_answer", q.get("answer", "")),  # 支援 correct_answer 和 answer 欄位
                "explanation": q.get("explanation", ""),
                "difficulty": q.get("difficulty", "normal"),
                "subject": q["subject"],
                "grade": q["grade"],
                "publisher": q["publisher"],
                "chapter": q.get("chapter", ""),
                "image_filename": q.get("image_filename"),
                "image_url": q.get("image_url")
            }
            formatted_questions.append(formatted_q)
        
        return {
            "success": True,
            "data": formatted_questions
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "data": []
        }


@router.get("/search", response_model=PaginatedResponse)
async def search_questions(
    grade: Optional[str] = Query(None, description="年級"),
    subject: Optional[str] = Query(None, description="科目"),
    publisher: Optional[str] = Query(None, description="出版社"),
    chapter: Optional[str] = Query(None, description="章節"),
    topic: Optional[str] = Query(None, description="主題"),
    knowledge_points: Optional[str] = Query(None, description="知識點（逗號分隔）"),
    difficulty: Optional[str] = Query(None, description="難度"),
    question_type: Optional[str] = Query(None, description="題型"),
    tags: Optional[str] = Query(None, description="標籤（逗號分隔）"),
    keyword: Optional[str] = Query(None, description="關鍵字"),
    limit: int = Query(20, ge=1, le=100, description="每頁數量"),
    skip: int = Query(0, ge=0, description="跳過數量"),
    db: DatabaseManager = Depends(get_database)
):
    """搜尋題目"""
    print(f"🔍 搜索請求: subject={subject}, grade={grade}, limit={limit}")
    try:
        # 處理知識點和標籤參數
        knowledge_point_list = None
        if knowledge_points:
            knowledge_point_list = [kp.strip() for kp in knowledge_points.split(",")]
        
        tags_list = None
        if tags:
            tags_list = [tag.strip() for tag in tags.split(",")]
        
        # 構建搜尋條件
        criteria = QuestionSearchCriteria(
            grade=grade,
            subject=subject,
            publisher=publisher,
            chapter=chapter,
            topic=topic,
            knowledge_point=knowledge_point_list,
            difficulty=difficulty,
            question_type=question_type,
            tags=tags_list,
            keyword=keyword
        )
        
        # 執行搜尋
        result = await QuestionCRUD.search_questions(db, criteria)
        
        # 獲取結果
        total_questions = result["total"]
        questions = result["questions"]
        
        return PaginatedResponse(
            items=questions,
            total=total_questions,
            page=skip // limit + 1,
            page_size=limit,
            total_pages=(total_questions + limit - 1) // limit
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"搜尋題目失敗: {str(e)}"
        )


@router.get("/random", response_model=List[QuestionResponse])
async def get_random_questions(
    count: int = Query(10, ge=1, le=50, description="題目數量"),
    subject: Optional[str] = Query(None, description="科目"),
    grade: Optional[str] = Query(None, description="年級"),
    difficulty: Optional[str] = Query(None, description="難度"),
    question_type: Optional[str] = Query(None, description="題型"),
    exclude_ids: Optional[str] = Query(None, description="排除的題目ID（逗號分隔）"),
    db: DatabaseManager = Depends(get_database)
):
    """獲取隨機題目"""
    try:
        # 處理排除ID
        exclude_ids_list = None
        if exclude_ids:
            exclude_ids_list = [id.strip() for id in exclude_ids.split(",")]
        
        questions = await QuestionCRUD.get_random_questions_flexible(
            db, count, subject, grade, difficulty, question_type, exclude_ids_list
        )
        
        return questions
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"獲取隨機題目失敗: {str(e)}"
        )


@router.get("/criteria", response_model=List[QuestionResponse])
async def get_questions_by_criteria(
    grade: str = Query(..., description="年級"),
    subject: str = Query(..., description="科目"),
    publisher: str = Query(..., description="出版社"),
    chapter: Optional[str] = Query(None, description="章節"),
    difficulty: Optional[str] = Query(None, description="難度"),
    knowledge_points: Optional[str] = Query(None, description="知識點（逗號分隔）"),
    limit: int = Query(10, ge=1, le=100, description="題目數量"),
    db: DatabaseManager = Depends(get_database)
):
    """根據條件獲取題目（學習服務使用）"""
    try:
        # 處理知識點參數
        knowledge_points_list = None
        if knowledge_points:
            knowledge_points_list = [kp.strip() for kp in knowledge_points.split(",")]
        
        questions = await QuestionCRUD.get_questions_by_criteria(
            db, grade, subject, publisher, chapter, difficulty, knowledge_points_list, limit
        )
        
        return questions
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"根據條件獲取題目失敗: {str(e)}"
        )


@router.post("/batch", response_model=List[QuestionResponse])
async def get_questions_by_ids(
    question_ids: List[str],
    db: DatabaseManager = Depends(get_database)
):
    """根據ID列表獲取題目"""
    try:
        questions = []
        for question_id in question_ids:
            question = await QuestionCRUD.get_question_by_id(db, question_id)
            if question:
                questions.append(question)
        
        return questions
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"根據ID獲取題目失敗: {str(e)}"
        )


@router.post("/bulk-import", response_model=BulkImportResult)
async def bulk_import_questions(
    questions_data: List[QuestionCreate],
    db: DatabaseManager = Depends(get_database)
):
    """批量導入題目"""
    try:
        success_count = 0
        failed_count = 0
        failed_items = []
        
        for question_data in questions_data:
            try:
                question_id = await QuestionCRUD.create_question(db, question_data)
                success_count += 1
            except Exception as e:
                failed_count += 1
                failed_items.append({
                    "question": question_data.dict(),
                    "error": str(e)
                })
        
        return BulkImportResult(
            total_count=len(questions_data),
            success_count=success_count,
            failed_count=failed_count,
            failed_items=failed_items
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"批量導入題目失敗: {str(e)}"
        )


@router.get("/statistics", response_model=Dict[str, Any])
async def get_question_statistics(
    grade: Optional[str] = Query(None, description="年級"),
    subject: Optional[str] = Query(None, description="科目"),
    publisher: Optional[str] = Query(None, description="出版社"),
    db: DatabaseManager = Depends(get_database)
):
    """獲取題目統計資訊"""
    try:
        # 構建查詢條件
        query = {}
        if grade:
            query["grade"] = grade
        if subject:
            query["subject"] = subject
        if publisher:
            query["publisher"] = publisher
        
        collection = await db.get_questions_collection()
        
        # 統計總數
        total_count = await collection.count_documents(query)
        
        # 統計各難度數量
        difficulty_stats = {}
        difficulty_pipeline = [
            {"$match": query},
            {"$group": {"_id": "$difficulty", "count": {"$sum": 1}}}
        ]
        difficulty_cursor = collection.aggregate(difficulty_pipeline)
        async for doc in difficulty_cursor:
            difficulty_stats[doc["_id"]] = doc["count"]
        
        # 統計各科目數量
        subject_stats = {}
        subject_pipeline = [
            {"$match": query},
            {"$group": {"_id": "$subject", "count": {"$sum": 1}}}
        ]
        subject_cursor = collection.aggregate(subject_pipeline)
        async for doc in subject_cursor:
            subject_stats[doc["_id"]] = doc["count"]
        
        return {
            "total_count": total_count,
            "difficulty_distribution": difficulty_stats,
            "subject_distribution": subject_stats,
            "query_criteria": query
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"獲取統計資訊失敗: {str(e)}"
        )


# 通配符路由必須放在最後，避免與具體路由衝突
@router.get("/{question_id}", response_model=QuestionResponse)
async def get_question(
    question_id: str,
    db: DatabaseManager = Depends(get_database)
):
    """根據ID獲取題目"""
    question = await QuestionCRUD.get_question_by_id(db, question_id)
    if not question:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="題目不存在"
        )
    return question


@router.put("/{question_id}", response_model=QuestionResponse)
async def update_question(
    question_id: str,
    question_update: QuestionUpdate,
    db: DatabaseManager = Depends(get_database)
):
    """更新題目"""
    # 檢查題目是否存在
    existing_question = await QuestionCRUD.get_question_by_id(db, question_id)
    if not existing_question:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="題目不存在"
        )
    
    # 更新題目
    success = await QuestionCRUD.update_question(db, question_id, question_update)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="更新題目失敗"
        )
    
    # 返回更新後的題目
    updated_question = await QuestionCRUD.get_question_by_id(db, question_id)
    return updated_question


@router.delete("/{question_id}", response_model=Message)
async def delete_question(
    question_id: str,
    db: DatabaseManager = Depends(get_database)
):
    """刪除題目"""
    success = await QuestionCRUD.delete_question(db, question_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="題目不存在或刪除失敗"
        )
    
    return {"message": "題目刪除成功"}