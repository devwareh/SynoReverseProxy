# Frontend Dockerfile for Synology Reverse Proxy Manager
# Multi-stage build: Build React app, then serve with nginx

# Stage 1: Build React application
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build argument for API URL
# Note: In Docker, the browser (client-side) needs to access backend via host
# So we use window.location.hostname fallback, or set this to empty to use fallback
# For Portainer/external access, you may want to set this to your NAS hostname:PORT
ARG REACT_APP_API_URL=
ENV REACT_APP_API_URL=$REACT_APP_API_URL

# Build argument for backend API port (used by frontend to connect to backend)
# This should match BACKEND_PORT from docker-compose.yml
ARG REACT_APP_API_PORT=18888
ENV REACT_APP_API_PORT=$REACT_APP_API_PORT

# Build the React app
RUN npm run build

# Stage 2: Serve with nginx
FROM nginx:alpine

# Install gettext for envsubst
RUN apk add --no-cache gettext

# Copy nginx config template
COPY nginx.conf.template /etc/nginx/templates/default.conf.template

# Copy entrypoint script
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

# Copy built files from builder stage
COPY --from=builder /app/build /usr/share/nginx/html

# Default port (can be overridden via environment variable)
ARG NGINX_PORT=8889
ENV NGINX_PORT=${NGINX_PORT}

# Expose port (will be set dynamically)
EXPOSE ${NGINX_PORT}

# Health check (port will be set via env var at runtime)
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD sh -c "wget --quiet --tries=1 --spider http://localhost:$$NGINX_PORT/ || exit 1"

# Use custom entrypoint
ENTRYPOINT ["/docker-entrypoint.sh"]

