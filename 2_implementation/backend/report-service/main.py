"""
學習報告服務 (Report Service)
負責生成、管理和提供各種學習報告
"""

from fastapi import FastAPI, HTTPException, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
import logging
from sqlalchemy.orm import Session
import database, models
import random
from sqlalchemy import func
from collections import Counter

# 配置日誌
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="學習報告服務",
    description="負責生成、管理和提供各種學習報告",
    version="1.0.0"
)

# CORS 配置
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 資料模型
class ReportRequest(BaseModel):
    child_id: int
    report_type: str = Field("weekly", description="報告類型: weekly, monthly, semester, custom")
    subject: Optional[str] = Field("all", description="科目: all, math, chinese, etc.")
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None

class LearningReport(BaseModel):
    child_id: int
    report_type: str
    subject: str
    generated_at: datetime
    overall_performance: Dict[str, Any]
    subject_analysis: List[Dict[str, Any]]
    learning_trend: Dict[str, Any]
    weakness_analysis: List[Dict[str, Any]]
    improvement_suggestions: List[Dict[str, Any]]

# 建立資料庫表格
models.Base.metadata.create_all(bind=database.engine)

# API 端點
@app.get("/health")
async def health_check():
    """健康檢查端點"""
    return {"status": "healthy", "service": "report-service", "timestamp": datetime.now()}

@app.post("/api/v1/reports/learning", response_model=LearningReport)
async def generate_learning_report(request: ReportRequest, db: Session = Depends(database.get_db)):
    """生成學習報告"""
    try:
        # 查詢學生資料
        student = db.query(models.User).filter(models.User.id == request.child_id).first()
        if not student:
            raise HTTPException(status_code=404, detail="找不到該學生")

        # 查詢學生的學習檔案
        profile = db.query(models.UserLearningProfile).filter(models.UserLearningProfile.user_id == request.child_id).first()

        # 查詢學習會話
        sessions = db.query(models.LearningSession).filter(models.LearningSession.user_id == request.child_id).all()

        # 計算整體表現
        overall_score = profile.overall_accuracy if profile else 0
        total_study_hours = (profile.total_practice_time / 3600) if profile else 0
        completed_tasks = profile.total_sessions if profile else 0
        
        # 計算各科平均分數
        subject_scores = {}
        subject_counts = {}
        for session in sessions:
            if session.subject not in subject_scores:
                subject_scores[session.subject] = 0
                subject_counts[session.subject] = 0
            subject_scores[session.subject] += session.accuracy_rate
            subject_counts[session.subject] += 1
        
        avg_subject_scores = []
        for subject, total_score in subject_scores.items():
            avg_score = total_score / subject_counts[subject]
            avg_subject_scores.append({"name": subject, "score": avg_score})


        # 計算各科详细分析
        subject_analysis = []
        subjects = {session.subject for session in sessions}
        
        for subject in subjects:
            subject_sessions = [s for s in sessions if s.subject == subject]
            
            total_exercises = sum(s.question_count for s in subject_sessions)
            total_accuracy = sum(s.accuracy_rate for s in subject_sessions) / len(subject_sessions) if subject_sessions else 0
            total_study_hours = sum(s.time_spent for s in subject_sessions) / 3600 if subject_sessions else 0
            
            # 进步幅度需要历史数据，暂时模拟
            progress = (random.random() * 5) + 1 # 模拟 1% 到 6% 的进步

            subject_analysis.append({
                "subject": subject,
                "score": total_accuracy,
                "completed_exercises": total_exercises,
                "accuracy": total_accuracy,
                "study_hours": total_study_hours,
                "progress": progress
            })

        # 计算学习趋势 (过去四周)
        four_weeks_ago = datetime.now() - timedelta(weeks=4)
        
        # 按周分组查询成绩趋势
        score_trend_query = db.query(
            func.date_trunc('week', models.LearningSession.start_time).label('week'),
            func.avg(models.LearningSession.accuracy_rate).label('avg_score')
        ).filter(
            models.LearningSession.user_id == request.child_id,
            models.LearningSession.start_time >= four_weeks_ago
        ).group_by('week').order_by('week').all()

        # 按周分组查询学习时数趋势
        hours_trend_query = db.query(
            func.date_trunc('week', models.LearningSession.start_time).label('week'),
            func.sum(models.LearningSession.time_spent / 3600).label('total_hours')
        ).filter(
            models.LearningSession.user_id == request.child_id,
            models.LearningSession.start_time >= four_weeks_ago
        ).group_by('week').order_by('week').all()

        learning_trend = {
            "scores": [{"week": row.week.strftime('%Y-%m-%d'), "score": row.avg_score} for row in score_trend_query],
            "study_hours": [{"week": row.week.strftime('%Y-%m-%d'), "hours": row.total_hours} for row in hours_trend_query]
        }

        # 计算弱点分析
        wrong_answers = db.query(models.ExerciseRecord).filter(
            models.ExerciseRecord.user_id == request.child_id,
            models.ExerciseRecord.is_correct == False
        ).all()

        weak_points_counter = Counter()
        for record in wrong_answers:
            if record.knowledge_points:
                weak_points_counter.update(record.knowledge_points)

        weakness_analysis = []
        improvement_suggestions = []

        for point, count in weak_points_counter.most_common(3): # 取出最常见的 3 个弱点
            weakness_analysis.append(
                {"area": point, "suggestion": f"在 {point} 知识点上答错了 {count} 次，需要加强练习。"}
            )
            improvement_suggestions.append(
                {"suggestion": f"针对 {point} 进行专项练习", "details": f"建议寻找关于 {point} 的练习题进行加强。"}
            )


        report_data = {
            "child_id": request.child_id,
            "report_type": request.report_type,
            "subject": request.subject,
            "generated_at": datetime.now(),
            "overall_performance": {
                "overall_score": overall_score,
                "total_study_hours": total_study_hours,
                "completed_tasks": completed_tasks,
                "subjects": avg_subject_scores
            },
            "subject_analysis": subject_analysis,
            "learning_trend": learning_trend,
            "weakness_analysis": weakness_analysis,
            "improvement_suggestions": improvement_suggestions
        }
        return LearningReport(**report_data)
    except Exception as e:
        logger.error(f"生成報告失敗: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="生成學習報告失敗"
        )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8006)
