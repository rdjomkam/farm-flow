# Stage 1: Install dependencies and generate Prisma client
FROM node:22-alpine AS deps
RUN apk add --no-cache openssl
WORKDIR /app

COPY package.json package-lock.json ./
COPY prisma ./prisma/
COPY prisma.config.ts ./

RUN npm ci
# prisma generate already runs via postinstall, but ensure it ran
RUN npx prisma generate

# Stage 2: Build the Next.js application
FROM node:22-alpine AS builder
RUN apk add --no-cache openssl
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/src/generated ./src/generated
COPY . .

ARG COMMIT_SHA
ENV COMMIT_SHA=${COMMIT_SHA}
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# Use npx next build --webpack directly (NOT npm run build which includes prisma migrate deploy)
RUN npx next build --webpack

# Stage 3: Production runner
FROM node:22-alpine AS runner
RUN apk add --no-cache openssl
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy Next.js standalone output
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Copy Prisma schema, migrations, and config (needed for migrate deploy at startup)
COPY --from=builder /app/prisma ./prisma/
COPY --from=builder /app/prisma.config.ts ./

# Copy generated Prisma client
COPY --from=builder /app/src/generated ./src/generated/

# Copy full node_modules for prisma CLI and pg driver
COPY --from=deps /app/node_modules ./node_modules

# Copy entrypoint script
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

# Set ownership
RUN chown -R nextjs:nodejs /app
RUN chown nextjs:nodejs /docker-entrypoint.sh

USER nextjs

EXPOSE 3000

HEALTHCHECK --interval=10s --timeout=10s --start-period=120s --retries=5 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:3000/api/health || exit 1

ENTRYPOINT ["/docker-entrypoint.sh"]
