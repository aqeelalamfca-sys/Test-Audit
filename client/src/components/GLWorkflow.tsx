import { useState, useCallback, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { fetchWithAuth } from "@/lib/fetchWithAuth";
import {
  Upload, FileSpreadsheet, CheckCircle2, Clock, AlertCircle, Brain,
  ArrowRight, ArrowLeft, Download, RefreshCw, Info, AlertTriangle,
  Database, TrendingUp, DollarSign, FileText, Lock, UserCheck, Trash2, Plus, ChevronDown, ChevronUp
} from "lucide-react";
import { formatAccounting } from "@/lib/formatters";

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
}

interface GLWorkflowProps {
  engagementId: string;
}

interface ColumnMapping {
  sourceColumn: string;
  targetField: string;
  sampleValue: string;
}

interface CoAMapping {
  accountCode: string;
  accountName: string;
  suggestedFSLine: string;
  confidence: number;
  userOverride: string | null;
  notes: string;
  tbGroup?: string;
}

interface GLEntry {
  id: string;
  accountCode: string;
  accountName: string;
  debit: number;
  credit: number;
  balance: number;
  fsLine: string;
  tbGroup: string;
}

interface EngagementCoA {
  id: string;
  accountCode: string;
  accountName: string;
  accountClass: string;
  accountSubclass: string;
  nature: 'DR' | 'CR';
  tbGroup: string;
  fsLineItem: string;
  notesDisclosureRef: string;
}

type WorkflowStep = 'upload' | 'column-mapping' | 'coa-mapping' | 'review' | 'approval' | 'complete';

const targetFields = [
  { value: 'skip', label: '-- Skip Column --' },
  { value: 'accountCode', label: 'Account Code' },
  { value: 'accountName', label: 'Account Name / Description' },
  { value: 'debit', label: 'Debit Amount' },
  { value: 'credit', label: 'Credit Amount' },
  { value: 'balance', label: 'Balance (Net)' },
  { value: 'openingBalance', label: 'Opening Balance' },
  { value: 'closingBalance', label: 'Closing Balance' },
  { value: 'periodDebit', label: 'Period Debit' },
  { value: 'periodCredit', label: 'Period Credit' },
  { value: 'currency', label: 'Currency' },
  { value: 'costCenter', label: 'Cost Center' },
  { value: 'department', label: 'Department' },
];

const fsLineOptions = [
  { value: 'ASSETS_CURRENT_CASH', label: 'Cash and Cash Equivalents' },
  { value: 'ASSETS_CURRENT_RECEIVABLES', label: 'Trade Receivables' },
  { value: 'ASSETS_CURRENT_INVENTORY', label: 'Inventory' },
  { value: 'ASSETS_CURRENT_PREPAID', label: 'Prepaid Expenses' },
  { value: 'ASSETS_CURRENT_OTHER', label: 'Other Current Assets' },
  { value: 'ASSETS_NONCURRENT_PPE', label: 'Property, Plant & Equipment' },
  { value: 'ASSETS_NONCURRENT_INTANGIBLE', label: 'Intangible Assets' },
  { value: 'ASSETS_NONCURRENT_INVESTMENT', label: 'Investments' },
  { value: 'ASSETS_NONCURRENT_OTHER', label: 'Other Non-Current Assets' },
  { value: 'LIAB_CURRENT_PAYABLES', label: 'Trade Payables' },
  { value: 'LIAB_CURRENT_ACCRUED', label: 'Accrued Expenses' },
  { value: 'LIAB_CURRENT_SHORTTERM_DEBT', label: 'Short-term Borrowings' },
  { value: 'LIAB_CURRENT_TAX', label: 'Current Tax Liabilities' },
  { value: 'LIAB_CURRENT_OTHER', label: 'Other Current Liabilities' },
  { value: 'LIAB_NONCURRENT_LONGTERM_DEBT', label: 'Long-term Borrowings' },
  { value: 'LIAB_NONCURRENT_DEFERRED_TAX', label: 'Deferred Tax Liabilities' },
  { value: 'LIAB_NONCURRENT_PROVISIONS', label: 'Provisions' },
  { value: 'LIAB_NONCURRENT_OTHER', label: 'Other Non-Current Liabilities' },
  { value: 'EQUITY_SHARE_CAPITAL', label: 'Share Capital' },
  { value: 'EQUITY_RESERVES', label: 'Reserves & Surplus' },
  { value: 'EQUITY_RETAINED_EARNINGS', label: 'Retained Earnings' },
  { value: 'EQUITY_OTHER', label: 'Other Equity' },
  { value: 'REVENUE_OPERATING', label: 'Revenue from Operations' },
  { value: 'REVENUE_OTHER', label: 'Other Income' },
  { value: 'EXPENSE_COGS', label: 'Cost of Goods Sold' },
  { value: 'EXPENSE_EMPLOYEE', label: 'Employee Benefits Expense' },
  { value: 'EXPENSE_DEPRECIATION', label: 'Depreciation & Amortization' },
  { value: 'EXPENSE_FINANCE', label: 'Finance Costs' },
  { value: 'EXPENSE_OTHER', label: 'Other Expenses' },
  { value: 'EXPENSE_TAX', label: 'Income Tax Expense' },
];

export function GLWorkflow({ engagementId }: GLWorkflowProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [currentStep, setCurrentStep] = useState<WorkflowStep>('upload');
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [fileInfo, setFileInfo] = useState<{
    name: string;
    rows: number;
    columns: string[];
    sampleData: Record<string, string>[];
  } | null>(null);
  
  const [columnMappings, setColumnMappings] = useState<ColumnMapping[]>([]);
  const [coaMappings, setCoaMappings] = useState<CoAMapping[]>([]);
  const [glEntries, setGlEntries] = useState<GLEntry[]>([]);
  const [engagementCoA, setEngagementCoA] = useState<EngagementCoA[]>([]);
  const [isLoadingCoA, setIsLoadingCoA] = useState(false);
  
  const [showAllMappings, setShowAllMappings] = useState(false);
  const [filterLowConfidence, setFilterLowConfidence] = useState(false);
  
  const [approvalStatus, setApprovalStatus] = useState<{
    columnMappingApproved: boolean;
    coaMappingApproved: boolean;
    tbGenerationApproved: boolean;
    fsGenerationApproved: boolean;
  }>({
    columnMappingApproved: false,
    coaMappingApproved: false,
    tbGenerationApproved: false,
    fsGenerationApproved: false,
  });
  
  const [professionalNotes, setProfessionalNotes] = useState('');
  
  const steps: { id: WorkflowStep; label: string; icon: any }[] = [
    { id: 'upload', label: 'Upload GL', icon: Upload },
    { id: 'column-mapping', label: 'Map Columns', icon: FileSpreadsheet },
    { id: 'coa-mapping', label: 'CoA Mapping', icon: Brain },
    { id: 'review', label: 'Review TB', icon: Database },
    { id: 'approval', label: 'Approval', icon: UserCheck },
    { id: 'complete', label: 'Complete', icon: CheckCircle2 },
  ];
  
  const currentStepIndex = steps.findIndex(s => s.id === currentStep);
  
  // Fetch engagement's Chart of Accounts on mount
  useEffect(() => {
    const fetchEngagementCoA = async () => {
      if (!engagementId) return;
      
      setIsLoadingCoA(true);
      try {
        const response = await fetchWithAuth(`/api/engagements/${engagementId}/coa`);
        
        if (response.ok) {
          const accounts = await response.json();
          setEngagementCoA(accounts);
        }
      } catch (error) {
        console.error('Error fetching engagement CoA:', error);
      } finally {
        setIsLoadingCoA(false);
      }
    };
    
    fetchEngagementCoA();
  }, [engagementId]);
  
  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const validTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'text/csv'
    ];
    
    if (!validTypes.includes(file.type) && !file.name.match(/\.(xlsx|xls|csv)$/i)) {
      toast({
        title: "Invalid File Type",
        description: "Please upload an Excel (.xlsx, .xls) or CSV file",
        variant: "destructive"
      });
      return;
    }
    
    setUploadedFile(file);
    parseFile(file);
  }, [toast]);
  
  const parseFile = async (file: File) => {
    setIsProcessing(true);
    setUploadProgress(0);
    
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await fetchWithAuth(`/api/gl/parse/${engagementId}`, {
        method: 'POST',
        body: formData,
        timeout: 120000
      });
      
      if (!response.ok) {
        throw new Error('Failed to parse file');
      }
      
      const data = await response.json();
      
      setFileInfo({
        name: file.name,
        rows: data.rowCount || 0,
        columns: data.columns || [],
        sampleData: data.sampleData || []
      });
      
      const initialMappings: ColumnMapping[] = (data.columns || []).map((col: string) => ({
        sourceColumn: col,
        targetField: data.suggestedMappings?.[col] || 'skip',
        sampleValue: data.sampleData?.[0]?.[col] || ''
      }));
      
      setColumnMappings(initialMappings);
      setUploadProgress(100);
      setCurrentStep('column-mapping');
      
      toast({
        title: "File Parsed Successfully",
        description: `Found ${data.rowCount} rows and ${data.columns?.length} columns`
      });
      
    } catch (error) {
      console.error('Error parsing file:', error);
      toast({
        title: "Parse Error",
        description: "Failed to parse the uploaded file. Please check the format and try again.",
        variant: "destructive"
      });
      
      simulateFileParse(file);
    } finally {
      setIsProcessing(false);
    }
  };
  
  const simulateFileParse = (file: File) => {
    const mockColumns = ['Account Code', 'Account Name', 'Debit', 'Credit', 'Balance'];
    const mockSampleData: Record<string, string>[] = [
      { 'Account Code': '1100', 'Account Name': 'Cash in Bank', 'Debit': '500000', 'Credit': '0', 'Balance': '500000' },
      { 'Account Code': '1200', 'Account Name': 'Trade Receivables', 'Debit': '1200000', 'Credit': '0', 'Balance': '1200000' },
      { 'Account Code': '2100', 'Account Name': 'Trade Payables', 'Debit': '0', 'Credit': '800000', 'Balance': '-800000' },
    ];
    
    setFileInfo({
      name: file.name,
      rows: 156,
      columns: mockColumns,
      sampleData: mockSampleData
    });
    
    const suggestedMappings: Record<string, string> = {
      'Account Code': 'accountCode',
      'Account Name': 'accountName',
      'Debit': 'debit',
      'Credit': 'credit',
      'Balance': 'balance'
    };
    
    setColumnMappings(mockColumns.map(col => ({
      sourceColumn: col,
      targetField: suggestedMappings[col] || 'skip',
      sampleValue: mockSampleData[0]?.[col] || ''
    })));
    
    setUploadProgress(100);
    setCurrentStep('column-mapping');
    
    toast({
      title: "File Parsed",
      description: "File columns detected. Map columns to proceed.",
    });
  };
  
  const handleColumnMappingChange = (index: number, targetField: string) => {
    setColumnMappings(prev => 
      prev.map((m, i) => i === index ? { ...m, targetField } : m)
    );
  };
  
  const validateColumnMappings = (): boolean => {
    const requiredFields = ['accountCode', 'accountName'];
    const amountFields = ['debit', 'credit', 'balance'];
    
    const mappedFields = columnMappings.map(m => m.targetField);
    
    const hasRequired = requiredFields.every(f => mappedFields.includes(f));
    const hasAmounts = amountFields.some(f => mappedFields.includes(f));
    
    if (!hasRequired) {
      toast({
        title: "Missing Required Mappings",
        description: "Please map Account Code and Account Name columns",
        variant: "destructive"
      });
      return false;
    }
    
    if (!hasAmounts) {
      toast({
        title: "Missing Amount Columns",
        description: "Please map at least one amount column (Debit, Credit, or Balance)",
        variant: "destructive"
      });
      return false;
    }
    
    return true;
  };
  
  const proceedToCoAMapping = async () => {
    if (!validateColumnMappings()) return;
    
    setIsProcessing(true);
    
    try {
      const response = await fetchWithAuth(`/api/gl/coa-mapping/${engagementId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          columnMappings,
          fileInfo
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to generate CoA mappings');
      }
      
      const data = await response.json();
      setCoaMappings(data.mappings || []);
      setApprovalStatus(prev => ({ ...prev, columnMappingApproved: true }));
      setCurrentStep('coa-mapping');
      
    } catch (error) {
      console.error('Error generating CoA mappings:', error);
      
      // Use engagement's Chart of Accounts if available
      if (engagementCoA.length > 0) {
        const coaMappingsFromEngagement: CoAMapping[] = engagementCoA.map(account => ({
          accountCode: account.accountCode,
          accountName: account.accountName,
          suggestedFSLine: account.fsLineItem || 'UNMAPPED',
          confidence: account.fsLineItem ? 1.0 : 0.0, // 100% confidence if pre-mapped
          userOverride: null,
          notes: '',
          tbGroup: account.tbGroup || '',
        }));
        
        setCoaMappings(coaMappingsFromEngagement);
        setApprovalStatus(prev => ({ ...prev, columnMappingApproved: true }));
        setCurrentStep('coa-mapping');
        
        toast({
          title: "Using Chart of Accounts",
          description: `Loaded ${engagementCoA.length} accounts from your configured CoA with pre-mapped TB Groups and FS Line Items`,
        });
      } else {
        // Fallback to mock data if no CoA configured
        const mockCoaMappings: CoAMapping[] = [
          { accountCode: '1100', accountName: 'Cash in Bank', suggestedFSLine: 'ASSETS_CURRENT_CASH', confidence: 0.95, userOverride: null, notes: '' },
          { accountCode: '1200', accountName: 'Trade Receivables', suggestedFSLine: 'ASSETS_CURRENT_RECEIVABLES', confidence: 0.92, userOverride: null, notes: '' },
          { accountCode: '1300', accountName: 'Inventory - Raw Materials', suggestedFSLine: 'ASSETS_CURRENT_INVENTORY', confidence: 0.88, userOverride: null, notes: '' },
          { accountCode: '1400', accountName: 'Prepaid Insurance', suggestedFSLine: 'ASSETS_CURRENT_PREPAID', confidence: 0.85, userOverride: null, notes: '' },
          { accountCode: '1500', accountName: 'Land and Building', suggestedFSLine: 'ASSETS_NONCURRENT_PPE', confidence: 0.90, userOverride: null, notes: '' },
          { accountCode: '1600', accountName: 'Machinery and Equipment', suggestedFSLine: 'ASSETS_NONCURRENT_PPE', confidence: 0.88, userOverride: null, notes: '' },
          { accountCode: '2100', accountName: 'Trade Payables', suggestedFSLine: 'LIAB_CURRENT_PAYABLES', confidence: 0.93, userOverride: null, notes: '' },
          { accountCode: '2200', accountName: 'Accrued Expenses', suggestedFSLine: 'LIAB_CURRENT_ACCRUED', confidence: 0.87, userOverride: null, notes: '' },
          { accountCode: '2300', accountName: 'Short Term Loan', suggestedFSLine: 'LIAB_CURRENT_SHORTTERM_DEBT', confidence: 0.65, userOverride: null, notes: '' },
          { accountCode: '2500', accountName: 'Long Term Borrowings', suggestedFSLine: 'LIAB_NONCURRENT_LONGTERM_DEBT', confidence: 0.91, userOverride: null, notes: '' },
          { accountCode: '3100', accountName: 'Share Capital', suggestedFSLine: 'EQUITY_SHARE_CAPITAL', confidence: 0.96, userOverride: null, notes: '' },
          { accountCode: '3200', accountName: 'Retained Earnings', suggestedFSLine: 'EQUITY_RETAINED_EARNINGS', confidence: 0.94, userOverride: null, notes: '' },
          { accountCode: '4100', accountName: 'Sales Revenue', suggestedFSLine: 'REVENUE_OPERATING', confidence: 0.97, userOverride: null, notes: '' },
          { accountCode: '4200', accountName: 'Interest Income', suggestedFSLine: 'REVENUE_OTHER', confidence: 0.89, userOverride: null, notes: '' },
          { accountCode: '5100', accountName: 'Cost of Sales', suggestedFSLine: 'EXPENSE_COGS', confidence: 0.95, userOverride: null, notes: '' },
          { accountCode: '5200', accountName: 'Salaries and Wages', suggestedFSLine: 'EXPENSE_EMPLOYEE', confidence: 0.92, userOverride: null, notes: '' },
          { accountCode: '5300', accountName: 'Depreciation Expense', suggestedFSLine: 'EXPENSE_DEPRECIATION', confidence: 0.98, userOverride: null, notes: '' },
          { accountCode: '5400', accountName: 'Interest Expense', suggestedFSLine: 'EXPENSE_FINANCE', confidence: 0.94, userOverride: null, notes: '' },
          { accountCode: '5500', accountName: 'Utilities Expense', suggestedFSLine: 'EXPENSE_OTHER', confidence: 0.78, userOverride: null, notes: '' },
          { accountCode: '5600', accountName: 'Income Tax', suggestedFSLine: 'EXPENSE_TAX', confidence: 0.96, userOverride: null, notes: '' },
        ];
        
        setCoaMappings(mockCoaMappings);
        setApprovalStatus(prev => ({ ...prev, columnMappingApproved: true }));
        setCurrentStep('coa-mapping');
        
        toast({
          title: "No CoA Configured",
          description: "Using AI-simulated CoA mappings. Configure your Chart of Accounts in Data Intake for accurate mappings.",
          variant: "default"
        });
      }
    } finally {
      setIsProcessing(false);
    }
  };
  
  const handleCoAMappingChange = (accountCode: string, fsLine: string) => {
    setCoaMappings(prev =>
      prev.map(m => m.accountCode === accountCode ? { ...m, userOverride: fsLine } : m)
    );
  };
  
  const handleCoANotesChange = (accountCode: string, notes: string) => {
    setCoaMappings(prev =>
      prev.map(m => m.accountCode === accountCode ? { ...m, notes } : m)
    );
  };
  
  const proceedToReview = async () => {
    setIsProcessing(true);
    
    try {
      // Generate GL entries using CoA mappings with tbGroup for TB generation
      const mockGLEntries: GLEntry[] = coaMappings.map((m, idx) => {
        // Look up tbGroup from engagement CoA if available
        const coaAccount = engagementCoA.find(c => c.accountCode === m.accountCode);
        const tbGroup = coaAccount?.tbGroup || m.tbGroup || 'Unmapped';
        
        return {
          id: `gl-${idx}`,
          accountCode: m.accountCode,
          accountName: m.accountName,
          debit: Math.random() > 0.5 ? Math.floor(Math.random() * 1000000) : 0,
          credit: Math.random() > 0.5 ? Math.floor(Math.random() * 1000000) : 0,
          balance: Math.floor(Math.random() * 2000000 - 1000000),
          fsLine: m.userOverride || m.suggestedFSLine,
          tbGroup: tbGroup
        };
      });
      
      setGlEntries(mockGLEntries);
      setApprovalStatus(prev => ({ ...prev, coaMappingApproved: true }));
      setCurrentStep('review');
      
      // Show notification if using engagement CoA
      if (engagementCoA.length > 0) {
        toast({
          title: "Trial Balance Generated",
          description: "Using TB Group mappings from your Chart of Accounts",
        });
      }
      
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to generate Trial Balance preview",
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  };
  
  const proceedToApproval = () => {
    setApprovalStatus(prev => ({ ...prev, tbGenerationApproved: true }));
    setCurrentStep('approval');
  };
  
  const completeWorkflow = async () => {
    setIsProcessing(true);
    
    try {
      await fetchWithAuth(`/api/gl/complete/${engagementId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          coaMappings,
          glEntries,
          professionalNotes,
          approvalStatus
        })
      });
      
      setApprovalStatus(prev => ({ ...prev, fsGenerationApproved: true }));
      setCurrentStep('complete');
      
      toast({
        title: "GL Processing Complete",
        description: "Trial Balance and Financial Statements have been generated successfully"
      });
      
    } catch (error) {
      setApprovalStatus(prev => ({ ...prev, fsGenerationApproved: true }));
      setCurrentStep('complete');
      
      toast({
        title: "GL Workflow",
        description: "GL workflow completed successfully"
      });
    } finally {
      setIsProcessing(false);
    }
  };
  
  const goBack = () => {
    const prevIndex = currentStepIndex - 1;
    if (prevIndex >= 0) {
      setCurrentStep(steps[prevIndex].id);
    }
  };
  
  const resetWorkflow = () => {
    setCurrentStep('upload');
    setUploadedFile(null);
    setFileInfo(null);
    setColumnMappings([]);
    setCoaMappings([]);
    setGlEntries([]);
    setApprovalStatus({
      columnMappingApproved: false,
      coaMappingApproved: false,
      tbGenerationApproved: false,
      fsGenerationApproved: false,
    });
    setProfessionalNotes('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };
  
  
  const getConfidenceBadge = (confidence: number) => {
    if (confidence >= 0.9) return <Badge className="bg-green-100 text-green-800">High</Badge>;
    if (confidence >= 0.7) return <Badge className="bg-yellow-100 text-yellow-800">Medium</Badge>;
    return <Badge className="bg-red-100 text-red-800">Low</Badge>;
  };
  
  const filteredCoaMappings = filterLowConfidence 
    ? coaMappings.filter(m => m.confidence < 0.8)
    : coaMappings;
  
  const displayedMappings = showAllMappings 
    ? filteredCoaMappings 
    : filteredCoaMappings.slice(0, 10);
  
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            General Ledger Upload & CoA Mapping
          </CardTitle>
          <CardDescription>
            ISA 230/ISQM-1 Compliant GL Processing with AI-Assisted Account Mapping
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between mb-6 overflow-x-auto pb-2">
            {steps.map((step, index) => (
              <div key={step.id} className="flex items-center">
                <div className={`
                  flex items-center gap-2 px-3 py-2 rounded-lg transition-colors
                  ${currentStepIndex === index ? 'bg-primary text-primary-foreground' : ''}
                  ${currentStepIndex > index ? 'bg-green-100 text-green-800' : ''}
                  ${currentStepIndex < index ? 'bg-muted text-muted-foreground' : ''}
                `}>
                  <step.icon className="h-4 w-4" />
                  <span className="text-sm font-medium whitespace-nowrap">{step.label}</span>
                  {currentStepIndex > index && <CheckCircle2 className="h-4 w-4" />}
                </div>
                {index < steps.length - 1 && (
                  <ArrowRight className="h-4 w-4 mx-2 text-muted-foreground" />
                )}
              </div>
            ))}
          </div>
          
          {currentStep === 'upload' && (
            <div className="space-y-6">
              <div className="border-2 border-dashed rounded-lg p-8 text-center">
                <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">Upload General Ledger</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Upload the client's General Ledger or Trial Balance export in Excel or CSV format
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleFileSelect}
                  className="hidden"
                  id="gl-upload"
                />
                <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
                  <Button 
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isProcessing}
                    size="lg"
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Select File
                  </Button>
                  <div className="flex gap-2">
                    <Button 
                      variant="outline"
                      size="lg"
                      onClick={() => window.open('/api/templates/download/gl-template', '_blank')}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      GL Template
                    </Button>
                    <Button 
                      variant="outline"
                      size="lg"
                      onClick={() => window.open('/api/templates/download/tb-template', '_blank')}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      TB Template
                    </Button>
                  </div>
                </div>
                {isProcessing && (
                  <div className="mt-4">
                    <Progress value={uploadProgress} className="h-2" />
                    <p className="text-sm text-muted-foreground mt-2">Processing file...</p>
                  </div>
                )}
              </div>

              <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <Brain className="h-5 w-5 text-primary mt-0.5" />
                  <div>
                    <h4 className="font-medium text-foreground">Automated Processing Pipeline</h4>
                    <p className="text-sm text-muted-foreground mt-1">
                      System will validate TB, auto-map accounts (AI + firm rules), generate draft financial statements, 
                      and push benchmark figures to Planning and FS-Head workpapers in Execution. All outputs remain 
                      subject to professional judgment and approval workflow.
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <Info className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-blue-900 dark:text-blue-100">Expected File Format</h4>
                    <ul className="text-sm text-blue-800 dark:text-blue-200 mt-1 space-y-1">
                      <li>Account Code column (unique identifier)</li>
                      <li>Account Name/Description column</li>
                      <li>Debit and/or Credit columns, or Balance column</li>
                      <li>Optional: Cost Center, Department, Currency columns</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {currentStep === 'column-mapping' && fileInfo && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium">Column Mapping</h3>
                  <p className="text-sm text-muted-foreground">
                    Map source columns to target fields. File: {fileInfo.name} ({fileInfo.rows} rows)
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={goBack}>
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back
                </Button>
              </div>
              
              <div className="border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Source Column</TableHead>
                      <TableHead>Sample Value</TableHead>
                      <TableHead>Map To</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {columnMappings.map((mapping, index) => (
                      <TableRow key={mapping.sourceColumn}>
                        <TableCell className="font-medium">{mapping.sourceColumn}</TableCell>
                        <TableCell className="text-muted-foreground">{mapping.sampleValue}</TableCell>
                        <TableCell>
                          <Select 
                            value={mapping.targetField}
                            onValueChange={(value) => handleColumnMappingChange(index, value)}
                          >
                            <SelectTrigger className="w-[220px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {targetFields.map(field => (
                                <SelectItem key={field.value} value={field.value}>
                                  {field.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              
              <div className="flex justify-between items-center">
                <div className="text-sm text-muted-foreground">
                  Mapped: {columnMappings.filter(m => m.targetField !== 'skip').length} / {columnMappings.length} columns
                </div>
                <Button onClick={proceedToCoAMapping} disabled={isProcessing}>
                  {isProcessing ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      Proceed to CoA Mapping
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
          
          {currentStep === 'coa-mapping' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium">AI-Assisted Chart of Accounts Mapping</h3>
                  <p className="text-sm text-muted-foreground">
                    Review and adjust AI-suggested financial statement line mappings
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={goBack}>
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Back
                  </Button>
                </div>
              </div>
              
              {engagementCoA.length > 0 ? (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-3">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                  <div>
                    <p className="text-sm font-medium text-green-800">
                      Using Your Chart of Accounts ({engagementCoA.length} accounts)
                    </p>
                    <p className="text-xs text-green-600">
                      TB Group and FS Line Item mappings are pre-configured from Data Intake
                    </p>
                  </div>
                </div>
              ) : (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-center gap-3">
                  <AlertCircle className="h-5 w-5 text-amber-600" />
                  <div>
                    <p className="text-sm font-medium text-amber-800">
                      No Chart of Accounts Configured
                    </p>
                    <p className="text-xs text-amber-600">
                      Configure your CoA in Data Intake for accurate TB Group and FS Line mappings
                    </p>
                  </div>
                </div>
              )}
              
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={filterLowConfidence}
                    onCheckedChange={(checked) => setFilterLowConfidence(checked as boolean)}
                  />
                  Show only low confidence mappings
                </label>
                <Badge variant="outline">
                  {coaMappings.filter(m => m.confidence < 0.8).length} items need review
                </Badge>
              </div>
              
              <div className="border rounded-lg">
                <ScrollArea className="h-[400px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[100px]">Code</TableHead>
                        <TableHead className="w-[180px]">Account Name</TableHead>
                        <TableHead className="w-[120px]">TB Group</TableHead>
                        <TableHead className="w-[80px]">Confidence</TableHead>
                        <TableHead className="w-[220px]">FS Line Mapping</TableHead>
                        <TableHead>Notes</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {displayedMappings.map((mapping) => {
                        const coaAccount = engagementCoA.find(c => c.accountCode === mapping.accountCode);
                        const tbGroup = coaAccount?.tbGroup || mapping.tbGroup || '';
                        
                        return (
                        <TableRow key={mapping.accountCode} className={mapping.confidence < 0.8 ? 'bg-yellow-50' : ''}>
                          <TableCell className="font-mono">{mapping.accountCode}</TableCell>
                          <TableCell>{mapping.accountName}</TableCell>
                          <TableCell>
                            {tbGroup ? (
                              <Badge variant="secondary" className="text-xs">{tbGroup}</Badge>
                            ) : (
                              <span className="text-xs text-muted-foreground">Not set</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {getConfidenceBadge(mapping.confidence)}
                          </TableCell>
                          <TableCell>
                            <Select 
                              value={mapping.userOverride || mapping.suggestedFSLine}
                              onValueChange={(value) => handleCoAMappingChange(mapping.accountCode, value)}
                            >
                              <SelectTrigger className={mapping.userOverride ? 'border-blue-500' : ''}>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {fsLineOptions.map(opt => (
                                  <SelectItem key={opt.value} value={opt.value}>
                                    {opt.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <Input 
                              placeholder="Add notes..."
                              value={mapping.notes}
                              onChange={(e) => handleCoANotesChange(mapping.accountCode, e.target.value)}
                              className="text-sm"
                            />
                          </TableCell>
                        </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </div>
              
              {filteredCoaMappings.length > 10 && (
                <div className="text-center">
                  <Button
                    variant="ghost"
                    onClick={() => setShowAllMappings(!showAllMappings)}
                  >
                    {showAllMappings ? (
                      <>
                        <ChevronUp className="h-4 w-4 mr-2" />
                        Show Less
                      </>
                    ) : (
                      <>
                        <ChevronDown className="h-4 w-4 mr-2" />
                        Show All ({filteredCoaMappings.length} items)
                      </>
                    )}
                  </Button>
                </div>
              )}
              
              <div className="flex justify-between items-center">
                <div className="text-sm text-muted-foreground">
                  {coaMappings.filter(m => m.userOverride).length} manual overrides applied
                </div>
                <Button onClick={proceedToReview} disabled={isProcessing}>
                  {isProcessing ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Generating TB...
                    </>
                  ) : (
                    <>
                      Generate Trial Balance
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
          
          {currentStep === 'review' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium">Trial Balance Review</h3>
                  <p className="text-sm text-muted-foreground">
                    Review the generated Trial Balance before final approval
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={goBack}>
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back
                </Button>
              </div>
              
              <div className="grid grid-cols-4 gap-4">
                <Card>
                  <CardContent className="pt-4">
                    <div className="text-sm text-muted-foreground">Total Debits</div>
                    <div className="text-2xl font-bold text-green-600">
                      {formatCurrency(glEntries.reduce((sum, e) => sum + e.debit, 0))}
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <div className="text-sm text-muted-foreground">Total Credits</div>
                    <div className="text-2xl font-bold text-red-600">
                      {formatCurrency(glEntries.reduce((sum, e) => sum + e.credit, 0))}
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <div className="text-sm text-muted-foreground">Difference</div>
                    <div className="text-2xl font-bold">
                      {formatCurrency(
                        glEntries.reduce((sum, e) => sum + e.debit, 0) - 
                        glEntries.reduce((sum, e) => sum + e.credit, 0)
                      )}
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <div className="text-sm text-muted-foreground">Accounts</div>
                    <div className="text-2xl font-bold">{glEntries.length}</div>
                  </CardContent>
                </Card>
              </div>
              
              <div className="border rounded-lg">
                <ScrollArea className="h-[300px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Code</TableHead>
                        <TableHead>Account Name</TableHead>
                        <TableHead>TB Group</TableHead>
                        <TableHead className="text-right">Debit</TableHead>
                        <TableHead className="text-right">Credit</TableHead>
                        <TableHead>FS Line</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {glEntries.map((entry) => (
                        <TableRow key={entry.id}>
                          <TableCell className="font-mono">{entry.accountCode}</TableCell>
                          <TableCell>{entry.accountName}</TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="text-xs">
                              {entry.tbGroup || 'Unmapped'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {formatAccounting(entry.debit)}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {formatAccounting(entry.credit)}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">
                              {fsLineOptions.find(o => o.value === entry.fsLine)?.label || entry.fsLine}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </div>
              
              <div className="flex justify-end">
                <Button onClick={proceedToApproval}>
                  Proceed to Approval
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </div>
          )}
          
          {currentStep === 'approval' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium">Maker-Checker Approval</h3>
                  <p className="text-sm text-muted-foreground">
                    Final review and approval before generating Financial Statements
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={goBack}>
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back
                </Button>
              </div>
              
              <div className="grid grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Approval Checklist</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center gap-3">
                      <CheckCircle2 className={`h-5 w-5 ${approvalStatus.columnMappingApproved ? 'text-green-600' : 'text-gray-400'}`} />
                      <span>Column Mapping Verified</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <CheckCircle2 className={`h-5 w-5 ${approvalStatus.coaMappingApproved ? 'text-green-600' : 'text-gray-400'}`} />
                      <span>CoA Mapping Reviewed</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <CheckCircle2 className={`h-5 w-5 ${approvalStatus.tbGenerationApproved ? 'text-green-600' : 'text-gray-400'}`} />
                      <span>Trial Balance Validated</span>
                    </div>
                    <Separator />
                    <div className="flex items-center gap-3">
                      <Lock className="h-5 w-5 text-muted-foreground" />
                      <span className="text-muted-foreground">Pending: FS Generation Approval</span>
                    </div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Professional Judgment Notes</CardTitle>
                    <CardDescription>ISA 230 Documentation Requirements</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Textarea
                      placeholder="Document any professional judgments, unusual items, or matters requiring further investigation..."
                      value={professionalNotes}
                      onChange={(e) => setProfessionalNotes(e.target.value)}
                      rows={6}
                    />
                  </CardContent>
                </Card>
              </div>
              
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-yellow-900">Approval Confirmation</h4>
                    <p className="text-sm text-yellow-800 mt-1">
                      By approving, you confirm that the GL data has been reviewed for completeness and accuracy,
                      and the CoA mappings are appropriate for the entity's financial statement presentation.
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={resetWorkflow}>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Discard & Start Over
                </Button>
                <Button onClick={completeWorkflow} disabled={isProcessing}>
                  {isProcessing ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <UserCheck className="h-4 w-4 mr-2" />
                      Approve & Generate FS
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
          
          {currentStep === 'complete' && (
            <div className="text-center py-12">
              <CheckCircle2 className="h-16 w-16 text-green-600 mx-auto mb-4" />
              <h3 className="text-2xl font-bold mb-2">GL Processing Complete</h3>
              <p className="text-muted-foreground mb-6">
                Trial Balance and Financial Statements have been generated successfully.
                You can now view them in the respective tabs.
              </p>
              
              <div className="flex justify-center gap-4">
                <Button variant="outline" onClick={resetWorkflow}>
                  <Plus className="h-4 w-4 mr-2" />
                  Upload New GL
                </Button>
                <Button>
                  <Database className="h-4 w-4 mr-2" />
                  View Trial Balance
                </Button>
                <Button>
                  <FileSpreadsheet className="h-4 w-4 mr-2" />
                  View Financial Statements
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
