-- ===============================================
-- Migration: 003_ai_results_jsonb
-- 目的: 為 ai_analysis_results 新增 JSONB 欄位並回填
-- ===============================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name='ai_analysis_results' AND column_name='weakness_analysis_json'
    ) THEN
        ALTER TABLE ai_analysis_results ADD COLUMN weakness_analysis_json JSONB;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name='ai_analysis_results' AND column_name='learning_guidance_json'
    ) THEN
        ALTER TABLE ai_analysis_results ADD COLUMN learning_guidance_json JSONB;
    END IF;
END $$;

-- 回填現有資料（僅當目標為 NULL 時）
UPDATE ai_analysis_results
SET weakness_analysis_json = CASE
    WHEN weakness_analysis IS NOT NULL AND weakness_analysis_json IS NULL
    THEN jsonb_build_object('text', weakness_analysis)
    ELSE weakness_analysis_json
END,
    learning_guidance_json = CASE
    WHEN learning_guidance IS NOT NULL AND learning_guidance_json IS NULL
    THEN jsonb_build_object('text', learning_guidance)
    ELSE learning_guidance_json
END;

-- 索引（可選）
-- CREATE INDEX IF NOT EXISTS idx_ai_results_weakness_json_gin ON ai_analysis_results USING GIN (weakness_analysis_json);
-- CREATE INDEX IF NOT EXISTS idx_ai_results_guidance_json_gin ON ai_analysis_results USING GIN (learning_guidance_json);


