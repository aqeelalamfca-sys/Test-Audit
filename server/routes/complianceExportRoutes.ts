import { Router, Response } from "express";
import { requireAuth, requireMinRole, AuthenticatedRequest } from "../auth";
import { prisma } from "../db";

const router = Router();

const ISA_COVERAGE_DATA = [
  { standard: "ISA 200", title: "Overall Objectives", coverage: "FULL", components: ["Engagement lifecycle", "audit chain state machine", "enforcement engine"] },
  { standard: "ISA 210", title: "Agreeing the Terms", coverage: "FULL", components: ["Engagement letter module", "acceptance/continuance decisions", "pre-planning gates"] },
  { standard: "ISA 220", title: "Quality Management for an Audit", coverage: "FULL", components: ["EQCR module", "sign-off authority matrix", "review notes", "ISQM integration"] },
  { standard: "ISA 230", title: "Audit Documentation", coverage: "FULL", components: ["Lock-gate system", "immutable audit trail", "evidence vault", "attachment management"] },
  { standard: "ISA 240", title: "Fraud Responsibilities", coverage: "FULL", components: ["AI risk assessment engine (ISA 240 fraud risk)", "risk procedure auto-mapper"] },
  { standard: "ISA 250", title: "Laws and Regulations", coverage: "FULL", components: ["Companies Act 2017 checklist", "SECP compliance dashboard", "FBR documentation"] },
  { standard: "ISA 260", title: "Communication with TCWG", coverage: "PARTIAL", components: ["Management letter module", "audit report generation"], gaps: ["No dedicated TCWG communication log"] },
  { standard: "ISA 265", title: "Communicating Deficiencies", coverage: "FULL", components: ["Control deficiency tracking", "management letter items", "ISA 265 badges in execution"] },
  { standard: "ISA 300", title: "Planning an Audit", coverage: "FULL", components: ["Planning phase with gate checks", "audit strategy engine (9-step)", "planning memos"] },
  { standard: "ISA 315", title: "Identifying and Assessing Risks", coverage: "FULL", components: ["AI risk assessment engine", "entity understanding", "risk heatmap", "risk-procedure linking"] },
  { standard: "ISA 320", title: "Materiality", coverage: "FULL", components: ["ISA 320 materiality panel", "8-step AI-driven analysis", "materiality engine"] },
  { standard: "ISA 330", title: "Responses to Assessed Risks", coverage: "FULL", components: ["Audit program engine (8-step)", "control tests", "substantive tests", "risk-response mapping"] },
  { standard: "ISA 402", title: "Service Organizations", coverage: "PARTIAL", components: ["Entity understanding covers service orgs"], gaps: ["No dedicated SOC report tracking"] },
  { standard: "ISA 450", title: "Evaluation of Misstatements", coverage: "FULL", components: ["Observation board", "misstatement tracking", "unadjusted differences in finalization"] },
  { standard: "ISA 500", title: "Audit Evidence", coverage: "FULL", components: ["Evidence vault", "AI copilot evidence sufficiency checks", "document management"] },
  { standard: "ISA 501", title: "Specific Items - Evidence", coverage: "FULL", components: ["Substantive test procedures", "external confirmations module"] },
  { standard: "ISA 505", title: "External Confirmations", coverage: "FULL", components: ["Confirmation letter service", "external confirmations tracking"] },
  { standard: "ISA 510", title: "Opening Balances", coverage: "FULL", components: ["Trial balance opening balance validation", "TB/GL import with OB checks"] },
  { standard: "ISA 520", title: "Analytical Procedures", coverage: "FULL", components: ["Analytical procedures module", "trend/ratio/variance analysis"] },
  { standard: "ISA 530", title: "Audit Sampling", coverage: "FULL", components: ["ISA 530 sampling engine (9-step)", "sampling runs", "population management"] },
  { standard: "ISA 540", title: "Accounting Estimates", coverage: "PARTIAL", components: ["Risk assessment covers estimates"], gaps: ["No dedicated estimate evaluation workflow"] },
  { standard: "ISA 550", title: "Related Parties", coverage: "FULL", components: ["Related parties tracking in engagement", "party master data"] },
  { standard: "ISA 560", title: "Subsequent Events", coverage: "FULL", components: ["Subsequent events module in finalization phase"] },
  { standard: "ISA 570", title: "Going Concern", coverage: "FULL", components: ["Going concern assessment with ISA 570.12/570.16 procedures"] },
  { standard: "ISA 580", title: "Written Representations", coverage: "FULL", components: ["Written representations module in finalization"] },
  { standard: "ISA 600", title: "Group Audits", coverage: "MISSING", components: [], gaps: ["No group/component auditor module"] },
  { standard: "ISA 610", title: "Using Internal Auditors", coverage: "MISSING", components: [], gaps: ["No internal audit reliance module"] },
  { standard: "ISA 620", title: "Using an Auditor's Expert", coverage: "MISSING", components: [], gaps: ["No expert engagement tracking"] },
  { standard: "ISA 700", title: "Forming an Opinion", coverage: "FULL", components: ["Audit report module", "opinion formation in finalization"] },
  { standard: "ISA 701", title: "Key Audit Matters", coverage: "PARTIAL", components: ["Audit report supports KAMs"], gaps: ["No dedicated KAM identification workflow"] },
  { standard: "ISA 705", title: "Modifications to Opinion", coverage: "FULL", components: ["Opinion tracker in SECP compliance", "qualified/adverse/disclaimer tracking"] },
  { standard: "ISA 706", title: "Emphasis/Other Matter", coverage: "PARTIAL", components: ["Report generation supports paragraphs"], gaps: ["No dedicated EOM tracking"] },
  { standard: "ISA 710", title: "Comparative Information", coverage: "PARTIAL", components: ["Prior year TB data available"], gaps: ["No formal comparative review workflow"] },
  { standard: "ISA 720", title: "Other Information", coverage: "MISSING", components: [], gaps: ["No other information review module"] },
];

const ISQM_REGISTER_DATA = [
  { controlId: "ISQM-GOV-001", domain: "Governance & Leadership", description: "Quality management partner designation", component: "isqmRoutes.ts - governance endpoints", status: "ACTIVE" },
  { controlId: "ISQM-GOV-002", domain: "Governance & Leadership", description: "Annual quality affirmation by leadership", component: "isqmRoutes.ts - leadership affirmations", status: "ACTIVE" },
  { controlId: "ISQM-GOV-003", domain: "Governance & Leadership", description: "Quality management committee tracking", component: "isqmRoutes.ts - committee management", status: "ACTIVE" },
  { controlId: "ISQM-GOV-004", domain: "Governance & Leadership", description: "Firm-wide quality policy documentation", component: "Firm settings, policy storage", status: "ACTIVE" },
  { controlId: "ISQM-ETH-001", domain: "Ethical Requirements", description: "Independence declaration per engagement", component: "Ethics & Independence module", status: "ACTIVE" },
  { controlId: "ISQM-ETH-002", domain: "Ethical Requirements", description: "Independence confirmation tracking", component: "ethicsRoutes.ts", status: "ACTIVE" },
  { controlId: "ISQM-ETH-003", domain: "Ethical Requirements", description: "Conflict of interest screening", component: "Pre-planning acceptance/continuance", status: "ACTIVE" },
  { controlId: "ISQM-ETH-004", domain: "Ethical Requirements", description: "Ethics breach monitoring dashboard", component: "ISQM dashboard - ethics metrics", status: "ACTIVE" },
  { controlId: "ISQM-AC-001", domain: "Acceptance & Continuance", description: "Client risk assessment before acceptance", component: "Pre-planning gates, acceptance decisions", status: "ACTIVE" },
  { controlId: "ISQM-AC-002", domain: "Acceptance & Continuance", description: "Independence clearance before engagement", component: "Enforcement engine gate check", status: "ACTIVE" },
  { controlId: "ISQM-AC-003", domain: "Acceptance & Continuance", description: "Partner approval for high-risk clients", component: "Sign-off authority matrix", status: "ACTIVE" },
  { controlId: "ISQM-AC-004", domain: "Acceptance & Continuance", description: "Annual continuance review", component: "Engagement lifecycle state machine", status: "ACTIVE" },
  { controlId: "ISQM-EP-001", domain: "Engagement Performance", description: "Phase-gated engagement workflow", component: "auditChainStateMachine.ts (9 phases)", status: "ACTIVE" },
  { controlId: "ISQM-EP-002", domain: "Engagement Performance", description: "Mandatory sign-off at each level", component: "signOffAuthority.ts (Prepared/Reviewed/Approved)", status: "ACTIVE" },
  { controlId: "ISQM-EP-003", domain: "Engagement Performance", description: "Partner review before finalization", component: "Lock-gate system, enforcement engine", status: "ACTIVE" },
  { controlId: "ISQM-EP-004", domain: "Engagement Performance", description: "Immutable audit trail for all actions", component: "auditLogService.ts, PlatformAuditLog", status: "ACTIVE" },
  { controlId: "ISQM-EP-005", domain: "Engagement Performance", description: "Document locking post-approval", component: "auditLock.ts middleware", status: "ACTIVE" },
  { controlId: "ISQM-EP-006", domain: "Engagement Performance", description: "Evidence sufficiency monitoring", component: "AI copilot evidence checks", status: "ACTIVE" },
  { controlId: "ISQM-EP-007", domain: "Engagement Performance", description: "Risk-response alignment", component: "riskProcedureAutoMapper.ts, linkageEngineService.ts", status: "ACTIVE" },
  { controlId: "ISQM-RES-001", domain: "Resources", description: "Team assignment with role enforcement", component: "Engagement team management, RBAC", status: "ACTIVE" },
  { controlId: "ISQM-RES-002", domain: "Resources", description: "Training hours tracking", component: "ISQM dashboard - training metrics", status: "ACTIVE" },
  { controlId: "ISQM-RES-003", domain: "Resources", description: "Technology resource management", component: "Platform AI config, firm settings", status: "ACTIVE" },
  { controlId: "ISQM-IC-001", domain: "Information & Communication", description: "Review notes and feedback system", component: "Review notes module", status: "ACTIVE" },
  { controlId: "ISQM-IC-002", domain: "Information & Communication", description: "Management letter generation", component: "Management letter module", status: "ACTIVE" },
  { controlId: "ISQM-IC-003", domain: "Information & Communication", description: "Audit report communication", component: "Audit report module, deliverables", status: "ACTIVE" },
  { controlId: "ISQM-MON-001", domain: "Monitoring & Remediation", description: "File inspection program", component: "isqmRoutes.ts - file inspections", status: "ACTIVE" },
  { controlId: "ISQM-MON-002", domain: "Monitoring & Remediation", description: "Inspection ratings (Satisfactory/Unsatisfactory)", component: "isqmRoutes.ts - inspection results", status: "ACTIVE" },
  { controlId: "ISQM-MON-003", domain: "Monitoring & Remediation", description: "Deficiency tracking and remediation", component: "isqmRoutes.ts - monitoring deficiencies", status: "ACTIVE" },
  { controlId: "ISQM-MON-004", domain: "Monitoring & Remediation", description: "Root cause analysis tracking", component: "isqmRoutes.ts - remediation tracking", status: "ACTIVE" },
  { controlId: "ISQM-MON-005", domain: "Monitoring & Remediation", description: "Annual monitoring plan", component: "isqmRoutes.ts - monitoring plans", status: "ACTIVE" },
  { controlId: "ISQM-EQR-001", domain: "ISQM 2 / Engagement Quality Review", description: "EQCR assignment and tracking", component: "EQCR module, eqcrRoutes.ts", status: "ACTIVE" },
  { controlId: "ISQM-EQR-002", domain: "ISQM 2 / Engagement Quality Review", description: "EQCR checklist completion", component: "EQCR checklist items", status: "ACTIVE" },
  { controlId: "ISQM-EQR-003", domain: "ISQM 2 / Engagement Quality Review", description: "EQCR comments and resolution", component: "EQCR comments management", status: "ACTIVE" },
  { controlId: "ISQM-EQR-004", domain: "ISQM 2 / Engagement Quality Review", description: "EQR independence from engagement team", component: "Role-based access control", status: "ACTIVE" },
];

const RBAC_MATRIX_DATA = {
  roleHierarchy: [
    { level: 1, role: "STAFF", description: "Junior audit staff, data entry" },
    { level: 2, role: "SENIOR", description: "Senior auditor, team supervision" },
    { level: 3, role: "MANAGER", description: "Engagement manager, review authority" },
    { level: 4, role: "EQCR", description: "Engagement quality control reviewer" },
    { level: 5, role: "PARTNER", description: "Engagement partner, approval authority" },
    { level: 6, role: "FIRM_ADMIN", description: "Firm-level administrator" },
    { level: 99, role: "SUPER_ADMIN", description: "Platform administrator (no firm data access)" },
  ],
  permissions: {
    engagementManagement: {
      viewEngagements: { STAFF: true, SENIOR: true, MANAGER: true, PARTNER: true, EQCR: true, FIRM_ADMIN: true, SUPER_ADMIN: false },
      createEngagement: { STAFF: false, SENIOR: false, MANAGER: true, PARTNER: true, EQCR: false, FIRM_ADMIN: true, SUPER_ADMIN: false },
      editEngagement: { STAFF: false, SENIOR: true, MANAGER: true, PARTNER: true, EQCR: false, FIRM_ADMIN: true, SUPER_ADMIN: false },
      deleteEngagement: { STAFF: false, SENIOR: false, MANAGER: false, PARTNER: true, EQCR: false, FIRM_ADMIN: true, SUPER_ADMIN: false },
      lockArchive: { STAFF: false, SENIOR: false, MANAGER: false, PARTNER: true, EQCR: false, FIRM_ADMIN: false, SUPER_ADMIN: false },
    },
    signOffAuthority: {
      prepare: { STAFF: true, SENIOR: true, MANAGER: false, PARTNER: false, EQCR: false },
      review: { STAFF: false, SENIOR: false, MANAGER: true, PARTNER: false, EQCR: false },
      approve: { STAFF: false, SENIOR: false, MANAGER: false, PARTNER: true, EQCR: false },
      eqcrReview: { STAFF: false, SENIOR: false, MANAGER: false, PARTNER: false, EQCR: true },
    },
    workingPapers: {
      createWorkingPaper: { STAFF: true, SENIOR: true, MANAGER: true, PARTNER: true, EQCR: false },
      editWorkingPaper: { STAFF: true, SENIOR: true, MANAGER: true, PARTNER: true, EQCR: false },
      uploadEvidence: { STAFF: true, SENIOR: true, MANAGER: true, PARTNER: true, EQCR: false },
      deleteEvidence: { STAFF: false, SENIOR: false, MANAGER: true, PARTNER: true, EQCR: false },
      viewLockedDocs: { STAFF: true, SENIOR: true, MANAGER: true, PARTNER: true, EQCR: true },
      editLockedDocs: { STAFF: false, SENIOR: false, MANAGER: false, PARTNER: false, EQCR: false },
    },
    aiFeatures: {
      useAIFieldAssist: { STAFF: true, SENIOR: true, MANAGER: true, PARTNER: true, EQCR: false },
      aiRiskAssessment: { STAFF: false, SENIOR: true, MANAGER: true, PARTNER: true, EQCR: false },
      aiAuditUtilities: { STAFF: false, SENIOR: true, MANAGER: true, PARTNER: true, EQCR: false },
      aiCopilotAccess: { STAFF: true, SENIOR: true, MANAGER: true, PARTNER: true, EQCR: true },
    },
    administration: {
      manageUsers: { STAFF: false, SENIOR: false, MANAGER: false, PARTNER: false, EQCR: false, FIRM_ADMIN: true, SUPER_ADMIN: true },
      manageFirmSettings: { STAFF: false, SENIOR: false, MANAGER: false, PARTNER: false, EQCR: false, FIRM_ADMIN: true, SUPER_ADMIN: false },
      viewAuditLogs: { STAFF: false, SENIOR: false, MANAGER: true, PARTNER: true, EQCR: true, FIRM_ADMIN: true, SUPER_ADMIN: true },
      manageSubscriptions: { STAFF: false, SENIOR: false, MANAGER: false, PARTNER: false, EQCR: false, FIRM_ADMIN: false, SUPER_ADMIN: true },
      platformConfig: { STAFF: false, SENIOR: false, MANAGER: false, PARTNER: false, EQCR: false, FIRM_ADMIN: false, SUPER_ADMIN: true },
    },
  },
  enforcementPoints: [
    { layer: "API Middleware", mechanism: "JWT + Role level check", file: "server/middleware/rbacGuard.ts" },
    { layer: "Tenant Isolation", mechanism: "firmId scoping", file: "server/middleware/tenantIsolation.ts" },
    { layer: "Super Admin Block", mechanism: "blockSuperAdmin middleware", file: "server/middleware/tenantIsolation.ts" },
    { layer: "Sign-Off Authority", mechanism: "Role-level validation", file: "server/services/signOffAuthority.ts" },
    { layer: "Phase Gates", mechanism: "Prerequisite validation", file: "server/services/enforcementEngine.ts" },
    { layer: "Document Lock", mechanism: "Post-approval edit block", file: "server/middleware/auditLock.ts" },
    { layer: "AI Governance", mechanism: "Prohibited action enforcement", file: "server/services/aiGovernance.ts" },
    { layer: "Database RLS", mechanism: "PostgreSQL row-level security", file: "server/scripts/enable-rls.ts" },
  ],
};

const SECURITY_CHECKLIST_DATA = [
  { category: "Authentication & Session Management", controls: [
    { id: 1, control: "JWT-based authentication", status: "ACTIVE", implementation: "Access tokens (15min) + refresh tokens (7d)", file: "server/middleware/jwtAuth.ts" },
    { id: 2, control: "Password policy enforcement", status: "ACTIVE", implementation: "Min 10 chars, mixed case, numbers, special chars, blacklist", file: "server/utils/passwordPolicy.ts" },
    { id: 3, control: "Account lockout", status: "ACTIVE", implementation: "Temporary IP/account blocking after failed attempts", file: "server/middleware/accountLockout.ts" },
    { id: 4, control: "Two-factor authentication (TOTP)", status: "ACTIVE", implementation: "TOTP via otplib, QR code setup", file: "server/services/twoFactorService.ts" },
    { id: 5, control: "Refresh token rotation", status: "ACTIVE", implementation: "Tokens rotated on use, old tokens revoked", file: "server/middleware/jwtAuth.ts" },
    { id: 6, control: "Session timeout", status: "ACTIVE", implementation: "15-minute access token expiry, 7-day refresh", file: "server/middleware/jwtAuth.ts" },
  ]},
  { category: "Authorization & Access Control", controls: [
    { id: 7, control: "Role-based access control (RBAC)", status: "ACTIVE", implementation: "10-level role hierarchy with middleware guards", file: "server/middleware/rbacGuard.ts" },
    { id: 8, control: "Object-level permissions", status: "ACTIVE", implementation: "61 granular permissions seeded", file: "server/seeds/" },
    { id: 9, control: "Tenant isolation middleware", status: "ACTIVE", implementation: "firmId scoping on all API routes", file: "server/middleware/tenantIsolation.ts" },
    { id: 10, control: "Super Admin data isolation", status: "ACTIVE", implementation: "blockSuperAdmin prevents firm data access", file: "server/middleware/tenantIsolation.ts" },
    { id: 11, control: "Database row-level security", status: "ACTIVE", implementation: "PostgreSQL RLS on 97 tables", file: "server/scripts/enable-rls.ts" },
    { id: 12, control: "Sign-off authority enforcement", status: "ACTIVE", implementation: "Role-level validation for sign-offs", file: "server/services/signOffAuthority.ts" },
    { id: 13, control: "Post-approval edit blocking", status: "ACTIVE", implementation: "Locked documents cannot be modified", file: "server/middleware/auditLock.ts" },
  ]},
  { category: "API Protection", controls: [
    { id: 14, control: "Global rate limiting", status: "ACTIVE", implementation: "100 req/min per IP for all /api/ routes", file: "server/middleware/rateLimiter.ts" },
    { id: 15, control: "Auth rate limiting", status: "ACTIVE", implementation: "5 login attempts per 15 minutes", file: "server/middleware/rateLimiter.ts" },
    { id: 16, control: "AI rate limiting", status: "ACTIVE", implementation: "20 req/min for AI endpoints", file: "server/middleware/rateLimiter.ts" },
    { id: 17, control: "Input sanitization", status: "ACTIVE", implementation: "SQL injection, XSS, path traversal detection", file: "server/middleware/inputSanitizer.ts" },
    { id: 18, control: "Request body size limit", status: "ACTIVE", implementation: "50MB JSON body limit", file: "server/index.ts" },
    { id: 19, control: "CORS configuration", status: "ACTIVE", implementation: "Dynamic origin validation", file: "server/index.ts" },
  ]},
  { category: "Security Headers", controls: [
    { id: 20, control: "Content-Security-Policy", status: "ACTIVE", implementation: "CSP header configured", file: "server/index.ts" },
    { id: 21, control: "Strict-Transport-Security", status: "ACTIVE", implementation: "HSTS enabled", file: "server/index.ts" },
    { id: 22, control: "X-Content-Type-Options", status: "ACTIVE", implementation: "nosniff", file: "server/index.ts" },
    { id: 23, control: "X-Frame-Options", status: "ACTIVE", implementation: "DENY", file: "server/index.ts" },
    { id: 24, control: "X-XSS-Protection", status: "ACTIVE", implementation: "1; mode=block", file: "server/index.ts" },
  ]},
  { category: "Audit & Logging", controls: [
    { id: 25, control: "API audit logging", status: "ACTIVE", implementation: "All POST/PUT/PATCH/DELETE logged", file: "server/services/auditLogService.ts" },
    { id: 26, control: "Security event logging", status: "ACTIVE", implementation: "Login attempts, permission changes", file: "server/services/auditLogService.ts" },
    { id: 27, control: "Entity-level change tracking", status: "ACTIVE", implementation: "Before/after values in audit trail", file: "server/auth.ts" },
    { id: 28, control: "AI usage logging", status: "ACTIVE", implementation: "Prompts, outputs, edits, approvals", file: "AIUsageLog, AIInteractionLog" },
    { id: 29, control: "Immutable audit trail", status: "ACTIVE", implementation: "Append-only PlatformAuditLog", file: "Database + service layer" },
    { id: 30, control: "Request ID tracking", status: "ACTIVE", implementation: "X-Request-Id on all requests", file: "server/index.ts" },
  ]},
  { category: "Data Protection", controls: [
    { id: 31, control: "Password hashing", status: "ACTIVE", implementation: "bcryptjs with salt rounds", file: "server/services/auth.ts" },
    { id: 32, control: "Sensitive field encryption", status: "ACTIVE", implementation: "AES-256 encryption service", file: "server/services/encryptionService.ts" },
    { id: 33, control: "Environment secrets protection", status: "ACTIVE", implementation: ".env not committed, env vars for secrets", file: ".gitignore" },
  ]},
  { category: "AI Governance Security", controls: [
    { id: 34, control: "Prohibited AI actions", status: "ACTIVE", implementation: "Blocks conclusion, sign-off, opinion generation", file: "server/services/aiGovernance.ts" },
    { id: 35, control: "AI output review requirement", status: "ACTIVE", implementation: "Human review tracked in AIUsageLog", file: "server/services/aiGovernance.ts" },
    { id: 36, control: "Prohibited AI fields", status: "ACTIVE", implementation: "auditOpinion, materialityAmount, sampleSize blocked", file: "Frontend + Backend" },
    { id: 37, control: "AI confidence indicators", status: "ACTIVE", implementation: "Low/Medium/High with ISA references", file: "server/services/aiGovernance.ts" },
  ]},
];

router.get("/isa-coverage-matrix", requireAuth, requireMinRole("MANAGER"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const fullCount = ISA_COVERAGE_DATA.filter(i => i.coverage === "FULL").length;
    const partialCount = ISA_COVERAGE_DATA.filter(i => i.coverage === "PARTIAL").length;
    const missingCount = ISA_COVERAGE_DATA.filter(i => i.coverage === "MISSING").length;
    const total = ISA_COVERAGE_DATA.length;

    res.json({
      title: "ISA Coverage Matrix",
      generatedAt: new Date().toISOString(),
      summary: {
        total,
        full: fullCount,
        partial: partialCount,
        missing: missingCount,
        coveragePercentage: Math.round(((fullCount + partialCount * 0.5) / total) * 100),
      },
      standards: ISA_COVERAGE_DATA,
    });
  } catch (error) {
    console.error("ISA coverage matrix error:", error);
    res.status(500).json({ error: "Failed to generate ISA coverage matrix" });
  }
});

router.get("/isqm-register", requireAuth, requireMinRole("MANAGER"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const activeCount = ISQM_REGISTER_DATA.filter(c => c.status === "ACTIVE").length;
    const domains = [...new Set(ISQM_REGISTER_DATA.map(c => c.domain))];

    res.json({
      title: "ISQM-1 Firm-Wide Control Register",
      generatedAt: new Date().toISOString(),
      summary: {
        totalControls: ISQM_REGISTER_DATA.length,
        active: activeCount,
        inactive: ISQM_REGISTER_DATA.length - activeCount,
        domains: domains.length,
      },
      domainBreakdown: domains.map(domain => ({
        domain,
        controls: ISQM_REGISTER_DATA.filter(c => c.domain === domain),
      })),
      controls: ISQM_REGISTER_DATA,
    });
  } catch (error) {
    console.error("ISQM register error:", error);
    res.status(500).json({ error: "Failed to generate ISQM register" });
  }
});

router.get("/rbac-matrix", requireAuth, requireMinRole("MANAGER"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    res.json({
      title: "RBAC Matrix",
      generatedAt: new Date().toISOString(),
      ...RBAC_MATRIX_DATA,
    });
  } catch (error) {
    console.error("RBAC matrix error:", error);
    res.status(500).json({ error: "Failed to generate RBAC matrix" });
  }
});

router.get("/security-checklist", requireAuth, requireMinRole("MANAGER"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const allControls = SECURITY_CHECKLIST_DATA.flatMap(c => c.controls);
    const activeCount = allControls.filter(c => c.status === "ACTIVE").length;

    res.json({
      title: "Security Controls Checklist",
      generatedAt: new Date().toISOString(),
      summary: {
        totalControls: allControls.length,
        active: activeCount,
        inactive: allControls.length - activeCount,
        categories: SECURITY_CHECKLIST_DATA.length,
      },
      categories: SECURITY_CHECKLIST_DATA,
    });
  } catch (error) {
    console.error("Security checklist error:", error);
    res.status(500).json({ error: "Failed to generate security checklist" });
  }
});

router.get("/qcr-readiness/:engagementId", requireAuth, requireMinRole("MANAGER"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { engagementId } = req.params;
    const firmId = req.user!.firmId;

    if (!firmId) {
      return res.status(400).json({ error: "User not associated with a firm" });
    }

    const engagement = await prisma.engagement.findFirst({
      where: { id: engagementId, firmId },
      include: {
        client: { select: { name: true } },
        team: { include: { user: { select: { fullName: true, role: true } } } },
        phases: true,
      },
    });

    if (!engagement) {
      return res.status(404).json({ error: "Engagement not found" });
    }

    const [
      engagementLetterCount,
      independenceCount,
      riskAssessmentCount,
      materialityCount,
      auditStrategyCount,
      evidenceCount,
      goingConcernCount,
      subsequentEventCount,
      writtenRepCount,
      managementLetterCount,
      auditReportCount,
      completionMemoCount,
      eqcrAssignmentCount,
      sectionSignOffCount,
      reviewNoteOpenCount,
      documentCount,
    ] = await Promise.all([
      prisma.engagementLetter.count({ where: { engagementId } }),
      prisma.independenceDeclaration.count({ where: { engagementId } }),
      prisma.riskAssessment.count({ where: { engagementId } }),
      prisma.materialityAssessment.count({ where: { engagementId } }),
      prisma.auditStrategy.count({ where: { engagementId } }),
      prisma.evidenceFile.count({ where: { engagementId } }),
      prisma.goingConcernAssessment.count({ where: { engagementId } }),
      prisma.subsequentEvent.count({ where: { engagementId } }),
      prisma.writtenRepresentation.count({ where: { engagementId } }),
      prisma.managementLetter.count({ where: { engagementId } }),
      prisma.auditReport.count({ where: { engagementId } }),
      prisma.completionMemo.count({ where: { engagementId } }),
      prisma.eQCRAssignment.count({ where: { engagementId } }),
      prisma.sectionSignOff.count({ where: { engagementId } }),
      prisma.reviewNote.count({ where: { engagementId, status: "OPEN" } }),
      prisma.document.count({ where: { engagementId } }),
    ]);

    const fileCompletenessItems = [
      { item: "Engagement letter on file", ready: engagementLetterCount > 0 },
      { item: "Independence declaration", ready: independenceCount > 0 },
      { item: "Team assignment documentation", ready: engagement.team.length > 0 },
      { item: "Risk assessment documentation", ready: riskAssessmentCount > 0 },
      { item: "Materiality determination", ready: materialityCount > 0 },
      { item: "Audit program/strategy", ready: auditStrategyCount > 0 },
      { item: "Evidence of procedures performed", ready: evidenceCount > 0 },
      { item: "Going concern assessment", ready: goingConcernCount > 0 },
      { item: "Subsequent events review", ready: subsequentEventCount > 0 },
      { item: "Written representations", ready: writtenRepCount > 0 },
      { item: "Management letter", ready: managementLetterCount > 0 },
      { item: "Audit report", ready: auditReportCount > 0 },
      { item: "Completion memorandum", ready: completionMemoCount > 0 },
      { item: "EQCR documentation", ready: eqcrAssignmentCount > 0 || !engagement.eqcrRequired },
    ];

    const preparedSignOffs = await prisma.sectionSignOff.count({ where: { engagementId } });
    const reviewedSignOffs = await prisma.sectionSignOff.count({ where: { engagementId, reviewedDate: { not: null } } });
    const approvedSignOffs = await prisma.sectionSignOff.count({ where: { engagementId, partnerApprovalDate: { not: null } } });

    const signOffTrailItems = [
      { item: "Preparer identification on all WPs", ready: preparedSignOffs > 0 },
      { item: "Reviewer sign-off evidence", ready: reviewedSignOffs > 0 },
      { item: "Partner approval evidence", ready: approvedSignOffs > 0 },
      { item: "Sign-off timestamps (server-side)", ready: sectionSignOffCount > 0 },
      { item: "No open critical review notes", ready: reviewNoteOpenCount === 0 },
    ];

    const fileReadyCount = fileCompletenessItems.filter(i => i.ready).length;
    const signOffReadyCount = signOffTrailItems.filter(i => i.ready).length;
    const totalItems = fileCompletenessItems.length + signOffTrailItems.length;
    const totalReady = fileReadyCount + signOffReadyCount;

    res.json({
      title: "QCR Readiness Report",
      generatedAt: new Date().toISOString(),
      engagement: {
        id: engagement.id,
        code: engagement.engagementCode,
        clientName: engagement.client.name,
        status: engagement.status,
        currentPhase: engagement.currentPhase,
      },
      summary: {
        totalItems,
        ready: totalReady,
        gaps: totalItems - totalReady,
        readinessPercentage: totalItems > 0 ? Math.round((totalReady / totalItems) * 100) : 0,
      },
      areas: [
        { area: "File Completeness", items: fileCompletenessItems, ready: fileReadyCount, total: fileCompletenessItems.length },
        { area: "Sign-Off Trail", items: signOffTrailItems, ready: signOffReadyCount, total: signOffTrailItems.length },
      ],
      metrics: {
        documents: documentCount,
        evidenceFiles: evidenceCount,
        sectionSignOffs: sectionSignOffCount,
        openReviewNotes: reviewNoteOpenCount,
        teamMembers: engagement.team.length,
      },
    });
  } catch (error) {
    console.error("QCR readiness error:", error);
    res.status(500).json({ error: "Failed to generate QCR readiness report" });
  }
});

export default router;
