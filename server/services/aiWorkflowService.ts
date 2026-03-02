import { prisma } from "../db";
import { Prisma } from "@prisma/client";

type ProposalStatus = 'PROPOSED' | 'REVIEWED' | 'APPROVED' | 'APPLIED' | 'REJECTED';

interface AIProposedChange {
  field: string;
  entityId: string;
  entityType: string;
  currentValue: string | null;
  proposedValue: string;
  reason: string;
}

interface CreateProposalInput {
  engagementId: string;
  tabKey: string;
  proposalType: string;
  title: string;
  description: string;
  changes: AIProposedChange[];
  confidence: number;
  reasoning: string;
}

interface AIProposalRow {
  id: string;
  engagementId: string;
  tabKey: string;
  proposalType: string;
  title: string;
  description: string;
  status: string;
  confidence: number;
  reasoning: string;
  proposedAt: Date;
  reviewedAt: Date | null;
  reviewedBy: string | null;
  approvedAt: Date | null;
  approvedBy: string | null;
  appliedAt: Date | null;
  rejectedAt: Date | null;
  rejectedBy: string | null;
  rejectionReason: string | null;
  changes: any;
  createdAt: Date;
  updatedAt: Date;
}

function parseProposal(p: AIProposalRow) {
  return {
    ...p,
    changes: typeof p.changes === 'string' ? JSON.parse(p.changes) : p.changes,
  };
}

export async function createProposal(input: CreateProposalInput) {
  const id = crypto.randomUUID();
  const now = new Date();
  const rows = await prisma.$queryRaw<AIProposalRow[]>`
    INSERT INTO "AIProposal" (id, "engagementId", "tabKey", "proposalType", title, description, changes, confidence, reasoning, status, "proposedAt", "createdAt", "updatedAt")
    VALUES (${id}, ${input.engagementId}, ${input.tabKey}, ${input.proposalType}, ${input.title}, ${input.description}, ${JSON.stringify(input.changes)}::jsonb, ${input.confidence}, ${input.reasoning}, 'PROPOSED', ${now}, ${now}, ${now})
    RETURNING *
  `;
  return rows[0] ? parseProposal(rows[0]) : null;
}

export async function listProposals(engagementId: string, filters?: { tabKey?: string; status?: string }) {
  let query = Prisma.sql`SELECT * FROM "AIProposal" WHERE "engagementId" = ${engagementId}`;

  if (filters?.tabKey && filters?.status) {
    query = Prisma.sql`SELECT * FROM "AIProposal" WHERE "engagementId" = ${engagementId} AND "tabKey" = ${filters.tabKey} AND status = ${filters.status} ORDER BY "proposedAt" DESC`;
  } else if (filters?.tabKey) {
    query = Prisma.sql`SELECT * FROM "AIProposal" WHERE "engagementId" = ${engagementId} AND "tabKey" = ${filters.tabKey} ORDER BY "proposedAt" DESC`;
  } else if (filters?.status) {
    query = Prisma.sql`SELECT * FROM "AIProposal" WHERE "engagementId" = ${engagementId} AND status = ${filters.status} ORDER BY "proposedAt" DESC`;
  } else {
    query = Prisma.sql`SELECT * FROM "AIProposal" WHERE "engagementId" = ${engagementId} ORDER BY "proposedAt" DESC`;
  }

  const proposals = await prisma.$queryRaw<AIProposalRow[]>(query);
  return proposals.map(parseProposal);
}

export async function getProposal(proposalId: string) {
  const rows = await prisma.$queryRaw<AIProposalRow[]>`
    SELECT * FROM "AIProposal" WHERE id = ${proposalId} LIMIT 1
  `;
  if (!rows[0]) return null;
  return parseProposal(rows[0]);
}

export async function reviewProposal(proposalId: string, userId: string) {
  const proposal = await getProposal(proposalId);
  if (!proposal) throw new Error('Proposal not found');
  if (proposal.status !== 'PROPOSED') throw new Error(`Cannot review proposal in ${proposal.status} status`);

  const now = new Date();
  const rows = await prisma.$queryRaw<AIProposalRow[]>`
    UPDATE "AIProposal" SET status = 'REVIEWED', "reviewedAt" = ${now}, "reviewedBy" = ${userId}, "updatedAt" = ${now}
    WHERE id = ${proposalId} RETURNING *
  `;
  return rows[0] ? parseProposal(rows[0]) : null;
}

export async function approveProposal(proposalId: string, userId: string) {
  const proposal = await getProposal(proposalId);
  if (!proposal) throw new Error('Proposal not found');
  if (proposal.status !== 'REVIEWED') throw new Error(`Cannot approve proposal in ${proposal.status} status. Must be REVIEWED first.`);

  const now = new Date();
  const rows = await prisma.$queryRaw<AIProposalRow[]>`
    UPDATE "AIProposal" SET status = 'APPROVED', "approvedAt" = ${now}, "approvedBy" = ${userId}, "updatedAt" = ${now}
    WHERE id = ${proposalId} RETURNING *
  `;
  return rows[0] ? parseProposal(rows[0]) : null;
}

export async function applyProposal(proposalId: string) {
  const proposal = await getProposal(proposalId);
  if (!proposal) throw new Error('Proposal not found');
  if (proposal.status !== 'APPROVED') throw new Error(`Cannot apply proposal in ${proposal.status} status. Must be APPROVED first.`);

  const now = new Date();
  const rows = await prisma.$queryRaw<AIProposalRow[]>`
    UPDATE "AIProposal" SET status = 'APPLIED', "appliedAt" = ${now}, "updatedAt" = ${now}
    WHERE id = ${proposalId} RETURNING *
  `;
  return rows[0] ? parseProposal(rows[0]) : null;
}

export async function rejectProposal(proposalId: string, userId: string, reason: string) {
  const proposal = await getProposal(proposalId);
  if (!proposal) throw new Error('Proposal not found');
  if (['APPLIED', 'REJECTED'].includes(proposal.status)) {
    throw new Error(`Cannot reject proposal in ${proposal.status} status`);
  }

  const now = new Date();
  const rows = await prisma.$queryRaw<AIProposalRow[]>`
    UPDATE "AIProposal" SET status = 'REJECTED', "rejectedAt" = ${now}, "rejectedBy" = ${userId}, "rejectionReason" = ${reason}, "updatedAt" = ${now}
    WHERE id = ${proposalId} RETURNING *
  `;
  return rows[0] ? parseProposal(rows[0]) : null;
}

export async function getProposalCounts(engagementId: string) {
  const rows = await prisma.$queryRaw<{ status: string; count: bigint }[]>`
    SELECT status, COUNT(*)::bigint as count FROM "AIProposal" WHERE "engagementId" = ${engagementId} GROUP BY status
  `;

  const counts: Record<string, number> = {
    PROPOSED: 0,
    REVIEWED: 0,
    APPROVED: 0,
    APPLIED: 0,
    REJECTED: 0,
    total: 0,
  };

  for (const row of rows) {
    const c = Number(row.count);
    counts[row.status] = c;
    counts.total += c;
  }

  return counts;
}

export async function validateProposalChanges(proposalId: string): Promise<{ valid: boolean; errors: string[] }> {
  const proposal = await getProposal(proposalId);
  if (!proposal) return { valid: false, errors: ['Proposal not found'] };

  const errors: string[] = [];
  const changes = proposal.changes;

  if (!Array.isArray(changes) || changes.length === 0) {
    errors.push('Proposal has no changes defined');
  } else {
    const entityTypes = new Set<string>();
    for (const change of changes) {
      if (!change.field) errors.push('Change missing field name');
      if (!change.entityId) errors.push('Change missing entity ID');
      if (!change.entityType) errors.push('Change missing entity type');
      if (change.proposedValue === undefined || change.proposedValue === null) {
        errors.push(`Change for field ${change.field} has no proposed value`);
      }
      entityTypes.add(change.entityType);
    }

    for (const entityType of Array.from(entityTypes)) {
      const validTypes = ['TB_ENTRY', 'GL_ENTRY', 'COA_ACCOUNT', 'FS_MAPPING', 'MATERIALITY', 'RISK_ASSESSMENT'];
      if (!validTypes.includes(entityType)) {
        errors.push(`Unknown entity type: ${entityType}`);
      }
    }
  }

  return { valid: errors.length === 0, errors };
}
