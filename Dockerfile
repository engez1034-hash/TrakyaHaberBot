FROM node:22-alpine
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
RUN npm install -g turbo
WORKDIR /app
COPY . .
RUN pnpm install --no-frozen-lockfile
RUN cd packages/database && npx prisma@6.19.3 generate --schema=prisma/schema.prisma

ENV NEXT_TELEMETRY_DISABLED=1
ENV DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy"
ENV REDIS_URL="redis://localhost:6379"

RUN turbo build --filter=@trakyahaber/database --filter=@trakyahaber/queue --filter=@trakyahaber/types --filter=@trakyahaber/config --filter=@trakyahaber/logger
RUN cd apps/web && npx next build --experimental-build-mode compile

WORKDIR /app/apps/web
EXPOSE 3000
CMD CMD ["sh", "-c", "cd /app/packages/database && npx prisma db push --schema=prisma/schema.prisma && npx prisma db seed && cd /app/apps/web && node .next/standalone/apps/web/server.js"]
