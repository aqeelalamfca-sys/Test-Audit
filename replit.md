# AuditWise — Statutory Audit Management Platform

## Project Overview

AuditWise is a full-stack TypeScript web application built for Pakistani audit firms. It provides ISA 200-720 full coverage, ISQM-1 quality controls, and deep local regulatory integration.

## Architecture

- **Frontend**: React 18 + Vite + Tailwind CSS + shadcn/ui components
- **Backend**: Express.js (TypeScript) serving both the API and Vite dev middleware in development
- **Database**: PostgreSQL via Prisma ORM
- **Authentication**: JWT + session-based (Passport.js)
- **Single server**: In development, Vite runs as middleware inside Express. Both frontend and backend share port 5000.

## Project Structure

```
/client         - React frontend (Vite root)
/server         - Express backend + Vite dev middleware
/shared         - Shared TypeScript types and schema
/prisma         - Prisma schema and seed files
/dist           - Production build output
```

## Key Configuration

- **Port**: 5000 (both frontend and backend in dev)
- **Host**: 0.0.0.0 (required for Replit proxy)
- **Vite**: Runs in middleware mode inside Express (`server/vite.ts`)
- **AllowedHosts**: Set to `true` in Vite server options for Replit proxy compatibility

## Environment Variables

- `DATABASE_URL` - PostgreSQL connection string (set by Replit)
- `SESSION_SECRET` - Express session secret (auto-generated if not set)
- `JWT_SECRET` - JWT signing secret (auto-generated or from `.jwt_secret` file)
- `OPENAI_API_KEY` - For AI features (optional)

## Database

Uses Prisma with PostgreSQL. Schema is in `prisma/schema.prisma`.

To push schema changes: `npx prisma db push`
To generate client: `npx prisma generate`

The app seeds data on startup:
- SuperAdmin: aqeelalam2010@gmail.com
- Demo users: partner, eqcr, manager, senior, staff (all with password `Test@123`)

## Development

The workflow runs: `NODE_OPTIONS='--max-old-space-size=1024' NODE_ENV=development npx tsx server/index.ts`

## Deployment

- Target: Autoscale
- Build: `npm run build`
- Run: `node dist/index.cjs`
