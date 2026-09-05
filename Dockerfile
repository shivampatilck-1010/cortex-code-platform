# Multi-stage Dockerfile for Cortex Cloud IDE
# Base image with Node.js, Python, and GCC/G++ build tools
FROM node:20-bookworm-slim AS base

# Install system dependencies: Python 3, GCC, G++, Make, Git, Curl
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    g++ \
    gcc \
    make \
    git \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Dependencies installation stage
FROM base AS deps
COPY package.json package-lock.json* ./
RUN npm ci

# Builder stage
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
RUN npm run build

# Production runner stage
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000

# Create persistent data directory for feedback database
RUN mkdir -p /app/data && chmod 777 /app/data

# Copy built artifacts and necessary files
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

EXPOSE 3000

CMD ["npm", "start"]
