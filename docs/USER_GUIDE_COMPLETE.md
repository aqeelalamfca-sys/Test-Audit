# AuditWise — Complete End-to-End User Guide

**Version:** 1.0 | **Last Updated:** March 2026
**URL:** https://auditwise.tech

---

## Table of Contents

1. [Getting Started](#1-getting-started)
2. [Dashboard Overview](#2-dashboard-overview)
3. [Client Management](#3-client-management)
4. [Engagement Management](#4-engagement-management)
5. [Audit Workspace — The 9-Phase Lifecycle](#5-audit-workspace)
   - 5.1 Pre-Planning (ISA 210/220/300/315)
   - 5.2 Information Requisition (PBC)
   - 5.3 Planning (ISA 300/315/320/330/520/530)
   - 5.4 Execution (ISA 230/330/500/501/505)
   - 5.5 FS Heads & Working Papers
   - 5.6 Evidence Vault
   - 5.7 Finalization (ISA 450/560/570/580/700)
   - 5.8 Deliverables & Reporting
   - 5.9 EQCR (Engagement Quality Control Review)
   - 5.10 Inspection
6. [Trial Balance & Data Import](#6-trial-balance--data-import)
7. [AI Assistant](#7-ai-assistant)
8. [Review Notes](#8-review-notes)
9. [Regulatory Compliance Tools](#9-regulatory-compliance-tools)
10. [Firm Administration](#10-firm-administration)
11. [Platform Administration (Super Admin)](#11-platform-administration)
12. [User Roles & Permissions](#12-user-roles--permissions)
13. [Auto-Save & Data Safety](#13-auto-save--data-safety)
14. [VPS Deployment & Maintenance](#14-vps-deployment--maintenance)
15. [Troubleshooting](#15-troubleshooting)

---

## 1. Getting Started

### Logging In
1. Open **https://auditwise.tech** in your browser (Chrome, Edge, or Firefox recommended)
2. Enter your email and password
3. Click **Login**

### First-Time Setup (Super Admin)
After first deployment, the Super Admin account is automatically created:
- **Email:** aqeelalam2010@gmail.com
- **Password:** Aqeel@123$

**Important:** Change your password after first login.

### Navigation
- **Sidebar** on the left provides access to all modules
- The sidebar adapts based on your **role** and whether you are in **Global Mode** or **Workspace Mode**
- **Global Mode** = Managing clients, engagements, and firm settings
- **Workspace Mode** = Working inside a specific engagement (audit lifecycle)

---

## 2. Dashboard Overview

The main dashboard (**/** or **/dashboard**) displays:

| Section | What It Shows |
|---------|---------------|
| **KPI Cards** | Total Clients, Active Engagements, Pending Reviews, Upcoming Deadlines |
| **My Assignments** | Engagements assigned to you with current phase and status |
| **Quick Actions** | Shortcuts to create new clients, engagements, or access recent work |
| **Notifications** | System alerts, review requests, and deadline reminders |

---

## 3. Client Management

### Creating a New Client
1. Navigate to **Clients** from the sidebar
2. Click **New Client**
3. Fill in the required information:
   - **Company Name** and Trading Name
   - **Entity Type** (Public Ltd, Private Ltd, Partnership, etc.)
   - **Registration Numbers** — SECP, NTN, STRN
   - **Industry Classification**
   - **Registered Address** and Contact Details
   - **Directors/Partners** — Names, CNICs, and designations
   - **UBO (Ultimate Beneficial Owner)** details
   - **Prior Auditor** information (if applicable)

### Automated Risk Scoring
AuditWise automatically calculates a **Risk Score** and **Risk Category** based on:
- Industry risk level
- Ownership complexity
- PEP (Politically Exposed Person) involvement
- Prior audit opinions and qualifications
- AML/Sanctions screening results

**Risk Categories:**
| Category | Meaning |
|----------|---------|
| **LOW** | Standard engagement, minimal additional procedures |
| **NORMAL** | Standard procedures apply |
| **HIGH** | Enhanced due diligence required, partner approval mandatory |
| **PROHIBITED** | Cannot accept — engagement must be declined |

### Client Approval
- Clients with **HIGH** risk require **Partner-level** sign-off
- **PROHIBITED** clients cannot be approved
- Approval generates a formal **Acceptance Memo**

---

## 4. Engagement Management

### Creating a New Engagement
1. Navigate to **Engagements** from the sidebar
2. Click **New Engagement**
3. Configure:
   - **Select Client** from approved client list
   - **Engagement Type** — Statutory Audit, Limited Review, Special Purpose, etc.
   - **Fiscal Year End** — The period under audit
   - **Period Start/End** dates
   - **Reporting Deadline**
   - **Assign Team:**
     - Engagement Partner
     - Manager
     - Team Lead
     - Staff members

### Engagement Lifecycle Phases
Each engagement follows **9 sequential phases**:

```
Onboarding → Pre-Planning → Requisition → Planning → Execution → Finalization → Reporting → EQCR → Inspection
```

### Phase Gates (Lock Gates)
AuditWise enforces **Lock Gates** — you cannot advance to the next phase until specific requirements are met:
- Materiality must be set before Execution
- Risk Assessment must be approved before Audit Program
- All working papers must be signed off before Finalization
- EQCR clearance required before Inspection

---

## 5. Audit Workspace

When you open an engagement, you enter the **Workspace**. The sidebar switches to show the audit lifecycle phases.

**URL Pattern:** `/workspace/:engagementId/:phase`

---

### 5.1 Pre-Planning (ISA 210/220/300/315)

**What it covers:** Engagement acceptance, ethical groundwork, and initial planning.

**Tabs/Sections:**

#### Tab 1: Engagement Setup (ISA 300/210)
- Client Name, Engagement Code, Fiscal Year — **auto-populated** from engagement data
- Reporting Framework (IFRS, AFRS, etc.)
- Currency
- Group Audit settings
- Engagement type and key dates (fieldwork start/end, planning deadline, reporting deadline)

#### Tab 2: Entity Understanding (ISA 315)
- Nature of the entity's business
- Legal structure and ownership
- Governance and management
- Industry-specific factors
- Applicable financial reporting framework

#### Tab 3: Ethics & Independence (ISA 220)
- Independence declarations for each team member
- Ethical conflict checks
- Fee arrangements and non-audit services assessment
- Staff rotation requirements

#### Tab 4: Acceptance & Continuance (ISA 210/220)
- **Know Your Client (KYC)** verification
- Due diligence assessment
- Entity identity verification (registration number, SECP, NTN, incorporation date)
- Director/shareholder verification
- Risk grading and acceptance decision (Accept / Accept with Conditions / Decline)

#### Tab 5: Engagement Letter (ISA 210)
- Generate the formal engagement letter
- Customize terms and conditions
- Define scope, responsibilities, and fee arrangements
- Digital signature and date

#### Tab 6: Completion & Sign-off (ISA 300)
- Pre-planning checklist review
- Partner approval gate
- Formal sign-off to proceed to Planning

---

### 5.2 Information Requisition (PBC — Provided by Client)

**What it covers:** Managing all data and document requests to the client.

**How to use:**
1. Navigate to **Requisition** in the workspace
2. Create information requests specifying:
   - Document/data needed
   - FS Category (Revenue, PPE, etc.)
   - Audit Assertion (Existence, Completeness, etc.)
   - Priority (High, Medium, Low)
   - Deadline
3. Track request status:

| Status | Meaning |
|--------|---------|
| **PENDING** | Request sent, awaiting client response |
| **PROVIDED** | Client has uploaded the document |
| **RETURNED** | Document returned for revision |
| **ACCEPTED** | Document verified and accepted |

4. **AI Assistance** can auto-generate request descriptions and score client response quality
5. Each request gets a **SR (Serial) Number** for tracking

---

### 5.3 Planning (ISA 300/315/320/330/520/530)

**What it covers:** The core audit strategy, risk assessment, materiality, and procedure design.

**Tabs/Sections:**

#### Tab 1: Financial Statements
- View Draft Financial Statements
- Balance Sheet and Profit & Loss review
- Trial Balance data overview

#### Tab 2: Entity & Controls
- Detailed internal control assessment
- Business process walkthroughs
- IT environment evaluation
- Control risk assessment

#### Tab 3: Risk Assessment (ISA 315)
- Identify risks of material misstatement
- Risk heatmap visualization
- AI-assisted risk identification
- Fraud risk assessment (ISA 240)
- Map risks to financial statement assertions

#### Tab 4: Analytical Procedures (ISA 520)
- Trend analysis
- Ratio analysis (standard financial ratios)
- Budget vs. actual comparison
- Unusual fluctuation identification
- Opening balances review

#### Tab 5: Materiality (ISA 320)
- **8-step materiality determination:**
  1. Select benchmark (Revenue, Total Assets, PBT, Equity, Gross Profit)
  2. Enter financial data
  3. Calculate Overall Materiality
  4. Set Performance Materiality (typically 50-75% of overall)
  5. Set Trivial Threshold (typically 3-5% of overall)
  6. Consider specific materiality for sensitive items
  7. Document rationale
  8. Partner approval

#### Tab 6: Audit Strategy & Approach
- Define the overall audit approach (substantive vs. combined)
- 9-step strategy development
- Resource and timing plan
- TCWG (Those Charged With Governance) communication plan

#### Tab 7: Sampling (ISA 530)
- Statistical and non-statistical sampling plans
- Sample size calculation
- Sampling method selection (random, systematic, haphazard)
- Population definition

#### Tab 8: Audit Program (ISA 330)
- Generate the audit procedures matrix
- Map procedures to identified risks
- Define nature, timing, and extent of procedures
- Assign procedures to team members

#### Tab 9: Specialized Areas
- Related party transactions (ISA 550)
- Accounting estimates (ISA 540)
- Group audit considerations (ISA 600)
- Laws and regulations (ISA 250)

#### Tab 10: TCWG Communication
- Plan required communications
- Independence confirmation
- Draft governance letters

#### Tab 11: Quality Control
- Planning review checklist
- Supervisor review and sign-off

---

### 5.4 Execution (ISA 230/330/500/501/505)

**What it covers:** The actual fieldwork — testing controls and performing substantive procedures.

**How to use:**
1. Navigate to **Execution** in the workspace
2. The dashboard shows completion progress by FS Head
3. **Planning Prerequisites Check** runs automatically — if materiality or risks aren't approved, you'll be blocked
4. Click on each **FS Head** (Revenue, PPE, Inventory, etc.) to access working papers
5. For each FS Head, document:
   - Control testing results
   - Substantive testing results
   - Analytical procedure results
   - Evidence collected

---

### 5.5 FS Heads & Working Papers

**What it covers:** Per-account audit documentation using the Field Orchestration system.

**Structure:**
- Each Financial Statement Head (Revenue, Cost of Sales, PPE, Receivables, etc.) has its own working paper set
- Working papers are generated dynamically based on audit blueprints
- **Multi-level sign-off** is enforced:
  1. **Preparer** — Staff who performs the work
  2. **Reviewer** — Manager who reviews the work
  3. **Approver** — Partner who approves

**Key Features:**
- Direct linkage to Trial Balance amounts
- Automated cross-referencing to audit procedures
- Evidence attachment capability
- ISA compliance mapping

---

### 5.6 Evidence Vault

**What it covers:** Centralized document management and audit trail.

**Features:**
- Upload and organize all audit evidence
- Tag documents by phase, FS Head, and assertion
- Version control — track document changes
- Link evidence directly to specific audit procedures
- Mark documents as "Permanent" to carry forward to future audits
- Full audit trail — every upload, modification, and deletion is logged

---

### 5.7 Finalization (ISA 450/560/570/580/700/705/706)

**What it covers:** Concluding the audit and forming the opinion.

**Tabs/Sections:**

#### Tab 1: Adjusted Financial Statements
- Review all proposed audit adjustments
- Track adjusted vs. unadjusted differences (ISA 450)
- View the final financial statements

#### Tab 2: Subsequent Events (ISA 560)
- Identify events between the financial statement date and report date
- Classify as adjusting or non-adjusting events
- Document procedures performed

#### Tab 3: Going Concern (ISA 570)
- Evaluate management's going concern assessment
- Review for at least 12 months from reporting date
- Document indicators and conclusions

#### Tab 4: Written Representations (ISA 580)
- Generate the Management Representation Letter
- Customize representations based on engagement specifics
- Track signed receipt from management

#### Tab 5: Audit Summary & Opinion (ISA 700/705/706)
- Form the audit opinion:
  - **Unmodified** — Clean opinion
  - **Qualified** — Material but not pervasive
  - **Adverse** — Material and pervasive
  - **Disclaimer** — Unable to obtain sufficient evidence
- Add Emphasis of Matter or Other Matter paragraphs (ISA 706)
- Draft the audit report

#### Tab 6: Completion Checklist
- Final ISA-mapped checklist covering:
  - ISA 220 (Quality Management)
  - ISA 230 (Documentation)
  - ISA 500 (Audit Evidence)
  - ISA 560 (Subsequent Events)
  - ISA 700 (Forming an Opinion)

#### Tab 7: Control Board
- File locking mechanism
- Partner final sign-off
- Lock the engagement file

---

### 5.8 Deliverables & Reporting

**What it covers:** Print-ready outputs and final documents.

**Deliverables include:**
- Audit Report (ISA 700/705/706)
- Management Letter
- Communication to TCWG
- Engagement completion summary
- All formatted for printing and filing

---

### 5.9 EQCR — Engagement Quality Control Review

**What it covers:** Independent quality review of the completed audit.

**How it works:**
1. An independent **EQCR Reviewer** (partner not involved in the engagement) is assigned
2. The reviewer assesses:
   - Significant judgments made
   - Audit evidence supporting the opinion
   - Independence and ethical compliance
   - Quality of documentation
3. EQCR clearance must be obtained before the audit report can be issued

---

### 5.10 Inspection

**What it covers:** Internal and external quality inspection dashboard.

**Features:**
- Review engagement files for quality compliance
- Track inspection findings and remediation
- Document compliance with ISQM-1 requirements
- Support internal QA reviews and external regulatory inspections

---

## 6. Trial Balance & Data Import

### Import Wizard
1. Navigate to your engagement workspace
2. Go to **TB Review** or use the **Import** function
3. Use the **Single File Import Template** (Excel) with sheets for:
   - **Chart of Accounts** — Account codes and names
   - **Trial Balance** — Opening and closing balances
   - **General Ledger** — Detailed transaction entries
   - **Parties** — AR/AP party master
   - **Bank Accounts** — Bank account details
   - **Open Items** — Outstanding receivables/payables

### Automated Validation
- Debit/Credit balance checks
- GL movements reconciliation with TB changes
- Duplicate entry detection
- Opening balance verification

### AI Classification
- AuditWise uses AI to suggest **FS Head mappings** for TB accounts
- Maps account codes/names to standard financial statement areas (Revenue, Cost of Sales, PPE, etc.)
- Suggestions can be reviewed and overridden manually

---

## 7. AI Assistant

AuditWise includes an **AI Co-Pilot** integrated throughout the workspace.

### How to Use
- Look for the **AI button** on any text field
- Click it to get ISA-compliant suggestions for:
  - Risk descriptions
  - Audit procedure wording
  - Entity understanding narratives
  - Going concern assessments
  - Management letter points
  - Any audit documentation text

### AI Configuration
- **Platform Level:** Super Admin sets global API keys and model preferences
- **Firm Level:** Firm Admin can override with firm-specific API keys
- **Supported Providers:** OpenAI (GPT-4o), Azure OpenAI, Google Gemini, DeepSeek

### AI Usage Monitoring
- Track token consumption per firm
- Monitor AI credit usage via Firm Admin dashboard

---

## 8. Review Notes

**Location:** Sidebar → **Review Notes**

A centralized hub for tracking review comments across all engagements:
- Create review notes linked to specific sections
- Assign to team members for resolution
- Track status (Open, In Progress, Resolved)
- Filter by engagement, phase, or priority

---

## 9. Regulatory Compliance Tools

### SECP Compliance
- **Location:** Sidebar → **SECP Compliance**
- Track compliance with Securities & Exchange Commission of Pakistan requirements
- Checklists for SECP filing requirements

### FBR Documentation
- **Location:** Sidebar → **FBR Documentation**
- Federal Board of Revenue compliance documentation
- Tax-related audit procedures

### Standards Matrix
- **Location:** Sidebar → **Standards Matrix**
- Complete mapping of audit procedures to ISA standards
- Verify ISA coverage across the engagement

---

## 10. Firm Administration

**Access:** Sidebar → **Firm Admin** (requires Firm Admin or Partner role)

### Firm Profile & Settings
- Update firm name, addresses, and contact information
- Regulatory registrations (ICAP, ICAEW, etc.)
- Tax identification numbers
- Partner listings for document headers
- Firm logo and branding

### User Management
- Add/edit/deactivate firm users
- Assign roles: **Partner, EQCR, Manager, Senior, Staff**
- **Granular Permission Overrides** — grant or revoke specific permissions per user
- **Maker-Checker Configuration** — define modules requiring dual authorization

### Subscription & Billing
- View current plan and usage statistics
- Monitor limits (users, offices, engagements, storage)
- View billing history and invoices

### Firm-Wide Controls (ISQM-1)
- Manage the firm's Quality Management System
- ISQM-1 control register
- Firm-wide compliance logs and monitoring

### AI Usage & Policy
- Monitor firm AI token consumption
- Configure firm-specific AI API keys (override platform defaults)

### Audit Logs
- Comprehensive activity logs for all firm actions
- Filter by user, action type, date range

---

## 11. Platform Administration (Super Admin Only)

**Access:** Sidebar → **Platform Admin**

### Platform Dashboard
- Total firms overview (active, trial, suspended)
- Total users across all firms
- AI usage statistics
- **System Health Monitoring:**
  - CPU, Memory, Disk usage gauges
  - Service status (Nginx, PostgreSQL, Redis, Backend)
  - Automated health probes

### Firm Management
- Create, suspend, activate, or terminate tenant firms
- Set up branch offices
- Upload firm logos
- Reset firm admin credentials

### Plan & Subscription Management
- Define pricing tiers (Starter, Growth, Professional, Enterprise)
- Configure limits per plan (users, offices, engagements, storage)
- Set pricing in PKR/USD
- Configure discount rules (monthly/annual)

### AI Configuration
- Global AI provider settings (OpenAI, Azure OpenAI, Google Gemini, DeepSeek)
- Manage API keys and model selection
- Set monthly token limits per plan

### System Deployment Control
- Trigger deployments from the dashboard
- Git pull, build, and migration controls

### Platform Audit Logs
- System-wide activity tracking
- Security event monitoring

### Notifications
- Send global, firm-specific, or engagement-specific notifications
- Notification types: Popup, Banner, or Email

---

## 12. User Roles & Permissions

| Role | Access Level |
|------|-------------|
| **Super Admin** | Full platform control — firms, plans, AI config, system health |
| **Firm Admin** | Firm-wide settings, users, subscriptions, ISQM-1 controls |
| **Partner** | All engagements, sign-off authority, EQCR assignment, client approval |
| **EQCR Reviewer** | Independent quality review of completed engagements |
| **Manager** | Engagement management, team allocation, review authority |
| **Senior** | Working paper preparation, team lead functions |
| **Staff** | Working paper preparation, data entry, basic access |

### Security Features
- **Two-Factor Authentication (2FA)** — TOTP-based secondary security
- **Digital Signatures & Partner PINs** — Required for high-stakes sign-offs
- **Complete Audit Trail** — Every field-level change logged with IP address and device info
- **Role-Based Access Control (RBAC)** — Granular permissions per module
- **Tenant Isolation** — Strict data separation between firms

---

## 13. Auto-Save & Data Safety

### How Auto-Save Works
- AuditWise automatically saves your work as you type
- **Draft saves** happen in the background every few seconds
- **Final saves** happen when you click Save or move between sections
- A save indicator in the UI shows the last save time

### Save Behavior
| Action | What Happens |
|--------|-------------|
| Typing in a field | Draft saved automatically after a brief pause |
| Clicking Save | Final save to the server |
| Navigating away | Pending changes are flushed before leaving |
| Browser closed | Last draft is preserved |
| Network interruption | Changes are queued and saved when connection returns |

### Data Protection
- All data encrypted in transit (SSL/TLS)
- Database-level encryption at rest
- Regular automated backups
- Immutable audit trails

---

## 14. VPS Deployment & Maintenance

### Standard Deployment Command
After code changes are pushed to GitHub, run on VPS:
```bash
cd /opt/auditwise && git fetch --all -q && git reset --hard origin/main -q && docker compose build backend frontend && docker compose up -d
```

### Container Architecture
| Container | Purpose | Port |
|-----------|---------|------|
| **auditwise-backend** | Express.js API server | 5000 (internal) |
| **auditwise-frontend** | Nginx serving React build | 80 (internal) |
| **auditwise-nginx** | SSL termination & reverse proxy | 80, 443 (public) |
| **auditwise-db** | PostgreSQL 15 database | 5432 (internal) |
| **auditwise-redis** | Redis 7 cache | 6379 (internal) |

### Health Check Commands
```bash
# Check all container status
docker ps

# View backend logs
docker logs auditwise-backend --tail 100

# View frontend logs
docker logs auditwise-frontend --tail 50

# Check API health
curl http://localhost:5000/api/health

# Check full system health
curl http://localhost:5000/api/health/full
```

### Recovery Commands
```bash
# If backend crashes (exit code 137 = out of memory)
docker system prune -f && docker compose up -d

# Full restart (safe)
cd /opt/auditwise && docker compose up -d

# Emergency recovery
cd /opt/auditwise && systemctl restart docker && sleep 8 && docker compose up -d
```

### Safety Rules
| Rule | Reason |
|------|--------|
| **Never** run `iptables -F` | Wipes all firewall rules, locks you out |
| **Never** enable UFW | Conflicts with Docker networking |
| **Never** use `docker compose restart` | Use `docker compose up -d` instead |
| **Never** delete Docker volumes | Contains your database and uploads |

---

## 15. Troubleshooting

### Common Issues & Solutions

| Problem | Solution |
|---------|----------|
| Can't log in | Check if backend is running: `docker ps`. Reset password via Super Admin |
| Page shows blank | Hard refresh (Ctrl+Shift+R). Check frontend container logs |
| API errors | Check backend logs: `docker logs auditwise-backend --tail 100` |
| Backend crash (exit 137) | Out of memory — run `docker system prune -f && docker compose up -d` |
| SSL certificate expired | Renew with certbot, then restart nginx |
| Slow performance | Check server resources: `free -h && df -h`. Prune Docker: `docker system prune -f` |
| Data not saving | Check browser console for errors. Verify JWT token hasn't expired (re-login) |
| Phase locked | Complete required items in the current phase. Check Lock Gate panel for missing requirements |
| AI not working | Verify OpenAI API key in Platform Admin → AI Config. Check backend logs for API errors |
| Import fails | Verify Excel file matches the import template format. Check for duplicate account codes |

### Getting Help
- **Built-in Guide:** Access via sidebar → **User Guide** for interactive documentation
- **Issue Reporting:** Use the User Guide's issue reporting feature to submit bugs
- **System Health:** Super Admin can check system diagnostics via Platform Admin dashboard

---

## ISA Standards Coverage Summary

| ISA Standard | Module | Phase |
|-------------|--------|-------|
| ISA 200 | Overall objectives | All phases |
| ISA 210 | Engagement terms | Pre-Planning (Engagement Letter) |
| ISA 220 | Quality management | Pre-Planning (Ethics), Planning (QC) |
| ISA 230 | Documentation | Execution (Working Papers) |
| ISA 240 | Fraud | Planning (Risk Assessment) |
| ISA 250 | Laws & regulations | Planning (Specialized Areas) |
| ISA 300 | Planning | Pre-Planning, Planning |
| ISA 315 | Risk identification | Pre-Planning, Planning |
| ISA 320 | Materiality | Planning (Materiality) |
| ISA 330 | Risk responses | Planning (Audit Program), Execution |
| ISA 450 | Misstatements | Finalization (Adjusted FS) |
| ISA 500 | Audit evidence | Execution (Working Papers) |
| ISA 501 | Specific items | Execution |
| ISA 505 | External confirmations | Execution |
| ISA 520 | Analytical procedures | Planning, Execution |
| ISA 530 | Sampling | Planning (Sampling) |
| ISA 540 | Accounting estimates | Planning (Specialized Areas) |
| ISA 550 | Related parties | Planning (Specialized Areas) |
| ISA 560 | Subsequent events | Finalization |
| ISA 570 | Going concern | Finalization |
| ISA 580 | Written representations | Finalization |
| ISA 600 | Group audits | Planning (Specialized Areas) |
| ISA 700 | Forming an opinion | Finalization (Audit Summary) |
| ISA 705 | Modified opinions | Finalization (Audit Summary) |
| ISA 706 | Emphasis/Other matters | Finalization (Audit Summary) |
| ISA 720 | Other information | Finalization |
| ISQM-1 | Quality management system | Firm Admin (Firm Controls) |

---

**End of Guide**
