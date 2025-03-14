#!/bin/bash

# ClipCraft starter script
# This script starts both the frontend and backend services

# Colors for console output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Working directory - where this script is located
WORK_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FRONTEND_PORT=3000
BACKEND_PORT=8000

echo -e "${BLUE}ClipCraft Starter${NC}"
echo "================"

# Check if Python is installed
if ! command -v python3 &> /dev/null; then
    echo -e "${RED}Error: Python 3 is not installed${NC}"
    exit 1
fi

# Check if pip is installed
if ! command -v pip3 &> /dev/null; then
    echo -e "${RED}Error: pip3 is not installed${NC}"
    exit 1
fi

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo -e "${RED}Error: Node.js is not installed${NC}"
    exit 1
fi

# Setup Python virtual environment if it doesn't exist
if [ ! -d "$WORK_DIR/backend/venv" ]; then
    echo -e "${YELLOW}Setting up Python virtual environment...${NC}"
    cd "$WORK_DIR/backend" || exit
    python3 -m venv venv
    source venv/bin/activate
    pip install -r requirements.txt
    deactivate
else
    echo -e "${GREEN}Virtual environment already exists.${NC}"
fi

# Function to handle script termination
cleanup() {
    echo -e "\n${YELLOW}Shutting down services...${NC}"
    kill $FRONTEND_PID $BACKEND_PID 2>/dev/null
    exit 0
}

# Register the cleanup function for when script is terminated
trap cleanup SIGINT SIGTERM

# Start backend in background
echo -e "${YELLOW}Starting backend service...${NC}"
cd "$WORK_DIR/backend" || exit
source venv/bin/activate

# Start Uvicorn with settings for large file uploads and longer timeouts
uvicorn app.main:app --reload --host 0.0.0.0 --port $BACKEND_PORT \
  --timeout-keep-alive 120 \
  --limit-concurrency 10 \
  --timeout-graceful-shutdown 300 &
BACKEND_PID=$!

# Wait for backend to start
echo -e "${YELLOW}Waiting for backend to initialize...${NC}"
sleep 2

# Start frontend in background
echo -e "${YELLOW}Starting frontend service...${NC}"
cd "$WORK_DIR" || exit
npm run dev &
FRONTEND_PID=$!

# Display running information
echo -e "\n${GREEN}Services started!${NC}"
echo -e "Frontend: ${BLUE}http://localhost:$FRONTEND_PORT${NC}"
echo -e "Backend:  ${BLUE}http://localhost:$BACKEND_PORT${NC}"
echo -e "API Docs: ${BLUE}http://localhost:$BACKEND_PORT/api/docs${NC}"
echo -e "\n${YELLOW}Press Ctrl+C to stop all services${NC}"
echo -e "\n${GREEN}Large file upload support: 10GB maximum${NC}"

# Wait for both processes to finish
wait 