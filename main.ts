// Launch Radar entry program (Node 22, standard library only).
//
// Reads the sealed snapshot, scores every rankable pre-token protocol with the
// peer-multiple model in lib/model.ts, and writes the hand-in to the output
// directory: board.json (the ranked board), data.js (the dashboard's dataset),
// dashboard/ and screenshots/ copied from this repository, and dossier.json,
// the judge's summary, written by the vendored make.fun library.
//
// In the grader the snapshot is at /input/snapshot.json and the output is
// /output. Locally:  mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input ../input/snapshot.json

import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildRadar, loadSnapshot, toDataScript, validateBoard } from './lib/model.ts';
import { buildDossier } from './vendor/makefun-board.ts';

const repoDir = fileURLToPath(new URL('.', import.meta.url));

/** Read `--name value` or `--name=value` from the arguments, else the fallback. */
function option(name: string, fallback: string): string {
  const flag = `--${name}`;
  const at = process.argv.indexOf(flag);
  if (at >= 0 && process.argv[at + 1] !== undefined) return process.argv[at + 1]!;
  const joined = process.argv.find((a) => a.startsWith(`${flag}=`));
  return joined === undefined ? fallback : joined.slice(flag.length + 1);
}

function fail(message: string): never {
  process.stderr.write(`launch radar: ${message}\n`);
  process.exit(1);
}

const inputArg = option('input', '/input');
const snapshotPath = inputArg.endsWith('.json') ? inputArg : join(inputArg, 'snapshot.json');
if (!existsSync(snapshotPath)) fail(`no snapshot at ${snapshotPath}: pass --input <snapshot.json|directory>`);
const outDir = option('output', process.env.MAKEFUN_OUTPUT_DIR ?? '/output');

const snapshot = loadSnapshot(readFileSync(snapshotPath, 'utf8'));
const { board, radar } = buildRadar(snapshot);
const problem = validateBoard(board, snapshot);
if (problem !== null) fail(`the model produced a board the gate refuses: ${problem}`);

mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'board.json'), `${JSON.stringify({ rows: board })}\n`);
writeFileSync(join(outDir, 'data.js'), toDataScript(radar));

/** Copy a directory's regular files one level deep, skipping dot names; returns the names copied. */
function copyTree(from: string, to: string): string[] {
  if (!existsSync(from)) return [];
  mkdirSync(to, { recursive: true });
  const names: string[] = [];
  const walk = (src: string, dst: string): void => {
    for (const name of readdirSync(src)) {
      if (name.startsWith('.')) continue;
      const s = join(src, name);
      const d = join(dst, name);
      if (statSync(s).isDirectory()) {
        mkdirSync(d, { recursive: true });
        walk(s, d);
      } else if (statSync(s).isFile()) {
        copyFileSync(s, d);
        names.push(name);
      }
    }
  };
  walk(from, to);
  return names;
}

const pageFiles = copyTree(join(repoDir, 'dashboard'), join(outDir, 'dashboard'));
const shotFiles = copyTree(join(repoDir, 'screenshots'), join(outDir, 'screenshots'));
if (shotFiles.length < 3) fail(`screenshots/ holds ${shotFiles.length} images: the hand-in needs 3 (board, detail, filtered)`);

// The dossier goes last: the scorer rebuilds it from this same output and compares bytes.
const dossier = buildDossier(outDir, {
  text_max_bytes: 65_536,
  screenshots: { max: 4, max_bytes: 524_288 },
  dashboard: { max_files: 400, max_bytes: 4_194_304 },
});
writeFileSync(join(outDir, 'dossier.json'), dossier);

process.stdout.write(
  `launch radar: scanned ${radar.counts.scanned} protocols, watchlist ${radar.counts.watchlist} covered, ` +
    `${radar.counts.board} rows ranked (${radar.counts.early} beyond the watchlist), ${radar.counts.live} traded shown apart\n` +
    `launch radar: wrote board.json, data.js, dashboard/ (${pageFiles.length} files), screenshots/ (${shotFiles.length} images), dossier.json (${dossier.length} bytes)\n`,
);
