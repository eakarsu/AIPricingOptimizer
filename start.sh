#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${CYAN}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║       AI Pricing Optimizer - Full Stack Startup            ║${NC}"
echo -e "${CYAN}║                  with Hot Reload Enabled                   ║${NC}"
echo -e "${CYAN}╚════════════════════════════════════════════════════════════╝${NC}"

# Get the directory where the script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Function to kill process on a port
kill_port() {
    local port=$1
    local pid=$(lsof -ti:$port 2>/dev/null)
    if [ -n "$pid" ]; then
        echo -e "${YELLOW}  → Killing process on port $port (PID: $pid)${NC}"
        kill -9 $pid 2>/dev/null
        sleep 1
    fi
}

# Function to check if a port is in use
check_port() {
    local port=$1
    if lsof -ti:$port > /dev/null 2>&1; then
        return 0  # Port is in use
    else
        return 1  # Port is free
    fi
}

# Function to check if PostgreSQL is running
check_postgres() {
    if command -v pg_isready &> /dev/null; then
        pg_isready -q
        return $?
    elif command -v psql &> /dev/null; then
        psql -c "SELECT 1" postgres &> /dev/null
        return $?
    else
        echo -e "${RED}PostgreSQL client not found. Please install PostgreSQL.${NC}"
        return 1
    fi
}

# Function to create database if not exists
setup_database() {
    echo -e "${BLUE}  → Setting up database...${NC}"

    # Check if database exists
    if psql -lqt | cut -d \| -f 1 | grep -qw pricing_optimizer; then
        echo -e "${GREEN}  ✓ Database 'pricing_optimizer' already exists${NC}"
    else
        echo -e "${YELLOW}  → Creating database 'pricing_optimizer'...${NC}"
        createdb pricing_optimizer 2>/dev/null || psql -c "CREATE DATABASE pricing_optimizer;" postgres 2>/dev/null
        echo -e "${GREEN}  ✓ Database created${NC}"
    fi
}

# ==================== STEP 1: Clean up ports ====================
echo -e "\n${BLUE}[Step 1/7] Cleaning up ports...${NC}"
for port in 3000 3001 3002 3003 3004; do
    if check_port $port; then
        kill_port $port
    fi
done
echo -e "${GREEN}  ✓ Ports cleaned${NC}"

# ==================== STEP 2: Check PostgreSQL ====================
echo -e "\n${BLUE}[Step 2/7] Checking PostgreSQL...${NC}"
if ! check_postgres; then
    echo -e "${RED}  ✗ PostgreSQL is not running. Please start PostgreSQL first.${NC}"
    echo -e "${YELLOW}    On macOS with Homebrew: brew services start postgresql${NC}"
    echo -e "${YELLOW}    On Linux: sudo systemctl start postgresql${NC}"
    exit 1
fi
echo -e "${GREEN}  ✓ PostgreSQL is running${NC}"

# ==================== STEP 3: Setup database ====================
echo -e "\n${BLUE}[Step 3/7] Database setup...${NC}"
setup_database

# ==================== STEP 4: Install backend dependencies ====================
echo -e "\n${BLUE}[Step 4/7] Installing backend dependencies...${NC}"
cd "$SCRIPT_DIR/backend"
if [ ! -d "node_modules" ]; then
    npm install
    echo -e "${GREEN}  ✓ Backend dependencies installed${NC}"
else
    echo -e "${GREEN}  ✓ Backend dependencies already installed${NC}"
fi

# Ensure nodemon is installed for hot reload
if ! npx nodemon --version &> /dev/null; then
    echo -e "${YELLOW}  → Installing nodemon for hot reload...${NC}"
    npm install nodemon --save-dev
fi
echo -e "${GREEN}  ✓ Nodemon (hot reload) ready${NC}"

# ==================== STEP 5: Seed the database ====================
echo -e "\n${BLUE}[Step 5/7] Seeding database with sample data...${NC}"
cd "$SCRIPT_DIR/backend"
node seed.js
if [ $? -eq 0 ]; then
    echo -e "${GREEN}  ✓ Database seeded successfully${NC}"
else
    echo -e "${YELLOW}  ⚠ Database seeding had issues (may already be seeded)${NC}"
fi

# ==================== STEP 6: Install frontend dependencies ====================
echo -e "\n${BLUE}[Step 6/7] Installing frontend dependencies...${NC}"
cd "$SCRIPT_DIR/frontend"
if [ ! -d "node_modules" ]; then
    npm install
    echo -e "${GREEN}  ✓ Frontend dependencies installed${NC}"
else
    echo -e "${GREEN}  ✓ Frontend dependencies already installed${NC}"
fi

# ==================== STEP 7: Start services ====================
echo -e "\n${BLUE}[Step 7/7] Starting services with hot reload...${NC}"

# Start backend server with nodemon for auto-reload
echo -e "${CYAN}  → Starting backend server on port 3001 (with nodemon hot reload)...${NC}"
cd "$SCRIPT_DIR/backend"
npm run dev &
BACKEND_PID=$!
echo -e "${GREEN}  ✓ Backend started with hot reload (PID: $BACKEND_PID)${NC}"

# Wait for backend to start
sleep 3

# Start frontend with hot reload (React's built-in)
echo -e "${CYAN}  → Starting frontend on port 3000 (with hot reload)...${NC}"
cd "$SCRIPT_DIR/frontend"
BROWSER=none npm start &
FRONTEND_PID=$!
echo -e "${GREEN}  ✓ Frontend started with hot reload (PID: $FRONTEND_PID)${NC}"

# Wait a moment for services to initialize
sleep 2

echo -e ""
echo -e "${CYAN}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║          Application Started Successfully!                 ║${NC}"
echo -e "${CYAN}╠════════════════════════════════════════════════════════════╣${NC}"
echo -e "${CYAN}║${NC}                                                            ${CYAN}║${NC}"
echo -e "${CYAN}║${NC}  ${GREEN}Frontend:${NC}  http://localhost:3000                         ${CYAN}║${NC}"
echo -e "${CYAN}║${NC}  ${GREEN}Backend:${NC}   http://localhost:3001                         ${CYAN}║${NC}"
echo -e "${CYAN}║${NC}                                                            ${CYAN}║${NC}"
echo -e "${CYAN}╠════════════════════════════════════════════════════════════╣${NC}"
echo -e "${CYAN}║${NC}  ${YELLOW}Login Credentials:${NC}                                       ${CYAN}║${NC}"
echo -e "${CYAN}║${NC}    Email:    admin@pricingoptimizer.com                    ${CYAN}║${NC}"
echo -e "${CYAN}║${NC}    Password: password123                                   ${CYAN}║${NC}"
echo -e "${CYAN}║${NC}    (Click 'Use Demo Credentials' button to auto-fill)     ${CYAN}║${NC}"
echo -e "${CYAN}║${NC}                                                            ${CYAN}║${NC}"
echo -e "${CYAN}╠════════════════════════════════════════════════════════════╣${NC}"
echo -e "${CYAN}║${NC}  ${BLUE}Features Available:${NC}                                      ${CYAN}║${NC}"
echo -e "${CYAN}║${NC}    • AI Competitor Price Tracker                          ${CYAN}║${NC}"
echo -e "${CYAN}║${NC}    • AI Demand Forecaster                                  ${CYAN}║${NC}"
echo -e "${CYAN}║${NC}    • AI Bundle Recommender                                 ${CYAN}║${NC}"
echo -e "${CYAN}║${NC}    • AI Discount Optimizer                                 ${CYAN}║${NC}"
echo -e "${CYAN}║${NC}    • AI Price Elasticity Analyzer                          ${CYAN}║${NC}"
echo -e "${CYAN}║${NC}                                                            ${CYAN}║${NC}"
echo -e "${CYAN}╠════════════════════════════════════════════════════════════╣${NC}"
echo -e "${CYAN}║${NC}  ${YELLOW}Hot Reload Enabled:${NC}                                      ${CYAN}║${NC}"
echo -e "${CYAN}║${NC}    Changes to backend/frontend will auto-reload           ${CYAN}║${NC}"
echo -e "${CYAN}║${NC}                                                            ${CYAN}║${NC}"
echo -e "${CYAN}║${NC}  ${RED}Press Ctrl+C to stop all services${NC}                       ${CYAN}║${NC}"
echo -e "${CYAN}╚════════════════════════════════════════════════════════════╝${NC}"

# Trap to cleanup on exit
cleanup() {
    echo -e "\n${YELLOW}Shutting down services...${NC}"
    kill $BACKEND_PID 2>/dev/null
    kill $FRONTEND_PID 2>/dev/null
    # Kill any remaining processes on the ports
    for port in 3000 3001; do
        kill_port $port
    done
    echo -e "${GREEN}Services stopped. Goodbye!${NC}"
    exit 0
}

trap cleanup SIGINT SIGTERM

# Wait for processes
wait
