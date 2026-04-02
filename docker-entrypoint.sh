#!/bin/sh
set -e

echo "Running Prisma migrations..."
npx prisma migrate deploy || echo "WARNING: Migrations failed. Continuing with server startup..."

echo "Starting Next.js server..."
exec node server.js
