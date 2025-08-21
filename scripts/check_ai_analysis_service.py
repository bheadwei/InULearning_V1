#!/usr/bin/env python3
import sys
import json
import uuid
import time
import requests


BASE = "http://localhost:8004"


def assert_true(cond, msg):
    if not cond:
        print(f"FAIL: {msg}")
        sys.exit(1)
    print(f"PASS: {msg}")


def main():
    # 1) 健康檢查
    r = requests.get(f"{BASE}/health", timeout=10)
    assert_true(r.status_code == 200, "health endpoint reachable")
    data = r.json()
    assert_true(data.get("status") in ("healthy", "degraded"), "health status present")
    assert_true(data.get("redis_available") is not None, "redis_available field present")
    assert_true(data.get("db_driver_available") is True, "db driver available")

    # 2) 整合端點一次生成並持久化
    exercise_record_id = str(uuid.uuid4())
    payload = {
        "question": {
            "grade": "7A",
            "subject": "數學",
            "publisher": "南一",
            "chapter": "1-1",
            "topic": "加法",
            "knowledge_point": ["加法定義"],
            "difficulty": "easy",
            "question": "2+3=?",
            "options": {"A": "4", "B": "5"},
            "answer": "B",
            "explanation": "基礎加法"
        },
        "student_answer": "A",
        "temperature": 1.0,
        "max_output_tokens": 256,
        "exercise_record_id": exercise_record_id
    }
    r2 = requests.post(f"{BASE}/api/v1/ai/analysis/generate", json=payload, timeout=60)
    assert_true(r2.status_code == 200, "generate endpoint returns 200")
    res = r2.json()
    assert_true(res.get("success") is True, "generate success true")
    assert_true("學生學習狀況評估" in res.get("data", {}), "weakness text present")
    assert_true("題目詳解與教學建議" in res.get("data", {}), "guidance text present")
    task_id = res.get("task_id")
    assert_true(task_id is not None, "task_id returned when persisted")

    # 3) by-record 命中快取
    r3 = requests.get(f"{BASE}/api/v1/ai/analysis/by-record/{exercise_record_id}", timeout=10)
    assert_true(r3.status_code == 200, "by-record returns 200")
    res3 = r3.json()
    assert_true(res3.get("latest_task_id") == task_id, "by-record returns latest task id")
    assert_true(res3.get("status") == "succeeded", "by-record status succeeded")
    assert_true("學生學習狀況評估" in (res3.get("data") or {}), "by-record weakness present")
    assert_true("題目詳解與教學建議" in (res3.get("data") or {}), "by-record guidance present")

    print("All checks passed.")


if __name__ == "__main__":
    main()


