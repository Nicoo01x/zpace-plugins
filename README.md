# Zpace plugins

The community registry for [Zpace](https://github.com/Nicoo01x/Zpace) — the desktop workspace for coding agents. Everything listed here shows up in **Settings › Plugins** inside the app, with your name and your GitHub avatar on the card, and installs in one click.

A plugin is a folder. No build step, no upload: you open a pull request, CI validates it, and once it is merged the app sees it.

## What is in the library

| Plugin | What it does |
| --- | --- |
| **Boards** (`kanban`) | A Trello-style board per project, wired to Zpace notes. |
| **Focus Timer** | Pomodoro in the island — the countdown next to the Zpace mark. |
| **Now Playing** | Spotify / any player: cover, track, play/pause/next, the track in the island. |
| **Calendar** | Month view, reminders ten minutes before, a note per event. |
| **Weather** | Now, the next hours, the week — Open-Meteo, no key. Temperature in the island. |
| **Code Reviewer** | A ready-made review agent for your rooms. |
| **Conventional Commits** | A Claude Code skill + a palette command for commit messages. |
| **Daily Standup** | Two prompts: what you did, what to do. |
| **Rosé Pine**, **Monokai Pro** | Theme packs. |
| **Hello World** | The template. |

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

Permissions: `commands` `panes` `events` `agents` `shell` `files` `network` `notifications` `clipboard` `notes` `media`. A script that calls something it did not declare gets an error, not the feature.

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
| `zpace.notify({ title, summary?, variant?, sticky?, action? })` | `notifications` | A notification in the island; returns its id. `zpace.notifications.update(id, patch)` / `.remove(id)`. |
| `zpace.island.set({ icon?, text, title?, color?, onClick? })` / `.set(null)` | `notifications` | A live readout in the compact island (a countdown, the track playing). |
| `zpace.panes.open(paneId)` / `zpace.panes.openHtml(title, html)` / `zpace.panes.postMessage(msg)` | `panes` | Opens a pane from `contributes.panes` or ad-hoc HTML; posts to the open ones. |
| `zpace.notes.list({ project? })` / `.read(id)` / `.create({ title, body?, tags? })` / `.update(id, patch)` / `.open(id)` | `notes` | Zpace notes. |
| `zpace.media.now()` / `zpace.media.control('play' | 'pause' | 'toggle' | 'next' | 'previous')` | `media` | The system media session (Spotify, browsers, any player): title, artist, album, cover, position. |
| `zpace.on(event, cb)` | `events` | `session:started`, `session:completed` (`{ sessionId, title, projectId, text }`), `notification`, `project:changed`, `pane:message` (`{ pluginId, message }` from your panes). Returns a disposer. |
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

A pane is an HTML file in a sandboxed iframe. The app injects `window.zpace` — the same API as the script, over postMessage, every call a promise — and its theme as CSS variables (`--background`, `--surface`, `--surface-inset`, `--text-primary`, `--text-secondary`, `--text-muted`, `--accent`, `--accent-soft`, `--border`, `--border-strong`, `--success`, `--warning`, `--danger`).

```js
const notes = await zpace.notes.list({ project: 'active' });
zpace.notify({ title: 'Done' });
zpace.on('session:completed', (e) => …);   // events, same names as the script
zpace.on('message', (m) => …);             // what your script sends with zpace.panes.postMessage
zpace.post({ type: 'hello' });             // to your script: zpace.on('pane:message', ({ message }) => …)
zpace.on('theme', ({ dark }) => …);        // when the app's theme changes
```

A pane and a script share state through `zpace.storage` — the timer keeps counting with the pane closed because the script owns the clock.

## Rules

- Only text files, only what the plugin needs. No minified blobs — reviewers read the code.
- Declare every permission the script uses. Undeclared calls fail.
- Say what the plugin sends where. A plugin that phones home without saying so is removed.
- Be nice in the review thread; this is a small community.

MIT. By publishing here you license your plugin under MIT too.
