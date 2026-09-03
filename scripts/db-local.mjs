/**
 * A local Postgres for development, with no Docker, no installer and no admin
 * rights.
 *
 * The `embedded-postgres` dev dependency ships real PostgreSQL binaries for the
 * current platform; this script drives them with `pg_ctl`, which daemonises
 * properly on Windows so the server outlives this process.
 *
 *   node scripts/db-local.mjs start | stop | status | reset
 *
 * The cluster lives in .pgdata/ (gitignored) and listens on localhost only.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import net from 'node:net';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dataDir = join(root, '.pgdata');
const logFile = join(dataDir, 'server.log');

// 5433, not 5432: a machine that already runs Postgres should not have this
// dev cluster fight it for the default port. Override with QM_DB_PORT.
const PORT = Number(process.env.QM_DB_PORT || 5433);
const USER = 'quranminds';
const PASSWORD = 'quranminds';
const DATABASE = 'quranminds';

/** Locate the platform's binaries, whichever @embedded-postgres package landed. */
function binDir() {
  const candidates = [
    'windows-x64', 'darwin-arm64', 'darwin-x64', 'linux-x64', 'linux-arm64', 'linux-arm64v8',
  ].map((p) => join(root, 'node_modules', '@embedded-postgres', p, 'native', 'bin'));

  const found = candidates.find((dir) => existsSync(join(dir, 'initdb.exe')) || existsSync(join(dir, 'initdb')));
  if (!found) {
    fail(
      'PostgreSQL binaries not found.\n' +
        'Run:  npm install\n' +
        'If npm blocked the install script:  npm approve-scripts @embedded-postgres/windows-x64',
    );
  }
  return found;
}

const BIN = binDir();
const exe = (name) => {
  const withExt = join(BIN, `${name}.exe`);
  return existsSync(withExt) ? withExt : join(BIN, name);
};

/**
 * Postgres forks worker processes, and on Windows those workers load the DLLs
 * sitting next to the binaries. Without the bin directory on PATH they die with
 * 0xC0000142 (DLL init failed) and the server restarts in a loop.
 */
function childEnv() {
  return {
    ...process.env,
    PATH: `${BIN}${process.platform === 'win32' ? ';' : ':'}${process.env.PATH || ''}`,
    PGDATA: undefined,
    PGPORT: undefined,
  };
}

function run(name, args, { quiet = false } = {}) {
  const result = spawnSync(exe(name), args, {
    encoding: 'utf8',
    env: childEnv(),
  });
  if (!quiet && result.stdout?.trim()) console.log(result.stdout.trim());
  if (result.status !== 0 && !quiet) {
    if (result.stderr?.trim()) console.error(result.stderr.trim());
  }
  return result;
}

function fail(message) {
  console.error(`\n${message}\n`);
  process.exit(1);
}

function portInUse(port) {
  return new Promise((resolveP) => {
    const socket = net.connect({ port, host: '127.0.0.1' });
    socket.setTimeout(700);
    socket.on('connect', () => { socket.destroy(); resolveP(true); });
    socket.on('timeout', () => { socket.destroy(); resolveP(false); });
    socket.on('error', () => resolveP(false));
  });
}

function isRunning() {
  return run('pg_ctl', ['-D', dataDir, 'status'], { quiet: true }).status === 0;
}

async function start() {
  if (isRunning()) {
    console.log(`Already running on port ${PORT}.`);
    printUrl();
    return;
  }

  if (!existsSync(join(dataDir, 'PG_VERSION'))) {
    console.log('Creating the cluster (first run only)...');
    mkdirSync(dataDir, { recursive: true });

    // initdb reads the superuser password from a file so it never appears in a
    // process listing.
    const pwFile = join(root, '.pgdata-init-password');
    writeFileSync(pwFile, PASSWORD, 'utf8');
    const init = run('initdb', [
      '-D', dataDir,
      '-U', USER,
      '--auth-local=scram-sha-256',
      '--auth-host=scram-sha-256',
      `--pwfile=${pwFile}`,
      '--encoding=UTF8',
      '--locale=C',
    ], { quiet: true });
    rmSync(pwFile, { force: true });

    if (init.status !== 0) fail(`initdb failed:\n${init.stderr || init.stdout}`);
    console.log('Cluster created.');
  }

  if (await portInUse(PORT)) {
    fail(
      `Port ${PORT} is already in use by something else.\n` +
        `Start on another port with:  QM_DB_PORT=5433 npm run db:start\n` +
        `(then update the port in .env to match)`,
    );
  }

  console.log(`Starting PostgreSQL on port ${PORT}...`);
  const started = run('pg_ctl', [
    '-D', dataDir,
    '-l', logFile,
    '-o', `-p ${PORT} -c listen_addresses=127.0.0.1`,
    '-w', '-t', '30',
    'start',
  ], { quiet: true });

  if (started.status !== 0) {
    const log = existsSync(logFile) ? readFileSync(logFile, 'utf8').split('\n').slice(-15).join('\n') : '';
    fail(`Could not start PostgreSQL:\n${started.stderr || started.stdout}\n${log}`);
  }

  // createdb is idempotent for our purposes - an existing database is fine.
  const created = run('createdb', ['-h', '127.0.0.1', '-p', String(PORT), '-U', USER, DATABASE], { quiet: true });
  if (created.status === 0) console.log(`Database "${DATABASE}" created.`);

  console.log('PostgreSQL is running.');
  printUrl();
}

function stop() {
  if (!isRunning()) {
    console.log('Not running.');
    return;
  }
  const result = run('pg_ctl', ['-D', dataDir, '-m', 'fast', '-w', 'stop'], { quiet: true });
  console.log(result.status === 0 ? 'Stopped.' : `Could not stop cleanly:\n${result.stderr || result.stdout}`);
}

function status() {
  if (isRunning()) {
    console.log(`Running on port ${PORT}.`);
    printUrl();
  } else {
    console.log('Not running. Start it with:  npm run db:start');
  }
}

function reset() {
  if (isRunning()) stop();
  rmSync(dataDir, { recursive: true, force: true });
  console.log('Cluster deleted. Run "npm run db:start" to create a fresh one.');
}

function printUrl() {
  const url = `postgresql://${USER}:${PASSWORD}@127.0.0.1:${PORT}/${DATABASE}?schema=quranminds`;
  console.log('\nPut these in .env:');
  console.log(`  POSTGRES_PRISMA_URL="${url}"`);
  console.log(`  POSTGRES_URL_NON_POOLING="${url}"`);
}

const command = process.argv[2] || 'start';
const commands = { start, stop, status, reset };
if (!commands[command]) fail(`Unknown command "${command}". Use: start | stop | status | reset`);
await commands[command]();
