#!/bin/bash
set -e

echo "📦 Installiere Root-Dependencies..."
npm install

echo "📦 Installiere Server-Dependencies..."
npm install --prefix server

echo "📦 Installiere Client-Dependencies..."
npm install --prefix client

echo "🔨 Baue Client (React + Vite)..."
npm run build --prefix client

echo "🔨 Baue Server (TypeScript)..."
npm run build --prefix server

echo "✅ Build fertig. Starten mit: node server/dist/index.js"
