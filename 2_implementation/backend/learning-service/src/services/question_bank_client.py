"""
題庫服務客戶端

負責與題庫服務進行通信，獲取題目資訊
"""

import logging
import os
import httpx
from typing import List, Dict, Any, Optional
from urllib.parse import urljoin

logger = logging.getLogger(__name__)


class QuestionBankClient:
    """題庫服務客戶端"""
    
    def __init__(self):
        # 基本位址優先讀取環境變數（容器間通訊使用服務名），並提供本機回退
        self.primary_base_url = os.getenv("QUESTION_BANK_URL", "http://question-bank-service:8002")
        self.fallback_base_urls = [
            self.primary_base_url,
            "http://question-bank-service:8002",
            "http://localhost:8002",
        ]
        self.timeout = 30.0

    def _candidate_urls(self, path: str):
        # 依序嘗試多個 base url，避免容器/本機環境差異導致不可達
        return [urljoin(base, path) for base in self.fallback_base_urls]
    
    async def get_questions_by_criteria(
        self,
        grade: str,
        subject: str,
        publisher: Optional[str] = None,
        chapter: Optional[str] = None,
        difficulty: Optional[str] = None,
        knowledge_points: Optional[List[str]] = None,
        limit: int = 10
    ) -> List[Dict[str, Any]]:
        """根據條件獲取題目"""
        
        try:
            # 構建查詢參數
            params = {
                "grade": grade,
                "subject": subject,
                "limit": limit
            }
            
            if publisher:
                params["publisher"] = publisher
            if chapter:
                params["chapter"] = chapter
            if difficulty:
                params["difficulty"] = difficulty
            if knowledge_points:
                params["knowledge_points"] = ",".join(knowledge_points)
            
            # 發送請求
            paths = self._candidate_urls("/api/v1/questions/search")
            last_exc = None
            for url in paths:
                try:
                    async with httpx.AsyncClient(timeout=self.timeout) as client:
                        response = await client.get(url, params=params)
                        response.raise_for_status()
                        data = response.json()
                        return data.get("items", [])
                except Exception as e:
                    last_exc = e
                    continue
            raise last_exc
                
        except httpx.HTTPStatusError as e:
            logger.error(f"HTTP error when getting questions: {e}")
            raise
        except Exception as e:
            logger.error(f"Error getting questions: {e}")
            raise
    
    async def get_questions_by_ids(self, question_ids: List[str]) -> List[Dict[str, Any]]:
        """根據題目ID獲取題目"""
        
        try:
            # 構建請求體
            payload = {"question_ids": question_ids}
            
            # 發送請求
            paths = self._candidate_urls("/api/v1/questions/batch")
            last_exc = None
            for url in paths:
                try:
                    async with httpx.AsyncClient(timeout=self.timeout) as client:
                        response = await client.post(url, json=payload)
                        response.raise_for_status()
                        data = response.json()
                        if isinstance(data, list):
                            return data
                        return data.get("questions", [])
                except Exception as e:
                    last_exc = e
                    continue
            raise last_exc
                
        except httpx.HTTPStatusError as e:
            logger.error(f"HTTP error when getting questions by IDs: {e}")
            raise
        except Exception as e:
            logger.error(f"Error getting questions by IDs: {e}")
            raise
    
    async def get_random_questions(
        self,
        grade: str,
        subject: str,
        count: int = 10,
        exclude_ids: Optional[List[str]] = None
    ) -> List[Dict[str, Any]]:
        """獲取隨機題目"""
        
        try:
            # 構建查詢參數
            params = {
                "grade": grade,
                "subject": subject,
                "count": count
            }
            
            if exclude_ids:
                params["exclude_ids"] = ",".join(exclude_ids)
            
            # 發送請求
            paths = self._candidate_urls("/api/v1/questions/random")
            last_exc = None
            for url in paths:
                try:
                    async with httpx.AsyncClient(timeout=self.timeout) as client:
                        response = await client.get(url, params=params)
                        response.raise_for_status()
                        return response.json()
                except Exception as e:
                    last_exc = e
                    continue
            raise last_exc
                
        except httpx.HTTPStatusError as e:
            logger.error(f"HTTP error when getting random questions: {e}")
            raise
        except Exception as e:
            logger.error(f"Error getting random questions: {e}")
            raise
    
    async def get_question_statistics(
        self,
        grade: str,
        subject: str,
        publisher: Optional[str] = None
    ) -> Dict[str, Any]:
        """獲取題目統計資訊"""
        
        try:
            # 構建查詢參數
            params = {
                "grade": grade,
                "subject": subject
            }
            
            if publisher:
                params["publisher"] = publisher
            
            # 發送請求
            paths = self._candidate_urls("/api/v1/questions/statistics")
            last_exc = None
            for url in paths:
                try:
                    async with httpx.AsyncClient(timeout=self.timeout) as client:
                        response = await client.get(url, params=params)
                        response.raise_for_status()
                        return response.json()
                except Exception as e:
                    last_exc = e
                    continue
            raise last_exc
                
        except httpx.HTTPStatusError as e:
            logger.error(f"HTTP error when getting question statistics: {e}")
            raise
        except Exception as e:
            logger.error(f"Error getting question statistics: {e}")
            raise

    async def get_questions_by_criteria_excluding(
        self,
        grade: str,
        subject: str,
        publisher: str,
        chapter: Optional[str],
        limit: int,
        exclude_ids: List[str],
        exclude_contents: Optional[List[str]] = None
    ) -> List[Dict[str, Any]]:
        """題庫根據條件出題並使用 $nin 排除。"""
        try:
            paths = self._candidate_urls("/api/v1/questions/criteria-excluding")
            payload = {
                "grade": grade,
                "subject": subject,
                "publisher": publisher,
                "chapter": chapter,
                "limit": limit,
                "exclude_ids": exclude_ids or [],
                "exclude_contents": exclude_contents or []
            }
            last_exc = None
            for url in paths:
                try:
                    async with httpx.AsyncClient(timeout=self.timeout) as client:
                        response = await client.post(url, json=payload)
                        response.raise_for_status()
                        data = response.json()
                        return data if isinstance(data, list) else data.get("data", [])
                except Exception as e:
                    last_exc = e
                    continue
            raise last_exc
        except httpx.HTTPStatusError as e:
            logger.error(f"HTTP error when criteria-excluding: {e}")
            raise
        except Exception as e:
            # 題庫服務不可用時，不阻斷流程，回傳空陣列讓上層啟用 fallback
            logger.error(f"Error criteria-excluding: {e}")
            return []
    async def check_question_count(
        self,
        grade: str,
        subject: str,
        publisher: str,
        chapter: Optional[str] = None
    ) -> int:
        """查詢符合條件的題目總數（代理 /api/v1/questions/check）。"""
        try:
            params = {
                "grade": grade,
                "edition": publisher,  # 題庫服務接口使用 edition
                "subject": subject
            }
            if chapter:
                params["chapter"] = chapter
            paths = self._candidate_urls("/api/v1/questions/check")
            last_exc = None
            for url in paths:
                try:
                    async with httpx.AsyncClient(timeout=self.timeout) as client:
                        response = await client.get(url, params=params)
                        response.raise_for_status()
                        data = response.json()
                        if isinstance(data, dict) and data.get("success") and isinstance(data.get("data"), dict):
                            return int(data["data"].get("count", 0))
                        return int(data.get("count", 0)) if isinstance(data, dict) else 0
                except Exception as e:
                    last_exc = e
                    continue
            raise last_exc
        except httpx.HTTPStatusError as e:
            logger.error(f"HTTP error when checking question count: {e}")
            raise
        except Exception as e:
            logger.error(f"Error checking question count: {e}")
            raise
    
    async def health_check(self) -> bool:
        """健康檢查"""
        
        try:
            url = urljoin(self.base_url, "/health")
            
            async with httpx.AsyncClient(timeout=5.0) as client:
                response = await client.get(url)
                return response.status_code == 200
                
        except Exception as e:
            logger.error(f"Health check failed: {e}")
            return False 

    async def get_questions_by_conditions_simple(
        self,
        grade: str,
        publisher: str,
        subject: str,
        chapter: Optional[str],
        question_count: int
    ) -> List[Dict[str, Any]]:
        """呼叫題庫 /questions/by-conditions 取得題目（已是前端使用的格式）。"""
        try:
            params = {
                "grade": grade,
                "edition": publisher,
                "subject": subject,
                "questionCount": question_count,
            }
            if chapter:
                params["chapter"] = chapter

            paths = self._candidate_urls("/api/v1/questions/by-conditions")
            last_exc = None
            for url in paths:
                try:
                    async with httpx.AsyncClient(timeout=self.timeout) as client:
                        response = await client.get(url, params=params)
                        response.raise_for_status()
                        data = response.json()
                        if isinstance(data, dict) and data.get("success"):
                            return data.get("data", [])
                        # 若結構非預期，嘗試容錯
                        return data.get("data", []) if isinstance(data, dict) else []
                except Exception as e:
                    last_exc = e
                    continue
            raise last_exc
        except Exception as e:
            logger.error(f"Error getting questions by conditions: {e}")
            return []