FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install system dependencies
RUN apk add --no-cache openssl ffmpeg

# Install dependencies
RUN npm ci

# Copy application code
COPY . .

# Generate Prisma Client
RUN npx prisma generate

# Make start script executable
RUN chmod +x start.sh

# Expose port
EXPOSE 3000

# Start command
CMD ["./start.sh"]
