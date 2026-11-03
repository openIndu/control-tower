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

function readSkill(skillDir) {
  const file = path.join(skillDir, 'SKILL.md');
  const source = fs.readFileSync(file, 'utf8');
  const frontmatter = source.match(/^---\r?\n([\s\S]*?)\r?\n---/m)?.[1];
  const name = frontmatter?.match(/^name:\s*['"]?([^'"\r\n]+)['"]?\s*$/m)?.[1];
  const description = frontmatter?.match(/^description:\s*(.+)$/m)?.[1];
  const explicitOnly = /^disable-model-invocation:\s*true\s*$/m.test(frontmatter ?? '');
  if (!name || !description) throw new Error(`Missing name/description frontmatter: ${file}`);
  return { name, description, explicitOnly };
}

function renderWrapper(name, description, explicitOnly) {
  const canonical = `../../../plugins/openindu-control-tower/skills/${name}/SKILL.md`;
  const principle = '../../../plugins/openindu-control-tower/skills/principle/SKILL.md';
  const activation = explicitOnly
    ? `Only use on explicit \`$${name}\` invocation or skill-picker selection. `
    : '';
  return `---\nname: ${name}\ndescription: ${description}\n---\n\nUse as \`$${name}\` in Codex. ${activation}Read the principles at \`${principle}\`, then follow the canonical workflow at \`${canonical}\`. Translate referenced Claude slash skills to their Codex \`$name\` forms; Codex does not register slash commands.\n`;
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
  if (manifest.skills !== './.agents/skills/') errors.push('Codex manifest skills path is not the Codex entrypoint directory');
  if (!fs.existsSync(path.join(root, '.codex-plugin', 'openindu-mark.svg'))) errors.push('Codex plugin icon file is missing');

  if (errors.length) {
    console.error(`Codex skill sync check failed (${errors.length}):\n- ${errors.join('\n- ')}`);
    process.exitCode = 1;
  } else {
    console.log(`Codex entrypoints match ${names.length} canonical skills; plugin manifest points at the Codex entrypoint directory.`);
  }
}

try {
  sync();
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
