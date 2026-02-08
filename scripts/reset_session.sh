#!/bin/bash

# Reset Synology Session Script
# This script clears the cached session data to force a fresh login

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
echo -e "${BLUE}Reset Synology Session${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Check if session file exists
SESSION_FILE="data/syno_session.json.enc"

if [ -f "$SESSION_FILE" ]; then
    echo -e "${YELLOW}Found existing session file: $SESSION_FILE${NC}"
    echo -e "${YELLOW}This will delete the cached session and device token.${NC}"
    echo -e "${YELLOW}You will need to log in again with OTP.${NC}"
    echo ""
    read -p "Continue? (y/n) " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo -e "${RED}Aborted.${NC}"
        exit 1
    fi
    
    # Backup the session file
    BACKUP_FILE="${SESSION_FILE}.backup.$(date +%Y%m%d_%H%M%S)"
    cp "$SESSION_FILE" "$BACKUP_FILE"
    echo -e "${GREEN}✓ Backed up session to: $BACKUP_FILE${NC}"
    
    # Delete the session file
    rm "$SESSION_FILE"
    echo -e "${GREEN}✓ Deleted session file${NC}"
else
    echo -e "${YELLOW}No session file found at: $SESSION_FILE${NC}"
    echo -e "${YELLOW}Nothing to reset.${NC}"
fi

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Session reset complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${BLUE}Next steps:${NC}"
echo -e "${BLUE}1. Start the server: ./scripts/start.sh${NC}"
echo -e "${BLUE}2. Open the web UI: http://localhost:3000${NC}"
echo -e "${BLUE}3. Use the login form with your current OTP code${NC}"
echo ""
