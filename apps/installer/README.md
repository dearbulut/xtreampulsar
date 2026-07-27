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
curl -fsSL https://raw.githubusercontent.com/dearbulut/xtreampulsar/main/apps/installer/install.sh | sudo bash
```

Lisans anahtari zorunlu degildir; `--key` verilmezse acik kaynak / self-host modunda kurulur.
Ticari lisansiniz varsa:

```bash
curl -fsSL https://raw.githubusercontent.com/dearbulut/xtreampulsar/main/apps/installer/install.sh -o install.sh
sudo bash install.sh --key YOUR_LICENSE_KEY
```

### Kurulum sonunda ne olur?

Script bittiginde ekranda **Erişim Bilgileri** kutusu cikar:

```
Panel URL       : http://SUNUCU_IP
Xtream API      : http://SUNUCU_IP:25461
Admin Kullanıcı : admin
Admin Şifre     : <otomatik üretilen şifre>
Kurulum Dizini  : /opt/xtreampulsar
```

> Admin sifresi **yalnizca bir kez** gosterilir. Kaydedin, ilk girisin ardindan
> **Ayarlar → Profil**'den degistirin. Kaybederseniz asagidaki `reset-admin` komutu ile sifirlayabilirsiniz.

### Domain ve SSL ile kurulum

```bash
curl -fsSL https://raw.githubusercontent.com/dearbulut/xtreampulsar/main/apps/installer/install.sh -o install.sh
sudo bash install.sh \
  --domain panel.example.com \
  --email admin@example.com
```

### Sonradan SSL ekleme (IP ile kurduysanız)

`--domain` vermeden kurulum yaptıysanız panel HTTP üzerinden çalışır. Sonradan bir
domain aldığınızda, A kaydını bu sunucuya yönlendirdikten sonra:

```bash
cd /opt/xtreampulsar && git pull
sudo bash apps/installer/enable-ssl.sh \
  --domain panel.example.com \
  --email admin@example.com
```

Script sırayla: DNS'i doğrular, `/.well-known/acme-challenge/` yolunu açar ve dışarıdan
okunduğunu test eder, Let's Encrypt sertifikasını alır, SSL'li nginx config'ini
aktifleştirir ve her gün 03:00'te çalışan otomatik yenileme cron'unu kurar.
Tekrar tekrar çalıştırılabilir (idempotent).

`--staging` ile Let's Encrypt test ortamını kullanabilirsiniz (rate limit'e takılmadan
deneme için), `--alt ikinci.example.com` ile ek domain ekleyebilirsiniz.

> SSL açıldıktan sonra port 80 HTTPS'e yönlenir. Düz HTTP isteyen Xtream istemcileri
> için **port 25461** açık kalmaya devam eder.

### Yerel dosyadan kurulum

```bash
sudo bash apps/installer/install.sh \
  --domain panel.example.com \
  --email admin@example.com
```

## Parametreler

| Parametre | Zorunlu | Açıklama |
|---|---|---|
| `--key` | Hayır | Ticari lisans anahtarı. Verilmezse self-host modu |
| `--domain` | Hayır | Panel domain (SSL için) |
| `--email` | Hayır | Let's Encrypt e-posta adresi |
| `--dir` | Hayır | Kurulum dizini (varsayılan: `/opt/xtreampulsar`) |

## Load Balancer Ekleme

Ayrı bir sunucuya load balancer node kurulumu:

```bash
curl -fsSL https://raw.githubusercontent.com/dearbulut/xtreampulsar/main/apps/installer/lb-install.sh -o lb-install.sh
sudo bash lb-install.sh \
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

# Migration manuel çalıştır (normalde API açılışta otomatik uygular)
docker compose exec api npx prisma migrate deploy
```

### Panele giriş yapamıyorum / admin oluşmadı

En sik karsilasilan durum. Kurulum dizininde su komutu calistirin — admin yoksa **olusturur**,
varsa **sifresini sifirlar**:

```bash
cd /opt/xtreampulsar
docker compose exec api node apps/api/dist/scripts/reset-admin.js admin 'YeniSifre123!'
```

### Girişte HTTP 500 / `column ... does not exist`

Veritabani semasi koddan eski. Guncel surumlerde migration'lar API konteyneri acilirken otomatik
uygulanir; guncelleyip yeniden baslatmak yeterli:

```bash
cd /opt/xtreampulsar
git pull && docker compose up -d --build
docker compose logs -f api
```

## Destek

- Kurulum & sorun giderme: [README → Install](../../README.md#-install)
- GitHub Issues: https://github.com/dearbulut/xtreampulsar/issues/new/choose
- Telegram: https://t.me/bulutworksdev
