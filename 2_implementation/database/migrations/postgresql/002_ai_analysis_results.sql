-- ===============================================
-- Migration: 002_ai_analysis_results
-- 目的: 建立 AI 生成分析結果的持久化資料表與索引
-- 作者: InU Learning
-- 日期: 2025-01-XX
-- ===============================================

CREATE TABLE IF NOT EXISTS ai_analysis_results (
    id UUID PRIMARY KEY,
    exercise_record_id UUID NOT NULL,
    status VARCHAR(32) NOT NULL,
    weakness_analysis TEXT NULL,
    learning_guidance TEXT NULL,
    error TEXT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ai_results_record_id ON ai_analysis_results(exercise_record_id);
CREATE INDEX IF NOT EXISTS idx_ai_results_created_at ON ai_analysis_results(created_at);

CREATE OR REPLACE FUNCTION trg_ai_results_update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_ai_results_set_updated_at ON ai_analysis_results;
CREATE TRIGGER trg_ai_results_set_updated_at
BEFORE UPDATE ON ai_analysis_results
FOR EACH ROW EXECUTE FUNCTION trg_ai_results_update_updated_at();


