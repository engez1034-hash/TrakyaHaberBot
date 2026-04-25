FROM node:22-alpine
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
RUN npm install -g turbo
WORKDIR /app
COPY . .
RUN pnpm install --no-frozen-lockfile
RUN cd packages/database && npx prisma@6.19.3 generate --schema=prisma/schema.prisma

ENV NEXT_TELEMETRY_DISABLED=1

RUN turbo build --filter=@trakyahaber/database --filter=@trakyahaber/queue --filter=@trakyahaber/types --filter=@trakyahaber/config --filter=@trakyahaber/logger
RUN cd apps/web && npx next build --experimental-build-mode compile

RUN printf '#!/bin/sh\ncd /app/packages/database\nnpx prisma db push --schema=prisma/schema.prisma --skip-generate\nnpx prisma db seed || true\ncd /app/apps/web\nnpx next build --experimental-build-mode generate\nnpx next start -H 0.0.0.0 -p ${PORT:-3000}\n' > /app/start.sh && chmod +x /app/start.sh

EXPOSE 3000
CMD ["/app/start.sh"]
