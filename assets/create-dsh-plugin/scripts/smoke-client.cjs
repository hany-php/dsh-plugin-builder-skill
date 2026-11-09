#!/usr/bin/env node
/**
 * Offline smoke test for a DSH client half.
 *
 * Usage: node smoke-client.cjs <client.js | plugin-dir>
 *
 * Loads the browser artifact with mocked window/document/localStorage/React,
 * runs the loader factory and plugin apply(), then renders every registered slot
 * component once per owner-prop/state variant. It proves wiring and
 * crash-freedom — never pixels or shipped-UI effects. Report those limits.
 */
const fs = require('node:fs');
const path = require('node:path');

const input = process.argv[2];
if (input === undefined) {
  console.error('usage: node smoke-client.cjs <client.js | plugin-dir>');
  process.exit(2);
}

let file = path.resolve(input);
let packageDir = path.dirname(file);
if (fs.statSync(file).isDirectory()) {
  packageDir = file;
  file = path.join(packageDir, 'client.js');
}
if (!fs.existsSync(file)) {
  console.error(`client artifact not found: ${file}`);
  process.exit(2);
}

let packageName;
try {
  packageName = JSON.parse(fs.readFileSync(path.join(packageDir, 'package.json'), 'utf8')).name;
} catch {
  packageName = undefined;
}

// --- browser mocks ----------------------------------------------------------
const attributes = new Map();
const styles = new Map();
const storage = { value: null };
const cleanups = [];

function makeElement(tagName) {
  const element = {
    tagName: String(tagName).toUpperCase(),
    id: '',
    textContent: '',
    dataset: {},
    style: { setProperty() {}, removeProperty() {} },
    children: [],
    setAttribute(name, value) { this[name] = String(value); },
    removeAttribute(name) { delete this[name]; },
    getAttribute(name) { return this[name]; },
    appendChild(child) { this.children.push(child); return child; },
    remove() {},
    addEventListener() {},
    removeEventListener() {},
    querySelector() { return null; },
    querySelectorAll() { return []; },
  };
  return element;
}

const documentMock = {
  documentElement: {
    attributes,
    setAttribute: (name, value) => attributes.set(name, String(value)),
    removeAttribute: (name) => attributes.delete(name),
    getAttribute: (name) => attributes.get(name) ?? null,
  },
  head: { appendChild: (element) => { if (element.id) styles.set(element.id, element); } },
  body: { appendChild() {} },
  createElement: (tagName) => makeElement(tagName),
  createTextNode: (text) => ({ textContent: text }),
  getElementById: (id) => styles.get(id) ?? null,
  querySelector: () => null,
  querySelectorAll: () => [],
  addEventListener() {},
  removeEventListener() {},
};

let definition;
const windowMock = {
  __ModuleLoader__: { load: (value) => { definition = value; } },
  localStorage: {
    getItem: () => storage.value,
    setItem: (_key, value) => { storage.value = String(value); },
    removeItem: () => { storage.value = null; },
  },
  innerWidth: 1280,
  innerHeight: 800,
  addEventListener() {},
  removeEventListener() {},
  requestAnimationFrame: (callback) => callback(0),
  setTimeout: globalThis.setTimeout,
  clearTimeout: globalThis.clearTimeout,
};

// --- React mocks ------------------------------------------------------------
const React = {
  createElement: (type, props, ...children) => ({ type, props: props ?? {}, children }),
  Fragment: Symbol('fragment'),
  useState: (initial) => {
    const value = typeof initial === 'function' ? initial() : initial;
    return [value, (next) => { void next; }];
  },
  useReducer: (reducer, initial) => [initial, (action) => { void reducer; void action; }],
  useEffect: (factory) => { const cleanup = factory(); if (typeof cleanup === 'function') cleanups.push(cleanup); },
  useLayoutEffect: (factory) => { const cleanup = factory(); if (typeof cleanup === 'function') cleanups.push(cleanup); },
  useMemo: (factory) => factory(),
  useCallback: (callback) => callback,
  useRef: (value) => ({ current: value }),
  useContext: () => undefined,
  createContext: () => ({ Provider: () => null, Consumer: () => null }),
  useSyncExternalStore: (_subscribe, getSnapshot) => getSnapshot(),
};
const runtime = {
  createElement: React.createElement,
  Fragment: React.Fragment,
  jsx: React.createElement,
  jsxs: React.createElement,
};

const requireMock = (id) => {
  if (id === 'react') return React;
  if (id === 'react/jsx-runtime') return runtime;
  throw new Error(`client artifact required an unavailable module: ${id}`);
};

// --- load -------------------------------------------------------------------
const report = { file, packageName, fatal: null, inject: null, registrations: [], effects: 0, renders: [], cleanupErrors: [] };
try {
  const source = fs.readFileSync(file, 'utf8');
  const run = new Function('window', 'document', 'require', source);
  run(windowMock, documentMock, requireMock);
} catch (error) {
  report.fatal = `loading the artifact threw: ${String(error && error.stack ? error.stack.split('\n')[0] : error)}`;
  finish();
}

if (definition === undefined) {
  report.fatal = 'artifact never called window.__ModuleLoader__.load({...})';
  finish();
}
report.loaderId = definition.id;
report.loaderIdMatchesPackage = packageName === undefined || definition.id === packageName;
if (typeof definition.factory !== 'function') {
  report.fatal = 'loader definition has no factory(require)';
  finish();
}

let plugin;
try {
  plugin = definition.factory(requireMock);
} catch (error) {
  report.fatal = `factory threw: ${String(error && error.message ? error.message : error)}`;
  finish();
}
report.inject = plugin && plugin.inject;
if (plugin === undefined || typeof plugin.apply !== 'function') {
  report.fatal = 'factory did not return { inject, apply(ctx) }';
  finish();
}

const ctx = {
  inject: (names, callback) => { void names; if (typeof callback === 'function') callback(); },
  effect: (factory) => { report.effects += 1; const cleanup = factory(); if (typeof cleanup === 'function') cleanups.push(cleanup); },
  on: () => () => {},
  get: () => undefined,
  logger: { warn() {}, info() {}, error() {} },
  locale: {
    bind: (namespace) => (key) => `t:${namespace}.${key}`,
    register: () => () => {},
    addLanguage: () => () => {},
    getLocale: () => ({ active: 'en', locales: ['en'] }),
    getSnapshot: () => ({ active: 'en', locales: ['en'], revision: 1 }),
    subscribe: () => () => {},
  },
  slots: {
    inject: (key, callback) => {
      report.registrations.push({ kind: 'inject', key });
      callback();
      return () => {};
    },
    register: (options, component) => {
      report.registrations.push({ kind: 'register', name: options && options.name, id: options && options.id, order: options && options.order, component });
      return () => {};
    },
  },
};

try {
  plugin.apply(ctx);
} catch (error) {
  report.fatal = `apply(ctx) threw: ${String(error && error.stack ? error.stack.split('\n')[0] : error)}`;
  finish();
}

// --- render -----------------------------------------------------------------
const textOf = (node) => {
  if (node === null || node === undefined || node === false) return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(textOf).join('');
  if (typeof node === 'object') return (node.children ?? []).map(textOf).join('');
  return '';
};
const findButton = (node) => {
  if (node === null || typeof node !== 'object') return undefined;
  if (node.type === 'button') return node;
  for (const child of node.children ?? []) {
    const found = findButton(child);
    if (found !== undefined) return found;
  }
  return undefined;
};

const t = (key) => `t:${key}`;
const registered = report.registrations.filter((entry) => entry.kind === 'register' && typeof entry.component === 'function');
if (registered.length === 0) {
  report.fatal = 'apply() registered no slot component (nothing will ever render)';
  finish();
}

for (const entry of registered) {
  for (const hidden of [false, true]) {
    for (const wide of [true, false]) {
      storage.value = hidden ? '1' : '0';
      attributes.clear();
      const props = { wide, t };
      const result = { component: entry.id ?? entry.name ?? '(anonymous)', hidden, wide };
      try {
        const tree = entry.component(props);
        const button = findButton(tree);
        result.ok = true;
        result.text = textOf(tree).slice(0, 120);
        if (button !== undefined) {
          result.button = {
            text: textOf(button).slice(0, 80),
            ariaPressed: button.props['aria-pressed'],
            title: button.props.title,
            type: button.props.type,
          };
        }
      } catch (error) {
        result.ok = false;
        result.error = String(error && error.message ? error.message : error);
      }
      report.renders.push(result);
    }
  }
}

// --- cleanup ----------------------------------------------------------------
for (const cleanup of cleanups) {
  try {
    cleanup();
  } catch (error) {
    report.cleanupErrors.push(String(error && error.message ? error.message : error));
  }
}
finish();

function finish() {
  const failures = [];
  const warnings = [];
  if (report.fatal !== null) failures.push(report.fatal);
  if (packageName !== undefined && report.loaderIdMatchesPackage === false) failures.push(`loader id "${report.loaderId}" does not match package name "${packageName}"`);
  const failedRenders = report.renders.filter((render) => render.ok !== true);
  if (report.renders.length > 0 && failedRenders.length === report.renders.length) failures.push('every render variant threw');
  else if (failedRenders.length > 0) warnings.push(`${failedRenders.length}/${report.renders.length} render variants threw`);
  if (report.cleanupErrors.length > 0) warnings.push(`${report.cleanupErrors.length} cleanup error(s)`);
  if (report.inject !== undefined && !(report.inject ?? []).includes('slots')) warnings.push('plugin.inject does not list "slots"');

  report.failures = failures;
  report.warnings = warnings;
  report.ok = failures.length === 0;
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.ok ? 0 : 1);
}
