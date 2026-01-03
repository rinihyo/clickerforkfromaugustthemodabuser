# Clicker :3

Real-time click broadcaster using Cloudflare Workers + Durable Objects.

## Pages

- `/` - Client page (enter name, receive clicks)
- `/local` - Local clicker (just plays sound on tap)
- `/admin` - Admin panel (trigger clicks, see connected users)

## Setup

```bash
bun install
```

Create `.dev.vars`:

```
ADMIN_PASSWORD=your-password
SLACK_TOKEN=xoxb-your-slack-bot-token
SLACK_CHANNEL=C0123456789
```

## Development

```bash
bunx wrangler dev
```

## Deploy

```bash
bunx wrangler deploy
bunx wrangler secret put ADMIN_PASSWORD
bunx wrangler secret put SLACK_TOKEN
bunx wrangler secret put SLACK_CHANNEL
```


---

pretty much fully made with amp
