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
RUN apk add --no-cache ffmpeg openssl postgresql-client

ENV NODE_ENV=production

COPY --from=builder /repo/node_modules ./node_modules
COPY --from=builder /repo/package.json ./package.json
COPY --from=builder /repo/pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY --from=builder /repo/packages ./packages
COPY --from=builder /repo/apps/api/dist ./apps/api/dist
COPY --from=builder /repo/apps/api/package.json ./apps/api/package.json
COPY --from=builder /repo/apps/api/node_modules ./apps/api/node_modules

EXPOSE 3000
CMD ["node", "apps/api/dist/main.js"]
