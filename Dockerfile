# syntax=docker/dockerfile:1

# ============================================
# Stage 1: Chromium base (heaviest layer, cached separately)
# ============================================
FROM node:20-alpine AS chromium-base
RUN apk add --no-cache chromium

# ============================================
# Stage 2: Build frontend + backend
# ============================================
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files (cached if package*.json unchanged)
COPY package*.json ./

# Install all dependencies (including dev)
RUN --mount=type=cache,target=/root/.npm npm ci

# Copy source files
COPY . .

# Pass build-time arguments for Vite
ARG VITE_TELEGRAM_BOT_USERNAME
ENV VITE_TELEGRAM_BOT_USERNAME=$VITE_TELEGRAM_BOT_USERNAME

# Build frontend (Vite) and server (TypeScript)
RUN npm run build

# ============================================
# Stage 3: Production (uses cached Chromium layer)
# ============================================
FROM chromium-base AS runner

WORKDIR /app

# Set production environment
ENV NODE_ENV=production
ENV CHROME_PATH=/usr/bin/chromium-browser

# Copy package files
COPY package*.json ./

# Install only production dependencies (npm cache persisted between builds)
RUN --mount=type=cache,target=/root/.npm npm ci --omit=dev

# Copy built assets from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/dist-server ./dist-server

# Copy fonts directory for PDF generation
COPY --from=builder /app/api/_assets ./api/_assets

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1

# Start the server
CMD ["node", "dist-server/server.js"]
