#!/usr/bin/env node
/**
 * Validates render.yaml is QA-only and contains no hardcoded secrets.
 * Uses only Node.js built-in modules (no external YAML parser required).
 * Exit 0 = all assertions pass. Exit 1 = one or more failures.
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const YAML_PATH = resolve(__dirname, '../render.yaml');

let raw;
try {
  raw = readFileSync(YAML_PATH, 'utf8');
} catch (e) {
  console.error(`FAIL: Cannot read render.yaml at ${YAML_PATH}: ${e.message}`);
  process.exit(1);
}

const lines = raw.split('\n');
let passed = 0;
let failed = 0;

function assert(name, cond, detail = '') {
  if (cond) {
    console.log(`  PASS  ${name}`);
    passed++;
  } else {
    console.error(`  FAIL  ${name}${detail ? ' -- ' + detail : ''}`);
    failed++;
  }
}

/**
 * Returns lines from lineIndex up to (but not including) the next sibling
 * env var entry (a line starting with "      - key:") or at most `maxLines`.
 * This prevents context from bleeding into the next env var block.
 */
function contextAround(lineIndex, maxLines = 8) {
  const end = Math.min(lineIndex + maxLines, lines.length);
  const chunk = [];
  for (let i = lineIndex; i < end; i++) {
    // Stop at the start of the next sibling env var entry
    if (i > lineIndex && /^\s+- key:/.test(lines[i])) break;
    chunk.push(lines[i]);
  }
  return chunk.join('\n');
}

console.log(`Validating: ${YAML_PATH}\n`);

// -----------------------------------------------------------------------
// 1. Only QA-named resources -- no production resource names
// -----------------------------------------------------------------------
console.log('# Resource names');

const nameLines = lines
  .map((l, i) => ({ line: l, idx: i }))
  .filter(({ line }) => /^\s+name:\s+\S/.test(line));

const names = nameLines.map(({ line }) => line.match(/name:\s+(.+)/)[1].trim());

assert(
  'Only QA resource names present (fulcrum-qa or fulcrum-qa-db)',
  names.length > 0 && names.every(n => n === 'fulcrum-qa' || n === 'fulcrum-qa-db'),
  `Found: [${names.join(', ')}]`
);
assert('QA web service fulcrum-qa declared', names.includes('fulcrum-qa'));
assert('QA database fulcrum-qa-db declared', names.includes('fulcrum-qa-db'));

// Explicit rejection of bare production names
const PROD_PATTERNS = [/\bfulcrum\b(?!-qa)/, /\bfulcrum-db\b(?!.*-qa)/];
const prodNameViolations = names.filter(n =>
  PROD_PATTERNS.some(p => p.test(n)) && n !== 'fulcrum-qa' && n !== 'fulcrum-qa-db'
);
assert(
  'No bare production resource names (e.g. "fulcrum", "fulcrum-db")',
  prodNameViolations.length === 0,
  `Violations: [${prodNameViolations.join(', ')}]`
);

// -----------------------------------------------------------------------
// 2. preDeployCommand
// -----------------------------------------------------------------------
console.log('\n# Pre-deploy command');

const EXPECTED_PREDEPLOY = 'npm run db:push -- --force && npm run migrate';
const preDeployLineObj = lines
  .map((l, i) => ({ line: l, idx: i }))
  .find(({ line }) => /preDeployCommand/.test(line));

assert('preDeployCommand key present', Boolean(preDeployLineObj));
if (preDeployLineObj) {
  assert(
    `preDeployCommand equals "${EXPECTED_PREDEPLOY}"`,
    preDeployLineObj.line.includes(EXPECTED_PREDEPLOY),
    `Got: ${preDeployLineObj.line.trim()}`
  );
}

// -----------------------------------------------------------------------
// 3. DATABASE_URL -- must use fromDatabase (no literal value)
// -----------------------------------------------------------------------
console.log('\n# DATABASE_URL');

const dbUrlIdx = lines.findIndex(l => /key:\s+DATABASE_URL/.test(l));
assert('DATABASE_URL env var declared', dbUrlIdx !== -1);
if (dbUrlIdx !== -1) {
  const ctx = contextAround(dbUrlIdx, 6);
  assert(
    'DATABASE_URL uses fromDatabase (not a literal value)',
    /fromDatabase/.test(ctx),
    `Context:\n${ctx}`
  );
  assert(
    'DATABASE_URL fromDatabase references fulcrum-qa-db',
    /fulcrum-qa-db/.test(ctx),
    `Context:\n${ctx}`
  );
  assert(
    'DATABASE_URL has no literal value: key',
    !/^\s+value:\s+\S/.test(ctx.split('\n').slice(1).join('\n')),
    'Found literal value: key in DATABASE_URL block'
  );
}

// -----------------------------------------------------------------------
// 4. SESSION_SECRET -- must use generateValue: true, no literal value
// -----------------------------------------------------------------------
console.log('\n# SESSION_SECRET');

const sessIdx = lines.findIndex(l => /key:\s+SESSION_SECRET/.test(l));
assert('SESSION_SECRET env var declared', sessIdx !== -1);
if (sessIdx !== -1) {
  const ctx = contextAround(sessIdx, 4);
  assert(
    'SESSION_SECRET uses generateValue: true',
    /generateValue:\s+true/.test(ctx),
    `Context:\n${ctx}`
  );
  assert(
    'SESSION_SECRET has no literal value',
    !/value:\s+\S/.test(ctx.split('\n').slice(1).join('\n')),
    `Context:\n${ctx}`
  );
}

// -----------------------------------------------------------------------
// 5. All operator-supplied secrets -- sync: false, no literal value
// -----------------------------------------------------------------------
console.log('\n# Operator-supplied secrets (sync: false, no literal values)');

const SYNC_FALSE_VARS = [
  'HUBSPOT_API_KEY',
  'HUBSPOT_CLIENT_ID',
  'HUBSPOT_CLIENT_SECRET',
  'XERO_CLIENT_ID',
  'XERO_CLIENT_SECRET',
  'OKTA_ISSUER',
  'OKTA_CLIENT_ID',
  'OKTA_CLIENT_SECRET',
  'OKTA_CALLBACK_URL',
];

for (const varName of SYNC_FALSE_VARS) {
  const idx = lines.findIndex(l => new RegExp(`key:\\s+${varName}\\s*$`).test(l));
  assert(`${varName} declared`, idx !== -1);
  if (idx !== -1) {
    const ctx = contextAround(idx, 4);
    const ctxRest = ctx.split('\n').slice(1).join('\n');
    assert(`${varName} has sync: false`, /sync:\s+false/.test(ctxRest), `Context:\n${ctx}`);
    assert(`${varName} has no literal value`, !/value:\s+\S/.test(ctxRest), `Context:\n${ctx}`);
  }
}

// -----------------------------------------------------------------------
// 6. No disk or domain entries
// -----------------------------------------------------------------------
console.log('\n# No disk/domain production hooks');

const hasDisk = lines.some(l => /^\s+disk:/.test(l));
const hasDomains = lines.some(l => /^\s+domains:/.test(l));
assert('No disk: entries in Blueprint', !hasDisk);
assert('No domains: entries in Blueprint', !hasDomains);

// -----------------------------------------------------------------------
// 7. NODE_ENV = production
// -----------------------------------------------------------------------
console.log('\n# NODE_ENV');

const nodeEnvIdx = lines.findIndex(l => /key:\s+NODE_ENV/.test(l));
assert('NODE_ENV declared', nodeEnvIdx !== -1);
if (nodeEnvIdx !== -1) {
  const ctx = contextAround(nodeEnvIdx, 3);
  assert('NODE_ENV value is "production"', /value:\s+production/.test(ctx), `Context:\n${ctx}`);
}

// -----------------------------------------------------------------------
// Summary
// -----------------------------------------------------------------------
console.log(`\n${'─'.repeat(60)}`);
console.log(`Result: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.error('\nrender.yaml FAILED validation. Fix the issues above before committing.');
  process.exit(1);
}
console.log('\nrender.yaml is valid: QA-only resources, no hardcoded secrets.');
