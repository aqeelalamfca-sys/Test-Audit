import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, boolean, integer, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const UserRole = {
  STAFF: "staff",
  SENIOR: "senior",
  MANAGER: "manager",
  PARTNER: "partner",
  EQCR: "eqcr",
  ADMIN: "admin",
} as const;

export type UserRoleType = typeof UserRole[keyof typeof UserRole];

export const AuditPhase = {
  ONBOARDING: "onboarding",
  PRE_PLANNING: "pre_planning",
  PLANNING: "planning",
  EXECUTION: "execution",
  FINALIZATION: "finalization",
  REPORTING: "reporting",
  EQCR: "eqcr",
  INSPECTION: "inspection",
} as const;

export type AuditPhaseType = typeof AuditPhase[keyof typeof AuditPhase];

export const PhaseStatus = {
  NOT_STARTED: "not_started",
  IN_PROGRESS: "in_progress",
  UNDER_REVIEW: "under_review",
  COMPLETED: "completed",
  LOCKED: "locked",
} as const;

export type PhaseStatusType = typeof PhaseStatus[keyof typeof PhaseStatus];

export const ChecklistItemStatus = {
  PENDING: "pending",
  IN_PROGRESS: "in_progress",
  COMPLETED: "completed",
  NOT_APPLICABLE: "not_applicable",
} as const;

export type ChecklistItemStatusType = typeof ChecklistItemStatus[keyof typeof ChecklistItemStatus];

export const RiskLevel = {
  LOW: "low",
  MEDIUM: "medium",
  HIGH: "high",
} as const;

export type RiskLevelType = typeof RiskLevel[keyof typeof RiskLevel];

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  fullName: text("full_name").notNull(),
  role: text("role").notNull().default("staff"),
  email: text("email"),
});

export const engagements = pgTable("engagements", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientName: text("client_name").notNull(),
  secpNo: text("secp_no"),
  ntn: text("ntn"),
  strn: text("strn"),
  entityType: text("entity_type"),
  industry: text("industry"),
  fiscalYearEnd: text("fiscal_year_end"),
  currentPhase: text("current_phase").notNull().default("onboarding"),
  riskRating: text("risk_rating").default("medium"),
  engagementPartnerId: varchar("engagement_partner_id"),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const phaseProgress = pgTable("phase_progress", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  engagementId: varchar("engagement_id").notNull(),
  phase: text("phase").notNull(),
  status: text("status").notNull().default("not_started"),
  completionPercentage: integer("completion_percentage").default(0),
  lockedAt: timestamp("locked_at"),
  lockedBy: varchar("locked_by"),
});

export const checklistItems = pgTable("checklist_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  engagementId: varchar("engagement_id").notNull(),
  phase: text("phase").notNull(),
  section: text("section").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  isaReference: text("isa_reference"),
  status: text("status").notNull().default("pending"),
  assignedTo: varchar("assigned_to"),
  completedBy: varchar("completed_by"),
  completedAt: timestamp("completed_at"),
  notes: text("notes"),
  orderIndex: integer("order_index").default(0),
});

export const auditTrail = pgTable("audit_trail", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  engagementId: varchar("engagement_id"),
  userId: varchar("user_id").notNull(),
  action: text("action").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: varchar("entity_id"),
  beforeValue: jsonb("before_value"),
  afterValue: jsonb("after_value"),
  justification: text("justification"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const reviewNotes = pgTable("review_notes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  engagementId: varchar("engagement_id").notNull(),
  phase: text("phase").notNull(),
  checklistItemId: varchar("checklist_item_id"),
  authorId: varchar("author_id").notNull(),
  content: text("content").notNull(),
  severity: text("severity").default("info"),
  status: text("status").notNull().default("open"),
  resolvedBy: varchar("resolved_by"),
  resolvedAt: timestamp("resolved_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const documents = pgTable("documents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  engagementId: varchar("engagement_id").notNull(),
  phase: text("phase").notNull(),
  name: text("name").notNull(),
  type: text("type").notNull(),
  path: text("path").notNull(),
  tags: text("tags").array(),
  uploadedBy: varchar("uploaded_by").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const guideIssues = pgTable("guide_issues", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  moduleKey: text("module_key").notNull(),
  pageKey: text("page_key"),
  title: text("title").notNull(),
  description: text("description").notNull(),
  status: text("status").notNull().default("open"),
  createdBy: varchar("created_by").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertGuideIssueSchema = createInsertSchema(guideIssues).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertGuideIssue = z.infer<typeof insertGuideIssueSchema>;
export type GuideIssue = typeof guideIssues.$inferSelect;

export const insertUserSchema = createInsertSchema(users).omit({ id: true });
export const insertEngagementSchema = createInsertSchema(engagements).omit({ id: true, createdAt: true });
export const insertPhaseProgressSchema = createInsertSchema(phaseProgress).omit({ id: true });
export const insertChecklistItemSchema = createInsertSchema(checklistItems).omit({ id: true });
export const insertAuditTrailSchema = createInsertSchema(auditTrail).omit({ id: true, createdAt: true });
export const insertReviewNoteSchema = createInsertSchema(reviewNotes).omit({ id: true, createdAt: true });
export const insertDocumentSchema = createInsertSchema(documents).omit({ id: true, createdAt: true });

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export type InsertEngagement = z.infer<typeof insertEngagementSchema>;
export type Engagement = typeof engagements.$inferSelect;

export type InsertPhaseProgress = z.infer<typeof insertPhaseProgressSchema>;
export type PhaseProgress = typeof phaseProgress.$inferSelect;

export type InsertChecklistItem = z.infer<typeof insertChecklistItemSchema>;
export type ChecklistItem = typeof checklistItems.$inferSelect;

export type InsertAuditTrail = z.infer<typeof insertAuditTrailSchema>;
export type AuditTrail = typeof auditTrail.$inferSelect;

export type InsertReviewNote = z.infer<typeof insertReviewNoteSchema>;
export type ReviewNote = typeof reviewNotes.$inferSelect;

export type InsertDocument = z.infer<typeof insertDocumentSchema>;
export type Document = typeof documents.$inferSelect;

export const PHASE_ORDER: AuditPhaseType[] = [
  "onboarding",
  "pre_planning",
  "planning",
  "execution",
  "finalization",
  "reporting",
  "eqcr",
  "inspection",
];

export const PHASE_LABELS: Record<AuditPhaseType, string> = {
  onboarding: "Client Onboarding",
  pre_planning: "Pre-Planning",
  planning: "Planning",
  execution: "Execution",
  finalization: "Finalization",
  reporting: "Reporting",
  eqcr: "EQCR Review",
  inspection: "Inspection Mode",
};
