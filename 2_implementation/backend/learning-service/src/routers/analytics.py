"""
Analytics API 路由

提供各科目雷達圖與趨勢圖所需的彙總資料
"""

from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, distinct, cast, Float, Integer, case, text

from ..utils.auth import get_current_user
from ..utils.database import get_db_session
from ..models.exercise_record import ExerciseRecord
from ..models.learning_session import LearningSession


logger = logging.getLogger(__name__)

router = APIRouter(prefix="/analytics", tags=["analytics"])


def _parse_window_days(window: str) -> int:
    """Parse window strings like '7d', '30d', '90d' into day count."""
    value = (window or "30d").strip().lower()
    if value.endswith("d") and value[:-1].isdigit():
        days = int(value[:-1])
        return days if days > 0 else 30
    # fallback
    if value.isdigit():
        days_int = int(value)
        return days_int if days_int > 0 else 30
    return 30


def _safe_int(value: Any) -> Optional[int]:
    try:
        return int(value)
    except Exception:
        return None


@router.get("/subjects/radar")
async def get_subjects_radar(
    window: str = Query("30d", description="時間範圍 (7d, 30d, 90d)"),
    current_user = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session),
):
    """取得各科目的六維度雷達圖指標 (raw + normalized)。"""
    days = _parse_window_days(window)
    user_id_int = _safe_int(current_user.user_id)
    if user_id_int is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid user id in token")

    # 聚合每科目資料（基礎 + 新指標）
    # - accuracy_ratio = AVG(is_correct::int) 0..1
    # - avg_time_spent_s = AVG(er.time_spent)
    # - qpm = 60 / avg_time_spent_s
    # - dwell_min = AVG(ls.time_spent) / 60  (分鐘)
    # - growth_rate = (recent_acc - past_acc) / past_acc  (以 window 對半切分)
    # - time_stddev_s = stddev_samp(er.time_spent)
    try:
        window_start = datetime.utcnow() - timedelta(days=days)
        window_mid = datetime.utcnow() - timedelta(days=max(1, days // 2))
        stmt = (
            select(
                ExerciseRecord.subject.label("subject"),
                (func.avg(cast(case((ExerciseRecord.is_correct == True, 1), else_=0), Float))).label("accuracy_ratio"),
                func.avg(ExerciseRecord.time_spent).label("avg_time_spent_s"),
                (func.avg(LearningSession.time_spent) / 60.0).label("dwell_min"),
                func.avg(cast(case((ExerciseRecord.created_at >= window_mid, case((ExerciseRecord.is_correct == True, 1), else_=0)), else_=None), Float)).label("recent_acc"),
                func.avg(cast(case((ExerciseRecord.created_at < window_mid, case((ExerciseRecord.is_correct == True, 1), else_=0)), else_=None), Float)).label("past_acc"),
                func.stddev_samp(ExerciseRecord.time_spent).label("time_stddev_s"),
            )
            .join(LearningSession, LearningSession.id == ExerciseRecord.session_id)
            .where(
                ExerciseRecord.user_id == user_id_int,
                ExerciseRecord.created_at >= window_start,
            )
            .group_by(ExerciseRecord.subject)
        )

        rows = (await db_session.execute(stmt)).all()
    except Exception as e:
        logger.error(f"Radar aggregation failed: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Radar aggregation failed")

    # 查詢知識點掌握率：對每個科目，平均每個知識點的正確率
    knowledge_mastery_map: Dict[str, float] = {}
    try:
        kp_sql = text(
            """
            WITH per_kp AS (
              SELECT er.subject AS subject,
                     kp AS kp,
                     AVG(CASE WHEN er.is_correct THEN 1.0 ELSE 0.0 END) AS kp_acc
              FROM exercise_records er, UNNEST(er.knowledge_points) AS kp
              WHERE er.user_id = :user_id
                AND er.created_at >= :window_start
              GROUP BY er.subject, kp
            )
            SELECT subject, AVG(kp_acc) AS knowledge_mastery
            FROM per_kp
            GROUP BY subject
            """
        )
        result = await db_session.execute(kp_sql, {"user_id": user_id_int, "window_start": window_start})
        for subject, km in result.fetchall():
            knowledge_mastery_map[subject] = float(km or 0.0)
    except Exception as e:
        logger.warning(f"Knowledge mastery aggregation failed, defaulting to accuracy: {e}")
        # fallback: 使用 accuracy_ratio 當作掌握率

    subjects_raw: List[Dict[str, Any]] = []
    for subject, accuracy_ratio, avg_time_spent_s, dwell_min, recent_acc, past_acc, time_stddev_s in rows:
        avg_time_spent_s = float(avg_time_spent_s) if avg_time_spent_s is not None else None
        qpm = 60.0 / avg_time_spent_s if (avg_time_spent_s and avg_time_spent_s > 0) else 0.0
        dwell_min = float(dwell_min or 0.0)
        accuracy_ratio = float(accuracy_ratio or 0.0)
        recent_acc = float(recent_acc or 0.0)
        past_acc = float(past_acc or 0.0)
        growth_rate = ((recent_acc - past_acc) / past_acc) if past_acc > 0 else 0.0
        time_stddev_s = float(time_stddev_s or 0.0)
        knowledge_mastery = knowledge_mastery_map.get(subject, accuracy_ratio)
        subjects_raw.append(
            {
                "subject": subject or "未知科目",
                "raw": {
                    "accuracy": accuracy_ratio,         # 0..1
                    "qpm": float(qpm),
                    "dwell_min": dwell_min,             # minutes
                    "growth_rate": growth_rate,         # can be negative
                    "knowledge_mastery": knowledge_mastery, # 0..1
                    "time_stability": time_stddev_s,    # seconds (stddev)
                },
            }
        )

    # 統一尺度鍵（0..1，前端顯示百分率）
    metric_keys = [
        "accuracy",           # higher better (0..1)
        "qpm",                # higher better (min-max)
        "dwell_min",          # lower better (invert then min-max)
        "growth_rate",        # can be negative, min-max across subjects
        "knowledge_mastery",  # higher better (0..1)
        "time_stability",     # lower better (invert then min-max)
    ]

    # 絕對尺度正規化（不依賴其他科目）
    def clamp01(x: float) -> float:
        if x is None:
            return 0.0
        if x < 0.0:
            return 0.0
        if x > 1.0:
            return 1.0
        return x

    QPM_MAX = 3.0            # 期望上限(題/分)
    DWELL_MAX_MIN = 30.0     # 期望上限(分鐘)
    STD_MAX = 60.0           # 作答時間標準差上限(秒)

    subjects_out: List[Dict[str, Any]] = []
    for item in subjects_raw:
        r = item["raw"]
        acc_norm = clamp01(r.get("accuracy", 0.0))
        qpm_norm = clamp01((r.get("qpm", 0.0) or 0.0) / QPM_MAX)
        dwell_raw = r.get("dwell_min", 0.0) or 0.0
        dwell_norm = clamp01(1.0 - (dwell_raw / DWELL_MAX_MIN))
        growth_raw = r.get("growth_rate", 0.0) or 0.0  # -inf..+inf,常見在[-1,1]
        growth_norm = clamp01((growth_raw + 1.0) / 2.0)
        km_norm = clamp01(r.get("knowledge_mastery", 0.0))
        std_raw = r.get("time_stability", 0.0) or 0.0
        time_stability_norm = clamp01(1.0 - (std_raw / STD_MAX))

        subjects_out.append(
            {
                "subject_id": item["subject"],
                "label": item["subject"],
                "raw": r,
                "normalized": {
                    "accuracy": acc_norm,
                    "qpm": qpm_norm,
                    "dwell_min": dwell_norm,
                    "growth_rate": growth_norm,
                    "knowledge_mastery": km_norm,
                    "time_stability": time_stability_norm,
                },
            }
        )

    # 固定科目順序
    subject_order = ["國文", "英文", "數學", "自然", "地理", "歷史", "公民"]
    def sort_key(item):
        name = item.get("label") or item.get("subject_id") or ""
        try:
            idx = subject_order.index(name)
        except ValueError:
            idx = 999
        return (idx, name)
    subjects_out.sort(key=sort_key)

    return {
        "window": f"{days}d",
        "metrics": metric_keys,
        "subjects": subjects_out,
    }


@router.get("/subjects/trend")
async def get_subjects_trend(
    metric: str = Query("accuracy", regex="^(accuracy|score)$", description="指標: accuracy 或 score"),
    window: str = Query("30d", description="時間範圍 (7d, 30d, 90d)"),
    limit: int = Query(100, ge=1, le=500, description="每科目最大點數"),
    subject: Optional[str] = Query(None, description="單一科目過濾"),
    current_user = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db_session),
):
    """取得各科目的每次會話趨勢資料。"""
    days = _parse_window_days(window)
    user_id_int = _safe_int(current_user.user_id)
    if user_id_int is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid user id in token")

    try:
        window_start = datetime.utcnow() - timedelta(days=days)
        # 先抓取每科目 x=開始時間、y=accuracy/score 的 per-session 聚合
        # accuracy = AVG(is_correct::int)
        acc_expr = func.avg(cast(case((ExerciseRecord.is_correct == True, 1), else_=0), Float))
        score_expr = func.avg(cast(ExerciseRecord.score, Float))
        y_expr = acc_expr if metric == "accuracy" else score_expr

        stmt = (
            select(
                ExerciseRecord.subject.label("subject"),
                ExerciseRecord.session_id.label("session_id"),
                LearningSession.start_time.label("x"),
                y_expr.label("y"),
            )
            .join(LearningSession, LearningSession.id == ExerciseRecord.session_id)
            .where(
                ExerciseRecord.user_id == user_id_int,
                ExerciseRecord.created_at >= window_start,
                *(
                    [ExerciseRecord.subject == subject]
                    if subject is not None and subject != ""
                    else []
                ),
            )
            .group_by(ExerciseRecord.subject, ExerciseRecord.session_id, LearningSession.start_time)
            .order_by(LearningSession.start_time.asc())
        )

        rows = (await db_session.execute(stmt)).all()
    except Exception as e:
        logger.error(f"Trend aggregation failed: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Trend aggregation failed")

    # 整理為 { subject -> list of points }
    series_map: Dict[str, List[Dict[str, Any]]] = {}
    for subj, _session_id, x, y in rows:
        if subj not in series_map:
            series_map[subj] = []
        # accuracy 0..1, score 0..100 (如果為 None，給 0)
        y_value = float(y) if y is not None else 0.0
        series_map[subj].append({"x": x.isoformat() if x else None, "y": y_value})

    # 依每科目限制點數，並固定科目順序
    out_series: List[Dict[str, Any]] = []
    for subj, points in series_map.items():
        if limit and len(points) > limit:
            points = points[-limit:]  # 取最新的 limit 筆
        out_series.append({"subject_id": subj, "label": subj, "points": points})

    subject_order = ["國文", "英文", "數學", "自然", "地理", "歷史", "公民"]
    def srt_key(s):
        name = s.get("label") or s.get("subject_id") or ""
        try:
            idx = subject_order.index(name)
        except ValueError:
            idx = 999
        return (idx, name)
    out_series.sort(key=srt_key)

    return {
        "window": f"{days}d",
        "metric": metric,
        "series": out_series,
    }


@router.get("/students/{student_id}/summary")
async def get_student_summary(
    student_id: int,
    db_session: AsyncSession = Depends(get_db_session),
    # 注意：此端點設計為可由其他後端服務調用，因此暫不強制要求終端用戶的 JWT
    # current_user = Depends(get_current_user),
):
    """取得特定學生的學習總結摘要。"""
    try:
        # 學習時數相關統計
        stmt_sessions = (
            select(
                func.count(LearningSession.id).label("total_sessions"),
                func.sum(LearningSession.time_spent).label("total_time_spent_seconds"),
                func.avg(LearningSession.time_spent).label("avg_session_duration_seconds"),
                func.count(distinct(func.date(LearningSession.start_time))).label("study_days"),
            )
            .where(LearningSession.user_id == student_id)
        )
        session_stats = (await db_session.execute(stmt_sessions)).first()

        # 練習記錄相關統計
        stmt_records = (
            select(
                func.count(ExerciseRecord.id).label("total_exercises"),
                func.avg(cast(case((ExerciseRecord.is_correct == True, 1), else_=0), Float)).label("accuracy_rate"),
            )
            .where(ExerciseRecord.user_id == student_id)
        )
        record_stats = (await db_session.execute(stmt_records)).first()

        total_time_spent_seconds = session_stats.total_time_spent_seconds or 0
        avg_duration_seconds = session_stats.avg_session_duration_seconds or 0

        # 將 Decimal 類型轉換為 float
        total_study_minutes = float(total_time_spent_seconds) / 60.0
        avg_session_duration_minutes = float(avg_duration_seconds) / 60.0

        return {
            "student_id": student_id,
            "total_study_minutes": round(total_study_minutes, 1),
            "total_sessions": session_stats.total_sessions or 0,
            "avg_session_duration_minutes": round(avg_session_duration_minutes, 1),
            "study_days": session_stats.study_days or 0,
            "total_exercises": record_stats.total_exercises or 0,
            "accuracy_rate": round(float(record_stats.accuracy_rate or 0.0) * 100, 2),
        }
    except Exception as e:
        logger.error(f"Failed to get student summary for student_id={student_id}: {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to retrieve student summary")


