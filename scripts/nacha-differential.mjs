/** Offline comparison of Garrett's supplied NACHA checker and Wizard R2.
 * The legacy HTML is loaded from a user-supplied local path, never committed or transmitted.
 */
import { createHash } from 'node:crypto';
import { readdir, readFile, mkdir, stat, writeFile } from 'node:fs/promises';
import { relative, resolve, dirname, basename, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const DEFAULT_PROFILE = 'nacha-origination-expanded-public-2026-r2';
const FILE_EXTENSIONS = new Set(['.ach', '.nacha', '.txt', '.dat']);
const DEFAULT_MAX_FILES = 250;
const DEFAULT_MAX_BYTES = 25_000_000;
const REPORT_MAX_ROWS = 40;

function sha256(bytes) { return createHash('sha256').update(bytes).digest('hex'); }
function safeString(value) { return String(value ?? '').replace(/[\r\n\t]+/g, ' ').replace(/\|/g, '\\|').replace(/</g, '&lt;').replace(/>/g, '&gt;').trim(); }
function severity(value) { return String(value ?? '').toUpperCase() === 'ERROR' ? 'ERROR' : 'WARNING'; }
function reportDate() { return new Date().toISOString(); }

/** Evaluate only the unmodified validation definitions/functions before UI rendering. */
export function createGarrettRunner(html, { timeoutMs = 2000 } = {}) {
  const scripts = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script\s*>/gi)].map(match => match[1]);
  const source = scripts.find(s => s.includes('function validate(records)') && s.includes('function parse(text)'));
  if (!source) throw new Error('Garrett source does not contain the expected parse/validate implementation.');
  const stop = source.indexOf('/* ============================ rendering');
  if (stop < 0 || source.indexOf('function validate(records)') > stop) throw new Error('Cannot isolate Garrett validation code from the UI.');
  const code = source.slice(0, stop);
  const context = vm.createContext(Object.create(null));
  new vm.Script(code, { filename: 'garrett-nacha-validation.js' }).runInContext(context, { timeout: timeoutMs });
  const runner = new vm.Script('validate(parse(__nachaSource))', { filename: 'garrett-nacha-run.js' });
  return (sourceText) => {
    context.__nachaSource = sourceText;
    try {
      const result = runner.runInContext(context, { timeout: timeoutMs });
      if (!result || !Array.isArray(result.issues) || !result.stats) throw new Error('Garrett returned an unexpected result.');
      return normalizeGarrett(result);
    } finally {
      delete context.__nachaSource;
    }
  };
}

function garrettTheme(field) {
  const s = String(field).toLowerCase();
  if (/structure|record length|record type|blocking/.test(s)) return 'Record structure';
  if (/file header|immediate|file creation|file id modifier|priority code|format code|record size/.test(s)) return 'File header';
  if (/service class|standard entry class|company|effective entry|settlement|originator status|batch number/.test(s)) return 'Batch header';
  if (/routing|check digit|receiving dfi/.test(s)) return 'Routing';
  if (/trace|entry detail sequence/.test(s)) return 'Trace';
  if (/addenda|payment related|return reason|notification of change/.test(s) && !/entry\/addenda count/i.test(s)) return 'Addenda';
  if (/count|total|entry hash|block count/.test(s)) return 'Control totals';
  if (/amount|transaction code|receiver|account|name|individual/.test(s)) return 'Entry details';
  return 'Other fields';
}
function wizardTheme(ruleId) {
  const s = String(ruleId).replace(/^nacha\./, '');
  if (/^(framing|ascii|record-order|blocking)$/.test(s)) return 'Record structure';
  if (/^(file-header|creation-date|creation-time)$/.test(s)) return 'File header';
  if (/^(service-class|sec-code|batch-required|effective-|settlement-|originator-status|odfi|batch-number)/.test(s)) return 'Batch header';
  if (/^routing$/.test(s)) return 'Routing';
  if (/^trace/.test(s) || /^addenda-link$/.test(s)) return 'Trace';
  if (/^addenda|^ctx-remittance|^healthcare-(addenda|trn)/.test(s)) return 'Addenda';
  if (/^(file-|batch-)/.test(s)) return 'Control totals';
  if (/^(description-|reversal-|sec-transaction|web-credit)/.test(s)) return 'SEC-specific rules';
  if (/^(transaction-code|entry-|field-padding|remittance-required)/.test(s)) return 'Entry details';
  return 'Other fields';
}
function groupGarrettIssues(issues) {
  const groups = new Map();
  for (const item of issues) {
    const field = typeof item.field === 'string' ? item.field : '(unknown field)';
    const sev = severity(item.sev);
    const theme = garrettTheme(field);
    const key = `${sev}\u0000${field}`;
    const found = groups.get(key);
    if (found) { found.count++; continue; }
    groups.set(key, { severity: sev, field, theme, line: Number.isInteger(item.lineNo) && item.lineNo > 0 ? item.lineNo : null, count: 1 });
  }
  return [...groups.values()].sort((a,b) => a.severity.localeCompare(b.severity) || a.theme.localeCompare(b.theme) || a.field.localeCompare(b.field));
}
function normalizeGarrett(result) {
  const issues = result.issues;
  const errors = issues.filter(x => String(x.sev).toLowerCase() === 'error').length;
  const warnings = issues.filter(x => String(x.sev).toLowerCase() === 'warning').length;
  return { status: errors ? 'FAIL' : warnings ? 'WARNINGS' : 'PASS', errors, warnings, groups: groupGarrettIssues(issues) };
}
function normalizeWizard(run) {
  if (!run || typeof run.overallStatus !== 'string' || !Array.isArray(run.results)) throw new Error('Wizard returned an unexpected result.');
  const findings = run.results.filter(x => x.outcome === 'ERROR' || x.outcome === 'WARNING').map(x => ({
    ruleId: x.ruleId, severity: x.outcome, theme: wizardTheme(x.ruleId), field: x.field,
    location: x.locator ?? '',
  }));
  return { status: run.overallStatus, errors: run.errorCount, warnings: run.warningCount,
    groups: findings, notEvaluated: (run.checks ?? []).filter(x => x.state === 'not-evaluated').length,
    profileId: run.provenance?.profileId ?? run.formatId ?? '', rulesetRevision: run.provenance?.rulesetRevision ?? '' };
}

/** Vite SSR loads the real TypeScript validator; it does not start an HTTP listener. */
export async function createWizardRunner(profile = DEFAULT_PROFILE) {
  const { createServer } = await import('vite');
  const vite = await createServer({ root: ROOT, configFile: false, appType: 'custom',
    logLevel: 'error', server: { middlewareMode: true, hmr: false } });
  try {
    const [{ validateSource }, { findEnabledFormatPack }] = await Promise.all([
      vite.ssrLoadModule('/src/validation.ts'), vite.ssrLoadModule('/src/format-packs.ts'),
    ]);
    const pack = findEnabledFormatPack(profile);
    if (!pack || pack.parserKind !== 'NACHA_FIXED') throw new Error(`Unknown or non-origination NACHA profile: ${profile}`);
    return { run: (name, contents) => normalizeWizard(validateSource(name, contents, pack)),
      close: () => vite.close() };
  } catch (e) { await vite.close(); throw e; }
}

export function observedSecCodes(source) {
  const normalized = source.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').replace(/\n+$/g, '');
  const rows = !normalized.includes('\n') && normalized.length % 94 === 0
    ? normalized.match(/.{94}/g) ?? [] : normalized.split('\n');
  return [...new Set(rows.filter(x => x.length === 94 && x.startsWith('5'))
    .map(x => x.slice(50, 53)).filter(x => /^[A-Z0-9]{3}$/.test(x)))].sort();
}

export function compareVerdicts(legacy, wizard) {
  if (!legacy || !wizard) return 'RUN ERROR';
  if (wizard.status === 'UNSUPPORTED') return 'WIZARD UNSUPPORTED';
  if (wizard.status === 'INCOMPLETE') return 'WIZARD INCOMPLETE';
  const legacyStatus = legacy.status;
  const wizardStatus = wizard.status === 'PASS_WITH_WARNINGS' ? 'WARNINGS' : wizard.status;
  return legacyStatus === wizardStatus ? 'SAME VERDICT' : 'DIFFERENT VERDICT';
}

export async function discoverNachaFiles(inputDir, { recursive = true, allFiles = false, excluded = [], maxFiles = DEFAULT_MAX_FILES } = {}) {
  const dir = resolve(inputDir);
  if (!(await stat(dir)).isDirectory()) throw new Error('The input path must be a directory.');
  const exclude = new Set(excluded.map(x => resolve(x)));
  const found = [];
  async function walk(folder) {
    const entries = (await readdir(folder, { withFileTypes: true })).sort((a,b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0);
    for (const entry of entries) {
      if (entry.isSymbolicLink()) continue; // Never follow links out of the selected input tree.
      const full = join(folder, entry.name);
      if (entry.isDirectory()) { if (recursive) await walk(full); continue; }
      if (!entry.isFile() || exclude.has(resolve(full))) continue;
      if (!allFiles && !FILE_EXTENSIONS.has(extname(entry.name).toLowerCase())) continue;
      found.push(full);
      if (found.length > maxFiles) throw new Error(`More than ${maxFiles} input files found; raise --max-files explicitly.`);
    }
  }
  await walk(dir);
  return found;
}

function readError(error) {
  if (error instanceof Error && error.name === 'TimeoutError') return 'validator timeout';
  if (error instanceof Error && /Script execution timed out/i.test(error.message)) return 'validator timeout';
  if (error instanceof TypeError) return 'invalid UTF-8 or unexpected input type';
  return String(error?.code ?? error?.name ?? 'validation error').slice(0, 80);
}

export async function runBatch({ input, garrett, report = 'nacha-differential-report.md', json,
  profile = DEFAULT_PROFILE, recursive = true, allFiles = false, maxFiles = DEFAULT_MAX_FILES,
  maxBytes = DEFAULT_MAX_BYTES, expectedGarrettSha256, timeOutMs = 2000,
}, { wizardFactory = createWizardRunner, legacyFactory = createGarrettRunner } = {}) {
  if (!input || !garrett) throw new Error('--input and --garrett are required.');
  const legacyBytes = await readFile(resolve(garrett));
  const legacySha256 = sha256(legacyBytes);
  if (expectedGarrettSha256 && expectedGarrettSha256.toLowerCase() !== legacySha256)
    throw new Error('The Garrett source checksum does not match --expected-garrett-sha256.');
  const legacyRun = legacyFactory(legacyBytes.toString('utf8'), { timeoutMs: timeOutMs });
  const files = await discoverNachaFiles(input, { recursive, allFiles, maxFiles, excluded: [report, json].filter(Boolean) });
  if (!files.length) throw new Error('No matching NACHA files found. Extensions: .ach, .nacha, .txt, .dat (or use --all-files).');
  const wizard = await wizardFactory(profile);
  const results = [];
  try {
    for (const path of files) {
      const item = { file: relative(resolve(input), path).split('\\').join('/'), bytes: 0, sha256: null,
        secCodes: [], legacy: null, wizard: null, errors: [] };
      try {
        const bytes = await readFile(path);
        item.bytes = bytes.length;
        item.sha256 = sha256(bytes);
        if (bytes.length > maxBytes) throw Object.assign(new Error('File exceeds the configured per-file size limit'), { code: 'FILE_TOO_LARGE' });
        const source = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
        item.secCodes = observedSecCodes(source);
        try { item.legacy = legacyRun(source); } catch (e) { item.errors.push(`Garrett: ${readError(e)}`); }
        try { item.wizard = await wizard.run(item.file, source); } catch (e) { item.errors.push(`Wizard: ${readError(e)}`); }
      } catch (e) { item.errors.push(`File: ${readError(e)}`); }
      item.comparison = compareVerdicts(item.legacy, item.wizard);
      results.push(item);
    }
  } finally { await wizard.close(); }
  const batch = { generatedAt: reportDate(), inputLabel: basename(resolve(input)), profile,
    legacySha256, files: results };
  await mkdir(dirname(resolve(report)), { recursive: true });
  await writeFile(resolve(report), renderMarkdown(batch), { encoding: 'utf8', mode: 0o600 });
  if (json) { await mkdir(dirname(resolve(json)), { recursive: true }); await writeFile(resolve(json), JSON.stringify(batch,null,2)+'\n', { encoding: 'utf8', mode: 0o600 }); }
  return batch;
}

function val(thing) { return thing === null || thing === undefined ? '—' : safeString(thing); }
function score(validator) { return validator ? `${safeString(validator.status)} (${validator.errors}E/${validator.warnings}W)` : 'NOT RUN'; }
function themes(groups) { return new Set((groups ?? []).map(x => x.theme)); }
function cell(x) { return safeString(x); }
function issueTable(groups, kind) {
  if (!groups?.length) return '_No reported errors or warnings._\n';
  const ordered = [...groups].sort((a,b) => a.severity.localeCompare(b.severity) || a.theme.localeCompare(b.theme) || String(a.field).localeCompare(String(b.field)));
  const rows = ordered.slice(0, REPORT_MAX_ROWS).map(x => kind === 'Garrett'
    ? `| ${cell(x.severity)} | ${cell(x.theme)} | ${cell(x.field)} | ${x.line ?? '—'} | ${x.count} |`
    : `| ${cell(x.severity)} | ${cell(x.theme)} | \`${cell(x.ruleId)}\` | ${cell(x.location)} | — |`);
  return `| Severity | Theme | ${kind === 'Garrett' ? 'Field' : 'Rule ID'} | ${kind === 'Garrett' ? 'First record' : 'Location'} | ${kind === 'Garrett' ? 'Occurrences' : '—'} |\n|---|---|---|---|---:|\n${rows.join('\n')}\n${ordered.length > REPORT_MAX_ROWS ? `\n_${ordered.length - REPORT_MAX_ROWS} additional finding groups omitted from Markdown; use --json for all normalized groups._\n` : ''}`;
}

export function renderMarkdown(batch) {
  const counts = new Map();
  for (const f of batch.files) counts.set(f.comparison, (counts.get(f.comparison) ?? 0) + 1);
  const lines = [
    '# NACHA differential validation report', '',
    `Generated: ${batch.generatedAt}`, '',
    `- **Input directory:** \`${cell(batch.inputLabel)}\` (${batch.files.length} files)`,
    `- **Wizard profile:** \`${cell(batch.profile)}\``,
    `- **Garrett source SHA-256:** \`${cell(batch.legacySha256)}\``,
    '- **Privacy:** Local-only execution. Reports omit raw NACHA records, account numbers, original payment values and unredacted diagnostic messages.',
    '- **Interpretation:** SAME VERDICT means only that headline outcomes agree; it does **not** establish complete validation parity or correctness. Garrett counts issue occurrences, while Wizard counts failed rules.',
    '', '## Summary', '',
    '| Comparison | Files |', '|---|---:|',
    ...['SAME VERDICT','DIFFERENT VERDICT','WIZARD UNSUPPORTED','WIZARD INCOMPLETE','RUN ERROR'].map(k => `| ${k} | ${counts.get(k) ?? 0} |`),
    '', '## File results', '',
    '| File | Observed SEC | Garrett | Wizard | Comparison |',
    '|---|---|---|---|---|',
    ...batch.files.map(f=>`| \`${cell(f.file)}\` | ${f.secCodes.join(', ') || '—'} | ${score(f.legacy)} | ${score(f.wizard)} | ${f.comparison} |`),
    '', '## Detailed findings', '',
  ];
  for (const f of batch.files) {
    lines.push(`### \`${cell(f.file)}\``, '',
      `**Comparison:** ${f.comparison} · **Size:** ${f.bytes} bytes · **SHA-256:** \`${f.sha256?.slice(0,16) ?? 'not computed'}…\` · **Observed SEC:** ${f.secCodes.join(', ') || 'none detected'}`, '');
    if (f.errors.length) lines.push(`**Processing problems:** ${f.errors.map(cell).join('; ')}. No validity verdict was inferred for the failed runner.`, '');
    if (f.wizard?.notEvaluated) lines.push(`**Wizard checks not evaluated:** ${f.wizard.notEvaluated}; review profile coverage before interpreting its verdict.`, '');
    if (f.legacy && f.wizard) {
      const left = themes(f.legacy.groups); const right = themes(f.wizard.groups);
      const onlyLegacy = [...left].filter(x => !right.has(x)).sort();
      const onlyWizard = [...right].filter(x => !left.has(x)).sort();
      lines.push(`**Finding-theme differences (heuristic, not rule-level equivalence):** Garrett-only: ${onlyLegacy.join(', ') || 'none'}; Wizard-only: ${onlyWizard.join(', ') || 'none'}.`, '');
    }
    lines.push(`**Garrett — ${score(f.legacy)}**`, '', f.legacy ? issueTable(f.legacy.groups, 'Garrett') : '_Not completed._', '',
      `**Wizard — ${score(f.wizard)}**`, '', f.wizard ? issueTable(f.wizard.groups, 'Wizard') : '_Not completed._', '');
  }
  lines.push('## Notes', '',
    '- The original Garrett implementation is a comparison baseline, **not** a normative ACH rules oracle.',
    '- SEC tokens are extracted from apparent batch headers for navigation; they are not independently validated.',
    '- A Wizard UNSUPPORTED result is a coverage gap, not a failed compliance check. Validity and bank acceptance cannot be inferred from either validator.',
    '- Input files are processed sequentially. The report contains no raw NACHA data. Use synthetic data only when sharing reports externally.', '');
  return lines.join('\n');
}

export function parseArguments(argv) {
  const opts = {};
  const args = [...argv];
  const take = (flag) => { if (!args.length || args[0].startsWith('--')) throw new Error(`Missing value for ${flag}`); return args.shift(); };
  while (args.length) {
    const flag = args.shift();
    if (flag === '--help' || flag === '-h') return { help: true };
    if (flag === '--input' || flag === '-i') opts.input = take(flag);
    else if (flag === '--garrett' || flag === '-g') opts.garrett = take(flag);
    else if (flag === '--report' || flag === '--out' || flag === '-o') opts.report = take(flag);
    else if (flag === '--json') opts.json = take(flag);
    else if (flag === '--profile') opts.profile = take(flag);
    else if (flag === '--expected-garrett-sha256') opts.expectedGarrettSha256 = take(flag);
    else if (flag === '--max-files') opts.maxFiles = Number(take(flag));
    else if (flag === '--max-mb') opts.maxBytes = Math.floor(Number(take(flag)) * 1_000_000);
    else if (flag === '--timeout-ms') opts.timeOutMs = Number(take(flag));
    else if (flag === '--no-recursive') opts.recursive = false;
    else if (flag === '--all-files') opts.allFiles = true;
    else if (flag === '--strict') opts.strict = true;
    else if (!flag.startsWith('-') && !opts.input) opts.input = flag;
    else throw new Error(`Unknown argument: ${flag}`);
  }
  for (const [key,min,max] of [['maxFiles',1,20000],['maxBytes',1,250_000_000],['timeOutMs',10,120000]]) {
    if (opts[key] !== undefined && (!Number.isInteger(opts[key]) || opts[key] < min || opts[key] > max)) throw new Error(`Invalid ${key} limit.`);
  }
  if (opts.expectedGarrettSha256 && !/^[0-9a-f]{64}$/i.test(opts.expectedGarrettSha256)) throw new Error('Expected SHA-256 must be 64 hexadecimal characters.');
  return opts;
}

const USAGE = `NACHA differential batch runner (local only)

Usage:
  npm run compare:nacha -- --input ./my-ach-files --garrett '/path/Garretts NACHA Validator ORIGINAL.html' --report ./reports/nacha.md

Options:
  --input/-i DIR                 Directory of ACH files (or positional DIR)
  --garrett/-g HTML             Original Garrett HTML validator (required)
  --report/-o FILE              Markdown destination (default: nacha-differential-report.md)
  --json FILE                   Optional normalized findings JSON (no raw NACHA content)
  --profile ID                  Wizard NACHA profile (default: R2)
  --max-files N                 Input file cap (default: 250)
  --max-mb N                    Per-file size limit in decimal MB (default: 25)
  --timeout-ms N                Garrett VM time budget per file (default: 2000)
  --expected-garrett-sha256 H   Require a specific original HTML checksum
  --no-recursive                Only inspect top-level directory
  --all-files                   Include files with other extensions
  --strict                      Exit 2 for discrepancies, unsupported files or execution errors
  --help                        Show usage
`;

async function main() {
  try {
    const opts = parseArguments(process.argv.slice(2));
    if (opts.help) { process.stdout.write(USAGE); return; }
    const batch = await runBatch(opts);
    const counts = {};
    for (const item of batch.files) counts[item.comparison] = (counts[item.comparison] ?? 0) + 1;
    console.log(`Analyzed ${batch.files.length} files; report: ${resolve(opts.report ?? 'nacha-differential-report.md')}`);
    console.log(Object.entries(counts).map(([name,n]) => `${name}: ${n}`).join('; '));
    if (opts.strict && batch.files.some(f => f.comparison !== 'SAME VERDICT')) process.exitCode = 2;
    else if (batch.files.some(f => f.comparison === 'RUN ERROR')) process.exitCode = 1;
  } catch (e) {
    console.error(`NACHA comparison could not start: ${readError(e)}.`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
