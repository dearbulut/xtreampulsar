FROM node:20-alpine AS builder
WORKDIR /repo

RUN npm install -g pnpm
RUN apk add --no-cache python3 make g++ openssl

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./
COPY tsconfig.base.json ./
COPY packages/ ./packages/
COPY apps/license/ ./apps/license/

RUN pnpm install --frozen-lockfile
RUN cd packages/database && npx prisma generate
RUN pnpm --filter @xtreampulsar/database build
RUN pnpm --filter @xtreampulsar/types build
RUN pnpm --filter @xtreampulsar/config build
RUN pnpm --filter @xtreampulsar/license build

FROM node:20-alpine
WORKDIR /repo
RUN apk add --no-cache openssl

ENV NODE_ENV=production

COPY --from=builder /repo/node_modules ./node_modules
COPY --from=builder /repo/package.json ./package.json
COPY --from=builder /repo/pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY --from=builder /repo/packages ./packages
COPY --from=builder /repo/apps/license/dist ./apps/license/dist
COPY --from=builder /repo/apps/license/package.json ./apps/license/package.json
COPY --from=builder /repo/apps/license/node_modules ./apps/license/node_modules

EXPOSE 3001
CMD ["node", "apps/license/dist/main.js"]
