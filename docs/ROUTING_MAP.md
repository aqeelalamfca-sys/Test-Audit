# AuditWise Routing Map

## Complete Navigation Flow

This document lists all routes and their linked CTAs (Call-to-Actions).

---

## Global Routes (No Engagement Context)

| Route | Component | Description | Next Step CTA |
|-------|-----------|-------------|---------------|
| `/` | Dashboard | Main dashboard | Select Engagement |
| `/dashboard` | Dashboard | Main dashboard | Select Engagement |
| `/clients` | ClientList | All clients list | View Client → Client Detail |
| `/clients/new` | ClientOnboarding | Create new client | Save → Client List |
| `/clients/:id` | ClientDetail | Client details | Create Engagement → New Engagement |
| `/clients/:id/edit` | ClientOnboarding | Edit client | Save → Client Detail |
| `/engagements` | Engagements | All engagements | Select Engagement → Workspace |
| `/engagement/new` | NewEngagement | Create engagement | Save → Engagement Detail |
| `/engagement/:id` | EngagementDetail | Engagement summary | Open Workspace → Requisition |
| `/engagement/:id/edit` | EngagementEdit | Edit engagement | Save → Engagement Detail |
| `/allocation` | EngagementAllocation | Team allocation | Assign → Save |
| `/admin` | AdminDashboard | Admin panel | Manage Users/Firms |
| `/administration` | Administration | System admin | Configure Settings |
| `/users` | UserManagement | User management | Add/Edit Users |
| `/firm-controls` | FirmWideControls | Firm controls | Configure Controls |
| `/reports` | Reports | Reporting | Generate Reports |
| `/settings` | Settings | App settings | Save Settings |

---

## Workspace Routes (Engagement Context Required)

### Audit Workflow Sequence

```
Client → Engagement → GL/TB Upload → CoA Mapping → Generate FS → Planning → Execution → Evidence → Finalization → Deliverables → EQCR → Inspection
```

| Route | Component | Phase | Description | Next Step CTA |
|-------|-----------|-------|-------------|---------------|
| `/workspace/:engagementId/requisition` | InformationRequisition | Onboarding | Upload TB/GL, Map CoA | Push to Planning → Pre-Planning |
| `/workspace/:engagementId/pre-planning` | PrePlanning | Pre-Planning | Preliminary procedures | Complete → Planning |
| `/workspace/:engagementId/planning` | Planning | Planning | Risk assessment, materiality | Approve → Execution |
| `/workspace/:engagementId/execution` | Execution | Execution | Testing procedures | Complete Tests → FS Heads |
| `/workspace/:engagementId/fs-heads` | FSHeadsPage | Execution | Financial statement heads | Complete → Evidence |
| `/workspace/:engagementId/evidence` | EvidenceVault | Execution | Evidence management | Upload Evidence → Finalization |
| `/workspace/:engagementId/observations` | Observations | Execution | ISA 450 observation board | Track Misstatements → Finalization |
| `/workspace/:engagementId/finalization` | Finalization | Finalization | Conclude audit | Finalize → Deliverables |
| `/workspace/:engagementId/deliverables` | PrintView | Reporting | Generate reports | Generate → EQCR |
| `/workspace/:engagementId/eqcr` | EQCR | EQCR | Quality control review | Approve → Inspection |
| `/workspace/:engagementId/inspection` | Inspection | Inspection | Inspection readiness | Submit → Complete |

### Supporting Workspace Routes

| Route | Component | Description |
|-------|-----------|-------------|
| `/workspace/:engagementId/control` | EngagementControl | Engagement controls |
| `/workspace/:engagementId/onboarding` | EngagementControl | Client onboarding |
| `/workspace/:engagementId/ethics` | EthicsIndependence | Ethics & Independence |
| `/workspace/:engagementId/tb-review` | TBReview | Trial Balance review |
| `/workspace/:engagementId/qcr-dashboard` | InspectionDashboard | QCR Dashboard |
| `/workspace/:engagementId/audit-health` | AuditHealthDashboard | Audit health metrics |

---

## Client Portal Routes

| Route | Component | Description |
|-------|-----------|-------------|
| `/portal/login` | PortalLogin | Client portal login |
| `/portal/dashboard` | PortalDashboard | Client portal home |
| `/portal/engagement/:id` | PortalRequests | Client document requests |

---

## Key Navigation CTAs Per Module

### Information Requisition
- **Upload TB** → Validate → Show errors/success
- **Upload GL** → Validate → Show errors/success
- **Run AI Mapping** → Auto-suggest CoA mappings
- **Approve Mapping** → Mark as MATCHED
- **Push to CoA** → Create/Update Chart of Accounts
- **Push to Planning** → Navigate to Pre-Planning

### Pre-Planning
- **Complete Checklist Items** → Mark phase complete
- **Submit for Review** → Manager review
- **Approve** → Navigate to Planning

### Planning
- **Calculate Materiality** → Generate thresholds
- **Assess Risks** → Document risk assessments
- **Create Audit Strategy** → Document approach
- **Approve Strategy** → Partner sign-off → Navigate to Execution

### Execution
- **Select FS Head** → Open testing procedures
- **Complete Procedure** → Mark done
- **Upload Evidence** → Attach to procedure
- **All Complete** → Navigate to Finalization

### Finalization
- **Draft Opinion** → Create audit opinion
- **Complete Checklist** → All items done
- **Partner Sign-off** → Approve → Navigate to Deliverables

### Deliverables
- **Generate Report** → Create PDF
- **Download** → Export document
- **Submit for EQCR** → Navigate to EQCR

### EQCR
- **Complete Review Points** → Address all items
- **Approve EQCR** → Partner approval
- **Complete** → Navigate to Inspection

### Inspection
- **Prepare Responses** → Document answers
- **Submit for QCR** → Final submission

---

## Route Naming Convention

The application uses a workspace-based routing pattern where all engagement-specific routes are under `/workspace/:engagementId/*`. This pattern is enforced in the router configuration in `client/src/App.tsx`.

**Note:** Legacy `/engagement/:id/*` routes should be updated in any external links or bookmarks to use the `/workspace/:id/*` pattern.

---

## API Endpoints Map

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/auth/ping` | Auth status |
| POST | `/api/auth/login` | User login |
| POST | `/api/auth/logout` | User logout |
| GET | `/api/clients` | List clients |
| POST | `/api/clients` | Create client |
| GET | `/api/engagements` | List engagements |
| POST | `/api/engagements` | Create engagement |
| GET | `/api/engagements/:id` | Get engagement |
| GET | `/api/coa/:engagementId` | Chart of Accounts |
| POST | `/api/tb/upload` | Upload Trial Balance |
| POST | `/api/gl/upload` | Upload General Ledger |
| GET | `/api/materiality/:engagementId` | Materiality |
| GET | `/api/risks/:engagementId` | Risk assessments |
| GET | `/api/evidence/:engagementId` | Evidence vault |
| GET | `/api/deliverables/:engagementId` | Deliverables |
| GET | `/api/observations/:engagementId` | List observations |
| POST | `/api/observations/:engagementId` | Create observation |
| GET | `/api/observations/:engagementId/:id` | Get observation |
| PATCH | `/api/observations/:engagementId/:id` | Update observation |
| DELETE | `/api/observations/:engagementId/:id` | Delete observation |
| POST | `/api/observations/:engagementId/:id/management-response` | Add management response |
| POST | `/api/observations/:engagementId/:id/auditor-conclusion` | Add auditor conclusion |
| POST | `/api/observations/:engagementId/:id/clear` | Clear observation |
| POST | `/api/observations/:engagementId/:id/waive` | Waive observation |
| GET | `/api/observations/:engagementId/summary` | Observation summary stats |
| GET | `/api/impacts/:engagementId` | List upstream impacts |
| POST | `/api/impacts/:engagementId` | Register impact |
| GET | `/api/impacts/:engagementId/:id` | Get impact |
| POST | `/api/impacts/:engagementId/:id/acknowledge` | Acknowledge impact |
| POST | `/api/impacts/:engagementId/:id/resolve` | Resolve impact |
| POST | `/api/impacts/:engagementId/:id/ignore` | Ignore impact |
| POST | `/api/impacts/:engagementId/bulk-resolve` | Bulk resolve impacts |
| GET | `/api/impacts/:engagementId/summary` | Impact summary stats |

---

*Last Updated: January 31, 2026*
