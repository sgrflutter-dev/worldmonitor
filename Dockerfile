# ── Stage 1: Build ────────────────────────────────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package.json package-lock.json ./
RUN npm ci

# Copy source
COPY . .

# Build the sebuf RPC gateway bundle (api/[domain]/v1/[rpc].ts → [rpc].js)
RUN node scripts/build-sidecar-sebuf.mjs

# Build the SPA
RUN VITE_VARIANT=full npx vite build

# ── Stage 2: Production ──────────────────────────────────────────────────
FROM node:22-alpine

WORKDIR /app

# Copy built SPA
COPY --from=builder /app/dist ./dist

# Copy API handlers (sidecar loads .js files at runtime)
COPY --from=builder /app/api ./api

# Copy the sidecar server
COPY --from=builder /app/src-tauri/sidecar/local-api-server.mjs ./src-tauri/sidecar/local-api-server.mjs

# Copy static data files
COPY --from=builder /app/data ./data

# Copy our static file server + API proxy
COPY --from=builder /app/server.mjs ./server.mjs

# Install only the runtime dependencies needed by API handlers
RUN npm init -y > /dev/null 2>&1 && \
    npm install --save @upstash/ratelimit@^2.0.8 @upstash/redis@^1.36.1 convex@^1.32.0 2>/dev/null

EXPOSE 3000

# Start both the sidecar API server (port 46123) and the static file server (port 3000)
CMD ["sh", "-c", "node src-tauri/sidecar/local-api-server.mjs & node server.mjs"]
