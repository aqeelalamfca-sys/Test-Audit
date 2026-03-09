#!/bin/bash
export NODE_OPTIONS='--max-old-space-size=1024'
export NODE_ENV=development
./node_modules/.bin/tsx server/index.ts
