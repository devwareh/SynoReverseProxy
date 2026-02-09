# Backend Dockerfile for Synology Reverse Proxy Manager
FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first for better caching
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY app/ ./app/

# Create entrypoint script for PUID/PGID support
RUN echo '#!/bin/sh' > /entrypoint.sh && \
    echo 'set -e' >> /entrypoint.sh && \
    echo '' >> /entrypoint.sh && \
    echo '# Use PUID and PGID if provided, otherwise run as root' >> /entrypoint.sh && \
    echo 'if [ -n "$PUID" ] && [ -n "$PGID" ]; then' >> /entrypoint.sh && \
    echo '  echo "Running as UID:GID $PUID:$PGID"' >> /entrypoint.sh && \
    echo '  # Create group if it does not exist' >> /entrypoint.sh && \
    echo '  if ! getent group $PGID > /dev/null 2>&1; then' >> /entrypoint.sh && \
    echo '    groupadd -g $PGID appgroup' >> /entrypoint.sh && \
    echo '  fi' >> /entrypoint.sh && \
    echo '  # Create user if it does not exist' >> /entrypoint.sh && \
    echo '  if ! getent passwd $PUID > /dev/null 2>&1; then' >> /entrypoint.sh && \
    echo '    useradd -u $PUID -g $PGID -m -s /bin/sh appuser' >> /entrypoint.sh && \
    echo '  fi' >> /entrypoint.sh && \
    echo '  # Ensure app directory has correct permissions' >> /entrypoint.sh && \
    echo '  chown -R $PUID:$PGID /app' >> /entrypoint.sh && \
    echo '  # Run as the specified user' >> /entrypoint.sh && \
    echo '  exec su-exec $PUID:$PGID "$@"' >> /entrypoint.sh && \
    echo 'else' >> /entrypoint.sh && \
    echo '  echo "Running as root (PUID/PGID not set)"' >> /entrypoint.sh && \
    echo '  exec "$@"' >> /entrypoint.sh && \
    echo 'fi' >> /entrypoint.sh && \
    chmod +x /entrypoint.sh

# Install su-exec for user switching
RUN apt-get update && apt-get install -y su-exec && rm -rf /var/lib/apt/lists/*

# Backend port (can be overridden via build arg)
ARG BACKEND_PORT=18888
ENV BACKEND_PORT=${BACKEND_PORT}

# Expose port
EXPOSE ${BACKEND_PORT}

# Health check (port will be set via env var at runtime)
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD sh -c "python -c \"import requests; requests.get('http://localhost:$$BACKEND_PORT/', timeout=5)\"" || exit 1

# Set entrypoint
ENTRYPOINT ["/entrypoint.sh"]

# Run the application
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${BACKEND_PORT}"]

