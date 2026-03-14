import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ModuleTemplates } from "@/components/module-templates";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Building2,
  Shield,
  ShieldCheck,
  Users,
  FileText,
  AlertTriangle,
  ClipboardCheck,
  Plus,
  Lock,
  CheckCircle2,
  XCircle,
  Eye,
  Edit,
  GraduationCap,
  Scale,
  Target,
  BarChart3,
  Loader2,
  Save,
  Library,
  Gavel,
  Activity,
  ChevronRight,
  TrendingUp,
  CircleDot,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { fetchWithAuth } from "@/lib/fetchWithAuth";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { formatAccounting } from '@/lib/formatters';

const apiRequest = async (url: string, options?: RequestInit) => {
  const res = await fetchWithAuth(url, {
    ...options,
    headers: { "Content-Type": "application/json", ...options?.headers },
  });
  if (!res.ok) {
    const contentType = res.headers.get("content-type");
    if (contentType?.includes("application/json")) {
      const err = await res.json().catch(() => ({ error: "Request failed" }));
      throw new Error(err.error || "Request failed");
    } else {
      const text = await res.text();
      console.error("Non-JSON error response:", { status: res.status, url, text: text.substring(0, 200) });
      throw new Error(`Request failed with status ${res.status}`);
    }
  }
  return res.json();
};

export default function FirmWideControls() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isAdmin = user?.role === "FIRM_ADMIN" || user?.role === "PARTNER";
  const isManager = user?.role === "MANAGER" || isAdmin;

  // Initialize activeTab from localStorage to preserve state during page refresh
  const [activeTab, setActiveTab] = useState(() => {
    try {
      const saved = localStorage.getItem('firm-controls-activeTab');
      return saved || "dashboard";
    } catch {
      return "dashboard";
    }
  });

  // Persist activeTab changes to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('firm-controls-activeTab', activeTab);
    } catch (error) {
      console.error('Failed to save active tab to localStorage:', error);
    }
  }, [activeTab]);

  const { data: dashboard, isLoading: dashboardLoading } = useQuery({
    queryKey: ["/api/isqm/dashboard"],
    queryFn: () => apiRequest("/api/isqm/dashboard"),
  });

  const { data: complianceDashboard } = useQuery({
    queryKey: ["/api/firm-wide-controls/compliance-dashboard"],
    queryFn: () => apiRequest("/api/firm-wide-controls/compliance-dashboard"),
  });

  const { data: fwcObjectives } = useQuery({
    queryKey: ["/api/firm-wide-controls/quality-objectives"],
    queryFn: () => apiRequest("/api/firm-wide-controls/quality-objectives"),
  });

  const { data: fwcRisks } = useQuery({
    queryKey: ["/api/firm-wide-controls/quality-risks"],
    queryFn: () => apiRequest("/api/firm-wide-controls/quality-risks"),
  });

  const { data: fwcResponses } = useQuery({
    queryKey: ["/api/firm-wide-controls/quality-responses"],
    queryFn: () => apiRequest("/api/firm-wide-controls/quality-responses"),
  });

  const { data: fwcDeficiencies } = useQuery({
    queryKey: ["/api/firm-wide-controls/deficiencies"],
    queryFn: () => apiRequest("/api/firm-wide-controls/deficiencies"),
  });

  const { data: fwcRemediations } = useQuery({
    queryKey: ["/api/firm-wide-controls/remediations"],
    queryFn: () => apiRequest("/api/firm-wide-controls/remediations"),
  });

  const { data: fwcMonitoringReviews } = useQuery({
    queryKey: ["/api/firm-wide-controls/monitoring-reviews"],
    queryFn: () => apiRequest("/api/firm-wide-controls/monitoring-reviews"),
  });

  const { data: eqcrPolicy } = useQuery({
    queryKey: ["/api/firm-wide-controls/eqcr-policy"],
    queryFn: () => apiRequest("/api/firm-wide-controls/eqcr-policy"),
  });

  const { data: eqcrAssignments } = useQuery({
    queryKey: ["/api/firm-wide-controls/eqcr-assignments"],
    queryFn: () => apiRequest("/api/firm-wide-controls/eqcr-assignments"),
  });

  const { data: policyDocuments } = useQuery({
    queryKey: ["/api/firm-wide-controls/policy-documents"],
    queryFn: () => apiRequest("/api/firm-wide-controls/policy-documents"),
  });

  const { data: isqmVersions } = useQuery({
    queryKey: ["/api/firm-wide-controls/isqm-versions"],
    queryFn: () => apiRequest("/api/firm-wide-controls/isqm-versions"),
  });

  const { data: activityLogs } = useQuery({
    queryKey: ["/api/firm-wide-controls/activity-logs"],
    queryFn: () => apiRequest("/api/firm-wide-controls/activity-logs"),
    enabled: isManager,
  });

  const [showAddFwcObjectiveDialog, setShowAddFwcObjectiveDialog] = useState(false);
  const [showAddFwcRiskDialog, setShowAddFwcRiskDialog] = useState(false);
  const [showAddFwcResponseDialog, setShowAddFwcResponseDialog] = useState(false);
  const [showAddFwcDeficiencyDialog, setShowAddFwcDeficiencyDialog] = useState(false);
  const [showAddRemediationDialog, setShowAddRemediationDialog] = useState(false);
  const [showAddEqcrDialog, setShowAddEqcrDialog] = useState(false);
  const [showAddPolicyDocDialog, setShowAddPolicyDocDialog] = useState(false);
  const [showAddVersionDialog, setShowAddVersionDialog] = useState(false);
  const [showAddMonitoringDialog, setShowAddMonitoringDialog] = useState(false);
  const [selectedComponent, setSelectedComponent] = useState<string>("governance");

  const [fwcObjectiveForm, setFwcObjectiveForm] = useState({ componentType: "governance", title: "", description: "" });
  const [fwcRiskForm, setFwcRiskForm] = useState({ objectiveId: "", riskTitle: "", riskDescription: "", likelihood: "medium", impact: "medium", riskRating: "medium" });
  const [fwcResponseForm, setFwcResponseForm] = useState({ objectiveId: "", riskId: "", responseTitle: "", designDescription: "", implementationStatus: "planned" });
  const [fwcDeficiencyForm, setFwcDeficiencyForm] = useState({ severity: "medium", deficiencyText: "", rootCause: "", dueAt: "" });
  const [remediationForm, setRemediationForm] = useState({ deficiencyId: "", actionText: "", deadlineAt: "" });
  const [eqcrForm, setEqcrForm] = useState({ eqcrPartnerUserId: "", engagementId: "" });
  const [policyDocForm, setPolicyDocForm] = useState({ docType: "quality_manual", title: "", version: "1.0" });
  const [versionForm, setVersionForm] = useState({ manualVersion: "", changeSummary: "" });
  const [reviewCycleForm, setReviewCycleForm] = useState({ reviewType: "internal_inspection", cycleCode: new Date().getFullYear().toString(), status: "planned" });

  const createFwcObjectiveMutation = useMutation({
    mutationFn: (data: any) => apiRequest("/api/firm-wide-controls/quality-objectives", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/firm-wide-controls/quality-objectives"] });
      queryClient.invalidateQueries({ queryKey: ["/api/firm-wide-controls/compliance-dashboard"] });
      toast({ title: "Success", description: "Quality objective created" });
      setShowAddFwcObjectiveDialog(false);
      setFwcObjectiveForm({ componentType: "governance", title: "", description: "" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const createFwcRiskMutation = useMutation({
    mutationFn: (data: any) => apiRequest("/api/firm-wide-controls/quality-risks", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/firm-wide-controls/quality-risks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/firm-wide-controls/compliance-dashboard"] });
      toast({ title: "Success", description: "Quality risk identified" });
      setShowAddFwcRiskDialog(false);
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const createFwcResponseMutation = useMutation({
    mutationFn: (data: any) => apiRequest("/api/firm-wide-controls/quality-responses", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/firm-wide-controls/quality-responses"] });
      queryClient.invalidateQueries({ queryKey: ["/api/firm-wide-controls/compliance-dashboard"] });
      toast({ title: "Success", description: "Response created" });
      setShowAddFwcResponseDialog(false);
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const createFwcDeficiencyMutation = useMutation({
    mutationFn: (data: any) => apiRequest("/api/firm-wide-controls/deficiencies", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/firm-wide-controls/deficiencies"] });
      queryClient.invalidateQueries({ queryKey: ["/api/firm-wide-controls/compliance-dashboard"] });
      toast({ title: "Success", description: "Deficiency recorded" });
      setShowAddFwcDeficiencyDialog(false);
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const createRemediationMutation = useMutation({
    mutationFn: (data: any) => apiRequest("/api/firm-wide-controls/remediations", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/firm-wide-controls/remediations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/firm-wide-controls/compliance-dashboard"] });
      toast({ title: "Success", description: "Remediation action created" });
      setShowAddRemediationDialog(false);
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const createEqcrAssignmentMutation = useMutation({
    mutationFn: (data: any) => apiRequest("/api/firm-wide-controls/eqcr-assignments", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/firm-wide-controls/eqcr-assignments"] });
      toast({ title: "Success", description: "EQCR assignment created" });
      setShowAddEqcrDialog(false);
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const createPolicyDocMutation = useMutation({
    mutationFn: (data: any) => apiRequest("/api/firm-wide-controls/policy-documents", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/firm-wide-controls/policy-documents"] });
      toast({ title: "Success", description: "Policy document added" });
      setShowAddPolicyDocDialog(false);
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const createVersionMutation = useMutation({
    mutationFn: (data: any) => apiRequest("/api/firm-wide-controls/isqm-versions", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/firm-wide-controls/isqm-versions"] });
      toast({ title: "Success", description: "Version record created" });
      setShowAddVersionDialog(false);
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const createMonitoringReviewMutation = useMutation({
    mutationFn: (data: any) => apiRequest("/api/firm-wide-controls/monitoring-reviews", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/firm-wide-controls/monitoring-reviews"] });
      toast({ title: "Success", description: "Monitoring review created" });
      setShowAddMonitoringDialog(false);
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const updateFwcObjectiveMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => apiRequest(`/api/firm-wide-controls/quality-objectives/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/firm-wide-controls/quality-objectives"] });
      queryClient.invalidateQueries({ queryKey: ["/api/firm-wide-controls/compliance-dashboard"] });
      toast({ title: "Success", description: "Objective updated" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const updateFwcRiskMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => apiRequest(`/api/firm-wide-controls/quality-risks/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/firm-wide-controls/quality-risks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/firm-wide-controls/compliance-dashboard"] });
      toast({ title: "Success", description: "Risk updated" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const updateFwcResponseMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => apiRequest(`/api/firm-wide-controls/quality-responses/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/firm-wide-controls/quality-responses"] });
      queryClient.invalidateQueries({ queryKey: ["/api/firm-wide-controls/compliance-dashboard"] });
      toast({ title: "Success", description: "Response updated" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const { data: affirmations } = useQuery({
    queryKey: ["/api/isqm/affirmations"],
    queryFn: () => apiRequest("/api/isqm/affirmations"),
  });

  const { data: declarations } = useQuery({
    queryKey: ["/api/isqm/independence/declarations"],
    queryFn: () => apiRequest("/api/isqm/independence/declarations"),
  });

  const { data: financialInterests } = useQuery({
    queryKey: ["/api/isqm/financial-interests"],
    queryFn: () => apiRequest("/api/isqm/financial-interests"),
  });

  const { data: giftsHospitality } = useQuery({
    queryKey: ["/api/isqm/gifts-hospitality"],
    queryFn: () => apiRequest("/api/isqm/gifts-hospitality"),
  });

  const { data: ethicsBreaches } = useQuery({
    queryKey: ["/api/isqm/ethics-breaches"],
    queryFn: () => apiRequest("/api/isqm/ethics-breaches"),
    enabled: isManager,
  });

  const { data: trainingData } = useQuery({
    queryKey: ["/api/isqm/training"],
    queryFn: () => apiRequest("/api/isqm/training"),
  });

  const { data: competencies } = useQuery({
    queryKey: ["/api/isqm/competency"],
    queryFn: () => apiRequest("/api/isqm/competency"),
  });

  const { data: monitoringPlans } = useQuery({
    queryKey: ["/api/isqm/monitoring/plans"],
    queryFn: () => apiRequest("/api/isqm/monitoring/plans"),
    enabled: isManager,
  });

  const { data: deficiencies } = useQuery({
    queryKey: ["/api/isqm/deficiencies"],
    queryFn: () => apiRequest("/api/isqm/deficiencies"),
    enabled: isManager,
  });

  const { data: qualityObjectives } = useQuery({
    queryKey: ["/api/isqm/quality-objectives"],
    queryFn: () => apiRequest("/api/isqm/quality-objectives"),
  });

  const { data: policies } = useQuery({
    queryKey: ["/api/isqm/policies"],
    queryFn: () => apiRequest("/api/isqm/policies"),
  });

  const { data: consultations } = useQuery({
    queryKey: ["/api/isqm/consultations"],
    queryFn: () => apiRequest("/api/isqm/consultations"),
  });

  const createAffirmationMutation = useMutation({
    mutationFn: (data: any) => apiRequest("/api/isqm/affirmations", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/isqm/affirmations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/isqm/dashboard"] });
      toast({ title: "Success", description: "Leadership affirmation submitted" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const createDeclarationMutation = useMutation({
    mutationFn: (data: any) => apiRequest("/api/isqm/independence/declarations", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/isqm/independence/declarations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/isqm/dashboard"] });
      toast({ title: "Success", description: "Independence declaration submitted" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const createFinancialInterestMutation = useMutation({
    mutationFn: (data: any) => apiRequest("/api/isqm/financial-interests", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/isqm/financial-interests"] });
      queryClient.invalidateQueries({ queryKey: ["/api/isqm/dashboard"] });
      toast({ title: "Success", description: "Financial interest recorded" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const createGiftMutation = useMutation({
    mutationFn: (data: any) => apiRequest("/api/isqm/gifts-hospitality", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/isqm/gifts-hospitality"] });
      toast({ title: "Success", description: "Gift/Hospitality record added" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const createTrainingMutation = useMutation({
    mutationFn: (data: any) => apiRequest("/api/isqm/training", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/isqm/training"] });
      queryClient.invalidateQueries({ queryKey: ["/api/isqm/dashboard"] });
      toast({ title: "Success", description: "Training record added" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const createDeficiencyMutation = useMutation({
    mutationFn: (data: any) => apiRequest("/api/isqm/deficiencies", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/isqm/deficiencies"] });
      queryClient.invalidateQueries({ queryKey: ["/api/isqm/dashboard"] });
      toast({ title: "Success", description: "Deficiency recorded" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const createConsultationMutation = useMutation({
    mutationFn: (data: any) => apiRequest("/api/isqm/consultations", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/isqm/consultations"] });
      toast({ title: "Success", description: "Consultation recorded" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const createEthicsBreachMutation = useMutation({
    mutationFn: (data: any) => apiRequest("/api/isqm/ethics-breaches", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/isqm/ethics-breaches"] });
      queryClient.invalidateQueries({ queryKey: ["/api/isqm/dashboard"] });
      toast({ title: "Success", description: "Ethics issue recorded" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const createResourceMutation = useMutation({
    mutationFn: (data: any) => apiRequest("/api/isqm/competency", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/isqm/competency"] });
      toast({ title: "Success", description: "Resource assessment recorded" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const createMonitoringMutation = useMutation({
    mutationFn: (data: any) => apiRequest("/api/isqm/monitoring/plans", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/isqm/monitoring/plans"] });
      toast({ title: "Success", description: "Monitoring plan created" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const createObjectiveMutation = useMutation({
    mutationFn: (data: any) => apiRequest("/api/isqm/quality-objectives", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/isqm/quality-objectives"] });
      toast({ title: "Success", description: "Quality objective added" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const createPolicyMutation = useMutation({
    mutationFn: (data: any) => apiRequest("/api/isqm/policies", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/isqm/policies"] });
      toast({ title: "Success", description: "Policy document added" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  // Update mutations
  const updateDeclarationMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => apiRequest(`/api/isqm/independence/declarations/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/isqm/independence/declarations"] });
      toast({ title: "Success", description: "Declaration updated" });
      setShowViewDeclarationDialog(false);
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const updateFinancialInterestMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => apiRequest(`/api/isqm/financial-interests/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/isqm/financial-interests"] });
      toast({ title: "Success", description: "Financial interest updated" });
      setShowViewFinancialInterestDialog(false);
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const updateGiftMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => apiRequest(`/api/isqm/gifts-hospitality/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/isqm/gifts-hospitality"] });
      toast({ title: "Success", description: "Gift/Hospitality updated" });
      setShowViewGiftDialog(false);
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const updateEthicsBreachMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => apiRequest(`/api/isqm/ethics-breaches/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/isqm/ethics-breaches"] });
      toast({ title: "Success", description: "Ethics breach updated" });
      setShowViewEthicsBreachDialog(false);
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const updateResourceMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => apiRequest(`/api/isqm/competency/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/isqm/competency"] });
      toast({ title: "Success", description: "Assessment updated" });
      setShowViewResourceDialog(false);
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const updateTrainingMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => apiRequest(`/api/isqm/training/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/isqm/training"] });
      toast({ title: "Success", description: "Training record updated" });
      setShowViewTrainingDialog(false);
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const updateMonitoringMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => apiRequest(`/api/isqm/monitoring/plans/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/isqm/monitoring/plans"] });
      toast({ title: "Success", description: "Monitoring plan updated" });
      setShowViewMonitoringDialog(false);
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const updateDeficiencyMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => apiRequest(`/api/isqm/deficiencies/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/isqm/deficiencies"] });
      toast({ title: "Success", description: "Deficiency updated" });
      setShowViewDeficiencyDialog(false);
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const updateObjectiveMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => apiRequest(`/api/isqm/quality-objectives/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/isqm/quality-objectives"] });
      toast({ title: "Success", description: "Objective updated" });
      setShowViewObjectiveDialog(false);
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const updatePolicyMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => apiRequest(`/api/isqm/policies/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/isqm/policies"] });
      toast({ title: "Success", description: "Policy updated" });
      setShowViewPolicyDialog(false);
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const [showAffirmationDialog, setShowAffirmationDialog] = useState(false);
  const [showDeclarationDialog, setShowDeclarationDialog] = useState(false);
  const [showViewDeclarationDialog, setShowViewDeclarationDialog] = useState(false);
  const [selectedDeclaration, setSelectedDeclaration] = useState<any>(null);
  const [isEditingDeclaration, setIsEditingDeclaration] = useState(false);
  const [showFinancialInterestDialog, setShowFinancialInterestDialog] = useState(false);
  const [showViewFinancialInterestDialog, setShowViewFinancialInterestDialog] = useState(false);
  const [selectedFinancialInterest, setSelectedFinancialInterest] = useState<any>(null);
  const [isEditingFinancialInterest, setIsEditingFinancialInterest] = useState(false);
  const [showGiftDialog, setShowGiftDialog] = useState(false);
  const [showViewGiftDialog, setShowViewGiftDialog] = useState(false);
  const [selectedGift, setSelectedGift] = useState<any>(null);
  const [isEditingGift, setIsEditingGift] = useState(false);
  const [showTrainingDialog, setShowTrainingDialog] = useState(false);
  const [showViewTrainingDialog, setShowViewTrainingDialog] = useState(false);
  const [selectedTraining, setSelectedTraining] = useState<any>(null);
  const [isEditingTraining, setIsEditingTraining] = useState(false);
  const [showDeficiencyDialog, setShowDeficiencyDialog] = useState(false);
  const [showViewDeficiencyDialog, setShowViewDeficiencyDialog] = useState(false);
  const [selectedDeficiency, setSelectedDeficiency] = useState<any>(null);
  const [isEditingDeficiency, setIsEditingDeficiency] = useState(false);
  const [showConsultationDialog, setShowConsultationDialog] = useState(false);
  const [showEthicsBreachDialog, setShowEthicsBreachDialog] = useState(false);
  const [showViewEthicsBreachDialog, setShowViewEthicsBreachDialog] = useState(false);
  const [selectedEthicsBreach, setSelectedEthicsBreach] = useState<any>(null);
  const [isEditingEthicsBreach, setIsEditingEthicsBreach] = useState(false);
  const [showResourceDialog, setShowResourceDialog] = useState(false);
  const [showViewResourceDialog, setShowViewResourceDialog] = useState(false);
  const [selectedResource, setSelectedResource] = useState<any>(null);
  const [isEditingResource, setIsEditingResource] = useState(false);
  const [showMonitoringDialog, setShowMonitoringDialog] = useState(false);
  const [showViewMonitoringDialog, setShowViewMonitoringDialog] = useState(false);
  const [selectedMonitoring, setSelectedMonitoring] = useState<any>(null);
  const [isEditingMonitoring, setIsEditingMonitoring] = useState(false);
  const [showObjectiveDialog, setShowObjectiveDialog] = useState(false);
  const [showViewObjectiveDialog, setShowViewObjectiveDialog] = useState(false);
  const [selectedObjective, setSelectedObjective] = useState<any>(null);
  const [isEditingObjective, setIsEditingObjective] = useState(false);
  const [showPolicyDialog, setShowPolicyDialog] = useState(false);
  const [showViewPolicyDialog, setShowViewPolicyDialog] = useState(false);
  const [selectedPolicy, setSelectedPolicy] = useState<any>(null);
  const [isEditingPolicy, setIsEditingPolicy] = useState(false);

  const [affirmationForm, setAffirmationForm] = useState({
    affirmationType: "ANNUAL",
    affirmationText: "I hereby affirm my commitment to the firm's quality management system and ethical standards as defined by ISQM 1/2 and IESBA Code of Ethics.",
  });

  const [declarationForm, setDeclarationForm] = useState({
    declarationType: "Annual",
    declarationYear: new Date().getFullYear(),
    hasFinancialInterest: false,
    hasFamilyRelationship: false,
    hasBusinessRelationship: false,
    hasPreviousEmployment: false,
    safeguardsImplemented: "",
    isIndependent: true,
  });

  const [financialInterestForm, setFinancialInterestForm] = useState({
    entityName: "",
    natureOfInterest: "SHARES" as string,
    relationshipType: "DIRECT" as string,
    estimatedValue: 0,
    acquisitionDate: format(new Date(), "yyyy-MM-dd"),
    status: "ACTIVE" as string,
    isAuditClient: false,
  });

  const [giftForm, setGiftForm] = useState({
    dateReceived: format(new Date(), "yyyy-MM-dd"),
    description: "",
    estimatedValue: 0,
    giverName: "",
    giverDesignation: "",
    giverRelationship: "",
    actionTaken: "RETAINED" as string,
    remarks: "",
  });

  const [trainingForm, setTrainingForm] = useState({
    trainingDate: format(new Date(), "yyyy-MM-dd"),
    trainingType: "TECHNICAL" as const,
    topic: "",
    provider: "",
    durationHours: 1,
    cpdHoursClaimed: 1,
  });

  const [deficiencyForm, setDeficiencyForm] = useState({
    sourceType: "MONITORING" as const,
    deficiencyDescription: "",
    rootCauseAnalysis: "",
    severity: "MINOR_LEVEL" as const,
    pervasiveness: "LIMITED" as const,
    targetResolutionDate: "",
  });

  const [consultationForm, setConsultationForm] = useState({
    consultationDate: format(new Date(), "yyyy-MM-dd"),
    consultationTopic: "",
    issueDescription: "",
    consultationConclusion: "",
  });

  const [ethicsBreachForm, setEthicsBreachForm] = useState({
    breachType: "CONFLICT_OF_INTEREST",
    description: "",
    personsInvolved: "",
    reportedDate: "",
    status: "OPEN" as string,
    resolutionDate: "",
    actionTaken: "",
    remediation: "",
  });

  const [resourceForm, setResourceForm] = useState({
    userId: "",
    technicalKnowledgeRating: "COMPETENT" as string,
    industryExperienceYears: 0,
    trainingNeedsIdentified: "",
    competencyGapAnalysis: "",
    developmentPlan: "",
    nextReviewDate: "",
  });

  const [monitoringForm, setMonitoringForm] = useState({
    planYear: new Date().getFullYear(),
    scopeOfMonitoring: "",
    monitoringMethodology: "",
    resourcesAllocated: "",
    plannedStartDate: "",
    plannedEndDate: "",
  });

  const [objectiveForm, setObjectiveForm] = useState({
    isqmComponent: "GOVERNANCE" as const,
    objectiveCode: "",
    objectiveDescription: "",
    isMandatory: true,
    effectiveFrom: format(new Date(), "yyyy-MM-dd"),
  });

  const [policyForm, setPolicyForm] = useState({
    policyCategory: "QUALITY_MANAGEMENT",
    policyName: "",
    policyNumber: "",
    versionNumber: "1.0",
    effectiveDate: format(new Date(), "yyyy-MM-dd"),
    reviewDate: "",
  });

  // Effect to populate edit forms when selectedItem changes
  useEffect(() => {
    if (isEditingDeclaration && selectedDeclaration) {
      setDeclarationForm({
        declarationType: selectedDeclaration.declarationType || "ANNUAL",
        declarationYear: selectedDeclaration.declarationYear || new Date().getFullYear(),
        hasFinancialInterest: selectedDeclaration.hasFinancialInterest || false,
        hasFamilyRelationship: selectedDeclaration.hasFamilyRelationship || false,
        hasBusinessRelationship: selectedDeclaration.hasBusinessRelationship || false,
        hasPreviousEmployment: selectedDeclaration.hasPreviousEmployment || false,
        safeguardsImplemented: selectedDeclaration.safeguardsImplemented || "",
        isIndependent: selectedDeclaration.isIndependent || false,
      });
    }
  }, [isEditingDeclaration, selectedDeclaration]);

  useEffect(() => {
    if (isEditingFinancialInterest && selectedFinancialInterest) {
      setFinancialInterestForm({
        entityName: selectedFinancialInterest.entityName || "",
        natureOfInterest: selectedFinancialInterest.natureOfInterest || "SHARES",
        relationshipType: selectedFinancialInterest.relationshipType || "DIRECT",
        estimatedValue: selectedFinancialInterest.estimatedValue || selectedFinancialInterest.approximateValue || 0,
        acquisitionDate: selectedFinancialInterest.acquisitionDate || format(new Date(), "yyyy-MM-dd"),
        status: selectedFinancialInterest.status || "ACTIVE",
        isAuditClient: selectedFinancialInterest.isAuditClient || false,
      });
    }
  }, [isEditingFinancialInterest, selectedFinancialInterest]);

  useEffect(() => {
    if (isEditingGift && selectedGift) {
      setGiftForm({
        description: selectedGift.description || "",
        dateReceived: selectedGift.dateReceived || format(new Date(), "yyyy-MM-dd"),
        estimatedValue: selectedGift.estimatedValue || 0,
        giverName: selectedGift.giverName || "",
        giverDesignation: selectedGift.giverDesignation || "",
        giverRelationship: selectedGift.giverRelationship || "",
        actionTaken: selectedGift.actionTaken || "ACCEPTED",
        remarks: selectedGift.remarks || "",
      });
    }
  }, [isEditingGift, selectedGift]);

  useEffect(() => {
    if (isEditingEthicsBreach && selectedEthicsBreach) {
      setEthicsBreachForm({
        breachType: selectedEthicsBreach.breachType || "CONFLICT_OF_INTEREST",
        description: selectedEthicsBreach.description || "",
        personsInvolved: selectedEthicsBreach.personsInvolved || "",
        reportedDate: selectedEthicsBreach.reportedDate || "",
        status: selectedEthicsBreach.status || "OPEN",
        resolutionDate: selectedEthicsBreach.resolutionDate || "",
        actionTaken: selectedEthicsBreach.actionTaken || "",
        remediation: selectedEthicsBreach.remediation || "",
      });
    }
  }, [isEditingEthicsBreach, selectedEthicsBreach]);

  useEffect(() => {
    if (isEditingResource && selectedResource) {
      setResourceForm({
        userId: selectedResource.userId || "",
        technicalKnowledgeRating: selectedResource.technicalKnowledgeRating || "COMPETENT",
        industryExperienceYears: selectedResource.industryExperienceYears || 0,
        trainingNeedsIdentified: selectedResource.trainingNeedsIdentified || "",
        competencyGapAnalysis: selectedResource.competencyGapAnalysis || "",
        developmentPlan: selectedResource.developmentPlan || "",
        nextReviewDate: selectedResource.nextReviewDate || "",
      });
    }
  }, [isEditingResource, selectedResource]);

  useEffect(() => {
    if (isEditingTraining && selectedTraining) {
      setTrainingForm({
        trainingDate: selectedTraining.trainingDate || format(new Date(), "yyyy-MM-dd"),
        trainingType: selectedTraining.trainingType || "TECHNICAL",
        topic: selectedTraining.topic || "",
        provider: selectedTraining.provider || "",
        durationHours: typeof selectedTraining.durationHours === 'string' ? parseFloat(selectedTraining.durationHours) : (selectedTraining.durationHours || 0),
        cpdHoursClaimed: typeof selectedTraining.cpdHoursClaimed === 'string' ? parseFloat(selectedTraining.cpdHoursClaimed) : (selectedTraining.cpdHoursClaimed || 0),
      });
    }
  }, [isEditingTraining, selectedTraining]);

  useEffect(() => {
    if (isEditingMonitoring && selectedMonitoring) {
      setMonitoringForm({
        planYear: selectedMonitoring.planYear || new Date().getFullYear(),
        scopeOfMonitoring: selectedMonitoring.scopeOfMonitoring || "",
        monitoringMethodology: selectedMonitoring.monitoringMethodology || "",
        resourcesAllocated: selectedMonitoring.resourcesAllocated || "",
        plannedStartDate: selectedMonitoring.plannedStartDate || "",
        plannedEndDate: selectedMonitoring.plannedEndDate || "",
      });
    }
  }, [isEditingMonitoring, selectedMonitoring]);

  useEffect(() => {
    if (isEditingDeficiency && selectedDeficiency) {
      setDeficiencyForm({
        sourceType: selectedDeficiency.sourceType || "MONITORING",
        severity: selectedDeficiency.severity || "MINOR_LEVEL",
        deficiencyDescription: selectedDeficiency.deficiencyDescription || "",
        rootCauseAnalysis: selectedDeficiency.rootCauseAnalysis || "",
        pervasiveness: selectedDeficiency.pervasiveness || "LIMITED",
        targetResolutionDate: selectedDeficiency.targetResolutionDate || "",
      });
    }
  }, [isEditingDeficiency, selectedDeficiency]);

  useEffect(() => {
    if (isEditingObjective && selectedObjective) {
      setObjectiveForm({
        isqmComponent: selectedObjective.isqmComponent || "GOVERNANCE",
        objectiveCode: selectedObjective.objectiveCode || "",
        objectiveDescription: selectedObjective.objectiveDescription || "",
        effectiveFrom: selectedObjective.effectiveFrom || format(new Date(), "yyyy-MM-dd"),
        isMandatory: selectedObjective.isMandatory || true,
      });
    }
  }, [isEditingObjective, selectedObjective]);

  useEffect(() => {
    if (isEditingPolicy && selectedPolicy) {
      setPolicyForm({
        policyCategory: selectedPolicy.policyCategory || "QUALITY_MANAGEMENT",
        policyName: selectedPolicy.policyName || "",
        policyNumber: selectedPolicy.policyNumber || "",
        versionNumber: selectedPolicy.versionNumber || "1.0",
        effectiveDate: selectedPolicy.effectiveDate || format(new Date(), "yyyy-MM-dd"),
        reviewDate: selectedPolicy.reviewDate || "",
      });
    }
  }, [isEditingPolicy, selectedPolicy]);

  const ISQM_COMPONENTS = [
    { key: "governance", label: "Governance & Leadership", icon: Building2 },
    { key: "ethics", label: "Ethical Requirements", icon: Scale },
    { key: "acceptance", label: "Acceptance & Continuance", icon: CheckCircle2 },
    { key: "performance", label: "Engagement Performance", icon: Target },
    { key: "resources", label: "Resources", icon: Users },
    { key: "info_comm", label: "Information & Communication", icon: FileText },
    { key: "monitoring", label: "Monitoring & Remediation", icon: ClipboardCheck },
  ];

  const getStatusColor = (status: string) => {
    if (status === "green") return "bg-emerald-500";
    if (status === "amber") return "bg-amber-500";
    return "bg-red-500";
  };

  const getStatusBadge = (status: string) => {
    if (status === "green") return "default";
    if (status === "amber") return "secondary";
    return "destructive";
  };

  const overallScore = complianceDashboard?.overallScore ?? 0;

  return (
    <div className="page-container">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <ShieldCheck className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-bold" data-testid="text-page-title">Firm Wide Controls</h1>
            <p className="text-muted-foreground text-sm">ISQM 1 / ISQM 2 / Code of Ethics — Quality Management Framework</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border bg-card" data-testid="badge-compliance-score">
            <TrendingUp className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">ISQM Compliance:</span>
            <span className={`text-lg font-bold ${overallScore >= 80 ? "text-emerald-600" : overallScore >= 50 ? "text-amber-600" : "text-red-600"}`}>
              {overallScore}%
            </span>
          </div>
          {!isAdmin && (
            <Badge variant="outline">
              <Lock className="h-3 w-3 mr-1" />
              Limited Access
            </Badge>
          )}
        </div>
      </div>

      <div className="text-xs text-muted-foreground border-b pb-2">
        Administration <ChevronRight className="h-3 w-3 inline" /> Firm Wide Controls
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-2.5">
        <div className="overflow-x-auto">
          <TabsList className="inline-flex w-auto min-w-full">
            <TabsTrigger value="dashboard" className="text-xs" data-testid="tab-dashboard">
              <BarChart3 className="h-4 w-4 mr-1" />
              <span className="hidden sm:inline">Dashboard</span>
            </TabsTrigger>
            <TabsTrigger value="isqm1" className="text-xs" data-testid="tab-isqm1">
              <ShieldCheck className="h-4 w-4 mr-1" />
              <span className="hidden sm:inline">ISQM 1</span>
            </TabsTrigger>
            <TabsTrigger value="governance" className="text-xs" data-testid="tab-governance">
              <Building2 className="h-4 w-4 mr-1" />
              <span className="hidden sm:inline">Governance</span>
            </TabsTrigger>
            <TabsTrigger value="independence" className="text-xs" data-testid="tab-independence">
              <Scale className="h-4 w-4 mr-1" />
              <span className="hidden sm:inline">Independence</span>
            </TabsTrigger>
            <TabsTrigger value="ethics" className="text-xs" data-testid="tab-ethics">
              <Shield className="h-4 w-4 mr-1" />
              <span className="hidden sm:inline">Ethics</span>
            </TabsTrigger>
            <TabsTrigger value="resources" className="text-xs" data-testid="tab-resources">
              <Users className="h-4 w-4 mr-1" />
              <span className="hidden sm:inline">Resources</span>
            </TabsTrigger>
            <TabsTrigger value="training" className="text-xs" data-testid="tab-training">
              <GraduationCap className="h-4 w-4 mr-1" />
              <span className="hidden sm:inline">Training</span>
            </TabsTrigger>
            <TabsTrigger value="monitoring" className="text-xs" data-testid="tab-monitoring">
              <ClipboardCheck className="h-4 w-4 mr-1" />
              <span className="hidden sm:inline">Monitoring</span>
            </TabsTrigger>
            <TabsTrigger value="deficiencies" className="text-xs" data-testid="tab-deficiencies">
              <AlertTriangle className="h-4 w-4 mr-1" />
              <span className="hidden sm:inline">Remediation</span>
            </TabsTrigger>
            <TabsTrigger value="eqcr" className="text-xs" data-testid="tab-eqcr">
              <Gavel className="h-4 w-4 mr-1" />
              <span className="hidden sm:inline">EQR</span>
            </TabsTrigger>
            <TabsTrigger value="objectives" className="text-xs" data-testid="tab-objectives">
              <Target className="h-4 w-4 mr-1" />
              <span className="hidden sm:inline">Objectives</span>
            </TabsTrigger>
            <TabsTrigger value="policies" className="text-xs" data-testid="tab-policies">
              <FileText className="h-4 w-4 mr-1" />
              <span className="hidden sm:inline">Policies</span>
            </TabsTrigger>
            <TabsTrigger value="docs" className="text-xs" data-testid="tab-docs">
              <Library className="h-4 w-4 mr-1" />
              <span className="hidden sm:inline">Docs Library</span>
            </TabsTrigger>
            <TabsTrigger value="activity" className="text-xs" data-testid="tab-activity">
              <Activity className="h-4 w-4 mr-1" />
              <span className="hidden sm:inline">Activity</span>
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="dashboard" className="space-y-2.5">
          {dashboardLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2.5">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Independence Compliance</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-lg font-bold text-green-600">{dashboard?.independenceCompliance || 0}%</div>
                    <p className="text-xs text-muted-foreground">{dashboard?.declaredUsers || 0} of {dashboard?.totalUsers || 0} declared</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Leadership Affirmations</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-lg font-bold">{dashboard?.leadershipAffirmations || 0}</div>
                    <p className="text-xs text-muted-foreground">This year</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Open Deficiencies</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-lg font-bold text-amber-600">{dashboard?.openDeficiencies || 0}</div>
                    <p className="text-xs text-muted-foreground">Requiring action</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Training Hours</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-lg font-bold">{dashboard?.totalTrainingHours || 0}</div>
                    <p className="text-xs text-muted-foreground">CPD hours logged</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Total Staff</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-lg font-bold">{dashboard?.totalUsers || 0}</div>
                    <p className="text-xs text-muted-foreground">Active users</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Open Breaches</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-lg font-bold text-red-600">{dashboard?.openBreaches || 0}</div>
                    <p className="text-xs text-muted-foreground">Ethics breaches</p>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>ISQM 1 Component Status</CardTitle>
                  <CardDescription>Quality management system components per ISQM 1</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
                    {[
                      { name: "Governance & Leadership", icon: Building2, status: "Operational" },
                      { name: "Ethics & Independence", icon: Scale, status: "Operational" },
                      { name: "Client Acceptance & Continuance", icon: Users, status: "Operational" },
                      { name: "Engagement Performance", icon: ClipboardCheck, status: "Operational" },
                      { name: "Resources", icon: Users, status: "Operational" },
                      { name: "Information & Communication", icon: FileText, status: "Operational" },
                    ].map((component, idx) => (
                      <div key={idx} className="flex items-center gap-3 p-3 border rounded-lg">
                        <component.icon className="h-5 w-5 text-primary" />
                        <div className="flex-1">
                          <p className="font-medium text-sm">{component.name}</p>
                        </div>
                        <Badge variant="outline" className="text-green-600 border-green-600">
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          {component.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        <TabsContent value="governance" className="space-y-2.5">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Leadership Affirmations</CardTitle>
                <CardDescription>Quality commitment affirmations per ISQM 1 para 28-31</CardDescription>
              </div>
              <Dialog open={showAffirmationDialog} onOpenChange={setShowAffirmationDialog}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Submit Affirmation
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Leadership Affirmation</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-2.5">
                    <div className="space-y-2">
                      <Label>Affirmation Type</Label>
                      <Select value={affirmationForm.affirmationType} onValueChange={(v) => setAffirmationForm({ ...affirmationForm, affirmationType: v })}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ANNUAL">Annual Affirmation</SelectItem>
                          <SelectItem value="ONBOARDING">New Joiner Affirmation</SelectItem>
                          <SelectItem value="SPECIAL">Special Circumstance</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Affirmation Statement</Label>
                      <Textarea
                        value={affirmationForm.affirmationText}
                        onChange={(e) => setAffirmationForm({ ...affirmationForm, affirmationText: e.target.value })}
                        rows={4}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setShowAffirmationDialog(false)}>Cancel</Button>
                    <Button
                      onClick={() => {
                        createAffirmationMutation.mutate(affirmationForm);
                        setShowAffirmationDialog(false);
                      }}
                      disabled={createAffirmationMutation.isPending}
                    >
                      {createAffirmationMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                      Submit
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Affirmation</TableHead>
                    <TableHead>Sign-off Date</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(affirmations || []).length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground py-2">
                        No leadership affirmations recorded yet
                      </TableCell>
                    </TableRow>
                  ) : (
                    (affirmations || []).map((aff: any) => (
                      <TableRow key={aff.id}>
                        <TableCell>
                          <Badge variant="outline">{aff.affirmationType}</Badge>
                        </TableCell>
                        <TableCell className="max-w-md truncate">{aff.affirmationText}</TableCell>
                        <TableCell>{aff.signoffDate ? format(new Date(aff.signoffDate), "dd/MM/yyyy") : "-"}</TableCell>
                        <TableCell>
                          <Badge className="bg-green-100 text-green-800">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Signed
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Consultation Register</CardTitle>
              <CardDescription>Technical consultations per ISQM 1 para 34</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex justify-end mb-2.5">
                <Dialog open={showConsultationDialog} onOpenChange={setShowConsultationDialog}>
                  <DialogTrigger asChild>
                    <Button variant="outline">
                      <Plus className="h-4 w-4 mr-2" />
                      Log Consultation
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Log Consultation</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-2.5">
                      <div className="space-y-2">
                        <Label>Date</Label>
                        <Input type="date" value={consultationForm.consultationDate} onChange={(e) => setConsultationForm({ ...consultationForm, consultationDate: e.target.value })} />
                      </div>
                      <div className="space-y-2">
                        <Label>Topic</Label>
                        <Input value={consultationForm.consultationTopic} onChange={(e) => setConsultationForm({ ...consultationForm, consultationTopic: e.target.value })} />
                      </div>
                      <div className="space-y-2">
                        <Label>Issue Description</Label>
                        <Textarea value={consultationForm.issueDescription} onChange={(e) => setConsultationForm({ ...consultationForm, issueDescription: e.target.value })} rows={3} />
                      </div>
                      <div className="space-y-2">
                        <Label>Conclusion</Label>
                        <Textarea value={consultationForm.consultationConclusion} onChange={(e) => setConsultationForm({ ...consultationForm, consultationConclusion: e.target.value })} rows={2} />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setShowConsultationDialog(false)}>Cancel</Button>
                      <Button onClick={() => { createConsultationMutation.mutate(consultationForm); setShowConsultationDialog(false); }} disabled={createConsultationMutation.isPending}>
                        {createConsultationMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                        Save
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Topic</TableHead>
                    <TableHead>Issue</TableHead>
                    <TableHead>Conclusion</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(consultations || []).length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground py-2">
                        No consultations recorded
                      </TableCell>
                    </TableRow>
                  ) : (
                    (consultations || []).map((c: any) => (
                      <TableRow key={c.id}>
                        <TableCell>{format(new Date(c.consultationDate), "dd/MM/yyyy")}</TableCell>
                        <TableCell>{c.consultationTopic}</TableCell>
                        <TableCell className="max-w-xs truncate">{c.issueDescription}</TableCell>
                        <TableCell className="max-w-xs truncate">{c.consultationConclusion || "-"}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="independence" className="space-y-2.5">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Annual Independence Declarations</CardTitle>
                <CardDescription>IESBA Code of Ethics & ISA 200 compliance declarations</CardDescription>
              </div>
              <Dialog open={showDeclarationDialog} onOpenChange={setShowDeclarationDialog}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Submit Declaration
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-lg">
                  <DialogHeader>
                    <DialogTitle>Independence Declaration</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-2.5">
                    <div className="grid grid-cols-2 gap-2.5">
                      <div className="space-y-2">
                        <Label>Declaration Type</Label>
                        <Select value={declarationForm.declarationType} onValueChange={(v) => setDeclarationForm({ ...declarationForm, declarationType: v })}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Annual">Annual Declaration</SelectItem>
                            <SelectItem value="Engagement">Engagement-Specific</SelectItem>
                            <SelectItem value="Client">Client-Specific</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Year</Label>
                        <Input type="number" value={declarationForm.declarationYear} onChange={(e) => setDeclarationForm({ ...declarationForm, declarationYear: parseInt(e.target.value) })} />
                      </div>
                    </div>
                    <div className="space-y-3 border-t pt-4">
                      <p className="text-sm font-medium">Independence Threats Assessment:</p>
                      <div className="flex items-center justify-between">
                        <Label className="text-sm">Financial Interest in Audit Client</Label>
                        <Switch checked={declarationForm.hasFinancialInterest} onCheckedChange={(v) => setDeclarationForm({ ...declarationForm, hasFinancialInterest: v })} />
                      </div>
                      <div className="flex items-center justify-between">
                        <Label className="text-sm">Family Relationship with Client Personnel</Label>
                        <Switch checked={declarationForm.hasFamilyRelationship} onCheckedChange={(v) => setDeclarationForm({ ...declarationForm, hasFamilyRelationship: v })} />
                      </div>
                      <div className="flex items-center justify-between">
                        <Label className="text-sm">Business Relationship with Client</Label>
                        <Switch checked={declarationForm.hasBusinessRelationship} onCheckedChange={(v) => setDeclarationForm({ ...declarationForm, hasBusinessRelationship: v })} />
                      </div>
                      <div className="flex items-center justify-between">
                        <Label className="text-sm">Previous Employment with Client</Label>
                        <Switch checked={declarationForm.hasPreviousEmployment} onCheckedChange={(v) => setDeclarationForm({ ...declarationForm, hasPreviousEmployment: v })} />
                      </div>
                    </div>
                    {(declarationForm.hasFinancialInterest || declarationForm.hasFamilyRelationship || declarationForm.hasBusinessRelationship || declarationForm.hasPreviousEmployment) && (
                      <div className="space-y-2">
                        <Label>Safeguards Implemented</Label>
                        <Textarea value={declarationForm.safeguardsImplemented} onChange={(e) => setDeclarationForm({ ...declarationForm, safeguardsImplemented: e.target.value })} placeholder="Describe safeguards to eliminate or reduce threats..." rows={3} />
                      </div>
                    )}
                    <div className="flex items-center justify-between border-t pt-4">
                      <Label className="font-medium">I confirm that I am independent</Label>
                      <Switch checked={declarationForm.isIndependent} onCheckedChange={(v) => setDeclarationForm({ ...declarationForm, isIndependent: v })} />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setShowDeclarationDialog(false)}>Cancel</Button>
                    <Button onClick={() => { createDeclarationMutation.mutate(declarationForm); setShowDeclarationDialog(false); }} disabled={createDeclarationMutation.isPending}>
                      {createDeclarationMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                      Submit Declaration
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Year</TableHead>
                    <TableHead>Threats Identified</TableHead>
                    <TableHead>Independence Status</TableHead>
                    <TableHead>Declaration Date</TableHead>
                    <TableHead className="w-[80px]">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(declarations || []).length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-2">
                        No independence declarations for current year
                      </TableCell>
                    </TableRow>
                  ) : (
                    (declarations || []).map((dec: any) => (
                      <TableRow key={dec.id}>
                        <TableCell><Badge variant="outline">{dec.declarationType}</Badge></TableCell>
                        <TableCell>{dec.declarationYear}</TableCell>
                        <TableCell>
                          {dec.hasFinancialInterest || dec.hasFamilyRelationship || dec.hasBusinessRelationship || dec.hasPreviousEmployment ? (
                            <Badge variant="secondary" className="text-amber-600">Threats Identified</Badge>
                          ) : (
                            <Badge variant="secondary" className="text-green-600">None</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {dec.isIndependent ? (
                            <Badge className="bg-green-100 text-green-800"><CheckCircle2 className="h-3 w-3 mr-1" />Independent</Badge>
                          ) : (
                            <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Not Independent</Badge>
                          )}
                        </TableCell>
                        <TableCell>{dec.declarationDate ? format(new Date(dec.declarationDate), "dd/MM/yyyy") : "-"}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="h-8 w-8 p-0"
                              onClick={() => {
                                setSelectedDeclaration(dec);
                                setIsEditingDeclaration(false);
                                setShowViewDeclarationDialog(true);
                              }}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="h-8 w-8 p-0"
                              onClick={() => {
                                setSelectedDeclaration(dec);
                                setIsEditingDeclaration(true);
                                setShowViewDeclarationDialog(true);
                              }}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* View/Edit Declaration Dialog */}
          <Dialog open={showViewDeclarationDialog} onOpenChange={setShowViewDeclarationDialog}>
            <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{isEditingDeclaration ? "Edit" : "View"} Independence Declaration</DialogTitle>
              </DialogHeader>
              {selectedDeclaration && (
                <div className="space-y-2.5">
                  {isEditingDeclaration ? (
                    <>
                      <div className="grid grid-cols-2 gap-2.5">
                        <div className="space-y-2">
                          <Label>Declaration Type</Label>
                          <Select value={declarationForm.declarationType} onValueChange={(v) => setDeclarationForm({ ...declarationForm, declarationType: v })}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="ANNUAL">Annual Declaration</SelectItem>
                              <SelectItem value="ENGAGEMENT_SPECIFIC">Engagement Specific</SelectItem>
                              <SelectItem value="AD_HOC">Ad-Hoc</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Year</Label>
                          <Input type="number" value={declarationForm.declarationYear} onChange={(e) => setDeclarationForm({ ...declarationForm, declarationYear: parseInt(e.target.value) })} />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2.5">
                        <div className="flex items-center justify-between p-3 border rounded">
                          <Label>Financial Interest</Label>
                          <Switch checked={declarationForm.hasFinancialInterest} onCheckedChange={(v) => setDeclarationForm({ ...declarationForm, hasFinancialInterest: v })} />
                        </div>
                        <div className="flex items-center justify-between p-3 border rounded">
                          <Label>Family Relationship</Label>
                          <Switch checked={declarationForm.hasFamilyRelationship} onCheckedChange={(v) => setDeclarationForm({ ...declarationForm, hasFamilyRelationship: v })} />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2.5">
                        <div className="flex items-center justify-between p-3 border rounded">
                          <Label>Business Relationship</Label>
                          <Switch checked={declarationForm.hasBusinessRelationship} onCheckedChange={(v) => setDeclarationForm({ ...declarationForm, hasBusinessRelationship: v })} />
                        </div>
                        <div className="flex items-center justify-between p-3 border rounded">
                          <Label>Previous Employment</Label>
                          <Switch checked={declarationForm.hasPreviousEmployment} onCheckedChange={(v) => setDeclarationForm({ ...declarationForm, hasPreviousEmployment: v })} />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Safeguards Implemented (if any threats identified)</Label>
                        <Textarea value={declarationForm.safeguardsImplemented} onChange={(e) => setDeclarationForm({ ...declarationForm, safeguardsImplemented: e.target.value })} rows={3} />
                      </div>
                      <div className="flex items-center justify-between p-3 border rounded">
                        <Label className="font-medium">I confirm that I am independent</Label>
                        <Switch checked={declarationForm.isIndependent} onCheckedChange={(v) => setDeclarationForm({ ...declarationForm, isIndependent: v })} />
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="grid grid-cols-2 gap-2.5">
                        <div>
                          <Label className="text-sm text-muted-foreground">Type</Label>
                          <p className="font-medium">{selectedDeclaration.declarationType}</p>
                        </div>
                        <div>
                          <Label className="text-sm text-muted-foreground">Year</Label>
                          <p className="font-medium">{selectedDeclaration.declarationYear}</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2.5">
                        <div className="flex items-center justify-between p-3 border rounded">
                          <Label>Financial Interest</Label>
                          {selectedDeclaration.hasFinancialInterest ? (
                            <CheckCircle2 className="h-5 w-5 text-amber-600" />
                          ) : (
                            <XCircle className="h-5 w-5 text-green-600" />
                          )}
                        </div>
                        <div className="flex items-center justify-between p-3 border rounded">
                          <Label>Family Relationship</Label>
                          {selectedDeclaration.hasFamilyRelationship ? (
                            <CheckCircle2 className="h-5 w-5 text-amber-600" />
                          ) : (
                            <XCircle className="h-5 w-5 text-green-600" />
                          )}
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2.5">
                        <div className="flex items-center justify-between p-3 border rounded">
                          <Label>Business Relationship</Label>
                          {selectedDeclaration.hasBusinessRelationship ? (
                            <CheckCircle2 className="h-5 w-5 text-amber-600" />
                          ) : (
                            <XCircle className="h-5 w-5 text-green-600" />
                          )}
                        </div>
                        <div className="flex items-center justify-between p-3 border rounded">
                          <Label>Previous Employment</Label>
                          {selectedDeclaration.hasPreviousEmployment ? (
                            <CheckCircle2 className="h-5 w-5 text-amber-600" />
                          ) : (
                            <XCircle className="h-5 w-5 text-green-600" />
                          )}
                        </div>
                      </div>
                      {selectedDeclaration.safeguardsImplemented && (
                        <div>
                          <Label className="text-sm text-muted-foreground">Safeguards Implemented</Label>
                          <p className="mt-1 p-3 bg-muted rounded">{selectedDeclaration.safeguardsImplemented}</p>
                        </div>
                      )}
                      <div className="flex items-center justify-between p-2.5 border rounded bg-muted/50">
                        <Label className="font-medium">Independence Status</Label>
                        {selectedDeclaration.isIndependent ? (
                          <Badge className="bg-green-100 text-green-800"><CheckCircle2 className="h-3 w-3 mr-1" />Independent</Badge>
                        ) : (
                          <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Not Independent</Badge>
                        )}
                      </div>
                      <div>
                        <Label className="text-sm text-muted-foreground">Declaration Date</Label>
                        <p className="font-medium">{selectedDeclaration.declarationDate ? format(new Date(selectedDeclaration.declarationDate), "dd MMMM yyyy") : "-"}</p>
                      </div>
                    </>
                  )}
                </div>
              )}
              {isEditingDeclaration && (
                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowViewDeclarationDialog(false)}>Cancel</Button>
                  <Button 
                    onClick={() => updateDeclarationMutation.mutate({ id: selectedDeclaration.id, data: declarationForm })} 
                    disabled={updateDeclarationMutation.isPending}
                  >
                    {updateDeclarationMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                    Save Changes
                  </Button>
                </DialogFooter>
              )}
            </DialogContent>
          </Dialog>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-2.5">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Financial Interests Register</CardTitle>
                  <CardDescription>IESBA Section 510 compliance</CardDescription>
                </div>
                <Dialog open={showFinancialInterestDialog} onOpenChange={setShowFinancialInterestDialog}>
                  <DialogTrigger asChild>
                    <Button size="sm" variant="outline">
                      <Plus className="h-4 w-4 mr-1" />
                      Add
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Record Financial Interest</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-2.5">
                      <div className="space-y-2">
                        <Label>Entity Name</Label>
                        <Input value={financialInterestForm.entityName} onChange={(e) => setFinancialInterestForm({ ...financialInterestForm, entityName: e.target.value })} placeholder="Company/Entity name" />
                      </div>
                      <div className="grid grid-cols-2 gap-2.5">
                        <div className="space-y-2">
                          <Label>Nature of Interest</Label>
                          <Select value={financialInterestForm.natureOfInterest} onValueChange={(v) => setFinancialInterestForm({ ...financialInterestForm, natureOfInterest: v as any })}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="SHARES">Shares</SelectItem>
                              <SelectItem value="DEBENTURES">Debentures</SelectItem>
                              <SelectItem value="LOANS">Loans</SelectItem>
                              <SelectItem value="OTHER">Other</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Relationship Type</Label>
                          <Select value={financialInterestForm.relationshipType} onValueChange={(v) => setFinancialInterestForm({ ...financialInterestForm, relationshipType: v as any })}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="DIRECT">Direct</SelectItem>
                              <SelectItem value="INDIRECT">Indirect</SelectItem>
                              <SelectItem value="FAMILY">Family</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2.5">
                        <div className="space-y-2">
                          <Label>Approximate Value</Label>
                          <Input type="number" value={financialInterestForm.estimatedValue} onChange={(e) => setFinancialInterestForm({ ...financialInterestForm, estimatedValue: parseFloat(e.target.value) })} />
                        </div>
                        <div className="space-y-2">
                          <Label>Acquisition Date</Label>
                          <Input type="date" value={financialInterestForm.acquisitionDate} onChange={(e) => setFinancialInterestForm({ ...financialInterestForm, acquisitionDate: e.target.value })} />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label className="flex items-center gap-2">
                          <Switch checked={financialInterestForm.isAuditClient} onCheckedChange={(checked) => setFinancialInterestForm({ ...financialInterestForm, isAuditClient: checked })} />
                          Is this an audit client?
                        </Label>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setShowFinancialInterestDialog(false)}>Cancel</Button>
                      <Button onClick={() => { createFinancialInterestMutation.mutate(financialInterestForm); setShowFinancialInterestDialog(false); }} disabled={createFinancialInterestMutation.isPending || !financialInterestForm.entityName}>
                        {createFinancialInterestMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                        Save
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Entity</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Relationship</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-[80px]">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(financialInterests || []).length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground py-3">
                          No financial interests reported
                        </TableCell>
                      </TableRow>
                    ) : (
                      (financialInterests || []).map((fi: any) => (
                        <TableRow key={fi.id}>
                          <TableCell>{fi.entityName}</TableCell>
                          <TableCell>{fi.natureOfInterest}</TableCell>
                          <TableCell>{fi.relationshipType}</TableCell>
                          <TableCell><Badge variant="outline">{fi.status}</Badge></TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="h-8 w-8 p-0"
                                onClick={() => {
                                  setSelectedFinancialInterest(fi);
                                  setIsEditingFinancialInterest(false);
                                  setShowViewFinancialInterestDialog(true);
                                }}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="h-8 w-8 p-0"
                                onClick={() => {
                                  setSelectedFinancialInterest(fi);
                                  setIsEditingFinancialInterest(true);
                                  setShowViewFinancialInterestDialog(true);
                                }}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Gifts & Hospitality Register</CardTitle>
                  <CardDescription>IESBA Section 420 compliance</CardDescription>
                </div>
                <Dialog open={showGiftDialog} onOpenChange={setShowGiftDialog}>
                  <DialogTrigger asChild>
                    <Button size="sm" variant="outline">
                      <Plus className="h-4 w-4 mr-1" />
                      Add
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Record Gift/Hospitality</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-2.5">
                      <div className="grid grid-cols-2 gap-2.5">
                        <div className="space-y-2">
                          <Label>Date Received</Label>
                          <Input type="date" value={giftForm.dateReceived} onChange={(e) => setGiftForm({ ...giftForm, dateReceived: e.target.value })} />
                        </div>
                        <div className="space-y-2">
                          <Label>Estimated Value (PKR)</Label>
                          <Input type="number" value={giftForm.estimatedValue} onChange={(e) => setGiftForm({ ...giftForm, estimatedValue: parseFloat(e.target.value) })} />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Description</Label>
                        <Input value={giftForm.description} onChange={(e) => setGiftForm({ ...giftForm, description: e.target.value })} />
                      </div>
                      <div className="grid grid-cols-2 gap-2.5">
                        <div className="space-y-2">
                          <Label>Giver Name</Label>
                          <Input value={giftForm.giverName} onChange={(e) => setGiftForm({ ...giftForm, giverName: e.target.value })} />
                        </div>
                        <div className="space-y-2">
                          <Label>Giver Designation</Label>
                          <Input value={giftForm.giverDesignation} onChange={(e) => setGiftForm({ ...giftForm, giverDesignation: e.target.value })} />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Action Taken</Label>
                        <Select value={giftForm.actionTaken} onValueChange={(v: any) => setGiftForm({ ...giftForm, actionTaken: v })}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="RETAINED">Retained</SelectItem>
                            <SelectItem value="RETURNED">Returned</SelectItem>
                            <SelectItem value="DONATED">Donated</SelectItem>
                            <SelectItem value="SHARED">Shared with Team</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Remarks</Label>
                        <Textarea value={giftForm.remarks} onChange={(e) => setGiftForm({ ...giftForm, remarks: e.target.value })} rows={2} />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setShowGiftDialog(false)}>Cancel</Button>
                      <Button onClick={() => { createGiftMutation.mutate(giftForm); setShowGiftDialog(false); }} disabled={createGiftMutation.isPending}>
                        {createGiftMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                        Save
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Value</TableHead>
                      <TableHead>Action Taken</TableHead>
                      <TableHead className="w-[80px]">View</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(giftsHospitality || []).length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground py-3">
                          No gifts/hospitality recorded
                        </TableCell>
                      </TableRow>
                    ) : (
                      (giftsHospitality || []).map((g: any) => (
                        <TableRow key={g.id}>
                          <TableCell>{format(new Date(g.dateReceived), "dd/MM/yyyy")}</TableCell>
                          <TableCell>{g.description}</TableCell>
                          <TableCell>PKR {formatAccounting(g.estimatedValue)}</TableCell>
                          <TableCell><Badge variant="outline">{g.actionTaken}</Badge></TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="h-8 w-8 p-0"
                                onClick={() => {
                                  setSelectedGift(g);
                                  setIsEditingGift(false);
                                  setShowViewGiftDialog(true);
                                }}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="h-8 w-8 p-0"
                                onClick={() => {
                                  setSelectedGift(g);
                                  setIsEditingGift(true);
                                  setShowViewGiftDialog(true);
                                }}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>

          {/* View/Edit Financial Interest Dialog */}
          <Dialog open={showViewFinancialInterestDialog} onOpenChange={setShowViewFinancialInterestDialog}>
            <DialogContent className="max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{isEditingFinancialInterest ? "Edit" : "View"} Financial Interest</DialogTitle>
              </DialogHeader>
              {selectedFinancialInterest && (
                <div className="space-y-2.5">
                  {isEditingFinancialInterest ? (
                    <>
                      <div className="space-y-2">
                        <Label>Entity Name</Label>
                        <Input value={financialInterestForm.entityName} onChange={(e) => setFinancialInterestForm({ ...financialInterestForm, entityName: e.target.value })} />
                      </div>
                      <div className="grid grid-cols-2 gap-2.5">
                        <div className="space-y-2">
                          <Label>Nature of Interest</Label>
                          <Select value={financialInterestForm.natureOfInterest} onValueChange={(v) => setFinancialInterestForm({ ...financialInterestForm, natureOfInterest: v })}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="SHARES">Shares</SelectItem>
                              <SelectItem value="DEBENTURES">Debentures</SelectItem>
                              <SelectItem value="LOANS">Loans</SelectItem>
                              <SelectItem value="OTHER">Other</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Relationship Type</Label>
                          <Select value={financialInterestForm.relationshipType} onValueChange={(v) => setFinancialInterestForm({ ...financialInterestForm, relationshipType: v })}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="DIRECT">Direct</SelectItem>
                              <SelectItem value="INDIRECT">Indirect</SelectItem>
                              <SelectItem value="FAMILY">Family Member</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2.5">
                        <div className="space-y-2">
                          <Label>Approximate Value (PKR)</Label>
                          <Input type="number" value={financialInterestForm.estimatedValue} onChange={(e) => setFinancialInterestForm({ ...financialInterestForm, estimatedValue: parseFloat(e.target.value) || 0 })} />
                        </div>
                        <div className="space-y-2">
                          <Label>Acquisition Date</Label>
                          <Input type="date" value={financialInterestForm.acquisitionDate} onChange={(e) => setFinancialInterestForm({ ...financialInterestForm, acquisitionDate: e.target.value })} />
                        </div>
                      </div>
                      <div className="flex items-center justify-between p-3 border rounded">
                        <Label>Is this an audit client?</Label>
                        <Switch checked={financialInterestForm.isAuditClient} onCheckedChange={(v) => setFinancialInterestForm({ ...financialInterestForm, isAuditClient: v })} />
                      </div>
                    </>
                  ) : (
                    <>
                      <div>
                        <Label className="text-sm text-muted-foreground">Entity Name</Label>
                        <p className="font-medium text-lg">{selectedFinancialInterest.entityName}</p>
                      </div>
                      <div className="grid grid-cols-2 gap-2.5">
                        <div>
                          <Label className="text-sm text-muted-foreground">Nature of Interest</Label>
                          <p className="font-medium">{selectedFinancialInterest.natureOfInterest}</p>
                        </div>
                        <div>
                          <Label className="text-sm text-muted-foreground">Relationship Type</Label>
                          <p className="font-medium">{selectedFinancialInterest.relationshipType}</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2.5">
                        <div>
                          <Label className="text-sm text-muted-foreground">Approximate Value</Label>
                          <p className="font-medium">{selectedFinancialInterest.approximateValue ? `PKR ${formatAccounting(parseFloat(selectedFinancialInterest.approximateValue))}` : "-"}</p>
                        </div>
                        <div>
                          <Label className="text-sm text-muted-foreground">Status</Label>
                          <Badge variant="outline">{selectedFinancialInterest.status}</Badge>
                        </div>
                      </div>
                      {selectedFinancialInterest.acquisitionDate && (
                        <div>
                          <Label className="text-sm text-muted-foreground">Acquisition Date</Label>
                          <p className="font-medium">{format(new Date(selectedFinancialInterest.acquisitionDate), "dd MMMM yyyy")}</p>
                        </div>
                      )}
                      {selectedFinancialInterest.isAuditClient && (
                        <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded border border-amber-200">
                          <p className="text-sm font-medium text-amber-800 dark:text-amber-300">This is an audit client</p>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
              {isEditingFinancialInterest && (
                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowViewFinancialInterestDialog(false)}>Cancel</Button>
                  <Button 
                    onClick={() => updateFinancialInterestMutation.mutate({ id: selectedFinancialInterest.id, data: financialInterestForm })} 
                    disabled={updateFinancialInterestMutation.isPending}
                  >
                    {updateFinancialInterestMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                    Save Changes
                  </Button>
                </DialogFooter>
              )}
            </DialogContent>
          </Dialog>

          {/* View/Edit Gift Dialog */}
          <Dialog open={showViewGiftDialog} onOpenChange={setShowViewGiftDialog}>
            <DialogContent className="max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{isEditingGift ? "Edit" : "View"} Gift/Hospitality</DialogTitle>
              </DialogHeader>
              {selectedGift && (
                <div className="space-y-2.5">
                  {isEditingGift ? (
                    <>
                      <div className="space-y-2">
                        <Label>Description</Label>
                        <Textarea value={giftForm.description} onChange={(e) => setGiftForm({ ...giftForm, description: e.target.value })} rows={2} />
                      </div>
                      <div className="grid grid-cols-2 gap-2.5">
                        <div className="space-y-2">
                          <Label>Date Received</Label>
                          <Input type="date" value={giftForm.dateReceived} onChange={(e) => setGiftForm({ ...giftForm, dateReceived: e.target.value })} />
                        </div>
                        <div className="space-y-2">
                          <Label>Estimated Value (PKR)</Label>
                          <Input type="number" value={giftForm.estimatedValue} onChange={(e) => setGiftForm({ ...giftForm, estimatedValue: parseFloat(e.target.value) || 0 })} />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2.5">
                        <div className="space-y-2">
                          <Label>Giver Name</Label>
                          <Input value={giftForm.giverName} onChange={(e) => setGiftForm({ ...giftForm, giverName: e.target.value })} />
                        </div>
                        <div className="space-y-2">
                          <Label>Relationship</Label>
                          <Input value={giftForm.giverRelationship} onChange={(e) => setGiftForm({ ...giftForm, giverRelationship: e.target.value })} />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Action Taken</Label>
                        <Select value={giftForm.actionTaken} onValueChange={(v) => setGiftForm({ ...giftForm, actionTaken: v })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="ACCEPTED">Accepted</SelectItem>
                            <SelectItem value="DECLINED">Declined</SelectItem>
                            <SelectItem value="RETURNED">Returned</SelectItem>
                            <SelectItem value="DONATED">Donated to Charity</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Remarks</Label>
                        <Textarea value={giftForm.remarks} onChange={(e) => setGiftForm({ ...giftForm, remarks: e.target.value })} rows={2} />
                      </div>
                    </>
                  ) : (
                    <>
                      <div>
                        <Label className="text-sm text-muted-foreground">Description</Label>
                        <p className="font-medium">{selectedGift.description}</p>
                      </div>
                      <div className="grid grid-cols-2 gap-2.5">
                        <div>
                          <Label className="text-sm text-muted-foreground">Date Received</Label>
                          <p className="font-medium">{format(new Date(selectedGift.dateReceived), "dd MMMM yyyy")}</p>
                        </div>
                        <div>
                          <Label className="text-sm text-muted-foreground">Estimated Value</Label>
                          <p className="font-medium">PKR {formatAccounting(selectedGift.estimatedValue)}</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2.5">
                        <div>
                          <Label className="text-sm text-muted-foreground">Giver Name</Label>
                          <p className="font-medium">{selectedGift.giverName || "-"}</p>
                        </div>
                        <div>
                          <Label className="text-sm text-muted-foreground">Giver Designation</Label>
                          <p className="font-medium">{selectedGift.giverDesignation || "-"}</p>
                        </div>
                      </div>
                      <div>
                        <Label className="text-sm text-muted-foreground">Action Taken</Label>
                        <div className="mt-1">
                          <Badge variant="outline">{selectedGift.actionTaken}</Badge>
                        </div>
                      </div>
                      {selectedGift.remarks && (
                        <div>
                          <Label className="text-sm text-muted-foreground">Remarks</Label>
                          <p className="mt-1 p-3 bg-muted rounded">{selectedGift.remarks}</p>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
              {isEditingGift && (
                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowViewGiftDialog(false)}>Cancel</Button>
                  <Button 
                    onClick={() => updateGiftMutation.mutate({ id: selectedGift.id, data: giftForm })} 
                    disabled={updateGiftMutation.isPending}
                  >
                    {updateGiftMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                    Save Changes
                  </Button>
                </DialogFooter>
              )}
            </DialogContent>
          </Dialog>
        </TabsContent>

        <TabsContent value="ethics" className="space-y-2.5">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Ethics Breach Register</CardTitle>
                <CardDescription>IESBA Code of Ethics breaches and remediation tracking</CardDescription>
              </div>
              {isManager && (
                <Dialog open={showEthicsBreachDialog} onOpenChange={setShowEthicsBreachDialog}>
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Ethics Issue
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Record Ethics Issue</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-2.5">
                      <div className="space-y-2">
                        <Label>Issue Type</Label>
                        <Select value={ethicsBreachForm.breachType} onValueChange={(v) => setEthicsBreachForm({ ...ethicsBreachForm, breachType: v })}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="CONFLICT_OF_INTEREST">Conflict of Interest</SelectItem>
                            <SelectItem value="INDEPENDENCE_BREACH">Independence Breach</SelectItem>
                            <SelectItem value="CONFIDENTIALITY_BREACH">Confidentiality Breach</SelectItem>
                            <SelectItem value="PROFESSIONAL_COMPETENCE">Professional Competence</SelectItem>
                            <SelectItem value="INTEGRITY_ISSUE">Integrity Issue</SelectItem>
                            <SelectItem value="OTHER">Other</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Description</Label>
                        <Textarea value={ethicsBreachForm.description} onChange={(e) => setEthicsBreachForm({ ...ethicsBreachForm, description: e.target.value })} placeholder="Describe the ethical issue or breach..." rows={3} />
                      </div>
                      <div className="space-y-2">
                        <Label>Persons Involved (Optional)</Label>
                        <Input value={ethicsBreachForm.personsInvolved} onChange={(e) => setEthicsBreachForm({ ...ethicsBreachForm, personsInvolved: e.target.value })} placeholder="Names or roles of persons involved" />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setShowEthicsBreachDialog(false)}>Cancel</Button>
                      <Button onClick={() => { createEthicsBreachMutation.mutate(ethicsBreachForm); setShowEthicsBreachDialog(false); }} disabled={createEthicsBreachMutation.isPending || !ethicsBreachForm.description}>
                        {createEthicsBreachMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                        Submit
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              )}
            </CardHeader>
            <CardContent>
              {!isManager ? (
                <div className="text-center py-2 text-muted-foreground">
                  <Lock className="h-8 w-8 mx-auto mb-2" />
                  <p>Manager or Partner access required to view ethics breaches</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date Reported</TableHead>
                      <TableHead>Breach Type</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Action Taken</TableHead>
                      <TableHead className="w-[80px]">View</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(ethicsBreaches || []).length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground py-2">
                          <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-green-500" />
                          No ethics breaches recorded
                        </TableCell>
                      </TableRow>
                    ) : (
                      (ethicsBreaches || []).map((b: any) => (
                        <TableRow key={b.id}>
                          <TableCell>{b.reportedDate ? format(new Date(b.reportedDate), "dd/MM/yyyy") : "-"}</TableCell>
                          <TableCell><Badge variant="destructive">{b.breachType}</Badge></TableCell>
                          <TableCell className="max-w-xs truncate">{b.description}</TableCell>
                          <TableCell>
                            <Badge variant={b.status === "Closed" ? "secondary" : "outline"}>{b.status}</Badge>
                          </TableCell>
                          <TableCell className="max-w-xs truncate">{b.actionTaken || "-"}</TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="h-8 w-8 p-0"
                                onClick={() => {
                                  setSelectedEthicsBreach(b);
                                  setIsEditingEthicsBreach(false);
                                  setShowViewEthicsBreachDialog(true);
                                }}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="h-8 w-8 p-0"
                                onClick={() => {
                                  setSelectedEthicsBreach(b);
                                  setIsEditingEthicsBreach(true);
                                  setShowViewEthicsBreachDialog(true);
                                }}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* View/Edit Ethics Breach Dialog */}
          <Dialog open={showViewEthicsBreachDialog} onOpenChange={setShowViewEthicsBreachDialog}>
            <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{isEditingEthicsBreach ? "Edit" : "View"} Ethics Breach</DialogTitle>
              </DialogHeader>
              {selectedEthicsBreach && (
                <div className="space-y-2.5">
                  {isEditingEthicsBreach ? (
                    <>
                      <div className="grid grid-cols-2 gap-2.5">
                        <div className="space-y-2">
                          <Label>Date Reported</Label>
                          <Input type="date" value={ethicsBreachForm.reportedDate} onChange={(e) => setEthicsBreachForm({ ...ethicsBreachForm, reportedDate: e.target.value })} />
                        </div>
                        <div className="space-y-2">
                          <Label>Breach Type</Label>
                          <Select value={ethicsBreachForm.breachType} onValueChange={(v) => setEthicsBreachForm({ ...ethicsBreachForm, breachType: v })}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="CONFLICT_OF_INTEREST">Conflict of Interest</SelectItem>
                              <SelectItem value="CONFIDENTIALITY">Confidentiality</SelectItem>
                              <SelectItem value="PROFESSIONAL_CONDUCT">Professional Conduct</SelectItem>
                              <SelectItem value="INDEPENDENCE">Independence</SelectItem>
                              <SelectItem value="OTHER">Other</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Description</Label>
                        <Textarea value={ethicsBreachForm.description} onChange={(e) => setEthicsBreachForm({ ...ethicsBreachForm, description: e.target.value })} rows={3} />
                      </div>
                      <div className="space-y-2">
                        <Label>Persons Involved</Label>
                        <Input value={ethicsBreachForm.personsInvolved} onChange={(e) => setEthicsBreachForm({ ...ethicsBreachForm, personsInvolved: e.target.value })} />
                      </div>
                      <div className="grid grid-cols-2 gap-2.5">
                        <div className="space-y-2">
                          <Label>Status</Label>
                          <Select value={ethicsBreachForm.status} onValueChange={(v) => setEthicsBreachForm({ ...ethicsBreachForm, status: v })}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Open">Open</SelectItem>
                              <SelectItem value="Under Investigation">Under Investigation</SelectItem>
                              <SelectItem value="Closed">Closed</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Resolution Date</Label>
                          <Input type="date" value={ethicsBreachForm.resolutionDate} onChange={(e) => setEthicsBreachForm({ ...ethicsBreachForm, resolutionDate: e.target.value })} />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Action Taken</Label>
                        <Textarea value={ethicsBreachForm.actionTaken} onChange={(e) => setEthicsBreachForm({ ...ethicsBreachForm, actionTaken: e.target.value })} rows={2} />
                      </div>
                      <div className="space-y-2">
                        <Label>Remediation</Label>
                        <Textarea value={ethicsBreachForm.remediation} onChange={(e) => setEthicsBreachForm({ ...ethicsBreachForm, remediation: e.target.value })} rows={2} />
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="grid grid-cols-2 gap-2.5">
                        <div>
                          <Label className="text-sm text-muted-foreground">Date Reported</Label>
                          <p className="font-medium">{selectedEthicsBreach.reportedDate ? format(new Date(selectedEthicsBreach.reportedDate), "dd MMMM yyyy") : "-"}</p>
                        </div>
                        <div>
                          <Label className="text-sm text-muted-foreground">Breach Type</Label>
                          <div className="mt-1">
                            <Badge variant="destructive">{selectedEthicsBreach.breachType}</Badge>
                          </div>
                        </div>
                      </div>
                      <div>
                        <Label className="text-sm text-muted-foreground">Description</Label>
                        <p className="mt-1 p-3 bg-muted rounded">{selectedEthicsBreach.description}</p>
                      </div>
                      {selectedEthicsBreach.personsInvolved && (
                        <div>
                          <Label className="text-sm text-muted-foreground">Persons Involved</Label>
                          <p className="font-medium">{selectedEthicsBreach.personsInvolved}</p>
                        </div>
                      )}
                      <div className="grid grid-cols-2 gap-2.5">
                        <div>
                          <Label className="text-sm text-muted-foreground">Status</Label>
                          <div className="mt-1">
                            <Badge variant={selectedEthicsBreach.status === "Closed" ? "secondary" : "outline"}>{selectedEthicsBreach.status}</Badge>
                          </div>
                        </div>
                        {selectedEthicsBreach.resolutionDate && (
                          <div>
                            <Label className="text-sm text-muted-foreground">Resolution Date</Label>
                            <p className="font-medium">{format(new Date(selectedEthicsBreach.resolutionDate), "dd MMMM yyyy")}</p>
                          </div>
                        )}
                      </div>
                      {selectedEthicsBreach.actionTaken && (
                        <div>
                          <Label className="text-sm text-muted-foreground">Action Taken</Label>
                          <p className="mt-1 p-3 bg-muted rounded">{selectedEthicsBreach.actionTaken}</p>
                        </div>
                      )}
                      {selectedEthicsBreach.remediation && (
                        <div>
                          <Label className="text-sm text-muted-foreground">Remediation</Label>
                          <p className="mt-1 p-3 bg-muted rounded">{selectedEthicsBreach.remediation}</p>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
              {isEditingEthicsBreach && (
                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowViewEthicsBreachDialog(false)}>Cancel</Button>
                  <Button 
                    onClick={() => updateEthicsBreachMutation.mutate({ id: selectedEthicsBreach.id, data: ethicsBreachForm })} 
                    disabled={updateEthicsBreachMutation.isPending}
                  >
                    {updateEthicsBreachMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                    Save Changes
                  </Button>
                </DialogFooter>
              )}
            </DialogContent>
          </Dialog>
        </TabsContent>

        <TabsContent value="resources" className="space-y-2.5">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Staff Competency Assessments</CardTitle>
                <CardDescription>ISQM 1 para 32 - Human resources competency tracking</CardDescription>
              </div>
              {isManager && (
                <Dialog open={showResourceDialog} onOpenChange={setShowResourceDialog}>
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Assessment
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-lg">
                    <DialogHeader>
                      <DialogTitle>Staff Competency Assessment</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-2.5">
                      <div className="grid grid-cols-2 gap-2.5">
                        <div className="space-y-2">
                          <Label>Technical Knowledge</Label>
                          <Select value={resourceForm.technicalKnowledgeRating} onValueChange={(v: any) => setResourceForm({ ...resourceForm, technicalKnowledgeRating: v })}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="EXPERT">Expert</SelectItem>
                              <SelectItem value="PROFICIENT">Proficient</SelectItem>
                              <SelectItem value="COMPETENT">Competent</SelectItem>
                              <SelectItem value="BASIC">Basic</SelectItem>
                              <SelectItem value="NONE">None</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Industry Experience (Years)</Label>
                          <Input type="number" value={resourceForm.industryExperienceYears} onChange={(e) => setResourceForm({ ...resourceForm, industryExperienceYears: parseInt(e.target.value) || 0 })} />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Training Needs Identified</Label>
                        <Textarea value={resourceForm.trainingNeedsIdentified} onChange={(e) => setResourceForm({ ...resourceForm, trainingNeedsIdentified: e.target.value })} rows={2} />
                      </div>
                      <div className="space-y-2">
                        <Label>Competency Gap Analysis</Label>
                        <Textarea value={resourceForm.competencyGapAnalysis} onChange={(e) => setResourceForm({ ...resourceForm, competencyGapAnalysis: e.target.value })} rows={2} />
                      </div>
                      <div className="space-y-2">
                        <Label>Development Plan</Label>
                        <Textarea value={resourceForm.developmentPlan} onChange={(e) => setResourceForm({ ...resourceForm, developmentPlan: e.target.value })} rows={2} />
                      </div>
                      <div className="space-y-2">
                        <Label>Next Review Date</Label>
                        <Input type="date" value={resourceForm.nextReviewDate} onChange={(e) => setResourceForm({ ...resourceForm, nextReviewDate: e.target.value })} />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setShowResourceDialog(false)}>Cancel</Button>
                      <Button onClick={() => { createResourceMutation.mutate({ ...resourceForm, userId: user?.id }); setShowResourceDialog(false); }} disabled={createResourceMutation.isPending}>
                        {createResourceMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                        Save Assessment
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              )}
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Assessment Date</TableHead>
                    <TableHead>Technical Knowledge</TableHead>
                    <TableHead>Industry Experience</TableHead>
                    <TableHead>Training Needs</TableHead>
                    <TableHead>Next Review</TableHead>
                    <TableHead className="w-[80px]">View</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(competencies || []).length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-2">
                        No competency assessments recorded
                      </TableCell>
                    </TableRow>
                  ) : (
                    (competencies || []).map((c: any) => (
                      <TableRow key={c.id}>
                        <TableCell>{format(new Date(c.assessmentDate), "dd/MM/yyyy")}</TableCell>
                        <TableCell><Badge variant="outline">{c.technicalKnowledgeRating || "N/A"}</Badge></TableCell>
                        <TableCell>{c.industryExperienceYears || 0} years</TableCell>
                        <TableCell className="max-w-xs truncate">{c.trainingNeedsIdentified || "-"}</TableCell>
                        <TableCell>{c.nextReviewDate ? format(new Date(c.nextReviewDate), "dd/MM/yyyy") : "-"}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="h-8 w-8 p-0"
                              onClick={() => {
                                setSelectedResource(c);
                                setIsEditingResource(false);
                                setShowViewResourceDialog(true);
                              }}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="h-8 w-8 p-0"
                              onClick={() => {
                                setSelectedResource(c);
                                setIsEditingResource(true);
                                setShowViewResourceDialog(true);
                              }}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* View/Edit Staff Competency Dialog */}
          <Dialog open={showViewResourceDialog} onOpenChange={setShowViewResourceDialog}>
            <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{isEditingResource ? "Edit" : "View"} Staff Competency Assessment</DialogTitle>
              </DialogHeader>
              {selectedResource && (
                <div className="space-y-2.5">
                  {isEditingResource ? (
                    <>
                      <div className="grid grid-cols-2 gap-2.5">
                        <div className="space-y-2">
                          <Label>Technical Knowledge</Label>
                          <Select value={resourceForm.technicalKnowledgeRating} onValueChange={(v: any) => setResourceForm({ ...resourceForm, technicalKnowledgeRating: v })}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="EXPERT">Expert</SelectItem>
                              <SelectItem value="PROFICIENT">Proficient</SelectItem>
                              <SelectItem value="COMPETENT">Competent</SelectItem>
                              <SelectItem value="BASIC">Basic</SelectItem>
                              <SelectItem value="NONE">None</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Industry Experience (Years)</Label>
                          <Input type="number" value={resourceForm.industryExperienceYears} onChange={(e) => setResourceForm({ ...resourceForm, industryExperienceYears: parseInt(e.target.value) || 0 })} />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Training Needs Identified</Label>
                        <Textarea value={resourceForm.trainingNeedsIdentified} onChange={(e) => setResourceForm({ ...resourceForm, trainingNeedsIdentified: e.target.value })} rows={2} />
                      </div>
                      <div className="space-y-2">
                        <Label>Competency Gap Analysis</Label>
                        <Textarea value={resourceForm.competencyGapAnalysis} onChange={(e) => setResourceForm({ ...resourceForm, competencyGapAnalysis: e.target.value })} rows={2} />
                      </div>
                      <div className="space-y-2">
                        <Label>Development Plan</Label>
                        <Textarea value={resourceForm.developmentPlan} onChange={(e) => setResourceForm({ ...resourceForm, developmentPlan: e.target.value })} rows={2} />
                      </div>
                      <div className="space-y-2">
                        <Label>Next Review Date</Label>
                        <Input type="date" value={resourceForm.nextReviewDate} onChange={(e) => setResourceForm({ ...resourceForm, nextReviewDate: e.target.value })} />
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="grid grid-cols-2 gap-2.5">
                        <div>
                          <Label className="text-sm text-muted-foreground">Assessment Date</Label>
                          <p className="font-medium">{format(new Date(selectedResource.assessmentDate), "dd MMMM yyyy")}</p>
                        </div>
                        <div>
                          <Label className="text-sm text-muted-foreground">Next Review Date</Label>
                          <p className="font-medium">{selectedResource.nextReviewDate ? format(new Date(selectedResource.nextReviewDate), "dd MMMM yyyy") : "-"}</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2.5">
                        <div>
                          <Label className="text-sm text-muted-foreground">Technical Knowledge</Label>
                          <div className="mt-1">
                            <Badge variant="outline">{selectedResource.technicalKnowledgeRating || "N/A"}</Badge>
                          </div>
                        </div>
                        <div>
                          <Label className="text-sm text-muted-foreground">Industry Experience</Label>
                          <p className="font-medium">{selectedResource.industryExperienceYears || 0} years</p>
                        </div>
                      </div>
                      {selectedResource.trainingNeedsIdentified && (
                        <div>
                          <Label className="text-sm text-muted-foreground">Training Needs Identified</Label>
                          <p className="mt-1 p-3 bg-muted rounded">{selectedResource.trainingNeedsIdentified}</p>
                        </div>
                      )}
                      {selectedResource.competencyGapAnalysis && (
                        <div>
                          <Label className="text-sm text-muted-foreground">Competency Gap Analysis</Label>
                          <p className="mt-1 p-3 bg-muted rounded">{selectedResource.competencyGapAnalysis}</p>
                        </div>
                      )}
                      {selectedResource.developmentPlan && (
                        <div>
                          <Label className="text-sm text-muted-foreground">Development Plan</Label>
                          <p className="mt-1 p-3 bg-muted rounded">{selectedResource.developmentPlan}</p>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
              {isEditingResource && (
                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowViewResourceDialog(false)}>Cancel</Button>
                  <Button 
                    onClick={() => updateResourceMutation.mutate({ id: selectedResource.id, data: resourceForm })} 
                    disabled={updateResourceMutation.isPending}
                  >
                    {updateResourceMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                    Save Changes
                  </Button>
                </DialogFooter>
              )}
            </DialogContent>
          </Dialog>
        </TabsContent>

        <TabsContent value="training" className="space-y-2.5">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>CPD & Training Register</CardTitle>
                <CardDescription>ICAP CPD compliance tracking - minimum 40 hours annually</CardDescription>
              </div>
              <div className="flex items-center gap-2.5">
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">Total CPD Hours</p>
                  <p className="text-lg font-bold text-primary">{trainingData?.totalHours || 0}</p>
                </div>
                <Dialog open={showTrainingDialog} onOpenChange={setShowTrainingDialog}>
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="h-4 w-4 mr-2" />
                      Log Training
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Log Training / CPD</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-2.5">
                      <div className="grid grid-cols-2 gap-2.5">
                        <div className="space-y-2">
                          <Label>Training Date</Label>
                          <Input type="date" value={trainingForm.trainingDate} onChange={(e) => setTrainingForm({ ...trainingForm, trainingDate: e.target.value })} />
                        </div>
                        <div className="space-y-2">
                          <Label>Training Type</Label>
                          <Select value={trainingForm.trainingType} onValueChange={(v: any) => setTrainingForm({ ...trainingForm, trainingType: v })}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="TECHNICAL">Technical</SelectItem>
                              <SelectItem value="SOFT_SKILLS">Soft Skills</SelectItem>
                              <SelectItem value="ETHICS">Ethics</SelectItem>
                              <SelectItem value="INDUSTRY_SPECIFIC">Industry Specific</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Topic</Label>
                        <Input value={trainingForm.topic} onChange={(e) => setTrainingForm({ ...trainingForm, topic: e.target.value })} />
                      </div>
                      <div className="space-y-2">
                        <Label>Provider</Label>
                        <Input value={trainingForm.provider} onChange={(e) => setTrainingForm({ ...trainingForm, provider: e.target.value })} />
                      </div>
                      <div className="grid grid-cols-2 gap-2.5">
                        <div className="space-y-2">
                          <Label>Duration (Hours)</Label>
                          <Input type="number" step="0.5" value={trainingForm.durationHours} onChange={(e) => setTrainingForm({ ...trainingForm, durationHours: parseFloat(e.target.value) })} />
                        </div>
                        <div className="space-y-2">
                          <Label>CPD Hours Claimed</Label>
                          <Input type="number" step="0.5" value={trainingForm.cpdHoursClaimed} onChange={(e) => setTrainingForm({ ...trainingForm, cpdHoursClaimed: parseFloat(e.target.value) })} />
                        </div>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setShowTrainingDialog(false)}>Cancel</Button>
                      <Button onClick={() => { createTrainingMutation.mutate(trainingForm); setShowTrainingDialog(false); }} disabled={createTrainingMutation.isPending}>
                        {createTrainingMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                        Save
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Topic</TableHead>
                    <TableHead>Provider</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>CPD Hours</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-[80px]">View</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(trainingData?.trainings || []).length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-muted-foreground py-2">
                        No training records yet
                      </TableCell>
                    </TableRow>
                  ) : (
                    (trainingData?.trainings || []).map((t: any) => (
                      <TableRow key={t.id}>
                        <TableCell>{format(new Date(t.trainingDate), "dd/MM/yyyy")}</TableCell>
                        <TableCell><Badge variant="outline">{t.trainingType}</Badge></TableCell>
                        <TableCell>{t.topic}</TableCell>
                        <TableCell>{t.provider || "-"}</TableCell>
                        <TableCell>{t.durationHours} hrs</TableCell>
                        <TableCell>{t.cpdHoursClaimed} hrs</TableCell>
                        <TableCell>
                          <Badge variant={t.verificationStatus === "Verified" ? "default" : "secondary"}>
                            {t.verificationStatus}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="h-8 w-8 p-0"
                              onClick={() => {
                                setSelectedTraining(t);
                                setIsEditingTraining(false);
                                setShowViewTrainingDialog(true);
                              }}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="h-8 w-8 p-0"
                              onClick={() => {
                                setSelectedTraining(t);
                                setIsEditingTraining(true);
                                setShowViewTrainingDialog(true);
                              }}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* View/Edit Training Dialog */}
          <Dialog open={showViewTrainingDialog} onOpenChange={setShowViewTrainingDialog}>
            <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{isEditingTraining ? "Edit" : "View"} Training</DialogTitle>
              </DialogHeader>
              {selectedTraining && (
                <div className="space-y-2.5">
                  {isEditingTraining ? (
                    <>
                      <div className="grid grid-cols-2 gap-2.5">
                        <div className="space-y-2">
                          <Label>Training Date</Label>
                          <Input type="date" value={trainingForm.trainingDate} onChange={(e) => setTrainingForm({ ...trainingForm, trainingDate: e.target.value })} />
                        </div>
                        <div className="space-y-2">
                          <Label>Training Type</Label>
                          <Select value={trainingForm.trainingType} onValueChange={(v: any) => setTrainingForm({ ...trainingForm, trainingType: v })}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="TECHNICAL">Technical</SelectItem>
                              <SelectItem value="SOFT_SKILLS">Soft Skills</SelectItem>
                              <SelectItem value="ETHICS">Ethics</SelectItem>
                              <SelectItem value="INDUSTRY_SPECIFIC">Industry Specific</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Topic</Label>
                        <Input value={trainingForm.topic} onChange={(e) => setTrainingForm({ ...trainingForm, topic: e.target.value })} />
                      </div>
                      <div className="space-y-2">
                        <Label>Provider</Label>
                        <Input value={trainingForm.provider} onChange={(e) => setTrainingForm({ ...trainingForm, provider: e.target.value })} />
                      </div>
                      <div className="grid grid-cols-2 gap-2.5">
                        <div className="space-y-2">
                          <Label>Duration (Hours)</Label>
                          <Input type="number" step="0.5" value={trainingForm.durationHours} onChange={(e) => setTrainingForm({ ...trainingForm, durationHours: parseFloat(e.target.value) })} />
                        </div>
                        <div className="space-y-2">
                          <Label>CPD Hours Claimed</Label>
                          <Input type="number" step="0.5" value={trainingForm.cpdHoursClaimed} onChange={(e) => setTrainingForm({ ...trainingForm, cpdHoursClaimed: parseFloat(e.target.value) })} />
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="grid grid-cols-2 gap-2.5">
                        <div>
                          <Label className="text-sm text-muted-foreground">Training Date</Label>
                          <p className="font-medium">{format(new Date(selectedTraining.trainingDate), "dd MMMM yyyy")}</p>
                        </div>
                        <div>
                          <Label className="text-sm text-muted-foreground">Training Type</Label>
                          <div className="mt-1">
                            <Badge variant="outline">{selectedTraining.trainingType}</Badge>
                          </div>
                        </div>
                      </div>
                      <div>
                        <Label className="text-sm text-muted-foreground">Topic</Label>
                        <p className="font-medium">{selectedTraining.topic}</p>
                      </div>
                      <div>
                        <Label className="text-sm text-muted-foreground">Provider</Label>
                        <p className="font-medium">{selectedTraining.provider || "-"}</p>
                      </div>
                      <div className="grid grid-cols-2 gap-2.5">
                        <div>
                          <Label className="text-sm text-muted-foreground">Duration</Label>
                          <p className="font-medium">{selectedTraining.durationHours} hours</p>
                        </div>
                        <div>
                          <Label className="text-sm text-muted-foreground">CPD Hours Claimed</Label>
                          <p className="font-medium">{selectedTraining.cpdHoursClaimed} hours</p>
                        </div>
                      </div>
                      <div>
                        <Label className="text-sm text-muted-foreground">Verification Status</Label>
                        <div className="mt-1">
                          <Badge variant={selectedTraining.verificationStatus === "Verified" ? "default" : "secondary"}>
                            {selectedTraining.verificationStatus}
                          </Badge>
                        </div>
                      </div>
                      {selectedTraining.verificationNotes && (
                        <div>
                          <Label className="text-sm text-muted-foreground">Verification Notes</Label>
                          <p className="mt-1 p-3 bg-muted rounded">{selectedTraining.verificationNotes}</p>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
              {isEditingTraining && (
                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowViewTrainingDialog(false)}>Cancel</Button>
                  <Button 
                    onClick={() => updateTrainingMutation.mutate({ 
                      id: selectedTraining.id, 
                      data: {
                        ...trainingForm,
                        durationHours: Number(trainingForm.durationHours),
                        cpdHoursClaimed: Number(trainingForm.cpdHoursClaimed),
                      }
                    })} 
                    disabled={updateTrainingMutation.isPending}
                  >
                    {updateTrainingMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                    Save Changes
                  </Button>
                </DialogFooter>
              )}
            </DialogContent>
          </Dialog>
        </TabsContent>

        <TabsContent value="monitoring" className="space-y-2.5">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Annual Monitoring Plan</CardTitle>
                <CardDescription>ISQM 1 para 35-47 - Monitoring and remediation process</CardDescription>
              </div>
              {isAdmin && (
                <Dialog open={showMonitoringDialog} onOpenChange={setShowMonitoringDialog}>
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Monitoring Plan
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-lg">
                    <DialogHeader>
                      <DialogTitle>Create Monitoring Plan</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-2.5">
                      <div className="grid grid-cols-2 gap-2.5">
                        <div className="space-y-2">
                          <Label>Plan Year</Label>
                          <Input type="number" value={monitoringForm.planYear} onChange={(e) => setMonitoringForm({ ...monitoringForm, planYear: parseInt(e.target.value) })} />
                        </div>
                        <div className="space-y-2">
                          <Label>Resources Allocated</Label>
                          <Input value={monitoringForm.resourcesAllocated} onChange={(e) => setMonitoringForm({ ...monitoringForm, resourcesAllocated: e.target.value })} placeholder="e.g., 2 Partners, 3 Managers" />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Scope of Monitoring</Label>
                        <Textarea value={monitoringForm.scopeOfMonitoring} onChange={(e) => setMonitoringForm({ ...monitoringForm, scopeOfMonitoring: e.target.value })} placeholder="Define the scope and coverage of monitoring activities..." rows={3} />
                      </div>
                      <div className="space-y-2">
                        <Label>Monitoring Methodology</Label>
                        <Textarea value={monitoringForm.monitoringMethodology} onChange={(e) => setMonitoringForm({ ...monitoringForm, monitoringMethodology: e.target.value })} placeholder="Describe the methodology for monitoring..." rows={2} />
                      </div>
                      <div className="grid grid-cols-2 gap-2.5">
                        <div className="space-y-2">
                          <Label>Planned Start Date</Label>
                          <Input type="date" value={monitoringForm.plannedStartDate} onChange={(e) => setMonitoringForm({ ...monitoringForm, plannedStartDate: e.target.value })} />
                        </div>
                        <div className="space-y-2">
                          <Label>Planned End Date</Label>
                          <Input type="date" value={monitoringForm.plannedEndDate} onChange={(e) => setMonitoringForm({ ...monitoringForm, plannedEndDate: e.target.value })} />
                        </div>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setShowMonitoringDialog(false)}>Cancel</Button>
                      <Button onClick={() => { createMonitoringMutation.mutate(monitoringForm); setShowMonitoringDialog(false); }} disabled={createMonitoringMutation.isPending}>
                        {createMonitoringMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                        Create Plan
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              )}
            </CardHeader>
            <CardContent>
              {!isManager ? (
                <div className="text-center py-2 text-muted-foreground">
                  <Lock className="h-8 w-8 mx-auto mb-2" />
                  <p>Manager or Partner access required</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Year</TableHead>
                      <TableHead>Scope</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Inspections</TableHead>
                      <TableHead>Start Date</TableHead>
                      <TableHead>End Date</TableHead>
                      <TableHead className="w-[80px]">View</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(monitoringPlans || []).length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-muted-foreground py-2">
                          No monitoring plans created
                        </TableCell>
                      </TableRow>
                    ) : (
                      (monitoringPlans || []).map((p: any) => (
                        <TableRow key={p.id}>
                          <TableCell className="font-medium">{p.planYear}</TableCell>
                          <TableCell className="max-w-xs truncate">{p.scopeOfMonitoring || "-"}</TableCell>
                          <TableCell><Badge variant="outline">{p.status}</Badge></TableCell>
                          <TableCell>{p.inspections?.length || 0}</TableCell>
                          <TableCell>{p.plannedStartDate ? format(new Date(p.plannedStartDate), "dd/MM/yyyy") : "-"}</TableCell>
                          <TableCell>{p.plannedEndDate ? format(new Date(p.plannedEndDate), "dd/MM/yyyy") : "-"}</TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="h-8 w-8 p-0"
                                onClick={() => {
                                  setSelectedMonitoring(p);
                                  setIsEditingMonitoring(false);
                                  setShowViewMonitoringDialog(true);
                                }}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="h-8 w-8 p-0"
                                onClick={() => {
                                  setSelectedMonitoring(p);
                                  setIsEditingMonitoring(true);
                                  setShowViewMonitoringDialog(true);
                                }}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* View/Edit Monitoring Dialog */}
          <Dialog open={showViewMonitoringDialog} onOpenChange={setShowViewMonitoringDialog}>
            <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{isEditingMonitoring ? "Edit" : "View"} Monitoring Plan</DialogTitle>
              </DialogHeader>
              {selectedMonitoring && (
                <div className="space-y-2.5">
                  {isEditingMonitoring ? (
                    <>
                      <div className="grid grid-cols-2 gap-2.5">
                        <div className="space-y-2">
                          <Label>Plan Year</Label>
                          <Input type="number" value={monitoringForm.planYear} onChange={(e) => setMonitoringForm({ ...monitoringForm, planYear: parseInt(e.target.value) })} />
                        </div>
                        <div className="space-y-2">
                          <Label>Resources Allocated</Label>
                          <Input value={monitoringForm.resourcesAllocated} onChange={(e) => setMonitoringForm({ ...monitoringForm, resourcesAllocated: e.target.value })} placeholder="e.g., 2 Partners, 3 Managers" />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Scope of Monitoring</Label>
                        <Textarea value={monitoringForm.scopeOfMonitoring} onChange={(e) => setMonitoringForm({ ...monitoringForm, scopeOfMonitoring: e.target.value })} rows={3} />
                      </div>
                      <div className="space-y-2">
                        <Label>Monitoring Methodology</Label>
                        <Textarea value={monitoringForm.monitoringMethodology} onChange={(e) => setMonitoringForm({ ...monitoringForm, monitoringMethodology: e.target.value })} rows={2} />
                      </div>
                      <div className="grid grid-cols-2 gap-2.5">
                        <div className="space-y-2">
                          <Label>Planned Start Date</Label>
                          <Input type="date" value={monitoringForm.plannedStartDate} onChange={(e) => setMonitoringForm({ ...monitoringForm, plannedStartDate: e.target.value })} />
                        </div>
                        <div className="space-y-2">
                          <Label>Planned End Date</Label>
                          <Input type="date" value={monitoringForm.plannedEndDate} onChange={(e) => setMonitoringForm({ ...monitoringForm, plannedEndDate: e.target.value })} />
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="grid grid-cols-2 gap-2.5">
                        <div>
                          <Label className="text-sm text-muted-foreground">Plan Year</Label>
                          <p className="font-medium text-lg">{selectedMonitoring.planYear}</p>
                        </div>
                        <div>
                          <Label className="text-sm text-muted-foreground">Status</Label>
                          <div className="mt-1">
                            <Badge variant="outline">{selectedMonitoring.status}</Badge>
                          </div>
                        </div>
                      </div>
                      {selectedMonitoring.scopeOfMonitoring && (
                        <div>
                          <Label className="text-sm text-muted-foreground">Scope of Monitoring</Label>
                          <p className="mt-1 p-3 bg-muted rounded">{selectedMonitoring.scopeOfMonitoring}</p>
                        </div>
                      )}
                      {selectedMonitoring.monitoringMethodology && (
                        <div>
                          <Label className="text-sm text-muted-foreground">Monitoring Methodology</Label>
                          <p className="mt-1 p-3 bg-muted rounded">{selectedMonitoring.monitoringMethodology}</p>
                        </div>
                      )}
                      <div className="grid grid-cols-2 gap-2.5">
                        <div>
                          <Label className="text-sm text-muted-foreground">Planned Start Date</Label>
                          <p className="font-medium">{selectedMonitoring.plannedStartDate ? format(new Date(selectedMonitoring.plannedStartDate), "dd MMMM yyyy") : "-"}</p>
                        </div>
                        <div>
                          <Label className="text-sm text-muted-foreground">Planned End Date</Label>
                          <p className="font-medium">{selectedMonitoring.plannedEndDate ? format(new Date(selectedMonitoring.plannedEndDate), "dd MMMM yyyy") : "-"}</p>
                        </div>
                      </div>
                      {selectedMonitoring.resourcesAllocated && (
                        <div>
                          <Label className="text-sm text-muted-foreground">Resources Allocated</Label>
                          <p className="font-medium">{selectedMonitoring.resourcesAllocated}</p>
                        </div>
                      )}
                      <div>
                        <Label className="text-sm text-muted-foreground">Inspections Conducted</Label>
                        <p className="font-medium">{selectedMonitoring.inspections?.length || 0}</p>
                      </div>
                    </>
                  )}
                </div>
              )}
              {isEditingMonitoring && (
                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowViewMonitoringDialog(false)}>Cancel</Button>
                  <Button 
                    onClick={() => updateMonitoringMutation.mutate({ id: selectedMonitoring.id, data: monitoringForm })} 
                    disabled={updateMonitoringMutation.isPending}
                  >
                    {updateMonitoringMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                    Save Changes
                  </Button>
                </DialogFooter>
              )}
            </DialogContent>
          </Dialog>
        </TabsContent>

        <TabsContent value="deficiencies" className="space-y-2.5">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Quality Deficiency Register</CardTitle>
                <CardDescription>ISQM 1 para 41-42 - Identified deficiencies and remediation</CardDescription>
              </div>
              {isManager && (
                <Dialog open={showDeficiencyDialog} onOpenChange={setShowDeficiencyDialog}>
                  <DialogTrigger asChild>
                    <Button variant="outline">
                      <Plus className="h-4 w-4 mr-2" />
                      Log Deficiency
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Log Quality Deficiency</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-2.5">
                      <div className="grid grid-cols-2 gap-2.5">
                        <div className="space-y-2">
                          <Label>Source</Label>
                          <Select value={deficiencyForm.sourceType} onValueChange={(v: any) => setDeficiencyForm({ ...deficiencyForm, sourceType: v })}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="MONITORING">Monitoring Review</SelectItem>
                              <SelectItem value="EQR">EQR Finding</SelectItem>
                              <SelectItem value="INTERNAL_REVIEW">Internal Review</SelectItem>
                              <SelectItem value="EXTERNAL_INSPECTION">External Inspection</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Severity</Label>
                          <Select value={deficiencyForm.severity} onValueChange={(v: any) => setDeficiencyForm({ ...deficiencyForm, severity: v })}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="SEVERE">Severe</SelectItem>
                              <SelectItem value="SIGNIFICANT">Significant</SelectItem>
                              <SelectItem value="MINOR_LEVEL">Minor</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Deficiency Description</Label>
                        <Textarea value={deficiencyForm.deficiencyDescription} onChange={(e) => setDeficiencyForm({ ...deficiencyForm, deficiencyDescription: e.target.value })} rows={3} />
                      </div>
                      <div className="space-y-2">
                        <Label>Root Cause Analysis</Label>
                        <Textarea value={deficiencyForm.rootCauseAnalysis} onChange={(e) => setDeficiencyForm({ ...deficiencyForm, rootCauseAnalysis: e.target.value })} rows={2} />
                      </div>
                      <div className="grid grid-cols-2 gap-2.5">
                        <div className="space-y-2">
                          <Label>Pervasiveness</Label>
                          <Select value={deficiencyForm.pervasiveness} onValueChange={(v: any) => setDeficiencyForm({ ...deficiencyForm, pervasiveness: v })}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="PERVASIVE">Pervasive</SelectItem>
                              <SelectItem value="LIMITED">Limited</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Target Resolution Date</Label>
                          <Input type="date" value={deficiencyForm.targetResolutionDate} onChange={(e) => setDeficiencyForm({ ...deficiencyForm, targetResolutionDate: e.target.value })} />
                        </div>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setShowDeficiencyDialog(false)}>Cancel</Button>
                      <Button onClick={() => { createDeficiencyMutation.mutate(deficiencyForm); setShowDeficiencyDialog(false); }} disabled={createDeficiencyMutation.isPending}>
                        {createDeficiencyMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                        Save
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              )}
            </CardHeader>
            <CardContent>
              {!isManager ? (
                <div className="text-center py-2 text-muted-foreground">
                  <Lock className="h-8 w-8 mx-auto mb-2" />
                  <p>Manager or Partner access required</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Source</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Severity</TableHead>
                      <TableHead>Pervasiveness</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Target Date</TableHead>
                      <TableHead className="w-[80px]">View</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(deficiencies || []).length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-muted-foreground py-2">
                          <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-green-500" />
                          No deficiencies recorded
                        </TableCell>
                      </TableRow>
                    ) : (
                      (deficiencies || []).map((d: any) => (
                        <TableRow key={d.id}>
                          <TableCell><Badge variant="outline">{d.sourceType}</Badge></TableCell>
                          <TableCell className="max-w-xs truncate">{d.deficiencyDescription}</TableCell>
                          <TableCell>
                            <Badge variant={d.severity === "SEVERE" ? "destructive" : d.severity === "SIGNIFICANT" ? "default" : "secondary"}>
                              {d.severity}
                            </Badge>
                          </TableCell>
                          <TableCell>{d.pervasiveness}</TableCell>
                          <TableCell>
                            <Badge variant={d.status === "Resolved" ? "default" : "outline"}>
                              {d.status}
                            </Badge>
                          </TableCell>
                          <TableCell>{d.targetResolutionDate ? format(new Date(d.targetResolutionDate), "dd/MM/yyyy") : "-"}</TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="h-8 w-8 p-0"
                                onClick={() => {
                                  setSelectedDeficiency(d);
                                  setIsEditingDeficiency(false);
                                  setShowViewDeficiencyDialog(true);
                                }}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="h-8 w-8 p-0"
                                onClick={() => {
                                  setSelectedDeficiency(d);
                                  setIsEditingDeficiency(true);
                                  setShowViewDeficiencyDialog(true);
                                }}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* View/Edit Deficiency Dialog */}
          <Dialog open={showViewDeficiencyDialog} onOpenChange={setShowViewDeficiencyDialog}>
            <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{isEditingDeficiency ? "Edit" : "View"} Quality Deficiency</DialogTitle>
              </DialogHeader>
              {selectedDeficiency && (
                <div className="space-y-2.5">
                  {isEditingDeficiency ? (
                    <>
                      <div className="grid grid-cols-2 gap-2.5">
                        <div className="space-y-2">
                          <Label>Source</Label>
                          <Select value={deficiencyForm.sourceType} onValueChange={(v: any) => setDeficiencyForm({ ...deficiencyForm, sourceType: v })}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="MONITORING">Monitoring Review</SelectItem>
                              <SelectItem value="EQR">EQR Finding</SelectItem>
                              <SelectItem value="INTERNAL_REVIEW">Internal Review</SelectItem>
                              <SelectItem value="EXTERNAL_INSPECTION">External Inspection</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Severity</Label>
                          <Select value={deficiencyForm.severity} onValueChange={(v: any) => setDeficiencyForm({ ...deficiencyForm, severity: v })}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="SEVERE">Severe</SelectItem>
                              <SelectItem value="SIGNIFICANT">Significant</SelectItem>
                              <SelectItem value="MINOR_LEVEL">Minor</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Deficiency Description</Label>
                        <Textarea value={deficiencyForm.deficiencyDescription} onChange={(e) => setDeficiencyForm({ ...deficiencyForm, deficiencyDescription: e.target.value })} rows={3} />
                      </div>
                      <div className="space-y-2">
                        <Label>Root Cause Analysis</Label>
                        <Textarea value={deficiencyForm.rootCauseAnalysis} onChange={(e) => setDeficiencyForm({ ...deficiencyForm, rootCauseAnalysis: e.target.value })} rows={2} />
                      </div>
                      <div className="grid grid-cols-2 gap-2.5">
                        <div className="space-y-2">
                          <Label>Pervasiveness</Label>
                          <Select value={deficiencyForm.pervasiveness} onValueChange={(v: any) => setDeficiencyForm({ ...deficiencyForm, pervasiveness: v })}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="PERVASIVE">Pervasive</SelectItem>
                              <SelectItem value="LIMITED">Limited</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Target Resolution Date</Label>
                          <Input type="date" value={deficiencyForm.targetResolutionDate} onChange={(e) => setDeficiencyForm({ ...deficiencyForm, targetResolutionDate: e.target.value })} />
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="grid grid-cols-2 gap-2.5">
                        <div>
                          <Label className="text-sm text-muted-foreground">Source Type</Label>
                          <div className="mt-1">
                            <Badge variant="outline">{selectedDeficiency.sourceType}</Badge>
                          </div>
                        </div>
                        <div>
                          <Label className="text-sm text-muted-foreground">Severity</Label>
                          <div className="mt-1">
                            <Badge variant={selectedDeficiency.severity === "SEVERE" ? "destructive" : selectedDeficiency.severity === "SIGNIFICANT" ? "default" : "secondary"}>
                              {selectedDeficiency.severity}
                            </Badge>
                          </div>
                        </div>
                      </div>
                      <div>
                        <Label className="text-sm text-muted-foreground">Deficiency Description</Label>
                        <p className="mt-1 p-3 bg-muted rounded">{selectedDeficiency.deficiencyDescription}</p>
                      </div>
                      {selectedDeficiency.rootCauseAnalysis && (
                        <div>
                          <Label className="text-sm text-muted-foreground">Root Cause Analysis</Label>
                          <p className="mt-1 p-3 bg-muted rounded">{selectedDeficiency.rootCauseAnalysis}</p>
                        </div>
                      )}
                      <div className="grid grid-cols-2 gap-2.5">
                        <div>
                          <Label className="text-sm text-muted-foreground">Pervasiveness</Label>
                          <p className="font-medium">{selectedDeficiency.pervasiveness}</p>
                        </div>
                        <div>
                          <Label className="text-sm text-muted-foreground">Status</Label>
                          <div className="mt-1">
                            <Badge variant={selectedDeficiency.status === "Resolved" ? "default" : "outline"}>
                              {selectedDeficiency.status}
                            </Badge>
                          </div>
                        </div>
                      </div>
                      {selectedDeficiency.targetResolutionDate && (
                        <div>
                          <Label className="text-sm text-muted-foreground">Target Resolution Date</Label>
                          <p className="font-medium">{format(new Date(selectedDeficiency.targetResolutionDate), "dd MMMM yyyy")}</p>
                        </div>
                      )}
                      {selectedDeficiency.remediationPlan && (
                        <div>
                          <Label className="text-sm text-muted-foreground">Remediation Plan</Label>
                          <p className="mt-1 p-3 bg-muted rounded">{selectedDeficiency.remediationPlan}</p>
                        </div>
                      )}
                      {selectedDeficiency.actualResolutionDate && (
                        <div>
                          <Label className="text-sm text-muted-foreground">Actual Resolution Date</Label>
                          <p className="font-medium">{format(new Date(selectedDeficiency.actualResolutionDate), "dd MMMM yyyy")}</p>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
              {isEditingDeficiency && (
                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowViewDeficiencyDialog(false)}>Cancel</Button>
                  <Button 
                    onClick={() => updateDeficiencyMutation.mutate({ id: selectedDeficiency.id, data: deficiencyForm })} 
                    disabled={updateDeficiencyMutation.isPending}
                  >
                    {updateDeficiencyMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                    Save Changes
                  </Button>
                </DialogFooter>
              )}
            </DialogContent>
          </Dialog>
        </TabsContent>

        <TabsContent value="objectives" className="space-y-2.5">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Quality Objectives & Risks</CardTitle>
                <CardDescription>ISQM 1 para 23-27 - Quality objectives and risk assessment</CardDescription>
              </div>
              {isAdmin && (
                <Dialog open={showObjectiveDialog} onOpenChange={setShowObjectiveDialog}>
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Objective
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add Quality Objective</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-2.5">
                      <div className="grid grid-cols-2 gap-2.5">
                        <div className="space-y-2">
                          <Label>ISQM Component</Label>
                          <Select value={objectiveForm.isqmComponent} onValueChange={(v: any) => setObjectiveForm({ ...objectiveForm, isqmComponent: v })}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="GOVERNANCE">Governance & Leadership</SelectItem>
                              <SelectItem value="ETHICS">Ethics & Independence</SelectItem>
                              <SelectItem value="CLIENT_ACCEPTANCE">Client Acceptance</SelectItem>
                              <SelectItem value="ENGAGEMENT_PERFORMANCE">Engagement Performance</SelectItem>
                              <SelectItem value="RESOURCES">Resources</SelectItem>
                              <SelectItem value="INFORMATION_COMMUNICATION">Information & Communication</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Objective Code</Label>
                          <Input value={objectiveForm.objectiveCode} onChange={(e) => setObjectiveForm({ ...objectiveForm, objectiveCode: e.target.value })} placeholder="e.g., QO-001" />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Objective Description</Label>
                        <Textarea value={objectiveForm.objectiveDescription} onChange={(e) => setObjectiveForm({ ...objectiveForm, objectiveDescription: e.target.value })} placeholder="Describe the quality objective..." rows={3} />
                      </div>
                      <div className="grid grid-cols-2 gap-2.5">
                        <div className="space-y-2">
                          <Label>Effective From</Label>
                          <Input type="date" value={objectiveForm.effectiveFrom} onChange={(e) => setObjectiveForm({ ...objectiveForm, effectiveFrom: e.target.value })} />
                        </div>
                        <div className="flex items-center space-x-2 pt-6">
                          <Switch checked={objectiveForm.isMandatory} onCheckedChange={(v) => setObjectiveForm({ ...objectiveForm, isMandatory: v })} />
                          <Label>Mandatory Objective</Label>
                        </div>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setShowObjectiveDialog(false)}>Cancel</Button>
                      <Button onClick={() => { createObjectiveMutation.mutate(objectiveForm); setShowObjectiveDialog(false); }} disabled={createObjectiveMutation.isPending || !objectiveForm.objectiveCode || !objectiveForm.objectiveDescription}>
                        {createObjectiveMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                        Add Objective
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              )}
            </CardHeader>
            <CardContent>
              <div className="space-y-2.5">
                {(qualityObjectives || []).length === 0 ? (
                  <div className="text-center py-2 text-muted-foreground">
                    No quality objectives defined yet
                  </div>
                ) : (
                  (qualityObjectives || []).map((obj: any) => (
                    <div key={obj.id} className="border rounded-lg p-2.5 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{obj.objectiveCode}</Badge>
                          <Badge variant="secondary">{obj.isqmComponent}</Badge>
                        </div>
                        <div className="flex items-center gap-2">
                          {obj.isMandatory && <Badge className="bg-blue-100 text-blue-800">Mandatory</Badge>}
                          <div className="flex gap-1">
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="h-8 w-8 p-0"
                              onClick={() => {
                                setSelectedObjective(obj);
                                setIsEditingObjective(false);
                                setShowViewObjectiveDialog(true);
                              }}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="h-8 w-8 p-0"
                              onClick={() => {
                                setSelectedObjective(obj);
                                setIsEditingObjective(true);
                                setShowViewObjectiveDialog(true);
                              }}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                      <p className="text-sm">{obj.objectiveDescription}</p>
                      {obj.risks?.length > 0 && (
                        <div className="mt-3 pl-4 border-l-2 space-y-2">
                          <p className="text-xs font-medium text-muted-foreground">Associated Risks:</p>
                          {obj.risks.map((risk: any) => (
                            <div key={risk.id} className="flex items-center gap-2 text-sm">
                              <AlertTriangle className="h-3 w-3 text-amber-500" />
                              <span className="font-mono text-xs">{risk.riskCode}</span>
                              <span>{risk.riskDescription}</span>
                              {risk.likelihood && <Badge variant="outline" className="text-xs">{risk.likelihood}</Badge>}
                              {risk.impact && <Badge variant="outline" className="text-xs">{risk.impact}</Badge>}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          {/* View/Edit Objective Dialog */}
          <Dialog open={showViewObjectiveDialog} onOpenChange={setShowViewObjectiveDialog}>
            <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{isEditingObjective ? "Edit" : "View"} Quality Objective</DialogTitle>
              </DialogHeader>
              {selectedObjective && (
                <div className="space-y-2.5">
                  {isEditingObjective ? (
                    <>
                      <div className="grid grid-cols-2 gap-2.5">
                        <div className="space-y-2">
                          <Label>ISQM Component</Label>
                          <Select value={objectiveForm.isqmComponent} onValueChange={(v: any) => setObjectiveForm({ ...objectiveForm, isqmComponent: v })}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="GOVERNANCE">Governance & Leadership</SelectItem>
                              <SelectItem value="ETHICS">Ethics & Independence</SelectItem>
                              <SelectItem value="CLIENT_ACCEPTANCE">Client Acceptance</SelectItem>
                              <SelectItem value="ENGAGEMENT_PERFORMANCE">Engagement Performance</SelectItem>
                              <SelectItem value="RESOURCES">Resources</SelectItem>
                              <SelectItem value="INFORMATION_COMMUNICATION">Information & Communication</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Objective Code</Label>
                          <Input value={objectiveForm.objectiveCode} onChange={(e) => setObjectiveForm({ ...objectiveForm, objectiveCode: e.target.value })} placeholder="e.g., QO-001" />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Objective Description</Label>
                        <Textarea value={objectiveForm.objectiveDescription} onChange={(e) => setObjectiveForm({ ...objectiveForm, objectiveDescription: e.target.value })} rows={3} />
                      </div>
                      <div className="grid grid-cols-2 gap-2.5">
                        <div className="space-y-2">
                          <Label>Effective From</Label>
                          <Input type="date" value={objectiveForm.effectiveFrom} onChange={(e) => setObjectiveForm({ ...objectiveForm, effectiveFrom: e.target.value })} />
                        </div>
                        <div className="flex items-center space-x-2 pt-6">
                          <Switch checked={objectiveForm.isMandatory} onCheckedChange={(v) => setObjectiveForm({ ...objectiveForm, isMandatory: v })} />
                          <Label>Mandatory Objective</Label>
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="grid grid-cols-2 gap-2.5">
                        <div>
                          <Label className="text-sm text-muted-foreground">Objective Code</Label>
                          <p className="font-medium text-lg">{selectedObjective.objectiveCode}</p>
                        </div>
                        <div>
                          <Label className="text-sm text-muted-foreground">ISQM Component</Label>
                          <div className="mt-1">
                            <Badge variant="secondary">{selectedObjective.isqmComponent}</Badge>
                          </div>
                        </div>
                      </div>
                      <div>
                        <Label className="text-sm text-muted-foreground">Objective Description</Label>
                        <p className="mt-1 p-3 bg-muted rounded">{selectedObjective.objectiveDescription}</p>
                      </div>
                      <div className="grid grid-cols-2 gap-2.5">
                        <div>
                          <Label className="text-sm text-muted-foreground">Effective From</Label>
                          <p className="font-medium">{selectedObjective.effectiveFrom ? format(new Date(selectedObjective.effectiveFrom), "dd MMMM yyyy") : "-"}</p>
                        </div>
                        <div>
                          <Label className="text-sm text-muted-foreground">Mandatory</Label>
                          <div className="mt-1">
                            {selectedObjective.isMandatory ? (
                              <Badge className="bg-blue-100 text-blue-800">Yes</Badge>
                            ) : (
                              <Badge variant="outline">No</Badge>
                            )}
                          </div>
                        </div>
                      </div>
                      {selectedObjective.risks && selectedObjective.risks.length > 0 && (
                        <div>
                          <Label className="text-sm text-muted-foreground">Associated Risks</Label>
                          <div className="mt-2 space-y-2">
                            {selectedObjective.risks.map((risk: any) => (
                              <div key={risk.id} className="p-3 bg-muted rounded space-y-2">
                                <div className="flex items-center gap-2">
                                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                                  <span className="font-mono text-sm font-medium">{risk.riskCode}</span>
                                </div>
                                <p className="text-sm">{risk.riskDescription}</p>
                                <div className="flex gap-2">
                                  {risk.likelihood && <Badge variant="outline">Likelihood: {risk.likelihood}</Badge>}
                                  {risk.impact && <Badge variant="outline">Impact: {risk.impact}</Badge>}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
              {isEditingObjective && (
                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowViewObjectiveDialog(false)}>Cancel</Button>
                  <Button 
                    onClick={() => updateObjectiveMutation.mutate({ id: selectedObjective.id, data: objectiveForm })} 
                    disabled={updateObjectiveMutation.isPending}
                  >
                    {updateObjectiveMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                    Save Changes
                  </Button>
                </DialogFooter>
              )}
            </DialogContent>
          </Dialog>
        </TabsContent>

        <TabsContent value="policies" className="space-y-2.5">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Quality Management Policies</CardTitle>
                <CardDescription>Firm policies and procedures documentation</CardDescription>
              </div>
              {isAdmin && (
                <Dialog open={showPolicyDialog} onOpenChange={setShowPolicyDialog}>
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Policy
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add Policy Document</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-2.5">
                      <div className="grid grid-cols-2 gap-2.5">
                        <div className="space-y-2">
                          <Label>Policy Category</Label>
                          <Select value={policyForm.policyCategory} onValueChange={(v) => setPolicyForm({ ...policyForm, policyCategory: v })}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="QUALITY_MANAGEMENT">Quality Management</SelectItem>
                              <SelectItem value="ETHICS_INDEPENDENCE">Ethics & Independence</SelectItem>
                              <SelectItem value="CLIENT_ACCEPTANCE">Client Acceptance</SelectItem>
                              <SelectItem value="ENGAGEMENT_PERFORMANCE">Engagement Performance</SelectItem>
                              <SelectItem value="HR_RESOURCES">HR & Resources</SelectItem>
                              <SelectItem value="MONITORING">Monitoring</SelectItem>
                              <SelectItem value="INFORMATION_SECURITY">Information Security</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Policy Number</Label>
                          <Input value={policyForm.policyNumber} onChange={(e) => setPolicyForm({ ...policyForm, policyNumber: e.target.value })} placeholder="e.g., POL-001" />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Policy Name</Label>
                        <Input value={policyForm.policyName} onChange={(e) => setPolicyForm({ ...policyForm, policyName: e.target.value })} placeholder="Enter policy name" />
                      </div>
                      <div className="grid grid-cols-3 gap-2.5">
                        <div className="space-y-2">
                          <Label>Version</Label>
                          <Input value={policyForm.versionNumber} onChange={(e) => setPolicyForm({ ...policyForm, versionNumber: e.target.value })} placeholder="1.0" />
                        </div>
                        <div className="space-y-2">
                          <Label>Effective Date</Label>
                          <Input type="date" value={policyForm.effectiveDate} onChange={(e) => setPolicyForm({ ...policyForm, effectiveDate: e.target.value })} />
                        </div>
                        <div className="space-y-2">
                          <Label>Review Date</Label>
                          <Input type="date" value={policyForm.reviewDate} onChange={(e) => setPolicyForm({ ...policyForm, reviewDate: e.target.value })} />
                        </div>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setShowPolicyDialog(false)}>Cancel</Button>
                      <Button onClick={() => { createPolicyMutation.mutate(policyForm); setShowPolicyDialog(false); }} disabled={createPolicyMutation.isPending || !policyForm.policyName}>
                        {createPolicyMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                        Add Policy
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              )}
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Policy #</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Policy Name</TableHead>
                    <TableHead>Version</TableHead>
                    <TableHead>Effective Date</TableHead>
                    <TableHead>Review Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-[80px]">View</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(policies || []).length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-muted-foreground py-2">
                        No policies documented yet
                      </TableCell>
                    </TableRow>
                  ) : (
                    (policies || []).map((p: any) => (
                      <TableRow key={p.id}>
                        <TableCell className="font-mono">{p.policyNumber || "-"}</TableCell>
                        <TableCell><Badge variant="outline">{p.policyCategory}</Badge></TableCell>
                        <TableCell>{p.policyName}</TableCell>
                        <TableCell>{p.versionNumber || "-"}</TableCell>
                        <TableCell>{p.effectiveDate ? format(new Date(p.effectiveDate), "dd/MM/yyyy") : "-"}</TableCell>
                        <TableCell>{p.reviewDate ? format(new Date(p.reviewDate), "dd/MM/yyyy") : "-"}</TableCell>
                        <TableCell>
                          <Badge variant={p.isActive ? "default" : "secondary"}>
                            {p.isActive ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="h-8 w-8 p-0"
                              onClick={() => {
                                setSelectedPolicy(p);
                                setIsEditingPolicy(false);
                                setShowViewPolicyDialog(true);
                              }}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="h-8 w-8 p-0"
                              onClick={() => {
                                setSelectedPolicy(p);
                                setIsEditingPolicy(true);
                                setShowViewPolicyDialog(true);
                              }}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* View/Edit Policy Dialog */}
          <Dialog open={showViewPolicyDialog} onOpenChange={setShowViewPolicyDialog}>
            <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{isEditingPolicy ? "Edit" : "View"} Policy Document</DialogTitle>
              </DialogHeader>
              {selectedPolicy && (
                <div className="space-y-2.5">
                  {isEditingPolicy ? (
                    <>
                      <div className="grid grid-cols-2 gap-2.5">
                        <div className="space-y-2">
                          <Label>Policy Category</Label>
                          <Select value={policyForm.policyCategory} onValueChange={(v) => setPolicyForm({ ...policyForm, policyCategory: v })}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="QUALITY_MANAGEMENT">Quality Management</SelectItem>
                              <SelectItem value="ETHICS_INDEPENDENCE">Ethics & Independence</SelectItem>
                              <SelectItem value="CLIENT_ACCEPTANCE">Client Acceptance</SelectItem>
                              <SelectItem value="ENGAGEMENT_PERFORMANCE">Engagement Performance</SelectItem>
                              <SelectItem value="HR_RESOURCES">HR & Resources</SelectItem>
                              <SelectItem value="MONITORING">Monitoring</SelectItem>
                              <SelectItem value="INFORMATION_SECURITY">Information Security</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Policy Number</Label>
                          <Input value={policyForm.policyNumber} onChange={(e) => setPolicyForm({ ...policyForm, policyNumber: e.target.value })} placeholder="e.g., POL-001" />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Policy Name</Label>
                        <Input value={policyForm.policyName} onChange={(e) => setPolicyForm({ ...policyForm, policyName: e.target.value })} />
                      </div>
                      <div className="grid grid-cols-3 gap-2.5">
                        <div className="space-y-2">
                          <Label>Version</Label>
                          <Input value={policyForm.versionNumber} onChange={(e) => setPolicyForm({ ...policyForm, versionNumber: e.target.value })} placeholder="1.0" />
                        </div>
                        <div className="space-y-2">
                          <Label>Effective Date</Label>
                          <Input type="date" value={policyForm.effectiveDate} onChange={(e) => setPolicyForm({ ...policyForm, effectiveDate: e.target.value })} />
                        </div>
                        <div className="space-y-2">
                          <Label>Review Date</Label>
                          <Input type="date" value={policyForm.reviewDate} onChange={(e) => setPolicyForm({ ...policyForm, reviewDate: e.target.value })} />
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="grid grid-cols-2 gap-2.5">
                        <div>
                          <Label className="text-sm text-muted-foreground">Policy Number</Label>
                          <p className="font-medium font-mono">{selectedPolicy.policyNumber || "-"}</p>
                        </div>
                        <div>
                          <Label className="text-sm text-muted-foreground">Category</Label>
                          <div className="mt-1">
                            <Badge variant="outline">{selectedPolicy.policyCategory}</Badge>
                          </div>
                        </div>
                      </div>
                      <div>
                        <Label className="text-sm text-muted-foreground">Policy Name</Label>
                        <p className="font-medium text-lg">{selectedPolicy.policyName}</p>
                      </div>
                      <div className="grid grid-cols-3 gap-2.5">
                        <div>
                          <Label className="text-sm text-muted-foreground">Version</Label>
                          <p className="font-medium">{selectedPolicy.versionNumber || "-"}</p>
                        </div>
                        <div>
                          <Label className="text-sm text-muted-foreground">Effective Date</Label>
                          <p className="font-medium">{selectedPolicy.effectiveDate ? format(new Date(selectedPolicy.effectiveDate), "dd MMM yyyy") : "-"}</p>
                        </div>
                        <div>
                          <Label className="text-sm text-muted-foreground">Review Date</Label>
                          <p className="font-medium">{selectedPolicy.reviewDate ? format(new Date(selectedPolicy.reviewDate), "dd MMM yyyy") : "-"}</p>
                        </div>
                      </div>
                      <div>
                        <Label className="text-sm text-muted-foreground">Status</Label>
                        <div className="mt-1">
                          <Badge variant={selectedPolicy.isActive ? "default" : "secondary"}>
                            {selectedPolicy.isActive ? "Active" : "Inactive"}
                          </Badge>
                        </div>
                      </div>
                      {selectedPolicy.approvedBy && (
                        <div>
                          <Label className="text-sm text-muted-foreground">Approved By</Label>
                          <p className="font-medium">{selectedPolicy.approvedBy}</p>
                        </div>
                      )}
                      {selectedPolicy.approvalDate && (
                        <div>
                          <Label className="text-sm text-muted-foreground">Approval Date</Label>
                          <p className="font-medium">{format(new Date(selectedPolicy.approvalDate), "dd MMMM yyyy")}</p>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
              {isEditingPolicy && (
                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowViewPolicyDialog(false)}>Cancel</Button>
                  <Button 
                    onClick={() => updatePolicyMutation.mutate({ id: selectedPolicy.id, data: policyForm })} 
                    disabled={updatePolicyMutation.isPending}
                  >
                    {updatePolicyMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                    Save Changes
                  </Button>
                </DialogFooter>
              )}
            </DialogContent>
          </Dialog>
        </TabsContent>

        {/* ISQM 1 Components Tab */}
        <TabsContent value="isqm1" className="space-y-2.5">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5" />
                ISQM 1 — Quality Management Components
              </CardTitle>
              <CardDescription>7 ISQM 1 components with objectives, risks, responses, and compliance scoring</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {ISQM_COMPONENTS.map((comp) => {
                  const cs = complianceDashboard?.componentScores?.[comp.key];
                  const score = cs?.score ?? 0;
                  const status = cs?.status ?? "red";
                  const CompIcon = comp.icon;
                  const compObjectives = (fwcObjectives || []).filter((o: any) => o.componentType === comp.key);
                  const compRisks = (fwcRisks || []).filter((r: any) => compObjectives.some((o: any) => o.id === r.objectiveId));
                  return (
                    <Card key={comp.key} className={`cursor-pointer transition-all hover:shadow-md ${selectedComponent === comp.key ? "ring-2 ring-primary" : ""}`} onClick={() => setSelectedComponent(comp.key)} data-testid={`card-isqm-component-${comp.key}`}>
                      <CardContent className="pt-4 pb-3">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <CompIcon className="h-4 w-4 text-primary" />
                            <span className="font-medium text-sm">{comp.label}</span>
                          </div>
                          <div className={`w-3 h-3 rounded-full ${getStatusColor(status)}`} />
                        </div>
                        <div className="flex items-center gap-2 mt-2">
                          <div className="flex-1 h-2 bg-secondary rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${score >= 80 ? "bg-emerald-500" : score >= 50 ? "bg-amber-500" : "bg-red-500"}`} style={{ width: `${score}%` }} />
                          </div>
                          <span className="text-xs font-semibold">{score}%</span>
                        </div>
                        <div className="flex gap-3 mt-2 text-xs text-muted-foreground">
                          <span>{compObjectives.length} objectives</span>
                          <span>{compRisks.length} risks</span>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              {/* Selected Component Detail */}
              <div className="mt-2.5 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">{ISQM_COMPONENTS.find(c => c.key === selectedComponent)?.label || "Select Component"}</h3>
                  {isAdmin && (
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => { setFwcObjectiveForm({ ...fwcObjectiveForm, componentType: selectedComponent }); setShowAddFwcObjectiveDialog(true); }} data-testid="button-add-objective">
                        <Plus className="h-3 w-3 mr-1" /> Objective
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setShowAddFwcRiskDialog(true)} data-testid="button-add-risk">
                        <Plus className="h-3 w-3 mr-1" /> Risk
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setShowAddFwcResponseDialog(true)} data-testid="button-add-response">
                        <Plus className="h-3 w-3 mr-1" /> Response
                      </Button>
                    </div>
                  )}
                </div>

                {/* Objectives for selected component */}
                <div className="space-y-2">
                  {(fwcObjectives || []).filter((o: any) => o.componentType === selectedComponent).map((obj: any) => (
                    <Card key={obj.id} className="border" data-testid={`card-objective-${obj.id}`}>
                      <CardContent className="py-3">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <CircleDot className="h-4 w-4 text-primary" />
                              <span className="font-medium">{obj.title}</span>
                              <Badge variant={obj.status === "approved" ? "default" : obj.status === "draft" ? "secondary" : "outline"} className="text-xs">
                                {obj.status}
                              </Badge>
                            </div>
                            {obj.description && <p className="text-sm text-muted-foreground mt-1 ml-6">{obj.description}</p>}
                          </div>
                          {isAdmin && obj.status === "draft" && (
                            <Button size="sm" variant="ghost" onClick={() => updateFwcObjectiveMutation.mutate({ id: obj.id, data: { status: "approved" } })} data-testid={`button-approve-objective-${obj.id}`}>
                              <CheckCircle2 className="h-4 w-4 mr-1" /> Approve
                            </Button>
                          )}
                        </div>

                        {/* Risks for this objective */}
                        {obj.risks?.length > 0 && (
                          <div className="ml-6 mt-2 space-y-1">
                            <span className="text-xs font-medium text-muted-foreground">Risks:</span>
                            {obj.risks.map((risk: any) => (
                              <div key={risk.id} className="flex items-center gap-2 text-sm pl-2 border-l-2 border-amber-400" data-testid={`text-risk-${risk.id}`}>
                                <AlertTriangle className="h-3 w-3 text-amber-500" />
                                <span>{risk.riskTitle}</span>
                                <Badge variant="outline" className="text-xs">{risk.riskRating}</Badge>
                                <Badge variant={risk.status === "mitigated" ? "default" : "secondary"} className="text-xs">{risk.status}</Badge>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Responses for this objective */}
                        {obj.responses?.length > 0 && (
                          <div className="ml-6 mt-2 space-y-1">
                            <span className="text-xs font-medium text-muted-foreground">Responses:</span>
                            {obj.responses.map((resp: any) => (
                              <div key={resp.id} className="flex items-center gap-2 text-sm pl-2 border-l-2 border-emerald-400" data-testid={`text-response-${resp.id}`}>
                                <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                                <span>{resp.responseTitle}</span>
                                <Badge variant={resp.implementationStatus === "tested" ? "default" : resp.implementationStatus === "implemented" ? "secondary" : "outline"} className="text-xs">
                                  {resp.implementationStatus}
                                </Badge>
                              </div>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                  {(fwcObjectives || []).filter((o: any) => o.componentType === selectedComponent).length === 0 && (
                    <div className="text-center py-2 text-muted-foreground">
                      <Target className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No quality objectives defined for this component yet.</p>
                      {isAdmin && <p className="text-xs mt-1">Click "Objective" to add one.</p>}
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Add Objective Dialog */}
          <Dialog open={showAddFwcObjectiveDialog} onOpenChange={setShowAddFwcObjectiveDialog}>
            <DialogContent>
              <DialogHeader><DialogTitle>Add Quality Objective</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label>Component</Label>
                  <Select value={fwcObjectiveForm.componentType} onValueChange={(v) => setFwcObjectiveForm({ ...fwcObjectiveForm, componentType: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ISQM_COMPONENTS.map(c => <SelectItem key={c.key} value={c.key}>{c.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Title</Label>
                  <Input value={fwcObjectiveForm.title} onChange={(e) => setFwcObjectiveForm({ ...fwcObjectiveForm, title: e.target.value })} data-testid="input-objective-title" />
                </div>
                <div>
                  <Label>Description</Label>
                  <Textarea value={fwcObjectiveForm.description} onChange={(e) => setFwcObjectiveForm({ ...fwcObjectiveForm, description: e.target.value })} data-testid="input-objective-description" />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowAddFwcObjectiveDialog(false)}>Cancel</Button>
                <Button onClick={() => createFwcObjectiveMutation.mutate(fwcObjectiveForm)} disabled={createFwcObjectiveMutation.isPending || !fwcObjectiveForm.title} data-testid="button-submit-objective">
                  {createFwcObjectiveMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  Create Objective
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Add Risk Dialog */}
          <Dialog open={showAddFwcRiskDialog} onOpenChange={setShowAddFwcRiskDialog}>
            <DialogContent>
              <DialogHeader><DialogTitle>Identify Risk</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label>Linked Objective</Label>
                  <Select value={fwcRiskForm.objectiveId} onValueChange={(v) => setFwcRiskForm({ ...fwcRiskForm, objectiveId: v })}>
                    <SelectTrigger><SelectValue placeholder="Select objective" /></SelectTrigger>
                    <SelectContent>
                      {(fwcObjectives || []).filter((o: any) => o.componentType === selectedComponent).map((o: any) => (
                        <SelectItem key={o.id} value={o.id}>{o.title}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Risk Title</Label>
                  <Input value={fwcRiskForm.riskTitle} onChange={(e) => setFwcRiskForm({ ...fwcRiskForm, riskTitle: e.target.value })} data-testid="input-risk-title" />
                </div>
                <div>
                  <Label>Description</Label>
                  <Textarea value={fwcRiskForm.riskDescription} onChange={(e) => setFwcRiskForm({ ...fwcRiskForm, riskDescription: e.target.value })} />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <Label>Likelihood</Label>
                    <Select value={fwcRiskForm.likelihood} onValueChange={(v) => setFwcRiskForm({ ...fwcRiskForm, likelihood: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Impact</Label>
                    <Select value={fwcRiskForm.impact} onValueChange={(v) => setFwcRiskForm({ ...fwcRiskForm, impact: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Rating</Label>
                    <Select value={fwcRiskForm.riskRating} onValueChange={(v) => setFwcRiskForm({ ...fwcRiskForm, riskRating: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="critical">Critical</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowAddFwcRiskDialog(false)}>Cancel</Button>
                <Button onClick={() => createFwcRiskMutation.mutate(fwcRiskForm)} disabled={createFwcRiskMutation.isPending || !fwcRiskForm.objectiveId || !fwcRiskForm.riskTitle} data-testid="button-submit-risk">
                  {createFwcRiskMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  Identify Risk
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Add Response Dialog */}
          <Dialog open={showAddFwcResponseDialog} onOpenChange={setShowAddFwcResponseDialog}>
            <DialogContent>
              <DialogHeader><DialogTitle>Design Response</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label>Linked Objective</Label>
                  <Select value={fwcResponseForm.objectiveId} onValueChange={(v) => setFwcResponseForm({ ...fwcResponseForm, objectiveId: v })}>
                    <SelectTrigger><SelectValue placeholder="Select objective" /></SelectTrigger>
                    <SelectContent>
                      {(fwcObjectives || []).filter((o: any) => o.componentType === selectedComponent).map((o: any) => (
                        <SelectItem key={o.id} value={o.id}>{o.title}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Response Title</Label>
                  <Input value={fwcResponseForm.responseTitle} onChange={(e) => setFwcResponseForm({ ...fwcResponseForm, responseTitle: e.target.value })} data-testid="input-response-title" />
                </div>
                <div>
                  <Label>Design Description</Label>
                  <Textarea value={fwcResponseForm.designDescription} onChange={(e) => setFwcResponseForm({ ...fwcResponseForm, designDescription: e.target.value })} />
                </div>
                <div>
                  <Label>Implementation Status</Label>
                  <Select value={fwcResponseForm.implementationStatus} onValueChange={(v) => setFwcResponseForm({ ...fwcResponseForm, implementationStatus: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="planned">Planned</SelectItem>
                      <SelectItem value="in_progress">In Progress</SelectItem>
                      <SelectItem value="implemented">Implemented</SelectItem>
                      <SelectItem value="tested">Tested</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowAddFwcResponseDialog(false)}>Cancel</Button>
                <Button onClick={() => createFwcResponseMutation.mutate(fwcResponseForm)} disabled={createFwcResponseMutation.isPending || !fwcResponseForm.objectiveId || !fwcResponseForm.responseTitle} data-testid="button-submit-response">
                  {createFwcResponseMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  Create Response
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </TabsContent>

        {/* EQR (ISQM 2) Tab */}
        <TabsContent value="eqcr" className="space-y-2.5">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Gavel className="h-5 w-5" />
                    ISQM 2 — Engagement Quality Review
                  </CardTitle>
                  <CardDescription>Manage EQR policy, assignments, and completion tracking</CardDescription>
                </div>
                {isAdmin && (
                  <Button size="sm" onClick={() => setShowAddEqcrDialog(true)} data-testid="button-add-eqcr">
                    <Plus className="h-4 w-4 mr-1" /> Assign EQR
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-2.5">
              {/* EQCR Policy Summary */}
              <Card className="bg-muted/50">
                <CardContent className="pt-4">
                  <h4 className="font-medium text-sm mb-2">EQR Policy Configuration</h4>
                  <div className="grid grid-cols-3 gap-2.5 text-sm">
                    <div>
                      <span className="text-muted-foreground">Independence Confirmation:</span>
                      <Badge variant={eqcrPolicy?.independenceConfirmRequired !== false ? "default" : "secondary"} className="ml-2">
                        {eqcrPolicy?.independenceConfirmRequired !== false ? "Required" : "Optional"}
                      </Badge>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Checklist Required:</span>
                      <Badge variant={eqcrPolicy?.checklistRequired !== false ? "default" : "secondary"} className="ml-2">
                        {eqcrPolicy?.checklistRequired !== false ? "Yes" : "No"}
                      </Badge>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Status:</span>
                      <Badge variant={eqcrPolicy ? "default" : "outline"} className="ml-2">
                        {eqcrPolicy ? "Configured" : "Not Set"}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* EQCR Assignments Table */}
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>EQR Partner</TableHead>
                    <TableHead>Engagement</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Completed</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(eqcrAssignments || []).map((a: any) => (
                    <TableRow key={a.id} data-testid={`row-eqcr-${a.id}`}>
                      <TableCell className="font-medium">{a.eqcrPartner?.fullName || "—"}</TableCell>
                      <TableCell>{a.engagementId ? a.engagementId.substring(0, 8) + "..." : "Firm-level"}</TableCell>
                      <TableCell>
                        <Badge variant={a.status === "completed" ? "default" : a.status === "in_review" ? "secondary" : "outline"}>
                          {a.status}
                        </Badge>
                      </TableCell>
                      <TableCell>{a.completedAt ? format(new Date(a.completedAt), "dd MMM yyyy") : "—"}</TableCell>
                    </TableRow>
                  ))}
                  {(!eqcrAssignments || eqcrAssignments.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground py-2">
                        No EQR assignments yet
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Add EQCR Assignment Dialog */}
          <Dialog open={showAddEqcrDialog} onOpenChange={setShowAddEqcrDialog}>
            <DialogContent>
              <DialogHeader><DialogTitle>Assign EQR Partner</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label>EQR Partner User ID</Label>
                  <Input value={eqcrForm.eqcrPartnerUserId} onChange={(e) => setEqcrForm({ ...eqcrForm, eqcrPartnerUserId: e.target.value })} placeholder="Enter partner user ID" data-testid="input-eqcr-partner" />
                </div>
                <div>
                  <Label>Engagement ID (optional)</Label>
                  <Input value={eqcrForm.engagementId} onChange={(e) => setEqcrForm({ ...eqcrForm, engagementId: e.target.value })} placeholder="Leave empty for firm-level" data-testid="input-eqcr-engagement" />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowAddEqcrDialog(false)}>Cancel</Button>
                <Button onClick={() => createEqcrAssignmentMutation.mutate(eqcrForm)} disabled={createEqcrAssignmentMutation.isPending || !eqcrForm.eqcrPartnerUserId} data-testid="button-submit-eqcr">
                  {createEqcrAssignmentMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  Assign
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </TabsContent>

        {/* Documentation Library Tab */}
        <TabsContent value="docs" className="space-y-2.5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
            <ModuleTemplates moduleName="isqm-governance" title="ISQM Governance Templates" collapsible={false} defaultExpanded />
            <ModuleTemplates moduleName="isqm-resources" title="ISQM HR & Resources" collapsible={false} defaultExpanded />
            <ModuleTemplates moduleName="isqm-monitoring" title="ISQM Monitoring" collapsible={false} defaultExpanded />
          </div>
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Library className="h-5 w-5" />
                    Documentation Library
                  </CardTitle>
                  <CardDescription>Centralized policy documents, quality manuals, and version control</CardDescription>
                </div>
                {isAdmin && (
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => setShowAddPolicyDocDialog(true)} data-testid="button-add-policy-doc">
                      <Plus className="h-4 w-4 mr-1" /> Add Document
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setShowAddVersionDialog(true)} data-testid="button-add-version">
                      <Plus className="h-4 w-4 mr-1" /> New Version
                    </Button>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-2.5">
              {/* Version Control */}
              <div>
                <h4 className="font-medium text-sm mb-2">ISQM Version Control</h4>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Version</TableHead>
                      <TableHead>Change Summary</TableHead>
                      <TableHead>Approved By</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(isqmVersions || []).map((v: any) => (
                      <TableRow key={v.id} data-testid={`row-version-${v.id}`}>
                        <TableCell className="font-mono font-medium">{v.manualVersion}</TableCell>
                        <TableCell>{v.changeSummary || "—"}</TableCell>
                        <TableCell>{v.approvedBy?.fullName || "—"}</TableCell>
                        <TableCell>{format(new Date(v.createdAt), "dd MMM yyyy")}</TableCell>
                      </TableRow>
                    ))}
                    {(!isqmVersions || isqmVersions.length === 0) && (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-muted-foreground py-3">No version records</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Policy Documents */}
              <div>
                <h4 className="font-medium text-sm mb-2">Firm Policy Documents</h4>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Type</TableHead>
                      <TableHead>Title</TableHead>
                      <TableHead>Version</TableHead>
                      <TableHead>Uploaded By</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(policyDocuments || []).map((doc: any) => (
                      <TableRow key={doc.id} data-testid={`row-policy-doc-${doc.id}`}>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">{doc.docType.replace(/_/g, " ")}</Badge>
                        </TableCell>
                        <TableCell className="font-medium">{doc.title}</TableCell>
                        <TableCell>{doc.version || "—"}</TableCell>
                        <TableCell>{doc.uploadedBy?.fullName || "—"}</TableCell>
                        <TableCell>{format(new Date(doc.uploadedAt), "dd MMM yyyy")}</TableCell>
                      </TableRow>
                    ))}
                    {(!policyDocuments || policyDocuments.length === 0) && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground py-3">No policy documents uploaded</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Add Policy Document Dialog */}
          <Dialog open={showAddPolicyDocDialog} onOpenChange={setShowAddPolicyDocDialog}>
            <DialogContent>
              <DialogHeader><DialogTitle>Add Policy Document</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label>Document Type</Label>
                  <Select value={policyDocForm.docType} onValueChange={(v) => setPolicyDocForm({ ...policyDocForm, docType: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="quality_manual">Quality Manual</SelectItem>
                      <SelectItem value="ethics_policy">Ethics Policy</SelectItem>
                      <SelectItem value="acceptance_policy">Acceptance Policy</SelectItem>
                      <SelectItem value="eqcr_policy">EQR Policy</SelectItem>
                      <SelectItem value="monitoring_plan">Monitoring Plan</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Title</Label>
                  <Input value={policyDocForm.title} onChange={(e) => setPolicyDocForm({ ...policyDocForm, title: e.target.value })} data-testid="input-policy-doc-title" />
                </div>
                <div>
                  <Label>Version</Label>
                  <Input value={policyDocForm.version} onChange={(e) => setPolicyDocForm({ ...policyDocForm, version: e.target.value })} />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowAddPolicyDocDialog(false)}>Cancel</Button>
                <Button onClick={() => createPolicyDocMutation.mutate(policyDocForm)} disabled={createPolicyDocMutation.isPending || !policyDocForm.title} data-testid="button-submit-policy-doc">
                  {createPolicyDocMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  Add Document
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Add Version Dialog */}
          <Dialog open={showAddVersionDialog} onOpenChange={setShowAddVersionDialog}>
            <DialogContent>
              <DialogHeader><DialogTitle>Create Version Record</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label>Version Number</Label>
                  <Input value={versionForm.manualVersion} onChange={(e) => setVersionForm({ ...versionForm, manualVersion: e.target.value })} placeholder="e.g. 2.0" data-testid="input-version-number" />
                </div>
                <div>
                  <Label>Change Summary</Label>
                  <Textarea value={versionForm.changeSummary} onChange={(e) => setVersionForm({ ...versionForm, changeSummary: e.target.value })} data-testid="input-version-summary" />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowAddVersionDialog(false)}>Cancel</Button>
                <Button onClick={() => createVersionMutation.mutate(versionForm)} disabled={createVersionMutation.isPending || !versionForm.manualVersion} data-testid="button-submit-version">
                  {createVersionMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  Create Version
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </TabsContent>

        {/* Activity Log Tab */}
        <TabsContent value="activity" className="space-y-2.5">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Activity Log
              </CardTitle>
              <CardDescription>Complete audit trail of all firm-wide control changes</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Timestamp</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Entity</TableHead>
                    <TableHead>Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(activityLogs || []).map((log: any) => (
                    <TableRow key={log.id} data-testid={`row-activity-${log.id}`}>
                      <TableCell className="text-xs font-mono">{format(new Date(log.createdAt), "dd MMM yyyy HH:mm")}</TableCell>
                      <TableCell>{log.actor?.fullName || log.actorUserId}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">{log.entityType}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={log.action === "create" ? "default" : log.action === "update" ? "secondary" : "destructive"} className="text-xs">
                          {log.action}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                  {(!activityLogs || activityLogs.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground py-2">
                        No activity logs yet
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
