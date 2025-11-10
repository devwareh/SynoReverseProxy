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
# For Portainer/external access, you may want to set this to your NAS hostname:18888
ARG REACT_APP_API_URL=
ENV REACT_APP_API_URL=$REACT_APP_API_URL

# Build the React app
RUN npm run build

# Stage 2: Serve with nginx
FROM nginx:alpine

# Copy custom nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy built files from builder stage
COPY --from=builder /app/build /usr/share/nginx/html

# Create non-root user (nginx already runs as nginx user)
# Expose port
EXPOSE 18889

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --quiet --tries=1 --spider http://localhost:18889/ || exit 1

# Start nginx
CMD ["nginx", "-g", "daemon off;"]

