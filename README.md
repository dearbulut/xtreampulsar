<div align="center">

<img width="820" alt="XtreamPulsar — modern self-hosted IPTV panel dashboard" src="https://github.com/user-attachments/assets/9e55790e-8f88-4425-b34d-ad5d7f88b4a5" />

# XtreamPulsar
You can contact me directly.
Telegram: https://t.me/bulutworksdev

### The modern, self-hosted IPTV panel — an open, Docker-native alternative to XtreamUI, XUI.ONE and Xtream-Masters.

**Xtream Codes API compatible · one-click migration · go live in 30 minutes.**

[![License: BSL 1.1](https://img.shields.io/badge/license-BSL%201.1-blue.svg)](./LICENSE)
[![Stars](https://img.shields.io/github/stars/dearbulut/xtreampulsar?style=social)](https://github.com/dearbulut/xtreampulsar/stargazers)
[![Built with TypeScript](https://img.shields.io/badge/TypeScript-96%25-3178C6?logo=typescript&logoColor=white)](#tech-stack)
[![NestJS](https://img.shields.io/badge/API-NestJS-E0234E?logo=nestjs&logoColor=white)](#tech-stack)
[![React](https://img.shields.io/badge/UI-React%2018-61DAFB?logo=react&logoColor=black)](#tech-stack)
[![Docker](https://img.shields.io/badge/deploy-Docker-2496ED?logo=docker&logoColor=white)](#-install)
[![PRs welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](./CONTRIBUTING.md)

<sub>A **Bulutworks** signature project · [xtreampulsar.com](https://xtreampulsar.com)</sub>

</div>

---

## 🚀 Live Demo

Try the full panel right now — no install required. This is a shared **demo instance in read-only demo mode**: you can click through everything, but passwords, destructive actions, and settings changes are disabled and may be reset periodically.

| Panel | URL | Username | Password |
|---|---|---|---|
| **Admin** | http://165.245.211.254/dashboard | `admin` | `Admin123!` |
| **Reseller** | http://165.245.211.254/reseller/dashboard | `Reseller2` | `Reseller2` |
| **Client** | http://165.245.211.254/client/dashboard | `test` | `test` |

> Like what you see? A **⭐ star** is the best way to support the project.

---

## Why XtreamPulsar?

**XtreamUI** and **XUI.ONE** defined a generation of IPTV panels — but they're stuck on aging PHP stacks, no longer actively maintained, and painful to secure, scale, or deploy. **XtreamPulsar** is a ground-up rewrite for operators who want a clean, fast, **Docker-native IPTV management panel** with the same **Xtream Codes API** your apps already speak — plus modern security, catch-up/DVR, a full reseller & billing system, and real anti-restream protection.

If you searched for an *"XtreamUI alternative"*, *"XUI.ONE alternative"*, a *"Docker IPTV panel"*, or a *"self-hosted Xtream Codes server"* — this is it.

```bash
curl -fsSL https://raw.githubusercontent.com/dearbulut/xtreampulsar/main/apps/installer/install.sh | sudo bash
```

One command on a fresh Ubuntu server: Docker, secrets, database, panel, firewall and your **admin account** — done. [Full install guide ↓](#-install)

---

## ✨ Full feature list

XtreamPulsar is a complete IPTV operations platform, not just a stream proxy. Every area below maps to a real module in the panel.

### 📺 Streaming core (Xtream Codes API)
- **Full Xtream Codes API compatibility** — `player_api.php`, `get.php`, `xmltv.php`, `panel_api.php` endpoints work with every Xtream-compatible player and app out of the box.
- **Live TV** streaming with proxy and restream modes.
- **VOD / Movies** library with categories, posters, and metadata.
- **Series / TV shows** with seasons, episodes, and per-episode playback.
- **24/7 LOOP channels** — turn a playlist of files into a permanent looping live channel (with shuffle and mixed-resolution normalization).
- **On-the-fly transcoding** — normalize resolution, bitrate, and audio for consistent playback across devices.
- **Idle-sleep** — automatically stops encoding streams nobody is watching to save CPU, and wakes them on demand.

### ⏪ Catch-up, DVR & timeshift
- **Per-channel archive recording** with configurable retention (days).
- **Timeshift playback** via standard `catchup-source` / `tv-archive` M3U attributes — replay any past program.
- Restart-storm protection and self-healing recorder supervision.

### 📅 EPG, playlists & metadata
- **XMLTV EPG** ingestion and delivery, with multi-source EPG sync.
- **M3U / M3U8 sync** — import and auto-refresh external playlists on a schedule.
- **Automatic metadata** enrichment for movies and series (titles, posters, descriptions).
- **Subtitle** management and delivery.
- **Search** across all content.
- **Categories & Bouquets** — organize channels/VOD into bouquets and assign them per package or per line.

### 📱 Player & device compatibility
- **HLS**, **MPEG-TS**, and **M3U / M3U8** output formats.
- **Enigma2** playlist support (get.php `type=enigma2`).
- **MAG / Stalker portal** support for set-top boxes.
- **Live connections** monitor — see every active stream, device, IP, and user in real time.

### 👥 User & line management
- Full **line (user) management** — create, edit, expiry, max-connections, trials, notes.
- **Packages** — bundle bouquets, connection limits, and durations into sellable plans.
- **Client panel** — end-users log in to see their subscription, connection info, and details.
- **Client requests** — customers submit content/support requests from their panel.
- **Activation** flows and per-device provisioning.

### 💼 Reseller system & billing
- **Multi-tier resellers** with credit balances and sub-resellers.
- **Commissions** tracking and payout accounting.
- **Invoices** generation and management.
- **Store** module for selling packages and credits.
- **Reseller API** for programmatic provisioning.
- **WHMCS integration** — automated billing, provisioning, and suspension.
- **White-label** — resellers run the panel under their own brand and domain.

### 🛡️ Anti-piracy & security
- **Restreamer / line-sharing detection** — heuristic scanning of suspicious lines with automatic banning.
- **Concurrent-connection limits** enforced as true simultaneous streams — NAT + same-user-agent sharing can no longer bypass the cap.
- **VPN / proxy blocking** and **datacenter / hosting IP blocking** per line (stops restreamers hosted on VPS providers).
- **Country geo-lock** and **IP allowlists** per line.
- **Device lock** — bind a line to the first device that connects.
- **Correct real-IP resolution** behind Cloudflare / NGINX (no more spoofable last-hop IP).
- **Two-factor authentication (2FA)** for admin accounts.
- **Audit log** of every sensitive action.
- **API keys**, request **filters**, and a hardened **gateway** layer.

### 🖥️ Multi-server & infrastructure
- **Multi-server / load-balancer** architecture — distribute load and edge-serve streams across nodes.
- **Per-server health monitoring** (CPU, RAM, bandwidth, stream counts).
- **Monitoring** and alerting across the fleet.
- **Download manager** — operator-driven, multi-connection downloads (aria2) with speed limits, queueing, and optional auto-VOD import.
- **Backups**, **updates**, and one-click **migration** from XtreamUI / XUI.ONE.
- **Config, Settings, Tools & System** panels for full runtime control.

### 📊 Engagement & automation
- **Analytics dashboards** — usage, active connections, top content, revenue.
- **Notifications** and **webhooks** for integrations and events.
- **Support module** with an **AI-assisted support bot**.

### 🌍 Localization
- Multi-language UI out of the box: **Turkish, English, German, Arabic** (i18next).

---

## XtreamPulsar vs XtreamUI vs XUI.ONE

| | **XtreamPulsar** | XtreamUI | XUI.ONE |
|---|:---:|:---:|:---:|
| Stack | **NestJS + React + TypeScript** | PHP (legacy) | PHP (legacy) |
| Deployment | **Docker, one command** | Manual scripts | Manual scripts |
| Actively maintained | ✅ | ❌ | ⚠️ |
| Xtream Codes API compatible | ✅ | ✅ | ✅ |
| Catch-up / DVR / timeshift | ✅ | Limited | Limited |
| Anti-restream detection | ✅ built-in | ❌ | Partial |
| VPN / datacenter IP block | ✅ | ❌ | ❌ |
| Reseller + WHMCS billing | ✅ | Add-on | Add-on |
| 2FA + audit log | ✅ | ❌ | ❌ |
| Modern responsive UI | ✅ | ❌ | ⚠️ |

*Comparison reflects the maintainers' assessment of publicly available versions. XtreamUI and XUI.ONE are trademarks of their respective owners and are referenced here only for interoperability and comparison.*

---

## 🐳 Install

**Requirements:** Ubuntu 22.04 / 24.04 · 2 GB RAM · 20 GB disk · 2 CPU cores · root access.
A domain is optional — you only need one if you want HTTPS.

### Option A — one command (recommended)

```bash
curl -fsSL https://raw.githubusercontent.com/dearbulut/xtreampulsar/main/apps/installer/install.sh | sudo bash
```

> The command is a **single line** and starts with `curl -fsSL`. If you only paste the URL,
> bash replies `No such file or directory` — it is trying to run the URL as a filename.
> If `curl` is missing: `sudo apt update && sudo apt install -y curl`.

The installer does everything for you:

1. Installs Docker + Docker Compose if missing
2. Clones the repo to `/opt/xtreampulsar`
3. Generates `.env` with strong random secrets (DB, Redis, JWT)
4. Builds and starts every service (API, Web, Postgres, Redis, NGINX)
5. Applies all database migrations
6. Opens firewall ports `22, 80, 443, 25461`
7. **Creates the `admin` account and prints its password**

No license key is required — running it without `--key` installs in open-source / self-host mode.

**With a domain and free Let's Encrypt SSL:**

```bash
curl -fsSL https://raw.githubusercontent.com/dearbulut/xtreampulsar/main/apps/installer/install.sh -o install.sh
sudo bash install.sh --domain panel.example.com --email you@example.com
```

| Flag | Required | Description |
|---|:---:|---|
| `--domain` | no | Panel domain — enables NGINX HTTPS + Let's Encrypt |
| `--email` | no | E-mail for Let's Encrypt notices |
| `--dir` | no | Install directory (default `/opt/xtreampulsar`) |
| `--key` | no | Commercial license key. Omit for self-host mode |

### Option B — manual Docker Compose

Use this if you already run Docker your own way, or you're developing.

```bash
# 1. Clone
git clone https://github.com/dearbulut/xtreampulsar.git
cd xtreampulsar

# 2. Configure — set strong values for POSTGRES_PASSWORD,
#    REDIS_PASSWORD, JWT_SECRET, JWT_REFRESH_SECRET, ADMIN_API_KEY
cp .env.example .env
nano .env

# 3. Launch (API + Web + Postgres + Redis + NGINX)
docker compose up -d --build

# 4. Create your first admin — the manual route does NOT create one for you
docker compose exec api node apps/api/dist/scripts/reset-admin.js admin 'YourStrongPassword1!'
```

> 💡 **Migrations run automatically** every time the API container starts, so you never need to run
> `prisma migrate deploy` by hand — not on install, not after an update.

> ⚠️ **Never commit your `.env`.** It's already in `.gitignore`. Change every default secret before
> exposing the panel to the internet.

---

## 🔑 First login

| | |
|---|---|
| **Panel** | `http://YOUR_SERVER_IP/` (or `https://your-domain` if you used `--domain`) |
| **Username** | `admin` |
| **Password** | Printed by the installer at the end — or the one you passed to `reset-admin` |
| **Xtream API** | `http://YOUR_SERVER_IP:25461` |
| **Player URL** | `http://YOUR_SERVER_IP:25461/player_api.php?username=USER&password=PASS` |

The installer shows the admin password **only once**, in the green "Erişim Bilgileri" box at the end.
Save it, then change it from **Settings → Profile** after your first login.

Lost it? See below — nothing is unrecoverable.

---

## 🛠️ Troubleshooting

<details>
<summary><b>I can't log in / no admin account was created</b></summary>

This is by far the most common issue, and there's a one-line fix. Run it from your install
directory (`/opt/xtreampulsar`, or wherever you cloned):

```bash
docker compose exec api node apps/api/dist/scripts/reset-admin.js admin 'NewPassword1!'
```

The same command **creates** the first admin if none exists and **resets the password** if the
account is already there. Then log in with `admin` / `NewPassword1!`.
</details>

<details>
<summary><b>Login returns HTTP 500, or logs say <code>column ... does not exist</code></b></summary>

Your database schema is older than the code. Current versions apply migrations automatically at
API startup, so pulling and restarting is enough:

```bash
git pull
docker compose up -d --build
docker compose logs -f api      # watch for "migrations applied"
```

To force it manually:

```bash
docker compose exec api npx prisma migrate deploy
```
</details>

<details>
<summary><b><code>cd: /opt/xtreampulsar: No such file or directory</code></b></summary>

`/opt/xtreampulsar` only exists if you used the one-command installer. If you cloned the repo
yourself, your install lives in that clone directory. Find it with:

```bash
docker inspect $(docker compose ls -q 2>/dev/null | head -1) 2>/dev/null ||   find / -maxdepth 4 -name docker-compose.yml -path '*xtreampulsar*' 2>/dev/null
```

Every `docker compose ...` command must be run **inside** that directory.
</details>

<details>
<summary><b>Containers are running but the panel doesn't open</b></summary>

```bash
docker compose ps                    # all services should be "Up"/"healthy"
docker compose logs --tail=100 api   # look for the real error
sudo ufw status                      # ports 80, 443, 25461 must be allowed
```

If a cloud provider firewall (DigitalOcean, Hetzner, AWS Security Groups) sits in front of the
server, open the same ports there too.
</details>

<details>
<summary><b>Health check, logs, update and uninstall</b></summary>

```bash
cd /opt/xtreampulsar

sudo ./health-check.sh          # containers, API, DB, Redis, disk, RAM, ports, firewall
docker compose logs -f api      # live API logs
sudo ./update.sh                # backup + pull + rebuild + migrate + health check
sudo ./uninstall.sh             # removes everything (asks twice)
```

Manual update without the installer scripts: `git pull && docker compose up -d --build`.
</details>

**Still stuck?** [Open an issue](https://github.com/dearbulut/xtreampulsar/issues/new/choose) with the
output of `docker compose ps` and `docker compose logs --tail=100 api` — that's almost always enough
to diagnose it. For quick questions: [Telegram](https://t.me/bulutworksdev).

---

## 🧱 Tech stack

| Layer | Technology |
|---|---|
| API | **NestJS 10**, TypeScript 5.5, Prisma ORM |
| Web UI | **React 18**, Vite, TanStack Router, react-query, i18next (TR/EN/DE/AR) |
| Control panel | Next.js 14 |
| Data | **PostgreSQL**, **Redis** |
| Streaming | FFmpeg, HLS, aria2 |
| Infra | **Docker Compose**, NGINX, Node.js 20, pnpm monorepo |

---

## 🗺️ Roadmap

XtreamPulsar is under **active development** toward its first public pilot. On the way: expanded catch-up UX, richer analytics, more migration sources, and a hosted edition. **Star ⭐ and watch 👀** to follow along — issues and feature requests are welcome.

---

## 🤝 Contributing

Contributions, bug reports, and feature ideas are welcome — see [CONTRIBUTING.md](./CONTRIBUTING.md). If XtreamPulsar is useful to you, the best way to support the project is a **⭐ star** and sharing it.

---

## 💜 Support the project

XtreamPulsar is free to self-host and always will be. If it saves you time or money, a donation
helps cover test servers, domains and demo bandwidth. Full details and safety notes:
**[DONATE.md](./DONATE.md)**.

| Coin | Network | Address |
|---|---|---|
| **USDT** | Tron (TRC20) | `TN9CUKG8UAkipPq3bL5Sr13aTVmSeV1ajY` |
| **BTC** | Bitcoin mainnet | `1MvCv9bePbkfJNx1e8DWjiSbia1uimjvMR` |
| **BNB** | BNB Smart Chain (BEP20) | `0x8d186a007e71ccd2c6fca98328112e77c696309a` |

> ⚠️ Check the **network** before sending — crypto transfers are irreversible. These addresses are
> official only as published in this repository on the `main` branch.

---

## 📄 License

XtreamPulsar is **source-available** under the **[Business Source License 1.1](./LICENSE)**.

You can read, self-host, and modify the code for your own use. You **may not** offer XtreamPulsar (or a derivative) as a commercial hosted/managed panel product to third parties without a commercial license. Each release converts to the Apache 2.0 open-source license on its Change Date. For commercial licensing, contact **Bulutworks**.

---

<div align="center">
<sub>Built with ⚡ by <b>Bulutworks</b> — leave XtreamUI, XUI.ONE and Xtream-Masters behind.</sub>
</div>
