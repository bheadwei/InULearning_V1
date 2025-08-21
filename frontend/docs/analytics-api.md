# Learning Analytics API (Radar & Trend)

- Base URL: `/api/v1/learning` (proxied by Nginx to learning-service)
- Auth: `Authorization: Bearer <JWT>` (user_id derived from token)
- Scope: Analytics for the current logged-in student (no user_id in path)

## 1) Subjects Radar (normalized six-dimension metrics)

GET `/api/v1/learning/analytics/subjects/radar`

- Query params
  - `window` (string, optional): time window. Allowed: `7d | 30d | 90d`. Default: `30d`.

- Response (example)
```json
{
  "window": "30d",
  "metrics": [
    "accuracy_pct",
    "qpm",
    "dwell_min",
    "questions_count",
    "avg_q_per_session",
    "sessions_count"
  ],
  "subjects": [
    {
      "subject_id": "math",
      "label": "數學",
      "raw": {
        "accuracy_pct": 82.5,
        "qpm": 2.1,
        "dwell_min": 12.3,
        "questions_count": 120,
        "avg_q_per_session": 8.6,
        "sessions_count": 14
      },
      "normalized": {
        "accuracy_pct": 82.5,
        "qpm": 63.0,
        "dwell_min": 55.0,
        "questions_count": 70.0,
        "avg_q_per_session": 68.0,
        "sessions_count": 60.0
      }
    }
  ]
}
```

- Metric definitions (raw)
  - `accuracy_pct` (0-100): per-subject accuracy = SUM(correct) / COUNT(*) * 100
  - `avg_rt_s` (seconds, not returned; used in qpm): AVG(response_time_ms) / 1000
  - `qpm` (questions per minute): 60 / NULLIF(avg_rt_s, 0)
  - `dwell_min` (minutes): AVG(learning_sessions.duration_seconds) / 60
  - `questions_count`: COUNT(*) per subject
  - `sessions_count`: COUNT(DISTINCT session_id) per subject
  - `avg_q_per_session`: questions_count / NULLIF(sessions_count, 0)

- Normalization rules (for `normalized`)
  - Method: min-max to 0-100 across subjects within the same window.
  - Higher-is-better metrics: `accuracy_pct`, `qpm`, `questions_count`, `avg_q_per_session`, `sessions_count` → normalized directly.
  - Lower-is-better metrics: `dwell_min` (and `avg_rt_s` if surfaced) → invert by using 1/value or by `max - value` before min-max. We use: compute `inv_dwell = 1 / max(dwell_min, ε)` and min-max normalize `inv_dwell`.
  - Edge cases: if all subjects have equal values for a metric, set normalized = 50 for that metric.
  - Return both `raw` and `normalized` per subject; `metrics` lists the six exposed keys.

- Data source and filters
  - Tables: `exercise_records` (aliased er), `learning_sessions` (aliased ls)
  - Join: `er.session_id = ls.id`
  - Filter: `er.user_id = :current_user_id` and `er.created_at >= NOW() - INTERVAL :window`

- Aggregation sketch (SQL-like)
```sql
SELECT
  er.subject_id,
  AVG(CASE WHEN er.is_correct THEN 1 ELSE 0 END) * 100.0 AS accuracy_pct,
  AVG(er.response_time_ms) / 1000.0 AS avg_rt_s,
  COUNT(*) AS questions_count,
  COUNT(DISTINCT er.session_id) AS sessions_count,
  AVG(ls.duration_seconds) / 60.0 AS dwell_min
FROM exercise_records er
JOIN learning_sessions ls ON ls.id = er.session_id
WHERE er.user_id = :user_id
  AND er.created_at >= NOW() - (:window)::interval
GROUP BY er.subject_id;
```
Then:
- `qpm = 60.0 / NULLIF(avg_rt_s, 0)`
- `avg_q_per_session = questions_count / NULLIF(sessions_count, 0)`
- Apply normalization per rules above.

## 2) Subjects Trend (per-session series)

GET `/api/v1/learning/analytics/subjects/trend`

- Query params
  - `metric` (string, optional): `accuracy` | `score` (if available). Default: `accuracy`.
  - `window` (string, optional): `7d | 30d | 90d`. Default: `30d`.
  - `limit` (int, optional): max points per subject. Default: `100`, Range: `1..500`.
  - `subject` (string, optional): filter to single subject; if omitted, return series for all subjects.

- Response (example)
```json
{
  "window": "30d",
  "metric": "accuracy",
  "series": [
    {
      "subject_id": "math",
      "label": "數學",
      "points": [
        { "x": "2025-08-01T10:00:00Z", "y": 0.80 },
        { "x": "2025-08-03T09:10:00Z", "y": 0.85 }
      ]
    },
    {
      "subject_id": "english",
      "label": "英文",
      "points": []
    }
  ]
}
```

- Aggregation sketch (per session per subject)
```sql
WITH per_session AS (
  SELECT
    er.subject_id,
    er.session_id,
    ls.started_at AS x,
    AVG(CASE WHEN er.is_correct THEN 1 ELSE 0 END) AS accuracy,
    /* if score exists: AVG(er.score) AS score */
  FROM exercise_records er
  JOIN learning_sessions ls ON ls.id = er.session_id
  WHERE er.user_id = :user_id
    AND er.created_at >= NOW() - (:window)::interval
    AND (:subject IS NULL OR er.subject_id = :subject)
  GROUP BY er.subject_id, er.session_id, ls.started_at
)
SELECT * FROM per_session
ORDER BY x ASC
LIMIT :limit_per_subject /* apply per subject in code or window function */;
```

- Notes
  - If `subject` is omitted, group results by subject_id and return multiple series.
  - `y` is chosen by `metric`: `accuracy` (0..1) or `score` if available.
  - Ensure chronological ordering and per-subject `limit`.

## Errors
- 401 Unauthorized: missing/invalid JWT.
- 500 Internal Server Error: unexpected failure. Learning service error envelope may be `{ "error": { "code": "...", "message": "...", "details": "..." } }`.

## Recommended DB Indexes (PostgreSQL)

These improve filters and joins used above (names may be adjusted to your naming convention):

```sql
-- exercise_records
CREATE INDEX IF NOT EXISTS idx_er_user_created ON exercise_records (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_er_subject ON exercise_records (subject_id);
CREATE INDEX IF NOT EXISTS idx_er_session ON exercise_records (session_id);

-- learning_sessions
CREATE INDEX IF NOT EXISTS idx_ls_user_started ON learning_sessions (user_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_ls_id ON learning_sessions (id);
```

- If bloat/locks are a concern in prod, use `CONCURRENTLY` on large tables when not inside transactions.

## Frontend Consumption Notes
- Use existing Nginx route: call via `/api/v1/learning/analytics/...`.
- Radar: use `normalized` values per metric; show `raw` in tooltip.
- Trend: one trace per subject; x = ISO timestamp from `points[].x`.

## Versioning & Defaults
- API namespace: `/api/v1/learning/analytics/...`
- Defaults: `window=30d`, `metric=accuracy`, `limit=100`.
