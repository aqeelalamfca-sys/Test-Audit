export interface EthicsQuestionnaireItem {
  id: string;
  question: string;
  helpText: string;
  suggestedResponse: string;
  isaReference: string;
  category: string;
  inputType: "select" | "textarea" | "yes-no";
  selectOptions?: { value: string; label: string }[];
}

export interface EthicsRow {
  id: string;
  response: string;
  remarks: string;
  isCustom?: boolean;
}

export interface TeamDeclaration {
  id: string;
  memberName: string;
  role: string;
  declarationDate: string;
  status: "Pending" | "Received" | "Overdue";
  uploadedDocument?: {
    fileName: string;
    uploadedAt: string;
    fileUrl?: string;
  };
}

export interface EngagementLetterChecklistRow {
  id: string;
  description: string;
  response: string;
  remarks: string;
  attachments: File[];
  isCustom: boolean;
}

export interface BudgetChecklistRow {
  id: string;
  description: string;
  response: string;
  remarks: string;
  attachments: File[];
  isCustom: boolean;
}
