#!/usr/bin/env python3
"""
檢查全題庫目錄中的JSON檔案格式
找出不符合格式的檔案
"""

import json
import sys
from pathlib import Path
import logging

# 設定日誌
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def check_json_file(file_path: Path):
    """檢查單個JSON檔案"""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        # 檢查基本結構
        if not isinstance(data, list):
            return False, f"不是陣列格式: {type(data)}"
        
        if len(data) == 0:
            return False, "空陣列"
        
        # 檢查第一個項目的格式
        first_item = data[0]
        if not isinstance(first_item, dict):
            return False, f"項目不是字典格式: {type(first_item)}"
        
        # 檢查必要欄位
        required_fields = ['question', 'options', 'answer']
        missing_fields = []
        
        for field in required_fields:
            if field not in first_item:
                missing_fields.append(field)
        
        if missing_fields:
            return False, f"缺少必要欄位: {missing_fields}"
        
        # 檢查選項格式
        options = first_item.get('options', {})
        if not isinstance(options, dict):
            return False, f"選項不是字典格式: {type(options)}"
        
        if len(options) < 2:
            return False, f"選項數量不足: {len(options)}"
        
        return True, "格式正確"
        
    except json.JSONDecodeError as e:
        return False, f"JSON解析錯誤: {e}"
    except UnicodeDecodeError as e:
        return False, f"編碼錯誤: {e}"
    except Exception as e:
        return False, f"其他錯誤: {e}"


def check_all_json_files():
    """檢查所有JSON檔案"""
    logger.info("🔍 開始檢查全題庫目錄中的JSON檔案...")
    
    # 取得全題庫目錄路徑
    seeds_path = Path(__file__).parent.parent.parent / "database" / "seeds" / "全題庫"
    
    if not seeds_path.exists():
        logger.error(f"❌ 目錄不存在: {seeds_path}")
        return
    
    logger.info(f"📂 檢查目錄: {seeds_path}")
    
    # 統計資訊
    total_files = 0
    valid_files = 0
    invalid_files = []
    
    # 遍歷所有JSON檔案
    for json_file in seeds_path.rglob("*.json"):
        # 跳過非題目檔案
        if "images" in str(json_file) or json_file.name.startswith("."):
            continue
        
        total_files += 1
        relative_path = json_file.relative_to(seeds_path)
        
        logger.info(f"📄 檢查檔案: {relative_path}")
        
        is_valid, message = check_json_file(json_file)
        
        if is_valid:
            valid_files += 1
            logger.info(f"  ✅ {message}")
        else:
            invalid_files.append({
                'file': str(relative_path),
                'path': str(json_file),
                'error': message
            })
            logger.error(f"  ❌ {message}")
    
    # 輸出統計結果
    logger.info("\n" + "="*60)
    logger.info("📊 檢查結果統計:")
    logger.info(f"  總檔案數: {total_files}")
    logger.info(f"  有效檔案: {valid_files}")
    logger.info(f"  無效檔案: {len(invalid_files)}")
    logger.info(f"  有效率: {(valid_files/total_files*100):.1f}%" if total_files > 0 else "  有效率: 0%")
    
    # 詳細列出無效檔案
    if invalid_files:
        logger.info("\n❌ 無效檔案詳細列表:")
        logger.info("-" * 60)
        
        for i, invalid_file in enumerate(invalid_files, 1):
            logger.info(f"{i}. 檔案: {invalid_file['file']}")
            logger.info(f"   路徑: {invalid_file['path']}")
            logger.info(f"   錯誤: {invalid_file['error']}")
            logger.info("")
        
        # 按錯誤類型分組
        error_types = {}
        for invalid_file in invalid_files:
            error_type = invalid_file['error'].split(':')[0]
            if error_type not in error_types:
                error_types[error_type] = []
            error_types[error_type].append(invalid_file['file'])
        
        logger.info("📈 錯誤類型統計:")
        for error_type, files in error_types.items():
            logger.info(f"  {error_type}: {len(files)} 個檔案")
            for file in files[:3]:  # 只顯示前3個
                logger.info(f"    - {file}")
            if len(files) > 3:
                logger.info(f"    ... 還有 {len(files) - 3} 個檔案")
            logger.info("")
    
    else:
        logger.info("\n🎉 所有檔案格式都正確！")
    
    return invalid_files


def detailed_check_invalid_file(file_path: Path, max_items=5):
    """詳細檢查無效檔案"""
    logger.info(f"🔍 詳細檢查檔案: {file_path.name}")
    
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # 檢查檔案大小
        file_size = len(content)
        logger.info(f"📏 檔案大小: {file_size:,} 字元")
        
        # 嘗試解析JSON
        try:
            data = json.loads(content)
            logger.info(f"📋 資料類型: {type(data)}")
            
            if isinstance(data, list):
                logger.info(f"📊 陣列長度: {len(data)}")
                
                # 檢查前幾個項目
                for i in range(min(len(data), max_items)):
                    item = data[i]
                    logger.info(f"  項目 {i+1}:")
                    logger.info(f"    類型: {type(item)}")
                    
                    if isinstance(item, dict):
                        logger.info(f"    欄位: {list(item.keys())}")
                        
                        # 檢查特定欄位
                        if 'question' in item:
                            q_text = str(item['question'])[:100]
                            logger.info(f"    題目: {q_text}...")
                        
                        if 'options' in item:
                            options = item['options']
                            logger.info(f"    選項類型: {type(options)}")
                            if isinstance(options, dict):
                                logger.info(f"    選項鍵: {list(options.keys())}")
                        
                        if 'answer' in item:
                            logger.info(f"    答案: {item['answer']}")
            
            elif isinstance(data, dict):
                logger.info(f"📋 字典欄位: {list(data.keys())}")
        
        except json.JSONDecodeError as e:
            logger.error(f"❌ JSON解析錯誤:")
            logger.error(f"    行號: {e.lineno}")
            logger.error(f"    列號: {e.colno}")
            logger.error(f"    錯誤: {e.msg}")
            
            # 顯示錯誤附近的內容
            lines = content.split('\n')
            start_line = max(0, e.lineno - 3)
            end_line = min(len(lines), e.lineno + 2)
            
            logger.error(f"    錯誤附近內容:")
            for i in range(start_line, end_line):
                marker = " >>> " if i == e.lineno - 1 else "     "
                logger.error(f"    {i+1:4d}{marker}{lines[i]}")
    
    except Exception as e:
        logger.error(f"❌ 檔案讀取錯誤: {e}")


def main():
    """主函數"""
    logger.info("🚀 開始檢查JSON檔案格式...")
    
    # 檢查所有檔案
    invalid_files = check_all_json_files()
    
    # 如果有無效檔案，提供詳細檢查選項
    if invalid_files:
        logger.info("\n" + "="*60)
        logger.info("🔧 詳細檢查前3個無效檔案:")
        
        for i, invalid_file in enumerate(invalid_files[:3], 1):
            logger.info(f"\n{i}. 詳細檢查: {invalid_file['file']}")
            logger.info("-" * 40)
            detailed_check_invalid_file(Path(invalid_file['path']))
    
    logger.info("\n🏁 檢查完成！")
    return len(invalid_files) == 0


if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)