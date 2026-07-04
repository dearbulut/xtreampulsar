FROM node:20-alpine AS builder
WORKDIR /app

RUN npm install -g pnpm

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/control/ ./apps/control/

RUN pnpm install --frozen-lockfile --filter @xtreampulsar/control
RUN pnpm --filter @xtreampulsar/control build

FROM node:20-alpine
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3003
ENV HOSTNAME=0.0.0.0

COPY --from=builder /app/apps/control/.next/standalone ./
COPY --from=builder /app/apps/control/.next/static ./apps/control/.next/static

EXPOSE 3003
CMD ["node", "apps/control/server.js"]
