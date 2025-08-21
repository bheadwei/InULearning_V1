#!/usr/bin/env python3
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

async def final_check():
    client = AsyncIOMotorClient('mongodb://aipe-tester:aipe-tester@localhost:27017/inulearning?authSource=admin')
    db = client.inulearning
    
    try:
        # 總數
        total = await db.questions.count_documents({})
        print(f"📊 總題目數量: {total}")
        
        # 按科目統計
        subjects = await db.questions.distinct("subject")
        print(f"📚 科目: {subjects}")
        
        for subject in subjects:
            count = await db.questions.count_documents({"subject": subject})
            print(f"   {subject}: {count} 題")
        
        # 按出版社統計
        publishers = await db.questions.distinct("publisher")
        print(f"📖 出版社: {publishers}")
        
        for publisher in publishers:
            count = await db.questions.count_documents({"publisher": publisher})
            print(f"   {publisher}: {count} 題")
        
        # 檢查有圖片的題目
        with_images = await db.questions.count_documents({"image_filename": {"$ne": None}})
        print(f"🖼️  有圖片的題目: {with_images} 題")
        
        # 範例題目
        sample = await db.questions.find_one()
        print(f"📝 範例題目: {sample['question'][:50]}...")
        print(f"   科目: {sample.get('subject')}")
        print(f"   出版社: {sample.get('publisher')}")
        print(f"   年級: {sample.get('grade')}")
        
    finally:
        client.close()

if __name__ == "__main__":
    asyncio.run(final_check())