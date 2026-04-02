FROM node:22-alpine
RUN apk add --no-cache openssl
WORKDIR /app

COPY package.json package-lock.json ./
COPY prisma ./prisma/
COPY prisma.config.ts ./

RUN npm ci --omit=dev
RUN npx prisma generate

EXPOSE 5555

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:5555 || exit 1

CMD ["npx", "prisma", "studio", "--port", "5555", "--browser", "none"]
