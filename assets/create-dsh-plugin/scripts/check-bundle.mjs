#!/usr/bin/env node
/**
 * Static lint for a DeepSeek Harness plugin bundle.
 *
 * Usage: node check-bundle.mjs <plugin-dir>
 *
 * It is a fast pre-flight, not the authority: `plugin_manager install_bundle`
 * remains the real validator. The checks mirror the failures that actually
 * leave a plugin installed but inert.
 */
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, resolve, basename } from 'node:path';

const target = resolve(process.argv[2] ?? '.');
const fails = [];
const warns = [];
const oks = [];
const fail = (message) => fails.push(message);
const warn = (message) => warns.push(message);
const ok = (message) => oks.push(message);

const readJson = (file) => {
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch (error) {
    fail(`cannot parse ${basename(file)}: ${String(error.message ?? error)}`);
    return undefined;
  }
};

// --- manifest ---------------------------------------------------------------
const manifestPath = join(target, 'package.json');
if (!existsSync(manifestPath)) {
  fail(`package.json missing in ${target}`);
  report();
}
const manifest = readJson(manifestPath) ?? {};

if (typeof manifest.name !== 'string' || manifest.name.length === 0) fail('package.json: name must be a non-empty string');
if (manifest.type !== 'module') fail('package.json: type must be "module" (Host module is ESM)');

const exportsMap = manifest.exports ?? {};
const hasExport = (key) => exportsMap[key] !== undefined;
if (!hasExport('.')) fail('package.json: exports["."] is required (Host module entry)');
if (!hasExport('./package.json')) warn('package.json: export "./package.json" so Plugin Manager can read name/description fallback');
if (!hasExport('./locale/*.json')) warn('package.json: export "./locale/*.json" or plugin display metadata is not read');
if (!hasExport('./icon')) warn('package.json: export "./icon" (or declare top-level "icon") or the generic artwork is shown');

// --- bundle patch -----------------------------------------------------------
const bundle = manifest.dsh?.bundle;
if (bundle === undefined) {
  fail('package.json: dsh.bundle is missing — the package is not a bundle');
} else {
  const declared = typeof bundle.patch === 'string' ? [bundle.patch] : bundle.patch;
  if (!Array.isArray(declared) || declared.every((entry) => typeof entry === 'string') === false) {
    fail('package.json: dsh.bundle.patch must be a file path or a list of file paths');
  } else {
    for (const relative of declared) {
      const patchPath = join(target, relative);
      if (!existsSync(patchPath)) {
        fail(`patch file missing: ${relative}`);
        continue;
      }
      const text = readFileSync(patchPath, 'utf8');
      if (/^\t/m.test(text)) fail(`${relative}: YAML must not use tab indentation`);
      if (/^\s*-\s*(host|client)\s*:/m.test(text)) {
        fail(`${relative}: contains a host:/client: map — the patch is a loader patch list, not a manifest`);
      }
      if (!/^\s*-\s*insert\s*:/m.test(text) && !/^\s*-\s*id\s*:/m.test(text)) {
        warn(`${relative}: no "insert:" or id-targeted rows found; the patch contributes nothing`);
      }
      const firstContent = text.split(/\r?\n/).find((line) => line.trim() !== '' && !line.trim().startsWith('#'));
      if (!firstContent?.trim().startsWith('-')) fail(`${relative}: must be a top-level YAML array of patch entries`);
      ok(`${relative}: patch shape plausible`);
    }
  }
}

// --- client artifact --------------------------------------------------------
const clientFile = typeof exportsMap['./client'] === 'string' ? exportsMap['./client'] : undefined;
const clientDeclared = manifest.dsh?.client !== undefined;
const clientPath = join(target, clientFile ?? 'client.js');
if (clientDeclared && clientFile === undefined) fail('package.json: dsh.client is set but exports["./client"] is missing');
if (clientFile !== undefined && !existsSync(clientPath)) fail(`client artifact missing: ${clientFile}`);
if (clientFile === undefined && existsSync(clientPath)) warn('client.js exists but exports["./client"] and dsh.client are missing — the browser half is never loaded');

if (existsSync(clientPath)) {
  const client = readFileSync(clientPath, 'utf8');
  if (!client.includes('window.__ModuleLoader__.load(')) fail('client.js: must call window.__ModuleLoader__.load({ id, factory })');
  if (/^\s*import\s/m.test(client)) fail('client.js: no ESM import statements (the artifact is a plain script)');
  if (/from\s+['"]@deepseek-ai\//.test(client) || /require\(\s*['"]@deepseek-ai\//.test(client)) {
    fail('client.js: must not load Harness Client packages (`@deepseek-ai/...`); write your own control');
  }
  if (!/['"]react['"]/.test(client)) warn('client.js: no require("react") found — the artifact may not be a loader factory');
  if (typeof manifest.name === 'string') {
    const idPattern = new RegExp(`id:\\s*['"\`]${manifest.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"\`]`);
    if (!idPattern.test(client)) fail(`client.js: loader id must equal the package name "${manifest.name}"`);
    else ok('client.js: loader id matches the package name');
  }
  ok('client.js: loader artifact present');
}

// --- display metadata -------------------------------------------------------
const localeDir = join(target, 'locale');
const enPath = join(localeDir, 'en.json');
if (!existsSync(enPath)) {
  warn('locale/en.json missing: Plugin Manager falls back to package name/description and the generic artwork');
} else {
  const en = readJson(enPath) ?? {};
  const title = en.meta?.title;
  const description = en.meta?.description;
  if (typeof title !== 'string' || title.trim() === '') fail('locale/en.json: meta.title must be a non-empty string');
  if (typeof description !== 'string' || description.trim() === '') fail('locale/en.json: meta.description must be a non-empty string');
  if (existsSync(localeDir)) {
    for (const entry of readdirSync(localeDir, { withFileTypes: true })) {
      if (!entry.isFile() || !entry.name.endsWith('.json')) continue;
      const language = entry.name.slice(0, -'.json'.length);
      if (!/^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$/.test(language)) warn(`locale/${entry.name}: filename should be a language id`);
      readJson(join(localeDir, entry.name));
    }
    ok('locale: dictionaries present');
  }
}

// --- icon -------------------------------------------------------------------
const iconExport = typeof exportsMap['./icon'] === 'string' ? exportsMap['./icon'] : undefined;
const iconPath = manifest.icon !== undefined ? join(target, manifest.icon) : iconExport !== undefined ? join(target, iconExport) : undefined;
if (iconPath === undefined) {
  warn('no icon declared (exports["./icon"] or package.json "icon"): generic artwork will be used');
} else if (!existsSync(iconPath)) {
  fail(`icon missing: ${iconPath.slice(target.length + 1)}`);
} else {
  const bytes = readFileSync(iconPath);
  if (bytes.length > 256 * 1024) fail('icon exceeds 256 KiB');
  const head = bytes.subarray(0, 64).toString('latin1');
  const svg = /^\s*<(\?xml[^>]*>\s*)?<!--[\s\S]*-->\s*<svg|^\s*<svg/i.test(head);
  const png = bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
  const jpeg = bytes[0] === 0xff && bytes[1] === 0xd8;
  const webp = bytes.subarray(0, 4).toString('latin1') === 'RIFF' && bytes.subarray(8, 12).toString('latin1') === 'WEBP';
  if (!svg && !png && !jpeg && !webp) fail('icon is not SVG/PNG/JPEG/WebP');
  else ok(`icon: ${thumbnail(iconPath)}`);
}

// --- runtime syntax ---------------------------------------------------------
const runtimeFiles = [];
const collect = (directory) => {
  if (!existsSync(directory)) return;
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const full = join(directory, entry.name);
    if (entry.isDirectory()) collect(full);
    else if (entry.isFile() && entry.name.endsWith('.js')) runtimeFiles.push(full);
  }
};
collect(target);
for (const file of runtimeFiles) {
  const result = spawnSync(process.execPath, ['--check', file], { stdio: 'ignore' });
  if (result.status !== 0) fail(`syntax error: ${file.slice(target.length + 1)}`);
}
if (runtimeFiles.length > 0) ok(`syntax: ${runtimeFiles.length} JavaScript file(s) parsed`);

// --- files list -------------------------------------------------------------
if (Array.isArray(manifest.files)) {
  for (const required of ['index.js', 'cordis.patch.yml']) {
    if (!manifest.files.some((pattern) => String(pattern).startsWith(required.replace(/\.(js|yml)$/, '')))) {
      warn(`files[]: does not appear to include ${required}`);
    }
  }
}

report();
function thumbnail(file) { return `${basename(file)} (${statSync(file).size} bytes)`; }
function report() {
  for (const line of oks) console.log(`ok    ${line}`);
  for (const line of warns) console.log(`warn  ${line}`);
  for (const line of fails) console.log(`FAIL  ${line}`);
  console.log(`\n${fails.length === 0 ? 'PASS' : 'FAILED'}: ${fails.length} failure(s), ${warns.length} warning(s)`);
  process.exit(fails.length === 0 ? 0 : 1);
}
