-- ===============================================
-- InULearning 學習練習記錄系統 - PostgreSQL 初始化腳本
-- 版本: v1.0.0
-- 作者: AIPE01_group2
-- 日期: 2024-12-19
-- 
-- 目的: 建立完整的學習練習記錄系統資料庫結構
-- 包含用戶管理、學習會話、練習記錄、知識點追蹤等功能
-- ===============================================

-- 建立擴展
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ===============================================
-- 1. 用戶管理相關表
-- ===============================================

-- 建立用戶表（如果不存在）
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(100) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    hashed_password VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'student' CHECK (role IN ('student', 'parent', 'teacher', 'admin')),
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    phone VARCHAR(20),
    avatar_url VARCHAR(500),
    is_active BOOLEAN DEFAULT TRUE,
    is_verified BOOLEAN DEFAULT FALSE,
    email_verified_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 建立 refresh tokens 表
CREATE TABLE IF NOT EXISTS refresh_tokens (
    id SERIAL PRIMARY KEY,
    token VARCHAR(500) UNIQUE NOT NULL,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    is_revoked BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 建立家長學生關聯表
CREATE TABLE IF NOT EXISTS parent_child_relations (
    id SERIAL PRIMARY KEY,
    parent_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    child_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    relationship_type VARCHAR(50) DEFAULT 'parent',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ===============================================
-- 2. 學習系統核心表
-- ===============================================

-- 建立學習會話表
CREATE TABLE IF NOT EXISTS learning_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_name VARCHAR(200) NOT NULL,
    subject VARCHAR(50) NOT NULL,
    grade VARCHAR(20) NOT NULL,
    chapter VARCHAR(100),
    publisher VARCHAR(20) NOT NULL DEFAULT '南一',
    difficulty VARCHAR(20),
    knowledge_points TEXT[],
    question_count INTEGER NOT NULL DEFAULT 10,
    correct_count INTEGER DEFAULT 0,
    total_score DECIMAL(5,2),
    accuracy_rate DECIMAL(5,2),
    time_spent INTEGER,
    status VARCHAR(20) DEFAULT 'completed' CHECK (status IN ('active', 'completed', 'paused')),
    session_metadata JSONB,
    start_time TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    end_time TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- 約束檢查
    CONSTRAINT chk_learning_sessions_publisher CHECK (publisher IN ('南一', '翰林', '康軒')),
    CONSTRAINT chk_learning_sessions_difficulty CHECK (difficulty IN ('easy', 'normal', 'hard') OR difficulty IS NULL),
    CONSTRAINT chk_learning_sessions_grade CHECK (grade IN ('7A', '7B', '8A', '8B', '9A', '9B')),
    CONSTRAINT chk_learning_sessions_subject CHECK (subject IN ('國文', '英文', '數學', '自然', '地理', '歷史', '公民'))
);

-- 建立練習記錄表
CREATE TABLE IF NOT EXISTS exercise_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES learning_sessions(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    question_id VARCHAR(100) NOT NULL,
    subject VARCHAR(50),
    grade VARCHAR(20),
    chapter VARCHAR(100),
    publisher VARCHAR(20),
    knowledge_points TEXT[],
    question_content TEXT,
    answer_choices JSONB,
    difficulty VARCHAR(20),
    question_topic VARCHAR(200),
    user_answer TEXT,
    correct_answer TEXT NOT NULL,
    is_correct BOOLEAN NOT NULL,
    score DECIMAL(5,2),
    explanation TEXT,
    time_spent INTEGER, -- 秒數
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 建立學習進度表
CREATE TABLE IF NOT EXISTS learning_progress (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    subject VARCHAR(50) NOT NULL,
    grade VARCHAR(20) NOT NULL,
    chapter VARCHAR(100) NOT NULL,
    knowledge_point VARCHAR(100) NOT NULL,
    correct_count INTEGER DEFAULT 0,
    total_count INTEGER DEFAULT 0,
    last_practiced_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, subject, grade, chapter, knowledge_point)
);

-- ===============================================
-- 3. 學習分析和檔案系統
-- ===============================================

-- 建立用戶學習檔案表
CREATE TABLE IF NOT EXISTS user_learning_profiles (
    user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    current_grade VARCHAR(20),
    preferred_subjects TEXT[],
    preferred_publishers TEXT[],
    -- 知識點追蹤
    strength_knowledge_points TEXT[], -- 強項知識點
    weakness_knowledge_points TEXT[],  -- 弱項知識點
    -- 統計數據
    total_practice_time INTEGER DEFAULT 0, -- 總練習時間（秒）
    total_sessions INTEGER DEFAULT 0,      -- 總練習會話數
    total_questions INTEGER DEFAULT 0,     -- 總答題數
    correct_questions INTEGER DEFAULT 0,   -- 總答對數
    overall_accuracy DECIMAL(5,2) DEFAULT 0, -- 整體正確率
    -- 學習偏好
    preferred_difficulty VARCHAR(20) DEFAULT 'normal',
    learning_preferences JSONB,            -- 其他學習偏好設置
    -- 時間追蹤
    last_practice_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- 約束檢查
    CONSTRAINT chk_user_profiles_grade 
        CHECK (current_grade IN ('7A', '7B', '8A', '8B', '9A', '9B') OR current_grade IS NULL),
    CONSTRAINT chk_user_profiles_difficulty 
        CHECK (preferred_difficulty IN ('easy', 'normal', 'hard')),
    CONSTRAINT chk_user_profiles_accuracy_range 
        CHECK (overall_accuracy >= 0 AND overall_accuracy <= 100)
);

-- 建立知識點主表
CREATE TABLE IF NOT EXISTS knowledge_points_master (
    id SERIAL PRIMARY KEY,
    knowledge_point VARCHAR(100) UNIQUE NOT NULL,
    subject VARCHAR(50) NOT NULL,
    grade VARCHAR(20) NOT NULL,
    chapter VARCHAR(100),
    difficulty_level VARCHAR(20) DEFAULT 'normal',
    description TEXT,
    prerequisites TEXT[], -- 前置知識點
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- 約束檢查
    CONSTRAINT chk_knowledge_points_subject 
        CHECK (subject IN ('國文', '英文', '數學', '自然', '地理', '歷史', '公民')),
    CONSTRAINT chk_knowledge_points_grade 
        CHECK (grade IN ('7A', '7B', '8A', '8B', '9A', '9B')),
    CONSTRAINT chk_knowledge_points_difficulty 
        CHECK (difficulty_level IN ('easy', 'normal', 'hard'))
);

-- ===============================================
-- 4. 建立索引以提升查詢效能
-- ===============================================

-- 用戶表索引
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token ON refresh_tokens(token);

-- learning_sessions 索引
CREATE INDEX IF NOT EXISTS idx_learning_sessions_user_id ON learning_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_learning_sessions_user_subject ON learning_sessions(user_id, subject);
CREATE INDEX IF NOT EXISTS idx_learning_sessions_grade_subject_publisher ON learning_sessions(grade, subject, publisher);
CREATE INDEX IF NOT EXISTS idx_learning_sessions_created_at ON learning_sessions(created_at);
CREATE INDEX IF NOT EXISTS idx_learning_sessions_status ON learning_sessions(status);
CREATE INDEX IF NOT EXISTS idx_learning_sessions_knowledge_points ON learning_sessions USING GIN (knowledge_points);

-- exercise_records 索引
CREATE INDEX IF NOT EXISTS idx_exercise_records_session_id ON exercise_records(session_id);
CREATE INDEX IF NOT EXISTS idx_exercise_records_user_id ON exercise_records(user_id);
CREATE INDEX IF NOT EXISTS idx_exercise_records_user_subject ON exercise_records(user_id, subject);
CREATE INDEX IF NOT EXISTS idx_exercise_records_knowledge_points ON exercise_records USING GIN (knowledge_points);
CREATE INDEX IF NOT EXISTS idx_exercise_records_is_correct ON exercise_records(is_correct);
CREATE INDEX IF NOT EXISTS idx_exercise_records_created_at ON exercise_records(created_at);

-- 其他表索引
CREATE INDEX IF NOT EXISTS idx_learning_progress_user_id ON learning_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_parent_child_relations_parent_id ON parent_child_relations(parent_id);
CREATE INDEX IF NOT EXISTS idx_parent_child_relations_child_id ON parent_child_relations(child_id);

-- user_learning_profiles 索引
CREATE INDEX IF NOT EXISTS idx_user_profiles_grade_subject ON user_learning_profiles(current_grade);
CREATE INDEX IF NOT EXISTS idx_user_profiles_strength_knowledge ON user_learning_profiles USING GIN (strength_knowledge_points);
CREATE INDEX IF NOT EXISTS idx_user_profiles_weakness_knowledge ON user_learning_profiles USING GIN (weakness_knowledge_points);

-- knowledge_points_master 索引
CREATE INDEX IF NOT EXISTS idx_knowledge_points_subject_grade ON knowledge_points_master(subject, grade);
CREATE INDEX IF NOT EXISTS idx_knowledge_points_chapter ON knowledge_points_master(chapter);

-- ===============================================
-- 5. 建立觸發器函數和觸發器
-- ===============================================

-- 建立更新時間觸發器函數
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 為相關表建立更新時間觸發器
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_learning_sessions_updated_at BEFORE UPDATE ON learning_sessions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_learning_progress_updated_at BEFORE UPDATE ON learning_progress FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_parent_child_relations_updated_at BEFORE UPDATE ON parent_child_relations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_user_learning_profiles_updated_at BEFORE UPDATE ON user_learning_profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 以下示例資料改由 seeds 腳本管理，避免與遷移重疊：
-- 2_implementation/database/seeds/postgresql/init-test-data.sql