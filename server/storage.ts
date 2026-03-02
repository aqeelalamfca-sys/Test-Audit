import {
  type User,
  type InsertUser,
  type Engagement,
  type InsertEngagement,
  type PhaseProgress,
  type InsertPhaseProgress,
  type ChecklistItem,
  type InsertChecklistItem,
  type AuditTrail,
  type InsertAuditTrail,
  type ReviewNote,
  type InsertReviewNote,
  type Document,
  type InsertDocument,
  type GuideIssue,
  type InsertGuideIssue,
  PHASE_ORDER,
} from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  getEngagements(): Promise<Engagement[]>;
  getEngagement(id: string): Promise<Engagement | undefined>;
  createEngagement(engagement: InsertEngagement): Promise<Engagement>;
  updateEngagement(id: string, updates: Partial<InsertEngagement>): Promise<Engagement | undefined>;

  getPhaseProgress(engagementId: string): Promise<PhaseProgress[]>;
  updatePhaseProgress(id: string, updates: Partial<InsertPhaseProgress>): Promise<PhaseProgress | undefined>;
  createPhaseProgress(progress: InsertPhaseProgress): Promise<PhaseProgress>;

  getChecklistItems(engagementId: string, phase?: string): Promise<ChecklistItem[]>;
  getChecklistItem(id: string): Promise<ChecklistItem | undefined>;
  createChecklistItem(item: InsertChecklistItem): Promise<ChecklistItem>;
  updateChecklistItem(id: string, updates: Partial<InsertChecklistItem>): Promise<ChecklistItem | undefined>;

  getAuditTrail(engagementId?: string): Promise<AuditTrail[]>;
  createAuditTrailEntry(entry: InsertAuditTrail): Promise<AuditTrail>;

  getReviewNotes(engagementId: string, phase?: string): Promise<ReviewNote[]>;
  createReviewNote(note: InsertReviewNote): Promise<ReviewNote>;
  updateReviewNote(id: string, updates: Partial<InsertReviewNote>): Promise<ReviewNote | undefined>;

  getDocuments(engagementId: string, phase?: string): Promise<Document[]>;
  createDocument(doc: InsertDocument): Promise<Document>;

  getGuideIssues(): Promise<GuideIssue[]>;
  createGuideIssue(issue: InsertGuideIssue): Promise<GuideIssue>;
  updateGuideIssue(id: string, updates: Partial<InsertGuideIssue>): Promise<GuideIssue | undefined>;
  deleteGuideIssue(id: string): Promise<void>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private engagements: Map<string, Engagement>;
  private phaseProgress: Map<string, PhaseProgress>;
  private checklistItems: Map<string, ChecklistItem>;
  private auditTrail: Map<string, AuditTrail>;
  private reviewNotes: Map<string, ReviewNote>;
  private documents: Map<string, Document>;
  private guideIssues: Map<string, GuideIssue>;

  constructor() {
    this.users = new Map();
    this.engagements = new Map();
    this.phaseProgress = new Map();
    this.checklistItems = new Map();
    this.auditTrail = new Map();
    this.reviewNotes = new Map();
    this.documents = new Map();
    this.guideIssues = new Map();

    this.seedData();
  }

  private seedData() {
    const defaultUser: User = {
      id: "user-1",
      username: "johndoe",
      password: "hashed",
      fullName: "John Doe",
      role: "partner",
      email: "john.doe@auditwise.com",
    };
    this.users.set(defaultUser.id, defaultUser);

    const sampleEngagements: Engagement[] = [
      {
        id: "eng-1",
        clientName: "ABC Corporation Ltd",
        secpNo: "0123456",
        ntn: "1234567-8",
        strn: "12-34-5678-901-23",
        entityType: "private_limited",
        industry: "Manufacturing",
        fiscalYearEnd: "2024-12-31",
        currentPhase: "pre_planning",
        riskRating: "medium",
        engagementPartnerId: "user-1",
        status: "active",
        createdAt: new Date(),
      },
      {
        id: "eng-2",
        clientName: "XYZ Industries",
        secpNo: "0987654",
        ntn: "8765432-1",
        strn: "23-45-6789-012-34",
        entityType: "public_limited",
        industry: "Technology",
        fiscalYearEnd: "2024-06-30",
        currentPhase: "execution",
        riskRating: "high",
        engagementPartnerId: "user-1",
        status: "active",
        createdAt: new Date(),
      },
      {
        id: "eng-3",
        clientName: "Tech Solutions Ltd",
        secpNo: "1122334",
        ntn: "5544332-1",
        strn: "34-56-7890-123-45",
        entityType: "private_limited",
        industry: "Services",
        fiscalYearEnd: "2024-12-31",
        currentPhase: "onboarding",
        riskRating: "low",
        engagementPartnerId: "user-1",
        status: "active",
        createdAt: new Date(),
      },
    ];

    sampleEngagements.forEach((eng) => {
      this.engagements.set(eng.id, eng);

      PHASE_ORDER.forEach((phase, index) => {
        const phaseProgressId = `${eng.id}-${phase}`;
        let status = "not_started";
        let percentage = 0;

        const currentPhaseIndex = PHASE_ORDER.indexOf(eng.currentPhase as any);
        if (index < currentPhaseIndex) {
          status = "completed";
          percentage = 100;
        } else if (index === currentPhaseIndex) {
          status = "in_progress";
          percentage = Math.floor(Math.random() * 60) + 20;
        }

        this.phaseProgress.set(phaseProgressId, {
          id: phaseProgressId,
          engagementId: eng.id,
          phase,
          status,
          completionPercentage: percentage,
          lockedAt: status === "completed" ? new Date() : null,
          lockedBy: status === "completed" ? "user-1" : null,
        });
      });
    });
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = {
      ...insertUser,
      id,
      role: insertUser.role ?? "staff",
      email: insertUser.email ?? null,
    };
    this.users.set(id, user);
    return user;
  }

  async getEngagements(): Promise<Engagement[]> {
    return Array.from(this.engagements.values()).sort(
      (a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0)
    );
  }

  async getEngagement(id: string): Promise<Engagement | undefined> {
    return this.engagements.get(id);
  }

  async createEngagement(insertEngagement: InsertEngagement): Promise<Engagement> {
    const id = randomUUID();
    const engagement: Engagement = {
      ...insertEngagement,
      id,
      secpNo: insertEngagement.secpNo ?? null,
      ntn: insertEngagement.ntn ?? null,
      strn: insertEngagement.strn ?? null,
      entityType: insertEngagement.entityType ?? null,
      industry: insertEngagement.industry ?? null,
      fiscalYearEnd: insertEngagement.fiscalYearEnd ?? null,
      currentPhase: insertEngagement.currentPhase || "onboarding",
      riskRating: insertEngagement.riskRating || "medium",
      engagementPartnerId: insertEngagement.engagementPartnerId ?? null,
      status: insertEngagement.status || "active",
      createdAt: new Date(),
    };
    this.engagements.set(id, engagement);

    PHASE_ORDER.forEach((phase) => {
      const phaseProgressId = `${id}-${phase}`;
      this.phaseProgress.set(phaseProgressId, {
        id: phaseProgressId,
        engagementId: id,
        phase,
        status: phase === "onboarding" ? "in_progress" : "not_started",
        completionPercentage: 0,
        lockedAt: null,
        lockedBy: null,
      });
    });

    return engagement;
  }

  async updateEngagement(
    id: string,
    updates: Partial<InsertEngagement>
  ): Promise<Engagement | undefined> {
    const existing = this.engagements.get(id);
    if (!existing) return undefined;

    const updated: Engagement = { ...existing, ...updates };
    this.engagements.set(id, updated);
    return updated;
  }

  async getPhaseProgress(engagementId: string): Promise<PhaseProgress[]> {
    return Array.from(this.phaseProgress.values()).filter(
      (p) => p.engagementId === engagementId
    );
  }

  async updatePhaseProgress(
    id: string,
    updates: Partial<InsertPhaseProgress>
  ): Promise<PhaseProgress | undefined> {
    const existing = this.phaseProgress.get(id);
    if (!existing) return undefined;

    const updated: PhaseProgress = { ...existing, ...updates };
    this.phaseProgress.set(id, updated);
    return updated;
  }

  async createPhaseProgress(progress: InsertPhaseProgress): Promise<PhaseProgress> {
    const id = randomUUID();
    const newProgress: PhaseProgress = {
      ...progress,
      id,
      status: progress.status ?? "not_started",
      completionPercentage: progress.completionPercentage ?? 0,
      lockedAt: progress.lockedAt ?? null,
      lockedBy: progress.lockedBy ?? null,
    };
    this.phaseProgress.set(id, newProgress);
    return newProgress;
  }

  async getChecklistItems(
    engagementId: string,
    phase?: string
  ): Promise<ChecklistItem[]> {
    return Array.from(this.checklistItems.values())
      .filter(
        (item) =>
          item.engagementId === engagementId &&
          (!phase || item.phase === phase)
      )
      .sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0));
  }

  async getChecklistItem(id: string): Promise<ChecklistItem | undefined> {
    return this.checklistItems.get(id);
  }

  async createChecklistItem(item: InsertChecklistItem): Promise<ChecklistItem> {
    const id = randomUUID();
    const newItem: ChecklistItem = {
      ...item,
      id,
      status: item.status || "pending",
      description: item.description ?? null,
      isaReference: item.isaReference ?? null,
      assignedTo: item.assignedTo ?? null,
      completedBy: item.completedBy ?? null,
      notes: item.notes ?? null,
      orderIndex: item.orderIndex ?? 0,
      completedAt: item.completedAt ?? null,
    };
    this.checklistItems.set(id, newItem);
    return newItem;
  }

  async updateChecklistItem(
    id: string,
    updates: Partial<InsertChecklistItem>
  ): Promise<ChecklistItem | undefined> {
    const existing = this.checklistItems.get(id);
    if (!existing) return undefined;

    const updated: ChecklistItem = {
      ...existing,
      ...updates,
      completedAt:
        updates.status === "completed" ? new Date() : existing.completedAt,
    };
    this.checklistItems.set(id, updated);
    return updated;
  }

  async getAuditTrail(engagementId?: string): Promise<AuditTrail[]> {
    const entries = Array.from(this.auditTrail.values());
    if (engagementId) {
      return entries
        .filter((e) => e.engagementId === engagementId)
        .sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0));
    }
    return entries.sort(
      (a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0)
    );
  }

  async createAuditTrailEntry(entry: InsertAuditTrail): Promise<AuditTrail> {
    const id = randomUUID();
    const newEntry: AuditTrail = {
      ...entry,
      id,
      engagementId: entry.engagementId ?? null,
      entityId: entry.entityId ?? null,
      beforeValue: entry.beforeValue ?? null,
      afterValue: entry.afterValue ?? null,
      justification: entry.justification ?? null,
      createdAt: new Date(),
    };
    this.auditTrail.set(id, newEntry);
    return newEntry;
  }

  async getReviewNotes(engagementId: string, phase?: string): Promise<ReviewNote[]> {
    return Array.from(this.reviewNotes.values())
      .filter(
        (note) =>
          note.engagementId === engagementId && (!phase || note.phase === phase)
      )
      .sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0));
  }

  async createReviewNote(note: InsertReviewNote): Promise<ReviewNote> {
    const id = randomUUID();
    const newNote: ReviewNote = {
      ...note,
      id,
      status: note.status || "open",
      checklistItemId: note.checklistItemId ?? null,
      severity: note.severity || "info",
      resolvedBy: note.resolvedBy ?? null,
      resolvedAt: note.resolvedAt ?? null,
      createdAt: new Date(),
    };
    this.reviewNotes.set(id, newNote);
    return newNote;
  }

  async updateReviewNote(
    id: string,
    updates: Partial<InsertReviewNote>
  ): Promise<ReviewNote | undefined> {
    const existing = this.reviewNotes.get(id);
    if (!existing) return undefined;

    const updated: ReviewNote = {
      ...existing,
      ...updates,
      resolvedAt:
        updates.status === "cleared" ? new Date() : existing.resolvedAt,
    };
    this.reviewNotes.set(id, updated);
    return updated;
  }

  async getDocuments(engagementId: string, phase?: string): Promise<Document[]> {
    return Array.from(this.documents.values())
      .filter(
        (doc) =>
          doc.engagementId === engagementId && (!phase || doc.phase === phase)
      )
      .sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0));
  }

  async createDocument(doc: InsertDocument): Promise<Document> {
    const id = randomUUID();
    const newDoc: Document = {
      ...doc,
      id,
      tags: doc.tags ?? null,
      createdAt: new Date(),
    };
    this.documents.set(id, newDoc);
    return newDoc;
  }
  async getGuideIssues(): Promise<GuideIssue[]> {
    return Array.from(this.guideIssues.values()).sort(
      (a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0)
    );
  }

  async createGuideIssue(issue: InsertGuideIssue): Promise<GuideIssue> {
    const id = randomUUID();
    const newIssue: GuideIssue = {
      ...issue,
      id,
      pageKey: issue.pageKey ?? null,
      status: issue.status ?? "open",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.guideIssues.set(id, newIssue);
    return newIssue;
  }

  async updateGuideIssue(id: string, updates: Partial<InsertGuideIssue>): Promise<GuideIssue | undefined> {
    const existing = this.guideIssues.get(id);
    if (!existing) return undefined;
    const updated: GuideIssue = { ...existing, ...updates, updatedAt: new Date() };
    this.guideIssues.set(id, updated);
    return updated;
  }

  async deleteGuideIssue(id: string): Promise<void> {
    this.guideIssues.delete(id);
  }
}

export const storage = new MemStorage();
