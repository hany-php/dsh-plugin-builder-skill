---
name: create-dsh-plugin
description: Build, install, repair, and verify a DeepSeek Harness (DSH) plugin or bundle in the current profile — a left-sidebar entry, a UI decoration, a Host tool or service, or an MCP row. Use whenever a request names a DSH/Harness add-on, plugin, bundle, slot, sidebar item, `cordis.patch.yml`, or reports that an existing plugin does not appear or does not work.
---

# Create a DSH plugin

This is the working playbook for authoring a persistent DeepSeek Harness plugin, installing it live into the running profile, and proving it works. Follow the order; each step exists because skipping it produced a real failure.

## What you are building

A DSH plugin is a **Cordis plugin row** contributed by a **bundle**: a package whose `package.json` declares `dsh.bundle.patch`, whose YAML patch inserts the row, and whose module is one of:

| Shape | Row module | Use for |
|---|---|---|
| **Host half** (Node) | `export function apply(ctx, config) {}` | tools, services, events, background work, MCP |
| **Client half** (browser) | `window.__ModuleLoader__.load({ id, factory })` returning `{ inject, apply(ctx) }` | sidebar entries, slot-rendered UI |
| **Both** | Host module + `dsh.client` section beside it | a visible control that also needs Host state |
| **Config only** | none (rows only) | enabling an MCP server or configuring a shipped plugin |

The plugin lands in the **current profile** (`$DSH_PROFILE_DIR`); it survives restarts and affects every session of that profile.

## Non-negotiables

1. **Install only with `plugin_manager` `install_bundle`**, target = absolute package directory. Never edit the profile's `package.json` or `cordis.patch.yml`, and never run pnpm in the profile.
2. **The bundle patch is a Cordis Loader patch** — a top-level YAML array of rows:
   ```yaml
   - insert:
       - id: my-plugin
         name: 'my-plugin'
   ```
   A `host:`/`client:` map, slot declarations, or plugin config inside the patch inserts **zero rows** and fails silently. The patch is not the place for anything but Loader rows.
3. **Host module is ESM**: `"type": "module"`, `exports["."]`, `export function apply() {}`. Never mix `#` with `//` comments in a `.js` file; one syntax error leaves the row permanently inactive.
4. **Client module id must equal the package name**, and the factory must return `{ inject, apply(ctx) }`. A default-exported React component or `import React from 'react'` at top level is never loaded — the browser artifact is not an ES module.
5. **Do not import Harness Client packages** (`@deepseek-ai/dsh-client-ui-*`, `@deepseek-ai/dsh-client-ui-primitives`). They change without notice, a plain-JS plugin has no type check, and a throwing component blanks its slot entry. Write your own control; copy markup and behavior, and use only `--dsw-alias-*` theme tokens for color.
6. **Register inside `apply`** with `ctx.effect(...)` / `ctx.slots.inject(...)`; return their cleanup. Factories stay free of side effects.
7. **Author in a workspace directory.** Never create packages under `$DSH_HOME` or inside the profile's `node_modules`; `install_bundle` links the directory you author.
8. **Never restart the desktop app to apply a change.** A restart ends the running agent session. Live apply is what `install_bundle`/`set_bundle` do; when a result says `restart-required`, tell the user instead.

## Workflow

### 0. Load the shipped references first

| Task | Load |
|---|---|
| Any plugin work | `skill` `cordis-plugin-development` (full procedure + templates) |
| Patch dialect, installed packages | `skill` `cordis-composition-reference` |
| Agent presets / composition | `skill` `editing-cordis-compositions` |
| Skill packaging (this skill's own shape) | `references/skill-provider.md` here |

Then inspect only what the version needs: `cordis_inspect_list`, then targeted `cordis_inspect_query` calls. The installed Harness is the authority — never guess a slot key, option, or token.

### 1. Pin the destination and the extension point

- **UI**: query client `Slots.listSubTree` with the exact `root` slot key (omit it for the tree). Read `catalog.ownerProps`, `standardProps`, `registration`, `replaceRisk`, then register into it. `replaceRisk: shadows-shipped-ui` means "replacing this hides shipped UI" — almost never what you want; `none` is the additive seat.
- **Host capability**: `Service.listService`, `Event.listEvents`, `Tool.listTools`.
- **Configuration**: `Config.listConfigs` (filter `name` for one package; then `entry` for its schema), and `Theme.listTokens` for UI color tokens.
- If the slot you need does not exist, or the request needs a stable markup marker (a DOM attribute, a class suffix), extract the shipped client packages from `app.asar` — see the next step.

### 2. Read shipped code inside `app.asar`

`shell`, `node`, `rg`, the glob/grep tools, and pnpm **cannot** open `resources/app.asar`; only the file-read tool can, and it needs exact paths. Use the extractor:

```
powershell -NoProfile -ExecutionPolicy Bypass -File <skill-base>/scripts/extract-asar.ps1 -List "dsh/node_modules/@deepseek-ai/dsh-client-ui-sidebar"
powershell -NoProfile -ExecutionPolicy Bypass -File <skill-base>/scripts/extract-asar.ps1 -Paths "dsh/node_modules/@deepseek-ai/dsh-client-ui-workspace" -OutDir <scratch>/src
rg -n "data-row-key|_groupSection|sidebar\.footer\.action" <scratch>/src
```

- Client UI packages: `dsh/node_modules/@deepseek-ai/dsh-client-ui-*`; Host: `dsh/node_modules/@deepseek-ai/dsh-*`.
- Run the script through the harness shell tool: `powershell -NoProfile -ExecutionPolicy Bypass -File` works everywhere, `pwsh -File` where PowerShell 7 is installed.
- Each `lib/client.js` is readable bundle code with comments and JSDoc — the CSS class **hash prefix** changes per build, the **suffix** (`_groupSection`) does not.
- Prefer semantic markers (`data-row-key`, `role`, `aria-*`) over hashed class names, and degrade inertly when a marker disappears.
- Delete the scratch directory before you finish.

### 3. Author the bundle

A minimal working skeleton is in `references/bundle-format.md`; the browser half contract and a complete sidebar-entry example are in `references/client-half.md`. The shortest correct form:

**`package.json`**
```json
{
  "name": "my-plugin",
  "version": "0.1.0",
  "private": true,
  "type": "module",
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

**`cordis.patch.yml`**
```yaml
- insert:
    - id: my-plugin
      name: 'my-plugin'
```

**Boundaries that fight back** (all observed):
- The patch row `name` must be the installed package name; the `id` becomes `include:<id>` in the live tree and is how you confirm the row later.
- Register the client entry into a slot the *owner* declares. `ctx.slots.inject(key, () => ctx.slots.register({ name: key, id, order, label?, locale? }, Component))` re-installs the entry whenever the owner declaration returns.
- Owner props reach the component (`{ wide }` for `sidebar.footer.action`); locale registration with `locale: <ns>` adds a reactive `t` seat.
- If the feature must affect shipped UI that has no slot (show/hide/restyle a list group), the last-resort pattern is: one control in a slot + a raw CSS rule keyed on a **stable** shipped marker, gated by a document-root attribute, with the rule inert when the marker changes. `references/client-half.md` shows the working example.
- Add display metadata: `locale/en.json` (`meta.title`, `meta.description`, sentence case) plus the user's language, and an original `icon.svg` (≤256 KiB). Both must be in `exports` and `files`.

### 4. Validate offline before installing

Resolve `<skill-base>` from the `Base directory for this skill:` line the `skill` tool prints, then:

```
node "<skill-base>/scripts/check-bundle.mjs" <plugin-dir>              # manifest, patch, syntax, client id, forbidden imports
node "<skill-base>/scripts/smoke-client.cjs" <plugin-dir>/client.js    # mocks browser + React, renders once
```

`check-bundle.mjs` is a static linter, not the authority: `install_bundle` is. If it reports a forbidden import, fix the code — do not rely on the module table staying compatible.

### 5. Install

### 5.5 Modifying an existing skill or plugin
If you need to update an existing skill's logic, add features, or fix a bug, follow this lifecycle to ensure changes are applied:

1. **Locate the Source**: Identify the workspace directory where the plugin is authored (do not edit files inside the profile's `node_modules`).
2. **Apply Changes**: 
   - For **Skills**: Edit the `SKILL.md` file to update instructions, discovery metadata (frontmatter), or examples.
   - For **Plugins**: Update the Host/Client JS modules, the `cordis.patch.yml`, or `package.json`.
3. **Static Validation**: Run the bundle linter to prevent syntax errors that would deactivate the plugin:
   ```
   node "<skill-base>/scripts/check-bundle.mjs" <plugin-dir>
   ```
4. **Apply to Profile**:
   - **Linked Install** (Standard): The profile points to your folder. Force a recomposition by toggling the bundle:
     ```javascript
     set_bundle { target: "plugin-name", enabled: false }
     set_bundle { target: "plugin-name", enabled: true }
     ```
   - **Copy Install**: You must remove and reinstall the snapshot:
     ```javascript
     remove_bundle { target: "plugin-name" }
     install_bundle { target: "<absolute-path-to-source>" }
     ```
5. **Verify Update**:
   - Use `Config.listConfigs` to check the row exists.
   - Load the skill again (`skill { name: "..." }`) to confirm the new instructions are active.

`plugin_manager` `install_bundle` with the absolute directory. Every `plugin_manager` action needs `danger-full-access` (or an approval the user grants); under a rejected approval, stop and tell the user.

Read the result, not the logs:

| Result | Meaning | Next |
|---|---|---|
| `application: applied` | live in the running profile | verify (step 6) |
| `error.code: already-installed` | package already in this profile | see "Changing an installed bundle" |
| `application: failed` + diagnostic | validation or import failed | fix, retry |
| `restart-required` + `restartReason` | HMR could not apply it | report to the user; do not restart the app |

**Changing an installed bundle.** How an edit reaches the profile depends on the install mode:

- **`link:` install** (the default for an absolute package directory). The profile points at your working copy. After a patch/manifest change, **deselect and reselect** the bundle — this forces recomposition live:
  ```
  set_bundle { target: "my-plugin", enabled: false }   # drops its rows
  set_bundle { target: "my-plugin", enabled: true }    # re-reads patch + activates
  ```
  Browser code is reloaded by client HMR; if the page misses it, the user refreshes once.
- **Copy install** (`file:` spec, registry package, tarball). The profile holds a packed snapshot; editing the source changes nothing until you reinstall: `remove_bundle` then `install_bundle` with the absolute directory (or a `file:` spec). This mode survives deletion of the source folder, apart from later pnpm re-resolution.

Prefer the toggle for content fixes on a linked install because it cannot leave the package uninstalled; prefer a copy install when the user needs a deployment independent of the working folder.

### 6. Verify

Evidence, in order of strength:

1. **Row exists**: `cordis_inspect_query` host `Config.listConfigs` with `name: "my-plugin"` → one entry, `patchId` = your row id (approval-free; this is the first confirmation).
2. **Row activated**: `plugin_manager` `list_plugins` → the row's `fiberPhase` is `active` (needs full access).
3. **Client half rendered**: client `Slots.listSubTree` with `root: "<slot key>"` → an occupant with your `id` and `active: true`. This proves the browser loaded the factory and ran `apply`.
4. **Behaviour**: exercise it through the UI when browser control exists; otherwise ask the user to click and report. Restore any state you changed.
5. **Report limits honestly**: installation plus slot registration is not visual verification. Say what was proven (row, occupant, syntax, mocked render) and what was not (pixels, clicks, theme).

### 7. Report

State the plugin location (paths), what each file does, the live evidence (row id, slot occupant, `fiberPhase`), how to use it, and any remaining limits. If you created a scratch extraction directory, delete it.

## Diagnosing a plugin that "does not work"

Work outside-in; every symptom below was a real root cause.

| Symptom | Likely cause | Check / fix |
|---|---|---|
| Nothing appears at all | patch inserted zero rows | `list_bundles` shows `rows: []`; rewrite patch as `insert` list |
| Installed, but no row | patch has `host:`/`client:` maps or slots | same fix; patch is Loader rows only |
| Row exists, plugin inactive | Host module syntax error or wrong module form | `node --check`; needs `export function apply(){}` + `type: module` |
| Row active, no UI | `dsh.client` missing, `exports["./client"]` missing, or client.js not a loader artifact | fix manifest; use the factory form |
| UI blank after adding a component | component threw | console: `slot entry crashed in '<slot>'`; simplify the component |
| Slot registered, nothing visible | registered into a single slot you shadowed, or a hidden/collapsed seat | re-inspect `ownerProps`; pick an additive list slot |
| `already-installed` | HMR refuses to reinstall an installed package | deselect/reselect, or remove + install |
| Change did not appear | profile composed the old patch | deselect/reselect; then refresh the page if needed |
| `restart-required` | HMR cannot apply (no HMR, moved package, restart-only module) | report; restart is the user's decision |
| Icon/locale ignored | not exported (`./icon`, `./locale/*.json`) or not listed in `files` | fix exports + files |
| Metadata diagnostic in bundle detail | malformed locale JSON (empty `meta.title`) | `references/bundle-format.md` rules |

Recovery checklist for a broken existing plugin (this is the exact failure set from a real repair): patch shape, `type: module`, ESM host export, client loader artifact + id, `dsh.client`/exports, real slot + stable markers, locale/icon exports, `files` list, then recompose and verify.

## Verification checklist

| Evidence | Method |
|---|---|
| Files parse | `node --check` every `.js`; `JSON.parse` every `.json`; XML-parse `icon.svg` |
| Patch shape | top-level array, `insert` rows with string `id` + `name` |
| Host row | `Config.listConfigs` (name filter) shows the entry |
| Host activation | `list_plugins` `fiberPhase: active` |
| Client registration | `Slots.listSubTree` root shows your occupant |
| Behaviour | UI interaction, or an explicit note that it is user-verified only |
| Cleanup | scratch dirs deleted, user state restored |

## References

- [`references/bundle-format.md`](references/bundle-format.md) — manifests, patch dialect, display metadata, install/recompose semantics, skill-provider bundles.
- [`references/client-half.md`](references/client-half.md) — module loader contract, slots, hooks, theming, root-attribute effects, worked sidebar example.
- [`references/skill-provider.md`](references/skill-provider.md) — packaging a skill as a bundle (this skill's own shape).
- `scripts/extract-asar.ps1` — list/extract shipped packages from `app.asar`.
- `scripts/check-bundle.mjs` — static bundle lint.
- `scripts/smoke-client.cjs` — mock-browser render of a client half.
