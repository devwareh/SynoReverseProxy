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

# Create non-root user (but run as root for volume write access)
# Note: For production, consider fixing volume permissions instead
# RUN useradd -m -u 1000 appuser && \
#     chown -R appuser:appuser /app
# USER appuser

# Backend port (can be overridden via build arg)
ARG BACKEND_PORT=18888
ENV BACKEND_PORT=${BACKEND_PORT}

# Expose port
EXPOSE ${BACKEND_PORT}

# Health check (port will be set via env var at runtime)
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD sh -c "python -c \"import requests; requests.get('http://localhost:$$BACKEND_PORT/', timeout=5)\"" || exit 1

# Run the application
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${BACKEND_PORT}"]

