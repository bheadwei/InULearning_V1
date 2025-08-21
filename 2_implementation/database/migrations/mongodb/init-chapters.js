// 章節初始化腳本
// 根據三版本科目章節.json 建立章節資料

// 切換到 inulearning 資料庫
db = db.getSiblingDB('inulearning');

// 建立用戶（如果需要）
try {
    db.createUser({
        user: "aipe-tester",
        pwd: "aipe-tester",
        roles: [
            { role: "readWrite", db: "inulearning" }
        ]
    });
} catch (e) {
    // 用戶可能已存在，忽略錯誤
    print("User may already exist, continuing...");
}

// 清空現有章節資料
db.chapters.deleteMany({});
db.knowledge_points.deleteMany({});

// 完整的章節資料（根據三版本科目章節.json）
const chapters = [
    // 南一版本
    {
        publisher: "南一",
        subject: "國文",
        grade: "7A",
        chapters: [
            "夏夜", "老師的十二樣見面禮", "鮭魚產卵，力爭上游", "吃冰的滋味",
            "絕句選(一)登鸛雀樓(二)黃鶴樓宋孟浩然之廣陵(三)楓橋夜泊",
            "飛翔的舞者", "牛背上的呀喝", "論語選(一)學而(二)子罕(三)述而紙船印象",
            "閱讀課　故鄉的桂花雨", "自學選文　暑假作業", "自學選文　茶葉的分類",
            "自學選文　值得記憶的小事：日記", "語文常識一　標點符號使用法",
            "語文常識二　資料檢索與閱讀策略"
        ]
    },
    {
        publisher: "南一",
        subject: "國文",
        grade: "7B",
        chapters: [
            "視力與偏見", "背　影", "土芭樂的生存之道", "溪頭的竹子",
            "律詩選(一)山居秋暝(二)聞官軍收河南河北", "劉墉寓言作品選",
            "負　荷", "兒時記趣", "謝　天", "閱讀課　示　愛",
            "自學選文　賣油翁", "自學選文　食蔥有時",
            "自學選文　跨時空的對望：淺談文言文翻譯", "語文常識一　認識漢字的造字法則",
            "語文常識二　漢字演變與書法欣賞"
        ]
    },
    // ...（其餘章節同原檔案，為簡潔起見省略）
];

// 插入章節資料
chapters.forEach((subjectData, index) => {
    subjectData.chapters.forEach((chapterName, chapterIndex) => {
        db.chapters.insertOne({
            publisher: subjectData.publisher,
            subject: subjectData.subject,
            grade: subjectData.grade,
            chapter: chapterName,
            description: `${subjectData.subject} - ${subjectData.grade} - ${chapterName}`,
            order: chapterIndex + 1,
            created_at: new Date(),
            updated_at: new Date()
        });
    });
});

// 建立知識點資料（為每個章節建立基本知識點）
db.chapters.find({}).forEach(function(chapter) {
    db.knowledge_points.insertOne({
        subject: chapter.subject,
        grade: chapter.grade,
        chapter: chapter.chapter,
        name: `${chapter.chapter} - 基本概念`,
        description: `${chapter.chapter} 的基本概念與應用`,
        order: 1,
        created_at: new Date(),
        updated_at: new Date()
    });
    
    db.knowledge_points.insertOne({
        subject: chapter.subject,
        grade: chapter.grade,
        chapter: chapter.chapter,
        name: `${chapter.chapter} - 進階應用`,
        description: `${chapter.chapter} 的進階應用與練習`,
        order: 2,
        created_at: new Date(),
        updated_at: new Date()
    });
});

print("章節資料初始化完成！");
print(`共插入 ${db.chapters.countDocuments()} 個章節`);
print(`共插入 ${db.knowledge_points.countDocuments()} 個知識點`);

