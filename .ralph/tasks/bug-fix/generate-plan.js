#!/usr/bin/env node

/**
 * generate-plan.js
 *
 * Parses FINDINGS.md from the audit phase and generates a fix-phase plan.md
 * grouped by file path, ordered by highest severity first.
 *
 * Usage: node .ralph/tasks/bug-fix/generate-plan.js
 */

const fs = require('fs');
const path = require('path');

const FINDINGS_PATH = path.join(__dirname, '..', 'bug-audit', 'FINDINGS.md');
const PLAN_PATH = path.join(__dirname, 'plan.md');
const PROGRESS_PATH = path.join(__dirname, 'PROGRESS.md');
const ACTIVITY_PATH = path.join(__dirname, 'activity.md');

const SEVERITY_ORDER = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3, INFO: 4 };

// Protected file patterns — auto-defer these
const PROTECTED_PATTERNS = [
  /^supabase\/migrations\//,
  /\.test\.(ts|tsx)$/,
  /\.spec\.(ts|tsx)$/,
  /^package\.json$/,
  /^package-lock\.json$/,
  /^next\.config\./,
];

function isProtectedFile(filePath) {
  return PROTECTED_PATTERNS.some(p => p.test(filePath));
}

function parseFindingsFile(content) {
  const findings = [];
  // Split on finding headers
  const blocks = content.split(/^---\n### Finding /m);

  for (const block of blocks) {
    // Match finding ID pattern like "1.1:" or "10.3:"
    const idMatch = block.match(/^(\d+\.\d+):\s*(.+)/);
    if (!idMatch) continue;

    const findingId = idMatch[1];
    const title = idMatch[2].trim();

    // Extract file
    const fileMatch = block.match(/\*\*File\*\*:\s*`([^`]+)`/);
    const file = fileMatch ? fileMatch[1] : null;

    // Extract severity
    const sevMatch = block.match(/\*\*Severity\*\*:\s*(CRITICAL|HIGH|MEDIUM|LOW|INFO)/);
    const severity = sevMatch ? sevMatch[1] : 'INFO';

    // Extract category
    const catMatch = block.match(/\*\*Category\*\*:\s*(\w+)/);
    const category = catMatch ? catMatch[1] : 'UNKNOWN';

    // Check if already has a Status (already processed by fix agent)
    const hasStatus = /\*\*Status\*\*:/.test(block);

    if (file) {
      findings.push({ findingId, title, file, severity, category, hasStatus });
    }
  }

  return findings;
}

function groupByFile(findings) {
  const groups = new Map();

  for (const f of findings) {
    if (!groups.has(f.file)) {
      groups.set(f.file, []);
    }
    groups.get(f.file).push(f);
  }

  return groups;
}

function maxSeverity(findings) {
  let best = 'INFO';
  for (const f of findings) {
    if ((SEVERITY_ORDER[f.severity] ?? 4) < (SEVERITY_ORDER[best] ?? 4)) {
      best = f.severity;
    }
  }
  return best;
}

function main() {
  // Read findings
  if (!fs.existsSync(FINDINGS_PATH)) {
    console.error(`Error: ${FINDINGS_PATH} not found. Run the audit first.`);
    process.exit(1);
  }

  const content = fs.readFileSync(FINDINGS_PATH, 'utf-8');
  const findings = parseFindingsFile(content);

  console.log(`Parsed ${findings.length} findings`);

  // Count severities
  const severityCounts = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0, INFO: 0 };
  for (const f of findings) {
    severityCounts[f.severity] = (severityCounts[f.severity] || 0) + 1;
  }
  console.log('Severity breakdown:', severityCounts);

  // Group by file
  const groups = groupByFile(findings);
  console.log(`Grouped into ${groups.size} file-based tasks`);

  // Build tasks
  const tasks = [];
  for (const [file, fileFindings] of groups) {
    const ms = maxSeverity(fileFindings);
    const autodefer = isProtectedFile(file) || file === 'Multiple files';

    tasks.push({
      file,
      finding_count: fileFindings.length,
      max_severity: ms,
      max_severity_order: SEVERITY_ORDER[ms] ?? 4,
      findings: fileFindings.map(f => f.findingId),
      auto_defer: autodefer || undefined,
    });
  }

  // Sort by severity (CRITICAL first), then by finding count descending
  tasks.sort((a, b) => {
    if (a.max_severity_order !== b.max_severity_order) {
      return a.max_severity_order - b.max_severity_order;
    }
    return b.finding_count - a.finding_count;
  });

  // Assign IDs and clean up
  const planTasks = tasks.map((t, i) => {
    const task = {
      id: i + 1,
      file: t.file,
      finding_count: t.finding_count,
      max_severity: t.max_severity,
      findings: t.findings,
      passes: false,
      status_counts: {},
    };
    if (t.auto_defer) {
      task.auto_defer = true;
    }
    return task;
  });

  // Write plan.md
  const plan = JSON.stringify(planTasks, null, 2);
  fs.writeFileSync(PLAN_PATH, plan + '\n');
  console.log(`Written ${PLAN_PATH} with ${planTasks.length} tasks`);

  // Write PROGRESS.md
  const progress = `# GoodRevCRM Bug Fix — Progress Report

> Automated fix phase by Ralph agent
> Source: .ralph/tasks/bug-audit/FINDINGS.md
> Generated: ${new Date().toISOString().split('T')[0]}

## Fix Progress
- **Tasks completed**: 0 / ${planTasks.length}
- **Findings FIXED**: 0
- **Findings ALREADY_FIXED**: 0
- **Findings NOT_AN_ISSUE**: 0
- **Findings DEFERRED**: 0
- **Build failures**: 0
- **Last updated**: —

## Severity Breakdown (from audit)
- **CRITICAL**: ${severityCounts.CRITICAL}
- **HIGH**: ${severityCounts.HIGH}
- **MEDIUM**: ${severityCounts.MEDIUM}
- **LOW**: ${severityCounts.LOW}
- **INFO**: ${severityCounts.INFO}
- **Total findings**: ${findings.length}

## Deferred Findings

_Findings that require manual intervention:_

(auto-populated as findings are deferred)

## Build Failures Log

_Tasks where npm run build failed:_

(auto-populated on build failures)
`;
  fs.writeFileSync(PROGRESS_PATH, progress);
  console.log(`Written ${PROGRESS_PATH}`);

  // Write activity.md
  const activity = `# GoodRevCRM Bug Fix — Activity Log

| Timestamp | Task | File | Fixed | Deferred | Other |
|-----------|------|------|-------|----------|-------|
`;
  fs.writeFileSync(ACTIVITY_PATH, activity);
  console.log(`Written ${ACTIVITY_PATH}`);

  console.log('\nDone! Review plan.md, then run:');
  console.log('  .ralph/ralph.sh .ralph/tasks/bug-fix 150 --stream --min-clean=2');
}

main();
