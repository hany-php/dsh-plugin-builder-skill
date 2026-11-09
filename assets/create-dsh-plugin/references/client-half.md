# Client half reference

The browser half is a plain script artifact loaded by the Web shell's module loader. It is **not** an ES module, has no JSX transform, and must not import Harness Client packages.

## Loader artifact

```js
window.__ModuleLoader__.load({
  id: 'my-plugin',                 // MUST equal the package name in package.json
  factory(require) {
    const React = require('react');   // from the static module table
    const h = React.createElement;    // no JSX in a plain-JS plugin

    function MyControl(props) { ... }

    return {
      inject: ['slots', 'locale'],   // services requested from the Cordis client context
      apply(ctx) {
        // registrations only; return cleanups through ctx.effect/slots.inject
      },
    };
  },
});
```

- `id` is how the loader binds the artifact to the Host row; a mismatch means the module never runs.
- `factory(require)` may `require('react')` and `require('react/jsx-runtime')` (both in the module table). Do **not** require `@deepseek-ai/dsh-client-ui-*` — see the skill's non-negotiables.
- The returned object is the Cordis plugin: `inject` lists client services (`slots`, `locale`, `layout`, `sessions`, `uiWorkspace`, `workspaces`, `theme`, `shortcuts`, ...). Inspect exact names with client `Service.listService`.
- `dsh.client` in `package.json` declares the artifact (`platform: "web"`, `immediately: true`); `dsh.client.inject` entries only order load of other client packages.

## Slots

```js
ctx.slots.inject('sidebar.footer.action', () =>
  ctx.slots.register(
    {
      name: 'sidebar.footer.action',
      id: 'my-control',        // fresh id = a new entry beside shipped ones
      order: 0,                // ascending position
      label: () => t('label'), // optional projection text; a thunk is re-read live
      locale: 'myPlugin',      // optional: supplies the reactive `t` seat
    },
    MyControl,
  ),
);
```

- `ctx.slots.inject(ownerKey, callback)` re-runs `callback` whenever the owner slot declaration returns; the registrations are disposed with the declaration. Never register a slot entry outside it.
- Registration options depend on the owner; `Slots.listSubTree` `root: "<slot>"` returns the accepted `registration` fields plus `ownerProps` (props the owner passes) and `standardProps` (data/hook seats available to every entry).
- For a `single` slot your entry replaces the occupant (`replaceRisk: shadows-shipped-ui`); for a `list` slot a fresh `id` adds an entry. Prefer `list` seats.
- Keep component factories side-effect free; do real work in `apply` and in effects.

## Theming and styles

- Color only through `--dsw-alias-*` theme tokens (`Theme.listTokens` lists the current set). Literal colors are for artwork only.
- Two accepted style mechanisms:
  - a global `<style>` tag created in `apply` and removed by its `ctx.effect` cleanup (needed when a rule must exist before the component mounts, or must affect shipped UI);
  - component-local CSS rendered as a React element (the tag disappears with the component).
- Match host geometry: sidebar foot rows are ~28–36px high with a 16px glyph and 13px label; the collapsed sidebar is a 56px rail (`wide: false`), so render icon-only there.
- No `document.body` appends, no iframes, no replacing the app root.

## Complete worked example — sidebar foot toggle

This is the shape that shipped and was verified live in this profile. It adds a button at the sidebar foot that hides a shipped list group by flipping a document-root attribute; the CSS rule is inert when the shipped marker changes.

```js
window.__ModuleLoader__.load({
  id: 'dsh-workspace-visibility-toggle',
  factory(require) {
    const React = require('react');
    const h = React.createElement;
    const NS = 'workspaceVisibility';
    const STORAGE_KEY = 'dsh.workspaceVisibility.hidden';
    const ROOT_FLAG = 'data-dsh-hide-ungrouped';
    const STYLE_ID = 'dsh-workspace-visibility-toggle-css';
    const ROW_CLASS = 'dsh-workspace-visibility-toggle';

    const EN = { label: 'Ungrouped', hide: 'Hide ungrouped workspaces', show: 'Show ungrouped workspaces' };

    // Scoped: gated by the root attribute; the :has() marker comes from the
    // shipped Workspace browser (data-row-key="workspace:" is its ungrouped row).
    const CSS = [
      `html[${ROOT_FLAG}="on"] [class*="_groupSection"]:has([data-row-key="workspace:"]) {`,
      '  display: none !important;',
      '}',
      `.${ROW_CLASS} { display: flex; align-items: center; gap: 8px; width: 100%; height: 32px;`,
      '  box-sizing: border-box; margin: 0; padding: 0 8px; border: none; border-radius: 6px;',
      '  background: none; color: var(--dsw-alias-label-secondary); font: inherit; font-size: 13px;',
      '  line-height: 18px; text-align: start; cursor: pointer; flex: none; }',
      `.${ROW_CLASS}:hover, .${ROW_CLASS}[aria-pressed="true"] { color: var(--dsw-alias-label-primary); }`,
      `.${ROW_CLASS}:focus-visible { outline: 2px solid var(--dsw-alias-brand-primary); outline-offset: -2px; }`,
      `.${ROW_CLASS}[data-rail="true"] { width: 36px; height: 36px; padding: 0; justify-content: center; }`,
      `.${ROW_CLASS} .dsh-wsvt-label { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }`,
    ].join('\n');

    function ensureStyle() {
      const existing = document.getElementById(STYLE_ID);
      if (existing !== null) return () => existing.remove();
      const tag = document.createElement('style');
      tag.id = STYLE_ID;
      tag.textContent = CSS;
      document.head.appendChild(tag);
      return () => tag.remove();
    }
    function readHidden() {
      try { return window.localStorage.getItem(STORAGE_KEY) === '1'; } catch { return false; }
    }
    function writeHidden(hidden) {
      try { window.localStorage.setItem(STORAGE_KEY, hidden ? '1' : '0'); } catch { /* session-only */ }
    }
    function applyHidden(hidden) {
      const root = document.documentElement;
      if (hidden) root.setAttribute(ROOT_FLAG, 'on');
      else root.removeAttribute(ROOT_FLAG);
    }

    function Glyph({ off }) {
      return h('svg', { viewBox: '0 0 16 16', width: 16, height: 16, fill: 'none',
        stroke: 'currentColor', strokeWidth: 1.4, strokeLinecap: 'round',
        strokeLinejoin: 'round', 'aria-hidden': true, focusable: 'false' },
        h('path', { d: 'M1.4 8S3.9 3.9 8 3.9 14.6 8 14.6 8 12.1 12.1 8 12.1 1.4 8 1.4 8Z' }),
        h('circle', { cx: 8, cy: 8, r: 1.9 }));
    }

    function WorkspaceVisibilityToggle(props) {
      const wide = props?.wide !== false;
      const t = typeof props?.t === 'function' ? props.t : (key) => EN[key] ?? key;
      const [hidden, setHidden] = React.useState(readHidden);
      React.useEffect(() => { applyHidden(hidden); writeHidden(hidden); }, [hidden]);
      const label = hidden ? t('show') : t('hide');
      return h('button', {
        type: 'button',
        className: ROW_CLASS,
        'data-rail': wide ? 'false' : 'true',
        'aria-pressed': hidden,
        'aria-label': label,
        title: label,
        onClick: () => setHidden((current) => !current),
      },
        h('span', { className: 'dsh-wsvt-glyph' }, h(Glyph, { off: hidden })),
        wide ? h('span', { className: 'dsh-wsvt-label' }, t('label')) : null,
      );
    }

    return {
      inject: ['slots', 'locale'],
      apply(ctx) {
        ctx.effect(() => ctx.locale.register(NS, 'en', EN), 'toggle: English dictionary');
        ctx.effect(() => ensureStyle(), 'toggle: stylesheet');
        ctx.effect(() => {
          applyHidden(readHidden());            // restore before first render
          return () => applyHidden(false);      // exact cleanup
        }, 'toggle: saved state');
        ctx.slots.inject('sidebar.footer.action', () =>
          ctx.slots.register({ name: 'sidebar.footer.action', id: 'workspace-visibility-toggle',
            order: 0, locale: NS }, WorkspaceVisibilityToggle));
      },
    };
  },
});
```

Why it is shaped this way:

- The control lives in a real slot; it never appends its own floating UI.
- The shipped-list effect is one document-root attribute plus one scoped rule. If a future build changes `_groupSection` or `data-row-key`, the rule simply stops matching: the button remains, nothing breaks.
- The attribute is restored/cleared in an effect, the preference is browser-local (the sidebar list's own view state is browser-local too), and storage failures degrade to a session-only toggle.
- `wide` drives the rail layout; the locale dictionary plus the `locale` registration supply translated text that follows a language switch.

## Offline smoke test

No browser control? Run the artifact under mocks:

```
node <skill-base>/scripts/smoke-client.cjs <plugin-dir>/client.js
```

It stubs `window`, `document`, `localStorage`, and React hooks, runs the factory and `apply`, prints the slot registration, and renders the component once per state. It cannot verify the pixels or the shipped CSS rule — say so in the report instead of claiming visual success.
