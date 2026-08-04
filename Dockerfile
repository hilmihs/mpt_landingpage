# Image untuk Cloud Run. Multi-stage supaya toolchain build tidak ikut terkirim.
#
#   gcloud builds submit --tag asia-southeast2-docker.pkg.dev/PROJECT/mpt/web
#   gcloud run deploy mpt-web --image ... --region asia-southeast2
#
# Variabel rahasia (DATABASE_URL, AUTH_SECRET, KIRIMI_*, dst) TIDAK dibangun ke
# dalam image — pasang lewat Secret Manager saat deploy. Lihat docs/DEPLOY_GCP.md.

FROM node:24-alpine AS deps
WORKDIR /app
RUN corepack enable
# pnpm-workspace.yaml WAJIB ikut: sejak pnpm 11 di situlah allowBuilds tinggal,
# dan tanpanya install berhenti dengan ERR_PNPM_IGNORED_BUILDS.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

FROM node:24-alpine AS builder
WORKDIR /app
RUN corepack enable
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Next membaca env saat build untuk halaman statis. Nilai NEXT_PUBLIC_* yang
# benar dipasang di sini; sisanya dibaca saat runtime.
ARG NEXT_PUBLIC_SITE_URL
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm build

FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Jangan jalan sebagai root.
RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Migrasi dijalankan terpisah (pnpm db:migrate), bukan saat container start:
# Cloud Run bisa menaikkan banyak instance sekaligus, dan migrasi paralel
# saling menimpa.
COPY --from=builder --chown=nextjs:nodejs /app/db ./db

USER nextjs
EXPOSE 8080
ENV PORT=8080
ENV HOSTNAME=0.0.0.0

CMD ["node", "server.js"]
