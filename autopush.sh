#!/bin/bash
while true
do
  git add -A
  git commit -m "Auto sync from Replit $(date)" || true
  git push origin main
  sleep 120
done
