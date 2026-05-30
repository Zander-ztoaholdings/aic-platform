FROM node:20-alpine AS base
WORKDIR /app
RUN npm install -g turbo@2

# ── Prune monorepo to platform workspace ─────────────────────────────────────
FROM base AS pruner
COPY . .
RUN turbo prune platform --docker

# ── Install dependencies ──────────────────────────────────────────────────────
FROM base AS installer
COPY --from=pruner /app/out/json/ .
COPY --from=pruner /app/out/package-lock.json ./package-lock.json
RUN npm ci --ignore-scripts

# ── Build ─────────────────────────────────────────────────────────────────────
FROM installer AS builder
COPY --from=pruner /app/out/full/ .
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_OPTIONS=--max-old-space-size=4096
RUN npx turbo build --filter=platform

# ── Production image ──────────────────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3001

RUN addgroup --system --gid 1001 nodejs && \
    adduser  --system --uid 1001 nextjs

COPY --from=builder --chown=nextjs:nodejs /app/apps/platform/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/platform/.next/static ./apps/platform/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/apps/platform/public ./apps/platform/public

USER nextjs
EXPOSE 3001

CMD ["node", "apps/platform/server.js"]
