import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams, useLocation } from "wouter";
import { useEngagement } from "@/lib/workspace-context";
import { Button } from "@/components/ui/button";
import { SimpleTabNavigation } from "@/components/numbered-tab-navigation";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { PageShell } from "@/components/page-shell";
import { AIAssistBanner, PHASE_AI_CONFIGS } from "@/components/ai-assist-banner";
import { usePreplanningSaveBridge } from "@/hooks/use-preplanning-save-bridge";
import { useToast } from "@/hooks/use-toast";
import { fetchWithAuth } from "@/lib/fetchWithAuth";
import {
  EngagementSetupSection,
  EthicsIndependenceSection,
  EngagementTeamSection,
  EngagementLetterSection,
  SignOffGateSection,
  AcceptanceDueDiligenceSection,
  EntityUnderstandingSection,
  getDefaultEngagementSetupData,
  getDefaultEthicsIndependenceData,
  getDefaultEngagementTeamData,
  getDefaultEngagementLetterData,
  getDefaultSignOffGateData,
  getDefaultAcceptanceDueDiligenceData,
  getDefaultEntityUnderstandingData,
  getDefaultRiskAssessmentData,
  getDefaultMaterialityData,
  getDefaultAnalyticsOpeningBalancesData,
  getDefaultAuditStrategyData,
  computePreplanningStatuses,
  computeGateChecksFromStatuses,
  TAB_DEPENDENCIES,
  TAB_ORDER,
} from "@/components/preplanning-wizard";
import type {
  EngagementSetupData,
  EthicsIndependenceData,
  EngagementTeamData,
  EngagementLetterData,
  SignOffGateData,
  AcceptanceDueDiligenceData,
  EntityUnderstandingData,
  RiskAssessmentData,
  MaterialityData,
  AnalyticsOpeningBalancesData,
  AuditStrategyData,
} from "@/components/preplanning-wizard";
import {
  ClipboardCheck, ArrowRight, Loader2, FileOutput, AlertTriangle,
} from "lucide-react";

function mapRoleToTeamRole(role: string): "associate" | "senior" | "manager" | "partner" | "eqcr" | "" {
  const r = (role || "").toLowerCase();
  if (r.includes("partner")) return "partner";
  if (r.includes("manager")) return "manager";
  if (r.includes("senior") || r.includes("teamlead") || r.includes("team_lead")) return "senior";
  if (r.includes("eqcr")) return "eqcr";
  if (r.includes("staff") || r.includes("associate") || r.includes("junior")) return "associate";
  return "";
}

const STEP_IDS = [
  "setup", "entity_understanding", "ethics",
  "acceptance_due_diligence", "letter",
  "signoff",
] as const;
type StepId = typeof STEP_IDS[number];

const PREPLANNING_TABS = [
  { id: "setup", label: "Engagement Setup (ISA 300/210)" },
  { id: "entity_understanding", label: "Entity Understanding (ISA 315)" },
  { id: "ethics", label: "Ethics & Independence (ISA 220)" },
  { id: "acceptance_due_diligence", label: "Acceptance & Continuance (ISA 210/220)" },
  { id: "letter", label: "Engagement Letter (ISA 210)" },
  { id: "signoff", label: "Completion & Sign-off (ISA 300)" },
];

export default function PrePlanning() {
  const params = useParams<{ engagementId: string }>();
  const [, navigate] = useLocation();
  const {
    engagementId: contextEngagementId,
    engagement,
    client,
    refreshEngagement,
  } = useEngagement();
  const engagementId = params.engagementId || contextEngagementId || "";
  const { toast } = useToast();

  const [activeStep, setActiveStep] = useState<StepId>(() => {
    const saved = localStorage.getItem(`preplanning-wizard-step-${engagementId}`);
    if (saved && STEP_IDS.includes(saved as StepId)) return saved as StepId;
    return "setup";
  });

  const [isProceedLoading, setIsProceedLoading] = useState(false);
  const [isGeneratingOutputs, setIsGeneratingOutputs] = useState(false);

  const [setupData, setSetupData] = useState<EngagementSetupData>(getDefaultEngagementSetupData);
  const [acceptanceData, setAcceptanceData] = useState<AcceptanceDueDiligenceData>(() => getDefaultAcceptanceDueDiligenceData(engagementId));
  const [ethicsData, setEthicsData] = useState<EthicsIndependenceData>(() => getDefaultEthicsIndependenceData(engagementId));
  const [teamData, setTeamData] = useState<EngagementTeamData>(() => getDefaultEngagementTeamData(engagementId));
  const [letterData, setLetterData] = useState<EngagementLetterData>(() => getDefaultEngagementLetterData(engagementId));
  const [entityUnderstandingData, setEntityUnderstandingData] = useState<EntityUnderstandingData>(() => getDefaultEntityUnderstandingData(engagementId));
  const [riskAssessmentData, setRiskAssessmentData] = useState<RiskAssessmentData>(() => getDefaultRiskAssessmentData(engagementId));
  const [materialityData, setMaterialityData] = useState<MaterialityData>(() => getDefaultMaterialityData(engagementId));
  const [analyticsOpeningData, setAnalyticsOpeningData] = useState<AnalyticsOpeningBalancesData>(() => getDefaultAnalyticsOpeningBalancesData(engagementId));
  const [strategyTcwgData, setStrategyTcwgData] = useState<AuditStrategyData>(() => getDefaultAuditStrategyData(engagementId));
  const [signoffData, setSignoffData] = useState<SignOffGateData>(getDefaultSignOffGateData);

  const tabStatuses = useMemo(() =>
    computePreplanningStatuses(
      setupData, acceptanceData, ethicsData, teamData, letterData,
      entityUnderstandingData, riskAssessmentData, materialityData,
      analyticsOpeningData, strategyTcwgData, signoffData
    ),
    [setupData, acceptanceData, ethicsData, teamData, letterData,
     entityUnderstandingData, riskAssessmentData, materialityData,
     analyticsOpeningData, strategyTcwgData, signoffData]
  );

  const computedGateChecks = useMemo(() => {
    const { signoff: _, ...otherStatuses } = tabStatuses;
    return computeGateChecksFromStatuses(otherStatuses);
  }, [tabStatuses]);

  useEffect(() => {
    const stripIcons = (checks: typeof computedGateChecks) =>
      (checks || []).map(({ icon, ...rest }) => rest);
    const currentSerialized = JSON.stringify(stripIcons(signoffData.gateChecks));
    const computedSerialized = JSON.stringify(stripIcons(computedGateChecks));
    if (currentSerialized !== computedSerialized) {
      setSignoffData(prev => ({ ...prev, gateChecks: computedGateChecks }));
    }
  }, [computedGateChecks]);

  const getDependencyWarnings = useCallback((tabId: string): string[] => {
    const deps = TAB_DEPENDENCIES[tabId as keyof typeof TAB_DEPENDENCIES] || [];
    const sortedDeps = [...deps].sort(
      (a, b) => TAB_ORDER.indexOf(a) - TAB_ORDER.indexOf(b)
    );
    const warnings: string[] = [];
    for (const dep of sortedDeps) {
      const depStatus = tabStatuses[dep as keyof typeof tabStatuses];
      if (depStatus && depStatus.status !== "complete" && depStatus.status !== "warning") {
        const tabLabel = PREPLANNING_TABS.find(t => t.id === dep)?.label || dep;
        warnings.push(`"${tabLabel}" is ${depStatus.label.toLowerCase()}`);
      }
    }
    return warnings;
  }, [tabStatuses]);

  const buildPayload = useCallback(() => ({
    activeStep,
    setupData,
    acceptanceData,
    ethicsData,
    teamData,
    letterData,
    entityUnderstandingData,
    riskAssessmentData,
    materialityData,
    analyticsOpeningData,
    strategyTcwgData,
    signoffData,
  }), [activeStep, setupData, acceptanceData, ethicsData, teamData, letterData,
       entityUnderstandingData, riskAssessmentData, materialityData,
       analyticsOpeningData, strategyTcwgData, signoffData]);

  const saveEngine = usePreplanningSaveBridge(engagementId, buildPayload);

  useEffect(() => {
    localStorage.setItem(`preplanning-wizard-step-${engagementId}`, activeStep);
  }, [activeStep, engagementId]);

  useEffect(() => {
    if (!engagementId) return;
    const loadSavedData = async () => {
      try {
        const response = await fetchWithAuth(`/api/engagements/${engagementId}/pre-planning`);
        if (!response.ok) return;
        const result = await response.json();
        const saved = result?.data?.data || result?.data || {};
        if (saved.setupData) setSetupData(prev => ({ ...prev, ...saved.setupData }));
        if (saved.acceptanceData) setAcceptanceData(prev => {
          const merged = { ...prev, ...saved.acceptanceData };
          merged.independenceCheck = { ...prev.independenceCheck, ...(saved.acceptanceData.independenceCheck || {}) };
          merged.competenceAssessment = { ...prev.competenceAssessment, ...(saved.acceptanceData.competenceAssessment || {}) };
          merged.engagementRiskGrading = {
            ...prev.engagementRiskGrading,
            ...(saved.acceptanceData.engagementRiskGrading || {}),
            riskFactors: {
              ...prev.engagementRiskGrading.riskFactors,
              ...(saved.acceptanceData.engagementRiskGrading?.riskFactors || saved.acceptanceData.dueDiligence?.riskFactors || {}),
            },
          };
          merged.dueDiligence = { ...prev.dueDiligence, ...(saved.acceptanceData.dueDiligence || {}) };
          merged.dueDiligence.entityIdentity = { ...prev.dueDiligence.entityIdentity, ...(saved.acceptanceData.dueDiligence?.entityIdentity || {}) };
          return merged;
        });
        if (saved.ethicsData) setEthicsData(prev => ({ ...prev, ...saved.ethicsData }));
        if (saved.teamData) setTeamData(prev => ({ ...prev, ...saved.teamData }));
        if (saved.letterData) setLetterData(prev => {
          const merged = { ...prev, ...saved.letterData };
          merged.templateVariables = { ...prev.templateVariables, ...(saved.letterData.templateVariables || {}) };
          return merged;
        });
        if (saved.entityUnderstandingData) setEntityUnderstandingData(prev => {
          const merged = { ...prev, ...saved.entityUnderstandingData };
          merged.entityBackground = { ...prev.entityBackground, ...(saved.entityUnderstandingData.entityBackground || {}) };
          merged.industryEnvironment = { ...prev.industryEnvironment, ...(saved.entityUnderstandingData.industryEnvironment || {}) };
          merged.businessOperations = { ...prev.businessOperations, ...(saved.entityUnderstandingData.businessOperations || {}) };
          merged.governance = { ...prev.governance, ...(saved.entityUnderstandingData.governance || {}) };
          merged.internalControlEnvironment = { ...prev.internalControlEnvironment, ...(saved.entityUnderstandingData.internalControlEnvironment || {}) };
          merged.itEnvironmentAssessment = { ...prev.itEnvironmentAssessment, ...(saved.entityUnderstandingData.itEnvironmentAssessment || {}) };
          merged.reportingFramework = { ...prev.reportingFramework, ...(saved.entityUnderstandingData.reportingFramework || {}) };
          merged.signOff = { ...prev.signOff, ...(saved.entityUnderstandingData.signOff || {}) };
          return merged;
        });
        if (saved.riskAssessmentData) setRiskAssessmentData(prev => {
          const merged = { ...prev, ...saved.riskAssessmentData };
          merged.inherentRiskFactors = { ...prev.inherentRiskFactors, ...(saved.riskAssessmentData.inherentRiskFactors || {}) };
          merged.fraudRiskFactors = { ...prev.fraudRiskFactors, ...(saved.riskAssessmentData.fraudRiskFactors || {}) };
          merged.presumedRisks = { ...prev.presumedRisks, ...(saved.riskAssessmentData.presumedRisks || {}) };
          merged.goingConcernAssessment = { ...prev.goingConcernAssessment, ...(saved.riskAssessmentData.goingConcernAssessment || {}) };
          merged.overallRiskAssessment = { ...prev.overallRiskAssessment, ...(saved.riskAssessmentData.overallRiskAssessment || {}) };
          merged.signOff = { ...prev.signOff, ...(saved.riskAssessmentData.signOff || {}) };
          return merged;
        });
        if (saved.materialityData) setMaterialityData(prev => {
          const merged = { ...prev, ...saved.materialityData };
          merged.financialData = { ...prev.financialData, ...(saved.materialityData.financialData || {}) };
          merged.materialityComputation = { ...prev.materialityComputation, ...(saved.materialityData.materialityComputation || {}) };
          merged.componentMateriality = { ...prev.componentMateriality, ...(saved.materialityData.componentMateriality || {}) };
          merged.clearlyTrivialThreshold = { ...prev.clearlyTrivialThreshold, ...(saved.materialityData.clearlyTrivialThreshold || {}) };
          merged.signOff = { ...prev.signOff, ...(saved.materialityData.signOff || {}) };
          return merged;
        });
        if (saved.analyticsOpeningData) setAnalyticsOpeningData(prev => {
          const merged = { ...prev, ...saved.analyticsOpeningData };
          merged.openingBalancesReview = { ...prev.openingBalancesReview, ...(saved.analyticsOpeningData.openingBalancesReview || {}) };
          if (saved.analyticsOpeningData.openingBalancesReview) {
            const savedOB = saved.analyticsOpeningData.openingBalancesReview;
            merged.openingBalancesReview.priorYearOpinion = { ...prev.openingBalancesReview.priorYearOpinion, ...(savedOB.priorYearOpinion || {}) };
            merged.openingBalancesReview.rollForwardStrategy = { ...prev.openingBalancesReview.rollForwardStrategy, ...(savedOB.rollForwardStrategy || {}) };
            merged.openingBalancesReview.firstYearProcedures = { ...prev.openingBalancesReview.firstYearProcedures, ...(savedOB.firstYearProcedures || {}) };
          }
          merged.trendAnalysis = { ...prev.trendAnalysis, ...(saved.analyticsOpeningData.trendAnalysis || {}) };
          merged.ratioAnalysis = { ...prev.ratioAnalysis, ...(saved.analyticsOpeningData.ratioAnalysis || {}) };
          if (merged.ratioAnalysis.standardRatios) {
            merged.ratioAnalysis.standardRatios = { ...prev.ratioAnalysis.standardRatios, ...(saved.analyticsOpeningData.ratioAnalysis?.standardRatios || {}) };
          }
          merged.budgetVsActual = { ...prev.budgetVsActual, ...(saved.analyticsOpeningData.budgetVsActual || {}) };
          merged.unusualFluctuations = { ...prev.unusualFluctuations, ...(saved.analyticsOpeningData.unusualFluctuations || {}) };
          merged.signOff = { ...prev.signOff, ...(saved.analyticsOpeningData.signOff || {}) };
          return merged;
        });
        if (saved.strategyTcwgData) setStrategyTcwgData(prev => {
          const merged = { ...prev, ...saved.strategyTcwgData };
          merged.overallStrategy = { ...prev.overallStrategy, ...(saved.strategyTcwgData.overallStrategy || {}) };
          merged.resourceTimingPlan = { ...prev.resourceTimingPlan, ...(saved.strategyTcwgData.resourceTimingPlan || {}) };
          merged.plannedCommunications = { ...prev.plannedCommunications, ...(saved.strategyTcwgData.plannedCommunications || {}) };
          merged.tcwgCommunication = { ...prev.tcwgCommunication, ...(saved.strategyTcwgData.tcwgCommunication || {}) };
          if (saved.strategyTcwgData.tcwgCommunication?.independenceConfirmation) {
            merged.tcwgCommunication.independenceConfirmation = { ...prev.tcwgCommunication.independenceConfirmation, ...saved.strategyTcwgData.tcwgCommunication.independenceConfirmation };
          }
          merged.signOff = { ...prev.signOff, ...(saved.strategyTcwgData.signOff || {}) };
          return merged;
        });
        if (saved.signoffData) setSignoffData(prev => {
          const merged = { ...prev, ...saved.signoffData };
          merged.completionChecklist = saved.signoffData.completionChecklist || prev.completionChecklist;
          merged.auditStrategyApproval = { ...prev.auditStrategyApproval, ...(saved.signoffData.auditStrategyApproval || {}) };
          merged.eqcrClearance = { ...prev.eqcrClearance, ...(saved.signoffData.eqcrClearance || {}) };
          merged.partnerSignOff = { ...prev.partnerSignOff, ...(saved.signoffData.partnerSignOff || {}) };
          return merged;
        });
        if (saved.activeStep && STEP_IDS.includes(saved.activeStep)) setActiveStep(saved.activeStep);
        saveEngine.initializeBaseline();
      } catch {
      }
    };
    loadSavedData();
  }, [engagementId]);

  useEffect(() => {
    if (!engagementId) return;
    const fetchContext = async () => {
      try {
        const response = await fetchWithAuth(`/api/pre-planning/context/${engagementId}`);
        if (!response.ok) return;
        const ctx = await response.json();
        const cm = ctx.clientMaster;
        const priorYear = ctx.priorYearData;

        if (ctx.tbTotals) {
          setMaterialityData(prev => {
            if (prev.financialData.revenue === 0 && prev.financialData.totalAssets === 0) {
              return {
                ...prev,
                financialData: {
                  revenue: ctx.materialityBenchmarks?.revenue || ctx.tbTotals?.totalRevenue || 0,
                  totalAssets: ctx.materialityBenchmarks?.totalAssets || ctx.tbTotals?.totalAssets || 0,
                  profitBeforeTax: ctx.materialityBenchmarks?.profitBeforeTax || ctx.tbTotals?.profitBeforeTax || 0,
                  equity: ctx.materialityBenchmarks?.equity || ctx.tbTotals?.totalEquity || 0,
                  grossProfit: ctx.materialityBenchmarks?.grossProfit || ctx.tbTotals?.grossProfit || 0,
                },
              };
            }
            return prev;
          });
        }

        if (cm) {
          setAcceptanceData(prev => {
            const dd = prev.dueDiligence;
            const ei = dd.entityIdentity;
            const hasIdentity = ei.registrationNumber || ei.secpNtn || ei.incorporationDate;
            if (hasIdentity) return prev;

            const directors = (cm.directors || []).map((d: any, i: number) => ({
              id: `auto-dir-${i}`,
              name: d.name || "",
              role: "director" as const,
              cnicPassport: "",
              nationality: "",
              ownershipPercentage: 0,
              isPEP: false,
              pepDetails: "",
              verified: false,
            }));
            const owners = (cm.owners || []).map((o: any, i: number) => ({
              id: `auto-own-${i}`,
              name: o.name || "",
              role: (o.isUBO ? "beneficial_owner" : "shareholder") as "beneficial_owner" | "shareholder",
              cnicPassport: "",
              nationality: "",
              ownershipPercentage: parseFloat(String(o.holdingPercentage || 0)),
              isPEP: !!o.isPEP,
              pepDetails: "",
              verified: false,
            }));

            return {
              ...prev,
              dueDiligence: {
                ...dd,
                entityIdentity: {
                  ...ei,
                  registrationNumber: cm.secpRegNo || "",
                  secpNtn: cm.ntn || "",
                  incorporationDate: cm.dateOfIncorporation || "",
                  registeredAddress: cm.registeredAddress || "",
                  natureOfBusiness: cm.natureOfBusiness || cm.principalLineOfBusiness || "",
                  principalActivities: cm.principalLineOfBusiness || "",
                },
                directorsAndOwners: dd.directorsAndOwners.length === 0 ? [...directors, ...owners] : dd.directorsAndOwners,
              },
            };
          });

          setEntityUnderstandingData(prev => {
            const eb = prev.entityBackground;
            const isEmpty = !eb.nature && !eb.legalStructure && !eb.ownership;
            if (!isEmpty) return prev;

            const ownersSummary = (cm.owners || [])
              .map((o: any) => `${o.name} (${o.holdingPercentage || 0}%)`)
              .join(", ");
            const directorsList = (cm.directors || [])
              .map((d: any) => `${d.name} — ${d.designation || "Director"}`)
              .join("; ");
            const regulatoryBodies = Array.isArray(cm.regulatoryBodies)
              ? cm.regulatoryBodies.join(", ")
              : cm.regulatoryBodies || "";

            return {
              ...prev,
              entityBackground: {
                ...eb,
                nature: [ctx.client?.industry, ctx.client?.subIndustry].filter(Boolean).join(" — ") || "",
                legalStructure: cm.legalForm || "",
                ownership: ownersSummary || "",
                dateOfIncorporation: cm.dateOfIncorporation || "",
                registeredOffice: cm.registeredAddress || "",
                sizeClassification: cm.listedStatus === "Listed" ? "listed" as const : eb.sizeClassification,
              },
              industryEnvironment: {
                ...prev.industryEnvironment,
                regulatoryEnvironment: prev.industryEnvironment.regulatoryEnvironment || regulatoryBodies,
              },
              governance: {
                ...prev.governance,
                governanceStructure: prev.governance.governanceStructure || (cm.listedStatus === "Listed" ? "Listed entity with formal governance framework" : cm.legalForm || ""),
                tcwgComposition: prev.governance.tcwgComposition || directorsList,
                auditCommitteeExists: cm.listedStatus === "Listed" ? true : prev.governance.auditCommitteeExists,
              },
            };
          });
        }

        if (ctx.team && ctx.team.length > 0) {
          setTeamData(prev => {
            if (prev.teamMembers.some(m => m.name)) return prev;
            const teamMembers = ctx.team.map((t: any, i: number) => ({
              id: `auto-team-${i}`,
              name: t.userName || "",
              role: mapRoleToTeamRole(t.role),
              email: t.userEmail || "",
              qualifications: "",
              industryExperience: "",
              yearsExperience: 0,
              competenceConfirmed: false,
              competenceNotes: "",
              trainingNeeds: "",
              briefingCompleted: false,
              briefingDate: "",
              allocatedHours: 0,
              reviewLevel: t.role === "ENGAGEMENT_PARTNER" || t.role === "partner" ? "approver" as const : t.role === "ENGAGEMENT_MANAGER" || t.role === "manager" ? "reviewer" as const : "preparer" as const,
            }));
            return { ...prev, teamMembers };
          });
        }

        if (cm) {
          setStrategyTcwgData(prev => {
            if (prev.tcwgIdentification.length > 0) return prev;
            const directors = (cm.directors || []).map((d: any, i: number) => ({
              id: `auto-tcwg-${i}`,
              name: d.name || "",
              role: d.designation || "Director",
              contact: "",
            }));
            const contacts = (cm.contacts || []).map((c: any, i: number) => ({
              id: `auto-contact-${i}`,
              name: c.name || "",
              role: c.role || "",
              contact: c.email || "",
            }));
            return {
              ...prev,
              tcwgIdentification: [...directors, ...contacts].slice(0, 20),
            };
          });
        }

        if (priorYear) {
          setAnalyticsOpeningData(prev => {
            const pyo = prev.openingBalancesReview.priorYearOpinion;
            if (pyo.opinionType || pyo.priorAuditorFirm) return prev;
            return {
              ...prev,
              openingBalancesReview: {
                ...prev.openingBalancesReview,
                priorYearOpinion: {
                  ...pyo,
                  priorPeriodEnd: priorYear.periodEnd || "",
                },
              },
            };
          });

          if (ctx.tbTotals && priorYear.financials) {
            setAnalyticsOpeningData(prev => {
              if (prev.trendAnalysis.items.length > 0) return prev;
              const trendItems = [
                { label: "Total Revenue", current: ctx.tbTotals.totalRevenue, prior: priorYear.financials.revenue },
                { label: "Total Assets", current: ctx.tbTotals.totalAssets, prior: priorYear.financials.totalAssets },
                { label: "Profit Before Tax", current: ctx.tbTotals.profitBeforeTax, prior: priorYear.financials.profitBeforeTax },
                { label: "Total Equity", current: ctx.tbTotals.totalEquity, prior: priorYear.financials.totalEquity || 0 },
                { label: "Total Expenses", current: ctx.tbTotals.totalExpenses, prior: priorYear.financials.totalExpenses || 0 },
              ].filter(t => t.current || t.prior);

              const items = trendItems.map((t, i) => {
                const change = (t.current || 0) - (t.prior || 0);
                const pct = t.prior ? Math.round((change / Math.abs(t.prior)) * 10000) / 100 : 0;
                return {
                  id: `auto-trend-${i}`,
                  lineItem: t.label,
                  currentYear: t.current || 0,
                  priorYear: t.prior || 0,
                  changeAmount: change,
                  changePercent: pct,
                  significanceFlag: Math.abs(pct) > 10,
                  explanation: "",
                };
              });

              return {
                ...prev,
                trendAnalysis: { ...prev.trendAnalysis, items },
              };
            });
          }
        }

        if (ctx.tbAccounts && ctx.tbAccounts.length > 0) {
          setRiskAssessmentData(prev => {
            if (prev.significantAccounts.length > 0) return prev;
            const pm = materialityData.materialityComputation.performanceMateriality;
            if (!pm || pm <= 0) return prev;
            const significantAccounts = ctx.tbAccounts
              .filter((a: any) => Math.abs(a.netBalance || 0) >= pm)
              .map((a: any, i: number) => ({
                id: `auto-sa-${i}`,
                accountName: a.accountName || a.accountCode || "",
                balance: Math.abs(a.netBalance || 0),
                exceedsMateriality: true,
                qualitativeSignificance: "",
                riskClassification: "significant" as const,
              }));
            if (significantAccounts.length === 0) return prev;
            return { ...prev, significantAccounts };
          });
        }

      } catch {
      }
    };
    fetchContext();
  }, [engagementId]);

  const handleSetupChange = useCallback((data: EngagementSetupData) => {
    setSetupData(data);
    saveEngine.signalChange();
  }, [saveEngine]);

  const handleAcceptanceChange = useCallback((data: AcceptanceDueDiligenceData) => {
    setAcceptanceData(data);
    saveEngine.signalChange();
  }, [saveEngine]);

  const handleEthicsChange = useCallback((data: EthicsIndependenceData) => {
    setEthicsData(data);
    saveEngine.signalChange();
  }, [saveEngine]);

  const handleLetterChange = useCallback((data: EngagementLetterData) => {
    setLetterData(data);
    saveEngine.signalChange();
  }, [saveEngine]);

  const handleEntityUnderstandingChange = useCallback((data: EntityUnderstandingData) => {
    setEntityUnderstandingData(data);
    saveEngine.signalChange();
  }, [saveEngine]);


  const handleSignoffChange = useCallback((data: SignOffGateData) => {
    setSignoffData(data);
    saveEngine.signalChange();
  }, [saveEngine]);

  const handleGenerateOutputs = useCallback(async () => {
    setIsGeneratingOutputs(true);
    try {
      const response = await fetchWithAuth(`/api/engagements/${engagementId}/outputs/generate-phase2`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const result = await response.json();
      if (response.ok && result.success) {
        toast({
          title: "Pre-Planning Outputs Generated",
          description: `Created ${result.outputsCreated} outputs${result.outputsSkipped > 0 ? `, ${result.outputsSkipped} already existed` : ""}. View them in Outputs page.`,
        });
      } else {
        throw new Error(result.error || "Failed to generate outputs");
      }
    } catch (error: any) {
      toast({
        title: "Generation Failed",
        description: error.message || "Unable to generate Pre-Planning outputs",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingOutputs(false);
    }
  }, [engagementId, toast]);

  const handleProceed = useCallback(async () => {
    setIsProceedLoading(true);
    try {
      await saveEngine.saveFinal();
      toast({
        title: "Progress Saved",
        description: "Proceeding to Planning phase...",
      });
      navigate(`/workspace/${engagementId}/planning`);
    } catch (error) {
      toast({
        title: "Save Required",
        description: "Please save your work before proceeding.",
        variant: "destructive",
      });
    } finally {
      setIsProceedLoading(false);
    }
  }, [saveEngine, toast, navigate, engagementId]);

  const saveFn = useCallback(async () => {
    try {
      await saveEngine.saveFinal();
      if (engagementId) {
        fetchWithAuth(`/api/engagements/${engagementId}/outputs/generate-phase2`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        }).catch(() => {});
      }
      return { ok: true };
    } catch (error) {
      return { ok: false, errors: error };
    }
  }, [saveEngine, engagementId]);

  return (
    <PageShell
      title="Pre-Planning Phase"
      subtitle={`${client?.name || "Select Client"}${engagement?.engagementCode ? ` (${engagement.engagementCode})` : ""}`}
      icon={<ClipboardCheck className="h-6 w-6 text-primary" />}
      useRegistry={true}
      backHref={`/workspace/${engagementId}/information-requisition`}
      nextHref={`/workspace/${engagementId}/planning`}
      dashboardHref="/engagements"
      saveFn={saveFn}
      hasUnsavedChanges={saveEngine.isDirty}
      isSaving={saveEngine.isSaving}
      showBack={true}
      showSaveProgress={true}
      showSaveNext={true}
      showSaveClose={true}
      tabs={PREPLANNING_TABS}
      activeTab={activeStep}
      onTabChange={(tab) => setActiveStep(tab as StepId)}
      headerActions={null}
    >
    <div className="w-full bg-background" data-testid="preplanning-wizard-page">
      <div className="px-4 py-2 space-y-2">
        {engagementId && (
          <AIAssistBanner
            engagementId={engagementId}
            config={{
              ...PHASE_AI_CONFIGS["pre-planning"],
              contextBuilder: () => JSON.stringify({
                phase: "pre-planning",
                engagementName: engagement?.engagementCode || "Unknown Engagement",
                clientName: client?.name || "Unknown Client",
                industry: (client as any)?.industry || "Not specified",
                activeStep,
              }),
              onActionComplete: (actionId: string) => {
                toast({
                  title: "AI Content Generated",
                  description: `${actionId} content has been generated. Apply it to relevant fields.`,
                });
              },
            }}
          />
        )}

        <Tabs value={activeStep} onValueChange={(v) => setActiveStep(v as StepId)}>
          <SimpleTabNavigation
            activeTab={activeStep}
            setActiveTab={(tab) => setActiveStep(tab as StepId)}
            tabs={PREPLANNING_TABS}
            ariaLabel="Pre-Planning Steps"
            tabStatuses={tabStatuses}
          />

          {(() => {
            const warnings = getDependencyWarnings(activeStep);
            if (warnings.length === 0) return null;
            return (
              <div className="mt-4 p-3 rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800" data-testid="dependency-warning">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
                  <div className="text-sm">
                    <p className="font-medium text-amber-800 dark:text-amber-200">Prerequisites not yet complete</p>
                    <ul className="mt-1 text-amber-700 dark:text-amber-300 list-disc list-inside">
                      {warnings.map((w, i) => <li key={i}>{w}</li>)}
                    </ul>
                  </div>
                </div>
              </div>
            );
          })()}

          <TabsContent value="setup" className="space-y-4 mt-3" data-testid="tab-content-setup">
            <EngagementSetupSection
              engagementId={engagementId}
              data={setupData}
              onChange={handleSetupChange}
            />
          </TabsContent>

          <TabsContent value="acceptance_due_diligence" className="space-y-4 mt-3" data-testid="tab-content-acceptance">
            <AcceptanceDueDiligenceSection
              engagementId={engagementId}
              data={acceptanceData}
              onChange={handleAcceptanceChange}
            />
          </TabsContent>

          <TabsContent value="ethics" className="space-y-4 mt-3" data-testid="tab-content-ethics">
            <EthicsIndependenceSection
              engagementId={engagementId}
              data={ethicsData}
              onChange={handleEthicsChange}
            />
          </TabsContent>

          <TabsContent value="letter" className="space-y-4 mt-3" data-testid="tab-content-letter">
            <EngagementLetterSection
              engagementId={engagementId}
              data={letterData}
              onChange={handleLetterChange}
            />
          </TabsContent>

          <TabsContent value="entity_understanding" className="space-y-4 mt-3" data-testid="tab-content-entity-understanding">
            <EntityUnderstandingSection
              engagementId={engagementId}
              data={entityUnderstandingData}
              onChange={handleEntityUnderstandingChange}
            />
          </TabsContent>

          <TabsContent value="signoff" className="space-y-4 mt-3" data-testid="tab-content-signoff">
            <SignOffGateSection
              engagementId={engagementId}
              data={signoffData}
              onChange={handleSignoffChange}
              onProceedToPlanning={handleProceed}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
    </PageShell>
  );
}
