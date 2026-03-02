# Objective
Make AuditWise production-ready: remove demo/seed data, make the portal deploy-ready for AWS, fix settings to be practical (AI API keys configurable), update deployment guide, ensure everything is clean, logical, and workable.

# Tasks

### T001: Make seeding production-aware (remove demo data in production)
- **Blocked By**: []
- **Details**:
  - Modify `server/index.ts` startup flow:
    - `seedPermissions()` — ALWAYS run (needed for RBAC)
    - `seedTestUsers()` — ONLY run if `NODE_ENV !== 'production'` OR if no users exist at all (first run needs an admin)
    - `seedDemoData()` — ONLY run if `NODE_ENV !== 'production'`
  - Create a new `server/seeds/seedInitialAdmin.ts` that:
    - Checks if any firm/user exists in DB
    - If no firm exists, creates one using env vars `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `FIRM_NAME` (with defaults)
    - Creates a single ADMIN user so the portal is usable on first deploy
    - This runs in production instead of seedTestUsers
  - Modify `seedTestUsers` to be clearly dev-only
  - Files: `server/index.ts`, `server/seeds/seedInitialAdmin.ts` (new)
  - Acceptance: Production startup creates only permissions + initial admin, no demo data

### T002: Remove demo credentials from login page in production
- **Blocked By**: []
- **Details**:
  - In `client/src/pages/login.tsx`:
    - Wrap the demo credentials section (data-testid="dev-credentials") with a check: only show if `import.meta.env.DEV` is true (Vite's dev-mode flag)
    - Wrap the portal demo credentials section (data-testid="dev-portal-credentials") similarly
    - The login form itself stays as-is
  - Clean up the login page UI — make it professional for production (no demo references visible)
  - Files: `client/src/pages/login.tsx`
  - Acceptance: Production build shows clean login page without demo credentials

### T003: Fix AI Settings to be practical and production-ready
- **Blocked By**: []
- **Details**:
  - Review `client/src/pages/settings.tsx` AI Configuration tab:
    - Ensure the API key input works: admin can enter OpenAI API key, save it, test connection
    - Add clear instructions: "Enter your OpenAI API key to enable AI features" 
    - Make sure the save flow works end-to-end: frontend → POST /api/ai/settings → DB storage
    - Make sure the test connection button works: frontend → POST /api/ai/test-connection → real API test
  - Review `server/aiRoutes.ts`:
    - Ensure GET /api/ai/settings returns current config (without exposing full key)
    - Ensure POST /api/ai/settings saves to DB properly
    - Ensure POST /api/ai/test-connection works with the provided key
  - Review `server/services/aiService.ts`:
    - Ensure it reads API key from DB first, then falls back to env var `OPENAI_API_KEY` or `AI_INTEGRATIONS_OPENAI_API_KEY`
    - Make sure the multi-provider fallback logic works
  - Files: `client/src/pages/settings.tsx`, `server/aiRoutes.ts`, `server/services/aiService.ts`
  - Acceptance: Admin can configure AI API key in settings, test it, and AI features work

### T004: Update Dockerfile and deployment configuration
- **Blocked By**: [T001]
- **Details**:
  - Update Dockerfile to include `prisma/` directory for migrations
  - Add `CMD` that runs `npx prisma db push && node dist/index.cjs` (auto-migrate on startup)
  - Ensure `start.sh` works for dev mode
  - Update `aws/task-definition.json` with all required env vars:
    - DATABASE_URL, SESSION_SECRET, ADMIN_EMAIL, ADMIN_PASSWORD, FIRM_NAME
    - Remove hardcoded demo values
  - Create/update `aws/deploy.sh` for clean deployment
  - Files: `Dockerfile`, `aws/task-definition.json`, `aws/deploy.sh`, `start.sh`
  - Acceptance: Docker build and deploy work cleanly for production

### T005: Update in-app Deployment Guide page
- **Blocked By**: [T001, T004]
- **Details**:
  - Find the deployment guide page component (likely at `/deployment-guide` route)
  - Update it to reflect:
    - Required environment variables (DATABASE_URL, SESSION_SECRET, ADMIN_EMAIL, ADMIN_PASSWORD, FIRM_NAME, OPENAI_API_KEY optional)
    - Steps: RDS setup, configure secrets, build Docker, push to ECR, deploy to ECS
    - Post-deployment: login with admin credentials, configure AI in Settings
    - Remove references to demo data/test users
  - Also update `AWS-DEPLOYMENT-GUIDE.md`
  - Files: deployment guide component, `AWS-DEPLOYMENT-GUIDE.md`
  - Acceptance: Guide is accurate for production deployment

### T006: Clean up and verify production build
- **Blocked By**: [T001, T002, T003]
- **Details**:
  - Run `npm run build` to verify the production build works
  - Check for any TypeScript or build errors
  - Verify the Dockerfile builds correctly (conceptually — can't run Docker in Replit)
  - Update `replit.md` with production deployment changes
  - Files: various
  - Acceptance: Production build succeeds, no errors
