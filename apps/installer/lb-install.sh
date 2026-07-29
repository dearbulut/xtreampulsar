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

# ─── Helpers ─────────────────────────────────────────────────────────────────
check_command() { command -v "$1" &>/dev/null; }
run_with_spinner() {
  local msg="$1"; shift
  "$@" &>/tmp/xp_lb.log &
  local pid=$!
  local frames=('⠋' '⠙' '⠹' '⠸' '⠼' '⠴' '⠦' '⠧' '⠇' '⠏')
  local i=0
  while kill -0 "$pid" 2>/dev/null; do
    printf "\r${CYAN}%s${RESET}  %s" "${frames[$((i % ${#frames[@]}))]}" "$msg"
    i=$((i + 1))
    sleep 0.1
  done
  printf "\r\033[K"
  if ! wait "$pid"; then
    log_error "$msg — başarısız. Log: /tmp/xp_lb.log"
    cat /tmp/xp_lb.log >&2
    exit 1
  fi
}

# ─── Argument Parsing ────────────────────────────────────────────────────────
MAIN_IP=""
LB_TOKEN=""
LB_DOMAIN=""
INSTALL_DIR="/opt/xtreampulsar-lb"
SSH_KEY_PATH="${HOME}/.ssh/id_rsa"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --main-ip)   MAIN_IP="$2";   shift 2 ;;
    --lb-token)  LB_TOKEN="$2";  shift 2 ;;
    --domain)    LB_DOMAIN="$2"; shift 2 ;;
    --ssh-key)   SSH_KEY_PATH="$2"; shift 2 ;;
    --dir)       INSTALL_DIR="$2"; shift 2 ;;
    --help|-h)
      echo "Kullanım: $0 --main-ip ANA_SUNUCU_IP --lb-token TOKEN [--domain LB_DOMAIN] [--ssh-key PATH]"
      echo ""
      echo "  --lb-token  Ana panelden alinan ADMIN oturum anahtari (accessToken)."
      echo "              Almak icin:"
      echo "                curl -s -X POST http://ANA_SUNUCU_IP/api/v1/auth/login \\"
      echo "                  -H 'Content-Type: application/json' \\"
      echo "                  -d '{\"username\":\"admin\",\"password\":\"SIFRE\"}'"
      echo "              Donen JSON icindeki accessToken degerini kullanin."
      exit 0 ;;
    *) log_error "Bilinmeyen parametre: $1"; exit 1 ;;
  esac
done

# ─── Validasyon ──────────────────────────────────────────────────────────────
echo -e "${BOLD}${CYAN}XtreamPulsar — Load Balancer Kurulumu${RESET}"
echo "────────────────────────────────────────"

if [[ $EUID -ne 0 ]]; then
  log_error "Root yetkisi gerekli: sudo $0 $*"
  exit 1
fi
if [[ -z "$MAIN_IP" ]]; then
  log_error "--main-ip zorunludur (ana XtreamPulsar sunucusunun IP'si)"
  exit 1
fi
if [[ -z "$LB_TOKEN" ]]; then
  log_error "--lb-token zorunludur — ana panelden alinan ADMIN accessToken."
  log_error "Almak icin ana sunucuda ya da kendi bilgisayarinizda:"
  log_error "  curl -s -X POST http://${MAIN_IP}/api/v1/auth/login \\"
  log_error "    -H 'Content-Type: application/json' \\"
  log_error "    -d '{\"username\":\"admin\",\"password\":\"SIFRE\"}'"
  log_error "Donen JSON icindeki accessToken degerini --lb-token ile verin."
  exit 1
fi

LB_IP=$(curl -s --max-time 10 ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}')
log_info "LB Sunucu IP : $LB_IP"
log_info "Ana Sunucu IP: $MAIN_IP"

# ─── Step 1: Sistem ──────────────────────────────────────────────────────────
log_step "[1/5] Sistem hazırlanıyor..."
export DEBIAN_FRONTEND=noninteractive
run_with_spinner "Paket listesi güncelleniyor" apt-get update -qq
run_with_spinner "Temel araçlar kuruluyor" apt-get install -y -qq \
  curl wget rsync openssh-client ufw ca-certificates gnupg

# ─── Step 2: Docker ──────────────────────────────────────────────────────────
log_step "[2/5] Docker kuruluyor..."
if check_command docker; then
  log_success "Docker zaten kurulu — atlanıyor"
else
  run_with_spinner "Docker kuruluyor" bash -c 'curl -fsSL https://get.docker.com | sh'
  log_success "Docker kuruldu"
fi
if ! docker compose version &>/dev/null; then
  run_with_spinner "Docker Compose Plugin kuruluyor" \
    apt-get install -y -qq docker-compose-plugin
fi
systemctl enable --now docker &>/dev/null || true

# ─── Step 3: SSH anahtarı ────────────────────────────────────────────────────
log_step "[3/5] SSH bağlantısı kuruluyor..."
mkdir -p "$HOME/.ssh"
chmod 700 "$HOME/.ssh"

if [[ ! -f "$SSH_KEY_PATH" ]]; then
  log_info "SSH anahtarı oluşturuluyor..."
  ssh-keygen -t ed25519 -f "$SSH_KEY_PATH" -N "" -C "xtreampulsar-lb@${LB_IP}" &>/dev/null
  log_success "SSH anahtarı oluşturuldu: $SSH_KEY_PATH"
  echo ""
  echo -e "${YELLOW}${BOLD}Önemli!${RESET} Aşağıdaki public anahtarı ana sunucuya ekleyin:"
  echo -e "${CYAN}$(cat "${SSH_KEY_PATH}.pub")${RESET}"
  echo ""
  echo "Ana sunucuda çalıştırın:"
  echo -e "  ${BOLD}echo '$(cat "${SSH_KEY_PATH}.pub")' >> ~/.ssh/authorized_keys${RESET}"
  echo ""
  echo -e "${YELLOW}Ekledikten sonra Enter'a basın...${RESET}"
  read -r
fi

# SSH bağlantısını test et
log_info "Ana sunucuya SSH bağlantısı test ediliyor..."
if ssh -o StrictHostKeyChecking=no -o ConnectTimeout=10 -i "$SSH_KEY_PATH" \
   "root@${MAIN_IP}" "echo OK" &>/dev/null; then
  log_success "SSH bağlantısı başarılı"
else
  log_warning "SSH bağlantısı kurulamadı. HLS sync elle yapılandırılacak."
fi

# ─── Step 4: docker-compose.lb.yml ──────────────────────────────────────────
log_step "[4/5] Load balancer yapılandırılıyor..."
mkdir -p "$INSTALL_DIR/nginx"

# Yapilandirma dosyalari: yerel depodan kopyala, yoksa GitHub'dan indir.
#
# ONEMLI: docker-compose.lb.yml, nginx konteynerine ./nginx/nginx.lb.conf
# dosyasini /etc/nginx/nginx.conf olarak baglar. Bu dosya yoksa Docker onun
# yerine BOS BIR DIZIN olusturur ve nginx "is a directory" ile hic acilmaz.
# Bu yuzden iki dosya da ZORUNLUDUR; ikisi de ayni kaynaktan alinir.
LB_RAW_BASE="${LB_RAW_BASE:-https://raw.githubusercontent.com/dearbulut/xtreampulsar/main}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" && pwd)"
REPO_ROOT="$SCRIPT_DIR/../.."

fetch_lb_file() {  # fetch_lb_file DEPO_ICI_YOL HEDEF_YOL
  local rel="$1" dest="$2"
  if [[ -f "$REPO_ROOT/$rel" ]]; then
    cp "$REPO_ROOT/$rel" "$dest"
    return 0
  fi
  curl -fsSL "$LB_RAW_BASE/$rel" -o "$dest" 2>>/tmp/xp_lb.log
}

if [[ -f "$REPO_ROOT/docker-compose.lb.yml" ]]; then
  log_info "Yapilandirma yerel depodan kopyalaniyor..."
else
  log_info "Yapilandirma GitHub'dan indiriliyor..."
fi

if ! fetch_lb_file "docker-compose.lb.yml" "$INSTALL_DIR/docker-compose.lb.yml"; then
  log_error "docker-compose.lb.yml alinamadi (kaynak: $LB_RAW_BASE)"
  log_error "Depoyu klonlayip betigi klasor icinden calistirin:"
  log_error "  git clone https://github.com/dearbulut/xtreampulsar.git /opt/xtreampulsar-src"
  log_error "  cd /opt/xtreampulsar-src && sudo bash apps/installer/lb-install.sh --main-ip $MAIN_IP --lb-token <TOKEN>"
  exit 1
fi

if ! fetch_lb_file "nginx/nginx.lb.conf" "$INSTALL_DIR/nginx/nginx.lb.conf"; then
  log_error "nginx/nginx.lb.conf alinamadi — nginx bu dosya olmadan baslamaz."
  log_error "Depoyu klonlayip betigi klasor icinden calistirin (yukaridaki komutlar)."
  exit 1
fi
log_success "Yapilandirma dosyalari hazir"

# Self-signed sertifika oluştur (domain yoksa)
mkdir -p "$INSTALL_DIR/nginx/ssl"
if [[ -z "$LB_DOMAIN" && ! -f "$INSTALL_DIR/nginx/ssl/fullchain.pem" ]]; then
  log_info "Self-signed SSL sertifikası oluşturuluyor..."
  openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout "$INSTALL_DIR/nginx/ssl/privkey.pem" \
    -out    "$INSTALL_DIR/nginx/ssl/fullchain.pem" \
    -subj "/CN=${LB_IP}/O=XtreamPulsar-LB/C=TR" &>/dev/null
  log_success "Self-signed sertifika oluşturuldu"
fi

# .env dosyası
cat > "$INSTALL_DIR/.env" <<ENV
MAIN_SERVER_HOST=${MAIN_IP}
MAIN_SERVER_USER=root
HLS_REMOTE_PATH=/tmp/xtreampulsar/hls
SYNC_INTERVAL=5
SSH_KEY_PATH=${SSH_KEY_PATH}
ENV

log_success "Load balancer yapılandırması hazır"

# ─── Step 5: Servisleri başlat ───────────────────────────────────────────────
log_step "[5/5] Servisler başlatılıyor..."
cd "$INSTALL_DIR"
docker compose -f docker-compose.lb.yml up -d
log_success "Load balancer servisleri başlatıldı"

# ─── Ana sunucuya kayıt ──────────────────────────────────────────────────────
log_step "▶ Ana sunucuya kayıt yapılıyor..."
# NOT: api servisi docker-compose.yml'de 3000 portunu yalnizca `expose` eder,
# `ports` ile YAYINLAMAZ — yani ana sunucunun 3000'i disaridan erisilebilir
# degildir. Kayit istegi nginx uzerinden (80) gitmelidir. Ozel kurulumlar icin
# 25461 ve 3000 yedek olarak denenir.
REGISTER_BODY="{\"name\":\"LB-${LB_IP}\",\"ip\":\"${LB_IP}\",\"port\":25461,\"role\":\"LOAD_BALANCER\"}"
REGISTER_RESPONSE="000"
for BASE in "http://${MAIN_IP}" "http://${MAIN_IP}:25461" "http://${MAIN_IP}:3000"; do
  REGISTER_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" \
    -X POST "${BASE}/api/v1/servers" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer ${LB_TOKEN}" \
    -d "$REGISTER_BODY" --max-time 15 2>/dev/null || echo "000")
  # 2xx = kaydedildi, 409 = zaten kayitli, 401/403 = ulastik ama token kotu.
  # Hepsinde ana sunucuya ULASILMIS demektir; baska port denemenin anlami yok.
  # NOT: `[[ ... ]] && break` yazilmaz — test basarisiz olunca donen 1,
  # `set -e` altinda betigi sessizce sonlandirir.
  if [[ "$REGISTER_RESPONSE" =~ ^(200|201|409|401|403)$ ]]; then
    break
  fi
done

case "$REGISTER_RESPONSE" in
  200|201) log_success "Ana sunucuya kayıt başarılı" ;;
  409)     log_success "Bu IP zaten kayıtlı — mevcut kayıt korundu" ;;
  401|403)
    log_warning "Token geçersiz veya yetkisiz (HTTP $REGISTER_RESPONSE)."
    log_warning "--lb-token degeri ADMIN accessToken olmalidir:"
    log_warning "  curl -s -X POST http://${MAIN_IP}/api/v1/auth/login -H 'Content-Type: application/json' -d '{\"username\":\"admin\",\"password\":\"SIFRE\"}'"
    log_warning "Panel → Sunucular → Sunucu Ekle ile elle de ekleyebilirsiniz." ;;
  *)
    log_warning "Ana sunucuya otomatik kayıt başarısız (HTTP: $REGISTER_RESPONSE)"
    log_warning "Panel → Sunucular → Sunucu Ekle ile elle ekleyin:"
    log_warning "  Ad: LB-${LB_IP}  |  IP: ${LB_IP}  |  Port: 25461  |  Rol: Load Balancer"
    log_warning "  API Secret alanini BOS birakin (LB uzerinde panel API'si calismaz)." ;;
esac

# ─── Firewall ────────────────────────────────────────────────────────────────
ufw allow 22/tcp    &>/dev/null
ufw allow 80/tcp    &>/dev/null
ufw allow 443/tcp   &>/dev/null
ufw allow 25461/tcp &>/dev/null
ufw --force enable  &>/dev/null
log_success "Firewall yapılandırıldı"

# ─── Tamamlandı ──────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}${BOLD}"
echo "╔════════════════════════════════════════════════════╗"
echo "║     Load Balancer kurulumu tamamlandı!            ║"
echo "╚════════════════════════════════════════════════════╝"
echo -e "${RESET}"
echo -e "  LB IP          : ${CYAN}${LB_IP}${RESET}"
echo -e "  Ana Sunucu     : ${CYAN}${MAIN_IP}${RESET}"
echo -e "  Kurulum Dizini : ${INSTALL_DIR}"
echo -e "  HLS Sync       : Her ${BOLD}5 saniye${RESET}"
echo -e "  Panel Kaydi    : HTTP ${REGISTER_RESPONSE}"
echo ""
echo -e "${BOLD}Kontrol${RESET}: Panel > Sunucular sayfasinda ${CYAN}${LB_IP}${RESET} gorunmelidir."
echo -e "Gorunmuyorsa Sunucu Ekle ile elle ekleyin — Rol: ${BOLD}Load Balancer${RESET},"
echo -e "Port: ${BOLD}25461${RESET}, API Secret alanini ${BOLD}bos birakin${RESET}."
echo ""
echo -e "Loglar: ${BOLD}cd $INSTALL_DIR && docker compose -f docker-compose.lb.yml logs -f${RESET}"
