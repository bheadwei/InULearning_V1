-- InULearning 測試資料初始化腳本
-- 版本: v1.2.0 (修正版 - 符合實際資料庫結構)
-- 作者: AIPE01_group2
-- 日期: 2024-12-19
-- 修正: 將UUID改為INTEGER以符合實際資料庫架構，並修正表結構

-- 插入測試用戶（學生、家長、教師、管理員）
INSERT INTO users (username, email, hashed_password, role, first_name, last_name, is_active, is_verified, created_at) VALUES
-- 學生用戶
('student01', 'student01@test.com', '$2b$12$80NUNl/aAMIfCCfbqbRc7e0ADOB81Ibbv1LWHNe7FytsweVw5ySNm', 'student', '王小明', '01', true, true, NOW()),
('student02', 'student02@test.com', '$2b$12$80NUNl/aAMIfCCfbqbRc7e0ADOB81Ibbv1LWHNe7FytsweVw5ySNm', 'student', '李小華', '02', true, true, NOW()),
('student03', 'student03@test.com', '$2b$12$80NUNl/aAMIfCCfbqbRc7e0ADOB81Ibbv1LWHNe7FytsweVw5ySNm', 'student', '張小美', '03', true, true, NOW()),
('student04', 'student04@test.com', '$2b$12$80NUNl/aAMIfCCfbqbRc7e0ADOB81Ibbv1LWHNe7FytsweVw5ySNm', 'student', '陳小強', '04', true, true, NOW()),
('student05', 'student05@test.com', '$2b$12$80NUNl/aAMIfCCfbqbRc7e0ADOB81Ibbv1LWHNe7FytsweVw5ySNm', 'student', '林小雅', '05', true, true, NOW()),

-- 家長用戶
('parent01', 'parent01@test.com', '$2b$12$80NUNl/aAMIfCCfbqbRc7e0ADOB81Ibbv1LWHNe7FytsweVw5ySNm', 'parent', '王大明', '家長', true, true, NOW()),
('parent02', 'parent02@test.com', '$2b$12$80NUNl/aAMIfCCfbqbRc7e0ADOB81Ibbv1LWHNe7FytsweVw5ySNm', 'parent', '李大華', '家長', true, true, NOW()),
('parent03', 'parent03@test.com', '$2b$12$80NUNl/aAMIfCCfbqbRc7e0ADOB81Ibbv1LWHNe7FytsweVw5ySNm', 'parent', '張大美', '家長', true, true, NOW()),

-- 教師用戶
('teacher01', 'teacher01@test.com', '$2b$12$80NUNl/aAMIfCCfbqbRc7e0ADOB81Ibbv1LWHNe7FytsweVw5ySNm', 'teacher', '林老師', '教師', true, true, NOW()),
('teacher02', 'teacher02@test.com', '$2b$12$80NUNl/aAMIfCCfbqbRc7e0ADOB81Ibbv1LWHNe7FytsweVw5ySNm', 'teacher', '陳老師', '教師', true, true, NOW()),

-- 管理員用戶
('admin01', 'admin01@test.com', '$2b$12$80NUNl/aAMIfCCfbqbRc7e0ADOB81Ibbv1LWHNe7FytsweVw5ySNm', 'admin', '系統管理員', '管理員', true, true, NOW())

ON CONFLICT (email) DO NOTHING;

-- 建立家長學生關聯（使用實際的user id）
INSERT INTO parent_child_relations (parent_id, child_id, relationship_type, is_active, created_at)
SELECT 
    p.id as parent_id,
    s.id as child_id,
    'parent' as relationship_type,
    true as is_active,
    NOW() as created_at
FROM users p, users s 
WHERE 
    -- 王大明是王小明和李小華的父親
    (p.email = 'parent01@test.com' AND s.email IN ('student01@test.com', 'student02@test.com')) OR
    -- 李大華是張小美的母親
    (p.email = 'parent02@test.com' AND s.email = 'student03@test.com') OR
    -- 張大美是陳小強和林小雅的母親
    (p.email = 'parent03@test.com' AND s.email IN ('student04@test.com', 'student05@test.com'))
AND NOT EXISTS (
    SELECT 1 FROM parent_child_relations pcr 
    WHERE pcr.parent_id = p.id AND pcr.child_id = s.id
);

-- 插入範例學習會話資料（使用learning_sessions表的實際結構）
INSERT INTO learning_sessions (user_id, session_name, subject, grade, chapter, knowledge_points, question_count, status, created_at)
SELECT 
    u.id as user_id,
    '數學基礎練習 - ' || u.first_name as session_name,
    '數學' as subject,
    '8年級' as grade,
    '一元一次方程式' as chapter,
    ARRAY['方程式求解', '移項運算', '基礎計算'] as knowledge_points,
    10 as question_count,
    'completed' as status,
    NOW() - INTERVAL '1 hour' as created_at
FROM users u 
WHERE u.role = 'student' AND u.email LIKE 'student0%@test.com'
LIMIT 3;

-- 插入範例練習記錄（使用exercise_records表）
INSERT INTO exercise_records (session_id, user_id, question_id, user_answer, correct_answer, is_correct, explanation, time_spent, created_at)
SELECT 
    ls.id as session_id,
    ls.user_id,
    'q_math_' || ls.user_id || '_' || generate_series as question_id,
    CASE WHEN random() > 0.3 THEN 'A' ELSE 'B' END as user_answer,
    'A' as correct_answer,
    CASE WHEN random() > 0.3 THEN true ELSE false END as is_correct,
    '這是一道基礎數學題目' as explanation,
    120 + (random() * 180)::integer as time_spent, -- 120-300秒隨機
    NOW() - INTERVAL '1 hour' as created_at
FROM learning_sessions ls
CROSS JOIN generate_series(1, 5) -- 每個會話生成5個記錄
WHERE ls.user_id IN (SELECT id FROM users WHERE role = 'student' LIMIT 3);

-- 插入學習進度資料（使用正確的欄位結構）
INSERT INTO learning_progress (user_id, subject, grade, chapter, knowledge_point, correct_count, total_count, last_practiced_at, created_at)
SELECT 
    u.id as user_id,
    '數學' as subject,
    '8年級' as grade,
    '一元一次方程式' as chapter,
    kp.knowledge_point,
    CASE 
        WHEN u.email = 'student01@test.com' THEN 8
        WHEN u.email = 'student02@test.com' THEN 7
        WHEN u.email = 'student03@test.com' THEN 9
        ELSE 6
    END as correct_count,
    10 as total_count,
    NOW() - INTERVAL '30 minutes' as last_practiced_at,
    NOW() as created_at
FROM users u 
CROSS JOIN (
    VALUES ('方程式求解'), ('移項運算'), ('基礎計算')
) AS kp(knowledge_point)
WHERE u.role = 'student' AND u.email LIKE 'student0%@test.com'
AND NOT EXISTS (
    SELECT 1 FROM learning_progress lp 
    WHERE lp.user_id = u.id 
    AND lp.subject = '數學' 
    AND lp.grade = '8年級' 
    AND lp.chapter = '一元一次方程式' 
    AND lp.knowledge_point = kp.knowledge_point
)
LIMIT 9; -- 3個學生 × 3個知識點

-- 顯示插入完成訊息
DO $$
DECLARE
    user_count integer;
    student_count integer;
    parent_count integer;
    teacher_count integer;
    admin_count integer;
    relation_count integer;
    session_count integer;
    exercise_count integer;
    progress_count integer;
BEGIN
    SELECT COUNT(*) INTO user_count FROM users;
    SELECT COUNT(*) INTO student_count FROM users WHERE role = 'student';
    SELECT COUNT(*) INTO parent_count FROM users WHERE role = 'parent';
    SELECT COUNT(*) INTO teacher_count FROM users WHERE role = 'teacher';
    SELECT COUNT(*) INTO admin_count FROM users WHERE role = 'admin';
    SELECT COUNT(*) INTO relation_count FROM parent_child_relations;
    SELECT COUNT(*) INTO session_count FROM learning_sessions;
    SELECT COUNT(*) INTO exercise_count FROM exercise_records;
    SELECT COUNT(*) INTO progress_count FROM learning_progress;
    
    RAISE NOTICE '';
    RAISE NOTICE '🎉 InULearning 測試資料初始化完成！';
    RAISE NOTICE '================================================';
    RAISE NOTICE '📊 資料統計:';
    RAISE NOTICE '   總用戶數: %', user_count;
    RAISE NOTICE '   👨‍🎓 學生數: %', student_count;
    RAISE NOTICE '   👪 家長數: %', parent_count;
    RAISE NOTICE '   👨‍🏫 教師數: %', teacher_count;
    RAISE NOTICE '   👨‍💼 管理員數: %', admin_count;
    RAISE NOTICE '   🔗 家長學生關聯數: %', relation_count;
    RAISE NOTICE '   📚 學習會話數: %', session_count;
    RAISE NOTICE '   📝 練習記錄數: %', exercise_count;
    RAISE NOTICE '   📈 學習進度記錄數: %', progress_count;
    RAISE NOTICE '';
END $$;

-- 顯示測試帳號資訊
SELECT '=== 🔑 測試帳號資訊 (密碼都是 password123) ===' as "系統資訊";

SELECT 
    '🎯 ' || email as "帳號",
    CASE role
        WHEN 'student' THEN '👨‍🎓 學生'
        WHEN 'parent' THEN '👪 家長'
        WHEN 'teacher' THEN '👨‍🏫 教師'
        WHEN 'admin' THEN '👨‍💼 管理員'
    END as "角色",
    COALESCE(first_name || ' ' || last_name, '未設定') as "姓名",
    CASE role
        WHEN 'student' THEN '🌐 http://localhost:8080'
        WHEN 'parent' THEN '🌐 http://localhost:8082'
        WHEN 'teacher' THEN '🌐 http://localhost:8083'
        WHEN 'admin' THEN '🌐 http://localhost:8081'
    END as "前端地址"
FROM users 
WHERE email LIKE '%@test.com' AND email NOT LIKE '%teacher@%' AND email NOT LIKE '%student@%'
ORDER BY 
    CASE role
        WHEN 'admin' THEN 1
        WHEN 'teacher' THEN 2
        WHEN 'parent' THEN 3
        WHEN 'student' THEN 4
    END, email;

