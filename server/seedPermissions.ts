import { prisma } from "./db";

interface PermissionDef {
  code: string;
  name: string;
  description: string;
  category: "SYSTEM" | "ENGAGEMENT" | "CLIENT" | "PLANNING" | "EXECUTION" | "FINALIZATION" | "QUALITY_CONTROL" | "REPORTING" | "ADMINISTRATION";
}

const permissions: PermissionDef[] = [
  { code: "SYSTEM_FULL_ACCESS", name: "Full System Access", description: "Complete access to all system functions", category: "SYSTEM" },
  { code: "SYSTEM_VIEW_DASHBOARD", name: "View Dashboard", description: "Access to main dashboard", category: "SYSTEM" },
  { code: "SYSTEM_VIEW_REPORTS", name: "View System Reports", description: "Access practice-wide reports and analytics", category: "SYSTEM" },
  
  { code: "USER_MANAGE", name: "Manage Users", description: "Create, edit, deactivate users", category: "ADMINISTRATION" },
  { code: "USER_VIEW", name: "View Users", description: "View user list and details", category: "ADMINISTRATION" },
  { code: "ROLE_MANAGE", name: "Manage Roles & Permissions", description: "Edit role permissions and user overrides", category: "ADMINISTRATION" },
  { code: "FIRM_SETTINGS_MANAGE", name: "Manage Firm Settings", description: "Configure firm-wide settings", category: "ADMINISTRATION" },
  { code: "MASTER_DATA_MANAGE", name: "Manage Master Data", description: "Configure dropdown values, templates, etc.", category: "ADMINISTRATION" },
  
  { code: "CLIENT_CREATE", name: "Create Clients", description: "Add new clients to the system", category: "CLIENT" },
  { code: "CLIENT_EDIT", name: "Edit Clients", description: "Modify client information", category: "CLIENT" },
  { code: "CLIENT_VIEW", name: "View Clients", description: "Access client details", category: "CLIENT" },
  { code: "CLIENT_DELETE", name: "Delete Clients", description: "Remove clients from system", category: "CLIENT" },
  { code: "CLIENT_ACCEPT", name: "Accept/Decline Clients", description: "Approve client acceptance decisions", category: "CLIENT" },
  { code: "CLIENT_KYC_MANAGE", name: "Manage Client KYC", description: "Upload and verify KYC documents", category: "CLIENT" },
  
  { code: "ENGAGEMENT_CREATE", name: "Create Engagements", description: "Initiate new audit engagements", category: "ENGAGEMENT" },
  { code: "ENGAGEMENT_EDIT", name: "Edit Engagements", description: "Modify engagement details", category: "ENGAGEMENT" },
  { code: "ENGAGEMENT_VIEW", name: "View Engagements", description: "Access engagement information", category: "ENGAGEMENT" },
  { code: "ENGAGEMENT_DELETE", name: "Delete Engagements", description: "Remove engagements", category: "ENGAGEMENT" },
  { code: "ENGAGEMENT_APPROVE", name: "Approve Engagements", description: "Final approval for engagement acceptance", category: "ENGAGEMENT" },
  { code: "ENGAGEMENT_TEAM_ASSIGN", name: "Assign Team Members", description: "Assign staff to engagements", category: "ENGAGEMENT" },
  { code: "ENGAGEMENT_SIGN_OFF", name: "Sign Off Engagements", description: "Final sign-off authority", category: "ENGAGEMENT" },
  
  { code: "PLANNING_VIEW", name: "View Planning", description: "Access planning phase documents", category: "PLANNING" },
  { code: "PLANNING_PREPARE", name: "Prepare Planning Documents", description: "Create and edit planning workpapers", category: "PLANNING" },
  { code: "PLANNING_REVIEW", name: "Review Planning", description: "Review and provide feedback on planning", category: "PLANNING" },
  { code: "PLANNING_APPROVE", name: "Approve Planning", description: "Final planning phase approval", category: "PLANNING" },
  { code: "PLANNING_LOCK", name: "Lock Planning Phase", description: "Lock planning phase for execution", category: "PLANNING" },
  { code: "MATERIALITY_SET", name: "Set Materiality", description: "Define materiality thresholds", category: "PLANNING" },
  { code: "RISK_ASSESS", name: "Perform Risk Assessment", description: "Conduct and document risk assessments", category: "PLANNING" },
  { code: "STRATEGY_DEVELOP", name: "Develop Audit Strategy", description: "Create audit strategy and approach", category: "PLANNING" },
  
  { code: "EXECUTION_VIEW", name: "View Execution", description: "Access execution phase workpapers", category: "EXECUTION" },
  { code: "EXECUTION_PREPARE", name: "Prepare Workpapers", description: "Complete audit procedures and workpapers", category: "EXECUTION" },
  { code: "EXECUTION_INITIAL_REVIEW", name: "Initial Review", description: "First-level review of workpapers", category: "EXECUTION" },
  { code: "EXECUTION_MANAGER_REVIEW", name: "Manager Review", description: "Manager-level review and supervision", category: "EXECUTION" },
  { code: "EXECUTION_PARTNER_REVIEW", name: "Partner Review", description: "Partner-level review", category: "EXECUTION" },
  { code: "EXECUTION_APPROVE", name: "Approve Execution", description: "Final execution phase approval", category: "EXECUTION" },
  { code: "EXECUTION_LOCK", name: "Lock Execution Phase", description: "Lock execution for finalization", category: "EXECUTION" },
  { code: "CONTROLS_TEST", name: "Test Controls", description: "Perform controls testing", category: "EXECUTION" },
  { code: "SUBSTANTIVE_TEST", name: "Perform Substantive Tests", description: "Execute substantive audit procedures", category: "EXECUTION" },
  { code: "TASK_ASSIGN", name: "Assign Tasks", description: "Assign audit tasks to team members", category: "EXECUTION" },
  
  { code: "FINALIZATION_VIEW", name: "View Finalization", description: "Access finalization documents", category: "FINALIZATION" },
  { code: "FINALIZATION_PREPARE", name: "Prepare Finalization", description: "Complete finalization procedures", category: "FINALIZATION" },
  { code: "FINALIZATION_REVIEW", name: "Review Finalization", description: "Review finalization workpapers", category: "FINALIZATION" },
  { code: "FINALIZATION_APPROVE", name: "Approve Finalization", description: "Final finalization approval", category: "FINALIZATION" },
  { code: "FINALIZATION_LOCK", name: "Lock File", description: "Lock audit file permanently", category: "FINALIZATION" },
  { code: "OPINION_SELECT", name: "Select Audit Opinion", description: "Choose audit opinion type", category: "FINALIZATION" },
  { code: "REPORT_SIGN", name: "Sign Audit Report", description: "Final signature authority on reports", category: "FINALIZATION" },
  
  { code: "QC_VIEW", name: "View Quality Control", description: "Access QC documentation", category: "QUALITY_CONTROL" },
  { code: "QC_MANAGE", name: "Manage Quality Control", description: "Configure QC policies", category: "QUALITY_CONTROL" },
  { code: "EQCR_PERFORM", name: "Perform EQCR", description: "Conduct engagement quality control review", category: "QUALITY_CONTROL" },
  { code: "EQCR_COMMENT", name: "EQCR Comments", description: "Raise and respond to EQCR comments", category: "QUALITY_CONTROL" },
  { code: "EQCR_CHALLENGE", name: "Challenge Conclusions", description: "Challenge audit conclusions as EQCR", category: "QUALITY_CONTROL" },
  { code: "ISQM_VIEW", name: "View ISQM Controls", description: "Access firm-wide quality controls", category: "QUALITY_CONTROL" },
  { code: "ISQM_MANAGE", name: "Manage ISQM Controls", description: "Configure ISQM 1/2 framework", category: "QUALITY_CONTROL" },
  { code: "INDEPENDENCE_DECLARE", name: "Submit Independence Declaration", description: "Submit personal independence declarations", category: "QUALITY_CONTROL" },
  { code: "INDEPENDENCE_REVIEW", name: "Review Independence", description: "Review team independence declarations", category: "QUALITY_CONTROL" },
  
  { code: "REPORT_VIEW", name: "View Reports", description: "Access generated reports", category: "REPORTING" },
  { code: "REPORT_GENERATE", name: "Generate Reports", description: "Create audit and management reports", category: "REPORTING" },
  { code: "REPORT_EDIT", name: "Edit Reports", description: "Modify report content", category: "REPORTING" },
  { code: "REPORT_FINALIZE", name: "Finalize Reports", description: "Mark reports as final", category: "REPORTING" },
  { code: "PORTFOLIO_VIEW", name: "View Portfolio Reports", description: "Access practice-wide portfolio reporting", category: "REPORTING" },
  { code: "ANALYTICS_VIEW", name: "View Analytics", description: "Access audit analytics and dashboards", category: "REPORTING" },
];

type RoleKey = "FIRM_ADMIN" | "PARTNER" | "EQCR" | "MANAGER" | "SENIOR" | "STAFF";

const rolePermissions: Record<RoleKey, string[]> = {
  FIRM_ADMIN: permissions.map(p => p.code),
  
  PARTNER: [
    "SYSTEM_VIEW_DASHBOARD", "SYSTEM_VIEW_REPORTS",
    "USER_VIEW",
    "CLIENT_VIEW", "CLIENT_EDIT", "CLIENT_ACCEPT", "CLIENT_KYC_MANAGE",
    "ENGAGEMENT_VIEW", "ENGAGEMENT_EDIT", "ENGAGEMENT_APPROVE", "ENGAGEMENT_TEAM_ASSIGN", "ENGAGEMENT_SIGN_OFF",
    "PLANNING_VIEW", "PLANNING_REVIEW", "PLANNING_APPROVE", "PLANNING_LOCK", "MATERIALITY_SET", "RISK_ASSESS", "STRATEGY_DEVELOP",
    "EXECUTION_VIEW", "EXECUTION_PARTNER_REVIEW", "EXECUTION_APPROVE", "EXECUTION_LOCK",
    "FINALIZATION_VIEW", "FINALIZATION_REVIEW", "FINALIZATION_APPROVE", "FINALIZATION_LOCK", "OPINION_SELECT", "REPORT_SIGN",
    "QC_VIEW", "ISQM_VIEW", "ISQM_MANAGE", "INDEPENDENCE_REVIEW",
    "REPORT_VIEW", "REPORT_GENERATE", "REPORT_EDIT", "REPORT_FINALIZE", "PORTFOLIO_VIEW", "ANALYTICS_VIEW",
  ],
  
  EQCR: [
    "SYSTEM_VIEW_DASHBOARD",
    "CLIENT_VIEW",
    "ENGAGEMENT_VIEW",
    "PLANNING_VIEW",
    "EXECUTION_VIEW",
    "FINALIZATION_VIEW",
    "QC_VIEW", "EQCR_PERFORM", "EQCR_COMMENT", "EQCR_CHALLENGE", "ISQM_VIEW",
    "REPORT_VIEW",
    "INDEPENDENCE_DECLARE",
  ],
  
  MANAGER: [
    "SYSTEM_VIEW_DASHBOARD",
    "USER_VIEW",
    "CLIENT_VIEW", "CLIENT_EDIT", "CLIENT_KYC_MANAGE",
    "ENGAGEMENT_VIEW", "ENGAGEMENT_EDIT", "ENGAGEMENT_TEAM_ASSIGN",
    "PLANNING_VIEW", "PLANNING_PREPARE", "PLANNING_REVIEW", "MATERIALITY_SET", "RISK_ASSESS", "STRATEGY_DEVELOP",
    "EXECUTION_VIEW", "EXECUTION_PREPARE", "EXECUTION_MANAGER_REVIEW", "CONTROLS_TEST", "SUBSTANTIVE_TEST", "TASK_ASSIGN",
    "FINALIZATION_VIEW", "FINALIZATION_PREPARE", "FINALIZATION_REVIEW",
    "QC_VIEW", "ISQM_VIEW", "INDEPENDENCE_DECLARE", "INDEPENDENCE_REVIEW",
    "REPORT_VIEW", "REPORT_GENERATE", "REPORT_EDIT", "ANALYTICS_VIEW",
  ],
  
  SENIOR: [
    "SYSTEM_VIEW_DASHBOARD",
    "CLIENT_VIEW",
    "ENGAGEMENT_VIEW",
    "PLANNING_VIEW", "PLANNING_PREPARE",
    "EXECUTION_VIEW", "EXECUTION_PREPARE", "EXECUTION_INITIAL_REVIEW", "CONTROLS_TEST", "SUBSTANTIVE_TEST", "TASK_ASSIGN",
    "FINALIZATION_VIEW", "FINALIZATION_PREPARE",
    "QC_VIEW", "INDEPENDENCE_DECLARE",
    "REPORT_VIEW",
  ],
  
  STAFF: [
    "SYSTEM_VIEW_DASHBOARD",
    "CLIENT_VIEW",
    "ENGAGEMENT_VIEW",
    "PLANNING_VIEW",
    "EXECUTION_VIEW", "EXECUTION_PREPARE", "CONTROLS_TEST", "SUBSTANTIVE_TEST",
    "FINALIZATION_VIEW",
    "QC_VIEW", "INDEPENDENCE_DECLARE",
    "REPORT_VIEW",
  ],
};

export async function seedPermissions(): Promise<void> {
  console.log("Seeding permissions...");
  
  for (const perm of permissions) {
    await prisma.permission.upsert({
      where: { code: perm.code },
      update: { name: perm.name, description: perm.description, category: perm.category },
      create: perm,
    });
  }
  console.log(`Created/updated ${permissions.length} permissions`);
  
  const allPermissions = await prisma.permission.findMany();
  const permissionMap = new Map(allPermissions.map(p => [p.code, p.id]));
  
  for (const [role, permCodes] of Object.entries(rolePermissions)) {
    for (const code of permCodes) {
      const permissionId = permissionMap.get(code);
      if (!permissionId) {
        console.warn(`Permission ${code} not found for role ${role}`);
        continue;
      }
      
      const existing = await prisma.rolePermission.findFirst({
        where: { role: role as any, permissionId, firmId: null },
      });
      
      if (!existing) {
        await prisma.rolePermission.create({
          data: { role: role as any, permissionId, isGranted: true },
        });
      }
    }
  }
  console.log("Role permissions assigned");
}

export async function getUserEffectivePermissions(userId: string): Promise<string[]> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, firmId: true },
  });
  
  if (!user) return [];
  
  const rolePerms = await prisma.rolePermission.findMany({
    where: {
      role: user.role,
      OR: [{ firmId: null }, { firmId: user.firmId }],
      isGranted: true,
    },
    include: { permission: true },
  });
  
  const overrides = await prisma.userPermissionOverride.findMany({
    where: {
      userId,
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
    include: { permission: true },
  });
  
  const permissionSet = new Set<string>();
  
  for (const rp of rolePerms) {
    if (rp.permission.isActive) {
      permissionSet.add(rp.permission.code);
    }
  }
  
  for (const override of overrides) {
    if (override.isGranted) {
      permissionSet.add(override.permission.code);
    } else {
      permissionSet.delete(override.permission.code);
    }
  }
  
  return Array.from(permissionSet);
}

export async function hasPermission(userId: string, permissionCode: string): Promise<boolean> {
  const permissions = await getUserEffectivePermissions(userId);
  return permissions.includes(permissionCode) || permissions.includes("SYSTEM_FULL_ACCESS");
}
