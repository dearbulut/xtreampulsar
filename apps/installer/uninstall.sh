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

INSTALL_DIR="${XP_INSTALL_DIR:-/opt/xtreampulsar}"

# ─── Root kontrolü ───────────────────────────────────────────────────────────
if [[ $EUID -ne 0 ]]; then
  log_error "Bu script root olarak çalıştırılmalıdır: sudo $0"
  exit 1
fi

# ─── Uyarı banner ────────────────────────────────────────────────────────────
echo ""
echo -e "${RED}${BOLD}"
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║           ⚠  XTREAMPULSAR KALDIRILACAK  ⚠                 ║"
echo "╠══════════════════════════════════════════════════════════════╣"
echo "║  Bu işlem aşağıdakileri KALICI OLARAK SİLECEK:             ║"
echo "║    • Tüm Docker konteynerleri ve imajları                   ║"
echo "║    • Tüm veritabanı verileri (kullanıcılar, akışlar vs.)   ║"
echo "║    • $INSTALL_DIR dizini ve tüm içeriği           ║"
echo "║    • Firewall kuralları (80, 443, 25461)                   ║"
echo "║                                                              ║"
echo "║  Bu işlem GERİ ALINAMAZ!                                   ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo -e "${RESET}"

# ─── İlk onay ────────────────────────────────────────────────────────────────
echo -e "${YELLOW}Devam etmek için ${BOLD}XTREAMPULSAR${RESET}${YELLOW} yazın (büyük harf):${RESET}"
read -r CONFIRM1
if [[ "$CONFIRM1" != "XTREAMPULSAR" ]]; then
  log_info "Kaldırma iptal edildi."
  exit 0
fi

# ─── İkinci onay ─────────────────────────────────────────────────────────────
echo -e "${RED}${BOLD}Son uyarı!${RESET} Tüm veriler silinecek. Emin misiniz?"
echo -e "${YELLOW}Onaylamak için tekrar ${BOLD}XTREAMPULSAR${RESET}${YELLOW} yazın:${RESET}"
read -r CONFIRM2
if [[ "$CONFIRM2" != "XTREAMPULSAR" ]]; then
  log_info "Kaldırma iptal edildi."
  exit 0
fi

echo ""
log_warning "Kaldırma işlemi başlıyor..."

# ─── Veritabanı yedeği (opsiyonel) ──────────────────────────────────────────
if [[ -f "$INSTALL_DIR/docker-compose.yml" ]]; then
  echo -ne "${YELLOW}Kaldırmadan önce veritabanı yedeği almak ister misiniz? [e/H]: ${RESET}"
  read -r DO_BACKUP
  if [[ "$DO_BACKUP" =~ ^[eEyY] ]]; then
    BACKUP_FILE="/root/xp-backup-$(date +%Y%m%d-%H%M%S).sql"
    cd "$INSTALL_DIR"
    docker compose exec -T postgres pg_dump \
      -U xtreampulsar xtreampulsar > "$BACKUP_FILE" 2>/dev/null && \
      log_success "Yedek alındı: $BACKUP_FILE" || \
      log_warning "Yedek alınamadı"
  fi
fi

# ─── Docker servislerini durdur ve kaldır ────────────────────────────────────
log_info "Docker konteynerleri durduruluyor..."
if [[ -f "$INSTALL_DIR/docker-compose.yml" ]]; then
  cd "$INSTALL_DIR"
  docker compose down -v --remove-orphans 2>/dev/null || true
  log_success "Konteynerler ve volume'lar durduruldu ve kaldırıldı"
else
  log_warning "docker-compose.yml bulunamadı, Docker kaldırma atlanıyor"
fi

# ─── Kurulum dizinini sil ────────────────────────────────────────────────────
log_info "Kurulum dizini siliniyor: $INSTALL_DIR"
rm -rf "$INSTALL_DIR"
log_success "Kurulum dizini silindi"

# ─── Firewall kurallarını kaldır ─────────────────────────────────────────────
log_info "Firewall kuralları kaldırılıyor..."
ufw delete allow 80/tcp  &>/dev/null || true
ufw delete allow 443/tcp &>/dev/null || true
ufw delete allow 25461/tcp &>/dev/null || true
log_success "Firewall kuralları (80, 443, 25461) kaldırıldı"
log_info   "SSH (22) kuralı korundu"

# ─── Docker imajlarını temizle (opsiyonel) ───────────────────────────────────
echo -ne "${YELLOW}Docker imajlarını da kaldırmak ister misiniz? (disk kazanımı) [e/H]: ${RESET}"
read -r DO_PRUNE
if [[ "$DO_PRUNE" =~ ^[eEyY] ]]; then
  docker image prune -a -f --filter "label=com.xtreampulsar=true" 2>/dev/null || \
  docker image prune -f 2>/dev/null || true
  log_success "Docker imajları temizlendi"
fi

# ─── Tamamlandı ──────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}${BOLD}XtreamPulsar başarıyla kaldırıldı.${RESET}"
echo ""
echo -e "${YELLOW}Dikkat: Aşağıdakiler kaldırılmadı:${RESET}"
echo -e "  • Docker engine (kaldırmak için: apt-get remove -y docker-ce docker-ce-cli)"
echo -e "  • FFmpeg (kaldırmak için: apt-get remove -y ffmpeg)"
echo -e "  • SSH firewall kuralı (port 22)"
if [[ -n "${BACKUP_FILE:-}" ]]; then
  echo -e "  • Veritabanı yedeği: $BACKUP_FILE"
fi
