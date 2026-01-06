# Clicker :3

## Setup

Access the web client at [clicker.jer.app](https://clicker.jer.app).

Desktop builds are on [GitHub Releases](https://github.com/jeremy46231/clicker/releases/tag/nightly), built via Actions from the `main` branch:

- [macOS (dmg)](https://github.com/jeremy46231/clicker/releases/download/nightly/clicker.dmg)
- [Windows (exe)](https://github.com/jeremy46231/clicker/releases/download/nightly/clicker.exe)
- [Windows (msi)](https://github.com/jeremy46231/clicker/releases/download/nightly/clicker.msi)
- [Linux (AppImage)](https://github.com/jeremy46231/clicker/releases/download/nightly/clicker.AppImage)
- [Linux (deb)](https://github.com/jeremy46231/clicker/releases/download/nightly/clicker.deb)

Add the following line of JavaScript or HTML to your site to embed a clicker client:

```js
import('https://clicker.jer.app/clicker.js')
```

```html
<script src="https://clicker.jer.app/clicker.js"></script>
```

Optionally, at any time (before or after loading the script), set `window._username` to any useful display name to identify the user.

## Structure

```
clicker/
├── client/     # Shared frontend (Vite + TypeScript)
├── web/        # Cloudflare Worker backend
└── desktop/    # Tauri desktop app shell
```

## Development

### Frontend

Runs just the frontend on [`localhost:1420`](http://localhost:1420), using production backend, hot reloaded.

```bash
bun run dev:client
```

### Fullstack

Runs the frontend with local Miniflare worker backend on [`localhost:1420`](http://localhost:1420).

First, start the client build watcher in one terminal:

```bash
bun run watch:client
```

Then, run the web backend in another terminal:

```bash
bun run dev:web
```

### Desktop

Runs the Tauri desktop app shell with embedded frontend, rebuilding on changes.

```bash
bun run dev:desktop
```

## Deploy

### Web

```bash
bun run deploy:web
```

Set secrets:

```bash
cd web
bunx wrangler secret put ADMIN_PASSWORD
bunx wrangler secret put SLACK_TOKEN
bunx wrangler secret put SLACK_CHANNEL
```

### Desktop

```bash
bun run build:desktop
```

## Pages

- `/` - Client page (enter name, receive clicks)
- `/local` - Local clicker (just plays sound on tap)
- `/admin` - Admin panel (trigger clicks, see connected users)

---

significantly made with amp/copilot :3
