# Packaging a skill as a DSH bundle

A skill becomes model-invocable when a plugin registers it on the `skills` service of the running profile. The simplest distributable shape is a bundle package that inserts its own provider row — exactly how this skill (`create-dsh-plugin`) is installed.

## Package layout

```
dsh-plugin-builder-skill/
  package.json
  cordis.patch.yml                 # inserts the provider row
  index.js                         # provider plugin (injects 'skills')
  icon.svg
  locale/en.json, locale/ar.json   # display metadata for Plugin Manager
  assets/
    create-dsh-plugin/
      SKILL.md                     # frontmatter + instructions (the body the model loads)
      references/*.md              # deferred depth, resolved against the base directory
      scripts/*                    # tools the skill tells the model to run
```

`package.json` essentials:

```json
{
  "type": "module",
  "exports": { ".": "./index.js", "./locale/*.json": "./locale/*.json",
               "./icon": "./icon.svg", "./package.json": "./package.json" },
  "files": ["index.js", "cordis.patch.yml", "assets", "locale/*.json", "icon.svg"],
  "dsh": { "bundle": { "patch": "./cordis.patch.yml" } }
}
```

`cordis.patch.yml`:

```yaml
- insert:
    - id: plugin-builder-skill
      name: 'dsh-plugin-builder-skill'
```

No `dsh.client` section and no Host tool: the row module is the provider plugin itself.

## Provider plugin

```js
import { readFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const PROVIDER = 'my-skill-provider';
const SKILL_DIR = fileURLToPath(new URL('./assets/my-skill/', import.meta.url));
const SKILL_FILE = `${SKILL_DIR}SKILL.md`;
const RANK = 600;   // BUNDLED_SKILL_RANK: packaged providers and bundled roots

function readSkill() {
  const raw = readFileSync(SKILL_FILE, 'utf8');
  const frontmatter = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/u.exec(raw);
  if (frontmatter === null) throw new Error(`${SKILL_FILE}: missing YAML frontmatter`);
  const description = /^description:[ \t]*(.+)$/mu.exec(frontmatter[1])?.[1]?.trim();
  const name = /^name:[ \t]*(.+)$/mu.exec(frontmatter[1])?.[1]?.trim();
  if (!description || !name) throw new Error(`${SKILL_FILE}: name/description required`);
  return { name, description, content: raw.slice(frontmatter[0].length).trim() };
}

const provider = {
  name: PROVIDER,
  list: () => {
    const { name, description } = readSkill();
    return Promise.resolve([{
      name, description,
      invocation: { modelInvocable: true, userInvocable: true },
      provider: PROVIDER,
      source: 'bundled',
      rank: RANK,
      resourceBase: { kind: 'directory', path: SKILL_DIR.split(sep).join('/') },
      locator: SKILL_FILE,
    }]);
  },
  async get(candidate, options) {
    const { description, content } = readSkill();
    return {
      name: candidate.name, description, content,
      invocation: candidate.invocation, provider: PROVIDER,
      source: 'bundled', resourceBase: candidate.resourceBase,
    };
  },
};

export const inject = ['skills'];
export function apply(ctx) {
  ctx.skills.registerProvider(() => provider);
}
```

- `list()` returns candidate **summaries**; the registry validates name (kebab-case), non-empty description, invocation booleans, provider ownership, numeric rank. A malformed candidate fails discovery for that provider.
- `get(candidate)` returns the full definition including `content` (the SKILL.md body without frontmatter).
- `resourceBase: { kind: 'directory', path }` makes the loaded skill show the base directory to the model, which is how `references/...` and `scripts/...` in the body resolve.
- Registration is synchronous; the provider survives until its registration is disposed. Providers are queried sequentially, so `list()` must stay cheap — read files lazily and cache if large.
- For a tiny skill, `ctx.skills.register({ name, description, content, invocation })` registers an in-memory runtime skill directly; no provider object is needed.

The `skills` service is mounted by `@deepseek-ai/dsh-skill` (a base row). A provider row contributed by a profile bundle lands in the **global layer**, so every agent preset sees it.

## SKILL.md rules

```markdown
---
name: kebab-case-skill-name
description: One trigger-rich sentence: what the skill does AND when to load it.
---

# Title

Concise instructions ...
```

- The frontmatter `description` is the discovery surface: name the capability, the objects it applies to, and the trigger words (including "does not work" style failure reports). Keep it one paragraph.
- The body is what the model loads when it invokes the skill. Put the procedure first, defer depth to `references/*.md` with one line saying when to read each, and name scripts in `scripts/` with exact commands.
- Keep critical constraints before the actions they constrain; keep the body short enough to be a bounded load (~200 lines) and let references carry detail.
- `name` in frontmatter must match what `skill` is invoked with; kebab-case only.

## Verify skill discovery

1. `install_bundle` (or `set_bundle` toggle for an installed package) → `application: applied`.
2. `Config.listConfigs` with `name: "<package>"` shows the row; `list_plugins` shows `fiberPhase: active`.
3. Load it by exact name: the `skill` tool with `name: "<skill>"` returns the `<skill_content>` wrapper with a `Base directory for this skill:` line. If a running session still holds its startup catalog, a new session is the reliable check; the catalog is a durable message, the tool itself resolves by name at call time.
