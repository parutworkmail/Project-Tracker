# Diagrams

Source files are Mermaid (`.mmd`). Rendered `.png` images are committed
alongside them so `docs/FEATURES.md` displays correctly on GitHub without
requiring a Mermaid renderer.

## Files

- `usecase-superadmin.mmd` / `.png` — everything a SUPER_ADMIN can do.
- `usecase-admin.mmd` / `.png` — everything an ADMIN can do (note: only on
  projects they've been assigned to; identical to USER elsewhere).
- `usecase-user.mmd` / `.png` — everything a normal USER can do.
- `flow-project-lifecycle.mmd` / `.png` — a project from creation to
  deletion.
- `sequence-login.mmd` / `.png` — the exact login flow, including every
  error path (rate limit, DB unavailable, account lockout, wrong
  password, forced password change).

## Regenerating after a change

Edit the `.mmd` source, then re-render with:

```bash
npx -y @mermaid-js/mermaid-cli -i docs/diagrams/<name>.mmd -o docs/diagrams/<name>.png -b white --scale 2 -p docs/diagrams/puppeteer-config.json
```

`puppeteer-config.json` disables Chrome's sandbox (`--no-sandbox`), which
this environment's headless Chrome needs to avoid a `Network.enable
timed out` error. If you're rendering somewhere Chrome runs normally,
you likely don't need the `-p` flag at all.
