<div align="center">

<img width="820" alt="XtreamPulsar — modern self-hosted IPTV panel dashboard" src="https://github.com/user-attachments/assets/9e55790e-8f88-4425-b34d-ad5d7f88b4a5" />

# XtreamPulsar

### The modern, self-hosted IPTV panel — an open, Docker-native alternative to XtreamUI, XUI.ONE and Xtream-Masters.

**Xtream Codes API compatible · one-click migration · go live in 30 minutes.**

[![License: BSL 1.1](https://img.shields.io/badge/license-BSL%201.1-blue.svg)](./LICENSE)
[![Stars](https://img.shields.io/github/stars/dearbulut/xtreampulsar?style=social)](https://github.com/dearbulut/xtreampulsar/stargazers)
[![Built with TypeScript](https://img.shields.io/badge/TypeScript-96%25-3178C6?logo=typescript&logoColor=white)](#tech-stack)
[![NestJS](https://img.shields.io/badge/API-NestJS-E0234E?logo=nestjs&logoColor=white)](#tech-stack)
[![React](https://img.shields.io/badge/UI-React%2018-61DAFB?logo=react&logoColor=black)](#tech-stack)
[![Docker](https://img.shields.io/badge/deploy-Docker-2496ED?logo=docker&logoColor=white)](#-quick-start-docker)
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
git clone https://github.com/dearbulut/xtreampulsar.git
cd xtreampulsar && cp .env.example .env      # set your passwords & secrets
docker compose up -d --build                 # go live
```

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

## 🐳 Quick start (Docker)

**Requirements:** a Linux server with Docker + Docker Compose, and a domain pointed at it.

```bash
# 1. Clone
git clone https://github.com/dearbulut/xtreampulsar.git
cd xtreampulsar

# 2. Configure — open .env and set strong values for:
#    POSTGRES_PASSWORD, REDIS_PASSWORD, JWT_SECRET, JWT_REFRESH_SECRET
cp .env.example .env

# 3. Launch (API + Web + Postgres + Redis + NGINX)
docker compose up -d --build

# 4. Apply database migrations
docker compose exec api npx prisma migrate deploy
```

Then open your panel in the browser and finish setup. Point any Xtream-compatible player at `http://your-domain:port/player_api.php?username=...&password=...`.

> ⚠️ **Never commit your `.env`.** It's already in `.gitignore`. Always change every default secret before exposing the panel to the internet.

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

## 📄 License

XtreamPulsar is **source-available** under the **[Business Source License 1.1](./LICENSE)**.

You can read, self-host, and modify the code for your own use. You **may not** offer XtreamPulsar (or a derivative) as a commercial hosted/managed panel product to third parties without a commercial license. Each release converts to the Apache 2.0 open-source license on its Change Date. For commercial licensing, contact **Bulutworks**.

---

<div align="center">
<sub>Built with ⚡ by <b>Bulutworks</b> — leave XtreamUI, XUI.ONE and Xtream-Masters behind.</sub>
</div>
