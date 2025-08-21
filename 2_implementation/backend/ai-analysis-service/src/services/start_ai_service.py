#!/usr/bin/env python3
"""
簡化的 AI 服務啟動腳本

這個腳本提供一個簡單的 FastAPI 服務，直接整合 Gemini API，
不需要複雜的依賴項，只需要基本的 FastAPI 和 Gemini API。
"""

import os
import sys
import json
import uuid
import time
from typing import Dict, Any, Optional, List
from enum import Enum
from dotenv import load_dotenv
import datetime
from concurrent.futures import ThreadPoolExecutor

# 載入環境變數
load_dotenv()

# 添加專案路徑
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# Mock 設定（需在導入 Gemini 前讀取）
AI_ANALYSIS_MOCK = os.getenv("AI_ANALYSIS_MOCK", "0") == "1"

if not AI_ANALYSIS_MOCK:
    try:
        from gemini_api import student_learning_evaluation, solution_guidance
        GEMINI_AVAILABLE = True
    except ImportError as e:
        print(f"警告: 無法導入 Gemini API: {e}")
        GEMINI_AVAILABLE = False
else:
    GEMINI_AVAILABLE = True

try:
    import psycopg2
    import psycopg2.extras
    PSYCOPG2_AVAILABLE = True
except ImportError as e:
    print(f"錯誤: 缺少資料庫套件: {e}")
    print("請執行: pip install psycopg2-binary")
    PSYCOPG2_AVAILABLE = False

try:
    from fastapi import FastAPI, HTTPException
    from fastapi.middleware.cors import CORSMiddleware
    from pydantic import BaseModel
    import uvicorn
except ImportError as e:
    print(f"錯誤: 缺少必要套件: {e}")
    print("請執行: pip install fastapi uvicorn pydantic")
    sys.exit(1)

# Redis 客戶端
try:
    import redis
    REDIS_AVAILABLE = True
except ImportError as e:
    print(f"警告: 缺少 Redis 套件: {e}")
    print("請執行: pip install redis")
    REDIS_AVAILABLE = False

# RQ（可選）
try:
    import rq
    RQ_AVAILABLE = True
except Exception as e:
    RQ_AVAILABLE = False

# 創建 FastAPI 應用
app = FastAPI(
    title="InULearning AI Service",
    description="簡化的 AI 分析服務，整合 Gemini API",
    version="1.0.0"
)

# 配置 CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 啟動時檢查資料表是否存在（不再主動建表，改由 SQL 初始化/遷移管理）
@app.on_event("startup")
async def on_startup():
    if PSYCOPG2_AVAILABLE:
        try:
            # 檢查資料表存在性
            conn = get_db_connection()
            with conn.cursor() as cur:
                cur.execute("""
                    SELECT 1
                    FROM information_schema.tables
                    WHERE table_schema = 'public' AND table_name = 'ai_analysis_results'
                    LIMIT 1
                """)
                _ = cur.fetchone()
                # 若表存在，確保必要欄位存在
                cur.execute(
                    """
                    DO $$
                    BEGIN
                        IF EXISTS (
                            SELECT 1 FROM information_schema.tables
                            WHERE table_schema='public' AND table_name='ai_analysis_results'
                        ) THEN
                            IF NOT EXISTS (
                                SELECT 1 FROM information_schema.columns
                                WHERE table_schema='public' AND table_name='ai_analysis_results' AND column_name='weakness_analysis'
                            ) THEN
                                ALTER TABLE ai_analysis_results ADD COLUMN weakness_analysis TEXT NULL;
                            END IF;
                            IF NOT EXISTS (
                                SELECT 1 FROM information_schema.columns
                                WHERE table_schema='public' AND table_name='ai_analysis_results' AND column_name='learning_guidance'
                            ) THEN
                                ALTER TABLE ai_analysis_results ADD COLUMN learning_guidance TEXT NULL;
                            END IF;
                        END IF;
                    END $$;
                    """
                )
            conn.close()
        except Exception as e:
            print(f"啟動檢查 ai_analysis_results 存在性失敗: {e}")

    # 檢查 Redis 連線
    if REDIS_AVAILABLE:
        try:
            _ = get_redis_client().ping()
        except Exception as e:
            print(f"啟動檢查 Redis 連線失敗: {e}")

    # 偵測 JSONB 欄位是否可用（最後執行，避免阻斷啟動）
    try:
        global JSONB_COLUMNS_AVAILABLE
        JSONB_COLUMNS_AVAILABLE = detect_jsonb_columns()
        print(f"JSONB columns available: {JSONB_COLUMNS_AVAILABLE}")
    except Exception:
        pass

# 請求模型
class AIAnalysisRequest(BaseModel):
    question: Dict[str, Any]
    student_answer: str
    temperature: float = 1.0
    max_output_tokens: int = 512
    exercise_record_id: Optional[str] = None

# 回應模型
class AIAnalysisResponse(BaseModel):
    success: bool
    data: Dict[str, Any]
    message: str
    task_id: Optional[str] = None

# 觸發 AI 分析請求模型（使用 exercise_record_id 作為來源）
class AIAnalysisTriggerRequest(BaseModel):
    exercise_record_id: str

    def normalized_uuid(self) -> str:
        try:
            return str(uuid.UUID(self.exercise_record_id))
        except Exception:
            raise HTTPException(status_code=400, detail="exercise_record_id 需為有效的 UUID")

# AI 任務狀態回應
class AIAnalysisTaskStatus(BaseModel):
    success: bool
    status: str
    data: Optional[Dict[str, Any]] = None
    message: str

# 讀取 DB 連線設定
POSTGRES_HOST = os.getenv("POSTGRES_HOST", "postgres")
POSTGRES_PORT = int(os.getenv("POSTGRES_PORT", "5432"))
POSTGRES_USER = os.getenv("POSTGRES_USER", "aipe-tester")
POSTGRES_PASSWORD = os.getenv("POSTGRES_PASSWORD", "aipe-tester")
POSTGRES_DB = os.getenv("POSTGRES_DB", "inulearning")


# Redis 設定
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
AI_CACHE_TTL_SECONDS = int(os.getenv("AI_CACHE_TTL_SECONDS", str(7 * 24 * 60 * 60)))
AI_CACHE_PREFIX = os.getenv("AI_CACHE_PREFIX", "ai:v1:")

# 是否可用 JSONB 欄位（啟動時偵測）
JSONB_COLUMNS_AVAILABLE: bool = False

# 併發執行緒池（Phase 1：限制同時 3 條，可由環境變數覆寫）
AI_MAX_CONCURRENCY = int(os.getenv("AI_MAX_CONCURRENCY", "3"))
TASK_EXECUTOR = ThreadPoolExecutor(max_workers=AI_MAX_CONCURRENCY)

# 速率限制（Phase 2）：每秒最大外部呼叫數
AI_RATE_LIMIT_RPS = int(os.getenv("AI_RATE_LIMIT_RPS", "2"))

# 去重鎖 TTL（秒）
AI_DEDUP_LOCK_TTL = int(os.getenv("AI_DEDUP_LOCK_TTL", "300"))

# 重試設定（次數與指數退避起始秒）
AI_RETRY_MAX_ATTEMPTS = int(os.getenv("AI_RETRY_MAX_ATTEMPTS", "2"))
AI_RETRY_BACKOFF_SECONDS = float(os.getenv("AI_RETRY_BACKOFF_SECONDS", "2"))
AI_PREWARM_DEFAULT_NEXT_N = int(os.getenv("AI_PREWARM_DEFAULT_NEXT_N", "5"))

# RQ 設定（Phase 4）
AI_USE_RQ = os.getenv("AI_USE_RQ", "0") == "1"
AI_RQ_QUEUE_NAME = os.getenv("AI_RQ_QUEUE_NAME", "ai-analysis")
AI_JOB_TIMEOUT_SECONDS = int(os.getenv("AI_JOB_TIMEOUT_SECONDS", "900"))  # 15 分鐘

# 本機記憶體狀態（無 Redis 時候的保底方案）
_LOCAL_RATE_STATE = {"sec": 0, "count": 0}
_LOCAL_LOCKED_RECORDS = set()
from threading import Lock
_LOCAL_RATE_LOCK = Lock()
_LOCAL_RECORD_LOCK = Lock()


def _rate_limit_token():
    """簡單 RPS 速率限制：優先使用 Redis；若無則使用本機記憶體。"""
    if AI_RATE_LIMIT_RPS <= 0:
        return
    now_sec = int(time.time())
    if REDIS_AVAILABLE:
        try:
            client = get_redis_client()
            key = f"{AI_CACHE_PREFIX}rl:gemini:{now_sec}"
            current = client.incr(key)
            if current == 1:
                client.expire(key, 1)
            if current > AI_RATE_LIMIT_RPS:
                # 等待下一秒
                sleep_time = (now_sec + 1) - time.time()
                if sleep_time > 0:
                    time.sleep(sleep_time)
                return
        except Exception:
            # 回退到本機
            pass

    # 本機回退
    with _LOCAL_RATE_LOCK:
        state = _LOCAL_RATE_STATE
        if state["sec"] != now_sec:
            state["sec"] = now_sec
            state["count"] = 0
        if state["count"] >= AI_RATE_LIMIT_RPS:
            sleep_time = (now_sec + 1) - time.time()
            if sleep_time > 0:
                time.sleep(sleep_time)
            state["sec"] = int(time.time())
            state["count"] = 0
        state["count"] += 1


def _acquire_record_lock(exercise_record_id: str) -> bool:
    """取得去重鎖，避免同一 record 被重複排程。"""
    if REDIS_AVAILABLE:
        try:
            client = get_redis_client()
            key = f"{AI_CACHE_PREFIX}analysis:lock:{exercise_record_id}"
            # nx: 僅在不存在時設定，ex: 過期秒數
            ok = client.set(key, "1", nx=True, ex=AI_DEDUP_LOCK_TTL)
            return bool(ok)
        except Exception:
            pass
    # 本機回退
    with _LOCAL_RECORD_LOCK:
        if exercise_record_id in _LOCAL_LOCKED_RECORDS:
            return False
        _LOCAL_LOCKED_RECORDS.add(exercise_record_id)
        return True


def _release_record_lock(exercise_record_id: str):
    if REDIS_AVAILABLE:
        try:
            client = get_redis_client()
            key = f"{AI_CACHE_PREFIX}analysis:lock:{exercise_record_id}"
            client.delete(key)
        except Exception:
            pass
    with _LOCAL_RECORD_LOCK:
        if exercise_record_id in _LOCAL_LOCKED_RECORDS:
            _LOCAL_LOCKED_RECORDS.discard(exercise_record_id)


def detect_jsonb_columns() -> bool:
    """偵測 ai_analysis_results 是否存在 JSONB 欄位。"""
    if not PSYCOPG2_AVAILABLE:
        return False
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT COUNT(*)
                FROM information_schema.columns
                WHERE table_schema='public' AND table_name='ai_analysis_results'
                  AND column_name IN ('weakness_analysis_json','learning_guidance_json')
                """
            )
            cnt = cur.fetchone()[0]
            return cnt >= 2
    except Exception:
        return False
    finally:
        conn.close()


def get_db_connection():
    if not PSYCOPG2_AVAILABLE:
        raise RuntimeError("psycopg2 未安裝，無法連接資料庫")
    return psycopg2.connect(
        host=POSTGRES_HOST,
        port=POSTGRES_PORT,
        user=POSTGRES_USER,
        password=POSTGRES_PASSWORD,
        dbname=POSTGRES_DB
    )


def get_redis_client():
    if not REDIS_AVAILABLE:
        raise RuntimeError("redis 套件未安裝，無法使用快取")
    return redis.Redis.from_url(REDIS_URL, decode_responses=True)


def _now_iso() -> str:
    return datetime.datetime.utcnow().replace(tzinfo=datetime.timezone.utc).isoformat()


def cache_set_task(task_id: str, exercise_record_id: str, status: str, weakness: Optional[str] = None, guidance: Optional[str] = None, error: Optional[str] = None):
    if not REDIS_AVAILABLE:
        return
    try:
        client = get_redis_client()
        key = f"{AI_CACHE_PREFIX}analysis:task:{task_id}"
        value = {
            "task_id": task_id,
            "exercise_record_id": exercise_record_id,
            "status": status,
            "學生學習狀況評估": weakness,
            "題目詳解與教學建議": guidance,
            "error": error,
            "updated_at": _now_iso()
        }
        client.set(key, json.dumps(value, ensure_ascii=False), ex=AI_CACHE_TTL_SECONDS)
    except Exception as e:
        print(f"寫入 Redis 任務快取失敗: {e}")


def cache_set_record_latest(exercise_record_id: str, task_id: str):
    if not REDIS_AVAILABLE:
        return
    try:
        client = get_redis_client()
        key = f"{AI_CACHE_PREFIX}analysis:record:{exercise_record_id}:latest"
        client.set(key, task_id, ex=AI_CACHE_TTL_SECONDS)
    except Exception as e:
        print(f"寫入 Redis 最新任務索引失敗: {e}")


# 封裝：可切換真實或模擬的 AI 生成功能
def do_student_learning_evaluation(question: Dict[str, Any], student_answer: str, temperature: float, max_output_tokens: int) -> Dict[str, Any]:
    if AI_ANALYSIS_MOCK:
        return {
            "學生學習狀況評估": "[MOCK] 根據該題與作答，學生在此知識點需加強，建議重溫課本基礎概念並配合練習題強化。"
        }
    return student_learning_evaluation(question, student_answer, temperature, max_output_tokens)


def do_solution_guidance(question: Dict[str, Any], student_answer: str, temperature: float, max_output_tokens: int) -> Dict[str, Any]:
    if AI_ANALYSIS_MOCK:
        return {
            "題目詳解與教學建議": "[MOCK] 題目核心為基礎概念運用。建議按步驟演練並回顧易錯點，搭配小範圍練習鞏固。"
        }
    return solution_guidance(question, student_answer, temperature, max_output_tokens)


def init_ai_results_table():
    """Deprecated: 由 SQL 初始化與遷移負責，不在程式中建表。"""
    pass


def fetch_exercise_record(record_id: str) -> Dict[str, Any]:
    """
    從 exercise_records 讀取題目與作答資訊，並組合為 Gemini 所需的題目結構。

    來源欄位（存在於 learning-service 的模型）:
      - subject, grade, chapter, publisher, knowledge_points, difficulty,
        question_content, answer_choices, question_topic, correct_answer,
        explanation, user_answer

    目標題目結構 keys:
      grade, subject, publisher, chapter, topic, knowledge_point, difficulty,
      question, options, answer, explanation
    """
    conn = get_db_connection()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                """
                SELECT id,
                       subject,
                       grade,
                       chapter,
                       publisher,
                       knowledge_points,
                       difficulty,
                       question_content,
                       answer_choices,
                       question_topic,
                       correct_answer,
                       explanation,
                       user_answer
                FROM exercise_records
                WHERE id = %s
                LIMIT 1
                """,
                (record_id,)
            )
            row = cur.fetchone()
            if not row:
                raise HTTPException(status_code=404, detail="找不到對應的 exercise_record")

            # 組合題目結構
            answer_choices = row.get("answer_choices")
            # 若是字串嘗試解析
            if isinstance(answer_choices, str):
                try:
                    answer_choices = json.loads(answer_choices)
                except json.JSONDecodeError:
                    answer_choices = {}

            question_dict = {
                "grade": row.get("grade"),
                "subject": row.get("subject"),
                "publisher": row.get("publisher"),
                "chapter": row.get("chapter"),
                "topic": row.get("question_topic"),
                "knowledge_point": row.get("knowledge_points") or [],
                "difficulty": row.get("difficulty"),
                "question": row.get("question_content") or "",
                "options": answer_choices or {},
                "answer": row.get("correct_answer") or "",
                "explanation": row.get("explanation") or ""
            }

            return {
                "question": question_dict,
                "student_answer": row.get("user_answer")
            }
    finally:
        conn.close()


def upsert_task_initial(task_id: uuid.UUID, exercise_record_id: str):
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO ai_analysis_results (id, exercise_record_id, status)
                VALUES (%s, %s, 'pending')
                ON CONFLICT (id) DO NOTHING
                """,
                (str(task_id), exercise_record_id)
            )
        conn.commit()
    finally:
        conn.close()


def update_task_status(task_id: uuid.UUID, status: str, weakness: Optional[str] = None, guidance: Optional[str] = None, error: Optional[str] = None):
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                UPDATE ai_analysis_results
                SET status = %s,
                    weakness_analysis = COALESCE(%s, weakness_analysis),
                    learning_guidance = COALESCE(%s, learning_guidance),
                    error = COALESCE(%s, error),
                    updated_at = NOW()
                WHERE id = %s
                """,
                (status, weakness, guidance, error, str(task_id))
            )
        conn.commit()
    finally:
        conn.close()


def get_task(task_id: str) -> Optional[Dict[str, Any]]:
    conn = get_db_connection()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                """
                SELECT id, exercise_record_id, status, weakness_analysis, learning_guidance, error, created_at, updated_at
                FROM ai_analysis_results
                WHERE id = %s
                LIMIT 1
                """,
                (task_id,)
            )
            row = cur.fetchone()
            return dict(row) if row else None
    finally:
        conn.close()


def get_latest_task_by_record(exercise_record_id: str) -> Optional[Dict[str, Any]]:
    conn = get_db_connection()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                """
                SELECT id, exercise_record_id, status, weakness_analysis, learning_guidance, error, created_at, updated_at
                FROM ai_analysis_results
                WHERE exercise_record_id = %s
                ORDER BY created_at DESC
                LIMIT 1
                """,
                (exercise_record_id,)
            )
            row = cur.fetchone()
            return dict(row) if row else None
    finally:
        conn.close()


def get_latest_success_by_record(exercise_record_id: str) -> Optional[Dict[str, Any]]:
    """讀取最新成功且有文字的分析結果。"""
    conn = get_db_connection()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                """
                SELECT id, exercise_record_id, status, weakness_analysis, learning_guidance, error, created_at, updated_at
                FROM ai_analysis_results
                WHERE exercise_record_id = %s AND status = 'succeeded'
                ORDER BY created_at DESC
                LIMIT 1
                """,
                (exercise_record_id,)
            )
            row = cur.fetchone()
            if row and row.get("weakness_analysis") and row.get("learning_guidance"):
                return dict(row)
            return None
    finally:
        conn.close()


def process_analysis_task(task_id: uuid.UUID, exercise_record_id: str, temperature: float = 1.0, max_output_tokens: int = 512):
    """背景任務：從 DB 取資料，呼叫 Gemini（含速率限制與重試），回寫結果。"""
    try:
        update_task_status(task_id, status="processing")
        cache_set_task(str(task_id), exercise_record_id, status="processing")

        record = fetch_exercise_record(exercise_record_id)
        question = record["question"]
        student_answer = record["student_answer"]

        attempts = 0
        last_err: Optional[Exception] = None
        while attempts <= AI_RETRY_MAX_ATTEMPTS:
            try:
                # 速率限制
                _rate_limit_token()

                eval_result = do_student_learning_evaluation(
                    question, student_answer, temperature, max_output_tokens
                )
                _rate_limit_token()
                guide_result = do_solution_guidance(
                    question, student_answer, temperature, max_output_tokens
                )

                weakness_text = (
                    eval_result.get("學生學習狀況評估") if isinstance(eval_result, dict) else str(eval_result)
                )
                guidance_text = (
                    guide_result.get("題目詳解與教學建議") if isinstance(guide_result, dict) else str(guide_result)
                )

                update_task_status(
                    task_id, status="succeeded", weakness=weakness_text, guidance=guidance_text
                )
                cache_set_task(
                    str(task_id),
                    exercise_record_id,
                    status="succeeded",
                    weakness=weakness_text,
                    guidance=guidance_text,
                )
                cache_set_record_latest(exercise_record_id, str(task_id))
                break
            except Exception as inner_e:
                last_err = inner_e
                attempts += 1
                if attempts > AI_RETRY_MAX_ATTEMPTS:
                    raise
                # 退避
                sleep_s = AI_RETRY_BACKOFF_SECONDS * (2 ** (attempts - 1))
                time.sleep(sleep_s)
        
    except Exception as e:
        update_task_status(task_id, status="failed", error=str(e))
        cache_set_task(str(task_id), exercise_record_id, status="failed", error=str(e))
    finally:
        # 嘗試釋放去重鎖（若有）
        try:
            _release_record_lock(exercise_record_id)
        except Exception:
            pass

# 取得最新成功（不嚴格，可能只有部分欄位）
def get_latest_succeeded_by_record_raw(exercise_record_id: str) -> Optional[Dict[str, Any]]:
    conn = get_db_connection()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                """
                SELECT id, exercise_record_id, status, weakness_analysis, learning_guidance, error, created_at, updated_at
                FROM ai_analysis_results
                WHERE exercise_record_id = %s AND status = 'succeeded'
                ORDER BY created_at DESC
                LIMIT 1
                """,
                (exercise_record_id,),
            )
            row = cur.fetchone()
            return dict(row) if row else None
    finally:
        conn.close()


def list_exercise_record_ids_by_session(session_id: str, limit: int = 1000) -> List[str]:
    """依據 session_id 讀取該 session 的 exercise_record id 列表。"""
    conn = get_db_connection()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                """
                SELECT id
                FROM exercise_records
                WHERE session_id = %s
                LIMIT %s
                """,
                (session_id, limit),
            )
            rows = cur.fetchall()
            return [str(r["id"]) for r in rows]
    finally:
        conn.close()


def list_exercise_record_ids_by_session_ordered(session_id: str, limit: int = 10000) -> List[str]:
    """依據 session_id 讀取該 session 的 exercise_record id 列表（按時間排序）。
    若資料表無 created_at 欄位，回退以 id 排序。
    """
    conn = get_db_connection()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            try:
                cur.execute(
                    """
                    SELECT id
                    FROM exercise_records
                    WHERE session_id = %s
                    ORDER BY created_at ASC, id ASC
                    LIMIT %s
                    """,
                    (session_id, limit),
                )
                rows = cur.fetchall()
                return [str(r["id"]) for r in rows]
            except Exception:
                # 回退：若無 created_at
                cur.execute(
                    """
                    SELECT id
                    FROM exercise_records
                    WHERE session_id = %s
                    ORDER BY id ASC
                    LIMIT %s
                    """,
                    (session_id, limit),
                )
                rows = cur.fetchall()
                return [str(r["id"]) for r in rows]
    finally:
        conn.close()


def queue_analysis_if_needed(
    exercise_record_id: str,
    temperature: float = 1.0,
    max_output_tokens: int = 512,
    skip_existing: bool = True,
) -> Optional[str]:
    """若無現成結果則排程任務；回傳新建的 task_id，否則回傳 None（代表跳過）。"""
    if skip_existing:
        # 1) Redis 嚴格命中
        if REDIS_AVAILABLE:
            try:
                client = get_redis_client()
                latest_key = f"{AI_CACHE_PREFIX}analysis:record:{exercise_record_id}:latest"
                latest_task_id = client.get(latest_key)
                if latest_task_id:
                    cache_key = f"{AI_CACHE_PREFIX}analysis:task:{latest_task_id}"
                    cached = client.get(cache_key)
                    if cached:
                        obj = json.loads(cached)
                        if (
                            obj.get("status") == "succeeded"
                            and obj.get("學生學習狀況評估")
                            and obj.get("題目詳解與教學建議")
                        ):
                            return None
            except Exception:
                pass

        # 2) PG 嚴格命中
        existing = get_latest_success_by_record(exercise_record_id)
        if existing:
            try:
                cache_set_task(
                    existing.get("id"),
                    exercise_record_id,
                    status="succeeded",
                    weakness=existing.get("weakness_analysis"),
                    guidance=existing.get("learning_guidance"),
                )
                cache_set_record_latest(exercise_record_id, existing.get("id"))
            except Exception:
                pass
            return None

    # 3) 去重鎖（避免重複排程）
    if not _acquire_record_lock(exercise_record_id):
        return None

    # 4) 排程新任務（可選 RQ）
    task_id = uuid.uuid4()
    upsert_task_initial(task_id, exercise_record_id)
    if AI_USE_RQ and REDIS_AVAILABLE and RQ_AVAILABLE:
        try:
            client = get_redis_client()
            queue = rq.Queue(AI_RQ_QUEUE_NAME, connection=client)
            queue.enqueue(
                process_analysis_task,
                task_id,
                exercise_record_id,
                temperature,
                max_output_tokens,
                job_timeout=AI_JOB_TIMEOUT_SECONDS,
            )
        except Exception as e:
            # 失敗則回退至執行緒池
            TASK_EXECUTOR.submit(
                process_analysis_task,
                task_id,
                exercise_record_id,
                temperature,
                max_output_tokens,
            )
    else:
        TASK_EXECUTOR.submit(
            process_analysis_task,
            task_id,
            exercise_record_id,
            temperature,
            max_output_tokens,
        )
    return str(task_id)

# 取得或生成兩欄，必要時僅補算缺失欄位，並同步 DB 與 Redis。
def get_or_generate_both(question: Dict[str, Any], student_answer: str, exercise_record_id: str, temperature: float, max_output_tokens: int) -> Dict[str, Any]:
    # 1) Redis 命中且兩欄齊
    if REDIS_AVAILABLE:
        try:
            client = get_redis_client()
            latest_key = f"{AI_CACHE_PREFIX}analysis:record:{exercise_record_id}:latest"
            latest_task_id = client.get(latest_key)
            if latest_task_id:
                cache_key = f"{AI_CACHE_PREFIX}analysis:task:{latest_task_id}"
                cached = client.get(cache_key)
                if cached:
                    obj = json.loads(cached)
                    if (
                        obj.get("status") == "succeeded"
                        and obj.get("學生學習狀況評估")
                        and obj.get("題目詳解與教學建議")
                    ):
                        return {
                            "task_id": latest_task_id,
                            "weakness": obj.get("學生學習狀況評估"),
                            "guidance": obj.get("題目詳解與教學建議"),
                            "message": "cached",
                        }
        except Exception:
            pass

    # 2) DB 命中（嚴格）
    strict = get_latest_success_by_record(exercise_record_id)
    if strict:
        try:
            cache_set_task(
                strict.get("id"),
                exercise_record_id,
                status="succeeded",
                weakness=strict.get("weakness_analysis"),
                guidance=strict.get("learning_guidance"),
            )
            cache_set_record_latest(exercise_record_id, strict.get("id"))
        except Exception:
            pass
        return {
            "task_id": strict.get("id"),
            "weakness": strict.get("weakness_analysis"),
            "guidance": strict.get("learning_guidance"),
            "message": "db_hit",
        }

    # 3) 可能有部分欄位：僅補缺
    latest = get_latest_succeeded_by_record_raw(exercise_record_id)
    weakness_text: Optional[str] = latest.get("weakness_analysis") if latest else None
    guidance_text: Optional[str] = latest.get("learning_guidance") if latest else None

    need_weakness = not bool(weakness_text)
    need_guidance = not bool(guidance_text)

    if need_weakness:
        eval_result = do_student_learning_evaluation(
            question=question,
            student_answer=student_answer,
            temperature=temperature,
            max_output_tokens=max_output_tokens,
        )
        weakness_text = (
            eval_result.get("學生學習狀況評估") if isinstance(eval_result, dict) else str(eval_result)
        )

    if need_guidance:
        guide_result = do_solution_guidance(
            question=question,
            student_answer=student_answer,
            temperature=temperature,
            max_output_tokens=max_output_tokens,
        )
        guidance_text = (
            guide_result.get("題目詳解與教學建議") if isinstance(guide_result, dict) else str(guide_result)
        )

    # 持久化為新的任務（確保單一任務同時擁有兩欄）
    task_uuid = uuid.uuid4()
    upsert_task_initial(task_uuid, exercise_record_id)
    update_task_status(
        task_uuid,
        status="succeeded",
        weakness=weakness_text,
        guidance=guidance_text,
    )
    cache_set_task(str(task_uuid), exercise_record_id, status="succeeded", weakness=weakness_text, guidance=guidance_text)
    cache_set_record_latest(exercise_record_id, str(task_uuid))

    return {
        "task_id": str(task_uuid),
        "weakness": weakness_text,
        "guidance": guidance_text,
        "message": "generated_or_completed",
    }

# 根路徑
@app.get("/")
async def root():
    """根路徑"""
    return {
        "message": "InULearning AI Service",
        "version": "1.0.0",
        "docs": "/docs",
        "health": "/health",
        "test": "/test"
    }

# 健康檢查
@app.get("/health")
async def health_check():
    """健康檢查端點"""
    redis_connected = False
    if REDIS_AVAILABLE:
        try:
            redis_connected = bool(get_redis_client().ping())
        except Exception:
            redis_connected = False
    status_val = "healthy" if (GEMINI_AVAILABLE and PSYCOPG2_AVAILABLE and (not REDIS_AVAILABLE or redis_connected)) else "degraded"
    return {
        "status": status_val,
        "service": "inulearning-ai-service",
        "version": "1.0.0",
        "gemini_available": GEMINI_AVAILABLE,
        "db_driver_available": PSYCOPG2_AVAILABLE,
        "redis_available": REDIS_AVAILABLE,
        "redis_connected": redis_connected
    }

# AI 弱點分析端點
@app.post("/api/v1/weakness-analysis/question-analysis", response_model=AIAnalysisResponse)
async def analyze_weakness(request: AIAnalysisRequest):
    """AI 弱點分析"""
    if not GEMINI_AVAILABLE:
        raise HTTPException(status_code=503, detail="Gemini API 不可用")
    
    try:
        result = do_student_learning_evaluation(
            question=request.question,
            student_answer=request.student_answer,
            temperature=request.temperature,
            max_output_tokens=request.max_output_tokens
        )
        # 可選持久化
        task_id: Optional[str] = None
        if request.exercise_record_id:
            try:
                # 正規化 UUID
                normalized_record_id = str(uuid.UUID(request.exercise_record_id))
                # 建立 task id 並持久化
                task_uuid = uuid.uuid4()
                task_id = str(task_uuid)
                upsert_task_initial(task_uuid, normalized_record_id)
                weakness_text = result.get("學生學習狀況評估") if isinstance(result, dict) else str(result)
                update_task_status(task_uuid, status="succeeded", weakness=weakness_text)
                cache_set_task(task_id, normalized_record_id, status="succeeded", weakness=weakness_text)
                cache_set_record_latest(normalized_record_id, task_id)
            except Exception as e:
                # 不阻斷回應
                print(f"同步端點持久化失敗: {e}")
        return {
            "success": True,
            "data": result,
            "message": "AI 弱點分析完成",
            "task_id": task_id
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI 分析失敗: {str(e)}")

# 學習建議端點
@app.post("/api/v1/learning-recommendation/question-guidance", response_model=AIAnalysisResponse)
async def get_guidance(request: AIAnalysisRequest):
    """學習建議"""
    if not GEMINI_AVAILABLE:
        raise HTTPException(status_code=503, detail="Gemini API 不可用")
    
    try:
        result = do_solution_guidance(
            question=request.question,
            student_answer=request.student_answer,
            temperature=request.temperature,
            max_output_tokens=request.max_output_tokens
        )
        # 可選持久化
        task_id: Optional[str] = None
        if request.exercise_record_id:
            try:
                normalized_record_id = str(uuid.UUID(request.exercise_record_id))
                task_uuid = uuid.uuid4()
                task_id = str(task_uuid)
                upsert_task_initial(task_uuid, normalized_record_id)
                guidance_text = result.get("題目詳解與教學建議") if isinstance(result, dict) else str(result)
                update_task_status(task_uuid, status="succeeded", guidance=guidance_text)
                cache_set_task(task_id, normalized_record_id, status="succeeded", guidance=guidance_text)
                cache_set_record_latest(normalized_record_id, task_id)
            except Exception as e:
                print(f"同步端點持久化失敗: {e}")
        return {
            "success": True,
            "data": result,
            "message": "學習建議生成完成",
            "task_id": task_id
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"學習建議生成失敗: {str(e)}")

# ========== 新增：非同步任務 API ==========
from fastapi import BackgroundTasks

@app.post("/api/v1/ai/analysis")
async def trigger_ai_analysis(request: AIAnalysisTriggerRequest, background_tasks: BackgroundTasks):
    if not GEMINI_AVAILABLE:
        raise HTTPException(status_code=503, detail="Gemini API 不可用")
    if not PSYCOPG2_AVAILABLE:
        raise HTTPException(status_code=503, detail="資料庫驅動不可用")

    # 先確認 exercise_record 是否存在並正規化 UUID
    normalized_record_id = request.normalized_uuid()
    try:
        _ = fetch_exercise_record(normalized_record_id)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"讀取作答記錄失敗: {str(e)}")

    # 若已有成功結果（兩欄齊備），直接返回（不重算）
    # 1) Redis
    if REDIS_AVAILABLE:
        try:
            client = get_redis_client()
            latest_key = f"{AI_CACHE_PREFIX}analysis:record:{normalized_record_id}:latest"
            latest_task_id = client.get(latest_key)
            if latest_task_id:
                cache_key = f"{AI_CACHE_PREFIX}analysis:task:{latest_task_id}"
                cached = client.get(cache_key)
                if cached:
                    obj = json.loads(cached)
                    if obj.get("status") == "succeeded" and obj.get("學生學習狀況評估") and obj.get("題目詳解與教學建議"):
                        return {"success": True, "task_id": latest_task_id, "message": "exists"}
        except Exception:
            pass

    # 2) PG
    existing = get_latest_success_by_record(normalized_record_id)
    if existing:
        try:
            cache_set_task(existing.get("id"), normalized_record_id, status="succeeded",
                           weakness=existing.get("weakness_analysis"), guidance=existing.get("learning_guidance"))
            cache_set_record_latest(normalized_record_id, existing.get("id"))
        except Exception:
            pass
        return {"success": True, "task_id": existing.get("id"), "message": "exists"}

    task_id = uuid.uuid4()
    upsert_task_initial(task_id, normalized_record_id)

    # 送入背景處理
    background_tasks.add_task(process_analysis_task, task_id, normalized_record_id)

    return {
        "success": True,
        "task_id": str(task_id),
        "message": "queued"
    }


# 單一端點：一次產生弱點分析與學習建議並可選一次寫入
@app.post("/api/v1/ai/analysis/generate", response_model=AIAnalysisResponse)
async def generate_combined_analysis(request: AIAnalysisRequest):
    if not GEMINI_AVAILABLE:
        raise HTTPException(status_code=503, detail="Gemini API 不可用")
    try:
        # 防重算：若帶 exercise_record_id，統一使用共用流程，確保兩欄齊備
        if request.exercise_record_id:
            try:
                normalized_record_id = str(uuid.UUID(request.exercise_record_id))
            except Exception:
                raise HTTPException(status_code=400, detail="exercise_record_id 需為有效的 UUID")

            ensured = get_or_generate_both(
                question=request.question,
                student_answer=request.student_answer,
                exercise_record_id=normalized_record_id,
                temperature=request.temperature,
                max_output_tokens=request.max_output_tokens,
            )
            return {
                "success": True,
                "data": {
                    "學生學習狀況評估": ensured.get("weakness"),
                    "題目詳解與教學建議": ensured.get("guidance"),
                },
                "message": ensured.get("message", "ok"),
                "task_id": ensured.get("task_id"),
            }

        eval_result = do_student_learning_evaluation(
            question=request.question,
            student_answer=request.student_answer,
            temperature=request.temperature,
            max_output_tokens=request.max_output_tokens,
        )
        guide_result = do_solution_guidance(
            question=request.question,
            student_answer=request.student_answer,
            temperature=request.temperature,
            max_output_tokens=request.max_output_tokens,
        )
        return {
            "success": True,
            "data": {
                "學生學習狀況評估": (
                    eval_result.get("學生學習狀況評估") if isinstance(eval_result, dict) else str(eval_result)
                ),
                "題目詳解與教學建議": (
                    guide_result.get("題目詳解與教學建議") if isinstance(guide_result, dict) else str(guide_result)
                ),
            },
            "message": "AI 弱點分析與學習建議生成完成",
            "task_id": None,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"整合生成失敗: {str(e)}")


@app.get("/api/v1/ai/analysis/{task_id}")
async def get_ai_analysis_status(task_id: str):
    if not PSYCOPG2_AVAILABLE:
        raise HTTPException(status_code=503, detail="資料庫驅動不可用")

    # 先讀取快取
    if REDIS_AVAILABLE:
        try:
            client = get_redis_client()
            cache_key = f"{AI_CACHE_PREFIX}analysis:task:{task_id}"
            cached = client.get(cache_key)
            if cached:
                obj = json.loads(cached)
                data = None
                if obj.get("status") == "succeeded":
                    data = {
                        "學生學習狀況評估": obj.get("學生學習狀況評估"),
                        "題目詳解與教學建議": obj.get("題目詳解與教學建議")
                    }
                return {
                    "success": True,
                    "status": obj.get("status"),
                    "data": data,
                    "message": obj.get("error") or "ok"
                }
        except Exception:
            pass

    task = get_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="找不到任務")

    data: Optional[Dict[str, Any]] = None
    if task["status"] == "succeeded":
        data = {
            "學生學習狀況評估": task.get("weakness_analysis"),
            "題目詳解與教學建議": task.get("learning_guidance")
        }

    # 回填快取
    if REDIS_AVAILABLE:
        try:
            cache_set_task(task.get("id"), task.get("exercise_record_id"), status=task.get("status"), weakness=task.get("weakness_analysis"), guidance=task.get("learning_guidance"), error=task.get("error"))
            if task.get("status") == "succeeded" and task.get("exercise_record_id"):
                cache_set_record_latest(task.get("exercise_record_id"), task.get("id"))
        except Exception:
            pass

    return {
        "success": True,
        "status": task["status"],
        "data": data,
        "message": task.get("error") or "ok"
    }


class SessionPrepareRequest(BaseModel):
    session_id: Optional[str] = None
    exercise_record_ids: Optional[List[str]] = None
    skip_existing: bool = True
    max_records: int = 100
    temperature: float = 1.0
    max_output_tokens: int = 512


@app.post("/api/v1/ai/analysis/session/prepare")
async def prepare_session_analysis(request: SessionPrepareRequest):
    if not GEMINI_AVAILABLE:
        raise HTTPException(status_code=503, detail="Gemini API 不可用")
    if not PSYCOPG2_AVAILABLE:
        raise HTTPException(status_code=503, detail="資料庫驅動不可用")

    if not request.session_id and not request.exercise_record_ids:
        raise HTTPException(status_code=400, detail="需提供 session_id 或 exercise_record_ids")

    # 解析 record_ids
    record_ids_set = set()
    if request.session_id:
        try:
            normalized_session_id = str(uuid.UUID(request.session_id))
        except Exception:
            raise HTTPException(status_code=400, detail="session_id 需為有效的 UUID")
        session_records = list_exercise_record_ids_by_session(
            normalized_session_id, limit=max(1, request.max_records)
        )
        record_ids_set.update(session_records)

    if request.exercise_record_ids:
        for rid in request.exercise_record_ids:
            try:
                record_ids_set.add(str(uuid.UUID(rid)))
            except Exception:
                # 忽略非法 UUID
                continue

    if not record_ids_set:
        return {
            "success": True,
            "accepted": 0,
            "skipped": 0,
            "queued": 0,
            "queued_task_ids": [],
            "message": "no_records",
        }

    # 限制數量
    record_ids: List[str] = list(record_ids_set)[: max(1, request.max_records)]

    accepted_task_ids: List[str] = []
    skipped = 0
    for rid in record_ids:
        task_id = queue_analysis_if_needed(
            rid,
            temperature=request.temperature,
            max_output_tokens=request.max_output_tokens,
            skip_existing=request.skip_existing,
        )
        if task_id is None:
            skipped += 1
        else:
            accepted_task_ids.append(task_id)

    return {
        "success": True,
        "accepted": len(accepted_task_ids),
        "skipped": skipped,
        "queued": len(accepted_task_ids),
        "queued_task_ids": accepted_task_ids,
        "message": "queued",
    }


class PrewarmStrategy(str, Enum):
    all = "all"
    next_n = "next_n"


class SessionPrewarmRequest(BaseModel):
    session_id: str
    strategy: PrewarmStrategy = PrewarmStrategy.all
    next_n: Optional[int] = None
    skip_existing: bool = True
    temperature: float = 1.0
    max_output_tokens: int = 512


@app.post("/api/v1/ai/analysis/session/prewarm")
async def prewarm_session_analysis(request: SessionPrewarmRequest):
    if not GEMINI_AVAILABLE:
        raise HTTPException(status_code=503, detail="Gemini API 不可用")
    if not PSYCOPG2_AVAILABLE:
        raise HTTPException(status_code=503, detail="資料庫驅動不可用")

    try:
        normalized_session_id = str(uuid.UUID(request.session_id))
    except Exception:
        raise HTTPException(status_code=400, detail="session_id 需為有效的 UUID")

    ordered_ids = list_exercise_record_ids_by_session_ordered(normalized_session_id)
    if not ordered_ids:
        return {
            "success": True,
            "accepted": 0,
            "skipped": 0,
            "queued": 0,
            "queued_task_ids": [],
            "message": "no_records",
        }

    if request.strategy == PrewarmStrategy.all:
        target_ids = ordered_ids
    else:
        n = request.next_n if request.next_n and request.next_n > 0 else AI_PREWARM_DEFAULT_NEXT_N
        target_ids = ordered_ids[:n]

    accepted_task_ids: List[str] = []
    skipped = 0
    for rid in target_ids:
        task_id = queue_analysis_if_needed(
            rid,
            temperature=request.temperature,
            max_output_tokens=request.max_output_tokens,
            skip_existing=request.skip_existing,
        )
        if task_id is None:
            skipped += 1
        else:
            accepted_task_ids.append(task_id)

    return {
        "success": True,
        "accepted": len(accepted_task_ids),
        "skipped": skipped,
        "queued": len(accepted_task_ids),
        "queued_task_ids": accepted_task_ids,
        "message": "queued",
        "strategy": request.strategy,
        "count": len(target_ids),
    }

# ===== Phase 5：前端批量查詢支援 =====
class BatchStatusRequest(BaseModel):
    exercise_record_ids: List[str]
    include_data: bool = False
    max_records: int = 100


def summarize_status_for_record(exercise_record_id: str, include_data: bool = False) -> Dict[str, Any]:
    # 1) Redis 最新 task → task payload
    if REDIS_AVAILABLE:
        try:
            client = get_redis_client()
            latest_key = f"{AI_CACHE_PREFIX}analysis:record:{exercise_record_id}:latest"
            latest_task_id = client.get(latest_key)
            if latest_task_id:
                cache_key = f"{AI_CACHE_PREFIX}analysis:task:{latest_task_id}"
                cached = client.get(cache_key)
                if cached:
                    obj = json.loads(cached)
                    data = None
                    if include_data and obj.get("status") == "succeeded":
                        data = {
                            "學生學習狀況評估": obj.get("學生學習狀況評估"),
                            "題目詳解與教學建議": obj.get("題目詳解與教學建議"),
                        }
                    has_both = bool(
                        obj.get("status") == "succeeded"
                        and obj.get("學生學習狀況評估")
                        and obj.get("題目詳解與教學建議")
                    )
                    return {
                        "exercise_record_id": exercise_record_id,
                        "latest_task_id": latest_task_id,
                        "status": obj.get("status"),
                        "has_both": has_both,
                        "updated_at": obj.get("updated_at"),
                        "data": data,
                        "message": obj.get("error") or "ok",
                        "source": "cache",
                    }
        except Exception:
            pass

    # 2) DB：先嚴格成功 → 再取最新任務
    strict = get_latest_success_by_record(exercise_record_id)
    if strict:
        data = None
        if include_data:
            data = {
                "學生學習狀況評估": strict.get("weakness_analysis"),
                "題目詳解與教學建議": strict.get("learning_guidance"),
            }
        return {
            "exercise_record_id": exercise_record_id,
            "latest_task_id": strict.get("id"),
            "status": "succeeded",
            "has_both": True,
            "updated_at": strict.get("updated_at").isoformat() if strict.get("updated_at") else None,
            "data": data,
            "message": "db_hit",
            "source": "db_strict",
        }

    latest = get_latest_task_by_record(exercise_record_id)
    if latest:
        data = None
        has_both = bool(
            latest.get("status") == "succeeded"
            and latest.get("weakness_analysis")
            and latest.get("learning_guidance")
        )
        if include_data and has_both:
            data = {
                "學生學習狀況評估": latest.get("weakness_analysis"),
                "題目詳解與教學建議": latest.get("learning_guidance"),
            }
        return {
            "exercise_record_id": exercise_record_id,
            "latest_task_id": latest.get("id"),
            "status": latest.get("status"),
            "has_both": has_both,
            "updated_at": latest.get("updated_at").isoformat() if latest.get("updated_at") else None,
            "data": data,
            "message": latest.get("error") or "ok",
            "source": "db_latest",
        }

    return {
        "exercise_record_id": exercise_record_id,
        "latest_task_id": None,
        "status": "not_found",
        "has_both": False,
        "updated_at": None,
        "data": None,
        "message": "no_task",
        "source": "none",
    }


@app.post("/api/v1/ai/analysis/status/batch")
async def get_batch_status(request: BatchStatusRequest):
    if not PSYCOPG2_AVAILABLE:
        raise HTTPException(status_code=503, detail="資料庫驅動不可用")

    if not request.exercise_record_ids:
        return {"success": True, "items": []}

    items: List[Dict[str, Any]] = []
    count = 0
    for rid in request.exercise_record_ids:
        if count >= max(1, request.max_records):
            break
        try:
            normalized = str(uuid.UUID(rid))
        except Exception:
            continue
        items.append(summarize_status_for_record(normalized, include_data=request.include_data))
        count += 1

    return {"success": True, "items": items}


@app.get("/api/v1/ai/analysis/session/{session_id}/status/batch")
async def get_session_batch_status(session_id: str, include_data: bool = False, max_records: int = 100):
    if not PSYCOPG2_AVAILABLE:
        raise HTTPException(status_code=503, detail="資料庫驅動不可用")
    try:
        normalized_session_id = str(uuid.UUID(session_id))
    except Exception:
        raise HTTPException(status_code=400, detail="session_id 需為有效的 UUID")

    record_ids = list_exercise_record_ids_by_session_ordered(normalized_session_id, limit=max(1, max_records))
    items = [summarize_status_for_record(rid, include_data=include_data) for rid in record_ids]
    return {"success": True, "items": items, "count": len(items)}

@app.get("/api/v1/ai/analysis/session/{session_id}/status")
async def get_session_analysis_status(session_id: str):
    if not PSYCOPG2_AVAILABLE:
        raise HTTPException(status_code=503, detail="資料庫驅動不可用")

    try:
        normalized_session_id = str(uuid.UUID(session_id))
    except Exception:
        raise HTTPException(status_code=400, detail="session_id 需為有效的 UUID")

    record_ids = list_exercise_record_ids_by_session(normalized_session_id, limit=10000)
    total = len(record_ids)
    if total == 0:
        return {
            "success": True,
            "session_id": normalized_session_id,
            "total": 0,
            "succeeded": 0,
            "processing": 0,
            "failed": 0,
            "missing_fields": 0,
            "latest_updated_at": None,
        }

    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            # 成功且兩欄齊備的題數（去重 record）
            cur.execute(
                """
                SELECT COUNT(DISTINCT exercise_record_id)
                FROM ai_analysis_results
                WHERE exercise_record_id = ANY(%s::uuid[])
                  AND status = 'succeeded'
                  AND weakness_analysis IS NOT NULL
                  AND learning_guidance IS NOT NULL
                """,
                (record_ids,),
            )
            succeeded = cur.fetchone()[0]

            # 處理中（尚未成功過）
            cur.execute(
                """
                SELECT COUNT(DISTINCT r.exercise_record_id)
                FROM ai_analysis_results r
                WHERE r.exercise_record_id = ANY(%s::uuid[])
                  AND r.status = 'processing'
                  AND NOT EXISTS (
                    SELECT 1 FROM ai_analysis_results s
                    WHERE s.exercise_record_id = r.exercise_record_id
                      AND s.status = 'succeeded'
                      AND s.weakness_analysis IS NOT NULL
                      AND s.learning_guidance IS NOT NULL
                  )
                """,
                (record_ids,),
            )
            processing = cur.fetchone()[0]

            # 失敗（尚未成功過）
            cur.execute(
                """
                SELECT COUNT(DISTINCT r.exercise_record_id)
                FROM ai_analysis_results r
                WHERE r.exercise_record_id = ANY(%s::uuid[])
                  AND r.status = 'failed'
                  AND NOT EXISTS (
                    SELECT 1 FROM ai_analysis_results s
                    WHERE s.exercise_record_id = r.exercise_record_id
                      AND s.status = 'succeeded'
                      AND s.weakness_analysis IS NOT NULL
                      AND s.learning_guidance IS NOT NULL
                  )
                """,
                (record_ids,),
            )
            failed = cur.fetchone()[0]

            # 成功但缺欄位
            cur.execute(
                """
                SELECT COUNT(DISTINCT exercise_record_id)
                FROM ai_analysis_results
                WHERE exercise_record_id = ANY(%s::uuid[])
                  AND status = 'succeeded'
                  AND (weakness_analysis IS NULL OR learning_guidance IS NULL)
                """,
                (record_ids,),
            )
            missing_fields = cur.fetchone()[0]

            # 最近更新時間
            cur.execute(
                """
                SELECT MAX(updated_at)
                FROM ai_analysis_results
                WHERE exercise_record_id = ANY(%s::uuid[])
                """,
                (record_ids,),
            )
            latest_updated_at = cur.fetchone()[0]

        return {
            "success": True,
            "session_id": normalized_session_id,
            "total": total,
            "succeeded": succeeded,
            "processing": processing,
            "failed": failed,
            "missing_fields": missing_fields,
            "latest_updated_at": latest_updated_at.isoformat() if latest_updated_at else None,
        }
    finally:
        conn.close()

@app.get("/api/v1/ai/analysis/by-record/{exercise_record_id}")
async def get_latest_analysis_by_record(exercise_record_id: str):
    if not PSYCOPG2_AVAILABLE:
        raise HTTPException(status_code=503, detail="資料庫驅動不可用")

    try:
        normalized_record_id = str(uuid.UUID(exercise_record_id))
    except Exception:
        raise HTTPException(status_code=400, detail="exercise_record_id 需為有效的 UUID")

    # 先讀 Redis: latest task id -> task payload
    if REDIS_AVAILABLE:
        try:
            client = get_redis_client()
            latest_key = f"{AI_CACHE_PREFIX}analysis:record:{normalized_record_id}:latest"
            latest_task_id = client.get(latest_key)
            if latest_task_id:
                cache_key = f"{AI_CACHE_PREFIX}analysis:task:{latest_task_id}"
                cached = client.get(cache_key)
                if cached:
                    obj = json.loads(cached)
                    data = None
                    if obj.get("status") == "succeeded":
                        data = {
                            "學生學習狀況評估": obj.get("學生學習狀況評估"),
                            "題目詳解與教學建議": obj.get("題目詳解與教學建議")
                        }
                    return {
                        "success": True,
                        "latest_task_id": latest_task_id,
                        "status": obj.get("status"),
                        "data": data,
                        "message": obj.get("error") or "ok"
                    }
        except Exception:
            pass

    task = get_latest_task_by_record(normalized_record_id)
    if not task:
        return {
            "success": True,
            "latest_task_id": None,
            "status": "not_found",
            "data": None,
            "message": "尚無分析結果"
        }

    data: Optional[Dict[str, Any]] = None
    if task["status"] == "succeeded":
        data = {
            "學生學習狀況評估": task.get("weakness_analysis"),
            "題目詳解與教學建議": task.get("learning_guidance")
        }

    # 回填快取
    if REDIS_AVAILABLE and task:
        try:
            cache_set_task(task.get("id"), normalized_record_id, status=task.get("status"), weakness=task.get("weakness_analysis"), guidance=task.get("learning_guidance"), error=task.get("error"))
            cache_set_record_latest(normalized_record_id, task.get("id"))
        except Exception:
            pass

    return {
        "success": True,
        "latest_task_id": task.get("id"),
        "status": task.get("status"),
        "data": data,
        "message": task.get("error") or "ok"
    }

# 佇列健康檢查（Phase 4）
@app.get("/api/v1/ai/queue/health")
async def get_queue_health():
    """回報工作列隊健康狀態（若啟用 RQ）。"""
    if not (AI_USE_RQ and REDIS_AVAILABLE and RQ_AVAILABLE):
        return {
            "success": True,
            "use_rq": False,
            "message": "rq_disabled_or_unavailable",
        }
    try:
        client = get_redis_client()
        queue = rq.Queue(AI_RQ_QUEUE_NAME, connection=client)
        return {
            "success": True,
            "use_rq": True,
            "queue": AI_RQ_QUEUE_NAME,
            "count": queue.count,
            "is_empty": queue.is_empty(),
        }
    except Exception as e:
        return {"success": False, "use_rq": True, "message": str(e)}

# 代理健康檢查（便於 /api/v1/ai/health 測試）
@app.get("/api/v1/ai/health")
async def ai_health_alias():
    return await health_check()

# 測試端點
@app.get("/test")
async def test_gemini():
    """測試 Gemini API 是否正常工作"""
    if not GEMINI_AVAILABLE:
        return {"status": "error", "message": "Gemini API 不可用"}
    
    try:
        # 測試題目
        test_question = {
            "grade": "7A",
            "subject": "數學",
            "question": "測試題目",
            "options": {"A": "選項A", "B": "選項B", "C": "選項C", "D": "選項D"},
            "answer": "C"
        }
        
        # 測試弱點分析
        weakness_result = student_learning_evaluation(test_question, "B")
        
        # 測試學習建議
        guidance_result = solution_guidance(test_question, "B")
        
        return {
            "status": "success",
            "message": "Gemini API 測試成功",
            "weakness_test": weakness_result,
            "guidance_test": guidance_result
        }
    except Exception as e:
        return {"status": "error", "message": f"Gemini API 測試失敗: {str(e)}"}

if __name__ == "__main__":
    print("🚀 啟動 InULearning AI 服務")
    print("📍 服務地址: http://localhost:8004")
    print("🔧 調試模式: True")
    print("📊 API 文檔: http://localhost:8004/docs")
    print("📋 健康檢查: http://localhost:8004/health")
    print("🧪 測試端點: http://localhost:8004/test")
    print("-" * 50)
    
    if not GEMINI_AVAILABLE:
        print("⚠️  警告: Gemini API 不可用，服務將無法提供 AI 分析功能")
        print("請確保已安裝 google-generativeai 套件並設定 GEMINI_API_KEY")
    if not PSYCOPG2_AVAILABLE:
        print("⚠️  警告: psycopg2 未安裝，將無法連接 PostgreSQL")
    
    # 初始化資料表已改為 SQL 管理，這裡不再執行

    # 啟動服務
    uvicorn.run(
        "start_ai_service:app",
        host="0.0.0.0",
        port=8004,
        reload=True,
        log_level="info"
    )
