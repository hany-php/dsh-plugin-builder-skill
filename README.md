# dsh-plugin-builder-skill

A bundle for the DeepSeek Harness profile that adds one model-invocable skill: **`create-dsh-plugin`**.

The skill is a working playbook for creating a persistent DSH plugin — a left-sidebar entry, a UI decoration, a Host tool/service, or an MCP row — including offline validation, live installation into the profile, recomposition of an edited bundle, and the evidence that proves it actually works.

## What is inside

| Path | Role |
|---|---|
| `index.js` | Host provider plugin: registers the skill on the `skills` service |
| `cordis.patch.yml` | Loader patch that inserts the provider row |
| `assets/create-dsh-plugin/SKILL.md` | The skill body loaded by the `skill` tool (frontmatter is the catalog name/description) |
| `assets/create-dsh-plugin/references/` | Deferred depth: bundle format, client half, skill-provider packaging |
| `assets/create-dsh-plugin/scripts/` | `extract-asar.ps1` (read shipped code inside app.asar), `check-bundle.mjs` (static lint), `smoke-client.cjs` (mock-browser render) |
| `locale/en.json`, `locale/ar.json` | Plugin Manager display metadata |
| `icon.svg` | Plugin Manager artwork |

## Install into the current profile

```
plugin_manager install_bundle { target: "<absolute path to this directory>" }
```

The row appears as `include:plugin-builder-skill`. A new session sees `create-dsh-plugin` in its skill catalog; any session can load it explicitly with `skill { name: "create-dsh-plugin" }`.

## Verify

```
node assets/create-dsh-plugin/scripts/check-bundle.mjs .
node assets/create-dsh-plugin/scripts/smoke-client.cjs ../dsh-workspace-visibility-toggle/client.js
```

Then confirm the live row with `cordis_inspect_query` host `Config.listConfigs` filtered by `name: "dsh-plugin-builder-skill"`, and load the skill by name.

## Notes

- The package is a bundle first: the skill only exists while this bundle is selected in the profile.
- The skill body must stay in sync with its frontmatter (`name` must be kebab-case and match what users invoke; `description` is the discovery surface).
- How edits reach the running profile depends on the install mode. A `link:` install reads these files live: reselect the bundle (`set_bundle` false → true) after a patch/manifest change and prose edits apply without reinstall. A copy install (`file:`, registry, tarball) is a packed snapshot: after any edit run `remove_bundle`, then `install_bundle` from this directory.
- Profile storage: installed packages live under `$DSH_HOME/profiles/<profile>/node_modules`; the source directory in this repository is for editing and reinstalling.
