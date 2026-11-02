#!/bin/zsh
cd "$(dirname "$0")" || exit 1
echo "Starte GymLog WebApp..."
node server.mjs
