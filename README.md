# Clicker :3

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
