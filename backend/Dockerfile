# Using Debian-based image (slim) instead of Alpine to ensure glibc compatibility 
# for binary tools like fbx2gltf (which don't support musl/Alpine)
FROM node:18-slim

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install system dependencies (Debian based)
# ca-certificates for potential HTTPS issues, ffmpeg for video, openssl for Prisma, assimp-utils for 3D conversion
# chromium and fonts for puppeteer
RUN apt-get update -y && apt-get install -y openssl ffmpeg dos2unix ca-certificates assimp-utils chromium fonts-ipafont-gothic fonts-wqy-zenhei fonts-thai-tlwg fonts-kacst fonts-freefont-ttf libxss1 --no-install-recommends && rm -rf /var/lib/apt/lists/*

# Install dependencies dependencies
RUN npm install

# Copy application code
COPY . .

# Generate Prisma Client
RUN npx prisma generate

# Make start script executable
RUN dos2unix start.sh
RUN chmod +x start.sh

# Expose port
EXPOSE 3000

# Start command
CMD ["./start.sh"]
