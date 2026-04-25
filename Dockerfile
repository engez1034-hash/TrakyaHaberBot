FROM node:22-alpine
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
WORKDIR /app

COPY package.json pnpm-workspace.yaml turbo.json ./
COPY apps/web/package.json ./apps/web/package.json
COPY packages/database/package.json ./packages/database/package.json
COPY packages/config/package.json ./packages/config/package.json
COPY packages/logger/package.json ./packages/logger/package.json
COPY packages/queue/package.json ./packages/queue/package.json
COPY packages/types/package.json ./packages/types/package.json
COPY packages/ai/package.json ./packages/ai/package.json
COPY packages/ui/package.json ./packages/ui/package.json

RUN pnpm install --no-frozen-lockfile

COPY . .

RUN cd packages/database && npx prisma@6.19.3 generate --schema=prisma/schema.prisma

RUN pnpm --filter @trakyahaber/web build

WORKDIR /app/apps/web
EXPOSE 3000
CMD ["npx", "next", "start", "-H", "0.0.0.0", "-p", "3000"]
