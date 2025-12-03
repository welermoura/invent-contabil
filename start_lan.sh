#!/bin/bash

# Detect local IP
HOST_IP=""

# Try ip route (Linux)
if command -v ip >/dev/null; then
    HOST_IP=$(ip route get 1 | grep -oP 'src \K\S+')
fi

# Try hostname -I (Linux fallback)
if [ -z "$HOST_IP" ] && command -v hostname >/dev/null; then
    HOST_IP=$(hostname -I 2>/dev/null | awk '{print $1}')
fi

# Try ipconfig (macOS)
if [ -z "$HOST_IP" ] && command -v ipconfig >/dev/null; then
    # Usually en0 is the main interface, but this is a best guess
    HOST_IP=$(ipconfig getifaddr en0)
fi

# If all fails, localhost
if [ -z "$HOST_IP" ]; then
    echo "Could not detect Host IP. Using localhost."
    HOST_IP="localhost"
fi

echo "Detected LAN IP: $HOST_IP"

# Create/Update .env file logic
# We export vars so docker-compose picks them up overriding .env file if needed for THIS session
export VITE_API_URL="http://$HOST_IP:8001"

echo "Setting VITE_API_URL to $VITE_API_URL"

# Check if .env exists, if not create from example
if [ ! -f .env ]; then
    echo "WARNING: .env file not found. Creating one from .env.example if it exists."
    if [ -f .env.example ]; then
        cp .env.example .env
        echo "Created .env from .env.example. Please review credentials."
    else
        echo "ERROR: No .env found. Please create one."
        exit 1
    fi
fi

# Bring down previous containers
docker-compose down

# Start up
echo "Starting services..."
docker-compose up --build
