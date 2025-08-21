#!/bin/bash

# InU Learning 登入系統測試腳本
# 適用於 Linux/WSL 環境

echo "🚀 InU Learning 統一登入系統測試"
echo "=================================="

# 檢查必要文件是否存在
echo "📁 檢查文件結構..."
if [ -f "login.html" ]; then
    echo "✅ login.html 存在"
else
    echo "❌ login.html 不存在"
    exit 1
fi

if [ -f "test-login.html" ]; then
    echo "✅ test-login.html 存在"
else
    echo "❌ test-login.html 不存在"
    exit 1
fi

if [ -f "README.md" ]; then
    echo "✅ README.md 存在"
else
    echo "❌ README.md 不存在"
    exit 1
fi

echo ""
echo "🔧 檢查 Docker 服務狀態..."

# 檢查 Docker 是否運行
if ! command -v docker &> /dev/null; then
    echo "❌ Docker 未安裝或未運行"
    exit 1
fi

# 檢查 docker-compose 是否可用
if ! command -v docker-compose &> /dev/null; then
    echo "❌ docker-compose 未安裝"
    exit 1
fi

echo "✅ Docker 環境正常"

echo ""
echo "🌐 檢查服務端口..."

# 檢查端口是否被佔用
check_port() {
    local port=$1
    local service=$2
    if netstat -tuln 2>/dev/null | grep -q ":$port "; then
        echo "✅ $service (端口 $port) 正在運行"
    else
        echo "⚠️  $service (端口 $port) 未運行"
    fi
}

check_port 80 "Nginx 代理"
check_port 8080 "學生應用"
check_port 8081 "管理員應用"
check_port 8082 "家長應用"
check_port 8083 "教師應用"

echo ""
echo "📋 測試帳號資訊："
echo "學生: student01@test.com / password123"
echo "家長: parent01@test.com / password123"
echo "教師: teacher01@test.com / password123"
echo "管理員: admin01@test.com / password123"

echo ""
echo "🔗 訪問連結："
echo "登入頁面: http://localhost/login.html"
echo "測試頁面: http://localhost/test-login.html"
echo "學生應用: http://localhost:8080"
echo "管理員應用: http://localhost:8081"
echo "家長應用: http://localhost:8082"
echo "教師應用: http://localhost:8083"

echo ""
echo "💡 使用說明："
echo "1. 確保 Docker 服務已啟動"
echo "2. 訪問 http://localhost/login.html"
echo "3. 選擇身份並使用測試帳號登入"
echo "4. 系統會自動跳轉到對應的應用"

echo ""
echo "✅ 測試腳本執行完成！" 