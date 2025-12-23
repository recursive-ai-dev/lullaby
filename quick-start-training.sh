#!/bin/bash

# Lullaby Training Quick Start Script
# This script starts the development server and opens the training interface

echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║  LULLABY BASIC PERSONALITY TRAINING - QUICK START          ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
    echo ""
fi

# Generate training manifest
echo "📋 Preparing training data..."
node prepare-training.js
echo ""

# Start the development server
echo "🚀 Starting development server..."
echo ""
echo "📍 Training interface will be available at:"
echo "   http://localhost:5173/train-in-browser.html"
echo ""
echo "📖 For detailed instructions, see:"
echo "   - TRAINING-SETUP-COMPLETE.md (quick reference)"
echo "   - TRAINING-GUIDE.md (comprehensive guide)"
echo ""
echo "═══════════════════════════════════════════════════════════════"
echo ""

# Start the dev server
npm run dev
