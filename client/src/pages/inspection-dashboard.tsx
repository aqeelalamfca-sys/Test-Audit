import { useState, useEffect } from 'react';
import { useParams, useLocation } from 'wouter';
import { AgentsLoadingInline } from "@/components/agents-loading";
import { useQuery } from '@tanstack/react-query';
import { fetchWithAuth } from '@/lib/fetchWithAuth';
import { 
  Shield, FileText, AlertTriangle, CheckCircle, XCircle, 
  Download, Eye, Lock, Clock, Activity, BarChart3, 
  AlertCircle, ChevronRight, FileCheck, Scale, Search,
  Building2, Users, Folder, History, FileWarning, 
  UserCheck, Settings, Shuffle, Target
} from 'lucide-react';

type InspectionMode = 'AOB_SIMULATION' | 'ICAP_QCR' | 'INTERNAL';
type QCRVerdict = 'PASS' | 'CONDITIONAL' | 'FAIL';

interface QCRSummary {
  engagementId: string;
  engagementCode: string;
  clientName: string;
  verdict: QCRVerdict;
  verdictReason: string;
  score: number;
  criticalFailures: number;
  highIssues: number;
  mediumIssues: number;
  lowIssues: number;
  reportIssuanceBlocked: boolean;
  blockReasons: string[];
  topActions: {
    priority: string;
    action: string;
    isaReference: string;
    deadline: string;
  }[];
}

interface InspectorProfile {
  name: string;
  style: 'Conservative' | 'Moderate' | 'Lenient';
  focusArea: string;
  tolerance: string;
  deepScanProbability: number;
}

const INSPECTOR_PROFILES: InspectorProfile[] = [
  { name: 'AOB Inspector – Risk Focus', style: 'Conservative', focusArea: 'Sampling & FS', tolerance: 'Zero assumptions', deepScanProbability: 0.8 },
  { name: 'AOB Inspector – Evidence', style: 'Conservative', focusArea: 'Documentation', tolerance: 'Evidence only', deepScanProbability: 0.7 },
  { name: 'ICAP QCR Reviewer', style: 'Moderate', focusArea: 'ISQM-1 Controls', tolerance: 'Minor gaps allowed', deepScanProbability: 0.5 },
];

const verdictColors = {
  PASS: 'bg-green-500',
  CONDITIONAL: 'bg-amber-500',
  FAIL: 'bg-red-500'
};

const modeConfig = {
  AOB_SIMULATION: { bg: 'bg-red-600', text: 'text-white', dot: 'bg-red-300', label: 'AOB Simulation' },
  ICAP_QCR: { bg: 'bg-amber-500', text: 'text-white', dot: 'bg-amber-300', label: 'ICAP QCR' },
  INTERNAL: { bg: 'bg-green-600', text: 'text-white', dot: 'bg-green-300', label: 'Internal Review' }
};

const severityColors = {
  CRITICAL: 'bg-red-500 text-white',
  HIGH: 'bg-orange-500 text-white',
  MEDIUM: 'bg-amber-500 text-white',
  LOW: 'bg-blue-500 text-white'
};

export default function InspectionDashboard() {
  const { engagementId } = useParams<{ engagementId: string }>();
  const [, setLocation] = useLocation();
  const [inspectionMode, setInspectionMode] = useState<InspectionMode>('INTERNAL');
  const [activeSection, setActiveSection] = useState('overview');
  const [selectedInspector, setSelectedInspector] = useState<InspectorProfile>(INSPECTOR_PROFILES[0]);
  const [isReadOnly, setIsReadOnly] = useState(false);

  useEffect(() => {
    if (inspectionMode === 'AOB_SIMULATION') {
      setIsReadOnly(true);
      setSelectedInspector(INSPECTOR_PROFILES[0]);
    } else if (inspectionMode === 'ICAP_QCR') {
      setIsReadOnly(true);
      setSelectedInspector(INSPECTOR_PROFILES[2]);
    } else {
      setIsReadOnly(false);
    }
  }, [inspectionMode]);

  const { data: qcrSummary, isLoading: loadingSummary } = useQuery<QCRSummary>({
    queryKey: ['qcr-summary', engagementId],
    queryFn: async () => {
      const res = await fetchWithAuth(`/api/qcr/engagements/${engagementId}/qcr-summary`);
      if (!res.ok) throw new Error('Failed to fetch QCR summary');
      return res.json();
    },
    enabled: !!engagementId
  });

  const { data: aobReadiness, isLoading: loadingAOB } = useQuery({
    queryKey: ['aob-readiness', engagementId],
    queryFn: async () => {
      const res = await fetchWithAuth(`/api/qcr/engagements/${engagementId}/aob-readiness`);
      if (!res.ok) throw new Error('Failed to fetch AOB readiness');
      return res.json();
    },
    enabled: !!engagementId
  });

  const sections = [
    { id: 'overview', label: 'Overview', icon: Activity },
    { id: 'acceptance', label: 'Engagement Acceptance', icon: CheckCircle, sectionNum: 1 },
    { id: 'planning', label: 'Planning & Strategy', icon: FileText, sectionNum: 2 },
    { id: 'risk', label: 'Risk Assessment', icon: AlertTriangle, sectionNum: 3 },
    { id: 'materiality', label: 'Materiality & Sampling', icon: Scale, sectionNum: 4 },
    { id: 'evidence', label: 'Evidence & Execution', icon: Folder, sectionNum: 5 },
    { id: 'fs', label: 'FS & Disclosures', icon: FileCheck, sectionNum: 6 },
    { id: 'completion', label: 'Completion & Opinion', icon: Shield, sectionNum: 7 },
    { id: 'quality', label: 'Quality Reviews', icon: Users, sectionNum: 8 },
    { id: 'secp', label: 'SECP & Listed Entity', icon: Building2 },
    { id: 'findings', label: 'Findings & Remediation', icon: AlertCircle },
    { id: 'trail', label: 'Audit Trail', icon: History }
  ];

  if (loadingSummary || loadingAOB) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-white">Loading inspection data...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <header className="sticky top-0 z-50 bg-slate-800 border-b border-slate-700">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Shield className="w-6 h-6 text-blue-400" />
            <div className="flex items-center gap-3">
              <span className="font-semibold text-lg">{qcrSummary?.clientName || 'Client'}</span>
              <span className="text-slate-400">|</span>
              <span className="text-slate-300">FY {new Date().getFullYear()}</span>
              <EntityBadge type={aobReadiness?.entityProfile?.type} />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <InspectionModeToggle mode={inspectionMode} setMode={setInspectionMode} />
          </div>

          <div className="flex items-center gap-4">
            <div className={`px-4 py-1.5 rounded-full ${verdictColors[qcrSummary?.verdict || 'FAIL']} font-bold text-sm`}>
              {qcrSummary?.verdict || 'FAIL'}
            </div>
            <div className="flex items-center gap-2 bg-slate-700 px-3 py-1.5 rounded-lg">
              <BarChart3 className="w-4 h-4" />
              <span className="font-mono font-bold">{qcrSummary?.score || 0}%</span>
            </div>
            <ExportMenu />
          </div>
        </div>

        {inspectionMode === 'AOB_SIMULATION' && (
          <div className="bg-red-900/50 border-t border-red-500 px-4 py-2 flex items-center justify-between">
            <div className="flex items-center gap-3 text-red-200 text-sm">
              <Lock className="w-4 h-4" />
              <span>AOB SIMULATION MODE - Read-only, evidence-only scoring, zero assumptions</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <UserCheck className="w-4 h-4 text-red-300" />
              <span className="text-red-300">{selectedInspector.name}</span>
              <span className="text-red-400 text-xs">({selectedInspector.focusArea})</span>
            </div>
          </div>
        )}
      </header>

      <div className="flex">
        <aside className="w-64 min-h-screen bg-slate-800 border-r border-slate-700 py-4">
          <nav className="space-y-1 px-2">
            {sections.map((section) => (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${
                  activeSection === section.id
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-300 hover:bg-slate-700'
                }`}
              >
                <section.icon className="w-4 h-4" />
                <span className="text-sm">{section.label}</span>
              </button>
            ))}
          </nav>
        </aside>

        <main className="flex-1 p-6">
          {activeSection === 'overview' && (
            <OverviewSection 
              qcrSummary={qcrSummary} 
              aobReadiness={aobReadiness}
              inspectionMode={inspectionMode}
              selectedInspector={selectedInspector}
            />
          )}
          {activeSection === 'acceptance' && <SectionDetailView sectionNumber={1} engagementId={engagementId!} isReadOnly={isReadOnly} />}
          {activeSection === 'planning' && <SectionDetailView sectionNumber={2} engagementId={engagementId!} isReadOnly={isReadOnly} />}
          {activeSection === 'risk' && <RiskAssessmentView engagementId={engagementId!} />}
          {activeSection === 'materiality' && <MaterialitySamplingView engagementId={engagementId!} />}
          {activeSection === 'evidence' && <SectionDetailView sectionNumber={5} engagementId={engagementId!} isReadOnly={isReadOnly} />}
          {activeSection === 'fs' && <SectionDetailView sectionNumber={6} engagementId={engagementId!} isReadOnly={isReadOnly} />}
          {activeSection === 'completion' && <SectionDetailView sectionNumber={7} engagementId={engagementId!} isReadOnly={isReadOnly} />}
          {activeSection === 'quality' && <SectionDetailView sectionNumber={8} engagementId={engagementId!} isReadOnly={isReadOnly} />}
          {activeSection === 'secp' && <SECPView engagementId={engagementId!} aobReadiness={aobReadiness} />}
          {activeSection === 'findings' && <FindingsKanbanView qcrSummary={qcrSummary} />}
          {activeSection === 'trail' && <AuditTrailView engagementId={engagementId!} />}
        </main>
      </div>
    </div>
  );
}

function InspectionModeToggle({ mode, setMode }: { mode: InspectionMode; setMode: (m: InspectionMode) => void }) {
  const modes: InspectionMode[] = ['AOB_SIMULATION', 'ICAP_QCR', 'INTERNAL'];
  
  return (
    <div className="flex rounded-lg overflow-hidden border border-slate-600">
      {modes.map((m) => (
        <button
          key={m}
          onClick={() => setMode(m)}
          className={`px-4 py-2 text-sm font-medium transition-colors flex items-center gap-2 ${
            mode === m 
              ? modeConfig[m].bg + ' ' + modeConfig[m].text
              : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
          }`}
        >
          <div className={`w-2 h-2 rounded-full ${mode === m ? modeConfig[m].dot + ' animate-pulse' : 'bg-slate-500'}`}></div>
          {modeConfig[m].label}
        </button>
      ))}
    </div>
  );
}

function EntityBadge({ type }: { type?: string }) {
  if (!type) return null;
  
  const badges: Record<string, { bg: string; text: string }> = {
    'Listed': { bg: 'bg-purple-600', text: 'LISTED' },
    'PIE': { bg: 'bg-blue-600', text: 'PIE' },
    'Unlisted': { bg: 'bg-slate-600', text: 'UNLISTED' }
  };
  
  const badge = badges[type] || badges['Unlisted'];
  
  return (
    <span className={`px-2 py-0.5 text-xs font-bold rounded ${badge.bg}`}>
      {badge.text}
    </span>
  );
}

function ExportMenu() {
  const [isOpen, setIsOpen] = useState(false);
  
  return (
    <div className="relative">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm"
      >
        <Download className="w-4 h-4" />
        Export
      </button>
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-48 bg-slate-700 border border-slate-600 rounded-lg shadow-xl z-50">
          <button className="w-full px-4 py-2 text-left text-sm hover:bg-slate-600 flex items-center gap-2">
            <FileText className="w-4 h-4" /> AOB Report (PDF)
          </button>
          <button className="w-full px-4 py-2 text-left text-sm hover:bg-slate-600 flex items-center gap-2">
            <FileCheck className="w-4 h-4" /> ICAP QCR Summary
          </button>
          <button className="w-full px-4 py-2 text-left text-sm hover:bg-slate-600 flex items-center gap-2">
            <Folder className="w-4 h-4" /> Evidence Pack (ZIP)
          </button>
        </div>
      )}
    </div>
  );
}

function OverviewSection({ qcrSummary, aobReadiness, inspectionMode, selectedInspector }: { 
  qcrSummary?: QCRSummary; 
  aobReadiness?: any;
  inspectionMode: InspectionMode;
  selectedInspector: InspectorProfile;
}) {
  const isaHeatmapData = [
    { isa: 'ISA 230', name: 'Documentation', planning: 85, execution: 78, completion: 92 },
    { isa: 'ISA 300', name: 'Planning', planning: 45, execution: 0, completion: 0 },
    { isa: 'ISA 315', name: 'Risk Identification', planning: 88, execution: 72, completion: 65 },
    { isa: 'ISA 330', name: 'Risk Response', planning: 35, execution: 28, completion: 0 },
    { isa: 'ISA 500', name: 'Audit Evidence', planning: 0, execution: 15, completion: 0 },
    { isa: 'ISA 530', name: 'Sampling', planning: 12, execution: 8, completion: 0 },
    { isa: 'ISA 700-706', name: 'Reporting', planning: 0, execution: 0, completion: 5 }
  ];

  const phaseTimeline = [
    { phase: 'Planning', locked: true, status: 'complete' },
    { phase: 'Risk Assessment', locked: true, status: 'complete' },
    { phase: 'Fieldwork', locked: false, status: 'incomplete', flag: 'Unlocked during inspection' },
    { phase: 'Completion', locked: false, status: 'incomplete' },
    { phase: 'Reporting', locked: false, status: 'blocked' }
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Inspection Overview</h1>
        {inspectionMode === 'AOB_SIMULATION' && (
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <Shuffle className="w-4 h-4" />
            Deep Scan Probability: {(selectedInspector.deepScanProbability * 100).toFixed(0)}%
          </div>
        )}
      </div>
      
      <div className="grid grid-cols-4 gap-4">
        <KPICard 
          label="Overall Compliance" 
          value={`${qcrSummary?.score || 0}%`} 
          color={qcrSummary?.score && qcrSummary.score >= 75 ? 'green' : 'red'} 
          icon={<Target className="w-5 h-5" />}
        />
        <KPICard 
          label="Critical Findings" 
          value={qcrSummary?.criticalFailures || 0} 
          color="red" 
          icon={<AlertTriangle className="w-5 h-5" />}
        />
        <KPICard 
          label="EQCR Required?" 
          value={aobReadiness?.entityProfile?.type === 'Listed' ? 'Yes' : 'No'} 
          color={aobReadiness?.entityProfile?.type === 'Listed' ? 'amber' : 'green'} 
          icon={<UserCheck className="w-5 h-5" />}
        />
        <KPICard 
          label="SECP Gaps" 
          value={aobReadiness?.entityProfile?.type === 'Listed' ? 3 : 0} 
          color={aobReadiness?.entityProfile?.type === 'Listed' ? 'red' : 'green'} 
          icon={<Building2 className="w-5 h-5" />}
        />
      </div>

      <div className="bg-slate-800 rounded-xl p-5">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-blue-400" />
          ISA-wise Compliance Heatmap
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="text-left py-2 px-3 w-40">ISA Standard</th>
                <th className="text-center py-2 px-3">Planning</th>
                <th className="text-center py-2 px-3">Execution</th>
                <th className="text-center py-2 px-3">Completion</th>
              </tr>
            </thead>
            <tbody>
              {isaHeatmapData.map((row) => (
                <tr key={row.isa} className="border-b border-slate-700/50">
                  <td className="py-2 px-3">
                    <div className="font-medium">{row.isa}</div>
                    <div className="text-xs text-slate-400">{row.name}</div>
                  </td>
                  <td className="py-2 px-3">
                    <HeatmapCell score={row.planning} />
                  </td>
                  <td className="py-2 px-3">
                    <HeatmapCell score={row.execution} />
                  </td>
                  <td className="py-2 px-3">
                    <HeatmapCell score={row.completion} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex items-center gap-3 mt-4 text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-red-500"></div>
            Critical Gap (&lt;60%)
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-amber-500"></div>
            Partial (60-84%)
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-green-500"></div>
            Compliant (≥85%)
          </div>
        </div>
      </div>

      <div className="bg-slate-800 rounded-xl p-5">
        <h3 className="text-lg font-semibold mb-4">Phase Timeline</h3>
        <div className="flex items-center justify-between">
          {phaseTimeline.map((phase, i) => (
            <div key={phase.phase} className="flex-1 relative">
              <div className={`flex flex-col items-center ${i < phaseTimeline.length - 1 ? 'pr-4' : ''}`}>
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  phase.status === 'complete' ? 'bg-green-600' :
                  phase.status === 'blocked' ? 'bg-red-600' : 'bg-slate-600'
                }`}>
                  {phase.locked ? (
                    <Lock className="w-4 h-4" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-amber-400" />
                  )}
                </div>
                <span className="text-sm mt-2">{phase.phase}</span>
                {phase.flag && (
                  <span className="text-xs text-amber-400 mt-1">{phase.flag}</span>
                )}
              </div>
              {i < phaseTimeline.length - 1 && (
                <div className={`absolute top-5 left-1/2 w-full h-0.5 ${
                  phase.status === 'complete' ? 'bg-green-600' : 'bg-slate-600'
                }`}></div>
              )}
            </div>
          ))}
        </div>
      </div>

      {qcrSummary?.reportIssuanceBlocked && (
        <div className="bg-red-900/50 border border-red-500 rounded-xl p-5">
          <div className="flex items-center gap-3 mb-3">
            <Lock className="w-6 h-6 text-red-400" />
            <h3 className="text-lg font-semibold text-red-300">Report Issuance Blocked</h3>
          </div>
          <ul className="space-y-1">
            {qcrSummary.blockReasons?.map((reason, i) => (
              <li key={i} className="text-sm text-red-200 flex items-center gap-2">
                <XCircle className="w-4 h-4" />
                {reason}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function HeatmapCell({ score }: { score: number }) {
  const bgColor = score < 60 ? 'bg-red-500' : score < 85 ? 'bg-amber-500' : 'bg-green-500';
  
  return (
    <div className={`${bgColor} rounded px-3 py-2 text-center font-mono font-bold text-white`}>
      {score}%
    </div>
  );
}

function KPICard({ label, value, color, icon }: { label: string; value: string | number; color: string; icon: React.ReactNode }) {
  const colorClasses: Record<string, string> = {
    green: 'border-green-500 bg-green-500/10 text-green-400',
    red: 'border-red-500 bg-red-500/10 text-red-400',
    orange: 'border-orange-500 bg-orange-500/10 text-orange-400',
    amber: 'border-amber-500 bg-amber-500/10 text-amber-400',
    blue: 'border-blue-500 bg-blue-500/10 text-blue-400'
  };

  return (
    <div className={`rounded-xl p-4 border ${colorClasses[color]}`}>
      <div className="flex items-center justify-between mb-2">
        {icon}
      </div>
      <div className="text-3xl font-bold text-white mb-1">{value}</div>
      <div className="text-sm text-slate-400">{label}</div>
    </div>
  );
}

function SectionDetailView({ sectionNumber, engagementId, isReadOnly }: { sectionNumber: number; engagementId: string; isReadOnly: boolean }) {
  const { data: section, isLoading } = useQuery({
    queryKey: ['qcr-section', engagementId, sectionNumber],
    queryFn: async () => {
      const res = await fetchWithAuth(`/api/qcr/engagements/${engagementId}/qcr-sections/${sectionNumber}`);
      if (!res.ok) throw new Error('Failed to fetch section');
      return res.json();
    }
  });

  const [selectedCheckpoint, setSelectedCheckpoint] = useState<any>(null);

  if (isLoading) {
    return <AgentsLoadingInline showDelay={1000} />;
  }

  return (
    <div className="flex gap-3">
      <div className="flex-1 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">{section?.sectionTitle}</h1>
            <p className="text-slate-400 text-sm mt-1">
              {section?.isaReferences?.join(', ')}
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-2xl font-mono font-bold">
                {section?.sectionScore}/{section?.maxScore}
              </div>
              <div className="text-sm text-slate-400">Section Score</div>
            </div>
            {section?.criticalFailures > 0 && (
              <span className="px-3 py-1 bg-red-600 rounded-lg text-sm font-semibold">
                {section.criticalFailures} Critical
              </span>
            )}
          </div>
        </div>

        {isReadOnly && (
          <div className="bg-slate-700/50 border border-slate-600 rounded-lg p-3 flex items-center gap-2 text-sm text-slate-300">
            <Lock className="w-4 h-4" />
            Inspection Mode - Read-only view. All data is evidence-based, no manual overrides allowed.
          </div>
        )}

        <div className="bg-slate-800 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-700">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">Checkpoint</th>
                <th className="px-4 py-3 text-center font-semibold w-20">Status</th>
                <th className="px-4 py-3 text-center font-semibold w-24">Severity</th>
                <th className="px-4 py-3 text-left font-semibold w-32">Evidence</th>
                <th className="px-4 py-3 text-left font-semibold">System Comment</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700">
              {section?.checkpoints?.map((cp: any, i: number) => (
                <tr 
                  key={i} 
                  className={`hover:bg-slate-750 cursor-pointer ${selectedCheckpoint?.id === cp.id ? 'bg-slate-700' : ''}`}
                  onClick={() => setSelectedCheckpoint(cp)}
                >
                  <td className="px-4 py-3">
                    <div className="font-medium">{cp.checkpoint}</div>
                    <div className="text-xs text-slate-400 mt-1">{cp.isaReference}</div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {cp.status === 'COMPLIANT' ? (
                      <CheckCircle className="w-5 h-5 text-green-500 mx-auto" />
                    ) : cp.status === 'PARTIAL' ? (
                      <AlertCircle className="w-5 h-5 text-amber-500 mx-auto" />
                    ) : (
                      <XCircle className="w-5 h-5 text-red-500 mx-auto" />
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {cp.severity && (
                      <span className={`px-2 py-0.5 text-xs rounded ${severityColors[cp.severity as keyof typeof severityColors]}`}>
                        {cp.severity}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {cp.evidenceReference ? (
                      <button className="flex items-center gap-1 text-blue-400 hover:text-blue-300 text-sm">
                        <Eye className="w-4 h-4" />
                        View
                      </button>
                    ) : (
                      <span className="text-red-400 text-sm flex items-center gap-1">
                        <FileWarning className="w-4 h-4" />
                        Missing
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-400 max-w-xs truncate">
                    {cp.reviewerConclusion || 'No comment'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="w-80 space-y-4">
        <div className="bg-slate-800 rounded-xl p-4">
          <h3 className="font-semibold mb-3 flex items-center gap-2">
            <Eye className="w-4 h-4 text-blue-400" />
            Evidence Preview
          </h3>
          {selectedCheckpoint?.evidenceReference ? (
            <div className="bg-slate-700 rounded-lg p-3 text-sm">
              <p className="text-blue-400 mb-2">{selectedCheckpoint.evidenceReference}</p>
              <p className="text-slate-400 text-xs">Click to view full document</p>
            </div>
          ) : (
            <p className="text-slate-400 text-sm">Select a checkpoint with evidence to preview</p>
          )}
        </div>

        <div className="bg-slate-800 rounded-xl p-4">
          <h3 className="font-semibold mb-3 flex items-center gap-2">
            <History className="w-4 h-4 text-blue-400" />
            Audit Trail
          </h3>
          {selectedCheckpoint ? (
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-400">Last Updated</span>
                <span>Jan 27, 2026</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Updated By</span>
                <span>System</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Status Change</span>
                <span className="text-amber-400">Auto-generated</span>
              </div>
            </div>
          ) : (
            <p className="text-slate-400 text-sm">Select a checkpoint to view history</p>
          )}
        </div>

        {selectedCheckpoint && !selectedCheckpoint.evidenceReference && (
          <div className="bg-slate-800 rounded-xl p-4">
            <h3 className="font-semibold mb-3 flex items-center gap-2 text-amber-400">
              <AlertTriangle className="w-4 h-4" />
              Override Justification
            </h3>
            <p className="text-slate-400 text-sm">
              No override available. Evidence must be provided per ISA 230.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function FindingsKanbanView({ qcrSummary }: { qcrSummary?: QCRSummary }) {
  const columns = [
    { id: 'CRITICAL', label: 'Critical', color: 'border-red-500', count: qcrSummary?.criticalFailures || 0 },
    { id: 'HIGH', label: 'High', color: 'border-orange-500', count: qcrSummary?.highIssues || 0 },
    { id: 'MEDIUM', label: 'Medium', color: 'border-amber-500', count: qcrSummary?.mediumIssues || 0 },
    { id: 'CLOSED', label: 'Closed', color: 'border-green-500', count: 0 }
  ];

  const mockFindings = qcrSummary?.topActions?.map((action, i) => ({
    id: i,
    priority: action.priority,
    title: action.action,
    isaRef: action.isaReference,
    rootCause: 'Execution',
    assignedTo: 'Partner',
    deadline: action.deadline,
    evidenceRequired: true
  })) || [];

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Findings & Remediation</h1>

      <div className="grid grid-cols-4 gap-4 h-[calc(100vh-200px)]">
        {columns.map((col) => (
          <div key={col.id} className={`bg-slate-800 rounded-xl p-4 border-t-4 ${col.color} flex flex-col`}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">{col.label}</h3>
              <span className="px-2 py-0.5 bg-slate-700 rounded text-sm">{col.count}</span>
            </div>
            
            <div className="flex-1 overflow-y-auto space-y-3">
              {mockFindings
                .filter(f => f.priority === col.id)
                .map(finding => (
                  <div key={finding.id} className="bg-slate-700 rounded-lg p-3 cursor-pointer hover:bg-slate-650">
                    <p className="text-sm font-medium mb-2">{finding.title}</p>
                    <div className="space-y-1 text-xs text-slate-400">
                      <div className="flex items-center gap-2">
                        <FileText className="w-3 h-3" />
                        {finding.isaRef}
                      </div>
                      <div className="flex items-center gap-2">
                        <AlertCircle className="w-3 h-3" />
                        Root: {finding.rootCause}
                      </div>
                      <div className="flex items-center gap-2">
                        <Users className="w-3 h-3" />
                        {finding.assignedTo}
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock className="w-3 h-3" />
                        {finding.deadline}
                      </div>
                    </div>
                    {finding.evidenceRequired && (
                      <div className="mt-2 pt-2 border-t border-slate-600 text-xs text-amber-400 flex items-center gap-1">
                        <FileWarning className="w-3 h-3" />
                        Evidence Required
                      </div>
                    )}
                  </div>
                ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function RiskAssessmentView({ engagementId }: { engagementId: string }) {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Risk Assessment (ISA 315/330)</h1>
      
      <div className="bg-slate-800 rounded-xl p-5">
        <h3 className="text-lg font-semibold mb-4">Risk Coverage Matrix</h3>
        <p className="text-slate-400 text-sm mb-4">
          Empty cells indicate risks without responsive procedures (automatic fail per ISA 330)
        </p>
        
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-700">
              <tr>
                <th className="px-3 py-2 text-left">Risk</th>
                <th className="px-3 py-2 text-center">Existence</th>
                <th className="px-3 py-2 text-center">Completeness</th>
                <th className="px-3 py-2 text-center">Valuation</th>
                <th className="px-3 py-2 text-center">Rights</th>
                <th className="px-3 py-2 text-center">Presentation</th>
                <th className="px-3 py-2 text-center">ToC</th>
                <th className="px-3 py-2 text-center">ToD</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700">
              <tr>
                <td className="px-3 py-2 font-medium">Revenue Recognition</td>
                <td className="px-3 py-2 text-center"><CheckCircle className="w-4 h-4 text-green-500 mx-auto" /></td>
                <td className="px-3 py-2 text-center"><CheckCircle className="w-4 h-4 text-green-500 mx-auto" /></td>
                <td className="px-3 py-2 text-center bg-red-900/30"><XCircle className="w-4 h-4 text-red-500 mx-auto" /></td>
                <td className="px-3 py-2 text-center text-slate-500">N/A</td>
                <td className="px-3 py-2 text-center"><CheckCircle className="w-4 h-4 text-green-500 mx-auto" /></td>
                <td className="px-3 py-2 text-center"><CheckCircle className="w-4 h-4 text-green-500 mx-auto" /></td>
                <td className="px-3 py-2 text-center"><CheckCircle className="w-4 h-4 text-green-500 mx-auto" /></td>
              </tr>
              <tr className="bg-red-900/20">
                <td className="px-3 py-2 font-medium flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-400" />
                  Management Override (Fraud)
                </td>
                <td className="px-3 py-2 text-center bg-red-900/30"><XCircle className="w-4 h-4 text-red-500 mx-auto" /></td>
                <td className="px-3 py-2 text-center bg-red-900/30"><XCircle className="w-4 h-4 text-red-500 mx-auto" /></td>
                <td className="px-3 py-2 text-center bg-red-900/30"><XCircle className="w-4 h-4 text-red-500 mx-auto" /></td>
                <td className="px-3 py-2 text-center bg-red-900/30"><XCircle className="w-4 h-4 text-red-500 mx-auto" /></td>
                <td className="px-3 py-2 text-center bg-red-900/30"><XCircle className="w-4 h-4 text-red-500 mx-auto" /></td>
                <td className="px-3 py-2 text-center bg-red-900/30"><XCircle className="w-4 h-4 text-red-500 mx-auto" /></td>
                <td className="px-3 py-2 text-center bg-red-900/30"><XCircle className="w-4 h-4 text-red-500 mx-auto" /></td>
              </tr>
              <tr>
                <td className="px-3 py-2 font-medium">Inventory Valuation</td>
                <td className="px-3 py-2 text-center"><CheckCircle className="w-4 h-4 text-green-500 mx-auto" /></td>
                <td className="px-3 py-2 text-center"><CheckCircle className="w-4 h-4 text-green-500 mx-auto" /></td>
                <td className="px-3 py-2 text-center"><CheckCircle className="w-4 h-4 text-green-500 mx-auto" /></td>
                <td className="px-3 py-2 text-center"><CheckCircle className="w-4 h-4 text-green-500 mx-auto" /></td>
                <td className="px-3 py-2 text-center text-slate-500">N/A</td>
                <td className="px-3 py-2 text-center text-slate-500">N/A</td>
                <td className="px-3 py-2 text-center"><CheckCircle className="w-4 h-4 text-green-500 mx-auto" /></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-red-900/30 border border-red-500 rounded-xl p-5">
          <h3 className="text-lg font-semibold mb-3 flex items-center gap-2 text-red-300">
            <AlertTriangle className="w-5 h-5" />
            Fraud Risks (ISA 240)
          </h3>
          <ul className="space-y-2 text-sm">
            <li className="flex items-center gap-2 text-red-200">
              <XCircle className="w-4 h-4" />
              Management Override - No response procedures documented
            </li>
            <li className="flex items-center gap-2 text-red-200">
              <XCircle className="w-4 h-4" />
              Revenue Recognition Fraud - Procedures incomplete
            </li>
          </ul>
        </div>

        <div className="bg-amber-900/30 border border-amber-500 rounded-xl p-5">
          <h3 className="text-lg font-semibold mb-3 flex items-center gap-2 text-amber-300">
            <AlertCircle className="w-5 h-5" />
            Going Concern (ISA 570)
          </h3>
          <div className="text-sm text-slate-300">
            <p>Assessment: Performed</p>
            <p>Material Uncertainty: No</p>
            <p className="text-amber-300 mt-2">Conclusion documented but procedures need linkage</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function MaterialitySamplingView({ engagementId }: { engagementId: string }) {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Materiality & Sampling (ISA 320/450/530)</h1>
      
      <div className="bg-red-900/30 border border-red-500 rounded-xl p-5">
        <div className="flex items-center gap-3 mb-3">
          <XCircle className="w-6 h-6 text-red-400" />
          <h3 className="text-lg font-semibold text-red-300">CRITICAL: No Materiality Calculation</h3>
        </div>
        <p className="text-red-200">
          No MaterialityCalculation records exist for this engagement. 
          This is a blocking issue per ISA 320.10.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="bg-slate-800 rounded-xl p-5">
          <h3 className="font-semibold mb-3">Overall Materiality</h3>
          <div className="text-3xl font-mono text-red-400">NOT SET</div>
          <div className="text-sm text-slate-400 mt-2">Benchmark: -</div>
          <div className="text-sm text-slate-400">Percentage: -</div>
        </div>
        
        <div className="bg-slate-800 rounded-xl p-5">
          <h3 className="font-semibold mb-3">Performance Materiality</h3>
          <div className="text-3xl font-mono text-red-400">NOT SET</div>
          <div className="text-sm text-slate-400 mt-2">PM Factor: 50-75% of OM</div>
        </div>
        
        <div className="bg-slate-800 rounded-xl p-5">
          <h3 className="font-semibold mb-3">Trivial Threshold</h3>
          <div className="text-3xl font-mono text-red-400">NOT SET</div>
          <div className="text-sm text-slate-400 mt-2">Trivial: ≤5% of OM</div>
        </div>
      </div>

      <div className="bg-slate-800 rounded-xl p-5">
        <h3 className="text-lg font-semibold mb-4">Sampling Analysis (ISA 530)</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-700">
              <tr>
                <th className="px-3 py-2 text-left">Test</th>
                <th className="px-3 py-2 text-center">Population</th>
                <th className="px-3 py-2 text-center">Sample Size</th>
                <th className="px-3 py-2 text-center">Method</th>
                <th className="px-3 py-2 text-center">Rationale</th>
                <th className="px-3 py-2 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700">
              <tr>
                <td className="px-3 py-2">Revenue Cutoff</td>
                <td className="px-3 py-2 text-center text-red-400">NOT SET</td>
                <td className="px-3 py-2 text-center">25</td>
                <td className="px-3 py-2 text-center text-red-400">NOT SET</td>
                <td className="px-3 py-2 text-center text-red-400">NOT SET</td>
                <td className="px-3 py-2 text-center"><XCircle className="w-4 h-4 text-red-500 mx-auto" /></td>
              </tr>
              <tr>
                <td className="px-3 py-2">Accounts Receivable</td>
                <td className="px-3 py-2 text-center text-red-400">NOT SET</td>
                <td className="px-3 py-2 text-center">30</td>
                <td className="px-3 py-2 text-center text-red-400">NOT SET</td>
                <td className="px-3 py-2 text-center text-red-400">NOT SET</td>
                <td className="px-3 py-2 text-center"><XCircle className="w-4 h-4 text-red-500 mx-auto" /></td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="text-red-400 text-sm mt-4">
          All 48 substantive tests have sample sizes but 0 have population values, sampling method, or rationale documented.
          This violates ISA 530.6.
        </p>
      </div>
    </div>
  );
}

function SECPView({ engagementId, aobReadiness }: { engagementId: string; aobReadiness: any }) {
  const secpChecks = [
    { requirement: 'Auditor eligibility (SECP panel)', status: 'compliant' },
    { requirement: 'Partner/Firm rotation compliance', status: 'compliant' },
    { requirement: 'Related party disclosures (IAS 24)', status: 'pending' },
    { requirement: 'Enhanced fraud procedures', status: 'fail' },
    { requirement: 'Mandatory EQCR (Listed entity)', status: 'pending' },
    { requirement: 'AGM timeline compliance', status: 'compliant' },
    { requirement: 'Disclosure completeness check', status: 'pending' }
  ];

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">SECP & Listed Entity Requirements</h1>
      
      {aobReadiness?.entityProfile?.type !== 'Listed' ? (
        <div className="bg-slate-800 rounded-xl p-5">
          <p className="text-slate-400">
            Entity is not classified as Listed. SECP enhanced requirements do not apply.
          </p>
        </div>
      ) : (
        <>
          <div className="bg-purple-900/30 border border-purple-500 rounded-xl p-5">
            <div className="flex items-center gap-3 mb-3">
              <Building2 className="w-6 h-6 text-purple-400" />
              <h3 className="text-lg font-semibold text-purple-300">Listed Entity - Enhanced Requirements Apply</h3>
            </div>
            <p className="text-purple-200 text-sm">
              Per SECP regulations, the following additional requirements are automatically enforced.
            </p>
          </div>

          <div className="bg-slate-800 rounded-xl overflow-hidden">
            <table className="w-full">
              <thead className="bg-slate-700">
                <tr>
                  <th className="px-4 py-3 text-left">SECP Requirement</th>
                  <th className="px-4 py-3 text-center w-32">Status</th>
                  <th className="px-4 py-3 text-center w-32">Blocking</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700">
                {secpChecks.map((check, i) => (
                  <tr key={i}>
                    <td className="px-4 py-3">{check.requirement}</td>
                    <td className="px-4 py-3 text-center">
                      {check.status === 'compliant' ? (
                        <CheckCircle className="w-5 h-5 text-green-500 mx-auto" />
                      ) : check.status === 'pending' ? (
                        <Clock className="w-5 h-5 text-amber-500 mx-auto" />
                      ) : (
                        <XCircle className="w-5 h-5 text-red-500 mx-auto" />
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {check.status === 'fail' && (
                        <Lock className="w-5 h-5 text-red-500 mx-auto" />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="bg-red-900/50 border border-red-500 rounded-xl p-5">
            <div className="flex items-center gap-3">
              <Lock className="w-6 h-6 text-red-400" />
              <div>
                <h3 className="font-semibold text-red-300">Report Issuance Gatekeeper Active</h3>
                <p className="text-sm text-red-200">
                  Any SECP checkpoint failure will block audit report issuance.
                </p>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function AuditTrailView({ engagementId }: { engagementId: string }) {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Audit Trail (Forensic View)</h1>
      
      <div className="bg-slate-800 rounded-xl p-5">
        <div className="flex items-center gap-3 mb-4 text-slate-400">
          <Lock className="w-5 h-5" />
          <span className="text-sm">This view is immutable. All actions are permanently logged.</span>
        </div>
        
        <div className="space-y-3">
          {[
            { time: '2026-01-27 07:21:42', user: 'System', action: 'QCR Checklist Generated', entity: 'QCRReport', detail: 'Verdict: FAIL, Score: 0%' },
            { time: '2026-01-27 07:15:30', user: 'Admin User', action: 'Phase Progress Updated', entity: 'PhaseProgress', detail: 'FINALIZATION status changed' },
            { time: '2026-01-27 07:10:15', user: 'Manager User', action: 'Evidence File Uploaded', entity: 'EvidenceFile', detail: 'Bank Confirmation.pdf' },
            { time: '2026-01-27 07:05:22', user: 'Staff Auditor', action: 'Substantive Test Completed', entity: 'SubstantiveTest', detail: 'Revenue Cutoff Test' },
          ].map((log, i) => (
            <div key={i} className="flex items-start gap-4 p-3 bg-slate-700 rounded-lg">
              <div className="text-xs text-slate-400 font-mono w-36">{log.time}</div>
              <div className="w-32 text-sm">{log.user}</div>
              <div className="flex-1">
                <span className="text-blue-400">{log.action}</span>
                <span className="text-slate-400 mx-2">on</span>
                <span className="text-purple-400">{log.entity}</span>
              </div>
              <div className="text-sm text-slate-300">{log.detail}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
