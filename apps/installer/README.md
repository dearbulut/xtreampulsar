# XtreamPulsar Installer

Production-ready bash installer scripts for XtreamPulsar Panel.

## Gereksinimler

| Gereksinim | Minimum |
|---|---|
| İşletim Sistemi | Ubuntu 22.04 / 24.04 |
| RAM | 2 GB |
| Disk | 20 GB |
| CPU | 2 çekirdek |
| Ağ | Statik IP veya domain |

## Hızlı Kurulum

```bash
curl -fsSL https://install.xtreampulsar.io | bash -s -- --key YOUR_LICENSE_KEY
```

### Domain ve SSL ile kurulum

```bash
curl -fsSL https://install.xtreampulsar.io | bash -s -- \
  --key YOUR_LICENSE_KEY \
  --domain panel.example.com \
  --email admin@example.com
```

### Yerel dosyadan kurulum

```bash
sudo bash apps/installer/install.sh \
  --key YOUR_LICENSE_KEY \
  --domain panel.example.com \
  --email admin@example.com
```

## Parametreler

| Parametre | Zorunlu | Açıklama |
|---|---|---|
| `--key` | Evet | Lisans anahtarı |
| `--domain` | Hayır | Panel domain (SSL için) |
| `--email` | Hayır | Let's Encrypt e-posta adresi |
| `--dir` | Hayır | Kurulum dizini (varsayılan: `/opt/xtreampulsar`) |

## Load Balancer Ekleme

Ayrı bir sunucuya load balancer node kurulumu:

```bash
curl -fsSL https://install.xtreampulsar.io/lb | bash -s -- \
  --main-ip ANA_SUNUCU_IP \
  --lb-token PANEL_DEN_URETILEN_TOKEN
```

Panel → Sunucular → "LB Token Oluştur" butonundan token alabilirsiniz.

### LB Parametreleri

| Parametre | Zorunlu | Açıklama |
|---|---|---|
| `--main-ip` | Evet | Ana XtreamPulsar sunucusunun IP adresi |
| `--lb-token` | Evet | Panel'den üretilen JWT token |
| `--domain` | Hayır | LB domain (SSL için) |
| `--ssh-key` | Hayır | SSH key yolu (varsayılan: `~/.ssh/id_rsa`) |
| `--dir` | Hayır | Kurulum dizini (varsayılan: `/opt/xtreampulsar-lb`) |

## Güncelleme

```bash
sudo /opt/xtreampulsar/update.sh
```

Güncelleme işlemi:
1. Mevcut ve yeni versiyon karşılaştırması
2. Otomatik veritabanı yedeği (PostgreSQL dump)
3. `docker compose pull` ile yeni imajları çek
4. Sıfır-downtime yeniden başlatma
5. Migration çalıştır
6. Health check doğrulaması

## Sağlık Kontrolü

```bash
sudo /opt/xtreampulsar/health-check.sh
```

Kontrol edilen bileşenler:
- Docker konteynerleri (postgres, redis, api, web, nginx, license)
- API health endpoint
- Lisans durumu (Redis cache)
- PostgreSQL bağlantısı ve tablo sayısı
- Redis bağlantısı ve bellek kullanımı
- Disk kullanımı (/ ve HLS dizini)
- RAM ve Swap kullanımı
- FFmpeg kurulumu
- Port durumu (80, 443, 3000, 25461)
- Firewall (ufw) durumu

## Kaldırma

```bash
sudo /opt/xtreampulsar/uninstall.sh
```

> **Uyarı:** Bu işlem tüm verileri kalıcı olarak siler. İki kez onay gerektirir.

## Kurulum Dizini Yapısı

```
/opt/xtreampulsar/
├── docker-compose.yml
├── .env                    # Otomatik üretilen (chmod 600)
├── nginx/
│   ├── nginx.conf
│   └── ssl/               # Let's Encrypt sertifikaları
├── install.sh
├── update.sh
├── uninstall.sh
└── health-check.sh
```

## Açık Portlar

| Port | Protokol | Kullanım |
|---|---|---|
| 22 | TCP | SSH |
| 80 | TCP | HTTP → HTTPS redirect |
| 443 | TCP | Panel (HTTPS) |
| 25461 | TCP | Xtream API & stream teslimatı |

## Sorun Giderme

```bash
# Tüm log'ları izle
cd /opt/xtreampulsar && docker compose logs -f

# Sadece API log'ları
docker compose logs -f api

# PostgreSQL log'ları
docker compose logs -f postgres

# Servisleri yeniden başlat
docker compose restart

# Migration manuel çalıştır
docker compose exec api npx prisma migrate deploy
```

## Destek

- Dokümantasyon: https://docs.xtreampulsar.io
- E-posta: support@xtreampulsar.io
- GitHub Issues: https://github.com/xtreampulsar/xtreampulsar/issues
