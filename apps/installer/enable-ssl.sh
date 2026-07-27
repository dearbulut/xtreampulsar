#!/usr/bin/env bash
#
# XtreamPulsar — mevcut bir kuruluma Let's Encrypt SSL ekler.
#
# install.sh --domain vermeden calistirildiysa panel HTTP-only nginx config'i
# ile ayaga kalkar. Sonradan bir domain aldiginda bu script SSL'i acar:
#   - /.well-known/acme-challenge/ yolunu servis eder
#   - certbot ile sertifikayi alir (webroot modu, nginx ayaktayken)
#   - SSL'li nginx config'ini aktiflestirir
#   - her gun 03:00'te otomatik yenileme cron'u kurar
#
# Idempotent: birden fazla kez calistirilabilir.
#
# Kullanim:
#   sudo bash apps/installer/enable-ssl.sh --domain panel.example.com --email you@example.com
#   sudo bash apps/installer/enable-ssl.sh --domain ... --email ... --staging   # test sertifikasi
#   sudo bash apps/installer/enable-ssl.sh --domain ... --email ... --force     # DNS kontrolunu atla
#
set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
log_info()    { echo -e "${BLUE}[*]${NC} $*"; }
log_success() { echo -e "${GREEN}[+]${NC} $*"; }
log_warning() { echo -e "${YELLOW}[!]${NC} $*"; }
log_error()   { echo -e "${RED}[x]${NC} $*" >&2; }
log_step()    { echo -e "\n${BLUE}==>${NC} $*"; }

INSTALL_DIR="${INSTALL_DIR:-/opt/xtreampulsar}"
DOMAIN=""
EMAIL=""
STAGING=0
FORCE=0
EXTRA_DOMAINS=()

while [[ $# -gt 0 ]]; do
  case "$1" in
    --domain)      DOMAIN="${2:-}"; shift 2 ;;
    --alt)         EXTRA_DOMAINS+=("${2:-}"); shift 2 ;;
    --email)       EMAIL="${2:-}"; shift 2 ;;
    --install-dir) INSTALL_DIR="${2:-}"; shift 2 ;;
    --staging)     STAGING=1; shift ;;
    --force)       FORCE=1; shift ;;
    -h|--help)
      sed -n '2,20p' "$0" | sed 's/^# \{0,1\}//'
      exit 0 ;;
    *) log_error "Bilinmeyen parametre: $1"; exit 1 ;;
  esac
done

[[ -n "$DOMAIN" ]] || { log_error "--domain zorunlu. Ornek: --domain panel.example.com"; exit 1; }
[[ -n "$EMAIL"  ]] || { log_error "--email zorunlu (Let's Encrypt yenileme uyarilari icin)."; exit 1; }
[[ -d "$INSTALL_DIR" ]] || { log_error "Kurulum dizini yok: $INSTALL_DIR"; exit 1; }
[[ $EUID -eq 0 ]] || { log_error "root olarak calistirin (sudo)."; exit 1; }

cd "$INSTALL_DIR"
[[ -f docker-compose.yml ]] || { log_error "$INSTALL_DIR icinde docker-compose.yml yok."; exit 1; }

CERT_DOMAINS=(-d "$DOMAIN")
for d in "${EXTRA_DOMAINS[@]:-}"; do
  [[ -n "$d" ]] && CERT_DOMAINS+=(-d "$d")
done

# ─── 1/6 DNS kontrolu ─────────────────────────────────────────────────────────
log_step "[1/6] DNS kontrolu"
SERVER_IP="$(curl -4 -s --max-time 10 https://ifconfig.me || curl -4 -s --max-time 10 https://api.ipify.org || echo '')"
DOMAIN_IP="$(getent ahostsv4 "$DOMAIN" 2>/dev/null | awk '{print $1; exit}' || echo '')"
log_info "Sunucu IP : ${SERVER_IP:-bilinmiyor}"
log_info "Domain IP : ${DOMAIN_IP:-cozulemedi}"

if [[ -z "$DOMAIN_IP" ]]; then
  log_error "$DOMAIN cozulemedi. Once A kaydini olusturun."
  [[ $FORCE -eq 1 ]] || exit 1
elif [[ -n "$SERVER_IP" && "$DOMAIN_IP" != "$SERVER_IP" ]]; then
  log_error "$DOMAIN -> $DOMAIN_IP, bu sunucu ise $SERVER_IP."
  log_error "Let's Encrypt dogrulamasi basarisiz olur. A kaydini duzeltin veya --force kullanin."
  [[ $FORCE -eq 1 ]] || exit 1
else
  log_success "DNS dogru: $DOMAIN -> $DOMAIN_IP"
fi

# ─── 2/6 Dizinler + ACME yolu ────────────────────────────────────────────────
log_step "[2/6] ACME dogrulama yolu hazirlaniyor"
mkdir -p nginx/ssl nginx/webroot/.well-known/acme-challenge

if ! grep -q 'acme-challenge' nginx/nginx.conf 2>/dev/null; then
  if [[ -f nginx/nginx-http-only.conf ]] && grep -q 'acme-challenge' nginx/nginx-http-only.conf; then
    cp nginx/nginx.conf "nginx/nginx.conf.bak.$(date +%s)" 2>/dev/null || true
    cp nginx/nginx-http-only.conf nginx/nginx.conf
    log_success "acme-challenge yolu iceren HTTP config aktiflestirildi"
  else
    log_error "Aktif nginx config'inde /.well-known/acme-challenge/ yok ve sablon bulunamadi."
    log_error "Once 'git pull' yapin (nginx-http-only.conf guncellendi)."
    exit 1
  fi
fi

docker compose up -d nginx >/dev/null 2>&1 || true
docker compose restart nginx >/dev/null 2>&1 || true
sleep 3

TOKEN="xp-selftest-$$"
echo "$TOKEN" > "nginx/webroot/.well-known/acme-challenge/$TOKEN"
GOT="$(curl -s --max-time 15 "http://${DOMAIN}/.well-known/acme-challenge/${TOKEN}" || echo '')"
rm -f "nginx/webroot/.well-known/acme-challenge/$TOKEN"
if [[ "$GOT" == "$TOKEN" ]]; then
  log_success "ACME self-test basarili (port 80 disaridan erisilebilir)"
else
  log_error "ACME self-test basarisiz. http://${DOMAIN}/.well-known/acme-challenge/ disaridan okunamiyor."
  log_error "Kontrol edin: firewall 80/tcp acik mi, DNS yayildi mi, nginx ayakta mi?"
  [[ $FORCE -eq 1 ]] || exit 1
fi

# ─── 3/6 Gecici self-signed (SSL config yuklenebilsin diye) ──────────────────
log_step "[3/6] Sertifika dosyalari kontrol ediliyor"
if [[ ! -f nginx/ssl/fullchain.pem || ! -f nginx/ssl/privkey.pem ]]; then
  openssl req -x509 -nodes -newkey rsa:2048 -days 1 \
    -keyout nginx/ssl/privkey.pem -out nginx/ssl/fullchain.pem \
    -subj "/CN=${DOMAIN}" &>/dev/null
  log_success "Gecici self-signed sertifika olusturuldu (birazdan gercegiyle degisecek)"
else
  log_info "Mevcut sertifika dosyalari bulundu"
fi

# ─── 4/6 Let's Encrypt ───────────────────────────────────────────────────────
log_step "[4/6] Let's Encrypt sertifikasi aliniyor"
CERTBOT_ARGS=(certonly --webroot --webroot-path /var/www/certbot
  "${CERT_DOMAINS[@]}" --email "$EMAIL"
  --agree-tos --non-interactive --no-eff-email --keep-until-expiring)
[[ $STAGING -eq 1 ]] && CERTBOT_ARGS+=(--staging)

if ! docker run --rm \
  -v "${INSTALL_DIR}/nginx/ssl:/etc/letsencrypt" \
  -v "${INSTALL_DIR}/nginx/webroot:/var/www/certbot" \
  certbot/certbot "${CERTBOT_ARGS[@]}" 2>&1 | tee /tmp/xp_certbot.log; then
  log_error "Sertifika alinamadi. Log: /tmp/xp_certbot.log"
  exit 1
fi

SSL_LIVE="nginx/ssl/live/${DOMAIN}"
[[ -f "${SSL_LIVE}/fullchain.pem" ]] || { log_error "Beklenen sertifika yok: ${SSL_LIVE}"; exit 1; }
cp "${SSL_LIVE}/fullchain.pem" nginx/ssl/fullchain.pem
cp "${SSL_LIVE}/privkey.pem"   nginx/ssl/privkey.pem
chmod 600 nginx/ssl/privkey.pem
log_success "Sertifika alindi: $DOMAIN"

# ─── 5/6 SSL'li nginx config'ini aktiflestir ─────────────────────────────────
log_step "[5/6] SSL nginx config'i aktiflestiriliyor"
TMP_CONF="$(mktemp)"
if git -C "$INSTALL_DIR" show HEAD:nginx/nginx.conf > "$TMP_CONF" 2>/dev/null && grep -q 'listen 443' "$TMP_CONF"; then
  cp nginx/nginx.conf "nginx/nginx.conf.bak.$(date +%s)"
  cp "$TMP_CONF" nginx/nginx.conf
  log_success "SSL config yazildi (git HEAD:nginx/nginx.conf)"
else
  log_warning "SSL config sablonu git'ten alinamadi; mevcut nginx.conf korunuyor."
fi
rm -f "$TMP_CONF"

if ! docker compose exec -T nginx nginx -t >/dev/null 2>&1; then
  log_error "nginx config testi basarisiz. Son yedege donuluyor."
  LAST_BAK="$(ls -1t nginx/nginx.conf.bak.* 2>/dev/null | head -1 || true)"
  [[ -n "$LAST_BAK" ]] && cp "$LAST_BAK" nginx/nginx.conf
  docker compose restart nginx >/dev/null 2>&1 || true
  exit 1
fi
docker compose restart nginx >/dev/null 2>&1
sleep 3
log_success "nginx yeniden baslatildi"

# ─── 6/6 Otomatik yenileme + firewall ────────────────────────────────────────
log_step "[6/6] Otomatik yenileme"
RENEW_CMD="docker run --rm -v ${INSTALL_DIR}/nginx/ssl:/etc/letsencrypt -v ${INSTALL_DIR}/nginx/webroot:/var/www/certbot certbot/certbot renew --quiet --webroot --webroot-path /var/www/certbot --deploy-hook 'cp /etc/letsencrypt/live/${DOMAIN}/fullchain.pem /etc/letsencrypt/fullchain.pem && cp /etc/letsencrypt/live/${DOMAIN}/privkey.pem /etc/letsencrypt/privkey.pem' && docker compose -f ${INSTALL_DIR}/docker-compose.yml restart nginx"
(crontab -l 2>/dev/null | grep -v 'certbot/certbot renew'; echo "0 3 * * * ${RENEW_CMD}") | crontab -
log_success "Yenileme cron'u kuruldu (her gun 03:00)"

command -v ufw >/dev/null 2>&1 && ufw allow 443/tcp comment 'HTTPS' >/dev/null 2>&1 || true

echo
log_success "SSL aktif: https://${DOMAIN}"
log_info "SERVER_URL degerini .env icinde https://${DOMAIN} yapmayi ve"
log_info "'docker compose up -d --build && docker compose restart nginx' calistirmayi unutmayin."
log_warning "Port 80 artik HTTPS'e yonlendiriyor. Xtream istemcileri icin duz HTTP portu: 25461"
