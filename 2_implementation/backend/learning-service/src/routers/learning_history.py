"""
學習歷程 API 路由

提供練習結果提交和學習歷程查詢的 API 端點
"""

import logging
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query, Body
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, or_, desc
from sqlalchemy.orm import selectinload
import math

from ..models.schemas import (
    CompleteExerciseRequest, CompleteExerciseResponse,
    LearningHistoryQuery, LearningHistoryResponse, LearningSessionSummary,
    LearningStatistics, SessionDetailResponse
)
from ..models.learning_session import LearningSession
from ..models.exercise_record import ExerciseRecord
from ..services.question_bank_client import QuestionBankClient
import random
from ..models.user_learning_profile import UserLearningProfile
from ..utils.database import get_db_session
from ..utils.auth import get_current_user
from ..services.question_bank_client import QuestionBankClient

logger = logging.getLogger(__name__)

router = APIRouter(tags=["learning_history"])


def _normalize_publisher(value: Optional[str]) -> Optional[str]:
    """將 publisher/edition 正規化為資料庫使用的固定值。"""
    if not value:
        return None
    value = str(value).strip()
    mapping = {
        "南一": "南一",
        "翰林": "翰林",
        "康軒": "康軒",
        # 常見別名/拼寫
        "康轩": "康軒",
        "翰林版": "翰林",
        "南一版": "南一",
        "康軒版": "康軒",
    }
    return mapping.get(value, value)

@router.post("/exercises/complete", response_model=CompleteExerciseResponse)
async def complete_exercise(
    request: CompleteExerciseRequest,
    current_user = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session)
):
    """完成練習並提交結果"""
    
    try:
        logger.info(f"Completing exercise for user {current_user.user_id}")
        
        # 計算統計數據
        total_questions = len(request.exercise_results)
        correct_count = sum(1 for result in request.exercise_results if result.is_correct)
        total_score = sum(result.score for result in request.exercise_results) / total_questions if total_questions > 0 else 0
        accuracy_rate = (correct_count / total_questions * 100) if total_questions > 0 else 0
        
        # 規範化出版社（若前端未正確帶入，嘗試從多處來源回填）
        def normalize_publisher(value: Optional[str]) -> Optional[str]:
            if not value:
                return None
            value = str(value).strip()
            mapping = {
                "南一": "南一",
                "翰林": "翰林",
                "康軒": "康軒",
                # 常見別名/拼寫
                "康轩": "康軒",
                "翰林版": "翰林",
                "南一版": "南一",
                "康軒版": "康軒",
            }
            return mapping.get(value, value)

        derived_publisher: Optional[str] = normalize_publisher(request.publisher)

        # 從 session_metadata.original_session_data 嘗試補值
        try:
            original = (request.session_metadata or {}).get("original_session_data") or {}
            if not derived_publisher:
                derived_publisher = normalize_publisher(original.get("publisher") or original.get("edition"))
        except Exception:
            pass

        # 從第一筆題目結果嘗試補值
        if not derived_publisher and request.exercise_results:
            derived_publisher = normalize_publisher(request.exercise_results[0].publisher)

        # 防守性：限制在允許清單內
        allowed_publishers = {"南一", "翰林", "康軒"}
        if derived_publisher not in allowed_publishers:
            # 最終保底
            derived_publisher = "南一"

        # 創建學習會話
        session = LearningSession(
            user_id=int(current_user.user_id),
            session_name=request.session_name,
            subject=request.subject,
            grade=request.grade,
            chapter=request.chapter,
            publisher=derived_publisher,
            difficulty=request.difficulty,
            knowledge_points=request.knowledge_points,
            question_count=total_questions,
            correct_count=correct_count,
            total_score=total_score,
            accuracy_rate=accuracy_rate,
            time_spent=request.total_time_spent,
            status='completed',
            session_metadata=request.session_metadata,
            start_time=datetime.utcnow(),
            end_time=datetime.utcnow()
        )
        
        db_session.add(session)
        await db_session.flush()  # 獲取 session.id
        
        # 創建練習記錄
        exercise_records = []
        for result in request.exercise_results:
            record_publisher = normalize_publisher(result.publisher) or derived_publisher
            record = ExerciseRecord(
                session_id=session.id,
                user_id=int(current_user.user_id),
                question_id=result.question_id,
                subject=result.subject,
                grade=result.grade,
                chapter=result.chapter,
                publisher=record_publisher,
                knowledge_points=result.knowledge_points,
                question_content=result.question_content,
                answer_choices=result.answer_choices,
                difficulty=result.difficulty,
                question_topic=result.question_topic,
                user_answer=result.user_answer,
                correct_answer=result.correct_answer,
                is_correct=result.is_correct,
                score=result.score,
                explanation=result.explanation,
                time_spent=result.time_spent
            )
            exercise_records.append(record)
        
        db_session.add_all(exercise_records)
        
        # 更新或創建用戶學習檔案
        user_id_int = int(current_user.user_id)
        result = await db_session.execute(
            select(UserLearningProfile).where(UserLearningProfile.user_id == user_id_int)
        )
        profile = result.scalar_one_or_none()
        
        if not profile:
            # 創建新的學習檔案
            profile = UserLearningProfile(
                user_id=user_id_int,
                current_grade=request.grade,
                preferred_subjects=[request.subject],
                preferred_publishers=[request.publisher],
                total_practice_time=request.total_time_spent or 0,
                total_sessions=1,
                total_questions=total_questions,
                correct_questions=correct_count,
                overall_accuracy=accuracy_rate,
                last_practice_date=datetime.utcnow().date()
            )
            db_session.add(profile)
        else:
            # 更新現有檔案
            profile.total_practice_time += request.total_time_spent or 0
            profile.total_sessions += 1
            profile.total_questions += total_questions
            profile.correct_questions += correct_count
            profile.overall_accuracy = (profile.correct_questions / profile.total_questions * 100) if profile.total_questions > 0 else 0
            profile.last_practice_date = datetime.utcnow().date()
            
            # 更新偏好科目和出版社
            if request.subject not in (profile.preferred_subjects or []):
                profile.preferred_subjects = (profile.preferred_subjects or []) + [request.subject]
            if request.publisher not in (profile.preferred_publishers or []):
                profile.preferred_publishers = (profile.preferred_publishers or []) + [request.publisher]
        
        await db_session.commit()
        
        return CompleteExerciseResponse(
            session_id=str(session.id),
            total_questions=total_questions,
            correct_count=correct_count,
            total_score=total_score,
            accuracy_rate=accuracy_rate,
            time_spent=request.total_time_spent or 0,
            created_at=session.created_at
        )
        
    except Exception as e:
        await db_session.rollback()
        logger.error(f"Failed to complete exercise: {e}", exc_info=True)
        
        # 根據錯誤類型返回更具體的錯誤信息
        if "duplicate key" in str(e).lower():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="練習結果已存在，請勿重複提交"
            )
        elif "foreign key" in str(e).lower():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="數據關聯錯誤，請檢查提交的數據"
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"提交練習結果失敗: {str(e)[:100]}"
            )


@router.get("/recent", response_model=LearningHistoryResponse)
async def get_recent_learning_records(
    limit: int = Query(5, ge=1, le=20, description="記錄數量"),
    current_user = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session)
):
    """獲取最近的學習記錄"""
    
    try:
        logger.info(f"Getting recent {limit} learning records for user {current_user.user_id}")
        
        user_id_int = int(current_user.user_id)
        
        # 查詢最近的學習記錄
        result = await db_session.execute(
            select(LearningSession)
            .where(LearningSession.user_id == user_id_int)
            .order_by(desc(LearningSession.start_time))
            .limit(limit)
        )
        sessions = result.scalars().all()
        
        # 轉換為響應格式
        session_summaries = []
        for session in sessions:
            summary = LearningSessionSummary(
                session_id=str(session.id),
                session_name=session.session_name,
                subject=session.subject,
                grade=session.grade,
                chapter=session.chapter,
                publisher=session.publisher,
                difficulty=session.difficulty,
                knowledge_points=session.knowledge_points or [],
                question_count=session.question_count,
                correct_count=session.correct_count,
                total_score=float(session.total_score) if session.total_score else 0.0,
                accuracy_rate=float(session.accuracy_rate) if session.accuracy_rate else 0.0,
                time_spent=session.time_spent,
                status=session.status,
                start_time=session.start_time,
                end_time=session.end_time
            )
            session_summaries.append(summary)
        
        return LearningHistoryResponse(
            sessions=session_summaries,
            total=len(session_summaries),
            page=1,
            page_size=limit,
            total_pages=1
        )
        
    except Exception as e:
        logger.error(f"Failed to get recent learning records: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="查詢最近學習記錄失敗"
        )


@router.get("/records", response_model=LearningHistoryResponse)
async def get_learning_records(
    subject: Optional[str] = Query(None, description="科目篩選"),
    grade: Optional[str] = Query(None, description="年級篩選"),
    publisher: Optional[str] = Query(None, description="出版社篩選"),
    start_date: Optional[datetime] = Query(None, description="開始日期"),
    end_date: Optional[datetime] = Query(None, description="結束日期"),
    page: int = Query(1, ge=1, description="頁碼"),
    page_size: int = Query(20, ge=1, le=100, description="每頁數量"),
    current_user = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session)
):
    """查詢學習歷程記錄"""
    
    try:
        logger.info(f"Getting learning records for user {current_user.user_id}")

        # 規範化時間參數（將含有時區資訊的時間轉為 UTC 並移除 tzinfo）
        try:
            if start_date and getattr(start_date, 'tzinfo', None) is not None:
                start_date = start_date.astimezone(timezone.utc).replace(tzinfo=None)
            if end_date and getattr(end_date, 'tzinfo', None) is not None:
                end_date = end_date.astimezone(timezone.utc).replace(tzinfo=None)
        except Exception as dt_err:
            logger.warning(f"Datetime normalization failed: {dt_err}")
        
        # 構建查詢條件
        user_id_int = int(current_user.user_id)
        conditions = [LearningSession.user_id == user_id_int]
        
        if subject:
            conditions.append(LearningSession.subject == subject)
        if grade:
            conditions.append(LearningSession.grade == grade)
        if publisher:
            conditions.append(LearningSession.publisher == publisher)
        if start_date:
            conditions.append(LearningSession.start_time >= start_date)
        if end_date:
            conditions.append(LearningSession.start_time <= end_date)
        
        # 查詢總數
        count_result = await db_session.execute(
            select(func.count(LearningSession.id)).where(and_(*conditions))
        )
        total = count_result.scalar()
        
        # 分頁查詢
        offset = (page - 1) * page_size
        result = await db_session.execute(
            select(LearningSession)
            .where(and_(*conditions))
            .order_by(desc(LearningSession.start_time))
            .offset(offset)
            .limit(page_size)
        )
        sessions = result.scalars().all()
        
        # 轉換為響應格式
        session_summaries = []
        for session in sessions:
            summary = LearningSessionSummary(
                session_id=str(session.id),
                session_name=session.session_name,
                subject=session.subject,
                grade=session.grade,
                chapter=session.chapter,
                publisher=session.publisher,
                difficulty=session.difficulty,
                knowledge_points=session.knowledge_points or [],
                question_count=session.question_count,
                correct_count=session.correct_count,
                total_score=float(session.total_score) if session.total_score else 0.0,
                accuracy_rate=float(session.accuracy_rate) if session.accuracy_rate else 0.0,
                time_spent=session.time_spent,
                status=session.status,
                start_time=session.start_time,
                end_time=session.end_time
            )
            session_summaries.append(summary)
        
        total_pages = math.ceil(total / page_size) if total > 0 else 0
        
        return LearningHistoryResponse(
            sessions=session_summaries,
            total=total,
            page=page,
            page_size=page_size,
            total_pages=total_pages
        )
        
    except Exception as e:
        logger.error(f"Failed to get learning records: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="查詢學習記錄失敗"
        )


@router.get("/records/{session_id}", response_model=SessionDetailResponse)
async def get_session_detail(
    session_id: str,
    current_user = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session)
):
    """查詢會話詳細資訊"""
    
    try:
        logger.info(f"Getting session detail for session {session_id}")
        
        # 查詢會話
        result = await db_session.execute(
            select(LearningSession).where(
                and_(
                    LearningSession.id == session_id,
                    LearningSession.user_id == int(current_user.user_id)
                )
            )
        )
        session = result.scalar_one_or_none()
        
        if not session:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="會話不存在"
            )
        
        # 查詢練習記錄
        records_result = await db_session.execute(
            select(ExerciseRecord)
            .where(ExerciseRecord.session_id == session_id)
            .order_by(ExerciseRecord.created_at)
        )
        exercise_records = records_result.scalars().all()
        
        # 轉換為響應格式
        session_summary = LearningSessionSummary(
            session_id=str(session.id),
            session_name=session.session_name,
            subject=session.subject,
            grade=session.grade,
            chapter=session.chapter,
            publisher=session.publisher,
            difficulty=session.difficulty,
            knowledge_points=session.knowledge_points or [],
            question_count=session.question_count,
            correct_count=session.correct_count,
            total_score=float(session.total_score) if session.total_score else 0.0,
            accuracy_rate=float(session.accuracy_rate) if session.accuracy_rate else 0.0,
            time_spent=session.time_spent,
            status=session.status,
            start_time=session.start_time,
            end_time=session.end_time
        )
        
        exercise_records_data = [record.to_dict() for record in exercise_records]
        
        return SessionDetailResponse(
            session=session_summary,
            exercise_records=exercise_records_data
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get session detail: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="查詢會話詳情失敗"
        )


@router.get("/records/done-questions")
async def get_done_question_ids(
    subject: Optional[str] = Query(None),
    grade: Optional[str] = Query(None),
    publisher: Optional[str] = Query(None),
    chapter: Optional[str] = Query(None),
    since_days: Optional[int] = Query(None, ge=1, le=3650),
    current_user = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session)
):
    """取得使用者已作答過的題目ID清單（可依條件過濾）。"""
    try:
        user_id_int = int(current_user.user_id)
        logger.info(
            "[done-questions] user=%s subject=%s grade=%s publisher=%s chapter=%s since_days=%s",
            user_id_int, subject, grade, _normalize_publisher(publisher), chapter, since_days
        )

        # 直接在 ExerciseRecord 上用欄位過濾，避免 join 帶來的潛在錯誤
        stmt = select(ExerciseRecord.question_id).where(ExerciseRecord.user_id == user_id_int)

        if subject:
            stmt = stmt.where(ExerciseRecord.subject == subject)
        if grade:
            stmt = stmt.where(ExerciseRecord.grade == grade)
        if publisher:
            # 舊資料可能 publisher 為 NULL，視為通配以避免漏抓
            stmt = stmt.where(or_(ExerciseRecord.publisher == _normalize_publisher(publisher), ExerciseRecord.publisher.is_(None)))
        if chapter:
            # 舊資料可能 chapter 為 NULL，視為通配以避免漏抓
            stmt = stmt.where(or_(ExerciseRecord.chapter == chapter, ExerciseRecord.chapter.is_(None)))
        if since_days:
            from datetime import datetime, timedelta
            start_dt = datetime.utcnow() - timedelta(days=since_days)
            stmt = stmt.where(ExerciseRecord.created_at >= start_dt)

        stmt = stmt.group_by(ExerciseRecord.question_id)

        result = await db_session.execute(stmt)
        ids = [row[0] for row in result.all() if row[0] is not None]
        logger.info("[done-questions] user=%s matched_ids=%d", user_id_int, len(ids))

        return {"success": True, "data": {"question_ids": ids, "count": len(ids)}}
    except Exception as e:
        logger.exception("[done-questions] failed: user=%s error=%s", getattr(current_user, 'user_id', None), str(e))
        return {
            "success": False,
            "data": {"question_ids": [], "count": 0},
            "error": f"done-questions failed: {str(e)[:200]}"
        }


@router.get("/availability/summary")
async def get_availability_summary(
    grade: str = Query(...),
    subject: str = Query(...),
    publisher: str = Query(..., description="出版社/版本"),
    chapter: Optional[str] = Query(None),
    current_user = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session)
):
    """彙總可用題目數：total/done/unseen。"""
    try:
        normalized_publisher = _normalize_publisher(publisher)
        user_id_int = int(current_user.user_id)

        # 1) 取 Mongo 題庫總數（透過題庫服務 /questions/check）
        qb = QuestionBankClient()
        total = await qb.check_question_count(
            grade=grade,
            subject=subject,
            publisher=normalized_publisher,
            chapter=chapter
        )

        # 2) 取 PostgreSQL 已做過數（ExerciseRecord 直接過濾）
        stmt = select(ExerciseRecord.question_id).where(
            ExerciseRecord.user_id == user_id_int
        )
        stmt = stmt.where(ExerciseRecord.subject == subject)
        stmt = stmt.where(ExerciseRecord.grade == grade)
        if normalized_publisher:
            stmt = stmt.where(or_(ExerciseRecord.publisher == normalized_publisher, ExerciseRecord.publisher.is_(None)))
        if chapter:
            stmt = stmt.where(or_(ExerciseRecord.chapter == chapter, ExerciseRecord.chapter.is_(None)))
        stmt = stmt.group_by(ExerciseRecord.question_id)

        result = await db_session.execute(stmt)
        done_ids = [row[0] for row in result.all() if row[0] is not None]
        done = len(done_ids)
        unseen = max(0, int(total) - int(done))

        logger.info(
            "[availability] user=%s total=%s done=%s unseen=%s grade=%s subject=%s publisher=%s chapter=%s",
            user_id_int, total, done, unseen, grade, subject, normalized_publisher, chapter
        )

        return {
            "success": True,
            "data": {
                "total": int(total),
                "done": int(done),
                "unseen": int(unseen)
            }
        }
    except Exception as e:
        logger.exception("[availability] failed: %s", str(e))
        return {
            "success": False,
            "error": f"availability summary failed: {str(e)[:200]}",
            "data": {"total": 0, "done": 0, "unseen": 0}
        }


@router.post("/questions/by-conditions-excluding")
async def get_questions_by_conditions_excluding(
    payload: dict = Body(...),
    current_user = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session)
):
    """根據條件出題，並排除指定的題目ID（含使用者已作答過的）。

    請求格式：
    {
      "grade": "8A",
      "subject": "國文",
      "publisher": "南一",            // 或傳 edition
      "chapter": "...",              // optional
      "questionCount": 10,            // 需要題數
      "excludeIds": ["id1","id2"]  // optional
    }
    回傳：{ success: true, data: [question,...] }
    """
    try:
        grade = payload.get("grade")
        subject = payload.get("subject")
        publisher = _normalize_publisher(payload.get("publisher") or payload.get("edition"))
        chapter = payload.get("chapter")
        question_count = int(payload.get("questionCount") or payload.get("question_count") or 10)
        exclude_ids = set(payload.get("excludeIds") or payload.get("exclude_ids") or [])

        if not grade or not subject:
            logger.warning("[exclude] missing required fields: grade=%s subject=%s", grade, subject)
            raise HTTPException(status_code=400, detail="grade 與 subject 為必填")

        logger.info(
            "[exclude] user=%s grade=%s subject=%s publisher=%s chapter=%s requested=%s exclude_in=%d",
            getattr(current_user, 'user_id', None), grade, subject, publisher, chapter, question_count, len(exclude_ids)
        )

        # 取得使用者已作答過的題目，加入排除集合
        # 直接在 ExerciseRecord 上過濾，避免 join 帶來的異常
        done_contents = set()
        try:
            stmt = select(ExerciseRecord.question_id, ExerciseRecord.question_content).where(
                ExerciseRecord.user_id == int(current_user.user_id)
            )
            if subject:
                stmt = stmt.where(ExerciseRecord.subject == subject)
            if grade:
                stmt = stmt.where(ExerciseRecord.grade == grade)
            if publisher:
                stmt = stmt.where(or_(ExerciseRecord.publisher == _normalize_publisher(publisher), ExerciseRecord.publisher.is_(None)))
            if chapter:
                stmt = stmt.where(or_(ExerciseRecord.chapter == chapter, ExerciseRecord.chapter.is_(None)))
            stmt = stmt.group_by(ExerciseRecord.question_id, ExerciseRecord.question_content)

            result = await db_session.execute(stmt)
            rows = result.all()
            done_ids = {row[0] for row in rows if row[0] is not None}
            done_contents = {row[1] for row in rows if len(row) > 1 and row[1] is not None}
            exclude_ids |= done_ids
            logger.info("[exclude] user=%s merged_exclude_ids size=%d (added %d ids, %d contents from DB)", getattr(current_user, 'user_id', None), len(exclude_ids), len(done_ids), len(done_contents))

            # 階段0診斷：抽樣驗證 done_ids 是否存在於 Mongo（型別/格式一致性）
            try:
                if done_ids:
                    sample_ids = list(done_ids)[:5]
                    qb = QuestionBankClient()
                    probe = await qb.get_questions_by_ids(sample_ids)
                    logger.info(
                        "[exclude][probe] sample=%s exists_in_mongo=%d", len(sample_ids), len(probe or [])
                    )
            except Exception as probe_err:
                logger.warning("[exclude][probe] validation failed: %s", str(probe_err))
        except Exception:
            # 後端過濾失敗時，不阻斷流程，改為僅使用前端提供的 excludeIds
            logger.exception("[exclude] failed to merge DB done_ids, fallback to client excludeIds only")

        # 直接由題庫服務以 $nin 過濾，失敗時回退到本地過濾
        client = QuestionBankClient()
        picked = []
        try:
            picked = await client.get_questions_by_criteria_excluding(
                grade=grade,
                subject=subject,
                publisher=publisher,
                chapter=chapter,
                limit=question_count,
                exclude_ids=list(exclude_ids),
                exclude_contents=list(done_contents)
            )
        except Exception as ce_err:
            logger.warning("[exclude] criteria-excluding failed, will try local filter: %s", str(ce_err))

        # 後備A：若題庫 $nin 失敗或回傳不足，先嘗試題庫的 by-conditions（已是前端格式）
        if (not picked) or (len(picked) < question_count):
            try:
                candidates = await client.get_questions_by_conditions_simple(
                    grade=grade,
                    publisher=publisher,
                    subject=subject,
                    chapter=chapter,
                    question_count=question_count * 5
                )
                # 本地排除：依 id 與內容（處理歷史 id 不對齊）
                exclude_id_set = set(exclude_ids)
                exclude_content_set = set(done_contents)
                filtered = []
                for q in candidates or []:
                    qid = q.get("id")
                    qcontent = q.get("content") or q.get("question") or ""
                    if qid in exclude_id_set:
                        continue
                    if qcontent in exclude_content_set:
                        continue
                    filtered.append(q)
                random.shuffle(filtered)
                picked = filtered[:question_count]
            except Exception as simple_err:
                logger.warning("[exclude] simple by-conditions fallback failed: %s", str(simple_err))

        # 後備B：若仍不足，抓更大樣本（學習服務後端 by-criteria）並本地過濾
        if (not picked) or (len(picked) < question_count):
            try:
                sample_limit = min(1000, max(question_count * 5, question_count))
                items = await client.get_questions_by_criteria(
                    grade=grade,
                    subject=subject,
                    publisher=publisher,
                    chapter=chapter,
                    limit=sample_limit
                )
                # 本地排除：依 id 與內容（處理歷史 id 不對齊）
                exclude_id_set = set(exclude_ids)
                exclude_content_set = set(done_contents)
                filtered = []
                for q in items or []:
                    qid = q.get("id")
                    qcontent = q.get("content") or q.get("question") or ""
                    if qid in exclude_id_set:
                        continue
                    if qcontent in exclude_content_set:
                        continue
                    filtered.append(q)
                random.shuffle(filtered)
                picked = filtered[:question_count]
            except Exception as lf_err:
                logger.warning("[exclude] local filter fallback failed: %s", str(lf_err))

        # 後備：若無需排除且未取到題目，嘗試無排除路徑（避免誤判為「全做過」）
        if (not picked or len(picked) == 0) and len(exclude_ids) == 0:
            try:
                logger.warning("[exclude] empty result with no exclude_ids; fallback to criteria fetch")
                picked = await client.get_questions_by_criteria(
                    grade=grade,
                    subject=subject,
                    publisher=publisher,
                    chapter=chapter,
                    limit=question_count
                )
            except Exception as fb_err:
                logger.warning("[exclude] fallback criteria fetch failed: %s", str(fb_err))

        # 第二層後備：若仍無題，顯示友善錯誤，避免前端誤判
        if not picked:
            logger.error("[exclude] no questions picked after fallbacks; check question bank and data")
            return {"success": False, "error": "目前無法取得題目，請稍後再試", "data": []}

        logger.info(
            "[exclude] user=%s exclude_total=%d returned=%d",
            getattr(current_user, 'user_id', None), len(exclude_ids), len(picked)
        )

        return {"success": True, "data": picked}
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("[exclude] failed: %s", str(e))
        return {
            "success": False,
            "error": f"by-conditions-excluding failed: {str(e)[:200]}",
            "data": []
        }


@router.get("/statistics", response_model=LearningStatistics)
async def get_learning_statistics(
    current_user = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session)
):
    """獲取學習統計資訊"""
    
    try:
        logger.info(f"Getting learning statistics for user {current_user.user_id}")
        
        # 查詢用戶學習檔案
        result = await db_session.execute(
            select(UserLearningProfile).where(UserLearningProfile.user_id == int(current_user.user_id))
        )
        profile = result.scalar_one_or_none()
        
        if not profile:
            # 返回空統計
            return LearningStatistics(
                total_sessions=0,
                total_questions=0,
                total_correct=0,
                overall_accuracy=0.0,
                total_time_spent=0,
                subject_stats={},
                recent_performance=[]
            )
        
        # 查詢科目統計
        subject_stats_result = await db_session.execute(
            select(
                LearningSession.subject,
                func.count(LearningSession.id).label('sessions'),
                func.sum(LearningSession.question_count).label('questions'),
                func.sum(LearningSession.correct_count).label('correct'),
                func.avg(LearningSession.accuracy_rate).label('avg_accuracy'),
                func.avg(LearningSession.total_score).label('avg_score')
            )
            .where(LearningSession.user_id == int(current_user.user_id))
            .group_by(LearningSession.subject)
        )
        
        subject_stats = {}
        for row in subject_stats_result:
            subject_stats[row.subject] = {
                "sessions": row.sessions,
                "questions": row.questions or 0,
                "correct": row.correct or 0,
                "accuracy": float(row.avg_accuracy) if row.avg_accuracy else 0.0,
                "avg_score": float(row.avg_score) if row.avg_score else 0.0
            }
        
        # 查詢近期表現（最近10次會話）
        recent_result = await db_session.execute(
            select(LearningSession)
            .where(LearningSession.user_id == int(current_user.user_id))
            .order_by(desc(LearningSession.start_time))
            .limit(10)
        )
        recent_sessions = recent_result.scalars().all()
        
        recent_performance = []
        for session in recent_sessions:
            recent_performance.append({
                "session_id": str(session.id),
                "subject": session.subject,
                "date": session.start_time.isoformat(),
                "score": float(session.total_score) if session.total_score else 0.0,
                "accuracy": float(session.accuracy_rate) if session.accuracy_rate else 0.0,
                "questions": session.question_count
            })
        
        return LearningStatistics(
            total_sessions=profile.total_sessions,
            total_questions=profile.total_questions,
            total_correct=profile.correct_questions,
            overall_accuracy=float(profile.overall_accuracy) if profile.overall_accuracy else 0.0,
            total_time_spent=profile.total_practice_time,
            subject_stats=subject_stats,
            recent_performance=recent_performance
        )
        
    except Exception as e:
        logger.error(f"Failed to get learning statistics: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="查詢學習統計失敗"
        )