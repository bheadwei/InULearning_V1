from pydantic import BaseModel, Field, validator
from typing import List, Optional, Dict, Any
from datetime import datetime
from enum import Enum


class GradeEnum(str, Enum):
    """年級枚舉"""
    GRADE_7A = "7A"
    GRADE_7B = "7B"
    GRADE_8A = "8A"
    GRADE_8B = "8B"
    GRADE_9A = "9A"
    GRADE_9B = "9B"


class SubjectEnum(str, Enum):
    """科目枚舉"""
    CHINESE = "國文"
    ENGLISH = "英文"
    MATH = "數學"
    SCIENCE = "自然"
    GEOGRAPHY = "地理"
    HISTORY = "歷史"
    CIVICS = "公民"


class PublisherEnum(str, Enum):
    """出版社枚舉"""
    NANI = "南一"
    HANLIN = "翰林"
    KANGXUAN = "康軒"


class DifficultyEnum(str, Enum):
    """難度枚舉"""
    EASY = "easy"
    NORMAL = "normal"
    HARD = "hard"


class QuestionTypeEnum(str, Enum):
    """題型枚舉"""
    MULTIPLE_CHOICE = "multiple_choice"
    FILL_BLANK = "fill_blank"
    SHORT_ANSWER = "short_answer"
    ESSAY = "essay"


class QuestionBase(BaseModel):
    """題目基礎模型"""
    grade: GradeEnum = Field(..., description="年級")
    subject: SubjectEnum = Field(..., description="科目")
    publisher: PublisherEnum = Field(..., description="出版社")
    chapter: str = Field(..., description="章節")
    topic: str = Field(..., description="主題")
    knowledge_point: List[str] = Field(..., description="知識點")
    difficulty: DifficultyEnum = Field(..., description="難度")
    question: str = Field(..., description="題目內容")
    question_type: QuestionTypeEnum = Field(QuestionTypeEnum.MULTIPLE_CHOICE, description="題型")
    options: Optional[Dict[str, str]] = Field(None, description="選項 (A/B/C/D)")
    answer: str = Field(..., description="正確答案")
    explanation: Optional[str] = Field(None, description="解析")
    media_urls: Optional[List[str]] = Field(None, description="媒體檔案URL")
    tags: Optional[List[str]] = Field(None, description="標籤")
    estimated_time: Optional[int] = Field(None, description="預估作答時間(秒)")
    points: Optional[int] = Field(10, description="題目分數")


class QuestionCreate(QuestionBase):
    """創建題目模型"""
    pass


class QuestionUpdate(BaseModel):
    """更新題目模型"""
    grade: Optional[GradeEnum] = None
    subject: Optional[SubjectEnum] = None
    publisher: Optional[PublisherEnum] = None
    chapter: Optional[str] = None
    topic: Optional[str] = None
    knowledge_point: Optional[List[str]] = None
    difficulty: Optional[DifficultyEnum] = None
    question: Optional[str] = None
    question_type: Optional[QuestionTypeEnum] = None
    options: Optional[Dict[str, str]] = None
    answer: Optional[str] = None
    explanation: Optional[str] = None
    media_urls: Optional[List[str]] = None
    tags: Optional[List[str]] = None
    estimated_time: Optional[int] = None
    points: Optional[int] = None


class QuestionResponse(QuestionBase):
    """題目回應模型"""
    id: str = Field(..., description="題目ID")
    created_at: datetime = Field(..., description="創建時間")
    updated_at: datetime = Field(..., description="更新時間")
    
    class Config:
        from_attributes = True


class QuestionSearchCriteria(BaseModel):
    """題目搜尋條件"""
    grade: Optional[GradeEnum] = None
    subject: Optional[SubjectEnum] = None
    publisher: Optional[PublisherEnum] = None
    chapter: Optional[str] = None
    topic: Optional[str] = None
    knowledge_point: Optional[List[str]] = None
    difficulty: Optional[DifficultyEnum] = None
    question_type: Optional[QuestionTypeEnum] = None
    tags: Optional[List[str]] = None
    keyword: Optional[str] = None
    limit: int = Field(20, ge=1, le=100)
    skip: int = Field(0, ge=0)


class ChapterBase(BaseModel):
    """章節基礎模型"""
    publisher: PublisherEnum = Field(..., description="出版社")
    subject: SubjectEnum = Field(..., description="科目")
    grade: GradeEnum = Field(..., description="年級")
    chapter_name: str = Field(..., description="章節名稱")
    chapter_number: str = Field(..., description="章節編號")
    topics: List[str] = Field(..., description="主題列表")
    knowledge_points: List[str] = Field(..., description="知識點列表")


class ChapterCreate(ChapterBase):
    """創建章節模型"""
    pass


class ChapterResponse(ChapterBase):
    """章節回應模型"""
    id: str = Field(..., description="章節ID")
    created_at: datetime = Field(..., description="創建時間")
    updated_at: datetime = Field(..., description="更新時間")
    
    class Config:
        from_attributes = True


class KnowledgePointBase(BaseModel):
    """知識點基礎模型"""
    subject: SubjectEnum = Field(..., description="科目")
    grade: GradeEnum = Field(..., description="年級")
    name: str = Field(..., description="知識點名稱")
    description: Optional[str] = Field(None, description="知識點描述")
    parent_knowledge_point: Optional[str] = Field(None, description="父知識點")
    difficulty_level: DifficultyEnum = Field(DifficultyEnum.NORMAL, description="難度等級")
    tags: Optional[List[str]] = Field(None, description="標籤")


class KnowledgePointCreate(KnowledgePointBase):
    """創建知識點模型"""
    pass


class KnowledgePointResponse(KnowledgePointBase):
    """知識點回應模型"""
    id: str = Field(..., description="知識點ID")
    created_at: datetime = Field(..., description="創建時間")
    updated_at: datetime = Field(..., description="更新時間")
    
    class Config:
        from_attributes = True


class PaginatedResponse(BaseModel):
    """分頁回應模型"""
    items: List[Any] = Field(..., description="項目列表")
    total: int = Field(..., description="總數量")
    page: int = Field(..., description="當前頁碼")
    page_size: int = Field(..., description="每頁數量")
    total_pages: int = Field(..., description="總頁數")


class Message(BaseModel):
    """訊息回應模型"""
    message: str = Field(..., description="訊息內容")


class BulkImportResult(BaseModel):
    """批量匯入結果模型"""
    total_imported: int = Field(..., description="成功匯入數量")
    total_failed: int = Field(..., description="失敗數量")
    errors: List[str] = Field(..., description="錯誤訊息列表") 