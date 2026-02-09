#!/bin/bash

# Synology Reverse Proxy Manager - Startup Script
# This script starts both the backend API and frontend UI

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Get the directory where the script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$( cd "$SCRIPT_DIR/.." && pwd )"
cd "$PROJECT_ROOT"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Synology Reverse Proxy Manager${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to cleanup on exit
cleanup() {
    echo ""
    echo -e "${YELLOW}Shutting down servers...${NC}"
    if [ ! -z "$BACKEND_PID" ]; then
        kill $BACKEND_PID 2>/dev/null || true
    fi
    if [ ! -z "$FRONTEND_PID" ]; then
        kill $FRONTEND_PID 2>/dev/null || true
    fi
    echo -e "${GREEN}Cleanup complete.${NC}"
    exit 0
}

# Set up signal handlers
trap cleanup SIGINT SIGTERM

# Check for required commands
echo -e "${BLUE}Checking prerequisites...${NC}"

if ! command_exists conda; then
    echo -e "${RED}Error: conda is not installed${NC}"
    exit 1
fi

if ! command_exists node; then
    echo -e "${RED}Error: node is not installed${NC}"
    exit 1
fi

if ! command_exists npm; then
    echo -e "${RED}Error: npm is not installed${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Prerequisites check passed${NC}"
echo ""

# Check for .env file
if [ ! -f "config/.env" ] && [ ! -f ".env" ]; then
    echo -e "${YELLOW}Warning: .env file not found${NC}"
    echo -e "${YELLOW}Please create a .env file in config/ directory with your Synology credentials${NC}"
    echo -e "${YELLOW}See README.md for required environment variables${NC}"
    echo ""
    read -p "Continue anyway? (y/n) " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
else
    echo -e "${GREEN}✓ .env file found${NC}"
fi
echo ""


# Function to get value from .env file
get_env_value() {
    local key=$1
    local default_val=$2
    local val=""
    
    if [ -f "config/.env" ]; then
        val=$(grep "^${key}=" config/.env | cut -d '=' -f2-)
    elif [ -f ".env" ]; then
        val=$(grep "^${key}=" .env | cut -d '=' -f2-)
    fi
    
    if [ -z "$val" ]; then
        echo "$default_val"
    else
        echo "$val"
    fi
}

# Source .env file if it exists to make variables available to child processes
if [ -f "config/.env" ]; then
    set -a
    source config/.env
    set +a
elif [ -f ".env" ]; then
    set -a
    source .env
    set +a
fi

# Get ports from env or use defaults (matching Docker configuration)
BACKEND_PORT=$(get_env_value "BACKEND_PORT" "18888")
FRONTEND_PORT=$(get_env_value "FRONTEND_PORT" "8889")

# Check Python dependencies
echo -e "${BLUE}Checking Python dependencies...${NC}"
if [ ! -f "backend/requirements.txt" ]; then
    echo -e "${RED}Error: backend/requirements.txt not found${NC}"
    exit 1
fi

# Initialize conda
echo -e "${BLUE}Initializing conda...${NC}"
# Find conda base directory - try common locations first
CONDA_BASE=""

if [ -f "$HOME/miniconda3/etc/profile.d/conda.sh" ]; then
    CONDA_BASE="$HOME/miniconda3"
elif [ -f "$HOME/anaconda3/etc/profile.d/conda.sh" ]; then
    CONDA_BASE="$HOME/anaconda3"
elif [ -f "/opt/conda/etc/profile.d/conda.sh" ]; then
    CONDA_BASE="/opt/conda"
else
    # Try to get it from conda command if available
    if command_exists conda; then
        # Check if conda is already initialized (has __conda_activate function)
        if type __conda_activate >/dev/null 2>&1; then
            CONDA_BASE=$(conda info --base 2>/dev/null)
        fi
    fi
    
    if [ -z "$CONDA_BASE" ]; then
        echo -e "${RED}Error: Could not find conda installation${NC}"
        echo -e "${YELLOW}Please ensure conda is installed and try again${NC}"
        exit 1
    fi
fi

# Source conda.sh to initialize conda
if [ -f "$CONDA_BASE/etc/profile.d/conda.sh" ]; then
    source "$CONDA_BASE/etc/profile.d/conda.sh"
    echo -e "${GREEN}✓ Conda initialized${NC}"
else
    echo -e "${RED}Error: Could not find conda.sh at $CONDA_BASE/etc/profile.d/conda.sh${NC}"
    exit 1
fi

# Activate conda environment
echo -e "${BLUE}Activating conda environment: synoenv${NC}"
if conda env list | grep -qE "synoenv\s"; then
    conda activate synoenv
    echo -e "${GREEN}✓ Conda environment activated${NC}"
else
    echo -e "${YELLOW}Conda environment 'synoenv' not found${NC}"
    echo -e "${YELLOW}Please create it first: conda create -n synoenv python=3.10${NC}"
    exit 1
fi

# Install/upgrade dependencies
echo -e "${BLUE}Installing Python dependencies...${NC}"
pip install -q --upgrade pip
pip install -q -r backend/requirements.txt
echo -e "${GREEN}✓ Python dependencies ready${NC}"
echo ""

# Check Node dependencies
echo -e "${BLUE}Checking Node dependencies...${NC}"
cd frontend

if [ ! -f "package.json" ]; then
    echo -e "${RED}Error: package.json not found${NC}"
    exit 1
fi

if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}Installing Node dependencies...${NC}"
    npm install
else
    echo -e "${GREEN}✓ Node dependencies found${NC}"
fi

cd ..
echo ""

# Start backend server
echo -e "${BLUE}Starting backend server on port ${BACKEND_PORT}...${NC}"
cd "$PROJECT_ROOT/backend"

# Find conda base path and python executable
CONDA_BASE=$(conda info --base)
PYTHON_EXEC="$CONDA_BASE/envs/synoenv/bin/python"

if [ ! -f "$PYTHON_EXEC" ]; then
    echo -e "${RED}Error: Python not found in synoenv conda environment${NC}"
    exit 1
fi

# Start uvicorn using the conda environment's python
# Run from backend directory, use app.main:app as module path
$PYTHON_EXEC -m uvicorn app.main:app --host 0.0.0.0 --port $BACKEND_PORT --reload > ../logs/backend.log 2>&1 &
BACKEND_PID=$!

# Wait a moment for backend to start
sleep 2

# Check if backend started successfully
if ! kill -0 $BACKEND_PID 2>/dev/null; then
    echo -e "${RED}Error: Backend server failed to start${NC}"
    echo -e "${RED}Check logs/backend.log for details${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Backend server running (PID: $BACKEND_PID)${NC}"
echo -e "${GREEN}  API available at: http://localhost:${BACKEND_PORT}${NC}"
echo ""

# Start frontend server
echo -e "${BLUE}Starting frontend server on port ${FRONTEND_PORT}...${NC}"
cd "$PROJECT_ROOT/frontend"

# Get the machine's IP address for network access
MACHINE_IP=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || hostname -I | awk '{print $1}' 2>/dev/null || echo "localhost")

# Start React dev server bound to all interfaces (0.0.0.0) for network access
# This allows access from other devices on the same network
# Set PORT environment variable for React scripts
PORT=$FRONTEND_PORT HOST=0.0.0.0 npm start > ../logs/frontend.log 2>&1 &
FRONTEND_PID=$!

# Wait a moment for frontend to start
sleep 3

# Check if frontend started successfully
if ! kill -0 $FRONTEND_PID 2>/dev/null; then
    echo -e "${RED}Error: Frontend server failed to start${NC}"
    echo -e "${RED}Check logs/frontend.log for details${NC}"
    kill $BACKEND_PID 2>/dev/null || true
    exit 1
fi

echo -e "${GREEN}✓ Frontend server running (PID: $FRONTEND_PID)${NC}"
echo -e "${GREEN}  UI available at: http://localhost:${FRONTEND_PORT}${NC}"
if [ "$MACHINE_IP" != "localhost" ] && [ -n "$MACHINE_IP" ]; then
    echo -e "${GREEN}  UI also available at: http://${MACHINE_IP}:${FRONTEND_PORT}${NC}"
fi
echo ""

# Success message
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Application started successfully!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${BLUE}Local Access:${NC}"
echo -e "${BLUE}  Backend API:${NC}  http://localhost:${BACKEND_PORT}"
echo -e "${BLUE}  Frontend UI:${NC}  http://localhost:${FRONTEND_PORT}"
echo -e "${BLUE}  API Docs:${NC}     http://localhost:${BACKEND_PORT}/docs"
if [ "$MACHINE_IP" != "localhost" ] && [ -n "$MACHINE_IP" ]; then
    echo ""
    echo -e "${BLUE}Network Access (from other devices):${NC}"
    echo -e "${BLUE}  Backend API:${NC}  http://${MACHINE_IP}:${BACKEND_PORT}"
    echo -e "${BLUE}  Frontend UI:${NC}  http://${MACHINE_IP}:${FRONTEND_PORT}"
    echo -e "${BLUE}  API Docs:${NC}     http://${MACHINE_IP}:${BACKEND_PORT}/docs"
fi
echo ""
echo -e "${YELLOW}Press Ctrl+C to stop both servers${NC}"
echo ""

# Wait for user interrupt
wait

