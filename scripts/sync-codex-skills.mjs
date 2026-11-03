import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const canonicalRoot = path.join(root, 'plugins/openindu-control-tower/skills');
const codexRoot = path.join(root, '.agents/skills');
const manifestPath = path.join(root, '.codex-plugin/plugin.json');
const pluginPath = path.join(root, 'plugins/openindu-control-tower/.claude-plugin/plugin.json');
const write = process.argv.includes('--write');
const errors = [];

function ensureCodexNote(file, name) {
  const source = fs.readFileSync(file, 'utf8');
  if (source.includes('**Codex compatibility:**')) return source;
  const note = `> **Codex compatibility:** Invoke this workflow as \`$${name}\` in Codex. Translate referenced Claude slash skills such as \`/principle\` to the corresponding Codex skill, such as \`$principle\`; Codex does not register \`/...\` commands.`;
  const updated = source.replace(/^(---\r?\n[\s\S]*?\r?\n---\r?\n)/, `$1\n${note}\n`);
  if (updated === source) throw new Error(`Missing skill frontmatter: ${file}`);
  if (write) {
    fs.writeFileSync(file, updated, 'utf8');
    return updated;
  }
  errors.push(`Missing Codex compatibility note: ${file}`);
  return source;
}

function readSkill(skillDir) {
  const file = path.join(skillDir, 'SKILL.md');
  const nameFromDir = path.basename(skillDir);
  const source = ensureCodexNote(file, nameFromDir);
  const frontmatter = source.match(/^---\r?\n([\s\S]*?)\r?\n---/m)?.[1];
  const name = frontmatter?.match(/^name:\s*['"]?([^'"\r\n]+)['"]?\s*$/m)?.[1];
  const description = frontmatter?.match(/^description:\s*(.+)$/m)?.[1];
  const explicitOnly = /^disable-model-invocation:\s*true\s*$/m.test(frontmatter ?? '');
  if (!name || !description) throw new Error(`Missing name/description frontmatter: ${file}`);
  return { name, description, explicitOnly };
}

function renderWrapper(name, description, explicitOnly) {
  const canonical = `plugins/openindu-control-tower/skills/${name}/SKILL.md`;
  const principle = 'plugins/openindu-control-tower/skills/principle/SKILL.md';
  const activation = explicitOnly
    ? `\nOnly activate this workflow when the user explicitly invokes \`$${name}\` or selects it in the skill picker; do not trigger it from inferred intent alone.\n`
    : '';
  return `---\nname: ${name}\ndescription: ${description}\n---\n\n# Codex entrypoint for ${name}\n\nThis skill is a Codex discovery entrypoint for the canonical openIndu control-tower workflow.\n${activation}\n1. Read and follow the authoritative principles in \`${principle}\` before any task action.\n2. Read and follow the canonical workflow instructions in \`${canonical}\`.\n3. When the workflow calls another slash command, use that skill by its Codex name (for example, \`$route\`) or read its canonical \`SKILL.md\`; Codex does not register Claude-style slash commands.\n`;
}

function sync() {
  const entries = fs.readdirSync(canonicalRoot, { withFileTypes: true }).filter((entry) => entry.isDirectory());
  const names = [];
  for (const entry of entries) {
    const { name, description, explicitOnly } = readSkill(path.join(canonicalRoot, entry.name));
    if (name !== entry.name) throw new Error(`Skill directory/frontmatter mismatch: ${entry.name} != ${name}`);
    names.push(name);
    const targetDir = path.join(codexRoot, name);
    const target = path.join(targetDir, 'SKILL.md');
    const expected = renderWrapper(name, description, explicitOnly);
    if (write) {
      fs.mkdirSync(targetDir, { recursive: true });
      fs.writeFileSync(target, expected, 'utf8');
    } else if (!fs.existsSync(target) || fs.readFileSync(target, 'utf8') !== expected) {
      errors.push(`Codex skill entrypoint is stale or missing: .agents/skills/${name}/SKILL.md`);
    }
  }

  const actualNames = fs.readdirSync(codexRoot, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
  const expectedNames = [...names].sort();
  if (JSON.stringify(actualNames) !== JSON.stringify(expectedNames)) {
    errors.push(`Codex skill directories differ; expected=${expectedNames.join(',')} actual=${actualNames.join(',')}`);
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const claudePlugin = JSON.parse(fs.readFileSync(pluginPath, 'utf8'));
  if (manifest.name !== 'openindu-control-tower') errors.push('Codex manifest has an unexpected plugin name');
  if (manifest.version !== claudePlugin.version) errors.push('Codex and Claude plugin versions differ');
  if (manifest.skills !== './plugins/openindu-control-tower/skills/') errors.push('Codex manifest skills path is not the canonical skill directory');
  if (!fs.existsSync(path.join(root, '.codex-plugin', 'openindu-mark.svg'))) errors.push('Codex plugin icon file is missing');

  if (errors.length) {
    console.error(`Codex skill sync check failed (${errors.length}):\n- ${errors.join('\n- ')}`);
    process.exitCode = 1;
  } else {
    console.log(`Codex entrypoints and client invocation notes match ${names.length} canonical skills; plugin manifest points at the canonical skill directory.`);
  }
}

try {
  sync();
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
