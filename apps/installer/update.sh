#!/bin/bash
set -euo pipefail

# ─── Colors ──────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
RESET='\033[0m'

log_info()    { echo -e "${CYAN}[INFO]${RESET}  $*"; }
log_success() { echo -e "${GREEN}[OK]${RESET}    $*"; }
log_error()   { echo -e "${RED}[ERROR]${RESET} $*" >&2; }
log_warning() { echo -e "${YELLOW}[WARN]${RESET}  $*"; }
log_step()    { echo -e "\n${BOLD}${CYAN}$*${RESET}"; }

INSTALL_DIR="${XP_INSTALL_DIR:-/opt/xtreampulsar}"

# ─── Checks ───────────────────────────────────────────────────────────────────
if [[ $EUID -ne 0 ]]; then
  log_error "Bu script root olarak çalıştırılmalıdır: sudo $0"
  exit 1
fi

if [[ ! -f "$INSTALL_DIR/docker-compose.yml" ]]; then
  log_error "XtreamPulsar kurulumu bulunamadı: $INSTALL_DIR"
  log_error "Önce install.sh çalıştırın."
  exit 1
fi

cd "$INSTALL_DIR"

echo -e "${BOLD}${CYAN}XtreamPulsar — Güncelleme${RESET}"
echo "────────────────────────────────────────"

# ─── Mevcut versiyon ─────────────────────────────────────────────────────────
log_step "▶ Mevcut durum kontrol ediliyor..."
CURRENT_API=$(docker compose images api --format json 2>/dev/null | \
  grep -o '"Tag":"[^"]*"' | head -1 | cut -d'"' -f4 || echo "bilinmiyor")
CURRENT_WEB=$(docker compose images web --format json 2>/dev/null | \
  grep -o '"Tag":"[^"]*"' | head -1 | cut -d'"' -f4 || echo "bilinmiyor")
log_info "Mevcut API imaj versiyonu : $CURRENT_API"
log_info "Mevcut Web imaj versiyonu : $CURRENT_WEB"

# ─── Yeni imajları çek ───────────────────────────────────────────────────────
log_step "▶ Yeni imajlar indiriliyor..."
docker compose pull 2>&1 | while IFS= read -r line; do
  echo -e "  ${line}"
done

# ─── Versiyon değişti mi kontrol et ─────────────────────────────────────────
NEW_API=$(docker compose images api --format json 2>/dev/null | \
  grep -o '"Tag":"[^"]*"' | head -1 | cut -d'"' -f4 || echo "bilinmiyor")
NEW_WEB=$(docker compose images web --format json 2>/dev/null | \
  grep -o '"Tag":"[^"]*"' | head -1 | cut -d'"' -f4 || echo "bilinmiyor")

if [[ "$CURRENT_API" == "$NEW_API" && "$CURRENT_WEB" == "$NEW_WEB" ]]; then
  log_success "XtreamPulsar zaten güncel (API: $CURRENT_API, Web: $CURRENT_WEB)."
  exit 0
fi

log_info "Güncelleme bulundu:"
[[ "$CURRENT_API" != "$NEW_API" ]] && log_info "  API : $CURRENT_API → $NEW_API"
[[ "$CURRENT_WEB" != "$NEW_WEB" ]] && log_info "  Web : $CURRENT_WEB → $NEW_WEB"

# ─── Yedek al ────────────────────────────────────────────────────────────────
log_step "▶ Yedek alınıyor..."
BACKUP_DIR="/opt/xp-backup-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"
cp "$INSTALL_DIR/.env" "$BACKUP_DIR/.env.bak" 2>/dev/null || true
log_info "Yedek dizini: $BACKUP_DIR"

# PostgreSQL dump al
docker compose exec -T postgres pg_dump \
  -U xtreampulsar xtreampulsar \
  > "$BACKUP_DIR/db-$(date +%Y%m%d-%H%M%S).sql" 2>/dev/null && \
  log_success "Veritabanı yedeği alındı" || \
  log_warning "Veritabanı yedeği alınamadı — devam ediliyor"

# ─── Servisleri güncelle ─────────────────────────────────────────────────────
log_step "▶ Servisler güncelleniyor..."
docker compose up -d --remove-orphans
log_success "Konteynerler güncellendi"

# ─── Migration ───────────────────────────────────────────────────────────────
log_step "▶ Database migration çalıştırılıyor..."
sleep 10
docker compose exec -T api sh -c "cd /repo/packages/database && npx prisma migrate deploy" 2>/dev/null && \
  log_success "Migration tamamlandı" || \
  log_warning "Migration başarısız veya gerekli değil"

# ─── Health check ─────────────────────────────────────────────────────────────
log_step "▶ Sağlık kontrolü..."
sleep 15
for i in $(seq 1 5); do
  if curl -sf http://localhost:3000/health &>/dev/null; then
    log_success "API sağlıklı"
    break
  fi
  if [[ $i -eq 5 ]]; then
    log_error "API health check başarısız. Önceki versiyona geri dönmek için:"
    log_error "  cd $INSTALL_DIR && docker compose down && docker compose up -d --no-pull"
    exit 1
  fi
  log_info "Bekleniyor ($i/5)..."
  sleep 10
done

echo ""
echo -e "${GREEN}${BOLD}Güncelleme tamamlandı!${RESET}"
echo -e "  API : $CURRENT_API → $NEW_API"
echo -e "  Web : $CURRENT_WEB → $NEW_WEB"
echo -e "  Yedek: $BACKUP_DIR"
