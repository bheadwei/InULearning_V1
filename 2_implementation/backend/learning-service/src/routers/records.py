"""
學習記錄查詢路由
提供家長和教師查詢學習記錄的API
"""
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from typing import List, Optional
from datetime import datetime, timedelta
import logging
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text

from ..utils.auth import get_current_user
from ..utils.database import get_db_session
from ..services.auth_service_client import auth_service_client

logger = logging.getLogger(__name__)

router = APIRouter()

def get_token_from_request(request: Request) -> str:
    """從請求中提取JWT token"""
    authorization = request.headers.get("Authorization")
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid authorization header")
    return authorization.split(" ")[1]

@router.get("/parent/children")
async def get_children_learning_records(
    request: Request,
    subject: Optional[str] = Query(None),
    start_date: Optional[datetime] = Query(None),
    end_date: Optional[datetime] = Query(None),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    current_user = Depends(get_current_user)
):
    """家長查詢子女的學習記錄"""
    
    # 檢查權限
    if current_user.role != "parent":
        raise HTTPException(status_code=403, detail="只有家長可以查詢子女學習記錄")
    
    try:
        # 獲取JWT token
        token = get_token_from_request(request)
        
        # 獲取家長的子女ID列表
        children_ids = await auth_service_client.get_parent_children_ids(current_user.id, token)
        
        # 返回模擬數據
        return {
            "records": [],
            "total": 0,
            "limit": limit,
            "offset": offset,
            "message": f"找到 {len(children_ids)} 個子女，但暫無學習記錄"
        }
        
    except Exception as e:
        logger.error(f"查詢子女學習記錄失敗: {str(e)}")
        raise HTTPException(status_code=500, detail="查詢學習記錄失敗")


# 新增：家長端 - 子女列表（對應前端 /learning/parents/children）
@router.get("/parents/children")
async def list_parent_children(
    request: Request,
    current_user = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session)
):
    """查詢家長名下子女列表，直接從 PostgreSQL 的 users 與 parent_child_relations 取得資料。"""
    if current_user.role != "parent":
        raise HTTPException(status_code=403, detail="只有家長可以查詢子女資料")

    # 驗證 Token（即使本查詢不直接調用其他服務，也先檢查請求頭部合法性）
    _ = get_token_from_request(request)

    try:
        parent_id = int(getattr(current_user, "user_id", getattr(current_user, "id", 0)))
        if not parent_id:
            raise HTTPException(status_code=401, detail="無效的使用者識別")

        query = text(
            """
            SELECT u.id, u.first_name, u.last_name, u.username, u.avatar_url, u.created_at
            FROM parent_child_relations pcr
            JOIN users u ON u.id = pcr.child_id
            WHERE pcr.parent_id = :parent_id
              AND pcr.is_active = TRUE
              AND u.is_active = TRUE
              AND u.role = 'student'
            ORDER BY u.id ASC
            """
        )

        result = await db_session.execute(query, {"parent_id": parent_id})
        rows = result.mappings().all()

        children = []
        for row in rows:
            first_name = row.get("first_name") or ""
            last_name = row.get("last_name") or ""
            full_name = (first_name + " " + last_name).strip() or row.get("username")
            children.append({
                "id": row["id"],
                "name": full_name,
                "grade": 0,  # 資料表未提供年級，給預設值避免前端出錯
                "class_name": None,
                "student_id": None,
                "avatar": row.get("avatar_url"),
                "created_at": row.get("created_at").isoformat() if row.get("created_at") else None,
                # 下列為學習度量的預設值，後續可由學習記錄計算填入
                "total_exercises": 0,
                "accuracy_rate": 0,
                "study_days": 0,
                "overall_progress": 0,
                "streak_days": 0,
                "total_study_hours": 0
            })

        return children
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"列出子女資料失敗: {e}")
        raise HTTPException(status_code=500, detail="獲取子女列表失敗")


# 新增：家長端 - 子女詳細（對應前端 /learning/parents/children/{child_id}）
@router.get("/parents/children/{child_id}")
async def get_parent_child_details(
    child_id: int,
    request: Request,
    current_user = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session)
):
    """查詢特定子女詳細資料，先驗證親子關係，再讀取 users。"""
    if current_user.role != "parent":
        raise HTTPException(status_code=403, detail="只有家長可以查詢子女資料")

    _ = get_token_from_request(request)

    try:
        parent_id = int(getattr(current_user, "user_id", getattr(current_user, "id", 0)))
        if not parent_id:
            raise HTTPException(status_code=401, detail="無效的使用者識別")

        # 驗證關係
        relation_query = text(
            """
            SELECT 1
            FROM parent_child_relations
            WHERE parent_id = :parent_id
              AND child_id = :child_id
              AND is_active = TRUE
            """
        )
        relation_result = await db_session.execute(relation_query, {"parent_id": parent_id, "child_id": child_id})
        if relation_result.scalar() is None:
            raise HTTPException(status_code=404, detail="子女不存在或無權限訪問")

        # 取得子女基本資料
        user_query = text(
            """
            SELECT id, first_name, last_name, username, avatar_url, created_at
            FROM users
            WHERE id = :child_id AND is_active = TRUE AND role = 'student'
            """
        )
        user_res = await db_session.execute(user_query, {"child_id": child_id})
        row = user_res.mappings().first()
        if not row:
            raise HTTPException(status_code=404, detail="學生不存在")

        first_name = row.get("first_name") or ""
        last_name = row.get("last_name") or ""
        full_name = (first_name + " " + last_name).strip() or row.get("username")

        detail = {
            "id": row["id"],
            "name": full_name,
            "grade": 0,
            "class_name": None,
            "student_id": None,
            "avatar": row.get("avatar_url"),
            "created_at": row.get("created_at").isoformat() if row.get("created_at") else None,
            # 下列欄位暫以預設值回傳
            "active_courses": 0,
            "completed_assignments": 0,
            "average_score": 0,
            "total_study_hours": 0,
            "status": ""
        }

        return detail
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"獲取子女詳細資料失敗: {e}")
        raise HTTPException(status_code=500, detail="獲取子女詳細資訊失敗")


# 新增：家長端 - 子女進度（對應前端 /learning/parents/children/{child_id}/progress）
@router.get("/parents/children/{child_id}/progress")
async def get_parent_child_progress(
    child_id: int,
    request: Request,
    current_user = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session)
):
    """查詢子女學習進度（目前回傳基本骨架，後續可擴充從學習記錄計算）。"""
    if current_user.role != "parent":
        raise HTTPException(status_code=403, detail="只有家長可以查詢學習進度")

    _ = get_token_from_request(request)

    try:
        parent_id = int(getattr(current_user, "user_id", getattr(current_user, "id", 0)))
        if not parent_id:
            raise HTTPException(status_code=401, detail="無效的使用者識別")

        # 驗證關係
        relation_query = text(
            """
            SELECT 1
            FROM parent_child_relations
            WHERE parent_id = :parent_id
              AND child_id = :child_id
              AND is_active = TRUE
            """
        )
        relation_result = await db_session.execute(relation_query, {"parent_id": parent_id, "child_id": child_id})
        if relation_result.scalar() is None:
            raise HTTPException(status_code=404, detail="子女不存在或無權限訪問")

        # 取得名稱
        user_query = text(
            """
            SELECT first_name, last_name, username
            FROM users
            WHERE id = :child_id AND is_active = TRUE AND role = 'student'
            """
        )
        user_res = await db_session.execute(user_query, {"child_id": child_id})
        row = user_res.mappings().first()
        if not row:
            raise HTTPException(status_code=404, detail="學生不存在")

        first_name = row.get("first_name") or ""
        last_name = row.get("last_name") or ""
        full_name = (first_name + " " + last_name).strip() or row.get("username")

        progress = {
            "child_name": full_name,
            "overall_progress": 0,
            "accuracy_rate": 0,
            "study_days": 0,
            "streak_days": 0,
            "subjects": [],
            "weaknesses": [],
            "trend_data": []
        }

        return progress
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"獲取子女學習進度失敗: {e}")
        raise HTTPException(status_code=500, detail="獲取學習進度失敗")

@router.get("/records/user/{user_id}")
async def get_user_records(
    user_id: int,
    limit: int = Query(10, ge=1, le=100),
    page: int = Query(1, ge=1),
    db_session: AsyncSession = Depends(get_db_session)
):
    """獲取指定用戶的學習記錄列表（主要供服務間調用）"""
    try:
        offset = (page - 1) * limit
        
        query = text(
            """
            SELECT * FROM learning_sessions
            WHERE user_id = :user_id
            ORDER BY start_time DESC
            LIMIT :limit OFFSET :offset
            """
        )
        
        result = await db_session.execute(query, {"user_id": user_id, "limit": limit, "offset": offset})
        records = result.mappings().all()

        total_query = text("SELECT COUNT(*) FROM learning_sessions WHERE user_id = :user_id")
        total_result = await db_session.execute(total_query, {"user_id": user_id})
        total = total_result.scalar() or 0
        
        return {
            "records": records,
            "total": total,
            "page": page,
            "limit": limit
        }
        
    except Exception as e:
        logger.error(f"查詢用戶 {user_id} 的學習記錄失敗: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="查詢學習記錄失敗")

@router.get("/teacher/students")
async def get_students_learning_records(
    request: Request,
    subject: Optional[str] = Query(None),
    start_date: Optional[datetime] = Query(None),
    end_date: Optional[datetime] = Query(None),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    current_user = Depends(get_current_user)
):
    """教師查詢學生的學習記錄"""
    
    # 檢查權限
    if current_user.role != "teacher":
        raise HTTPException(status_code=403, detail="只有教師可以查詢學生學習記錄")
    
    try:
        # 獲取JWT token
        token = get_token_from_request(request)
        
        # 獲取教師的學生ID列表
        student_ids = await auth_service_client.get_teacher_student_ids(current_user.id, token)
        
        # 返回模擬數據
        return {
            "records": [],
            "total": 0,
            "limit": limit,
            "offset": offset,
            "message": f"找到 {len(student_ids)} 個學生，但暫無學習記錄"
        }
        
    except Exception as e:
        logger.error(f"查詢學生學習記錄失敗: {str(e)}")
        raise HTTPException(status_code=500, detail="查詢學習記錄失敗")

@router.get("/parent/statistics")
async def get_children_learning_statistics(
    request: Request,
    days: int = Query(30, ge=1, le=365),
    current_user = Depends(get_current_user)
):
    """家長查詢子女的學習統計"""
    
    # 檢查權限
    if current_user.role != "parent":
        raise HTTPException(status_code=403, detail="只有家長可以查詢子女學習統計")
    
    try:
        # 獲取JWT token
        token = get_token_from_request(request)
        
        # 獲取家長的子女ID列表
        children_ids = await auth_service_client.get_parent_children_ids(current_user.id, token)
        
        # 返回模擬統計數據
        return {
            "total_sessions": 0,
            "total_questions": 0,
            "correct_answers": 0,
            "accuracy_rate": 0.0,
            "average_score": 0.0,
            "subjects": {},
            "recent_activity": [],
            "message": f"找到 {len(children_ids)} 個子女，但暫無學習數據"
        }
        
    except Exception as e:
        logger.error(f"查詢子女學習統計失敗: {str(e)}")
        raise HTTPException(status_code=500, detail="查詢學習統計失敗")


@router.get("/student/records")
async def get_student_learning_records(
    request: Request,
    subject: Optional[str] = Query(None),
    start_date: Optional[datetime] = Query(None),
    end_date: Optional[datetime] = Query(None),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    current_user = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session)
):
    """學生查詢自己的學習記錄（重定向到新的學習歷程API）"""
    
    # 檢查權限
    if current_user.role != "student":
        raise HTTPException(status_code=403, detail="只有學生可以查詢自己的學習記錄")
    
    try:
        # 重定向到新的學習歷程API
        from ..routers.learning_history import get_learning_records
        
        # 計算頁碼
        page = (offset // limit) + 1
        page_size = limit
        
        return await get_learning_records(
            subject=subject,
            grade=None,
            publisher=None,
            start_date=start_date,
            end_date=end_date,
            page=page,
            page_size=page_size,
            current_user=current_user,
            db_session=db_session
        )
        
    except Exception as e:
        logger.error(f"查詢學生學習記錄失敗: {str(e)}")
        raise HTTPException(status_code=500, detail="查詢學習記錄失敗")


@router.get("/student/statistics")
async def get_student_learning_statistics(
    request: Request,
    current_user = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session)
):
    """學生查詢自己的學習統計（重定向到新的學習歷程API）"""
    
    # 檢查權限
    if current_user.role != "student":
        raise HTTPException(status_code=403, detail="只有學生可以查詢自己的學習統計")
    
    try:
        # 重定向到新的學習歷程API
        from ..routers.learning_history import get_learning_statistics
        
        return await get_learning_statistics(
            current_user=current_user,
            db_session=db_session
        )
        
    except Exception as e:
        logger.error(f"查詢學生學習統計失敗: {str(e)}")
        raise HTTPException(status_code=500, detail="查詢學習統計失敗") 