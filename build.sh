#!/usr/bin/env bash
# Exit on error
set -o errexit

echo "=== [1/2] Building Frontend (React + Vite) ==="
cd Frontend
npm install
npm run build
cd ..

echo "=== [2/2] Installing Backend Dependencies ==="
pip install --upgrade pip
pip install -r requirements.txt

echo "=== Build Completed Successfully ==="
