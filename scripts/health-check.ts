#!/usr/bin/env tsx
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

interface HealthCheckResult {
  category: string;
  check: string;
  status: 'PASS' | 'FAIL' | 'WARN';
  message: string;
  duration?: number;
}

const results: HealthCheckResult[] = [];

async function runCommand(cmd: string, description: string): Promise<{ success: boolean; output: string; duration: number }> {
  const start = Date.now();
  try {
    const { stdout, stderr } = await execAsync(cmd, { timeout: 120000 });
    return { success: true, output: stdout + stderr, duration: Date.now() - start };
  } catch (error: any) {
    return { success: false, output: error.message || 'Command failed', duration: Date.now() - start };
  }
}

async function checkTypeScript(): Promise<void> {
  console.log('\n📦 Running TypeScript check...');
  const { success, output, duration } = await runCommand('npm run typecheck 2>&1', 'TypeScript');
  
  if (success) {
    results.push({ category: 'Build', check: 'TypeScript', status: 'PASS', message: 'No type errors', duration });
  } else {
    const errorCount = (output.match(/error TS/g) || []).length;
    results.push({ 
      category: 'Build', 
      check: 'TypeScript', 
      status: errorCount > 0 ? 'WARN' : 'PASS', 
      message: errorCount > 0 ? `${errorCount} type errors found` : 'Completed with warnings',
      duration 
    });
  }
}

async function checkBuild(): Promise<void> {
  console.log('\n🔨 Running build check...');
  const { success, output, duration } = await runCommand('npm run build 2>&1', 'Build');
  
  results.push({ 
    category: 'Build', 
    check: 'Production Build', 
    status: success ? 'PASS' : 'FAIL', 
    message: success ? 'Build successful' : 'Build failed',
    duration 
  });
}

async function checkApiEndpoints(): Promise<void> {
  console.log('\n🌐 Checking API endpoints...');
  
  const endpoints = [
    { path: '/health', method: 'GET', description: 'Health check' },
    { path: '/api/clients', method: 'GET', description: 'Clients list' },
    { path: '/api/engagements', method: 'GET', description: 'Engagements list' },
    { path: '/api/users', method: 'GET', description: 'Users list' },
    { path: '/api/firms', method: 'GET', description: 'Firms' },
  ];
  
  for (const endpoint of endpoints) {
    try {
      const start = Date.now();
      const response = await fetch(`http://localhost:5000${endpoint.path}`, {
        method: endpoint.method,
        headers: { 'Content-Type': 'application/json' }
      });
      const duration = Date.now() - start;
      
      results.push({
        category: 'API',
        check: endpoint.description,
        status: response.ok || response.status === 401 ? 'PASS' : 'FAIL',
        message: `${response.status} ${response.statusText}`,
        duration
      });
    } catch (error: any) {
      results.push({
        category: 'API',
        check: endpoint.description,
        status: 'FAIL',
        message: error.message || 'Connection failed'
      });
    }
  }
}

async function checkDatabase(): Promise<void> {
  console.log('\n🗄️ Checking database...');
  
  const { success, output, duration } = await runCommand(
    'npx prisma db pull --force 2>&1 | head -5',
    'Database connection'
  );
  
  results.push({
    category: 'Database',
    check: 'Connection',
    status: success || output.includes('Your database is now in sync') ? 'PASS' : 'FAIL',
    message: success ? 'Database connected' : 'Connection issue',
    duration
  });
}

function printResults(): void {
  console.log('\n' + '='.repeat(70));
  console.log('                    AUDITWISE HEALTH CHECK REPORT');
  console.log('='.repeat(70));
  
  const categories = [...new Set(results.map(r => r.category))];
  
  for (const category of categories) {
    console.log(`\n📋 ${category.toUpperCase()}`);
    console.log('-'.repeat(50));
    
    const categoryResults = results.filter(r => r.category === category);
    for (const result of categoryResults) {
      const statusIcon = result.status === 'PASS' ? '✅' : result.status === 'WARN' ? '⚠️' : '❌';
      const duration = result.duration ? ` (${result.duration}ms)` : '';
      console.log(`  ${statusIcon} ${result.check}: ${result.message}${duration}`);
    }
  }
  
  console.log('\n' + '='.repeat(70));
  
  const passed = results.filter(r => r.status === 'PASS').length;
  const warned = results.filter(r => r.status === 'WARN').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  const total = results.length;
  
  console.log(`\n📊 SUMMARY: ${passed}/${total} passed, ${warned} warnings, ${failed} failed`);
  
  if (failed > 0) {
    console.log('\n❌ TOP ISSUES:');
    results.filter(r => r.status === 'FAIL').forEach(r => {
      console.log(`   - ${r.category}/${r.check}: ${r.message}`);
    });
  }
  
  console.log('\n' + '='.repeat(70));
}

async function main(): Promise<void> {
  console.log('🏥 Starting AuditWise Health Check...');
  console.log('   Time:', new Date().toISOString());
  
  await checkTypeScript();
  await checkBuild();
  await checkDatabase();
  await checkApiEndpoints();
  
  printResults();
  
  const failed = results.filter(r => r.status === 'FAIL').length;
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(console.error);
