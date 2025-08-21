#!/bin/bash

# InULearning Docker 一鍵啟動腳本
# 作者: AIPE01_group2
# 版本: v2.0.0 - 跨裝置優化版
# 支援: Linux, macOS, Windows (WSL/Git Bash)

set -e

echo "🚀 正在啟動 InULearning 系統..."

# 顏色定義
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# 系統資訊
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SYSTEM_TYPE=""
ARCH=""
MEMORY_GB=0
DOCKER_COMPOSE_CMD=""

# 日誌函數
log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

log_step() {
    echo -e "${PURPLE}🔄 $1${NC}"
}

log_highlight() {
    echo -e "${CYAN}🎯 $1${NC}"
}

# 錯誤處理函數
handle_error() {
    log_error "腳本執行失敗，正在清理..."
    cleanup_on_error
    exit 1
}

cleanup_on_error() {
    if command -v docker &> /dev/null && docker info &> /dev/null; then
        log_step "清理失敗的容器..."
        $DOCKER_COMPOSE_CMD down --remove-orphans 2>/dev/null || true
    fi
}

trap handle_error ERR

# 檢測系統類型和架構
detect_system() {
    log_step "檢測系統環境..."
    
    # 檢測作業系統
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        SYSTEM_TYPE="Linux"
        if grep -q Microsoft /proc/version 2>/dev/null; then
            SYSTEM_TYPE="WSL"
        fi
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        SYSTEM_TYPE="macOS"
    elif [[ "$OSTYPE" == "msys" || "$OSTYPE" == "cygwin" ]]; then
        SYSTEM_TYPE="Windows"
    else
        SYSTEM_TYPE="Unknown"
    fi
    
    # 檢測架構
    ARCH=$(uname -m)
    case $ARCH in
        x86_64) ARCH="amd64" ;;
        aarch64|arm64) ARCH="arm64" ;;
        armv7l) ARCH="arm" ;;
        *) ARCH="unknown" ;;
    esac
    
    log_success "系統類型: $SYSTEM_TYPE ($ARCH)"
    
    # 檢測記憶體
    if command -v free &> /dev/null; then
        MEMORY_GB=$(free -g | awk 'NR==2{printf "%.1f", $2}')
    elif [[ "$SYSTEM_TYPE" == "macOS" ]]; then
        MEMORY_GB=$(echo "scale=1; $(sysctl -n hw.memsize) / 1024 / 1024 / 1024" | bc 2>/dev/null || echo "8.0")
    else
        MEMORY_GB="8.0"  # 預設值
    fi
    
    if (( $(echo "$MEMORY_GB < 4.0" | bc -l 2>/dev/null || echo "0") )); then
        log_warning "系統記憶體較少 (${MEMORY_GB}GB)，建議至少 4GB"
    else
        log_success "系統記憶體充足 (${MEMORY_GB}GB)"
    fi
}

# 檢查必要工具
check_required_tools() {
    log_step "檢查必要工具..."
    
    local missing_tools=()
    
    # 檢查基本工具
    for tool in curl git; do
        if ! command -v $tool &> /dev/null; then
            missing_tools+=($tool)
        fi
    done
    
    # 檢查 bc (用於數值計算)
    if ! command -v bc &> /dev/null; then
        log_warning "bc 工具未安裝，將跳過部分數值檢查"
    fi
    
    if [ ${#missing_tools[@]} -ne 0 ]; then
        log_error "缺少必要工具: ${missing_tools[*]}"
        log_info "請安裝缺少的工具後重新執行"
        case $SYSTEM_TYPE in
            "Linux"|"WSL")
                log_info "Ubuntu/Debian: sudo apt update && sudo apt install -y ${missing_tools[*]}"
                log_info "CentOS/RHEL: sudo yum install -y ${missing_tools[*]}"
                ;;
            "macOS")
                log_info "macOS: brew install ${missing_tools[*]}"
                ;;
        esac
        exit 1
    fi
    
    log_success "所有必要工具已安裝"
}

# 檢查 Docker 環境
check_docker() {
    log_step "檢查 Docker 環境..."
    
    # 檢查 Docker 是否安裝
    if ! command -v docker &> /dev/null; then
        log_error "Docker 未安裝"
        show_docker_install_guide
        exit 1
    fi
    
    # 檢查 Docker 是否運行
    if ! docker info &> /dev/null; then
        log_error "Docker 服務未運行"
        log_info "請啟動 Docker 服務："
        case $SYSTEM_TYPE in
            "Linux"|"WSL")
                log_info "  sudo systemctl start docker"
                log_info "  或者: sudo service docker start"
                ;;
            "macOS"|"Windows")
                log_info "  請啟動 Docker Desktop 應用程式"
                ;;
        esac
        exit 1
    fi
    
    # 檢查 Docker Compose
    if command -v "docker-compose" &> /dev/null; then
        DOCKER_COMPOSE_CMD="docker-compose"
    elif docker compose version &> /dev/null; then
        DOCKER_COMPOSE_CMD="docker compose"
    else
        log_error "Docker Compose 未安裝"
        show_docker_install_guide
        exit 1
    fi
    
    # 檢查版本
    local docker_version=$(docker --version | cut -d' ' -f3 | cut -d',' -f1)
    local compose_version
    if [[ "$DOCKER_COMPOSE_CMD" == "docker-compose" ]]; then
        compose_version=$(docker-compose --version | cut -d' ' -f3 | cut -d',' -f1)
    else
        compose_version=$(docker compose version --short 2>/dev/null || echo "unknown")
    fi
    
    log_success "Docker 版本: $docker_version"
    log_success "Docker Compose 版本: $compose_version"
    
    # 檢查 Docker 權限
    if ! docker ps &> /dev/null; then
        log_warning "當前用戶可能沒有 Docker 權限"
        if [[ "$SYSTEM_TYPE" == "Linux" || "$SYSTEM_TYPE" == "WSL" ]]; then
            log_info "嘗試將用戶加入 docker 群組："
            log_info "  sudo usermod -aG docker \$USER"
            log_info "  然後重新登入或執行: newgrp docker"
        fi
        
        # 嘗試使用 sudo
        if sudo docker ps &> /dev/null; then
            log_warning "需要使用 sudo 權限運行 Docker"
            DOCKER_COMPOSE_CMD="sudo $DOCKER_COMPOSE_CMD"
        else
            log_error "無法訪問 Docker，請檢查權限設置"
            exit 1
        fi
    fi
}

# 顯示 Docker 安裝指南
show_docker_install_guide() {
    log_info "Docker 安裝指南："
    case $SYSTEM_TYPE in
        "Linux")
            log_info "  Ubuntu/Debian:"
            log_info "    curl -fsSL https://get.docker.com -o get-docker.sh"
            log_info "    sudo sh get-docker.sh"
            log_info "    sudo usermod -aG docker \$USER"
            ;;
        "WSL")
            log_info "  請在 Windows 中安裝 Docker Desktop"
            log_info "  下載地址: https://desktop.docker.com/win/main/amd64/Docker%20Desktop%20Installer.exe"
            ;;
        "macOS")
            log_info "  請安裝 Docker Desktop for Mac"
            if [[ "$ARCH" == "arm64" ]]; then
                log_info "  下載地址: https://desktop.docker.com/mac/main/arm64/Docker.dmg"
            else
                log_info "  下載地址: https://desktop.docker.com/mac/main/amd64/Docker.dmg"
            fi
            ;;
        "Windows")
            log_info "  請安裝 Docker Desktop for Windows"
            log_info "  下載地址: https://desktop.docker.com/win/main/amd64/Docker%20Desktop%20Installer.exe"
            ;;
    esac
    log_info "  官方文檔: https://docs.docker.com/get-docker/"
}

# 檢查網路連接
check_network() {
    log_step "檢查網路連接..."
    
    local test_urls=(
        "https://registry-1.docker.io"
        "https://github.com"
        "https://cdn.tailwindcss.com"
    )
    
    local failed_count=0
    for url in "${test_urls[@]}"; do
        if ! curl -s --connect-timeout 5 --max-time 10 "$url" > /dev/null; then
            log_warning "無法連接到 $url"
            ((failed_count++))
        fi
    done
    
    if [ $failed_count -eq ${#test_urls[@]} ]; then
        log_error "網路連接異常，請檢查網路設置"
        exit 1
    elif [ $failed_count -gt 0 ]; then
        log_warning "部分網路連接異常，可能影響下載速度"
    else
        log_success "網路連接正常"
    fi
}

# 檢查端口占用
check_ports() {
    log_step "檢查端口占用..."
    
    local ports=(80 5432 6379 8001 8002 8003 8004 8005 8007 8080 8081 8082 8083 9000 9001 27017)
    local occupied_ports=()
    
    for port in "${ports[@]}"; do
        if command -v netstat &> /dev/null; then
            if netstat -tuln 2>/dev/null | grep -q ":$port "; then
                occupied_ports+=($port)
            fi
        elif command -v ss &> /dev/null; then
            if ss -tuln 2>/dev/null | grep -q ":$port "; then
                occupied_ports+=($port)
            fi
        elif command -v lsof &> /dev/null; then
            if lsof -i :$port &>/dev/null; then
                occupied_ports+=($port)
            fi
        fi
    done
    
    if [ ${#occupied_ports[@]} -gt 0 ]; then
        log_warning "以下端口已被占用: ${occupied_ports[*]}"
        log_info "如果遇到端口衝突，請關閉占用端口的程序或修改 docker-compose.yml"
    else
        log_success "所有必要端口可用"
    fi
}

# 自動創建目錄結構
setup_directories() {
    log_step "建立目錄結構..."
    
    cd "$SCRIPT_DIR"
    
    # 建立必要目錄
    local directories=(
        "logs"
        "nginx/conf.d"
        "data/postgres"
        "data/mongodb"
        "data/redis"
        "data/minio"
        "files"
        "2_implementation/database"
        "2_implementation/database/seeds"
        "2_implementation/database/seeds/全題庫"
    )
    
    for dir in "${directories[@]}"; do
        if [ ! -d "$dir" ]; then
            mkdir -p "$dir"
            log_info "建立目錄: $dir"
        fi
    done
    
    # 設置權限
    chmod -R 755 logs nginx/conf.d files 2>/dev/null || true
    
    # 針對 logs 目錄額外設定擁有者權限，確保日誌寫入順暢
    if [ -d "logs" ]; then
        log_info "設定 logs 目錄權限..."
        sudo chown -R $USER:$USER logs/ || log_warning "無法設定 logs 目錄擁有者權限，請手動檢查。"
    fi

    log_success "目錄結構建立完成"
}

# 題庫載入進度監控
monitor_question_bank_loader_progress() {
    log_step "監控題庫資料載入進度..."

    local seeds_dir="2_implementation/database/seeds/全題庫"
    local images_total=""
    local questions_total=""

    # 計算圖片總數
    if [ -d "$seeds_dir" ]; then
        images_total=$(find "$seeds_dir" -type f -name "*.jpg" 2>/dev/null | wc -l | tr -d ' \n')
    fi

    # 計算題目總數（若系統有 python3）
    if command -v python3 &>/dev/null; then
        questions_total=$(python3 - <<'PY'
import os, json
base = '2_implementation/database/seeds/全題庫'
total = 0
for root, dirs, files in os.walk(base):
    if os.path.basename(root) == 'images':
        continue
    for f in files:
        if f.endswith('.json'):
            p = os.path.join(root, f)
            try:
                with open(p, 'r', encoding='utf-8') as fh:
                    data = json.load(fh)
                if isinstance(data, list):
                    total += len(data)
                elif isinstance(data, dict):
                    total += 1
            except Exception:
                pass
print(total)
PY
)
        questions_total=$(echo "$questions_total" | tr -d ' \n')
    fi

    local images_done=0
    local questions_done=0

    # 追蹤載入容器日誌
    $DOCKER_COMPOSE_CMD logs -f question-bank-loader 2>/dev/null | while IFS= read -r line; do
        # 圖片進度
        if [[ "$line" =~ 已上傳[[:space:]]+([0-9]+)[[:space:]]+張圖片 ]]; then
            images_done="${BASH_REMATCH[1]}"
        fi
        # 題目進度
        if [[ "$line" =~ 已載入[[:space:]]+([0-9]+)[[:space:]]+道題目 ]]; then
            questions_done="${BASH_REMATCH[1]}"
        fi

        # 計算百分比
        local img_pct="-"
        local q_pct="-"
        if [[ -n "$images_total" && "$images_total" =~ ^[0-9]+$ && $images_total -gt 0 ]]; then
            img_pct=$(( images_done * 100 / images_total ))
        fi
        if [[ -n "$questions_total" && "$questions_total" =~ ^[0-9]+$ && $questions_total -gt 0 ]]; then
            q_pct=$(( questions_done * 100 / questions_total ))
        fi

        # 顯示動態進度（覆蓋同一行）
        printf "\r🖼️ 圖片: %s/%s (%s%%)  |  📚 題目: %s/%s (%s%%) " \
            "$images_done" "${images_total:-?}" "${img_pct}" \
            "$questions_done" "${questions_total:-?}" "${q_pct}"

        # 完成通知（強制顯示 100%）
        if [[ "$line" =~ 資料載入完成 ]]; then
            echo
            images_total="$images_done"
            questions_total="$questions_done"
            printf "\r🖼️ 圖片: %s/%s (100%%)  |  📚 題目: %s/%s (100%%) \n" \
                "$images_done" "$images_total" "$questions_done" "$questions_total"
            log_success "題庫資料載入完成！圖片: ${images_done}/${images_total}；題目: ${questions_done}/${questions_total}"
            break
        fi
    done
}

# 檢查和建立環境變數檔案
setup_environment() {
    log_step "設置環境變數..."
    
    if [ ! -f .env ]; then
        if [ -f env.docker ]; then
            log_info "從 env.docker 建立 .env 檔案..."
            cp env.docker .env
        else
            log_info "建立預設 .env 檔案..."
            cat > .env << 'EOF'
# Database Configuration
POSTGRES_DB=inulearning
POSTGRES_USER=aipe-tester
POSTGRES_PASSWORD=aipe-tester
POSTGRES_HOST=postgres
POSTGRES_PORT=5432

# MongoDB Configuration
MONGODB_DATABASE=inulearning
MONGODB_USERNAME=aipe-tester
MONGODB_PASSWORD=aipe-tester
MONGODB_HOST=mongodb
MONGODB_PORT=27017

# Redis Configuration
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=aipe-tester

# MinIO Configuration
MINIO_ROOT_USER=aipe-tester
MINIO_ROOT_PASSWORD=aipe-tester
MINIO_HOST=minio
MINIO_PORT=9000

# JWT Configuration
JWT_SECRET_KEY=your-super-secret-jwt-key-change-this-in-production-$(date +%s)
JWT_ALGORITHM=HS256
JWT_ACCESS_TOKEN_EXPIRE_MINUTES=30

# Application Configuration
DEBUG=true
ENVIRONMENT=development

# System Configuration
SYSTEM_TYPE=${SYSTEM_TYPE}
ARCH=${ARCH}

# AI Analysis Configuration
GEMINI_API_KEY=
AI_ANALYSIS_MOCK=0
AI_CACHE_PREFIX=ai:v1:
AI_CACHE_TTL_SECONDS=604800
EOF
        fi
        log_success ".env 檔案已建立"
    else
        log_success ".env 檔案已存在"
    fi
}

# 清理舊環境
cleanup_old_environment() {
    log_step "清理舊環境..."
    
    # 停止並移除舊容器
    $DOCKER_COMPOSE_CMD down --remove-orphans --volumes 2>/dev/null || true
    
    # 清理未使用的 Docker 資源
    log_info "清理未使用的 Docker 資源..."
    docker system prune -f 2>/dev/null || true
    
    log_success "舊環境清理完成"
}

# 拉取和建立映像
pull_and_build() {
    log_step "準備 Docker 映像..."
    
    # 拉取基礎映像
    log_info "拉取基礎映像..."
    $DOCKER_COMPOSE_CMD pull --ignore-pull-failures 2>/dev/null || true
    
    # 建立自定義映像
    log_info "建立應用映像..."
    $DOCKER_COMPOSE_CMD build --parallel 2>/dev/null || $DOCKER_COMPOSE_CMD build
    
    log_success "映像準備完成"
}

# 啟動服務
start_services() {
    log_step "啟動服務..."
    
    # 分階段啟動
    log_info "啟動基礎服務..."
    $DOCKER_COMPOSE_CMD up -d postgres mongodb redis minio
    
    # 等待基礎服務就緒
    log_info "等待基礎服務啟動..."
    sleep 10
    
    log_info "啟動應用服務..."
    $DOCKER_COMPOSE_CMD up -d auth-service question-bank-service learning-service ai-analysis-service ai-analysis-worker parent-dashboard-service report-service teacher-management-service


    # 啟動題庫資料載入（一次性）
    log_info "啟動題庫資料載入..."
    $DOCKER_COMPOSE_CMD up -d question-bank-loader || true
    # 進度監控（背景執行，不阻塞主流程）
    monitor_question_bank_loader_progress &
    
    # 等待應用服務就緒
    log_info "等待應用服務啟動..."
    sleep 20
    
    log_info "啟動前端和代理服務..."
    $DOCKER_COMPOSE_CMD up -d student-frontend admin-frontend teacher-frontend parent-frontend nginx
    
    log_success "所有服務已啟動"
}

# 等待服務就緒
wait_for_services() {
    log_step "等待服務完全就緒..."
    
    local max_attempts=60
    local attempt=0
    
    while [ $attempt -lt $max_attempts ]; do
        attempt=$((attempt + 1))
        
        # 檢查關鍵服務
        local services_ready=true
        
        # 檢查資料庫
        if ! $DOCKER_COMPOSE_CMD exec -T postgres pg_isready -U aipe-tester &>/dev/null; then
            services_ready=false
        fi
        
        # 檢查 Redis
        if ! $DOCKER_COMPOSE_CMD exec -T redis redis-cli ping &>/dev/null; then
            services_ready=false
        fi
        
        # 檢查認證服務
        if ! curl -s -f http://localhost:8001/health > /dev/null 2>&1; then
            services_ready=false
        fi
        # 檢查題庫服務
        if ! curl -s -f http://localhost:8002/health > /dev/null 2>&1; then
            services_ready=false
        fi
        # 檢查學習服務
        if ! curl -s -f http://localhost:8003/health > /dev/null 2>&1; then
            services_ready=false
        fi
        # 檢查 AI 分析服務
        if ! curl -s -f http://localhost:8004/api/v1/ai/health > /dev/null 2>&1; then
            services_ready=false
        fi
        # 檢查 AI 佇列（若啟用 RQ）
        if curl -s -f http://localhost:8004/api/v1/ai/queue/health > /dev/null 2>&1; then
            :
        else
            log_warning "AI 佇列健康檢查不可用或未啟用 RQ（可忽略）"
        fi
        
        if [ "$services_ready" = true ]; then
            log_success "所有關鍵服務已就緒"
            break
        fi
        
        if [ $attempt -eq $max_attempts ]; then
            log_error "服務啟動超時，請檢查日誌"
            return 1
        fi
        
        echo -n "."
        sleep 2
    done
    
    # 額外等待時間確保穩定
    log_info "等待服務穩定..."
    sleep 10
}

# 初始化測試資料
initialize_test_data() {
    log_step "初始化測試資料..."
    
    # 檢查資料庫連接
    if ! $DOCKER_COMPOSE_CMD exec -T postgres pg_isready -U aipe-tester &>/dev/null; then
        log_warning "資料庫未就緒，跳過測試資料初始化"
        return
    fi
    
    # 檢查是否已有測試資料
    local user_count=$($DOCKER_COMPOSE_CMD exec -T postgres psql -U aipe-tester -d inulearning -t -c "SELECT COUNT(*) FROM users;" 2>/dev/null | tr -d ' \n' || echo "0")
    
    if [ "$user_count" -gt "5" ]; then
        log_success "測試資料已存在 ($user_count 個用戶)"
    else
        # 執行測試資料初始化
        if [ -f "2_implementation/database/seeds/postgresql/init-test-data.sql" ]; then
            log_info "執行測試資料初始化..."
            $DOCKER_COMPOSE_CMD exec -T postgres psql -U aipe-tester -d inulearning < 2_implementation/database/seeds/postgresql/init-test-data.sql 2>/dev/null || {
                log_warning "測試資料初始化失敗，使用基本用戶創建"
                create_basic_users
            }
        else
            log_info "創建基本測試用戶..."
            create_basic_users
        fi
    fi
    
    # 檢查知識點數據
    local knowledge_count=$($DOCKER_COMPOSE_CMD exec -T postgres psql -U aipe-tester -d inulearning -t -c "SELECT COUNT(*) FROM knowledge_points_master;" 2>/dev/null | tr -d ' \n' || echo "0")
    
    if [ "$knowledge_count" -gt "100" ]; then
        log_success "知識點數據已存在 ($knowledge_count 個知識點)"
    else
        log_info "初始化知識點數據..."
        if [ -f "2_implementation/database/seeds/postgresql/knowledge_points_seed.sql" ]; then
            $DOCKER_COMPOSE_CMD exec -T postgres psql -U aipe-tester -d inulearning < 2_implementation/database/seeds/postgresql/knowledge_points_seed.sql 2>/dev/null || {
                log_warning "知識點數據初始化失敗"
            }
            local new_knowledge_count=$($DOCKER_COMPOSE_CMD exec -T postgres psql -U aipe-tester -d inulearning -t -c "SELECT COUNT(*) FROM knowledge_points_master;" 2>/dev/null | tr -d ' \n' || echo "0")
            log_success "知識點數據初始化完成 ($new_knowledge_count 個知識點)"
        else
            log_warning "找不到知識點種子數據文件"
        fi
    fi
    
    log_success "測試資料初始化完成"
}

# 創建基本測試用戶
create_basic_users() {
    $DOCKER_COMPOSE_CMD exec -T postgres psql -U aipe-tester -d inulearning -c "
    INSERT INTO users (username, email, hashed_password, role, first_name, last_name, is_active, is_verified, created_at) VALUES 
    ('student01', 'student01@test.com', '\$2b\$12\$80NUNl/aAMIfCCfbqbRc7e0ADOB81Ibbv1LWHNe7FytsweVw5ySNm', 'student', '學生', '01', true, true, NOW()),
    ('teacher01', 'teacher01@test.com', '\$2b\$12\$80NUNl/aAMIfCCfbqbRc7e0ADOB81Ibbv1LWHNe7FytsweVw5ySNm', 'teacher', '01', true, true, NOW()),
    ('parent01', 'parent01@test.com', '\$2b\$12\$80NUNl/aAMIfCCfbqbRc7e0ADOB81Ibbv1LWHNe7FytsweVw5ySNm', 'parent', '家長', '01', true, true, NOW()),
    ('admin01', 'admin01@test.com', '\$2b\$12\$80NUNl/aAMIfCCfbqbRc7e0ADOB81Ibbv1LWHNe7FytsweVw5ySNm', 'admin', '管理員', '01', true, true, NOW())
    ON CONFLICT (email) DO NOTHING;
    " 2>/dev/null || true
}

# 健康檢查
health_check() {
    log_step "執行系統健康檢查..."
    
    local services=("postgres" "mongodb" "redis" "minio" "auth-service" "question-bank-service" "learning-service" "ai-analysis-service" "parent-dashboard-service" "report-service" "nginx")
    local frontend_services=("student-frontend" "admin-frontend" "teacher-frontend" "parent-frontend")
    local failed_services=()
    
    # 檢查後端服務
    for service in "${services[@]}"; do
        if $DOCKER_COMPOSE_CMD ps "$service" | grep -q "Up"; then
            log_success "$service 運行正常"
        else
            log_warning "$service 狀態異常"
            failed_services+=("$service")
        fi
    done
    
    # 檢查前端服務
    for service in "${frontend_services[@]}"; do
        if $DOCKER_COMPOSE_CMD ps "$service" | grep -q "Up"; then
            log_success "$service 運行正常"
        else
            log_warning "$service 狀態異常"
            failed_services+=("$service")
        fi
    done
    
    if [ ${#failed_services[@]} -gt 0 ]; then
        log_warning "以下服務狀態異常: ${failed_services[*]}"
        log_info "請使用以下命令檢查日誌："
        for service in "${failed_services[@]}"; do
            log_info "  $DOCKER_COMPOSE_CMD logs $service"
        done
    fi
}

# 連通性測試
test_connectivity() {
    log_step "測試服務連通性..."
    
    local endpoints=(
        "http://localhost:8080|學生端前端"
        "http://localhost:8081|管理員端前端"
        "http://localhost:8082|家長端前端"
        "http://localhost:8083|教師端前端"
        "http://localhost:8001/health|認證服務健康檢查"
        "http://localhost:8002/health|題庫服務健康檢查"
        "http://localhost:8003/health|學習服務健康檢查"
        "http://localhost/|Nginx代理服務"
        "http://localhost:8004/api/v1/ai/health|AI 分析服務健康檢查"
        "http://localhost:8005/health|家長儀表板服務健康檢查"
        "http://localhost:8007/health|報告服務健康檢查"
    )
    
    local failed_endpoints=()
    
    for endpoint in "${endpoints[@]}"; do
        local url="${endpoint%|*}"
        local name="${endpoint#*|}"
        
        if curl -s -f --connect-timeout 5 --max-time 10 "$url" > /dev/null 2>&1; then
            log_success "$name 可訪問"
        else
            log_warning "$name 暫時無法訪問"
            failed_endpoints+=("$name")
        fi
    done
    
    if [ ${#failed_endpoints[@]} -eq 0 ]; then
        log_success "所有服務連通性正常"
    else
        log_warning "部分服務暫時無法訪問，請稍後重試"
    fi
}

# 顯示系統資訊
show_system_info() {
    echo ""
    echo "🎉 InULearning 系統啟動完成！"
    echo "================================================"
    echo ""
    log_highlight "📋 服務訪問地址："
    echo "  🏠 統一入口 (首頁): http://localhost/"
    echo "  🔐 統一登入頁面: http://localhost/login.html"
    echo "  📝 統一註冊頁面: http://localhost/register.html"
    echo "  🎓 學生端前端: http://localhost:8080"
    echo "  👨‍💼 管理員端前端: http://localhost:8081"
    echo "  👪 家長端前端: http://localhost:8082"
    echo "  👨‍🏫 教師端前端: http://localhost:8083"
    echo ""
    log_highlight "🔐 API 服務地址："
    echo "  認證服務: http://localhost:8001"
    echo "  題庫服務: http://localhost:8002"
    echo "  學習服務: http://localhost:8003"
    echo "  AI 分析服務: http://localhost:8004"
    echo "  家長儀表板服務: http://localhost:8005"
    echo "  報告服務: http://localhost:8007"
    echo ""
    log_highlight "🗄️ 資料庫服務："
    echo "  PostgreSQL: localhost:5432"
    echo "  MongoDB: localhost:27017"
    echo "  Redis: localhost:6379"
    echo "  MinIO: http://localhost:9000 (Console: http://localhost:9001)"
    echo ""
    log_highlight "📝 測試帳號 (密碼都是 password123)："
    echo "  👨‍🎓 學生帳號: student01@test.com"
    echo "  👨‍🏫 教師帳號: teacher01@test.com"
    echo "  👪 家長帳號: parent01@test.com"
    echo "  👨‍💼 管理員帳號: admin01@test.com"
    echo ""
    log_highlight "🔧 管理命令："
    echo "  查看所有服務狀態: $DOCKER_COMPOSE_CMD ps"
    echo "  查看服務日誌: $DOCKER_COMPOSE_CMD logs -f [服務名]"
    echo "  停止所有服務: $DOCKER_COMPOSE_CMD down"
    echo "  重啟特定服務: $DOCKER_COMPOSE_CMD restart [服務名]"
    echo "  進入容器: $DOCKER_COMPOSE_CMD exec [服務名] bash"
    echo ""
    log_highlight "🔍 故障排除："
    echo "  • 如果服務無法訪問，請等待 1-2 分鐘後重試"
    echo "  • 查看服務日誌: $DOCKER_COMPOSE_CMD logs -f"
    echo "  • 重新啟動系統: ./start.sh"
    echo "  • 完全重置: $DOCKER_COMPOSE_CMD down -v && ./start.sh"
    echo ""
    log_highlight "💡 系統資訊："
    echo "  作業系統: $SYSTEM_TYPE ($ARCH)"
    echo "  記憶體: ${MEMORY_GB}GB"
    echo "  Docker Compose: $DOCKER_COMPOSE_CMD"
    echo "  工作目錄: $SCRIPT_DIR"
    echo ""
    echo "✨ 開始使用 InULearning 吧！"
    echo "================================================"
}

# 主執行流程
main() {
    echo "🚀 InULearning 一鍵啟動腳本 v2.0.0"
    echo "跨裝置優化版 - 支援 Linux, macOS, Windows"
    echo "================================================"
    echo ""
    
    # 系統檢測
    detect_system
    check_required_tools
    check_docker
    check_network
    check_ports
    
    # 環境準備
    setup_directories
    setup_environment
    
    # 服務啟動
    cleanup_old_environment
    pull_and_build
    start_services
    wait_for_services
    
    # 資料初始化
    initialize_test_data
    
    # 系統檢查
    health_check
    test_connectivity
    
    # 顯示結果
    show_system_info
    
    log_success "🎉 InULearning 啟動流程完成！"
}

# 檢查是否為直接執行
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi
