// Builds plugins.json from every plugins/*/plugin.json — CI runs it on every push to main.
//   node scripts/build-index.mjs          # write plugins.json
//   node scripts/build-index.mjs --check  # validate only (pull requests); exit 1 on any problem
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PLUGINS = path.join(ROOT, 'plugins');
const TEXT = /\.(json|js|mjs|css|html|htm|md|txt|svg|yml|yaml|toml)$/i;
const IMAGE = /\.(png|jpe?g|webp|gif)$/i;
const MAX_IMAGE = 1536 * 1024;
const ID = /^[a-z0-9][a-z0-9-]{1,48}$/;
const SEMVER = /^\d+\.\d+\.\d+([-+][\w.-]+)?$/;
const PERMISSIONS = ['commands', 'panes', 'events', 'agents', 'shell', 'files', 'network', 'notifications', 'clipboard', 'notes', 'media'];
const MAX_FILE = 512 * 1024;

const problems = [];
const entries = [];
const dirs = fs
  .readdirSync(PLUGINS, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name)
  .sort();

for (const dir of dirs) {
  const folder = path.join(PLUGINS, dir);
  const manifestPath = path.join(folder, 'plugin.json');
  const at = (msg) => problems.push(`plugins/${dir}: ${msg}`);
  if (!fs.existsSync(manifestPath)) {
    at('missing plugin.json');
    continue;
  }
  let m;
  try {
    m = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  } catch (e) {
    at(`plugin.json is not valid JSON (${e.message})`);
    continue;
  }
  if (m.id !== dir) at(`id "${m.id}" must equal the folder name "${dir}"`);
  if (!ID.test(m.id ?? '')) at('id: lowercase letters, digits and dashes, 2-49 chars');
  if (!m.name?.trim()) at('name: required');
  if (!SEMVER.test(m.version ?? '')) at('version: semver (1.2.3)');
  if (!m.description?.trim() || m.description.length > 300) at('description: required, up to 300 chars');
  if (!/^[A-Za-z0-9-]{1,39}$/.test(m.author?.github ?? '')) at('author.github: a GitHub login');
  if (!m.author?.name?.trim()) at('author.name: required');
  for (const p of m.permissions ?? []) if (!PERMISSIONS.includes(p)) at(`permissions: unknown "${p}"`);
  if (m.main && !fs.existsSync(path.join(folder, m.main))) at(`main: ${m.main} not found`);
  if (m.icon && !fs.existsSync(path.join(folder, m.icon))) at(`icon: ${m.icon} not found`);
  if (m.icon && !/\.svg$/i.test(m.icon)) at('icon: must be an .svg');
  for (const sh of m.screenshots ?? []) {
    if (!IMAGE.test(sh) || sh.includes('..')) at(`screenshots: "${sh}" must be a png/jpg/webp/gif in the folder`);
    else if (!fs.existsSync(path.join(folder, sh))) at(`screenshots: ${sh} not found`);
    else if (fs.statSync(path.join(folder, sh)).size > MAX_IMAGE) at(`screenshots: ${sh} over 1.5 MB`);
  }
  for (const pane of m.contributes?.panes ?? []) if (!fs.existsSync(path.join(folder, pane.entry ?? ''))) at(`panes: ${pane.entry} not found`);
  for (const sk of m.contributes?.skills ?? []) if (!fs.existsSync(path.join(folder, sk.path ?? '', 'SKILL.md'))) at(`skills: ${sk.path}/SKILL.md not found`);
  for (const cmd of m.contributes?.commands ?? []) if (!cmd.id || !cmd.title || !cmd.action?.kind) at(`commands: "${cmd.id ?? '?'}" needs id, title and action`);
  for (const th of m.contributes?.themes ?? []) if (!th.id || !th.label || !['light', 'dark'].includes(th.appearance)) at(`themes: "${th.id ?? '?'}" needs id, label and appearance`);
  // every file: relative, text only, small
  const files = [];
  const walk = (d, rel = '') => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const r = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDirectory()) {
        walk(path.join(d, e.name), r);
        continue;
      }
      if (IMAGE.test(e.name)) continue; // pictures stay in the repo (the card shows them from here)
      if (!TEXT.test(e.name)) {
        at(`${r}: only text files (json/js/css/html/md/svg/yml) and pictures (png/jpg/webp/gif) belong in a plugin`);
        continue;
      }
      if (fs.statSync(path.join(d, e.name)).size > MAX_FILE) at(`${r}: over 512 KB`);
      files.push(r);
    }
  };
  walk(folder);
  let updated;
  try {
    updated = execSync(`git log -1 --format=%cI -- "plugins/${dir}"`, { cwd: ROOT, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim() || undefined;
  } catch {
    updated = undefined;
  }
  entries.push({ ...m, path: `plugins/${dir}`, files: files.sort(), updated });
}

if (problems.length) {
  console.error(problems.map((p) => `x ${p}`).join('\n'));
  process.exit(1);
}
// deterministic: the index's date is the newest plugin's, so rebuilding without changes changes nothing
const index = { updated: entries.map((e) => e.updated).filter(Boolean).sort().at(-1) ?? new Date().toISOString(), plugins: entries };
if (process.argv.includes('--check')) {
  console.log(`ok: ${entries.length} plugins valid`);
} else {
  fs.writeFileSync(path.join(ROOT, 'plugins.json'), JSON.stringify(index, null, 2) + '\n');
  console.log(`ok: plugins.json with ${entries.length} plugins`);
}
