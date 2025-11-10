#!/bin/bash
# Test script for Docker deployment
# This script helps test the application locally using Docker

set -e

echo "=========================================="
echo "Synology Reverse Proxy Manager - Docker Test"
echo "=========================================="
echo ""

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Error: Docker is not running. Please start Docker first."
    exit 1
fi

echo "✅ Docker is running"
echo ""

# Check for required environment variables
echo "Checking environment variables..."
if [ -z "$SYNOLOGY_NAS_URL" ] || [ -z "$SYNOLOGY_USERNAME" ] || [ -z "$SYNOLOGY_PASSWORD" ]; then
    echo "⚠️  Warning: Required environment variables not set:"
    echo "   - SYNOLOGY_NAS_URL"
    echo "   - SYNOLOGY_USERNAME"
    echo "   - SYNOLOGY_PASSWORD"
    echo ""
    echo "You can either:"
    echo "1. Export them before running this script:"
    echo "   export SYNOLOGY_NAS_URL='http://YOUR_NAS_IP:5000'"
    echo "   export SYNOLOGY_USERNAME='your_username'"
    echo "   export SYNOLOGY_PASSWORD='your_password'"
    echo ""
    echo "2. Or create a .env file in the project root with:"
    echo "   SYNOLOGY_NAS_URL=http://YOUR_NAS_IP:5000"
    echo "   SYNOLOGY_USERNAME=your_username"
    echo "   SYNOLOGY_PASSWORD=your_password"
    echo ""
    read -p "Do you want to continue anyway? (y/n) " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
else
    echo "✅ Required environment variables are set"
fi

# Create necessary directories
echo ""
echo "Creating necessary directories..."
mkdir -p data logs
echo "✅ Directories created"

# Stop and remove existing containers if they exist
echo ""
echo "Cleaning up existing containers..."
docker-compose down 2>/dev/null || true
echo "✅ Cleanup complete"

# Build and start containers
echo ""
echo "Building Docker images (this may take a few minutes)..."
docker-compose build

echo ""
echo "Starting containers..."
docker-compose up -d

# Wait for containers to be healthy
echo ""
echo "Waiting for containers to be ready..."
sleep 5

# Check container status
echo ""
echo "Container status:"
docker-compose ps

echo ""
echo "=========================================="
echo "✅ Docker containers are running!"
echo "=========================================="
echo ""
echo "Access the application:"
echo "  📱 Frontend UI: http://localhost:18889"
echo "  🔧 Backend API: http://localhost:18888"
echo "  📚 API Docs:    http://localhost:18888/docs"
echo ""
echo "Next steps:"
echo "1. Open http://localhost:18889 in your browser"
echo "2. If you see a 'First-Time Setup' modal, enter your OTP code (if 2FA enabled)"
echo "3. Or use the API docs at http://localhost:18888/docs to call /auth/first-login"
echo ""
echo "To view logs:"
echo "  docker-compose logs -f"
echo ""
echo "To stop containers:"
echo "  docker-compose down"
echo ""
echo "To rebuild after code changes:"
echo "  docker-compose up -d --build"
echo ""

