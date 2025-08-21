from typing import List, Optional, Dict, Any
from datetime import datetime
from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorCollection
from app.schemas import (
    QuestionCreate, QuestionUpdate, QuestionSearchCriteria,
    ChapterCreate, KnowledgePointCreate
)
from app.database import DatabaseManager


class QuestionCRUD:
    """題目 CRUD 操作"""
    
    @staticmethod
    def _transform_question_data(question: Dict[str, Any]) -> Dict[str, Any]:
        """轉換數據庫數據格式以匹配API模型"""
        # 基本字段轉換
        question["id"] = str(question["_id"])
        del question["_id"]
        
        # 字段名稱轉換
        if "content" in question:
            question["question"] = question["content"]
            del question["content"]
        
        if "correct_answer" in question:
            question["answer"] = question["correct_answer"]
            del question["correct_answer"]
        
        if "knowledge_points" in question:
            question["knowledge_point"] = question["knowledge_points"]
            del question["knowledge_points"]
        
        # 枚舉值轉換
        difficulty_map = {
            "簡單": "easy",
            "中等": "normal", 
            "困難": "hard"
        }
        if question.get("difficulty") in difficulty_map:
            question["difficulty"] = difficulty_map[question["difficulty"]]
        
        # 科目轉換（處理未分類的情況）
        subject_map = {
            "未分類": "自然"  # 將未分類映射到自然科
        }
        if question.get("subject") in subject_map:
            question["subject"] = subject_map[question["subject"]]
        
        # 年級轉換（處理國中的情況）
        grade_map = {
            "國中": "7A"  # 將國中映射到7A
        }
        if question.get("grade") in grade_map:
            question["grade"] = grade_map[question["grade"]]
        
        # 出版社轉換（處理other的情況）
        publisher_map = {
            "other": "康軒"  # 將other映射到康軒
        }
        if question.get("publisher") in publisher_map:
            question["publisher"] = publisher_map[question["publisher"]]
        
        question_type_map = {
            "選擇題": "multiple_choice",
            "填空題": "fill_blank",
            "簡答題": "short_answer",
            "論述題": "essay"
        }
        if question.get("question_type") in question_type_map:
            question["question_type"] = question_type_map[question["question_type"]]
        
        # 選項格式轉換 (列表 -> 字典)
        if "options" in question and isinstance(question["options"], list):
            options_dict = {}
            for i, option in enumerate(question["options"]):
                options_dict[chr(65 + i)] = option  # A, B, C, D...
            question["options"] = options_dict
        
        # 時間字段處理
        if question.get("created_at") is None:
            question["created_at"] = datetime.now()
        if question.get("updated_at") is None:
            question["updated_at"] = datetime.now()
        
        return question
    
    @staticmethod
    async def create_question(db: DatabaseManager, question: QuestionCreate) -> str:
        """創建題目"""
        collection = await db.get_questions_collection()
        
        question_data = question.dict()
        question_data["created_at"] = datetime.utcnow()
        question_data["updated_at"] = datetime.utcnow()
        
        result = await collection.insert_one(question_data)
        return str(result.inserted_id)
    
    @staticmethod
    async def get_question_by_id(db: DatabaseManager, question_id: str) -> Optional[Dict[str, Any]]:
        """根據ID獲取題目"""
        collection = await db.get_questions_collection()
        
        try:
            question = await collection.find_one({"_id": ObjectId(question_id)})
            if question:
                question["id"] = str(question["_id"])
                del question["_id"]
            return question
        except:
            return None
    
    @staticmethod
    async def update_question(db: DatabaseManager, question_id: str, question_update: QuestionUpdate) -> bool:
        """更新題目"""
        collection = await db.get_questions_collection()
        
        update_data = question_update.dict(exclude_unset=True)
        update_data["updated_at"] = datetime.utcnow()
        
        try:
            result = await collection.update_one(
                {"_id": ObjectId(question_id)},
                {"$set": update_data}
            )
            return result.modified_count > 0
        except:
            return False
    
    @staticmethod
    async def delete_question(db: DatabaseManager, question_id: str) -> bool:
        """刪除題目"""
        collection = await db.get_questions_collection()
        
        try:
            result = await collection.delete_one({"_id": ObjectId(question_id)})
            return result.deleted_count > 0
        except:
            return False
    
    @staticmethod
    async def search_questions(db: DatabaseManager, criteria: QuestionSearchCriteria) -> Dict[str, Any]:
        """搜尋題目"""
        collection = await db.get_questions_collection()
        
        # 構建查詢條件
        query = {}
        
        if criteria.grade:
            query["grade"] = criteria.grade
        if criteria.subject:
            query["subject"] = criteria.subject
        if criteria.publisher:
            query["publisher"] = criteria.publisher
        if criteria.chapter:
            query["chapter"] = {"$regex": criteria.chapter, "$options": "i"}
        if criteria.topic:
            query["topic"] = {"$regex": criteria.topic, "$options": "i"}
        if criteria.knowledge_point:
            query["knowledge_points"] = {"$in": criteria.knowledge_point}
        if criteria.difficulty:
            query["difficulty"] = criteria.difficulty
        if criteria.question_type:
            query["question_type"] = criteria.question_type
        if criteria.tags:
            query["tags"] = {"$in": criteria.tags}
        if criteria.keyword:
            query["$or"] = [
                {"content": {"$regex": criteria.keyword, "$options": "i"}},
                {"explanation": {"$regex": criteria.keyword, "$options": "i"}},
                {"topic": {"$regex": criteria.keyword, "$options": "i"}}
            ]
        
        # 執行查詢
        print(f"🔍 MongoDB查詢條件: {query}")
        total = await collection.count_documents(query)
        print(f"📊 找到 {total} 個結果")
        cursor = collection.find(query).skip(criteria.skip).limit(criteria.limit)
        
        questions = []
        async for question in cursor:
            # 轉換數據格式以匹配API模型
            question = QuestionCRUD._transform_question_data(question)
            questions.append(question)
        
        return {
            "questions": questions,
            "total": total,
            "skip": criteria.skip,
            "limit": criteria.limit
        }
    
    @staticmethod
    async def get_random_questions(
        db: DatabaseManager,
        grade: str,
        subject: str,
        publisher: str,
        count: int = 10,
        exclude_ids: Optional[List[str]] = None
    ) -> List[Dict[str, Any]]:
        """隨機獲取題目"""
        collection = await db.get_questions_collection()
        
        query = {
            "grade": grade,
            "subject": subject,
            "publisher": publisher
        }
        
        if exclude_ids:
            exclude_object_ids = [ObjectId(qid) for qid in exclude_ids]
            query["_id"] = {"$nin": exclude_object_ids}
        
        # 使用聚合管道隨機選擇
        pipeline = [
            {"$match": query},
            {"$sample": {"size": count}}
        ]
        
        questions = []
        async for question in collection.aggregate(pipeline):
            question["id"] = str(question["_id"])
            del question["_id"]
            questions.append(question)
        
        return questions

    @staticmethod
    async def get_random_questions_flexible(
        db: DatabaseManager,
        count: int = 10,
        subject: Optional[str] = None,
        grade: Optional[str] = None,
        difficulty: Optional[str] = None,
        question_type: Optional[str] = None,
        exclude_ids: Optional[List[str]] = None
    ) -> List[Dict[str, Any]]:
        """靈活的隨機獲取題目"""
        collection = await db.get_questions_collection()
        
        # 構建查詢條件
        query = {}
        if subject:
            query["subject"] = subject
        if grade:
            query["grade"] = grade
        if difficulty:
            query["difficulty"] = difficulty
        if question_type:
            query["question_type"] = question_type
            
        if exclude_ids:
            exclude_object_ids = [ObjectId(qid) for qid in exclude_ids]
            query["_id"] = {"$nin": exclude_object_ids}
        
        # 使用聚合管道隨機選擇
        pipeline = [
            {"$match": query},
            {"$sample": {"size": count}}
        ]
        
        questions = []
        async for question in collection.aggregate(pipeline):
            # 轉換數據格式以匹配API模型
            question = QuestionCRUD._transform_question_data(question)
            questions.append(question)
        
        return questions
    
    @staticmethod
    async def get_questions_by_criteria(
        db: DatabaseManager,
        grade: str,
        subject: str,
        publisher: str,
        chapter: Optional[str] = None,
        difficulty: Optional[str] = None,
        knowledge_points: Optional[List[str]] = None,
        limit: int = 10
    ) -> List[Dict[str, Any]]:
        """根據條件獲取題目"""
        collection = await db.get_questions_collection()
        
        query = {
            "grade": grade,
            "subject": subject,
            "publisher": publisher
        }
        
        if chapter:
            query["chapter"] = chapter
        if difficulty:
            query["difficulty"] = difficulty
        if knowledge_points:
            query["knowledge_points"] = {"$in": knowledge_points}
        
        cursor = collection.find(query).limit(limit)
        
        questions = []
        async for question in cursor:
            # 字段映射：資料庫字段 -> API 模型字段
            mapped_question = {
                "id": str(question["_id"]),
                "grade": question.get("grade"),
                "subject": question.get("subject"),
                "publisher": question.get("publisher"),
                "chapter": question.get("chapter"),
                "topic": question.get("topic", ""),
                "knowledge_point": question.get("knowledge_points", []),  # 映射字段名
                "difficulty": QuestionCRUD._map_difficulty(question.get("difficulty", "normal")),  # 映射難度值
                "question": question.get("content", ""),  # 映射字段名
                "question_type": QuestionCRUD._map_question_type(question.get("question_type", "multiple_choice")),  # 映射題型
                "options": QuestionCRUD._map_options(question.get("options", [])),  # 映射選項格式
                "answer": question.get("correct_answer", ""),  # 映射字段名
                "explanation": question.get("explanation", ""),
                "created_at": question.get("created_at") or datetime.utcnow(),
                "updated_at": question.get("updated_at") or datetime.utcnow()
            }
            questions.append(mapped_question)
        
        return questions
    
    @staticmethod
    def _map_difficulty(difficulty: str) -> str:
        """映射難度值"""
        difficulty_map = {
            "簡單": "easy",
            "普通": "normal", 
            "困難": "hard",
            "easy": "easy",
            "normal": "normal",
            "hard": "hard"
        }
        return difficulty_map.get(difficulty, "normal")
    
    @staticmethod
    def _map_question_type(question_type: str) -> str:
        """映射題型值"""
        type_map = {
            "選擇題": "multiple_choice",
            "填空題": "fill_blank",
            "簡答題": "short_answer",
            "問答題": "essay",
            "multiple_choice": "multiple_choice",
            "fill_blank": "fill_blank",
            "short_answer": "short_answer",
            "essay": "essay"
        }
        return type_map.get(question_type, "multiple_choice")
    
    @staticmethod
    def _map_options(options) -> Dict[str, str]:
        """映射選項格式"""
        if isinstance(options, dict):
            return options
        elif isinstance(options, list):
            # 將陣列轉換為字典格式 A, B, C, D
            option_dict = {}
            labels = ['A', 'B', 'C', 'D', 'E', 'F']
            for i, option in enumerate(options[:len(labels)]):
                option_dict[labels[i]] = str(option)
            return option_dict
        else:
            return {}


class ChapterCRUD:
    """章節 CRUD 操作"""
    
    @staticmethod
    async def create_chapter(db: DatabaseManager, chapter: ChapterCreate) -> str:
        """創建章節"""
        collection = await db.get_chapters_collection()
        
        chapter_data = chapter.dict()
        chapter_data["created_at"] = datetime.utcnow()
        chapter_data["updated_at"] = datetime.utcnow()
        
        result = await collection.insert_one(chapter_data)
        return str(result.inserted_id)
    
    @staticmethod
    async def get_chapters_by_subject_grade(
        db: DatabaseManager,
        subject: str,
        grade: str,
        publisher: str
    ) -> List[Dict[str, Any]]:
        """根據科目年級獲取章節"""
        collection = await db.get_chapters_collection()
        
        query = {
            "subject": subject,
            "grade": grade,
            "publisher": publisher
        }
        
        cursor = collection.find(query).sort("order", 1)
        
        chapters = []
        async for chapter in cursor:
            chapter["id"] = str(chapter["_id"])
            del chapter["_id"]
            chapters.append(chapter)
        
        return chapters

    @staticmethod
    async def get_all_chapters(db: DatabaseManager) -> List[Dict[str, Any]]:
        """獲取所有章節列表"""
        collection = await db.get_chapters_collection()
        
        cursor = collection.find({}).sort([("publisher", 1), ("subject", 1), ("grade", 1), ("order", 1)])
        chapters = []
        
        async for chapter in cursor:
            chapter["id"] = str(chapter["_id"])
            del chapter["_id"]
            chapters.append(chapter)
        
        return chapters


class KnowledgePointCRUD:
    """知識點 CRUD 操作"""
    
    @staticmethod
    async def create_knowledge_point(db: DatabaseManager, knowledge_point: KnowledgePointCreate) -> str:
        """創建知識點"""
        collection = await db.get_knowledge_points_collection()
        
        knowledge_point_data = knowledge_point.dict()
        knowledge_point_data["created_at"] = datetime.utcnow()
        knowledge_point_data["updated_at"] = datetime.utcnow()
        
        result = await collection.insert_one(knowledge_point_data)
        return str(result.inserted_id)
    
    @staticmethod
    async def get_knowledge_points_by_subject_grade(
        db: DatabaseManager,
        subject: str,
        grade: str
    ) -> List[Dict[str, Any]]:
        """根據科目年級獲取知識點"""
        collection = await db.get_knowledge_points_collection()
        
        query = {
            "subject": subject,
            "grade": grade
        }
        
        cursor = collection.find(query).sort("name", 1)
        
        knowledge_points = []
        async for knowledge_point in cursor:
            knowledge_point["id"] = str(knowledge_point["_id"])
            del knowledge_point["_id"]
            knowledge_points.append(knowledge_point)
        
        return knowledge_points 