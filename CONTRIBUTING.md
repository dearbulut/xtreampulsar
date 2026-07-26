# Contributing to XtreamPulsar

Thanks for your interest in XtreamPulsar! Contributions of all kinds are welcome — bug reports,
feature ideas, documentation, translations, and code.

## Ways to help

- ⭐ **Star the repo** — it genuinely helps visibility and motivates development.
- 🐛 **Report bugs** via [Issues](https://github.com/dearbulut/xtreampulsar/issues/new/choose).
- 🆘 **Stuck installing?** Use the *Install / setup help* template — but check the
  [README troubleshooting section](./README.md#%EF%B8%8F-troubleshooting) first; most problems have a one-line fix.
- 💡 **Request features** via Issues — describe the problem you're trying to solve, not just the solution.
- 🌍 **Translate the panel** — see [Adding a language](#adding-a-language) below.
- 🔧 **Submit pull requests** for fixes and improvements.

## Filing a good bug report

The issue forms ask for these because they're what actually make a report actionable:

- **What you did, expected, and got** — in that order.
- **`docker compose ps`** — shows whether a service is down or restart-looping.
- **`docker compose logs --tail=100 api`** — contains the real error almost every time.
- **Your commit** — `git rev-parse --short HEAD` inside the install directory.

Please redact secrets, license keys, customer credentials, and public IPs before pasting logs.

## Development setup

XtreamPulsar is a pnpm monorepo (NestJS API + React web + Next.js control panel).

```bash
git clone https://github.com/dearbulut/xtreampulsar.git
cd xtreampulsar
cp .env.example .env          # set local secrets
pnpm install
docker compose up -d postgres redis     # just the datastores for local dev
pnpm db:generate                        # generate the Prisma client
pnpm db:migrate                         # apply migrations
pnpm dev                                # API + web in watch mode
```

To run the whole stack in Docker instead:

```bash
docker compose up -d --build
docker compose exec api node apps/api/dist/scripts/reset-admin.js admin 'YourStrongPassword1!'
```

Migrations are applied automatically when the API container starts.

### Layout

| Path | What lives there |
|---|---|
| `apps/api` | NestJS 10 API, Xtream Codes endpoints, workers |
| `apps/web` | React 18 + Vite admin/reseller/client panel |
| `apps/control` | Next.js 14 control panel |
| `apps/installer` | `install.sh`, `update.sh`, `health-check.sh`, `uninstall.sh` |
| `packages/database` | Prisma schema and migrations |

### Database changes

Never hand-edit an applied migration. Change `packages/database/prisma/schema.prisma`, then:

```bash
pnpm --filter @xtreampulsar/database exec prisma migrate dev --name short_description
```

Commit the generated migration directory together with the schema change.

### Adding a language

UI strings live in `apps/web/src/i18n/locales/<lang>.json`. Copy `en.json`, translate the values
(keep the keys), and register the language in `apps/web/src/i18n/i18n.ts`. Turkish, English, German
and Arabic ship today.

## Before opening a PR

```bash
pnpm typecheck     # must be clean
pnpm lint
pnpm build
```

1. Fork the repo and create a branch from `main` (`feat/...`, `fix/...`, `docs/...`).
2. Keep PRs focused — one logical change per PR.
3. Match the existing code style (TypeScript, English identifiers and comments).
4. Describe **what** and **why** in the PR description; screenshots for UI changes.
5. Don't commit `.env`, build output, or generated Prisma clients.

## Security issues

Please **do not** open a public issue for vulnerabilities — follow [SECURITY.md](./SECURITY.md)
and use a private advisory instead.

## License

By contributing, you agree that your contributions are licensed under the project's
[Business Source License 1.1](./LICENSE).

## Code of conduct

Be respectful and constructive. XtreamPulsar is a tool for **legitimate IPTV operators** — we don't
support or assist content piracy, and the project's anti-restream features exist to protect
operators' rights.
