#!/bin/bash

# Reset Web UI Password Script
# This script removes the web authentication file to reset your web UI password

set -e

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
echo -e "${BLUE}Reset Web UI Password${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Check if auth file exists
AUTH_FILE="config/.web_auth.json"

if [ -f "$AUTH_FILE" ]; then
    echo -e "${YELLOW}Found existing web authentication file: $AUTH_FILE${NC}"
    echo -e "${YELLOW}This will delete your web UI password.${NC}"
    echo -e "${YELLOW}You will need to complete the setup wizard again.${NC}"
    echo ""
    read -p "Continue? (y/n) " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo -e "${RED}Aborted.${NC}"
        exit 1
    fi
    
    # Backup the auth file
    BACKUP_FILE="${AUTH_FILE}.backup.$(date +%Y%m%d_%H%M%S)"
    cp "$AUTH_FILE" "$BACKUP_FILE"
    echo -e "${GREEN}✓ Backed up auth file to: $BACKUP_FILE${NC}"
    
    # Delete the auth file
    rm "$AUTH_FILE"
    echo -e "${GREEN}✓ Deleted web authentication file${NC}"
else
    echo -e "${YELLOW}No auth file found at: $AUTH_FILE${NC}"
    echo -e "${YELLOW}Nothing to reset.${NC}"
fi

# Also clear web sessions
SESSION_FILE="data/web_sessions.json.enc"
if [ -f "$SESSION_FILE" ]; then
    rm "$SESSION_FILE"
    echo -e "${GREEN}✓ Cleared web sessions${NC}"
fi

# Get frontend port from .env or use default
FRONTEND_PORT="8889"
if [ -f "config/.env" ]; then
    ENV_PORT=$(grep "^FRONTEND_PORT=" config/.env | cut -d '=' -f2-)
    if [ -n "$ENV_PORT" ]; then
        FRONTEND_PORT="$ENV_PORT"
    fi
elif [ -f ".env" ]; then
    ENV_PORT=$(grep "^FRONTEND_PORT=" .env | cut -d '=' -f2-)
    if [ -n "$ENV_PORT" ]; then
        FRONTEND_PORT="$ENV_PORT"
    fi
fi

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Password reset complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${BLUE}Next steps:${NC}"
echo -e "${BLUE}1. Restart the server (if running)${NC}"
echo -e "${BLUE}2. Open the web UI: http://localhost:${FRONTEND_PORT}${NC}"
echo -e "${BLUE}3. Complete the setup wizard with a new password${NC}"
echo ""
