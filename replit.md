# AuditWise - Statutory Audit Management Software

## Overview
AuditWise is a comprehensive full-stack statutory audit management platform designed to streamline and enhance the efficiency and compliance of statutory audit processes for firms. It integrates AI-assisted functionalities with human oversight to manage engagements, clients, risk assessments, and compliance through a phase-driven workflow. The platform supports regulatory standards like ISA 230 and ISQM 1, provides robust audit trail capabilities, and aims to deliver a complete audit lifecycle management tool, improving audit quality and firm-wide consistency. It includes both a web application and a VS Code extension, covering the entire audit lifecycle from planning to finalization.

## User Preferences
Not specified.

## System Architecture
AuditWise utilizes a modern full-stack architecture with React 18, Vite, TailwindCSS, Radix UI, and React Query for the frontend, and Express.js in TypeScript with PostgreSQL and Prisma ORM for the backend. Session-based authentication is handled via Passport.js.

Key architectural patterns and features include:
- **Multi-Tenant SaaS Architecture**: Strict tenant isolation with Row-Level Security (RLS) in PostgreSQL, `withTenantContext` helper, and `blockSuperAdmin` middleware. Features invite-based onboarding, a defined role hierarchy, subscription plans with overage pricing, and comprehensive subscription/firm status guards.
- **Audit Enforcement Engine**: A global backend service ensuring compliance (ISA 230/ISQM-1) through phase sequencing, gate checks, and immutable audit logging.
- **Integrated Audit Workspace**: Features a Global EngagementContext, auto-save, AI Assistance, phase gates, Evidence Vault, and cross-phase data linking.
- **AI Audit Utilities Module**: Integrates AI services for evidence sufficiency analysis, risk-response gap detection, documentation completeness checks, draft memo generation, and AI output persistence with rate limiting.
- **Core AI Engines**: Includes an AI Risk Assessment Engine (ISA 315/240/330), ISA 300/330 Audit Strategy & Approach Engine, ISA 530 Audit Sampling Engine, and ISA 330 Audit Program & Procedure Engine.
- **Financial Statement Builder Module**: AI-assisted mapping of Trial Balance to Financial Statement captions and materiality handling.
- **Materiality Engine Module (ISA 320/450)**: Configurable materiality calculation with an 8-step AI-driven analysis.
- **Compliance & Control**: Features an AI Audit Health Dashboard for ISA/ISQM-1 compliance monitoring, a Dynamic Link Monitor + Auto-Repair Engine for audit chain integrity, a Firm Control Compliance Log, Regulatory Compliance Checklists, and a Compliance Simulation Engine.
- **Sign-Off & Locking**: A Unified SignOffBar component enforcing role-based sign-offs (Maker-Checker-Approver) with an audit trail and a `useModuleReadOnly` hook for locking approved modules.
- **Finalization Control Board**: A user-wise dashboard with a deterministic risk scoring engine, AI-assisted narrative risk analysis, role-scoped views, unadjusted differences tracking, and a Standards Gate blocking finalization based on risk and unresolved issues.
- **Security & Access Control**: Implements robust password policies, input sanitization, security headers, a comprehensive audit log service, account lockout mechanisms, rate limiting middleware, and role-based access control.
- **Authentication**: Utilizes JWT access tokens (15-minute expiry) and refresh tokens (7-day expiry) with auto-refresh functionality on the frontend.
- **Performance Optimizations**: Includes lazy loading, response compression, database indexing, connection pooling, auto-save system, batched DB operations, and targeted query invalidation.
- **Deployment & Production Readiness**: Supports multi-platform deployment with Docker, NGINX configurations, daily backups, health checks, and robust environment variable management.
- **User Settings**: Provides configurable profile, notifications, preferences, AI configuration (admin only), and security settings, including backup/restore functionality.
- **Standard Audit Templates**: Auto-seeded templates (68 ISA/ISQM) covering various audit phases, manageable through an administration module.
- **Enhanced Platform Notifications**: Rich notification system with image upload (PNG/JPG/WEBP/GIF up to 10MB), YouTube video link embedding with preview, AI-powered content generation (topic + tone), and granular firm targeting (Global/Selected Firms with multi-select, search, and select-all). Preview dialog for media-rich notifications. Static file serving for uploaded notification images.
- **Invoice Auto-Email**: Automated invoice email delivery via Nodemailer on invoice generation and dispatch. Professional HTML email template with firm branding, line items, payment instructions. Graceful degradation when SMTP not configured.
- **Review Notes Dashboard**: Dedicated `/review-notes` page aggregating review notes across all engagements. Three tabs (Assigned to Me, Created by Me, All Notes for managers). Stats cards showing open/total counts. Filters by status, severity, and search. Reply threads, status transitions (Open→Addressed→Cleared), resolution workflow with justification. Links to engagement workspace. API: `/api/review-notes-v2/*` routes with multi-user assignment via `ReviewNoteAssignee` model.

## External Dependencies
- **PostgreSQL**: The primary relational database for data storage.
- **Prisma ORM**: Used for database interactions and object-relational mapping.
- **Passport.js**: Utilized for authentication middleware.
- **OpenAI API**: Provides AI-powered functionalities, including mapping, classification, risk assessment, procedure generation, notes generation, and compliance checks.