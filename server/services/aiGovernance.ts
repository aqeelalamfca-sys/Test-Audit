import { prisma } from '../db';
import { createHash } from 'crypto';
import type { AIInteractionAction } from '@prisma/client';

// =====================================
// TYPES & INTERFACES
// =====================================

export type AIInteractionStatus = 'SUGGESTED' | 'ACCEPTED' | 'REJECTED' | 'MODIFIED';

export interface AIInteractionLogParams {
  engagementId?: string;
  userId: string;
  userRole: string;
  promptText: string;
  outputText: string;
  contextType?: string;
  contextId?: string;
  action: AIInteractionAction;
  editedOutput?: string;
  module?: string;
  screen?: string;
  processingTimeMs?: number;
  tokenCount?: number;
  modelUsed?: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface AIContext {
  engagementId?: string;
  userId: string;
  userRole: string;
  module: string;
  screen?: string;
  sourceDataReferences?: SourceDataReference[];
  isaReferences?: string[];
  confidenceScore?: number;
  actionRequired: string;
}

export interface SourceDataReference {
  type: 'TRIAL_BALANCE' | 'GENERAL_LEDGER' | 'DOCUMENT' | 'WORKING_PAPER' | 'EXTERNAL_CONFIRMATION' | 'OTHER';
  id: string;
  name: string;
  description?: string;
}

export interface AISuggestionWrapper<T> {
  suggestion: T;
  metadata: {
    outputId: string;
    promptHash: string;
    timestamp: Date;
    disclaimer: string;
    sourceDataReferences: SourceDataReference[];
    isaReferences: string[];
    confidenceIndicator: ConfidenceIndicator;
    actionRequired: string;
    isAIGenerated: true;
    requiresHumanApproval: true;
  };
}

export interface ConfidenceIndicator {
  level: 'LOW' | 'MEDIUM' | 'HIGH';
  score: number;
  explanation: string;
}

// =====================================
// CONSTANTS
// =====================================

const AI_DISCLAIMER = "AI-assisted — subject to professional judgment";

const PROHIBITED_ACTIONS = new Set([
  'CONCLUDE',
  'SIGN_OFF',
  'APPROVE',
  'AUTO_APPROVE',
  'POST_ADJUSTING_ENTRY',
  'POST_AJE',
  'FINALIZE',
  'LOCK',
  'OVERRIDE_HUMAN_JUDGMENT',
  'ISSUE_REPORT',
  'SIGN_REPORT',
  'PARTNER_APPROVAL',
  'MANAGER_APPROVAL',
  'EQCR_APPROVAL',
  'RELEASE_DELIVERABLE',
]);

const ACTION_TO_STATUS: Record<AIInteractionAction, AIInteractionStatus> = {
  ACCEPT: 'ACCEPTED',
  REJECT: 'REJECTED',
  EDIT: 'MODIFIED',
  REGENERATE: 'SUGGESTED',
};

// =====================================
// HELPER FUNCTIONS
// =====================================

function generatePromptHash(promptText: string): string {
  return createHash('sha256').update(promptText).digest('hex').substring(0, 32);
}

function generateOutputId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 10);
  return `AI-${timestamp}-${random}`.toUpperCase();
}

function calculateConfidenceIndicator(score?: number): ConfidenceIndicator {
  const normalizedScore = score ?? 0.5;
  
  if (normalizedScore >= 0.8) {
    return {
      level: 'HIGH',
      score: normalizedScore,
      explanation: 'AI has high confidence based on available data patterns and ISA requirements. Human review still mandatory.',
    };
  } else if (normalizedScore >= 0.5) {
    return {
      level: 'MEDIUM',
      score: normalizedScore,
      explanation: 'AI has moderate confidence. Additional professional judgment required to validate suggestion.',
    };
  } else {
    return {
      level: 'LOW',
      score: normalizedScore,
      explanation: 'AI has low confidence due to limited data or complexity. Significant professional review required.',
    };
  }
}

// =====================================
// CORE FUNCTIONS
// =====================================

/**
 * Logs an AI interaction to both AIInteractionLog and AuditTrail tables
 * Returns the generated outputId for tracking
 */
export async function logAIInteraction(params: AIInteractionLogParams): Promise<string> {
  const promptHash = generatePromptHash(params.promptText);
  const outputId = generateOutputId();
  const status = ACTION_TO_STATUS[params.action] || 'SUGGESTED';

  await prisma.$transaction(async (tx) => {
    await tx.aIInteractionLog.create({
      data: {
        engagementId: params.engagementId,
        userId: params.userId,
        userRole: params.userRole,
        promptHash,
        promptText: params.promptText,
        outputId,
        outputText: params.outputText,
        contextType: params.contextType,
        contextId: params.contextId,
        action: params.action,
        editedOutput: params.editedOutput,
        module: params.module,
        screen: params.screen,
        processingTimeMs: params.processingTimeMs,
        tokenCount: params.tokenCount,
        modelUsed: params.modelUsed,
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
      },
    });

    await tx.auditTrail.create({
      data: {
        engagementId: params.engagementId,
        userId: params.userId,
        userRole: params.userRole,
        action: `AI_INTERACTION_${status}`,
        entityType: params.contextType || 'AI_SUGGESTION',
        entityId: params.contextId,
        module: params.module,
        screen: params.screen,
        aiPromptHash: promptHash,
        aiOutputId: outputId,
        aiAction: params.action,
        beforeValue: { promptText: params.promptText },
        afterValue: {
          outputText: params.outputText,
          editedOutput: params.editedOutput,
          status,
        },
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
        reason: `AI ${params.action.toLowerCase()} - ${params.module || 'unknown module'}`,
        isImmutable: true,
      },
    });
  });

  return outputId;
}

/**
 * Wraps an AI suggestion with governance metadata for explainability
 * Ensures all AI output is clearly labeled and traceable
 */
export function wrapAISuggestion<T>(
  suggestion: T,
  context: AIContext
): AISuggestionWrapper<T> {
  const promptHash = generatePromptHash(JSON.stringify(suggestion));
  const outputId = generateOutputId();

  return {
    suggestion,
    metadata: {
      outputId,
      promptHash,
      timestamp: new Date(),
      disclaimer: AI_DISCLAIMER,
      sourceDataReferences: context.sourceDataReferences || [],
      isaReferences: context.isaReferences || [],
      confidenceIndicator: calculateConfidenceIndicator(context.confidenceScore),
      actionRequired: context.actionRequired,
      isAIGenerated: true,
      requiresHumanApproval: true,
    },
  };
}

/**
 * Returns the standard AI disclaimer text
 */
export function getAIDisclaimer(): string {
  return AI_DISCLAIMER;
}

/**
 * Checks if AI is allowed to perform a given action
 * Always returns false for conclude/approve/post actions
 * This is the hard enforcement layer - non-overridable
 */
export function canAIPerformAction(action: string): boolean {
  const normalizedAction = action.toUpperCase().replace(/[^A-Z_]/g, '_');
  
  if (PROHIBITED_ACTIONS.has(normalizedAction)) {
    return false;
  }

  const prohibitedPatterns = [
    /CONCLUDE/i,
    /SIGN.?OFF/i,
    /APPROVE/i,
    /AUTO.?APPROVE/i,
    /POST.?AJ/i,
    /POST.?ADJUST/i,
    /FINALIZE/i,
    /OVERRIDE/i,
    /ISSUE.?REPORT/i,
    /SIGN.?REPORT/i,
    /RELEASE/i,
    /LOCK/i,
  ];

  for (const pattern of prohibitedPatterns) {
    if (pattern.test(action)) {
      return false;
    }
  }

  return true;
}

// =====================================
// ADDITIONAL GOVERNANCE UTILITIES
// =====================================

/**
 * Validates that an AI action is allowed before execution
 * Throws an error if the action is prohibited
 */
export function enforceAIActionRestriction(action: string, context: string): void {
  if (!canAIPerformAction(action)) {
    throw new Error(
      `AI GOVERNANCE VIOLATION: Action "${action}" is prohibited. ` +
      `Context: ${context}. ` +
      `AI cannot conclude, sign off, approve, or post adjusting entries without human approval.`
    );
  }
}

/**
 * Gets the list of all prohibited AI actions
 */
export function getProhibitedActions(): string[] {
  return Array.from(PROHIBITED_ACTIONS);
}

/**
 * Logs an AI governance violation attempt
 */
export async function logGovernanceViolation(
  userId: string,
  userRole: string,
  attemptedAction: string,
  context: string,
  engagementId?: string
): Promise<void> {
  await prisma.auditTrail.create({
    data: {
      engagementId,
      userId,
      userRole,
      action: 'AI_GOVERNANCE_VIOLATION_ATTEMPT',
      entityType: 'AI_GOVERNANCE',
      module: 'AI_GOVERNANCE',
      reason: `Attempted prohibited action: ${attemptedAction}`,
      beforeValue: { attemptedAction, context },
      afterValue: { blocked: true, reason: 'Action prohibited by AI governance layer' },
      isImmutable: true,
    },
  });
}

/**
 * Creates an explainability wrapper for AI-generated content
 */
export function createExplainabilityBlock(
  content: string,
  context: AIContext
): {
  content: string;
  explainability: {
    sourceDataReferences: SourceDataReference[];
    isaReferences: string[];
    confidenceIndicator: ConfidenceIndicator;
    actionRequired: string;
    disclaimer: string;
    generatedAt: Date;
  };
} {
  return {
    content,
    explainability: {
      sourceDataReferences: context.sourceDataReferences || [],
      isaReferences: context.isaReferences || [],
      confidenceIndicator: calculateConfidenceIndicator(context.confidenceScore),
      actionRequired: context.actionRequired,
      disclaimer: AI_DISCLAIMER,
      generatedAt: new Date(),
    },
  };
}

/**
 * Formats ISA references for display
 */
export function formatISAReferences(references: string[]): string {
  if (references.length === 0) {
    return 'No specific ISA references';
  }
  return `ISA References: ${references.join(', ')}`;
}

/**
 * Creates a human action prompt for AI suggestions
 */
export function createHumanActionPrompt(actionRequired: string): string {
  return `⚠️ HUMAN ACTION REQUIRED: ${actionRequired}\n\n${AI_DISCLAIMER}`;
}
