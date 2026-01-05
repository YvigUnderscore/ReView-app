#!/bin/sh
set -e

# Get absolute path to current directory
PWD=$(pwd)

# Default DATA_PATH if not set
if [ -z "$DATA_PATH" ]; then
  # Use absolute path for default to avoid ambiguity with Prisma
  export DATA_PATH="$PWD/storage"
  echo "DATA_PATH not set, using default: $DATA_PATH"
fi

# Ensure DATA_PATH exists
mkdir -p "$DATA_PATH"

# Default DATABASE_URL if not set
if [ -z "$DATABASE_URL" ]; then
  # Use the absolute DATA_PATH
  export DATABASE_URL="file:${DATA_PATH}/review.db"
  echo "DATABASE_URL not set, using default: $DATABASE_URL"
fi

# Run migrations
echo "Running database migrations..."
npx prisma migrate deploy

# Start application
echo "Starting application..."
exec node server.js
