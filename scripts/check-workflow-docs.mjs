import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const skillsDir = path.join(root, 'plugins/openindu-control-tower/skills');
const manifestPath = path.join(root, 'plugins/openindu-control-tower/reference/manifest.yaml');
const docs = ['README.md', 'README_ZH.md', 'AGENTS.md', 'plugins/openindu-control-tower/README.md'];
const errors = [];
const skillIds = [];

for (const entry of fs.readdirSync(skillsDir, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  const skillPath = path.join(skillsDir, entry.name, 'SKILL.md');
  if (!fs.existsSync(skillPath)) {
    errors.push(`Missing SKILL.md: ${entry.name}`);
    continue;
  }
  const content = fs.readFileSync(skillPath, 'utf8');
  const name = content.match(/^name:\s*['"]?([^'"\r\n]+)['"]?\s*$/m)?.[1];
  if (!name) errors.push(`Missing frontmatter name: ${entry.name}`);
  else {
    skillIds.push(name);
    if (name !== entry.name) errors.push(`Directory/frontmatter mismatch: ${entry.name} != ${name}`);
  }
  if (entry.name !== 'principle' && !content.split(/\r?\n/).slice(0, 20).join('\n').includes('/principle')) {
    errors.push(`No /principle instruction in first 20 lines: ${entry.name}`);
  }
}

const unique = (values) => [...new Set(values)].sort();
if (unique(skillIds).length !== skillIds.length) errors.push('Duplicate skill frontmatter names');

const manifest = fs.readFileSync(manifestPath, 'utf8');
const skillsSection = manifest.split(/# ---- Skills[^\n]*\n/)[1]?.split(/# ---- Escalation rules/)[0];
if (!skillsSection) errors.push('Could not locate skills section in reference/manifest.yaml');
else {
  const manifestIds = [...skillsSection.matchAll(/^\s*- id:\s*([a-z0-9_-]+)\s*$/gm)].map((match) => match[1]);
  if (JSON.stringify(unique(skillIds)) !== JSON.stringify(unique(manifestIds))) {
    errors.push(`Manifest skill IDs differ; dirs=${unique(skillIds).join(',')} manifest=${unique(manifestIds).join(',')}`);
  }
}

for (const relativePath of docs) {
  const content = fs.readFileSync(path.join(root, relativePath), 'utf8');
  const documentedIds = [...content.matchAll(/^\|\s*`\/([a-z0-9_-]+)(?=[\s<`])/gm)].map((match) => match[1]);
  if (JSON.stringify(unique(skillIds)) !== JSON.stringify(unique(documentedIds))) {
    errors.push(`${relativePath} command rows differ; missing=${unique(skillIds.filter((id) => !documentedIds.includes(id))).join(',')} extra=${unique(documentedIds.filter((id) => !skillIds.includes(id))).join(',')}`);
  }
}

if (errors.length) {
  console.error(`Workflow documentation check failed (${errors.length}):\n- ${errors.join('\n- ')}`);
  process.exitCode = 1;
} else {
  console.log(`Workflow documentation consistent: ${skillIds.length} skills, manifest, 4 command inventories, and /principle entry instructions.`);
}
