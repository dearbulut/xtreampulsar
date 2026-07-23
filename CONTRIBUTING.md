# Contributing to XtreamPulsar

Thanks for your interest in XtreamPulsar! Contributions of all kinds are welcome — bug reports, feature ideas, documentation, and code.

## Ways to help

- ⭐ **Star the repo** — it genuinely helps visibility and motivates development.
- 🐛 **Report bugs** via [Issues](https://github.com/dearbulut/xtreampulsar/issues). Include steps to reproduce, expected vs actual behavior, and your environment (OS, Docker version, browser).
- 💡 **Request features** via Issues — describe the problem you're trying to solve, not just the solution.
- 🔧 **Submit pull requests** for fixes and improvements.

## Development setup

XtreamPulsar is a pnpm monorepo (NestJS API + React web + Next.js control).

```bash
git clone https://github.com/dearbulut/xtreampulsar.git
cd xtreampulsar
cp .env.example .env          # set local secrets
docker compose up -d          # postgres + redis + services
pnpm install
```

- API: `apps/api` (NestJS 10, Prisma)
- Web: `apps/web` (React 18 + Vite)
- Database schema & migrations: `packages/database/prisma`

Run type checks before opening a PR:

```bash
pnpm -r typecheck
```

## Pull request guidelines

1. Fork the repo and create a branch from `main` (`feat/...`, `fix/...`).
2. Keep PRs focused — one logical change per PR.
3. Match the existing code style (TypeScript, English identifiers).
4. Describe **what** and **why** in the PR description.
5. Make sure the build is clean.

## License

By contributing, you agree that your contributions are licensed under the project's [Business Source License 1.1](./LICENSE).

## Code of conduct

Be respectful and constructive. XtreamPulsar is a tool for **legitimate IPTV operators** — we don't support or assist content piracy, and the project's anti-restream features exist to protect operators' rights.
