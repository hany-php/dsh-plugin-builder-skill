# Bundle format reference

Exact shapes accepted by the running loader. Verify every claim against inspection before depending on it — the installed Harness is the authority.

## Bundle

A bundle is any package whose `package.json` declares:

```json
"dsh": { "bundle": { "patch": "./cordis.patch.yml" } }
```

`patch` is one path or an ordered list of paths relative to the package. The profile composes: every selected bundle's patch in `dsh.profile.bundles` order, then the profile's own `cordis.patch.yml`, then launcher `--patch` layers.

A package can be a bundle **and** the plugin it inserts (one package, `name` in the row = package name). That is the simplest local shape and the one used by the working examples in this profile.

## Loader patch dialect

Top-level YAML **array** of patch entries:

```yaml
# insert new rows (appended at the end of the entry list)
- insert:
    - id: my-plugin            # unique row id; becomes include:my-plugin
      name: 'my-plugin'        # package name or relative module path beside the patch
      config: {}               # optional; validated by the row's Config

# target an existing row: supplied fields replace its fields
- id: ui-sidebar
  name: '@deepseek-ai/dsh-client-ui-sidebar'   # optional truthy assertion
  config: { ... }              # config is REPLACED wholesale, never deep-merged

# append rows inside an existing group row
- id: some-group
  insert: [...]

# disable / enable an existing row
- id: ui-sidebar
  disabled: true

# group row (nested entry list)
- id: my-group
  name: 'cordis:group'
  group: true
  config:
    - id: child
      name: 'child-plugin'
```

Rules that fail quietly:

- A non-`insert` patch without a non-empty `id`, and a target that matches no row, is **warned about and skipped** — nothing activates.
- Unknown top-level keys (for example `host:` / `client:` maps) are not rows: they insert nothing.
- `!!js` scalars are Loader expressions (`!!js ctx.get('profileContext')`), evaluated against the Loader context when the row activates. They are not `!js`.
- `config` must satisfy the row's `Config`; query `Config.listConfigs` (`name`, then `entry`) for the schema instead of guessing.

## Manifest essentials

```json
{
  "name": "my-plugin",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "index.js",
  "exports": {
    ".": "./index.js",
    "./client": "./client.js",
    "./locale/*.json": "./locale/*.json",
    "./icon": "./icon.svg",
    "./package.json": "./package.json"
  },
  "files": ["index.js", "client.js", "cordis.patch.yml", "locale/*.json", "icon.svg"],
  "dsh": {
    "bundle": { "patch": "./cordis.patch.yml" },
    "client": { "platform": "web", "immediately": true }
  }
}
```

- `exports` is resolved when the Harness reads your display metadata and your client artifact. Missing `./locale/*.json`, `./icon`, `./client`, or `./package.json` entries silently remove that feature.
- `files` matters for packed/published bundles; a linked local directory is read as-is, so keep `files` honest anyway.
- `dsh.client` is only for a browser half. `platform: "web"`, `immediately: true`; optional `inject: ["<other-client-package>"]` orders module load and `external` declares non-baseline runtime imports.

## Display metadata and icon

Read without activating the plugin, so a broken plugin still shows in Plugin Manager:

- `locale/en.json` is **required** as the anchor: `{ "meta": { "title": "...", "description": "..." } }`.
- Every other `locale/<id>.json` in the same directory is a language dictionary; filenames must be language ids (`ar`, `zh`, `pt`, ...). Add the user's language.
- `meta.title`/`meta.description` must be non-empty strings. An empty or non-string value produces a metadata diagnostic and falls back.
- Titles in sentence case (`Git worktrees`, not `Git Worktrees`).
- Icon: export `./icon` (path inside the package) or declare top-level `"icon"` in `package.json`; SVG/PNG/JPEG/WebP, ≤ 256 KiB, no absolute paths, URLs, or symlinks leaving the package. Default artwork is a fallback, not a choice — make an original icon.

## Host half contract

One of:

```js
// apply form
export function apply(ctx, config) {}
export const inject = ['tools']          // optional services
export const Config = z.object({ ... })  // optional schema

// or service class as default export
export default class MyService {}
```

- ESM only (`"type": "module"`). A syntax error leaves the row inactive as a whole.
- Register everything inside `apply` with `ctx.effect(...)`/`ctx.on(...)` and return cleanups; nothing outside `apply`.
- Persist your own configuration with `ctx.get('configEditor').edit(entry, current => ...)`; never rewrite the profile patch by hand.

## Client half contract (short form)

```js
window.__ModuleLoader__.load({
  id: 'my-plugin',                    // MUST equal the package name
  factory(require) {
    const React = require('react');
    // ... build components
    return { inject: ['slots'], apply(ctx) { /* register */ } };
  },
});
```

See [`client-half.md`](client-half.md).

## Install lifecycle

`plugin_manager` `install_bundle` target = absolute package directory:

| Result | Meaning |
|---|---|
| `application: applied` | live in the running profile |
| `error.code: already-installed` | the package is already in the profile; do not reinstall |
| `application: failed` + diagnostic | validation/import failure, nothing saved |
| `restart-required` + `restartReason` | saved but not live (`no-hmr`, `package-moved`, ...); report to the user |

Changing an already-installed **linked** package:

```
set_bundle { target: "my-plugin", enabled: false }   # deselect: rows dropped live
set_bundle { target: "my-plugin", enabled: true }    # reselect: patch re-read, rows recreated
```

This is the recomposition step for patch/manifest edits. Browser code reloads through client HMR; a stale page needs one refresh. A true version replacement is `remove_bundle` then `install_bundle`; prefer the toggle for content fixes because it cannot leave the package uninstalled. Never restart the desktop app to apply — that ends the agent session; it is the user's decision.

## Extension-point cheat sheet (verify each with inspection)

- Sidebar foot actions: client list slot `sidebar.footer.action`, owner props `{ wide }`.
- Sidebar region: `sidebar.workspaces` (single, replacing shadows the browser — avoid); additive seats inside it: `sidebar.workspaces.session.row.action`, `sidebar.session.row.leading|trailing|hover`.
- Settings: `settings.section` (page), `settings.general.item` (one preference row), `settings.plugins.tab`.
- Composer: `conversation.composer.dock`, `conversation.input.left|right|dock`, `conversation.input.overlay`.
- Chat: `conversation.chat.node` (keyed by node kind), `conversation.chat.turnTail`, `conversation.chat.assistant-actions`.
- Frame: `shell.overlay` (floating), `shell.quota-notice` (chain), `contextMenu.content` (keyed).

Slot details, owner props, and standard props are returned by `Slots.listSubTree` with `root: "<slot key>"`.
