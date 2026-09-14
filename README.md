# Zpace plugins

The community registry for [Zpace](https://github.com/Nicoo01x/Zpace) — the desktop workspace for coding agents. Everything listed here shows up in **Settings › Plugins** inside the app, with your name and your GitHub avatar on the card, and installs in one click.

A plugin is a folder. No build step, no upload: you open a pull request, CI validates it, and once it is merged the app sees it.

## Publish a plugin

1. Fork this repo and copy `plugins/hello-world` to `plugins/<your-id>` (lowercase, dashes).
2. Edit `plugin.json` — `id` must equal the folder name; put your GitHub login in `author.github` (that is where the avatar and the link come from).
3. Keep only text files in the folder (`.json .js .css .html .md .svg .yml`), each under 512 KB. Icons are SVG.
4. `node scripts/build-index.mjs --check` — the same check CI runs.
5. Open the pull request. When it is merged, `plugins.json` is rebuilt and the plugin is live.

To update, bump `version` and open another pull request; the app offers the update to everyone who installed it.

## What a plugin can do

| Key | What it is |
| --- | --- |
| `contributes.themes` | Theme packs: colours, terminal scheme, editor colours. They appear next to the built-in packs. |
| `contributes.commands` | Palette entries. `action.kind`: `prompt` (sends text to Claude, in the active session or a new one), `shell` (runs a command in the project, result in the island), `url`, `pane`. |
| `contributes.agents` | Ready-made Zpace agents (persona, rules, allowed tools, model). Created on install, removed on uninstall. |
| `contributes.skills` | Claude Code skills — a folder with a `SKILL.md`, copied to `~/.claude/skills/<name>`. |
| `contributes.panes` | HTML pages opened as workspace panes (sandboxed iframe, themed with the app's CSS variables). |
| `main` | A script, `activate(zpace)`, for everything else — see the API below. Its `permissions` are shown before install. |

`plugins/hello-world` uses most of it and is the template.

### plugin.json

```json
{
  "id": "my-plugin",
  "name": "My plugin",
  "version": "1.0.0",
  "description": "One or two sentences. Up to 300 characters.",
  "author": { "name": "Your Name", "github": "your-login" },
  "icon": "icon.svg",
  "homepage": "https://…",
  "tags": ["theme", "command"],
  "permissions": ["commands", "notifications"],
  "contributes": { "themes": [], "commands": [], "agents": [], "skills": [], "panes": [] },
  "main": "main.js"
}
```

Permissions: `commands` `panes` `events` `agents` `shell` `files` `network` `notifications` `clipboard`. A script that calls something it did not declare gets an error, not the feature.

### The script API

```js
export function activate(zpace) {
  const off = zpace.commands.register({ id: 'hi', title: 'Say hi', run: () => zpace.notify({ title: 'Hi' }) });
  const stop = zpace.on('session:completed', (e) => console.log(e.title, e.text));
  return () => { off(); stop(); }; // runs on disable / uninstall
}
```

| Member | Needs | Does |
| --- | --- | --- |
| `zpace.plugin` | — | `{ id, version, dir }` |
| `zpace.commands.register({ id, title, keywords?, run })` | `commands` | Adds a palette command; returns a disposer. |
| `zpace.notify({ title, summary?, variant?, action? })` | `notifications` | A notification in the island. |
| `zpace.panes.open(paneId)` / `zpace.panes.openHtml(title, html)` | `panes` | Opens a pane from `contributes.panes`, or ad-hoc HTML. |
| `zpace.on(event, cb)` | `events` | `session:started`, `session:completed` (`{ sessionId, title, projectId, text }`), `notification`, `project:changed`. Returns a disposer. |
| `zpace.agents.ask(text, { project?, session?: 'active' \| 'new', title? })` | `agents` | Sends a prompt to Claude Code; returns the session id. `zpace.agents.list()` lists your Zpace agents. |
| `zpace.projects.current()` / `.list()` | — | `{ id, name, path }` |
| `zpace.shell.run(command, { cwd? })` | `shell` | Runs in PowerShell / sh; resolves `{ code, output }`. |
| `zpace.fs.readText(path)` / `.writeText(path, text)` / `.exists(path)` | `files` | Plain files. |
| `zpace.storage.get(key, fallback?)` / `.set(key, value)` | — | A key–value bag kept per plugin, across launches. |
| `zpace.settings.language()` / `.theme()` | — | What the app is set to. |
| `zpace.clipboard.write(text)` | `clipboard` | |
| `zpace.openUrl(url)` | `network` | In the default browser. |
| `zpace.t(text)` | — | The app's translator (your own strings stay as written). |

### Panes

A pane is an HTML file. The app wraps it with `--background`, `--surface`, `--text-primary`, `--text-secondary`, `--accent` and `--border` as CSS variables, so a page can match the theme without knowing it. From the page:

```js
parent.postMessage({ zpace: 'notify', title: 'Done', summary: '…' }, '*');
parent.postMessage({ zpace: 'command', id: 'hi' }, '*'); // runs one of your commands
```

## Rules

- Only text files, only what the plugin needs. No minified blobs — reviewers read the code.
- Declare every permission the script uses. Undeclared calls fail.
- Say what the plugin sends where. A plugin that phones home without saying so is removed.
- Be nice in the review thread; this is a small community.

MIT. By publishing here you license your plugin under MIT too.
