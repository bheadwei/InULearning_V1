#!/usr/bin/env python3
"""
RQ Worker 啟動腳本（Phase 4）

環境需求：
- REDIS_URL（與服務相同）
- AI_RQ_QUEUE_NAME（可選，預設 ai-analysis）

啟動（Linux/WSL）：
  export AI_RQ_QUEUE_NAME=ai-analysis
  rq worker -u "$REDIS_URL" "$AI_RQ_QUEUE_NAME"

或使用 python 直接啟動：
  python rq_worker.py
"""

import os
from dotenv import load_dotenv

load_dotenv()

AI_RQ_QUEUE_NAME = os.getenv("AI_RQ_QUEUE_NAME", "ai-analysis")
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")

def main():
    try:
        from rq import Worker, Queue, Connection
        import redis
    except Exception as e:
        print(f"缺少 rq/redis 套件：{e}")
        print("請執行: pip install rq redis")
        return

    redis_conn = redis.from_url(REDIS_URL)
    with Connection(redis_conn):
        worker = Worker([Queue(AI_RQ_QUEUE_NAME)])
        print(f"RQ Worker 啟動，queue={AI_RQ_QUEUE_NAME}, redis={REDIS_URL}")
        worker.work()

if __name__ == "__main__":
    main()


