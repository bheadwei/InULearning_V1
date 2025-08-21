// 在 admin 資料庫中建立用戶
db = db.getSiblingDB('admin');

// 建立用戶（如果需要）
try {
    db.createUser({
        user: "aipe-tester",
        pwd: "aipe-tester",
        roles: [
            { role: "readWrite", db: "inulearning" },
            { role: "dbAdmin", db: "inulearning" }
        ]
    });
    print("User created successfully");
} catch (e) {
    // 用戶可能已存在，忽略錯誤
    print("User may already exist, continuing...");
}

// 切換到 inulearning 資料庫
db = db.getSiblingDB('inulearning');

// 在 inulearning 資料庫中也創建用戶
try {
    db.createUser({
        user: "aipe-tester",
        pwd: "aipe-tester",
        roles: [
            { role: "readWrite", db: "inulearning" },
            { role: "dbAdmin", db: "inulearning" }
        ]
    });
    print("User created in inulearning database successfully");
} catch (e) {
    print("User may already exist in inulearning database, continuing...");
}

// 建立集合
db.createCollection('questions');
db.createCollection('chapters');
db.createCollection('knowledge_points');

// 建立索引
db.questions.createIndex({ "subject": 1, "grade": 1, "chapter": 1 });
db.questions.createIndex({ "knowledge_points": 1 });
db.questions.createIndex({ "difficulty": 1 });
db.questions.createIndex({ "question_type": 1 });

db.chapters.createIndex({ "subject": 1, "grade": 1 });
db.knowledge_points.createIndex({ "subject": 1, "grade": 1, "chapter": 1 });
// 資料插入由 init-chapters.js 與外部資料載入流程處理
print("MongoDB 初始化完成（已建立使用者、集合與索引）！");

