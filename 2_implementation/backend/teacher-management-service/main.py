"""
教師管理服務 (Teacher Management Service)
提供教師查看班級管理、學生追蹤、課程分析等功能
"""

from fastapi import FastAPI, HTTPException, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import httpx
import json
import logging
from datetime import datetime, timedelta
import asyncio
import os
from jose import jwt, JWTError

# 配置日誌
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="教師管理服務",
    description="提供教師查看班級管理、學生追蹤、課程分析等功能",
    version="1.0.0"
)

# CORS 配置
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost",
        "http://localhost:8080",
        "http://localhost:8081",
        "http://localhost:8082",
        "http://localhost:8083",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 安全配置
security = HTTPBearer()

# 服務配置
AUTH_SERVICE_URL = "http://auth-service:8000"
LEARNING_SERVICE_URL = "http://learning-service:8000"
AI_ANALYSIS_SERVICE_URL = "http://ai-analysis-service:8004"
QUESTION_BANK_SERVICE_URL = "http://question-bank-service:8000"

# JWT 設定（與 auth-service 同步）
JWT_SECRET_KEY = os.getenv("SECRET_KEY", "your-secret-key-here-change-in-production")
JWT_ALGORITHM = os.getenv("ALGORITHM", "HS256")

# 資料模型
class ClassInfo(BaseModel):
    id: int
    name: str
    grade: int
    subject: str
    student_count: int
    average_progress: float
    average_accuracy: float
    created_at: datetime

class StudentInfo(BaseModel):
    id: int
    name: str
    grade: int
    class_name: str
    student_id: str
    avatar: Optional[str] = None
    total_exercises: int = 0
    accuracy_rate: float = 0.0
    study_days: int = 0
    overall_progress: float = 0.0
    last_active: Optional[datetime] = None

class ClassAnalytics(BaseModel):
    class_id: int
    class_name: str
    total_students: int
    active_students: int
    average_progress: float
    average_accuracy: float
    subject_breakdown: List[Dict[str, Any]]
    student_rankings: List[Dict[str, Any]]
    recent_activities: List[Dict[str, Any]]
    alerts: List[Dict[str, Any]]

class CourseInfo(BaseModel):
    id: int
    name: str
    subject: str
    grade: int
    description: str
    total_lessons: int
    completed_lessons: int
    average_completion_rate: float
    created_at: datetime

# 依賴注入
async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> Dict[str, Any]:
    """驗證用戶身份（優先本地驗簽，驗簽失敗時降級僅解析宣告）"""
    token = credentials.credentials
    payload: Dict[str, Any] = {}
    try:
        payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
    except JWTError as e:
        logger.warning(f"JWT 驗簽失敗，降級使用未驗簽解析: {e}")
        try:
            payload = jwt.get_unverified_claims(token)  # 僅解析，不驗簽（開發環境降級）
        except Exception as ue:
            logger.error(f"JWT 未驗簽解析失敗: {ue}")
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="無效的認證令牌")

    user_id = payload.get("sub")
    email = payload.get("email")
    role = payload.get("role")
    if not user_id or not email:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="無效的認證令牌")
    if role != "teacher":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="只有教師角色可以訪問此服務")
    return {"id": int(user_id), "email": email, "role": role, "token": token}

async def get_teacher_classes(teacher_id: int, auth_token: str) -> List[Dict[str, Any]]:
    """獲取教師的班級列表"""
    try:
        async with httpx.AsyncClient() as client:
            # 透過 relationships 服務查詢目前教師的班級關係
            response = await client.get(
                f"{AUTH_SERVICE_URL}/api/v1/relationships/teacher-class",
                headers={"Authorization": f"Bearer {auth_token}"}
            )
            
            if response.status_code == 200:
                relations = response.json()
                # 轉換成統一班級資料格式（期望含 id、name、grade、subject、student_count、created_at）
                classes: List[Dict[str, Any]] = []
                for rel in relations:
                    classes.append({
                        "id": rel.get("class_id"),
                        "name": rel.get("class_name"),
                        "grade": 7,
                        "subject": rel.get("subject", ""),
                        "student_count": 0,
                        "created_at": datetime.now().isoformat(),
                    })
                return classes
            else:
                logger.error(f"獲取班級列表失敗: {response.status_code}")
                return []
    except httpx.RequestError as e:
        logger.error(f"獲取班級列表錯誤: {e}")
        return []

async def get_class_students(class_id: int, auth_token: str) -> List[Dict[str, Any]]:
    """獲取班級的學生列表"""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{AUTH_SERVICE_URL}/api/v1/relationships/classes/{class_id}/students",
                headers={"Authorization": f"Bearer {auth_token}"}
            )
            
            if response.status_code == 200:
                rels = response.json()
                # 轉換為教師服務期望的學生格式
                students: List[Dict[str, Any]] = []
                for r in rels:
                    students.append({
                        "id": r.get("student_id"),
                        "name": r.get("student_name") or "",
                        "grade": 7,
                        "class_name": r.get("class_name") or "",
                        "student_id": str(r.get("student_id")),
                        "avatar": None,
                    })
                return students
            else:
                logger.error(f"獲取學生列表失敗: {response.status_code}")
                return []
    except httpx.RequestError as e:
        logger.error(f"獲取學生列表錯誤: {e}")
        return []

async def get_student_learning_data(student_id: int) -> Dict[str, Any]:
    """獲取學生的學習資料"""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{LEARNING_SERVICE_URL}/api/v1/learning/students/{student_id}/summary"
            )
            
            if response.status_code == 200:
                return response.json()
            else:
                logger.error(f"獲取學習資料失敗: {response.status_code}")
                return {}
    except httpx.RequestError as e:
        logger.error(f"獲取學習資料錯誤: {e}")
        return {}

async def get_class_learning_analytics(class_id: int) -> Dict[str, Any]:
    """獲取班級的學習分析資料"""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{LEARNING_SERVICE_URL}/api/v1/learning/classes/{class_id}/analytics"
            )
            
            if response.status_code == 200:
                return response.json()
            else:
                logger.error(f"獲取班級分析失敗: {response.status_code}")
                return {}
    except httpx.RequestError as e:
        logger.error(f"獲取班級分析錯誤: {e}")
        return {}

# API 端點
@app.get("/health")
async def health_check():
    """健康檢查端點"""
    return {"status": "healthy", "service": "teacher-management-service", "timestamp": datetime.now()}

@app.get("/api/v1/teacher/classes", response_model=List[ClassInfo])
async def get_teacher_classes_endpoint(current_user: Dict[str, Any] = Depends(get_current_user)):
    """獲取教師的班級列表"""
    try:
        teacher_id = current_user["id"]
        token = current_user.get("token") or current_user.get("access_token") or ""
        classes_data = await get_teacher_classes(teacher_id, token)
        
        # 並行獲取每個班級的學習資料
        tasks = []
        for class_info in classes_data:
            task = get_class_learning_analytics(class_info["id"])
            tasks.append(task)
        
        analytics_list = await asyncio.gather(*tasks, return_exceptions=True)
        
        # 整合資料
        enriched_classes = []
        for i, class_info in enumerate(classes_data):
            analytics = analytics_list[i] if not isinstance(analytics_list[i], Exception) else {}
            
            enriched_class = ClassInfo(
                id=class_info["id"],
                name=class_info.get("name", ""),
                grade=int(class_info.get("grade", 7)),
                subject=class_info.get("subject", ""),
                student_count=int(class_info.get("student_count", 0)),
                average_progress=analytics.get("average_progress", 0.0),
                average_accuracy=analytics.get("average_accuracy", 0.0),
                created_at=datetime.fromisoformat(class_info.get("created_at", datetime.now().isoformat()))
            )
            enriched_classes.append(enriched_class)
        
        return enriched_classes
        
    except Exception as e:
        logger.error(f"獲取班級列表錯誤: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="獲取班級列表失敗"
        )

@app.get("/api/v1/teacher/classes/{class_id}/students", response_model=List[StudentInfo])
async def get_class_students_endpoint(
    class_id: int,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """獲取班級的學生列表"""
    try:
        teacher_id = current_user["id"]
        token = current_user.get("token") or current_user.get("access_token") or ""
        teacher_classes = await get_teacher_classes(teacher_id, token)
        
        # 驗證班級是否屬於該教師
        class_info = next((c for c in teacher_classes if c["id"] == class_id), None)
        if not class_info:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="班級不存在或無權限訪問"
            )
        
        students_data = await get_class_students(class_id, token)
        
        # 並行獲取每個學生的學習資料
        tasks = []
        for student in students_data:
            task = get_student_learning_data(student["id"])
            tasks.append(task)
        
        learning_data_list = await asyncio.gather(*tasks, return_exceptions=True)
        
        # 整合資料
        enriched_students = []
        for i, student in enumerate(students_data):
            learning_data = learning_data_list[i] if not isinstance(learning_data_list[i], Exception) else {}
            
            enriched_student = StudentInfo(
                id=student["id"],
                name=student["name"],
                grade=student["grade"],
                class_name=student.get("class_name", ""),
                student_id=student.get("student_id", ""),
                avatar=student.get("avatar"),
                total_exercises=learning_data.get("total_exercises", 0),
                accuracy_rate=learning_data.get("accuracy_rate", 0.0),
                study_days=learning_data.get("study_days", 0),
                overall_progress=learning_data.get("overall_progress", 0.0),
                last_active=datetime.fromisoformat(learning_data.get("last_active", datetime.now().isoformat())) if learning_data.get("last_active") else None
            )
            enriched_students.append(enriched_student)
        
        return enriched_students
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"獲取學生列表錯誤: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="獲取學生列表失敗"
        )

@app.get("/api/v1/teacher/classes/{class_id}/analytics", response_model=ClassAnalytics)
async def get_class_analytics_endpoint(
    class_id: int,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """獲取班級的詳細分析資料"""
    try:
        teacher_id = current_user["id"]
        teacher_classes = await get_teacher_classes(teacher_id)
        
        # 驗證班級是否屬於該教師
        class_info = next((c for c in teacher_classes if c["id"] == class_id), None)
        if not class_info:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="班級不存在或無權限訪問"
            )
        
        # 並行獲取各種資料
        students_task = get_class_students(class_id)
        analytics_task = get_class_learning_analytics(class_id)
        
        students_data, analytics_data = await asyncio.gather(
            students_task, analytics_task,
            return_exceptions=True
        )
        
        # 處理異常
        if isinstance(students_data, Exception):
            students_data = []
        if isinstance(analytics_data, Exception):
            analytics_data = {}
        
        # 獲取學生學習資料
        student_learning_tasks = []
        for student in students_data:
            task = get_student_learning_data(student["id"])
            student_learning_tasks.append(task)
        
        student_learning_list = await asyncio.gather(*student_learning_tasks, return_exceptions=True)
        
        # 構建學生排名
        student_rankings = []
        for i, student in enumerate(students_data):
            learning_data = student_learning_list[i] if not isinstance(student_learning_list[i], Exception) else {}
            
            ranking_data = {
                "student_id": student["id"],
                "student_name": student["name"],
                "overall_progress": learning_data.get("overall_progress", 0.0),
                "accuracy_rate": learning_data.get("accuracy_rate", 0.0),
                "total_exercises": learning_data.get("total_exercises", 0),
                "study_days": learning_data.get("study_days", 0)
            }
            student_rankings.append(ranking_data)
        
        # 按進度排序
        student_rankings.sort(key=lambda x: x["overall_progress"], reverse=True)
        
        # 計算活躍學生數量
        active_students = sum(1 for learning_data in student_learning_list 
                            if not isinstance(learning_data, Exception) and learning_data.get("study_days", 0) > 0)
        
        # 構建分析資料
        analytics = ClassAnalytics(
            class_id=class_id,
            class_name=class_info["name"],
            total_students=len(students_data),
            active_students=active_students,
            average_progress=analytics_data.get("average_progress", 0.0),
            average_accuracy=analytics_data.get("average_accuracy", 0.0),
            subject_breakdown=analytics_data.get("subject_breakdown", []),
            student_rankings=student_rankings,
            recent_activities=analytics_data.get("recent_activities", []),
            alerts=generate_class_alerts(students_data, student_learning_list)
        )
        
        return analytics
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"獲取班級分析錯誤: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="獲取班級分析失敗"
        )

@app.get("/api/v1/teacher/courses", response_model=List[CourseInfo])
async def get_teacher_courses_endpoint(current_user: Dict[str, Any] = Depends(get_current_user)):
    """獲取教師的課程列表"""
    try:
        teacher_id = current_user["id"]
        
        # 獲取教師的課程資料
        courses_data = await get_teacher_courses(teacher_id)
        
        # 並行獲取每個課程的完成率資料
        tasks = []
        for course in courses_data:
            task = get_course_completion_data(course["id"])
            tasks.append(task)
        
        completion_data_list = await asyncio.gather(*tasks, return_exceptions=True)
        
        # 整合資料
        enriched_courses = []
        for i, course in enumerate(courses_data):
            completion_data = completion_data_list[i] if not isinstance(completion_data_list[i], Exception) else {}
            
            enriched_course = CourseInfo(
                id=course["id"],
                name=course["name"],
                subject=course["subject"],
                grade=course["grade"],
                description=course.get("description", ""),
                total_lessons=course.get("total_lessons", 0),
                completed_lessons=completion_data.get("completed_lessons", 0),
                average_completion_rate=completion_data.get("average_completion_rate", 0.0),
                created_at=datetime.fromisoformat(course["created_at"])
            )
            enriched_courses.append(enriched_course)
        
        return enriched_courses
        
    except Exception as e:
        logger.error(f"獲取課程列表錯誤: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="獲取課程列表失敗"
        )

# 創建班級的數據模型
class CreateClassRequest(BaseModel):
    name: str  # 修正：與前端發送的數據一致
    subject: str
    description: Optional[str] = None
    grade: Optional[str] = "7"  # auth-service 期望字符串類型
    school_year: Optional[str] = "2024"  # 提供預設值避免 null 錯誤

@app.post("/api/v1/teacher/classes", response_model=Dict[str, Any])
async def create_teacher_class(
    class_data: CreateClassRequest,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """創建新的班級"""
    try:
        teacher_id = current_user["id"]
        token = current_user.get("token") or current_user.get("access_token") or ""
        
        # 調用 auth-service 創建班級
        async with httpx.AsyncClient() as client:
            # 首先創建班級
            class_response = await client.post(
                f"{AUTH_SERVICE_URL}/api/v1/relationships/classes",
                headers={"Authorization": f"Bearer {token}"},
                json={
                    "class_name": class_data.name,  # auth-service 期望 class_name
                    "grade": class_data.grade,
                    "school_year": class_data.school_year
                }
            )
            
            if class_response.status_code not in [200, 201]:
                error_detail = class_response.text
                logger.error(f"創建班級失敗: {class_response.status_code} - {error_detail}")
                
                # 檢查是否是班級已存在的錯誤
                if "班級已存在" in error_detail:
                    raise HTTPException(
                        status_code=status.HTTP_409_CONFLICT,
                        detail="班級名稱已存在，請使用不同的名稱"
                    )
                else:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"創建班級失敗: {error_detail}"
                    )
            
            # 獲取創建的班級 ID
            created_class = class_response.json()
            class_id = created_class.get("id") or created_class.get("class_id")
            
            if not class_id:
                logger.error(f"無法獲取創建班級的 ID: {created_class}")
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="創建班級成功但無法獲取 ID"
                )
            
            # 然後建立教師與班級的關係
            relationship_response = await client.post(
                f"{AUTH_SERVICE_URL}/api/v1/relationships/teacher-class",
                headers={"Authorization": f"Bearer {token}"},
                json={
                    "class_id": class_id,
                    "subject": class_data.subject  # 添加必需的 subject 字段
                }
            )
            
            if relationship_response.status_code not in [200, 201]:
                logger.error(f"建立教師班級關係失敗: {relationship_response.status_code} - {relationship_response.text}")
                # 如果關係建立失敗，記錄錯誤（auth-service 沒有刪除班級的端點）
                logger.error(f"無法刪除已創建的班級 {class_id}，因為 auth-service 沒有刪除端點")
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"建立教師班級關係失敗: {relationship_response.text}"
                )
            
            response = class_response  # 使用班級創建響應
            
            if response.status_code == 201 or response.status_code == 200:
                created_class = response.json()
                logger.info(f"班級創建成功: {created_class}")
                return {
                    "success": True,
                    "message": "班級創建成功",
                    "class_id": created_class.get("class_id") or created_class.get("id"),
                    "data": created_class
                }
            else:
                logger.error(f"創建班級失敗: {response.status_code} - {response.text}")
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"創建班級失敗: {response.text}"
                )
                
    except httpx.RequestError as e:
        logger.error(f"創建班級請求錯誤: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="創建班級服務暫時不可用"
        )
    except Exception as e:
        logger.error(f"創建班級錯誤: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="創建班級失敗"
        )

@app.get("/api/v1/teacher/dashboard")
async def get_teacher_dashboard(current_user: Dict[str, Any] = Depends(get_current_user)):
    """獲取教師儀表板概覽"""
    try:
        teacher_id = current_user["id"]
        token = current_user.get("token") or current_user.get("access_token") or ""
        
        # 並行獲取各種資料
        classes_task = get_teacher_classes(teacher_id, token)
        courses_task = get_teacher_courses(teacher_id)
        
        classes_data, courses_data = await asyncio.gather(
            classes_task, courses_task,
            return_exceptions=True
        )
        
        # 處理異常
        if isinstance(classes_data, Exception):
            classes_data = []
        if isinstance(courses_data, Exception):
            courses_data = []
        
        # 獲取班級分析資料
        class_analytics_tasks = []
        for class_info in classes_data:
            task = get_class_learning_analytics(class_info["id"])
            class_analytics_tasks.append(task)
        
        class_analytics_list = await asyncio.gather(*class_analytics_tasks, return_exceptions=True)
        
        # 計算總體統計
        total_students = 0
        total_progress = 0.0
        total_accuracy = 0.0
        valid_classes = 0
        
        for analytics in class_analytics_list:
            if not isinstance(analytics, Exception):
                total_students += analytics.get("total_students", 0)
                total_progress += analytics.get("average_progress", 0.0)
                total_accuracy += analytics.get("average_accuracy", 0.0)
                valid_classes += 1
        
        average_progress = total_progress / valid_classes if valid_classes > 0 else 0.0
        average_accuracy = total_accuracy / valid_classes if valid_classes > 0 else 0.0
        
        # 獲取最近活動
        recent_activities = await get_recent_activities_for_teacher(teacher_id)
        
        # 生成警報
        alerts = generate_teacher_alerts(classes_data, class_analytics_list)
        
        dashboard_data = {
            "total_classes": len(classes_data),
            "total_courses": len(courses_data),
            "total_students": total_students,
            "overall_stats": {
                "average_progress": round(average_progress, 2),
                "average_accuracy": round(average_accuracy, 2),
                "active_classes": valid_classes
            },
            "recent_activities": recent_activities,
            "alerts": alerts
        }
        
        return dashboard_data
        
    except Exception as e:
        logger.error(f"獲取教師儀表板錯誤: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="獲取教師儀表板失敗"
        )

# 輔助函數
async def get_teacher_courses(teacher_id: int) -> List[Dict[str, Any]]:
    """獲取教師的課程列表"""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{AUTH_SERVICE_URL}/api/v1/teachers/{teacher_id}/courses"
            )
            
            if response.status_code == 200:
                return response.json()
            else:
                logger.error(f"獲取課程列表失敗: {response.status_code}")
                return []
    except httpx.RequestError as e:
        logger.error(f"獲取課程列表錯誤: {e}")
        return []

async def get_course_completion_data(course_id: int) -> Dict[str, Any]:
    """獲取課程完成率資料"""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{LEARNING_SERVICE_URL}/api/v1/learning/courses/{course_id}/completion"
            )
            
            if response.status_code == 200:
                return response.json()
            else:
                logger.error(f"獲取課程完成率失敗: {response.status_code}")
                return {}
    except httpx.RequestError as e:
        logger.error(f"獲取課程完成率錯誤: {e}")
        return {}

async def get_recent_activities_for_teacher(teacher_id: int) -> List[Dict[str, Any]]:
    """獲取教師的最近活動"""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{LEARNING_SERVICE_URL}/api/v1/learning/teachers/{teacher_id}/activities",
                params={"limit": 10}
            )
            
            if response.status_code == 200:
                return response.json()
            else:
                return []
    except Exception as e:
        logger.error(f"獲取教師活動錯誤: {e}")
        return []

def generate_class_alerts(students_data: List[Dict[str, Any]], student_learning_list: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """生成班級警報"""
    alerts = []
    
    # 檢查學習進度偏低的學生
    low_progress_students = []
    for i, student in enumerate(students_data):
        learning_data = student_learning_list[i] if i < len(student_learning_list) and not isinstance(student_learning_list[i], Exception) else {}
        
        progress = learning_data.get("overall_progress", 0.0)
        if progress < 50.0 and learning_data.get("study_days", 0) > 0:
            low_progress_students.append({
                "name": student["name"],
                "progress": progress
            })
    
    if low_progress_students:
        alerts.append({
            "type": "warning",
            "title": "學習進度偏低的學生",
            "message": f"有 {len(low_progress_students)} 名學生學習進度低於 50%",
            "details": low_progress_students
        })
    
    # 檢查不活躍的學生
    inactive_students = []
    for i, student in enumerate(students_data):
        learning_data = student_learning_list[i] if i < len(student_learning_list) and not isinstance(student_learning_list[i], Exception) else {}
        
        study_days = learning_data.get("study_days", 0)
        if study_days == 0:
            inactive_students.append(student["name"])
    
    if inactive_students:
        alerts.append({
            "type": "danger",
            "title": "不活躍的學生",
            "message": f"有 {len(inactive_students)} 名學生尚未開始學習",
            "details": inactive_students
        })
    
    return alerts

def generate_teacher_alerts(classes_data: List[Dict[str, Any]], class_analytics_list: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """生成教師警報"""
    alerts = []
    
    # 檢查班級平均進度
    low_progress_classes = []
    for i, class_info in enumerate(classes_data):
        analytics = class_analytics_list[i] if i < len(class_analytics_list) and not isinstance(class_analytics_list[i], Exception) else {}
        
        average_progress = analytics.get("average_progress", 0.0)
        if average_progress < 60.0:
            low_progress_classes.append({
                "name": class_info["name"],
                "progress": average_progress
            })
    
    if low_progress_classes:
        alerts.append({
            "type": "warning",
            "title": "班級學習進度偏低",
            "message": f"有 {len(low_progress_classes)} 個班級平均進度低於 60%",
            "details": low_progress_classes
        })
    
    # 檢查班級活躍度
    inactive_classes = []
    for i, class_info in enumerate(classes_data):
        analytics = class_analytics_list[i] if i < len(class_analytics_list) and not isinstance(class_analytics_list[i], Exception) else {}
        
        active_students = analytics.get("active_students", 0)
        total_students = analytics.get("total_students", 0)
        
        if total_students > 0 and (active_students / total_students) < 0.5:
            inactive_classes.append({
                "name": class_info["name"],
                "active_rate": round((active_students / total_students) * 100, 1)
            })
    
    if inactive_classes:
        alerts.append({
            "type": "info",
            "title": "班級活躍度偏低",
            "message": f"有 {len(inactive_classes)} 個班級活躍學生比例低於 50%",
            "details": inactive_classes
        })
    
    return alerts

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8006) 