#!/bin/bash

# ─── Colors & Symbols ────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
RESET='\033[0m'
OK="${GREEN}✓${RESET}"
FAIL="${RED}✗${RESET}"
WARN="${YELLOW}⚠${RESET}"

INSTALL_DIR="${XP_INSTALL_DIR:-/opt/xtreampulsar}"
PASS_COUNT=0
FAIL_COUNT=0
WARN_COUNT=0

# ─── Header ──────────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}${CYAN}XtreamPulsar — Sistem Sağlık Kontrolü${RESET}"
echo -e "$(date '+%Y-%m-%d %H:%M:%S')"
echo "════════════════════════════════════════════════════════════════"

# ─── Helper ──────────────────────────────────────────────────────────────────
result_ok()   { echo -e "  ${OK}  $(printf '%-40s' "$1") ${GREEN}${2:-OK}${RESET}"; ((PASS_COUNT++)); }
result_fail() { echo -e "  ${FAIL}  $(printf '%-40s' "$1") ${RED}${2:-HATA}${RESET}"; ((FAIL_COUNT++)); }
result_warn() { echo -e "  ${WARN}  $(printf '%-40s' "$1") ${YELLOW}${2:-UYARI}${RESET}"; ((WARN_COUNT++)); }
section()     { echo -e "\n${BOLD}$*${RESET}"; }

# ─── 1. Docker Servisleri ────────────────────────────────────────────────────
section "● Docker Servisleri"

if ! command -v docker &>/dev/null; then
  result_fail "Docker kurulumu" "Kurulu değil"
else
  DOCKER_VER=$(docker --version | grep -oP '\d+\.\d+' | head -1)
  result_ok "Docker" "v${DOCKER_VER}"

  if [[ -f "$INSTALL_DIR/docker-compose.yml" ]]; then
    cd "$INSTALL_DIR"

    SERVICES=("postgres" "redis" "api" "web" "nginx" "license")
    for svc in "${SERVICES[@]}"; do
      STATUS=$(docker compose ps --status running "$svc" 2>/dev/null | grep "$svc" | awk '{print $NF}')
      if [[ "$STATUS" == "running" ]]; then
        UPTIME=$(docker compose ps "$svc" 2>/dev/null | grep "$svc" | grep -oP '\(.*?\)' | head -1 || echo "")
        result_ok "Konteyner: $svc" "Çalışıyor $UPTIME"
      else
        CONTAINER_STATUS=$(docker compose ps "$svc" 2>/dev/null | grep "$svc" | awk '{print $(NF-1), $NF}' || echo "bulunamadı")
        result_fail "Konteyner: $svc" "$CONTAINER_STATUS"
      fi
    done
  else
    result_warn "docker-compose.yml" "$INSTALL_DIR bulunamadı"
  fi
fi

# ─── 2. API Health ───────────────────────────────────────────────────────────
section "● API Sağlık"

API_HEALTH=$(curl -sf --max-time 5 http://localhost:3000/health 2>/dev/null || echo "")
if [[ -n "$API_HEALTH" ]]; then
  result_ok "API health endpoint" "http://localhost:3000/health"
  # Status detayları
  DB_STATUS=$(echo "$API_HEALTH" | grep -o '"database":{"status":"[^"]*"' | grep -o '"[^"]*"$' | tr -d '"' || echo "?")
  REDIS_STATUS=$(echo "$API_HEALTH" | grep -o '"redis":{"status":"[^"]*"' | grep -o '"[^"]*"$' | tr -d '"' || echo "?")
  [[ "$DB_STATUS" == "up" ]] && result_ok "  API → Database" "up" || result_warn "  API → Database" "$DB_STATUS"
  [[ "$REDIS_STATUS" == "up" ]] && result_ok "  API → Redis" "up" || result_warn "  API → Redis" "$REDIS_STATUS"
else
  result_fail "API health endpoint" "Yanıt vermiyor"
fi

# License status
LICENSE_STATUS=$(curl -sf --max-time 5 http://localhost:3000/api/v1/license/status 2>/dev/null || echo "")
if [[ -n "$LICENSE_STATUS" ]]; then
  IS_VALID=$(echo "$LICENSE_STATUS" | grep -o '"valid":[^,}]*' | cut -d: -f2 | tr -d ' ' || echo "?")
  TIER=$(echo "$LICENSE_STATUS" | grep -o '"tier":"[^"]*"' | cut -d'"' -f4 || echo "?")
  if [[ "$IS_VALID" == "true" ]]; then
    result_ok "Lisans durumu" "Geçerli (Tier: $TIER)"
  else
    result_warn "Lisans durumu" "Geçersiz veya belirsiz"
  fi
else
  result_warn "Lisans endpoint" "Yanıt vermiyor"
fi

# ─── 3. PostgreSQL ───────────────────────────────────────────────────────────
section "● PostgreSQL"

if [[ -f "$INSTALL_DIR/docker-compose.yml" ]]; then
  cd "$INSTALL_DIR"
  if docker compose exec -T postgres pg_isready -U xtreampulsar &>/dev/null; then
    # Tablo sayısını kontrol et
    TABLE_COUNT=$(docker compose exec -T postgres psql -U xtreampulsar -d xtreampulsar -t \
      -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public';" \
      2>/dev/null | tr -d ' \n' || echo "?")
    result_ok "PostgreSQL bağlantısı" "Hazır (${TABLE_COUNT} tablo)"

    # Aktif bağlantı sayısı
    CONN_COUNT=$(docker compose exec -T postgres psql -U xtreampulsar -d xtreampulsar -t \
      -c "SELECT COUNT(*) FROM pg_stat_activity WHERE state='active';" \
      2>/dev/null | tr -d ' \n' || echo "?")
    result_ok "Aktif DB bağlantıları" "$CONN_COUNT"
  else
    result_fail "PostgreSQL bağlantısı" "Yanıt vermiyor"
  fi
else
  # Doğrudan bağlantı dene
  if pg_isready -h localhost -p 5432 &>/dev/null; then
    result_ok "PostgreSQL" "Çalışıyor"
  else
    result_warn "PostgreSQL" "docker-compose.yml bulunamadı — kontrol atlandı"
  fi
fi

# ─── 4. Redis ────────────────────────────────────────────────────────────────
section "● Redis"

if [[ -f "$INSTALL_DIR/docker-compose.yml" ]]; then
  cd "$INSTALL_DIR"
  REDIS_PING=$(docker compose exec -T redis redis-cli ping 2>/dev/null | tr -d '\r\n' || echo "")
  if [[ "$REDIS_PING" == "PONG" ]]; then
    REDIS_MEM=$(docker compose exec -T redis redis-cli info memory 2>/dev/null | \
      grep "used_memory_human:" | cut -d: -f2 | tr -d '\r\n ' || echo "?")
    result_ok "Redis bağlantısı" "PONG (Bellek: ${REDIS_MEM})"
  else
    result_fail "Redis bağlantısı" "PING başarısız"
  fi
else
  if redis-cli ping 2>/dev/null | grep -q "PONG"; then
    result_ok "Redis" "Çalışıyor"
  else
    result_warn "Redis" "Kontrol atlandı"
  fi
fi

# ─── 5. Disk Kullanımı ────────────────────────────────────────────────────────
section "● Disk Kullanımı"

ROOT_USAGE=$(df -h / | awk 'NR==2{print $5}' | tr -d '%')
ROOT_AVAIL=$(df -h / | awk 'NR==2{print $4}')
ROOT_TOTAL=$(df -h / | awk 'NR==2{print $2}')
if [[ "$ROOT_USAGE" -lt 80 ]]; then
  result_ok "/ (kök disk)" "${ROOT_AVAIL} boş / ${ROOT_TOTAL} (%%${ROOT_USAGE} kullanımda)"
elif [[ "$ROOT_USAGE" -lt 90 ]]; then
  result_warn "/ (kök disk)" "${ROOT_AVAIL} boş / ${ROOT_TOTAL} (%%${ROOT_USAGE} kullanımda)"
else
  result_fail "/ (kök disk)" "${ROOT_AVAIL} boş / ${ROOT_TOTAL} (%%${ROOT_USAGE} DOLU!)"
fi

HLS_DIR="${HLS_OUTPUT_PATH:-/tmp/xtreampulsar/hls}"
if [[ -d "$HLS_DIR" ]]; then
  HLS_SIZE=$(du -sh "$HLS_DIR" 2>/dev/null | cut -f1 || echo "?")
  HLS_COUNT=$(find "$HLS_DIR" -name "*.ts" 2>/dev/null | wc -l)
  result_ok "HLS dizini" "${HLS_DIR} (${HLS_SIZE}, ${HLS_COUNT} segment)"
else
  result_warn "HLS dizini" "$HLS_DIR mevcut değil"
fi

# Docker volume kullanımı
DOCKER_USAGE=$(docker system df --format "{{.Size}}" 2>/dev/null | head -1 || echo "?")
result_ok "Docker toplam kullanım" "$DOCKER_USAGE"

# ─── 6. RAM Kullanımı ────────────────────────────────────────────────────────
section "● RAM Kullanımı"

TOTAL_RAM=$(free -m | awk '/^Mem:/{print $2}')
USED_RAM=$(free -m  | awk '/^Mem:/{print $3}')
FREE_RAM=$(free -m  | awk '/^Mem:/{print $4}')
RAM_PCT=$(( USED_RAM * 100 / TOTAL_RAM ))

if [[ "$RAM_PCT" -lt 80 ]]; then
  result_ok "RAM kullanımı" "${USED_RAM}MB / ${TOTAL_RAM}MB (%%${RAM_PCT})"
elif [[ "$RAM_PCT" -lt 90 ]]; then
  result_warn "RAM kullanımı" "${USED_RAM}MB / ${TOTAL_RAM}MB (%%${RAM_PCT})"
else
  result_fail "RAM kullanımı" "${USED_RAM}MB / ${TOTAL_RAM}MB (%%${RAM_PCT} YÜKSEK!)"
fi

# Swap
SWAP_TOTAL=$(free -m | awk '/^Swap:/{print $2}')
SWAP_USED=$(free -m  | awk '/^Swap:/{print $3}')
if [[ "$SWAP_TOTAL" -gt 0 ]]; then
  result_ok "Swap" "${SWAP_USED}MB / ${SWAP_TOTAL}MB kullanımda"
else
  result_warn "Swap" "Swap alanı yapılandırılmamış"
fi

# ─── 7. FFmpeg ────────────────────────────────────────────────────────────────
section "● FFmpeg"

if command -v ffmpeg &>/dev/null; then
  FFMPEG_VER=$(ffmpeg -version 2>&1 | head -1 | grep -oP 'version \K\S+')
  result_ok "FFmpeg" "v$FFMPEG_VER ($(which ffmpeg))"
else
  result_fail "FFmpeg" "Kurulu değil!"
fi

# API konteynerinde ffmpeg var mı?
if [[ -f "$INSTALL_DIR/docker-compose.yml" ]]; then
  cd "$INSTALL_DIR"
  API_FFMPEG=$(docker compose exec -T api ffmpeg -version 2>/dev/null | head -1 | grep -oP 'version \K\S+' || echo "")
  if [[ -n "$API_FFMPEG" ]]; then
    result_ok "FFmpeg (API konteyneri)" "v$API_FFMPEG"
  else
    result_warn "FFmpeg (API konteyneri)" "Bulunamadı"
  fi
fi

# ─── 8. Ağ / Port Kontrolü ───────────────────────────────────────────────────
section "● Ağ & Port Durumu"

check_port() {
  local port=$1
  local desc=$2
  if ss -tlnp 2>/dev/null | grep -q ":${port} " || \
     netstat -tlnp 2>/dev/null | grep -q ":${port} "; then
    result_ok "$desc (port $port)" "Dinleniyor"
  else
    result_warn "$desc (port $port)" "Dinlenmiyor"
  fi
}

check_port 80    "HTTP"
check_port 443   "HTTPS"
check_port 25461 "Xtream API"
check_port 3000  "API (internal)"

# UFW durumu
UFW_STATUS=$(ufw status 2>/dev/null | head -1 || echo "bilinmiyor")
if echo "$UFW_STATUS" | grep -q "active"; then
  result_ok "Firewall (ufw)" "Aktif"
else
  result_warn "Firewall (ufw)" "$UFW_STATUS"
fi

# ─── Özet ─────────────────────────────────────────────────────────────────────
echo ""
echo "════════════════════════════════════════════════════════════════"
TOTAL=$((PASS_COUNT + FAIL_COUNT + WARN_COUNT))
echo -e "  ${GREEN}✓ Başarılı: ${PASS_COUNT}${RESET}   ${YELLOW}⚠ Uyarı: ${WARN_COUNT}${RESET}   ${RED}✗ Hata: ${FAIL_COUNT}${RESET}   (Toplam: ${TOTAL})"
echo "════════════════════════════════════════════════════════════════"

if [[ "$FAIL_COUNT" -gt 0 ]]; then
  echo -e "${RED}${BOLD}Kritik sorunlar var! Lütfen ✗ işaretli servisleri inceleyin.${RESET}"
  echo -e "Log için: cd $INSTALL_DIR && docker compose logs [servis-adı]"
  exit 1
elif [[ "$WARN_COUNT" -gt 0 ]]; then
  echo -e "${YELLOW}Uyarılar var — sistem çalışıyor ancak dikkat gerektiren noktalar mevcut.${RESET}"
  exit 0
else
  echo -e "${GREEN}${BOLD}Tüm kontroller başarılı! Sistem sağlıklı.${RESET}"
  exit 0
fi
