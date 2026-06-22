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
RUN pnpm --filter @xtreampulsar/license build

FROM node:20-alpine
WORKDIR /app
RUN apk add --no-cache openssl

ENV NODE_ENV=production

COPY --from=builder /repo/node_modules ./node_modules
COPY --from=builder /repo/packages ./packages
COPY --from=builder /repo/apps/license/dist ./dist
COPY --from=builder /repo/apps/license/package.json ./package.json

EXPOSE 3001
CMD ["node", "dist/main.js"]
