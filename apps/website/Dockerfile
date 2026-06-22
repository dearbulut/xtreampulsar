FROM node:20-alpine AS builder
WORKDIR /app

RUN npm install -g pnpm

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/website/ ./apps/website/

RUN pnpm install --frozen-lockfile --filter @xtreampulsar/website
RUN pnpm --filter @xtreampulsar/website build

FROM node:20-alpine
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3002
ENV HOSTNAME=0.0.0.0

COPY --from=builder /app/apps/website/.next/standalone ./
COPY --from=builder /app/apps/website/.next/static ./apps/website/.next/static
COPY --from=builder /app/apps/website/public ./apps/website/public

EXPOSE 3002
CMD ["node", "apps/website/server.js"]
