import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

const errors = [];

function walkFiles(dir, exts) {
  const results = [];
  const absDir = path.join(ROOT, dir);
  if (!fs.existsSync(absDir)) return results;

  for (const entry of fs.readdirSync(absDir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === '.git') continue;
    const full = path.join(absDir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkFiles(path.relative(ROOT, full), exts));
    } else if (exts.includes(path.extname(entry.name).toLowerCase())) {
      results.push(full);
    }
  }
  return results;
}

function resolveRelativeImport(fromFile, spec) {
  const baseDir = path.dirname(fromFile);
  const candidates = [
    path.resolve(baseDir, spec),
    path.resolve(baseDir, `${spec}.js`),
    path.resolve(baseDir, `${spec}.jsx`),
    path.resolve(baseDir, `${spec}.mjs`),
    path.resolve(baseDir, spec, 'index.js'),
    path.resolve(baseDir, spec, 'index.jsx'),
  ];
  return candidates.some((c) => fs.existsSync(c) && fs.statSync(c).isFile());
}

// 1. Syntax check on all server, shared, tests, and scripts JS/MJS files
const backendJsFiles = [
  ...walkFiles('server', ['.js', '.mjs']),
  ...walkFiles('shared', ['.js', '.mjs']),
  ...walkFiles('tests', ['.js', '.mjs']),
  ...walkFiles('scripts', ['.js', '.mjs']),
];

for (const file of backendJsFiles) {
  try {
    execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' });
  } catch (err) {
    errors.push(`Erro de sintaxe em ${path.relative(ROOT, file)}: ${err.stderr?.toString() || err.message}`);
  }
}

// 2. Enforce least-privilege bot invite permissions (ban permissions=8 in frontend/shared)
const frontendAndShared = [...walkFiles('src', ['.js', '.jsx']), ...walkFiles('shared', ['.js', '.mjs'])];
for (const file of frontendAndShared) {
  const rel = path.relative(ROOT, file).replace(/\\/g, '/');
  const txt = fs.readFileSync(file, 'utf8');
  if (txt.includes('permissions=8')) {
    errors.push(`${rel}: proibido usar "permissions=8" (use buildDiscordBotInviteUrl de shared/appConfig.js)`);
  }
}

// 3. Enforce atomic JSON persistence on server/ state files
const ALLOWED_RAW_WRITE_FILES = new Set([
  'server/utils/atomicJson.js',
  'server/db.js',
  'server/authSession.js', // .session-secret with mode 0o600
  'server/gsi.js', // Valve .cfg install files in game directory
  'server/runner.js', // PID file
]);

for (const file of walkFiles('server', ['.js', '.mjs'])) {
  const rel = path.relative(ROOT, file).replace(/\\/g, '/');
  if (ALLOWED_RAW_WRITE_FILES.has(rel)) continue;
  const txt = fs.readFileSync(file, 'utf8');
  if (/writeFileSync\s*\(/.test(txt)) {
    errors.push(`${rel}: use writeJsonAtomic() em vez de fs.writeFileSync() para persistência JSON`);
  }
}

// 4. Verify relative ES imports resolve cleanly across server/, shared/, src/, scripts/
const importCheckFiles = [...backendJsFiles, ...walkFiles('src', ['.js', '.jsx'])];
const staticImportRe = /(?:^|\n)\s*(?:import|export)\s+(?:[\s\S]*?\s+from\s+)?['"](\.[^'"]+)['"]/g;
const dynamicImportRe = /\bimport\s*\(\s*['"](\.[^'"]+)['"]\s*\)/g;

for (const file of importCheckFiles) {
  const rel = path.relative(ROOT, file).replace(/\\/g, '/');
  const txt = fs.readFileSync(file, 'utf8');
  for (const rx of [staticImportRe, dynamicImportRe]) {
    rx.lastIndex = 0;
    let m;
    while ((m = rx.exec(txt)) !== null) {
      const spec = m[1];
      if (!resolveRelativeImport(file, spec)) {
        errors.push(`${rel}: import relativo não encontrado -> "${spec}"`);
      }
    }
  }
}

if (errors.length > 0) {
  console.error('❌ [LINT] Falhas encontradas:');
  for (const err of errors) {
    console.error(`  - ${err}`);
  }
  process.exit(1);
}

console.log(`✔ [LINT] ${backendJsFiles.length} arquivos Node validados e ${importCheckFiles.length} módulos verificados sem erros.`);
