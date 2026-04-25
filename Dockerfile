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

RUN find /app/apps/web/app -name "page.tsx" -exec grep -l "generateStaticParams" {} \; | xargs -I{} sed -i '1s/^/export const dynamic = "force-dynamic";\n/' {}
RUN find /app/apps/web/app -name "route.ts" -exec sed -i '1s/^/export const dynamic = "force-dynamic";\n/' {} \;

RUN turbo build --filter=@trakyahaber/web || pnpm --filter @trakyahaber/web build

WORKDIR /app/apps/web
EXPOSE 3000
CMD ["node", ".next/standalone/apps/web/server.js"]
