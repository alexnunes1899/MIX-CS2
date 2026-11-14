import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

function ensureWindowsToolPaths() {
  if (process.platform !== 'win32') return;
  const localAppData = process.env.LOCALAPPDATA || '';
  const appData = process.env.APPDATA || '';
  const extraDirs = [
    path.join(localAppData, 'Programs', 'Git', 'cmd'),
    path.join(localAppData, 'MinGit', 'cmd'),
    'C:\\Program Files\\Git\\cmd',
    'C:\\Program Files\\nodejs',
    path.join(appData, 'npm'),
  ].filter(Boolean);

  const currentPath = process.env.PATH || '';
  const currentSet = new Set(currentPath.split(';').map((item) => item.toLowerCase()));
  const missing = extraDirs.filter((dir) => fs.existsSync(dir) && !currentSet.has(dir.toLowerCase()));
  if (missing.length > 0) {
    process.env.PATH = `${currentPath};${missing.join(';')}`;
  }
}

function runCommand(command, args, { capture = false, allowFail = false, useShell = false } = {}) {
  const result = spawnSync(command, args, {
    cwd: ROOT_DIR,
    stdio: capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
    encoding: 'utf8',
    shell: useShell,
  });

  if (result.error) {
    if (allowFail) return { ok: false, status: 1, stdout: '', stderr: result.error.message };
    throw result.error;
  }

  const ok = result.status === 0;
  if (!ok && !allowFail) {
    const err = new Error(`Comando falhou (${command} ${args.join(' ')}) com código ${result.status}`);
    err.exitCode = result.status || 1;
    throw err;
  }

  return {
    ok,
    status: result.status ?? 0,
    stdout: (result.stdout || '').trim(),
    stderr: (result.stderr || '').trim(),
  };
}

function runGit(args, options = {}) {
  return runCommand('git', args, { ...options, useShell: false });
}

function runNpm(args, options = {}) {
  const npmBin = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  return runCommand(npmBin, args, { ...options, useShell: process.platform === 'win32' });
}

function parseCliArgs(argv) {
  let dryRun = false;
  let skipBuild = false;
  let skipCheck = false;
  const messageParts = [];

  for (const arg of argv) {
    if (arg === '--dry-run') dryRun = true;
    else if (arg === '--skip-build') skipBuild = true;
    else if (arg === '--skip-check') skipCheck = true;
    else messageParts.push(arg);
  }

  const commitMessage = messageParts.join(' ').trim() || 'update: sincronizar alteracoes com GitHub';
  return { dryRun, skipBuild, skipCheck, commitMessage };
}

function main() {
  ensureWindowsToolPaths();
  const { dryRun, skipBuild, skipCheck, commitMessage } = parseCliArgs(process.argv.slice(2));

  console.log('========================================================');
  console.log('  Sincronizando CS2 Mix Hub com o GitHub...');
  console.log('========================================================\n');

  const gitCheck = runGit(['--version'], { capture: true, allowFail: true });
  if (!gitCheck.ok) {
    console.error('[ERRO] Git não encontrado. Instale em https://git-scm.com/downloads');
    process.exit(1);
  }

  const insideRepo = runGit(['rev-parse', '--is-inside-work-tree'], { capture: true, allowFail: true });
  if (!insideRepo.ok || insideRepo.stdout !== 'true') {
    console.error('[ERRO] Esta pasta não é um repositório Git conectado ao GitHub.');
    console.error('Clone o repositório oficial com: git clone https://github.com/alexnunes1899/MIX-CS2.git');
    process.exit(1);
  }

  const branchRes = runGit(['rev-parse', '--abbrev-ref', 'HEAD'], { capture: true });
  const branch = branchRes.stdout || 'main';
  if (branch === 'HEAD') {
    console.error('[ERRO] Repositório em HEAD destacado. Execute: git checkout main');
    process.exit(1);
  }

  const originRes = runGit(['remote', 'get-url', 'origin'], { capture: true, allowFail: true });
  if (!originRes.ok || !originRes.stdout) {
    console.error('[ERRO] Remote "origin" não configurado neste repositório.');
    process.exit(1);
  }

  if (!fs.existsSync(path.join(ROOT_DIR, 'node_modules'))) {
    console.log('[0/5] Pasta node_modules ausente. Executando npm install...');
    if (!dryRun) runNpm(['install']);
  }

  console.log(`[1/5] Baixando atualizações do GitHub (origin/${branch})...`);
  if (!dryRun) {
    const pullRes = runGit(['pull', '--rebase', '--autostash', 'origin', branch], { allowFail: true });
    if (!pullRes.ok) {
      console.error('\n[ERRO] Falha ao puxar alterações do GitHub (possível conflito ou falha de rede).');
      console.error('Se houver um rebase pendente com conflito, resolva os arquivos ou rode: git rebase --abort');
      process.exit(pullRes.status || 1);
    }
  }

  if (!skipCheck) {
    console.log('\n[2/5] Executando verificações e testes (npm run check)...');
    if (!dryRun) runNpm(['run', 'check']);
  } else {
    console.log('\n[2/5] Verificações puladas (--skip-check).');
  }

  if (!skipBuild) {
    console.log('\n[3/5] Compilando frontend (npm run build)...');
    if (!dryRun) runNpm(['run', 'build']);
  } else {
    console.log('\n[3/5] Build do frontend pulado (--skip-build).');
  }

  console.log('\n[4/5] Verificando e preparando alterações locais...');
  if (!dryRun) {
    runGit(['add', '-A']);
    // Evita subir snapshot local de runtime caso o servidor local tenha gravado em activeMixStore.json
    runGit(['reset', '-q', 'HEAD', '--', 'server/data/activeMixStore.json'], { allowFail: true });

    const cachedDiff = runGit(['diff', '--cached', '--quiet'], { allowFail: true });
    if (!cachedDiff.ok) {
      console.log(`Criando commit: "${commitMessage}"`);
      runGit(['commit', '-m', commitMessage]);
    } else {
      console.log('Nenhuma alteração local nova para commitar.');
    }
  }

  console.log(`\n[5/5] Verificando envios pendentes para origin/${branch}...`);
  if (!dryRun) {
    const upstreamRef = `origin/${branch}`;
    const hasUpstream = runGit(['rev-parse', '--verify', upstreamRef], { capture: true, allowFail: true }).ok;
    const aheadCount = hasUpstream
      ? Number(runGit(['rev-list', '--count', `${upstreamRef}..HEAD`], { capture: true }).stdout || '0')
      : 1;

    if (!hasUpstream || aheadCount > 0) {
      runGit(['push', '-u', 'origin', branch]);
      console.log(`\n[SUCESSO] ${aheadCount} commit(s) enviado(s) para origin/${branch}!`);
    } else {
      console.log(`\n[OK] Repositório já está 100% sincronizado com origin/${branch}.`);
    }
  } else {
    console.log(`\n[DRY-RUN] Fluxo concluído para branch "${branch}" com mensagem "${commitMessage}".`);
  }
}

try {
  main();
} catch (error) {
  console.error(`\n[ERRO] ${error.message || error}`);
  process.exit(error.exitCode || 1);
}
