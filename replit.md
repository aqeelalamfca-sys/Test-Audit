# AuditWise

AI-enabled audit management platform for statutory audit execution.

## Architecture

- **Full-stack TypeScript** monorepo
- **Backend**: Express.js server (`server/`) serving both API and (in dev) Vite-proxied frontend
- **Frontend**: React + Vite (`client/`) with Tailwind CSS and shadcn/ui components
- **Database**: PostgreSQL via Prisma ORM (primary) and Drizzle ORM (shared schema)
- **Port**: 5000 (single port for both frontend and backend)

## Project Structure

```
client/        React + Vite frontend
server/        Express backend, routes, services, seeds
shared/        Shared types, Drizzle schema
prisma/        Prisma schema and seed
migrations/    Drizzle migrations
```

## Key Dependencies

- **ORM**: Prisma (main) + Drizzle ORM (shared schema definitions)
- **Auth**: Passport.js + JWT + express-session
- **AI**: OpenAI integration (optional, via OPENAI_API_KEY)
- **Storage**: Local filesystem or AWS S3 (optional)
- **Email**: Nodemailer/SMTP (optional)

## Development

```bash
npm run dev       # Start development server (tsx server/index.ts)
npm run build     # Build for production
npm run db:push   # Push Drizzle schema changes
npx prisma db push  # Push Prisma schema changes
```

## Environment Variables

Required:
- `DATABASE_URL` - PostgreSQL connection string (auto-provisioned by Replit)

Optional:
- `SESSION_SECRET` - Express session secret (auto-generated if not set in dev)
- `JWT_SECRET` - JWT signing secret (auto-generated if not set in dev)
- `OPENAI_API_KEY` - For AI copilot features
- `SMTP_*` - For email notifications
- `AWS_*` / `S3_*` - For S3 file storage

## Workflow

- **Start application**: `npm run dev` on port 5000 (webview)

## Deployment

- Target: autoscale
- Build: `npm run build`
- Run: `node dist/index.cjs`
