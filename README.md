# HTML Viewer

An [Obsidian](https://obsidian.md) plugin that renders `.html` and `.htm` files directly inside Obsidian using a sandboxed iframe.

## Features

- Opens `.html` / `.htm` files in a dedicated viewer pane automatically
- Resolves local resources (images, stylesheets, scripts) relative to the vault
- Toolbar with **Refresh**, **View Source**, and **Open Externally** buttons
- Status bar showing current JS mode and render mode
- Live reload when the file is modified
- Content Security Policy (CSP) injected on every render to prevent data exfiltration

## Settings

| Setting | Default | Description |
|---|---|---|
| Enable JavaScript | Off | Allow scripts to run inside HTML views |
| Allow external resources | Off | Load images/fonts/media from `http`/`https` URLs |
| Allow forms | Off | Allow form submission inside HTML views |
| Trusted folders | _(empty)_ | Comma-separated folder paths where JS is always enabled, overriding the global toggle |

## Installation

### From the community plugin list

1. Open **Settings → Community plugins → Browse**
2. Search for **HTML Viewer** and install

### Manual

Copy `main.js`, `styles.css`, and `manifest.json` into `<vault>/.obsidian/plugins/html-viewer/`.

## Development

```bash
npm i
npm run dev   # watch mode
```

Requires Node.js ≥ 16. Run `npm run lint` to check code quality.
