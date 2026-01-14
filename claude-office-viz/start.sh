#!/bin/bash

# 🏢 Claude Office Visualizer - Start Script
# Starter både bridge og visualisering

echo "🏢 Claude Office Visualizer"
echo "============================"
echo ""

# Finn script-mappen
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Sjekk at node er installert
if ! command -v node &> /dev/null; then
    echo "❌ Node.js er ikke installert!"
    echo "   Installer fra: https://nodejs.org"
    exit 1
fi

# Sjekk at npm packages er installert
if [ ! -d "$SCRIPT_DIR/server/node_modules" ]; then
    echo "📦 Installerer server-avhengigheter..."
    cd "$SCRIPT_DIR/server" && npm install
fi

if [ ! -d "$SCRIPT_DIR/client/node_modules" ]; then
    echo "📦 Installerer klient-avhengigheter..."
    cd "$SCRIPT_DIR/client" && npm install
fi

# Start bridge i bakgrunnen
echo ""
echo "🚀 Starter WebSocket bridge på port 3001..."
cd "$SCRIPT_DIR/server"
node bridge.js &
BRIDGE_PID=$!

# Vent litt
sleep 1

# Start React app
echo "🎨 Starter visualisering på http://localhost:3000..."
cd "$SCRIPT_DIR/client"
npm run dev &
CLIENT_PID=$!

# Vent litt
sleep 2

echo ""
echo "✅ Alt er startet!"
echo ""
echo "📺 Åpne http://localhost:3000 i nettleseren"
echo ""
echo "🔗 For å koble til Claude Code, kjør i et nytt vindu:"
echo "   claude --output-format stream-json | node $SCRIPT_DIR/server/bridge.js"
echo ""
echo "⏹️  Trykk Ctrl+C for å stoppe alt"
echo ""

# Cleanup ved avslutning
cleanup() {
    echo ""
    echo "🛑 Stopper..."
    kill $BRIDGE_PID 2>/dev/null
    kill $CLIENT_PID 2>/dev/null
    exit 0
}

trap cleanup SIGINT SIGTERM

# Vent på at prosessene avsluttes
wait
