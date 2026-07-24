#!/bin/bash
set -euo pipefail

# ─── Colors & Symbols ────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
RESET='\033[0m'
CHECK="${GREEN}✓${RESET}"
CROSS="${RED}✗${RESET}"

# ─── Logging ─────────────────────────────────────────────────────────────────
log_info()    { echo -e "${BLUE}[INFO]${RESET}  $*"; }
log_success() { echo -e "${GREEN}[OK]${RESET}    $*"; }
log_error()   { echo -e "${RED}[ERROR]${RESET} $*" >&2; }
log_warning() { echo -e "${YELLOW}[WARN]${RESET}  $*"; }
log_step()    { echo -e "\n${BOLD}${CYAN}$*${RESET}"; }

# ─── Spinner ─────────────────────────────────────────────────────────────────
spinner() {
  local pid=$1
  local msg="${2:-Lütfen bekleyin...}"
  local frames=('⠋' '⠙' '⠹' '⠸' '⠼' '⠴' '⠦' '⠧' '⠇' '⠏')
  local i=0
  while kill -0 "$pid" 2>/dev/null; do
    printf "\r${CYAN}%s${RESET}  %s" "${frames[$((i % ${#frames[@]}))]}" "$msg"
    i=$((i + 1))
    sleep 0.1
  done
  printf "\r\033[K"
}

# ─── Helpers ─────────────────────────────────────────────────────────────────
generate_password() {
  openssl rand -base64 18 | tr -dc 'a-zA-Z0-9' | head -c 20
}

check_command() {
  command -v "$1" &>/dev/null
}

run_with_spinner() {
  local msg="$1"; shift
  "$@" &>/tmp/xp_install.log &
  local pid=$!
  spinner "$pid" "$msg"
  if ! wait "$pid"; then
    log_error "$msg — başarısız. Log: /tmp/xp_install.log"
    cat /tmp/xp_install.log >&2
    exit 1
  fi
}

# ─── Argument Parsing ─────────────────────────────────────────────────────────
LICENSE_KEY=""
SELFHOST_MODE=false
DOMAIN=""
EMAIL=""
INSTALL_DIR="/opt/xtreampulsar"
REPO_URL="https://github.com/dearbulut/xtreampulsar"
LICENSE_SERVER="https://license.xtreampulsar.com"
DEV_MODE=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --key)     LICENSE_KEY="$2"; shift 2 ;;
    --domain)  DOMAIN="$2";      shift 2 ;;
    --email)   EMAIL="$2";       shift 2 ;;
    --dir)     INSTALL_DIR="$2"; shift 2 ;;
    --dev)     DEV_MODE=true;    shift ;;
    --help|-h)
      echo "Kullanım: $0 [--key LICENSE_KEY] [--domain DOMAIN] [--email EMAIL] [--dev]"
      echo "  --key   Opsiyonel. Verilmezse açık kaynak / self-host modda (lisanssız) kurulur."
      echo "  --dev   Geliştirme modu: lisans doğrulaması atlanır, test anahtarı kullanılır"
      exit 0 ;;
    *) log_error "Bilinmeyen parametre: $1"; exit 1 ;;
  esac
done

# ─── Banner ───────────────────────────────────────────────────────────────────
echo -e "${BOLD}${CYAN}"
cat <<'EOF'
 __  __  _____ ______  _____          __  __ _____  _    _ _      _____         _____
 \ \/ / |_   _|  ____|/ ____|        |  \/  |  __ \| |  | | |    / ____|  /\   |  __ \
  \  /    | | | |__  | |     _______ | \  / | |__) | |  | | |   | (___   /  \  | |__) |
  /  \    | | |  __| | |    |_______|| |\/| |  ___/| |  | | |    \___ \ / /\ \ |  _  /
 / /\ \  _| |_| |____| |____         | |  | | |    | |__| | |____ ____) / ____ \| | \ \
/_/  \_\|_____|______|\_____|        |_|  |_|_|     \____/|______|_____/_/    \_\_|  \_\
EOF
echo -e "${RESET}"
echo -e "${BOLD}XtreamPulsar Panel — Kurulum Sihirbazı v1.1${RESET}"
echo -e "────────────────────────────────────────────────────────────────────"

# ─── Pre-flight Checks ───────────────────────────────────────────────────────
log_step "▶ Ön kontroller"

# Lisans opsiyonel: anahtar verilmezse acik-kaynak / self-host modunda kurulur (lisans yok).
if [[ -z "$LICENSE_KEY" && "$DEV_MODE" = false ]]; then
  SELFHOST_MODE=true
  log_info "Lisans anahtari verilmedi -> acik kaynak / self-host modu (lisans dogrulamasi yok)."
fi

if [[ "$DEV_MODE" = true ]]; then
  log_warning "DEV MODE aktif — lisans doğrulaması atlanacak, test ortamı kurulacak"
fi

# Root / sudo kontrolü
if [[ $EUID -ne 0 ]]; then
  log_error "Bu script root olarak çalıştırılmalıdır. Tekrar dene: sudo $0 $*"
  exit 1
fi
log_success "Root yetkisi"

# Ubuntu versiyonu
if ! check_command lsb_release; then
  apt-get install -y -qq lsb-release &>/dev/null
fi
OS_ID=$(lsb_release -si 2>/dev/null || echo "Unknown")
OS_VER=$(lsb_release -sr 2>/dev/null || echo "0")
if [[ "$OS_ID" != "Ubuntu" ]]; then
  log_error "Yalnızca Ubuntu desteklenmektedir (tespit edilen: $OS_ID)."
  exit 1
fi
if [[ "$OS_VER" != "22.04" && "$OS_VER" != "24.04" ]]; then
  log_warning "Önerilen Ubuntu sürümü: 22.04 veya 24.04 (mevcut: $OS_VER). Devam ediliyor..."
fi
log_success "İşletim sistemi: Ubuntu $OS_VER"

# RAM kontrolü (minimum 2 GB)
TOTAL_RAM=$(free -m | awk '/^Mem:/{print $2}')
if [[ "$TOTAL_RAM" -lt 2048 ]]; then
  log_error "Yetersiz RAM: ${TOTAL_RAM}MB (minimum 2048MB gerekli)."
  exit 1
fi
log_success "RAM: ${TOTAL_RAM}MB"

# Disk kontrolü (minimum 20 GB)
AVAIL_DISK=$(df -BG / | awk 'NR==2{gsub(/G/,""); print $4}')
if [[ "$AVAIL_DISK" -lt 20 ]]; then
  log_error "Yetersiz disk alanı: ${AVAIL_DISK}GB (minimum 20GB gerekli)."
  exit 1
fi
log_success "Disk: ${AVAIL_DISK}GB boş"

# ─── Step 1/9: Sistem Güncelleme ─────────────────────────────────────────────
log_step "[1/9] Sistem güncelleniyor..."
export DEBIAN_FRONTEND=noninteractive
run_with_spinner "Paket listesi güncelleniyor" apt-get update -qq
run_with_spinner "Sistem güncelleniyor" apt-get upgrade -y -qq
run_with_spinner "Temel araçlar kuruluyor" apt-get install -y -qq \
  curl wget git unzip ca-certificates gnupg lsb-release ufw openssl
log_success "Sistem güncellendi"

# ─── Step 2/9: Docker Kurulumu ───────────────────────────────────────────────
log_step "[2/9] Docker kuruluyor..."
if check_command docker; then
  DOCKER_VER=$(docker --version | grep -oP '\d+\.\d+\.\d+' | head -1)
  log_success "Docker zaten kurulu (v$DOCKER_VER) — atlanıyor"
else
  run_with_spinner "Docker kuruluyor" bash -c 'curl -fsSL https://get.docker.com | sh'
  log_success "Docker kuruldu"
fi

if ! docker compose version &>/dev/null; then
  run_with_spinner "Docker Compose Plugin kuruluyor" bash -c \
    'apt-get install -y -qq docker-compose-plugin'
  log_success "Docker Compose Plugin kuruldu"
else
  log_success "Docker Compose zaten kurulu"
fi

systemctl enable --now docker &>/dev/null || true
CURRENT_USER="${SUDO_USER:-$USER}"
if [[ -n "$CURRENT_USER" && "$CURRENT_USER" != "root" ]]; then
  usermod -aG docker "$CURRENT_USER" 2>/dev/null || true
  log_info "Kullanıcı '$CURRENT_USER' docker grubuna eklendi (yeniden giriş gerekebilir)"
fi

# ─── Step 3/9: FFmpeg Kurulumu ───────────────────────────────────────────────
log_step "[3/9] FFmpeg kuruluyor..."
if check_command ffmpeg; then
  FFMPEG_VER=$(ffmpeg -version 2>&1 | head -1 | grep -oP 'version \K\S+')
  log_success "FFmpeg zaten kurulu (v$FFMPEG_VER) — atlanıyor"
else
  run_with_spinner "FFmpeg kuruluyor" apt-get install -y -qq ffmpeg
  FFMPEG_VER=$(ffmpeg -version 2>&1 | head -1 | grep -oP 'version \K\S+')
  log_success "FFmpeg kuruldu (v$FFMPEG_VER)"
fi

# ─── Step 4/9: Lisans Doğrulama ──────────────────────────────────────────────
log_step "[4/9] Lisans doğrulanıyor..."
SERVER_IP=$(curl -s --max-time 10 ifconfig.me 2>/dev/null || \
            curl -s --max-time 10 api.ipify.org 2>/dev/null || \
            hostname -I | awk '{print $1}')

log_info "Sunucu IP: $SERVER_IP"

if [[ "$DEV_MODE" = true ]]; then
  log_warning "DEV MODE: Lisans doğrulama atlanıyor"
  LICENSE_KEY="DEV-TEST-KEY"
  LICENSE_SERVER="http://localhost:3001"
  log_info "Lisans anahtarı: $LICENSE_KEY (dev)"
elif [[ "$SELFHOST_MODE" = true ]]; then
  log_warning "Self-host modu: lisans dogrulamasi atlaniyor (anahtar yok, panel lisanssiz calisir)."
  LICENSE_KEY=""
else
  log_info "Lisans anahtarı: ${LICENSE_KEY:0:8}****"

  ACTIVATE_RESPONSE=$(curl -s -w "\n%{http_code}" \
    -X POST "${LICENSE_SERVER}/licenses/activate" \
    -H "Content-Type: application/json" \
    -d "{\"key\": \"${LICENSE_KEY}\", \"serverIp\": \"${SERVER_IP}\"}" \
    --max-time 30 2>/dev/null || echo '{"status":"error"}')

  HTTP_CODE=$(echo "$ACTIVATE_RESPONSE" | tail -1)
  RESPONSE_BODY=$(echo "$ACTIVATE_RESPONSE" | head -1)

  if [[ "$HTTP_CODE" != "200" && "$HTTP_CODE" != "201" ]]; then
    log_error "Lisans aktivasyonu başarısız (HTTP $HTTP_CODE)."
    log_error "Yanıt: $RESPONSE_BODY"
    log_error "Lütfen lisans anahtarınızı kontrol edin veya support@xtreampulsar.com ile iletişime geçin."
    exit 1
  fi

  IS_VALID=$(echo "$RESPONSE_BODY" | grep -o '"status":"[^"]*"' | cut -d'"' -f4 || echo "PENDING")
  if [[ "$IS_VALID" == "SUSPENDED" || "$IS_VALID" == "EXPIRED" ]]; then
    log_error "Lisans geçersiz veya askıya alınmış: $IS_VALID"
    exit 1
  fi

  log_success "Lisans aktif — Tier: $(echo "$RESPONSE_BODY" | grep -o '"tier":"[^"]*"' | cut -d'"' -f4 || echo 'UNKNOWN')"
fi

# ─── Step 5/9: Dosyaları Hazırla ─────────────────────────────────────────────
log_step "[5/9] Kurulum dosyaları hazırlanıyor..."
mkdir -p "$INSTALL_DIR"

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" &>/dev/null && pwd)"
REPO_ROOT="$(dirname "$(dirname "$SCRIPT_DIR")")"  # apps/installer → 2 üst dizin = repo root

log_info "Script dizini : $SCRIPT_DIR"
log_info "Repo kökü     : $REPO_ROOT"
log_info "Kurulum dizini: $INSTALL_DIR"

if [[ -f "$REPO_ROOT/docker-compose.yml" ]]; then
  if [[ "$INSTALL_DIR" != "$REPO_ROOT" ]]; then
    log_info "Dosyalar kopyalanıyor: $REPO_ROOT → $INSTALL_DIR"
    cp -r "$REPO_ROOT/." "$INSTALL_DIR/"
    log_success "Tüm kaynak dosyalar kopyalandı"
  else
    log_info "Script zaten kurulum dizininde — kopyalama atlanıyor"
  fi
else
  log_info "Yerel kaynak bulunamadı, GitHub'dan indiriliyor..."
  run_with_spinner "Kaynak indiriliyor" \
    git clone --depth 1 "$REPO_URL" "$INSTALL_DIR"
  log_success "Kaynak GitHub'dan indirildi"
fi

# ── [FIX #1] Gizli anahtarlar üret — REDIS_PASSWORD dahil ──────────────────
DB_PASSWORD=$(generate_password)
REDIS_PASSWORD=$(openssl rand -hex 32)
JWT_SECRET=$(openssl rand -hex 32)
JWT_REFRESH_SECRET=$(openssl rand -hex 32)
ADMIN_API_KEY=$(generate_password)
ADMIN_PASSWORD=$(generate_password)
CONTROL_JWT_SECRET=$(openssl rand -hex 32)

if [[ -n "$DOMAIN" ]]; then
  SERVER_URL="http://${DOMAIN}"
else
  SERVER_URL="http://${SERVER_IP}"
fi

if [[ -n "$DOMAIN" ]]; then
  CORS_ORIGINS="https://${DOMAIN},http://${DOMAIN}"
else
  CORS_ORIGINS="http://${SERVER_IP}"
fi

cat > "$INSTALL_DIR/.env" <<ENV
# ─── Database ─────────────────────────────────────────────────────────────
DATABASE_URL=postgresql://xtreampulsar:${DB_PASSWORD}@postgres:5432/xtreampulsar
POSTGRES_DB=xtreampulsar
POSTGRES_USER=xtreampulsar
POSTGRES_PASSWORD=${DB_PASSWORD}

# ─── Redis ────────────────────────────────────────────────────────────────
REDIS_PASSWORD=${REDIS_PASSWORD}
REDIS_URL=redis://:${REDIS_PASSWORD}@redis:6379

# ─── JWT ──────────────────────────────────────────────────────────────────
JWT_SECRET=${JWT_SECRET}
JWT_REFRESH_SECRET=${JWT_REFRESH_SECRET}
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# ─── License ──────────────────────────────────────────────────────────────
LICENSE_KEY=${LICENSE_KEY}
LICENSE_SERVER_URL=${LICENSE_SERVER}
LICENSE_ENFORCE=false
LICENSE_OFFLINE_GRACE_HOURS=72
ADMIN_API_KEY=${ADMIN_API_KEY}
DEV_MODE=${DEV_MODE}

# ─── Support / Control Panel ─────────────────────────────────────────────────
# Destek talepleri bizim control panelimize düşer. Müşteri sunucusunda bu URL
# her zaman bizim control panelimizi göstermeli; X-License-Key olarak müşterinin
# lisans anahtarı kullanılır.
CONTROL_PANEL_URL=https://control.xtreampulsar.com
PANEL_LICENSE_KEY=${LICENSE_KEY}
CONTROL_JWT_SECRET=${CONTROL_JWT_SECRET}

# ─── Server ───────────────────────────────────────────────────────────────
SERVER_URL=${SERVER_URL}
CORS_ORIGINS=${CORS_ORIGINS}
MAX_CONNECTIONS_PER_IP=0
GUARD_RESTREAM_ENFORCE=false
RS_WINDOW=300
SERVER_PORT=25461
FFMPEG_PATH=/usr/bin/ffmpeg
HLS_OUTPUT_PATH=/tmp/xtreampulsar/hls
NODE_ENV=production
ENV

chmod 600 "$INSTALL_DIR/.env"
log_success "Kurulum dizini hazır: $INSTALL_DIR"

# ── [FIX #2+#3] SSL için dizinleri ve self-signed sertifika oluştur ─────────
log_info "SSL dizinleri ve başlangıç sertifikası hazırlanıyor..."
mkdir -p "${INSTALL_DIR}/nginx/ssl"
mkdir -p "${INSTALL_DIR}/nginx/webroot"

if [[ -n "$DOMAIN" ]]; then
  # Domain varsa: self-signed ile başla, certbot sonra gerçeğiyle değiştirecek
  openssl req -x509 -nodes -newkey rsa:2048 -days 1 \
    -keyout "${INSTALL_DIR}/nginx/ssl/privkey.pem" \
    -out    "${INSTALL_DIR}/nginx/ssl/fullchain.pem" \
    -subj "/CN=${DOMAIN}" &>/dev/null
  log_success "Geçici self-signed sertifika oluşturuldu (Let's Encrypt ile değiştirilecek)"
else
  # Domain yok: IP ile erişim, HTTP-only nginx config kullan
  if [[ -f "${INSTALL_DIR}/nginx/nginx-http-only.conf" ]]; then
    cp "${INSTALL_DIR}/nginx/nginx-http-only.conf" "${INSTALL_DIR}/nginx/nginx.conf"
    log_success "HTTP-only nginx config aktifleştirildi (SSL yok)"
  else
    log_warning "nginx-http-only.conf bulunamadı, mevcut nginx.conf kullanılıyor"
    # Domain olmadan SSL gerekmesin diye self-signed oluştur
    openssl req -x509 -nodes -newkey rsa:2048 -days 3650 \
      -keyout "${INSTALL_DIR}/nginx/ssl/privkey.pem" \
      -out    "${INSTALL_DIR}/nginx/ssl/fullchain.pem" \
      -subj "/CN=${SERVER_IP}" &>/dev/null
    log_info "IP için self-signed sertifika oluşturuldu (tarayıcıda uyarı verir)"
  fi
  log_warning "Domain belirtilmedi. Panel HTTP üzerinden erişilebilir: http://${SERVER_IP}"
fi

# ─── Step 6/9: Veritabanı Başlat ─────────────────────────────────────────────
log_step "[6/9] Veritabanı başlatılıyor..."
cd "$INSTALL_DIR"
run_with_spinner "PostgreSQL ve Redis başlatılıyor" \
  docker compose up -d postgres redis

log_info "PostgreSQL hazır olana kadar bekleniyor (max 60s)..."
for i in $(seq 1 12); do
  if docker compose exec -T postgres pg_isready -U xtreampulsar &>/dev/null; then
    log_success "PostgreSQL hazır"
    break
  fi
  if [[ $i -eq 12 ]]; then
    log_error "PostgreSQL 60 saniye içinde başlamadı."
    docker compose logs postgres >&2
    exit 1
  fi
  sleep 5
done

log_info "Migration çalıştırılıyor..."
docker compose run --rm api sh -c \
  "cd /repo/packages/database && ./node_modules/.bin/prisma migrate deploy" \
  &>/tmp/xp_migrate.log || {
  log_warning "Migration başarısız — atlanıyor"
  log_info "Kurulum tamamlandıktan sonra: docker compose exec api npx prisma migrate deploy"
}
log_success "Veritabanı hazır"

# ─── Step 7/9: Servisleri Başlat ─────────────────────────────────────────────
log_step "[7/9] Servisler başlatılıyor..."
cd "$INSTALL_DIR"
run_with_spinner "Tüm servisler derleniyor ve başlatılıyor" docker compose up -d --build

log_info "Servislerin hazır olması bekleniyor (30s)..."
sleep 30

# Health check
HEALTH_OK=""
for i in $(seq 1 6); do
  HTTP=$(curl -s -o /dev/null -w "%{http_code}" http://localhost/api/v1/health 2>/dev/null || echo "000")
  if [[ "$HTTP" == "200" || "$HTTP" == "503" ]]; then
    log_success "API yanıt veriyor (HTTP $HTTP)"
    HEALTH_OK="1"; break
  fi
  log_info "Health check bekleniyor, yeniden deneniyor ($i/6, HTTP $HTTP)..."
  sleep 10
done
if [[ -z "$HEALTH_OK" ]]; then
  log_warning "API health check başarısız. Loglar: cd $INSTALL_DIR && docker compose logs api"
fi

# ─── Step 8/9: SSL Kurulumu ──────────────────────────────────────────────────
log_step "[8/9] SSL yapılandırması..."
if [[ -n "$DOMAIN" && -n "$EMAIL" ]]; then
  # ── [FIX #2] Certbot webroot modu — nginx zaten ayakta, port çakışması yok ──
  log_info "Let's Encrypt sertifikası alınıyor (webroot modu): $DOMAIN"

  docker run --rm \
    -v "${INSTALL_DIR}/nginx/ssl:/etc/letsencrypt" \
    -v "${INSTALL_DIR}/nginx/webroot:/var/www/certbot" \
    certbot/certbot certonly --webroot \
    --webroot-path /var/www/certbot \
    -d "$DOMAIN" \
    --email "$EMAIL" \
    --agree-tos --non-interactive --no-eff-email \
    2>/tmp/xp_certbot.log && {

    # Gerçek sertifikaları nginx ssl dizinine kopyala
    SSL_DIR="${INSTALL_DIR}/nginx/ssl/live/${DOMAIN}"
    cp "${SSL_DIR}/fullchain.pem" "${INSTALL_DIR}/nginx/ssl/fullchain.pem"
    cp "${SSL_DIR}/privkey.pem"   "${INSTALL_DIR}/nginx/ssl/privkey.pem"

    docker compose restart nginx
    log_success "Let's Encrypt sertifikası alındı ve nginx yeniden başlatıldı"

    # ── [FIX #5] Otomatik SSL yenileme cron'u ──────────────────────────────
    RENEW_CMD="docker run --rm -v ${INSTALL_DIR}/nginx/ssl:/etc/letsencrypt -v ${INSTALL_DIR}/nginx/webroot:/var/www/certbot certbot/certbot renew --quiet && docker compose -f ${INSTALL_DIR}/docker-compose.yml restart nginx"
    (crontab -l 2>/dev/null | grep -v "certbot/certbot renew"; echo "0 3 * * * ${RENEW_CMD}") | crontab -
    log_success "SSL otomatik yenileme cron'u eklendi (her gün 03:00)"
  } || {
    log_warning "Let's Encrypt sertifikası alınamadı (log: /tmp/xp_certbot.log)"
    log_warning "Self-signed sertifika ile devam ediliyor. Daha sonra elle alabilirsiniz:"
    log_warning "  cd ${INSTALL_DIR} && sudo bash apps/installer/install.sh --key ${LICENSE_KEY} --domain ${DOMAIN} --email ${EMAIL}"
  }
elif [[ -n "$DOMAIN" && -z "$EMAIL" ]]; then
  log_warning "--email belirtilmedi, SSL atlanıyor."
  log_warning "SSL için: $0 --key ${LICENSE_KEY} --domain ${DOMAIN} --email admin@${DOMAIN}"
else
  log_info "Domain belirtilmedi, SSL atlanıyor. HTTP ile devam ediliyor."
fi

# ─── Step 9/9: Firewall ──────────────────────────────────────────────────────
log_step "[9/9] Firewall yapılandırılıyor..."
ufw allow 22/tcp    comment 'SSH'        &>/dev/null
ufw allow 80/tcp    comment 'HTTP'       &>/dev/null
ufw allow 443/tcp   comment 'HTTPS'      &>/dev/null
ufw allow 25461/tcp comment 'Xtream API' &>/dev/null
ufw --force enable  &>/dev/null
log_success "Firewall kuralları uygulandı (22, 80, 443, 25461)"

# ─── [FIX #4] Admin kullanıcı — /auth/setup endpoint ────────────────────────
log_info "Admin kullanıcı oluşturuluyor..."
SETUP_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" \
  -X POST "http://localhost/api/v1/auth/setup" \
  -H "Content-Type: application/json" \
  -H "X-Admin-Key: ${ADMIN_API_KEY}" \
  -d "{\"username\":\"admin\",\"password\":\"${ADMIN_PASSWORD}\"}" \
  --max-time 15 2>/dev/null || echo "000")

if [[ "$SETUP_RESPONSE" == "201" ]]; then
  log_success "Admin kullanıcı oluşturuldu"
elif [[ "$SETUP_RESPONSE" == "409" ]]; then
  log_info "Admin kullanıcı zaten mevcut (atlanıyor)"
  ADMIN_PASSWORD="(mevcut şifre değiştirilmedi)"
else
  log_warning "Admin kullanıcı oluşturulamadı (HTTP $SETUP_RESPONSE)"
  log_warning "Panele girdikten sonra manuel oluşturun:"
  log_warning "  docker compose exec api node apps/api/dist/scripts/reset-admin.js admin 'YeniSifre123!'"
  ADMIN_PASSWORD="(manuel oluşturulacak)"
fi

# ─── Tamamlandı ──────────────────────────────────────────────────────────────
PANEL_URL="${SERVER_URL}"

echo ""
echo -e "${GREEN}${BOLD}"
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║          XtreamPulsar kurulumu tamamlandı!                  ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo -e "${RESET}"
echo -e "${BOLD}Erişim Bilgileri${RESET}"
echo -e "────────────────────────────────────────────────────────────────"
echo -e "  Panel URL       : ${CYAN}${PANEL_URL}${RESET}"
echo -e "  Xtream API      : ${CYAN}http://${SERVER_IP}:25461${RESET}"
echo -e "  Admin Kullanıcı : ${BOLD}admin${RESET}"
echo -e "  Admin Şifre     : ${BOLD}${YELLOW}${ADMIN_PASSWORD}${RESET}"
echo -e "  Kurulum Dizini  : ${INSTALL_DIR}"
echo ""
echo -e "${BOLD}Faydalı Komutlar${RESET}"
echo -e "────────────────────────────────────────────────────────────────"
echo -e "  Loglar          : cd ${INSTALL_DIR} && docker compose logs -f"
echo -e "  Güncelleme      : ${INSTALL_DIR}/update.sh"
echo -e "  Sağlık Kontrolü : ${INSTALL_DIR}/health-check.sh"
echo -e "  Kaldırma        : ${INSTALL_DIR}/uninstall.sh"
echo ""
echo -e "${BOLD}Dokümantasyon${RESET} : https://docs.xtreampulsar.com"
echo -e "  ${YELLOW}⚠  Admin şifreyi şimdi kaydedin! Tekrar gösterilmeyecek.${RESET}"
echo ""

# Scriptleri kurulum dizinine kopyala
cp "$0" "$INSTALL_DIR/install.sh" 2>/dev/null || true
[[ -f "$(dirname "$0")/update.sh" ]]       && cp "$(dirname "$0")/update.sh"       "$INSTALL_DIR/"
[[ -f "$(dirname "$0")/uninstall.sh" ]]    && cp "$(dirname "$0")/uninstall.sh"    "$INSTALL_DIR/"
[[ -f "$(dirname "$0")/health-check.sh" ]] && cp "$(dirname "$0")/health-check.sh" "$INSTALL_DIR/"
chmod +x "$INSTALL_DIR"/*.sh 2>/dev/null || true
