import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { 
  Lock, 
  CheckCircle2, 
  Circle, 
  AlertTriangle, 
  ChevronDown, 
  ChevronRight,
  FileText,
  Upload,
  Lightbulb,
  Shield,
  Target,
  Plus,
  XCircle
} from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';

interface MappedProcedure {
  id: string;
  ref: string;
  type: 'TOC' | 'TOD' | 'ANALYTICS';
  description: string;
  isaReference: string;
  mandatory: boolean;
  locked: boolean;
  linkedRiskIds: string[];
  status: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED' | 'BLOCKED';
  evidenceRequired: {
    id: string;
    evidenceType: string;
    description: string;
    status: string;
    uploadedCount: number;
    requiredCount: number;
  }[];
}

interface RiskCoverage {
  totalRisks: number;
  coveredRisks: number;
  coveragePercentage: number;
  uncoveredRisks: { riskId: string; description: string; missingProcedure: string }[];
  isComplete: boolean;
}

interface AISuggestion {
  type: string;
  message: string;
  recommendation: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  isaReference?: string;
  aiConfidence: number;
}

interface FSHeadProcedureMapping {
  fsHeadId: string;
  fsHeadName: string;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  riskLocked: boolean;
  mandatoryProcedures: MappedProcedure[];
  optionalProcedures: MappedProcedure[];
  completedCount: number;
  totalMandatory: number;
  riskCoverage: RiskCoverage;
  canComplete: boolean;
  blockers: string[];
}

interface FSHeadProcedureSelectorProps {
  fsHeadId: string;
  onProcedureSelect?: (procedure: MappedProcedure) => void;
}

export function FSHeadProcedureSelector({ fsHeadId, onProcedureSelect }: FSHeadProcedureSelectorProps) {
  const [expandedProcedure, setExpandedProcedure] = useState<string | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [selectedOptionalProcedure, setSelectedOptionalProcedure] = useState<MappedProcedure | null>(null);
  const [justification, setJustification] = useState('');
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery<{
    mapping: FSHeadProcedureMapping;
    risks: any[];
    aiSuggestions: AISuggestion[];
    template: any;
  }>({
    queryKey: ['/api/risk-procedure/fs-head', fsHeadId, 'procedure-mapping'],
    enabled: !!fsHeadId,
  });

  const addProcedureMutation = useMutation({
    mutationFn: async (data: { procedureRef: string; procedureType: string; justification: string }) => {
      return apiRequest('POST', `/api/risk-procedure/fs-head/${fsHeadId}/add-procedure`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/risk-procedure/fs-head', fsHeadId] });
      setShowAddDialog(false);
      setJustification('');
      setSelectedOptionalProcedure(null);
    }
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center gap-2">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
            <span className="text-muted-foreground">Loading procedure mapping...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !data) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-2 text-destructive">
            <XCircle className="h-4 w-4" />
            <span>Failed to load procedure mapping</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  const { mapping, aiSuggestions } = data;
  const progressPercentage = mapping.totalMandatory > 0 
    ? Math.round((mapping.completedCount / mapping.totalMandatory) * 100) 
    : 0;

  const getRiskLevelBadge = (level: string) => {
    switch (level) {
      case 'HIGH':
        return <Badge variant="destructive">HIGH</Badge>;
      case 'MEDIUM':
        return <Badge variant="secondary" className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200">MEDIUM</Badge>;
      case 'LOW':
        return <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200">LOW</Badge>;
      default:
        return <Badge variant="outline">{level}</Badge>;
    }
  };

  const getProcedureTypeBadge = (type: string) => {
    switch (type) {
      case 'TOC':
        return <Badge variant="outline" className="bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">TOC</Badge>;
      case 'TOD':
        return <Badge variant="outline" className="bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">TOD</Badge>;
      case 'ANALYTICS':
        return <Badge variant="outline" className="bg-cyan-50 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300">Analytics</Badge>;
      default:
        return <Badge variant="outline">{type}</Badge>;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'IN_PROGRESS':
        return <Circle className="h-4 w-4 text-amber-500 fill-amber-200" />;
      case 'BLOCKED':
        return <XCircle className="h-4 w-4 text-destructive" />;
      default:
        return <Circle className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const handleAddOptionalProcedure = (procedure: MappedProcedure) => {
    setSelectedOptionalProcedure(procedure);
    setShowAddDialog(true);
  };

  const submitAddProcedure = () => {
    if (!selectedOptionalProcedure || justification.length < 10) return;
    
    addProcedureMutation.mutate({
      procedureRef: selectedOptionalProcedure.ref,
      procedureType: selectedOptionalProcedure.type,
      justification,
    });
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5" />
                {mapping.fsHeadName}
              </CardTitle>
              <CardDescription className="mt-1">Procedure mapping based on risk assessment</CardDescription>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Risk Level:</span>
                {getRiskLevelBadge(mapping.riskLevel)}
                {mapping.riskLocked && <Lock className="h-3 w-3 text-muted-foreground" />}
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Mandatory Procedures: {mapping.completedCount} / {mapping.totalMandatory}</span>
              <span className="font-medium">{progressPercentage}%</span>
            </div>
            <Progress value={progressPercentage} className="h-2" />
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Lock className="h-4 w-4" />
                Auto-Selected Procedures (Locked)
              </CardTitle>
              <CardDescription>These procedures are mandatory based on risk assessment and cannot be removed</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {mapping.mandatoryProcedures.map((proc) => (
                <Collapsible
                  key={proc.id}
                  open={expandedProcedure === proc.id}
                  onOpenChange={(open) => setExpandedProcedure(open ? proc.id : null)}
                >
                  <div className="border rounded-md">
                    <CollapsibleTrigger asChild>
                      <button
                        data-testid={`procedure-${proc.ref}`}
                        className="w-full p-3 flex items-center justify-between gap-3 hover-elevate text-left"
                        onClick={() => onProcedureSelect?.(proc)}
                      >
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          {getStatusIcon(proc.status)}
                          <Lock className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                          <span className="text-sm truncate">{proc.description}</span>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {getProcedureTypeBadge(proc.type)}
                          <span className="text-xs text-muted-foreground">{proc.isaReference}</span>
                          {expandedProcedure === proc.id ? (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          )}
                        </div>
                      </button>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="px-3 pb-3 pt-0 border-t">
                        <div className="pt-3 space-y-3">
                          <div>
                            <Label className="text-xs text-muted-foreground">Objective</Label>
                            <p className="text-sm">{proc.description}</p>
                          </div>
                          <div>
                            <Label className="text-xs text-muted-foreground">ISA Reference</Label>
                            <p className="text-sm">{proc.isaReference}</p>
                          </div>
                          <div>
                            <Label className="text-xs text-muted-foreground flex items-center gap-1">
                              <FileText className="h-3 w-3" />
                              Evidence Required
                            </Label>
                            <div className="mt-1 space-y-1">
                              {proc.evidenceRequired.length > 0 ? (
                                proc.evidenceRequired.map((ev) => (
                                  <div key={ev.id} className="flex items-center justify-between text-sm">
                                    <span>{ev.description}</span>
                                    <Badge variant={ev.uploadedCount > 0 ? 'default' : 'outline'} className="text-xs">
                                      {ev.uploadedCount > 0 ? (
                                        <span className="flex items-center gap-1">
                                          <CheckCircle2 className="h-3 w-3" />
                                          {ev.uploadedCount}
                                        </span>
                                      ) : (
                                        <span className="flex items-center gap-1">
                                          <Upload className="h-3 w-3" />
                                          Pending
                                        </span>
                                      )}
                                    </Badge>
                                  </div>
                                ))
                              ) : (
                                <p className="text-xs text-muted-foreground">No evidence slots configured</p>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </CollapsibleContent>
                  </div>
                </Collapsible>
              ))}
            </CardContent>
          </Card>

          {mapping.optionalProcedures.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Plus className="h-4 w-4" />
                  Optional Procedures
                </CardTitle>
                <CardDescription>Additional procedures that can be added with justification</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {mapping.optionalProcedures.map((proc) => (
                  <div
                    key={proc.id}
                    className="border rounded-md p-3 flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <Circle className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm truncate">{proc.description}</span>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {getProcedureTypeBadge(proc.type)}
                      <Button
                        data-testid={`add-procedure-${proc.ref}`}
                        variant="outline"
                        size="sm"
                        onClick={() => handleAddOptionalProcedure(proc)}
                      >
                        <Plus className="h-3 w-3 mr-1" />
                        Add
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Risk Coverage
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Coverage</span>
                  <Badge variant={mapping.riskCoverage.isComplete ? 'default' : 'destructive'}>
                    {mapping.riskCoverage.coveragePercentage}%
                  </Badge>
                </div>
                {mapping.riskCoverage.uncoveredRisks.length > 0 && (
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Uncovered Risks</Label>
                    {mapping.riskCoverage.uncoveredRisks.map((risk) => (
                      <div key={risk.riskId} className="text-sm p-2 bg-destructive/10 rounded border border-destructive/20">
                        <p className="font-medium text-destructive">{risk.description}</p>
                        <p className="text-xs text-muted-foreground mt-1">Missing: {risk.missingProcedure}</p>
                      </div>
                    ))}
                  </div>
                )}
                {mapping.riskCoverage.isComplete && (
                  <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                    <CheckCircle2 className="h-4 w-4" />
                    <span className="text-sm">All risks covered</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {aiSuggestions && aiSuggestions.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Lightbulb className="h-4 w-4" />
                  AI Suggestions
                </CardTitle>
                <CardDescription className="text-xs">AI-assisted - subject to professional judgment</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {aiSuggestions.map((suggestion, index) => (
                  <div
                    key={index}
                    className={`p-2 rounded border text-sm ${
                      suggestion.severity === 'CRITICAL'
                        ? 'bg-destructive/10 border-destructive/20'
                        : suggestion.severity === 'WARNING'
                        ? 'bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-800'
                        : 'bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800'
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      {suggestion.severity === 'CRITICAL' ? (
                        <AlertTriangle className="h-4 w-4 text-destructive flex-shrink-0 mt-0.5" />
                      ) : (
                        <Lightbulb className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                      )}
                      <div>
                        <p className="font-medium">{suggestion.message}</p>
                        <p className="text-xs text-muted-foreground mt-1">{suggestion.recommendation}</p>
                        {suggestion.isaReference && (
                          <Badge variant="outline" className="mt-2 text-xs">{suggestion.isaReference}</Badge>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {mapping.blockers.length > 0 && (
            <Card className="border-destructive">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2 text-destructive">
                  <XCircle className="h-4 w-4" />
                  Completion Blockers
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {mapping.blockers.map((blocker, index) => (
                    <li key={index} className="text-sm flex items-start gap-2">
                      <AlertTriangle className="h-4 w-4 text-destructive flex-shrink-0 mt-0.5" />
                      {blocker}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Optional Procedure</DialogTitle>
            <DialogDescription>
              {selectedOptionalProcedure?.description}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="justification">Justification (required)</Label>
              <Textarea
                id="justification"
                data-testid="input-procedure-justification"
                placeholder="Explain why this additional procedure is necessary..."
                value={justification}
                onChange={(e) => setJustification(e.target.value)}
                className="mt-1"
                rows={4}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Minimum 10 characters required
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Cancel
            </Button>
            <Button
              data-testid="button-confirm-add-procedure"
              onClick={submitAddProcedure}
              disabled={justification.length < 10 || addProcedureMutation.isPending}
            >
              {addProcedureMutation.isPending ? 'Adding...' : 'Add Procedure'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
