import { readFileSync } from 'node:fs';
import { sep } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Bundled `create-dsh-plugin` skill provider.
 *
 * The skill body and its references/scripts live under assets/; the SKILL.md
 * frontmatter is the single source of the skill name and description, so the
 * catalog entry cannot drift from the document.
 *
 * @module dsh-plugin-builder-skill
 */
const PROVIDER = 'dsh-plugin-builder';
const SKILL_DIR = fileURLToPath(new URL('./assets/create-dsh-plugin/', import.meta.url));
const SKILL_FILE = `${SKILL_DIR}SKILL.md`;
/** Precedence for packaged providers and bundled roots (`BUNDLED_SKILL_RANK`). */
const RANK = 600;

/**
 * Read SKILL.md and split its YAML frontmatter from the instruction body.
 * @returns the skill name, description and stripped body.
 * @throws when the frontmatter or its description is missing.
 */
function readSkill() {
  const raw = readFileSync(SKILL_FILE, 'utf8');
  const frontmatter = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/u.exec(raw);
  if (frontmatter === null) throw new Error(`${SKILL_FILE}: missing YAML frontmatter`);
  const meta = frontmatter[1];
  const name = /^name:[ \t]*(.+)$/mu.exec(meta)?.[1]?.trim();
  const description = /^description:[ \t]*(.+)$/mu.exec(meta)?.[1]?.trim();
  if (name === undefined || name === '') throw new Error(`${SKILL_FILE}: frontmatter needs a name`);
  if (description === undefined || description === '') throw new Error(`${SKILL_FILE}: frontmatter needs a description`);
  return { name, description, content: raw.slice(frontmatter[0].length).trim() };
}

/** Build the discovery candidate; the locator stays opaque to the registry. */
function candidate() {
  const { name, description } = readSkill();
  return {
    name,
    description,
    invocation: { modelInvocable: true, userInvocable: true },
    provider: PROVIDER,
    source: 'bundled',
    rank: RANK,
    resourceBase: { kind: 'directory', path: SKILL_DIR.split(sep).join('/') },
    locator: SKILL_FILE,
  };
}

const provider = {
  name: PROVIDER,
  list: () => Promise.resolve([candidate()]),
  /** @param loaded - the candidate returned by `list()`. */
  get: (loaded) => {
    const { description, content } = readSkill();
    return Promise.resolve({
      name: loaded.name,
      description,
      invocation: loaded.invocation,
      provider: PROVIDER,
      source: 'bundled',
      resourceBase: loaded.resourceBase,
      content,
    });
  },
};

/** The skill registry is the only service this provider needs. */
export const inject = ['skills'];

/**
 * Register the create-dsh-plugin provider.
 * @param ctx - Host context carrying the `skills` service.
 */
export function apply(ctx) {
  ctx.skills.registerProvider(() => provider);
}
