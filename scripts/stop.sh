#!/bin/bash

# Stop script for Synology Reverse Proxy Manager
# Kills all running instances of the backend and frontend servers

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Stopping Synology Reverse Proxy Manager...${NC}"

# Kill uvicorn processes (match both old and new patterns)
UVICORN_PIDS=$(pgrep -f "uvicorn.*app" || true)
if [ ! -z "$UVICORN_PIDS" ]; then
    echo -e "${YELLOW}Stopping backend server...${NC}"
    echo $UVICORN_PIDS | xargs kill 2>/dev/null || true
    sleep 1
    # Force kill if still running
    echo $UVICORN_PIDS | xargs kill -9 2>/dev/null || true
    echo -e "${GREEN}✓ Backend server stopped${NC}"
else
    echo -e "${YELLOW}No backend server found running${NC}"
fi

# Kill React dev server processes
REACT_PIDS=$(pgrep -f "react-scripts start" || true)
if [ ! -z "$REACT_PIDS" ]; then
    echo -e "${YELLOW}Stopping frontend server...${NC}"
    echo $REACT_PIDS | xargs kill 2>/dev/null || true
    sleep 1
    # Force kill if still running
    echo $REACT_PIDS | xargs kill -9 2>/dev/null || true
    echo -e "${GREEN}✓ Frontend server stopped${NC}"
else
    echo -e "${YELLOW}No frontend server found running${NC}"
fi

# Kill node processes on ports 3000 and 8000 (fallback)
lsof -ti:3000 | xargs kill -9 2>/dev/null || true
lsof -ti:8000 | xargs kill -9 2>/dev/null || true

echo -e "${GREEN}All servers stopped.${NC}"

