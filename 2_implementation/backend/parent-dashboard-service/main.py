"""
家長儀表板服務 (Parent Dashboard Service)
提供家長查看子女學習狀況、進度追蹤、弱點分析等功能
"""

from fastapi import FastAPI, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import httpx
import json
import logging
from datetime import datetime, timedelta
import asyncio

# 新增 SQLAlchemy 相關導入
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

# 配置日誌
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="家長儀表板服務",
    description="提供家長查看子女學習狀況、進度追蹤、弱點分析等功能",
    version="1.0.0"
)

# # CORS 配置 (整個區塊移除或註解掉)
# app.add_middleware(
#     CORSMiddleware,
#     allow_origins=["*"],
#     allow_credentials=True,
#     allow_methods=["*"],
#     allow_headers=["*"],
# )

# 安全配置
security = HTTPBearer(auto_error=False)

# 服務配置
AUTH_SERVICE_URL = "http://auth-service:8000"
LEARNING_SERVICE_URL = "http://learning-service:8000"
AI_ANALYSIS_SERVICE_URL = "http://ai-analysis-service:8004"
QUESTION_BANK_SERVICE_URL = "http://question-bank-service:8000"

# 新增：資料庫連接配置
DATABASE_URL = "postgresql://aipe-tester:aipe-tester@postgres:5432/inulearning"
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# 資料模型
class ChildInfo(BaseModel):
    id: int
    name: str
    grade: Optional[int] = None
    class_name: Optional[str] = None
    student_id: Optional[str] = None
    avatar: Optional[str] = None
    created_at: datetime
    total_exercises: int = 0
    accuracy_rate: float = 0.0
    study_days: int = 0
    overall_progress: float = 0.0
    streak_days: int = 0
    total_study_hours: float = 0.0 # 保留前端其他地方可能用到的欄位

class ChildProgress(BaseModel):
    child_name: str
    overall_progress: float
    accuracy_rate: float
    study_days: int
    streak_days: int
    subjects: List[Dict[str, Any]]
    weaknesses: List[Dict[str, Any]]
    trend_data: List[Dict[str, Any]]

class CommunicationAdvice(BaseModel):
    child_id: int
    advice_type: str
    title: str
    content: str
    suggested_topics: List[str]
    mood_analysis: Dict[str, Any]
    created_at: datetime

class LearningActivity(BaseModel):
    id: int
    title: str
    description: str
    activity_type: str
    created_at: datetime
    metadata: Dict[str, Any]

# 依賴注入
async def get_current_user(credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)) -> Dict[str, Any]:
    """驗證用戶身份並返回用戶資訊"""
    logger.info("開始驗證用戶身份...")
    if not credentials:
        logger.warning("請求未包含認證令牌")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="請求未包含有效的認證令牌",
            headers={"WWW-Authenticate": "Bearer"},
        )
    try:
        logger.info(f"接收到令牌: {credentials.credentials[:10]}...") # 只記錄前10個字符以保護隱私
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{AUTH_SERVICE_URL}/api/v1/users/profile",
                headers={"Authorization": f"Bearer {credentials.credentials}"}
            )
            
            logger.info(f"認證服務回應狀態碼: {response.status_code}")
            
            if response.status_code == 200:
                user_data = response.json()
                logger.info(f"成功獲取用戶資訊: {user_data.get('email')}, 角色: {user_data.get('role')}")
                if user_data.get("role") != "parent":
                    logger.warning(f"用戶角色不符: {user_data.get('role')}")
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail="只有家長角色可以訪問此服務"
                    )
                return user_data
            else:
                logger.error(f"認證失敗: {response.text}")
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="無效的認證令牌"
                )
    except httpx.RequestError as e:
        logger.error(f"認證服務連接錯誤: {e}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="認證服務暫時不可用"
        )
    except Exception as e:
        logger.error(f"get_current_user 中發生未知錯誤: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="內部伺服器錯誤"
        )

async def get_user_children(token: str) -> List[Dict[str, Any]]:
    """獲取家長的子女列表"""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{AUTH_SERVICE_URL}/api/v1/relationships/parent-child",
                headers={"Authorization": f"Bearer {token}"}
            )
            
            if response.status_code == 200:
                # auth-service 回傳的是家長-子女關係列表，需要正規化為子女清單
                data = response.json()
                normalized_children: List[Dict[str, Any]] = []
                if isinstance(data, list):
                    for item in data:
                        # 已是子女物件（包含 id 與 name）則直接沿用
                        if isinstance(item, dict) and "id" in item and "name" in item:
                            child_obj = dict(item)
                            child_obj.setdefault("created_at", datetime.now().isoformat())
                            normalized_children.append(child_obj)
                            continue

                        # 關係物件（包含 child_id/child_name）→ 映射成子女物件
                        if isinstance(item, dict):
                            child_id = item.get("child_id") or item.get("id")
                            child_name = item.get("child_name") or item.get("name") or (f"學生 {child_id}" if child_id is not None else "學生")
                            created_at = item.get("created_at") or datetime.now().isoformat()

                            if child_id is not None:
                                normalized_children.append({
                                    "id": child_id,
                                    "name": child_name,
                                    "grade": item.get("grade"),
                                    "class_name": item.get("class_name"),
                                    "student_id": item.get("student_id"),
                                    "avatar": item.get("avatar"),
                                    "created_at": created_at,
                                })
                    # 若清單為空，回傳空陣列
                logger.info(f"正規化後的子女數量: {len(normalized_children)}")
                return normalized_children
            else:
                logger.error(f"獲取子女列表失敗: {response.status_code}, {response.text}")
                return []
    except httpx.RequestError as e:
        logger.error(f"獲取子女列表錯誤: {e}")
        return []

async def get_child_learning_data(child_id: int) -> Dict[str, Any]:
    """獲取子女的學習資料"""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{LEARNING_SERVICE_URL}/api/v1/learning/analytics/students/{child_id}/summary"
            )
            
            if response.status_code == 200:
                return response.json()
            else:
                logger.error(f"獲取學習資料失敗: {response.status_code}")
                return {}
    except httpx.RequestError as e:
        logger.error(f"獲取學習資料錯誤: {e}")
        return {}

async def get_child_weakness_analysis(child_id: int) -> List[Dict[str, Any]]:
    """獲取子女的弱點分析"""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{AI_ANALYSIS_SERVICE_URL}/api/v1/ai/weakness-analysis",
                json={"student_id": child_id}
            )
            
            if response.status_code == 200:
                return response.json().get("weaknesses", [])
            else:
                logger.error(f"獲取弱點分析失敗: {response.status_code}")
                return []
    except httpx.RequestError as e:
        logger.error(f"獲取弱點分析錯誤: {e}")
        return []

async def get_communication_advice(child_id: int) -> Dict[str, Any]:
    """獲取親子溝通建議"""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{AI_ANALYSIS_SERVICE_URL}/api/v1/ai/communication-advice",
                json={"student_id": child_id}
            )
            
            if response.status_code == 200:
                return response.json()
            else:
                logger.error(f"獲取溝通建議失敗: {response.status_code}")
                return {}
    except httpx.RequestError as e:
        logger.error(f"獲取溝通建議錯誤: {e}")
        return {}

# API 端點
@app.get("/health")
async def health_check():
    """健康檢查端點"""
    return {"status": "healthy", "service": "parent-dashboard-service", "timestamp": datetime.now()}

@app.get("/api/v1/parent/children", response_model=List[ChildInfo])
async def get_children(current_user: Dict[str, Any] = Depends(get_current_user), token: HTTPAuthorizationCredentials = Depends(security)):
    """獲取家長的子女列表"""
    logger.info(f"用戶 {current_user.get('email')} 正在請求子女列表...")
    try:
        children_data = await get_user_children(token.credentials)
        logger.info(f"成功從 auth-service 獲取到 {len(children_data)} 個子女的基礎資料")
        
        # 並行獲取每個子女的學習資料
        tasks = []
        for child in children_data:
            task = get_child_learning_data(child["id"])
            tasks.append(task)
        
        learning_data_list = await asyncio.gather(*tasks, return_exceptions=True)
        logger.info("已並行獲取所有子女的學習資料")
        
        # 整合資料
        enriched_children = []
        for i, child in enumerate(children_data):
            learning_data = learning_data_list[i] if not isinstance(learning_data_list[i], Exception) else {}
            
            if isinstance(learning_data_list[i], Exception):
                logger.error(f"獲取子女 {child['id']} 的學習資料時發生錯誤: {learning_data_list[i]}")

            enriched_child = ChildInfo(
                id=child["id"],
                name=child["name"],
                grade=child.get("grade"),
                class_name=child.get("class_name"),
                student_id=child.get("student_id"),
                avatar=child.get("avatar"),
                created_at=datetime.fromisoformat(child["created_at"]),
                total_exercises=learning_data.get("total_exercises", 0),
                accuracy_rate=learning_data.get("accuracy_rate", 0.0),
                study_days=learning_data.get("study_days", 0),
                overall_progress=learning_data.get("overall_progress", 0.0),
                streak_days=learning_data.get("streak_days", 0),
                total_study_hours=learning_data.get("total_study_hours", 0.0)
            )
            enriched_children.append(enriched_child)
        
        logger.info(f"成功整合 {len(enriched_children)} 個子女的完整資料")
        return enriched_children
        
    except Exception as e:
        logger.error(f"在 get_children 端點處理用戶 {current_user.get('email')} 的請求時發生嚴重錯誤: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"獲取子女列表時發生內部錯誤: {e}"
        )

@app.get("/api/v1/parent/children/{child_id}", response_model=ChildInfo)
async def get_child_details(
    child_id: int,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """獲取特定子女的詳細資訊"""
    try:
        parent_id = current_user["id"]
        children_data = await get_user_children(current_user["token"]) # Pass token here
        
        # 驗證子女是否屬於該家長
        child = next((c for c in children_data if c["id"] == child_id), None)
        if not child:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="子女不存在或無權限訪問"
            )
        
        # 獲取學習資料
        learning_data = await get_child_learning_data(child_id)
        
        # 獲取最近學習活動
        recent_activities = await get_recent_activities(child_id)
        
        enriched_child = ChildInfo(
            id=child["id"],
            name=child["name"],
            grade=child["grade"],
            class_name=child.get("class_name"),
            student_id=child.get("student_id"),
            avatar=child.get("avatar"),
            created_at=datetime.fromisoformat(child["created_at"]),
            total_exercises=learning_data.get("total_exercises", 0),
            accuracy_rate=learning_data.get("accuracy_rate", 0.0),
            study_days=learning_data.get("study_days", 0),
            overall_progress=learning_data.get("overall_progress", 0.0),
            streak_days=learning_data.get("streak_days", 0),
            total_study_hours=learning_data.get("total_study_hours", 0.0)
        )
        
        # 添加最近活動到響應中
        response_data = enriched_child.dict()
        response_data["recent_activities"] = recent_activities
        
        return response_data
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"獲取子女詳細資訊錯誤: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="獲取子女詳細資訊失敗"
        )

@app.get("/api/v1/parent/children/{child_id}/progress", response_model=ChildProgress)
async def get_child_progress(
    child_id: int,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """獲取子女的學習進度"""
    try:
        parent_id = current_user["id"]
        children_data = await get_user_children(current_user["token"]) # Pass token here
        
        # 驗證子女是否屬於該家長
        child = next((c for c in children_data if c["id"] == child_id), None)
        if not child:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="子女不存在或無權限訪問"
            )
        
        # 並行獲取各種資料
        learning_data_task = get_child_learning_data(child_id)
        weaknesses_task = get_child_weakness_analysis(child_id)
        trend_data_task = get_learning_trend(child_id)
        
        learning_data, weaknesses, trend_data = await asyncio.gather(
            learning_data_task, weaknesses_task, trend_data_task,
            return_exceptions=True
        )
        
        # 處理異常
        if isinstance(learning_data, Exception):
            learning_data = {}
        if isinstance(weaknesses, Exception):
            weaknesses = []
        if isinstance(trend_data, Exception):
            trend_data = []
        
        # 構建科目進度資料
        subjects = learning_data.get("subjects", [])
        
        progress_data = ChildProgress(
            child_name=child["name"],
            overall_progress=learning_data.get("overall_progress", 0.0),
            accuracy_rate=learning_data.get("accuracy_rate", 0.0),
            study_days=learning_data.get("study_days", 0),
            streak_days=learning_data.get("streak_days", 0),
            subjects=subjects,
            weaknesses=weaknesses,
            trend_data=trend_data
        )
        
        return progress_data
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"獲取學習進度錯誤: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="獲取學習進度失敗"
        )

@app.get("/api/v1/parent/children/{child_id}/communication-advice", response_model=CommunicationAdvice)
async def get_communication_advice_for_child(
    child_id: int,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """獲取親子溝通建議"""
    try:
        parent_id = current_user["id"]
        children_data = await get_user_children(current_user["token"]) # Pass token here
        
        # 驗證子女是否屬於該家長
        child = next((c for c in children_data if c["id"] == child_id), None)
        if not child:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="子女不存在或無權限訪問"
            )
        
        # 獲取溝通建議
        advice_data = await get_communication_advice(child_id)
        
        if not advice_data:
            # 返回預設建議
            advice_data = {
                "advice_type": "general",
                "title": "一般性溝通建議",
                "content": "建議與孩子保持開放和耐心的溝通態度，關注孩子的學習興趣和困難。",
                "suggested_topics": ["學習興趣", "學習困難", "學習目標"],
                "mood_analysis": {"overall_mood": "neutral", "confidence": 0.5}
            }
        
        communication_advice = CommunicationAdvice(
            child_id=child_id,
            advice_type=advice_data.get("advice_type", "general"),
            title=advice_data.get("title", "溝通建議"),
            content=advice_data.get("content", ""),
            suggested_topics=advice_data.get("suggested_topics", []),
            mood_analysis=advice_data.get("mood_analysis", {}),
            created_at=datetime.now()
        )
        
        return communication_advice
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"獲取溝通建議錯誤: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="獲取溝通建議失敗"
        )

@app.get("/api/v1/parent/dashboard")
async def get_parent_dashboard_data(
    current_user: Dict[str, Any] = Depends(get_current_user),
    token: HTTPAuthorizationCredentials = Depends(security)
):
    """獲取家長儀表板的所有數據"""
    try:
        logger.info(f"用戶 {current_user.get('email')} 正在請求儀表板聚合數據...")

        # 並行執行所有數據獲取任務
        stats_task = get_parent_summary_stats(None, current_user, token)
        children_task = get_children(current_user, token)
        
        # 獲取子女列表以遍歷活動
        children_data = await get_user_children(token.credentials)
        activity_tasks = [get_recent_activities(child['id'], limit=3) for child in children_data]
        
        all_activities_list = await asyncio.gather(*activity_tasks, return_exceptions=True)
        
        # 扁平化並排序活動列表
        recent_activities = []
        for result in all_activities_list:
            if not isinstance(result, Exception):
                recent_activities.extend(result)
        
        # 按時間倒序排序，並只取最新的5條
        recent_activities.sort(key=lambda x: x.get('start_time') or x.get('created_at'), reverse=True)
        recent_activities = recent_activities[:5]

        # 等待統計和子女數據
        stats_data, children_data_for_grid = await asyncio.gather(stats_task, children_task, return_exceptions=True)

        # 處理異常情況
        if isinstance(stats_data, Exception):
            logger.error(f"獲取統計數據時出錯: {stats_data}")
            stats_data = {}
        if isinstance(children_data_for_grid, Exception):
            logger.error(f"獲取子女網格數據時出錯: {children_data_for_grid}")
            children_data_for_grid = []

        dashboard_data = {
            "stats": stats_data,
            "children": children_data_for_grid,
            "activities": recent_activities,
            "notifications": [] # 通知功能暫時返回空列表
        }

        return dashboard_data

    except Exception as e:
        logger.error(f"獲取儀表板聚合數據時發生錯誤: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="無法獲取儀表板數據"
        )

# 輔助函數
async def get_recent_activities(child_id: int, limit: int = 5) -> List[Dict[str, Any]]:
    """獲取子女的最近學習活動"""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{LEARNING_SERVICE_URL}/api/v1/internal/records/user/{child_id}",
                params={"limit": limit, "page": 1}
            )
            
            if response.status_code == 200:
                data = response.json()
                logger.info(f"從 learning-service 收到的原始活動資料: {json.dumps(data, indent=2, ensure_ascii=False)}")
                return data.get("records", [])
            else:
                logger.error(f"從 learning-service 獲取活動失敗 (child_id: {child_id}): {response.status_code}")
                return []
    except Exception as e:
        logger.error(f"獲取最近活動時發生錯誤: {e}", exc_info=True)
        return []

async def get_recent_activities_for_parent(parent_id: int, token: str) -> List[Dict[str, Any]]:
    """獲取家長所有子女的最近活動"""
    try:
        children_data = await get_user_children(token)
        all_activities = []
        
        for child in children_data:
            activities = await get_recent_activities(child["id"])
            for activity in activities:
                activity["child_name"] = child["name"]
                all_activities.append(activity)
        
        # 按時間排序並取前10個
        all_activities.sort(key=lambda x: x.get("created_at", ""), reverse=True)
        return all_activities[:10]
        
    except Exception as e:
        logger.error(f"獲取家長活動錯誤: {e}")
        return []

async def get_learning_trend(child_id: int) -> List[Dict[str, Any]]:
    """獲取學習趨勢資料"""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{LEARNING_SERVICE_URL}/api/v1/learning/students/{child_id}/trend",
                params={"days": 30}
            )
            
            if response.status_code == 200:
                return response.json()
            else:
                return []
    except Exception as e:
        logger.error(f"獲取學習趨勢錯誤: {e}")
        return []

@app.get("/api/v1/parent/children/{child_id}/activities")
async def get_child_recent_activities(
    child_id: int,
    limit: int = 5,
    current_user: Dict[str, Any] = Depends(get_current_user),
    token: HTTPAuthorizationCredentials = Depends(security)
):
    """獲取指定子女的最近學習活動"""
    # 驗證該家長是否對該子女有訪問權限
    children_data = await get_user_children(token.credentials)
    if not any(child['id'] == child_id for child in children_data):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="您無權訪問此子女的資訊"
        )
    
    activities = await get_recent_activities(child_id, limit)
    return activities

@app.get("/api/v1/parent/summary/stats")
async def get_parent_summary_stats(
    child_id: Optional[int] = None,
    current_user: Dict[str, Any] = Depends(get_current_user), 
    token: HTTPAuthorizationCredentials = Depends(security)
):
    """計算並返回該家長所有或特定子女的匯總統計數據"""
    db = SessionLocal()
    try:
        if child_id:
            logger.info(f"用戶 {current_user.get('email')} 正在請求子女 {child_id} 的統計數據...")
            target_user_ids = [child_id]
        else:
            logger.info(f"用戶 {current_user.get('email')} 正在請求所有子女的匯總統計數據...")
            children_data = await get_user_children(token.credentials)
            if not children_data:
                return {"total_study_minutes": 0.0, "total_sessions": 0, "average_score": 0.0}
            target_user_ids = [child['id'] for child in children_data]

        if not target_user_ids:
            return {"total_study_minutes": 0.0, "total_sessions": 0, "average_score": 0.0}

        sql_query = text("""
            SELECT 
                SUM(time_spent) as total_seconds, 
                COUNT(id) as total_sessions,
                AVG(total_score) as average_score
            FROM learning_sessions 
            WHERE user_id = ANY(:user_ids)
        """)
        result = db.execute(sql_query, {"user_ids": target_user_ids}).first()
        
        total_seconds = result.total_seconds or 0
        total_sessions = result.total_sessions or 0
        average_score = result.average_score or 0
        total_minutes = float(total_seconds) / 60.0
        
        logger.info(f"從資料庫計算得出 -> 總秒數: {total_seconds}, 總測驗次數: {total_sessions}, 平均分數: {average_score}")
        return {
            "total_study_minutes": round(total_minutes, 1),
            "total_sessions": total_sessions,
            "average_score": round(float(average_score), 1)
        }

    except Exception as e:
        logger.error(f"查詢匯總統計數據時發生錯誤: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="無法計算匯總統計數據"
        )
    finally:
        db.close()

def generate_alerts(children_data: List[Dict[str, Any]], learning_data_list: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """生成警報"""
    alerts = []
    
    for i, child in enumerate(children_data):
        learning_data = learning_data_list[i] if i < len(learning_data_list) and not isinstance(learning_data_list[i], Exception) else {}
        
        # 檢查學習天數
        study_days = learning_data.get("study_days", 0)
        if study_days == 0:
            alerts.append({
                "type": "warning",
                "title": f"{child['name']} 尚未開始學習",
                "message": "建議鼓勵孩子開始使用學習平台",
                "child_id": child["id"]
            })
        
        # 檢查正確率
        accuracy_rate = learning_data.get("accuracy_rate", 0.0)
        if accuracy_rate < 60.0 and study_days > 0:
            alerts.append({
                "type": "danger",
                "title": f"{child['name']} 學習正確率偏低",
                "message": f"當前正確率為 {accuracy_rate}%，建議加強基礎練習",
                "child_id": child["id"]
            })
        
        # 檢查連續學習天數
        streak_days = learning_data.get("streak_days", 0)
        if streak_days >= 7:
            alerts.append({
                "type": "success",
                "title": f"{child['name']} 連續學習 {streak_days} 天",
                "message": "孩子學習習慣良好，請給予鼓勵",
                "child_id": child["id"]
            })
    
    return alerts

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8005) 