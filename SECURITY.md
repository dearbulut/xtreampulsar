# Security Policy

## Reporting a vulnerability

XtreamPulsar takes security seriously. If you discover a vulnerability, please **do not open a public issue**. Instead, report it privately:

- Use GitHub's [private security advisory](https://github.com/dearbulut/xtreampulsar/security/advisories/new) feature, or
- Contact **Bulutworks** through [xtreampulsar.com](https://xtreampulsar.com).

Please include steps to reproduce and the potential impact. We aim to acknowledge reports promptly and will credit responsible disclosures.

## Supported versions

XtreamPulsar is under active development; security fixes target the latest `main`.

## Hardening reminders for operators

- Always change every default secret in `.env` before going live.
- Never commit your `.env` file (it is gitignored by default).
- Put the panel behind HTTPS and restrict admin access.
- Keep Docker images and dependencies up to date.
