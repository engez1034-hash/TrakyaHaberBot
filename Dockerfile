# deploy-v5
FROM node:22-alpine
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
RUN npm install -g turbo
WORKDIR /app
COPY . .
RUN pnpm install --no-frozen-lockfile
RUN cd packages/database && npx prisma@6.19.3 generate --schema=prisma/schema.prisma

ENV NEXT_TELEMETRY_DISABLED=1

RUN echo 'DATABASE_URL=postgresql://postgres:YYzvHBOctTMCUfPtntsucYcitLFblzCS@gondola.proxy.rlwy.net:49156/railway' > /app/.env
RUN echo 'DATABASE_URL=postgresql://postgres:YYzvHBOctTMCUfPtntsucYcitLFblzCS@gondola.proxy.rlwy.net:49156/railway' > /app/packages/database/.env
RUN echo 'DATABASE_URL=postgresql://postgres:YYzvHBOctTMCUfPtntsucYcitLFblzCS@gondola.proxy.rlwy.net:49156/railway' > /app/apps/web/.env
RUN echo 'REDIS_URL=redis://localhost:6379' >> /app/.env
RUN echo 'REDIS_URL=redis://localhost:6379' >> /app/apps/web/.env

RUN find /app/apps/web/app -name "route.ts" -exec node -e "const fs=require('fs');const f=process.argv[1];const c=fs.readFileSync(f,'utf8');if(!c.includes('export const dynamic')){fs.writeFileSync(f,'export const dynamic=\"force-dynamic\";\n'+c)}" {} \;

RUN turbo build --filter=@trakyahaber/web

RUN rm -f /app/.env /app/packages/database/.env /app/apps/web/.env

RUN printf '#!/bin/sh\ncd /app/packages/database\nnpx prisma db push --schema=prisma/schema.prisma --skip-generate\nnpx prisma db seed || true\ncd /app/apps/web\nnpx next start -H 0.0.0.0 -p ${PORT:-3000}\n' > /app/start.sh && chmod +x /app/start.sh

EXPOSE 3000
CMD ["/app/start.sh"]
