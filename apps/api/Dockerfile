FROM node:20-alpine AS builder
WORKDIR /repo

RUN npm install -g pnpm
RUN apk add --no-cache python3 make g++ openssl ffmpeg

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY tsconfig.base.json ./
COPY packages/ ./packages/
COPY apps/api/ ./apps/api/

RUN pnpm install --frozen-lockfile
RUN cd packages/database && npx prisma generate
RUN pnpm --filter @xtreampulsar/api build

FROM node:20-alpine
WORKDIR /app
RUN apk add --no-cache ffmpeg openssl

ENV NODE_ENV=production

COPY --from=builder /repo/apps/api/dist ./dist
COPY --from=builder /repo/node_modules ./node_modules
COPY --from=builder /repo/packages ./packages

EXPOSE 3000
CMD ["node", "dist/main.js"]
