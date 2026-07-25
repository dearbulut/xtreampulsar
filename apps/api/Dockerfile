FROM node:20-alpine AS builder
WORKDIR /repo

RUN npm install -g pnpm
RUN apk add --no-cache python3 make g++ openssl postgresql-client

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY tsconfig.base.json ./
COPY packages/ ./packages/
COPY apps/api/ ./apps/api/

RUN pnpm install --frozen-lockfile
RUN cd packages/database && npx prisma generate
RUN pnpm --filter @xtreampulsar/database build
RUN pnpm --filter @xtreampulsar/types build
RUN pnpm --filter @xtreampulsar/config build
RUN pnpm --filter @xtreampulsar/api build

FROM node:20-alpine
WORKDIR /repo
RUN apk add --no-cache ffmpeg aria2 openssl postgresql-client wget ca-certificates \
 && wget -O /usr/local/bin/yt-dlp https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_musllinux \
 && chmod +x /usr/local/bin/yt-dlp \
 && /usr/local/bin/yt-dlp --version

ENV NODE_ENV=production

COPY --from=builder /repo/node_modules ./node_modules
COPY --from=builder /repo/package.json ./package.json
COPY --from=builder /repo/pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY --from=builder /repo/packages ./packages
COPY --from=builder /repo/apps/api/dist ./apps/api/dist
COPY --from=builder /repo/apps/api/package.json ./apps/api/package.json
COPY --from=builder /repo/apps/api/node_modules ./apps/api/node_modules
COPY --from=builder /repo/apps/api/docker-entrypoint.sh ./apps/api/docker-entrypoint.sh
RUN chmod +x ./apps/api/docker-entrypoint.sh

EXPOSE 3000
CMD ["sh", "apps/api/docker-entrypoint.sh"]
