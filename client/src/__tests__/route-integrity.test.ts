import { test, expect } from '@playwright/test';

const WORKSPACE_ROUTES = [
  '/workspace/:engagementId/requisition',
  '/workspace/:engagementId/pre-planning',
  '/workspace/:engagementId/planning',
  '/workspace/:engagementId/execution',
  '/workspace/:engagementId/fs-heads',
  '/workspace/:engagementId/evidence',
  '/workspace/:engagementId/outputs',
  '/workspace/:engagementId/finalization',
  '/workspace/:engagementId/deliverables',
  '/workspace/:engagementId/eqcr',
  '/workspace/:engagementId/inspection',
  '/workspace/:engagementId/audit-health',
  '/workspace/:engagementId/workflow-health',
  '/workspace/:engagementId/onboarding',
  '/workspace/:engagementId/control',
  '/workspace/:engagementId/ethics',
  '/workspace/:engagementId/tb-review',
  '/workspace/:engagementId/import',
  '/workspace/:engagementId/qcr-dashboard',
];

const WORKSPACE_PHASES = [
  { key: 'requisition', label: 'Data Intake' },
  { key: 'pre-planning', label: 'Pre-Planning' },
  { key: 'planning', label: 'Planning' },
  { key: 'execution', label: 'Execution' },
  { key: 'fs-heads', label: 'FS Heads' },
  { key: 'evidence', label: 'Evidence' },
  { key: 'outputs', label: 'Outputs' },
  { key: 'finalization', label: 'Finalization' },
  { key: 'deliverables', label: 'Deliverables' },
  { key: 'eqcr', label: 'Quality Review' },
  { key: 'inspection', label: 'Inspection' },
];

const GLOBAL_ROUTES = [
  '/',
  '/dashboard',
  '/clients',
  '/clients/new',
  '/engagements',
  '/engagement/new',
  '/allocation',
  '/admin',
  '/administration',
  '/users',
  '/firm-controls',
  '/reports',
  '/settings',
];

test.describe('Route Integrity', () => {
  test('all workspace phases have corresponding routes', () => {
    const routeKeys = WORKSPACE_ROUTES.map(r => r.split('/').pop());
    
    WORKSPACE_PHASES.forEach(phase => {
      const hasRoute = routeKeys.includes(phase.key);
      expect(hasRoute).toBe(true);
    });
  });

  test('workspace routes follow correct pattern', () => {
    WORKSPACE_ROUTES.forEach(route => {
      expect(route).toMatch(/^\/workspace\/:engagementId\/[a-z-]+$/);
    });
  });

  test('global routes do not require engagementId', () => {
    GLOBAL_ROUTES.forEach(route => {
      expect(route).not.toContain('engagementId');
    });
  });

  test('audit sequence is correctly ordered', () => {
    const auditSequence = [
      'requisition',
      'pre-planning',
      'planning',
      'execution',
      'fs-heads',
      'evidence',
      'outputs',
      'finalization',
      'deliverables',
      'eqcr',
      'inspection',
    ];

    const phaseKeys = WORKSPACE_PHASES.map(p => p.key);
    expect(phaseKeys).toEqual(auditSequence);
  });

  test('no duplicate phase keys exist', () => {
    const phaseKeys = WORKSPACE_PHASES.map(p => p.key);
    const uniqueKeys = new Set(phaseKeys);
    expect(phaseKeys.length).toBe(uniqueKeys.size);
  });
});

test.describe('Workflow Gates', () => {
  const PHASE_DEPENDENCIES: Record<string, string[]> = {
    'pre-planning': ['requisition'],
    'planning': ['pre-planning'],
    'execution': ['planning'],
    'fs-heads': ['execution'],
    'finalization': ['fs-heads'],
    'deliverables': ['finalization'],
    'eqcr': ['deliverables'],
    'inspection': ['eqcr'],
  };

  test('phase dependencies form a valid DAG', () => {
    const visited = new Set<string>();
    const visiting = new Set<string>();

    function hasCycle(phase: string): boolean {
      if (visiting.has(phase)) return true;
      if (visited.has(phase)) return false;

      visiting.add(phase);
      const deps = PHASE_DEPENDENCIES[phase] || [];
      for (const dep of deps) {
        if (hasCycle(dep)) return true;
      }
      visiting.delete(phase);
      visited.add(phase);
      return false;
    }

    Object.keys(PHASE_DEPENDENCIES).forEach(phase => {
      expect(hasCycle(phase)).toBe(false);
    });
  });

  test('all dependencies reference valid phases', () => {
    const validPhases = new Set(WORKSPACE_PHASES.map(p => p.key));

    Object.entries(PHASE_DEPENDENCIES).forEach(([phase, deps]) => {
      expect(validPhases.has(phase)).toBe(true);
      deps.forEach(dep => {
        expect(validPhases.has(dep)).toBe(true);
      });
    });
  });
});
